import pickle
import warnings
import cv2
import mediapipe as mp
import numpy as np
from collections import Counter

warnings.filterwarnings("ignore")

# ==========================
# Load trained model & encoder
# ==========================

model_dict = pickle.load(open('./model.p', 'rb'))
model = model_dict['model']
label_encoder = model_dict['label_encoder']  # Crucial for converting int -> str

# ==========================
# Webcam
# ==========================

cap = cv2.VideoCapture(0)

# ==========================
# MediaPipe Setup
# ==========================

mp_hands = mp.solutions.hands
mp_drawing = mp.solutions.drawing_utils
mp_drawing_styles = mp.solutions.drawing_styles

hands = mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=2,
    min_detection_confidence=0.3
)

# ==========================
# Sentence Logic
# ==========================

current_sentence = ""
last_confirmed_prediction = ""

prediction_history = []
frames_to_confirm = 20
last_printed_hands = -1

while True:

    ret, frame = cap.read()

    if not ret:
        break

    frame = cv2.flip(frame, 1)
    h, w, _ = frame.shape
    frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = hands.process(frame_rgb)

    if results.multi_hand_landmarks:

        # Containers to hold clean coordinates for feature matching
        raw_x = []
        raw_y = []
        
        # Track bounding box visual limits
        bbox_x = []
        bbox_y = []

        # ==========================
        # Sort hands left → right
        # ==========================

        hand_landmarks_list = sorted(
            results.multi_hand_landmarks,
            key=lambda hand: min([lm.x for lm in hand.landmark])
        )[:2]

        # ==========================
        # Draw hands + collect features
        # ==========================

        for hand_landmarks in hand_landmarks_list:

            mp_drawing.draw_landmarks(
                frame,
                hand_landmarks,
                mp_hands.HAND_CONNECTIONS,
                mp_drawing_styles.get_default_hand_landmarks_style(),
                mp_drawing_styles.get_default_hand_connections_style()
            )

            for landmark in hand_landmarks.landmark:
                raw_x.append(landmark.x)
                raw_y.append(landmark.y)
                
                # Keep original pixel scale coordinates strictly for drawing UI
                bbox_x.append(landmark.x)
                bbox_y.append(landmark.y)

        # If only 1 hand is visible, we pad the raw arrays with 21 zeros 
        # to preserve the structure before running our normalization logic
        if len(hand_landmarks_list) == 1:
            raw_x.extend([0.0] * 21)
            raw_y.extend([0.0] * 21)

        # Convert to numpy arrays for streamlined index calculations
        x_coords = np.array(raw_x, dtype=np.float32)
        y_coords = np.array(raw_y, dtype=np.float32)

        # =======================================================
        # LIVE DATA WRIST NORMALIZATION (Matches Training Pipeline)
        # =======================================================
        # Normalize Hand 1 relative to its wrist (index 0)
        x_coords[0:21] -= x_coords[0]
        y_coords[0:21] -= y_coords[0]
        
        # Normalize Hand 2 relative to its wrist (index 21) if hand 2 is present
        # If Hand 2 was missing, index 21 is a padded 0.0, resulting in an automated safety pass
        x_coords[21:42] -= x_coords[21]
        y_coords[21:42] -= y_coords[21]

        # Interleave the normalized x and y points into [x1, y1, x2, y2...] layout
        processed_features = np.empty(84, dtype=np.float32)
        processed_features[0::2] = x_coords
        processed_features[1::2] = y_coords

        # ==========================
        # Bounding Box Math (Pixel Space)
        # ==========================

        x1 = int(min(bbox_x) * w) - 20
        y1 = int(min(bbox_y) * h) - 20
        x2 = int(max(bbox_x) * w) + 20
        y2 = int(max(bbox_y) * h) + 20

        # Prevent coordinates from bleeding off-screen limits
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(w, x2), min(h, y2)

        # ==========================
        # Predict & Decode Integer Label
        # ==========================

        prediction = model.predict([processed_features])
        
        # Transform integer encoding safely back to string token
        predicted_word = str(label_encoder.inverse_transform(prediction)[0])

        # ==========================
        # Prediction smoothing
        # ==========================

        prediction_history.append(predicted_word)

        if len(prediction_history) > frames_to_confirm:
            prediction_history.pop(0)

        most_common_prediction = Counter(prediction_history).most_common(1)[0][0]

        # Confirm prediction only if stable
        if prediction_history.count(most_common_prediction) == frames_to_confirm:
            if most_common_prediction != last_confirmed_prediction:
                current_sentence += most_common_prediction + " "
                last_confirmed_prediction = most_common_prediction

        print(predicted_word)

        # ==========================
        # Draw UI
        # ==========================

        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 3)

        cv2.putText(
            frame,
            predicted_word, # Standardized python string text argument safely loaded
            (x1, y1 - 10),
            cv2.FONT_HERSHEY_SIMPLEX,
            1,
            (0, 255, 0),
            3,
            cv2.LINE_AA
        )

    else:
        # Reset so same word can be repeated when hands drop out of frame
        last_confirmed_prediction = ""
        prediction_history = []

    # ==========================
    # Status display
    # ==========================
    num_hands = len(results.multi_hand_landmarks) if results.multi_hand_landmarks else 0
    if num_hands != last_printed_hands:
        print(f"Hand detection status: {num_hands} hand(s) in frame", flush=True)
        last_printed_hands = num_hands
    status_text = f"Hands detected: {num_hands}"
    cv2.putText(
        frame,
        status_text,
        (20, 40),
        cv2.FONT_HERSHEY_SIMPLEX,
        1.0,
        (0, 0, 255) if num_hands == 0 else (0, 255, 0),
        2,
        cv2.LINE_AA
    )

    # ==========================
    # Sentence display
    # ==========================

    cv2.rectangle(frame, (0, h - 90), (w, h), (0, 0, 0), -1)

    cv2.putText(
        frame,
        f"Sentence: {current_sentence}",
        (20, h - 30),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.9,
        (255, 255, 255),
        2
    )

    cv2.imshow('frame', frame)

    key = cv2.waitKey(25) & 0xFF

    # Backspace/Delete (Mac Delete = 127, Windows Backspace = 8)
    if key == 8 or key == 127:
        words = current_sentence.strip().split()
        if len(words) > 0:
            words.pop()
        current_sentence = " ".join(words)
        if current_sentence:
            current_sentence += " "

    elif key == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()