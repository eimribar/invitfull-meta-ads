# Invitfull — Invitation Library Brief

## What This Is For

We're building a **Meta Ads creative factory** that generates ad creatives using AI (Gemini 3 Pro Image). The system takes inspiration ads from competitors, brand references, and **real Invitfull invitation examples** — then generates on-brand ad creatives at scale.

The invitation examples are the **hero of every ad**. We need a library of real Invitfull invitations, organized by segment, to feed into the system.

---

## What We Need

**3-4 invitation screenshots per segment, 4 segments = 12-16 total invitations.**

Each screenshot should be a **finished invitation as a guest would see it** — not the editor, not the dashboard. The final, shareable invite page.

### Requirements per screenshot:
- **High resolution** (minimum 1080px wide, ideally 1440px+)
- **Full invitation view** — the complete invite as it appears when opened
- **Different styles/themes within each segment** — variety matters (don't make 4 identical-looking invites)
- **PNG or JPG format**
- **No browser chrome** — just the invitation itself (crop out URL bar, etc.)

---

## Segments & Examples

### 1. Baby Shower (3-4 invitations)

| # | Style Direction | Notes |
|---|---|---|
| 1 | Classic / elegant | Soft colors, floral, greenery |
| 2 | Modern / minimal | Clean, bold typography |
| 3 | Themed / fun | Animals, storybook, specific theme |
| 4 | Gender-specific (optional) | "It's a boy" / "It's a girl" style |

### 2. Kids Birthday (4 invitations)

| # | Style Direction | Notes |
|---|---|---|
| 1 | Generic fun | Balloons, confetti, bright colors |
| 2 | Themed — girl | Unicorn, princess, fairy, etc. |
| 3 | Themed — boy | Dinosaur, superhero, space, etc. |
| 4 | Activity-based | Pool party, bowling, trampoline, etc. |

### 3. Gender Reveal (3-4 invitations)

| # | Style Direction | Notes |
|---|---|---|
| 1 | Classic pink & blue | Traditional gender reveal style |
| 2 | Modern / neutral | Elegant, muted tones |
| 3 | Fun / playful | "He or She?", balloons, confetti |
| 4 | Themed (optional) | Specific reveal theme (baseball, etc.) |

### 4. General Events (4 invitations)

| # | Style Direction | Notes |
|---|---|---|
| 1 | Dinner party / housewarming | Elegant, adult, sophisticated |
| 2 | Milestone birthday (30th/40th/50th) | Celebratory, age-specific |
| 3 | Graduation party | Achievement-themed |
| 4 | Casual gathering / BBQ / holiday | Relaxed, fun |

---

## File Organization

Please deliver as:

```
invitations/
├── baby_shower/
│   ├── baby_classic.png
│   ├── baby_modern.png
│   ├── baby_themed.png
│   └── baby_gendered.png (optional)
├── kids_birthday/
│   ├── kids_generic.png
│   ├── kids_girl_theme.png
│   ├── kids_boy_theme.png
│   └── kids_activity.png
├── gender_reveal/
│   ├── reveal_classic.png
│   ├── reveal_modern.png
│   ├── reveal_fun.png
│   └── reveal_themed.png (optional)
└── general/
    ├── general_dinner.png
    ├── general_milestone.png
    ├── general_graduation.png
    └── general_casual.png
```

---

## How These Will Be Used

Each invitation screenshot gets tagged as `[PRODUCT]` and sent to the AI image model alongside:
- The Invitfull logo
- 3 website screenshots (brand reference)
- 1 competitor ad inspiration (layout blueprint)

The AI then generates a new ad creative that **features the Invitfull invitation as the hero visual**, with copy tailored to the specific audience and angle.

We run this across **20 different angle combinations** (4 segments × 5 angles each) to produce high-volume ad creatives for Meta campaigns.

**The better and more varied the invitation examples, the better the ads.**
