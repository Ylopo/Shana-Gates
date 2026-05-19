/**
 * api/property-history.ts
 *
 * SSE-streamed property history research + branded PDF.
 * Pulls publicly available information about a property — construction,
 * ownership, permits/remodels, STR history, historic designation, notable
 * residents, and public-record events — and emails a branded PDF.
 *
 * Companion to api/property-report.ts (the investment analysis). This
 * endpoint runs independently when the visitor checks the History Report
 * option on /property-report.html.
 */

import { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'
import { tavily } from '@tavily/core'
import * as fs from 'fs'
import * as path from 'path'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ─── SSE helpers ────────────────────────────────────────────────────────────

function send(res: VercelResponse, data: object) {
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}

function step(res: VercelResponse, key: string, status: 'running' | 'done' | 'error', label: string, extra?: object) {
  send(res, { step: key, status, label, ...extra })
}

// ─── Claude helpers ──────────────────────────────────────────────────────────

async function extract(systemPrompt: string, userPrompt: string): Promise<string> {
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{ role: 'user', content: userPrompt }],
    system: systemPrompt,
  })
  const block = msg.content[0]
  return block.type === 'text' ? block.text : ''
}

function parseJson<T>(text: string, fallback: T): T {
  const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/)
  if (!match) return fallback
  try { return JSON.parse(match[0]) } catch { return fallback }
}

async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(7000) })
    if (!res.ok) return null
    const ct = res.headers.get('content-type') || ''
    if (!ct.startsWith('image/')) return null
    const buf = await res.arrayBuffer()
    return `data:${ct.split(';')[0]};base64,${Buffer.from(buf).toString('base64')}`
  } catch {
    return null
  }
}

// ─── Strict research system prompt ───────────────────────────────────────────
// Used by every analysis step. Drives Claude to only report what's explicitly
// present in the Tavily search context — no inference, no hallucination.

const RESEARCH_SYSTEM_PROMPT = `You are a property records researcher. You only report information that is explicitly present in the research context provided. If a fact is not present, return null or an empty array — never invent dates, names, prices, or events. Return ONLY valid JSON, no markdown.`

// ─── Step 1 — Discovery (parallel Tavily searches across all topics) ─────────

async function runDiscovery(address: string) {
  const tv = tavily({ apiKey: process.env.TAVILY_API_KEY || '' })

  // Parallel Tavily searches — one per research dimension.
  // includeImages on the first search to power the cover-page photo.
  const [propRes, constructRes, ownerRes, permitRes, strRes, historicRes, residentRes, eventsRes, newsRes] = await Promise.all([
    tv.search(`${address} property details year built architecture`, { maxResults: 5, includeImages: true }),
    tv.search(`${address} year built architect builder style original`, { maxResults: 5 }),
    tv.search(`${address} sale history sold price owner deed`, { maxResults: 6 }),
    tv.search(`${address} building permit remodel addition renovation`, { maxResults: 5 }),
    tv.search(`${address} airbnb vrbo vacation rental short term rental listing`, { maxResults: 4 }),
    tv.search(`${address} historic designation register modernism class 1 site`, { maxResults: 4 }),
    tv.search(`${address} celebrity famous owner resident former owner`, { maxResults: 4 }),
    tv.search(`${address} death fire incident police lawsuit news`, { maxResults: 4 }),
    tv.search(`${address} desert sun palm springs life feature article news`, { maxResults: 4 }),
  ])

  const propImageUrls: string[] = ((propRes as any).images || []).slice(0, 4)

  const join = (r: any) => (r?.results || []).map((x: any) => `${x.title}\n${x.content}\n${x.url || ''}`).join('\n\n')

  return {
    propContext: join(propRes),
    constructContext: join(constructRes),
    ownerContext: join(ownerRes),
    permitContext: join(permitRes),
    strContext: join(strRes),
    historicContext: join(historicRes),
    residentContext: join(residentRes),
    eventsContext: join(eventsRes),
    newsContext: join(newsRes),
    propImageUrls,
  }
}

// ─── Step 2 — Construction ────────────────────────────────────────────────────

async function analyzeConstruction(address: string, propContext: string, constructContext: string) {
  const raw = await extract(
    RESEARCH_SYSTEM_PROMPT,
    `Extract construction & architecture facts for: ${address}

Research Context (Property):
${propContext}

Research Context (Construction):
${constructContext}

Return JSON. If a field is unknown, return null.
{
  "year_built": "<4-digit year or null>",
  "architect": "<architect name or null>",
  "builder": "<builder name or null>",
  "architectural_style": "<style e.g. Mid-Century Modern, Spanish Revival, or null>",
  "original_sqft": "<number with commas or null>",
  "lot_size": "<size with units or null>",
  "stories": "<number or null>",
  "original_features": "<2-3 notable original features or null>",
  "summary": "<1-2 sentence narrative about the home's construction history; if no info, say 'Public construction records for this property were limited.'>"
}`
  )
  return parseJson(raw, { year_built: null, summary: 'Public construction records for this property were limited.' })
}

