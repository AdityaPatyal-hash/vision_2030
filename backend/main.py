"""
MIRA backend — FastAPI service for YOLO object detection and ISL sign recognition.

Demo endpoints return sample data so the frontend works out of the box.
Plug in real models where marked:
  - YOLO:        pip install ultralytics  →  YOLO("yolov8n.pt")
  - MediaPipe:   pip install mediapipe    →  hands solutions for /sign

Run:  uvicorn main:app --reload --port 8000
"""
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import random
import base64

app = FastAPI(title="MIRA API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

SAMPLE_OBJECTS = ["person", "chair", "bottle", "laptop", "book", "cup", "phone", "table"]


class Detection(BaseModel):
    label: str
    confidence: float
    box: list[float]  # [x1, y1, x2, y2], normalized 0-1


@app.get("/health")
def health():
    return {"status": "ok", "service": "MIRA API", "mode": "demo"}


@app.post("/detect", response_model=list[Detection])
async def detect(file: UploadFile = File(...)):
    """Object detection. Demo mode: returns sample detections.
    For real YOLO inference, decode `file` and run the model here."""
    count = random.randint(1, 3)
    results = []
    for _ in range(count):
        label = random.choice(SAMPLE_OBJECTS)
        x1, y1 = random.random() * 0.6, random.random() * 0.6
        results.append(Detection(
            label=label,
            confidence=round(random.uniform(0.8, 0.98), 3),
            box=[round(x1, 3), round(y1, 3), round(x1 + 0.25, 3), round(y1 + 0.3, 3)],
        ))
    return results


class Frame(BaseModel):
    image: str  # base64 JPEG


@app.post("/sign")
async def sign_recognize(frame: Frame):
    """ISL alphabet recognition. Demo mode: random letter.
    For real inference, feed decoded frames to MediaPipe hands + classifier."""
    return {"letter": random.choice(["A", "B", "L", "V", "Y"]), "confidence": round(random.uniform(0.85, 0.99), 3)}


@app.post("/describe")
async def describe(file: UploadFile = File(...)):
    """Scene description endpoint (YOLO + optional VLM/LLM)."""
    labels = random.sample(SAMPLE_OBJECTS, k=2)
    return {"description": f"I see {labels[0]} and {labels[1]} in front of you."}
