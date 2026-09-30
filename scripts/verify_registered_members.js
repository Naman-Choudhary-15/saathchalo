const fs = require('fs');

console.log('========================================================');
console.log('VERIFYING REGISTERED MEMBERS SECTION IMPLEMENTATION');
console.log('========================================================\n');

// 1. Verify HTML Structure
const html = fs.readFileSync('index.html', 'utf8');
const requiredIds = [
    'live-community',
    'statActiveNowHeader',
    'statTotalRegisteredHeader',
    'statTotalRegisteredCount',
    'statConnectedCount',
    'statOfflineCount',
    'statActiveRiders',
    'memberFilterTabAll',
    'memberFilterTabActive',
    'memberFilterTabOffline',
    'memberSearchInput',
    'activeNowSection',
    'offlineSection',
    'liveConnectedUsersList',
    'offlineMembersList',
    'communityRegisteredCountBadge',
    'communityPresenceBadge'
];

console.log('1. Checking HTML elements:');
let missingHtml = 0;
for (const id of requiredIds) {
    if (html.includes(`id="${id}"`)) {
        console.log(`   ✓ id="${id}"`);
    } else {
        console.log(`   ✗ MISSING id="${id}"`);
        missingHtml++;
    }
}

// 2. Verify script.js functions
const script = fs.readFileSync('script.js', 'utf8');
const requiredFunctions = [
    'renderLiveCommunitySection',
    'renderFilteredCommunityMembers',
    'setMemberFilter',
    'handleMemberSearchInput',
    'toggleShowAllOfflineMembers',
    'updatePresenceCountUI'
];

console.log('\n2. Checking JavaScript logic in script.js:');
let missingJs = 0;
for (const fn of requiredFunctions) {
    if (script.includes(fn)) {
        console.log(`   ✓ Function ${fn}`);
    } else {
        console.log(`   ✗ MISSING Function ${fn}`);
        missingJs++;
    }
}

// 3. Verify API endpoint & privacy
console.log('\n3. Testing presence API endpoint:');
async function testApi() {
    try {
        const res = await fetch('http://127.0.0.1:8085/api/presence');
        const data = await res.json();
        
        console.log(`   ✓ Total Registered: ${data.totalRegisteredUsers}`);
        console.log(`   ✓ Connected (Active Now): ${data.connectedCount}`);
        console.log(`   ✓ Offline Users Count: ${data.offlineCount}`);
        console.log(`   ✓ Connected Users Array: ${data.connectedUsers.length} users`);
        console.log(`   ✓ Offline Users Array: ${data.offlineUsers.length} users`);
        
        // Privacy check
        let privacyLeak = false;
        const allUsers = [...data.connectedUsers, ...data.offlineUsers];
        for (const u of allUsers) {
            if (u.email || u.phone || u.passwordHash || u.token) {
                console.log(`   ✗ PRIVACY LEAK detected for user ${u.name}`);
                privacyLeak = true;
                break;
            }
        }
        if (!privacyLeak) {
            console.log('   ✓ Strict Privacy Verified: No email, phone, token, or password exposed');
        }

        console.log('\n========================================================');
        if (missingHtml === 0 && missingJs === 0 && !privacyLeak) {
            console.log('🎉 ALL REGISTERED MEMBERS CHECKS PASSED SUCCESSFULLY!');
        } else {
            console.log('⚠️ Issues found during verification.');
        }
        console.log('========================================================');
    } catch (e) {
        console.error('API Test Error:', e.message);
    }
}

testApi();
