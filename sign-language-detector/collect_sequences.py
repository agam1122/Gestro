import os
import cv2
import pickle
import numpy as np
import mediapipe as mp
import time

"""
Dynamic Sign Language Sequence Collector.
Supports appending new gesture classes to an existing sequences.pickle file
without losing previously recorded data (e.g., HELLO, THANK_YOU, PLEASE).
"""

# Define MediaPipe Hands components
mp_hands = mp.solutions.hands
hands = mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=2,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
)

# Configuration
NUM_SEQUENCES = 30  # Number of training samples per gesture
SEQUENCE_LENGTH = 30 # Number of consecutive frames per gesture (1 second at 30fps)
FEATURE_DIM = 84    # 2 hands * 21 landmarks * 2 coordinates (x, y)

print("=== GESTRO DYNAMIC DATA COLLECTOR ===")

# ==========================
# 1. Load Existing Dataset (If Any)
# ==========================
existing_data = None
existing_labels = None
existing_classes = []
pickle_path = 'sequences.pickle'

if os.path.exists(pickle_path):
    try:
        with open(pickle_path, 'rb') as f:
            payload = pickle.load(f)
        existing_data = payload['data']        # Shape: (N, 30, 84)
        existing_labels = payload['labels']      # Shape: (N,)
        existing_classes = list(payload['classes'])
        print(f"\nFound existing dataset '{pickle_path}':")
        print(f"  - Existing Classes: {existing_classes}")
        print(f"  - Total Recorded Sequences: {existing_data.shape[0]}")
    except Exception as e:
        print(f"\nWarning: Failed to load '{pickle_path}' ({e}). Starting fresh.")
        existing_data = None
        existing_labels = None
        existing_classes = []

# ==========================
# 2. Select Collection Mode
# ==========================
mode = "2"
if existing_classes:
    print("\nChoose collection mode:")
    print("  [1] Append new gesture classes (keep existing HELLO, PLEASE, etc.)")
    print("  [2] Overwrite and start completely fresh")
    choice = input("Enter choice (1 or 2): ").strip()
    if choice == "1":
        mode = "1"

classes_to_record = []
recording_classes = list(existing_classes)

if mode == "1":
    # Append Mode
    print(f"\nCurrent classes: {existing_classes}")
    new_words_input = input("Enter new gesture name(s) to record, separated by commas (e.g. HELP, SORRY, YES): ").strip()
    new_classes = [w.strip().upper() for w in new_words_input.split(',') if w.strip()]
    
    if not new_classes:
        print("No valid new gestures entered. Exiting.")
        exit()
        
    for nc in new_classes:
        if nc in existing_classes:
            print(f"  -> Skipping '{nc}': already exists in dataset.")
        else:
            classes_to_record.append(nc)
            recording_classes.append(nc)
            
    if not classes_to_record:
        print("No new gestures to record. Exiting.")
        exit()
else:
    # Overwrite/Fresh Mode
    print("\nStarting fresh dataset.")
    words_input = input("Enter gesture names to record from scratch, separated by commas (default: HELLO, THANK_YOU, PLEASE): ").strip()
    if words_input:
        classes_to_record = [w.strip().upper() for w in words_input.split(',') if w.strip()]
    else:
        classes_to_record = ['HELLO', 'THANK_YOU', 'PLEASE']
    recording_classes = list(classes_to_record)

print(f"\nGestures to be recorded now: {classes_to_record}")
print(f"Target dataset final classes will be: {recording_classes}")

# ==========================
# 3. Setup Webcam & Recording Loop
# ==========================
cap = cv2.VideoCapture(0)
if not cap.isOpened():
    print("Error: Could not access webcam. Check privacy permissions in System Settings.")
    exit()

all_sequences = []
all_labels = []

