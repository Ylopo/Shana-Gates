# Shana Gates — Community Pages Reference

Single source of truth for how the Coachella Valley community pages are
structured, what content lives on each one, and how to replicate the
pattern on a new real estate site in a different market.

`MAPS.md` covers everything map-related in depth — this file refers to it
for map specifics rather than repeating them.

---

## What a "Community Page" Is

A community page is a single long-scroll page about one city or
neighborhood, designed to do four jobs at once:

1. **Rank in local search** for `"<city> homes for sale"` and related terms
2. **Earn AI/LLM citations** by answering buyer questions clearly (the FAQ
   block in particular is structured for snippet/AEO use)
3. **Convert visitors to leads** via Shana's contact CTAs in 3+ positions
4. **Show live listings** via the YLOPO MLS widget so the page never goes stale

Every Coachella Valley city has one of these pages and they all follow the
same anatomy. The 9 city pages share a single CSS file (`community.css`)
and a single JS file (`community-map.js`); everything that changes per
city is either inline HTML content or an inline `window.CV_MAP_CONFIG`
object.

---

## File Inventory

```
palm-springs.html          ← Community page (one per city, 9 total)
palm-desert.html
rancho-mirage.html
indian-wells.html
la-quinta.html
indio.html
cathedral-city.html
desert-hot-springs.html
coachella.html

community.css              ← Shared styles for all 9 pages (~4,400 lines)
community-map.js           ← Shared Mapbox 3D map init (reads CV_MAP_CONFIG)
images/                    ← Page images (most pages rely on map visuals + CTAs)

MAPS.md                    ← Full Mapbox reference (boundaries, roads, palette)
```

Each city page is a standalone, fully-rendered HTML file (~1,000 lines).
The site is static — no build step — so the page you ship is the page you
serve. Vercel auto-deploys on `git push` to `main`.

---

## Page Anatomy — Top to Bottom

Every community page is structured as the same 14 sections in the same
order. The IDs below are real `<section id="…">` anchors used in the HTML
and styled by `community.css`.

| # | Section ID | What it does | Per-city content |
|---|---|---|---|
| 1 | `<nav>` | Sticky top nav with Communities dropdown + phone CTA | None — identical across pages |
| 2 | `community-hero` | Full-bleed 3D map with city name overlay + 4 hero stats | City name, 4 stats (listings count, median price, property types, "Updated") |
| 3 | `valley-location` | Smaller orientation map showing this city highlighted in the valley + 4 drive-time cards | Drive-time facts (e.g. "~30 min to Palm Desert via Hwy 111") |
| 4 | `overview` | Two-column layout: 3-paragraph editorial intro + "At a Glance" quick facts sidebar | Editorial copy, 8 quick-fact pairs |
| 5 | `demographics` | Single row of 5 census-style stats with `Source: U.S. Census Bureau` note | Pop, median age, avg income, households, ownership rate |
| 6 | `highlights` | 6-card grid — "What makes it special" | 6 icon + title + 1-paragraph items |
| 7 | `neighborhoods` | Compact grid of neighborhood cards with price range + tags | 8–12 neighborhood cards |
| 8 | `city-stats` | Decorative row of 5 SVG-icon stats (sunny days, pools, golf, etc.) | 5 number + label pairs |
| 9 | `listings` | YLOPO MLS widget showing 12 live listings + "View All" link | None — widget config drives data |
| 10 | `hoa-fees` | Two-column: HOA fee table + "What HOAs cover" bullets | Fee ranges by community type |
| 11 | `parks-rec` | 3+ park cards with address, size, amenity bullets | Park names, addresses, amenities |
| 12 | `schools` | Tabbed (Public / Private & Charter) school tables with disclaimer | School name, grades, district |
| 13 | `nearby-communities` | Comparison table linking out to the other 8 city pages | "Why consider" one-liners |
| 14 | `faq` | 6–10 accordion FAQ items written for AEO/featured-snippet capture | The questions buyers actually ask |
| 15 | `lifestyle` | Two-column: editorial copy + interactive lazy-loaded 3D map | Lifestyle bullets (events, attractions) |
| 16 | `community-cta` | Final pitch with phone + email buttons | None — identical |
| 17 | `<footer>` | Brand, communities list, quick links, social, MLS disclaimer | None — identical |

