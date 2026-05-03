const { createClient } = require('@supabase/supabase-js');
const s = createClient('https://hktiibwedhlcvcknmwmq.supabase.co', 'sb_secret_WgQFeggC39-fIPVqBUYjeg_FafDf7QG', { auth: { persistSession: false } });

(async () => {
  const { data, error } = await s.from('products').select('id, name, price, category, is_active').order('created_at', { ascending: false });
  if (error) { console.error(error.message); return; }
  console.log('\nTotal products:', data.length, '\n');
  data.forEach((p, i) => {
    const status = p.is_active ? 'ACTIVE' : 'HIDDEN';
    console.log(`  ${i + 1}. [${status}] P${p.price} | ${p.category ?? '-'} | ${p.name}`);
  });
  console.log();
})();
