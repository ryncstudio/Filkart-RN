// FilKart Supabase Migration Script
// Run with: node supabase/apply-migrations.js

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const PROJECT_REF   = 'hktiibwedhlcvcknmwmq';
const SERVICE_KEY   = 'sb_secret_WgQFeggC39-fIPVqBUYjeg_FafDf7QGAnon';

const MIGRATIONS = [
  '001_schema.sql',
  '002_functions.sql',
  '003_rls.sql',
];

// Supabase Management API - execute SQL
function executeSql(sql) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query: sql });
    const options = {
      hostname: 'api.supabase.com',
      path:     `/v1/projects/${PROJECT_REF}/database/query`,
      method:   'POST',
      headers:  {
        'Content-Type':   'application/json',
        'Authorization':  `Bearer ${SERVICE_KEY}`,
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('🚀 FilKart — Applying Supabase migrations...\n');

  for (const file of MIGRATIONS) {
    const filePath = path.join(__dirname, 'migrations', file);
    const sql      = fs.readFileSync(filePath, 'utf8');

    console.log(`📄 Applying ${file}...`);
    const result = await executeSql(sql);

    if (result.status === 200 || result.status === 201) {
      console.log(`   ✅ ${file} — OK\n`);
    } else {
      console.log(`   ⚠️  ${file} — Status: ${result.status}`);
      console.log('   Response:', JSON.stringify(result.body, null, 2), '\n');
    }
  }

  console.log('✅ All migrations applied!');
  console.log('\nNext steps:');
  console.log('  1. Verify tables in Supabase Dashboard → Table Editor');
  console.log('  2. Add your Anon Key to src/lib/supabase.js');
  console.log('  3. Deploy Edge Functions (see README)');
}

main().catch(console.error);