The order matters. It moves the reader through *orientation* (where is
this place?) → *desirability* (why live here?) → *practical info*
(neighborhoods, fees, schools) → *live inventory* → *common objections*
(FAQ) → *call to action*.

---

## Hero — Section 2 (`#community-hero`)

The most distinctive element on the page. A 100vh map fills the
background; an overlay div darkens it; an oversized serif title + 4
hero stats sit on top.

```html
<section id="community-hero">
  <div id="hero-map"></div>            <!-- Mapbox 3D city view -->
  <div class="hero-map-overlay"></div> <!-- Dark gradient -->
  <div class="hero-content">
    <div class="breadcrumb">
      <a href="/">Home</a> · <a href="/#communities">Communities</a> · <span class="current">Palm Springs</span>
    </div>
    <p class="hero-eyebrow">Coachella Valley · California</p>
    <h1 class="hero-title">Palm <em>Springs</em></h1>
    <div class="hero-stats">
      <div class="hero-stat"><span class="hero-stat-value">500+</span><span class="hero-stat-label">Active Listings</span></div>
      <div class="hero-divider-v"></div>
      <div class="hero-stat"><span class="hero-stat-value">$650K</span><span class="hero-stat-label">Median Price</span></div>
      <!-- two more stats -->
    </div>
  </div>
</section>
```

The `<em>` wrapping the second word of the title (`Palm <em>Springs</em>`)
gets the *Cormorant Garamond italic* serif treatment. Every page does
this — it's the visual signature of the H1.

The map at `#hero-map` is initialized by `community-map.js` — see
**Shared Map System** below.

---

## Valley Location — Section 3 (`#valley-location`)

A standalone "where is this city" orientation map. Smaller than the hero
map, shows all 9 CV cities with the current one highlighted in yellow,
plus the I-10 and Hwy 111 roads colored. Below the map: four drive-time
"to X via Y" cards.

The script for this map is **inlined per-page** (not in
`community-map.js`) because the highlighting needs to know which city is
"current" — see lines 888–954 of any community HTML file for the
reference implementation. Each page has its own copy with
`CURRENT_SLUG` set to the matching city slug.

```html
<section id="valley-location">
  <div class="valley-loc-head">
    <p class="valley-loc-eyebrow">Location</p>
    <h2 class="valley-loc-title">Where is <em>Palm Springs?</em></h2>
    <p class="valley-loc-desc">The western gateway of the Coachella Valley — ...</p>
  </div>
  <div class="valley-loc-map-wrap">
    <div id="valley-context-map"></div>
    <div class="valley-loc-legend"> ... </div>
  </div>
  <div class="valley-loc-cards">
    <div class="valley-loc-card">
      <span class="valley-loc-card-time">~1.5 hrs</span>
      <span class="valley-loc-card-dest">to Los Angeles</span>
      <span class="valley-loc-card-via">via I-10 West</span>
    </div>
    <!-- 3 more cards -->
  </div>
</section>
```

---

## Overview + Quick Facts — Section 4 (`#overview`)

The most visited block on the page. Three paragraphs of warm,
specific-to-this-city editorial copy on the left; a 2-col "At a Glance"
fact sidebar on the right. Both columns slide in via `.reveal` animation
when scrolled into view.

The sidebar facts use a consistent set of labels across all pages so the
**Sanity CMS override system** can update them by label name (see
**CMS Overrides** below).

