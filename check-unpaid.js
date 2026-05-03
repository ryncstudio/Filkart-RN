const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://hktiibwedhlcvcknmwmq.supabase.co';
const SERVICE_KEY  = 'sb_secret_WgQFeggC39-fIPVqBUYjeg_FafDf7QG';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  // 1. Fetch ALL users (oldest first)
  const { data: users, error } = await supabase
    .from('users')
    .select('id, full_name, username, email, mobile_number, status, plan_id, plan_amount, referral_code, referred_by, created_at')
    .order('created_at', { ascending: true });

  if (error) { console.error('Error fetching users:', error.message); return; }

  // 2. Fetch ALL filled network_nodes (real placements after payment)
  const { data: nodes, error: nodesErr } = await supabase
    .from('network_nodes')
    .select('id, user_id, position, level, level_position, parent_id, filled_at')
    .not('user_id', 'is', null)
    .order('position', { ascending: true });

  if (nodesErr) { console.error('Error fetching nodes:', nodesErr.message); return; }

  // 3. Fetch vacant slots for capacity info
  const { data: vacantNodes } = await supabase
    .from('network_nodes')
    .select('id, position, level, level_position')
    .is('user_id', null)
    .order('position', { ascending: true });

  // Build lookups
  const userMap = {};
  users.forEach(u => { userMap[u.id] = u; });

  const nodeByUserId = {};
  nodes.forEach(n => { nodeByUserId[n.user_id] = n; });

  // Find the root user (Position 1 = Filkart Root)
  const rootNode = nodes.find(n => n.position === 1);
  const rootUser = rootNode ? userMap[rootNode.user_id] : null;

  // Separate users
  const unpaid = users.filter(u => u.status !== 'PAID' && u.status !== 'Active');
  const paid   = users.filter(u => u.status === 'PAID');
  const active = users.filter(u => u.status === 'Active');

  // Helper: referrer name
  const referrerName = (u) => {
    if (!u.referred_by) return '(none — ROOT account)';
    const ref = userMap[u.referred_by];
    return ref ? `${ref.full_name} (code: ${ref.referral_code})` : u.referred_by;
  };

  // Helper: date format
  const fmtDate = (iso) => {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  FILKART NETWORK & USER REPORT');
  console.log(`  Total users in database: ${users.length}`);
  console.log('  (Ordered by sign-up date — first signup at the top)');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // ── FILKART ROOT ──
  console.log('  👑 FILKART ROOT (Topmost Account)');
  console.log('  ─────────────────────────────────────────────────────');
  if (rootUser) {
    console.log(`     ${rootUser.full_name} (@${rootUser.username ?? '-'})`);
    console.log(`     Email:     ${rootUser.email}`);
    console.log(`     Mobile:    ${rootUser.mobile_number}`);
    console.log(`     My Code:   ${rootUser.referral_code}`);
    console.log(`     Signed Up: ${fmtDate(rootUser.created_at)}`);
  } else {
    console.log('     (no root user found)');
  }
  console.log();

  // ── LEVEL 1 (10 slots directly under root) ──
  // These are network positions 2–11 (Level 2 in DB, but "Level 1" from user perspective)
  const level1Nodes = nodes.filter(n => n.level === 2);
  const level1Vacant = (vacantNodes || []).filter(n => n.level === 2).length;

  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`  📊 LEVEL 1 MEMBERS  (${level1Nodes.length} of 10 slots filled | ${level1Vacant} vacant)`);
  console.log('  These are directly under Filkart Root');
  console.log('═══════════════════════════════════════════════════════════════════');
  if (level1Nodes.length === 0) {
    console.log('  (no members yet)\n');
  } else {
    level1Nodes.forEach((n, i) => {
      const u = userMap[n.user_id];
      if (!u) return;
      // Count how many people used this user's referral code (their Level 1)
      const theirReferrals = users.filter(r => r.referred_by === u.id && r.status === 'Active');
      const theirPending   = users.filter(r => r.referred_by === u.id && r.status === 'Pending');

      console.log(`\n  ${i + 1}. ✅ ${u.full_name} (@${u.username ?? '-'})  —  Position #${n.level_position}`);
      console.log(`     Email:        ${u.email}`);
      console.log(`     Mobile:       ${u.mobile_number}`);
      console.log(`     Plan:         ${u.plan_id ?? '-'} | ₱${u.plan_amount ?? 0}`);
      console.log(`     Referral Code:${u.referral_code}`);
      console.log(`     Signed Up:    ${fmtDate(u.created_at)}`);
      console.log(`     Placed At:    ${fmtDate(n.filled_at)}`);
      if (theirReferrals.length > 0) {
        console.log(`     Their Active Referrals: ${theirReferrals.map(r => r.full_name).join(', ')}`);
      }
      if (theirPending.length > 0) {
        console.log(`     Their Pending (unpaid): ${theirPending.map(r => r.full_name).join(', ')}`);
      }
    });
  }
  console.log();

  // ── LEVEL 2 (100 slots — under Level 1 members) ──
  const level2Nodes = nodes.filter(n => n.level === 3);
  const level2Vacant = (vacantNodes || []).filter(n => n.level === 3).length;

  if (level2Nodes.length > 0 || level2Vacant > 0) {
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log(`  📊 LEVEL 2 MEMBERS  (${level2Nodes.length} of 100 slots filled | ${level2Vacant} vacant)`);
    console.log('  These are under Level 1 members');
    console.log('═══════════════════════════════════════════════════════════════════');
    if (level2Nodes.length === 0) {
      console.log('  (no members yet)\n');
    } else {
      level2Nodes.forEach((n, i) => {
        const u = userMap[n.user_id];
        console.log(`  ${i + 1}. ✅ ${u?.full_name ?? '???'} (@${u?.username ?? '-'})  —  Position #${n.level_position}`);
      });
      console.log();
    }
  }

  // ── SIGNED UP BUT DID NOT PAY ──
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`  ⏳ SIGNED UP BUT DID NOT PAY (${unpaid.length} users)`);
  console.log('  NOT in the network — they must pay first to be placed');
  console.log('═══════════════════════════════════════════════════════════════════');
  if (unpaid.length === 0) {
    console.log('  (none)\n');
  } else {
    unpaid.forEach((u, i) => {
      console.log(`\n  ${i + 1}. ${u.full_name}`);
      console.log(`     Email:        ${u.email}`);
      console.log(`     Mobile:       ${u.mobile_number}`);
      console.log(`     Used Code Of: ${referrerName(u)}`);
      console.log(`     Plan Chosen:  ${u.plan_id ?? 'none'} | ₱${u.plan_amount ?? 0}`);
      console.log(`     Signed Up:    ${fmtDate(u.created_at)}`);
    });
    console.log();
  }

  // ── SUMMARY ──
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log(`  👑 Filkart Root:                 ${rootUser?.full_name ?? '(none)'}`);
  console.log(`  ✅ Level 1 (under root):         ${level1Nodes.length} / 10 slots`);
  console.log(`  ✅ Level 2 (under Level 1):      ${level2Nodes.length} / 100 slots`);
  console.log(`  💳 Paid but stuck at OTP:        ${paid.length}`);
  console.log(`  ⏳ Signed up, never paid:        ${unpaid.length}`);
  console.log(`  🔲 Total vacant network slots:   ${(vacantNodes || []).length}`);
  console.log('═══════════════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
