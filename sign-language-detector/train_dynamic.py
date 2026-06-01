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
        return self.data[idx], self.labels[idx]

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
    hidden_dim = 128
    num_layers = 2
    batch_size = 16 if os.path.exists(pickle_path) else 32
    epochs = 15 if os.path.exists(pickle_path) else 5
    learning_rate = 0.001

    # Device configuration
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Training on device: {device}")

    # Dataset & Dataloaders
    train_dataset = SignSequenceDataset(pickle_path=pickle_path, is_train=True)
    val_dataset = SignSequenceDataset(pickle_path=pickle_path, is_train=False)

    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False)


    # Initialize model, loss and optimizer
    model = DynamicSignLSTM(
        input_dim=input_dim, 
        hidden_dim=hidden_dim, 
        num_layers=num_layers, 
        num_classes=num_classes
    ).to(device)

    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=learning_rate)

    # Training Loop
    for epoch in range(epochs):
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
        print(f"Epoch [{epoch+1}/{epochs}] - Loss: {epoch_loss:.4f}, Accuracy: {epoch_acc:.2f}%")

    # Save model weights
    torch.save(model.state_dict(), 'lstm_sign_model.pth')
    print("PyTorch Dynamic Sign LSTM Model saved as 'lstm_sign_model.pth'")

if __name__ == "__main__":
    train_model()