```html
<section id="overview">
  <div class="overview-text reveal">
    <p class="section-eyebrow">The Iconic Desert City</p>
    <h2 class="overview-title">Where <em>Mid-Century</em><br>Meets Modern Luxury</h2>
    <div class="overview-divider"></div>
    <p class="overview-body">Palm Springs is the crown jewel of …</p>
    <p class="overview-body">…</p>
    <p class="overview-body">…</p>
    <div class="overview-cta">
      <a href="mailto:shana@craftbauer.com" class="btn-primary">Connect With Shana</a>
      <a href="#listings" class="btn-text">View Listings ↓</a>
    </div>
  </div>

  <div class="quick-facts reveal reveal-delay-2">
    <p class="quick-facts-heading">At a Glance</p>
    <div class="quick-fact"><span class="fact-label">City Type</span><span class="fact-value">Incorporated City</span></div>
    <div class="quick-fact"><span class="fact-label">County</span><span class="fact-value">Riverside County</span></div>
    <div class="quick-fact"><span class="fact-label">Population</span><span class="fact-value">~47,000</span></div>
    <div class="quick-fact"><span class="fact-label">Median Home Price</span><span class="fact-value">$650,000</span></div>
    <div class="quick-fact"><span class="fact-label">Architecture</span><span class="fact-value">Mid-Century Modern</span></div>
    <div class="quick-fact"><span class="fact-label">Elevation</span><span class="fact-value">479 ft</span></div>
    <div class="quick-fact"><span class="fact-label">Airport</span><span class="fact-value">PSP (2 mi)</span></div>
    <div class="quick-fact"><span class="fact-label">Drive to LA</span><span class="fact-value">~2 hours</span></div>
  </div>
</section>
```

### Quick-fact labels actually used (case-sensitive for the CMS sync)

`City Type` · `County` · `Population` · `Median Home Price` · `Architecture` · `Known For` · `Elevation` · `Golf Courses` · `Airport` · `Drive to LA`

(Not every page uses every label; pages choose ~8 that fit best.)

---

## Highlights, Neighborhoods, City Stats — Sections 6–8

These three are pure HTML — no JS, no APIs.

**`#highlights`** — 6-card grid. Each card has an emoji icon, a short
title, and a 1-paragraph body. Use icons that match the city's identity
(🏛️ for architecture, ⛳ for golf, 🎵 for festivals).

**`#neighborhoods`** — Compact grid of `.neighborhood-card` items, each
with a name, a price range, and 1–2 descriptor tags. 8–12 cards per page
is the sweet spot.

**`#city-stats`** — A decorative band of 5 stats with inline SVG icons.
Round numbers that read like trivia (350 sunny days, 8,000+ pools,
100+ golf courses). Use this for *feel*, not precision.

---

## Listings — Section 9 (`#listings`)

The MLS data block. This is a YLOPO widget — drop in a `<div>` with a
`data-search` JSON attribute and the YLOPO script renders a 12-listing
grid. **Always use `"limit":12`** across the site so the YLOPO "View All"
flow works consistently.

```html
<section id="listings">
  <div class="listings-header reveal">
    <div>
      <p class="section-eyebrow">Live MLS Data</p>
      <h2 class="section-title">Palm Springs Homes For Sale</h2>
    </div>
    <a class="view-all-link" target="_blank" rel="noopener"
       href="https://search.searchcoachellavalleyhomes.com/search?s[orderBy]=sourceCreationDate%2Cdesc&s[page]=1&s[locations][0][city]=Palm+Springs&s[locations][0][state]=CA">
       View All Listings →
    </a>
  </div>
  <div class="reveal">
    <div class="YLOPO_resultsWidget"
         data-search='{"locations":[{"city":"Palm Springs","state":"CA"}],"propertyTypes":["house","condo","townhouse"],"limit":12}'></div>
  </div>
  <div class="listings-cta-row reveal">
    <a class="btn-view-all" target="_blank" rel="noopener" href="…/search?…">View All Palm Springs Properties →</a>
  </div>
</section>
```

Required setup in `<head>`:

```html
<script>
  var YLOPO_HOSTNAME = 'search.searchcoachellavalleyhomes.com';
  window.YLOPO_WIDGETS = { domain: 'search.searchcoachellavalleyhomes.com' };
</script>
```

Required at end of `<body>`:

```html
<script src="https://search.searchcoachellavalleyhomes.com/build/js/widgets-1.0.0.js" defer></script>
```

The YLOPO widget only renders on domains registered with YLOPO. On
`localhost` and Vercel preview URLs it will show empty grid — that's
expected.

See `CLAUDE.md` (YLOPO Widget System) for the full `data-search` schema.

---

## HOA Fees, Parks, Schools — Sections 10–12

All three are table-driven content blocks.

