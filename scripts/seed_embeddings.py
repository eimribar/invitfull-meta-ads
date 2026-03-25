"""
Seed all three embedding databases:
1. Reference images (logo, screenshots, invitations)
2. Inspiration images (all inspiration folders)
3. Active ads (currently running creatives)

Usage:
    python seed_embeddings.py
    python seed_embeddings.py --only references
    python seed_embeddings.py --only inspirations
    python seed_embeddings.py --only ads
"""

import os
import sys
import json
import argparse
import base64
import time
from pathlib import Path
from dotenv import load_dotenv
import requests

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
load_dotenv(PROJECT_DIR / ".env")
load_dotenv(PROJECT_DIR / "agent" / ".env")

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://yhrifwcqwluhbhwquxqn.supabase.co").strip()
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
GEMINI_EMBED_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2-preview:embedContent?key={GEMINI_API_KEY}"

if not GEMINI_API_KEY:
    print("ERROR: Set GEMINI_API_KEY"); sys.exit(1)
if not SUPABASE_KEY:
    print("ERROR: Set SUPABASE_SERVICE_ROLE_KEY"); sys.exit(1)


def embed_image(image_path: Path, text: str = "") -> list[float] | None:
    """Embed an image (optionally with text) using Gemini Embedding 2."""
    with open(image_path, "rb") as f:
        img_data = base64.b64encode(f.read()).decode("utf-8")

    mime = "image/jpeg" if image_path.suffix.lower() in (".jpg", ".jpeg") else "image/png"

    parts = [{"inline_data": {"mime_type": mime, "data": img_data}}]
    if text:
        parts.insert(0, {"text": text})

    resp = requests.post(GEMINI_EMBED_URL, json={
        "content": {"parts": parts},
        "output_dimensionality": 768,
    })

    data = resp.json()
    if "error" in data:
        print(f"  ERROR: {data['error']['message']}")
        return None

    values = data.get("embedding", {}).get("values")
    return values


def supabase_upsert(table: str, rows: list[dict]):
    """Upsert rows to Supabase."""
    resp = requests.post(
        f"{SUPABASE_URL}/rest/v1/{table}",
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates",
        },
        json=rows,
    )
    if resp.status_code not in (200, 201):
        print(f"  Supabase error: {resp.status_code} {resp.text[:200]}")


def find_images(directory: Path) -> list[Path]:
    exts = (".png", ".jpg", ".jpeg", ".webp")
    return sorted([f for f in directory.iterdir() if f.suffix.lower() in exts])


# ─── Reference Images ──────────────────────────────────────────────
def seed_references():
    print("\n=== REFERENCE IMAGES ===\n")

    refs = []

    # Baby shower references
    base = PROJECT_DIR / "baby-shower" / "reference-images"

    # Logo
    logo = base / "logo" / "logo.png"
    if logo.exists():
        refs.append({"path": logo, "category": "logo", "description": "Invitfull brand logo — dark red/orange with calendar icons"})

    # Screenshots
    for f in find_images(base / "screenshots"):
        refs.append({"path": f, "category": "product_screenshot", "description": f"Product screenshot: {f.stem}"})

    # Invitations
    for f in find_images(base / "invitations"):
        refs.append({"path": f, "category": "invitation", "description": f"Invitation example: {f.stem}"})

    # Also check kids-birthday and general references
    for segment in ["kids-birthday", "general"]:
        seg_base = PROJECT_DIR / segment / "reference-images"
        if not seg_base.exists():
            continue
        for sub in ["screenshots", "invitations"]:
            sub_dir = seg_base / sub
            if sub_dir.exists():
                for f in find_images(sub_dir):
                    refs.append({"path": f, "category": f"product_screenshot" if sub == "screenshots" else "invitation", "description": f"{segment} {sub}: {f.stem}"})

    # Deduplicate by filename
    seen = set()
    unique_refs = []
    for r in refs:
        name = r["path"].name
        if name not in seen and name != ".DS_Store":
            seen.add(name)
            unique_refs.append(r)

    print(f"Found {len(unique_refs)} unique reference images")

    rows = []
    for i, ref in enumerate(unique_refs):
        print(f"  [{i+1}/{len(unique_refs)}] {ref['category']}: {ref['path'].name}")
        embedding = embed_image(ref["path"])
        if not embedding:
            continue
        rows.append({
            "id": ref["path"].stem,
            "category": ref["category"],
            "description": ref["description"],
            "file_path": str(ref["path"]),
            "embedding": json.dumps(embedding),
        })
        time.sleep(0.5)  # rate limit

    if rows:
        supabase_upsert("reference_images", rows)
        print(f"\n  Stored {len(rows)} reference embeddings")


