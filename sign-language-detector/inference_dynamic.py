import os
import cv2
import pickle
import numpy as np
import mediapipe as mp
import torch
from collections import Counter
from dynamic_sign_model import DynamicSignLSTM

"""
Gestro Dynamic Sign Language Real-Time Inference.
Reads frames from your webcam, tracks coordinates, maintains a sliding
window of 30 frames, and classifies gestures using the PyTorch LSTM model.
"""

# ==========================
# 1. Load Classes and Initialize Model
# ==========================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
pickle_path = os.path.join(BASE_DIR, 'sequences.pickle')
pth_path = os.path.join(BASE_DIR, 'lstm_sign_model.pth')

if os.path.exists(pickle_path):
    with open(pickle_path, 'rb') as f:
        payload = pickle.load(f)
    CLASSES = payload['classes']
    print(f"Loaded classes from {pickle_path}: {CLASSES}")
else:
    CLASSES = ['HELLO', 'THANK_YOU', 'PLEASE']
    print(f"sequences.pickle not found. Defaulting to: {CLASSES}")

num_classes = len(CLASSES)
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

model = DynamicSignLSTM(input_dim=84, num_classes=num_classes).to(device)

if os.path.exists(pth_path):
    model.load_state_dict(torch.load(pth_path, map_location=device))
    model.eval()
    print(f"Successfully loaded PyTorch LSTM weights from '{pth_path}'")
else:
    print(f"Error: Model weights file '{pth_path}' not found! Run train_dynamic.py first.")
    exit()

# ==========================
# 2. MediaPipe and OpenCV Setup
# ==========================
mp_hands = mp.solutions.hands
mp_drawing = mp.solutions.drawing_utils
mp_drawing_styles = mp.solutions.drawing_styles

hands = mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=2,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
)

cap = cv2.VideoCapture(0)
if not cap.isOpened():
    print("Error: Could not open camera.")
    exit()

# Sliding Window Buffer and Prediction Tracking
sequence_buffer = []
prediction_history = []
frames_to_smooth = 10
current_sentence = []
last_confirmed_gesture = ""

print("\n=== STARTING REAL-TIME DYNAMIC INFERENCE ===")
print("Keep hands in frame. Press 'q' to quit.")

while True:
    ret, frame = cap.read()
    if not ret:
        break

    frame = cv2.flip(frame, 1)
    h, w, c = frame.shape
    img_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = hands.process(img_rgb)

    frame_features = []
    
    if results.multi_hand_landmarks:
        # Sort hands left-to-right
        sorted_landmarks = sorted(
            results.multi_hand_landmarks,
            key=lambda hand: min([lm.x for lm in hand.landmark])
        )[:2]

        # Draw hand landmarks
        for hand_landmarks in sorted_landmarks:
            mp_drawing.draw_landmarks(
                frame,
                hand_landmarks,
                mp_hands.HAND_CONNECTIONS,
                mp_drawing_styles.get_default_hand_landmarks_style(),
                mp_drawing_styles.get_default_hand_connections_style()
            )

            for lm in hand_landmarks.landmark:
                frame_features.append(lm.x)
                frame_features.append(lm.y)

        # Pad if only 1 hand is detected
        if len(sorted_landmarks) == 1:
            frame_features.extend([0.0] * 42)
    else:
        # Pad zeros if no hands are visible
        frame_features.extend([0.0] * 84)

    # Clean up dimensions
    frame_features = frame_features[:84]
    while len(frame_features) < 84:
        frame_features.append(0.0)

    # Wrist Normalization
    # Hand 1 normalization (index 0)
    base_1_x, base_1_y = frame_features[0], frame_features[1]
    for i in range(21):
        frame_features[i*2] -= base_1_x
        frame_features[i*2 + 1] -= base_1_y
        
    # Hand 2 normalization (index 21)
    base_2_x, base_2_y = frame_features[42], frame_features[43]
    for i in range(21, 42):
        frame_features[i*2] -= base_2_x
        frame_features[i*2 + 1] -= base_2_y

    # Append to sequence buffer
    sequence_buffer.append(frame_features)
    if len(sequence_buffer) > 30:
        sequence_buffer.pop(0)

    predicted_gesture = "Buffering..."
    
    # Run prediction once window is full
    if len(sequence_buffer) == 30:
        # Prepare inputs: shape [1, 30, 84]
        sequence_tensor = torch.tensor([sequence_buffer], dtype=torch.float32).to(device)
        
        with torch.no_grad():
            logits = model(sequence_tensor)
            prediction_idx = torch.argmax(logits, dim=1).item()
            
        predicted_gesture = CLASSES[prediction_idx]
        
        # Smooth predictions
        prediction_history.append(predicted_gesture)
        if len(prediction_history) > frames_to_smooth:
            prediction_history.pop(0)
            
        smoothed_gesture = Counter(prediction_history).most_common(1)[0][0]
        
        # Sentence construction logic
        if smoothed_gesture != last_confirmed_gesture and smoothed_gesture != "Buffering...":
            # If no hands are visible, don't trigger new words
            if results.multi_hand_landmarks:
                current_sentence.append(smoothed_gesture)
                last_confirmed_gesture = smoothed_gesture
    else:
        # Reset last confirmed gesture when hands are dropped out
        if not results.multi_hand_landmarks:
            last_confirmed_gesture = ""
            prediction_history = []

    # ==========================
    # Draw Info HUD
    # ==========================
    # Display buffering status or current prediction
    status_color = (0, 0, 255) if len(sequence_buffer) < 30 else (0, 255, 0)
    cv2.putText(
        frame,
        f"Prediction: {predicted_gesture}",
        (20, 50),
        cv2.FONT_HERSHEY_SIMPLEX,
        1.0,
        status_color,
        2,
        cv2.LINE_AA
    )
    
    # Display the queue status
    cv2.putText(
        frame,
        f"Buffer: {len(sequence_buffer)}/30 frames",
        (20, 90),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.7,
        (255, 255, 0),
        2,
        cv2.LINE_AA
    )

    # Display reconstructed sentence
    sentence_str = " ".join(current_sentence[-5:]) # Show last 5 gestures
    cv2.rectangle(frame, (0, h - 60), (w, h), (0, 0, 0), -1)
    cv2.putText(
        frame,
        f"Sentence: {sentence_str}",
        (20, h - 20),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.8,
        (255, 255, 255),
        2,
        cv2.LINE_AA
    )

    cv2.imshow('Gestro Dynamic Sign Recognition', frame)

    key = cv2.waitKey(25) & 0xFF
    if key == ord('q'):
        break
    elif key == ord('c'): # Press 'c' to clear current sentence
        current_sentence = []

cap.release()
cv2.destroyAllWindows()
print("Inference terminated cleanly.")