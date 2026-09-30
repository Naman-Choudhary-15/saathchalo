const http = require('http');

function fetch(url) {
    return new Promise((resolve, reject) => {
        http.get(url, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve({ status: res.statusCode, data }));
        }).on('error', reject);
    });
}

async function verify() {
    console.log('--- VERIFYING STATIC ASSETS & HTML ---');
    const index = await fetch('http://localhost:8085/');
    console.log('Index HTML status:', index.status);

    const checks = [
        'id="live-community"',
        'href="#live-community"',
        'id="statConnectedCount"',
        'id="statActiveRiders"',
        'id="statRidesOrganizing"',
        'id="liveConnectedUsersList"',
        'id="toggleTrafficLayerBtn"',
        'id="toggleCorridorLayerBtn"',
        'id="toggleVehiclesLayerBtn"',
        'pricing.config.js',
        'id="bookingModal"',
        'id="rideDetails"'
    ];

    let allPassed = true;
    for (const c of checks) {
        if (index.data.includes(c)) {
            console.log('✓ Found:', c);
        } else {
            console.error('✗ Missing:', c);
            allPassed = false;
        }
    }

    console.log('\n--- VERIFYING SCRIPTS ---');
    const scripts = ['/pricing.config.js', '/script.js', '/supabase-client.js', '/env.js'];
    for (const s of scripts) {
        const res = await fetch('http://localhost:8085' + s);
        console.log(`Script ${s}: status ${res.status}, length ${res.data.length}`);
        if (res.status !== 200) allPassed = false;
    }

    if (allPassed) {
        console.log('\n✓ ALL SERVER ASSETS & DOM ELEMENTS VERIFIED SUCCESSFULLY!');
    } else {
        console.error('\n✗ SOME CHECKS FAILED!');
        process.exit(1);
    }
}
verify();
