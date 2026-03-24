"""
Test runner — generates Invitfull ads using the NEW system instruction.

Usage:
    python run_batch_test.py --segment generic --dir "/path/to/inspirations" --model pro
    python run_batch_test.py --segment generic --dir "/path/to/inspirations" --model flash
"""

import asyncio
import os
import sys
import argparse
from pathlib import Path
from datetime import datetime

from dotenv import load_dotenv
from google import genai
from google.genai import types
from PIL import Image

# --- Setup ---
SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
load_dotenv(PROJECT_DIR / ".env")

SUPPORTED_RATIOS = {
    "1:1": 1.0,
    "4:3": 4 / 3,
    "3:4": 3 / 4,
    "16:9": 16 / 9,
    "9:16": 9 / 16,
}

MODEL_MAP = {
    "pro": "gemini-3-pro-image-preview",
    "flash": "gemini-3.1-flash-image-preview",
}


def detect_aspect_ratio(image_path: Path) -> str:
    """Detect the closest supported Gemini aspect ratio for an image."""
    with Image.open(image_path) as img:
        w, h = img.size
    ratio = w / h
    closest = min(SUPPORTED_RATIOS, key=lambda k: abs(SUPPORTED_RATIOS[k] - ratio))
    return closest

# --- Segment configuration (uses NEW system instruction + test output folder) ---
SEGMENT_CONFIG = {
    "generic": {
        "campaign_dir": PROJECT_DIR / "general",
        "logo_path": PROJECT_DIR / "general" / "reference-images" / "logo" / "logo.png",
        "screenshots_dir": PROJECT_DIR / "general" / "reference-images" / "screenshots",
        "invitations_dir": PROJECT_DIR / "general" / "reference-images" / "invitations",
        "output_dir": PROJECT_DIR / "general" / "new new system instructions test",
        "system_instruction_file": PROJECT_DIR / "general" / "new new system instructions test" / "system_instruction.md",
        "final_instruction": "Recreate this ad for Invitfull following system instructions. The product is a digital invitation platform for any event. Show real photorealistic people in celebration settings. Use only the brand palette colors specified in the system instruction. The words 'Free' and 'Ad-Free' should appear visibly.",
    },
    "baby_shower": {
        "campaign_dir": PROJECT_DIR / "baby-shower",
        "logo_path": PROJECT_DIR / "baby-shower" / "reference-images" / "logo" / "logo.png",
        "screenshots_dir": PROJECT_DIR / "baby-shower" / "reference-images" / "screenshots",
        "invitations_dir": PROJECT_DIR / "baby-shower" / "reference-images" / "invitations",
        "output_dir": PROJECT_DIR / "baby-shower" / "new new system instructions test",
        "system_instruction_file": PROJECT_DIR / "baby-shower" / "new new system instructions test" / "system_instruction.md",
        "final_instruction": "Recreate this ad for Invitfull following system instructions. The product is a digital invitation platform for baby showers. Show real photorealistic pregnant women and moms in baby shower celebration settings. Use only the brand palette colors specified in the system instruction. The words 'baby shower', 'Free', and 'Ad-Free' should appear visibly.",
    },
}


def load_system_instruction(segment: str) -> str:
    si_path = SEGMENT_CONFIG[segment]["system_instruction_file"]
    if not si_path.exists():
        print(f"ERROR: System instruction not found: {si_path}")
        sys.exit(1)
    return si_path.read_text()


def get_sorted_screenshots(screenshots_dir: Path) -> list[Path]:
    extensions = ("*.png", "*.jpg", "*.jpeg", "*.webp")
    screenshots = []
    for ext in extensions:
        screenshots.extend(screenshots_dir.glob(ext))
    return sorted(screenshots)


def get_inspirations(inspirations_dir: Path) -> list[str]:
    extensions = ("*.png", "*.jpg", "*.jpeg", "*.webp")
    files = []
    for ext in extensions:
        files.extend(inspirations_dir.glob(ext))
    return sorted([f.name for f in files])


