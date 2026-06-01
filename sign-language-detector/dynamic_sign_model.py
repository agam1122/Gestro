import torch
import torch.nn as nn

class DynamicSignLSTM(nn.Module):
    """
    Spatial-Temporal Sign Language Recognition Model.
    Processes sequences of 84-dimensional hand landmark coordinates
    over a temporal window (e.g., 30 frames) to predict dynamic sign gestures.
    """
    def __init__(self, input_dim=84, hidden_dim=128, num_layers=2, num_classes=28, dropout=0.3):
        super(DynamicSignLSTM, self).__init__()
        
        self.hidden_dim = hidden_dim
        self.num_layers = num_layers
        
        # LSTM Recurrent Layer to capture temporal dependencies
        self.lstm = nn.LSTM(
            input_size=input_dim,
            hidden_size=hidden_dim,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0.0,
            bidirectional=True
        )
        
        # Batch Normalization for feature stabilization
        self.batch_norm = nn.BatchNorm1d(hidden_dim * 2)
        
        # Fully Connected Layer for classification
        self.fc = nn.Sequential(
            nn.Linear(hidden_dim * 2, 64),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(64, num_classes)
        )

    def forward(self, x):
        # x shape: [batch_size, sequence_length, input_dim]
        # h0, c0 initialization (defaults to zeros if not provided)
        lstm_out, (hn, cn) = self.lstm(x)
        
        # Extract features from the last time step of the bidirectional LSTM
        # Shape of lstm_out: [batch_size, sequence_length, hidden_dim * 2]
        out_last = lstm_out[:, -1, :]
        
        # Apply Batch Normalization
        out_norm = self.batch_norm(out_last)
        
        # Classification logits
        logits = self.fc(out_norm)
        
        return logits

if __name__ == "__main__":
    # Test model initialization and dummy forward pass
    batch_size = 4
    sequence_length = 30 # 30 frames window (1 second of signing at 30 fps)
    input_dim = 84       # 2 hands * 21 landmarks * 2 coordinates (x, y)
    num_classes = 28     # A-Z, SPACE, NOTHING
    
    model = DynamicSignLSTM(input_dim=input_dim, num_classes=num_classes)
    
    dummy_input = torch.randn(batch_size, sequence_length, input_dim)
    output = model(dummy_input)
    
    print("LSTM Sign Model Initialized successfully.")
    print("Input shape:", dummy_input.shape)
    print("Output Logits shape:", output.shape)
