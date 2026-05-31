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

def initialize_resources():
    global model, label_encoder, model_error
    if model is not None:
        return
    
    print("Lazy-loading ML model...", flush=True)
    
    # Load trained model
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

@app.get("/debug")
async def debug():
    initialize_resources()
    return {
        "model_loaded": model is not None,
        "model_error": model_error
    }

@app.websocket("/ws/detect")
async def detect_sign_language(websocket: WebSocket):
    await websocket.accept()
    print("Client connected to WebSocket", flush=True)
    
    # Load model on the first WS connection asynchronously to avoid blocking the event loop
    asyncio.create_task(asyncio.to_thread(initialize_resources))
    
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

