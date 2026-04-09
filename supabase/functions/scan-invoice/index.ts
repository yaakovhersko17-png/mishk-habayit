/**
 * Supabase Edge Function: scan-invoice
 * Uses Gemma 3 27B (vision) to extract invoice data.
 * GEMINI_API_KEY is stored only as a Supabase secret — never in frontend code.
 */

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? ''
const MODEL_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/gemma-3-27b-it:generateContent?key=${GEMINI_API_KEY}`

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const EXTRACTION_PROMPT = `
You are an expert OCR and data extraction system specialized in Hebrew and English invoices, receipts, and bills.

Look carefully at every detail in the image. Extract all text you can see.

Return your answer as a single JSON object with NO markdown, NO code blocks, NO explanation — just pure JSON.

JSON structure:
{"business_name":"...","date":"YYYY-MM-DD","invoice_number":null,"total":0.00,"vat":0.00,"currency":"₪","items":[{"name":"...","quantity":1,"price":0.00}]}

EXTRACTION RULES:
1. business_name: Read the store/business name from the top of the receipt (look for large text, logo text, header)
2. date: Find the date on the receipt. Convert to YYYY-MM-DD. Israeli date format is DD/MM/YYYY.
3. total: Find the FINAL total amount (look for: סה"כ, סה"כ לתשלום, סכום לתשלום, total, amount due). Use the LARGEST amount or the one labeled as total.
4. vat: Find VAT/tax amount (מע"מ, VAT). Use 0 if not found.
5. currency: "₪" for Israeli Shekel (default), "$" for USD, "€" for EUR.
6. items: List every product/item line you can find. Each item: name=description, quantity=how many, price=unit price.
7. All numbers must be numeric (not strings). No ₪ or $ inside numbers.
8. If you cannot read the image or it is NOT a receipt/invoice, return: {"error":"not_invoice"}

IMPORTANT: Read Hebrew text right-to-left. Common Hebrew receipt words:
- סה"כ / סך הכל = total
- מחיר = price
- כמות = quantity
- מע"מ = VAT
- תאריך = date
- חשבונית / קבלה = invoice/receipt
`.trim()

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return ok(null)
  }

  if (req.method !== 'POST') {
    return ok({ error: 'method_not_allowed' })
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    return ok({ error: 'unauthorized' })
  }

  if (!GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY secret is not set')
    return ok({ error: 'not_configured', message: 'GEMINI_API_KEY secret is missing' })
  }

  let image: string, mimeType: string
  try {
    const body = await req.json()
    image = body.image
    mimeType = body.mimeType || 'image/jpeg'
    if (!image) throw new Error('Missing image')
  } catch (_e) {
    return ok({ error: 'bad_request', message: 'Missing image in request body' })
  }

  let modelRes: Response
  try {
    modelRes = await fetch(MODEL_URL, {
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
          temperature: 0.05,
          maxOutputTokens: 2048,
        },
      }),
    })
  } catch (e) {
    console.error('Model fetch error:', e)
    return ok({ error: 'model_unreachable', message: String(e) })
  }

  if (!modelRes.ok) {
    const errText = await modelRes.text()
    console.error('Model API error:', modelRes.status, errText)
    return ok({ error: 'gemini_api_error', status: modelRes.status, message: errText })
  }

  const modelData = await modelRes.json()
  const rawText: string = modelData?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

  // Strip markdown code blocks (```json ... ```)
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/im, '')
    .replace(/\s*```\s*$/im, '')
    .trim()

  // Extract JSON object from response in case there's surrounding text
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  const jsonStr = jsonMatch ? jsonMatch[0] : cleaned

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(jsonStr)
  } catch (_e) {
    console.error('Failed to parse response:', rawText.slice(0, 400))
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
