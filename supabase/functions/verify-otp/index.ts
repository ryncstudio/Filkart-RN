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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    (Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))!,
    { auth: { persistSession: false } }
  );

  const { user_id, otp_code } = await req.json();

  if (!user_id || !otp_code) {
    return json({ error: 'user_id and otp_code are required' }, 400);
  }

  // ── Gate: only PAID users may verify OTP ─────────────────────────────
  const { data: user, error: userErr } = await supabase
    .from('users')
    .select('id, mobile_number, status, otp_verified')
    .eq('id', user_id)
    .single();

  if (userErr || !user) return json({ error: 'User not found' }, 404);

  if (user.status !== 'PAID') {
    return json({ error: 'OTP only available after payment.', status: user.status }, 403);
  }

  if (user.otp_verified) {
    return json({ error: 'OTP already verified', already_active: true });
  }

  // ── Verify OTP with Twilio ─────────────────────────────────────────────
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID') ?? '';
  const authToken  = Deno.env.get('TWILIO_AUTH_TOKEN') ?? '';
  const serviceSid = Deno.env.get('TWILIO_VERIFY_SERVICE_SID') ?? '';

  if (!accountSid) {
    return json({ error: 'Twilio not configured on server' }, 503);
  }

  const e164 = user.mobile_number.startsWith('+')
    ? user.mobile_number
    : `+63${user.mobile_number.replace(/^0/, '')}`;

  const twilioRes = await fetch(
    `https://verify.twilio.com/v2/Services/${serviceSid}/VerificationCheck`,
    {
      method: 'POST',
      headers: {
        Authorization:  'Basic ' + btoa(`${accountSid}:${authToken}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: e164, Code: otp_code }),
    }
  );

  const twilioData = await twilioRes.json();
  if (twilioData.status !== 'approved') {
    return json({ error: 'Invalid or expired OTP', twilio_status: twilioData.status }, 400);
  }

  // ── Activate user ──────────────────────────────────────────────────────
  const { error: activateErr } = await supabase
    .rpc('activate_user_after_otp', { p_user_id: user_id });

  if (activateErr) return json({ error: activateErr.message }, 500);

  return json({ success: true, message: 'Account activated successfully!' });
});
