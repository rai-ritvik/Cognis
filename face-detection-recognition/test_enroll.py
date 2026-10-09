import base64
import json
import time
from pathlib import Path
import cv2


OUTPUT_FILE = Path("enroll_request.json")

CAMERA_INDEX = 0
FRAME_COUNT = 5
DELAY_SECONDS = 0.7


def image_to_data_url(frame):
    ok, encoded = cv2.imencode(
        ".jpg",
        frame,
        [cv2.IMWRITE_JPEG_QUALITY, 85],
    )

    if not ok:
        raise RuntimeError("Could not encode camera frame")

    b64 = base64.b64encode(
        encoded.tobytes()
    ).decode("utf-8")

    return f"data:image/jpeg;base64,{b64}"


def main():
    cap = cv2.VideoCapture(CAMERA_INDEX)

    if not cap.isOpened():
        raise RuntimeError(
            "Could not open camera. Check camera permissions."
        )

    frames = []

    print("Camera opened.")
    print("Keep your face centered.")
    print(f"Capturing {FRAME_COUNT} frames...")

    try:
        time.sleep(2)

        for i in range(FRAME_COUNT):

            ok, frame = cap.read()

            if not ok:
                raise RuntimeError(
                    f"Could not read camera frame {i + 1}"
                )

            frames.append(
                image_to_data_url(frame)
            )

            print(
                f"Captured frame {i + 1}/{FRAME_COUNT}"
            )

            time.sleep(DELAY_SECONDS)

    finally:
        cap.release()

    request = {
        "student_id": "25154115",
        "full_name": "Ambesh Kumar Sharma",
        "frames": frames,
    }

    OUTPUT_FILE.write_text(
        json.dumps(
            request,
            indent=2
        ),
        encoding="utf-8",
    )

    print()
    print("✅ Enrollment request created:")
    print(OUTPUT_FILE.resolve())


if __name__ == "__main__":
    main()