**`#hoa-fees`** — A monthly-HOA-by-community-type table + a "What HOAs
typically cover" bullet list. Keep the values realistic for the market.

**`#parks-rec`** — 3+ `.park-card` items per page. Each card has a name,
a real street address, an acreage chip, and an amenities bullet list.
Real addresses and acreages signal local authority.

**`#schools`** — A tabbed component with a `Public` panel and a
`Private & Charter` panel. The HTML has inline `onclick="switchTab(…)"`
handlers; the toggle script is at the bottom of the page (see
**Inline JavaScript** below). Always include a school-zoning disclaimer
at the bottom — school assignments are address-specific and federal Fair
Housing rules limit how agents can talk about them.

---

## Nearby Communities — Section 13 (`#nearby-communities`)

A 7-row table linking to the other 8 city pages. Each row: city name,
starting price, a 1-sentence "Why consider" pitch, and a → arrow. This
is **the most important internal-linking section** on the page — it
keeps users moving sideways through your community pages instead of
bouncing.

```html
<tr>
  <td class="nearby-name-cell"><a href="cathedral-city.html">Cathedral City</a></td>
  <td class="nearby-price-cell">From $280K</td>
  <td>Most affordable entry point adjacent to Palm Springs. Growing dining and arts scene with easy access to PS amenities.</td>
  <td class="nearby-arrow-cell">→</td>
</tr>
```

---

## FAQ — Section 14 (`#faq`)

This is the AEO (answer-engine optimization) workhorse. 6–10 accordion
items, each posed as the question a buyer *would actually type into
Google* and answered in 2–4 sentences with specific local detail.

```html
<div class="faq-item">
  <div class="faq-question" onclick="toggleFaq(this)">
    <span class="faq-question-text">What is the median home price in Palm Springs?</span>
    <div class="faq-toggle"><span class="faq-toggle-icon">+</span></div>
  </div>
  <div class="faq-answer">
    <div class="faq-answer-inner">The median home price in Palm Springs is approximately $650,000 as of 2026, though …</div>
  </div>
</div>
```

### FAQ question patterns that work

- `What is the median home price in <city>?`
- `Is <city> a good market for vacation rentals?`
- `What ZIP codes cover <city>?`
- `Are there 55+ / gated communities in <city>?`
- `What architectural styles are most common in <city>?`
- `How hot does it get in <city>?` (or weather/climate question)
- `Is <city> a good place to buy for investment?`
- `What is the land-lease situation in <city>?` (Palm Springs specific —
  every market has its own version of this)

Each answer should mention Shana by name at least once across the set
(but not in every answer — that looks spammy).

---

## Lifestyle + CTA + Footer — Sections 15–17

**`#lifestyle`** — Two-column. Left: 2 paragraphs of vibe-y editorial
copy + a 5-bullet list of can't-miss events/attractions. Right: an
interactive 3D Mapbox map (52° pitch, navigation controls) that
lazy-loads when scrolled into view.

**`#community-cta`** — Final pitch. Big "Ready to find your X home?"
title, phone button + email button. Identical across all 9 pages except
the eyebrow line.

**`<footer>`** — Same on every page. Brand block, communities column,
quick links, social row, and the legally-required MLS attribution +
DRE/CalDRE disclaimer.

---

## Shared Map System

Every community page loads three pieces and the map system handles
itself:

```html
<!-- in <head> -->
<link href="https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.css" rel="stylesheet" />

<!-- near </body> -->
<script src="https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.js"></script>
<script>
  window.CV_MAP_CONFIG = {
    "city": "Palm Springs",
    "subtitle": "Coachella Valley, CA",
    "lng": -116.5453,
    "lat": 33.8303,
    "heroZoom": 11.5,
    "lifestyleZoom": 11,
    "boundary": [ /* [lng,lat] closed polygon */ ],
    "pois": [ /* 4–6 POI objects with name, desc, lng, lat, icon */ ]
  }
</script>
<script src="/community-map.js"></script>
```

`community-map.js` reads `window.CV_MAP_CONFIG` and creates:

