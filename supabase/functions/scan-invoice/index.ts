/**
 * Supabase Edge Function: scan-invoice
 * Receives a base64-encoded invoice image/PDF from the authenticated frontend,
 * calls Google Gemini Vision API, and returns structured JSON data.
 *
 * The GEMINI_API_KEY is stored ONLY as a Supabase secret — never in frontend code.
 * Set it via: supabase secrets set GEMINI_API_KEY=your_key_here
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
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  // Require authenticated Supabase user
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    return json({ error: 'Unauthorized' }, 401)
  }

  // Verify API key is configured
  if (!GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY secret is not set')
    return json({ error: 'Service not configured' }, 500)
  }

  // Parse request body
  let image: string, mimeType: string
  try {
    const body = await req.json()
    image = body.image
    mimeType = body.mimeType || 'image/jpeg'
    if (!image) throw new Error('Missing image')
  } catch (e) {
    return json({ error: 'Invalid request body' }, 400)
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
    return json({ error: 'Failed to reach Gemini API' }, 502)
  }

  if (!geminiRes.ok) {
    const errText = await geminiRes.text()
    console.error('Gemini API error:', geminiRes.status, errText)
    return json({ error: 'Gemini API error', status: geminiRes.status }, 502)
  }

  const geminiData = await geminiRes.json()
  const rawText: string = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(rawText)
  } catch {
    console.error('Failed to parse Gemini response:', rawText)
    return json({ error: 'Failed to parse invoice data' }, 500)
  }

  return json(parsed, 200)
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
