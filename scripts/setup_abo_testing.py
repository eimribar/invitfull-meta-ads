"""
Set up ABO testing campaign with 10 ad sets × $20/day × 2 creatives each.

Usage:
    python setup_abo_testing.py --dir "/path/to/approved/creatives" --dry-run
    python setup_abo_testing.py --dir "/path/to/approved/creatives"
"""

import argparse
import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
load_dotenv(PROJECT_DIR / ".env")

# Import functions from upload_to_meta
sys.path.insert(0, str(SCRIPT_DIR))
from upload_to_meta import (
    get_access_token,
    create_campaign,
    create_ad_set,
    upload_image,
    create_ad_creative,
    create_ad,
    is_video,
    upload_video,
    create_video_creative,
)

LANDING_PAGE = "https://invitfull.com/baby-shower"

# Copy matched to each creative (by sorted filename order)
# Each entry: headline, primary_text, description — tailored to the visual
COPY_BY_CREATIVE = [
    # 1. 483914283 — branded, pregnant woman + phone/laptop showing product, "100% FREE & AD-FREE"
    {
        "headline": "Baby Shower Invitations — Free Forever",
        "primary_text": "Invitfull makes custom baby shower invitations with AI. Describe your theme, get a unique design in 60 seconds. One link handles RSVPs, registry, and directions. No fees. No ads. Not now, not ever.",
        "description": "Free baby shower invitations by AI",
    },
    # 2. 488074896 — branded, product screenshot with "Create My Event" button
    {
        "headline": "Create Your Baby Shower Invite in Seconds",
        "primary_text": "One click. Describe your baby shower. AI designs a custom invitation — not a template. Share one link for RSVPs, registry, everything. Invitfull is completely free and ad-free.",
        "description": "AI baby shower invitations — free",
    },
    # 3. 497510807 — branded, phone mockup "Sarah's Baby Shower" with RSVP/Registry/Directions
    {
        "headline": "RSVPs, Registry, Directions — One Link",
        "primary_text": "Your guests open one link and see your baby shower invitation, RSVP button, registry, and directions. No apps. No group chats. Invitfull handles it all. Free and ad-free.",
        "description": "All-in-one baby shower invitations",
    },
    # 4. 505861666 — branded testimonial, "Sarah M. New Mom" + website screenshots
    {
        "headline": "Free and Ad-Free Baby Shower Invitations",
        "primary_text": "Real moms use Invitfull for their baby showers. AI creates a custom invitation in 60 seconds. One link for RSVPs, registry, and details. No templates. No fees. No ads on your invite.",
        "description": "Trusted by real moms — free",
    },
    # 5. 569916197 — comparison: Invitfull vs Other Sites, checkmarks vs X marks
    {
        "headline": "Invitfull vs. Other Invitation Sites",
        "primary_text": "Other sites: generic templates, hidden fees, ads everywhere. Invitfull: AI-designed custom baby shower invitations, RSVPs, registry — one link. Completely free. Zero ads. See the difference.",
        "description": "Free AI invitations vs. paid templates",
    },
    # 6. 579711182 — branded, 3 phones showing product, "Baby showers = simplified"
    {
        "headline": "Baby Showers, Simplified",
        "primary_text": "Custom AI invitations. Automatic RSVPs. Registry link. All in one place. Invitfull handles your entire baby shower from one link. Free and ad-free — no hidden fees, ever.",
        "description": "Free baby shower planning",
    },
    # 7. 586126917 — branded, chat bubbles "sent the baby shower invites! so easy" + phone
    {
        "headline": "Send Baby Shower Invites in Under a Minute",
        "primary_text": "Describe your baby shower theme. AI designs a custom invitation. Share one link — done. RSVPs, registry, directions all handled automatically. Free and ad-free.",
        "description": "Baby shower invitations in 60 seconds",
    },
    # 8. 600240598 — testimonial quote card, Sarah Johnson speech bubble + phone
    {
        "headline": "100% Free. No Ads. No Hidden Fees.",
        "primary_text": "Invitfull's AI generates your baby shower invitation, RSVP tracker, and registry link in under 60 seconds. It's completely free. No ads on your invitation. No catch.",
        "description": "Free AI baby shower invitations",
    },
    # 9. 611603080 (v1) — hybrid, Twitter testimonial + product screenshots below
    {
        "headline": "Moms Are Switching to Invitfull",
        "primary_text": "AI-powered baby shower invitations that are custom, beautiful, and completely free. One link replaces group chats, RSVP spreadsheets, and template sites. No ads. No fees. Try it.",
        "description": "Free baby shower invitations + RSVPs",
    },
    # 10. 611603080 (v2) — hybrid, Twitter testimonial "Sarah M." + phone/laptop
    {
        "headline": "Baby Shower Planning Without the Stress",
        "primary_text": "Invitfull's AI creates a custom baby shower invitation from one sentence. Not a template. Share one link — RSVPs, registry, directions. Completely free and ad-free.",
        "description": "Stress-free baby shower invitations",
    },
    # 11. 615800621 — before/after: DIY stress vs Invitfull ease, progress bars
    {
        "headline": "Stop DIY-ing Your Baby Shower Invites",
        "primary_text": "DIY invitations: hours of effort, printing costs, manual RSVPs. Invitfull: AI designs a custom invite in 60 seconds. One link for everything. Free. Ad-free. Forever.",
        "description": "Skip the DIY — free AI invitations",
    },
    # 12. 632244722 — branded, "CREATE YOUR DREAM BABY SHOWER INVITATION" + family scene
    {
        "headline": "Your Dream Baby Shower Invitation",
        "primary_text": "AI-powered custom designs. One-link RSVPs and registry. Completely free and ad-free. Describe your baby shower theme — Invitfull creates something unique in seconds.",
        "description": "Custom AI baby shower invitations",
    },
    # 13. 634334497 — authentic dark tweet, "@sarahj_eats" reviewing Invitfull
    {
        "headline": "Free Baby Shower Invitations by AI",
        "primary_text": "Type a few details about your baby shower. AI creates a custom design — not a template. One link handles RSVPs, registry, and everything else. Completely free. No ads.",
        "description": "AI invitations — free, no ads",
    },
    # 14. 635108075 — authentic iMessage: "how much?" "nothing. literally $0."
    {
        "headline": "Baby Shower Invitations — $0",
        "primary_text": "Custom AI-designed baby shower invitations. RSVPs, registry, photos — one link. The price? $0. No trial. No premium tier. No ads. Free forever.",
        "description": "Free baby shower invitations",
    },
    # 15. 637700575 — hybrid, Twitter "@SarahT_Mom" + product screenshot below
    {
        "headline": "The Best Baby Shower Invitation Platform",
        "primary_text": "Invitfull generates a custom baby shower invite, RSVP tracker, and registry link in under 60 seconds. Free and ad-free. No hidden fees. See why moms love it.",
        "description": "Free — loved by moms",
    },
    # 16. 638120022 — authentic dark tweet, "@SarahJ_Creates" describing the experience
    {
        "headline": "AI Baby Shower Invitations — Free",
        "primary_text": "Describe your baby shower theme. AI creates a custom invitation in under a minute. Not a template. RSVPs, registry, everything in one link. Free and ad-free.",
        "description": "Custom AI invitations — free",
    },
    # 17. 639555072 — authentic Twitter, "@sarah_j_m" + product screenshot "Olivia's Baby Shower"
    {
        "headline": "Custom Baby Shower Invites in 60 Seconds",
        "primary_text": "Describe your theme. AI designs a one-of-a-kind baby shower invitation. Share one link — RSVPs, registry, directions. No templates. No fees. No ads. Ready in under a minute.",
        "description": "AI baby shower invitations — free",
    },
    # 18. 645332897 — branded influencer quote, "@SarahMomsToBe 12K FOLLOWERS" + product screenshots
    {
        "headline": "Ready in Under 60 Seconds. Free.",
        "primary_text": "Invitfull's AI creates your baby shower invitation, handles RSVPs, and shares your registry — all from one link. No fees. No ads. Completely free, forever.",
        "description": "Free baby shower invitations",
    },
    # 19. 646353941 — story-style, "I planned my entire baby shower in 60 seconds" speech bubbles
    {
        "headline": "Plan Your Baby Shower in 60 Seconds",
        "primary_text": "AI generates a custom baby shower invite from your description. Share one link — RSVPs, registry, photos, directions. All in one place. Completely free and ad-free.",
        "description": "Free baby shower planning in seconds",
    },
    # 20. 646383254 — UGC selfie style, woman pointing at screen, "Stop paying for invites"
    {
        "headline": "Stop Paying for Baby Shower Invites",
        "primary_text": "Invitfull makes custom AI baby shower invitations. One link for RSVPs, registry, and details. 100% free. No ads. No hidden fees. Ever.",
        "description": "Free AI baby shower invitations",
    },
]


