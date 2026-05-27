# Property History Report — Feature Specification

**Built for:** Shana Gates — Craft & Bauer | Real Broker
**Live URL:** `https://shanasells.com/property-report.html` (shared page; second checkbox)
**Purpose:** Public lead-gen tool — visitor enters a property address and can request a *Property History Report* as an optional second PDF alongside the existing Buyers Analysis Report. Designed for a buyer on the way to view a property who wants quick public-record context first.

---

## What It Does

The visitor checks "Property History Report" on `/property-report.html` (alongside or instead of the Buyers Analysis Report) and the system:

1. Runs 9 parallel Tavily searches against the address — property facts, construction, ownership, permits, STR listings, historic designation, notable residents, public-record events, and news mentions
2. Pulls the property image URLs from the first search (same fallback chain as the buyers report)
3. Runs 4 Claude Sonnet extractions: construction, ownership, permits, public records (STR + historic + residents + events combined into one call)
4. Generates a 5-page branded PDF using pdfmake
5. Emails the PDF to the visitor via Resend — either alone or as a second attachment alongside the Buyers Analysis PDF if both were requested
6. Notifies Shana of the lead (subject line indicates which reports were requested)

The visitor watches the same animated checklist as the buyers report — when both reports are requested, the two pipelines run in parallel and both step groups light up under section labels.

---

## Files

```
api/property-history.ts        ← SSE pipeline + PDF generation (maxDuration: 300)
api/property-report-send.ts    ← Shared email endpoint (now accepts both PDFs)
property-report.html           ← Shared landing page (second checkbox added)
images/shana-green-pdf.jpg     ← Agent headshot (same image used by both reports)
realestate-skills/scripts/fonts/
  Marcellus-Regular.ttf
  Montserrat-Regular.ttf
  Montserrat-SemiBold.ttf
  Montserrat-Light.ttf
```

No new dependencies. Reuses Tavily, Anthropic, pdfmake, Resend, and the agent photo from the existing buyers-report stack.

---

## UI — `property-report.html`

### Report picker (above the address input)

```
[✓] Buyers Analysis Report       — default checked
[ ] Property History Report      — default unchecked
```

- At least one must be checked. Unchecking the last one re-checks it automatically.
- "Generate My Report" button label is shared. The text on the left-column checklist describes both reports.
- The headline reads "Residential Property **BUYERS** Reports" (plural) to cover both.

### Step list (dynamic)

The animated step list shows:
- Only the **Buyers Analysis** steps (7) when only that report is checked
- Only the **Property History** steps (6) when only that report is checked
- Both groups under section labels when both are checked — the two pipelines run in parallel via `Promise.all([…])`
- A shared **"Sending to your inbox"** step appears at the end regardless

The progress bar fills based on the total active step count across both pipelines.

### Email capture flow

Identical to the buyers report — the email-capture box slides in after the first `discovery` or `h_discovery` step completes. The send fires when:
- All PDFs from selected reports are captured (`analysisPdfBase64`, `historyPdfBase64`), AND
- The user has submitted their email

If the user submits their email before the PDFs arrive, the send waits. If the PDFs arrive before the email is submitted, the send waits.

---

## Analysis API — `api/property-history.ts`

### Request
```
POST /api/property-history
Content-Type: application/json
{ "address": "123 Main St, Palm Springs, CA" }
```

### Response
`Content-Type: text/event-stream` — same SSE format as the buyers report.

### SSE event format
```json
{ "step": "h_construction", "status": "running", "label": "Reading construction history…" }
{ "step": "h_construction", "status": "done",    "label": "Construction history — complete" }
{ "step": "h_pdf",          "status": "done",    "label": "History report ready", "pdfBase64": "..." }
{ "step": "complete" }
{ "step": "error",  "message": "..." }
```

Step keys are prefixed `h_` to avoid collisions with the buyers-report pipeline when both run simultaneously into the same client step list.

### 6-step pipeline

| # | Step key         | What happens |
|---|------------------|--------------|
| 1 | `h_discovery`    | 9 parallel Tavily searches — property, construction, ownership, permits, STR, historic, residents, events, news. Property image URLs collected for cover. |
| 2 | `h_construction` | Claude extracts: year built, architect, builder, style, original sqft, lot size, stories, original features, narrative |
| 3 | `h_ownership`    | Claude extracts: sales (date/price/owner/source), total known sales, current ownership type (LLC/Trust/Individual), longest tenure, narrative |
| 4 | `h_permits`      | Claude extracts: permits (year/description/value), major remodel years, additions, narrative |
| 5 | `h_records`      | Claude extracts (combined call): STR history, historic designation, notable residents, notable events, media mentions, summary |
| 6 | `h_pdf`          | pdfmake generates 5-page PDF |

### Research system prompt

```
You are a property records researcher. You only report information that is
explicitly present in the research context provided. If a fact is not present,
return null or an empty array — never invent dates, names, prices, or events.
Return ONLY valid JSON, no markdown.
```

Each Claude call returns strict JSON with explicit `null` fallbacks. The PDF renders "—" or "No public records found." rather than hallucinated content when fields come back empty.

### Notable events — Fair Housing & §1710.2 compliance

The `h_records` system instructions explicitly tell Claude:
- Only include events explicitly described in the research context
- California Civil Code §1710.2 prohibits disclosure of HIV/AIDS-related deaths — omit any such reference
- A prominent disclaimer appears on the final PDF page noting that accuracy is not guaranteed, absence of records does not mean nothing occurred, and the buyer must independently verify

### Vercel config

```json
"api/property-history.ts": { "maxDuration": 300 }
```

---

