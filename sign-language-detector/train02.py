import pickle
import numpy as np

from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix
)

# =========================
# 1. LOAD DATA
# =========================

data_dict = pickle.load(open('./data.pickle', 'rb'))

raw_data = data_dict['data']
raw_labels = data_dict['labels']

processed_data = []
processed_labels = []

# =========================
# 2. PREPROCESSING
# =========================
# IMPORTANT:
# Convert landmarks to RELATIVE coordinates.
# This improves robustness against:
# - distance from camera
# - hand position
# - different users

for landmarks, label in zip(raw_data, raw_labels):

    # Ensure valid hand landmarks
    if len(landmarks) != 42:
        continue

    landmarks = np.array(landmarks)

    x = landmarks[0::2]
    y = landmarks[1::2]

    # Normalize relative to first landmark
    x = x - x[0]
    y = y - y[0]

    # Scale normalization
    max_value = max(
        np.max(np.abs(x)),
        np.max(np.abs(y))
    )

    if max_value != 0:
        x = x / max_value
        y = y / max_value

    normalized = []

    for xi, yi in zip(x, y):
        normalized.extend([xi, yi])

    processed_data.append(normalized)
    processed_labels.append(label)

data = np.asarray(processed_data)
labels = np.asarray(processed_labels)

print(f"Dataset Shape: {data.shape}")
print(f"Number of Classes: {len(np.unique(labels))}")

# =========================
# 3. TRAIN TEST SPLIT
# =========================

x_train, x_test, y_train, y_test = train_test_split(
    data,
    labels,
    test_size=0.2,
    stratify=labels,
    shuffle=True,
    random_state=42
)

# =========================
# 4. MODEL
# =========================

model = RandomForestClassifier(
    n_estimators=300,
    max_depth=30,
    min_samples_split=2,
    min_samples_leaf=1,
    max_features='sqrt',
    bootstrap=True,
    class_weight='balanced',
    random_state=42,
    n_jobs=-1
)

# =========================
# 5. TRAIN
# =========================

model.fit(x_train, y_train)

# =========================
# 6. CROSS VALIDATION
# =========================

cv_scores = cross_val_score(
    model,
    x_train,
    y_train,
    cv=5,
    scoring='accuracy'
)

print("\nCross Validation Accuracy:")
print(cv_scores)
print(f"Mean CV Accuracy: {cv_scores.mean() * 100:.2f}%")

# =========================
# 7. TEST EVALUATION
# =========================

y_pred = model.predict(x_test)

accuracy = accuracy_score(y_test, y_pred)

print(f"\nTest Accuracy: {accuracy * 100:.2f}%")

print("\nClassification Report:\n")
print(classification_report(y_test, y_pred))

# =========================
# 8. CONFIDENCE TEST
# =========================

probs = model.predict_proba(x_test)

max_probs = np.max(probs, axis=1)

print(f"\nAverage Prediction Confidence: {np.mean(max_probs)*100:.2f}%")

# =========================
# 9. SAVE MODEL
# =========================

with open('model.p', 'wb') as f:
    pickle.dump({
        'model': model
    }, f)

print("\nModel saved successfully!")