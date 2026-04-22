import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// ── Config ────────────────────────────────────────────────────────────────
const SUPABASE_URL      = 'https://hktiibwedhlcvcknmwmq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_d3t7p3pwb5LcYTb1EU4soA_vFEtk6zk';

// ── Client ────────────────────────────────────────────────────────────────
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage:          AsyncStorage,
    autoRefreshToken: true,
    persistSession:   true,
    detectSessionInUrl: false,
  },
});

// ── Auth helpers ──────────────────────────────────────────────────────────

/**
 * Register a new user in Supabase Auth + insert into users table.
 * Registration does NOT set status to PAID — that happens via PayMongo webhook.
 */
export async function registerUser({ fullName, mobile, email, password, planId, planAmount }) {
  // 1. Create auth account
  const { data: authData, error: authErr } = await supabase.auth.signUp({
    email,
    password,
  });
  if (authErr) throw authErr;

  const userId = authData.user?.id;
  if (!userId) throw new Error('No user ID returned from auth');

  // 2. Insert into public.users
  const { error: profileErr } = await supabase.from('users').insert({
    id:            userId,
    full_name:     fullName,
    mobile_number: mobile,
    email,
    plan_id:       planId,
    plan_amount:   planAmount,
    status:        'Pending',
  });
  if (profileErr) throw profileErr;

  return userId;
}

/**
 * Create a pending payment record before redirecting to PayMongo.
 */
export async function createPendingPayment({ userId, planId, amount }) {
  const { data, error } = await supabase.from('payments').insert({
    user_id:  userId,
    plan_id:  planId,
    amount,
    status:   'pending',
  }).select().single();

  if (error) throw error;
  return data;
}

/**
 * Sign in with email/password.
 */
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

/**
 * Sign out.
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Get the current authenticated user's profile from public.users.
 */
export async function getCurrentUserProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('users')
    .select('*, wallets(*)')
    .eq('id', user.id)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get the user's wallet balances.
 */
export async function getWallet(userId) {
  const { data, error } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error) throw error;
  return data;
}

/**
 * Verify OTP via the Edge Function (only works for PAID users).
 */
export async function verifyOTP(userId, otpCode) {
  const { data, error } = await supabase.functions.invoke('verify-otp', {
    body: { user_id: userId, otp_code: otpCode },
  });
  if (error) throw error;
  return data;
}

/**
 * Create a PayMongo QR Ph payment source via Edge Function.
 * Returns { sourceId, checkoutUrl, qrCode, amount, planLabel }
 */
export async function createPayment({ userId, planId, amount, fullName = '', mobile = '' }) {
  const { data, error } = await supabase.functions.invoke('create-payment', {
    body: { userId, planId, amount, fullName, mobile },
  });
  if (error) {
    // Try to extract the real error from the response body
    let detail = error.message;
    try {
      if (error.context?.json) {
        const ctx = await error.context.json();
        detail = ctx.error ?? ctx.message ?? error.message;
      }
    } catch (_) {}
    throw new Error(detail);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

/**
 * Poll Supabase for the payment status of a user.
 * Returns 'pending' | 'paid' | 'failed'
 */
export async function checkPaymentStatus(userId) {
  const { data, error } = await supabase
    .from('payments')
    .select('status')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  if (error) return 'pending';
  return data?.status ?? 'pending';
}

/**
 * Check if user status is PAID (OTP gate).
 */
export async function getUserStatus(userId) {
  const { data, error } = await supabase
    .from('users')
    .select('status, otp_verified')
    .eq('id', userId)
    .single();
  if (error) return null;
  return data;
}
