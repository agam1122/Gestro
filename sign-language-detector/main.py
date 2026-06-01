import os
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
import pickle
import numpy as np
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import warnings

warnings.filterwarnings("ignore")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"status": "ok", "message": "Gestro Sign Language Detector API is running!"}

# Load trained model lazily to ensure instant boot time (prevents Render healthcheck SIGKILL)
model = None
label_encoder = None
model_error = "Not initialized yet"

# Globally defined variables for PyTorch LSTM
lstm_model = None
dynamic_classes = None
lstm_model_error = "Not initialized yet"

def initialize_resources():
    global model, label_encoder, model_error
    global lstm_model, dynamic_classes, lstm_model_error
    
    # Load Scikit-Learn Classifier
    if model is None:
        print("Lazy-loading Scikit-Learn ML model...", flush=True)
        try:
            import xgboost  # Ensure xgboost is available for StackingClassifier unpickling
            import os
            BASE_DIR = os.path.dirname(os.path.abspath(__file__))
            model_path = os.path.join(BASE_DIR, 'model.p')
            print(f"Loading model from absolute path: {model_path}", flush=True)
            
            model_dict = pickle.load(open(model_path, 'rb'))
            model = model_dict['model']
            label_encoder = model_dict.get('label_encoder', None)
            print("Scikit-Learn Classifier loaded successfully!", flush=True)
            model_error = None
        except Exception as e:
            import traceback
            model_error = traceback.format_exc()
            print("Error loading model:", e, flush=True)
            traceback.print_exc()
            model = None
            label_encoder = None

    # Load PyTorch LSTM Model
    if lstm_model is None:
        print("Lazy-loading PyTorch LSTM model...", flush=True)
        try:
            import torch
            import os
            from dynamic_sign_model import DynamicSignLSTM
            BASE_DIR = os.path.dirname(os.path.abspath(__file__))
            
            # Read classes mapping from sequences.pickle
            pickle_path = os.path.join(BASE_DIR, 'sequences.pickle')
            if os.path.exists(pickle_path):
                with open(pickle_path, 'rb') as f:
                    payload = pickle.load(f)
                dynamic_classes = payload['classes']
                num_classes = len(dynamic_classes)
                print(f"Loaded dynamic classes from pickle: {dynamic_classes}", flush=True)
            else:
                dynamic_classes = ["HELLO", "THANK_YOU", "PLEASE"]
                num_classes = 3
                print(f"sequences.pickle not found. Defaulting to: {dynamic_classes}", flush=True)
                
            # Initialize LSTM structure
            print("Instantiating DynamicSignLSTM...", flush=True)
            lstm_model = DynamicSignLSTM(input_dim=84, num_classes=num_classes)
            print("DynamicSignLSTM instantiated.", flush=True)
            
            # Load weights if trained pth file exists
            pth_path = os.path.join(BASE_DIR, 'lstm_sign_model.pth')
            print(f"Checking if weights exist at {pth_path}...", flush=True)
            if os.path.exists(pth_path):
                print("Loading weights file...", flush=True)
                weights = torch.load(pth_path, map_location=torch.device('cpu'))
                print("Weights file loaded. Loading state dict...", flush=True)
                lstm_model.load_state_dict(weights)
                print("State dict loaded. Setting eval...", flush=True)
                lstm_model.eval()
                print("PyTorch Dynamic LSTM Model weights loaded successfully!", flush=True)
                lstm_model_error = None
            else:
                lstm_model_error = "lstm_sign_model.pth weight file not found"
                print(lstm_model_error, flush=True)
                lstm_model = None
        except Exception as e:
            import traceback
            lstm_model_error = traceback.format_exc()
            print("Error loading PyTorch LSTM:", e, flush=True)
            traceback.print_exc()
            lstm_model = None

@app.on_event("startup")
def startup_event():
    print("Application starting up... initializing models on main thread", flush=True)
    initialize_resources()

@app.get("/debug")
async def debug():
    initialize_resources()
    return {
        "sklearn_model_loaded": model is not None,
        "sklearn_model_error": model_error,
        "pytorch_lstm_loaded": lstm_model is not None,
        "pytorch_lstm_error": lstm_model_error,
        "dynamic_classes": dynamic_classes
    }