- **Hero map** at `#hero-map` — non-interactive, 45° pitch, immediate load
- **Lifestyle map** at `#lifestyle-map` — interactive, 52° pitch, lazy-loaded
  via `IntersectionObserver`, with `NavigationControl` and a corner label

Both maps automatically get:

- Mapbox Standard style + `night` light preset (dark + lit 3D buildings)
- I-10 (blue) and Hwy 111 (bronze) GeoJSON line layers
- The city boundary polygon as a fill + outline
- POI markers with click-to-open dark glassmorphism popups

For all the map-specific detail — boundary polygons, road waypoints,
color palette, POI marker CSS, alternative-map ideas — see
**`MAPS.md`** in this repo. It's the single source of truth for the map
implementation; this doc covers the page-level integration.

The valley-location map (section 3) is a **separate** per-page inline
script because the highlighted-current-city logic needs `CURRENT_SLUG`
hardcoded. It lives at the bottom of each HTML file. To replicate it on
a new page, copy the IIFE wholesale and change one line: `var CURRENT_SLUG = 'palm-springs'` → your city's slug.

---

## CMS Overrides (Sanity)

Each community page has a small inline `fetch` block at the bottom that
hits `/api/community?slug=<city-slug>` and overlays any CMS-edited values
on top of the hardcoded HTML defaults. This is what lets Shana update
stats via the AI Content Assistant without redeploying.

The sync script matches **by label text**:

```js
fetch('/api/community?slug=palm-springs')
  .then(r => r.json())
  .then(doc => {
    if (!doc?.quickStats) return
    doc.quickStats.forEach(stat => {
      // Match .hero-stat by .hero-stat-label
      // Match .quick-fact by .fact-label
      // Update the matching .hero-stat-value / .fact-value
    })
    // Optional: doc.heroImage replaces the 3D map with a real photo overlay
  })
```

Falls back silently if the API returns nothing or the doc has no stats —
so the HTML defaults are the authoritative source if Sanity is offline
or unconfigured.

If you replicate this on another site, you have three choices:

1. **Keep the Sanity sync** — port `api/community.ts`, `lib/sanity.ts`,
   and the Sanity project setup over. Worth it if the client wants to
   edit stats themselves.
2. **Remove the sync** — delete the inline fetch script and just edit the
   HTML directly. Simplest. Suits sites with a developer in the loop.
3. **Swap the data source** — point the fetch at a different endpoint
   (Google Sheets via API, Airtable, Webflow CMS, whatever). The
   matching-by-label logic doesn't care where the data comes from.

---

## Tracking, SEO, and Other Head Content

Every community page has the same `<head>` boilerplate in this order:

1. **Marketing tracking pixels** — RAEK, OIR/Aggle, MM (added by the
   `Start RAEK Code` … `End RAEK Code` blocks — see commit `d34ac37`)
2. **Google Analytics 4 gtag**
3. **Meta charset + viewport**
4. **Favicon**
5. **Title + description** — `<city> Homes For Sale | <agent> — <market>`
6. **Google Fonts preconnect + load** — Cormorant Garamond + Jost
7. **Mapbox GL CSS**
8. **`community.css`**
9. **YLOPO config**
10. **Canonical URL injection** (small inline script)

Title pattern that works for these pages:

```html
<title>Palm Springs Homes For Sale | Shana Gates — Coachella Valley Real Estate</title>
<meta name="description" content="Explore homes for sale in Palm Springs, CA. Mid-century modern icons, celebrity estates, and desert living at its finest. Shana Gates, Craft & Bauer | Real Broker." />
```

Always 50–60 chars title, 140–160 chars description, city + "Homes For
Sale" leading, agent + brokerage trailing.

---

## Inline JavaScript

Three tiny scripts live at the bottom of every page. Keep them inline —
they're small and removing the network round-trip helps perceived
performance.

```html
<!-- FAQ accordion + Schools tabs -->
<script>
  function toggleFaq(btn) {
    var item = btn.parentElement
    var wasOpen = item.classList.contains('open')
    document.querySelectorAll('.faq-item.open').forEach(el => el.classList.remove('open'))
    if (!wasOpen) item.classList.add('open')
  }
  function switchTab(tab, panelId) {
    var section = tab.closest('section')
    section.querySelectorAll('.schools-tab').forEach(t => t.classList.remove('active'))
    section.querySelectorAll('.schools-panel').forEach(p => p.classList.remove('active'))
    tab.classList.add('active')
    var panel = document.getElementById(panelId)
    if (panel) panel.classList.add('active')
  }
</script>
```