## Email API — `api/property-report-send.ts` (shared, extended)

### Updated request shape
```
POST /api/property-report-send
{
  "email": "buyer@example.com",
  "pdfBase64": "...",            // optional — analysis PDF (omit if history-only)
  "historyPdfBase64": "...",     // optional — history PDF (omit if analysis-only)
  "address": "123 Main St, ..."
}
```

At least one of `pdfBase64` / `historyPdfBase64` must be present. The endpoint attaches each provided PDF as a separate file:
- `Property-Analysis-{shortAddr}.pdf`
- `Property-History-{shortAddr}.pdf`

The subject line + email body copy adapt to which reports were attached. The lead notification to Shana indicates which report combination was requested ("Analysis", "History", or "Analysis + History").

---

## PDF Report — pdfmake, 5 pages

Same brand system as the buyers report (Marcellus + Montserrat, dark cover, light gray rules, cream text on dark). No scoring/grading — this is a fact-compilation document, not an evaluation.

### Brand colors
```typescript
DARK   = '#131313'
ACCENT = '#C8C8C8'  // light gray
CREAM  = '#F2EDE4'
ROW_ALT = '#F5F0E8'
```

### Cover page (dark background)
- Property photo (Tavily; same fallback chain as buyers report)
- "PROPERTY HISTORY REPORT" eyebrow (light gray, letter-spaced serif)
- Address (large serif, cream)
- Date
- "At a Glance" block: Year Built · Architecture · Known Sales · Historic (Yes/No)
- Shana credit block (rule + headshot + name/brokerage/contact)
- "Compiled from public sources. Accuracy not guaranteed." note

### Interior pages

| Page | Content |
|---|---|
| 2 | Construction & Architecture — facts table, original features, narrative |
| 3 | Ownership Timeline — 3-column summary (total sales / current type / longest tenure), sales table, narrative |
| 4 | Permits & Remodels — permits table, major remodel years, additions, narrative |
| 5 | Public Records & Notable Events — STR row, historic designation row, notable residents table, notable events table, summary, prominent disclaimer block |

Page header on pages 2–5:
```
PROPERTY HISTORY REPORT                 Shana Gates · Craft & Bauer | Real Broker · 760.232.4054
```

Page footer:
```
For informational purposes only. Compiled from public sources — accuracy not guaranteed.        Page X of N
```

### Disclaimer block (bottom of page 5)

Full text rendered at 7pt:

> This report compiles information from publicly available sources including news media, real estate listings, and public records databases. Accuracy is not guaranteed. Absence of records does not mean an event did not occur. California Civil Code §1710.2 limits required seller disclosure of deaths at a property to the past three years and prohibits disclosure of deaths related to HIV/AIDS. The buyer is responsible for independently verifying any property history that materially affects a purchase decision. This document does not constitute legal, financial, or investment advice.
>
> Nothing in this report should be construed as a basis for any housing decision that violates the Fair Housing Act or California Fair Employment and Housing Act. Shana Gates, REALTOR® · CalDRE #01729222 · Craft & Bauer | The Real Brokerage Inc. · Brokerage CalDRE #02224632.

---

## Environment Variables

No new env vars. Reuses:

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API (claude-sonnet-4-6) |
| `TAVILY_API_KEY` | Property research + image search |
| `RESEND_API_KEY` | Email delivery |
| `FROM_EMAIL` | Sender address |

---

## Research Quality Notes

- **Best for Coachella Valley mid-century / architectural homes** — Palm Springs has unusually rich public sourcing (Modernism Week, Class 1 site list, named architects: Wexler, Krisel, Frey, Cody, Lapham, Williams). The pipeline will surface architect, designation, and notable residents for these properties.
- **Modest tract homes return sparse data** — the PDF will say so explicitly rather than padding. "No public construction records found." is preferable to invented facts.
- **No paid public-record APIs** — Riverside County assessor data isn't directly scrapeable by Tavily. The pipeline relies on Zillow / Redfin / Realtor.com sale-history tabs, news articles, and any source Tavily surfaces. The composite of these is enough for most CV properties.
- **Claude is constrained against hallucination** by the strict system prompt ("only report what's explicitly present") and JSON schema defaults to `null` when unknown.

---

## Verification

1. **End-to-end (history only):**
   - Open `/property-report.html`
   - Uncheck "Buyers Analysis Report", check "Property History Report"
   - Enter a known Palm Springs property (e.g. a Frank Sinatra estate or named architect home)
   - Submit email when the box slides in
   - Confirm the email lands with `Property-History-*.pdf` as a single attachment

2. **End-to-end (both):**
   - Same flow, both boxes checked
   - Both step groups should animate under their section labels
   - Email should contain *both* PDFs as separate attachments

3. **End-to-end (analysis only — regression):**
   - Default state (only analysis checked) should behave identically to the previous version

4. **Empty-property test:**
   - Enter a generic tract address with no public history
   - Confirm the PDF renders all sections with "No public records found" / "—" rather than fabricated data

5. **Error path:**
   - If `/api/property-history` returns an error mid-stream, the global error state appears and the user is offered a retry

---

## Adapting for a New Client

All adaptation work for this report mirrors the buyers report — see the `BUYERS-REPORT.md` "Adapting for a New Client" section. Specifically:

- Brand colors in `api/property-history.ts` (`DARK`, `ACCENT`, `CREAM`)
- Agent photo at `images/shana-green-pdf.jpg`
- Contact info in cover-page credit block + page header + email footer
- Market geography is address-driven — Tavily adapts to whatever address is submitted; no code change needed for a new market
- §1710.2 reference in the disclaimer is California-specific — adjust for the operating jurisdiction
