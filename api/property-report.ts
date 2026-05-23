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

// ─── Research step ───────────────────────────────────────────────────────────

async function runDiscovery(address: string) {
  const tv = tavily({ apiKey: process.env.TAVILY_API_KEY || '' })
  const [propRes, compRes, mktRes] = await Promise.all([
    tv.search(`${address} property details beds baths sqft year built`, { maxResults: 5, includeImages: true }),
    tv.search(`${address} comparable sales recent sold 2024 2025 price per sqft`, { maxResults: 6 }),
    tv.search(`${address.split(',').slice(1).join(',').trim()} real estate market conditions 2025 median price days on market inventory`, { maxResults: 5 }),
  ])
  const propImageUrls: string[] = ((propRes as any).images || []).slice(0, 4)
  return {
    propContext: propRes.results.map(r => `${r.title}\n${r.content}`).join('\n\n'),
    compContext: compRes.results.map(r => `${r.title}\n${r.content}`).join('\n\n'),
    mktContext: mktRes.results.map(r => `${r.title}\n${r.content}`).join('\n\n'),
    propImageUrls,
  }
}

// ─── Analysis steps ──────────────────────────────────────────────────────────

async function analyzeComps(address: string, compContext: string, propContext: string) {
  const raw = await extract(
    'You are a real estate analyst. Return ONLY valid JSON, no markdown.',
    `Analyze comparable sales for: ${address}

Property Info:
${propContext}

Comparable Sales Research:
${compContext}

Return JSON:
{
  "score": <0-100 integer>,
  "listing_price": "<formatted price>",
  "beds": "<number>",
  "baths": "<number>",
  "sqft": "<number with commas>",
  "year_built": "<year>",
  "property_type": "<type>",
  "lot_size": "<size>",
  "price_per_sqft": "<$/sqft>",
  "comps": [{"address":"<addr>","price":"<$>","sqft":"<sqft>","price_sqft":"<$/sqft>","sold_date":"<date>","distance":"<mi>"}],
  "comp_avg_price": "<avg price>",
  "comp_avg_price_sqft": "<avg $/sqft>",
  "over_under": "<percentage and direction vs comps>",
  "summary": "<2-sentence comp analysis>"
}`
  )
  return parseJson(raw, { score: 50, comps: [], summary: 'Comparable data limited.' })
}

async function analyzeRental(address: string, propContext: string, mktContext: string) {
  const raw = await extract(
    'You are a real estate investment analyst. Return ONLY valid JSON, no markdown.',
    `Analyze rental income potential for: ${address}

Property Info:
${propContext}

Market Context:
${mktContext}

Return JSON:
{
  "score": <0-100 integer>,
  "ltr_monthly": "<$X,XXX>",
  "str_monthly_optimistic": "<$X,XXX>",
  "vacancy_rate": "<X%>",
  "cap_rate": "<X.X%>",
  "cash_on_cash": "<X.X%>",
  "grm": "<XX.X>",
  "monthly_mortgage_est": "<$X,XXX (20% down, 30yr)>",
  "net_cash_flow_ltr": "<$X,XXX or -$X,XXX/mo>",
  "cashflow_items": [{"item":"<name>","monthly":"<$>","annual":"<$>"}],
  "summary": "<2-sentence rental analysis>"
}`
  )
  return parseJson(raw, { score: 50, cap_rate: 'N/A', summary: 'Rental data limited.' })
}

async function analyzeNeighborhood(address: string, propContext: string) {
  const city = address.split(',').slice(1, 3).join(',').trim()
  const tv = tavily({ apiKey: process.env.TAVILY_API_KEY || '' })
  const nbrRes = await tv.search(`${city} schools crime walkability demographics neighborhood quality`, { maxResults: 5 })
  const nbrContext = nbrRes.results.map(r => `${r.title}\n${r.content}`).join('\n\n')

  const raw = await extract(
    'You are a real estate neighborhood analyst. Return ONLY valid JSON, no markdown.',
    `Score neighborhood quality for: ${address}

Property Context:
${propContext}

Neighborhood Research:
${nbrContext}

Return JSON:
{
  "score": <0-100 integer>,
  "school_quality": <0-100>,
  "safety_score": <0-100>,
  "walkability": <0-100>,
  "growth_trajectory": <0-100>,
  "demographics_score": <0-100>,
  "elementary_school": "<name — rating/10>",
  "middle_school": "<name — rating/10>",
  "high_school": "<name — rating/10>",
  "amenities": "<notable amenities nearby>",
  "growth_drivers": "<key growth factors>",
  "summary": "<2-sentence neighborhood analysis>"
}`
  )
  return parseJson(raw, { score: 60, summary: 'Neighborhood data limited.' })
}

