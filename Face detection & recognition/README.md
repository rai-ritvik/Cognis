# Face Attendance ML API

Stateless FastAPI service for the ML part of a face-recognition attendance system.

## Responsibilities

- Face detection and exactly-one-face validation
- Face quality filtering
- ArcFace/InsightFace 512-D embeddings
- Multi-frame enrollment template generation
- MediaPipe blink challenge
- Multi-frame identity verification using cosine similarity

## Explicitly NOT handled here

- PostgreSQL/database storage
- Attendance records
- Session/society rules
- Student authentication/authorization
- Frontend camera UI

## Architecture

```text
Frontend camera
      |
      v
Backend
      |
      |  /enroll: frames
      |  /verify: reference_embedding + frames
      v
ML FastAPI
      |
      +--> InsightFace
      +--> MediaPipe
      |
      v
ML result
      |
      v
Backend -> database / attendance
```

The ML service keeps the neural-network models in process memory, but it does **not** keep student templates. By default, downloaded model files are stored in the project-local `models/` directory; set `FACE_MODEL_DIR` to override this path. That makes the API stateless with respect to student data.

## Run locally

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Windows PowerShell activation:

```powershell
.venv\Scripts\Activate.ps1
```

Open:

```text
http://127.0.0.1:8000/docs
```

## Enrollment request

`POST /enroll`

```json
{
  "student_id": "AKGEC001",
  "full_name": "Student Name",
  "frames": [
    "<base64-or-data-url-frame-1>",
    "<base64-or-data-url-frame-2>",
    "<base64-or-data-url-frame-3>",
    "<base64-or-data-url-frame-4>",
    "<base64-or-data-url-frame-5>"
  ]
}
```

The response contains `reference_embedding`, a normalized 512-D vector. The backend stores that vector against the student.

## Verification request

`POST /verify`

```json
{
  "reference_embedding": [
    0.0123,
    -0.0456
  ],
  "frames": [
    "<base64-or-data-url-frame-1>",
    "..."
  ]
}
```

The real embedding array must contain 512 values.

The response contains:

- `verified`
- `similarity` (median similarity)
- `mean_similarity`
- `min_similarity`
- `threshold`
- `passed_frames`
- `total_identity_frames`
- `pass_ratio`
- `blink_detected`
- `liveness.method`
- `reason`

## Important

`FACE_THRESHOLD=0.50` is only a configurable provisional value. After the multi-frame verifier is validated, rerun threshold calibration with the same multi-frame decision rule and then freeze the chosen value in deployment configuration.

Blink challenge indicates that the requested blink sequence was detected; it is not a universal guarantee against every possible spoofing attack.

## Render 512 MB deployment

This package is optimized for Render's 512 MB Free web service. The default configuration uses InsightFace `buffalo_sc`, a much smaller model pack that contains only the SCRFD detector and MBF recognition model. The Render build should run `python prepare_insightface_model.py` after installing dependencies so the model files are included in the deployed build artifact.

Recommended Render settings:

```text
Root Directory: ml-identity        # when deploying from the OmniScan monorepo
Build Command: pip install --no-cache-dir -r requirements.txt && python prepare_insightface_model.py
Start Command: python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 1
Health Check Path: /
ML_API_KEY: set as a Render secret

FACE_MODEL_NAME=buffalo_sc
FACE_DET_SIZE=480
MAX_IMAGE_DIM=640
MAX_FRAME_BYTES=262144
MAX_FRAME_CHARS=360000
MAX_REQUEST_BYTES=8388608
ATTENDANCE_MIN_FRAMES=15
ATTENDANCE_MAX_FRAMES=20
```

Frames are decoded one at a time rather than stored as a list of full-resolution NumPy arrays. ML requests are also serialized inside the FastAPI process so a second inference cannot duplicate the native ONNX/MediaPipe memory footprint. The API also rejects oversized HTTP requests before Pydantic parses large frame payloads.

Keep the client camera around 640x480 JPEG quality 65-75 for the best balance on this small instance.

Render Free services have an ephemeral filesystem and spin down after 15 minutes of inactivity, so do not store student embeddings or attendance data on this service. The backend database remains the source of truth.
