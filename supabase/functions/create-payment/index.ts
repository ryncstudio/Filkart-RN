import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const PAYMONGO_API = 'https://api.paymongo.com/v1';
const PLAN_LABELS: Record<string, string> = {
  affiliate: 'FilKart Affiliate Plan',
  partner:   'FilKart Partner Sales Plan',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    (Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))!,
    { auth: { persistSession: false } }
  );

  const PAYMONGO_SECRET = Deno.env.get('PAYMONGO_SECRET_KEY') ?? '';

  let body: { userId: string; planId: string; amount: number; fullName?: string; mobile?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }

  const { userId, planId, amount, fullName = '', mobile = '' } = body;
  if (!userId || !planId || !amount) {
    return json({ error: 'userId, planId, and amount are required' }, 400);
  }

  const amountCentavos = Math.round(amount * 100);
  const planLabel      = PLAN_LABELS[planId] ?? 'FilKart Subscription';

  // ── Create PayMongo Checkout Session (supports QRPh, GCash, cards) ───────
  const sessionRes = await fetch(`${PAYMONGO_API}/checkout_sessions`, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + btoa(`${PAYMONGO_SECRET}:`),
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      data: {
        attributes: {
          billing: {
            name:  fullName,
            phone: mobile.startsWith('+') ? mobile : `+63${mobile.replace(/^0/, '')}`,
          },
          send_email_receipt:   false,
          show_description:     true,
          show_line_items:      true,
          line_items: [{
            currency:    'PHP',
            amount:      amountCentavos,
            description: planLabel,
            name:        planLabel,
            quantity:    1,
          }],
          payment_method_types: ['qrph', 'gcash', 'grab_pay', 'paymaya', 'card'],
          reference_number: userId.replace(/-/g, '').slice(0, 20),
          success_url: 'https://hktiibwedhlcvcknmwmq.supabase.co/payment/success',
          cancel_url:  'https://hktiibwedhlcvcknmwmq.supabase.co/payment/cancel',
          metadata: {
            user_id:   userId,
            plan_id:   planId,
            mobile,
            full_name: fullName,
          },
        },
      },
    }),
  });

  const sessionBody = await sessionRes.json();
  if (!sessionRes.ok) {
    return json({ error: 'PayMongo error', details: sessionBody }, 502);
  }

  const session      = sessionBody.data;
  const sessionAttrs = session.attributes;

  // ── Save pending payment ────────────────────────────────────────────────
  await supabase.from('payments').insert({
    user_id:            userId,
    paymongo_source_id: session.id,
    amount,
    plan_id:            planId,
    status:             'pending',
  });

  // ── Update user plan ────────────────────────────────────────────────────
  await supabase.from('users').update({
    plan_id:     planId,
    plan_amount: amount,
    updated_at:  new Date().toISOString(),
  }).eq('id', userId);

  return json({
    sourceId:    session.id,
    checkoutUrl: sessionAttrs.checkout_url ?? null,
    qrCode:      null,
    amount,
    planId,
    planLabel,
    status:      sessionAttrs.status,
  });
});
