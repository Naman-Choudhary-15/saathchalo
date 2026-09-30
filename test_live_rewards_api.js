const http = require('http');

function request(options, bodyData) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ statusCode: res.statusCode, data: data ? JSON.parse(data) : {} });
                } catch(e) {
                    resolve({ statusCode: res.statusCode, raw: data });
                }
            });
        });
        req.on('error', reject);
        if (bodyData) {
            req.write(typeof bodyData === 'string' ? bodyData : JSON.stringify(bodyData));
        }
        req.end();
    });
}

async function runLiveApiTests() {
    console.log('Testing live server on http://127.0.0.1:8085...\n');

    // 1. Health check
    const health = await request({
        hostname: '127.0.0.1',
        port: 8085,
        path: '/health',
        method: 'GET'
    });
    console.log('1. Health check status:', health.statusCode, 'Service:', health.data.service);

    // 2. Real user rewards balance (Aditya)
    const adityaRewards = await request({
        hostname: '127.0.0.1',
        port: 8085,
        path: '/api/users/me/rewards?userId=usr_461c33b024b2fd83',
        method: 'GET'
    });
    console.log('2. Real user rewards balance (Aditya):', adityaRewards.data.reward_points, 'Status:', adityaRewards.data.status);

    // 3. Register two test users via real registration endpoint
    const suffix = Date.now();
    const userARes = await request({
        hostname: '127.0.0.1',
        port: 8085,
        path: '/api/auth/register',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }, {
        name: 'Aditya Demo',
        email: `aditya_demo_${suffix}@saathchalo.in`,
        password: 'Password@123',
        area: 'Knowledge Park'
    });
    const tokenA = userARes.data.token;
    const userA = userARes.data.user;
    console.log('3. Registered User A:', userA.name, 'Initial Points:', userA.reward_points);

    const userBRes = await request({
        hostname: '127.0.0.1',
        port: 8085,
        path: '/api/auth/register',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }, {
        name: 'Teammate 3 Demo',
        email: `teammate3_demo_${suffix}@saathchalo.in`,
        password: 'Password@123',
        area: 'Knowledge Park'
    });
    const tokenB = userBRes.data.token;
    const userB = userBRes.data.user;
    console.log('4. Registered User B:', userB.name, 'Initial Points:', userB.reward_points);

    // 4. Create community ride via booking endpoint for User A
    const bookingARes = await request({
        hostname: '127.0.0.1',
        port: 8085,
        path: '/api/bookings',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tokenA}`
        }
    }, {
        pickup: 'Knowledge Park Metro',
        dropoff: 'Pari Chowk Interchange',
        distanceKm: 7.4
    });
    const rideId = bookingARes.data.ride_id;
    console.log('5. Created Shared Pool Ride:', rideId, 'for', userA.name);

    // 5. User B joins the same ride pool
    const bookingBRes = await request({
        hostname: '127.0.0.1',
        port: 8085,
        path: '/api/bookings',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tokenB}`
        }
    }, {
        pickup: 'Knowledge Park Gate 2',
        dropoff: 'Pari Chowk Interchange',
        distanceKm: 7.0
    });
    console.log('6. User B joined Shared Pool Ride:', bookingBRes.data.ride_id);

    // 6. User A checks in ("I'm Here")
    const checkInARes = await request({
        hostname: '127.0.0.1',
        port: 8085,
        path: `/api/rides/${rideId}/check-in`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tokenA}`
        }
    });
    console.log('7. User A Check-in Status:', checkInARes.data.status, '-', checkInARes.data.message);

    // 7. Inspect attendance before finalization
    const attendancePre = await request({
        hostname: '127.0.0.1',
        port: 8085,
        path: `/api/rides/${rideId}/attendance`,
        method: 'GET'
    });
    console.log('8. Pre-finalization Attendance:');
    attendancePre.data.participants.forEach(p => {
        console.log(`   - ${p.name} (${p.userId}): ${p.attendance_status}`);
    });

    // 8. Finalize Attendance
    const finalizeRes = await request({
        hostname: '127.0.0.1',
        port: 8085,
        path: `/api/rides/${rideId}/finalize-attendance`,
        method: 'POST'
    });
    console.log('9. Attendance Finalized:');
    console.log('   - Present users (0 pts change):', finalizeRes.data.results.present);
    console.log('   - Absent users (-5 pts deduction):', finalizeRes.data.results.absent);

    // 9. Verify User A balance: MUST BE 100
    const rewardsA = await request({
        hostname: '127.0.0.1',
        port: 8085,
        path: '/api/users/me/rewards',
        method: 'GET',
        headers: { 'Authorization': `Bearer ${tokenA}` }
    });
    console.log('10. User A (Present) Reward Balance:', rewardsA.data.reward_points, '(Expected: 100)');
    if (rewardsA.data.reward_points !== 100) {
        throw new Error(`Expected User A to have 100 points, got ${rewardsA.data.reward_points}`);
    }

    // 10. Verify User B balance: MUST BE 95
    const rewardsB = await request({
        hostname: '127.0.0.1',
        port: 8085,
        path: '/api/users/me/rewards',
        method: 'GET',
        headers: { 'Authorization': `Bearer ${tokenB}` }
    });
    console.log('11. User B (Absent) Reward Balance:', rewardsB.data.reward_points, '(Expected: 95)');
    if (rewardsB.data.reward_points !== 95) {
        throw new Error(`Expected User B to have 95 points, got ${rewardsB.data.reward_points}`);
    }

    // 11. IDEMPOTENCY TEST: Call finalize attendance again on the same ride
    const refinalizeRes = await request({
        hostname: '127.0.0.1',
        port: 8085,
        path: `/api/rides/${rideId}/finalize-attendance`,
        method: 'POST'
    });
    const rewardsBRetry = await request({
        hostname: '127.0.0.1',
        port: 8085,
        path: '/api/users/me/rewards',
        method: 'GET',
        headers: { 'Authorization': `Bearer ${tokenB}` }
    });
    console.log('12. User B Reward Balance after repeated finalization:', rewardsBRetry.data.reward_points, '(Expected: 95 - IDEMPOTENT)');
    if (rewardsBRetry.data.reward_points !== 95) {
        throw new Error(`IDEMPOTENCY FAILURE: User B points changed to ${rewardsBRetry.data.reward_points} on retry!`);
    }

    // 12. Check User B transaction ledger
    const historyB = await request({
        hostname: '127.0.0.1',
        port: 8085,
        path: '/api/users/me/rewards/history',
        method: 'GET',
        headers: { 'Authorization': `Bearer ${tokenB}` }
    });
    console.log('13. User B Reward Transaction Ledger:');
    historyB.data.forEach(t => {
        console.log(`   - Reason: "${t.reason}", Change: ${t.points_change} pts, Date: ${t.created_at}`);
    });
    if (historyB.data.length !== 1 || historyB.data[0].points_change !== -5) {
        throw new Error('Ledger entry mismatch for User B');
    }

    // Clean up test accounts
    await request({
        hostname: '127.0.0.1',
        port: 8085,
        path: '/api/auth/account',
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${tokenA}` }
    });
    await request({
        hostname: '127.0.0.1',
        port: 8085,
        path: '/api/auth/account',
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${tokenB}` }
    });

    console.log('\n✓ ALL LIVE REWARD HTTP API TESTS PASSED WITH 100% SUCCESS!');
}

runLiveApiTests().catch(err => {
    console.error('Test error:', err);
    process.exit(1);
});