@app.websocket("/ws/detect")
async def detect_sign_language(websocket: WebSocket):
    await websocket.accept()
    print("Client connected to WebSocket", flush=True)
    
    try:
        while True:
            data = await websocket.receive_json()
            features = data.get("features", None)
            
            response_data = {"letter": None, "error": None}
            
            if model is None:
                response_data["error"] = "Classifier model not initialized yet"
                await websocket.send_json(response_data)
                continue
                
            if features is None:
                response_data["error"] = "No features array provided"
                await websocket.send_json(response_data)
                continue
                
            try:
                processed_features = np.array(features, dtype=np.float32)
                if len(processed_features) == 84:
                    prediction = model.predict([processed_features])
                    if label_encoder:
                        response_data["letter"] = str(label_encoder.inverse_transform(prediction)[0])
                    else:
                        response_data["letter"] = str(prediction[0])
                else:
                    response_data["error"] = f"Invalid features length: expected 84, got {len(processed_features)}"
                
                await websocket.send_json(response_data)
                
            except Exception as e:
                import traceback
                print(f"Error processing prediction: {e}", flush=True)
                traceback.print_exc()
                response_data["error"] = f"Prediction exception: {str(e)}"
                await websocket.send_json(response_data)
                
    except WebSocketDisconnect:
        print("Client disconnected", flush=True)
    except Exception as e:
        print(f"WebSocket connection error: {e}", flush=True)


@app.websocket("/ws/detect_dynamic")
async def detect_dynamic_sign(websocket: WebSocket):
    await websocket.accept()
    print("Client connected to Dynamic WebSocket", flush=True)
    
    # Track sequence of coordinates for this connection
    sequence_buffer = []
    
    try:
        while True:
            data = await websocket.receive_json()
            features = data.get("features", None)
            
            response_data = {"gesture": None, "error": None}
            
            if lstm_model is None:
                response_data["error"] = f"LSTM Model not initialized. Details: {lstm_model_error}"
                await websocket.send_json(response_data)
                continue
                
            if features is None:
                response_data["error"] = "No features array provided"
                await websocket.send_json(response_data)
                continue
                
            try:
                processed_features = np.array(features, dtype=np.float32)
                if len(processed_features) == 84:
                    # Append coordinates to sliding window queue
                    sequence_buffer.append(processed_features)
                    
                    # Maintain sliding window of size 30
                    if len(sequence_buffer) > 30:
                        sequence_buffer.pop(0)
                        
                    # Predict only when the sequence buffer is full (30 frames representing 1 second)
                    if len(sequence_buffer) == 30:
                        import torch
                        # Format sequence to PyTorch batch tensor: [batch_size, sequence_length, input_dim]
                        # Shape should be [1, 30, 84]
                        sequence_tensor = torch.tensor([sequence_buffer], dtype=torch.float32)
                        
                        lstm_model.eval() # Ensure evaluation mode to avoid batch norm training errors
                        with torch.no_grad():
                            logits = lstm_model(sequence_tensor)
                            prediction_idx = torch.argmax(logits, dim=1).item()
                            
                        if dynamic_classes and prediction_idx < len(dynamic_classes):
                            response_data["gesture"] = dynamic_classes[prediction_idx]
                        else:
                            response_data["gesture"] = f"Class {prediction_idx}"
                        response_data["letter"] = response_data["gesture"]
                    else:
                        # Return buffering status to client
                        response_data["gesture"] = f"BUFFERING: {len(sequence_buffer)}/30"
                        response_data["letter"] = response_data["gesture"]
                else:
                    response_data["error"] = f"Invalid features length: expected 84, got {len(processed_features)}"
                
                await websocket.send_json(response_data)
                
            except Exception as e:
                import traceback
                print(f"Error processing dynamic prediction: {e}", flush=True)
                traceback.print_exc()
                response_data["error"] = f"Prediction exception: {str(e)}"
                await websocket.send_json(response_data)
                
    except WebSocketDisconnect:
        print("Dynamic Client disconnected", flush=True)
    except Exception as e:
        print(f"Dynamic WebSocket connection error: {e}", flush=True)