Scroll-reveal animations (the slide-in-on-scroll effect for elements with
`.reveal`) are handled by `community-map.js` — anything with the
`.reveal` class gets a `visible` class added when it crosses into the
viewport.

---

## Design Tokens

Defined at the top of `community.css`:

```css
:root {
  --dark:         #0d0d0d;
  --dark-2:       #131313;
  --dark-3:       #1a1a1a;
  --cream:        #F2EDE4;
  --cream-2:      #E8E1D5;
  --bronze:       #C8C8C8;
  --bronze-light: #DCDCDC;
  --bronze-dim:   rgba(200,200,200,0.18);
  --text-light:   #F2EDE4;
  --text-muted:   rgba(242,237,228,0.55);
  --text-dark:    #1a1814;
  --text-mid:     #4a4540;
  --serif:        'Cormorant Garamond', Georgia, serif;
  --sans:         'Jost', system-ui, sans-serif;
}
```

When replicating on a different brand: change `--bronze` (the accent),
`--cream`/`--cream-2` (warm tones), the `--text-*` pair, and the two
fonts. The dark background palette holds up well across most luxury
real-estate brands — it makes the night-mode 3D map feel native.

---

## How to Add a 10th CV Community Page (Same Project)

1. Pick the slug (e.g. `bermuda-dunes.html`)
2. Copy any existing community HTML file as the starting template
3. **Update the `<head>`:** title, description, canonical URL
4. **Update the nav** in *every other community page* to add a Communities-dropdown link to the new one. Also update the footer Communities list everywhere.
5. **Update content for each of the 14 sections:**
   - Hero: city name, 4 hero stats
   - Valley location: drive-time cards
   - Overview: 3 editorial paragraphs + 8 quick-facts
   - Demographics: 5 census stats
   - Highlights: 6 cards
   - Neighborhoods: 8–12 cards
   - City stats: 5 SVG-icon stats
   - Listings: YLOPO `data-search` `city` param + the "View All" URL
   - HOA fees, Parks, Schools: as researched
   - Nearby communities: row order updated to reflect proximity
   - FAQ: 6–10 city-specific Q&As
   - Lifestyle bullets
6. **Update `CV_MAP_CONFIG`** at the bottom — center lng/lat, zoom levels,
   boundary polygon, 4–6 POIs (see MAPS.md for the polygon format)
7. **Update the valley-location inline script** — change `CURRENT_SLUG`
   to the new slug
8. **Update `sitemap.xml`** + `index.html`'s communities grid + the
   homepage `COMMUNITIES` array in `index.html` (boundary polygon
   duplicated there — keep in sync)
9. `git add . && git commit && git push` — Vercel auto-deploys

---

## How to Replicate the Whole Pattern on a New Site / New Market

This is the big one. The pattern is portable to any real estate market
with 4+ named submarkets. Here's the minimum work to ship it for a new
agent:

### Phase 1 — Strip + Rebrand

1. Copy `community.css`, `community-map.js`, **MAPS.md**, **COMMUNITIES.md** to the new project.
2. Pick a representative community HTML file (e.g. `palm-springs.html`) and copy it as your template.
3. Replace **brand tokens** in `community.css`: `--bronze`, `--cream*`, and the two font references in `--serif`/`--sans`.
4. Replace **agent strings** site-wide: name, brokerage, phone, email, CalDRE, contact address, social handles.
5. Replace **market strings** site-wide: "Coachella Valley" → new market name, "CV" → new abbreviation if any.

### Phase 2 — Map system

The map system is geo-agnostic — it just needs new coordinates.