async function analyzeInvestment(address: string, compsData: any, rentalData: any, mktContext: string) {
  const raw = await extract(
    'You are a real estate investment strategist. Return ONLY valid JSON, no markdown.',
    `Evaluate investment strategies for: ${address}

Comps Score: ${compsData.score}/100
Rental Score: ${rentalData.score}/100
Cap Rate: ${rentalData.cap_rate || 'N/A'}
Cash on Cash: ${rentalData.cash_on_cash || 'N/A'}

Market Context:
${mktContext}

Return JSON:
{
  "score": <0-100 integer>,
  "best_strategy": "<Buy & Hold LTR | Buy & Hold STR | Fix & Flip | Not Recommended>",
  "projected_roi_1yr": "<X%>",
  "projected_roi_3yr": "<X%>",
  "projected_roi_5yr": "<X%>",
  "annual_appreciation_est": "<X.X%>",
  "risk_level": "<Low | Moderate | High | Very High>",
  "strategies": [
    {"strategy":"<name>","return":"<projected>","timeframe":"<X yrs>","pros":"<pros>","risk":"<risk>"}
  ],
  "appreciation_5yr": {"conservative":"<$X>","moderate":"<$X>","aggressive":"<$X>"},
  "scenarios": [
    {"scenario":"Bull Case","probability":"<X%>","return":"<+X%>","trigger":"<conditions>"},
    {"scenario":"Base Case","probability":"<X%>","return":"<X%>","trigger":"<conditions>"},
    {"scenario":"Bear Case","probability":"<X%>","return":"<-X%>","trigger":"<conditions>"}
  ],
  "summary": "<2-sentence investment analysis>"
}`
  )
  return parseJson(raw, { score: 50, best_strategy: 'Buy & Hold LTR', summary: 'Investment data limited.' })
}

async function analyzeMarket(address: string, mktContext: string) {
  const raw = await extract(
    'You are a real estate market analyst. Return ONLY valid JSON, no markdown.',
    `Analyze market conditions for: ${address}

Market Research:
${mktContext}

Return JSON:
{
  "score": <0-100 integer>,
  "market_type": "<Buyer's Market | Seller's Market | Balanced Market>",
  "median_price": "<$X,XXX,XXX>",
  "days_on_market": "<XX days>",
  "inventory_months": "<X.X months>",
  "price_trend_yoy": "<+X.X% or -X.X%>",
  "absorption_rate": "<X%>",
  "list_to_sale_ratio": "<XX%>",
  "economic_drivers": "<key economic factors>",
  "forecast": "<6-12 month outlook>",
  "summary": "<2-sentence market analysis>"
}`
  )
  return parseJson(raw, { score: 55, market_type: 'Balanced Market', summary: 'Market data limited.' })
}

// ─── PDF generation ──────────────────────────────────────────────────────────

