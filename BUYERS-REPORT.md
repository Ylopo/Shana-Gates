# Buyers Analysis Report — Feature Specification

**Built for:** Shana Gates — Craft & Bauer | Real Broker  
**Live URL:** `https://shana-gates.vercel.app/property-report.html`  
**Purpose:** Public lead-gen tool — any buyer enters a property address and receives a full AI-generated investment analysis as a branded PDF delivered to their inbox. No login required.

---

## What It Does

A visitor enters any property address. The system:

1. Researches the property, comparable sales, and local market using Tavily
2. Runs 5 Claude analysis passes (comps, rental, neighborhood, investment, market)
3. Fetches a property photo from Tavily image results
4. Generates a 6-page branded PDF report using pdfmake server-side
5. Emails the PDF to the visitor via Resend
6. Sends a lead notification to the agent

The visitor watches a live checklist animate step-by-step while their report builds — no page reload, no waiting blind.

---

## Files

```
property-report.html          ← Public landing page (the full UI)
api/property-report.ts        ← SSE streaming analysis + PDF generation (maxDuration: 300)
api/property-report-send.ts   ← Email delivery endpoint (POST, lightweight)
images/shana-green-pdf.jpg    ← Agent headshot pre-resized for PDF (20KB, 320×320)
realestate-skills/scripts/fonts/
  Marcellus-Regular.ttf
  Montserrat-Regular.ttf
  Montserrat-SemiBold.ttf
  Montserrat-Light.ttf
```

---

## Landing Page — `property-report.html`

### Brand palette (Shana Gates version)
```css
--sg:        #1A444C   /* teal green — buttons, accents */
--sg-hover:  #255a65
--sg-dim:    rgba(26,68,76,0.14)
--sg-border: rgba(26,68,76,0.30)
/* Body background: var(--dark) = #131313 */
/* Headline accent: #4ade80 (bright green for "BUYERS") */
```

### Fonts
Loaded from Google Fonts CDN:
```html
Cormorant Garamond (serif headlines) + Jost (sans body)
```

### Page structure
Two-column idle layout (stacks to single column on mobile ≤800px):

**Left column** — value proposition
- Headline: "Residential Property / BUYERS Analysis Report"
- Sub-copy explaining the tool
- Checklist of 8 deliverables (teal circle checkmarks)

**Right column** — lead capture + agent CTA
- Address input + "Analyze This Property" button
- Agent photo (Shana Gates Green.jpeg, shown at full aspect ratio)
- "Ready to make a move?" CTA with phone + email buttons

### 4 UI states
| State | ID | Trigger |
|---|---|---|
| Idle | `#state-idle` | Page load / after restart |
| Analyzing | `#state-analyzing` | Address submitted |
| Done | `#state-done` | `complete` SSE event received |
| Error | `#state-error` | `error` SSE event received |

**Important:** states are shown/hidden with `style.display = 'block'` (not `''`) — setting `''` exposes the underlying `display: none` and causes a blank page.

### Two-phase email UX
The email address is NOT collected upfront. Instead:

1. Visitor enters address → analysis starts streaming
2. After step 1 (discovery) completes → email input slides in via CSS `max-height` transition
3. Visitor submits email while analysis continues in background
4. When both the PDF (from SSE `pdf` event) and email are ready → `POST /api/property-report-send`

This pattern keeps the friction low (no email gate before seeing value) and ensures the PDF is sent the instant both pieces are available.

```javascript
// Client captures PDF from SSE stream
let pdfBase64 = null
let userEmail = null

// Called when step=pdf, status=done arrives in the SSE stream
// pdfBase64 = evt.pdfBase64

// Called when visitor submits email form
// userEmail = input value

// When both are set, send immediately
async function sendReport() {
  await fetch('/api/property-report-send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: userEmail, pdfBase64, address })
  })
}
```

---

## Analysis API — `api/property-report.ts`

### Request
```
POST /api/property-report
Content-Type: application/json
{ "address": "123 Main St, Palm Springs, CA" }
```