# ─── Inspiration Images ────────────────────────────────────────────
def seed_inspirations():
    print("\n=== INSPIRATION IMAGES ===\n")

    inspo_dirs = {
        "canva": Path("/Users/eimribar/Desktop/Projects/ad inspirations/canva"),
        "manychat": Path("/Users/eimribar/Desktop/Projects/ad inspirations/manychat"),
        "staticflow": Path("/Users/eimribar/Desktop/Projects/ad inspirations/staticflow ads inspo"),
        "untitled": Path("/Users/eimribar/Desktop/Projects/ad inspirations/untitled folder"),
        "anthropic": Path("/Users/eimribar/Desktop/Projects/ad inspirations/anthropic ads"),
        "openai": Path("/Users/eimribar/Desktop/Projects/ad inspirations/Openai ads"),
        "zapier": Path("/Users/eimribar/Desktop/Projects/ad inspirations/zapier ads"),
        "untitled2": Path("/Users/eimribar/Desktop/untitled folder 2"),
    }

    all_inspos = []
    for source, dir_path in inspo_dirs.items():
        if dir_path.exists():
            for f in find_images(dir_path):
                all_inspos.append({"path": f, "source": source})

    print(f"Found {len(all_inspos)} inspiration images across {len(inspo_dirs)} sources")

    rows = []
    for i, inspo in enumerate(all_inspos):
        print(f"  [{i+1}/{len(all_inspos)}] {inspo['source']}: {inspo['path'].name}")
        embedding = embed_image(inspo["path"])
        if not embedding:
            continue
        rows.append({
            "id": inspo["path"].stem,
            "source": inspo["source"],
            "description": f"Inspiration from {inspo['source']}: {inspo['path'].stem}",
            "file_path": str(inspo["path"]),
            "embedding": json.dumps(embedding),
        })
        time.sleep(0.3)  # rate limit

        # Batch insert every 20
        if len(rows) >= 20:
            supabase_upsert("inspiration_images", rows)
            print(f"    Stored batch of {len(rows)}")
            rows = []

    if rows:
        supabase_upsert("inspiration_images", rows)
        print(f"    Stored final batch of {len(rows)}")


# ─── Active Ads ────────────────────────────────────────────────────
def seed_active_ads():
    print("\n=== ACTIVE ADS ===\n")

    ads_dir = Path("/Users/eimribar/Desktop/new ads invitfull")
    if not ads_dir.exists():
        print("  Ads directory not found")
        return

    # Map filenames to ad copy from setup_abo_testing.py
    from setup_abo_testing import COPY_BY_CREATIVE

    images = find_images(ads_dir)
    print(f"Found {len(images)} ad creatives")

    rows = []
    for i, img in enumerate(images):
        copy = COPY_BY_CREATIVE[i] if i < len(COPY_BY_CREATIVE) else {}
        headline = copy.get("headline", "")
        primary = copy.get("primary_text", "")

        print(f"  [{i+1}/{len(images)}] {img.name[:60]}")

        # Embed with headline + primary text (multimodal)
        embed_text = f"{headline}. {primary}" if headline else ""
        embedding = embed_image(img, text=embed_text)
        if not embedding:
            continue

        rows.append({
            "ad_id": img.stem,
            "ad_name": img.stem[:80],
            "headline": headline,
            "primary_text": primary[:200],
            "embedding": json.dumps(embedding),
            "status": "ACTIVE" if i < 20 else "RESERVE",
            "classification": "LEARNING",
        })
        time.sleep(0.3)

        if len(rows) >= 10:
            supabase_upsert("creative_embeddings", rows)
            print(f"    Stored batch of {len(rows)}")
            rows = []

    if rows:
        supabase_upsert("creative_embeddings", rows)
        print(f"    Stored final batch of {len(rows)}")


# ─── Main ──────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", choices=["references", "inspirations", "ads"])
    args = parser.parse_args()

    print("=== Seeding Embedding Databases ===")
    print(f"Gemini API: ...{GEMINI_API_KEY[-8:]}")
    print(f"Supabase: {SUPABASE_URL}")

    if not args.only or args.only == "references":
        seed_references()

    if not args.only or args.only == "inspirations":
        seed_inspirations()

    if not args.only or args.only == "ads":
        seed_active_ads()

    print("\n=== Done ===")


if __name__ == "__main__":
    main()