6. **Pick your roads.** Replace I-10 and Hwy 111 waypoints in `community-map.js` with the freeway + commercial corridor in the new market (or remove the road layers entirely if the market doesn't have signature roads).
7. **Get boundary polygons.** For each city you'll cover, build a closed `[lng,lat]` polygon. Sources: OpenStreetMap → export, US Census TIGER shapefiles → convert with `mapshaper`, or hand-draw in `geojson.io` for approximate ones (good enough for visual purposes — these aren't legal boundaries).
8. **Pick POIs per city** — 4–6 named landmarks with `name`, `desc`, `lng`, `lat`, and an emoji icon.
9. Update the **homepage valley-overview map** (in `index.html`) — same boundary polygons, same road lines, but flat (`pitch: 0`) and zoomed out to fit all cities. Lay each city polygon as a clickable layer that navigates to its page.
10. Update the **per-page valley-location inline script** — same data, but highlight just the current city in yellow.

### Phase 3 — Content for each city page

For each city, gather:

- 3-paragraph overview (warm, locally-specific, no hype)
- 8 quick-facts (population, county, median price, elevation, etc.)
- 5 demographics stats (cite the Census ACS as source)
- 6 "what makes it special" highlights
- 8–12 neighborhoods with price ranges
- 5 city-stat trivia numbers
- HOA fee ranges + standard "what HOAs cover" bullets
- 3+ park cards with real addresses and amenities
- Public + private school lists (then add the zoning disclaimer)
- 6–10 FAQs written as the question buyers actually type into Google
- 5 lifestyle bullets

This is where the work actually lives. If you're building 6 city pages,
plan ~3–6 hours of research per city for genuinely authoritative content.
**Don't shortcut this.** The whole point of the page is depth — generic
content reads instantly as AI slop and fails both search and AEO.

### Phase 4 — Plumbing

11. Wire up the **YLOPO widget** (or whatever IDX provider the new agent uses — same pattern: a div with a JSON config attribute + a CDN script tag).
12. **Tracking pixels** — see commit `d34ac37` in this repo for the RAEK/OIR/MM block. Drop equivalents into the new site's `<head>`.
13. **Sanity CMS overrides** — decide whether to port them. If yes: new Sanity project, port `lib/sanity.ts` + `api/community.ts`, update the inline sync script's API endpoint. If no: delete the sync script block.
14. **Vercel deploy.** Static HTML, no build step needed. Push to GitHub, connect Vercel, done.

---

## What Holds Up Across Markets vs. What Breaks

**Holds up well** (use as-is):
- The 14-section page anatomy
- The CSS file structure and reveal animations
- The Mapbox Standard / night-preset visual treatment
- The FAQ accordion + Schools tabs JS
- The YLOPO widget integration pattern
- The footer structure and disclaimer placement
- The CMS-overlay-by-label sync pattern

**Needs market-specific work**:
- All road lines (`I-10`, `HWY111`) — only relevant to CV
- All city boundary polygons
- POI sets per city
- The "drive-time cards" (section 3) — destinations are CV-specific
- The Nearby Communities table — needs your actual neighboring cities
- The HOA fee ranges, school district names, park names — obviously
- The brand color palette and fonts

**Needs editorial work, not just copy/paste**:
- All editorial copy across all sections
- The FAQ — must match how *your* buyers in *your* market actually search
- The Lifestyle bullets — locally-specific events and attractions

---

## File Cross-Reference

| If you're touching… | Also check… |
|---|---|
| A new POI on the city map | `MAPS.md` (POI schema + how to add) |
| A boundary polygon change | `MAPS.md` (boundary format) + `index.html` (homepage map has a duplicate copy) |
| A new community page | `sitemap.xml`, `index.html` communities grid + COMMUNITIES array, all 9 existing community pages' nav dropdowns + footer Communities column |
| The Sanity stat sync logic | `api/community.ts`, `lib/sanity.ts`, `CLAUDE.md` (AI Content Assistant section) |
| The YLOPO widget config | `CLAUDE.md` (YLOPO Widget System section) |
| Tracking pixel changes | All 47 public HTML pages — use the same bulk-sed pattern from commit `d34ac37` |

---

## Maintenance Instructions

After every significant change to a community page, update this file to
reflect:
- New sections added or removed
- New CSS classes or design tokens
- Changes to the map system or `CV_MAP_CONFIG` schema
- New CMS sync behavior
- New tracking or analytics integrations
