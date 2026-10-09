# Backend Handoff

## What the backend should use

### Enrollment
POST `/enroll` with `student_id`, `full_name`, and 3-8 live frames.
Store the returned `reference_embedding` in the backend database.

### Verification
POST `/verify` with the stored `reference_embedding` and 15-20 live frames.
The ML service performs blink/liveness, face-quality checks, multi-frame embeddings, and identity matching.

Treat `verified: true` as the signal to continue with attendance business logic. The ML service does not write attendance records.

### Health
GET `/health` to confirm the ML service is alive and inspect active thresholds.

## Keep outside this service

- PostgreSQL/database
- attendance records
- society/session logic
- student login/authentication
- frontend camera UI

## Local requirements

- Python 3.11.11
- Install with `pip install -r requirements.txt`
- Start with `python -m uvicorn app.main:app --host 0.0.0.0 --port 8000`

## Important

This handoff package intentionally excludes `.venv`, generated face images, cached Python files, and the sample `enroll_request.json` because those are machine-specific or contain biometric test data.

## Render deployment notes

For the 512 MB Render Free instance, this package defaults to InsightFace `buffalo_sc`, 480px detector input, 640px maximum decoded image dimension, and 15-20 attendance frames. Frames are decoded one at a time and ML requests are serialized in-process.

Render Web Service settings when this directory is the service root:

```text
Runtime: Python 3
PYTHON_VERSION: 3.11.11
Build: pip install --no-cache-dir -r requirements.txt && python prepare_insightface_model.py
Start: python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 1
Health Check Path: /
```

When deploying the parent `OmniScan` repository as a monorepo service, set the Render Root Directory to `ml-identity` so these commands run inside this directory.

Set a secret `ML_API_KEY` in Render and send it as the `X-API-Key` request header from the backend. Do not expose the key in browser JavaScript.
