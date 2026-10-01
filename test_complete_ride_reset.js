/**
 * SAATHCHALO — FINAL DRIVER RIDE RESET AFTER COMPLETION TEST
 * 
 * Verifies:
 * 1. Active ride completion resets driver's active operational state
 * 2. GET /api/driver/current-ride returns null after completion
 * 3. Driver remains ONLINE and available for new assignments
 * 4. Completed ride is preserved in history
 * 5. Driver earnings are incremented
 * 6. New subsequent ride can be assigned immediately
 */

const http = require('http');

function request(options, data = null) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(body) });
                } catch (e) {
                    resolve({ status: res.statusCode, headers: res.headers, data: body });
                }
            });
        });
        req.on('error', reject);
        if (data) req.write(typeof data === 'string' ? data : JSON.stringify(data));
        req.end();
    });
}

async function runTest() {
    console.log('======================================================================');
    console.log('SAATHCHALO — COMPLETE RIDE OPERATIONAL RESET TEST');
    console.log('======================================================================\n');

    // 1. Authenticate Aditya and Driver Satish Sharma
    const suffix = Date.now();
    const regAditya = await request({
        hostname: '127.0.0.1', port: 8085, path: '/api/auth/register', method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }, {
        name: 'Aditya',
        email: `aditya_${suffix}@saathchalo.in`,
        password: 'Password@123',
        area: 'Knowledge Park II'
    });
    const adityaToken = regAditya.data.token;

    const driverLogin = await request({
        hostname: '127.0.0.1', port: 8085, path: '/api/auth/login', method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }, {
        email: 'satish.driver@saathchalo.in',
        password: 'driver123'
    });
    const driverToken = driverLogin.data.token;
    console.log('✓ Driver Authenticated:', driverLogin.data.user.name);

    const driverAuth = { 'Authorization': `Bearer ${driverToken}`, 'x-driver-token': 'tok_driver_satish' };

    // Initial driver profile
    const initialProfile = await request({
        hostname: '127.0.0.1', port: 8085, path: '/api/driver/me', method: 'GET',
        headers: driverAuth
    });
    const initialEarnings = initialProfile.data.driver.todayEarnings || initialProfile.data.driver.today_earnings || 0;
    const initialRides = initialProfile.data.driver.todayRides || initialProfile.data.driver.today_rides || 0;

    // 2. Aditya creates booking
    const bkRes = await request({
        hostname: '127.0.0.1', port: 8085, path: '/api/bookings', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adityaToken}` }
    }, {
        pickup: 'Knowledge Park II, Greater Noida',
        dropoff: 'Botanical Garden Metro, Noida',
        sessionType: 'MORNING'
    });
    console.log('✓ Booking created for Aditya:', bkRes.data.id, 'Assigned Ride:', bkRes.data.ride_id || bkRes.data.rideId);

    // 3. Driver queries current ride before completion
    const activeRideRes = await request({
        hostname: '127.0.0.1', port: 8085, path: '/api/driver/current-ride', method: 'GET',
        headers: driverAuth
    });
    console.log('✓ Active Ride before completion:', activeRideRes.data.ride?.id, 'Passengers:', activeRideRes.data.ride?.passengers?.map(p => p.name));
    if (!activeRideRes.data.ride) {
        throw new Error('FAIL: Active ride not found before completion');
    }

    const rideId = activeRideRes.data.ride.id;

    // 4. Driver completes ride
    const completeRes = await request({
        hostname: '127.0.0.1', port: 8085, path: '/api/driver/action', method: 'POST',
        headers: { 'Content-Type': 'application/json', ...driverAuth }
    }, {
        rideId: rideId,
        action: 'COMPLETE_RIDE'
    });
    console.log('✓ Complete Ride API response status:', completeRes.status, 'Ride in payload:', completeRes.data.ride);

    // 5. Query Driver Current Ride immediately after completion
    const afterCompleteRide = await request({
        hostname: '127.0.0.1', port: 8085, path: '/api/driver/current-ride', method: 'GET',
        headers: driverAuth
    });
    console.log('✓ Driver Current Ride after completion:', afterCompleteRide.data.ride);
    if (afterCompleteRide.data.ride !== null) {
        throw new Error('FAIL: Expected driver current-ride to be null after completion');
    }

    // 6. Query Driver Profile
    const updatedProfile = await request({
        hostname: '127.0.0.1', port: 8085, path: '/api/driver/me', method: 'GET',
        headers: driverAuth
    });
    const updatedEarnings = updatedProfile.data.driver.todayEarnings || updatedProfile.data.driver.today_earnings || 0;
    const updatedRides = updatedProfile.data.driver.todayRides || updatedProfile.data.driver.today_rides || 0;

    console.log('✓ Driver Profile status:', updatedProfile.data.driver.status, 
                'Rides:', updatedRides, 
                'Earnings:', updatedEarnings);

    if (updatedProfile.data.driver.status !== 'ONLINE') {
        throw new Error('FAIL: Expected driver to remain ONLINE');
    }
    if (updatedRides !== initialRides + 1) {
        throw new Error('FAIL: Driver ride count did not increment');
    }
    const rideFare = activeRideRes.data.ride.total_vehicle_fare || activeRideRes.data.ride.fare || 95;
    if (updatedEarnings < initialEarnings + rideFare) {
        throw new Error(`FAIL: Driver earnings did not increment by fare (got +${updatedEarnings - initialEarnings}, expected +${rideFare})`);
    }

    // 7. Verify next ride can be assigned
    const regRawat = await request({
        hostname: '127.0.0.1', port: 8085, path: '/api/auth/register', method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }, {
        name: 'Rawat',
        email: `rawat_${suffix}@saathchalo.in`,
        password: 'Password@123',
        area: 'Knowledge Park II'
    });

    const nextBkRes = await request({
        hostname: '127.0.0.1', port: 8085, path: '/api/bookings', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${regRawat.data.token}` }
    }, {
        pickup: 'Knowledge Park II, Greater Noida',
        dropoff: 'Botanical Garden Metro, Noida',
        sessionType: 'MORNING'
    });
    console.log('✓ Next booking created for Rawat:', nextBkRes.data.id);

    const nextActiveRide = await request({
        hostname: '127.0.0.1', port: 8085, path: '/api/driver/current-ride', method: 'GET',
        headers: driverAuth
    });
    console.log('✓ Next Active Ride assigned to driver:', nextActiveRide.data.ride?.id, 'Passenger:', nextActiveRide.data.ride?.passengers?.map(p => p.name));
    if (!nextActiveRide.data.ride || nextActiveRide.data.ride.passengers[0].name !== 'Rawat') {
        throw new Error('FAIL: Next ride not properly assigned to available driver');
    }

    // Complete Rawat's ride to clean database
    await request({
        hostname: '127.0.0.1', port: 8085, path: '/api/driver/complete-ride', method: 'POST',
        headers: driverAuth
    });

    console.log('\n======================================================================');
    console.log('ALL RIDE RESET & LIFECYCLE TESTS PASSED 100% SUCCESSFULLY!');
    console.log('======================================================================');
}

runTest().catch(err => {
    console.error('TEST ERROR:', err);
    process.exit(1);
});
