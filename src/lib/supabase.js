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

// ── Generate unique referral code (FK + 6 chars) ─────────────────────────────
function generateReferralCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid confusion
  let code = 'FK';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// ── Auth helpers ──────────────────────────────────────────────────────────

/**
 * Register a new user in Supabase Auth + insert into users table.
 * Registration does NOT set status to PAID — that happens via PayMongo webhook.
 */
export async function registerUser({ fullName, username, mobile, email, password, planId, planAmount, referralCode }) {
  // 1. Create auth account
  const { data: authData, error: authErr } = await supabase.auth.signUp({
    email,
    password,
  });
  if (authErr) throw authErr;

  const userId = authData.user?.id;
  if (!userId) throw new Error('No user ID returned from auth');

  // 2. Generate a unique referral code for this new user
  const myReferralCode = generateReferralCode();

  // 3. Resolve referrer's user_id if a referral code was provided
  //    Uses RPC function with SECURITY DEFINER to bypass RLS
  //    (RLS only lets users read their own row, but we need to look up
  //     someone else's referral code during signup)
  let referredBy = null;
  if (referralCode) {
    const { data: referrerId, error: refErr } = await supabase
      .rpc('validate_referral_code', { p_code: referralCode.trim() });

    if (refErr) {
      console.warn('Referral code lookup error:', refErr.message);
    }

    if (referrerId) {
      referredBy = referrerId;
    } else {
      // Clean up: sign out the auth account we just created since referral is invalid
      // (the user can re-try with a different code)
      await supabase.auth.signOut();
      throw new Error('Invalid referral code. Please check the code and try again.');
    }
  }

  // 4. Insert into public.users
  const { error: profileErr } = await supabase.from('users').insert({
    id:            userId,
    full_name:     fullName,
    username:      username || null,
    mobile_number: mobile,
    email,
    plan_id:       planId,
    plan_amount:   planAmount,
    status:        'Pending',
    referred_by:   referredBy,
    referral_code: myReferralCode,
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
    body: { action: 'verify', user_id: userId, otp_code: otpCode },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

/**
 * Send (or resend) OTP to the user's mobile. Only works for PAID users.
 */
export async function sendOTP(userId) {
  const { data, error } = await supabase.functions.invoke('verify-otp', {
    body: { action: 'send', user_id: userId },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
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
  // Check users.status (not payments.status) to avoid a race condition:
  // the webhook calls mark_payment_as_paid THEN mark_user_as_paid.
  // If we detect payments.status='paid' before users.status='PAID',
  // resolveScreenForUser would still return 'membership' instead of 'otp'.
  const { data } = await supabase
    .from('users')
    .select('status')
    .eq('id', userId)
    .single();
  return data?.status === 'PAID' ? 'paid' : 'pending';
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

/**
 * Get last 5 transactions for a user (Recent Activities).
 */
export async function getTransactions(userId) {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(5);
  if (error) return [];
  return data || [];
}

/**
 * Get affiliates at a specific level of the Power of 10 network.
 * Uses RPC function that computes levels from users.referred_by chain.
 */
export async function getNetworkByLevel(userId, level) {
  const { data, error } = await supabase
    .rpc('get_network_by_level', { p_user_id: userId, p_level: level });
  if (error) {
    console.warn('getNetworkByLevel error:', error.message);
    return [];
  }
  // Map to the shape NetworkScreen expects: { referred_id, position, users: { username, full_name } }
  return (data || []).map(row => ({
    referred_id: row.referred_id,
    position: row.pos,
    users: { username: row.username, full_name: row.full_name },
  }));
}

/**
 * Get the user who referred this user (Topmost Account).
 * Uses RPC function that looks up users.referred_by.
 */
export async function getReferrer(userId) {
  const { data, error } = await supabase
    .rpc('get_referrer', { p_user_id: userId });
  if (error) {
    console.warn('getReferrer error:', error.message);
    return null;
  }
  if (!data || data.length === 0) return null;
  const row = data[0];
  // Map to the shape NetworkScreen expects: { referrer_id, users: { username, full_name } }
  return {
    referrer_id: row.referrer_id,
    users: { username: row.username, full_name: row.full_name },
  };
}

/**
 * Get total count of affiliates at a specific level (for capacity display on cards).
 * Uses RPC function that counts from users.referred_by chain.
 */
export async function getNetworkCountByLevel(userId, level) {
  const { data, error } = await supabase
    .rpc('get_network_count_by_level', { p_user_id: userId, p_level: level });
  if (error) {
    console.warn('getNetworkCountByLevel error:', error.message);
    return 0;
  }
  return data ?? 0;
}

/**
 * Save a user's interest in being notified when the shop goes live.
 *
 * ── Supabase SQL (run once in Dashboard SQL editor) ───────────────────────
 * CREATE TABLE IF NOT EXISTS shop_notify (
 *   id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *   user_id    uuid REFERENCES users(id) ON DELETE CASCADE,
 *   feature    text NOT NULL DEFAULT 'shop_essentials',
 *   created_at timestamptz DEFAULT now(),
 *   UNIQUE(user_id, feature)
 * );
 * ALTER TABLE shop_notify ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "Users can insert own notify" ON shop_notify
 *   FOR INSERT WITH CHECK (auth.uid() = user_id);
 * ─────────────────────────────────────────────────────────────────────────
 */
export async function saveNotifyInterest(userId) {
  const { error } = await supabase
    .from('shop_notify')
    .upsert(
      { user_id: userId, feature: 'shop_essentials' },
      { onConflict: 'user_id,feature' }
    );
  if (error) throw error;
}

// ── Marketplace helpers ────────────────────────────────────────────────────
//
// Required SQL (run once in Supabase Dashboard → SQL Editor):
//
// CREATE TABLE IF NOT EXISTS products (
//   id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//   name         text NOT NULL,
//   partner_name text,
//   price        numeric NOT NULL DEFAULT 0,
//   category     text,
//   rating       numeric DEFAULT 0,
//   review_count int DEFAULT 0,
//   image_url    text,
//   is_trending  boolean DEFAULT true,
//   is_active    boolean DEFAULT true,
//   created_at   timestamptz DEFAULT now()
// );
//
// CREATE TABLE IF NOT EXISTS favorites (
//   id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//   user_id    uuid REFERENCES users(id) ON DELETE CASCADE,
//   product_id uuid REFERENCES products(id) ON DELETE CASCADE,
//   created_at timestamptz DEFAULT now(),
//   UNIQUE(user_id, product_id)
// );
//
// CREATE TABLE IF NOT EXISTS cart_items (
//   id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//   user_id    uuid REFERENCES users(id) ON DELETE CASCADE,
//   product_id uuid REFERENCES products(id) ON DELETE CASCADE,
//   quantity   int DEFAULT 1,
//   created_at timestamptz DEFAULT now(),
//   UNIQUE(user_id, product_id)
// );
// ─────────────────────────────────────────────────────────────────────────────

/** Fetch all active/trending products. */
export async function getProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  if (error) return [];
  return data || [];
}

/** Fetch all favorited products for a user. */
export async function getFavorites(userId) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('favorites')
    .select('product_id')
    .eq('user_id', userId);
  if (error) return [];
  return data || [];
}

/** Toggle a favorite — inserts if missing, deletes if present. */
export async function toggleFavorite(userId, productId) {
  if (!userId || !productId) return;
  const { data: existing } = await supabase
    .from('favorites')
    .select('id')
    .eq('user_id', userId)
    .eq('product_id', productId)
    .maybeSingle();

  if (existing) {
    await supabase.from('favorites').delete().eq('id', existing.id);
  } else {
    await supabase.from('favorites').insert({ user_id: userId, product_id: productId });
  }
}

/** Add a product to cart (upsert — increments quantity if already present). */
export async function addToCart(userId, productId, qty = 1, size = null) {
  if (!userId || !productId) return;
  const { data: existing } = await supabase
    .from('cart_items')
    .select('id, quantity')
    .eq('user_id', userId)
    .eq('product_id', productId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('cart_items')
      .update({ quantity: existing.quantity + qty })
      .eq('id', existing.id);
  } else {
    await supabase
      .from('cart_items')
      .insert({ user_id: userId, product_id: productId, quantity: qty, size: size });
  }
}

// ── Cart helpers ───────────────────────────────────────────────────────────────

export async function getCartItems(userId) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('cart_items')
    .select('id, quantity, size, products(id, name, price, image_url, category, partner_name)')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) return [];
  return data || [];
}

export function subscribeToCart(userId, callback) {
  return supabase
    .channel(`cart-${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'cart_items', filter: `user_id=eq.${userId}` }, callback)
    .subscribe();
}

export async function updateCartQuantity(cartItemId, quantity) {
  if (quantity < 1) return;
  await supabase.from('cart_items').update({ quantity }).eq('id', cartItemId);
}

export async function removeFromCart(cartItemId) {
  await supabase.from('cart_items').delete().eq('id', cartItemId);
}

export async function clearCart(userId) {
  await supabase.from('cart_items').delete().eq('user_id', userId);
}

// ── Delivery Address helpers ───────────────────────────────────────────────────

export async function getDeliveryAddresses(userId) {
  if (!userId) return [];
  const { data } = await supabase
    .from('delivery_addresses')
    .select('*')
    .eq('user_id', userId)
    .order('is_default', { ascending: false });
  return data || [];
}

export async function addDeliveryAddress(userId, addr) {
  // If setting as default, clear other defaults first
  if (addr.is_default) {
    await supabase.from('delivery_addresses').update({ is_default: false }).eq('user_id', userId);
  }
  const { data, error } = await supabase
    .from('delivery_addresses')
    .insert({ user_id: userId, ...addr })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function setDefaultAddress(userId, addressId) {
  await supabase.from('delivery_addresses').update({ is_default: false }).eq('user_id', userId);
  await supabase.from('delivery_addresses').update({ is_default: true }).eq('id', addressId);
}

export async function deleteDeliveryAddress(addressId) {
  await supabase.from('delivery_addresses').delete().eq('id', addressId);
}

// ── Order helpers ──────────────────────────────────────────────────────────────

export async function placeOrder({ userId, cartItems, paymentMethod, walletType, addressSnapshot, subtotal, shippingFee }) {
  const total    = subtotal + shippingFee;
  const totalPv  = cartItems.reduce((sum, i) => sum + Math.round((i.products?.price ?? 0) * i.quantity * 0.1), 0);

  // Deduct from wallet if paying with Filkart Wallet
  if (paymentMethod === 'wallet' && walletType) {
    const col = walletType === 'commission' ? 'share_earn' : 'unilevel_cash';
    const { data: wallet } = await supabase.from('wallets').select(col).eq('user_id', userId).single();
    const balance = wallet?.[col] ?? 0;
    if (balance < total) throw new Error('Insufficient wallet balance');
    await supabase.from('wallets').update({ [col]: balance - total }).eq('user_id', userId);
  }

  // Create order
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .insert({
      user_id: userId,
      status: 'placed',
      payment_method: paymentMethod,
      wallet_type: walletType ?? null,
      subtotal,
      shipping_fee: shippingFee,
      total,
      total_pv: totalPv,
      delivery_address_snapshot: addressSnapshot,
    })
    .select()
    .single();
  if (orderErr) throw orderErr;

  // Insert order items
  const items = cartItems.map(i => ({
    order_id:      order.id,
    product_id:    i.products?.id ?? null,
    product_name:  i.products?.name ?? 'Product',
    product_image: i.products?.image_url ?? null,
    price:         i.products?.price ?? 0,
    quantity:      i.quantity,
    size:          i.size ?? null,
    pv:            Math.round((i.products?.price ?? 0) * i.quantity * 0.1),
  }));
  await supabase.from('order_items').insert(items);

  // Clear cart
  await supabase.from('cart_items').delete().eq('user_id', userId);

  // Credit unilevel points: 5 pts per ₱1,000, split 50/50 cash/credits
  creditUnilevelFromOrder(userId, total).catch(() => {});

  return order;
}

export async function getOrders(userId) {
  if (!userId) return [];
  const { data } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return data || [];
}

export async function getOrderById(orderId) {
  const { data } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('id', orderId)
    .single();
  return data;
}

export function subscribeToOrder(orderId, callback) {
  return supabase
    .channel(`order-${orderId}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` }, payload => callback(payload.new))
    .subscribe();
}

// ── Reviews ────────────────────────────────────────────────────────────────────

export async function getProductReviews(productId) {
  const { data } = await supabase
    .from('reviews')
    .select('*, users(username, full_name)')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .limit(20);
  return data || [];
}

export async function addReview(userId, productId, rating, comment) {
  const { error } = await supabase
    .from('reviews')
    .upsert({ user_id: userId, product_id: productId, rating, comment }, { onConflict: 'user_id,product_id' });
  if (error) throw error;
}

// ── Wallet Hub helpers ─────────────────────────────────────────────────────────

export async function getWalletFull(userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error) return null;
  return data;
}

export async function getWalletTransactions(userId, walletType = null, limit = 20) {
  if (!userId) return [];
  let q = supabase
    .from('wallet_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (walletType) q = q.eq('wallet_type', walletType);
  const { data } = await q;
  return data || [];
}

export async function requestWithdrawal({ userId, walletType, amount, mop, accountName, accountNumber, bankName }) {
  // Validate balance
  const wallet = await getWalletFull(userId);
  const balanceCol = walletType === 'unilevel_cash' ? 'unilevel_cash' : 'share_earn';
  const available = Number(wallet?.[balanceCol] ?? 0);
  if (amount > available) throw new Error('Amount exceeds available balance');

  // Deduct balance
  await supabase.from('wallets')
    .update({ [balanceCol]: available - amount })
    .eq('user_id', userId);

  // Record withdrawal
  await supabase.from('withdrawals').insert({
    user_id: userId, wallet_type: walletType, amount, mop,
    account_name: accountName, account_number: accountNumber, bank_name: bankName ?? null,
  });

  // Log transaction
  await supabase.from('wallet_transactions').insert({
    user_id: userId,
    wallet_type: walletType === 'unilevel_cash' ? 'unilevel' : 'share',
    transaction_type: 'withdrawal',
    amount: -amount,
    source_label: `${mop.toUpperCase()} Withdrawal`,
    status: 'pending',
  });
}

export async function convertToCredits(userId, amount) {
  const wallet = await getWalletFull(userId);
  const shareEarn = Number(wallet?.share_earn ?? 0);
  if (amount > shareEarn) throw new Error('Amount exceeds Share & Earn balance');

  await supabase.from('wallets').update({
    share_earn:       shareEarn - amount,
    unilevel_credits: Number(wallet?.unilevel_credits ?? 0) + amount,
  }).eq('user_id', userId);

  await supabase.from('wallet_transactions').insert([
    { user_id: userId, wallet_type: 'share', transaction_type: 'convert', amount: -amount, source_label: 'Converted to Credits' },
    { user_id: userId, wallet_type: 'unilevel', transaction_type: 'convert', amount, source_label: 'Credits from Share & Earn' },
  ]);
}

export async function creditUnilevelFromOrder(userId, orderTotal) {
  if (!userId || !orderTotal) return;
  const pts = Math.floor(orderTotal / 1000) * 5;
  if (pts <= 0) return;
  const cash    = pts * 0.5;
  const credits = pts * 0.5;

  const wallet = await getWalletFull(userId);
  await supabase.from('wallets').update({
    unilevel_cash:    Number(wallet?.unilevel_cash    ?? 0) + cash,
    unilevel_credits: Number(wallet?.unilevel_credits ?? 0) + credits,
  }).eq('user_id', userId);

  await supabase.from('wallet_transactions').insert({
    user_id: userId, wallet_type: 'unilevel',
    transaction_type: 'purchase_bonus',
    amount: pts, source_label: 'Purchase Bonus (50/50 Split)',
    status: 'completed',
  });
}

export async function creditShareEarn(userId, type = 'affiliate') {
  if (!userId) return;
  const amount = type === 'partner' ? 200 : 100;
  const wallet = await getWalletFull(userId);

  await supabase.from('wallets')
    .update({ share_earn: Number(wallet?.share_earn ?? 0) + amount })
    .eq('user_id', userId);

  await supabase.from('wallet_transactions').insert({
    user_id: userId, wallet_type: 'share',
    transaction_type: type === 'partner' ? 'partner_referral' : 'direct_referral',
    amount,
    source_label: type === 'partner' ? 'Partner Seller Referral' : 'Direct Referral Bonus',
    status: 'completed',
  });
}

export function subscribeToWallet(userId, callback) {
  return supabase
    .channel(`wallet-${userId}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'wallets', filter: `user_id=eq.${userId}` }, p => callback(p.new))
    .subscribe();
}

export function subscribeToWalletTransactions(userId, callback) {
  return supabase
    .channel(`wallet-txns-${userId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'wallet_transactions', filter: `user_id=eq.${userId}` }, p => callback(p.new))
    .subscribe();
}

export async function updateUserProfile(userId, updates) {
  const { error } = await supabase.from('users').update(updates).eq('id', userId);
  if (error) throw error;
}

export async function getUserOrders(userId) {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function cancelOrder(orderId, userId) {
  // 1. Get the order to check if it's pending/placed and its payment method
  const { data: order, error: fetchErr } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .eq('user_id', userId)
    .single();
  
  if (fetchErr) throw fetchErr;
  if (!order || (order.status !== 'placed' && order.status !== 'pending')) {
    throw new Error('Order cannot be cancelled at this stage.');
  }

  // 2. If paid via wallet, refund the user
  if (order.payment_method === 'wallet' && order.wallet_type) {
    const col = order.wallet_type === 'commission' ? 'share_earn' : 'unilevel_cash';
    const { data: wallet } = await supabase.from('wallets').select(col).eq('user_id', userId).single();
    if (wallet) {
      await supabase.from('wallets').update({ [col]: wallet[col] + order.total }).eq('user_id', userId);
      // Optional: Add a wallet transaction record for the refund
      await supabase.from('wallet_transactions').insert({
        user_id: userId,
        amount: order.total,
        transaction_type: 'refund',
        status: 'completed',
        source_label: `Refund for Order #${orderId.slice(0, 8)}`,
      });
    }
  }

  // 3. Update order status to cancelled
  const { error: updateErr } = await supabase
    .from('orders')
    .update({ status: 'cancelled' })
    .eq('id', orderId);

  if (updateErr) throw updateErr;
}

export function subscribeToOrders(userId, callback) {
  return supabase
    .channel(`orders-${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${userId}` }, callback)
    .subscribe();
}

