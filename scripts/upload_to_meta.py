"""
Upload creatives to Meta and create ads programmatically.

Usage:
    python upload_to_meta.py --segment baby_shower --ad-set-id 12345
    python upload_to_meta.py --segment kids_birthday --ad-set-id 12345
    python upload_to_meta.py --segment generic --ad-set-id 12345
    python upload_to_meta.py --segment baby_shower --ad-set-id 12345 --dry-run
"""

import argparse
import json
import os
import sys
import time
import requests
from pathlib import Path

from dotenv import load_dotenv

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
load_dotenv(PROJECT_DIR / ".env")

AD_ACCOUNT_ID = "act_104007129"
PAGE_ID = "917868684732619"
IG_ACTOR_ID = "17841477854992643"
API_VERSION = "v22.0"
BASE_URL = f"https://graph.facebook.com/{API_VERSION}"

SEGMENT_CONFIG = {
    "baby_shower": {
        "images_dir": SCRIPT_DIR / "Baby shower",
        "landing_page": "https://invitfull.com/baby-shower",
        "copy_variations": [
            # 1. Video — product demo
            {
                "headline": "Baby Shower Invite — Done in 60 Seconds",
                "primary_text": "Watch how fast this actually is. Type your baby shower theme. AI creates a custom invitation. Share one link — guests RSVP, find registry, see details. Free. No ads. No catch.",
                "description": "Free AI baby shower invitations",
            },
            # 2. Flash 631254091 — example cards (Sophie, Jackson, Aisha)
            {
                "headline": "Every Baby Shower Invitation — One of a Kind",
                "primary_text": "Sophie got florals. Jackson got safari. Aisha got butterflies. Every Invitfull design is AI-generated from scratch — no templates, no repeats. Describe your vibe, get something nobody's ever seen. RSVP and registry included.",
                "description": "Custom AI baby shower invitations",
            },
            # 3. Pro 579711182 — phone mockups Maya's Baby Shower
            {
                "headline": "Baby Shower Invitations — 100% Free. No Catch.",
                "primary_text": "Most invitation sites hit you with fees at checkout. Invitfull is free. Actually free. Create a stunning baby shower invitation, share one link, track RSVPs — $0. No ads on your invitation either.",
                "description": "Free baby shower invitations + RSVP",
            },
            # 4. Pro 587103467 — bold text "ACTUALLY FREE. NO CATCH."
            {
                "headline": "One Sentence. One Baby Shower Invitation.",
                "primary_text": "No browsing templates. No design skills. Just describe your baby shower theme and Invitfull's AI creates a stunning, personalized invitation instantly. Share one link — RSVPs, registry, directions, all handled.",
                "description": "AI baby shower invitations in seconds",
            },
            # 5. Pro 600240598 — Sarah Miller testimonial card, orange border
            {
                "headline": "One Link. Your Entire Baby Shower.",
                "primary_text": "Guests open your link — see a gorgeous custom invitation, tap RSVP, find the registry, get directions. No app downloads. No group chat chaos. You see who's coming in real time. All free.",
                "description": "Baby shower invitations + RSVP tracking",
            },
            # 6. Pro 645332897 — quote "effortless and beautiful", party photo
            {
                "headline": "Baby Shower Invitations Without the Stress",
                "primary_text": "You have a hundred things on your baby shower to-do list. Cross off invitations in 60 seconds. Type your theme, AI designs it, share one link. RSVPs roll in automatically. Free and ad-free.",
                "description": "Effortless baby shower planning",
            },
            # 7. Pro 645383053 — "ONE BABY SHOWER. A MILLION DETAILS. DONE."
            {
                "headline": "Baby Shower RSVPs, Registry, Details — One Link",
                "primary_text": "Stop juggling spreadsheets, group chats, and three different websites. Invitfull handles your baby shower invitation, RSVP tracking, registry link, directions, and guest photos — all from one link. Free.",
                "description": "All-in-one baby shower invitations",
            },
            # 8. Pro 646353941 — speech bubble story "5 minutes... for free"
            {
                "headline": "AI Designs Your Baby Shower Invitation",
                "primary_text": "No Canva. No Pinterest rabbit holes. No designer friend. Just tell Invitfull your baby shower theme — the AI creates something stunning that matches your exact vibe. Ready to share in under a minute.",
                "description": "AI-designed baby shower invitations",
            },
            # 9. Pro An-oTlU5P (Mar 10) — @sarah_plans_joy Twitter, light
            {
                "headline": "Free Baby Shower Invitations — 10,000+ Moms Agree",
                "primary_text": "Join the moms who stopped overpaying for boring templates. Invitfull's AI creates custom baby shower invitations in seconds — unique designs, not recycled templates. RSVP tracking and registry built in. Completely free.",
                "description": "Join 10,000+ moms on Invitfull",
            },
            # 10. Pro An-oTlU5P (Mar 14) — @Sarah_Expecting Twitter, dark
            {
                "headline": "Free Baby Shower Invitations — How Is This Real?",
                "primary_text": "AI-designed baby shower invitations that look like you hired a designer. RSVP tracking that actually works. A registry link your guests can find. All from one link. All free. No ads, no upsells, no catch.",
                "description": "Free AI baby shower invitations",
            },
            # 11. Pro An914d5 — POV before/after
            {
                "headline": "Baby Shower Invitations — No More Template Sites",
                "primary_text": "Broken websites. Ugly designs. Hidden fees. Sound familiar? Invitfull is different — describe your baby shower theme, AI creates something unique in seconds. RSVP and registry included. Actually free.",
                "description": "No templates, no fees — your baby shower",
            },
            # 12. Pro An9YZTDXb — "Some moments deserve more than IT'S A GIRL!"
            {
                "headline": "Your Baby Shower Deserves More Than a Text",
                "primary_text": "A group chat announcement? For your baby shower? You deserve better. Create a custom invitation that makes your friends gasp. AI-designed from one sentence. Beautiful, unique, and free.",
                "description": "Custom baby shower invitations — free",
            },
            # 13. Pro An9lWmSH — slider before/after, outdoor
            {
                "headline": "Baby Shower Invitations — Gorgeous in 60 Seconds",
                "primary_text": "You'd think a custom baby shower invitation this beautiful would take hours. It takes one sentence. Invitfull's AI matches your theme, handles RSVPs, and hosts your registry link — all free.",
                "description": "Beautiful invitations, instantly",
            },
            # 14. Pro An_2qJG5 — feature diagram, pink
            {
                "headline": "Baby Shower Invitations That Do Everything",
                "primary_text": "Custom AI invitation. RSVP tracking. Registry link. Directions. Potluck sign-ups. Dietary needs. Photo sharing. One link handles your entire baby shower. And it's free. Not free-with-a-catch. Actually free.",
                "description": "One link for your entire baby shower",
            },
            # 15. Reddit r/BabyBumps — light theme
            {
                "headline": "Free Baby Shower Invitations — Try It Now",
                "primary_text": "Open Invitfull. Describe your baby shower. Get a custom AI invitation instantly. Add your registry, share one link — RSVPs roll in automatically. No fees. No ads. Ever.",
                "description": "Free AI baby shower invitations",
            },
            # 16. Facebook post Emily Chen — Asian woman + phone
            {
                "headline": "Baby Shower Invitations Guests Screenshot",
                "primary_text": "A baby shower invitation so beautiful your friends screenshot it. Custom AI design from one sentence — not a template. RSVP tracking built in. And it costs exactly $0.",
                "description": "Custom baby shower invitations — free",
            },
        ],
    },
    "kids_birthday": {
        "images_dir": SCRIPT_DIR / "Kids birthday",
        "landing_page": "https://invitfull.com/kids-birthday",
        "copy_variations": [
            {
                "headline": "Birthday Party Invitations — 100% Free",
                "primary_text": "Describe the party theme, get a custom birthday invitation in 60 seconds. RSVPs, dietary needs, potluck — all in one link. Free and ad-free, forever.",
                "description": "Free ad-free birthday party invitations",
            },
            {
                "headline": "Free Birthday Invitations. No Ads. No Catch.",
                "primary_text": "One sentence about the party. One custom invitation in seconds. One link for RSVPs, directions, and everything else. Invitfull is completely free and ad-free.",
                "description": "AI-designed birthday party invitations — free",
            },
            {
                "headline": "The Invite Your Kid Deserves — Free & Ad-Free",
                "primary_text": "Stop juggling group chats, spreadsheets, and generic templates. Describe the birthday party, get a stunning invitation, share one link. Done. Free forever, no ads.",
                "description": "Custom birthday party invitations, free and ad-free",
            },
            {
                "headline": "Birthday Party Invitations in 60 Seconds",
                "primary_text": "AI designs a custom invitation that matches any theme your kid wants. RSVPs, potluck sign-ups, dietary needs — one link handles it all. 100% free. Zero ads.",
                "description": "Free ad-free birthday invitations by AI",
            },
            {
                "headline": "Free Birthday Invitations — Any Theme, Any Party",
                "primary_text": "Dinosaurs, princesses, superheroes — describe the party and get a custom invitation instantly. One link for RSVPs, details, everything. Free and ad-free.",
                "description": "Birthday party invitations — free, no ads",
            },
            {
                "headline": "One Link. RSVPs, Details, Everything. Free.",
                "primary_text": "Create a birthday party invitation that actually matches the theme. Share one link — guests RSVP, see details, sign up for potluck. Completely free and ad-free.",
                "description": "Free ad-free birthday party invitations",
            },
            {
                "headline": "Birthday Invitations Made Easy — Free & Ad-Free",
                "primary_text": "No more scattered group chats and RSVP spreadsheets. Describe the party, get a beautiful invitation, share one link. Everything your guests need. Free forever.",
                "description": "AI birthday party invitations, 100% free",
            },
            {
                "headline": "Custom Birthday Invitations — Free, Always",
                "primary_text": "Your kid's party deserves better than a generic template. Describe the theme, AI creates a custom invitation in seconds. RSVPs, directions, potluck — one link. Free and ad-free.",
                "description": "Free birthday party invitations — no ads ever",
            },
            {
                "headline": "Free Birthday Party Invitations by AI",
                "primary_text": "Describe the party in one sentence. Get a custom invitation that matches any theme. Share one link for RSVPs, dietary needs, and everything else. Free. Ad-free. Done.",
                "description": "Birthday invitations — free and ad-free",
            },
            {
                "headline": "Plan the Party, Not the Invite — It's Free",
                "primary_text": "Birthday party invitations that match any theme your kid loves. AI-designed in seconds, shared in one link. RSVPs, potluck, directions — all handled. 100% free, no ads.",
                "description": "Free ad-free AI birthday party invitations",
            },
            {
                "headline": "Birthday Invitations — Free, Ad-Free, Instant",
                "primary_text": "One sentence about the party. One stunning invitation. One link for everything — RSVPs, dietary needs, potluck, photos. Invitfull is free and always will be.",
                "description": "Free birthday party invitations in seconds",
            },
            {
                "headline": "Throw an Amazing Party — Invitations Are Free",
                "primary_text": "Custom birthday party invitations designed by AI in 60 seconds. Any theme. One link for RSVPs and all the details. No ads, no fees, no strings attached.",
                "description": "Free ad-free birthday invitations",
            },
            {
                "headline": "Free AI Birthday Invitations — Zero Ads",
                "primary_text": "Stop spending hours on invitation design. Describe the birthday party, AI handles the rest. RSVPs, potluck, dietary restrictions — one link. Free and ad-free, always.",
                "description": "Birthday party invitations — completely free",
            },
            {
                "headline": "Birthday Party? Free Invitations in Seconds",
                "primary_text": "Describe the theme, get a custom invitation instantly. Share one link — RSVPs, directions, potluck sign-ups, everything. Invitfull is 100% free and ad-free.",
                "description": "Free AI birthday party invitations",
            },
            {
                "headline": "The Easiest Birthday Invitation — And It's Free",
                "primary_text": "Any theme your kid wants, designed by AI in seconds. One link handles RSVPs, dietary needs, potluck, and details. Birthday party invitations that are free and ad-free.",
                "description": "Free ad-free birthday party invitations",
            },
            {
                "headline": "Free Birthday Invitations That Actually Look Good",
                "primary_text": "No more generic templates. Describe the birthday party theme, AI creates a stunning custom invitation. One link for RSVPs and everything else. Free forever, zero ads.",
                "description": "Custom birthday invitations — free, no ads",
            },
            {
                "headline": "Birthday Party Invitations — Totally Free, No Ads",
                "primary_text": "AI designs a beautiful invitation for any birthday party theme in seconds. One link replaces group chats, RSVP spreadsheets, and scattered details. 100% free and ad-free.",
                "description": "Free birthday party invitations by AI",
            },
        ],
    },
    "generic": {
        "images_dir": PROJECT_DIR / "general" / "output",
        "landing_page": "https://invitfull.com",
        "copy_variations": [
            # 1. "Planning = Partying" — 3 colorful party invitation mockups
            {
                "headline": "Any Theme. Any Party. Free.",
                "primary_text": "K-pop party? Dinosaur bash? Space adventure? Just type it. AI matches the invitation to any theme in seconds. One link handles RSVPs, potluck, directions — everything. Free and ad-free.",
                "description": "Free AI invitations for any event",
            },
            # 2. Feature grid — RSVP, Photos, Registry, Potluck, 7 event types
            {
                "headline": "One Link Replaces Five Apps",
                "primary_text": "RSVPs in one app. Potluck in a group chat. Directions in a text. Registry in an email. Stop. One Invitfull link does all of it — and it's completely free with zero ads.",
                "description": "Free invitations — everything in one link",
            },
            # 3. "Create Stunning Invitations in Minutes" with feature callouts
            {
                "headline": "Not a Template. Not a Fee.",
                "primary_text": "Every invitation on Invitfull is AI-designed from scratch — not picked from a library someone else used last month. Describe your event, get something unique. Free and ad-free, forever.",
                "description": "Custom AI invitations — always free",
            },
            # 4. Woman at laptop — "5 min while cooking dinner" story bubbles
            {
                "headline": "Event Planning on Autopilot",
                "primary_text": "The invitation is usually the hardest part. Not anymore. One sentence about your event → AI designs it → one link handles RSVPs, dietary needs, potluck, directions. Done before the water boils. Free and ad-free.",
                "description": "Free AI event invitations in seconds",
            },
            # 5. iMessage — Sarah: "how'd you make this?" garden party invite
            {
                "headline": "They'll Think You Hired a Designer",
                "primary_text": "That reaction when friends see your invitation and can't believe you didn't pay someone. Invitfull's AI designs custom invitations from one sentence — free and ad-free. The compliments are just a bonus.",
                "description": "Free AI invitations that look custom",
            },
            # 6. Twitter/X — Chloe: "3 different parties, all amazing, totally free"
            {
                "headline": "Free Invitations. No Ads. No Catch.",
                "primary_text": "Graduation, housewarming, birthday — whatever you're hosting, Invitfull creates a custom invitation in seconds. One link for RSVPs, directions, everything. Actually free. Actually ad-free.",
                "description": "AI invitations for every occasion — free",
            },
            # 7. Before/After — group chat chaos vs clean Invitfull app
            {
                "headline": "Ditch the Spreadsheet",
                "primary_text": "Group chats for potluck. Spreadsheet for RSVPs. Separate text for directions. Calendar invite for the date. Or: one Invitfull link that handles all of it. Free and ad-free.",
                "description": "Free invitations that replace everything",
            },
            # 8. "Some moments deserve more than 'you're invited'" — balloons
            {
                "headline": "Your Event Deserves Better",
                "primary_text": "A plain text invite says 'I didn't try.' A custom AI invitation says 'this is going to be good.' Describe your event, get something stunning in seconds. One link for RSVPs and details. Free and ad-free.",
                "description": "Free custom invitations by AI",
            },
            # 9. iMessage — Bestie: "OBSESSED 😍" about Erica Turns 18
            {
                "headline": "Made on Invitfull. Totally Free.",
                "primary_text": "The invitation everyone asks about. AI designs it from one sentence — custom to your event, not a template. RSVPs, directions, everything in one link. Free, ad-free, and ready in 60 seconds.",
                "description": "Free AI invitations — looks custom, costs nothing",
            },
            # 10. Before/After — text prompt → Top Gun Baby Shower design
            {
                "headline": "Type It. AI Designs It. Free.",
                "primary_text": "No design skills needed. No templates to scroll through. Describe your event in plain text — AI turns it into a custom invitation. Add RSVPs, potluck, registry. Share one link. Free and ad-free.",
                "description": "Free AI invitations from a text description",
            },
            # 11. Portrait feature grid — icons + happy friends at party
            {
                "headline": "One Invitation. Every Detail. Free.",
                "primary_text": "Guests open one link and see everything: the invitation, RSVP button, potluck sign-up, directions, photos. No app downloads. No group chat chaos. Free and ad-free.",
                "description": "Free invitations your guests will love",
            },
            # 12. "5 different apps" — stressed woman → happy with invitation
            {
                "headline": "Five Apps Down to One Link",
                "primary_text": "RSVP tracker. Potluck spreadsheet. Group chat. Map link. Invitation designer. You used to need all five. Now you need one Invitfull link. Custom AI invitation + everything else. Free and ad-free.",
                "description": "Free invitations that replace everything",
            },
            # 13. Facebook: Moms Who Plan group, daughter's dino party
            {
                "headline": "The Invite Other Parents Notice",
                "primary_text": "When the invitation is so good that other parents message you asking how you made it. Invitfull's AI designs custom invitations from one sentence. RSVPs, dietary needs, potluck — one link. Free and ad-free.",
                "description": "Free AI party invitations",
            },
            # 14. Dark FB post: Gabriel's space birthday, RSVPs rolling in
            {
                "headline": "RSVPs on Autopilot. Free.",
                "primary_text": "Create the invitation. Share one link. RSVPs come in automatically — no chasing people in group chats. Potluck, dietary needs, directions all handled. Invitfull is completely free and ad-free.",
                "description": "Free invitations with automatic RSVPs",
            },
            # 15. Mom + daughter on couch, tablet, IG-style overlay
            {
                "headline": "5 Minutes. Custom Invitation. $0.",
                "primary_text": "Describe the party theme. AI designs a custom invitation your kid will love. Share one link — RSVPs, potluck, directions, everything. No templates, no fees, no ads. Just your event, done right.",
                "description": "Free AI invitations kids love",
            },
        ],
    },
}


