"""
analyze.py — Race Finish Line OCR System
Olzhasstik Motorsports | OM-Bot Integration

Pipeline:
  1. Read video frame-by-frame
  2. MOG2 background subtractor → detect motion in finish-line ROI
  3. When motion threshold exceeded → run EasyOCR on name-tag strip
  4. Deduplicate results (same name within 3s cooldown)
  5. Output JSON lines to stdout for Node.js to consume

Camera is FIXED, cars move VERTICALLY (top → bottom through finish line).
Name tags appear ABOVE the car body, roughly in the upper-center of each car.

Usage:
  python analyze.py <video_path> [--debug]
"""

import sys
import cv2
import json
import time
import argparse
import numpy as np

# ── Lazy-load EasyOCR so import errors surface clearly ──────────────────────
try:
    import easyocr
except ImportError:
    print(json.dumps({"error": "easyocr not installed. Run: pip install easyocr"}),
          flush=True)
    sys.exit(1)


# ═══════════════════════════════════════════════════════════════════════════
#  CONFIG
# ═══════════════════════════════════════════════════════════════════════════

# ROI: where name-tags appear on screen.
# From your screenshot the finish line is roughly at y=55-75% of frame height,
# name tags float ~20-35% from top of frame, spanning full width.
# Adjust ROI_* constants after testing on real video.

ROI_Y_START = 0.18   # fraction of frame height (top of name-tag band)
ROI_Y_END   = 0.55   # fraction of frame height (bottom — covers full car pass)
ROI_X_START = 0.10   # leave some margin on sides
ROI_X_END   = 0.90

# Motion detection
MOTION_PIXEL_THRESHOLD = 800   # minimum changed pixels to trigger OCR
MOG2_HISTORY          = 100    # frames for background model
MOG2_VAR_THRESHOLD    = 40
MOG2_DETECT_SHADOWS   = False  # shadow detection is expensive; off for speed

# OCR
OCR_LANGUAGES   = ["en"]
OCR_CONFIDENCE  = 0.45         # minimum confidence to accept a reading
OCR_RESIZE_W    = 640          # resize ROI width before OCR for speed

# Deduplication
COOLDOWN_SECONDS = 3.0         # ignore same driver name within this window

# Processing
FRAME_SKIP = 2   # process every Nth frame (2 = half framerate, saves CPU)


# ═══════════════════════════════════════════════════════════════════════════
#  HELPERS
# ═══════════════════════════════════════════════════════════════════════════

def build_roi(frame: np.ndarray) -> tuple[np.ndarray, tuple[int,int,int,int]]:
    """Crop the name-tag region from frame. Returns (roi_img, (x1,y1,x2,y2))."""
    h, w = frame.shape[:2]
    x1 = int(w * ROI_X_START)
    x2 = int(w * ROI_X_END)
    y1 = int(h * ROI_Y_START)
    y2 = int(h * ROI_Y_END)
    return frame[y1:y2, x1:x2], (x1, y1, x2, y2)


def preprocess_for_ocr(roi: np.ndarray) -> np.ndarray:
    """
    Enhance white text on varied backgrounds.
    Steps:
      1. Upscale for readability
      2. Convert to grayscale
      3. CLAHE contrast enhancement
      4. Threshold to isolate bright (white) text
    """
    # Upscale to fixed width
    scale = OCR_RESIZE_W / roi.shape[1]
    resized = cv2.resize(roi, None, fx=scale, fy=scale,
                         interpolation=cv2.INTER_CUBIC)

    gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)

    # CLAHE — improves text visibility against busy backgrounds
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)

    # Otsu threshold — white text becomes white, rest black
    _, binary = cv2.threshold(enhanced, 0, 255,
                               cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return binary


def timestamp_from_ms(ms: float) -> str:
    """Convert milliseconds → MM:SS string."""
    total_s = int(ms / 1000)
    m = total_s // 60
    s = total_s % 60
    return f"{m:02d}:{s:02d}"


def emit(driver: str, ts: str) -> None:
    """Print a JSON line to stdout (Node.js reads this via spawn stdio)."""
    record = {"driver": driver, "timestamp": ts}
    print(json.dumps(record), flush=True)


# ═══════════════════════════════════════════════════════════════════════════
#  MAIN
# ═══════════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description="Race finish-line OCR")
    parser.add_argument("video", help="Path to video file")
    parser.add_argument("--debug", action="store_true",
                        help="Save debug frames to ./debug_frames/")
    args = parser.parse_args()

    if args.debug:
        import os
        os.makedirs("debug_frames", exist_ok=True)

    # ── Open video ──────────────────────────────────────────────────────────
    cap = cv2.VideoCapture(args.video)
    if not cap.isOpened():
        print(json.dumps({"error": f"Cannot open video: {args.video}"}), flush=True)
        sys.exit(1)

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0

    # ── Background subtractor ───────────────────────────────────────────────
    mog2 = cv2.createBackgroundSubtractorMOG2(
        history=MOG2_HISTORY,
        varThreshold=MOG2_VAR_THRESHOLD,
        detectShadows=MOG2_DETECT_SHADOWS
    )

    # ── EasyOCR reader (GPU=False for Railway CPU-only) ─────────────────────
    # easyocr prints its own init logs to stderr; redirect if desired
    reader = easyocr.Reader(OCR_LANGUAGES, gpu=False, verbose=False)

    # ── State ────────────────────────────────────────────────────────────────
    last_seen: dict[str, float] = {}   # driver_name → wall-clock time
    frame_idx = 0
    debug_save_idx = 0

    # ── Process frames ───────────────────────────────────────────────────────
    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame_idx += 1
        if frame_idx % FRAME_SKIP != 0:
            continue

        video_ms = cap.get(cv2.CAP_PROP_POS_MSEC)
        ts = timestamp_from_ms(video_ms)

        # 1. Crop ROI
        roi, coords = build_roi(frame)

        # 2. Motion detection on ROI only
        fg_mask = mog2.apply(roi)
        motion_pixels = int(np.count_nonzero(fg_mask))

        if motion_pixels < MOTION_PIXEL_THRESHOLD:
            continue   # nothing moving — skip OCR

        # 3. Preprocess & OCR
        processed = preprocess_for_ocr(roi)

        # EasyOCR accepts BGR, gray, or PIL image
        results = reader.readtext(processed, detail=1, paragraph=False)

        if args.debug and results:
            debug_save_idx += 1
            cv2.imwrite(f"debug_frames/{debug_save_idx:04d}_roi.png", roi)
            cv2.imwrite(f"debug_frames/{debug_save_idx:04d}_proc.png", processed)

        # 4. Filter & emit
        now = time.monotonic()
        for (bbox, text, confidence) in results:
            if confidence < OCR_CONFIDENCE:
                continue

            name = text.strip()
            if len(name) < 2:           # skip single-char noise
                continue
            if not any(c.isalpha() for c in name):  # must have letters
                continue

            # Cooldown dedup
            last = last_seen.get(name, 0.0)
            if (now - last) < COOLDOWN_SECONDS:
                continue

            last_seen[name] = now
            emit(name, ts)

    cap.release()


if __name__ == "__main__":
    main()
