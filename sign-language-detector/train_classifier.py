import pickle
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.ensemble import RandomForestClassifier, StackingClassifier
from xgboost import XGBClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    classification_report
)

# ==========================
# 1. Load and Preprocess Data
# ==========================

data_dict = pickle.load(open('./data.pickle', 'rb'))

filtered_data = []
filtered_labels = []

# Target feature size (84 features means 2 hands * 21 landmarks * 2 coordinates [x, y])
TARGET_FEATURE_SIZE = 84 

for i in range(len(data_dict['data'])):
    if len(data_dict['data'][i]) == TARGET_FEATURE_SIZE:
        raw_coords = np.array(data_dict['data'][i], dtype=np.float32)
        
        # --- ADVANCED FEATURE ENGINEERING: WRIST NORMALIZATION ---
        x_coords = raw_coords[0::2]
        y_coords = raw_coords[1::2]
        
        # Normalize Hand 1 relative to its wrist (index 0)
        x_coords[0:21] -= x_coords[0]
        y_coords[0:21] -= y_coords[0]
        
        # Normalize Hand 2 relative to its wrist (index 21)
        x_coords[21:42] -= x_coords[21]
        y_coords[21:42] -= y_coords[21]
        
        # Re-interleave the normalized X and Y coordinates back to [x1, y1, x2, y2...]
        normalized_coords = np.empty(TARGET_FEATURE_SIZE, dtype=np.float32)
        normalized_coords[0::2] = x_coords
        normalized_coords[1::2] = y_coords
        
        filtered_data.append(normalized_coords)
        filtered_labels.append(data_dict['labels'][i])

data = np.asarray(filtered_data)
labels = np.asarray(filtered_labels)

print(f"Total valid samples: {len(data)}")
print(f"Feature size (Normalized): {data.shape[1]}")

# XGBoost and Stacking require integer encoded labels
label_encoder = LabelEncoder()
encoded_labels = label_encoder.fit_transform(labels)
classes_in_test = [str(c) for c in label_encoder.classes_]

# ==========================
# 2. Split Data
# ==========================

x_train, x_test, y_train, y_test = train_test_split(
    data,
    encoded_labels,
    test_size=0.2,
    shuffle=True,
    stratify=encoded_labels,
    random_state=12
)

# ==========================
# 3. Build & Train Stacking Classifier
# ==========================

print("\nInitializing Stacking Classifier Ensemble...")

# Step 3a: Define Base Models (Bagging + Boosting)
base_models = [
    ('rf', RandomForestClassifier(
        n_estimators=200,
        max_depth=25,
        min_samples_split=2,
        min_samples_leaf=1,
        random_state=41,
        n_jobs=-1
    )),
    ('xgb', XGBClassifier(
        n_estimators=150,
        max_depth=8,
        learning_rate=0.1,
        eval_metric='mlogloss',
        random_state=41,
        n_jobs=-1
    ))
]

# Step 3b: Define Final Meta-Learner
# Max_iter is increased to ensure convergence across multi-class boundary evaluations
meta_learner = LogisticRegression(max_iter=1000, random_state=41)

# Step 3c: Combine into a Stacked Pipeline
stacked_model = StackingClassifier(
    estimators=base_models,
    final_estimator=meta_learner,
    cv=5,                      # 5-Fold cross-validation for clean meta-feature generation
    passthrough=False,         # Meta-learner trains strictly on the predictions of base models
    n_jobs=-1                  # Parallel processing execution
)

print("Training base estimators and final meta-learner (this may take a moment)...")
stacked_model.fit(x_train, y_train)

# ==========================
# 4. Evaluate Ensemble Model
# ==========================

y_predict = stacked_model.predict(x_test)
score = accuracy_score(y_test, y_predict)

print(f"\nStacked Ensemble Validation Accuracy: {score * 100:.2f}%")

# ==========================
# 5. Confusion Matrix Generation
# ==========================

cm = confusion_matrix(y_test, y_predict)

plt.figure(figsize=(14, 10))
sns.heatmap(
    cm,
    annot=True,
    fmt='d',
    cmap='Blues',
    xticklabels=classes_in_test,
    yticklabels=classes_in_test
)

plt.title('Sign Language Detector (Stacked Ensemble) - Confusion Matrix')
plt.xlabel('Predicted')
plt.ylabel('Actual')
plt.tight_layout()
plt.savefig('confusion_matrix_results.png')
plt.close()

print("\nConfusion matrix saved as: confusion_matrix_results.png")

# ==========================
# 6. Classification Report
# ==========================

print("\nClassification Report:\n")
print(
    classification_report(
        y_test,
        y_predict,
        target_names=classes_in_test
    )
)

# ==========================
# 7. Save Model & Encoders
# ==========================

payload = {
    'model': stacked_model,
    'label_encoder': label_encoder,
    'model_name': "Stacked_RF_XGBoost"
}

with open('model.p', 'wb') as f:
    pickle.dump(payload, f)

print("\nSuccess! Combined Stacked Ensemble and Label Encoder saved to 'model.p'")