def get_access_token():
    # Prefer .meta_token file (most reliable)
    token_file = SCRIPT_DIR / ".meta_token"
    if token_file.exists():
        token = token_file.read_text().strip()
        if token and token.startswith("EAA"):
            return token
    token = os.environ.get("META_ACCESS_TOKEN", "")
    if token and token.startswith("EAA"):
        return token
    print("ERROR: No valid Meta access token found. Save token to .meta_token file.")
    sys.exit(1)


VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv"}


def is_video(path: Path) -> bool:
    return path.suffix.lower() in VIDEO_EXTENSIONS


def upload_video(access_token: str, video_path: Path) -> str:
    """Upload a video to the ad account. Returns the video ID."""
    url = f"{BASE_URL}/{AD_ACCOUNT_ID}/advideos"
    with open(video_path, "rb") as f:
        resp = requests.post(
            url,
            files={"source": (video_path.name, f, "video/mp4")},
            data={"access_token": access_token},
        )
    if resp.status_code != 200:
        print(f"  Video upload error: {resp.status_code} {resp.text[:300]}")
        resp.raise_for_status()
    data = resp.json()
    video_id = data.get("id")
    if not video_id:
        raise ValueError(f"No video ID in response: {data}")
    # Wait for video to be ready
    print(f"  Video ID: {video_id} — waiting for processing...")
    for _ in range(30):
        status_resp = requests.get(
            f"{BASE_URL}/{video_id}",
            params={"access_token": access_token, "fields": "status"},
        )
        status_data = status_resp.json()
        video_status = status_data.get("status", {}).get("video_status", "")
        if video_status == "ready":
            print(f"  Video ready!")
            return video_id
        if video_status == "error":
            raise ValueError(f"Video processing failed: {status_data}")
        time.sleep(2)
    print(f"  Warning: video may still be processing, continuing anyway")
    return video_id


