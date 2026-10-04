# First-hand evidence: what the screenshots show

Date: 2026-10-04. Source: 7 screenshots of **Komoot's Android app** that the user took from their own account, and the app
screens reproduced in their pitch deck (slides 4 and 12). The images are in `replica/screens/` on the user's machine and are
not committed (the repo is public; see `replica/screens/.gitignore`). This file is text only and leaves out the account's
name, places and dates.

**What this is not.** It is the **mobile app**, not the web page the recon started from. Layout, wording and controls below
are first-hand for the app. For the website they are a strong hint, not proof. Nothing here was measured on Komoot's web
Discover. Geometry is read off the image at 390 CSS px wide (the files are 1080 px wide, scale 0.361), so it is good to about
3 px. Colours are sampled from pixels (JPEG, so about 2 per cent off).

## The seven screens

| file | screen | in the Discover slice? |
| --- | --- | --- |
| `orig-m-map-wide` | Routes tab, **map view**, zoomed out over south India, "14 runs" | yes (S01) |
| `orig-m-map-chennai` | Routes tab, map view, searched "Chennai", "within 46 km", "2 runs" | yes (S01, S03) |
| `orig-m-routes-list-top` | Routes tab, **list view**, first card | yes (S01) |
| `orig-m-routes-list-scrolled` | same, scrolled one card | yes (S01) |
| `orig-m-home` | Home tab: Explore / Challenges / Events | no |
| `orig-m-profile` | Profile tab: sports, followers, 4 stat tiles | no |
| `orig-m-record-paused` | Record tab, paused | no |

## S01 map view (first-hand)

From the top of the screen down, all floating over a full-bleed map:

1. **Search pill.** White, fully rounded, 58 px tall, 17 px from each edge, 61 px from the top. Search icon, the text
   "Map area" (or the place you searched, here "Chennai"), a hairline divider, then a **"+ Plan New"** action in dark green.
2. **Chip row**, 48 px tall, 11 px gaps, white fully rounded chips: a **sport selector** (an orange sport icon and a chevron,
   78 px wide: a dropdown), **"within 227 km"** (a radius icon and text, about 150 px), **"Filters"** (funnel icon and text, about
   100 px).
3. Scale bar, top left, under the chips.
4. Right edge, from the bottom: a **"Map layers"** pill (layers icon), a round **locate-me** button, and a round orange
   **offline** button with an "OFFLINE" label above it (the device has no connection in these shots).
5. Pins: round pins with a navigation-arrow glyph in red, dark brown, purple and blue; one star pin with a name label (a
   place of interest, which the app calls a Highlight); a blue dot with a white ring (the device's own position). What the pin
   colours mean is not established.
6. **Bottom sheet**, top corners rounded about 20 px, a centred grab handle, and one line of text: **"14 runs"** zoomed out,
   **"2 runs"** after searching Chennai within 46 km. Collapsed it is about 70 px tall.
7. Bottom navigation, five tabs: Home, Routes (active, green), Record, Profile, Offline. This is the app's own shell.

## S01 list view (first-hand)

Reached from the map; a floating orange **"Map"** pill, bottom centre, goes back. The search pill and chip row stay at the top.
Cards, 357 px wide, 17 px from each edge, about 28 px apart:

- **Media**, about 140 px tall, corner radius about 12 px. Either a photo with a small **map thumbnail inset** (61 x 60 px,
  bottom right, white border, rounded) or, when there is no photo, a **map image of the route** (blue line with a white
  casing, a green "A" start marker).
- A **difficulty badge** over the media, top left: a dark olive pill with white text. The one seen reads **"Moderate"**.
  (The recon's help-article summary said intermediate and expert. The words here are Easy / Moderate / Hard style, which
  is what Naarad already uses.)
- A row under the media: **star and rating** (orange star, "5.0") then a **people icon and a count** ("29", "1"). A route
  with no rating shows only the people count. What the count measures is not stated (completions is a guess).
- **Title**, about 17 px, bold, humanist geometric sans: "Napier Bridge loop from Chepauk".
- **Stats row**, about 15 px, muted warm grey: clock + duration ("49m"), arrows + length ("7.98 km"), up arrow + ascent
  ("20 m"), separated by dots.
- No distance-from-centre on the card. Naarad's cards have one ("12 km away"), which is more than the original shows.

## Answers to the recon's open questions

| recon item | answer from the screenshots | confidence |
| --- | --- | --- |
| 6. What does `max_distance` mean? | The control in the app is a chip reading "**within 46 km**" next to the place: a **search radius**. `max_distance=30000` in the web URL is 30 000 m, so "within 30 km". No separate "longest route" control is visible in the control row (the Filters panel was not opened, so one may live inside it). | high that the chip is a radius; medium that the web URL means the same |
| 7. Does the list follow the map? | The count in the sheet follows the area ("14 runs" wide, "2 runs" for Chennai). Deck slide 4 shows an orange **"Search this area"** pill over a panned map, so panning does not search by itself: you press it. | medium (one frame, from a deck) |
| 4. Does a tour detail screen (S04) exist? | Yes. Deck slides 4 and 12 show it: back arrow and title, map with numbered stops and an A / B start and end, an orange **"Navigate"** pill and a **"Save o…"** (save offline) pill, a layers button, and an **Elevation profile** panel (close button, then "40m · 2.93 km · up 10 m · down 10 m", a distance axis, stop markers on the profile). | medium (seen only in deck crops) |
| 5. Click count for F01 | Still not counted: no recording of the flow. | n/a |

## Not answered

Contents of the Filters panel; the sport dropdown's options; whether the list pages or scrolls forever; what happens with no
results or no network; the web layout; logged-out view; anything about the web's pagination.

## Colours sampled (original, for reference only; Naarad uses its own palette)

Page and sheet `#F6F3EC`, cards and pills `#FFFFFF`, primary buttons and badge dark olive `#404823` to `#4B5427`, secondary
button tan `#E3D2B4`, stat tile `#EDE9DE`, floating orange `#EE6C18`, premium purple `#8879E0`, body text `#242320`, muted text
`#726656`. Naarad's kit orange `#F26A1C` is within a few per cent of the original's orange and its Sand `#F2E8DB` is close to
the page colour. That is worth knowing: see `replica/brand-review.md`, "How close is too close".
