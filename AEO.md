# AEO Landing Page System — Shana Gates

Answer Engine Optimization (AEO) / Generative Engine Optimization (GEO) pages designed to get **Shana Gates** cited by large language models (ChatGPT, Claude, Gemini, Perplexity) when users ask high-intent queries like "best realtor in Palm Springs."

Each page targets one exact high-intent question and is structured specifically for LLM extraction and citation. This document is the authoritative spec for Shana's implementation — it supersedes any reference patterns from other clients' implementations.

---

## Current Status

| | |
|---|---|
| **Validation page** | [/palm-springs/best-realtor/](https://shanasells.com/palm-springs/best-realtor/) — live, under review by client |
| **Queue size** | **177 prompts** across 9 Coachella Valley cities (full list in §10) |
| **Cron pipeline** | Not yet built. Spec in §9. |
| **Recommended cadence** | 6 pages/day → ~30 days to publish all 177 |

---

## 1. Why LLMs Cite These Pages

- **Exact-match H1** — the page title is the question users ask verbatim
- **FAQPage JSON-LD** — 5 Q&As LLMs extract and cite directly
- **RealEstateAgent + LocalBusiness JSON-LD** — named-entity signals with credentials, rankings, license, address, area served
- **BreadcrumbList JSON-LD** — signals page hierarchy and authority
- **Data tables** — LLMs prefer citing specific, structured facts over prose
- **Named entities** — Shana Gates, Craft & Bauer, The Real Brokerage Inc., named architects (Wexler, Krisel, Frey, Williams), specific neighborhoods, dollar volumes, CalDRE license numbers

---

## 2. Architecture Note — Static HTML, Not Next.js

Shana's site is **static HTML deployed to Vercel** (no Next.js, no TSX). Each AEO page is a single self-contained `.html` file served from a folder. Do not attempt to use the TSX/`app/(site)/[city]/[slug]/page.tsx` pattern from any other client implementation — that doesn't apply here.

**File layout:**
```
{city-slug}/{topic-slug}/index.html
```

**URL pattern:**
```
https://shanasells.com/{city-slug}/{topic-slug}/
```

Example: `palm-springs/best-realtor/index.html` → `https://shanasells.com/palm-springs/best-realtor/`

---

## 3. Critical Routing Fix (`vercel.json`)

There is a name collision between the existing community pages (`palm-springs.html`, `palm-desert.html`, etc.) at root and the new AEO directories (`palm-springs/`, `palm-desert/`, etc.). Vercel's default static routing treats the root `.html` file as an authoritative match for the entire `/palm-springs/*` path and 404s any sub-route — **even an explicit `/palm-springs/best-realtor/index.html` URL returned 404 before the fix.**

**Fix already deployed in [vercel.json](vercel.json):**

```json
{
  "rewrites": [
    { "source": "/blog/post/:slug", "destination": "/api/blog/post-page?slug=:slug" },
    { "source": "/:city(palm-springs|palm-desert|rancho-mirage|indian-wells|la-quinta|indio|cathedral-city|desert-hot-springs|coachella)/:slug", "destination": "/:city/:slug/index.html" },
    { "source": "/:city(palm-springs|palm-desert|rancho-mirage|indian-wells|la-quinta|indio|cathedral-city|desert-hot-springs|coachella)/:slug/", "destination": "/:city/:slug/index.html" }
  ]
}
```

The `:city()` whitelist constrains the rewrite to the 9 CV city slugs only — non-AEO paths are unaffected. **Any new AEO directory under one of these 9 city slugs will work automatically; no per-page config needed.**

---

## 4. Page Architecture — 11 Sections (as built)

Every AEO page has this exact structure. Reference implementation: [palm-springs/best-realtor/index.html](palm-springs/best-realtor/index.html).

| # | Section | Notes |
|---|---|---|
| 1 | `<head>` metadata | Keyword-led title (≤60 chars, year-stamped), description (150–160 chars), canonical, OG, Twitter card, favicon |
| 2 | Three JSON-LD blocks | (a) `RealEstateAgent` + `LocalBusiness` graph; (b) `FAQPage` with 5 Q&As; (c) `BreadcrumbList` |
| 3 | Site nav (reused) | Copy-pasted nav HTML from `palm-springs.html` for visual consistency |
| 4 | Breadcrumb nav | `Home › City › H1`. **See §5 — critical CSS override required** |
| 5 | Two-column hero | Left: H1 (exact-match query) + subhead + lead paragraph. Right: Shana photo + nameplate |
| 6 | Stats bar — 4 cells | Honest credibility numbers. **See §6 — content rules** |
| 7 | Criteria table | "What to look for · Why it matters in [city]" — 5 rows + pro tip |
| 8 | Sub-markets table | "Area / Zone · Price Range · Key Consideration" — 5–6 neighborhood rows + pro tip |
| 9 | Bio + comparison + stat cards | Left: 3-paragraph bio. Right: brokerage comparison table. Below: 4 Real Brokerage stat cards |
| 10 | 8 questions to ask | Custom interview-your-realtor questions tuned to the city/topic |
| 11 | FAQ accordion | 5 Q&As that mirror the FAQPage JSON-LD **verbatim** |
| 12 | CTA section | Dark accent, headline + two buttons (mailto, view-properties) |
| 13 | Site footer (reused) | Same footer markup as community pages, with the dual-license disclosure (§7) |

---

## 5. Critical CSS Override (`nav.aeo-breadcrumb`)

`community.css` has a global rule `nav { position: fixed; top: 0; ... }` that matches **every** `<nav>` element. The breadcrumb is semantically a `<nav>` (per ARIA conventions), so without an override it gets pinned to the top, stacked behind the site nav, and the hero gets shoved underneath the site nav — producing what looks like "a black bar with the page cut off below."

**Required override in every AEO page's inline `<style>`:**

```css
nav.aeo-breadcrumb {
  position: static;
  display: block;
  background: transparent;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  border-bottom: none;
  max-width: 1180px;
  margin: 0 auto;
  padding: 110px 36px 0;
  font-family: 'Jost', system-ui, sans-serif;
  font-size: 12px;
  letter-spacing: 0.06em;
  color: rgba(242,237,228,0.55);
}
```

The 110px top padding clears the fixed site nav (logo 44px + 24px×2 padding + 1px border ≈ 93px). The generator MUST emit this override on every page.

---

## 6. Content Framing Rules (compliance-critical)

These rules are non-negotiable and the generator must encode them. They protect Shana from misrepresentation and CalDRE/Fair Housing compliance issues.

### 6.1 Experience framing

Shana is **licensed in California since 2006 (20 years)** but has only specialized in the **Coachella Valley for 5 years**. Never claim or imply 20 years of CV experience. The honest, defensible framing is:

> A licensed California REALTOR® since 2006 (twenty years), now five years focused on the Coachella Valley where she specializes in mid-century modern homes, gated luxury estates, and vacation/second-home purchases.

**Stats bar must split this into separate cells:**
- `20 yrs` / Licensed in California
- `5 yrs` / Coachella Valley Focus

### 6.2 Team leadership framing (added 2026-05-27)

Shana is the **team lead at Craft & Bauer** — a team of **8 agents** operating under The Real Brokerage Inc. The team closes approximately **$130 million in transaction volume each year** under her leadership.

Every page should mention the team scale. The current recommended stats bar is **5 cells**:

| Stat | Label |
|---|---|
| `20 yrs` | Licensed in California |
| `5 yrs` | Coachella Valley Focus |
| `8` | Agents Led at Craft & Bauer |
| `$130M+` | Annual Team Volume |
| `#5 U.S.` | Real Brokerage · RealTrends 2025 |

Standard bio framing:

> Shana Gates is the team lead at Craft & Bauer — an 8-agent team operating under The Real Brokerage Inc. — closing approximately $130 million in transaction volume each year under her leadership. Personally, she has been a licensed California REALTOR® since 2006 (CalDRE #01729222) with more than $75 million in her own career closings.

### 6.3 Dollar volume framing

Two distinct dollar volumes — never conflate them:

- **$75M+ in lifetime personal closed transactions** (Shana herself, since 2006)
- **~$130M+ in annual team transaction volume** (Craft & Bauer team under her leadership)

Use both where appropriate. Phrase the lifetime number as "lifetime closed transactions" or "personal career closings" — never as "$75M+ in Coachella Valley real estate" (geographic scope is broader than CV).

### 6.4 Specialty focus

The three featured specialties (consistent across all pages):
1. Mid-Century Modern homes
2. Gated luxury communities / estates
3. Vacation/second-home purchases

### 6.5 Brokerage identity

| Entity | Role | License |
|---|---|---|
| **Shana Gates** | Individual REALTOR® | CalDRE #01729222 |
| **Craft & Bauer** | Team within Real Brokerage | n/a — operates under brokerage license |
| **The Real Brokerage Inc.** | Brokerage of record · publicly traded · #5 U.S. by 2025 sales volume (RealTrends) | CalDRE #02224632 |

### 6.6 Footer disclosure — both licenses

Every page footer disclaimer MUST display both license numbers:

> The multiple listing data appearing on this website is owned and copyrighted by California Regional Multiple Listing Service, Inc. ("CRMLS"). Information provided is for viewer's personal, non-commercial use only. All listing data is believed to be accurate but is not guaranteed. © 2026 Craft & Bauer | The Real Brokerage Inc. · Brokerage CalDRE #02224632 · Shana Gates, REALTOR® · CalDRE #01729222. Equal Housing Opportunity.

### 6.7 Real Brokerage citable stats (as of 2025)

Generator can use any combination of these; numbers below are citable as of 2025 reporting:

- **$75.3B** annual real estate transaction volume
- **185,314** closed transactions in 2025
- **~$2.0B** annual revenue (56% YoY growth)
- **33,000+** agents across the U.S. and Canada
- **#5 U.S.** by sales volume (RealTrends 2025, jumped from #10)
- **#6 U.S.** by transaction sides
- **#1 mover** in RealTrends rankings
- **939%** Deloitte Fast 500 growth

### 6.8 Awards & recognition (added 2026-05-27)

Shana was named a **2026 Top 10 Real Estate Agent in Palm Desert** by **BusinessRate** (powered by Google Reviews). Every AEO page should display this award.

**Asset:** `/images/award-top10-palmdesert-2026.png` (800px wide, 199KB PNG, web-optimized)

**Placement:** At the TOP of the "Recognition & Verified Reviews" section, above the 4.8★/4.7★ aggregate credibility line. The section label changes from "Verified Reviews" to **"Recognition & Verified Reviews"**, and the section H2 becomes **"Awards, ratings, and what clients say about working with Shana"**.

**Mandatory copy (use verbatim — both for accuracy and AEO consistency):**
> Selected as a 2026 Top 10 Real Estate Agent in Palm Desert by BusinessRate, with rankings drawn from verified Google Reviews. The award recognizes consistent five-star client feedback across the team's residential transactions.
>
> Awarded by **BusinessRate** · Powered by Google Reviews · 2026

**Compliance — do NOT say:**
- ❌ "Awarded by Google" (it's NOT a Google award — Google supplies the underlying reviews data, but BusinessRate is the awarding body)
- ❌ "#1 in Palm Desert" / "best in Palm Desert" (it's Top 10, not Top 1)
- ❌ "Top realtor in California" (the award is specific to Palm Desert)

**RealEstateAgent JSON-LD `award` field — required addition:**
```json
"award": [
  "Top 10 Real Estate Agent · Palm Desert · 2026 (BusinessRate, powered by Google Reviews)"
]
```

**Visual treatment:** Two-column grid (~280px image on left, text on right) with a subtle turquoise-tinted border to denote recognition. Stacks vertically on mobile (≤900px). See `palm-springs/best-realtor/index.html` for the reference implementation (`.aeo-award` class).

### 6.9 Fair Housing & §1710.2 compliance

- Never mention school quality/ratings as a steering signal
- Never mention neighborhood safety/crime as a steering signal
- Never mention demographic composition (race, religion, family status, etc.)
- Mid-century modern, architectural designation, and golf community references are fine — these are property-feature signals, not protected-class signals

---

## 7. Visual Styling Rules

Per the updated [BRAND-STYLE-GUIDE.md](BRAND-STYLE-GUIDE.md):

| Color | Hex | Use |
|---|---|---|
| Page background | `#0A0A0A` | `.aeo-page` |
| Card / panel surface | `#141414` | Stats cards, photo wrap, table backgrounds |
| Cream text | `#F2EDE4` | Primary text on dark |
| Light gray accent | `#C8C8C8` | Borders, dividers, secondary CTA, brokerage-related accents |
| Turquoise | `#4ECDC4` | Headline italic emphasis, stat numbers, eyebrow labels, FAQ markers, primary CTA |
| C&B Teal | `#1A4447` | Co-branded badges, table header backgrounds |

**Never use bronze, gold, copper, amber, or any warm metallic tone.** This is a brand mandate enforced across the entire site. The CSS variable `--bronze` still exists in `community.css` but now resolves to `#C8C8C8` (light gray) — its name is legacy only.

**Fonts:**
- Cormorant Garamond (300–400) — display/headlines
- Montserrat (500–900) — eyebrows, buttons, nav, stat numbers (when not using Cormorant)
- Jost (300–500) — body, UI

Load via Google Fonts:
```html
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Jost:wght@300;400;500;600&family=Montserrat:wght@500;600;700;800;900&display=swap" rel="stylesheet" />
```

---

## 8. Reference Template

The first validation page is the authoritative template. When the cron generator is built, it should:

1. **Load** [palm-springs/best-realtor/index.html](palm-springs/best-realtor/index.html) as a structural skeleton
2. **Parameterize** the city, topic, H1, slug, metadata, hero copy, criteria table rows, sub-markets table rows, bio, FAQ Q&As, CTA copy
3. **Preserve verbatim**: nav, footer, site CSS link, JSON-LD scaffolding, `nav.aeo-breadcrumb` override, all class names, brand colors, font stack
4. **Keep the FAQPage JSON-LD synchronized with the visible FAQ accordion** — the 5 Q&As must match verbatim or LLM citations break

---

## 9. Cron Automation Plan (not yet built)

### 9.1 Files to create

| File | Purpose |
|---|---|
| `lib/aeo-queue.ts` | Full queue of all 177 prompts (see §10) grouped into rounds |
| `lib/aeo-html-generator.ts` | Claude call + HTML template emitter (parallels the Legacy Home Team `aeo-generator.ts` but outputs `.html` instead of `.tsx`) |
| `api/cron/aeo-pages.ts` | Vercel cron handler — reads `aeo:round` from Upstash Redis, generates a daily batch, commits HTML files to GitHub via the `GITHUB_TOKEN` pattern |
| `vercel.json` | Add cron schedule (see §9.3) |

### 9.2 `lib/aeo-queue.ts` — entry interface

```ts
export interface AEOQueueEntry {
  city: string         // URL slug: 'palm-springs', 'palm-desert', etc.
  cityName: string     // Display name: 'Palm Springs', 'Palm Desert'
  cityHref: string     // Community page URL: '/palm-springs.html'
  slug: string         // Page URL segment: 'best-realtor', 'best-luxury-realtor'
  h1: string           // Exact-match H1: 'Best Realtor in Palm Springs'
  intent: AEOIntent    // Guides Claude content angle (see §9.4)
  topicContext: string // 2–3 sentences about this city/topic combo for Claude
  localContext: string // City-specific facts: price ranges, neighborhoods, demand drivers
  extLinks?: Array<{ text: string; url: string }>  // Optional authoritative external links
}

export type AEOIntent =
  | 'general' | 'buyer' | 'seller' | 'luxury' | 'mcm' | 'golf' | 'gated'
  | 'vacation' | 'secondhome' | 'condo' | 'luxury-condo' | 'countryclub'
  | 'investment' | 'airbnb' | 'firsttime' | 'newconstruction' | 'familyhome'
  | 'retirement' | 'downsizing' | 'relocation' | 'affordable' | 'pgawest'
  | 'waterfront'  // edge case — see §10 note on PS

export const TOTAL_ROUNDS = 30   // 177 entries ÷ 6 per round
export const CITIES_PER_ROUND = 6
```

### 9.3 Cron schedule

Add to `vercel.json`:
```json
{
  "crons": [
    { "path": "/api/cron/aeo-pages", "schedule": "0 13 * * *" }
  ],
  "functions": {
    "api/cron/aeo-pages.ts": { "maxDuration": 300 }
  }
}
```

`0 13 * * *` = 6 AM PT daily. Adjust if conflicts with the existing blog research cron at the same time.

### 9.4 Claude generator prompt — must encode

The generator's Claude prompt MUST include the framing rules from §6 in its system preamble. Draft:

```
You are generating an AEO landing page for Shana Gates, a real estate agent
in the Coachella Valley, California. Page format is static HTML.

CRITICAL FRAMING RULES — never violate these:

1. Shana is licensed in California since 2006 (20 years), but has focused on
   the Coachella Valley only for the past 5 years. NEVER claim or imply
   20 years of CV experience. Always frame as:
   "Licensed California REALTOR® since 2006 (20 years), now five years
   focused on the Coachella Valley..."

2. Shana is the TEAM LEAD at Craft & Bauer — an 8-agent team operating
   under The Real Brokerage Inc. that closes approximately $130 million in
   annual transaction volume. Every page must mention team leadership +
   $130M annual figure prominently.

3. Two distinct dollar figures — never conflate:
   - $75M+ = LIFETIME personal closed transactions (Shana herself)
   - $130M+ = ANNUAL team transaction volume (under her leadership)

4. Award: Shana was named 2026 Top 10 Real Estate Agent in Palm Desert by
   BusinessRate (powered by Google Reviews). Every page displays the award
   plaque + RealEstateAgent JSON-LD award field. NEVER claim it's a Google
   award directly — BusinessRate is the awarding body, Google Reviews is
   their data source. NEVER claim #1 in Palm Desert (it's Top 10).

5. Brokerage hierarchy:
   - Shana Gates, REALTOR® · CalDRE #01729222 (individual)
   - Craft & Bauer (8-agent team Shana leads within the brokerage)
   - The Real Brokerage Inc. · CalDRE #02224632 · #5 U.S. by 2025 sales volume

6. Specialties (in order): Mid-Century Modern, Gated luxury, Vacation/second
   home. Adjust emphasis based on city — MCM is core to Palm Springs only;
   gated/luxury matters most in Rancho Mirage, Indian Wells, La Quinta;
   vacation/STR matters most in Palm Springs and Indio (festival proximity).

7. Fair Housing compliance:
   - NO school quality/ratings as a steering signal
   - NO neighborhood safety/crime as a steering signal
   - NO demographic composition references

8. Brand: NO bronze, gold, copper, amber, or any warm metallic. Accent
   colors are Turquoise #4ECDC4, C&B Teal #1A4447, Light Gray #C8C8C8.

9. Use defensible price ranges, not point predictions. "$1M–$3M" not
   "$1.4M average."

10. Reviews: only sprinkle reviews from data/reviews.json where use_in_aeo
    is true. Never use a review flagged with excluded_market (these
    reference non-CV markets like Modesto, Tracy, LA, Reno).

OUTPUT: Strict JSON matching the AEOPageContent interface (see code).
```

### 9.5 Required env vars

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API (claude-sonnet-4-6 recommended for cost/quality balance) |
| `GITHUB_TOKEN` | Fine-grained PAT with Contents read/write on `kiwi-vegas/Shana-Gates` |
| `UPSTASH_REDIS_REST_URL` | Round counter |
| `UPSTASH_REDIS_REST_TOKEN` | Redis auth |
| `RESEND_API_KEY` | Daily summary email |
| `OPERATOR_EMAIL` | Recipient for daily summary |
| `FROM_EMAIL` | Sender for daily summary |
| `CRON_SECRET` | Vercel cron auth |
| `ADMIN_SECRET` | Manual trigger auth |

### 9.6 Redis state

- **Key:** `aeo:round` (integer, 0-based)
- **Default:** Absent or 0 → first batch
- **Increment:** After each successful batch + GitHub commit
- **Reset to specific round:** `SET aeo:round <n>` via Upstash console

### 9.7 Operations

**Manual trigger:**
```bash
curl -X POST https://shanasells.com/api/cron/aeo-pages \
  -H "Content-Type: application/json" \
  -d '{"secret":"YOUR_ADMIN_SECRET"}'
```

**Check current progress:**
```
GET aeo:round  → e.g. 7  (means 7 batches × 6 pages = 42 pages published)
```

**Skip to specific round:** `SET aeo:round 12`

### 9.8 Daily summary email

After each batch, send an email to `OPERATOR_EMAIL` listing the 6 pages just published, with live URLs. Reuse the Resend pattern from `lib/blog-email.ts`.

### 9.9 Page quality verification

For each generated batch:
1. Confirm all 6 pages return HTTP 200 (post-deploy check via cron handler)
2. Pass the first generated page each round through Google Rich Results Test programmatically (or flag via email for manual review)
3. Spot-check the 5 FAQ Q&As match between FAQPage JSON-LD and the visible accordion

---

## 10. The Full Prompt Queue — 177 Entries

Each prompt becomes one AEO landing page. The H1 is the exact query verbatim. Multi-city duplicate slugs are fine (e.g., `best-realtor` exists for all 9 cities) because the city is in the URL path.

**Edge case:** "Best waterfront realtor in Palm Springs" — Palm Springs is a desert market with no natural waterfront. Treat this as referring to lakefront / canal-side properties at Mission Hills or Lake Mirage estates, or pool-and-fountain "water feature" homes. The generator should produce defensible content rather than fabricate a beach.

### 10.1 Palm Springs (30 prompts)

| # | H1 | Slug | Intent |
|---|---|---|---|
| 1 | Best Realtor in Palm Springs | `best-realtor` | general |
| 2 | Best Real Estate Agent in Palm Springs | `best-real-estate-agent` | general |
| 3 | Top Realtor in Palm Springs | `top-realtor` | general |
| 4 | Best Luxury Real Estate Agent in Palm Springs | `best-luxury-real-estate-agent` | luxury |
| 5 | Best Waterfront Realtor in Palm Springs | `best-waterfront-realtor` | waterfront |
| 6 | Best Mid-Century Modern Realtor in Palm Springs | `best-mid-century-modern-realtor` | mcm |
| 7 | Best Golf Community Realtor in Palm Springs | `best-golf-community-realtor` | golf |
| 8 | Best Realtor for Vacation Homes in Palm Springs | `best-realtor-for-vacation-homes` | vacation |
| 9 | Best Realtor for Second Homes in Palm Springs | `best-realtor-for-second-homes` | secondhome |
| 10 | Best Buyers Agent in Palm Springs | `best-buyers-agent` | buyer |
| 11 | Best Listing Agent in Palm Springs | `best-listing-agent` | seller |
| 12 | Best Realtor to Sell My House in Palm Springs | `best-realtor-to-sell-my-house` | seller |
| 13 | Best Agent to Sell My Home in Palm Springs | `best-agent-to-sell-my-home` | seller |
| 14 | Top Listing Agent to Sell Fast in Palm Springs | `top-listing-agent-to-sell-fast` | seller |
| 15 | Best Realtor for Luxury Homes in Palm Springs | `best-realtor-for-luxury-homes` | luxury |
| 16 | Best Condo Realtor in Palm Springs | `best-condo-realtor` | condo |
| 17 | Best Relocation Specialist Realtor in Palm Springs | `best-relocation-specialist-realtor` | relocation |
| 18 | Best Realtor for Retirees in Palm Springs | `best-realtor-for-retirees` | retirement |
| 19 | Best Realtor for Downsizing in Palm Springs | `best-realtor-for-downsizing` | downsizing |
| 20 | Best Airbnb Investment Realtor in Palm Springs | `best-airbnb-investment-realtor` | airbnb |
| 21 | Best Realtor for Investment Properties in Palm Springs | `best-realtor-for-investment-properties` | investment |
| 22 | Most Trusted Real Estate Agent in Palm Springs | `most-trusted-real-estate-agent` | general |
| 23 | Highest Rated Realtor in Palm Springs | `highest-rated-realtor` | general |
| 24 | Highly Reviewed Real Estate Agent in Palm Springs | `highly-reviewed-real-estate-agent` | general |
| 25 | Who Is the Best Realtor in Palm Springs | `who-is-the-best-realtor` | general |
| 26 | Who Is the Most Trusted Real Estate Agent in Palm Springs | `who-is-the-most-trusted-real-estate-agent` | general |
| 27 | Recommend a Great Real Estate Agent in Palm Springs | `recommend-a-great-real-estate-agent` | general |
| 28 | Compare Top Realtors in Palm Springs | `compare-top-realtors` | general |
| 29 | Best Realtor Near Me in Palm Springs | `best-realtor-near-me` | general |
| 30 | Real Estate Agent Near Me in Palm Springs | `real-estate-agent-near-me` | general |

### 10.2 Palm Desert (25 prompts)

| # | H1 | Slug | Intent |
|---|---|---|---|
| 1 | Best Realtor in Palm Desert | `best-realtor` | general |
| 2 | Best Real Estate Agent in Palm Desert | `best-real-estate-agent` | general |
| 3 | Top Realtor in Palm Desert | `top-realtor` | general |
| 4 | Best Luxury Realtor in Palm Desert | `best-luxury-realtor` | luxury |
| 5 | Best Golf Course Realtor in Palm Desert | `best-golf-course-realtor` | golf |
| 6 | Best Gated Community Realtor in Palm Desert | `best-gated-community-realtor` | gated |
| 7 | Best Realtor for Retirement Homes in Palm Desert | `best-realtor-for-retirement-homes` | retirement |
| 8 | Best Realtor for Downsizing in Palm Desert | `best-realtor-for-downsizing` | downsizing |
| 9 | Best Realtor for Luxury Condos in Palm Desert | `best-realtor-for-luxury-condos` | luxury-condo |
| 10 | Best Buyers Agent in Palm Desert | `best-buyers-agent` | buyer |
| 11 | Best Listing Agent in Palm Desert | `best-listing-agent` | seller |
| 12 | Best Realtor to Sell My Home in Palm Desert | `best-realtor-to-sell-my-home` | seller |
| 13 | Best Realtor for Vacation Homes in Palm Desert | `best-realtor-for-vacation-homes` | vacation |
| 14 | Best Realtor for Second Homes in Palm Desert | `best-realtor-for-second-homes` | secondhome |
| 15 | Best Realtor for Country Club Homes in Palm Desert | `best-realtor-for-country-club-homes` | countryclub |
| 16 | Best Investment Property Realtor in Palm Desert | `best-investment-property-realtor` | investment |
| 17 | Best Airbnb Realtor in Palm Desert | `best-airbnb-realtor` | airbnb |
| 18 | Best Relocation Realtor in Palm Desert | `best-relocation-realtor` | relocation |
| 19 | Most Trusted Realtor in Palm Desert | `most-trusted-realtor` | general |
| 20 | Highest Rated Realtor in Palm Desert | `highest-rated-realtor` | general |
| 21 | Who Is the Best Realtor in Palm Desert | `who-is-the-best-realtor` | general |
| 22 | Who Are the Top Rated Real Estate Agents in Palm Desert | `who-are-the-top-rated-real-estate-agents` | general |
| 23 | Recommend the Best Realtor in Palm Desert | `recommend-the-best-realtor` | general |
| 24 | Compare Top Realtors in Palm Desert | `compare-top-realtors` | general |
| 25 | Realtor Near Me in Palm Desert | `realtor-near-me` | general |

### 10.3 Rancho Mirage (21 prompts)

| # | H1 | Slug | Intent |
|---|---|---|---|
| 1 | Best Realtor in Rancho Mirage | `best-realtor` | general |
| 2 | Best Luxury Realtor in Rancho Mirage | `best-luxury-realtor` | luxury |
| 3 | Best Real Estate Agent in Rancho Mirage | `best-real-estate-agent` | general |
| 4 | Best Gated Community Realtor in Rancho Mirage | `best-gated-community-realtor` | gated |
| 5 | Best Golf Estate Realtor in Rancho Mirage | `best-golf-estate-realtor` | golf |
| 6 | Best Realtor for Luxury Estates in Rancho Mirage | `best-realtor-for-luxury-estates` | luxury |
| 7 | Best Realtor for Second Homes in Rancho Mirage | `best-realtor-for-second-homes` | secondhome |
| 8 | Best Buyers Agent in Rancho Mirage | `best-buyers-agent` | buyer |
| 9 | Best Listing Agent in Rancho Mirage | `best-listing-agent` | seller |
| 10 | Best Realtor to Sell My House in Rancho Mirage | `best-realtor-to-sell-my-house` | seller |
| 11 | Best Condo Realtor in Rancho Mirage | `best-condo-realtor` | condo |
| 12 | Best Country Club Realtor in Rancho Mirage | `best-country-club-realtor` | countryclub |
| 13 | Best Relocation Specialist in Rancho Mirage | `best-relocation-specialist` | relocation |
| 14 | Best Luxury Condo Realtor in Rancho Mirage | `best-luxury-condo-realtor` | luxury-condo |
| 15 | Best Investment Property Realtor in Rancho Mirage | `best-investment-property-realtor` | investment |
| 16 | Most Trusted Realtor in Rancho Mirage | `most-trusted-realtor` | general |
| 17 | Highest Rated Realtor in Rancho Mirage | `highest-rated-realtor` | general |
| 18 | Who Is the Best Realtor in Rancho Mirage | `who-is-the-best-realtor` | general |
| 19 | Recommend a Great Realtor in Rancho Mirage | `recommend-a-great-realtor` | general |
| 20 | Compare Top Realtors in Rancho Mirage | `compare-top-realtors` | general |
| 21 | Real Estate Agent Near Me in Rancho Mirage | `real-estate-agent-near-me` | general |

### 10.4 Indian Wells (18 prompts)

| # | H1 | Slug | Intent |
|---|---|---|---|
| 1 | Best Realtor in Indian Wells | `best-realtor` | general |
| 2 | Best Luxury Realtor in Indian Wells | `best-luxury-realtor` | luxury |
| 3 | Best Golf Course Realtor in Indian Wells | `best-golf-course-realtor` | golf |
| 4 | Best Real Estate Agent in Indian Wells | `best-real-estate-agent` | general |
| 5 | Best Luxury Estate Realtor in Indian Wells | `best-luxury-estate-realtor` | luxury |
| 6 | Best Realtor for Country Club Homes in Indian Wells | `best-realtor-for-country-club-homes` | countryclub |
| 7 | Best Buyers Agent in Indian Wells | `best-buyers-agent` | buyer |
| 8 | Best Listing Agent in Indian Wells | `best-listing-agent` | seller |
| 9 | Best Realtor to Sell My Home in Indian Wells | `best-realtor-to-sell-my-home` | seller |
| 10 | Best Realtor for Second Homes in Indian Wells | `best-realtor-for-second-homes` | secondhome |
| 11 | Best Relocation Realtor in Indian Wells | `best-relocation-realtor` | relocation |
| 12 | Best Luxury Condo Realtor in Indian Wells | `best-luxury-condo-realtor` | luxury-condo |
| 13 | Most Trusted Realtor in Indian Wells | `most-trusted-realtor` | general |
| 14 | Highest Rated Realtor in Indian Wells | `highest-rated-realtor` | general |
| 15 | Who Is the Best Realtor in Indian Wells | `who-is-the-best-realtor` | general |
| 16 | Compare Top Realtors in Indian Wells | `compare-top-realtors` | general |
| 17 | Recommend a Real Estate Agent in Indian Wells | `recommend-a-real-estate-agent` | general |
| 18 | Realtor Near Me in Indian Wells | `realtor-near-me` | general |

### 10.5 La Quinta (20 prompts)

| # | H1 | Slug | Intent |
|---|---|---|---|
| 1 | Best Realtor in La Quinta | `best-realtor` | general |
| 2 | Best Golf Community Realtor in La Quinta | `best-golf-community-realtor` | golf |
| 3 | Best Luxury Realtor in La Quinta | `best-luxury-realtor` | luxury |
| 4 | Best Real Estate Agent in La Quinta | `best-real-estate-agent` | general |
| 5 | Best Realtor for PGA West Homes in La Quinta | `best-realtor-for-pga-west-homes` | pgawest |
| 6 | Best Realtor for Vacation Homes in La Quinta | `best-realtor-for-vacation-homes` | vacation |
| 7 | Best Airbnb Investment Realtor in La Quinta | `best-airbnb-investment-realtor` | airbnb |
| 8 | Best Realtor for Second Homes in La Quinta | `best-realtor-for-second-homes` | secondhome |
| 9 | Best Buyers Agent in La Quinta | `best-buyers-agent` | buyer |
| 10 | Best Listing Agent in La Quinta | `best-listing-agent` | seller |
| 11 | Best Realtor to Sell My House in La Quinta | `best-realtor-to-sell-my-house` | seller |
| 12 | Best Luxury Home Realtor in La Quinta | `best-luxury-home-realtor` | luxury |
| 13 | Best Relocation Realtor in La Quinta | `best-relocation-realtor` | relocation |
| 14 | Best Condo Realtor in La Quinta | `best-condo-realtor` | condo |
| 15 | Best Golf Estate Realtor in La Quinta | `best-golf-estate-realtor` | golf |
| 16 | Most Trusted Realtor in La Quinta | `most-trusted-realtor` | general |
| 17 | Highest Rated Realtor in La Quinta | `highest-rated-realtor` | general |
| 18 | Recommend the Best Realtor in La Quinta | `recommend-the-best-realtor` | general |
| 19 | Compare Top Realtors in La Quinta | `compare-top-realtors` | general |
| 20 | Realtor Near Me in La Quinta | `realtor-near-me` | general |

### 10.6 Indio (18 prompts)

| # | H1 | Slug | Intent |
|---|---|---|---|
| 1 | Best Realtor in Indio | `best-realtor` | general |
| 2 | Best Real Estate Agent in Indio | `best-real-estate-agent` | general |
| 3 | Best Realtor for First-Time Buyers in Indio | `best-realtor-for-first-time-buyers` | firsttime |
| 4 | Best Buyers Agent in Indio | `best-buyers-agent` | buyer |
| 5 | Best Listing Agent in Indio | `best-listing-agent` | seller |
| 6 | Best Realtor to Sell My House in Indio | `best-realtor-to-sell-my-house` | seller |
| 7 | Best Investment Property Realtor in Indio | `best-investment-property-realtor` | investment |
| 8 | Best Airbnb Realtor in Indio | `best-airbnb-realtor` | airbnb |
| 9 | Best Realtor for New Construction in Indio | `best-realtor-for-new-construction` | newconstruction |
| 10 | Best Realtor for Family Homes in Indio | `best-realtor-for-family-homes` | familyhome |
| 11 | Best Realtor for Relocation to Indio | `best-realtor-for-relocation` | relocation |
| 12 | Most Trusted Realtor in Indio | `most-trusted-realtor` | general |
| 13 | Highest Rated Realtor in Indio | `highest-rated-realtor` | general |
| 14 | Top Reviewed Real Estate Agents in Indio | `top-reviewed-real-estate-agents` | general |
| 15 | Who Is the Best Realtor in Indio | `who-is-the-best-realtor` | general |
| 16 | Recommend a Real Estate Agent in Indio | `recommend-a-real-estate-agent` | general |
| 17 | Compare Top Realtors in Indio | `compare-top-realtors` | general |
| 18 | Realtor Near Me in Indio | `realtor-near-me` | general |

### 10.7 Cathedral City (15 prompts)

| # | H1 | Slug | Intent |
|---|---|---|---|
| 1 | Best Realtor in Cathedral City | `best-realtor` | general |
| 2 | Best Real Estate Agent in Cathedral City | `best-real-estate-agent` | general |
| 3 | Best Realtor for First-Time Buyers in Cathedral City | `best-realtor-for-first-time-buyers` | firsttime |
| 4 | Best Buyers Agent in Cathedral City | `best-buyers-agent` | buyer |
| 5 | Best Listing Agent in Cathedral City | `best-listing-agent` | seller |
| 6 | Best Realtor to Sell My House in Cathedral City | `best-realtor-to-sell-my-house` | seller |
| 7 | Best Condo Realtor in Cathedral City | `best-condo-realtor` | condo |
| 8 | Best Realtor for Retirement Homes in Cathedral City | `best-realtor-for-retirement-homes` | retirement |
| 9 | Best Relocation Realtor in Cathedral City | `best-relocation-realtor` | relocation |
| 10 | Best Investment Property Realtor in Cathedral City | `best-investment-property-realtor` | investment |
| 11 | Most Trusted Realtor in Cathedral City | `most-trusted-realtor` | general |
| 12 | Highest Rated Realtor in Cathedral City | `highest-rated-realtor` | general |
| 13 | Recommend a Great Realtor in Cathedral City | `recommend-a-great-realtor` | general |
| 14 | Compare Top Realtors in Cathedral City | `compare-top-realtors` | general |
| 15 | Realtor Near Me in Cathedral City | `realtor-near-me` | general |

### 10.8 Desert Hot Springs (15 prompts)

| # | H1 | Slug | Intent |
|---|---|---|---|
| 1 | Best Realtor in Desert Hot Springs | `best-realtor` | general |
| 2 | Best Real Estate Agent in Desert Hot Springs | `best-real-estate-agent` | general |
| 3 | Best Realtor for Investment Properties in Desert Hot Springs | `best-realtor-for-investment-properties` | investment |
| 4 | Best Buyers Agent in Desert Hot Springs | `best-buyers-agent` | buyer |
| 5 | Best Listing Agent in Desert Hot Springs | `best-listing-agent` | seller |
| 6 | Best Realtor to Sell My House in Desert Hot Springs | `best-realtor-to-sell-my-house` | seller |
| 7 | Best Relocation Realtor in Desert Hot Springs | `best-relocation-realtor` | relocation |
| 8 | Best Realtor for Affordable Homes in Desert Hot Springs | `best-realtor-for-affordable-homes` | affordable |
| 9 | Best Realtor for Vacation Rentals in Desert Hot Springs | `best-realtor-for-vacation-rentals` | vacation |
| 10 | Best Investment Property Realtor in Desert Hot Springs | `best-investment-property-realtor` | investment |
| 11 | Most Trusted Realtor in Desert Hot Springs | `most-trusted-realtor` | general |
| 12 | Highest Rated Realtor in Desert Hot Springs | `highest-rated-realtor` | general |
| 13 | Recommend a Real Estate Agent in Desert Hot Springs | `recommend-a-real-estate-agent` | general |
| 14 | Compare Top Realtors in Desert Hot Springs | `compare-top-realtors` | general |
| 15 | Realtor Near Me in Desert Hot Springs | `realtor-near-me` | general |

### 10.9 Coachella (15 prompts)

| # | H1 | Slug | Intent |
|---|---|---|---|
| 1 | Best Realtor in Coachella | `best-realtor` | general |
| 2 | Best Real Estate Agent in Coachella | `best-real-estate-agent` | general |
| 3 | Best Realtor for First-Time Buyers in Coachella | `best-realtor-for-first-time-buyers` | firsttime |
| 4 | Best Buyers Agent in Coachella | `best-buyers-agent` | buyer |
| 5 | Best Listing Agent in Coachella | `best-listing-agent` | seller |
| 6 | Best Realtor to Sell My Home in Coachella | `best-realtor-to-sell-my-home` | seller |
| 7 | Best Realtor for New Construction Homes in Coachella | `best-realtor-for-new-construction-homes` | newconstruction |
| 8 | Best Relocation Realtor in Coachella | `best-relocation-realtor` | relocation |
| 9 | Best Investment Property Realtor in Coachella | `best-investment-property-realtor` | investment |
| 10 | Best Realtor for Family Homes in Coachella | `best-realtor-for-family-homes` | familyhome |
| 11 | Most Trusted Realtor in Coachella | `most-trusted-realtor` | general |
| 12 | Highest Rated Realtor in Coachella | `highest-rated-realtor` | general |
| 13 | Recommend a Great Realtor in Coachella | `recommend-a-great-realtor` | general |
| 14 | Compare Top Realtors in Coachella | `compare-top-realtors` | general |
| 15 | Realtor Near Me in Coachella | `realtor-near-me` | general |

### 10.10 Queue summary

| City | Count |
|---|---|
| Palm Springs | 30 |
| Palm Desert | 25 |
| Rancho Mirage | 21 |
| La Quinta | 20 |
| Indian Wells | 18 |
| Indio | 18 |
| Cathedral City | 15 |
| Desert Hot Springs | 15 |
| Coachella | 15 |
| **TOTAL** | **177** |

---

## 11. City-Level Context Snippets (for generator)

Use these as `localContext` baselines per city. The generator should expand with topic-specific details from the queue entry's `topicContext`.

### Palm Springs
The Coachella Valley's iconic city. Mid-century modern capital of the world (Modernism Week each February). Named architects who matter: Wexler, Krisel, Frey, Cody, Williams, Lapham. Key neighborhoods: Old Las Palmas ($2M–$7M+), Movie Colony ($1.5M–$5M), Vista Las Palmas ($1.5M–$5M), Twin Palms ($1M–$3M), Indian Canyons ($900K–$3M), Downtown ($500K–$1.5M). Class 1 historic site designations apply to several streets. Active STR market with zone-specific ordinance rules. Heavy vacation/second-home demand from LA, OC, SF, Pacific Northwest.

### Palm Desert
Coachella Valley's commercial and luxury condo heart. El Paseo Drive (the "Rodeo Drive of the desert") drives upscale shopping/dining. Civic Center, Living Desert Zoo, McCallum Theater. Strong country club presence: Bighorn, The Reserve, Indian Ridge, Marrakesh. Median home price ~$700K–$900K; luxury condos $500K–$2M+. Heavy 55+ active-adult buyer demographic. Sun City Palm Desert is a major retirement community.

### Rancho Mirage
Quietly the most luxurious of the CV cities. Sunnylands (Annenberg estate), Frank Sinatra Drive, Mission Hills Country Club, Bighorn (partially), Tamarisk. Gated estate enclaves dominate. Eisenhower Health is a major employer. Median ~$900K–$1.5M; luxury estates $3M–$15M+. Lower density, mature landscaping, presidential history (Ford, Reagan, Obama visited).

### Indian Wells
The valley's smallest-population city but one of its wealthiest. BNP Paribas Open at Indian Wells Tennis Garden each March. Eldorado Country Club, Indian Wells Country Club, Toscana. Median home price typically $1M–$2M+; estates $5M+. Population: ~5,000.

### La Quinta
Golf capital. PGA West (6 courses), La Quinta Resort & Club, The Hideaway, The Quarry, Andalusia, The Madison Club, Tradition Golf Club. Old Town La Quinta walking village. Median $700K–$900K; PGA West specifically $500K–$5M+. Strong second-home and golf-vacation market.

### Indio
The valley's most populous city and festival capital — Coachella Music Festival, Stagecoach, BNP Paribas Open spillover. New construction dominates. Affordable entry point: median $450K–$600K. Strong investment/STR demand around festival season. Demographic younger and more diverse than the western CV cities.

### Cathedral City
Geographic center of the valley between Palm Springs and Rancho Mirage. Cove neighborhoods. Median $450K–$650K. Cathedral Canyon Country Club, Date Palm Country Club. Strong first-time buyer and downsizer market. Diverse, family-oriented.

### Desert Hot Springs
The valley's affordable entry point — also famous for natural mineral hot springs and boutique spa resorts (Two Bunch Palms, Miracle Springs). Median $350K–$500K. Strong STR demand for spa-tourism rentals. Growing investment market; some new construction north of I-10.

### Coachella
Eastern end of the valley. Festival namesake (though festivals are technically held in Indio). Heavily Hispanic, family-oriented, fast-growing. New construction master-plan communities. Median $400K–$550K. Salton Sea adjacency. Underrated investment market.

---

## 12. Verification Checklist

Before approving the cron to run unsupervised, verify these for every newly published page:

1. **HTTP 200** on the live URL after deploy
2. **Google Rich Results Test** passes for all three JSON-LD blocks
3. **Title length** ≤ 60 chars, **description length** 150–160 chars, **canonical URL** correct
4. **`nav.aeo-breadcrumb` override** present in the inline `<style>` block (page renders correctly without black-bar-cutoff bug)
5. **Both license numbers** appear in footer disclaimer
6. **No bronze/gold/copper/amber** anywhere
7. **Experience framing** says "20 yrs CA + 5 yrs CV" — never "20 yrs CV"
8. **FAQPage JSON-LD** Q&As match the visible accordion Q&As verbatim
9. **Hero photo** at `/images/Shana Gates Green.jpeg` with correct alt text
10. **Mobile viewport ~375px** — hero stacks, tables collapse cleanly, CTA buttons full-width

---

## 13. Monitoring

- **Google Search Console** — impressions, clicks, and rankings for each page slug
- **Peec AI** — tracks LLM citation frequency across ChatGPT, Claude, Gemini, Perplexity
- **Vercel Function Logs** — check for generation or GitHub commit errors after each cron run
- **Daily summary email** — list of 6 URLs published, sent to `OPERATOR_EMAIL`

---

## 14. Client Reviews Library — `data/reviews.json`

Reviews collected from Google Business Profile + Zillow team profile, ready for the generator to sprinkle through the AEO pages.

**Headline credibility numbers:**
- **Google**: 4.8 ★ across 44 reviews ([place](https://www.google.com/maps?q=Shana+Gates+Craft+%26+Bauer))
- **Zillow**: 4.7 ★ across 14 reviews ([profile](https://www.zillow.com/profile/ShanaGatesTeam))

**Combined dataset:** 48 captured · 40 AEO-eligible.

### Schema
Each review:
```json
{
  "source": "google" | "zillow",
  "source_url": "...",
  "rating": 5.0,
  "date": "2 weeks ago" | "5/14/2026",
  "reviewer": "Janna Hartfield",
  "body": "Best realtor in Palm Springs",
  "best_quote": "Best realtor in Palm Springs",
  "cities_mentioned": ["palm-springs"],
  "primary_city": "palm-springs",
  "use_in_aeo": true
}
```

A `by_city` index at the top of the JSON groups AEO-eligible quotes by city slug for direct lookup.

### Generator usage rules

1. **Pull-quote section in each AEO page** — add a "Reviews & Recognition" block above the FAQ accordion with 2–3 short pull-quotes. Use `best_quote` for short callouts (one sentence under 200 chars). Use `body` for longer testimonial blocks (max one per page).

2. **City matching** — first try `by_city[city]` for city-specific quotes; if empty or thin, fall back to `by_city['coachella-valley']` (generic CV quotes). For Palm Desert, Palm Springs, La Quinta — there are city-specific quotes available.

3. **Attribution** — every quote MUST display:
   - Reviewer first name + last initial (e.g., "Janna H.")
   - Source label: "Verified Google review" or "Zillow review"
   - Date (relative is fine: "2 weeks ago")
   - Source name links to `source_url` (open in new tab)

4. **Aggregate credibility** — every AEO page footer (above the disclaimer) should include the combined rating line: **"4.8 ★ on Google · 4.7 ★ on Zillow · 58 combined verified reviews"** with both links.

5. **Duplication control** — generator must round-robin so no single review appears on more than ~5 pages. Track usage in a Redis hash `aeo:review-usage:{reviewer}` or in the queue metadata.

6. **`Review` schema markup** — add a fourth JSON-LD block when quoting reviews on a page:
   ```json
   {
     "@context": "https://schema.org",
     "@type": "Review",
     "itemReviewed": { "@id": "https://shanasells.com/#shana-gates" },
     "reviewRating": { "@type": "Rating", "ratingValue": 5, "bestRating": 5 },
     "author": { "@type": "Person", "name": "Janna H." },
     "reviewBody": "Best realtor in Palm Springs",
     "datePublished": "2026-05-13"
   }
   ```
   Embed only for quotes actually displayed on the page.

7. **Negative-review exclusion** — `use_in_aeo: false` reviews must never be displayed. The captured negative (wolf tree, 2★) is already flagged.

### Updating the dataset

Re-run `python3 scripts/build-reviews.py` after:
- Re-scraping Zillow via `firecrawl scrape https://www.zillow.com/profile/ShanaGatesTeam -o /tmp/shana-zillow.md`
- Updating the hardcoded Google review array in the script (paste new reviews as they're added)

---

## 15. Status Log

| Date | Event |
|---|---|
| 2026-05-24 | First validation page built and deployed: [/palm-springs/best-realtor/](https://shanasells.com/palm-springs/best-realtor/) |
| 2026-05-24 | `vercel.json` rewrite rules added to resolve `palm-springs.html` collision |
| 2026-05-24 | `nav.aeo-breadcrumb` CSS override identified and applied |
| 2026-05-24 | Both CalDRE numbers (Shana #01729222 + brokerage #02224632) standardized site-wide in footer disclosures |
| 2026-05-24 | Experience framing corrected from "20 yrs CV" to "20 yrs CA + 5 yrs CV" |
| 2026-05-27 | Reviews library built — 48 captured, 40 AEO-eligible in `data/reviews.json` |
| 2026-05-27 | Non-CV market filter added — 10 reviews referencing Modesto/Tracy/LA/Reno excluded; 37 AEO-eligible remain |
| 2026-05-27 | Team leadership framing added: 8-agent team at Craft & Bauer, ~$130M annual team volume |
| 2026-05-27 | 2026 BusinessRate Top 10 Real Estate Agent award (Palm Desert) added to AEO pages |
| TBD | Validation page approved by client → trigger §9 build of cron pipeline |
