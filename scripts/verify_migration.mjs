import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.*)/)[1].trim();

const client = createClient(url, key);

async function runComprehensiveVerification() {
  console.log('====================================================');
  console.log('POST-MIGRATION SECURITY & FUNCTIONALITY TEST SUITE');
  console.log('====================================================\n');

  // 1. Check Tables Existence via REST
  console.log('1. Checking Public Tables:');
  const tables = ['restaurants', 'categories', 'menu_items', 'offers'];
  for (const t of tables) {
    const { data, error } = await client.from(t).select('*').limit(1);
    if (error) {
      console.log(`   ❌ Table '${t}' failed: ${error.message}`);
    } else {
      console.log(`   ✅ Table '${t}' is active and queryable! (Count: ${data.length})`);
    }
  }

  // 2. Check Storage Bucket
  console.log('\n2. Checking Storage Bucket:');
  const { data: buckets, error: bErr } = await client.storage.listBuckets();
  if (bErr) {
    console.log(`   ❌ Bucket check error: ${bErr.message}`);
  } else {
    const target = (buckets || []).find(b => b.id === 'menu-images');
    if (target) {
      console.log(`   ✅ Storage bucket 'menu-images' exists! Public: ${target.public}`);
    } else {
      console.log(`   ⚠️ Storage bucket 'menu-images' not listed in client output.`);
    }
  }

  // 3. Test Public Customer Security Barrier (Unauthenticated)
  console.log('\n3. Testing Public Customer Permissions (Must be SELECT only):');
  
  // Try to illegally insert a restaurant without auth
  const { error: insertErr } = await client.from('restaurants').insert({
    name: 'Hacker Restaurant',
    slug: 'hacker-slug'
  });
  if (insertErr) {
    console.log(`   ✅ Unauthenticated INSERT blocked as expected: ${insertErr.message}`);
  } else {
    console.log(`   ❌ CRITICAL: Unauthenticated INSERT was allowed!`);
  }

  // Try to illegally delete categories without auth
  const { error: delErr } = await client.from('categories').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (delErr) {
    console.log(`   ✅ Unauthenticated DELETE blocked as expected: ${delErr.message}`);
  } else {
    console.log(`   ❌ CRITICAL: Unauthenticated DELETE was allowed!`);
  }

  // 4. Test Realtime Channel Connectivity
  console.log('\n4. Testing Realtime Subscription Channel:');
  const channel = client.channel('test-schema-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, () => {})
    .subscribe((status) => {
      console.log(`   Realtime channel connection status: ${status}`);
    });

  // Give Realtime 3 seconds to establish handshake
  await new Promise(res => setTimeout(res, 3000));
  await client.removeChannel(channel);

  console.log('\n====================================================');
  console.log('VERIFICATION COMPLETE');
  console.log('====================================================');
}

runComprehensiveVerification().catch(console.error);