for label in classes_to_record:
    label_idx = recording_classes.index(label)
    print(f"\n--------------------------------------------------")
    print(f"Prepare to collect data for gesture: '{label}' (Class Index: {label_idx})")
    print(f"--------------------------------------------------")
    
    # Wait for user input to start this class
    while True:
        ret, frame = cap.read()
        if not ret: continue
        frame = cv2.flip(frame, 1)
        cv2.putText(frame, f'Collect "{label}". Press "S" to Start!', (50, 50),
                    cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 255, 0), 2, cv2.LINE_AA)
        cv2.imshow('Gestro Sequence Collector', frame)
        if cv2.waitKey(1) & 0xFF == ord('s'):
            break

    # Loop to capture multiple sequences
    for seq_idx in range(NUM_SEQUENCES):
        sequence_buffer = []
        print(f"Recording Sequence {seq_idx + 1}/{NUM_SEQUENCES} in 3 seconds...")
        
        # Countdown overlay
        for countdown in [3, 2, 1]:
            t_end = time.time() + 1.0
            while time.time() < t_end:
                ret, frame = cap.read()
                if not ret: continue
                frame = cv2.flip(frame, 1)
                cv2.putText(frame, f'Get Ready for "{label}": {countdown}', (120, 250),
                            cv2.FONT_HERSHEY_SIMPLEX, 1.3, (0, 0, 255), 3, cv2.LINE_AA)
                cv2.imshow('Gestro Sequence Collector', frame)
                cv2.waitKey(1)

        # Collect SEQUENCE_LENGTH consecutive frames
        frame_counter = 0
        while frame_counter < SEQUENCE_LENGTH:
            ret, frame = cap.read()
            if not ret: continue
            frame = cv2.flip(frame, 1)
            h, w, c = frame.shape
            
            # Extract hand features using MediaPipe
            img_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = hands.process(img_rgb)
            
            frame_features = []
            if results.multi_hand_landmarks:
                # Sort hands left to right
                sorted_landmarks = sorted(
                    results.multi_hand_landmarks,
                    key=lambda hand: min([lm.x for lm in hand.landmark])
                )[:2]
                
                # Extract coordinates
                for hand_landmarks in sorted_landmarks:
                    for lm in hand_landmarks.landmark:
                        frame_features.append(lm.x)
                        frame_features.append(lm.y)
                        
                # Pad if only 1 hand is detected
                if len(sorted_landmarks) == 1:
                    frame_features.extend([0.0] * 42)
            else:
                # Pad zero features if no hands are visible
                frame_features.extend([0.0] * 84)

            # Ensure strict feature size (84 dimensions)
            frame_features = frame_features[:84]
            while len(frame_features) < 84:
                frame_features.append(0.0)

            # Wrist Normalization (Feature Engineering)
            # Normalize Hand 1 relative to wrist (index 0)
            base_1_x, base_1_y = frame_features[0], frame_features[1]
            for i in range(21):
                frame_features[i*2] -= base_1_x
                frame_features[i*2 + 1] -= base_1_y
                
            # Normalize Hand 2 relative to wrist (index 21)
            base_2_x, base_2_y = frame_features[42], frame_features[43]
            for i in range(21, 42):
                frame_features[i*2] -= base_2_x
                frame_features[i*2 + 1] -= base_2_y

            sequence_buffer.append(frame_features)
            
            # Visual feedback on recording progress
            cv2.putText(frame, f'RECORDING "{label}": {frame_counter + 1}/{SEQUENCE_LENGTH}', (50, 50),
                        cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 0, 255), 2, cv2.LINE_AA)
            cv2.imshow('Gestro Sequence Collector', frame)
            cv2.waitKey(1)
            frame_counter += 1

        all_sequences.append(sequence_buffer)
        all_labels.append(label_idx) # Map to correct class index
        print(f"Sequence {seq_idx + 1} captured successfully.")

cap.release()
cv2.destroyAllWindows()

# ==========================
# 4. Save and Merge Datasets
# ==========================
new_data_arr = np.array(all_sequences, dtype=np.float32)
new_labels_arr = np.array(all_labels, dtype=np.int64)

if existing_data is not None:
    # Concatenate along the sample axis (axis 0)
    combined_data = np.concatenate([existing_data, new_data_arr], axis=0)
    combined_labels = np.concatenate([existing_labels, new_labels_arr], axis=0)
else:
    combined_data = new_data_arr
    combined_labels = new_labels_arr

payload = {
    'data': combined_data,
    'labels': combined_labels,
    'classes': recording_classes
}

with open(pickle_path, 'wb') as f:
    pickle.dump(payload, f)

print("\n=== DATA COLLECTION & MERGE COMPLETE ===")
print(f"Saved database path: '{pickle_path}'")
print(f"Final Class Labels: {recording_classes}")
print(f"Final Data Matrix Shape: {combined_data.shape} (Total Sequences, Frames per seq, Coordinates per frame)")
print(f"Final Labels Vector Shape: {combined_labels.shape}")
print("You are ready to train the PyTorch LSTM on the updated classes list!")
