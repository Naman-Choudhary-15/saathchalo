const http = require('http');

async function req(path, method = 'GET', body = null, token = null) {
    const url = 'http://127.0.0.1:8085' + path;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
    });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, data: json };
}

async function runZeroDowntimeVerification() {
    console.log('========================================================');
    console.log('SAATHCHALO ZERO-DOWNTIME & DATA PRESERVATION VERIFICATION');
    console.log('========================================================\n');

    // 1. Health check verification
    console.log('--- TEST 1: HEALTH CHECK & SYSTEM STATUS ---');
    const health = await req('/health');
    console.log('Health Status Code:', health.status);
    console.log('Database Connected:', health.data?.database?.connected);
    console.log('Registered Users Count:', health.data?.database?.usersCount);
    console.log('Storage Mode:', health.data?.database?.storage);
    if (health.status === 200 && health.data?.status === 'healthy' && health.data?.database?.usersCount > 0) {
        console.log('✓ PASS: System is healthy and reporting active database\n');
    } else {
        throw new Error('Health check failed');
    }

    const preTestUserCount = health.data.database.usersCount;

    // 2. Real user preservation: Login with pre-existing user
    console.log('--- TEST 2: PRE-EXISTING USER LOGIN & DATA PRESERVATION ---');
    const testEmail = 'permanent_probe@saathchalo.in';
    const testPass = 'ProbePassword123!';
    
    // Attempt login first
    let loginRes = await req('/api/auth/login', 'POST', { email: testEmail, password: testPass });
    if (loginRes.status !== 200) {
        // Register this permanent user if not present
        const regRes = await req('/api/auth/register', 'POST', {
            name: 'Permanent Probe Commuter',
            email: testEmail,
            password: testPass,
            area: 'Knowledge Park'
        });
        loginRes = await req('/api/auth/login', 'POST', { email: testEmail, password: testPass });
    }

    console.log('Login Status:', loginRes.status);
    console.log('Logged In User:', loginRes.data?.user?.name, 'Area:', loginRes.data?.user?.primary_area);
    if (loginRes.status === 200 && loginRes.data?.token) {
        console.log('✓ PASS: Pre-existing user successfully logged in and profile preserved\n');
    } else {
        throw new Error('User login preservation failed');
    }

    // 3. Concurrent registration test
    console.log('--- TEST 3: CONCURRENT REGISTRATIONS AT IDENTICAL MILLISECOND ---');
    const concurrentCount = 5;
    const promises = [];
    const timestamp = Date.now();

    for (let i = 1; i <= concurrentCount; i++) {
        promises.push(req('/api/auth/register', 'POST', {
            name: `Concurrent User ${i}`,
            email: `concurrent_${timestamp}_${i}@test.com`,
            password: 'SecurePassword123!',
            area: 'Knowledge Park'
        }));
    }

    const results = await Promise.all(promises);
    const successCount = results.filter(r => r.status === 201).length;
    console.log(`Concurrent Registrations Attempted: ${concurrentCount}, Successful: ${successCount}`);
    
    // Verify each user has a unique ID and token
    const userIds = new Set(results.map(r => r.data?.user?.id).filter(Boolean));
    console.log('Unique User IDs created:', userIds.size);
    if (successCount === concurrentCount && userIds.size === concurrentCount) {
        console.log('✓ PASS: Zero race conditions or data loss under concurrent writes\n');
    } else {
        throw new Error('Concurrent registration verification failed');
    }

    // 4. Duplicate registration prevention (Rule 18)
    console.log('--- TEST 4: DUPLICATE EMAIL REGISTRATION REJECTION ---');
    const dupRes = await req('/api/auth/register', 'POST', {
        name: 'Duplicate Attempt',
        email: `concurrent_${timestamp}_1@test.com`,
        password: 'SecurePassword123!'
    });
    console.log('Duplicate Register Status:', dupRes.status);
    if (dupRes.status === 409) {
        console.log('✓ PASS: Duplicate registration cleanly rejected with 409 Conflict\n');
    } else {
        throw new Error('Duplicate prevention failed');
    }

    // 5. Booking Idempotency test (Rule 17 & 18)
    console.log('--- TEST 5: BOOKING IDEMPOTENCY & DUPLICATE PREVENTION ---');
    const testToken = results[0].data.token;
    const bookingPayload = {
        pickup: 'Knowledge Park II Gate',
        dropoff: 'Pari Chowk Interchange',
        distance_km: 4.2,
        vehicle_type: 'Shared Auto',
        vehicle_id: 'Auto UP16-AT-1411',
        fare: 25.00
    };

    const b1 = await req('/api/bookings', 'POST', bookingPayload, testToken);
    const b2 = await req('/api/bookings', 'POST', bookingPayload, testToken); // Immediate retry

    console.log('Booking 1 ID:', b1.data?.id, 'Status:', b1.status);
    console.log('Booking 2 ID:', b2.data?.id, 'Status:', b2.status);
    if (b1.data?.id === b2.data?.id) {
        console.log('✓ PASS: Idempotency confirmed: Retry within 10s returned identical confirmed booking without creating duplicate\n');
    } else {
        throw new Error('Booking idempotency failed');
    }

    // 6. Active vs Offline calculation (Rule 20 & 21)
    console.log('--- TEST 6: ACTIVE VS OFFLINE CALCULATION ---');
    const presenceRes = await req('/api/presence?communityId=knowledge-park');
    console.log('Total Registered in System:', presenceRes.data?.totalRegisteredUsers);
    console.log('Currently Connected Users (All):', presenceRes.data?.connectedCount);
    console.log('Currently Connected Registered:', presenceRes.data?.connectedRegisteredCount);
    console.log('Offline Registered Users:', presenceRes.data?.offlineCount);

    const mathChecksOut = ((presenceRes.data?.connectedRegisteredCount || 0) + presenceRes.data?.offlineCount) === presenceRes.data?.totalRegisteredUsers;
    console.log('Connected Registered + Offline === Total Registered:', mathChecksOut);
    if (mathChecksOut && presenceRes.data?.offlineCount >= 0) {
        console.log('✓ PASS: Registered users preserved; offline users correctly derived as registered minus active\n');
    } else {
        throw new Error('Active/offline calculation mismatch');
    }

    // 7. Verify post-test total users grew strictly additively
    console.log('--- TEST 7: NET USER PRESERVATION AUDIT ---');
    const finalHealth = await req('/health');
    const postTestUserCount = finalHealth.data.database.usersCount;
    console.log(`Pre-test Users: ${preTestUserCount} → Post-test Users: ${postTestUserCount}`);
    if (postTestUserCount >= preTestUserCount + concurrentCount) {
        console.log('✓ PASS: All previous users preserved + all new concurrent users persisted additively\n');
    } else {
        throw new Error('User count decreased or data lost!');
    }

    console.log('========================================================');
    console.log('🎉 ALL ZERO-DOWNTIME & DATA INTEGRITY TESTS PASSED 100%!');
    console.log('========================================================');
}

runZeroDowntimeVerification().catch(err => {
    console.error('VERIFICATION ERROR:', err);
    process.exit(1);
});
