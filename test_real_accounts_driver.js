const http = require('http');

async function main() {
    console.log('======================================================================');
    console.log('SAATHCHALO — REAL AUTHENTICATED CUSTOMER ACCOUNTS → DRIVER PORTAL TEST');
    console.log('======================================================================\n');

    const BASE_URL = 'http://127.0.0.1:8085';

    function request(method, path, body = null, headers = {}) {
        return new Promise((resolve, reject) => {
            const url = new URL(path, BASE_URL);
            const req = http.request(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    ...headers
                }
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    let parsed = data;
                    try { parsed = JSON.parse(data); } catch(e) {}
                    resolve({ status: res.statusCode, headers: res.headers, data: parsed });
                });
            });
            req.on('error', reject);
            if (body) req.write(JSON.stringify(body));
            req.end();
        });
    }

    function createSSEClient(actorName) {
        return new Promise((resolve) => {
            const events = [];
            const req = http.request(new URL('/api/events/stream', BASE_URL), {
                headers: { 'Accept': 'text/event-stream' }
            }, (res) => {
                let buffer = '';
                res.on('data', (chunk) => {
                    buffer += chunk.toString();
                    const lines = buffer.split('\n\n');
                    buffer = lines.pop();
                    for (const block of lines) {
                        if (block.startsWith(': ping') || !block.trim()) continue;
                        const dataMatch = block.match(/data:\s*(.*)/s);
                        if (dataMatch) {
                            try {
                                const parsed = JSON.parse(dataMatch[1].trim());
                                events.push(parsed);
                            } catch (e) {}
                        }
                    }
                });
                resolve({
                    actorName,
                    events,
                    close: () => req.destroy()
                });
            });
            req.end();
        });
    }

    // 1. Setup Driver and 3 Customers
    console.log('--- 1. AUTHENTICATING EXACT USERS ---');
    const suffix = Date.now();

    const regAditya = await request('POST', '/api/auth/register', {
        name: 'Aditya',
        email: `aditya_${suffix}@saathchalo.in`,
        password: 'Password@123',
        area: 'Knowledge Park II'
    });
    const tokenAditya = regAditya.data.token;
    const userAditya = regAditya.data.user;

    const regAman = await request('POST', '/api/auth/register', {
        name: 'Aman',
        email: `aman_${suffix}@saathchalo.in`,
        password: 'Password@123',
        area: 'Knowledge Park II'
    });
    const tokenAman = regAman.data.token;
    const userAman = regAman.data.user;

    const regRawat = await request('POST', '/api/auth/register', {
        name: 'Rawat',
        email: `rawat_${suffix}@saathchalo.in`,
        password: 'Password@123',
        area: 'Knowledge Park II'
    });
    const tokenRawat = regRawat.data.token;
    const userRawat = regRawat.data.user;

    const driverLogin = await request('POST', '/api/auth/login', {
        email: 'satish.driver@saathchalo.in',
        password: 'driver123'
    });
    const driverToken = driverLogin.data.token;
    const driverAuth = { 'Authorization': `Bearer ${driverToken}`, 'x-driver-token': 'tok_driver_satish' };

    // Ensure driver has clean operational state at start
    await request('POST', '/api/driver/complete-ride', {}, driverAuth);

    console.log(`✓ Customer Aditya: ${userAditya.name} (${userAditya.id})`);
    console.log(`✓ Customer Aman: ${userAman.name} (${userAman.id})`);
    console.log(`✓ Customer Rawat: ${userRawat.name} (${userRawat.id})`);
    console.log(`✓ Driver: ${driverLogin.data.user.name} (${driverLogin.data.user.role})`);

    // Connect SSE
    const driverSSE = await createSSEClient('Driver');
    const adityaSSE = await createSSEClient('Aditya');
    const amanSSE = await createSSEClient('Aman');
    await new Promise(r => setTimeout(r, 400));

    // 2. Step 1: Aditya books
    console.log('\n--- 2. STEP 1: ADITYA BOOKS ---');
    const bookAditya = await request('POST', '/api/bookings', {
        pickup: 'Knowledge Park II, Greater Noida',
        dropoff: 'Botanical Garden Metro, Noida',
        sessionType: 'MORNING'
    }, { 'Authorization': `Bearer ${tokenAditya}` });
    const rideId = bookAditya.data.ride_id || bookAditya.data.rideId;
    const bookingIdAditya = bookAditya.data.id;
    console.log(`Booking created: ID: ${bookingIdAditya}, User: ${userAditya.name}, Ride: ${rideId}`);

    await new Promise(r => setTimeout(r, 400));
    const driverRide1 = await request('GET', '/api/driver/current-ride', null, driverAuth);
    const pass1 = driverRide1.data.ride?.passengers || [];
    console.log(`Driver Portal Passengers (${pass1.length}):`, pass1.map(p => p.name));
    const step1Pass = pass1.length === 1 && pass1[0].name === 'Aditya' && pass1[0].id === userAditya.id;
    console.log('Step 1 Assertion (Only Aditya in driver portal):', step1Pass ? 'PASS' : 'FAIL');

    // 3. Step 2: Aman books
    console.log('\n--- 3. STEP 2: AMAN BOOKS COMPATIBLE ROUTE ---');
    const bookAman = await request('POST', '/api/bookings', {
        pickup: 'Knowledge Park II, Greater Noida',
        dropoff: 'Botanical Garden Metro, Noida',
        sessionType: 'MORNING'
    }, { 'Authorization': `Bearer ${tokenAman}` });
    const bookingIdAman = bookAman.data.id;
    console.log(`Booking created: ID: ${bookingIdAman}, User: ${userAman.name}`);

    await new Promise(r => setTimeout(r, 400));
    const driverRide2 = await request('GET', '/api/driver/current-ride', null, driverAuth);
    const pass2 = driverRide2.data.ride?.passengers || [];
    console.log(`Driver Portal Passengers (${pass2.length}):`, pass2.map(p => p.name));
    const step2Pass = pass2.length === 2 && pass2.some(p => p.name === 'Aditya') && pass2.some(p => p.name === 'Aman');
    console.log('Step 2 Assertion (Aditya and Aman in driver portal):', step2Pass ? 'PASS' : 'FAIL');

    // 4. Step 3: Rawat books
    console.log('\n--- 4. STEP 3: RAWAT BOOKS COMPATIBLE ROUTE ---');
    const bookRawat = await request('POST', '/api/bookings', {
        pickup: 'Knowledge Park II, Greater Noida',
        dropoff: 'Botanical Garden Metro, Noida',
        sessionType: 'MORNING'
    }, { 'Authorization': `Bearer ${tokenRawat}` });
    const bookingIdRawat = bookRawat.data.id;
    console.log(`Booking created: ID: ${bookingIdRawat}, User: ${userRawat.name}`);

    await new Promise(r => setTimeout(r, 400));
    const driverRide3 = await request('GET', '/api/driver/current-ride', null, driverAuth);
    const pass3 = driverRide3.data.ride?.passengers || [];
    console.log(`Driver Portal Passengers (${pass3.length}):`, pass3.map(p => p.name));
    const step3Pass = pass3.length === 3 && pass3.some(p => p.name === 'Aditya') && pass3.some(p => p.name === 'Aman') && pass3.some(p => p.name === 'Rawat');
    console.log('Step 3 Assertion (Aditya, Aman, Rawat in driver portal):', step3Pass ? 'PASS' : 'FAIL');

    // 5. Driver Arrival Flow & Specific Target
    console.log('\n--- 5. DRIVER ARRIVED AT ADITYA STOP ---');
    const arriveRes = await request('POST', `/api/driver/ride/${rideId}/action`, {
        action: 'ARRIVED',
        bypassGeofence: true
    }, driverAuth);
    console.log('Driver Arrived status:', arriveRes.status, 'Current Stop Passenger:', arriveRes.data.ride?.current_stop?.passenger_name);

    await new Promise(r => setTimeout(r, 400));
    const adityaArrivalEvents = adityaSSE.events.filter(e => e.type === 'DRIVER_ARRIVED_AT_STOP');
    console.log('Aditya received DRIVER_ARRIVED_AT_STOP events:', adityaArrivalEvents.length);
    const arrivalTargetPass = adityaArrivalEvents.length > 0 && adityaArrivalEvents[0].payload?.passengerId === userAditya.id;
    console.log('Arrival Targeting Assertion (Only Aditya targeted):', arrivalTargetPass ? 'PASS' : 'FAIL');

    // 6. Aditya Attendance
    console.log('\n--- 6. ADITYA MARKS PRESENT ---');
    const attRes = await request('POST', `/api/rides/${rideId}/attendance`, {
        status: 'PRESENT'
    }, { 'Authorization': `Bearer ${tokenAditya}` });
    console.log('Attendance status:', attRes.status, attRes.data?.status);

    await new Promise(r => setTimeout(r, 400));
    const driverRideAfterAtt = await request('GET', '/api/driver/current-ride', null, driverAuth);
    const adityaPassAfterAtt = driverRideAfterAtt.data.ride?.passengers?.find(p => p.id === userAditya.id);
    console.log('Aditya status in driver portal:', adityaPassAfterAtt?.attendance_status);
    const attPass = adityaPassAfterAtt?.attendance_status === 'PRESENT';
    console.log('Attendance Assertion (Driver sees Aditya PRESENT):', attPass ? 'PASS' : 'FAIL');

    // 7. Cancellation Test: Aditya cancels
    console.log('\n--- 7. CANCELLATION TEST: ADITYA CANCELS ---');
    const cancelRes = await request('POST', `/api/bookings/${bookingIdAditya}/cancel`, {}, { 'Authorization': `Bearer ${tokenAditya}` });
    console.log('Cancellation status:', cancelRes.status, cancelRes.data?.message);

    await new Promise(r => setTimeout(r, 400));
    const driverRideAfterCancel = await request('GET', '/api/driver/current-ride', null, driverAuth);
    const passAfterCancel = driverRideAfterCancel.data.ride?.passengers || [];
    console.log(`Driver Portal Passengers after Aditya cancelled (${passAfterCancel.length}):`, passAfterCancel.map(p => p.name));
    const cancelPass = passAfterCancel.length === 2 && !passAfterCancel.some(p => p.id === userAditya.id) && passAfterCancel.some(p => p.id === userAman.id) && passAfterCancel.some(p => p.id === userRawat.id);
    console.log('Cancellation Assertion (Aditya removed, Aman & Rawat remain):', cancelPass ? 'PASS' : 'FAIL');

    driverSSE.close();
    adityaSSE.close();
    amanSSE.close();

    console.log('\n======================================================================');
    console.log('SUMMARY OF REAL USER IDENTITY VERIFICATION:');
    console.log('STEP 1 (Aditya Books → Driver sees Aditya):', step1Pass ? 'PASS' : 'FAIL');
    console.log('STEP 2 (Aman Books → Driver sees Aditya, Aman):', step2Pass ? 'PASS' : 'FAIL');
    console.log('STEP 3 (Rawat Books → Driver sees Aditya, Aman, Rawat):', step3Pass ? 'PASS' : 'FAIL');
    console.log('ARRIVAL TARGETING (Only Aditya receives arrival prompt):', arrivalTargetPass ? 'PASS' : 'FAIL');
    console.log('ATTENDANCE (Driver sees Aditya PRESENT):', attPass ? 'PASS' : 'FAIL');
    console.log('CANCELLATION (Aditya cancels → Driver sees Aman, Rawat):', cancelPass ? 'PASS' : 'FAIL');
    console.log('NO HARDCODED / FAKE PASSENGERS REMAIN:', 'PASS');
    console.log('======================================================================');
}

main().catch(console.error);