def get_video_thumbnail(access_token: str, video_id: str) -> str:
    """Get the auto-generated thumbnail URL for a video."""
    resp = requests.get(
        f"{BASE_URL}/{video_id}/thumbnails",
        params={"access_token": access_token},
    )
    data = resp.json()
    thumbnails = data.get("data", [])
    if thumbnails:
        return thumbnails[0].get("uri", "")
    # Fallback: get picture from video object
    resp2 = requests.get(
        f"{BASE_URL}/{video_id}",
        params={"access_token": access_token, "fields": "picture"},
    )
    return resp2.json().get("picture", "")


def create_video_creative(
    access_token: str,
    video_id: str,
    landing_page: str,
    headline: str,
    primary_text: str,
    description: str,
    creative_name: str,
) -> str:
    """Create a video ad creative and return its ID."""
    thumbnail_url = get_video_thumbnail(access_token, video_id)
    if not thumbnail_url:
        raise ValueError(f"Could not get thumbnail for video {video_id}")
    print(f"  Thumbnail: {thumbnail_url[:80]}...")

    url = f"{BASE_URL}/{AD_ACCOUNT_ID}/adcreatives"
    payload = {
        "access_token": access_token,
        "name": creative_name,
        "object_story_spec": json.dumps({
            "page_id": PAGE_ID,
            "video_data": {
                "video_id": video_id,
                "image_url": thumbnail_url,
                "message": primary_text,
                "title": headline,
                "link_description": description,
                "call_to_action": {
                    "type": "LEARN_MORE",
                    "value": {"link": landing_page},
                },
            },
        }),
    }
    resp = requests.post(url, data=payload)
    if resp.status_code != 200:
        print(f"  Creative error: {resp.status_code} {resp.text[:500]}")
        resp.raise_for_status()
    return resp.json()["id"]


