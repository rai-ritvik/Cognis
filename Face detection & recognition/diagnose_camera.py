import time
import cv2
from app.face_service import FaceMLService, MLValidationError


CAMERA_INDEX = 0
FRAME_COUNT = 5


print("=" * 70)
print("FACE ATTENDANCE CAMERA DIAGNOSTIC")
print("=" * 70)



# Load ML service

service = FaceMLService()


# Open camera

cap = cv2.VideoCapture(
    CAMERA_INDEX
)

if not cap.isOpened():
    raise RuntimeError(
        "Could not open camera."
    )


print()
print("Camera opened.")
print(
    "Keep ONLY ONE person in the frame."
)
print(
    "Keep your face centered."
)
print(
    "Use good lighting."
)
print()


time.sleep(2)


frames = []


# Capture

try:

    for i in range(FRAME_COUNT):

        ok, frame = cap.read()

        if not ok:

            print(
                f"Frame {i + 1}: CAMERA READ FAILED"
            )

            continue

        frames.append(frame)

        filename = (
            f"diagnostic_frame_{i + 1}.jpg"
        )

        cv2.imwrite(
            filename,
            frame
        )

        print(
            f"Captured frame {i + 1}/{FRAME_COUNT}: "
            f"{frame.shape[1]}x{frame.shape[0]}"
        )

        time.sleep(0.6)

finally:

    cap.release()


# ML diagnostics

print()
print("=" * 70)
print("PER-FRAME ML DIAGNOSTIC")
print("=" * 70)


usable_count = 0


for i, frame in enumerate(
    frames,
    start=1
):

    print()
    print(
        f"--- FRAME {i} ---"
    )


    try:

        # IMPORTANT:
        # The camera already gives us a BGR NumPy image.
        # We do NOT need to convert it into base64 and decode it again.

        embedding, face = (
        service.extract_face_embedding(
        frame
          )
         )

        quality = service.assess_face_quality(
        frame,
        face
        )


        print(
            "Face detected: YES"
        )

        print(
            "Face bounding box:",
            face.bbox
        )

        print(
            "Face area ratio:",
            round(
                quality["area_ratio"],
                4
            )
        )

        print(
            "Blur variance:",
            round(
                quality["blur_variance"],
                2
            )
        )

        print(
            "Quality score:",
            round(
                quality["quality_score"],
                4
            )
        )

        print(
            "Usable:",
            quality["usable"]
        )


        if quality["usable"]:

            usable_count += 1


    except MLValidationError as exc:

        print(
            "ML ERROR CODE:",
            exc.code
        )

        print(
            "MESSAGE:",
            exc.message
        )


    except Exception as exc:

        print(
            "UNEXPECTED ERROR:",
            type(exc).__name__,
            str(exc)
        )


# Final result

print()
print("=" * 70)
print("RESULT")
print("=" * 70)

print(
    "Captured frames:",
    len(frames)
)

print(
    "Usable frames:",
    usable_count,
    "/",
    len(frames)
)


print()
print("Saved diagnostic images:")

for i in range(
    1,
    len(frames) + 1
):

    print(
        f"  diagnostic_frame_{i}.jpg"
    )