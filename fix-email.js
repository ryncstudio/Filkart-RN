const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://hktiibwedhlcvcknmwmq.supabase.co';
const SERVICE_KEY  = 'sb_secret_WgQFeggC39-fIPVqBUYjeg_FafDf7QG';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const OLD_EMAIL = 'jovie13@gmail.com';
const NEW_EMAIL = 'jojie13@gmail.com';

async function main() {
  console.log(`\n📧  Changing email: ${OLD_EMAIL} → ${NEW_EMAIL}\n`);

  // 1. Find user in public.users
  const { data: user, error: findErr } = await supabase
    .from('users')
    .select('id, email, full_name')
    .eq('email', OLD_EMAIL)
    .maybeSingle();

  if (findErr || !user) {
    console.error('❌  User not found with email:', OLD_EMAIL);
    return;
  }

  console.log(`  Found: ${user.full_name} (${user.id})`);

  // 2. Update email in public.users table
  const { error: updateErr } = await supabase
    .from('users')
    .update({ email: NEW_EMAIL })
    .eq('id', user.id);

  if (updateErr) {
    console.error('❌  Failed to update users table:', updateErr.message);
    return;
  }
  console.log('  ✅  public.users email updated');

  // 3. Update email in Supabase Auth (auth.users)
  const { error: authErr } = await supabase.auth.admin.updateUserById(user.id, {
    email: NEW_EMAIL,
    email_confirm: true,  // auto-confirm so they don't need to verify
  });

  if (authErr) {
    console.error('❌  Failed to update auth email:', authErr.message);
    return;
  }
  console.log('  ✅  auth.users email updated');

  console.log(`\n🎉  Done! Jojie can now log in with: ${NEW_EMAIL}\n`);
}

main().catch(console.error);