async function generatePdf(address: string, data: {
  comps: any
  rental: any
  neighborhood: any
  investment: any
  market: any
  overallScore: number
  grade: string
  signal: string
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
  } catch (_) {
    // fall back to Helvetica
  }

  // Load Shana green photo (pre-resized to 320×320, 20KB — safe to embed)
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
  const ACCENT = '#C8C8C8'
  const CREAM = '#F2EDE4'
  const PAGE_BG = '#FAFAF8'
  const ROW_ALT = '#F5F0E8'
  const GREEN = '#2E7D32'
  const RED = '#C62828'
  const YELLOW = '#F9A825'

  const scoreColor = data.overallScore >= 70 ? GREEN : data.overallScore >= 40 ? YELLOW : RED

  function scoreBar(score: number, label: string) {
    const color = score >= 70 ? GREEN : score >= 40 ? YELLOW : RED
    return [
      { text: label, font: sans, fontSize: 9, color: DARK, margin: [0, 2, 0, 1] },
      {
        canvas: [
          { type: 'rect', x: 0, y: 0, w: 380, h: 10, r: 5, color: '#E8E1D5' },
          { type: 'rect', x: 0, y: 0, w: Math.round(3.8 * score), h: 10, r: 5, color },
        ],
        margin: [0, 0, 0, 4],
      },
      { text: `${score}/100`, font: sans, fontSize: 8, color, bold: true, margin: [0, 0, 0, 6] },
    ]
  }

  function tableRow(cells: string[], shade: boolean) {
    return cells.map(c => ({
      text: c, font: sans, fontSize: 8, color: DARK,
      fillColor: shade ? ROW_ALT : '#FFFFFF',
      margin: [4, 4, 4, 4],
    }))
  }

  const comps = data.comps
  const rental = data.rental
  const nbr = data.neighborhood
  const inv = data.investment
  const mkt = data.market

  const compsRows = (comps.comps || []).map((c: any, i: number) =>
    tableRow([c.address || '', c.price || '', c.sqft || '', c.price_sqft || '', c.sold_date || '', c.distance || ''], i % 2 === 1)
  )
  if (compsRows.length === 0) compsRows.push(tableRow(['No comparable sales found', '', '', '', '', ''], false))

  const cashflowRows = (rental.cashflow_items || []).map((item: any, i: number) => {
    const isTotal = (item.item || '').toLowerCase().includes('net cash')
    return [
      { text: item.item || '', font: sans, fontSize: 8, color: DARK, bold: isTotal, fillColor: isTotal ? CREAM : (i % 2 === 1 ? ROW_ALT : '#FFFFFF'), margin: [4, 4, 4, 4] },
      { text: item.monthly || '', font: sans, fontSize: 8, color: isTotal ? (String(item.monthly).includes('-') ? RED : GREEN) : DARK, bold: isTotal, fillColor: isTotal ? CREAM : (i % 2 === 1 ? ROW_ALT : '#FFFFFF'), margin: [4, 4, 4, 4] },
      { text: item.annual || '', font: sans, fontSize: 8, color: isTotal ? (String(item.annual).includes('-') ? RED : GREEN) : DARK, bold: isTotal, fillColor: isTotal ? CREAM : (i % 2 === 1 ? ROW_ALT : '#FFFFFF'), margin: [4, 4, 4, 4] },
    ]
  })
  if (cashflowRows.length === 0) {
    cashflowRows.push(tableRow(['Gross Rental Income (est.)', rental.ltr_monthly || 'N/A', '—'], false))
    cashflowRows.push(tableRow(['Net Cash Flow (est.)', rental.net_cash_flow_ltr || 'N/A', '—'], true))
  }

  const strategiesRows = (inv.strategies || []).map((s: any, i: number) =>
    tableRow([s.strategy || '', s.return || '', s.timeframe || '', s.risk || ''], i % 2 === 1)
  )
  if (strategiesRows.length === 0) {
    strategiesRows.push(tableRow([inv.best_strategy || 'Buy & Hold', inv.projected_roi_5yr || 'N/A', '7-10 yrs', inv.risk_level || 'Moderate'], false))
  }

  const docImages: Record<string, string> = {}
  if (data.propImageBase64) docImages['property'] = data.propImageBase64
  if (shanaImageBase64) docImages['shana'] = shanaImageBase64

  const docDef: any = {
    pageSize: 'LETTER',
    pageMargins: [50, 60, 50, 50],
    defaultStyle: { font: sans, fontSize: 10, color: DARK },
    fonts,
    images: docImages,

    // Full-bleed dark background on cover page only
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
          { text: 'PROPERTY ANALYSIS REPORT', font: serif, fontSize: 9, color: ACCENT, margin: [50, 20, 0, 0] },
          { text: 'Shana Gates  ·  Craft & Bauer | Real Broker  ·  760.232.4054', font: sans, fontSize: 8, color: '#888', alignment: 'right', margin: [0, 20, 50, 0] },
        ],
      }
    },

    footer: (currentPage: number, pageCount: number) => {
      if (currentPage === 1) return null
      return {
        columns: [
          { text: 'For educational purposes only. Not financial or investment advice.', font: sans, fontSize: 7, color: '#aaa', margin: [50, 10, 0, 0] },
          { text: `Page ${currentPage} of ${pageCount}`, font: sans, fontSize: 8, color: ACCENT, alignment: 'right', margin: [0, 10, 50, 0] },
        ],
      }
    },

    content: [
      // ── COVER PAGE ────────────────────────────────────────────────────────
      // (dark background handled by `background` callback above)

      // Property photo — shown when Tavily returns an image for the address
      ...(data.propImageBase64 ? [{
        image: 'property',
        fit: [512, 172],
        alignment: 'center',
        margin: [0, 0, 0, 18],
      }] : []),

      {
        text: 'PROPERTY ANALYSIS REPORT',
        font: serif,
        fontSize: 11,
        color: ACCENT,
        letterSpacing: 3,
        alignment: 'center',
        margin: [0, data.propImageBase64 ? 0 : 32, 0, 4],
      },
      {
        canvas: [{ type: 'line', x1: 160, y1: 0, x2: 352, y2: 0, lineWidth: 0.5, lineColor: ACCENT }],
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
      // Score gauge (text-based)
      {
        table: {
          widths: ['*'],
          body: [[{
            stack: [
              { text: String(data.overallScore), font: serif, fontSize: 56, color: scoreColor, alignment: 'center', margin: [0, 16, 0, 0] },
              { text: 'out of 100', font: sans, fontSize: 9, color: '#999', alignment: 'center', margin: [0, 0, 0, 8] },
              { text: data.grade, font: serif, fontSize: 28, color: ACCENT, alignment: 'center', margin: [0, 0, 0, 4] },
              { text: data.signal.toUpperCase(), font: sans, fontSize: 10, color: scoreColor, alignment: 'center', bold: true, margin: [0, 0, 0, 16] },
            ],
            fillColor: '#1a1a1a',
            border: [false, false, false, false],
          }]],
        },
        layout: {
          hLineWidth: () => 0,
          vLineWidth: () => 0,
          hLineColor: () => ACCENT,
          paddingLeft: () => 0,
          paddingRight: () => 0,
          paddingTop: () => 0,
          paddingBottom: () => 0,
        },
        margin: [120, 0, 120, 32],
      },
      // Category score row
      {
        columns: [
          { stack: [{ text: 'VALUE & COMPS', font: sans, fontSize: 7, color: '#888', alignment: 'center' }, { text: `${comps.score || 50}`, font: sans, fontSize: 16, color: (comps.score || 50) >= 70 ? GREEN : YELLOW, bold: true, alignment: 'center' }] },
          { stack: [{ text: 'INCOME', font: sans, fontSize: 7, color: '#888', alignment: 'center' }, { text: `${rental.score || 50}`, font: sans, fontSize: 16, color: (rental.score || 50) >= 70 ? GREEN : YELLOW, bold: true, alignment: 'center' }] },
          { stack: [{ text: 'NEIGHBORHOOD', font: sans, fontSize: 7, color: '#888', alignment: 'center' }, { text: `${nbr.score || 60}`, font: sans, fontSize: 16, color: (nbr.score || 60) >= 70 ? GREEN : YELLOW, bold: true, alignment: 'center' }] },
          { stack: [{ text: 'INVESTMENT', font: sans, fontSize: 7, color: '#888', alignment: 'center' }, { text: `${inv.score || 50}`, font: sans, fontSize: 16, color: (inv.score || 50) >= 70 ? GREEN : YELLOW, bold: true, alignment: 'center' }] },
          { stack: [{ text: 'MARKET', font: sans, fontSize: 7, color: '#888', alignment: 'center' }, { text: `${mkt.score || 55}`, font: sans, fontSize: 16, color: (mkt.score || 55) >= 70 ? GREEN : YELLOW, bold: true, alignment: 'center' }] },
        ],
        margin: [0, 0, 0, 40],
      },
      // Shana credit on cover — rule spans full block width, then photo + text side by side
      {
        columns: [
          { text: '', width: '*' },
          {
            canvas: [{ type: 'line', x1: 0, y1: 0, x2: shanaImageBase64 ? 236 : 172, y2: 0, lineWidth: 0.5, lineColor: ACCENT }],
            width: shanaImageBase64 ? 236 : 172,
          },
        ],
        margin: [0, 0, 0, 10],
      },
      {
        columns: [
          { text: '', width: '*' },
          ...(shanaImageBase64 ? [{
            image: 'shana',
            fit: [56, 56],
            width: 56,
            margin: [0, 2, 14, 0],
          }] : []),
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
      { text: 'For educational purposes only. Not financial or investment advice.', font: sans, fontSize: 7, color: '#666', alignment: 'center' },

      // ── PAGE 2: PROPERTY OVERVIEW + COMPS ────────────────────────────────
      { text: '', pageBreak: 'before' },
      { text: 'PROPERTY OVERVIEW', font: serif, fontSize: 14, color: DARK, margin: [0, 0, 0, 4] },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 512, y2: 0, lineWidth: 1, lineColor: ACCENT }], margin: [0, 0, 0, 16] },
      {
        columns: [
          {
            stack: [
              { text: comps.listing_price || 'N/A', font: serif, fontSize: 28, color: DARK, margin: [0, 0, 0, 4] },
              { text: 'List Price', font: sans, fontSize: 9, color: '#777', margin: [0, 0, 0, 16] },
              {
                table: {
                  widths: ['auto', '*'],
                  body: [
                    [{ text: 'Beds / Baths', font: sans, fontSize: 8, color: '#777', border: [false, false, false, false] }, { text: `${comps.beds || '—'} bed / ${comps.baths || '—'} bath`, font: sans, fontSize: 8, color: DARK, bold: true, border: [false, false, false, false] }],
                    [{ text: 'Square Feet', font: sans, fontSize: 8, color: '#777', border: [false, false, false, false] }, { text: comps.sqft || '—', font: sans, fontSize: 8, color: DARK, bold: true, border: [false, false, false, false] }],
                    [{ text: 'Year Built', font: sans, fontSize: 8, color: '#777', border: [false, false, false, false] }, { text: comps.year_built || '—', font: sans, fontSize: 8, color: DARK, bold: true, border: [false, false, false, false] }],
                    [{ text: 'Lot Size', font: sans, fontSize: 8, color: '#777', border: [false, false, false, false] }, { text: comps.lot_size || '—', font: sans, fontSize: 8, color: DARK, bold: true, border: [false, false, false, false] }],
                    [{ text: 'Property Type', font: sans, fontSize: 8, color: '#777', border: [false, false, false, false] }, { text: comps.property_type || 'SFR', font: sans, fontSize: 8, color: DARK, bold: true, border: [false, false, false, false] }],
                    [{ text: 'Price / SqFt', font: sans, fontSize: 8, color: '#777', border: [false, false, false, false] }, { text: comps.price_per_sqft || '—', font: sans, fontSize: 8, color: DARK, bold: true, border: [false, false, false, false] }],
                  ],
                },
                layout: { hLineWidth: () => 0.3, vLineWidth: () => 0, hLineColor: () => '#ddd', paddingTop: () => 4, paddingBottom: () => 4 },
              },
            ],
            width: '45%',
          },
          { width: 16, text: '' },
          {
            stack: [
              { text: 'COMP SUMMARY', font: sans, fontSize: 8, color: ACCENT, bold: true, margin: [0, 0, 0, 6] },
              { text: `Avg Comp Price: ${comps.comp_avg_price || 'N/A'}`, font: sans, fontSize: 9, color: DARK, margin: [0, 0, 0, 3] },
              { text: `Avg Comp $/SqFt: ${comps.comp_avg_price_sqft || 'N/A'}`, font: sans, fontSize: 9, color: DARK, margin: [0, 0, 0, 3] },
              { text: `Valuation vs Comps: ${comps.over_under || 'N/A'}`, font: sans, fontSize: 9, color: DARK, margin: [0, 0, 0, 12] },
              { text: comps.summary || '', font: sans, fontSize: 9, color: '#444', italics: true },
            ],
            width: '*',
          },
        ],
        margin: [0, 0, 0, 24],
      },
      { text: 'COMPARABLE SALES', font: serif, fontSize: 12, color: DARK, margin: [0, 0, 0, 8] },
      {
        table: {
          widths: ['*', 'auto', 'auto', 'auto', 'auto', 'auto'],
          body: [
            [
              { text: 'Address', font: sans, fontSize: 8, bold: true, color: CREAM, fillColor: DARK, margin: [4, 6, 4, 6], border: [false, false, false, false] },
              { text: 'Price', font: sans, fontSize: 8, bold: true, color: CREAM, fillColor: DARK, margin: [4, 6, 4, 6], border: [false, false, false, false] },
              { text: 'SqFt', font: sans, fontSize: 8, bold: true, color: CREAM, fillColor: DARK, margin: [4, 6, 4, 6], border: [false, false, false, false] },
              { text: '$/SqFt', font: sans, fontSize: 8, bold: true, color: CREAM, fillColor: DARK, margin: [4, 6, 4, 6], border: [false, false, false, false] },
              { text: 'Sold', font: sans, fontSize: 8, bold: true, color: CREAM, fillColor: DARK, margin: [4, 6, 4, 6], border: [false, false, false, false] },
              { text: 'Dist.', font: sans, fontSize: 8, bold: true, color: CREAM, fillColor: DARK, margin: [4, 6, 4, 6], border: [false, false, false, false] },
            ],
            ...compsRows,
          ],
        },
        layout: { hLineWidth: () => 0.3, vLineWidth: () => 0, hLineColor: () => '#ddd', paddingLeft: () => 4, paddingRight: () => 4 },
        margin: [0, 0, 0, 0],
      },

      // ── PAGE 3: CASH FLOW ──────────────────────────────────────────────────
      { text: '', pageBreak: 'before' },
      { text: 'CASH FLOW ANALYSIS', font: serif, fontSize: 14, color: DARK, margin: [0, 0, 0, 4] },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 512, y2: 0, lineWidth: 1, lineColor: ACCENT }], margin: [0, 0, 0, 16] },
      {
        columns: [
          { stack: [
            { text: 'KEY METRICS', font: sans, fontSize: 8, color: ACCENT, bold: true, margin: [0, 0, 0, 8] },
            { text: `Cap Rate: ${rental.cap_rate || 'N/A'}`, font: sans, fontSize: 10, color: DARK, margin: [0, 0, 0, 4] },
            { text: `Cash-on-Cash: ${rental.cash_on_cash || 'N/A'}`, font: sans, fontSize: 10, color: DARK, margin: [0, 0, 0, 4] },
            { text: `GRM: ${rental.grm || 'N/A'}`, font: sans, fontSize: 10, color: DARK, margin: [0, 0, 0, 4] },
            { text: `LTR Rent Est.: ${rental.ltr_monthly || 'N/A'}/mo`, font: sans, fontSize: 10, color: DARK, margin: [0, 0, 0, 4] },
            { text: `STR Optimistic: ${rental.str_monthly_optimistic || 'N/A'}/mo`, font: sans, fontSize: 10, color: DARK, margin: [0, 0, 0, 4] },
            { text: `Vacancy Rate: ${rental.vacancy_rate || '5%'}`, font: sans, fontSize: 10, color: DARK, margin: [0, 0, 0, 16] },
            { text: rental.summary || '', font: sans, fontSize: 9, color: '#444', italics: true },
          ], width: '40%' },
          { width: 16, text: '' },
          {
            stack: [
              { text: 'MONTHLY CASH FLOW PROJECTION', font: sans, fontSize: 8, color: ACCENT, bold: true, margin: [0, 0, 0, 8] },
              {
                table: {
                  widths: ['*', 'auto', 'auto'],
                  body: [
                    [
                      { text: 'Item', font: sans, fontSize: 8, bold: true, color: CREAM, fillColor: DARK, margin: [4, 6, 4, 6], border: [false, false, false, false] },
                      { text: 'Monthly', font: sans, fontSize: 8, bold: true, color: CREAM, fillColor: DARK, margin: [4, 6, 4, 6], border: [false, false, false, false] },
                      { text: 'Annual', font: sans, fontSize: 8, bold: true, color: CREAM, fillColor: DARK, margin: [4, 6, 4, 6], border: [false, false, false, false] },
                    ],
                    ...cashflowRows,
                  ],
                },
                layout: { hLineWidth: () => 0.3, vLineWidth: () => 0, hLineColor: () => '#ddd', paddingLeft: () => 4, paddingRight: () => 4 },
              },
            ],
            width: '*',
          },
        ],
        margin: [0, 0, 0, 0],
      },

      // ── PAGE 4: NEIGHBORHOOD ───────────────────────────────────────────────
      { text: '', pageBreak: 'before' },
      { text: 'NEIGHBORHOOD SCORECARD', font: serif, fontSize: 14, color: DARK, margin: [0, 0, 0, 4] },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 512, y2: 0, lineWidth: 1, lineColor: ACCENT }], margin: [0, 0, 0, 20] },
      ...scoreBar(nbr.school_quality || 60, 'School Quality'),
      ...scoreBar(nbr.safety_score || 55, 'Safety & Crime'),
      ...scoreBar(nbr.walkability || 65, 'Walkability'),
      ...scoreBar(nbr.demographics_score || 65, 'Demographics'),
      ...scoreBar(nbr.growth_trajectory || 70, 'Growth Trajectory'),
      {
        columns: [
          {
            stack: [
              { text: 'SCHOOLS', font: sans, fontSize: 8, color: ACCENT, bold: true, margin: [0, 16, 0, 6] },
              { text: `Elementary: ${nbr.elementary_school || 'N/A'}`, font: sans, fontSize: 9, color: DARK, margin: [0, 0, 0, 3] },
              { text: `Middle: ${nbr.middle_school || 'N/A'}`, font: sans, fontSize: 9, color: DARK, margin: [0, 0, 0, 3] },
              { text: `High School: ${nbr.high_school || 'N/A'}`, font: sans, fontSize: 9, color: DARK, margin: [0, 0, 0, 16] },
              { text: 'AMENITIES', font: sans, fontSize: 8, color: ACCENT, bold: true, margin: [0, 0, 0, 6] },
              { text: nbr.amenities || 'N/A', font: sans, fontSize: 9, color: DARK, margin: [0, 0, 0, 0] },
            ],
            width: '50%',
          },
          { width: 16, text: '' },
          {
            stack: [
              { text: 'GROWTH DRIVERS', font: sans, fontSize: 8, color: ACCENT, bold: true, margin: [0, 16, 0, 6] },
              { text: nbr.growth_drivers || 'N/A', font: sans, fontSize: 9, color: DARK, margin: [0, 0, 0, 16] },
              { text: 'SUMMARY', font: sans, fontSize: 8, color: ACCENT, bold: true, margin: [0, 0, 0, 6] },
              { text: nbr.summary || '', font: sans, fontSize: 9, color: '#444', italics: true },
            ],
            width: '*',
          },
        ],
      },

      // ── PAGE 5: INVESTMENT + MARKET ────────────────────────────────────────
      { text: '', pageBreak: 'before' },
      { text: 'INVESTMENT ANALYSIS', font: serif, fontSize: 14, color: DARK, margin: [0, 0, 0, 4] },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 512, y2: 0, lineWidth: 1, lineColor: ACCENT }], margin: [0, 0, 0, 16] },
      {
        columns: [
          {
            stack: [
              { text: 'BEST STRATEGY', font: sans, fontSize: 8, color: ACCENT, bold: true, margin: [0, 0, 0, 4] },
              { text: inv.best_strategy || 'Buy & Hold', font: serif, fontSize: 14, color: DARK, margin: [0, 0, 0, 12] },
              { text: `Risk Level: ${inv.risk_level || 'Moderate'}`, font: sans, fontSize: 9, color: DARK, margin: [0, 0, 0, 4] },
              { text: `1-Year ROI: ${inv.projected_roi_1yr || 'N/A'}`, font: sans, fontSize: 9, color: DARK, margin: [0, 0, 0, 4] },
              { text: `3-Year ROI: ${inv.projected_roi_3yr || 'N/A'}`, font: sans, fontSize: 9, color: DARK, margin: [0, 0, 0, 4] },
              { text: `5-Year ROI: ${inv.projected_roi_5yr || 'N/A'}`, font: sans, fontSize: 9, color: DARK, margin: [0, 0, 0, 4] },
              { text: `Annual Appreciation: ${inv.annual_appreciation_est || 'N/A'}`, font: sans, fontSize: 9, color: DARK, margin: [0, 0, 0, 16] },
              { text: inv.summary || '', font: sans, fontSize: 9, color: '#444', italics: true },
            ],
            width: '40%',
          },
          { width: 16, text: '' },
          {
            stack: [
              { text: 'STRATEGY COMPARISON', font: sans, fontSize: 8, color: ACCENT, bold: true, margin: [0, 0, 0, 8] },
              {
                table: {
                  widths: ['*', 'auto', 'auto', '*'],
                  body: [
                    [
                      { text: 'Strategy', font: sans, fontSize: 7, bold: true, color: CREAM, fillColor: DARK, margin: [4, 5, 4, 5], border: [false, false, false, false] },
                      { text: 'Return', font: sans, fontSize: 7, bold: true, color: CREAM, fillColor: DARK, margin: [4, 5, 4, 5], border: [false, false, false, false] },
                      { text: 'Timeline', font: sans, fontSize: 7, bold: true, color: CREAM, fillColor: DARK, margin: [4, 5, 4, 5], border: [false, false, false, false] },
                      { text: 'Risk', font: sans, fontSize: 7, bold: true, color: CREAM, fillColor: DARK, margin: [4, 5, 4, 5], border: [false, false, false, false] },
                    ],
                    ...strategiesRows,
                  ],
                },
                layout: { hLineWidth: () => 0.3, vLineWidth: () => 0, hLineColor: () => '#ddd', paddingLeft: () => 4, paddingRight: () => 4 },
                margin: [0, 0, 0, 16],
              },
              { text: 'MARKET CONDITIONS', font: sans, fontSize: 8, color: ACCENT, bold: true, margin: [0, 0, 0, 8] },
              { text: `Market Type: ${mkt.market_type || 'N/A'}`, font: sans, fontSize: 9, color: DARK, margin: [0, 0, 0, 3] },
              { text: `Median Price: ${mkt.median_price || 'N/A'}`, font: sans, fontSize: 9, color: DARK, margin: [0, 0, 0, 3] },
              { text: `Days on Market: ${mkt.days_on_market || 'N/A'}`, font: sans, fontSize: 9, color: DARK, margin: [0, 0, 0, 3] },
              { text: `Price Trend YoY: ${mkt.price_trend_yoy || 'N/A'}`, font: sans, fontSize: 9, color: DARK, margin: [0, 0, 0, 3] },
              { text: `Inventory: ${mkt.inventory_months || 'N/A'}`, font: sans, fontSize: 9, color: DARK, margin: [0, 0, 0, 8] },
              { text: mkt.summary || '', font: sans, fontSize: 9, color: '#444', italics: true },
            ],
            width: '*',
          },
        ],
        margin: [0, 0, 0, 0],
      },

      // ── PAGE 6: RECOMMENDATION ─────────────────────────────────────────────
      { text: '', pageBreak: 'before' },
      { text: 'RECOMMENDATION', font: serif, fontSize: 14, color: DARK, margin: [0, 0, 0, 4] },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 512, y2: 0, lineWidth: 1, lineColor: ACCENT }], margin: [0, 0, 0, 20] },
      {
        table: {
          widths: ['*'],
          body: [[{
            stack: [
              { text: data.signal.toUpperCase(), font: serif, fontSize: 20, color: scoreColor, alignment: 'center', margin: [0, 12, 0, 4] },
              { text: `Overall Score: ${data.overallScore}/100 — Grade ${data.grade}`, font: sans, fontSize: 10, color: CREAM, alignment: 'center', margin: [0, 0, 0, 12] },
            ],
            fillColor: DARK,
            border: [false, false, false, false],
          }]],
        },
        layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 },
        margin: [0, 0, 0, 20],
      },
      { text: `${comps.summary || ''} ${rental.summary || ''} ${inv.summary || ''}`.trim(), font: sans, fontSize: 10, color: DARK, margin: [0, 0, 0, 20] },
      { text: 'SCENARIOS', font: sans, fontSize: 8, color: ACCENT, bold: true, margin: [0, 0, 0, 8] },
      ...(inv.scenarios || []).map((s: any, i: number) => ({
        columns: [
          { text: s.scenario || '', font: sans, fontSize: 9, bold: true, color: s.scenario?.includes('Bull') ? GREEN : s.scenario?.includes('Bear') ? RED : DARK, width: 80 },
          { text: `${s.probability || ''} — ${s.return || ''}`, font: sans, fontSize: 9, color: DARK, width: 120 },
          { text: s.trigger || '', font: sans, fontSize: 8, color: '#555', width: '*' },
        ],
        margin: [0, 0, 0, 6],
        fillColor: i % 2 === 1 ? ROW_ALT : '#FFFFFF',
      })),
      { text: '', margin: [0, 16, 0, 0] },
      { text: 'NEXT STEPS', font: sans, fontSize: 8, color: ACCENT, bold: true, margin: [0, 0, 0, 8] },
      { text: `Contact Shana Gates for personalized guidance on this property.`, font: sans, fontSize: 10, color: DARK, margin: [0, 0, 0, 4] },
      { text: `shana@craftbauer.com  ·  760.232.4054  ·  Craft & Bauer | Real Broker`, font: sans, fontSize: 9, color: '#666', margin: [0, 0, 0, 24] },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 512, y2: 0, lineWidth: 0.5, lineColor: '#ddd' }], margin: [0, 0, 0, 12] },
      { text: 'DISCLAIMER: This report is for educational and informational purposes only. It does not constitute financial, investment, or legal advice. All data is AI-generated based on publicly available information and should be independently verified. Past performance is not indicative of future results. Always consult with licensed real estate, financial, and legal professionals before making any investment decisions. Shana Gates, Craft & Bauer | Real Broker, CalDRE #02224632.', font: sans, fontSize: 7, color: '#999' },
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