def upload_image(access_token: str, image_path: Path) -> dict:
    """Upload an image to the ad account and return the image hash."""
    url = f"{BASE_URL}/{AD_ACCOUNT_ID}/adimages"
    with open(image_path, "rb") as f:
        resp = requests.post(
            url,
            files={"filename": (image_path.name, f, "image/png")},
            data={"access_token": access_token},
        )
    if resp.status_code != 200:
        print(f"  Upload error: {resp.status_code} {resp.text[:300]}")
        resp.raise_for_status()
    data = resp.json()
    # Response format: {"images": {"filename": {"hash": "abc123", ...}}}
    images = data.get("images", {})
    for name, info in images.items():
        return {"hash": info["hash"], "url": info.get("url", "")}
    raise ValueError(f"No image hash in response: {data}")


def create_ad_creative(
    access_token: str,
    image_hash: str,
    landing_page: str,
    headline: str,
    primary_text: str,
    description: str,
    creative_name: str,
) -> str:
    """Create an ad creative and return its ID."""
    url = f"{BASE_URL}/{AD_ACCOUNT_ID}/adcreatives"
    payload = {
        "access_token": access_token,
        "name": creative_name,
        "object_story_spec": json.dumps({
            "page_id": PAGE_ID,
            "link_data": {
                "image_hash": image_hash,
                "link": landing_page,
                "message": primary_text,
                "name": headline,
                "description": description,
                "call_to_action": {"type": "LEARN_MORE"},
            },
        }),
    }
    resp = requests.post(url, data=payload)
    resp.raise_for_status()
    return resp.json()["id"]


