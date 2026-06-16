"""
CQS Logo Processor - Background Removal + Resolution Enhancement Service
Runs on port 8000, called by the Next.js studio via /api/studio/remove-background
"""
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from PIL import Image, ImageFilter
from rembg import remove, new_session
import numpy as np
import io
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="CQS Logo Processor")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

# Target: 3000px on the longest side @ 300 DPI = ~10" print at full quality.
# Printful DTG minimum is 150 DPI; 300 is ideal.
TARGET_PX = 3000
TARGET_DPI = 300

logger.info("Loading isnet-general-use model...")
_session = new_session("isnet-general-use")
logger.info("Model ready.")


def _already_transparent(img: Image.Image, min_ratio: float = 0.10) -> bool:
    """
    Returns True if the image has substantial transparency — at least 10% of
    pixels are non-opaque. This distinguishes properly processed logos from
    screenshots that have a few stray shadow/anti-alias pixels with alpha < 255.
    """
    if img.mode != "RGBA":
        return False
    arr = np.array(img)
    total = arr.shape[0] * arr.shape[1]
    count = int(np.sum(arr[:, :, 3] < 255))
    ratio = count / total
    if ratio >= min_ratio:
        logger.info(f"Already transparent ({ratio:.1%} of pixels non-opaque) — skipping ML")
        return True
    logger.info(f"Minimal transparency ({ratio:.1%}) — likely screenshot shadow, proceeding with ML")
    return False


def _is_light_background(img: Image.Image, threshold: int = 240) -> bool:
    """Sample the four corners to detect a solid white/light background."""
    rgba = img.convert("RGBA")
    w, h = rgba.size
    sample_size = max(5, min(20, w // 20, h // 20))
    corners = [
        rgba.crop((0, 0, sample_size, sample_size)),
        rgba.crop((w - sample_size, 0, w, sample_size)),
        rgba.crop((0, h - sample_size, sample_size, h)),
        rgba.crop((w - sample_size, h - sample_size, w, h)),
    ]
    pixels = []
    for c in corners:
        arr = np.array(c)
        pixels.extend(arr[:, :, :3].reshape(-1, 3).tolist())
    avg = np.mean(pixels, axis=0)
    return bool(np.all(avg >= threshold))


def _prestrip_white(img: Image.Image, tolerance: int = 30) -> Image.Image:
    """
    Flood-fill from edges to remove near-white background pixels before ML.
    Gives the model a cleaner input and prevents mis-segmentation of large
    uniform white regions.
    """
    rgba = img.convert("RGBA")
    data = np.array(rgba, dtype=np.float32)
    r, g, b = data[:, :, 0], data[:, :, 1], data[:, :, 2]
    near_white = (r >= 255 - tolerance) & (g >= 255 - tolerance) & (b >= 255 - tolerance)

    h, w = near_white.shape
    visited = np.zeros((h, w), dtype=bool)
    stack = []
    for x in range(w):
        if near_white[0, x]: stack.append((0, x))
        if near_white[h - 1, x]: stack.append((h - 1, x))
    for y in range(h):
        if near_white[y, 0]: stack.append((y, 0))
        if near_white[y, w - 1]: stack.append((y, w - 1))

    while stack:
        cy, cx = stack.pop()
        if cy < 0 or cy >= h or cx < 0 or cx >= w or visited[cy, cx]:
            continue
        visited[cy, cx] = True
        if not near_white[cy, cx]:
            continue
        for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            stack.append((cy + dy, cx + dx))

    data[visited, 3] = 0
    return Image.fromarray(data.astype(np.uint8), "RGBA")


def _boost_resolution(img: Image.Image, target_px: int = TARGET_PX) -> Image.Image:
    """
    Upscale the image if its longest side is below target_px.
    Uses Lanczos (best quality traditional resampling) then applies a mild
    unsharp mask to recover crispness lost during interpolation.
    Images already at or above target_px are returned unchanged.
    """
    w, h = img.size
    longest = max(w, h)

    if longest >= target_px:
        logger.info(f"Resolution OK — {w}x{h}px, no upscaling needed")
        return img

    scale = target_px / longest
    new_w, new_h = round(w * scale), round(h * scale)
    logger.info(f"Upscaling {w}x{h} → {new_w}x{new_h} (×{scale:.2f})")

    upscaled = img.resize((new_w, new_h), Image.LANCZOS)

    # Unsharp mask: recovers fine detail softened by Lanczos interpolation.
    # radius=1.5 targets pixel-level edges; percent=60 is a gentle boost.
    upscaled = upscaled.filter(ImageFilter.UnsharpMask(radius=1.5, percent=60, threshold=3))

    return upscaled


def _to_png(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=False, dpi=(TARGET_DPI, TARGET_DPI))
    return buf.getvalue()


@app.get("/health")
async def health():
    return {"status": "ok", "model": "isnet-general-use", "target_px": TARGET_PX, "target_dpi": TARGET_DPI}


@app.post("/remove-background")
async def remove_background(file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    try:
        contents = await file.read()
        if not contents:
            raise HTTPException(status_code=400, detail="Empty file")

        logger.info(f"Processing {file.filename} ({file.content_type}, {len(contents)} bytes)")

        input_image = Image.open(io.BytesIO(contents)).convert("RGBA")
        w, h = input_image.size
        logger.info(f"Input size: {w}x{h}px")

        # Already transparent — skip ML, just boost resolution and return.
        if _already_transparent(input_image):
            output = _boost_resolution(input_image)
            return Response(content=_to_png(output), media_type="image/png")

        # Pre-strip solid white/light backgrounds before running ML.
        if _is_light_background(input_image):
            logger.info("Light background detected — pre-stripping white before ML pass")
            prestripped = _prestrip_white(input_image)
        else:
            prestripped = input_image

        # ML background removal with alpha matting for clean edges.
        output_image = remove(
            prestripped,
            session=_session,
            alpha_matting=True,
            alpha_matting_foreground_threshold=240,
            alpha_matting_background_threshold=10,
            alpha_matting_erode_size=10,
        )

        if output_image.mode != "RGBA":
            output_image = output_image.convert("RGBA")

        # Boost resolution after removal so the clean foreground gets upscaled.
        output_image = _boost_resolution(output_image)

        result = _to_png(output_image)
        logger.info(f"Done — output {len(result)} bytes")
        return Response(content=result, media_type="image/png")

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Processing failed")
        raise HTTPException(status_code=500, detail=str(e))
