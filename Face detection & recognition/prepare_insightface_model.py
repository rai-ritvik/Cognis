"""Download the small InsightFace buffalo_sc model pack for deployment.

This runs during the Render build so the deployed service starts with the ONNX
files already present. The downloaded pretrained weights are for non-commercial
research use according to InsightFace's published model terms.
"""

from __future__ import annotations

import hashlib
import os
import shutil
import tempfile
import urllib.request
import zipfile
from pathlib import Path

MODEL_NAME = "buffalo_sc"
MODEL_URL = (
    "https://github.com/deepinsight/insightface/"
    "releases/download/model-zoo/buffalo_sc.zip"
)
MODEL_SHA256 = (
    "57d31b56b6ffa911c8a73cfc1707c73cab76efe7f13b675a05223bf42de47c72"
)

ROOT = Path(__file__).resolve().parent
PACK_DIR = ROOT / "models" / MODEL_NAME
DETECTOR = PACK_DIR / "det_500m.onnx"
RECOGNIZER = PACK_DIR / "w600k_mbf.onnx"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def safe_extract(archive: zipfile.ZipFile, destination: Path) -> None:
    destination = destination.resolve()
    for member in archive.infolist():
        target = (destination / member.filename).resolve()
        if not str(target).startswith(str(destination) + os.sep):
            raise RuntimeError("Unsafe path in model archive")
    archive.extractall(destination)


def main() -> None:
    if DETECTOR.exists() and RECOGNIZER.exists():
        print("[BUILD] buffalo_sc model already present; skipping download")
        return

    PACK_DIR.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="buffalo_sc_") as temp_dir:
        temp_dir_path = Path(temp_dir)
        zip_path = temp_dir_path / f"{MODEL_NAME}.zip"
        extract_dir = temp_dir_path / MODEL_NAME

        print("[BUILD] Downloading InsightFace buffalo_sc model...")
        urllib.request.urlretrieve(MODEL_URL, zip_path)

        digest = sha256_file(zip_path)
        if digest != MODEL_SHA256:
            raise RuntimeError(
                "buffalo_sc SHA-256 mismatch: "
                f"expected {MODEL_SHA256}, got {digest}"
            )

        extract_dir.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(zip_path, "r") as archive:
            safe_extract(archive, extract_dir)

        detector_matches = list(extract_dir.rglob("det_500m.onnx"))
        recognizer_matches = list(extract_dir.rglob("w600k_mbf.onnx"))
        if not detector_matches or not recognizer_matches:
            raise RuntimeError("buffalo_sc archive is missing required ONNX files")

        if PACK_DIR.exists():
            shutil.rmtree(PACK_DIR)
        PACK_DIR.mkdir(parents=True, exist_ok=True)
        shutil.copy2(detector_matches[0], DETECTOR)
        shutil.copy2(recognizer_matches[0], RECOGNIZER)

    print(
        "[BUILD] buffalo_sc ready: "
        f"detector={DETECTOR.stat().st_size / 1024 / 1024:.1f} MB, "
        f"recognizer={RECOGNIZER.stat().st_size / 1024 / 1024:.1f} MB"
    )


if __name__ == "__main__":
    main()