// ─── Step 3 — Ownership ──────────────────────────────────────────────────────

async function analyzeOwnership(address: string, ownerContext: string) {
  const raw = await extract(
    RESEARCH_SYSTEM_PROMPT,
    `Extract ownership & sale history for: ${address}

Research Context (Ownership):
${ownerContext}

Return JSON. Include only sales/owners explicitly mentioned in the context. If owner is an LLC or trust, label as such.
{
  "sales": [
    { "date": "<YYYY-MM or YYYY or null>", "price": "<$X,XXX,XXX or null>", "owner_or_buyer": "<name, LLC, Trust, or null>", "source": "<Zillow, Redfin, Realtor, news, county, or null>" }
  ],
  "total_known_sales": <integer>,
  "current_ownership_type": "<Individual | LLC | Trust | Unknown>",
  "longest_tenure": "<text e.g. '12 years (2008–2020)' or null>",
  "summary": "<1-2 sentence narrative about ownership pattern; if no records found, say 'Public ownership records for this property were limited.'>"
}`
  )
  return parseJson(raw, { sales: [], total_known_sales: 0, current_ownership_type: 'Unknown', summary: 'Public ownership records for this property were limited.' })
}

// ─── Step 4 — Permits & remodels ─────────────────────────────────────────────

async function analyzePermits(address: string, permitContext: string) {
  const raw = await extract(
    RESEARCH_SYSTEM_PROMPT,
    `Extract permit & renovation history for: ${address}

Research Context (Permits):
${permitContext}

Return JSON. Include only permits/remodels explicitly mentioned.
{
  "permits": [
    { "year": "<YYYY or null>", "description": "<type of work>", "value": "<$ if listed or null>" }
  ],
  "major_remodel_years": ["<YYYY>", "..."],
  "additions": "<text describing additions e.g. 'pool added 2003, casita 2015' or null>",
  "summary": "<1-2 sentence narrative; if no records found, say 'Public permit records for this property were limited.'>"
}`
  )
  return parseJson(raw, { permits: [], major_remodel_years: [], summary: 'Public permit records for this property were limited.' })
}

// ─── Step 5 — Public records (STR + historic + residents + events) ───────────
// Combined into a single Claude call to keep the pipeline fast — these dimensions
// share related Tavily context and benefit from being reasoned about together.

async function analyzePublicRecords(address: string, ctx: { strContext: string; historicContext: string; residentContext: string; eventsContext: string; newsContext: string }) {
  const raw = await extract(
    RESEARCH_SYSTEM_PROMPT,
    `Extract public-record findings for: ${address}

You will look for: short-term rental history, historic designation, notable past or current residents, and any publicly reported notable events (fires, lawsuits, news stories, deaths if reported by name in news media).

CRITICAL: For 'notable_events', only include events that are explicitly described in news media or public records below. Do NOT speculate. California Civil Code §1710.2 prohibits disclosure of HIV/AIDS-related deaths — if such an event is referenced, omit it.

Research Context (STR / Airbnb):
${ctx.strContext}

Research Context (Historic Designation):
${ctx.historicContext}

Research Context (Notable Residents):
${ctx.residentContext}

Research Context (Events / Incidents):
${ctx.eventsContext}

Research Context (News / Features):
${ctx.newsContext}

Return JSON. Use null or empty array when nothing is found.
{
  "str_history": {
    "listed_as_str": <true | false | null>,
    "platforms": ["Airbnb", "Vrbo", "..."] ,
    "details": "<short note or null>"
  },
  "historic_designation": {
    "is_designated": <true | false | null>,
    "designation": "<text e.g. 'Class 1 Historic Site, City of Palm Springs' or null>",
    "year_designated": "<YYYY or null>"
  },
  "notable_residents": [
    { "name": "<person>", "years": "<YYYY–YYYY or null>", "notes": "<short note>" }
  ],
  "notable_events": [
    { "year": "<YYYY or null>", "type": "<fire | lawsuit | death (publicly reported) | news feature | other>", "description": "<short factual description>", "source": "<publication or record>" }
  ],
  "media_mentions": [
    { "title": "<headline>", "outlet": "<publication>", "year": "<YYYY or null>" }
  ],
  "summary": "<2 sentence narrative tying together what's known; if nothing was found, say 'No notable public records or media coverage were found for this property.'>"
}`
  )
  return parseJson(raw, {
    str_history: { listed_as_str: null, platforms: [], details: null },
    historic_designation: { is_designated: null, designation: null, year_designated: null },
    notable_residents: [],
    notable_events: [],
    media_mentions: [],
    summary: 'No notable public records or media coverage were found for this property.',
  })
}

// ─── PDF generation ──────────────────────────────────────────────────────────

