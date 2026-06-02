import os
import pickle
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
from sklearn.model_selection import train_test_split
from dynamic_sign_model import DynamicSignLSTM

class SignSequenceDataset(Dataset):
    """
    Custom PyTorch Dataset for sign sequences.
    Loads real dynamic gesture coordinate arrays if sequences.pickle exists.
    Otherwise, generates dummy validation data.
    """
    def __init__(self, pickle_path='./sequences.pickle', is_train=True):
        self.is_train = is_train
        if os.path.exists(pickle_path):
            print(f"Loading real sequence data from {pickle_path}...")
            with open(pickle_path, 'rb') as f:
                payload = pickle.load(f)
            
            data_raw = payload['data'] # shape: (num_samples, 30, 84)
            labels_raw = payload['labels'] # shape: (num_samples,)
            
            # Split dataset into 80% train and 20% validation
            x_train, x_val, y_train, y_val = train_test_split(
                data_raw, labels_raw, test_size=0.2, random_state=42, stratify=labels_raw
            )
            
            if is_train:
                self.data = torch.tensor(x_train, dtype=torch.float32)
                self.labels = torch.tensor(y_train, dtype=torch.long)
            else:
                self.data = torch.tensor(x_val, dtype=torch.float32)
                self.labels = torch.tensor(y_val, dtype=torch.long)
        else:
            print("Warning: sequences.pickle not found. Generating dummy validation dataset.")
            # Default shapes for compile validation
            num_samples = 800 if is_train else 200
            self.data = torch.randn(num_samples, 30, 84)
            self.labels = torch.randint(0, 3, (num_samples,)) # 3 default classes

    def __len__(self):
        return len(self.data)

    def __getitem__(self, idx):
        x = self.data[idx]
        y = self.labels[idx]
        
        # Apply augmentation only during training to regularize
        if self.is_train:
            # 1. Coordinate Jittering (adds tiny Gaussian noise)
            noise = torch.randn_like(x) * 0.005
            x = x + noise
            
            # 2. Temporal scaling/jittering (shifts sequence slightly in time with 50% probability)
            if torch.rand(1).item() < 0.5:
                shift = torch.randint(-2, 3, (1,)).item()
                if shift > 0:
                    x = torch.cat([x[0].repeat(shift, 1), x[:-shift]], dim=0)
                elif shift < 0:
                    x = torch.cat([x[-shift:], x[-1].repeat(-shift, 1)], dim=0)
                    
        return x, y

def train_model():
    pickle_path = './sequences.pickle'
    num_classes = 3
    if os.path.exists(pickle_path):
        with open(pickle_path, 'rb') as f:
            payload = pickle.load(f)
        num_classes = len(payload['classes'])
        print(f"Detected {num_classes} classes from sequences.pickle: {payload['classes']}")
        
    # Configurations
    input_dim = 84
    hidden_dim = 64   # Simpler model structure reduces overfitting on small datasets
    num_layers = 2
    batch_size = 16 if os.path.exists(pickle_path) else 32
    epochs = 50 if os.path.exists(pickle_path) else 5
    learning_rate = 0.001
    weight_decay = 1e-4  # L2 Regularization to prevent extreme weights

    # Device configuration
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Training on device: {device}")

    # Dataset & Dataloaders
    train_dataset = SignSequenceDataset(pickle_path=pickle_path, is_train=True)
    val_dataset = SignSequenceDataset(pickle_path=pickle_path, is_train=False)

    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False)

    # Initialize model with increased dropout (0.4) for better regularization
    model = DynamicSignLSTM(
        input_dim=input_dim, 
        hidden_dim=hidden_dim, 
        num_layers=num_layers, 
        num_classes=num_classes,
        dropout=0.4
    ).to(device)

    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=learning_rate, weight_decay=weight_decay)
    
    # Learning rate scheduler (halves the LR when validation loss flattens for 4 epochs)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode='min', factor=0.5, patience=4)

    best_val_loss = float('inf')
    early_stopping_patience = 10
    epochs_no_improve = 0

    # Training Loop
    for epoch in range(epochs):
        # 1. Training Phase
        model.train()
        running_loss = 0.0
        correct_preds = 0
        total_samples = 0

        for inputs, targets in train_loader:
            inputs, targets = inputs.to(device), targets.to(device)
            
            # Forward pass
            outputs = model(inputs)
            loss = criterion(outputs, targets)
            
            # Backward and optimize
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            
            running_loss += loss.item() * inputs.size(0)
            _, predicted = torch.max(outputs, 1)
            correct_preds += (predicted == targets).sum().item()
            total_samples += targets.size(0)

        epoch_loss = running_loss / total_samples
        epoch_acc = (correct_preds / total_samples) * 100

        # 2. Validation Phase
        model.eval()
        val_running_loss = 0.0
        val_correct_preds = 0
        val_total_samples = 0

        with torch.no_grad():
            for val_inputs, val_targets in val_loader:
                val_inputs, val_targets = val_inputs.to(device), val_targets.to(device)
                val_outputs = model(val_inputs)
                val_loss = criterion(val_outputs, val_targets)

                val_running_loss += val_loss.item() * val_inputs.size(0)
                _, val_predicted = torch.max(val_outputs, 1)
                val_correct_preds += (val_predicted == val_targets).sum().item()
                val_total_samples += val_targets.size(0)

        val_epoch_loss = val_running_loss / val_total_samples
        val_epoch_acc = (val_correct_preds / val_total_samples) * 100

        print(f"Epoch [{epoch+1}/{epochs}] - Train Loss: {epoch_loss:.4f}, Train Acc: {epoch_acc:.2f}% | Val Loss: {val_epoch_loss:.4f}, Val Acc: {val_epoch_acc:.2f}%")

        # Step scheduler
        scheduler.step(val_epoch_loss)

        # Check Early Stopping & Save Best Weights
        if val_epoch_loss < best_val_loss:
            best_val_loss = val_epoch_loss
            epochs_no_improve = 0
            torch.save(model.state_dict(), 'lstm_sign_model.pth')
            print(f"  --> Saved new best model weights (Val Loss: {val_epoch_loss:.4f})")
        else:
            epochs_no_improve += 1
            if epochs_no_improve >= early_stopping_patience:
                print(f"Early stopping triggered at epoch {epoch+1}. Restoring best weights.")
                break

    print("Training finished. Best model weights saved as 'lstm_sign_model.pth'")

if __name__ == "__main__":
    train_model()
