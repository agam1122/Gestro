import os
import pickle
import mediapipe as mp
import cv2

mp_hands = mp.solutions.hands

hands = mp_hands.Hands(
    static_image_mode=True,
    max_num_hands=2,  # detect both hands
    min_detection_confidence=0.3
)

DATA_DIR = './data'

data = []
labels = []

for dir_ in os.listdir(DATA_DIR):

    # Skip hidden files and non-directories
    if dir_.startswith('.') or not os.path.isdir(os.path.join(DATA_DIR, dir_)):
        continue

    folder_path = os.path.join(DATA_DIR, dir_)

    for img_path in os.listdir(folder_path):

        # Skip hidden files
        if img_path.startswith('.'):
            continue

        image_path = os.path.join(folder_path, img_path)

        img = cv2.imread(image_path)

        if img is None:
            continue

        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

        results = hands.process(img_rgb)

        data_aux = []

        if results.multi_hand_landmarks:

            # Sort hands left to right for consistency
            hand_landmarks_list = sorted(
                results.multi_hand_landmarks,
                key=lambda hand: min([lm.x for lm in hand.landmark])
            )

            for hand_landmarks in hand_landmarks_list:

                hand_features = []

                for landmark in hand_landmarks.landmark:
                    hand_features.append(landmark.x)
                    hand_features.append(landmark.y)

                data_aux.extend(hand_features)

            # Pad if only one hand detected
            while len(data_aux) < 84:
                data_aux.append(0)

            data.append(data_aux)
            labels.append(dir_)

    print(f"{dir_} completed")

with open('data.pickle', 'wb') as f:
    pickle.dump({
        'data': data,
        'labels': labels
    }, f)

print("Dataset saved successfully!")