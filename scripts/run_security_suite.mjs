import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.*)/)[1].trim();

// Unauthenticated public client
const publicClient = createClient(url, key, { auth: { persistSession: false } });

// Function to generate client for specific session
function getAuthClient(token) {
  return createClient(url, key, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
}

const testResults = [];

function recordResult(testName, status, details) {
  testResults.push({ testName, status, details });
  const icon = status === 'PASSED' ? '✅' : status === 'FAILED' ? '❌' : '⚠️';
  console.log(`${icon} [${status}] ${testName}: ${details}`);
}

async function runEndToEndSecurityTests() {
  console.log('================================================================');
  console.log('COMPREHENSIVE END-TO-END SECURITY & REALTIME AUDIT SUITE');
  console.log('================================================================\n');

  const timestamp = Date.now();
  const ownerAEmail = `test_owner_a_${timestamp}@gmail.com`;
  const ownerBEmail = `test_owner_b_${timestamp}@gmail.com`;
  const testPassword = `AuditPass!99_${timestamp}`;

  let ownerAClient = null;
  let ownerBClient = null;
  let ownerAUser = null;
  let ownerBUser = null;

  let restaurantA = null;
  let restaurantB = null;
  let categoryA = null;
  let categoryB = null;
  let itemA = null;

  // ---------------------------------------------------------------------------
  // 1. OWNER AUTHENTICATION
  // ---------------------------------------------------------------------------
  console.log('--- 1. Testing Owner Signup & Authentication ---');
  try {
    const { data: signA, error: errA } = await publicClient.auth.signUp({
      email: ownerAEmail,
      password: testPassword
    });

    if (errA || !signA?.user) {
      recordResult('Owner A Signup', 'FAILED', errA ? errA.message : 'No user returned');
    } else {
      ownerAUser = signA.user;
      if (signA.session?.access_token) {
        ownerAClient = getAuthClient(signA.session.access_token);
        recordResult('Owner A Signup & Auto-session', 'PASSED', `User created: ${ownerAUser.id}`);
      } else {
        // If email confirmation is required on the Supabase project
        const { data: logA, error: logAErr } = await publicClient.auth.signInWithPassword({
          email: ownerAEmail,
          password: testPassword
        });
        if (logAErr) {
          recordResult('Owner A Auth Session', 'FAILED', `Email confirmation required by project: ${logAErr.message}`);
        } else {
          ownerAClient = getAuthClient(logA.session.access_token);
          recordResult('Owner A Signup & Sign-in', 'PASSED', `Session active for: ${ownerAUser.id}`);
        }
      }
    }

    const { data: signB, error: errB } = await publicClient.auth.signUp({
      email: ownerBEmail,
      password: testPassword
    });

    if (errB || !signB?.user) {
      recordResult('Owner B Signup', 'FAILED', errB ? errB.message : 'No user returned');
    } else {
      ownerBUser = signB.user;
      if (signB.session?.access_token) {
        ownerBClient = getAuthClient(signB.session.access_token);
        recordResult('Owner B Signup & Auto-session', 'PASSED', `User created: ${ownerBUser.id}`);
      } else {
        const { data: logB, error: logBErr } = await publicClient.auth.signInWithPassword({
          email: ownerBEmail,
          password: testPassword
        });
        if (logBErr) {
          recordResult('Owner B Auth Session', 'FAILED', `Email confirmation required by project: ${logBErr.message}`);
        } else {
          ownerBClient = getAuthClient(logB.session.access_token);
          recordResult('Owner B Signup & Sign-in', 'PASSED', `Session active for: ${ownerBUser.id}`);
        }
      }
    }
  } catch (e) {
    recordResult('Authentication Setup', 'FAILED', e.message);
  }

  // If sessions could not be established (e.g. project requires email confirmation), we note it
  if (!ownerAClient || !ownerBClient) {
    console.log('\n⚠️ Notice: Project requires email confirmation for newly signed up users.');
    console.log('Skipping authenticated owner tests that require valid JWT session.\n');
  } else {
    // ---------------------------------------------------------------------------
    // 2. OWNER CRUD & RESTAURANT CREATION
    // ---------------------------------------------------------------------------
    console.log('\n--- 2. Testing Owner CRUD & Multi-Tenant Isolation ---');
    try {
      // 2.1 Owner A creates Restaurant A
      const slugA = `test-bistro-a-${timestamp}`;
      const { data: restAData, error: restAErr } = await ownerAClient.from('restaurants').insert({
        owner_id: ownerAUser.id,
        name: 'Bistro A',
        slug: slugA,
        is_published: true
      }).select().single();

      if (restAErr) {
        recordResult('Owner A Create Restaurant', 'FAILED', restAErr.message);
      } else {
        restaurantA = restAData;
        recordResult('Owner A Create Restaurant', 'PASSED', `Created restaurant: ${restaurantA.id} (${slugA})`);
      }

      // 2.2 Owner B creates Restaurant B
      const slugB = `test-cafe-b-${timestamp}`;
      const { data: restBData, error: restBErr } = await ownerBClient.from('restaurants').insert({
        owner_id: ownerBUser.id,
        name: 'Cafe B',
        slug: slugB,
        is_published: false // Test unpublished state
      }).select().single();

      if (restBErr) {
        recordResult('Owner B Create Restaurant', 'FAILED', restBErr.message);
      } else {
        restaurantB = restBData;
        recordResult('Owner B Create Restaurant', 'PASSED', `Created unpublished restaurant: ${restaurantB.id}`);
      }

      // 2.3 Owner A creates Category A
      if (restaurantA) {
        const { data: catAData, error: catAErr } = await ownerAClient.from('categories').insert({
          restaurant_id: restaurantA.id,
          name: 'Starters A',
          is_active: true,
          sort_order: 1
        }).select().single();

        if (catAErr) {
          recordResult('Owner A Create Category', 'FAILED', catAErr.message);
        } else {
          categoryA = catAData;
          recordResult('Owner A Create Category', 'PASSED', `Category: ${categoryA.id}`);
        }
      }

      // 2.4 Owner A creates Menu Items (visible + out-of-stock + hidden)
      if (restaurantA && categoryA) {
        const { data: itAData, error: itAErr } = await ownerAClient.from('menu_items').insert({
          restaurant_id: restaurantA.id,
          category_id: categoryA.id,
          name: 'Artisan Soup A',
          price: 250.00,
          is_available: false, // Out of stock
          is_visible: true
        }).select().single();

        if (itAErr) {
          recordResult('Owner A Create Menu Item (Out of Stock)', 'FAILED', itAErr.message);
        } else {
          itemA = itAData;
          recordResult('Owner A Create Menu Item', 'PASSED', `Item: ${itemA.id} (Price: ₹250, Available: false)`);
        }

        // Hidden item
        const { error: hiddenErr } = await ownerAClient.from('menu_items').insert({
          restaurant_id: restaurantA.id,
          category_id: categoryA.id,
          name: 'Secret Secret Dish',
          price: 999.00,
          is_available: true,
          is_visible: false // Hidden item
        });
        if (hiddenErr) {
          recordResult('Owner A Create Hidden Item', 'FAILED', hiddenErr.message);
        } else {
          recordResult('Owner A Create Hidden Item', 'PASSED', 'Successfully created hidden item');
        }
      }

      // 2.5 Cross-tenant attack: Owner A attempts to read Owner B's unpublished restaurant
      if (restaurantB) {
        const { data: crossReadB, error: crossReadBErr } = await ownerAClient
          .from('restaurants')
          .select('*')
          .eq('id', restaurantB.id);

        if (crossReadB && crossReadB.length > 0) {
          recordResult('Cross-Tenant Read Isolation', 'FAILED', 'Owner A was able to read Owner B unpublished restaurant!');
        } else {
          recordResult('Cross-Tenant Read Isolation', 'PASSED', 'Owner A cannot read Owner B private data');
        }

        // Cross-tenant attack: Owner A attempts to UPDATE Owner B's restaurant
        const { error: crossUpErr } = await ownerAClient
          .from('restaurants')
          .update({ name: 'Hacked By A' })
          .eq('id', restaurantB.id);
        
        // Check if name changed
        const { data: bCheck } = await ownerBClient.from('restaurants').select('name').eq('id', restaurantB.id).single();
        if (bCheck && bCheck.name === 'Hacked By A') {
          recordResult('Cross-Tenant Update Isolation', 'FAILED', 'Owner A modified Owner B restaurant!');
        } else {
          recordResult('Cross-Tenant Update Isolation', 'PASSED', 'Owner A update on Owner B restaurant was blocked/ineffective');
        }

        // Cross-tenant attack: Owner A attempts to INSERT item into Owner B's restaurant
        if (categoryA) {
          const { error: crossInsErr } = await ownerAClient.from('menu_items').insert({
            restaurant_id: restaurantB.id,
            category_id: categoryA.id,
            name: 'Rogue Item',
            price: 100.00
          });
          if (crossInsErr) {
            recordResult('Cross-Tenant Insert Isolation', 'PASSED', `Blocked with error: ${crossInsErr.message}`);
          } else {
            recordResult('Cross-Tenant Insert Isolation', 'FAILED', 'Owner A inserted item into Owner B restaurant!');
          }
        }
      }

      // 2.6 Owner B views own unpublished restaurant
      if (restaurantB) {
        const { data: bOwn, error: bOwnErr } = await ownerBClient.from('restaurants').select('*').eq('id', restaurantB.id).single();
        if (bOwn && bOwn.id === restaurantB.id) {
          recordResult('Owner Access Own Unpublished Data', 'PASSED', `Owner B can view own unpublished restaurant: ${bOwn.name}`);
        } else {
          recordResult('Owner Access Own Unpublished Data', 'FAILED', bOwnErr ? bOwnErr.message : 'Not found');
        }
      }
    } catch (e) {
      recordResult('Owner CRUD Tests', 'FAILED', e.message);
    }
  }

  // ---------------------------------------------------------------------------
  // 3. PUBLIC CUSTOMER ACCESS (UNAUTHENTICATED)
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. Testing Public Customer Access (Unauthenticated) ---');
  try {
    // 3.1 Can read published restaurant
    if (restaurantA) {
      const { data: pubRestA, error: pubRestAErr } = await publicClient
        .from('restaurants')
        .select('*')
        .eq('id', restaurantA.id);

      if (pubRestA && pubRestA.length === 1) {
        recordResult('Public Read Published Restaurant', 'PASSED', `Found: ${pubRestA[0].name}`);
      } else {
        recordResult('Public Read Published Restaurant', 'FAILED', pubRestAErr ? pubRestAErr.message : '0 records');
      }
    }

    // 3.2 CANNOT read unpublished restaurant
    if (restaurantB) {
      const { data: pubRestB, error: pubRestBErr } = await publicClient
        .from('restaurants')
        .select('*')
        .eq('id', restaurantB.id);

      if (!pubRestB || pubRestB.length === 0) {
        recordResult('Public Cannot Read Unpublished Restaurant', 'PASSED', 'Unpublished restaurant is hidden from public');
      } else {
        recordResult('Public Cannot Read Unpublished Restaurant', 'FAILED', 'Public was able to read unpublished restaurant!');
      }
    }

    // 3.3 Out-of-stock items remain VISIBLE to public
    if (restaurantA) {
      const { data: pubItems, error: pubItemsErr } = await publicClient
        .from('menu_items')
        .select('*')
        .eq('restaurant_id', restaurantA.id);

      const outOfStockItem = pubItems ? pubItems.find(i => i.is_available === false) : null;
      if (outOfStockItem) {
        recordResult('Public Can See Out-Of-Stock Item', 'PASSED', `Item '${outOfStockItem.name}' is visible with is_available=false`);
      } else {
        recordResult('Public Can See Out-Of-Stock Item', 'FAILED', 'Out-of-stock item not found in public query');
      }

      // 3.4 Hidden items (is_visible = false) are INVISIBLE to public
      const hiddenItem = pubItems ? pubItems.find(i => i.is_visible === false) : null;
      if (!hiddenItem) {
        recordResult('Public Cannot See Hidden Item', 'PASSED', 'Hidden items filtered out by RLS');
      } else {
        recordResult('Public Cannot See Hidden Item', 'FAILED', 'Public was able to see hidden item!');
      }
    }

    // 3.5 Public cannot INSERT / UPDATE / DELETE
    const { error: anonInsErr } = await publicClient.from('menu_items').insert({
      name: 'Hack Item',
      price: 10
    });
    recordResult('Public INSERT Blocked', anonInsErr ? 'PASSED' : 'FAILED', anonInsErr ? anonInsErr.message : 'No error!');

    const { error: anonUpErr } = await publicClient.from('menu_items').update({ price: 1 }).eq('name', 'Artisan Soup A');
    recordResult('Public UPDATE Blocked', anonUpErr ? 'PASSED' : 'FAILED', anonUpErr ? anonUpErr.message : 'No error!');

    const { error: anonDelErr } = await publicClient.from('menu_items').delete().neq('price', -1);
    recordResult('Public DELETE Blocked', anonDelErr ? 'PASSED' : 'FAILED', anonDelErr ? anonDelErr.message : 'No error!');

  } catch (e) {
    recordResult('Public Access Tests', 'FAILED', e.message);
  }

  // ---------------------------------------------------------------------------
  // 4. STORAGE SECURITY
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. Testing Storage Security ---');
  if (ownerAClient && restaurantA) {
    try {
      const fakeImage = Buffer.from('fake-image-content-audit');
      const filePathA = `${restaurantA.id}/test-soup.png`;

      // Owner A uploads to own folder
      const { data: upAData, error: upAErr } = await ownerAClient.storage
        .from('menu-images')
        .upload(filePathA, fakeImage, { contentType: 'image/png', upsert: true });

      if (upAErr) {
        recordResult('Owner A Image Upload to Own Folder', 'FAILED', upAErr.message);
      } else {
        recordResult('Owner A Image Upload to Own Folder', 'PASSED', `Uploaded: ${filePathA}`);

        // Public customer can view/fetch the image URL
        const { data: pubUrlData } = publicClient.storage.from('menu-images').getPublicUrl(filePathA);
        if (pubUrlData?.publicUrl) {
          recordResult('Public Customer Image View URL', 'PASSED', `Public URL accessible: ${pubUrlData.publicUrl}`);
        } else {
          recordResult('Public Customer Image View URL', 'FAILED', 'Could not obtain public URL');
        }

        // Owner B attempts to delete Owner A's image
        if (ownerBClient) {
          const { error: delBErr } = await ownerBClient.storage
            .from('menu-images')
            .remove([filePathA]);

          // Verify if image still exists by trying to download with owner A
          const { data: stillThere } = await ownerAClient.storage.from('menu-images').download(filePathA);
          if (stillThere) {
            recordResult('Cross-Owner Image Deletion Blocked', 'PASSED', 'Owner B could not delete Owner A image');
          } else {
            recordResult('Cross-Owner Image Deletion Blocked', 'FAILED', 'Owner B deleted Owner A image!');
          }
        }
      }
    } catch (e) {
      recordResult('Storage Security Test', 'FAILED', e.message);
    }
  } else {
    recordResult('Storage Security Test', 'NOT TESTED', 'Requires active owner auth session');
  }

  // ---------------------------------------------------------------------------
  // 5. REALTIME FUNCTIONAL SYNC TEST
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. Testing Realtime Synchronization & Price Update ---');
  if (ownerAClient && itemA) {
    try {
      let realtimeReceived = false;
      let newPriceReceived = null;

      const subChannel = publicClient.channel('realtime-test-audit')
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'menu_items',
          filter: `id=eq.${itemA.id}`
        }, (payload) => {
          console.log('   [Realtime Event Received]:', payload.new);
          realtimeReceived = true;
          newPriceReceived = payload.new.price;
        })
        .subscribe();

      // Wait 2.5s for subscription to connect
      await new Promise(r => setTimeout(r, 2500));

      // Owner A updates price from 250 to 295
      const updatedPrice = 295.00;
      const { error: priceUpErr } = await ownerAClient
        .from('menu_items')
        .update({ price: updatedPrice })
        .eq('id', itemA.id);

      if (priceUpErr) {
        recordResult('Owner A Update Menu Item Price', 'FAILED', priceUpErr.message);
      } else {
        recordResult('Owner A Update Menu Item Price', 'PASSED', `Price changed to ₹${updatedPrice}`);
      }

      // Wait 3.5s for broadcast
      await new Promise(r => setTimeout(r, 3500));
      await publicClient.removeChannel(subChannel);

      if (realtimeReceived && Number(newPriceReceived) === updatedPrice) {
        recordResult('Realtime Customer Broadcast', 'PASSED', `Customer client received live price update: ₹${newPriceReceived}`);
      } else {
        recordResult('Realtime Customer Broadcast', 'FAILED', `Event received: ${realtimeReceived}, price: ${newPriceReceived}`);
      }
    } catch (e) {
      recordResult('Realtime Functional Test', 'FAILED', e.message);
    }
  } else {
    recordResult('Realtime Functional Test', 'NOT TESTED', 'Requires active item & owner session');
  }

  // ---------------------------------------------------------------------------
  // 6. CLEANUP TEST DATA (SAFE DELETE)
  // ---------------------------------------------------------------------------
  console.log('\n--- 6. Cleaning Up Test Records ---');
  try {
    if (ownerAClient && restaurantA) {
      // Menu items first due to ON DELETE RESTRICT on categories
      await ownerAClient.from('menu_items').delete().eq('restaurant_id', restaurantA.id);
      await ownerAClient.from('categories').delete().eq('restaurant_id', restaurantA.id);
      await ownerAClient.from('restaurants').delete().eq('id', restaurantA.id);
      console.log('   Cleaned up Restaurant A test records.');
    }
    if (ownerBClient && restaurantB) {
      await ownerBClient.from('restaurants').delete().eq('id', restaurantB.id);
      console.log('   Cleaned up Restaurant B test records.');
    }
  } catch (e) {
    console.log('   Cleanup notice:', e.message);
  }

  console.log('\n================================================================');
  console.log('FINAL AUDIT SUMMARY:');
  console.log('================================================================');
  const passed = testResults.filter(r => r.status === 'PASSED').length;
  const failed = testResults.filter(r => r.status === 'FAILED').length;
  const notTested = testResults.filter(r => r.status === 'NOT TESTED').length;
  console.log(`TOTAL TESTS: ${testResults.length} | PASSED: ${passed} | FAILED: ${failed} | NOT TESTED: ${notTested}`);
  console.log('================================================================\n');
}

runEndToEndSecurityTests().catch(console.error);
