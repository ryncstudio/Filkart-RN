const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://hktiibwedhlcvcknmwmq.supabase.co';
const SERVICE_KEY  = 'sb_secret_WgQFeggC39-fIPVqBUYjeg_FafDf7QG';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// The new user who was activated manually (referral bonus was skipped)
const NEW_USER_EMAIL = process.argv[2] ?? 'jovie13@gmail.com';

async function main() {
  // 1. Find the new user and check who referred them
  const { data: newUser, error: userErr } = await supabase
    .from('users')
    .select('id, email, full_name, referred_by, plan_id')
    .eq('email', NEW_USER_EMAIL)
    .maybeSingle();

  if (userErr || !newUser) {
    console.error('❌  User not found:', NEW_USER_EMAIL);
    return;
  }

  console.log(`\n👤  New user: ${newUser.full_name} (${newUser.email})`);
  console.log(`    Plan: ${newUser.plan_id}`);
  console.log(`    Referred by: ${newUser.referred_by ?? 'nobody'}`);

  if (!newUser.referred_by) {
    console.log('\n⚠️   No referrer found — nothing to credit.');
    return;
  }

  // 2. Find the referrer
  const { data: referrer } = await supabase
    .from('users')
    .select('id, email, full_name')
    .eq('id', newUser.referred_by)
    .maybeSingle();

  if (!referrer) {
    console.error('❌  Referrer not found in DB');
    return;
  }

  console.log(`\n👤  Referrer: ${referrer.full_name} (${referrer.email})`);

  // 3. Determine bonus amount
  const bonus = newUser.plan_id === 'partner' ? 200 : 100;
  const txnType = newUser.plan_id === 'partner' ? 'partner_referral' : 'direct_referral';
  const label = newUser.plan_id === 'partner' ? 'Partner Seller Referral Bonus' : 'Direct Referral Bonus';

  // 4. Check if this referral bonus was already credited (avoid double-credit)
  const { data: existingTxn } = await supabase
    .from('wallet_transactions')
    .select('id')
    .eq('user_id', referrer.id)
    .eq('transaction_type', txnType)
    .eq('amount', bonus)
    .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // last hour
    .limit(1);

  // 5. Get referrer's current share_earn balance
  const { data: wallet } = await supabase
    .from('wallets')
    .select('share_earn')
    .eq('user_id', referrer.id)
    .maybeSingle();

  const currentBalance = Number(wallet?.share_earn ?? 0);
  console.log(`\n💰  Current Share & Earn balance: ₱${currentBalance}`);
  console.log(`    Crediting: +₱${bonus} (${label})`);

  // 6. Credit the wallet
  const { error: updateErr } = await supabase
    .from('wallets')
    .update({ share_earn: currentBalance + bonus })
    .eq('user_id', referrer.id);

  if (updateErr) {
    console.error('❌  Failed to credit wallet:', updateErr.message);
    return;
  }
  console.log(`  ✅  Balance updated: ₱${currentBalance} → ₱${currentBalance + bonus}`);

  // 7. Record the transaction
  const { error: txnErr } = await supabase.from('wallet_transactions').insert({
    user_id:          referrer.id,
    wallet_type:      'share',
    transaction_type: txnType,
    amount:           bonus,
    source_label:     label,
    status:           'completed',
  });

  if (txnErr) console.log('  ⚠️   Transaction log note:', txnErr.message);
  else console.log('  ✅  Transaction recorded');

  console.log(`\n🎉  Done! ₱${bonus} credited to ${referrer.full_name}'s Share & Earn wallet.`);
  console.log(`    New balance: ₱${currentBalance + bonus}\n`);
}

main().catch(console.error);