def create_ad(
    access_token: str,
    ad_set_id: str,
    creative_id: str,
    ad_name: str,
    status: str = "PAUSED",
) -> str:
    """Create an ad linked to a creative and ad set. Returns ad ID."""
    url = f"{BASE_URL}/{AD_ACCOUNT_ID}/ads"
    payload = {
        "access_token": access_token,
        "name": ad_name,
        "adset_id": ad_set_id,
        "creative": json.dumps({"creative_id": creative_id}),
        "status": status,
    }
    resp = requests.post(url, data=payload)
    resp.raise_for_status()
    return resp.json()["id"]


def create_campaign(access_token: str, name: str) -> str:
    """Create an ABO campaign optimized for conversions. Returns campaign ID."""
    url = f"{BASE_URL}/{AD_ACCOUNT_ID}/campaigns"
    payload = {
        "access_token": access_token,
        "name": name,
        "objective": "OUTCOME_LEADS",
        "status": "PAUSED",
        "special_ad_categories": json.dumps([]),
        "is_adset_budget_sharing_enabled": "false",
    }
    resp = requests.post(url, data=payload)
    if resp.status_code != 200:
        print(f"  Campaign error: {resp.status_code} {resp.text[:500]}")
        resp.raise_for_status()
    return resp.json()["id"]


