from __future__ import annotations

import os
from typing import Any

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

from .face_service import FaceMLService, MLValidationError


APP_TITLE = "Face Attendance ML API"
APP_VERSION = os.getenv("ML_API_VERSION", "1.0.0")
API_KEY = os.getenv("ML_API_KEY")


app = FastAPI(
    title=APP_TITLE,
    version=APP_VERSION,
    description=(
        "Stateless ML service for face enrollment and attendance verification. "
        "Student records and attendance business logic remain outside this service."
    ),
)


service = FaceMLService()


# ============================================================================
# REQUEST MODELS
# ============================================================================

class EnrollmentRequest(BaseModel):
    student_id: str
    full_name: str
    frames: list[str]


class VerificationRequest(BaseModel):
    reference_embedding: list[float]
    frames: list[str]


# ============================================================================
# HEALTH RESPONSE
# ============================================================================

class HealthResponse(BaseModel):
    status: str
    model: str
    embedding_dimension: int

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