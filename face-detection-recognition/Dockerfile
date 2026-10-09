FROM python:3.11.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    OMP_NUM_THREADS=1 \
    OPENBLAS_NUM_THREADS=1 \
    MKL_NUM_THREADS=1 \
    NUMEXPR_NUM_THREADS=1

WORKDIR /app

# Install Linux libraries needed by MediaPipe and OpenCV.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgles2 \
    libegl1 \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    libgomp1 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies.
COPY requirements.txt .
RUN python -m pip install --no-cache-dir -r requirements.txt

# Copy the ML API source and model files.
COPY . .

# Prepare the lightweight InsightFace model during image build.
RUN python prepare_insightface_model.py

EXPOSE 10000

# Use one worker to limit memory consumption.
CMD ["sh", "-c", "exec python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000} --workers 1"]
