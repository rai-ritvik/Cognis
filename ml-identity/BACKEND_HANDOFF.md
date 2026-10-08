# Backend Handoff

## What the backend should use

### Enrollment
POST `/enroll` with `student_id`, `full_name`, and 3-8 live frames.
Store the returned `reference_embedding` in the backend database.

### Verification
POST `/verify` with the stored `reference_embedding` and 20-60 live frames.
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

- Python 3.12
- Install with `pip install -r requirements.txt`
- Start with `python -m uvicorn app.main:app --host 0.0.0.0 --port 8000`

## Important

This handoff package intentionally excludes `.venv`, generated face images, cached Python files, and the sample `enroll_request.json` because those are machine-specific or contain biometric test data.
