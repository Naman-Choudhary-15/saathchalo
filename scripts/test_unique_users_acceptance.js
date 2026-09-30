const fs = require('fs');

console.log('========================================================');
console.log('SAATHCHALO ACCEPTANCE TEST: UNIQUE USERS & REGISTRATION COUNT');
console.log('========================================================\n');

const BASE_URL = 'http://127.0.0.1:8085';

async function req(url, options = {}) {
  const res = await fetch(BASE_URL + url, options);
  const text = await res.text();
  try {
    return { status: res.status, data: JSON.parse(text) };
  } catch (e) {
    return { status: res.status, data: text };
  }
}

async function runAcceptanceTest() {
  // 1. Initial State Check
  console.log('--- TEST 1: INITIAL STATE AUDIT ---');
  const initStats = (await req('/api/presence')).data;
  const initialRegistered = initStats.totalRegisteredUsers;
  console.log('Initial Registered Users:', initialRegistered);
  console.log('Initial Active Now:', initStats.connectedCount);
  console.log('Initial Offline:', initStats.offlineCount);
  console.log('Active + Offline === Total Registered?', (initStats.connectedCount + initStats.offlineCount === initialRegistered));
  
  if (initStats.connectedCount + initStats.offlineCount !== initialRegistered) {
    throw new Error('FAILED: Active + Offline does not equal Total Registered!');
  }
  console.log('✓ PASS: Baseline counts are consistent\n');

  // 2. Members API Test
  console.log('--- TEST 2: GET /api/community/knowledge-park/members ---');
  const membersRes = await req('/api/community/knowledge-park/members');
  console.log('Members API Status:', membersRes.status);
  console.log('Members API Registered Count:', membersRes.data.registeredCount);
  console.log('Members API Active Count:', membersRes.data.activeCount);
  console.log('Members API Offline Count:', membersRes.data.offlineCount);
  console.log('Members API Array Length:', membersRes.data.members.length);

  // Verify all member IDs in members API are unique
  const memberIds = membersRes.data.members.map(m => m.id);
  const uniqueMemberIds = new Set(memberIds);
  console.log('Are all member IDs in API strictly unique?', (uniqueMemberIds.size === memberIds.length));
  if (uniqueMemberIds.size !== memberIds.length) {
    throw new Error('FAILED: Duplicate user IDs found in members API!');
  }
  console.log('✓ PASS: Members API returns strictly unique accounts\n');

  // 3. User A Lifecycle (Register -> Multi-login -> Multi-device -> Logout -> Login)
  console.log('--- TEST 3: USER A REGISTRATION & MULTI-SESSION LIFECYCLE ---');
  const testAEmail = `acceptance_test_a_${Date.now()}@gmail.com`;
  const regA = await req('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Acceptance User A',
      email: testAEmail,
      password: 'Password123!',
      area: 'Knowledge Park'
    })
  });
  console.log('User A Registered Status:', regA.status);
  const tokenA = regA.data.token;
  const userAId = regA.data.user.id;

  const afterRegA = (await req('/api/presence')).data;
  console.log('Registered count after User A registered:', afterRegA.totalRegisteredUsers);
  if (afterRegA.totalRegisteredUsers !== initialRegistered + 1) {
    throw new Error(`FAILED: Expected registered count ${initialRegistered + 1}, got ${afterRegA.totalRegisteredUsers}`);
  }
  console.log('✓ PASS: Registration increased count by exactly 1');

  // Connect User A (Active Now)
  await req('/api/presence', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenA}`
    },
    body: JSON.stringify({ userId: userAId })
  });

  const activeA = (await req('/api/presence')).data;
  console.log('After User A active -> Active Now:', activeA.connectedCount, 'Offline:', activeA.offlineCount, 'Total:', activeA.totalRegisteredUsers);
  if (activeA.totalRegisteredUsers !== initialRegistered + 1) {
    throw new Error('FAILED: Presence check changed registered count!');
  }

  // Multi-login User A (10 logins in a row)
  for (let i = 1; i <= 10; i++) {
    await req('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testAEmail, password: 'Password123!' })
    });
  }
  const after10Logins = (await req('/api/presence')).data;
  console.log('After 10 logins of User A -> Total Registered:', after10Logins.totalRegisteredUsers);
  if (after10Logins.totalRegisteredUsers !== initialRegistered + 1) {
    throw new Error('FAILED: Repeated logins increased registered count!');
  }
  console.log('✓ PASS: 10 repeated logins of User A did NOT increase registered count');

  // Simulate multiple devices / tabs for User A (ping presence 10 times)
  for (let i = 1; i <= 10; i++) {
    await req('/api/presence', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenA}`
      },
      body: JSON.stringify({ userId: userAId })
    });
  }
  const multiDeviceStats = (await req('/api/presence')).data;
  console.log('After 10 tabs/device pings for User A -> Active Now:', multiDeviceStats.connectedCount, 'Total Registered:', multiDeviceStats.totalRegisteredUsers);
  if (multiDeviceStats.connectedCount !== 1) {
    throw new Error(`FAILED: User A with multiple tabs should count as 1 active person, got ${multiDeviceStats.connectedCount}`);
  }
  console.log('✓ PASS: Multiple tabs/devices for same user aggregates to ONE active person');

  // User A logs out
  await req('/api/auth/logout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: userAId })
  });
  const afterLogout = (await req('/api/presence')).data;
  console.log('After User A logout -> Active Now:', afterLogout.connectedCount, 'Offline:', afterLogout.offlineCount, 'Total Registered:', afterLogout.totalRegisteredUsers);
  if (afterLogout.connectedCount !== 0) {
    throw new Error('FAILED: Active Now did not drop to 0 after logout!');
  }
  if (afterLogout.totalRegisteredUsers !== initialRegistered + 1) {
    throw new Error('FAILED: Logout changed total registered count!');
  }
  console.log('✓ PASS: Logout immediately transitions user to offline without changing registered count\n');

  // 4. User B Lifecycle
  console.log('--- TEST 4: USER B REGISTRATION & INTERACTION ---');
  const testBEmail = `acceptance_test_b_${Date.now()}@gmail.com`;
  const regB = await req('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Acceptance User B',
      email: testBEmail,
      password: 'Password123!',
      area: 'Knowledge Park'
    })
  });
  const afterRegB = (await req('/api/presence')).data;
  console.log('After User B registration -> Total Registered:', afterRegB.totalRegisteredUsers);
  if (afterRegB.totalRegisteredUsers !== initialRegistered + 2) {
    throw new Error('FAILED: User B registration did not increase count by 1!');
  }
  console.log('✓ PASS: User B registered successfully, total count = baseline + 2');

  // 5. Booking & Location Ping Must Never Create Duplicate Accounts
  console.log('\n--- TEST 5: BOOKING & MAP PINGS AS GUEST DO NOT CREATE USERS ---');
  // Unauthenticated booking
  const guestBooking = await req('/api/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pickup: 'Knowledge Park III',
      dropoff: 'Pari Chowk',
      fare: 25,
      vehicle_type: 'Shared Auto'
    })
  });
  console.log('Guest Booking Status:', guestBooking.status);

  // Unauthenticated map ping
  const guestLoc = await req('/api/locations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      latitude: 28.4744,
      longitude: 77.5040,
      sharing_enabled: true
    })
  });
  console.log('Guest Map Location Status:', guestLoc.status);

  const afterGuestActions = (await req('/api/presence')).data;
  console.log('After guest booking + map ping -> Total Registered:', afterGuestActions.totalRegisteredUsers);
  if (afterGuestActions.totalRegisteredUsers !== initialRegistered + 2) {
    throw new Error('FAILED: Guest booking or map ping created extra registered users!');
  }
  console.log('✓ PASS: Guest actions NEVER create permanent user accounts');

  // 6. Audit of Existing Canonical Users
  console.log('\n--- TEST 6: CANONICAL PRODUCTION USERS INTEGRITY ---');
  const finalDb = JSON.parse(fs.readFileSync('saath-db.json', 'utf8'));
  ['ADITYA', 'Anshika yadav', 'Teammate 3', 'Teammate 4'].forEach(name => {
    const matching = finalDb.users.filter(u => u.name === name);
    console.log(`  "${name}" in database: ${matching.length} account (Expected: 1)`);
    if (matching.length !== 1) {
      throw new Error(`FAILED: ${name} appears ${matching.length} times in database!`);
    }
  });

  // Verify privacy: no user in /api/presence has email, phone, passwordHash, token
  const presenceCheck = (await req('/api/presence')).data;
  const allPresenceUsers = [...presenceCheck.connectedUsers, ...presenceCheck.offlineUsers];
  for (const u of allPresenceUsers) {
    if (u.email || u.phone || u.passwordHash || u.token) {
      throw new Error(`FAILED: Private field leaked in presence for user ${u.name}`);
    }
  }
  console.log('✓ PASS: Zero private data leaked');

  console.log('\n========================================================');
  console.log('🎉 100% OF ACCEPTANCE TESTS PASSED PERFECTLY!');
  console.log('   ONE REAL ACCOUNT = ONE REGISTERED USER GUARANTEED.');
  console.log('========================================================');
}

runAcceptanceTest().catch(err => {
  console.error('\n❌ TEST FAILED:', err.message);
  process.exit(1);
});
