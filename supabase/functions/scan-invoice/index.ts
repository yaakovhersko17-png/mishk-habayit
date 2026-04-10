/**
 * Supabase Edge Function: scan-invoice
 * Uses Gemini 2.0 Flash (vision) to extract invoice data.
 * GEMINI_API_KEY is stored only as a Supabase secret — never in frontend code.
 */

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? ''
const MODEL = 'gemini-1.5-flash'  // vision-capable, stable
const MODEL_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ── System instruction ────────────────────────────────────────────────────────
// Tells the model WHO it is before it even sees the image.
const SYSTEM_INSTRUCTION = `
You are an expert OCR system for Israeli receipts and invoices.
You read Hebrew (right-to-left) and English.
You always respond with a single valid JSON object and nothing else — no markdown, no code fences, no explanation.
`.trim()

// ── Extraction prompt ─────────────────────────────────────────────────────────
// Step-by-step guide so the model doesn't guess — it follows clear rules.
const EXTRACTION_PROMPT = `
Look carefully at the receipt/invoice image below and extract the data.

OUTPUT: One JSON object only. Schema:
{"business_name":"...","date":"YYYY-MM-DD","invoice_number":null,"total":0.00,"vat":0.00,"currency":"₪","items":[{"name":"...","quantity":1,"price":0.00}]}

--- EXTRACTION GUIDE ---

BUSINESS NAME:
- The largest text at the TOP of the receipt — store/restaurant/business name
- Hebrew label: שם העסק / שם החנות / בית עסק
- Write it exactly as it appears (Hebrew or English)

DATE:
- Find: תאריך / Date
- Israeli date format is DD/MM/YYYY → always convert to YYYY-MM-DD
- Example: 07/04/2025 → "2025-04-07"

INVOICE NUMBER:
- Find: מספר חשבונית / מספר קבלה / מס' / No. / Invoice #
- Use null if not present

ITEMS (every product/service line):
- Hebrew column headers: פריט/תיאור = item name, כמות = quantity, מחיר ליחידה = unit price
- Use the UNIT price per item (not the line total) for "price"
- If only a line total is shown and qty=1, use that as price
- quantity must be a number (default 1)
- price must be a number (no currency symbol)

VAT (מע"מ):
- Find: מע"מ / מס ערך מוסף / VAT
- In Israel VAT is 17% or 18% — it will be shown separately near the bottom
- Use 0 if not shown

TOTAL:
- The FINAL amount to pay — always at the BOTTOM of the receipt
- Hebrew labels: סה"כ לתשלום / סכום לתשלום / סה"כ / סך הכל / לתשלום
- English: Total / Amount Due / Grand Total
- This number INCLUDES VAT unless marked "לפני מע"מ" (before VAT)
- Ignore thousands separators: "1,234.50" → 1234.50

CURRENCY:
- ₪ or ש"ח or NIS → use "₪"  (default for Israeli receipts)
- $ or USD → use "$"
- € or EUR → use "€"

STRICT RULES:
1. All number fields (total, vat, price, quantity) must be NUMERIC — never strings
2. Do NOT put ₪ or $ or € inside a number value
3. If the image is NOT a receipt/invoice → return exactly: {"error":"not_invoice"}
4. If a field is unreadable → null for text fields, 0 for number fields
5. Return ONLY the JSON — no words before or after it
`.trim()

// ─────────────────────────────────────────────────────────────────────────────

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
        // System instruction — sets context BEFORE the image
        system_instruction: {
          parts: [{ text: SYSTEM_INSTRUCTION }],
        },
        contents: [{
          role: 'user',
          parts: [
            // Image first so the model can "see" before reading instructions
            { inlineData: { mimeType, data: image } },
            // Then the step-by-step extraction guide
            { text: EXTRACTION_PROMPT },
          ],
        }],
        generationConfig: {
          temperature: 0.0,   // 0 = fully deterministic, no hallucination
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
    console.error(`Model API error [${MODEL}]:`, modelRes.status, errText)
    return ok({ error: 'gemini_api_error', status: modelRes.status, message: errText })
  }

  const modelData = await modelRes.json()
  const rawText: string = modelData?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

  // Strip markdown code blocks (```json ... ```) in case model adds them
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/im, '')
    .replace(/\s*```\s*$/im, '')
    .trim()

  // Extract the JSON object — handles any stray text before/after
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
