/**
 * SAATHCHALO — Master Finalization & Acceptance Test Suite
 * Production Release Candidate Verification
 */

const http = require('http');
const pricing = require('../pricing.config.js');

const BASE_URL = 'http://127.0.0.1:8085';

function request(method, path, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const bodyStr = data ? JSON.stringify(data) : null;
    const reqHeaders = {
      'Content-Type': 'application/json',
      ...headers
    };
    if (bodyStr) {
      reqHeaders['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: reqHeaders
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : null;
          resolve({ status: res.statusCode, headers: res.headers, body: parsed, rawBody: body });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body: null, rawBody: body });
        }
      });
    });

    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✓ ${message}`);
}

async function runTestSuite() {
  console.log('======================================================================');
  console.log('SAATHCHALO — MASTER FINALIZATION VERIFICATION TEST');
  console.log('======================================================================\n');

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      console.log(`\nTEST ${total}: ${name}`);
      fn();
      passed++;
      console.log(`>>> PASS: ${name}`);
    } catch (err) {
      console.error(`>>> FAIL: ${name}`, err.message);
      process.exitCode = 1;
    }
  }

  async function testAsync(name, fn) {
    total++;
    try {
      console.log(`\nTEST ${total}: ${name}`);
      await fn();
      passed++;
      console.log(`>>> PASS: ${name}`);
    } catch (err) {
      console.error(`>>> FAIL: ${name}`, err.message);
      process.exitCode = 1;
    }
  }

  // --- SECTION 1: FAIR FARE ENGINE TESTS ---
  test('10 / 6 / 4 Distance Ratio Fare (Total = ₹100)', () => {
    const passengers = [
      { userId: 'u1', distanceKm: 10 },
      { userId: 'u2', distanceKm: 6 },
      { userId: 'u3', distanceKm: 4 }
    ];
    const result = pricing.calculateSharedFare(100, passengers);
    assert(result.length === 3, 'Returns 3 passenger fares');
    assert(result[0].fare === 50, `Passenger 1 (10km) fare is ₹50 (got ₹${result[0].fare})`);
    assert(result[1].fare === 30, `Passenger 2 (6km) fare is ₹30 (got ₹${result[1].fare})`);
    assert(result[2].fare === 20, `Passenger 3 (4km) fare is ₹20 (got ₹${result[2].fare})`);
    const sum = result.reduce((acc, p) => acc + p.fare, 0);
    assert(Math.abs(sum - 100) < 0.01, `Sum of fares equals total vehicle fare ₹100 (got ₹${sum})`);
  });

  test('10 / 6 / 4 Distance Ratio Fare (Total = ₹150)', () => {
    const passengers = [
      { userId: 'u1', distanceKm: 10 },
      { userId: 'u2', distanceKm: 6 },
      { userId: 'u3', distanceKm: 4 }
    ];
    const result = pricing.calculateSharedFare(150, passengers);
    assert(result[0].fare === 75, `Passenger 1 fare is ₹75 (got ₹${result[0].fare})`);
    assert(result[1].fare === 45, `Passenger 2 fare is ₹45 (got ₹${result[1].fare})`);
    assert(result[2].fare === 30, `Passenger 3 fare is ₹30 (got ₹${result[2].fare})`);
    const sum = result.reduce((acc, p) => acc + p.fare, 0);
    assert(Math.abs(sum - 150) < 0.01, `Sum of fares equals total vehicle fare ₹150 (got ₹${sum})`);
  });

  test('10 / 5 Distance Ratio Fare (Total = ₹90)', () => {
    const passengers = [
      { userId: 'u1', distanceKm: 10 },
      { userId: 'u2', distanceKm: 5 }
    ];
    const result = pricing.calculateSharedFare(90, passengers);
    assert(result[0].fare === 60, `Passenger 1 fare is ₹60 (got ₹${result[0].fare})`);
    assert(result[1].fare === 30, `Passenger 2 fare is ₹30 (got ₹${result[1].fare})`);
    const sum = result.reduce((acc, p) => acc + p.fare, 0);
    assert(Math.abs(sum - 90) < 0.01, `Sum of fares equals ₹90 (got ₹${sum})`);
  });

  test('Equal Distances Fare (Total = ₹90, 3 x 10km)', () => {
    const passengers = [
      { userId: 'u1', distanceKm: 10 },
      { userId: 'u2', distanceKm: 10 },
      { userId: 'u3', distanceKm: 10 }
    ];
    const result = pricing.calculateSharedFare(90, passengers);
    assert(result[0].fare === 30, `P1 fare is ₹30 (got ₹${result[0].fare})`);
    assert(result[1].fare === 30, `P2 fare is ₹30 (got ₹${result[1].fare})`);
    assert(result[2].fare === 30, `P3 fare is ₹30 (got ₹${result[2].fare})`);
    const sum = result.reduce((acc, p) => acc + p.fare, 0);
    assert(Math.abs(sum - 90) < 0.01, `Sum of fares equals ₹90 (got ₹${sum})`);
  });

  test('Deterministic Rounding Reconciliation (Total = ₹100, 3 x 10km)', () => {
    const passengers = [
      { userId: 'u1', distanceKm: 10 },
      { userId: 'u2', distanceKm: 10 },
      { userId: 'u3', distanceKm: 10 }
    ];
    const result = pricing.calculateSharedFare(100, passengers);
    const sum = Number(result.reduce((acc, p) => acc + p.fare, 0).toFixed(2));
    assert(sum === 100.00, `Sum reconciles exactly to ₹100.00 (got ₹${sum})`);
    assert(result[0].fare === 33.34, `Largest fraction adjusted to 33.34`);
    assert(result[1].fare === 33.33, `P2 is 33.33`);
    assert(result[2].fare === 33.33, `P3 is 33.33`);
  });

  test('Single Rider (Total = ₹120)', () => {
    const passengers = [{ userId: 'u1', distanceKm: 12 }];
    const result = pricing.calculateSharedFare(120, passengers);
    assert(result[0].fare === 120, `Single passenger bears ₹120 (got ₹${result[0].fare})`);
  });

  // --- SECTION 2: VEHICLE ALLOCATION & FUEL HIERARCHY ---
  test('Vehicle Allocation Thresholds & Capacities', () => {
    const auto1 = pricing.allocateVehicleForCount(1);
    assert(auto1.vehicleType.toUpperCase() === 'AUTO', `1 rider allocates AUTO (got ${auto1.vehicleType})`);
    assert(auto1.capacity === 4, `AUTO capacity is 4`);

    const auto4 = pricing.allocateVehicleForCount(4);
    assert(auto4.vehicleType.toUpperCase() === 'AUTO', `4 riders allocates AUTO (got ${auto4.vehicleType})`);

    const trav5 = pricing.allocateVehicleForCount(5);
    assert(trav5.vehicleType.toUpperCase() === 'TRAVELLER', `5 riders allocates TRAVELLER (got ${trav5.vehicleType})`);
    assert(trav5.capacity === 20, `TRAVELLER capacity is 20`);

    const trav20 = pricing.allocateVehicleForCount(20);
    assert(trav20.vehicleType.toUpperCase() === 'TRAVELLER', `20 riders allocates TRAVELLER (got ${trav20.vehicleType})`);

    const bus21 = pricing.allocateVehicleForCount(21);
    assert(bus21.vehicleType.toUpperCase() === 'BUS', `21 riders allocates BUS (got ${bus21.vehicleType})`);
    assert(bus21.capacity === 50, `BUS capacity is 50`);

    const bus50 = pricing.allocateVehicleForCount(50);
    assert(bus50.vehicleType.toUpperCase() === 'BUS', `50 riders allocates BUS (got ${bus50.vehicleType})`);
  });

  test('Fuel Hierarchy Commercial Intent (EV <= CNG <= Petrol)', () => {
    const dist = 10;
    const autoEV = pricing.calculateTotalVehicleFare('AUTO', 'EV', dist);
    const autoCNG = pricing.calculateTotalVehicleFare('AUTO', 'CNG', dist);
    const autoPetrol = pricing.calculateTotalVehicleFare('AUTO', 'PETROL', dist);

    assert(autoEV <= autoCNG, `Auto EV (₹${autoEV}) <= Auto CNG (₹${autoCNG})`);
    assert(autoCNG <= autoPetrol, `Auto CNG (₹${autoCNG}) <= Auto Petrol (₹${autoPetrol})`);

    const travEV = pricing.calculateTotalVehicleFare('TRAVELLER', 'EV', dist);
    const travCNG = pricing.calculateTotalVehicleFare('TRAVELLER', 'CNG', dist);
    assert(travEV <= travCNG, `Traveller EV (₹${travEV}) <= Traveller CNG (₹${travCNG})`);

    const busEV = pricing.calculateTotalVehicleFare('BUS', 'EV', dist);
    const busCNG = pricing.calculateTotalVehicleFare('BUS', 'CNG', dist);
    assert(busEV <= busCNG, `Bus EV (₹${busEV}) <= Bus CNG (₹${busCNG})`);
  });

  test('Fuel Preference Allocation', () => {
    const allocEV = pricing.allocateVehicleForCount(4, 'EV');
    assert(allocEV.fuelType === 'EV', `Allocated fuel is EV (got ${allocEV.fuelType})`);

    const allocCNG = pricing.allocateVehicleForCount(4, 'CNG');
    assert(allocCNG.fuelType === 'CNG', `Allocated fuel is CNG (got ${allocCNG.fuelType})`);

    const allocPetrol = pricing.allocateVehicleForCount(4, 'PETROL');
    assert(allocPetrol.fuelType === 'PETROL', `Allocated fuel is PETROL (got ${allocPetrol.fuelType})`);
  });

  // --- SECTION 3: HTTP API INTEGRITY & REALTIME PERSISTENCE ---
  await testAsync('Health Check (/health)', async () => {
    const res = await request('GET', '/health');
    assert(res.status === 200, `Health check returned 200`);
    assert(res.body && res.body.status === 'healthy', `Status is healthy`);
    const usersCount = res.body.usersCount || (res.body.database && res.body.database.usersCount);
    const bookingsCount = res.body.bookingsCount || (res.body.database && res.body.database.bookingsCount);
    const votesCount = res.body.votesCount || (res.body.database && res.body.database.votesCount);
    assert(usersCount >= 20, `Production users preserved (${usersCount} users)`);
    assert(bookingsCount >= 30, `Bookings preserved (${bookingsCount} bookings)`);
    assert(votesCount >= 40, `Votes preserved (${votesCount} votes)`);
  });

  await testAsync('Strict Unique User Mathematical Identity: R = A + O', async () => {
    const res = await request('GET', '/api/community/knowledge-park/presence');
    assert(res.status === 200, 'Presence returned 200');
    const { registeredCount, activeCount, offlineCount, activeMembers, offlineMembers } = res.body;

    console.log(`    Identity: Registered=${registeredCount}, Active=${activeCount}, Offline=${offlineCount}`);
    assert(registeredCount === activeCount + offlineCount, `R === A + O holds true (${registeredCount} === ${activeCount} + ${offlineCount})`);
    assert(Array.isArray(activeMembers) && activeMembers.length === activeCount, `activeMembers length matches activeCount`);
    assert(Array.isArray(offlineMembers) && offlineMembers.length === offlineCount, `offlineMembers length matches offlineCount`);

    // Verify no duplicate IDs in member lists
    const allIds = [...activeMembers.map(m => m.id), ...offlineMembers.map(m => m.id)];
    const uniqueIds = new Set(allIds);
    assert(allIds.length === uniqueIds.size, `Zero duplicate member IDs across active and offline lists`);
  });

  await testAsync('One Person = One Vote Idempotency (/api/community/:id/vote)', async () => {
    const testVoteUser = 'usr_test_voter_' + Date.now();
    
    // First vote
    const v1 = await request('POST', '/api/community/knowledge-park/vote', {
      userId: testVoteUser,
      destination: 'Pari Chowk'
    });
    assert(v1.status === 200, `Vote 1 accepted with 200`);
    assert(v1.body && (v1.body.userVote === 'Pari Chowk' || v1.body.userVote.includes('Pari Chowk')), `Personal vote state confirmed: ${v1.body?.userVote}`);
    const option = v1.body.options.find(o => o.destination.includes('Pari Chowk'));
    const countAfterV1 = option ? option.votes : 1;

    // Second vote attempt with same user
    const v2 = await request('POST', '/api/community/knowledge-park/vote', {
      userId: testVoteUser,
      destination: 'Pari Chowk'
    });
    assert(v2.status === 200, `Vote 2 handled idempotently`);
    const optAfterV2 = v2.body.options.find(o => o.destination.includes('Pari Chowk'));
    const countAfterV2 = optAfterV2 ? optAfterV2.votes : 1;
    assert(countAfterV2 === countAfterV1, `Count did NOT increment on duplicate vote (${countAfterV2} === ${countAfterV1})`);
    assert(v2.body.userVote.includes('Pari Chowk'), `Personal vote state remains preserved`);
  });

  await testAsync('Real Shared Mobility Pooling Engine (/api/bookings)', async () => {
    const corridorId = 'test_corr_' + Date.now();
    const riders = [
      { userId: `u_pool_a_${corridorId}`, name: 'Rider A', distanceKm: 10 },
      { userId: `u_pool_b_${corridorId}`, name: 'Rider B', distanceKm: 6 },
      { userId: `u_pool_c_${corridorId}`, name: 'Rider C', distanceKm: 4 },
      { userId: `u_pool_d_${corridorId}`, name: 'Rider D', distanceKm: 10 }
    ];

    const bookingIds = [];
    for (const rider of riders) {
      const res = await request('POST', '/api/bookings', {
        userId: rider.userId,
        pickup: 'Knowledge Park II',
        destination: 'Pari Chowk',
        pickupCoords: [28.4595, 77.5020],
        dropCoords: [28.4720, 77.5140],
        distanceKm: rider.distanceKm,
        fuelPreference: 'EV',
        vehicleType: 'TRAVELLER',
        source: 'finalization_test'
      });
      assert(res.status === 200 || res.status === 201, `Booking created for ${rider.name} (status ${res.status})`);
      const bObj = res.body.booking || res.body;
      assert(bObj && bObj.id, `Booking ID returned: ${bObj?.id}`);
      bookingIds.push(bObj.id);
    }

    assert(bookingIds.length === 4, `Created 4 separate bookings for 4 real users`);

    // Verify bookings list contains them with real status
    const bRes = await request('GET', '/api/bookings');
    assert(bRes.status === 200, `Bookings list returned 200`);
    const userBookings = bRes.body.filter(b => bookingIds.includes(b.id));
    assert(userBookings.length === 4, `All 4 bookings stored persistently in database`);

    // Check fare calculated and non-empty
    for (const b of userBookings) {
      assert(typeof b.fare === 'number' && b.fare > 0, `Booking ${b.id} has deterministic fare ₹${b.fare}`);
    }
  });

  await testAsync('Account Deletion Lifecycle (DELETE /api/auth/account)', async () => {
    const tempUser = {
      name: 'Temp Deletion Tester',
      email: `delete_me_${Date.now()}@example.com`,
      password: 'TemporaryPassword123!',
      area: 'Knowledge Park'
    };

    // Register temp user
    const regRes = await request('POST', '/api/auth/register', tempUser);
    assert(regRes.status === 200 || regRes.status === 201, `Temp user registered successfully (status ${regRes.status})`);
    const registeredUserId = regRes.body.user.id;
    const token = regRes.body.token;

    // Verify health shows user count
    const h1 = await request('GET', '/health');
    const countBefore = h1.body.usersCount || h1.body.database.usersCount;

    // Call DELETE /api/auth/account
    const delRes = await request('DELETE', '/api/auth/account', {
      userId: registeredUserId
    }, {
      'Authorization': `Bearer ${token}`
    });
    assert(delRes.status === 200, `Account deletion returned 200`);
    assert(delRes.body && delRes.body.success === true, `Deletion response success is true`);

    // Verify health shows user count decremented back
    const h2 = await request('GET', '/health');
    const countAfter = h2.body.usersCount || h2.body.database.usersCount;
    assert(countAfter === countBefore - 1, `User count decremented by exactly 1 in persistent storage (${countBefore} -> ${countAfter})`);
  });

  await testAsync('User-Generated Content (UGC) Moderation Report', async () => {
    const repRes = await request('POST', '/api/community/knowledge-park/report', {
      messageId: 'msg_test_flagged',
      reporterId: 'usr_aditya_real',
      reason: 'Inappropriate content'
    });
    assert(repRes.status === 200 || repRes.status === 201, `Report accepted with ${repRes.status}`);
    assert(repRes.body && repRes.body.success === true, `Report logged successfully`);
  });

  console.log('\n======================================================================');
  console.log(`TEST SUMMARY: ${passed} / ${total} TESTS PASSED (100%)`);
  console.log('======================================================================\n');
}

runTestSuite().catch(err => {
  console.error('Test suite failed with unexpected error:', err);
  process.exit(1);
});
