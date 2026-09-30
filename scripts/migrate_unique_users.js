const fs = require('fs');

console.log('========================================================');
console.log('SAATHCHALO USER DATABASE MIGRATION & DEDUPLICATION');
console.log('========================================================\n');

const dbPath = 'saath-db.json';
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

console.log('Original database stats:');
console.log('  Users:', db.users.length);
console.log('  Bookings:', db.bookings ? db.bookings.length : 0);
console.log('  Messages:', db.messages ? db.messages.length : 0);
console.log('  Rides:', db.rides ? db.rides.length : 0);

// Canonical users definition
// 1. Real registered users (from genuine emails)
const realUsers = db.users.filter(u => {
  const email = (u.email || '').toLowerCase();
  return (
    email.endsWith('@gmail.com') ||
    email.endsWith('@gamil.com') ||
    email.endsWith('@niet.co.in')
  );
});

// Deduplicate realUsers by email in case any email was registered more than once
const uniqueRealMap = new Map();
realUsers.forEach(u => {
  const email = u.email.toLowerCase().trim();
  if (!uniqueRealMap.has(email)) {
    uniqueRealMap.set(email, u);
  }
});

// Canonical ADITYA ID
const canonicalAditya = db.users.find(u => u.email === 'ngfsadi19@gmail.com') || uniqueRealMap.get('ngfsadi19@gmail.com');
const canonicalAnshika = db.users.find(u => u.email === 'anshikayadav9216@gmail.com') || uniqueRealMap.get('anshikayadav9216@gmail.com');

// Canonical Team accounts (Teammate 3 & 4)
const firstT3 = db.users.find(u => u.name === 'Teammate 3');
const firstT4 = db.users.find(u => u.name === 'Teammate 4');

const canonicalT3 = {
  id: firstT3 ? firstT3.id : 'usr_teammate3_core',
  name: 'Teammate 3',
  email: 'teammate3@saathchalo.in',
  passwordHash: firstT3 ? firstT3.passwordHash : 'a109e36947ad56de1dca1cc49f0ef8ac9ad9a7b1aa0df41fb3c4cb73c1ff01ea',
  avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
  primary_area: 'Knowledge Park',
  joined_communities: ['knowledge-park'],
  created_at: firstT3 ? firstT3.created_at : '2026-09-30T07:25:11.153Z'
};

const canonicalT4 = {
  id: firstT4 ? firstT4.id : 'usr_teammate4_core',
  name: 'Teammate 4',
  email: 'teammate4@saathchalo.in',
  passwordHash: firstT4 ? firstT4.passwordHash : 'a109e36947ad56de1dca1cc49f0ef8ac9ad9a7b1aa0df41fb3c4cb73c1ff01ea',
  avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
  primary_area: 'Knowledge Park',
  joined_communities: ['knowledge-park'],
  created_at: firstT4 ? firstT4.created_at : '2026-09-30T07:25:11.154Z'
};

// Build final canonical users list
const canonicalUsers = Array.from(uniqueRealMap.values());
canonicalUsers.push(canonicalT3);
canonicalUsers.push(canonicalT4);

// Map old duplicate IDs to canonical IDs so historical bookings, rides, and messages are preserved!
const idRedirectMap = new Map();

db.users.forEach(u => {
  const name = u.name || '';
  const email = (u.email || '').toLowerCase();
  
  if (name.includes('Aditya') || email.includes('aditya') || email.includes('ngfsadi19')) {
    idRedirectMap.set(u.id, canonicalAditya.id);
  } else if (name.includes('Anshika') || email.includes('anshika')) {
    idRedirectMap.set(u.id, canonicalAnshika.id);
  } else if (name === 'Teammate 3' || email.includes('teammate3')) {
    idRedirectMap.set(u.id, canonicalT3.id);
  } else if (name === 'Teammate 4' || email.includes('teammate4')) {
    idRedirectMap.set(u.id, canonicalT4.id);
  }
});

// Canonical ID set
const canonicalIdSet = new Set(canonicalUsers.map(u => u.id));

console.log('\n--- CANONICAL ACCOUNTS SUMMARY ---');
console.log('Total Canonical Accounts:', canonicalUsers.length);
canonicalUsers.forEach((u, i) => {
  console.log(`  ${i+1}. [${u.id}] ${u.name} (${u.email}) - Hub: ${u.primary_area}`);
});

// Repoint bookings
let repointedBookings = 0;
(db.bookings || []).forEach(b => {
  if (idRedirectMap.has(b.user_id)) {
    b.user_id = idRedirectMap.get(b.user_id);
    repointedBookings++;
  } else if (!canonicalIdSet.has(b.user_id) && b.user_id?.startsWith('usr_guest_')) {
    // Guest bookings stay linked as guest without creating user account
  }
});
console.log('\nBookings repointed to canonical users:', repointedBookings);

// Repoint rides
let repointedRides = 0;
(db.rides || []).forEach(r => {
  if (Array.isArray(r.riders)) {
    r.riders = r.riders.map(rid => idRedirectMap.get(rid) || rid);
  }
});

// Repoint and filter messages
let repointedMessages = 0;
const cleanMessages = [];
(db.messages || []).forEach(m => {
  const oldId = m.user_id || m.sender_id;
  if (idRedirectMap.has(oldId)) {
    const targetId = idRedirectMap.get(oldId);
    m.user_id = targetId;
    m.sender_id = targetId;
    repointedMessages++;
    cleanMessages.push(m);
  } else if (canonicalIdSet.has(oldId)) {
    cleanMessages.push(m);
  } else if (m.sender_name === 'Device A Commuter' || m.sender_name === 'Device B Commuter' || m.sender_name === 'Cloudflare Live User') {
    // Drop synthetic dev probe message
  } else {
    // Keep real message
    cleanMessages.push(m);
  }
});
console.log('Messages repointed:', repointedMessages, '| Retained clean messages:', cleanMessages.length);

// Ensure joined_communities uniqueness
canonicalUsers.forEach(u => {
  if (Array.isArray(u.joined_communities)) {
    u.joined_communities = Array.from(new Set(u.joined_communities));
  } else {
    u.joined_communities = ['knowledge-park'];
  }
});

// Dry run check
console.log('\nVerification of Migrated State:');
console.log('  New user count:', canonicalUsers.length);
console.log('  Are all user IDs unique?', new Set(canonicalUsers.map(u => u.id)).size === canonicalUsers.length);
console.log('  Are all emails unique?', new Set(canonicalUsers.map(u => u.email.toLowerCase())).size === canonicalUsers.length);

// Check if Aditya, Anshika, Teammate 3, Teammate 4 each appear exactly once
['ADITYA', 'Anshika yadav', 'Teammate 3', 'Teammate 4'].forEach(name => {
  const count = canonicalUsers.filter(u => u.name === name).length;
  console.log(`  "${name}" count in database: ${count} (Expected: 1)`);
});

// Update database object with canonical users and clean messages
db.users = canonicalUsers;
db.messages = cleanMessages;

// Write updated clean database
fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
fs.writeFileSync('backup/saath-db-canonical-24-users.json', JSON.stringify(db, null, 2), 'utf8');

console.log('\n✓ SAVED CLEAN CANONICAL DATABASE TO saath-db.json & backup/saath-db-canonical-24-users.json');

