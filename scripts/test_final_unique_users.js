const http = require('http');

function apiCall(endpoint, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, 'http://127.0.0.1:8085');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  console.log('====================================================');
  console.log('SAATHCHALO ACCEPTANCE TEST: REAL UNIQUE REGISTERED USERS');
  console.log('====================================================\n');

  // Step 1: Initial State Check
  const initKP = await apiCall('/api/community/knowledge-park/members');
  const initStats = await apiCall('/api/community/knowledge-park/member-stats');
  console.log('1. Initial Knowledge Park state:');
  console.log('   Registered Members:', initKP.data.registeredCount);
  console.log('   Active Now:', initKP.data.activeCount);
  console.log('   Offline Members:', initKP.data.offlineCount);
  console.log('   Member Stats Status:', initStats.status);
  console.log('   Mathematical Check (Active + Offline === Registered):', initKP.data.registeredCount === (initKP.data.activeCount + initKP.data.offlineCount));

  if (initKP.data.registeredCount !== (initKP.data.activeCount + initKP.data.offlineCount)) {
    throw new Error('FAIL: registeredCount must equal activeCount + offlineCount');
  }

  const baseKPRegistered = initKP.data.registeredCount;

  // Step 2: Register Account A
  const testEmailA = `test.unique.user.a.${Date.now()}@saathchalo.in`;
  console.log('\n2. Registering Account A (' + testEmailA + ')...');
  const regA = await apiCall('/api/auth/register', 'POST', {
    email: testEmailA,
    password: 'password123',
    name: 'Unique Test User A',
    area: 'Knowledge Park'
  });
  console.log('   Registration response:', regA.status, regA.data.user.id);
  const tokenA = regA.data.token;
  const userAId = regA.data.user.id;

  const afterRegA = await apiCall('/api/community/knowledge-park/members');
  console.log('   After Account A registered -> Registered Count:', afterRegA.data.registeredCount);
  if (afterRegA.data.registeredCount !== baseKPRegistered + 1) {
    throw new Error(`FAIL: Expected ${baseKPRegistered + 1}, got ${afterRegA.data.registeredCount}`);
  }

  // Step 3: Account A logs in
  console.log('\n3. Account A logs in...');
  const loginA1 = await apiCall('/api/auth/login', 'POST', {
    email: testEmailA,
    password: 'password123'
  });
  const afterLoginA1 = await apiCall('/api/community/knowledge-park/members');
  console.log('   After Login -> Registered Count:', afterLoginA1.data.registeredCount);
  if (afterLoginA1.data.registeredCount !== baseKPRegistered + 1) {
    throw new Error(`FAIL: Login must NOT increase registered count! Got ${afterLoginA1.data.registeredCount}`);
  }

  // Step 4: Account A active presence (Tab 1)
  console.log('\n4. Account A connects (Tab 1 presence ping)...');
  await apiCall('/api/presence', 'POST', { communityId: 'knowledge-park', userId: userAId }, tokenA);
  const presenceTab1 = await apiCall('/api/community/knowledge-park/members');
  console.log('   Active Now:', presenceTab1.data.activeCount, 'Offline:', presenceTab1.data.offlineCount, 'Registered:', presenceTab1.data.registeredCount);
  if (presenceTab1.data.activeCount !== 1) {
    throw new Error(`FAIL: Expected 1 active user, got ${presenceTab1.data.activeCount}`);
  }

  // Step 5: Account A opens second tab & second device (3 pings with same account)
  console.log('\n5. Account A opens second tab and second device (multiple presence sessions)...');
  await apiCall('/api/presence', 'POST', { communityId: 'knowledge-park', userId: userAId }, tokenA);
  await apiCall('/api/presence', 'POST', { communityId: 'knowledge-park', userId: userAId }, tokenA);
  const presenceMulti = await apiCall('/api/community/knowledge-park/members');
  console.log('   Active Now:', presenceMulti.data.activeCount, 'Registered:', presenceMulti.data.registeredCount);
  if (presenceMulti.data.activeCount !== 1) {
    throw new Error(`FAIL: Multiple tabs/devices for same user must aggregate to 1 active person! Got ${presenceMulti.data.activeCount}`);
  }
  if (presenceMulti.data.registeredCount !== baseKPRegistered + 1) {
    throw new Error(`FAIL: Multiple sessions must NOT inflate registered count!`);
  }

  // Step 6: Account A logs out
  console.log('\n6. Account A logs out...');
  await apiCall('/api/auth/logout', 'POST', { userId: userAId }, tokenA);
  const afterLogout = await apiCall('/api/community/knowledge-park/members');
  console.log('   After Logout -> Active Now:', afterLogout.data.activeCount, 'Offline:', afterLogout.data.offlineCount, 'Registered:', afterLogout.data.registeredCount);
  if (afterLogout.data.activeCount !== 0) {
    throw new Error(`FAIL: After logout active count must be 0, got ${afterLogout.data.activeCount}`);
  }
  if (afterLogout.data.registeredCount !== baseKPRegistered + 1) {
    throw new Error(`FAIL: Registered count must remain unchanged after logout!`);
  }

  // Step 7: Account A logs in again repeatedly (10 times)
  console.log('\n7. Account A logs in 10 times repeatedly...');
  for (let i = 0; i < 10; i++) {
    await apiCall('/api/auth/login', 'POST', { email: testEmailA, password: 'password123' });
  }
  const after10Logins = await apiCall('/api/community/knowledge-park/members');
  console.log('   After 10 Logins -> Registered Count:', after10Logins.data.registeredCount);
  if (after10Logins.data.registeredCount !== baseKPRegistered + 1) {
    throw new Error(`FAIL: 10 logins must NOT change registered count!`);
  }

  // Step 8: Register Account B
  const testEmailB = `test.unique.user.b.${Date.now()}@saathchalo.in`;
  console.log('\n8. Registering Account B (' + testEmailB + ')...');
  const regB = await apiCall('/api/auth/register', 'POST', {
    email: testEmailB,
    password: 'password123',
    name: 'Unique Test User B',
    area: 'Knowledge Park'
  });
  const afterRegB = await apiCall('/api/community/knowledge-park/members');
  console.log('   After Account B registered -> Registered Count:', afterRegB.data.registeredCount);
  if (afterRegB.data.registeredCount !== baseKPRegistered + 2) {
    throw new Error(`FAIL: Expected ${baseKPRegistered + 2}, got ${afterRegB.data.registeredCount}`);
  }

  // Step 9: Account B logs in 10 times
  console.log('\n9. Account B logs in 10 times...');
  for (let i = 0; i < 10; i++) {
    await apiCall('/api/auth/login', 'POST', { email: testEmailB, password: 'password123' });
  }
  const after10LoginsB = await apiCall('/api/community/knowledge-park/members');
  console.log('   After 10 Logins of B -> Registered Count:', after10LoginsB.data.registeredCount);
  if (after10LoginsB.data.registeredCount !== baseKPRegistered + 2) {
    throw new Error(`FAIL: Expected ${baseKPRegistered + 2}, got ${after10LoginsB.data.registeredCount}`);
  }

  // Step 10: Anonymous guest actions (booking and map ping)
  console.log('\n10. Unauthenticated guest performs booking and map ping...');
  await apiCall('/api/bookings', 'POST', { pickup: 'Knowledge Park', dropoff: 'Pari Chowk', distanceKm: 4.2 });
  await apiCall('/api/locations', 'POST', { latitude: 28.4744, longitude: 77.5040 });
  const afterGuest = await apiCall('/api/community/knowledge-park/members');
  console.log('   After Guest Actions -> Registered Count:', afterGuest.data.registeredCount);
  if (afterGuest.data.registeredCount !== baseKPRegistered + 2) {
    throw new Error(`FAIL: Guest actions must NEVER create registered users!`);
  }

  // Step 11: Privacy audit on member list
  console.log('\n11. Privacy verification on member list...');
  for (const m of afterGuest.data.members) {
    if (m.email || m.phone || m.passwordHash || m.token) {
      throw new Error(`FAIL: Privacy leak detected on member: ${JSON.stringify(m)}`);
    }
  }
  console.log('   ✓ Zero private fields (email/phone/password/token) exposed in API response.');

  // Clean up temporary test users created during this test
  console.log('\n12. Cleaning up test accounts...');
  const fs = require('fs');
  const db = JSON.parse(fs.readFileSync('saath-db.json', 'utf8'));
  db.users = db.users.filter(u => u.email !== testEmailA && u.email !== testEmailB);
  db.bookings = (db.bookings || []).filter(b => b.pickup !== 'Knowledge Park' || b.distance_km !== 4.2);
  fs.writeFileSync('saath-db.json', JSON.stringify(db, null, 2), 'utf8');

  console.log('\n====================================================');
  console.log('✓ ALL 12 ACCEPTANCE TESTS PASSED 100% PERFECTLY!');
  console.log('====================================================');
}

run().catch(err => {
  console.error('\n❌ ACCEPTANCE TEST FAILED:', err.message);
  process.exit(1);
});