def get_creatives(images_dir: Path, max_count: int = 20) -> list[Path]:
    extensions = ("*.png", "*.jpg", "*.jpeg", "*.mp4", "*.mov")
    files = []
    for ext in extensions:
        files.extend(images_dir.glob(ext))
    files = sorted(files)
    return files[:max_count]


def main():
    parser = argparse.ArgumentParser(description="Set up ABO testing campaign")
    parser.add_argument("--dir", required=True, help="Directory with approved creatives")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--max-creatives", type=int, default=20)
    parser.add_argument("--budget-per-adset", type=int, default=2000, help="Budget per ad set in cents (default: 2000 = $20)")
    parser.add_argument("--creatives-per-adset", type=int, default=2)
    args = parser.parse_args()

    images_dir = Path(args.dir)
    creatives = get_creatives(images_dir, args.max_creatives)

    if not creatives:
        print(f"ERROR: No media files found in {images_dir}")
        sys.exit(1)

    n_adsets = len(creatives) // args.creatives_per_adset
    total_budget = n_adsets * args.budget_per_adset / 100

    print(f"=== ABO Testing Campaign Setup ===")
    print(f"Creatives: {len(creatives)} from {images_dir}")
    print(f"Ad sets: {n_adsets} × ${args.budget_per_adset / 100:.0f}/day × {args.creatives_per_adset} creatives")
    print(f"Total daily budget: ${total_budget:.0f}/day")
    print(f"Landing page: {LANDING_PAGE}")
    print()

    if args.dry_run:
        for i in range(n_adsets):
            start = i * args.creatives_per_adset
            end = start + args.creatives_per_adset
            batch = creatives[start:end]
            print(f"Ad Set {i+1} (${args.budget_per_adset / 100:.0f}/day):")
            for j, f in enumerate(batch):
                copy = COPY_BY_CREATIVE[(start + j) % len(COPY_BY_CREATIVE)]
                print(f"  [{start+j+1}] {f.name}")
                print(f"      Headline: {copy['headline']}")
            print()
        print(f"Total: {n_adsets} ad sets, {len(creatives)} ads, ${total_budget:.0f}/day")
        return

    access_token = get_access_token()

    # 1. Create campaign
    campaign_name = "Baby Shower — ABO Testing — March 2026"
    print(f"Creating campaign: {campaign_name}")
    campaign_id = create_campaign(access_token, campaign_name)
    print(f"  Campaign ID: {campaign_id}")
    print()

    # 2. Create ad sets and ads
    for i in range(n_adsets):
        start = i * args.creatives_per_adset
        end = start + args.creatives_per_adset
        batch = creatives[start:end]

        ad_set_name = f"Test {i+1} — Broad US"
        print(f"Creating ad set: {ad_set_name} (${args.budget_per_adset / 100:.0f}/day)")
        ad_set_id = create_ad_set(access_token, campaign_id, ad_set_name, args.budget_per_adset)
        print(f"  Ad set ID: {ad_set_id}")

        for j, media_path in enumerate(batch):
            idx = start + j
            copy = COPY_BY_CREATIVE[idx % len(COPY_BY_CREATIVE)]
            creative_name = f"baby_shower — {media_path.stem}"

            print(f"  [{idx+1}] {media_path.name}")
            print(f"      Headline: {copy['headline']}")

            if is_video(media_path):
                video_id = upload_video(access_token, media_path)
                creative_id = create_video_creative(
                    access_token, video_id, LANDING_PAGE,
                    copy["headline"], copy["primary_text"], copy["description"],
                    creative_name,
                )
            else:
                img_data = upload_image(access_token, media_path)
                creative_id = create_ad_creative(
                    access_token, img_data["hash"], LANDING_PAGE,
                    copy["headline"], copy["primary_text"], copy["description"],
                    creative_name,
                )

            ad_name = f"baby_shower — {media_path.stem}"
            ad_id = create_ad(access_token, ad_set_id, creative_id, ad_name, "PAUSED")
            print(f"      Creative: {creative_id} | Ad: {ad_id}")

        print()

    print(f"=== Done! ===")
    print(f"Campaign: {campaign_name} (ID: {campaign_id})")
    print(f"Ad sets: {n_adsets} × ${args.budget_per_adset / 100:.0f}/day")
    print(f"Ads: {len(creatives)} total")
    print(f"Status: PAUSED — review in Ads Manager, then activate")


if __name__ == "__main__":
    main()
