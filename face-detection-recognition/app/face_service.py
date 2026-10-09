from __future__ import annotations

import base64
import binascii
import gc
import hashlib
import os
import shutil
import sys
import urllib.request
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterator

# Keep native numerical libraries conservative on Render's small instance.
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")
os.environ.setdefault("NUMEXPR_NUM_THREADS", "1")
os.environ.setdefault("MALLOC_ARENA_MAX", "2")
os.environ.setdefault("OMP_WAIT_POLICY", "PASSIVE")

import cv2
import mediapipe as mp
import numpy as np

# MediaPipe is pinned to 0.10.35 for reproducible deployment.
MP_VERSION = mp.__version__
MP_MAJOR = int(MP_VERSION.split(".")[0])
if MP_MAJOR >= 1:
    raise RuntimeError(
        f"Unsupported MediaPipe version {MP_VERSION}. "
        "Use mediapipe==0.10.35 for this project."
    )

from insightface.app import FaceAnalysis
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

cv2.setNumThreads(1)
try:
    cv2.ocl.setUseOpenCL(False)
except Exception:
    pass


# ============================================================================
# CONFIGURATION
# ============================================================================

@dataclass(frozen=True)
class ServiceConfig:
    # InsightFace / ArcFace
    model_name: str = os.getenv("FACE_MODEL_NAME", "buffalo_sc")
    embedding_dim: int = int(os.getenv("FACE_EMBEDDING_DIM", "512"))
    det_size: int = int(os.getenv("FACE_DET_SIZE", "480"))

    # Identity verification
    face_threshold: float = float(os.getenv("FACE_THRESHOLD", "0.50"))
    verification_target_frames: int = int(
        os.getenv("VERIFICATION_TARGET_FRAMES", "8")
    )
    verification_min_good_frames: int = int(
        os.getenv("VERIFICATION_MIN_GOOD_FRAMES", "5")
    )
    verification_min_pass_ratio: float = float(
        os.getenv("VERIFICATION_MIN_PASS_RATIO", "0.75")
    )

    # Enrollment
    registration_min_frames: int = int(
        os.getenv("REGISTRATION_MIN_FRAMES", "3")
    )
    registration_max_frames: int = int(
        os.getenv("REGISTRATION_MAX_FRAMES", "8")
    )
    registration_target_frames: int = int(
        os.getenv("REGISTRATION_TARGET_FRAMES", "5")
    )
    enrollment_min_coherence: float = float(
        os.getenv("ENROLLMENT_MIN_COHERENCE", "0.45")
    )

    # Attendance capture range
    attendance_min_frames: int = int(
        os.getenv("ATTENDANCE_MIN_FRAMES", "15")
    )
    attendance_max_frames: int = int(
        os.getenv("ATTENDANCE_MAX_FRAMES", "20")
    )

    # Image quality
    # Based on the user's real camera measurements, 0.03 and 25.0 are
    # practical starting gates. These are NOT identity thresholds.
    min_face_area_ratio: float = float(
        os.getenv("MIN_FACE_AREA_RATIO", "0.03")
    )
    min_blur_variance: float = float(
        os.getenv("MIN_BLUR_VARIANCE", "25.0")
    )

    # Blink / liveness
    blink_min_observations: int = int(
        os.getenv("BLINK_MIN_OBSERVATIONS", "10")
    )
    blink_baseline_frames: int = int(
        os.getenv("BLINK_BASELINE_FRAMES", "5")
    )
    blink_min_closed_frames: int = int(
        os.getenv("BLINK_MIN_CLOSED_FRAMES", "2")
    )
    blink_min_reopen_frames: int = int(
        os.getenv("BLINK_MIN_REOPEN_FRAMES", "2")
    )
    blink_close_floor: float = float(
        os.getenv("BLINK_CLOSE_FLOOR", "0.20")
    )
    blink_close_delta: float = float(
        os.getenv("BLINK_CLOSE_DELTA", "0.08")
    )
    blink_eye_delta: float = float(
        os.getenv("BLINK_EYE_DELTA", "0.03")
    )
    blink_reopen_delta: float = float(
        os.getenv("BLINK_REOPEN_DELTA", "0.04")
    )

    # Keep the compressed frame payload bounded, then resize the decoded
    # image so raw NumPy allocations remain small too.
    max_frame_bytes: int = int(
        os.getenv("MAX_FRAME_BYTES", "262144")
    )
    max_image_dim: int = int(
        os.getenv("MAX_IMAGE_DIM", "640")
    )

    # Project-local model directory.
    model_dir: Path = Path(
        os.getenv(
            "FACE_MODEL_DIR",
            str(Path(__file__).resolve().parent.parent / "models"),
        )
    )

    # InsightFace expects <root>/models/<model_name>. The Render build creates
    # the buffalo_sc files under this root so runtime startup is offline.
    insightface_root: Path = Path(
        os.getenv(
            "INSIGHTFACE_ROOT",
            str(Path(__file__).resolve().parent.parent),
        )
    )

    mediapipe_model_name: str = "face_landmarker.task"
    mediapipe_url: str = (
        "https://storage.googleapis.com/mediapipe-models/"
        "face_landmarker/face_landmarker/float16/latest/face_landmarker.task"
    )