def create_ad_set(
    access_token: str,
    campaign_id: str,
    name: str,
    daily_budget: int,
    pixel_id: str = "1398381481388085",
) -> str:
    """Create an ad set with Advantage+ broad targeting. Returns ad set ID."""
    url = f"{BASE_URL}/{AD_ACCOUNT_ID}/adsets"
    payload = {
        "access_token": access_token,
        "campaign_id": campaign_id,
        "name": name,
        "daily_budget": daily_budget,  # in cents
        "billing_event": "IMPRESSIONS",
        "optimization_goal": "OFFSITE_CONVERSIONS",
        "bid_strategy": "LOWEST_COST_WITHOUT_CAP",
        "promoted_object": json.dumps({
            "pixel_id": pixel_id,
            "custom_event_type": "COMPLETE_REGISTRATION",
        }),
        "targeting": json.dumps({
            "geo_locations": {"countries": ["US"]},
            "age_min": 18,
            "age_max": 65,
        }),
        "publisher_platforms": json.dumps(["facebook", "instagram", "messenger"]),
        "status": "PAUSED",
    }
    resp = requests.post(url, data=payload)
    if resp.status_code != 200:
        print(f"  Ad set error: {resp.status_code} {resp.text[:500]}")
        resp.raise_for_status()
    return resp.json()["id"]


