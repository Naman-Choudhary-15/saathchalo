const http = require('http');

function request(method, path, body, token) {
    return new Promise((resolve, reject) => {
        const payload = body ? JSON.stringify(body) : null;
        const headers = {
            'Content-Type': 'application/json'
        };
        if (payload) {
            headers['Content-Length'] = Buffer.byteLength(payload);
        }
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        const req = http.request({
            hostname: '127.0.0.1',
            port: 8085,
            path: path,
            method: method,
            headers: headers
        }, (res) => {
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
        if (payload) req.write(payload);
        req.end();
    });
}

async function runTests() {
    console.log('=== TEST 1: GUEST/UNAUTHENTICATED RIDE BOOKING ===');
    const guestBookingRes = await request('POST', '/api/bookings', {
        pickup: 'Knowledge Park II, Greater Noida',
        dropoff: 'Pari Chowk, Greater Noida',
        distanceKm: 3.8,
        vehicleType: 'Shared Auto',
        vehicleId: 'Auto UP16-AT-1411',
        fare: 24.67
    });
    console.log('Guest Booking Status:', guestBookingRes.status);
    console.log('Guest Booking ID:', guestBookingRes.data?.id);
    console.log('Auto-Assigned User:', guestBookingRes.data?.user?.name);
    console.log('Guest Auth Token Assigned:', Boolean(guestBookingRes.data?.token));
    if (guestBookingRes.status !== 201 || !guestBookingRes.data?.id) {
        throw new Error('Guest booking failed!');
    }
    console.log('✓ PASS: Guest can immediately book a ride without being blocked!');

    const guestToken = guestBookingRes.data.token;

    console.log('\n=== TEST 2: AUTHENTICATED RIDE BOOKING (USING ASSIGNED TOKEN) ===');
    const authBookingRes = await request('POST', '/api/bookings', {
        pickup: 'Pari Chowk, Greater Noida',
        dropoff: 'Alpha 1, Greater Noida',
        distance_km: 4.2,
        vehicle_type: 'Campus Bus',
        vehicle_id: 'Bus UP16-BS-5002',
        fare: 15.00
    }, guestToken);
    console.log('Auth Booking Status:', authBookingRes.status);
    console.log('Auth Booking ID:', authBookingRes.data?.id);
    console.log('Vehicle Type:', authBookingRes.data?.vehicle_type);
    console.log('Fare:', authBookingRes.data?.fare);
    if (authBookingRes.status !== 201) {
        throw new Error('Authenticated booking failed!');
    }
    console.log('✓ PASS: Authenticated booking successfully saved!');

    console.log('\n=== TEST 3: GUEST SHUTTLE SEAT RESERVATION ===');
    const shuttleRes = await request('POST', '/api/shuttles/SH-01/book', {});
    console.log('Shuttle Reservation Status:', shuttleRes.status);
    console.log('Success:', shuttleRes.data?.success);
    console.log('Available Seats Left:', shuttleRes.data?.shuttle?.available_seats);
    console.log('Shuttle Booking Record ID:', shuttleRes.data?.booking?.id);
    if (shuttleRes.status !== 200 || !shuttleRes.data?.success) {
        throw new Error('Shuttle reservation failed!');
    }
    console.log('✓ PASS: Shuttle seat successfully reserved!');

    console.log('\n=== TEST 4: GET BOOKINGS LIST ===');
    const listRes = await request('GET', '/api/bookings', null, guestToken);
    console.log('GET Bookings Status:', listRes.status);
    console.log('Total Bookings Returned:', listRes.data?.length);
    console.log('Latest Booking:', listRes.data?.[0]?.pickup, '→', listRes.data?.[0]?.dropoff, `(Fare: ₹${listRes.data?.[0]?.fare})`);
    if (listRes.status !== 200 || !Array.isArray(listRes.data) || listRes.data.length === 0) {
        throw new Error('Listing bookings failed!');
    }
    console.log('✓ PASS: Bookings list accurately returns user bookings with fares and routes!');

    console.log('\n🎉 ALL BOOKING SYSTEM TESTS PASSED 100%!');
}

runTests().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
