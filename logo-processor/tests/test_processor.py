"""
pytest tests for the CQS Logo Processor service.

Requires the service running at PROCESSOR_URL (default http://localhost:8000).
Run from the project root:
    pytest logo-processor/tests/ -v
"""
import io
import os
import pytest
import httpx
from PIL import Image
import numpy as np

PROCESSOR_URL = os.getenv("PROCESSOR_URL", "http://localhost:8000")
FIXTURES = os.path.join(os.path.dirname(__file__), "../../tests/fixtures")


def fixture(filename: str) -> str:
    return os.path.join(FIXTURES, filename)


def open_result(content: bytes) -> Image.Image:
    return Image.open(io.BytesIO(content)).convert("RGBA")


def has_transparency(img: Image.Image) -> bool:
    arr = np.array(img)
    return bool(np.any(arr[:, :, 3] < 255))


def transparency_ratio(img: Image.Image) -> float:
    arr = np.array(img)
    return float(np.sum(arr[:, :, 3] < 255)) / (arr.shape[0] * arr.shape[1])


# ── Health ────────────────────────────────────────────────────────────────────

def test_health():
    r = httpx.get(f"{PROCESSOR_URL}/health")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert "model" in data


# ── Background removal ────────────────────────────────────────────────────────

def test_removes_background_from_opaque_jpeg():
    """Small opaque JPEG should come back with transparent background."""
    with open(fixture("logo-small-opaque.jpeg"), "rb") as f:
        r = httpx.post(f"{PROCESSOR_URL}/remove-background",
                       files={"file": ("logo.jpeg", f, "image/jpeg")},
                       timeout=60)
    assert r.status_code == 200
    assert r.headers["content-type"] == "image/png"
    img = open_result(r.content)
    assert has_transparency(img), "Expected background to be removed but all pixels are opaque"
    assert transparency_ratio(img) > 0.10, "Expected >10% transparent pixels after removal"


def test_removes_background_from_wolf_logo():
    """Real logo with white background — should produce clean transparent output."""
    with open(fixture("logo-wolf.jpg"), "rb") as f:
        r = httpx.post(f"{PROCESSOR_URL}/remove-background",
                       files={"file": ("wolf.jpg", f, "image/jpeg")},
                       timeout=120)
    assert r.status_code == 200
    img = open_result(r.content)
    assert has_transparency(img)
    assert transparency_ratio(img) > 0.10


def test_removes_background_from_jpeg_disguised_as_png():
    """File named .png but actually JPEG — service should handle it."""
    with open(fixture("logo-jpeg-as-png.png"), "rb") as f:
        r = httpx.post(f"{PROCESSOR_URL}/remove-background",
                       files={"file": ("test.png", f, "image/png")},
                       timeout=60)
    assert r.status_code == 200
    img = open_result(r.content)
    assert has_transparency(img)


# ── Pass-through for already-transparent images ───────────────────────────────

def test_transparent_png_passes_through_unchanged():
    """
    PNG that already has a transparent background (>10% transparent pixels)
    should be returned as-is — no ML removal should run.
    The output pixel data should be nearly identical to the input.
    """
    with open(fixture("logo-transparent.png"), "rb") as f:
        original_bytes = f.read()
    original = Image.open(io.BytesIO(original_bytes)).convert("RGBA")

    r = httpx.post(f"{PROCESSOR_URL}/remove-background",
                   files={"file": ("logo.png", io.BytesIO(original_bytes), "image/png")},
                   timeout=30)
    assert r.status_code == 200
    result = open_result(r.content)

    # Dimensions must be preserved or upscaled (never shrunk)
    assert result.width >= original.width
    assert result.height >= original.height

    # Must still be transparent
    assert has_transparency(result)


def test_webp_with_alpha_passes_through():
    """WebP file with existing alpha channel should skip ML and pass through."""
    with open(fixture("logo-webp-alpha.webp"), "rb") as f:
        content = f.read()

    r = httpx.post(f"{PROCESSOR_URL}/remove-background",
                   files={"file": ("logo.webp", io.BytesIO(content), "image/webp")},
                   timeout=30)
    assert r.status_code == 200
    assert r.headers["content-type"] == "image/png"
    img = open_result(r.content)
    assert has_transparency(img)


# ── Resolution upscaling ──────────────────────────────────────────────────────

def test_small_image_is_upscaled():
    """225×225 image should be upscaled to at least 3000px on longest side."""
    with open(fixture("logo-small-opaque.jpeg"), "rb") as f:
        r = httpx.post(f"{PROCESSOR_URL}/remove-background",
                       files={"file": ("logo.jpeg", f, "image/jpeg")},
                       timeout=60)
    assert r.status_code == 200
    img = open_result(r.content)
    assert max(img.width, img.height) >= 3000, (
        f"Expected upscale to >=3000px, got {img.width}x{img.height}"
    )


def test_large_image_is_not_shrunk():
    """1200×1200 image should not be shrunk even though it's below 3000px target."""
    with open(fixture("logo-wolf.jpg"), "rb") as f:
        r = httpx.post(f"{PROCESSOR_URL}/remove-background",
                       files={"file": ("wolf.jpg", f, "image/jpeg")},
                       timeout=120)
    assert r.status_code == 200
    img = open_result(r.content)
    # After upscaling 1200→3000, should be at least 3000px
    assert max(img.width, img.height) >= 3000


def test_already_large_transparent_image_not_shrunk():
    """Transparent image that's large enough should not be downscaled."""
    with open(fixture("logo-transparent.png"), "rb") as f:
        original = Image.open(f)
        orig_size = max(original.width, original.height)

    with open(fixture("logo-transparent.png"), "rb") as f:
        r = httpx.post(f"{PROCESSOR_URL}/remove-background",
                       files={"file": ("logo.png", f, "image/png")},
                       timeout=30)
    assert r.status_code == 200
    img = open_result(r.content)
    assert max(img.width, img.height) >= orig_size


# ── Output format ─────────────────────────────────────────────────────────────

def test_output_is_always_png():
    """All inputs should produce PNG output regardless of input format."""
    fixtures_to_test = [
        ("logo-small-opaque.jpeg", "image/jpeg"),
        ("logo-wolf.jpg", "image/jpeg"),
        ("logo-transparent.png", "image/png"),
    ]
    for filename, mime in fixtures_to_test:
        with open(fixture(filename), "rb") as f:
            r = httpx.post(f"{PROCESSOR_URL}/remove-background",
                           files={"file": (filename, f, mime)},
                           timeout=120)
        assert r.status_code == 200, f"Failed for {filename}: {r.text}"
        assert r.headers["content-type"] == "image/png", f"Wrong content-type for {filename}"
        # Verify it's actually a valid PNG
        img = Image.open(io.BytesIO(r.content))
        assert img.format == "PNG", f"Output is not PNG for {filename}"


# ── Error handling ────────────────────────────────────────────────────────────

def test_rejects_empty_file():
    r = httpx.post(f"{PROCESSOR_URL}/remove-background",
                   files={"file": ("empty.png", io.BytesIO(b""), "image/png")},
                   timeout=10)
    assert r.status_code == 400


def test_rejects_non_image():
    r = httpx.post(f"{PROCESSOR_URL}/remove-background",
                   files={"file": ("doc.pdf", io.BytesIO(b"not an image"), "application/pdf")},
                   timeout=10)
    assert r.status_code == 400