def get_media_to_upload(images_dir: Path) -> list[Path]:
    """Get all PNG/JPEG/MP4 media files in a directory, sorted by name."""
    extensions = ("*.png", "*.jpg", "*.jpeg", "*.mp4", "*.mov")
    media = []
    for ext in extensions:
        media.extend(images_dir.glob(ext))
    return sorted(media)


def get_copy_for_index(cfg: dict, index: int) -> dict:
    """Get copy for a given index. Supports copy_variations or single copy fallback."""
    if "copy_variations" in cfg:
        return cfg["copy_variations"][index % len(cfg["copy_variations"])]
    return {
        "headline": cfg["headline"],
        "primary_text": cfg["primary_text"],
        "description": cfg["description"],
    }


def main():
    parser = argparse.ArgumentParser(description="Upload creatives to Meta Ads")
    parser.add_argument("--segment", required=True, choices=list(SEGMENT_CONFIG.keys()))
    parser.add_argument("--ad-set-id", help="Ad set ID to add ads to")
    parser.add_argument("--create-campaign", metavar="NAME", help="Create a new campaign + ad set with this name")
    parser.add_argument("--daily-budget", type=int, default=10000, help="Daily budget in cents (default: 10000 = $100)")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be uploaded without uploading")
    parser.add_argument("--status", default="PAUSED", choices=["PAUSED", "ACTIVE"], help="Initial ad status")
    parser.add_argument("--dir", help="Override images directory (default: segment config)")
    args = parser.parse_args()

    if not args.ad_set_id and not args.create_campaign:
        print("ERROR: Provide --ad-set-id or --create-campaign")
        sys.exit(1)

    cfg = SEGMENT_CONFIG[args.segment]
    images_dir = Path(args.dir) if args.dir else cfg["images_dir"]
    media_files = get_media_to_upload(images_dir)

    if not media_files:
        print(f"ERROR: No media files found in {images_dir}")
        sys.exit(1)

    n_images = sum(1 for f in media_files if not is_video(f))
    n_videos = sum(1 for f in media_files if is_video(f))

    print(f"Segment: {args.segment}")
    print(f"Media dir: {images_dir}")
    print(f"Files found: {len(media_files)} ({n_images} images, {n_videos} videos)")
    print(f"Landing page: {cfg['landing_page']}")
    print(f"Status: {args.status}")
    print()

    if args.dry_run:
        print("DRY RUN — would upload:")
        for i, f in enumerate(media_files):
            copy = get_copy_for_index(cfg, i)
            media_type = "VIDEO" if is_video(f) else "IMAGE"
            print(f"  [{i+1}] [{media_type}] {f.name}")
            print(f"      Headline: {copy['headline']}")
            print(f"      Primary:  {copy['primary_text'][:80]}...")
        print(f"\nTotal: {len(media_files)} ads would be created")
        return

    access_token = get_access_token()

    # Create campaign + ad set if requested
    ad_set_id = args.ad_set_id
    if args.create_campaign:
        print(f"Creating campaign: {args.create_campaign}")
        campaign_id = create_campaign(access_token, args.create_campaign)
        print(f"  Campaign ID: {campaign_id}")

        ad_set_name = f"{args.create_campaign} — Broad US"
        print(f"Creating ad set: {ad_set_name} (${args.daily_budget / 100:.0f}/day)")
        ad_set_id = create_ad_set(access_token, campaign_id, ad_set_name, args.daily_budget)
        print(f"  Ad set ID: {ad_set_id}")
        print()

    for i, media_path in enumerate(media_files):
        print(f"[{i+1}/{len(media_files)}] {media_path.name}")

        copy = get_copy_for_index(cfg, i)
        creative_name = f"Invitfull {args.segment} — {media_path.stem}"

        if is_video(media_path):
            # Video upload flow
            print(f"  Uploading video...")
            video_id = upload_video(access_token, media_path)

            print(f"  Creating video creative...")
            print(f"  Headline: {copy['headline']}")
            creative_id = create_video_creative(
                access_token,
                video_id,
                cfg["landing_page"],
                copy["headline"],
                copy["primary_text"],
                copy["description"],
                creative_name,
            )
        else:
            # Image upload flow
            print(f"  Uploading image...")
            img_data = upload_image(access_token, media_path)
            print(f"  Image hash: {img_data['hash']}")

            print(f"  Creating creative...")
            print(f"  Headline: {copy['headline']}")
            creative_id = create_ad_creative(
                access_token,
                img_data["hash"],
                cfg["landing_page"],
                copy["headline"],
                copy["primary_text"],
                copy["description"],
                creative_name,
            )

        print(f"  Creative ID: {creative_id}")

        # Create ad
        ad_name = f"{args.segment} — {media_path.stem}"
        print(f"  Creating ad...")
        ad_id = create_ad(
            access_token,
            ad_set_id,
            creative_id,
            ad_name,
            args.status,
        )
        print(f"  Ad ID: {ad_id}")
        print()

    print(f"Done! {len(media_files)} ads created in ad set {ad_set_id}")


if __name__ == "__main__":
    main()