// ─── Scoring ──────────────────────────────────────────────────────────────────

function computeScore(comps: any, rental: any, neighborhood: any, investment: any, market: any): number {
  const c = Math.round(
    (comps.score || 50) * 0.25 +
    (rental.score || 50) * 0.20 +
    (neighborhood.score || 60) * 0.20 +
    (investment.score || 50) * 0.20 +
    (market.score || 55) * 0.15
  )
  return Math.max(0, Math.min(100, c))
}

function gradeSignal(score: number): { grade: string; signal: string } {
  if (score >= 85) return { grade: 'A+', signal: 'Strong Buy' }
  if (score >= 75) return { grade: 'A', signal: 'Buy' }
  if (score >= 65) return { grade: 'B', signal: 'Buy' }
  if (score >= 55) return { grade: 'C', signal: 'Watch' }
  if (score >= 45) return { grade: 'D', signal: 'Caution' }
  return { grade: 'F', signal: 'Avoid' }
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

  let compsData: any = { score: 50 }
  let rentalData: any = { score: 50 }
  let nbrData: any = { score: 60 }
  let invData: any = { score: 50 }
  let mktData: any = { score: 55 }

  try {
    // Step 1: Discovery
    step(res, 'discovery', 'running', 'Researching property data…')
    const { propContext, compContext, mktContext, propImageUrls } = await runDiscovery(addr)
    // Try each candidate image URL in order; runs concurrently with analysis steps
    const propImagePromise: Promise<string | null> = (async () => {
      for (const url of propImageUrls) {
        const b64 = await fetchImageAsBase64(url)
        if (b64) return b64
      }
      return null
    })()
    step(res, 'discovery', 'done', 'Property data collected')

    // Step 2: Comps
    step(res, 'comps', 'running', 'Pulling comparable sales…')
    compsData = await analyzeComps(addr, compContext, propContext)
    step(res, 'comps', 'done', 'Comparable sales — complete')

    // Step 3: Rental
    step(res, 'rental', 'running', 'Estimating rental income…')
    rentalData = await analyzeRental(addr, propContext, mktContext)
    step(res, 'rental', 'done', 'Rental income analysis — complete')

    // Step 4: Neighborhood
    step(res, 'neighborhood', 'running', 'Scoring the neighborhood…')
    nbrData = await analyzeNeighborhood(addr, propContext)
    step(res, 'neighborhood', 'done', 'Neighborhood scorecard — complete')

    // Step 5: Investment
    step(res, 'investment', 'running', 'Running investment models…')
    invData = await analyzeInvestment(addr, compsData, rentalData, mktContext)
    step(res, 'investment', 'done', 'Investment analysis — complete')

    // Step 6: Market
    step(res, 'market', 'running', 'Analyzing market conditions…')
    mktData = await analyzeMarket(addr, mktContext)
    step(res, 'market', 'done', 'Market conditions — complete')

    // Step 7: PDF
    step(res, 'pdf', 'running', 'Generating your branded PDF…')
    const overallScore = computeScore(compsData, rentalData, nbrData, invData, mktData)
    const { grade, signal } = gradeSignal(overallScore)
    const propImageBase64 = await propImagePromise
    const pdfBase64 = await generatePdf(addr, { comps: compsData, rental: rentalData, neighborhood: nbrData, investment: invData, market: mktData, overallScore, grade, signal, propImageBase64 })
    step(res, 'pdf', 'done', 'PDF report ready', { pdfBase64 })
    send(res, { step: 'complete' })

  } catch (err: any) {
    const msg = err?.message || 'Unexpected error'
    send(res, { step: 'error', message: msg })
  } finally {
    res.end()
  }
}
