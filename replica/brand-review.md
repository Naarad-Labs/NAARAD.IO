# Brand and deck review: visual cues for Naarad Discover

Date: 2026-10-04. Sources: the 16-page pitch deck "Naarad Today" (exported 2026-06-28), the **Brand Kit v1.0** image
(`replica/brand/naarad-brand-kit-v1.jpg`, dated "MAY 2025" on the image), the live site's CSS (`index.html`), and the Komoot
screenshots in `screens-notes.md`.

How to read the numbers. **Printed** = a value written in the kit. **Sampled** = read from pixels of the deck or screenshots
(JPEG and PDF rendering, so about 2 per cent off, and most deck slides are AI-generated raster images with no source values).
**Read** = my judgement from looking. Contrast ratios are computed (WCAG 2.x formula), not estimated.

## 1. The three sources disagree

| thing | brand kit v1.0 (printed) | pitch deck (sampled) | live site (`index.html`) | Discover before | Discover now |
| --- | --- | --- | --- | --- | --- |
| Navy | `#0B1D3A` Deep Navy | `#19274E`, `#142846`, `#1E224D` in headings | `--navy: #172752` | `#172752` | `#172752` (matches deck and site) |
| Orange | `#F26A1C` Heritage Orange | burnt sienna `#A7542A` to `#C36547`, plus a bright orange on the journey slide | `--terra: #DD6E27`, `--terra-d: #C4581A` | `#B35920` text, `#DD6E27` graphic | `#A7542A` text (the deck's sienna), `#E0621B` graphic, `#F26A1C` fill with a navy label |
| Cream | `#F2E8DB` Sand | `#F4EEE3` to `#F7F1E9`, with a paper grain | `body { background: #F9F1DC }` | `#FAF8F2` | `#F6F0E6` (the deck's cream); Sand `#F2E8DB` for tags and card media |
| Green | `#1E5B46` Forest Green | muted sage `#8FA37E` (pyramid, donut) | none | `#15803D` for easy routes | `#1E5B46` for easy routes and success |
| Gold | `#D99A2B` Mustard | `#E9A73C`, and `#FFC550` for testimonial banners | none | none | not used (2.4:1 on white) |
| Grey | `#6B6B6B` Stone Gray | `#595963`, `#A8A4A3` | `--slate` | `#4A5068` for muted text | `#4A5068` (Stone Gray is 4.4:1 on Sand) |
| Headings | **Cinzel** | **Playfair Display** Bold and Bold Italic (embedded in the PDF), Poppins Bold and DM Sans Bold on the team slide | **Playfair Display**, with Cormorant Garamond also loaded | Inter 700 | Playfair Display 700 for card titles and the empty state |
| Body | Inter | Inter-like, plus Varela Round on the live-text slides | Inter | Inter | Inter |

Two things stand out. **The deck matches the live site, and the kit is the odd one out**: the kit's navy is darker, its
orange is brighter, and its heading face is Cinzel, which neither the deck nor the site uses. The kit is dated May 2025 and the
repo was created in May 2026, so it may simply be older. And **the deck's real accent is a burnt sienna, not the kit's
bright orange.** Slides 9, 10, 11 and 14 are built on `#A7542A`-ish terracotta with navy, sand and sage.

### Decisions for you (defaults chosen so work can go on; each is one token to change)

1. **Heading face: Playfair Display, not Cinzel.** Reason: the deck, the site and every page already use it, and Cinzel has
   no lowercase (it draws small capitals), so "Napier Bridge loop from Chepauk" would read as a shout. Cinzel stays in the
   logo's wordmark, where it is an image. Reverse this if the kit is the authority and the site is meant to change.
2. **Navy: the site's `#172752`, not the kit's `#0B1D3A`.** Reason: the planner's own navy bar sits directly above Discover,
   and two navies on one screen read as a mistake. The deck sides with the site. To adopt the kit's navy everywhere, change
   `--navy` in `index.html` and `color.primary` and `color.text` in `replica/design/tokens.json`.
3. **Orange is for graphics, and a darker sienna is for text.** See section 3.

## 2. What the deck says about look and feel (read)

- **Mood.** Warm paper, deep navy serif headlines, terracotta and mustard accents, sage as the quiet third colour. It reads as
  an illustrated heritage guide, not a tech product. The deck's own wording: "Warm, authentic, earthy and immersive" (kit,
  imagery style).
- **Ornament.** Very faint jaali arches and mandala corners at slide edges (about 5 to 10 per cent opacity), topographic
  contour lines behind the journey, yatra and roadmap slides, and four repeat patterns in the kit (contour weave, mandala,
  jaali lattice, a tile motif). Used as texture, never behind text.
- **Shapes.** Rounded rectangles with a 2 px outline in navy or terracotta (about 16 to 24 px radius) on slides 7, 13 and 14;
  double-line gold-bordered cards on the revenue slide; arch-topped frames; pill tags in semantic colours; dashed connectors
  with ring nodes; a thick orange winding route line with arrow nodes on the "Core Experience" slide.
- **Icons.** Two-tone line icons: navy stroke about 2 px with round caps, with a terracotta or mustard fill accent. The kit
  lists twelve: Explore (pin), Maps, Listen, Discover (compass), Heritage, Achievements, Community, Events, Share, Save, Offline,
  Navigate. All outline, all navy.
- **Colour as meaning.** On the Hampi slide **red and terracotta mean crowded** and **green means the better route**. Tags:
  "High Crowd Density" (red), "Long Wait Times" (orange), "Balanced Footfall" and "Shorter Travel Time" (green), "Tier-2" and
  "New Discoveries" (green). The deck's categorical order in charts is navy, terracotta, sage, sand, mustard.
- **Voice.** Kit: Authentic, Curious, Inclusive, Responsible. Slide titles are declarative with a colon ("The Core
  Experience: From Discovery to Immersion"). Taglines: "Explore. Listen. Connect." and "Transforming tourists from consumers
  into creators".
- **Accessibility.** Slides 6 and 7 commit to **WCAG 2.1 AA**: contrast, keyboard use, focus order, alt text, screen readers.
  This matters below: parts of the kit's palette do not meet it.

## 3. Contrast of the palettes (computed)

| pair | ratio | verdict |
| --- | --- | --- |
| Navy `#0B1D3A` on Sand `#F2E8DB` | 13.9 | pass |
| Forest `#1E5B46` on white / on Sand | 7.9 / 6.6 | pass |
| White on Forest | 7.9 | pass |
| **White on Heritage Orange `#F26A1C`** | **3.06** | **fails AA for normal text** (passes only for text of 24 px, or 18.7 px bold, and up) |
| Orange on white / on Sand | 3.06 / 2.53 | fails as text; passes the 3:1 for a graphic only on white |
| **Navy on Heritage Orange** | **5.5** | pass: use navy, not white, as the label on an orange button |
| Orange on navy | 5.5 | pass |
| **Mustard `#D99A2B` on white / Sand** | **2.4 / 2.0** | fails even as a graphic; fine on navy (6.9) |
| Stone Gray `#6B6B6B` on white / on Sand | 5.3 / **4.4** | passes on white, fails on Sand for small text |
| Deck terracotta `#A7542A` on cream `#F4EEE3` / on white | 4.6 / 5.3 | pass, as text and as a white-on-fill button |
| Deck testimonial yellow `#FFC550` on white | 1.6 | fails as a graphic; navy text on it passes (10.7) |
| Sage `#8FA37E` on cream | 2.4 | decoration only |

So **the kit's own "Secondary Button" (white label on orange) fails the AA commitment on slide 7.** In Discover, orange fills
carry a navy label, and orange text is not used. Sienna `#A7542A` is the text-safe accent, and it is the colour the deck
actually uses. Mustard appears only on navy.

## 4. How close is too close

The Komoot app's orange is `#EE6C18` and the kit's is `#F26A1C`: **6 apart on a scale of 441, which is the same colour to the
eye.** The app's page colour `#F6F3EC` is 21 from the kit's Sand and 10 from the deck's cream. Cream with an orange floating
button reads as Komoot.

What makes Naarad different, and what Discover leans on: the **navy** (the original has none: it uses a dark olive), a
**forest green** that is clearly not that olive (52 apart), **Playfair Display headings** (the original uses a geometric
sans), the **contour and mandala patterns**, and the **sitar logo**. Discover therefore uses navy for primary buttons and
selected chips (not olive and tan), keeps orange to one or two accents, and uses serif card titles. I also did not copy the
original's navigation-arrow pins, its "Plan New" wording or its bottom tab bar.

**One element is a near match, and it was asked for:** the **Map button**, an orange pill with a map icon and the word "Map", centred
at the bottom of the list. Its job, position and colour are the original's. If it needs distance, the cheapest change is navy
instead of orange (one token: `--color-orange` for `--color-primary`, and the label to `--color-on-primary`). The layout as a whole
(a floating pill, a chip row, a bottom sheet) is a common map-app pattern, not Komoot's alone. This is a design judgement, not legal
advice.
`/replica-brand` is where it gets settled.

## 5. The logo

Printed in the kit: a sitar (navy body, orange globe behind its neck, a green leaf and a small orange leaf at the base) with
Devanagari letters in orange and navy floating up and left; the wordmark **NAARAD** in Cinzel capitals; the tagline
**EXPLORE. LISTEN. CONNECT.** in orange. Variants: full colour, on dark (a navy tile), monochrome, icon only. Rules: use the
primary logo on light backgrounds and the white version on dark; keep clear space equal to the height of the letter "व"; do not
change colours, stretch, rotate or add effects.

Not available here: a vector file. The kit is a 1536 x 1024 JPEG, so the logo in it is about 380 px tall. That is enough for a
header at 1x and not for print or a store icon. The site embeds its own logo as an image; Discover adds none. **Ask the
designer for the SVG.**

## 6. What the deck asks of Discover, specifically

1. **The deck presents Discover as the front door.** Slide 4's first phone is the search pill ("Map area" and "Plan New"),
   highlighted in an orange frame, captioned "Users intuitively define their search radius and filter for specialized heritage
   circuits". That is the layout now built for phones (`discover/`): a floating pill, then three chips (sport, "within N km",
   Filters).
2. **The "Anti-Google Map" slide is the product's point of difference, and nothing in Discover shows it yet.** It labels
   places with crowd density, open hours, travel time and tier (Tier-1 hotspot, Tier-2 gem). None of that is in the data. It is
   the strongest candidate for "better than the original" in `/replica-entrepreneur`, and it needs data first.
3. **Audio is the other half.** Slide 4's third phone and the testimonial slide show numbered stops with audio that triggers on
   a geofence. The tour page (S04) should carry numbered stops and the elevation profile; Naarad's route pages already have audio
   stops.
4. **Colour semantics carry over.** Red or sienna for crowded or hard, green for good or easy. Discover's difficulty colours
   follow that, and always come with a word.

## 7. What was applied

| cue | where it went |
| --- | --- |
| Palette and roles | `replica/design/tokens.json` and the generated `discover/tokens.css` |
| Serif card titles, Inter for everything else | `discover/primitives.css` |
| Pill controls with a 1px outline; cards with a 16px radius and a soft shadow | `discover/primitives.css` |
| Contour pattern on cards with no photo, mandala in the empty state | `discover/primitives.css`, `discover/discover.js` |
| Outline icons, 2 px round caps, navy | `discover/discover.js` (inline SVG, drawn fresh) |
| Phone layout from the app screenshots | `discover/discover.js`, `discover/primitives.css`; measured in `parity.md` |

Not applied: the deck's ornament frames (too heavy for a working screen), the mustard banners, photography (there are no
photos in the data), and the kit's Cinzel.

## 8. Outside the brief, worth knowing

Slides 4 and 12 use screens from Komoot's own app (its map, search pill, Navigate button and elevation profile) as pictures of
Naarad, and slide 12's testimonials sit beside one. If the deck goes to funders or is published, check that those screens
are labelled for what they are. This is a note, not a finding: I do not know how the deck is used.
