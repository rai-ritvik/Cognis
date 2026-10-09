import base64
import json
import os
import time
import urllib.error
import urllib.request
import cv2


API = os.getenv("ML_API_URL", "http://127.0.0.1:8000")
API_KEY = os.getenv("ML_API_KEY")

STUDENT_ID = "25154115"
FULL_NAME = "Ambesh Kumar Sharma"

CAMERA_INDEX = 0


def frame_to_data_url(frame):
    ok, encoded = cv2.imencode(
        ".jpg",
        frame,
        [cv2.IMWRITE_JPEG_QUALITY, 70],
    )

    if not ok:
        raise RuntimeError("Could not encode frame")

    b64 = base64.b64encode(
        encoded.tobytes()
    ).decode("utf-8")

    return "data:image/jpeg;base64," + b64


def capture_frames(
    count,
    delay,
    message,
):
    print()
    print(message)

    cap = cv2.VideoCapture(
        CAMERA_INDEX
    )

    if not cap.isOpened():
        raise RuntimeError(
            "Camera could not be opened"
        )

    frames = []

    try:
        time.sleep(2)

        for i in range(count):

            ok, frame = cap.read()

            if not ok:
                raise RuntimeError(
                    f"Camera read failed at frame {i+1}"
                )

            frames.append(
                frame_to_data_url(frame)
            )

            print(
                f"Frame {i+1}/{count}"
            )

            time.sleep(delay)

    finally:
        cap.release()

    return frames


def post_json(path, payload):

    data = json.dumps(
        payload
    ).encode("utf-8")

    request = urllib.request.Request(
        API + path,
        data=data,
        headers={
            "Content-Type": "application/json",
            **({"X-API-Key": API_KEY} if API_KEY else {}),
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(
            request,
            timeout=180,
        ) as response:

            body = response.read().decode()

            return (
                response.status,
                json.loads(body),
            )

    except urllib.error.HTTPError as exc:

        body = exc.read().decode()

        try:
            result = json.loads(body)
        except Exception:
            result = {
                "raw": body
            }

        return exc.code, result


# 1. ENROLLMENT

print("=" * 60)
print("ENROLLMENT")
print("=" * 60)

enroll_frames = capture_frames(
    count=5,
    delay=0.6,
    message=(
        "Look directly at the camera. "
        "Keep only your face in the frame."
    ),
)

enroll_payload = {
    "student_id": STUDENT_ID,
    "full_name": FULL_NAME,
    "frames": enroll_frames,
}

status, result = post_json(
    "/enroll",
    enroll_payload,
)

print()
print("HTTP:", status)
print(
    json.dumps(
        {
            k: v
            for k, v in result.items()
            if k != "reference_embedding"
        },
        indent=2,
    )
)

if status != 200:
    raise SystemExit(
        "Enrollment failed"
    )

reference_embedding = result[
    "reference_embedding"
]

print(
    "\nEmbedding dimension:",
    len(reference_embedding),
)

if len(reference_embedding) != 512:
    raise SystemExit(
        "Invalid embedding dimension"
    )

print(
    "\n✅ ENROLLMENT PASSED"
)


# 2. ATTENDANCE

print()
print("=" * 60)
print("ATTENDANCE")
print("=" * 60)

attendance_frames = capture_frames(
    count=20,
    delay=0.12,
    message=(
        "Keep your eyes open initially. "
        "Blink ONCE during capture, "
        "then open your eyes again."
    ),
)

verify_payload = {
    "reference_embedding":
        reference_embedding,
    "frames":
        attendance_frames,
}

status, result = post_json(
    "/verify",
    verify_payload,
)

print()
print("HTTP:", status)
print(
    json.dumps(
        result,
        indent=2,
    )
)

if status != 200:
    raise SystemExit(
        "Verification request failed"
    )

print()

if result.get("verified"):

    print(
        "✅ GENUINE VERIFICATION PASSED"
    )

else:

    print(
        "❌ GENUINE VERIFICATION FAILED"
    )