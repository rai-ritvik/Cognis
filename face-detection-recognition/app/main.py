from __future__ import annotations

import os
from typing import Annotated, Any

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse
import threading

from pydantic import BaseModel, Field

from .face_service import FaceMLService, MLValidationError


APP_TITLE = "Face Attendance ML API"
APP_VERSION = os.getenv("ML_API_VERSION", "1.0.0")
API_KEY = os.getenv("ML_API_KEY")
MAX_REQUEST_BYTES = int(os.getenv("MAX_REQUEST_BYTES", str(8 * 1024 * 1024)))
MAX_FRAME_CHARS = int(os.getenv("MAX_FRAME_CHARS", "360000"))

# A 512 MB instance should never run two ONNX/MediaPipe jobs concurrently.
# Requests wait here instead of duplicating the model's native memory use.
ML_LOCK = threading.Lock()


app = FastAPI(
    title=APP_TITLE,
    version=APP_VERSION,
    description=(
        "Stateless ML service for face enrollment and attendance verification. "
        "Student records and attendance business logic remain outside this service."
    ),
)


service = FaceMLService()


@app.middleware("http")
async def limit_request_body(request: Request, call_next):
    """Reject oversized JSON requests before Pydantic keeps them in memory."""
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            size = int(content_length)
        except ValueError:
            size = 0

        if size > MAX_REQUEST_BYTES:
            return JSONResponse(
                status_code=413,
                content={
                    "success": False,
                    "error_code": "REQUEST_TOO_LARGE",
                    "message": f"Request exceeds {MAX_REQUEST_BYTES} bytes",
                },
            )

    return await call_next(request)


# ============================================================================
# REQUEST MODELS
# ============================================================================

FramePayload = Annotated[str, Field(min_length=16, max_length=MAX_FRAME_CHARS)]


class EnrollmentRequest(BaseModel):
    student_id: str = Field(min_length=1, max_length=64)
    full_name: str = Field(min_length=1, max_length=128)
    frames: list[FramePayload] = Field(min_length=3, max_length=8)


class VerificationRequest(BaseModel):
    reference_embedding: list[float] = Field(min_length=512, max_length=512)
    frames: list[FramePayload] = Field(min_length=15, max_length=20)


# ============================================================================
# HEALTH RESPONSE
# ============================================================================

class HealthResponse(BaseModel):
    status: str
    model: str
    embedding_dimension: int
    peak_rss_mb: float

    face_threshold: float

    verification_target_frames: int
    verification_min_good_frames: int
    verification_min_pass_ratio: float

    # Image quality settings
    min_face_area_ratio: float
    min_blur_variance: float

    # Storage
    storage: str


# ============================================================================
# API KEY
# ============================================================================

def check_api_key(
    x_api_key: str | None,
) -> None:
    """
    Optional service-to-service API key.

    If ML_API_KEY is not configured, authentication is disabled.
    """

    if API_KEY and x_api_key != API_KEY:
        raise HTTPException(
            status_code=401,
            detail={
                "success": False,
                "error_code": "UNAUTHORIZED",
                "message": "Invalid or missing API key",
            },
        )


# ============================================================================
# ROOT
# ============================================================================

@app.get(
    "/",
    include_in_schema=False,
)
def root() -> dict[str, Any]:
    return {
        "service": APP_TITLE,
        "version": APP_VERSION,
        "status": "ok",
        "docs": "/docs",
    }


# ============================================================================
# HEALTH
# ============================================================================

@app.get(
    "/health",
    response_model=HealthResponse,
)
def health(
    x_api_key: str | None = Header(default=None),
) -> dict[str, Any]:

    check_api_key(x_api_key)

    return service.health()


# ============================================================================
# ENROLLMENT
# ============================================================================

@app.post("/enroll")
def enroll(
    request: EnrollmentRequest,
    x_api_key: str | None = Header(default=None),
) -> dict[str, Any]:

    check_api_key(x_api_key)

    try:

        with ML_LOCK:
            return service.enroll(
                student_id=request.student_id,
                full_name=request.full_name,
                frames=request.frames,
            )

    except MLValidationError as exc:

        raise HTTPException(
            status_code=400,
            detail={
                "success": False,
                "error_code": exc.code,
                "message": exc.message,
            },
        ) from exc

    except Exception as exc:

        # Keep the actual exception out of the public API response.
        print(
            f"[ML API ERROR] /enroll: "
            f"{type(exc).__name__}: {exc}"
        )

        raise HTTPException(
            status_code=500,
            detail={
                "success": False,
                "error_code": "ML_INTERNAL_ERROR",
                "message": "Unexpected ML service error",
            },
        ) from exc


# ============================================================================
# VERIFICATION
# ============================================================================

@app.post("/verify")
def verify(
    request: VerificationRequest,
    x_api_key: str | None = Header(default=None),
) -> dict[str, Any]:

    check_api_key(x_api_key)

    try:

        with ML_LOCK:
            return service.verify(
                reference_embedding=request.reference_embedding,
                frames=request.frames,
            )

    except MLValidationError as exc:

        raise HTTPException(
            status_code=400,
            detail={
                "success": False,
                "error_code": exc.code,
                "message": exc.message,
            },
        ) from exc

    except Exception as exc:

        print(
            f"[ML API ERROR] /verify: "
            f"{type(exc).__name__}: {exc}"
        )

        raise HTTPException(
            status_code=500,
            detail={
                "success": False,
                "error_code": "ML_INTERNAL_ERROR",
                "message": "Unexpected ML service error",
            },
        ) from exc