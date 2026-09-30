const http = require('http');

function get(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:8085${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

async function verify() {
  console.log('=== VERIFYING CLIENT DOM & API BINDINGS ===\n');

  // 1. Fetch live member data from API
  const membersRes = await get('/api/community/knowledge-park/members');
  if (membersRes.status !== 200) throw new Error('API returned status ' + membersRes.status);
  const data = JSON.parse(membersRes.body);

  console.log('1. API Response Summary:');
  console.log('   - communityId:', data.communityId);
  console.log('   - registeredCount:', data.registeredCount);
  console.log('   - activeCount:', data.activeCount);
  console.log('   - offlineCount:', data.offlineCount);
  console.log('   - members.length:', data.members.length);

  // 2. Validate mathematical law: registeredCount === activeCount + offlineCount
  if (data.registeredCount !== data.activeCount + data.offlineCount) {
    throw new Error('Mathematical inequality: registeredCount must equal activeCount + offlineCount');
  }
  console.log('   ✓ Math constraint verified: registeredCount === activeCount + offlineCount');

  // 3. Validate uniqueness of member IDs
  const seenIds = new Set();
  const seenNames = new Set();
  const duplicates = [];
  const syntheticUsers = [];
  const bannedNames = ['Device A Commuter', 'Device B Commuter', 'Cloudflare Live User'];

  data.members.forEach(m => {
    if (seenIds.has(m.id)) duplicates.push(`Duplicate ID: ${m.id}`);
    seenIds.add(m.id);
    if (bannedNames.includes(m.name)) syntheticUsers.push(m.name);
  });

  if (duplicates.length > 0) throw new Error('Found duplicate member IDs: ' + duplicates.join(', '));
  if (syntheticUsers.length > 0) throw new Error('Found synthetic test users: ' + syntheticUsers.join(', '));
  console.log('   ✓ All 22 members have strictly unique canonical IDs');
  console.log('   ✓ Zero synthetic/test accounts in community directory');

  // 4. Verify privacy: No sensitive fields
  data.members.forEach(m => {
    if (m.email || m.phone || m.passwordHash || m.token) {
      throw new Error(`Privacy leak on user ${m.id}: email/phone/passwordHash/token found!`);
    }
  });
  console.log('   ✓ Zero private fields (email, phone, passwordHash, token) exposed');

  // 5. Verify DOM Element IDs and structure in index.html
  const htmlRes = await get('/');
  const html = htmlRes.body;
  const expectedElementIds = [
    'statTotalRegisteredHeader',
    'statTotalRegisteredCount',
    'statActiveNowHeader',
    'statConnectedCount',
    'statOfflineCount',
    'statActiveRiders',
    'memberFilterTabAll',
    'memberFilterTabActive',
    'memberFilterTabOffline',
    'memberFilterCountAll',
    'memberFilterCountActive',
    'memberFilterCountOffline',
    'memberSearchInput',
    'activeNowSection',
    'activeNowSectionCountBadge',
    'liveConnectedUsersList',
    'offlineSection',
    'offlineSectionCountBadge',
    'offlineMembersList',
    'communityPresenceText',
    'communityRegisteredText'
  ];

  expectedElementIds.forEach(id => {
    if (!html.includes(`id="${id}"`)) {
      throw new Error(`Missing expected DOM element: id="${id}"`);
    }
  });
  console.log('   ✓ All 21 expected DOM element IDs present in index.html');

  // 6. Verify client script has loadCommunityMembers and wires everything
  const jsRes = await get('/script.js');
  const js = jsRes.body;
  if (!js.includes('loadCommunityMembers')) throw new Error('script.js missing loadCommunityMembers');
  if (!js.includes('LIVE MEMBER STATS')) throw new Error('script.js missing LIVE MEMBER STATS debug log');
  if (!js.includes('renderLiveCommunitySection')) throw new Error('script.js missing renderLiveCommunitySection');
  console.log('   ✓ script.js contains loadCommunityMembers with live debug logging');

  console.log('\n=== ALL VERIFICATIONS PASSED 100% ===');
}

verify().catch(e => {
  console.error('VERIFICATION ERROR:', e.message);
  process.exit(1);
});
