/**
 * Supabase Edge Function: voice-command
 * Parses Hebrew voice commands from Siri Shortcuts and executes them.
 * Auth: Bearer JWT from Supabase auth (user's access_token).
 *
 * Supported commands:
 *   "הוצאה 50 שקל על אוכל"    → add expense transaction
 *   "הוצאה 150 שקל"           → add expense (no category)
 *   "הכנסה 2000 שקל"          → add income transaction
 *   "כמה כסף יש לי"           → return total wallet balance
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function respond(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function parseCommand(cmd: string): { action: string; amount?: number; note?: string } | null {
  const text = cmd.trim()

  // Balance query
  if (/כמה כסף|יתרה|מה היתרה/.test(text)) {
    return { action: 'balance' }
  }

  // Expense: "הוצאה 50 שקל על אוכל" or "הוצאה 50"
  const expMatch = text.match(/הוצא[הי]\s+(\d+(?:\.\d+)?)\s*(?:שקל(?:ים)?|₪)?\s*(?:על\s+(.+))?/)
  if (expMatch) {
    return { action: 'expense', amount: parseFloat(expMatch[1]), note: expMatch[2]?.trim() }
  }

  // Income: "הכנסה 2000 שקל"
  const incMatch = text.match(/הכנס[הי]\s+(\d+(?:\.\d+)?)\s*(?:שקל(?:ים)?|₪)?(?:\s+(?:מ|על|בגין)\s+(.+))?/)
  if (incMatch) {
    return { action: 'income', amount: parseFloat(incMatch[1]), note: incMatch[2]?.trim() }
  }

  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // Auth — extract user from JWT
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return respond({ error: 'חסר Authorization header' }, 401)
  }
  const token = authHeader.slice(7)

  // User-scoped client (respects RLS)
  const userClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  // Verify token + get user
  const { data: { user }, error: authErr } = await userClient.auth.getUser(token)
  if (authErr || !user) return respond({ error: 'Token לא תקין' }, 401)

  let body: { command?: string }
  try { body = await req.json() } catch { return respond({ error: 'JSON לא תקין' }, 400) }

  const command = body?.command?.trim()
  if (!command) return respond({ error: 'חסר שדה command' }, 400)

  const parsed = parseCommand(command)
  if (!parsed) {
    return respond({
      error: 'לא הבנתי את הפקודה',
      hint: 'נסה: "הוצאה 50 שקל על אוכל" או "הכנסה 2000 שקל" או "כמה כסף יש לי"',
    }, 422)
  }

  // Service client for operations that need to bypass RLS (wallet update)
  const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  if (parsed.action === 'balance') {
    const { data: wallets, error } = await svc
      .from('wallets')
      .select('balance, name')
    if (error) return respond({ error: 'שגיאה בטעינת יתרה' }, 500)
    const total = (wallets ?? []).reduce((s, w) => s + Number(w.balance), 0)
    return respond({ message: `יתרה כוללת: ₪${total.toLocaleString('he-IL')}`, total })
  }

  if (parsed.action === 'expense' || parsed.action === 'income') {
    const today = new Date().toISOString().split('T')[0]
    const type = parsed.action === 'expense' ? 'expense' : 'income'

    // Get first wallet as default target
    const { data: wallets } = await svc.from('wallets').select('id, balance').limit(1).single()
    if (!wallets) return respond({ error: 'לא נמצא ארנק' }, 500)

    // Insert transaction
    const { error: txErr } = await svc.from('transactions').insert({
      user_id: user.id,
      wallet_id: wallets.id,
      type,
      amount: parsed.amount,
      description: parsed.note ?? (type === 'expense' ? 'הוצאה מסירי' : 'הכנסה מסירי'),
      date: today,
    })
    if (txErr) return respond({ error: 'שגיאה בהוספת עסקה', detail: txErr.message }, 500)

    // Update wallet balance
    const sign = type === 'income' ? 1 : -1
    const newBalance = Number(wallets.balance) + sign * (parsed.amount ?? 0)
    await svc.from('wallets').update({ balance: newBalance }).eq('id', wallets.id)

    const verb = type === 'expense' ? 'הוצאה' : 'הכנסה'
    const noteStr = parsed.note ? ` על ${parsed.note}` : ''
    return respond({
      message: `נרשמה ${verb} של ₪${parsed.amount}${noteStr}`,
      type,
      amount: parsed.amount,
      note: parsed.note,
    })
  }

  return respond({ error: 'פקודה לא מוכרת' }, 400)
})
