# Render 512 MB Deployment Setup

This ML API is prepared for Render's 512 MB Free web service.

## Render service

- Service type: Web Service
- Repository: the parent `OmniScan` GitHub repository
- Root Directory: `ml-identity`
- Runtime: Python 3
- Python version: `3.11.11`
- Build Command:

```text
pip install --no-cache-dir -r requirements.txt && python prepare_insightface_model.py
```

- Start Command:

```text
python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 1
```

- Health Check Path: `/`

## Required Render secret

```text
ML_API_KEY=<strong-random-secret>
```

Send the key from your backend using the HTTP header:

```text
X-API-Key: <strong-random-secret>
```

Do not put this key in frontend/browser JavaScript.

## Low-memory defaults

```text
FACE_MODEL_NAME=buffalo_sc
FACE_DET_SIZE=480
FACE_EMBEDDING_DIM=512
MAX_IMAGE_DIM=640
MAX_FRAME_BYTES=262144
MAX_FRAME_CHARS=360000
MAX_REQUEST_BYTES=8388608
ATTENDANCE_MIN_FRAMES=15
ATTENDANCE_MAX_FRAMES=20
VERIFICATION_TARGET_FRAMES=8
VERIFICATION_MIN_GOOD_FRAMES=5
VERIFICATION_MIN_PASS_RATIO=0.75
OMP_NUM_THREADS=1
OPENBLAS_NUM_THREADS=1
MKL_NUM_THREADS=1
NUMEXPR_NUM_THREADS=1
MALLOC_ARENA_MAX=2
OMP_WAIT_POLICY=PASSIVE
```

## What was changed for the 512 MB limit

1. Replaced the default InsightFace `buffalo_l` model with `buffalo_sc` and load only detection + recognition modules.
2. Added a Render build script that downloads and SHA-256 verifies the official `buffalo_sc` model pack, then keeps only the two ONNX files used by this service.
3. Reduced detector input from 640 to 480.
4. Resizes decoded frames to a maximum 640px dimension.
5. Caps each decoded frame at 256 KB and each base64 frame at 360,000 characters.
6. Caps the full HTTP request at 8 MB when a `Content-Length` header is provided.
7. Reworked enrollment and verification so full-resolution NumPy frames are never retained as a list; each frame is decoded, processed, and released.
8. Verification runs blink/liveness and face recognition on the same decoded frame, then releases it.
9. Serializes ML inference with a process-wide lock so two requests cannot load duplicate native inference memory at the same time.
10. Limits native numerical libraries and OpenCV to one thread where supported.
11. Pins the Python/ML runtime versions for reproducible Render builds.
12. Adds `peak_rss_mb` to `/health` so the live service reports its observed peak resident memory.

## Client camera guidance

Use approximately 640x480 JPEG frames, quality 65-75. Enrollment sends 3-8 frames. Attendance verification sends 15-20 frames.

## Important

This service is stateless for student data. Store the returned 512-dimensional reference embedding in the main backend database, not on Render's local filesystem.