CONFIG = ServiceConfig()


# ============================================================================
# VALIDATION ERROR
# ============================================================================

class MLValidationError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


# ============================================================================
# FACE ML SERVICE
# ============================================================================

class FaceMLService:
    """Stateless face ML service for enrollment and verification."""

    def __init__(self, config: ServiceConfig = CONFIG) -> None:
        self.config = config
        self._load_models()

    # ========================================================================
    # MODEL LOADING
    # ========================================================================

    def _ensure_insightface_pack(self) -> None:
        """Ensure the small buffalo_sc ONNX pack is available locally."""
        if self.config.model_name != "buffalo_sc":
            return

        pack_dir = (
            self.config.insightface_root
            / "models"
            / self.config.model_name
        )
        detector = pack_dir / "det_500m.onnx"
        recognizer = pack_dir / "w600k_mbf.onnx"

        if detector.exists() and recognizer.exists():
            return

        pack_dir.parent.mkdir(parents=True, exist_ok=True)

        url = (
            "https://github.com/deepinsight/insightface/"
            "releases/download/model-zoo/buffalo_sc.zip"
        )
        expected_sha256 = (
            "57d31b56b6ffa911c8a73cfc1707c73cab76efe7f13b675a05223bf42de47c72"
        )
        zip_path = pack_dir.parent / "buffalo_sc.zip"

        print("[ML] Preparing InsightFace buffalo_sc model pack...")
        urllib.request.urlretrieve(url, zip_path)

        digest = hashlib.sha256()
        with zip_path.open("rb") as model_file:
            for chunk in iter(lambda: model_file.read(1024 * 1024), b""):
                digest.update(chunk)
        if digest.hexdigest() != expected_sha256:
            zip_path.unlink(missing_ok=True)
            raise RuntimeError("Downloaded buffalo_sc model pack failed SHA-256 verification")

        with zipfile.ZipFile(zip_path, "r") as archive:
            for member in archive.infolist():
                target = (pack_dir / member.filename).resolve()
                if not str(target).startswith(str(pack_dir.resolve()) + os.sep):
                    raise RuntimeError("Unsafe path in buffalo_sc model archive")
            archive.extractall(pack_dir)

        detector_candidates = list(pack_dir.rglob("det_500m.onnx"))
        recognizer_candidates = list(pack_dir.rglob("w600k_mbf.onnx"))
        if not detector_candidates or not recognizer_candidates:
            zip_path.unlink(missing_ok=True)
            raise RuntimeError("buffalo_sc model pack is missing required ONNX files")

        detector_source = detector_candidates[0]
        recognizer_source = recognizer_candidates[0]
        if detector_source != detector:
            detector.unlink(missing_ok=True)
            detector_source.replace(detector)
        if recognizer_source != recognizer:
            recognizer.unlink(missing_ok=True)
            recognizer_source.replace(recognizer)

        for child in list(pack_dir.iterdir()):
            if child.name not in {detector.name, recognizer.name}:
                if child.is_dir():
                    shutil.rmtree(child, ignore_errors=True)
                else:
                    child.unlink(missing_ok=True)

        zip_path.unlink(missing_ok=True)

        if not (detector.exists() and recognizer.exists()):
            raise RuntimeError("buffalo_sc model pack setup failed")

    def _load_models(self) -> None:
        self.config.model_dir.mkdir(parents=True, exist_ok=True)
        self._ensure_insightface_pack()

        # buffalo_sc contains only the detector + recognition models needed by
        # this service, and allowed_modules prevents accidental extra loading.
        self.face_app = FaceAnalysis(
            name=self.config.model_name,
            root=str(self.config.insightface_root),
            allowed_modules=["detection", "recognition"],
            providers=["CPUExecutionProvider"],
        )
        self.face_app.prepare(
            ctx_id=-1,
            det_size=(self.config.det_size, self.config.det_size),
        )

        print(
            f"[ML] InsightFace loaded: {self.config.model_name}; "
            f"det_size={self.config.det_size}"
        )

        mediapipe_model = (
            self.config.model_dir / self.config.mediapipe_model_name
        )

        if not mediapipe_model.exists():
            urllib.request.urlretrieve(
                self.config.mediapipe_url,
                mediapipe_model,
            )

        base_options = python.BaseOptions(
            model_asset_path=str(mediapipe_model)
        )

        options = vision.FaceLandmarkerOptions(
            base_options=base_options,
            running_mode=vision.RunningMode.IMAGE,
            num_faces=1,
            min_face_detection_confidence=0.5,
            min_face_presence_confidence=0.5,
            min_tracking_confidence=0.5,
            output_face_blendshapes=True,
        )

        self.blink_landmarker = vision.FaceLandmarker.create_from_options(
            options
        )

    # ========================================================================
    # EMBEDDINGS
    # ========================================================================

    @staticmethod
    def normalize_embedding(
        embedding: np.ndarray | list[float],
    ) -> np.ndarray:
        arr = np.asarray(embedding, dtype=np.float32).reshape(-1)

        if arr.size == 0:
            raise MLValidationError(
                "INVALID_EMBEDDING",
                "Embedding is empty",
            )

        if not np.all(np.isfinite(arr)):
            raise MLValidationError(
                "INVALID_EMBEDDING",
                "Embedding contains invalid values",
            )

        norm = float(np.linalg.norm(arr))
        if norm <= 0.0:
            raise MLValidationError(
                "INVALID_EMBEDDING",
                "Embedding norm is zero",
            )

        return arr / norm

    # ========================================================================
    # FRAME DECODING
    # ========================================================================

    def decode_frame(self, frame_payload: str) -> np.ndarray:
        if not isinstance(frame_payload, str) or not frame_payload.strip():
            raise MLValidationError(
                "INVALID_FRAME",
                "Frame must be a non-empty base64 string",
            )

        payload = frame_payload.strip()

        if payload.startswith("data:"):
            try:
                _, payload = payload.split(",", 1)
            except ValueError as exc:
                raise MLValidationError(
                    "INVALID_FRAME",
                    "Malformed data URL",
                ) from exc

        try:
            raw = base64.b64decode(payload, validate=True)
        except (binascii.Error, ValueError) as exc:
            raise MLValidationError(
                "INVALID_FRAME",
                "Frame is not valid base64",
            ) from exc

        if len(raw) > self.config.max_frame_bytes:
            raise MLValidationError(
                "FRAME_TOO_LARGE",
                f"Decoded frame exceeds {self.config.max_frame_bytes} bytes",
            )

        image = cv2.imdecode(
            np.frombuffer(raw, dtype=np.uint8),
            cv2.IMREAD_COLOR,
        )
        del raw

        if image is None:
            raise MLValidationError(
                "INVALID_IMAGE",
                "Frame could not be decoded as an image",
            )

        if image.ndim != 3 or image.shape[2] != 3:
            raise MLValidationError(
                "INVALID_IMAGE",
                "Expected a color image",
            )

        max_dim = max(image.shape[:2])
        if max_dim > self.config.max_image_dim:
            scale = self.config.max_image_dim / float(max_dim)
            new_w = max(1, int(round(image.shape[1] * scale)))
            new_h = max(1, int(round(image.shape[0] * scale)))
            resized = cv2.resize(
                image,
                (new_w, new_h),
                interpolation=cv2.INTER_AREA,
            )
            del image
            image = resized

        return image

    def iter_decoded_frames(
        self,
        frames: list[str],
    ) -> Iterator[tuple[int, np.ndarray]]:
        if not isinstance(frames, list):
            raise MLValidationError(
                "INVALID_FRAMES",
                "frames must be a JSON array",
            )

        for index, frame in enumerate(frames):
            yield index, self.decode_frame(frame)

    def decode_frames(self, frames: list[str]) -> list[np.ndarray]:
        if not isinstance(frames, list):
            raise MLValidationError(
                "INVALID_FRAMES",
                "frames must be a JSON array",
            )

        return [self.decode_frame(frame) for frame in frames]

    # ========================================================================
    # FACE DETECTION + EMBEDDING
    # ========================================================================

    def extract_face_embedding(
        self,
        image: np.ndarray,
    ) -> tuple[np.ndarray, Any]:
        faces = self.face_app.get(image)

        if len(faces) == 0:
            raise MLValidationError(
                "NO_FACE",
                "No face detected",
            )

        if len(faces) != 1:
            raise MLValidationError(
                "MULTIPLE_FACES",
                f"Expected exactly one face; found {len(faces)}",
            )

        face = faces[0]
        embedding = getattr(face, "normed_embedding", None)

        if embedding is None:
            raise MLValidationError(
                "EMBEDDING_FAILED",
                "Face embedding was not produced",
            )

        embedding = self.normalize_embedding(embedding)

        if embedding.size != self.config.embedding_dim:
            raise MLValidationError(
                "EMBEDDING_DIMENSION",
                f"Embedding dimension {embedding.size} != "
                f"{self.config.embedding_dim}",
            )

        return embedding, face

    # ========================================================================
    # FACE QUALITY
    # ========================================================================

    def assess_face_quality(
        self,
        image: np.ndarray,
        face: Any,
    ) -> dict[str, float | bool]:
        """Check face size and image sharpness."""
        h, w = image.shape[:2]
        box = np.asarray(face.bbox, dtype=np.float32)

        face_w = max(0.0, float(box[2] - box[0]))
        face_h = max(0.0, float(box[3] - box[1]))

        area_ratio = (
            face_w * face_h / max(1.0, float(w * h))
        )

        x1 = max(0, min(int(box[0]), w))
        y1 = max(0, min(int(box[1]), h))
        x2 = max(0, min(int(box[2]), w))
        y2 = max(0, min(int(box[3]), h))

        crop = image[y1:y2, x1:x2]
        blur_variance = 0.0

        if crop.size:
            gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
            blur_variance = float(
                cv2.Laplacian(gray, cv2.CV_64F).var()
            )

        face_size_ok = (
            area_ratio >= self.config.min_face_area_ratio
        )
        blur_ok = (
            blur_variance >= self.config.min_blur_variance
        )
        usable = bool(face_size_ok and blur_ok)

        area_score = min(
            area_ratio
            / max(self.config.min_face_area_ratio * 4.0, 1e-6),
            1.0,
        )
        blur_score = min(blur_variance / 150.0, 1.0)
        quality_score = 0.55 * area_score + 0.45 * blur_score

        return {
            "usable": usable,
            "face_size_ok": bool(face_size_ok),
            "blur_ok": bool(blur_ok),
            "area_ratio": float(area_ratio),
            "blur_variance": float(blur_variance),
            "quality_score": float(quality_score),
            "min_area_ratio": float(self.config.min_face_area_ratio),
            "min_blur_variance": float(self.config.min_blur_variance),
        }

    # ========================================================================
    # SIMILARITY
    # ========================================================================

    def cosine_similarity(
        self,
        a: np.ndarray | list[float],
        b: np.ndarray | list[float],
    ) -> float:
        a_n = self.normalize_embedding(a)
        b_n = self.normalize_embedding(b)

        if a_n.size != b_n.size:
            raise MLValidationError(
                "EMBEDDING_DIMENSION",
                "Embeddings must have the same dimension",
            )

        return float(np.dot(a_n, b_n))

    # ========================================================================
    # FRAME SELECTION
    # ========================================================================

    @staticmethod
    def select_temporally_distributed(
        candidates: list[dict[str, Any]],
        target_count: int,
    ) -> list[dict[str, Any]]:
        if not candidates:
            return []

        ordered = sorted(candidates, key=lambda x: x["index"])
        target_count = max(1, min(int(target_count), len(ordered)))

        if len(ordered) <= target_count:
            return sorted(
                ordered,
                key=lambda x: x["quality"]["quality_score"],
                reverse=True,
            )

        selected: list[dict[str, Any]] = []

        for bucket in np.array_split(
            np.arange(len(ordered)),
            target_count,
        ):
            if len(bucket) == 0:
                continue

            pool = [ordered[int(i)] for i in bucket]
            selected.append(
                max(
                    pool,
                    key=lambda x: x["quality"]["quality_score"],
                )
            )

        return sorted(selected, key=lambda x: x["index"])

    # ========================================================================
    # ENROLLMENT
    # ========================================================================

    def enroll(
        self,
        student_id: str,
        full_name: str,
        frames: list[str],
    ) -> dict[str, Any]:
        if not str(student_id).strip():
            raise MLValidationError(
                "INVALID_STUDENT_ID",
                "student_id is required",
            )

        if not str(full_name).strip():
            raise MLValidationError(
                "INVALID_NAME",
                "full_name is required",
            )

        if not (
            self.config.registration_min_frames
            <= len(frames)
            <= self.config.registration_max_frames
        ):
            raise MLValidationError(
                "INVALID_FRAME_COUNT",
                f"Enrollment requires "
                f"{self.config.registration_min_frames} to "
                f"{self.config.registration_max_frames} frames",
            )

        # Stream frames so raw camera images never accumulate in memory.
        candidates: list[dict[str, Any]] = []
        rejection_counts: dict[str, int] = {}
        quality_details: list[dict[str, Any]] = []

        for index, image in self.iter_decoded_frames(frames):
            try:
                embedding, face = self.extract_face_embedding(image)
                quality = self.assess_face_quality(image, face)

                if quality["usable"]:
                    candidates.append(
                        {
                            "index": index,
                            "embedding": embedding,
                            "quality": quality,
                        }
                    )
                else:
                    rejection_counts["LOW_QUALITY"] = (
                        rejection_counts.get("LOW_QUALITY", 0) + 1
                    )
                    quality_details.append(
                        {
                            "frame": index,
                            "area_ratio": round(
                                float(quality["area_ratio"]), 4
                            ),
                            "blur_variance": round(
                                float(quality["blur_variance"]), 2
                            ),
                            "quality_score": round(
                                float(quality["quality_score"]), 4
                            ),
                            "face_size_ok": bool(
                                quality["face_size_ok"]
                            ),
                            "blur_ok": bool(quality["blur_ok"]),
                        }
                    )

            except MLValidationError as exc:
                rejection_counts[exc.code] = (
                    rejection_counts.get(exc.code, 0) + 1
                )
            finally:
                del image

        gc.collect()

        if len(candidates) < self.config.registration_min_frames:
            rejection_text = ", ".join(
                f"{key}={value}"
                for key, value in sorted(rejection_counts.items())
            ) or "none"

            message = (
                f"Only {len(candidates)} usable enrollment frames found; "
                f"need at least {self.config.registration_min_frames}. "
                f"Rejections: {rejection_text}"
            )

            # Return the quality diagnostics when available so the issue can
            # be fixed from the actual API data rather than guessed.
            if quality_details:
                message += f". Quality details: {quality_details}"

            raise MLValidationError(
                "INSUFFICIENT_GOOD_FRAMES",
                message,
            )

        selected = self.select_temporally_distributed(
            candidates,
            self.config.registration_target_frames,
        )

        reference = self.normalize_embedding(
            np.mean(
                np.stack([
                    item["embedding"] for item in selected
                ]),
                axis=0,
            )
        )

        coherence_scores = [
            self.cosine_similarity(item["embedding"], reference)
            for item in selected
        ]
        coherence_median = float(np.median(coherence_scores))

        if coherence_median < self.config.enrollment_min_coherence:
            raise MLValidationError(
                "INCONSISTENT_ENROLLMENT",
                "Enrollment frames are not sufficiently consistent; "
                "please register again",
            )

        return {
            "success": True,
            "student_id": str(student_id),
            "full_name": str(full_name).strip(),
            "samples_received": len(frames),
            "samples_used": len(selected),
            "embedding_dimension": int(reference.size),
            "reference_embedding": reference.astype(float).tolist(),
            "enrollment_coherence_median": round(
                coherence_median, 4
            ),
            "selected_frame_indices": [
                int(item["index"]) for item in selected
            ],
            "rejected_frame_counts": rejection_counts,
            "model": {
                "name": self.config.model_name,
                "embedding_dimension": self.config.embedding_dim,
            },
        }

    # ========================================================================
    # BLINK / LIVENESS
    # ========================================================================

    def get_blink_score(
        self,
        image: np.ndarray,
    ) -> dict[str, float] | None:
        rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(
            image_format=mp.ImageFormat.SRGB,
            data=rgb,
        )

        result = self.blink_landmarker.detect(mp_image)

        if not result.face_blendshapes or not result.face_landmarks:
            return None

        scores = {
            item.category_name: float(item.score)
            for item in result.face_blendshapes[0]
        }

        left = scores.get("eyeBlinkLeft")
        right = scores.get("eyeBlinkRight")

        if left is None or right is None:
            return None

        return {
            "left": float(left),
            "right": float(right),
            "mean": float((left + right) / 2.0),
        }

    @staticmethod
    def smooth_signal(
        values: list[float],
        window: int = 3,
    ) -> np.ndarray:
        arr = np.asarray(values, dtype=np.float32)
        if len(arr) < window:
            return arr

        pad = window // 2
        padded = np.pad(arr, (pad, pad), mode="edge")
        kernel = np.ones(window, dtype=np.float32) / window

        return np.convolve(
            padded,
            kernel,
            mode="valid",
        ).astype(np.float32)

    def _evaluate_blink_observations(
        self,
        observations: list[dict[str, float | int]],
    ) -> dict[str, Any]:
        """Evaluate the existing OPEN -> CLOSED -> OPEN blink rule."""
        if len(observations) < self.config.blink_min_observations:
            return {
                "blink_detected": False,
                "reason": "INSUFFICIENT_BLINK_OBSERVATIONS",
                "valid_observations": len(observations),
                "max_score": max(
                    (float(x["mean"]) for x in observations),
                    default=0.0,
                ),
                "scores": [float(x["mean"]) for x in observations],
            }

        left = np.asarray([x["left"] for x in observations], dtype=np.float32)
        right = np.asarray([x["right"] for x in observations], dtype=np.float32)

        left_s = self.smooth_signal(left.tolist(), 3)
        right_s = self.smooth_signal(right.tolist(), 3)
        mean_s = (left_s + right_s) / 2.0

        # Robust open-eye baseline. Use a lower percentile so 1-2 early
        # blink frames do not raise the baseline enough to hide the blink.
        baseline_count = min(
            max(5, self.config.blink_baseline_frames),
            len(mean_s),
        )
        baseline_window = mean_s[:baseline_count]
        baseline = float(np.percentile(baseline_window, 40))

        # The previous 0.30 closure floor was above the user's observed
        # genuine peak (~0.2622). These values retain an explicit 2-frame
        # closure + 2-frame recovery requirement.
        close_threshold = max(
            self.config.blink_close_floor,
            baseline + self.config.blink_close_delta,
        )
        eye_close_threshold = max(
            0.10,
            baseline + self.config.blink_eye_delta,
        )
        reopen_threshold = max(
            0.12,
            baseline + self.config.blink_reopen_delta,
        )

        seen_open = False
        open_run = 0
        closed_run = 0
        reopen_run = 0

        closure_start: int | None = None
        closure_end: int | None = None
        recovery_index: int | None = None

        peak_score = 0.0
        peak_index: int | None = None

        initial_open_required = max(
            2,
            self.config.blink_min_reopen_frames,
        )

        # Search from frame 0 instead of starting after the baseline window.
        # Your previous genuine blink pattern was approximately:
        # OPEN OPEN OPEN CLOSED CLOSED OPEN OPEN...
        for i in range(len(mean_s)):
            current_left = float(left_s[i])
            current_right = float(right_s[i])
            current_mean = float(mean_s[i])

            if current_mean > peak_score:
                peak_score = current_mean
                peak_index = i

            both_open = (
                current_left <= reopen_threshold
                and current_right <= reopen_threshold
            )

            both_closed = (
                current_mean >= close_threshold
                and current_left >= eye_close_threshold
                and current_right >= eye_close_threshold
            )

            if closure_start is None:
                if both_open:
                    open_run += 1
                else:
                    open_run = 0

                if open_run >= initial_open_required:
                    seen_open = True

                if seen_open and both_closed:
                    closed_run += 1
                else:
                    closed_run = 0

                if (
                    seen_open
                    and closed_run >= self.config.blink_min_closed_frames
                ):
                    closure_start = (
                        i - self.config.blink_min_closed_frames + 1
                    )
                    closure_end = i
                    reopen_run = 0

                continue

            # After closure, require the eyes to return to the open range.
            if both_open:
                reopen_run += 1
            else:
                reopen_run = 0

            if reopen_run >= self.config.blink_min_reopen_frames:
                recovery_index = i
                return {
                    "blink_detected": True,
                    "reason": None,
                    "valid_observations": len(observations),
                    "baseline": round(baseline, 4),
                    "close_threshold": round(close_threshold, 4),
                    "eye_close_threshold": round(eye_close_threshold, 4),
                    "reopen_threshold": round(reopen_threshold, 4),
                    "max_score": round(float(np.max(mean_s)), 4),
                    "peak_index": peak_index,
                    "closure_start": closure_start,
                    "closure_end": closure_end,
                    "recovery_index": recovery_index,
                    "scores": [round(float(x), 4) for x in mean_s],
                    "left_scores": [round(float(x), 4) for x in left_s],
                    "right_scores": [round(float(x), 4) for x in right_s],
                }

        return {
            "blink_detected": False,
            "reason": "NO_COMPLETE_BLINK_SEQUENCE",
            "valid_observations": len(observations),
            "baseline": round(baseline, 4),
            "close_threshold": round(close_threshold, 4),
            "eye_close_threshold": round(eye_close_threshold, 4),
            "reopen_threshold": round(reopen_threshold, 4),
            "max_score": round(float(np.max(mean_s)), 4),
            "peak_index": peak_index,
            "closure_start": closure_start,
            "closure_end": closure_end,
            "recovery_index": recovery_index,
            "scores": [round(float(x), 4) for x in mean_s],
            "left_scores": [round(float(x), 4) for x in left_s],
            "right_scores": [round(float(x), 4) for x in right_s],
        }

    def detect_blink(
        self,
        images: list[np.ndarray],
    ) -> dict[str, Any]:
        """Detect one natural blink using OPEN -> CLOSED -> OPEN."""
        observations: list[dict[str, float | int]] = []

        for index, image in enumerate(images):
            value = self.get_blink_score(image)
            if value is None:
                continue

            observations.append({
                "index": index,
                "left": float(value["left"]),
                "right": float(value["right"]),
                "mean": float(value["mean"]),
            })

        return self._evaluate_blink_observations(observations)

    def _collect_blink_observations(
        self,
        frames: list[str],
    ) -> list[dict[str, float | int]]:
        """Run MediaPipe frame-by-frame and retain only scalar observations."""
        observations: list[dict[str, float | int]] = []
        for index, image in self.iter_decoded_frames(frames):
            try:
                value = self.get_blink_score(image)
                if value is not None:
                    observations.append({
                        "index": index,
                        "left": float(value["left"]),
                        "right": float(value["right"]),
                        "mean": float(value["mean"]),
                    })
            finally:
                del image
        return observations

    # ========================================================================
    # VERIFICATION
    # ========================================================================

    def verify(
        self,
        reference_embedding: list[float],
        frames: list[str],
    ) -> dict[str, Any]:
        reference = self.normalize_embedding(reference_embedding)

        if reference.size != self.config.embedding_dim:
            raise MLValidationError(
                "EMBEDDING_DIMENSION",
                f"reference_embedding must contain "
                f"{self.config.embedding_dim} values",
            )

        if not (
            self.config.attendance_min_frames
            <= len(frames)
            <= self.config.attendance_max_frames
        ):
            raise MLValidationError(
                "INVALID_FRAME_COUNT",
                f"Attendance requires "
                f"{self.config.attendance_min_frames} to "
                f"{self.config.attendance_max_frames} frames",
            )

        # Decode each frame exactly once. Run MediaPipe and InsightFace on the
        # same image, then release it before the next frame arrives.
        blink_observations: list[dict[str, float | int]] = []
        candidates: list[dict[str, Any]] = []
        rejection_counts: dict[str, int] = {}
        quality_details: list[dict[str, Any]] = []

        for index, image in self.iter_decoded_frames(frames):
            try:
                blink_value = self.get_blink_score(image)
                if blink_value is not None:
                    blink_observations.append({
                        "index": index,
                        "left": float(blink_value["left"]),
                        "right": float(blink_value["right"]),
                        "mean": float(blink_value["mean"]),
                    })

                try:
                    embedding, face = self.extract_face_embedding(image)
                    quality = self.assess_face_quality(image, face)

                    if quality["usable"]:
                        candidates.append(
                            {
                                "index": index,
                                "embedding": embedding,
                                "quality": quality,
                            }
                        )
                    else:
                        rejection_counts["LOW_QUALITY"] = (
                            rejection_counts.get("LOW_QUALITY", 0) + 1
                        )
                        quality_details.append(
                            {
                                "frame": index,
                                "area_ratio": round(
                                    float(quality["area_ratio"]), 4
                                ),
                                "blur_variance": round(
                                    float(quality["blur_variance"]), 2
                                ),
                                "quality_score": round(
                                    float(quality["quality_score"]), 4
                                ),
                                "face_size_ok": bool(
                                    quality["face_size_ok"]
                                ),
                                "blur_ok": bool(quality["blur_ok"]),
                            }
                        )
                except MLValidationError as exc:
                    rejection_counts[exc.code] = (
                        rejection_counts.get(exc.code, 0) + 1
                    )
            finally:
                del image

        gc.collect()
        blink = self._evaluate_blink_observations(blink_observations)

        if not blink["blink_detected"]:
            return {
                "success": True,
                "verified": False,
                "similarity": None,
                "mean_similarity": None,
                "min_similarity": None,
                "threshold": self.config.face_threshold,
                "passed_frames": 0,
                "total_identity_frames": 0,
                "pass_ratio": 0.0,
                "blink_detected": False,
                "liveness": {
                    "passed": False,
                    "method": "blink_challenge",
                    "reason": blink["reason"],
                    "valid_observations": blink.get("valid_observations"),
                    "baseline": blink.get("baseline"),
                    "max_score": blink.get("max_score"),
                    "close_threshold": blink.get("close_threshold"),
                    "eye_close_threshold": blink.get(
                        "eye_close_threshold"
                    ),
                    "reopen_threshold": blink.get("reopen_threshold"),
                    "peak_index": blink.get("peak_index"),
                    "closure_start": blink.get("closure_start"),
                    "closure_end": blink.get("closure_end"),
                    "recovery_index": blink.get("recovery_index"),
                    "scores": blink.get("scores"),
                },
                "reason": "BLINK_CHALLENGE_FAILED",
            }

        if len(candidates) < self.config.verification_min_good_frames:
            return {
                "success": True,
                "verified": False,
                "similarity": None,
                "mean_similarity": None,
                "min_similarity": None,
                "threshold": self.config.face_threshold,
                "passed_frames": 0,
                "total_identity_frames": len(candidates),
                "pass_ratio": 0.0,
                "blink_detected": True,
                "liveness": {
                    "passed": True,
                    "method": "blink_challenge",
                    "reason": None,
                },
                "rejected_frame_counts": rejection_counts,
                "quality_details": quality_details,
                "reason": "INSUFFICIENT_GOOD_FRAMES",
            }

        selected = self.select_temporally_distributed(
            candidates,
            self.config.verification_target_frames,
        )

        scores = [
            self.cosine_similarity(reference, item["embedding"])
            for item in selected
        ]

        score_array = np.asarray(scores, dtype=np.float32)
        median_similarity = float(np.median(score_array))
        mean_similarity = float(np.mean(score_array))
        min_similarity = float(np.min(score_array))

        passed_frames = int(
            np.sum(score_array >= self.config.face_threshold)
        )
        pass_ratio = float(passed_frames / len(score_array))

        verified = bool(
            median_similarity >= self.config.face_threshold
            and pass_ratio >= self.config.verification_min_pass_ratio
        )

        return {
            "success": True,
            "verified": verified,
            "similarity": round(median_similarity, 4),
            "mean_similarity": round(mean_similarity, 4),
            "min_similarity": round(min_similarity, 4),
            "threshold": self.config.face_threshold,
            "passed_frames": passed_frames,
            "total_identity_frames": len(score_array),
            "pass_ratio": round(pass_ratio, 4),
            "scores": [round(float(x), 4) for x in score_array],
            "selected_frame_indices": [
                int(item["index"]) for item in selected
            ],
            "blink_detected": True,
            "liveness": {
                "passed": True,
                "method": "blink_challenge",
                "peak_score": blink.get("max_score"),
                "reason": None,
            },
            "rejected_frame_counts": rejection_counts,
            "reason": None if verified else "FACE_SIMILARITY_FAILED",
        }

    # ========================================================================
    # HEALTH
    # ========================================================================

    def health(self) -> dict[str, Any]:
        # On Render/Linux, VmHWM is the process peak resident memory in KiB.
        # Keep a portable fallback for local macOS development.
        peak_rss_mb = 0.0
        try:
            status_file = Path("/proc/self/status")
            if status_file.exists():
                for line in status_file.read_text().splitlines():
                    if line.startswith("VmHWM:"):
                        peak_rss_mb = float(line.split()[1]) / 1024.0
                        break
        except Exception:
            pass

        if peak_rss_mb == 0.0:
            try:
                import resource
                raw_rss = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
                peak_rss_mb = (
                    raw_rss / (1024.0 * 1024.0)
                    if sys.platform == "darwin"
                    else raw_rss / 1024.0
                )
            except Exception:
                pass

        return {
            "status": "ok",
            "model": self.config.model_name,
            "embedding_dimension": self.config.embedding_dim,
            "peak_rss_mb": round(float(peak_rss_mb), 2),
            "face_threshold": self.config.face_threshold,
            "verification_target_frames": self.config.verification_target_frames,
            "verification_min_good_frames": self.config.verification_min_good_frames,
            "verification_min_pass_ratio": self.config.verification_min_pass_ratio,
            "min_face_area_ratio": self.config.min_face_area_ratio,
            "min_blur_variance": self.config.min_blur_variance,
            "registration_min_frames": self.config.registration_min_frames,
            "registration_max_frames": self.config.registration_max_frames,
            "registration_target_frames": self.config.registration_target_frames,
            "attendance_min_frames": self.config.attendance_min_frames,
            "attendance_max_frames": self.config.attendance_max_frames,
            "blink_min_observations": self.config.blink_min_observations,
            "blink_min_closed_frames": self.config.blink_min_closed_frames,
            "blink_min_reopen_frames": self.config.blink_min_reopen_frames,
            "storage": "stateless",
        }