### Response
`Content-Type: text/event-stream` — SSE via `fetch` + `response.body.getReader()` (not `EventSource`, which doesn't support POST).

### SSE event format
```json
{ "step": "comps", "status": "running", "label": "Pulling comparable sales…" }
{ "step": "comps", "status": "done",    "label": "Comparable sales — complete" }
{ "step": "pdf",   "status": "done",    "label": "PDF report ready", "pdfBase64": "..." }
{ "step": "complete" }
{ "step": "error",  "message": "..." }
```

### 7-step pipeline

| # | Step key | What happens |
|---|---|---|
| 1 | `discovery` | Tavily: 3 parallel searches (property details w/ images, comps, market). Property image URLs fetched in background. |
| 2 | `comps` | Claude extracts: listing price, beds/baths/sqft, 3–5 comps with price/sqft, comp avg, over/under vs comps |
| 3 | `rental` | Claude estimates: LTR monthly rent, STR optimistic, cap rate, cash-on-cash, GRM, full cashflow line items |
| 4 | `neighborhood` | Tavily neighborhood search + Claude scores: schools, safety, walkability, demographics, growth (0–100 each) |
| 5 | `investment` | Claude evaluates: best strategy (Buy & Hold / STR / Flip), 1/3/5yr ROI projections, Bull/Base/Bear scenarios |
| 6 | `market` | Claude analyzes: market type, median price, DOM, YoY trend, inventory months, absorption rate |
| 7 | `pdf` | pdfmake generates 6-page PDF (see PDF section below) |

### Composite score formula
```typescript
score = Math.round(
  comps.score       * 0.25 +
  rental.score      * 0.20 +
  neighborhood.score * 0.20 +
  investment.score   * 0.20 +
  market.score       * 0.15
)
```

### Grade / signal mapping
| Score | Grade | Signal |
|---|---|---|
| 85–100 | A+ | Strong Buy |
| 75–84 | A | Buy |
| 65–74 | B | Buy |
| 55–64 | C | Watch |
| 45–54 | D | Caution |
| 0–44 | F | Avoid |

### Vercel config required
```json
"api/property-report.ts": { "maxDuration": 300 }
```

---

## Email API — `api/property-report-send.ts`

```
POST /api/property-report-send
{ "email": "buyer@example.com", "pdfBase64": "...", "address": "123 Main St, ..." }
```

Sends two emails via Resend:
1. **To the buyer** — branded HTML email with PDF attached (`Property-Analysis-{address}.pdf`)
2. **To the agent** — plain lead notification with buyer email, address, and timestamp (PT timezone)

---

## PDF Report — pdfmake server-side

### Technical setup
```typescript
const pdfMake = require('pdfmake/src/printer')   // server-side printer, NOT /build/pdfmake
const printer = new pdfMake(fonts)
const pdfDoc = printer.createPdfKitDocument(docDef, { fontLayoutCache: true })
```

Fonts must be passed as Node.js `Buffer` objects (from `fs.readFileSync()`), **not** `.buffer` (ArrayBuffer) — pdfmake's printer rejects ArrayBuffer and silently falls back to Helvetica.

### Brand colors (Shana Gates version)
```typescript
DARK   = '#131313'   // page background (cover), table headers
ACCENT = '#C8C8C8'  // light gray   // section rules, accent labels, page numbers
CREAM  = '#F2EDE4'   // body text on dark backgrounds
PAGE_BG = '#FAFAF8'  // interior page background (default white)
ROW_ALT = '#F5F0E8'  // alternating table row fill
GREEN  = '#2E7D32'   // positive scores / Bull case
RED    = '#C62828'   // negative scores / Bear case
YELLOW = '#F9A825'   // mid-range scores
```

### Cover page (dark background)
The dark full-bleed background is applied via pdfmake's **`background` callback** — NOT via a canvas element in the content array. Canvas in content flow cannot use negative coordinates and gets clipped.

```typescript
background: (currentPage, pageSize) => {
  if (currentPage === 1) {
    return { canvas: [{ type: 'rect', x: 0, y: 0, w: pageSize.width, h: pageSize.height, color: DARK }] }
  }
  return null
}
```

Cover page sections (top → bottom):
1. **Property photo** (if Tavily returns one) — `fit: [512, 172]`, centered
2. "PROPERTY ANALYSIS REPORT" — Marcellus serif, light gray, letter-spaced
3. Horizontal rule
4. Address — large serif, cream
5. Date
6. Score gauge — large number + grade + signal in a dark-fill table
7. Category scores row — 5 columns (Value & Comps / Income / Neighborhood / Investment / Market)
8. Agent credit — horizontal rule + `shana-green-pdf.jpg` headshot + name/brokerage/contact

### Interior pages (pages 2–6)
| Page | Content |
|---|---|
| 2 | Property Overview (specs table) + Comparable Sales table |
| 3 | Cash Flow Analysis — key metrics + monthly cashflow projection table |
| 4 | Neighborhood Scorecard — progress bars + schools + amenities + growth drivers |
| 5 | Investment Analysis — strategy comparison table + market conditions |
| 6 | Recommendation — signal banner + scenario analysis (Bull/Base/Bear) + disclaimer |

Page breaks: `{ text: '', pageBreak: 'before' }` between each section.

Header on pages 2–6 (columns only — no canvas):
```typescript
header: (currentPage) => {
  if (currentPage === 1) return null
  return { columns: [
    { text: 'PROPERTY ANALYSIS REPORT', font: serif, fontSize: 9, color: ACCENT, margin: [50, 20, 0, 0] },
    { text: 'Agent Name  ·  Brokerage  ·  Phone', font: sans, fontSize: 8, color: '#888', alignment: 'right', margin: [0, 20, 50, 0] },
  ]}
}
```

**Important:** pdfmake silently drops the canvas if a header object contains both `columns` and `canvas`. Keep the header as `columns` only.

### Agent photo in the PDF
Pre-resize the agent's photo to ≤320×320 JPEG before committing to the repo:
```bash
python3 -c "
from PIL import Image
img = Image.open('images/agent-photo.jpg')
img = img.resize((320, 320), Image.LANCZOS)
img.save('images/agent-photo-pdf.jpg', 'JPEG', quality=82, optimize=True)
"
```
At 320×320 / quality 82, the output is ~20KB — safe to embed in an emailed PDF. The original 8.5MB source stays on the web for the HTML page.

### Property photo
Fetched live from Tavily image search during the discovery step. Up to 4 candidate URLs are tried in order; the first that returns a valid `image/*` content-type is base64-encoded and embedded. Graceful fallback: if no image is found, the cover page renders without a property photo and the title margin self-adjusts.

```typescript
// In runDiscovery():
tv.search(query, { maxResults: 5, includeImages: true })
// Response: propRes.images = string[]  (array of image URLs)

// In main handler — tries each URL until one succeeds:
for (const url of propImageUrls) {
  const b64 = await fetchImageAsBase64(url)
  if (b64) { propImageBase64 = b64; break }
}
```

---

## Environment Variables

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API (claude-sonnet-4-6) |
| `TAVILY_API_KEY` | Property research + image search |
| `RESEND_API_KEY` | Email delivery |
| `FROM_EMAIL` | Sender address (e.g. `agent@brokerage.com`) |

No auth, no Redis, no Sanity — this feature is entirely self-contained.

---

## Adapting for a New Client

### 1. Brand colors
Update these constants in `api/property-report.ts`:
```typescript
const DARK   = '#131313'   // cover page background
const ACCENT = '#C8C8C8'  // light gray   // accent color (rules, labels) — replace with brand accent
const CREAM  = '#F2EDE4'   // light text on dark bg
```

Update CSS variables in `property-report.html`:
```css
--sg:        #1A444C   /* primary brand color */
--sg-hover:  #255a65   /* hover state */
```

### 2. Agent photo
Replace `images/shana-green-pdf.jpg` with the new agent's photo (pre-resized to ≤320px, ≤50KB).

### 3. Contact info
In `api/property-report.ts`, update the disclaimer text and "Prepared by" credit on the cover:
```typescript
{ text: 'Prepared by [Agent Name]', ... }
{ text: '[Brokerage Name]', ... }
{ text: '[email]  ·  [phone]', ... }
```

In `api/property-report-send.ts`, update:
```typescript
from: process.env.FROM_EMAIL
to: 'agent@brokerage.com'   // lead notification recipient
```

In the HTML, update the CTA phone/email links.

### 4. Market geography
The page copy references "Coachella Valley" — update the eyebrow, sub-copy, and address placeholder for the new market:
```html
<p class="pr-eyebrow">Palm Beach County &nbsp;·&nbsp; AI Property Intelligence</p>
<input placeholder="123 Ocean Dr, West Palm Beach, FL" />
```

Tavily's searches are address-driven so no other change is needed — analysis adapts to whatever address is submitted.

### 5. Headline
```html
<!-- Current -->
<h1>Residential Property<br><em><span style="color:#4ade80">BUYERS</span> Analysis Report</em></h1>

<!-- Customize the accent color and label as needed -->
```

### 6. Disclaimer
Update the CalDRE license number at the bottom of the PDF and the footer of the email:
```typescript
{ text: 'DISCLAIMER: ... [Agent Name], [Brokerage], [License #].', ... }
```

---

## Local PDF Testing (Python — not Vercel)

`realestate-skills/scripts/generate_realestate_pdf.py` is a standalone Python/ReportLab script that generates the same report from a JSON data file. Use it for local testing without deploying.

```bash
# Run with a data file
python3 realestate-skills/scripts/generate_realestate_pdf.py property-data-4321-lumina.json

# Run with demo data (no args)
python3 realestate-skills/scripts/generate_realestate_pdf.py
# → outputs PROPERTY-REPORT-sample.pdf
```

The JSON schema matches the Claude extraction outputs. See `property-data-4321-lumina.json` for a complete working example.

---

## CLI Skills (Local Analysis — not Vercel)

The `realestate-skills/` folder contains 14 Claude Code skills for running analyses locally in the terminal. These are separate from the website feature — they output markdown files rather than PDFs.

| Skill | Purpose |
|---|---|
| `/realestate-analyze` | Full analysis orchestrator (5 parallel agents) |
| `/realestate-quick` | 60-second snapshot, no subagents |
| `/realestate-comps` | Comparable sales analysis |
| `/realestate-market` | Local market conditions |
| `/realestate-neighborhood` | Schools, crime, walkability scoring |
| `/realestate-invest` | Buy & Hold / BRRRR / Flip strategies |
| `/realestate-rental` | Rental income & cash flow model |
| `/realestate-flip` | Fix-and-flip analysis |
| `/realestate-commercial` | Commercial property (NOI, cap rate) |
| `/realestate-mortgage` | Mortgage calculator & affordability |
| `/realestate-screen` | Property screener by investment criteria |
| `/realestate-compare` | Side-by-side two-property comparison |
| `/realestate-listing` | MLS listing description generator |
| `/realestate-report-pdf` | Compiles saved analysis files into PDF |

---

## Known Issues & Notes

- **Tavily property images** — `includeImages: true` doesn't always return images for every address. The system tries up to 4 candidate URLs and degrades gracefully if none work. Coverage is best for properties listed on Zillow/Redfin/Realtor.com.
- **Analysis time** — typically 60–180 seconds depending on Claude API latency. The `maxDuration: 300` on Vercel provides sufficient headroom.
- **Email deliverability** — Resend requires a verified sending domain. The FROM_EMAIL domain must be verified in the Resend dashboard. Using the agent's own domain (e.g. `shana@craftbauer.com`) improves inbox placement vs. a generic sender.
- **PDF file size** — with property photo (~50–200KB fetched) + agent headshot (20KB) + fonts (Marcellus + Montserrat, ~200KB total), final PDF is typically 400–800KB — well within email attachment limits.
- **Fair housing** — this tool targets buyers and is for educational purposes only. The disclaimer at the bottom of every PDF and email makes this explicit. Do not use AI-generated neighborhood scores as a basis for any protected-class recommendations.