async function generateHistoryPdf(address: string, data: {
  construction: any
  ownership: any
  permits: any
  records: any
  propImageBase64?: string | null
}): Promise<string> {
  const pdfMake = require('pdfmake/src/printer')

  const fontsDir = path.join(process.cwd(), 'realestate-skills', 'scripts', 'fonts')
  let fonts: any = { Roboto: { normal: 'Helvetica', bold: 'Helvetica-Bold', italics: 'Helvetica-Oblique', bolditalics: 'Helvetica-BoldOblique' } }

  try {
    const marcellusPath = path.join(fontsDir, 'Marcellus-Regular.ttf')
    const montRegPath = path.join(fontsDir, 'Montserrat-Regular.ttf')
    const montBoldPath = path.join(fontsDir, 'Montserrat-SemiBold.ttf')
    const montLightPath = path.join(fontsDir, 'Montserrat-Light.ttf')

    if (fs.existsSync(marcellusPath)) {
      fonts = {
        Marcellus: {
          normal: fs.readFileSync(marcellusPath),
          bold: fs.readFileSync(marcellusPath),
        },
        Montserrat: {
          normal: fs.readFileSync(montRegPath),
          bold: fs.readFileSync(montBoldPath),
          italics: fs.readFileSync(montLightPath),
        },
      }
    }
  } catch (_) {}

  let shanaImageBase64: string | null = null
  try {
    const shanaPath = path.join(process.cwd(), 'images', 'shana-green-pdf.jpg')
    if (fs.existsSync(shanaPath)) {
      shanaImageBase64 = `data:image/jpeg;base64,${fs.readFileSync(shanaPath).toString('base64')}`
    }
  } catch (_) {}

  const useMarcellus = fonts.Marcellus !== undefined
  const serif = useMarcellus ? 'Marcellus' : 'Helvetica'
  const sans = useMarcellus ? 'Montserrat' : 'Helvetica'

  const DARK = '#131313'
  const BRONZE = '#B8975A'
  const CREAM = '#F2EDE4'
  const ROW_ALT = '#F5F0E8'

  const c = data.construction
  const o = data.ownership
  const p = data.permits
  const r = data.records

  // ── Ownership rows ─────────────────────────────────────────────────────────
  const salesRows = (o.sales || []).map((s: any, i: number) => [
    { text: s.date || '—', font: sans, fontSize: 9, color: DARK, fillColor: i % 2 === 1 ? ROW_ALT : '#FFFFFF', margin: [4, 6, 4, 6], border: [false, false, false, false] },
    { text: s.price || '—', font: sans, fontSize: 9, color: DARK, fillColor: i % 2 === 1 ? ROW_ALT : '#FFFFFF', margin: [4, 6, 4, 6], border: [false, false, false, false] },
    { text: s.owner_or_buyer || '—', font: sans, fontSize: 9, color: DARK, fillColor: i % 2 === 1 ? ROW_ALT : '#FFFFFF', margin: [4, 6, 4, 6], border: [false, false, false, false] },
    { text: s.source || '—', font: sans, fontSize: 8, color: '#777', fillColor: i % 2 === 1 ? ROW_ALT : '#FFFFFF', margin: [4, 6, 4, 6], border: [false, false, false, false] },
  ])
  if (salesRows.length === 0) {
    salesRows.push([
      { text: 'No public sale records found.', font: sans, fontSize: 9, color: '#777', italics: true, fillColor: '#FFFFFF', margin: [4, 6, 4, 6], border: [false, false, false, false], colSpan: 4 },
      {}, {}, {},
    ])
  }

  // ── Permit rows ────────────────────────────────────────────────────────────
  const permitRows = (p.permits || []).map((pm: any, i: number) => [
    { text: pm.year || '—', font: sans, fontSize: 9, color: DARK, fillColor: i % 2 === 1 ? ROW_ALT : '#FFFFFF', margin: [4, 6, 4, 6], border: [false, false, false, false] },
    { text: pm.description || '—', font: sans, fontSize: 9, color: DARK, fillColor: i % 2 === 1 ? ROW_ALT : '#FFFFFF', margin: [4, 6, 4, 6], border: [false, false, false, false] },
    { text: pm.value || '—', font: sans, fontSize: 9, color: DARK, fillColor: i % 2 === 1 ? ROW_ALT : '#FFFFFF', margin: [4, 6, 4, 6], border: [false, false, false, false] },
  ])
  if (permitRows.length === 0) {
    permitRows.push([
      { text: 'No public permit records found.', font: sans, fontSize: 9, color: '#777', italics: true, fillColor: '#FFFFFF', margin: [4, 6, 4, 6], border: [false, false, false, false], colSpan: 3 },
      {}, {},
    ])
  }

  // ── Notable events rows ────────────────────────────────────────────────────
  const eventRows = (r.notable_events || []).map((ev: any, i: number) => [
    { text: ev.year || '—', font: sans, fontSize: 9, color: DARK, fillColor: i % 2 === 1 ? ROW_ALT : '#FFFFFF', margin: [4, 6, 4, 6], border: [false, false, false, false] },
    { text: ev.type || '—', font: sans, fontSize: 9, color: DARK, fillColor: i % 2 === 1 ? ROW_ALT : '#FFFFFF', margin: [4, 6, 4, 6], border: [false, false, false, false] },
    { text: ev.description || '—', font: sans, fontSize: 9, color: DARK, fillColor: i % 2 === 1 ? ROW_ALT : '#FFFFFF', margin: [4, 6, 4, 6], border: [false, false, false, false] },
    { text: ev.source || '—', font: sans, fontSize: 8, color: '#777', fillColor: i % 2 === 1 ? ROW_ALT : '#FFFFFF', margin: [4, 6, 4, 6], border: [false, false, false, false] },
  ])

  // ── Notable residents rows ─────────────────────────────────────────────────
  const residentRows = (r.notable_residents || []).map((rs: any, i: number) => [
    { text: rs.name || '—', font: sans, fontSize: 9, color: DARK, bold: true, fillColor: i % 2 === 1 ? ROW_ALT : '#FFFFFF', margin: [4, 6, 4, 6], border: [false, false, false, false] },
    { text: rs.years || '—', font: sans, fontSize: 9, color: DARK, fillColor: i % 2 === 1 ? ROW_ALT : '#FFFFFF', margin: [4, 6, 4, 6], border: [false, false, false, false] },
    { text: rs.notes || '—', font: sans, fontSize: 9, color: DARK, fillColor: i % 2 === 1 ? ROW_ALT : '#FFFFFF', margin: [4, 6, 4, 6], border: [false, false, false, false] },
  ])

  const docImages: Record<string, string> = {}
  if (data.propImageBase64) docImages['property'] = data.propImageBase64
  if (shanaImageBase64) docImages['shana'] = shanaImageBase64

  const docDef: any = {
    pageSize: 'LETTER',
    pageMargins: [50, 60, 50, 50],
    defaultStyle: { font: sans, fontSize: 10, color: DARK },
    fonts,
    images: docImages,

    background: (currentPage: number, pageSize: any) => {
      if (currentPage === 1) {
        return { canvas: [{ type: 'rect', x: 0, y: 0, w: pageSize.width, h: pageSize.height, color: DARK }] }
      }
      return null
    },

    header: (currentPage: number) => {
      if (currentPage === 1) return null
      return {
        columns: [
          { text: 'PROPERTY HISTORY REPORT', font: serif, fontSize: 9, color: BRONZE, margin: [50, 20, 0, 0] },
          { text: 'Shana Gates  ·  Craft & Bauer | Real Broker  ·  760.232.4054', font: sans, fontSize: 8, color: '#888', alignment: 'right', margin: [0, 20, 50, 0] },
        ],
      }
    },

    footer: (currentPage: number, pageCount: number) => {
      if (currentPage === 1) return null
      return {
        columns: [
          { text: 'For informational purposes only. Compiled from public sources — accuracy not guaranteed.', font: sans, fontSize: 7, color: '#aaa', margin: [50, 10, 0, 0] },
          { text: `Page ${currentPage} of ${pageCount}`, font: sans, fontSize: 8, color: BRONZE, alignment: 'right', margin: [0, 10, 50, 0] },
        ],
      }
    },

    content: [
      // ── COVER PAGE ────────────────────────────────────────────────────────
      ...(data.propImageBase64 ? [{
        image: 'property',
        fit: [512, 172],
        alignment: 'center',
        margin: [0, 0, 0, 18],
      }] : []),

      {
        text: 'PROPERTY HISTORY REPORT',
        font: serif,
        fontSize: 11,
        color: BRONZE,
        letterSpacing: 3,
        alignment: 'center',
        margin: [0, data.propImageBase64 ? 0 : 32, 0, 4],
      },
      {
        canvas: [{ type: 'line', x1: 160, y1: 0, x2: 352, y2: 0, lineWidth: 0.5, lineColor: BRONZE }],
        margin: [0, 0, 0, 24],
      },
      {
        text: address,
        font: serif,
        fontSize: 22,
        color: CREAM,
        alignment: 'center',
        margin: [0, 0, 0, 8],
      },
      {
        text: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        font: sans,
        fontSize: 9,
        color: '#999',
        alignment: 'center',
        margin: [0, 0, 0, 40],
      },

      // Cover summary block
      {
        table: {
          widths: ['*'],
          body: [[{
            stack: [
              { text: 'AT A GLANCE', font: sans, fontSize: 8, color: BRONZE, bold: true, letterSpacing: 2, alignment: 'center', margin: [0, 20, 0, 14] },
              {
                columns: [
                  { stack: [
                    { text: 'YEAR BUILT', font: sans, fontSize: 7, color: '#888', alignment: 'center' },
                    { text: c.year_built || '—', font: serif, fontSize: 18, color: CREAM, alignment: 'center', margin: [0, 4, 0, 0] },
                  ]},
                  { stack: [
                    { text: 'ARCHITECTURE', font: sans, fontSize: 7, color: '#888', alignment: 'center' },
                    { text: c.architectural_style || '—', font: serif, fontSize: 14, color: CREAM, alignment: 'center', margin: [0, 4, 0, 0] },
                  ]},
                  { stack: [
                    { text: 'KNOWN SALES', font: sans, fontSize: 7, color: '#888', alignment: 'center' },
                    { text: String(o.total_known_sales ?? 0), font: serif, fontSize: 18, color: CREAM, alignment: 'center', margin: [0, 4, 0, 0] },
                  ]},
                  { stack: [
                    { text: 'HISTORIC?', font: sans, fontSize: 7, color: '#888', alignment: 'center' },
                    { text: r.historic_designation?.is_designated === true ? 'Yes' : r.historic_designation?.is_designated === false ? 'No' : '—', font: serif, fontSize: 18, color: r.historic_designation?.is_designated ? '#8ab8bf' : CREAM, alignment: 'center', margin: [0, 4, 0, 0] },
                  ]},
                ],
                margin: [0, 0, 0, 24],
              },
            ],
            fillColor: '#1a1a1a',
            border: [false, false, false, false],
          }]],
        },
        layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 },
        margin: [40, 0, 40, 40],
      },

      // Shana credit
      {
        columns: [
          { text: '', width: '*' },
          { canvas: [{ type: 'line', x1: 0, y1: 0, x2: shanaImageBase64 ? 236 : 172, y2: 0, lineWidth: 0.5, lineColor: BRONZE }], width: shanaImageBase64 ? 236 : 172 },
        ],
        margin: [0, 0, 0, 10],
      },
      {
        columns: [
          { text: '', width: '*' },
          ...(shanaImageBase64 ? [{ image: 'shana', fit: [56, 56], width: 56, margin: [0, 2, 14, 0] }] : []),
          {
            stack: [
              { text: 'Prepared by Shana Gates', font: serif, fontSize: 10, color: CREAM, margin: [0, 0, 0, 3] },
              { text: 'Craft & Bauer | Real Broker', font: sans, fontSize: 8, color: '#999', margin: [0, 0, 0, 2] },
              { text: 'shana@craftbauer.com  ·  760.232.4054', font: sans, fontSize: 8, color: '#888' },
            ],
            width: 172,
          },
        ],
        margin: [0, 0, 0, 20],
      },
      { text: 'Compiled from public sources. Accuracy not guaranteed. See disclaimer on final page.', font: sans, fontSize: 7, color: '#666', alignment: 'center' },

      // ── PAGE 2: CONSTRUCTION & ARCHITECTURE ───────────────────────────────
      { text: '', pageBreak: 'before' },
      { text: 'CONSTRUCTION & ARCHITECTURE', font: serif, fontSize: 14, color: DARK, margin: [0, 0, 0, 4] },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 512, y2: 0, lineWidth: 1, lineColor: BRONZE }], margin: [0, 0, 0, 20] },

      {
        table: {
          widths: ['auto', '*'],
          body: [
            [{ text: 'Year Built', font: sans, fontSize: 9, color: '#777', border: [false, false, false, false], margin: [0, 4, 16, 4] }, { text: c.year_built || '—', font: sans, fontSize: 10, color: DARK, bold: true, border: [false, false, false, false], margin: [0, 4, 0, 4] }],
            [{ text: 'Architect', font: sans, fontSize: 9, color: '#777', border: [false, false, false, false], margin: [0, 4, 16, 4] }, { text: c.architect || '—', font: sans, fontSize: 10, color: DARK, bold: true, border: [false, false, false, false], margin: [0, 4, 0, 4] }],
            [{ text: 'Builder', font: sans, fontSize: 9, color: '#777', border: [false, false, false, false], margin: [0, 4, 16, 4] }, { text: c.builder || '—', font: sans, fontSize: 10, color: DARK, bold: true, border: [false, false, false, false], margin: [0, 4, 0, 4] }],
            [{ text: 'Architectural Style', font: sans, fontSize: 9, color: '#777', border: [false, false, false, false], margin: [0, 4, 16, 4] }, { text: c.architectural_style || '—', font: sans, fontSize: 10, color: DARK, bold: true, border: [false, false, false, false], margin: [0, 4, 0, 4] }],
            [{ text: 'Original Square Feet', font: sans, fontSize: 9, color: '#777', border: [false, false, false, false], margin: [0, 4, 16, 4] }, { text: c.original_sqft || '—', font: sans, fontSize: 10, color: DARK, bold: true, border: [false, false, false, false], margin: [0, 4, 0, 4] }],
            [{ text: 'Lot Size', font: sans, fontSize: 9, color: '#777', border: [false, false, false, false], margin: [0, 4, 16, 4] }, { text: c.lot_size || '—', font: sans, fontSize: 10, color: DARK, bold: true, border: [false, false, false, false], margin: [0, 4, 0, 4] }],
            [{ text: 'Stories', font: sans, fontSize: 9, color: '#777', border: [false, false, false, false], margin: [0, 4, 16, 4] }, { text: c.stories || '—', font: sans, fontSize: 10, color: DARK, bold: true, border: [false, false, false, false], margin: [0, 4, 0, 4] }],
          ],
        },
        layout: { hLineWidth: () => 0.3, vLineWidth: () => 0, hLineColor: () => '#eee', paddingTop: () => 2, paddingBottom: () => 2 },
        margin: [0, 0, 0, 20],
      },

      { text: 'ORIGINAL FEATURES', font: sans, fontSize: 8, color: BRONZE, bold: true, margin: [0, 0, 0, 6] },
      { text: c.original_features || 'No original features documented in available records.', font: sans, fontSize: 10, color: DARK, margin: [0, 0, 0, 18] },

      { text: 'NARRATIVE', font: sans, fontSize: 8, color: BRONZE, bold: true, margin: [0, 0, 0, 6] },
      { text: c.summary || '', font: sans, fontSize: 10, color: '#444', italics: true, lineHeight: 1.5 },

      // ── PAGE 3: OWNERSHIP TIMELINE ─────────────────────────────────────────
      { text: '', pageBreak: 'before' },
      { text: 'OWNERSHIP TIMELINE', font: serif, fontSize: 14, color: DARK, margin: [0, 0, 0, 4] },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 512, y2: 0, lineWidth: 1, lineColor: BRONZE }], margin: [0, 0, 0, 20] },

      {
        columns: [
          { stack: [
            { text: 'TOTAL KNOWN SALES', font: sans, fontSize: 8, color: '#777' },
            { text: String(o.total_known_sales ?? 0), font: serif, fontSize: 22, color: DARK, margin: [0, 2, 0, 0] },
          ]},
          { stack: [
            { text: 'CURRENT OWNERSHIP', font: sans, fontSize: 8, color: '#777' },
            { text: o.current_ownership_type || '—', font: serif, fontSize: 16, color: DARK, margin: [0, 2, 0, 0] },
          ]},
          { stack: [
            { text: 'LONGEST TENURE', font: sans, fontSize: 8, color: '#777' },
            { text: o.longest_tenure || '—', font: serif, fontSize: 14, color: DARK, margin: [0, 2, 0, 0] },
          ]},
        ],
        margin: [0, 0, 0, 20],
      },

      { text: 'SALES HISTORY', font: sans, fontSize: 8, color: BRONZE, bold: true, margin: [0, 0, 0, 8] },
      {
        table: {
          widths: ['auto', 'auto', '*', 'auto'],
          body: [
            [
              { text: 'Date', font: sans, fontSize: 8, bold: true, color: CREAM, fillColor: DARK, margin: [4, 6, 4, 6], border: [false, false, false, false] },
              { text: 'Price', font: sans, fontSize: 8, bold: true, color: CREAM, fillColor: DARK, margin: [4, 6, 4, 6], border: [false, false, false, false] },
              { text: 'Owner / Buyer', font: sans, fontSize: 8, bold: true, color: CREAM, fillColor: DARK, margin: [4, 6, 4, 6], border: [false, false, false, false] },
              { text: 'Source', font: sans, fontSize: 8, bold: true, color: CREAM, fillColor: DARK, margin: [4, 6, 4, 6], border: [false, false, false, false] },
            ],
            ...salesRows,
          ],
        },
        layout: { hLineWidth: () => 0.3, vLineWidth: () => 0, hLineColor: () => '#ddd', paddingLeft: () => 4, paddingRight: () => 4 },
        margin: [0, 0, 0, 20],
      },

      { text: 'NARRATIVE', font: sans, fontSize: 8, color: BRONZE, bold: true, margin: [0, 0, 0, 6] },
      { text: o.summary || '', font: sans, fontSize: 10, color: '#444', italics: true, lineHeight: 1.5 },

      // ── PAGE 4: PERMITS & REMODELS ─────────────────────────────────────────
      { text: '', pageBreak: 'before' },
      { text: 'PERMITS & REMODELS', font: serif, fontSize: 14, color: DARK, margin: [0, 0, 0, 4] },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 512, y2: 0, lineWidth: 1, lineColor: BRONZE }], margin: [0, 0, 0, 20] },

      { text: 'PERMIT HISTORY', font: sans, fontSize: 8, color: BRONZE, bold: true, margin: [0, 0, 0, 8] },
      {
        table: {
          widths: ['auto', '*', 'auto'],
          body: [
            [
              { text: 'Year', font: sans, fontSize: 8, bold: true, color: CREAM, fillColor: DARK, margin: [4, 6, 4, 6], border: [false, false, false, false] },
              { text: 'Description', font: sans, fontSize: 8, bold: true, color: CREAM, fillColor: DARK, margin: [4, 6, 4, 6], border: [false, false, false, false] },
              { text: 'Value', font: sans, fontSize: 8, bold: true, color: CREAM, fillColor: DARK, margin: [4, 6, 4, 6], border: [false, false, false, false] },
            ],
            ...permitRows,
          ],
        },
        layout: { hLineWidth: () => 0.3, vLineWidth: () => 0, hLineColor: () => '#ddd', paddingLeft: () => 4, paddingRight: () => 4 },
        margin: [0, 0, 0, 20],
      },

      { text: 'MAJOR REMODEL YEARS', font: sans, fontSize: 8, color: BRONZE, bold: true, margin: [0, 0, 0, 6] },
      { text: (p.major_remodel_years || []).length > 0 ? (p.major_remodel_years || []).join(' · ') : 'None documented in public records.', font: sans, fontSize: 10, color: DARK, margin: [0, 0, 0, 16] },

      { text: 'ADDITIONS', font: sans, fontSize: 8, color: BRONZE, bold: true, margin: [0, 0, 0, 6] },
      { text: p.additions || 'None documented in public records.', font: sans, fontSize: 10, color: DARK, margin: [0, 0, 0, 18] },

      { text: 'NARRATIVE', font: sans, fontSize: 8, color: BRONZE, bold: true, margin: [0, 0, 0, 6] },
      { text: p.summary || '', font: sans, fontSize: 10, color: '#444', italics: true, lineHeight: 1.5 },

      // ── PAGE 5: PUBLIC RECORDS & NOTABLE EVENTS ────────────────────────────
      { text: '', pageBreak: 'before' },
      { text: 'PUBLIC RECORDS & NOTABLE EVENTS', font: serif, fontSize: 14, color: DARK, margin: [0, 0, 0, 4] },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 512, y2: 0, lineWidth: 1, lineColor: BRONZE }], margin: [0, 0, 0, 20] },

      // Short-term rental
      { text: 'SHORT-TERM RENTAL HISTORY', font: sans, fontSize: 8, color: BRONZE, bold: true, margin: [0, 0, 0, 6] },
      {
        columns: [
          { text: r.str_history?.listed_as_str === true ? 'Yes' : r.str_history?.listed_as_str === false ? 'No' : 'No records found', font: sans, fontSize: 11, bold: true, color: r.str_history?.listed_as_str ? '#1A444C' : DARK, width: 100 },
          { text: (r.str_history?.platforms || []).join(', ') || '—', font: sans, fontSize: 10, color: DARK, width: '*' },
        ],
        margin: [0, 0, 0, 4],
      },
      { text: r.str_history?.details || '', font: sans, fontSize: 9, color: '#666', italics: true, margin: [0, 0, 0, 16] },

      // Historic designation
      { text: 'HISTORIC DESIGNATION', font: sans, fontSize: 8, color: BRONZE, bold: true, margin: [0, 0, 0, 6] },
      {
        columns: [
          { text: r.historic_designation?.is_designated === true ? 'Designated' : r.historic_designation?.is_designated === false ? 'Not designated' : 'No records found', font: sans, fontSize: 11, bold: true, color: r.historic_designation?.is_designated ? '#1A444C' : DARK, width: 140 },
          { text: r.historic_designation?.designation || '—', font: sans, fontSize: 10, color: DARK, width: '*' },
        ],
        margin: [0, 0, 0, 4],
      },
      { text: r.historic_designation?.year_designated ? `Designated: ${r.historic_designation.year_designated}` : '', font: sans, fontSize: 9, color: '#666', italics: true, margin: [0, 0, 0, 16] },

      // Notable residents
      { text: 'NOTABLE RESIDENTS', font: sans, fontSize: 8, color: BRONZE, bold: true, margin: [0, 0, 0, 8] },
      ...(residentRows.length > 0 ? [{
        table: {
          widths: ['auto', 'auto', '*'],
          body: [
            [
              { text: 'Name', font: sans, fontSize: 8, bold: true, color: CREAM, fillColor: DARK, margin: [4, 6, 4, 6], border: [false, false, false, false] },
              { text: 'Years', font: sans, fontSize: 8, bold: true, color: CREAM, fillColor: DARK, margin: [4, 6, 4, 6], border: [false, false, false, false] },
              { text: 'Notes', font: sans, fontSize: 8, bold: true, color: CREAM, fillColor: DARK, margin: [4, 6, 4, 6], border: [false, false, false, false] },
            ],
            ...residentRows,
          ],
        },
        layout: { hLineWidth: () => 0.3, vLineWidth: () => 0, hLineColor: () => '#ddd', paddingLeft: () => 4, paddingRight: () => 4 },
        margin: [0, 0, 0, 16],
      }] : [{ text: 'No notable residents identified in public records.', font: sans, fontSize: 10, color: '#777', italics: true, margin: [0, 0, 0, 16] }]),

      // Notable events
      { text: 'NOTABLE EVENTS', font: sans, fontSize: 8, color: BRONZE, bold: true, margin: [0, 0, 0, 8] },
      ...(eventRows.length > 0 ? [{
        table: {
          widths: ['auto', 'auto', '*', 'auto'],
          body: [
            [
              { text: 'Year', font: sans, fontSize: 8, bold: true, color: CREAM, fillColor: DARK, margin: [4, 6, 4, 6], border: [false, false, false, false] },
              { text: 'Type', font: sans, fontSize: 8, bold: true, color: CREAM, fillColor: DARK, margin: [4, 6, 4, 6], border: [false, false, false, false] },
              { text: 'Description', font: sans, fontSize: 8, bold: true, color: CREAM, fillColor: DARK, margin: [4, 6, 4, 6], border: [false, false, false, false] },
              { text: 'Source', font: sans, fontSize: 8, bold: true, color: CREAM, fillColor: DARK, margin: [4, 6, 4, 6], border: [false, false, false, false] },
            ],
            ...eventRows,
          ],
        },
        layout: { hLineWidth: () => 0.3, vLineWidth: () => 0, hLineColor: () => '#ddd', paddingLeft: () => 4, paddingRight: () => 4 },
        margin: [0, 0, 0, 16],
      }] : [{ text: 'No notable events identified in public records.', font: sans, fontSize: 10, color: '#777', italics: true, margin: [0, 0, 0, 16] }]),

      // Summary
      { text: 'SUMMARY', font: sans, fontSize: 8, color: BRONZE, bold: true, margin: [0, 6, 0, 6] },
      { text: r.summary || '', font: sans, fontSize: 10, color: '#444', italics: true, lineHeight: 1.5, margin: [0, 0, 0, 20] },

      // Disclaimer block
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 512, y2: 0, lineWidth: 0.5, lineColor: '#ddd' }], margin: [0, 0, 0, 12] },
      { text: 'IMPORTANT DISCLAIMERS', font: sans, fontSize: 8, color: BRONZE, bold: true, margin: [0, 0, 0, 6] },
      {
        text: 'This report compiles information from publicly available sources including news media, real estate listings, and public records databases. Accuracy is not guaranteed. Absence of records does not mean an event did not occur. California Civil Code §1710.2 limits required seller disclosure of deaths at a property to the past three years and prohibits disclosure of deaths related to HIV/AIDS. The buyer is responsible for independently verifying any property history that materially affects a purchase decision. This document does not constitute legal, financial, or investment advice.\n\nNothing in this report should be construed as a basis for any housing decision that violates the Fair Housing Act or California Fair Employment and Housing Act. Shana Gates, Craft & Bauer | Real Broker, CalDRE #02224632.',
        font: sans,
        fontSize: 7,
        color: '#888',
        lineHeight: 1.55,
      },
    ],
  }

  return new Promise((resolve, reject) => {
    const printer = new pdfMake(fonts)
    const pdfDoc = printer.createPdfKitDocument(docDef, { fontLayoutCache: true })
    const chunks: Buffer[] = []
    pdfDoc.on('data', (chunk: Buffer) => chunks.push(chunk))
    pdfDoc.on('end', () => resolve(Buffer.concat(chunks).toString('base64')))
    pdfDoc.on('error', reject)
    pdfDoc.end()
  })
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { address } = req.body || {}
  if (!address || typeof address !== 'string' || address.trim().length < 5) {
    return res.status(400).json({ error: 'A valid property address is required.' })
  }

  const addr = address.trim()

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  let constructionData: any = {}
  let ownershipData: any = {}
  let permitsData: any = {}
  let recordsData: any = {}

  try {
    // Step 1: Discovery
    step(res, 'h_discovery', 'running', 'Searching public records…')
    const ctx = await runDiscovery(addr)

    const propImagePromise: Promise<string | null> = (async () => {
      for (const url of ctx.propImageUrls) {
        const b64 = await fetchImageAsBase64(url)
        if (b64) return b64
      }
      return null
    })()
    step(res, 'h_discovery', 'done', 'Public records collected')

    // Step 2: Construction
    step(res, 'h_construction', 'running', 'Reading construction history…')
    constructionData = await analyzeConstruction(addr, ctx.propContext, ctx.constructContext)
    step(res, 'h_construction', 'done', 'Construction history — complete')

    // Step 3: Ownership
    step(res, 'h_ownership', 'running', 'Tracing ownership timeline…')
    ownershipData = await analyzeOwnership(addr, ctx.ownerContext)
    step(res, 'h_ownership', 'done', 'Ownership timeline — complete')

    // Step 4: Permits
    step(res, 'h_permits', 'running', 'Pulling permits & remodels…')
    permitsData = await analyzePermits(addr, ctx.permitContext)
    step(res, 'h_permits', 'done', 'Permits & remodels — complete')

    // Step 5: Public records (STR + historic + residents + events)
    step(res, 'h_records', 'running', 'Compiling public records & events…')
    recordsData = await analyzePublicRecords(addr, {
      strContext: ctx.strContext,
      historicContext: ctx.historicContext,
      residentContext: ctx.residentContext,
      eventsContext: ctx.eventsContext,
      newsContext: ctx.newsContext,
    })
    step(res, 'h_records', 'done', 'Public records & events — complete')

    // Step 6: PDF
    step(res, 'h_pdf', 'running', 'Generating your history PDF…')
    const propImageBase64 = await propImagePromise
    const pdfBase64 = await generateHistoryPdf(addr, {
      construction: constructionData,
      ownership: ownershipData,
      permits: permitsData,
      records: recordsData,
      propImageBase64,
    })
    step(res, 'h_pdf', 'done', 'History report ready', { pdfBase64 })
    send(res, { step: 'complete' })

  } catch (err: any) {
    const msg = err?.message || 'Unexpected error'
    send(res, { step: 'error', message: msg })
  } finally {
    res.end()
  }
}
