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

const PAID_GATE_MSG =
  'Activation requires a ₱880 or ₱1,500 payment. ' +
  'Please complete your subscription to receive your code.';

async function twilioSend(accountSid: string, authToken: string, serviceSid: string, e164: string) {
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
  return res.json();
}

async function twilioCheck(accountSid: string, authToken: string, serviceSid: string, e164: string, code: string) {
  const res = await fetch(
    `https://verify.twilio.com/v2/Services/${serviceSid}/VerificationCheck`,
    {
      method: 'POST',
      headers: {
        Authorization:  'Basic ' + btoa(`${accountSid}:${authToken}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: e164, Code: code }),
    }
  );
  return res.json();
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    (Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))!,
    { auth: { persistSession: false } }
  );

  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID') ?? '';
  const authToken  = Deno.env.get('TWILIO_AUTH_TOKEN') ?? '';
  const serviceSid = Deno.env.get('TWILIO_VERIFY_SERVICE_SID') ?? '';

  let body: { action?: string; user_id: string; otp_code?: string };
  try { body = await req.json(); }
  catch { return json({ error: 'Invalid JSON' }, 400); }

  const { action = 'verify', user_id, otp_code } = body;
  if (!user_id) return json({ error: 'user_id is required' }, 400);

  // ── Fetch user status + mobile via SECURITY DEFINER ───────────────────────
  const { data: userRow } = await supabase
    .rpc('get_user_status_mobile', { p_user_id: user_id });

  const user = userRow?.[0] ?? userRow;
  if (!user) return json({ error: 'User not found' }, 404);

  const e164 = (user.mobile_number ?? '').startsWith('+')
    ? user.mobile_number
    : `+63${(user.mobile_number ?? '').replace(/^0/, '')}`;

  // ────────────────────────────────────────────────────────────────────────────
  // ACTION: send — resend the OTP code (only for PAID users)
  // ────────────────────────────────────────────────────────────────────────────
  if (action === 'send') {
    if (user.status !== 'PAID') {
      return json({ error: PAID_GATE_MSG, status: user.status }, 403);
    }
    if (!accountSid) return json({ error: 'Twilio not configured' }, 503);

    const r = await twilioSend(accountSid, authToken, serviceSid, e164);
    if (r.status === 'pending') return json({ success: true, sent: true });
    return json({ error: 'Failed to send OTP', detail: r }, 502);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // ACTION: verify — check the OTP code, activate account, run auto-spill
  // ────────────────────────────────────────────────────────────────────────────
  if (!otp_code) return json({ error: 'otp_code is required' }, 400);

  // Gate: only PAID users can verify OTP
  if (user.status !== 'PAID') {
    return json({ error: PAID_GATE_MSG, status: user.status }, 403);
  }

  if (!accountSid) return json({ error: 'Twilio not configured' }, 503);

  // ── Developer Bypass for Twilio Trial ──
  if (otp_code === '111111') {
    console.log('Master OTP used by', e164);
  } else {
    // Verify OTP with Twilio
    const twilioData = await twilioCheck(accountSid, authToken, serviceSid, e164, otp_code);
    if (twilioData.status !== 'approved') {
      return json({ error: 'Invalid or expired OTP. Please try again.', twilio_status: twilioData.status }, 400);
    }
  }

  // ── Activate account (SECURITY DEFINER — bypasses RLS) ───────────────────
  await supabase.rpc('activate_user_after_otp', { p_user_id: user_id });

  // ── Auto-Spill: place user in Power of 10 network (Left → Right, FCFS) ──
  const { data: spillResult, error: spillErr } = await supabase
    .rpc('auto_spill_user', { p_user_id: user_id });
  if (spillErr) console.error('Auto-spill error:', spillErr.message);

  // ── Credit Referrer's Share & Earn Wallet ─────────────────────────────────
  // ₱100 for affiliate referral, ₱200 for partner referral
  try {
    const { data: newUser } = await supabase
      .from('users')
      .select('referred_by, plan_id')
      .eq('id', user_id)
      .maybeSingle();

    if (newUser?.referred_by) {
      const referrerId = newUser.referred_by;
      const planId     = newUser.plan_id ?? 'affiliate';
      const bonus      = planId === 'partner' ? 200 : 100;
      const txnType    = planId === 'partner' ? 'partner_referral' : 'direct_referral';
      const label      = planId === 'partner'
        ? 'Partner Seller Referral Bonus'
        : 'Direct Referral Bonus';

      // Fetch referrer's current share_earn balance
      const { data: wallet } = await supabase
        .from('wallets')
        .select('share_earn')
        .eq('user_id', referrerId)
        .maybeSingle();

      const currentBalance = Number(wallet?.share_earn ?? 0);

      // Credit the wallet
      await supabase
        .from('wallets')
        .update({ share_earn: currentBalance + bonus })
        .eq('user_id', referrerId);

      // Record the transaction
      await supabase.from('wallet_transactions').insert({
        user_id:          referrerId,
        wallet_type:      'share',
        transaction_type: txnType,
        amount:           bonus,
        source_label:     label,
        status:           'completed',
      });

      console.log(`Credited ₱${bonus} to referrer ${referrerId} (${txnType})`);
    }
  } catch (refErr) {
    // Non-fatal — don't block account activation if referral credit fails
    console.error('Referral credit error:', (refErr as Error).message);
  }

  return json({
    success:  true,
    message:  'Account activated successfully!',
    spill:    spillResult,
  });
});
