/**
 * Supabase Edge Function: scan-invoice
 * Calls Google Gemini Vision API to extract invoice data.
 * GEMINI_API_KEY is stored only as a Supabase secret — never in frontend code.
 */

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? ''
const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const EXTRACTION_PROMPT = `
You are an expert at reading invoices, receipts, and bills written in any language (especially Hebrew and English).

Analyze the attached document image and extract structured data.
Return ONLY valid JSON — no markdown, no code blocks, no explanation.

Required JSON format:
{
  "business_name": "name of the business or store",
  "date": "YYYY-MM-DD",
  "invoice_number": "invoice/receipt number or null",
  "total": 123.45,
  "vat": 0.00,
  "currency": "₪",
  "items": [
    { "name": "item description", "quantity": 1, "price": 10.00 }
  ]
}

Rules:
- business_name: main business name at the top of the document
- date: invoice/receipt date in YYYY-MM-DD format; if not visible use today
- total: the final amount due (look for: סה"כ לתשלום, grand total, total due) — must be a number
- vat: VAT/tax amount (look for: מע"מ, VAT, tax) — 0 if not visible
- currency: "₪" for Israeli Shekel, "$" for USD, "€" for EUR
- items: each line item with name (string), quantity (number), price (unit price, number)
- All numeric fields must be numbers, not strings
- Do NOT include currency symbols inside numeric fields
- If this image is NOT an invoice or receipt, return exactly: {"error":"not_invoice"}
`.trim()

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return ok(null)
  }

  if (req.method !== 'POST') {
    return ok({ error: 'method_not_allowed' })
  }

  // Require authenticated Supabase user
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    return ok({ error: 'unauthorized' })
  }

  // Check API key is configured
  if (!GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY secret is not set')
    return ok({ error: 'not_configured', message: 'GEMINI_API_KEY secret is missing' })
  }

  // Parse request body
  let image: string, mimeType: string
  try {
    const body = await req.json()
    image = body.image
    mimeType = body.mimeType || 'image/jpeg'
    if (!image) throw new Error('Missing image')
  } catch (_e) {
    return ok({ error: 'bad_request', message: 'Missing image in request body' })
  }

  // Call Gemini Vision API
  let geminiRes: Response
  try {
    geminiRes = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inlineData: { mimeType, data: image } },
            { text: EXTRACTION_PROMPT },
          ],
        }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
          maxOutputTokens: 2048,
        },
      }),
    })
  } catch (e) {
    console.error('Gemini fetch error:', e)
    return ok({ error: 'gemini_unreachable', message: String(e) })
  }

  if (!geminiRes.ok) {
    const errText = await geminiRes.text()
    console.error('Gemini API error:', geminiRes.status, errText)
    return ok({ error: 'gemini_api_error', status: geminiRes.status, message: errText })
  }

  const geminiData = await geminiRes.json()
  const rawText: string = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(rawText)
  } catch (_e) {
    console.error('Failed to parse Gemini response:', rawText)
    return ok({ error: 'parse_failed', raw: rawText.slice(0, 200) })
  }

  return ok(parsed)
})

function ok(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
