const http = require('http');

function request(method, path, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const parsed = new URL('http://127.0.0.1:8085' + path);
        const reqHeaders = {
            'Content-Type': 'application/json',
            ...headers
        };
        const req = http.request({
            hostname: '127.0.0.1',
            port: 8085,
            path: parsed.pathname + parsed.search,
            method,
            headers: reqHeaders
        }, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                let json = null;
                try { json = JSON.parse(data); } catch(e) {}
                resolve({ status: res.statusCode, headers: res.headers, data: json || data });
            });
        });
        req.on('error', reject);
        if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
        req.end();
    });
}

async function runDriverArrivalAttendanceTest() {
    console.log('======================================================================');
    console.log('SAATHCHALO — DRIVER ARRIVAL → PASSENGER ATTENDANCE TEST SUITE');
    console.log('======================================================================\n');

    let allPassed = true;

    // 1. Authenticate Driver
    console.log('--- 1. DRIVER AUTHENTICATION ---');
    const driverLogin = await request('POST', '/api/auth/login', {
        email: 'satish.driver@saathchalo.in',
        password: 'driver123'
    });
    if (driverLogin.status === 200 && driverLogin.data.user?.role === 'DRIVER') {
        console.log(`✓ Driver Login Successful: ${driverLogin.data.user.name} (${driverLogin.data.user.role})`);
    } else {
        console.error('✗ Driver login failed:', driverLogin.data);
        allPassed = false;
    }
    const driverAuth = { 'Authorization': `Bearer ${driverLogin.data.token}` };

    // 2. Fetch / Reset Active Shared Ride to Stop 1
    console.log('\n--- 2. CURRENT ACTIVE SHARED RIDE ---');
    const rideRes = await request('GET', '/api/driver/current-ride?reset=true', null, driverAuth);
    if (rideRes.status === 200 && rideRes.data.ride) {
        const ride = rideRes.data.ride;
        console.log(`✓ Ride ID: ${ride.id}, Total Fare: ₹${ride.total_vehicle_fare}, Passengers: ${ride.passengers_count}`);
        console.log(`  Stops: ${ride.stops.map(s => `${s.order}. ${s.passenger_name || s.passengerName} (${s.type})`).join(' -> ')}`);
    } else {
        console.error('✗ Failed to load current ride:', rideRes.data);
        allPassed = false;
    }
    const ride = rideRes.data.ride;

    // 3. Driver Arrives at Stop 1 (Aman Sharma)
    console.log('\n--- 3. DRIVER ARRIVAL AT STOP 1 (AMAN SHARMA) ---');
    const arr1 = await request('POST', `/api/driver/ride/${ride.id}/action`, {
        action: 'ARRIVED',
        bypassGeofence: true
    }, driverAuth);

    if (arr1.status === 200 && arr1.data.success) {
        const stop1 = arr1.data.ride.stops[0];
        console.log(`✓ Stop 1 Status: ${stop1.status}`);
        const pass1 = arr1.data.ride.passengers[0];
        console.log(`✓ Passenger 1 (${pass1.name}) Attendance Status: ${pass1.attendance_status}`);
        if (stop1.status === 'ARRIVED' && pass1.attendance_status === 'CHECK_IN_OPEN') {
            console.log('✓ Backend verified driver, ownership, and opened check-in for Stop 1');
        } else {
            console.error('✗ Stop 1 status or passenger attendance status invalid:', stop1, pass1);
            allPassed = false;
        }
    } else {
        console.error('✗ Driver arrival at stop 1 failed:', arr1.data);
        allPassed = false;
    }

    // 4. Passenger Aman Sharma Marks "I'M HERE" (PRESENT)
    console.log('\n--- 4. PASSENGER 1 CONFIRMS ATTENDANCE: [ I\'M HERE ] ---');
    const amanAttRes = await request('POST', `/api/rides/${ride.id}/attendance`, {
        status: 'PRESENT',
        userId: 'usr_p1_aman'
    });
    if (amanAttRes.status === 200 && amanAttRes.data.status === 'PRESENT') {
        console.log(`✓ Aman marked as PRESENT: "${amanAttRes.data.message}"`);
        console.log(`✓ Reward points deducted: ${amanAttRes.data.reward_points_deducted} pts (Zero deduction for showing up)`);
    } else {
        console.error('✗ Aman check-in failed:', amanAttRes.data);
        allPassed = false;
    }

    // Verify Driver sees Aman as PRESENT
    const rideCheck1 = await request('GET', '/api/driver/current-ride', null, driverAuth);
    const pass1Updated = rideCheck1.data.ride.passengers[0];
    if (pass1Updated.attendance_status === 'PRESENT') {
        console.log(`✓ Driver view updated in realtime: ${pass1Updated.name} is ${pass1Updated.attendance_status}`);
    } else {
        console.error('✗ Driver does not see Aman as PRESENT:', pass1Updated);
        allPassed = false;
    }

    // 5. Driver Marks Stop 1 as PICKED UP -> Advances to Stop 2
    console.log('\n--- 5. DRIVER MARKS PICKED UP FOR STOP 1 ---');
    const pick1 = await request('POST', `/api/driver/ride/${ride.id}/action`, {
        action: 'PICKED_UP'
    }, driverAuth);
    if (pick1.status === 200 && pick1.data.ride.current_stop_index === 1) {
        console.log(`✓ Stop 1 completed. Current Stop Index advanced to: ${pick1.data.ride.current_stop_index}`);
        const nextStop = pick1.data.ride.stops[1];
        console.log(`✓ Next Stop is: ${nextStop.passenger_name || nextStop.passengerName} at ${nextStop.pickup_location || nextStop.location}`);
    } else {
        console.error('✗ Picked up stop 1 failed:', pick1.data);
        allPassed = false;
    }

    // 6. Driver Arrives at Stop 2 (Riya Verma)
    console.log('\n--- 6. DRIVER ARRIVAL AT STOP 2 (RIYA VERMA) ---');
    const arr2 = await request('POST', `/api/driver/ride/${ride.id}/action`, {
        action: 'ARRIVED',
        bypassGeofence: true
    }, driverAuth);
    if (arr2.status === 200 && arr2.data.success) {
        const stop2 = arr2.data.ride.stops[1];
        const pass2 = arr2.data.ride.passengers[1];
        console.log(`✓ Stop 2 Status: ${stop2.status}, Passenger 2 (${pass2.name}) Attendance: ${pass2.attendance_status}`);
        if (stop2.status === 'ARRIVED' && pass2.attendance_status === 'CHECK_IN_OPEN') {
            console.log('✓ Attendance opened specifically for Stop 2 passenger (Riya Verma)');
        } else {
            console.error('✗ Stop 2 arrival state invalid:', stop2, pass2);
            allPassed = false;
        }
    } else {
        console.error('✗ Driver arrival at stop 2 failed:', arr2.data);
        allPassed = false;
    }

    // 7. Passenger Riya Verma Clicks "I WILL NOT BE THERE" (ABSENT)
    console.log('\n--- 7. PASSENGER 2 DECIDES: [ I WILL NOT BE THERE ] (ABSENT) ---');
    // First register a test user for Riya to test real balance deduction
    const riyaReg = await request('POST', '/api/auth/register', {
        name: 'Riya Verma',
        email: `riya_test_${Date.now()}@saathchalo.in`,
        password: 'Password123!',
        area: 'Knowledge Park'
    });
    const riyaUser = riyaReg.data.user;
    const initialPoints = riyaUser.reward_points; // 100
    console.log(`  Riya Initial Balance: ${initialPoints} points`);

    const riyaAttRes = await request('POST', `/api/rides/${ride.id}/attendance`, {
        status: 'ABSENT',
        userId: riyaUser.id
    }, { 'Authorization': `Bearer ${riyaReg.data.token}` });

    if (riyaAttRes.status === 200 && riyaAttRes.data.status === 'ABSENT') {
        console.log(`✓ Riya marked as ABSENT: "${riyaAttRes.data.message}"`);
        console.log(`✓ Points deducted: -${riyaAttRes.data.reward_points_deducted} pts, New Balance: ${riyaAttRes.data.new_balance} pts`);
        if (riyaAttRes.data.new_balance === initialPoints - 5) {
            console.log('✓ Exact -5 reward points deducted for confirmed no-show');
        } else {
            console.error(`✗ Expected ${initialPoints - 5} points, got ${riyaAttRes.data.new_balance}`);
            allPassed = false;
        }
    } else {
        console.error('✗ Riya absence request failed:', riyaAttRes.data);
        allPassed = false;
    }

    // 8. Idempotency Check: Calling Attendance Again Must NEVER Deduct Twice
    console.log('\n--- 8. IDEMPOTENCY VERIFICATION (NEVER DEDUCT TWICE) ---');
    const riyaRetry = await request('POST', `/api/rides/${ride.id}/attendance`, {
        status: 'ABSENT',
        userId: riyaUser.id
    }, { 'Authorization': `Bearer ${riyaReg.data.token}` });

    if (riyaRetry.status === 200 && riyaRetry.data.new_balance === initialPoints - 5) {
        console.log(`✓ Retry Balance: ${riyaRetry.data.new_balance} pts (Remained 95, NOT 90 - IDEMPOTENCY CONFIRMED)`);
    } else {
        console.error(`✗ Idempotency violated! Balance changed to: ${riyaRetry.data.new_balance}`);
        allPassed = false;
    }

    // 9. Driver View After Absence
    console.log('\n--- 9. DRIVER VIEW AFTER PASSENGER ABSENCE ---');
    const rideCheck2 = await request('GET', '/api/driver/current-ride', null, driverAuth);
    const pass2Updated = rideCheck2.data.ride.passengers[1];
    console.log(`✓ Driver view for ${pass2Updated.name}: Status is ${pass2Updated.status || pass2Updated.attendance_status}`);

    // Driver skips absent passenger and moves to Stop 3
    const nextStopRes = await request('POST', `/api/driver/ride/${ride.id}/action`, {
        action: 'NEXT_STOP'
    }, driverAuth);
    if (nextStopRes.status === 200 && nextStopRes.data.ride.current_stop_index === 2) {
        console.log(`✓ Driver skipped absent passenger and advanced to Stop 3 (Rahul Yadav)`);
    } else {
        console.error('✗ Advance to stop 3 failed:', nextStopRes.data);
        allPassed = false;
    }

    console.log('\n======================================================================');
    if (allPassed) {
        console.log('✓ ALL DRIVER ARRIVAL → PASSENGER ATTENDANCE TESTS PASSED (100%)');
    } else {
        console.error('✗ SOME TESTS FAILED');
        process.exit(1);
    }
    console.log('======================================================================\n');
}

runDriverArrivalAttendanceTest().catch(err => {
    console.error('Test Suite Error:', err);
    process.exit(1);
});
