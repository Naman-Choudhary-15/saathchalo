// Comprehensive Automated Verification for SAATHCHALO Social Mobility Map
const http = require('http');

function request(method, path, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const payload = body ? JSON.stringify(body) : null;
        const reqHeaders = {
            'Content-Type': 'application/json',
            ...headers
        };
        if (payload) {
            reqHeaders['Content-Length'] = Buffer.byteLength(payload);
        }

        const req = http.request({
            hostname: 'localhost',
            port: 8085,
            path,
            method,
            headers: reqHeaders
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = data ? JSON.parse(data) : {};
                    resolve({ status: res.statusCode, body: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, body: data });
                }
            });
        });

        req.on('error', reject);
        if (payload) req.write(payload);
        req.end();
    });
}

async function runTests() {
    console.log('=== TEST 1: REGISTER REAL USER 1 (Aditya) & USER 2 (Anshika) ===');
    const email1 = `aditya_test_${Date.now()}@example.com`;
    const reg1 = await request('POST', '/api/auth/register', {
        name: 'Aditya',
        email: email1,
        password: 'Password123!',
        area: 'Knowledge Park',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'
    });
    console.log('User 1 Register Status:', reg1.status, 'User ID:', reg1.body?.user?.id);
    const token1 = reg1.body.token;
    const user1Id = reg1.body.user.id;

    const email2 = `anshika_test_${Date.now()}@example.com`;
    const reg2 = await request('POST', '/api/auth/register', {
        name: 'Anshika',
        email: email2,
        password: 'Password123!',
        area: 'Knowledge Park',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80'
    });
    console.log('User 2 Register Status:', reg2.status, 'User ID:', reg2.body?.user?.id);
    const token2 = reg2.body.token;
    const user2Id = reg2.body.user.id;

    if (!token1 || !token2) throw new Error('FAIL: Registration failed');
    console.log('✓ PASS: Both real authenticated users registered successfully');

    console.log('\n=== TEST 2: POST /api/locations (USER 1 SHARING LOCATION) ===');
    const loc1 = await request('POST', '/api/locations', {
        latitude: 28.4744,
        longitude: 77.5040,
        accuracy: 12,
        destination: 'Pari Chowk',
        sharing_enabled: true
    }, { 'Authorization': `Bearer ${token1}` });

    console.log('User 1 Location Status:', loc1.status, 'Success:', loc1.body?.success);
    if (loc1.status === 200 && loc1.body.success) {
        console.log('✓ PASS: User 1 (Aditya) location successfully registered');
    } else {
        throw new Error('FAIL: User 1 location post failed');
    }

    console.log('\n=== TEST 3: POST /api/locations (USER 2 - ANSHIKA SHARING LOCATION) ===');
    const loc2 = await request('POST', '/api/locations', {
        latitude: 28.4720,
        longitude: 77.5075,
        accuracy: 8,
        destination: 'Pari Chowk',
        sharing_enabled: true
    }, { 'Authorization': `Bearer ${token2}` });

    console.log('User 2 Location Status:', loc2.status, 'Success:', loc2.body?.success);
    if (loc2.status === 200 && loc2.body.success) {
        console.log('✓ PASS: User 2 (Anshika) location successfully registered');
    } else {
        throw new Error('FAIL: User 2 location post failed');
    }

    console.log('\n=== TEST 4: VERIFY OPTED-IN COMMUTERS & DESTINATION MATCHING ===');
    const getLocs = await request('GET', '/api/locations');
    console.log('GET /api/locations Status:', getLocs.status);
    console.log('Total Visible Commuters:', getLocs.body?.totalVisible);
    const visibleUsers = getLocs.body?.locations || [];
    console.log('Active Visible Commuters:', visibleUsers.map(u => `${u.name} (Dest: ${u.destination})`));

    const user1InList = visibleUsers.find(u => u.user_id === user1Id);
    const user2InList = visibleUsers.find(u => u.user_id === user2Id);
    if (user1InList && user2InList) {
        console.log('✓ PASS: Both authenticated opted-in users appear on live map');
    } else {
        throw new Error('FAIL: Opted-in users not found in /api/locations');
    }

    // Verify privacy: no email or phone leaked
    if (user1InList.email || user1InList.password || user1InList.phone) {
        throw new Error('FAIL: Privacy leak detected! Private profile fields exposed.');
    }
    console.log('✓ PASS: Zero private profile information (no email, phone, password) exposed!');

    console.log('\n=== TEST 5: LOCATION PRIVACY TOGGLE (USER 1 TURNS SHARING OFF) ===');
    const privRes = await request('POST', '/api/locations/privacy', {
        sharing_enabled: false,
        visibility_state: 'NOT_SHARING'
    }, { 'Authorization': `Bearer ${token1}` });

    console.log('Privacy Toggle Status:', privRes.status, 'Body:', privRes.body);
    if (privRes.status === 200 && privRes.body.success) {
        console.log('✓ PASS: User 1 privacy state toggled to NOT_SHARING');
    } else {
        throw new Error('FAIL: Privacy toggle failed');
    }

    console.log('\n=== TEST 6: VERIFY USER 1 REMOVED FROM LIVE MAP BUT USER 2 REMAINS ===');
    const getLocsAfter = await request('GET', '/api/locations');
    const visibleAfter = getLocsAfter.body?.locations || [];
    const user1StillPresent = visibleAfter.find(u => u.user_id === user1Id);
    const user2StillPresent = visibleAfter.find(u => u.user_id === user2Id);

    if (!user1StillPresent) {
        console.log('✓ PASS: User 1 is hidden from other community members on the live map');
    } else {
        throw new Error('FAIL: User 1 still appears on map after turning sharing off');
    }

    if (user2StillPresent) {
        console.log('✓ PASS: User 2 (Anshika) remains visible with active sharing');
    } else {
        throw new Error('FAIL: User 2 was unexpectedly removed');
    }

    console.log('\n=== TEST 7: GET /api/vehicles (ASSIGNED CAMPUS VEHICLES) ===');
    const vehRes = await request('GET', '/api/vehicles');
    console.log('Status:', vehRes.status, 'Total Vehicles:', vehRes.body?.totalVehicles);
    const vehicles = vehRes.body?.vehicles || [];
    console.log('Assigned Fleet:', vehicles.map(v => `${v.type} (${v.id}) - ETA: ${v.eta}, Seats: ${v.seats_occupied}/${v.capacity}, Status: ${v.status}`));

    const hasAuto = vehicles.some(v => v.type === 'Auto');
    const hasTraveller = vehicles.some(v => v.type === 'Traveller' || v.type === 'Shuttle');
    const hasBus = vehicles.some(v => v.type === 'Bus');

    if (hasAuto && hasTraveller && hasBus) {
        console.log('✓ PASS: Campus fleet features distinct Auto, Traveller, and Bus vehicles with ETA & capacity');
    } else {
        throw new Error('FAIL: Complete vehicle fleet not returned');
    }

    console.log('\n🎉 ALL SOCIAL MOBILITY MAP ENDPOINT & PRIVACY TESTS PASSED 100%!');
}

runTests().catch(err => {
    console.error('Test error:', err);
    process.exit(1);
});
