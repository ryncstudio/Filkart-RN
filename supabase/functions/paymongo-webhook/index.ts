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

// ── Send OTP via Twilio ──────────────────────────────────────────────────────
async function sendOTP(mobile: string): Promise<boolean> {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID') ?? '';
  const authToken  = Deno.env.get('TWILIO_AUTH_TOKEN') ?? '';
  const serviceSid = Deno.env.get('TWILIO_VERIFY_SERVICE_SID') ?? '';
  if (!accountSid || !authToken || !serviceSid) {
    console.warn('Twilio not configured — skipping OTP');
    return false;
  }
  const e164 = mobile.startsWith('+') ? mobile : `+63${mobile.replace(/^0/, '')}`;
  const res = await fetch(
    `https://verify.twilio.com/v2/Services/${serviceSid}/Verifications`,
    {
      method: 'POST',
      headers: {
        Authorization:  'Basic ' + btoa(`${accountSid}:${authToken}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: e164, Channel: 'sms' }),
    }
  );
  const r = await res.json();
  return r.status === 'pending';
}

// ── Capture GCash/QR source into a PayMongo payment ─────────────────────────
async function captureSourcePayment(
  sourceId: string,
  amount: number,
  metadata: Record<string, string>
) {
  const secret = Deno.env.get('PAYMONGO_SECRET_KEY')!;
  const res = await fetch('https://api.paymongo.com/v1/payments', {
    method: 'POST',
    headers: {
      Authorization:  'Basic ' + btoa(`${secret}:`),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      data: {
        attributes: {
          amount,
          currency: 'PHP',
          source:      { id: sourceId, type: 'source' },
          description: `FilKart subscription — ${metadata.full_name ?? ''}`,
          metadata,
        },
      },
    }),
  });
  return res.json();
}

// ────────────────────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    (Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))!,
    { auth: { persistSession: false } }
  );

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return json({ error: 'Invalid JSON' }, 400); }

  // ── Parse PayMongo webhook envelope ─────────────────────────────────────
  // Structure: body.data.attributes.type  (event type)
  //            body.data.attributes.data  (the source or payment object)
  const eventData  = body.data  as Record<string, unknown>;
  const eventAttrs = (eventData?.attributes ?? {}) as Record<string, unknown>;
  const eventType  = eventAttrs.type as string | undefined;
  const innerObj   = (eventAttrs.data ?? {}) as Record<string, unknown>;   // source or payment
  const innerAttrs = (innerObj.attributes ?? {}) as Record<string, unknown>;
  const metadata   = (innerAttrs.metadata ?? {}) as Record<string, string>;

  console.log('Webhook event:', eventType, '| inner id:', innerObj.id);

  // ── source.chargeable → capture payment ──────────────────────────────────
  if (eventType === 'source.chargeable') {
    const sourceId = innerObj.id as string;
    const amount   = innerAttrs.amount as number;   // centavos
    const userId   = metadata.user_id;

    if (!userId) return json({ error: 'No user_id in metadata' }, 400);

    const paymentResult = await captureSourcePayment(sourceId, amount, metadata);
    const paymentId = paymentResult?.data?.id ?? null;

    console.log('Captured payment:', paymentId);
    return json({ received: true, event: 'source.chargeable', payment_id: paymentId });
  }

  // ── payment.paid OR checkout_session.payment.paid → mark paid ────────────
  if (eventType === 'payment.paid' || eventType === 'checkout_session.payment.paid') {
    const paymentId = innerObj.id as string;
    const sourceId  = (innerAttrs.source as Record<string, unknown>)?.id as string
                   ?? (innerAttrs.checkout_session_id as string)
                   ?? '';
    const userId    = metadata.user_id;

    if (!userId) return json({ error: 'No user_id in metadata' }, 400);

    // 1. Mark payment as paid (SECURITY DEFINER — bypasses RLS)
    await supabase.rpc('mark_payment_as_paid', {
      p_source_id:  sourceId,
      p_payment_id: paymentId,
    });

    // 2. Mark user as PAID (SECURITY DEFINER — bypasses RLS)
    await supabase.rpc('mark_user_as_paid', { p_user_id: userId });

    // 3. Get mobile + send OTP (auto-spill now runs AFTER OTP verification)
    const { data: mobile } = await supabase
      .rpc('get_user_mobile', { p_user_id: userId });
    let otpSent = false;
    if (mobile) otpSent = await sendOTP(mobile as string);

    return json({ success: true, user_id: userId, otp_sent: otpSent });
  }

  return json({ received: true, skipped: true, type: eventType });
});
