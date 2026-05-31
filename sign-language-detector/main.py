import pickle
import cv2
import mediapipe as mp
import numpy as np
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

# Load trained model
try:
    model_dict = pickle.load(open('./model.p', 'rb'))
    model = model_dict['model']
    label_encoder = model_dict.get('label_encoder', None)
except Exception as e:
    print("Error loading model:", e)
    model = None
    label_encoder = None

# MediaPipe Setup
mp_hands = mp.solutions.hands
hands = mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=2,
    min_detection_confidence=0.7,
    min_tracking_confidence=0.7
)

@app.websocket("/ws/detect")
async def detect_sign_language(websocket: WebSocket):
    await websocket.accept()
    print("Client connected to WebSocket")
    try:
        while True:
            data = await websocket.receive_bytes()
            
            # Decode JPEG
            np_arr = np.frombuffer(data, np.uint8)
            frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
            
            if frame is None:
                continue

            # Flip the frame to match what the model was trained on
            frame = cv2.flip(frame, 1)
            
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = hands.process(frame_rgb)
            
            response_data = {"letter": None, "landmarks": []}
            
            if results.multi_hand_landmarks:
                # Sort hands left to right
                hand_landmarks_list = sorted(
                    results.multi_hand_landmarks,
                    key=lambda hand: min([lm.x for lm in hand.landmark])
                )[:2]
                
                raw_x = []
                raw_y = []
                all_landmarks_for_frontend = []
                
                for hand_landmarks in hand_landmarks_list:
                    for landmark in hand_landmarks.landmark:
                        raw_x.append(landmark.x)
                        raw_y.append(landmark.y)
                        # We send all processed landmarks to the frontend so it can draw them exactly
                        all_landmarks_for_frontend.append({"x": landmark.x, "y": landmark.y})
                        
                # Pad if only one hand is detected
                if len(hand_landmarks_list) == 1:
                    raw_x.extend([0.0] * 21)
                    raw_y.extend([0.0] * 21)
                    
                x_coords = np.array(raw_x, dtype=np.float32)
                y_coords = np.array(raw_y, dtype=np.float32)

                # Normalize Hand 1 relative to its wrist (index 0)
                x_coords[0:21] -= x_coords[0]
                y_coords[0:21] -= y_coords[0]
                
                # Normalize Hand 2 relative to its wrist (index 21)
                x_coords[21:42] -= x_coords[21]
                y_coords[21:42] -= y_coords[21]

                # Interleave the normalized x and y points
                processed_features = np.empty(84, dtype=np.float32)
                processed_features[0::2] = x_coords
                processed_features[1::2] = y_coords
                    
                if model:
                    prediction = model.predict([processed_features])
                    if label_encoder:
                        response_data["letter"] = str(label_encoder.inverse_transform(prediction)[0])
                    else:
                        response_data["letter"] = str(prediction[0])
                    
                response_data["landmarks"] = all_landmarks_for_frontend
            
            await websocket.send_json(response_data)
            
    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as e:
        print(f"Error processing frame: {e}")