def build_contents(inspiration_path: Path, cfg: dict) -> list:
    import random
    contents = []

    # 1. Logo
    contents.append("LOGO — Invitfull brand logo, use exactly as-is:")
    contents.append(Image.open(cfg["logo_path"]))

    # 2. Random 5 brand reference screenshots
    screenshots = get_sorted_screenshots(cfg["screenshots_dir"])
    selected_ss = random.sample(screenshots, min(5, len(screenshots)))
    for i, ss in enumerate(selected_ss, 1):
        contents.append(f"BRAND_REF {i} — Invitfull website screenshot:")
        contents.append(Image.open(ss))

    # 3. Ad inspiration (LAST)
    contents.append("AD_INSPIRATION — Recreate this ad for Invitfull:")
    contents.append(Image.open(inspiration_path))

    # 4. Final instruction
    contents.append(cfg["final_instruction"])

    return contents


async def generate_one(
    client,
    model: str,
    system_instruction: str,
    inspiration_path: Path,
    output_dir: Path,
    prefix: str,
    cfg: dict,
) -> str:
    def _sync_generate():
        aspect_ratio = detect_aspect_ratio(inspiration_path)
        contents = build_contents(inspiration_path, cfg)
        response = client.models.generate_content(
            model=model,
            contents=contents,
            config=types.GenerateContentConfig(
                response_modalities=["IMAGE", "TEXT"],
                system_instruction=system_instruction,
                temperature=1.0,
                image_config=types.ImageConfig(aspect_ratio=aspect_ratio, image_size="4K"),
            ),
        )
        return response, aspect_ratio

    loop = asyncio.get_event_loop()
    response, aspect_ratio = await loop.run_in_executor(None, _sync_generate)

    output_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    stem = inspiration_path.stem
    output_path = output_dir / f"test_{prefix}_{stem}_{timestamp}.png"

    for part in response.candidates[0].content.parts:
        if part.inline_data:
            with open(output_path, "wb") as f:
                f.write(part.inline_data.data)
            return f"OK: {inspiration_path.name} ({aspect_ratio}) -> {output_path.name}"
        elif part.text:
            return f"TEXT RESPONSE for {inspiration_path.name}: {part.text[:200]}"

    return f"FAILED: {inspiration_path.name} — no image generated"


async def main():
    parser = argparse.ArgumentParser(description="Test new system instruction for Invitfull ads")
    parser.add_argument(
        "--segment",
        default="generic",
        choices=list(SEGMENT_CONFIG.keys()),
        help="Event segment (default: generic)",
    )
    parser.add_argument(
        "--dir",
        required=True,
        help="Directory containing inspiration images",
    )
    parser.add_argument(
        "--model",
        required=True,
        choices=["pro", "flash"],
        help="Model to use: pro (Gemini 3 Pro) or flash (Gemini 3.1 Flash)",
    )
    args = parser.parse_args()

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("ERROR: GEMINI_API_KEY not set")
        sys.exit(1)

    inspirations_dir = Path(args.dir)
    if not inspirations_dir.exists():
        print(f"ERROR: Inspirations directory not found: {inspirations_dir}")
        sys.exit(1)

    inspiration_names = get_inspirations(inspirations_dir)
    if not inspiration_names:
        print(f"ERROR: No image files found in {inspirations_dir}")
        sys.exit(1)

    model = MODEL_MAP[args.model]
    client = genai.Client(api_key=api_key)

    cfg = SEGMENT_CONFIG[args.segment]
    system_instruction = load_system_instruction(args.segment)

    print(f"TEST RUN — New System Instruction")
    print(f"Model: {model}")
    print(f"Segment: {args.segment}")
    print(f"System instruction: {cfg['system_instruction_file']}")
    print(f"Output: {cfg['output_dir']}")
    print(f"Logo: {cfg['logo_path']}")
    print(f"Screenshots: {len(get_sorted_screenshots(cfg['screenshots_dir']))}")
    print(f"Inspirations: {len(inspiration_names)} from {inspirations_dir}")
    print("---")

    tasks = [
        generate_one(
            client, model, system_instruction, inspirations_dir / name,
            cfg["output_dir"], f"{args.model}_{args.segment}", cfg,
        )
        for name in inspiration_names
    ]

    results = await asyncio.gather(*tasks, return_exceptions=True)

    print(f"\nResults:")
    for r in results:
        if isinstance(r, Exception):
            print(f"  ERROR: {r}")
        else:
            print(f"  {r}")

    print(f"\nOutput folder: {cfg['output_dir']}")


if __name__ == "__main__":
    asyncio.run(main())
