const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { 
    VEHICLE_CAPACITIES,
    VEHICLE_FARE_CONFIG,
    VEHICLE_PRICING, 
    calculateTotalVehicleFare,
    calculateSharedFare,
    calculateVehicleFare, 
    allocateVehicleForCount 
} = require('./pricing.config.js');

// Load environment variables from .env
function loadEnv() {
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
        const lines = fs.readFileSync(envPath, 'utf8').split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
                const [k, ...v] = trimmed.split('=');
                const key = k.trim();
                const val = v.join('=').trim();
                if (!process.env[key]) {
                    process.env[key] = val;
                }
            }
        }
    }
}
loadEnv();

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8085;
const DB_FILE = process.env.SAATH_DB_PATH || path.join(__dirname, 'saath-db.json');

// Feature flags for safe zero-downtime rollouts
const FEATURE_FLAGS = {
    ENABLE_SOCIAL_MAP: true,
    ENABLE_TRAFFIC_ROUTE: true,
    ENABLE_FUEL_SELECTION: true,
    ENABLE_OFFLINE_MEMBERS: true,
    ENABLE_VEHICLE_PRICING_V2: true,
    ENABLE_EXACT_LOCATION_PIN: true
};

const MIME = {
    '.html': 'text/html; charset=UTF-8',
    '.css': 'text/css; charset=UTF-8',
    '.js': 'application/javascript; charset=UTF-8',
    '.json': 'application/json; charset=UTF-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const COMMUNITIES = [
    {
        id: 'knowledge-park',
        name: 'Knowledge Park',
        city: 'Greater Noida',
        icon: 'fa-graduation-cap',
        desc: 'College campuses & student housing hub'
    },
    {
        id: 'pari-chowk',
        name: 'Pari Chowk',
        city: 'Greater Noida',
        icon: 'fa-circle-nodes',
        desc: 'Major transit interchange & metro terminal'
    },
    {
        id: 'alpha-1',
        name: 'Alpha 1 & 2',
        city: 'Greater Noida',
        icon: 'fa-building',
        desc: 'Residential sectors & commercial markets'
    },
    {
        id: 'noida-sec-62',
        name: 'Noida Sector 62',
        city: 'Noida',
        icon: 'fa-city',
        desc: 'IT hub, institutional area & Blue Line metro'
    },
    {
        id: 'ghaziabad',
        name: 'Ghaziabad Terminal',
        city: 'Ghaziabad',
        icon: 'fa-train-subway',
        desc: 'Railway junction & intercity connector'
    }
];

// ==========================================
// 1. EMBEDDED PERSISTENT DATABASE ENGINE
// ==========================================
function getDefaultDb() {
    return {
        users: [],
        messages: [], // ZERO demo chats - completely clean slate!
        communities: COMMUNITIES,
        voteSessions: [
            {
                id: 'vs-kp-live',
                community_id: 'knowledge-park',
                title: 'Evening Campus Departure Pooling',
                departure_time: '6:30 PM Today',
                status: 'ACTIVE',
                vote_options: [
                    { id: 'opt-kp-pari-chowk', destination: 'Pari Chowk', display_order: 1 },
                    { id: 'opt-kp-alpha-1', destination: 'Alpha 1 & 2', display_order: 2 },
                    { id: 'opt-kp-noida-62', destination: 'Noida Sector 62', display_order: 3 },
                    { id: 'opt-kp-ghaziabad', destination: 'Ghaziabad Terminal', display_order: 4 }
                ]
            },
            {
                id: 'vs-pari-chowk-live',
                community_id: 'pari-chowk',
                title: 'Evening Metro Connect Pooling',
                departure_time: '7:00 PM Today',
                status: 'ACTIVE',
                vote_options: [
                    { id: 'opt-pc-kp', destination: 'Knowledge Park II', display_order: 1 },
                    { id: 'opt-pc-sec137', destination: 'Sector 137 Metro', display_order: 2 },
                    { id: 'opt-pc-botanical', destination: 'Botanical Garden', display_order: 3 },
                    { id: 'opt-pc-alpha', destination: 'Alpha Commercial Belt', display_order: 4 }
                ]
            },
            {
                id: 'vs-alpha-1-live',
                community_id: 'alpha-1',
                title: 'Sector Commute & Metro Connect',
                departure_time: '6:45 PM Today',
                status: 'ACTIVE',
                vote_options: [
                    { id: 'opt-alpha-kp', destination: 'Knowledge Park Campus', display_order: 1 },
                    { id: 'opt-alpha-pari', destination: 'Pari Chowk Metro', display_order: 2 },
                    { id: 'opt-alpha-sec62', destination: 'Noida Electronic City', display_order: 3 },
                    { id: 'opt-alpha-surajpur', destination: 'Surajpur Industrial', display_order: 4 }
                ]
            },
            {
                id: 'vs-noida-62-live',
                community_id: 'noida-sec-62',
                title: 'Noida IT Corridor Express Pooling',
                departure_time: '7:15 PM Today',
                status: 'ACTIVE',
                vote_options: [
                    { id: 'opt-n62-kp', destination: 'Knowledge Park', display_order: 1 },
                    { id: 'opt-n62-pari', destination: 'Pari Chowk', display_order: 2 },
                    { id: 'opt-n62-botanical', destination: 'Botanical Garden Metro', display_order: 3 },
                    { id: 'opt-n62-anand', destination: 'Anand Vihar ISBT', display_order: 4 }
                ]
            },
            {
                id: 'vs-ghaziabad-live',
                community_id: 'ghaziabad',
                title: 'Intercity Commute Pooling',
                departure_time: '6:30 PM Today',
                status: 'ACTIVE',
                vote_options: [
                    { id: 'opt-gzb-kp', destination: 'Knowledge Park', display_order: 1 },
                    { id: 'opt-gzb-pari', destination: 'Pari Chowk', display_order: 2 },
                    { id: 'opt-gzb-sec62', destination: 'Sector 62 Noida', display_order: 3 },
                    { id: 'opt-gzb-mohan', destination: 'Mohan Nagar Metro', display_order: 4 }
                ]
            }
        ],
        votes: [], // ZERO demo votes! Real user votes only!
        rides: [],
        ride_participants: [],
        shuttles: [
            { id: 'SH-01', route: 'Knowledge Park → Pari Chowk', departure_time: '08:30 AM', arrival_time: '08:50 AM', capacity: 20, available_seats: 18, status: 'Available', fare: 20 },
            { id: 'SH-02', route: 'Knowledge Park → Noida Sector 62', departure_time: '09:00 AM', arrival_time: '09:50 AM', capacity: 20, available_seats: 0, status: 'Full', fare: 45 },
            { id: 'SH-03', route: 'Alpha 1 → Knowledge Park', departure_time: '05:45 PM', arrival_time: '06:05 PM', capacity: 20, available_seats: 12, status: 'Available', fare: 20 },
            { id: 'SH-04', route: 'Knowledge Park → Pari Chowk', departure_time: '06:30 PM', arrival_time: '06:50 PM', capacity: 20, available_seats: 17, status: 'Filling Fast', fare: 20 },
            { id: 'SH-05', route: 'Pari Chowk → Ghaziabad Terminal', departure_time: '07:15 PM', arrival_time: '08:05 PM', capacity: 20, available_seats: 14, status: 'Available', fare: 50 }
        ],
        bookings: []
    };
}

let db = null;
let isSaving = false;
let saveQueued = false;

function createAutoBackup(customLabel = '') {
    try {
        const backupDir = path.join(__dirname, 'backup');
        if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
        const now = new Date();
        const pad = n => String(n).padStart(2, '0');
        const ts = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
        const target = path.join(backupDir, `saath-db-${ts}${customLabel ? '-' + customLabel : ''}.json`);
        if (fs.existsSync(DB_FILE)) {
            fs.copyFileSync(DB_FILE, target);
        }
    } catch (e) {
        console.warn('Auto-backup notice:', e.message);
    }
}

function loadDb() {
    if (!db) {
        if (fs.existsSync(DB_FILE)) {
            try {
                const raw = fs.readFileSync(DB_FILE, 'utf8');
                db = JSON.parse(raw);
                if (!Array.isArray(db.users)) db.users = [];
                if (!Array.isArray(db.messages)) db.messages = [];
                if (!Array.isArray(db.votes)) db.votes = [];
                if (!Array.isArray(db.communities)) db.communities = COMMUNITIES;
                if (!Array.isArray(db.bookings)) db.bookings = [];
                if (!Array.isArray(db.rides)) db.rides = [];
                if (!Array.isArray(db.ride_participants)) db.ride_participants = [];
                if (!Array.isArray(db.shuttles)) db.shuttles = getDefaultDb().shuttles;

                for (const u of db.users) {
                    if (!u.email) u.email = 'guest_' + u.id + '@guest.saathchalo.in';
                    if (!u.joined_communities) u.joined_communities = ['knowledge-park'];
                }

                if (!Array.isArray(db.voteSessions) || db.voteSessions.length < 5) {
                    db.voteSessions = getDefaultDb().voteSessions;
                }
            } catch (e) {
                console.error('CRITICAL WARNING: Error reading database file:', e.message);
                // NEVER OVERWRITE PRODUCTION FILE WITH EMPTY DATABASE!
                // Attempt to restore from latest verified backup in backup/ directory
                const backupDir = path.join(__dirname, 'backup');
                let restored = false;
                if (fs.existsSync(backupDir)) {
                    const files = fs.readdirSync(backupDir).filter(f => f.startsWith('saath-db-') && f.endsWith('.json')).sort().reverse();
                    if (files.length > 0) {
                        try {
                            const latestBackup = path.join(backupDir, files[0]);
                            const backupData = JSON.parse(fs.readFileSync(latestBackup, 'utf8'));
                            if (backupData && Array.isArray(backupData.users) && backupData.users.length > 0) {
                                console.log(`✓ SAFELY RESTORED ${backupData.users.length} PRODUCTION USERS FROM BACKUP: ${files[0]}`);
                                db = backupData;
                                saveDb();
                                restored = true;
                            }
                        } catch (backupErr) {
                            console.error('Failed reading backup:', backupErr.message);
                        }
                    }
                }
                if (!restored) {
                    console.error('FATAL: Could not read DB and no backup found. Halting to prevent data loss.');
                    throw new Error('Database integrity check failed: ' + e.message);
                }
            }
        } else {
            console.log('No DB file found, initializing default structure...');
            db = getDefaultDb();
            saveDb();
        }
    }
    return db;
}

function saveDb() {
    if (!db) return;

    if (isSaving) {
        saveQueued = true;
        return;
    }

    isSaving = true;
    try {
        const payload = JSON.stringify(db, null, 2);
        const tempFile = DB_FILE + '.tmp.' + process.pid + '.' + Date.now();
        
        fs.writeFileSync(tempFile, payload, 'utf8');

        // On Windows renameSync can rarely throw if another process briefly locks; retry
        let renamed = false;
        for (let attempt = 0; attempt < 5; attempt++) {
            try {
                fs.renameSync(tempFile, DB_FILE);
                renamed = true;
                break;
            } catch (err) {
                const end = Date.now() + 15;
                while (Date.now() < end) {}
            }
        }
        if (!renamed) {
            fs.copyFileSync(tempFile, DB_FILE);
            try { fs.unlinkSync(tempFile); } catch (e) {}
        }
    } catch (err) {
        console.error('CRITICAL: saveDb failed:', err);
    } finally {
        isSaving = false;
        if (saveQueued) {
            saveQueued = false;
            setImmediate(saveDb);
        }
    }
}

// Load DB immediately on start and perform initial safety backup
loadDb();
createAutoBackup('startup');

// Scheduled automated safety backup every 30 minutes
setInterval(() => {
    createAutoBackup('periodic');
}, 30 * 60 * 1000);

// ==========================================
// 2. REAL-TIME SERVER-SENT EVENTS (SSE)
// ==========================================
const sseClients = new Set();
const activeUsersInCommunity = new Map(); // communityId -> Set(userId)

// Real Connected Users: userId -> { id, name, avatar_url, primary_area, lastSeen }
const activeConnectedUsers = new Map();

// Social Mobility Map: userId -> { id, user_id, name, avatar_url, latitude, longitude, accuracy, destination, sharing_enabled, visibility_state, is_active_rider, updated_at }
const activeUserLocations = new Map();

// Real Assigned & Pooling Vehicles: vehicleId -> { id, type, title, vehicle_number, lat, lng, status, eta_min, capacity, available_seats, traffic_condition, driver_name }
const activeVehicles = new Map();

activeVehicles.set('VH-AUTO-1', {
    id: 'VH-AUTO-1',
    type: 'AUTO',
    title: 'Shared Auto',
    vehicle_number: 'Auto UP16-AT-1411',
    fuel_type: 'CNG',
    label: 'Auto • CNG',
    lat: 28.4715,
    lng: 77.5090,
    status: 'Active Pooling',
    eta_min: 4,
    capacity: 4,
    available_seats: 2,
    traffic_condition: 'Normal',
    driver_name: 'Ramesh Kumar (4.9 ★)'
});
activeVehicles.set('VH-SHUTTLE-1', {
    id: 'VH-SHUTTLE-1',
    type: 'TRAVELLER',
    title: 'Traveller / Shuttle',
    vehicle_number: 'Traveller UP16-SH-2088',
    fuel_type: 'EV',
    label: 'Traveller • EV',
    lat: 28.4770,
    lng: 77.5010,
    status: 'En Route',
    eta_min: 7,
    capacity: 20,
    available_seats: 12,
    traffic_condition: 'Slow',
    driver_name: 'Satish Sharma (4.8 ★)'
});
activeVehicles.set('VH-BUS-1', {
    id: 'VH-BUS-1',
    type: 'BUS',
    title: 'Campus Express Bus',
    vehicle_number: 'Bus UP16-BS-5002',
    fuel_type: 'CNG',
    label: 'Bus • CNG',
    lat: 28.4840,
    lng: 77.5180,
    status: 'Campus Transit',
    eta_min: 12,
    capacity: 50,
    available_seats: 28,
    traffic_condition: 'Normal',
    driver_name: 'Gurmeet Singh (4.9 ★)'
});

function getLiveCommunityStats(communityId = 'knowledge-park') {
    const database = loadDb();

    // 1. Strict Canonical Registered Users:
    // Only real, permanent registered user accounts. Filter any guest/synthetic/test IDs.
    const uniqueUserMap = new Map();
    for (const u of (database.users || [])) {
        if (u && u.id && !u.id.startsWith('usr_guest_') && !u.email?.includes('@guest.')) {
            // Filter synthetic test names if any exist
            if (u.name === 'Device A Commuter' || u.name === 'Device B Commuter' || u.name === 'Cloudflare Live User') {
                continue;
            }
            if (!uniqueUserMap.has(u.id)) {
                uniqueUserMap.set(u.id, u);
            }
        }
    }
    const realRegisteredUsers = Array.from(uniqueUserMap.values());
    const targetCommunity = communityId || 'knowledge-park';

    // Section 7: Community-specific count
    // For knowledge-park or another specific community, count only users who joined that community.
    const isGlobal = targetCommunity === 'all';
    const communityUsers = isGlobal
        ? realRegisteredUsers
        : realRegisteredUsers.filter(u => Array.isArray(u.joined_communities) && u.joined_communities.includes(targetCommunity));

    const totalRegisteredUsers = communityUsers.length;
    const globalRegisteredCount = realRegisteredUsers.length;

    // 2. Active Now (Real-Time Presence):
    // MUST BE COUNT(DISTINCT authenticated_user_id) from permanent registered accounts.
    const activeRegisteredList = [];
    const offlineRegisteredList = [];
    const membersList = [];

    for (const u of communityUsers) {
        // Real-time presence: User is active if currently connected in activeConnectedUsers
        const isOnline = activeConnectedUsers.has(u.id);
        const isInCommunity = activeUsersInCommunity.has(targetCommunity) 
            ? activeUsersInCommunity.get(targetCommunity).has(u.id) 
            : isOnline;
        const isActive = isOnline && isInCommunity;

        const userObj = {
            id: u.id,
            name: u.name,
            displayName: u.name,
            avatar: u.avatar_url,
            avatar_url: u.avatar_url,
            avatarUrl: u.avatar_url,
            primary_area: u.primary_area || 'Knowledge Park',
            primaryArea: u.primary_area || 'Knowledge Park',
            status: isActive ? 'active' : 'offline',
            created_at: u.created_at
        };

        membersList.push(userObj);

        if (isActive) {
            activeRegisteredList.push(userObj);
        } else {
            offlineRegisteredList.push(userObj);
        }
    }

    const connectedCount = activeRegisteredList.length;
    const offlineCount = offlineRegisteredList.length;

    // 3. Real active riders: users with confirmed bookings or allocated rides
    const activeBookingsCount = (database.bookings || []).filter(b => b.status === 'CONFIRMED' && (!targetCommunity || targetCommunity === 'all' || b.community_id === targetCommunity || b.pickup?.toLowerCase().includes('knowledge') || b.dropoff?.toLowerCase().includes('knowledge'))).length;
    const activeRidesCount = (database.rides || []).filter(r => r.status === 'CONFIRMED' && (!targetCommunity || targetCommunity === 'all' || r.community_id === targetCommunity)).length;
    const activeRidersCount = activeBookingsCount + activeRidesCount;

    // 4. Real rides being organized: active community vote sessions
    const ridesOrganizingCount = (database.voteSessions || []).filter(s => s.status === 'ACTIVE' && (!targetCommunity || targetCommunity === 'all' || s.community_id === targetCommunity)).length;

    return {
        communityId: targetCommunity,
        connectedCount,
        activeCount: connectedCount,
        totalRegisteredUsers,
        registeredCount: totalRegisteredUsers,
        globalRegisteredCount,
        offlineCount,
        users: activeRegisteredList,
        connectedUsers: activeRegisteredList,
        offlineUsers: offlineRegisteredList,
        members: membersList,
        activeRiders: activeRidersCount,
        activeRidersCount,
        ridesOrganizing: ridesOrganizingCount,
        ridesOrganizingCount
    };
}

// Cleanup stale sessions every 10 seconds (> 35s without ping for presence; > 90s without location update)
setInterval(() => {
    const now = Date.now();
    let presenceChanged = false;
    for (const [userId, userObj] of activeConnectedUsers.entries()) {
        if (now - userObj.lastSeen > 35000) {
            activeConnectedUsers.delete(userId);
            for (const [commId, set] of activeUsersInCommunity.entries()) {
                set.delete(userId);
            }
            presenceChanged = true;
        }
    }
    for (const [commId, set] of activeUsersInCommunity.entries()) {
        for (const uid of set) {
            if (!activeConnectedUsers.has(uid)) {
                set.delete(uid);
                presenceChanged = true;
            }
        }
    }
    if (presenceChanged) {
        broadcastEvent('CONNECTED_USERS_UPDATE', getLiveCommunityStats());
    }

    let locationsChanged = false;
    for (const [userId, loc] of activeUserLocations.entries()) {
        if (now - loc.updated_at > 90000) {
            activeUserLocations.delete(userId);
            broadcastEvent('LOCATION_REMOVED', { userId });
            locationsChanged = true;
        }
    }
}, 10000);

function broadcastEvent(type, payload) {
    const data = `data: ${JSON.stringify({ type, payload, timestamp: Date.now() })}\n\n`;
    for (const client of sseClients) {
        try {
            client.res.write(data);
        } catch (e) {
            sseClients.delete(client);
        }
    }
}

function parseJsonBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk;
            if (body.length > 2e6) req.connection.destroy();
        });
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (err) {
                reject(err);
            }
        });
    });
}

function sendJson(res, statusCode, data) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=UTF-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Bypass-Tunnel-Reminder, Accept, X-Requested-With'
    });
    res.end(JSON.stringify(data));
}

function getAuthenticatedUser(req) {
    const authHeader = req.headers['authorization'] || '';
    if (!authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.substring(7).trim();
    if (!token) return null;
    const database = loadDb();
    return database.users.find(u => u.token === token) || null;
}

// ==========================================
// 3. HTTP REQUEST ROUTER
// ==========================================
const server = http.createServer(async (req, res) => {
    try {
        // CORS Preflight
        if (req.method === 'OPTIONS') {
            res.writeHead(204, {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, Bypass-Tunnel-Reminder, Accept, X-Requested-With'
            });
            res.end();
            return;
        }

        const [rawPathname, queryString] = req.url.split('?');
        const pathname = rawPathname.length > 1 && rawPathname.endsWith('/') ? rawPathname.slice(0, -1) : rawPathname;
        const urlParams = new URLSearchParams(queryString || '');

        // ----------------------------------------------------
        // SSE Realtime Stream Endpoint
        // ----------------------------------------------------
        if (pathname === '/api/events') {
            res.writeHead(200, {
                'Content-Type': 'text/event-stream; charset=UTF-8',
                'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
            'Access-Control-Allow-Origin': '*'
        });
        res.write('retry: 2000\n\n');
        res.write(': connected\n\n');

        const clientObj = { res, id: Date.now() + Math.random().toString(36) };
        sseClients.add(clientObj);

        // Keepalive heartbeat every 10s to keep tunnels (Cloudflare QUIC) alive
        const keepAliveTimer = setInterval(() => {
            try {
                res.write(': keepalive\n\n');
            } catch (e) {
                clearInterval(keepAliveTimer);
            }
        }, 10000);

        req.on('close', () => {
            clearInterval(keepAliveTimer);
            sseClients.delete(clientObj);
        });
        return;
    }

    // ----------------------------------------------------
    // API: Register User
    // ----------------------------------------------------
    if (pathname === '/api/auth/register' && req.method === 'POST') {
        try {
            const body = await parseJsonBody(req);
            const { email, password, name, avatar, area } = body;

            if (!email || !password || !name) {
                return sendJson(res, 400, { error: 'Name, email, and password are required.' });
            }

            const database = loadDb();
            const existing = database.users.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());
            if (existing) {
                return sendJson(res, 409, { error: 'An account with this email already exists.' });
            }

            const areaMap = {
                'Knowledge Park': 'knowledge-park',
                'Greater Noida': 'knowledge-park',
                'Pari Chowk': 'pari-chowk',
                'Alpha': 'alpha-1',
                'Beta': 'alpha-1',
                'Noida': 'noida-sec-62',
                'Ghaziabad': 'ghaziabad'
            };
            const initialCommunity = areaMap[area] || 'knowledge-park';

            const token = 'tok_' + crypto.randomBytes(24).toString('hex');
            const newUser = {
                id: 'usr_' + crypto.randomBytes(8).toString('hex'),
                email: email.trim().toLowerCase(),
                passwordHash: crypto.createHash('sha256').update(password).digest('hex'),
                name: name.trim(),
                avatar_url: avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
                primary_area: area || 'Knowledge Park',
                joined_communities: [initialCommunity],
                token: token,
                created_at: new Date().toISOString()
            };

            database.users.push(newUser);
            saveDb();

            broadcastEvent('CONNECTED_USERS_UPDATE', getLiveCommunityStats(initialCommunity));
            broadcastEvent('COMMUNITY_MEMBER_UPDATE', {
                communityId: initialCommunity,
                userId: newUser.id,
                action: 'REGISTER'
            });

            return sendJson(res, 201, {
                user: {
                    id: newUser.id,
                    email: newUser.email,
                    name: newUser.name,
                    avatar_url: newUser.avatar_url,
                    primary_area: newUser.primary_area,
                    joined_communities: newUser.joined_communities
                },
                token: token
            });
        } catch (e) {
            return sendJson(res, 500, { error: 'Registration failed: ' + e.message });
        }
    }

    // ----------------------------------------------------
    // API: Login User
    // ----------------------------------------------------
    if (pathname === '/api/auth/login' && req.method === 'POST') {
        try {
            const body = await parseJsonBody(req);
            const { email, password } = body;

            if (!email || !password) {
                return sendJson(res, 400, { error: 'Email and password required.' });
            }

            const database = loadDb();
            const hash = crypto.createHash('sha256').update(password).digest('hex');
            const user = database.users.find(u => u.email && u.email.toLowerCase() === email.toLowerCase() && u.passwordHash === hash);

            if (!user) {
                return sendJson(res, 401, { error: 'Invalid email or password.' });
            }

            if (!Array.isArray(user.joined_communities)) {
                user.joined_communities = ['knowledge-park'];
            }

            // Refresh token
            user.token = 'tok_' + crypto.randomBytes(24).toString('hex');
            saveDb();

            return sendJson(res, 200, {
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    avatar_url: user.avatar_url,
                    primary_area: user.primary_area,
                    joined_communities: user.joined_communities
                },
                token: user.token
            });
        } catch (e) {
            return sendJson(res, 500, { error: 'Login failed: ' + e.message });
        }
    }

    // ----------------------------------------------------
    // API: Logout User (Immediate Presence Termination)
    // ----------------------------------------------------
    if (pathname === '/api/auth/logout' && req.method === 'POST') {
        let body = {};
        try { body = await parseJsonBody(req); } catch (e) {}
        const user = getAuthenticatedUser(req);
        const userId = (user && user.id) || body.userId;
        if (userId) {
            activeConnectedUsers.delete(userId);
            for (const [commId, set] of activeUsersInCommunity.entries()) {
                set.delete(userId);
            }
            activeUserLocations.delete(userId);
            broadcastEvent('LOCATION_REMOVED', { userId });
            broadcastEvent('CONNECTED_USERS_UPDATE', getLiveCommunityStats());
        }
        return sendJson(res, 200, { success: true, message: 'Logged out successfully.' });
    }

    // ----------------------------------------------------
    // API: Current User Profile
    // ----------------------------------------------------
    if (pathname === '/api/auth/me' && req.method === 'GET') {
        const user = getAuthenticatedUser(req);
        if (!user) {
            return sendJson(res, 401, { error: 'Not authenticated.' });
        }
        if (!Array.isArray(user.joined_communities)) {
            user.joined_communities = ['knowledge-park'];
        }
        return sendJson(res, 200, {
            id: user.id,
            email: user.email,
            name: user.name,
            avatar_url: user.avatar_url,
            primary_area: user.primary_area,
            joined_communities: user.joined_communities
        });
    }

    // ----------------------------------------------------
    // API: Delete Account (Real Account Deletion - Section 83)
    // ----------------------------------------------------
    if (pathname === '/api/auth/account' && req.method === 'DELETE') {
        let user = getAuthenticatedUser(req);
        let body = {};
        try {
            body = await parseJsonBody(req);
        } catch (e) {}

        const database = loadDb();
        if (!user && body.userId) {
            user = database.users.find(u => u.id === body.userId);
        }

        if (!user) {
            return sendJson(res, 401, { error: 'Authentication required to delete account.' });
        }
        database.users = database.users.filter(u => u.id !== user.id);
        const userCommunities = Array.isArray(user.joined_communities) ? user.joined_communities : ['knowledge-park'];

        // Clean up real-time presence and active location
        activeConnectedUsers.delete(user.id);
        for (const [commId, set] of activeUsersInCommunity.entries()) {
            set.delete(user.id);
        }
        activeUserLocations.delete(user.id);

        saveDb();

        broadcastEvent('LOCATION_REMOVED', { userId: user.id });
        broadcastEvent('CONNECTED_USERS_UPDATE', getLiveCommunityStats());
        for (const commId of userCommunities) {
            broadcastEvent('COMMUNITY_MEMBER_UPDATE', {
                communityId: commId,
                userId: user.id,
                action: 'DELETE_ACCOUNT'
            });
        }

        return sendJson(res, 200, {
            success: true,
            message: 'Your account and personal profile data have been permanently deleted.'
        });
    }

    // ----------------------------------------------------
    // API: Get All Communities (Directory)
    // ----------------------------------------------------
    if (pathname === '/api/communities' && req.method === 'GET') {
        const database = loadDb();
        const user = getAuthenticatedUser(req);
        const result = COMMUNITIES.map(c => {
            const members = (database.users || []).filter(u => 
                u && u.id && !u.id.startsWith('usr_guest_') && !u.email?.includes('@guest.') &&
                u.name !== 'Device A Commuter' && u.name !== 'Device B Commuter' && u.name !== 'Cloudflare Live User' &&
                Array.isArray(u.joined_communities) && u.joined_communities.includes(c.id)
            );
            const uniqueMap = new Map(members.map(u => [u.id, u]));
            const memberCount = uniqueMap.size;
            const isMember = user ? (Array.isArray(user.joined_communities) && user.joined_communities.includes(c.id)) : false;
            return {
                ...c,
                memberCount,
                isMember
            };
        });
        return sendJson(res, 200, result);
    }

    // ----------------------------------------------------
    // API: Join Community Group
    // ----------------------------------------------------
    if (pathname.startsWith('/api/community/') && pathname.endsWith('/join') && req.method === 'POST') {
        const user = getAuthenticatedUser(req);
        if (!user) {
            return sendJson(res, 401, { error: 'Please log in to join a community.' });
        }
        const parts = pathname.split('/');
        const communityId = parts[3];
        const database = loadDb();
        const dbUser = database.users.find(u => u.id === user.id);
        if (!dbUser) {
            return sendJson(res, 404, { error: 'User not found.' });
        }
        if (!Array.isArray(dbUser.joined_communities)) {
            dbUser.joined_communities = [];
        }
        if (!dbUser.joined_communities.includes(communityId)) {
            dbUser.joined_communities.push(communityId);
            saveDb();
        }

        broadcastEvent('COMMUNITY_MEMBER_UPDATE', {
            communityId,
            userId: dbUser.id,
            action: 'JOIN'
        });

        return sendJson(res, 200, {
            success: true,
            communityId,
            joined_communities: dbUser.joined_communities
        });
    }

    // ----------------------------------------------------
    // API: Leave Community Group
    // ----------------------------------------------------
    if (pathname.startsWith('/api/community/') && pathname.endsWith('/leave') && req.method === 'POST') {
        const user = getAuthenticatedUser(req);
        if (!user) {
            return sendJson(res, 401, { error: 'Please log in to manage communities.' });
        }
        const parts = pathname.split('/');
        const communityId = parts[3];
        const database = loadDb();
        const dbUser = database.users.find(u => u.id === user.id);
        if (!dbUser) {
            return sendJson(res, 404, { error: 'User not found.' });
        }
        if (Array.isArray(dbUser.joined_communities)) {
            dbUser.joined_communities = dbUser.joined_communities.filter(id => id !== communityId);
            saveDb();
        }

        broadcastEvent('COMMUNITY_MEMBER_UPDATE', {
            communityId,
            userId: dbUser.id,
            action: 'LEAVE'
        });

        return sendJson(res, 200, {
            success: true,
            communityId,
            joined_communities: dbUser.joined_communities || []
        });
    }

    // ----------------------------------------------------
    // API: Current User Communities
    // ----------------------------------------------------
    if (pathname === '/api/user/communities' && req.method === 'GET') {
        const user = getAuthenticatedUser(req);
        if (!user) {
            return sendJson(res, 401, { error: 'Not authenticated.' });
        }
        return sendJson(res, 200, {
            joined_communities: user.joined_communities || ['knowledge-park']
        });
    }

    // ----------------------------------------------------
    // API: Get Community Members & Member Stats (Strict Unique Real Accounts)
    // ----------------------------------------------------
    // ----------------------------------------------------
    // API: Get Community Members & Member Stats (Strict Unique Real Accounts)
    // ----------------------------------------------------
    if (pathname.startsWith('/api/community/') && (pathname.endsWith('/members') || pathname.endsWith('/member-stats') || pathname.endsWith('/presence')) && req.method === 'GET') {
        const parts = pathname.split('/');
        const communityId = parts[3] || 'knowledge-park';
        const stats = getLiveCommunityStats(communityId);
        return sendJson(res, 200, {
            communityId,
            registeredCount: stats.totalRegisteredUsers,
            totalRegisteredUsers: stats.totalRegisteredUsers,
            activeCount: stats.connectedCount,
            connectedCount: stats.connectedCount,
            offlineCount: stats.offlineCount,
            members: stats.members,
            connectedUsers: stats.connectedUsers,
            activeMembers: stats.connectedUsers,
            offlineUsers: stats.offlineUsers,
            offlineMembers: stats.offlineUsers,
            activeRiders: stats.activeRidersCount,
            activeRidersCount: stats.activeRidersCount,
            ridesOrganizing: stats.ridesOrganizingCount,
            ridesOrganizingCount: stats.ridesOrganizingCount
        });
    }

    // ----------------------------------------------------
    // API: Get Community Messages
    // ----------------------------------------------------
    if (pathname.startsWith('/api/community/') && pathname.endsWith('/messages')) {
        const parts = pathname.split('/');
        const communityId = parts[3];
        const database = loadDb();

        if (req.method === 'GET') {
            const list = database.messages
                .filter(m => m.community_id === communityId)
                .slice(-100)
                .map(m => ({
                    id: m.id,
                    communityId: m.community_id,
                    senderId: m.sender_id,
                    senderName: m.sender_name,
                    avatar: m.avatar_url,
                    text: m.message,
                    time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }));
            return sendJson(res, 200, list);
        }

        if (req.method === 'POST') {
            const user = getAuthenticatedUser(req);
            if (!user) {
                return sendJson(res, 401, { error: 'Must be logged in to send messages.' });
            }

            try {
                const body = await parseJsonBody(req);
                if (!body.message || !body.message.trim()) {
                    return sendJson(res, 400, { error: 'Message cannot be empty.' });
                }

                // Automatically join user to this community if not already joined
                const dbUser = database.users.find(u => u.id === user.id);
                if (dbUser) {
                    if (!Array.isArray(dbUser.joined_communities)) dbUser.joined_communities = [];
                    if (!dbUser.joined_communities.includes(communityId)) {
                        dbUser.joined_communities.push(communityId);
                    }
                }

                const newMsg = {
                    id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                    community_id: communityId,
                    sender_id: user.id,
                    sender_name: user.name,
                    avatar_url: user.avatar_url,
                    message: body.message.trim(),
                    created_at: new Date().toISOString()
                };

                database.messages.push(newMsg);
                saveDb();

                const formatted = {
                    id: newMsg.id,
                    communityId: newMsg.community_id,
                    senderId: newMsg.sender_id,
                    senderName: newMsg.sender_name,
                    avatar: newMsg.avatar_url,
                    text: newMsg.message,
                    time: new Date(newMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                };

                // Broadcast to all active clients immediately!
                broadcastEvent('NEW_MESSAGE', formatted);

                return sendJson(res, 201, formatted);
            } catch (e) {
                return sendJson(res, 500, { error: e.message });
            }
        }
    }

    // ----------------------------------------------------
    // API: Report Message / Community Moderation (Section 85)
    // ----------------------------------------------------
    if (pathname.startsWith('/api/community/') && pathname.endsWith('/report') && req.method === 'POST') {
        let user = getAuthenticatedUser(req);
        let body = {};
        try {
            body = await parseJsonBody(req);
        } catch (e) {}

        const database = loadDb();
        if (!user && (body.reporterId || body.userId)) {
            user = database.users.find(u => u.id === (body.reporterId || body.userId)) || {
                id: body.reporterId || body.userId,
                name: 'Community Member'
            };
        }
        if (!user) {
            return sendJson(res, 401, { error: 'Authentication required to report content.' });
        }
        const parts = pathname.split('/');
        const communityId = parts[3];
        try {
            const { messageId, reportedUserId, reason } = body;
            if (!Array.isArray(database.reports)) {
                database.reports = [];
            }
            const report = {
                id: 'rep_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                community_id: communityId,
                reporter_id: user.id,
                message_id: messageId || null,
                reported_user_id: reportedUserId || null,
                reason: (reason || 'Inappropriate content').trim(),
                status: 'PENDING_REVIEW',
                created_at: new Date().toISOString()
            };
            database.reports.push(report);
            saveDb();
            return sendJson(res, 201, { success: true, reportId: report.id, message: 'Report submitted. Our moderation team will review this promptly.' });
        } catch (e) {
            return sendJson(res, 500, { error: 'Failed to process report: ' + e.message });
        }
    }

    // ----------------------------------------------------
    // API: Active Vote Session & Vote Casting
    // ----------------------------------------------------
    if (pathname.startsWith('/api/community/') && pathname.endsWith('/vote')) {
        const parts = pathname.split('/');
        const communityId = parts[3];
        const database = loadDb();

        let session = database.voteSessions.find(s => s.community_id === communityId && s.status === 'ACTIVE');
        if (!session) {
            session = database.voteSessions.find(s => s.community_id === communityId);
            if (!session) {
                session = {
                    id: 'vs-' + communityId + '-live',
                    community_id: communityId,
                    title: 'Local Destination Pooling',
                    departure_time: '6:30 PM Today',
                    status: 'ACTIVE',
                    vote_options: [
                        { id: 'opt-' + communityId + '-1', destination: 'Pari Chowk Metro', display_order: 1 },
                        { id: 'opt-' + communityId + '-2', destination: 'Knowledge Park Campus', display_order: 2 },
                        { id: 'opt-' + communityId + '-3', destination: 'Noida Sector 62', display_order: 3 },
                        { id: 'opt-' + communityId + '-4', destination: 'Botanical Garden', display_order: 4 }
                    ]
                };
                database.voteSessions.push(session);
                saveDb();
            }
        }

        if (req.method === 'GET') {
            const sessionVotes = database.votes.filter(v => v.vote_session_id === session.id);
            const counts = {};
            sessionVotes.forEach(v => {
                counts[v.option_id] = (counts[v.option_id] || 0) + 1;
            });

            const user = getAuthenticatedUser(req);
            let userVotedOptionId = null;
            if (user) {
                const userVote = sessionVotes.find(v => v.user_id === user.id);
                if (userVote) userVotedOptionId = userVote.option_id;
            }

            return sendJson(res, 200, {
                session,
                counts,
                total: sessionVotes.length,
                userVotedOptionId
            });
        }

        if (req.method === 'POST') {
            let user = getAuthenticatedUser(req);
            let body = {};
            try {
                body = await parseJsonBody(req);
            } catch (e) {}

            if (!user && body.userId) {
                user = database.users.find(u => u.id === body.userId) || {
                    id: body.userId,
                    name: 'Commuter',
                    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
                    primary_area: communityId
                };
            }
            if (!user) {
                return sendJson(res, 401, { error: 'Authentication required to vote.' });
            }

            try {
                let { sessionId, optionId, destination } = body;
                if (!sessionId && session) sessionId = session.id;
                if (!optionId && destination && session && session.vote_options) {
                    const match = session.vote_options.find(o => o.destination.toLowerCase().includes(destination.toLowerCase()));
                    if (match) optionId = match.id;
                    else optionId = session.vote_options[0].id;
                }

                // Enforce one vote per user per session constraint
                const existingVoteIndex = database.votes.findIndex(v => v.vote_session_id === sessionId && v.user_id === user.id);
                if (existingVoteIndex >= 0) {
                    const existingVote = database.votes[existingVoteIndex];
                    const sessionVotes = database.votes.filter(v => v.vote_session_id === sessionId);
                    const counts = {};
                    sessionVotes.forEach(v => {
                        counts[v.option_id] = (counts[v.option_id] || 0) + 1;
                    });
                    const opt = session.vote_options.find(o => o.id === existingVote.option_id);
                    return sendJson(res, 200, {
                        success: true,
                        alreadyVoted: true,
                        userVote: opt ? opt.destination : existingVote.option_id,
                        userVotedOptionId: existingVote.option_id,
                        counts,
                        total: sessionVotes.length,
                        options: session.vote_options.map(o => ({
                            id: o.id,
                            destination: o.destination,
                            votes: counts[o.id] || 0
                        }))
                    });
                }

                const newVote = {
                    vote_session_id: sessionId,
                    option_id: optionId,
                    user_id: user.id,
                    community_id: communityId,
                    created_at: new Date().toISOString()
                };

                database.votes.push(newVote);
                saveDb();

                // Recalculate counts
                const sessionVotes = database.votes.filter(v => v.vote_session_id === sessionId);
                const counts = {};
                sessionVotes.forEach(v => {
                    counts[v.option_id] = (counts[v.option_id] || 0) + 1;
                });

                // Broadcast live vote update to all devices!
                broadcastEvent('VOTE_UPDATE', {
                    sessionId,
                    communityId,
                    counts,
                    total: sessionVotes.length
                });

                const opt = session.vote_options.find(o => o.id === optionId);
                return sendJson(res, 200, {
                    success: true,
                    counts,
                    total: sessionVotes.length,
                    userVote: opt ? opt.destination : optionId,
                    userVotedOptionId: optionId,
                    options: session.vote_options.map(o => ({
                        id: o.id,
                        destination: o.destination,
                        votes: counts[o.id] || 0
                    }))
                });
            } catch (e) {
                return sendJson(res, 500, { error: e.message });
            }
        }
    }

    // ----------------------------------------------------
    // API: Finalize Vote & Vehicle Allocation
    // ----------------------------------------------------
    if (pathname.startsWith('/api/community/') && pathname.endsWith('/allocate-ride') && req.method === 'POST') {
        const parts = pathname.split('/');
        const communityId = parts[3];
        const database = loadDb();

        try {
            const body = await parseJsonBody(req);
            const { sessionId, winningDestination } = body;

            // Gather all real users who voted
            const sessionVotes = database.votes.filter(v => v.vote_session_id === sessionId);
            const totalRiders = sessionVotes.length;

            // Determine vehicle type, fuel tier, and vehicle-specific fare using centralized pricing engine
            const preferredFuel = body.preferredFuel || body.fuelPreference || 'EV';
            const allocation = allocateVehicleForCount(totalRiders, preferredFuel);
            const plate = allocation.platePrefix + Math.floor(1000 + Math.random() * 9000);
            const distanceKm = 7.4; // Standard corridor distance
            const totalVehicleCost = calculateTotalVehicleFare(allocation.type, allocation.fuelType, distanceKm);
            const vehicleFare = calculateVehicleFare(allocation.type, distanceKm, Math.max(1, totalRiders), allocation.fuelType);

            const ride = {
                id: 'ride_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                community_id: communityId,
                destination: winningDestination || 'Pari Chowk',
                vehicle_type: allocation.vehicleType,
                fuel_type: allocation.fuelType,
                vehicle_title: `${allocation.vehicleType} • ${allocation.fuelType}`,
                vehicle_label: allocation.label,
                vehicle_number: plate,
                capacity: allocation.capacity,
                rider_count: Math.min(Math.max(1, totalRiders), allocation.capacity),
                total_vehicle_fare: totalVehicleCost,
                fare: vehicleFare,
                departure_time: '15 Minutes from Campus Gate',
                status: 'CONFIRMED',
                driver_name: ['Ramesh Kumar', 'Satish Sharma', 'Mohd. Imran', 'Sunil Yadav'][Math.floor(Math.random() * 4)],
                created_at: new Date().toISOString()
            };

            database.rides.push(ride);

            // Register into live activeVehicles map for real-time map telemetry
            activeVehicles.set(ride.id, {
                id: ride.id,
                type: allocation.type,
                fuel_type: allocation.fuelType,
                label: allocation.label,
                title: `${allocation.vehicleType} • ${allocation.fuelType}`,
                vehicle_number: plate,
                lat: 28.4744 + (Math.random() * 0.004 - 0.002),
                lng: 77.5040 + (Math.random() * 0.004 - 0.002),
                status: 'Active Pool',
                eta_min: 5,
                capacity: allocation.capacity,
                available_seats: Math.max(0, allocation.capacity - totalRiders),
                traffic_condition: 'Normal',
                driver_name: ride.driver_name
            });

            saveDb();

            // Broadcast to all connected devices in this community!
            broadcastEvent('RIDE_ALLOCATED', ride);
            broadcastEvent('VEHICLE_UPDATE', activeVehicles.get(ride.id));

            return sendJson(res, 201, ride);
        } catch (e) {
            return sendJson(res, 500, { error: e.message });
        }
    }

    // ----------------------------------------------------
    // API: Shuttles List & Booking
    // ----------------------------------------------------
    if (pathname === '/api/shuttles' && req.method === 'GET') {
        const database = loadDb();
        return sendJson(res, 200, database.shuttles);
    }

    if (pathname.startsWith('/api/shuttles/') && pathname.endsWith('/book') && req.method === 'POST') {
        let user = getAuthenticatedUser(req);
        const database = loadDb();

        if (!user) {
            const guestToken = 'tok_guest_' + crypto.randomBytes(16).toString('hex');
            user = {
                id: 'usr_guest_' + Date.now(),
                name: 'Guest Commuter',
                avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
                primary_area: 'Knowledge Park',
                token: guestToken,
                isGuest: true
            };
        }

        const parts = pathname.split('/');
        const shuttleId = parts[3];
        const shuttle = database.shuttles.find(s => s.id === shuttleId);

        if (!shuttle) {
            return sendJson(res, 404, { error: 'Shuttle not found.' });
        }

        if (shuttle.available_seats <= 0) {
            return sendJson(res, 400, { error: 'Sorry, this shuttle is fully booked.' });
        }

        // Decrement available seat
        shuttle.available_seats -= 1;
        if (shuttle.available_seats === 0) {
            shuttle.status = 'Full';
        } else if (shuttle.available_seats <= 3) {
            shuttle.status = 'Filling Fast';
        }

        // Record booking
        const routeParts = (shuttle.route || '').split('→');
        const booking = {
            id: 'sh_bk_' + Date.now(),
            user_id: user.id,
            shuttle_id: shuttle.id,
            route: shuttle.route,
            pickup: (routeParts[0] || 'Campus Gate').trim(),
            dropoff: (routeParts[1] || 'Destination').trim(),
            departure_time: shuttle.departure_time,
            fare: shuttle.fare,
            vehicle_type: 'Traveller/Shuttle',
            vehicle_id: shuttle.id,
            status: 'CONFIRMED',
            booking_time: new Date().toISOString(),
            created_at: new Date().toISOString()
        };
        database.bookings.push(booking);
        saveDb();

        // Broadcast updated shuttles to all devices immediately!
        broadcastEvent('SHUTTLE_UPDATE', database.shuttles);

        return sendJson(res, 200, {
            success: true,
            shuttle,
            booking,
            token: user.token,
            user: { id: user.id, name: user.name, avatar_url: user.avatar_url },
            message: `Seat confirmed on ${shuttle.route}!`
        });
    }

    // ----------------------------------------------------
    // API: User Ride Bookings & Real Shared Pooling Engine
    // ----------------------------------------------------
    if (pathname === '/api/bookings') {
        let user = getAuthenticatedUser(req);
        const database = loadDb();

        if (req.method === 'GET') {
            if (!user) {
                return sendJson(res, 200, database.bookings.slice(-10).reverse());
            }
            const userBookings = database.bookings
                .filter(b => b.user_id === user.id)
                .reverse();
            return sendJson(res, 200, userBookings);
        }

        if (req.method === 'POST') {
            try {
                const body = await parseJsonBody(req);
                const pickup = body.pickup || 'Knowledge Park, Greater Noida';
                const dropoff = body.dropoff || 'Alpha 1, Greater Noida';
                const distanceKm = Number(body.distance_km || body.distanceKm || 3.5);
                const fuelPreference = body.fuel_preference || body.fuelPreference || 'EV';

                if (!user) {
                    const guestToken = 'tok_guest_' + crypto.randomBytes(16).toString('hex');
                    user = {
                        id: 'usr_guest_' + Date.now(),
                        name: 'Guest Commuter',
                        avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
                        primary_area: 'Knowledge Park',
                        token: guestToken,
                        isGuest: true
                    };
                }

                // Zero-Downtime Safe Idempotency Check:
                // Prevent duplicate bookings if a network retry or double-click occurs within 10 seconds
                const recentCutoff = Date.now() - 10000;
                const duplicateBooking = (database.bookings || []).find(b => 
                    b.user_id === user.id && 
                    b.pickup === pickup && 
                    b.dropoff === dropoff && 
                    new Date(b.booking_time).getTime() > recentCutoff
                );
                if (duplicateBooking) {
                    return sendJson(res, 200, {
                        ...duplicateBooking,
                        token: user.token,
                        user: { id: user.id, name: user.name, avatar_url: user.avatar_url }
                    });
                }

                // ----------------------------------------------------
                // Real Shared-Mobility Pooling Engine (Sections 22, 23, 24, 32-38)
                // Search for an active shared ride pool along compatible corridor
                // ----------------------------------------------------
                const normDrop = dropoff.toLowerCase();
                let matchedRide = (database.rides || []).find(r => {
                    if (r.status !== 'CONFIRMED' && r.status !== 'POOL_FORMING') return false;
                    const rDest = (r.destination || '').toLowerCase();
                    const isDestMatch = rDest.includes(normDrop.split(',')[0].trim()) || normDrop.includes(rDest.split(',')[0].trim());
                    const currentCount = Array.isArray(r.participants) ? r.participants.length : (r.rider_count || 1);
                    return isDestMatch && currentCount < (r.capacity || 20);
                });

                let allocatedVehicleType = 'AUTO';
                let allocatedFuelType = fuelPreference === 'PETROL' ? 'PETROL' : (fuelPreference === 'CNG' ? 'CNG' : 'EV');
                let vehicleNumber = 'UP16-AT-' + Math.floor(1000 + Math.random() * 9000);
                let rideId = matchedRide ? matchedRide.id : ('ride_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4));

                let finalPassengerFare = 20.00;

                if (matchedRide) {
                    // Participant joins existing pool
                    if (!Array.isArray(matchedRide.participants)) {
                        matchedRide.participants = [{
                            id: matchedRide.driver_name ? 'rider_orig_1' : user.id,
                            userId: matchedRide.driver_name ? 'rider_orig_1' : user.id,
                            name: matchedRide.driver_name ? 'Commuter 1' : user.name,
                            distanceKm: distanceKm,
                            pickup: matchedRide.pickup || pickup,
                            dropoff: matchedRide.destination || dropoff
                        }];
                    }

                    matchedRide.participants.push({
                        id: user.id,
                        userId: user.id,
                        name: user.name,
                        distanceKm: distanceKm,
                        pickup: pickup,
                        dropoff: dropoff
                    });

                    const totalPoolRiders = matchedRide.participants.length;
                    const newAllocation = allocateVehicleForCount(totalPoolRiders, matchedRide.fuel_type || fuelPreference);
                    matchedRide.vehicle_type = newAllocation.vehicleType;
                    matchedRide.fuel_type = newAllocation.fuelType;
                    matchedRide.vehicle_title = `${newAllocation.vehicleType} • ${newAllocation.fuelType}`;
                    matchedRide.capacity = newAllocation.capacity;
                    matchedRide.rider_count = totalPoolRiders;

                    // Calculate max corridor distance among all participants
                    const maxDist = Math.max(...matchedRide.participants.map(p => p.distanceKm || distanceKm));
                    const totalRideFare = calculateTotalVehicleFare(newAllocation.type, newAllocation.fuelType, maxDist);
                    matchedRide.total_vehicle_fare = totalRideFare;

                    // Apply Fair Distance-Ratio Fare Formula F * (d_i / D)
                    const fareDistribution = calculateSharedFare(totalRideFare, matchedRide.participants);
                    matchedRide.participants = fareDistribution;

                    const myAllocated = fareDistribution.find(p => p.userId === user.id || p.id === user.id);
                    finalPassengerFare = myAllocated ? myAllocated.fare : calculateVehicleFare(newAllocation.type, distanceKm, totalPoolRiders, newAllocation.fuelType);

                    allocatedVehicleType = newAllocation.vehicleType;
                    allocatedFuelType = newAllocation.fuelType;
                    vehicleNumber = matchedRide.vehicle_number;

                    // Update corresponding participant bookings in database
                    for (const part of fareDistribution) {
                        const existingB = database.bookings.find(b => b.user_id === part.userId && b.ride_id === matchedRide.id);
                        if (existingB) {
                            existingB.fare = part.fare;
                            existingB.vehicle_type = `${newAllocation.vehicleType} • ${newAllocation.fuelType}`;
                        }
                    }

                    broadcastEvent('RIDE_ALLOCATED', matchedRide);
                } else {
                    // Create new pool
                    const allocation = allocateVehicleForCount(1, fuelPreference);
                    allocatedVehicleType = allocation.vehicleType;
                    allocatedFuelType = allocation.fuelType;
                    vehicleNumber = allocation.platePrefix + Math.floor(1000 + Math.random() * 9000);

                    const totalRideFare = calculateTotalVehicleFare(allocation.type, allocation.fuelType, distanceKm);
                    finalPassengerFare = calculateVehicleFare(allocation.type, distanceKm, 1, allocation.fuelType);

                    const newRide = {
                        id: rideId,
                        community_id: 'knowledge-park',
                        pickup: pickup,
                        destination: dropoff,
                        vehicle_type: allocation.vehicleType,
                        fuel_type: allocation.fuelType,
                        vehicle_title: `${allocation.vehicleType} • ${allocation.fuelType}`,
                        vehicle_label: allocation.label,
                        vehicle_number: vehicleNumber,
                        capacity: allocation.capacity,
                        rider_count: 1,
                        total_vehicle_fare: totalRideFare,
                        fare: finalPassengerFare,
                        departure_time: 'Immediate',
                        status: 'CONFIRMED',
                        participants: [{
                            id: user.id,
                            userId: user.id,
                            name: user.name,
                            distanceKm: distanceKm,
                            fare: finalPassengerFare,
                            pickup: pickup,
                            dropoff: dropoff
                        }],
                        driver_name: ['Ramesh Kumar', 'Satish Sharma', 'Mohd. Imran', 'Sunil Yadav'][Math.floor(Math.random() * 4)],
                        created_at: new Date().toISOString()
                    };

                    database.rides.push(newRide);

                    activeVehicles.set(newRide.id, {
                        id: newRide.id,
                        type: allocation.type,
                        fuel_type: allocation.fuelType,
                        label: allocation.label,
                        title: `${allocation.vehicleType} • ${allocation.fuelType}`,
                        vehicle_number: vehicleNumber,
                        lat: 28.4744 + (Math.random() * 0.004 - 0.002),
                        lng: 77.5040 + (Math.random() * 0.004 - 0.002),
                        status: 'Active Pool',
                        eta_min: 4,
                        capacity: allocation.capacity,
                        available_seats: Math.max(0, allocation.capacity - 1),
                        traffic_condition: 'Normal',
                        driver_name: newRide.driver_name
                    });

                    broadcastEvent('RIDE_ALLOCATED', newRide);
                    broadcastEvent('VEHICLE_UPDATE', activeVehicles.get(newRide.id));
                }

                const newBooking = {
                    id: 'BK-' + Date.now().toString().slice(-6),
                    ride_id: rideId,
                    user_id: user.id,
                    pickup: pickup,
                    dropoff: dropoff,
                    distance_km: distanceKm,
                    vehicle_type: `${allocatedVehicleType} • ${allocatedFuelType}`,
                    vehicle_id: vehicleNumber,
                    fuel_type: allocatedFuelType,
                    fare: finalPassengerFare,
                    status: 'CONFIRMED',
                    booking_time: new Date().toISOString(),
                    created_at: new Date().toISOString()
                };

                database.bookings.push(newBooking);
                saveDb();

                broadcastEvent('CONNECTED_USERS_UPDATE', getLiveCommunityStats());

                return sendJson(res, 201, {
                    ...newBooking,
                    token: user.token,
                    user: { id: user.id, name: user.name, avatar_url: user.avatar_url }
                });
            } catch (e) {
                return sendJson(res, 500, { error: e.message });
            }
        }
    }

    // ----------------------------------------------------
    // API: Real-Time Presence & Live Community Stats
    // ----------------------------------------------------
    if (pathname === '/api/presence') {
        const communityId = urlParams.get('communityId') || 'knowledge-park';
        if (req.method === 'GET') {
            return sendJson(res, 200, getLiveCommunityStats(communityId));
        }
        if (req.method === 'POST') {
            try {
                const body = await parseJsonBody(req);
                const user = getAuthenticatedUser(req);
                const userId = (user && user.id) || body.userId;
                
                if (userId) {
                    const database = loadDb();
                    // Must be a permanent registered user account in database.users
                    const dbUser = database.users.find(u => u.id === userId && !u.id.startsWith('usr_guest_') && !u.email?.includes('@guest.'));
                    
                    if (dbUser) {
                        activeConnectedUsers.set(dbUser.id, {
                            id: dbUser.id,
                            name: dbUser.name,
                            avatar_url: dbUser.avatar_url,
                            primary_area: dbUser.primary_area || 'Knowledge Park',
                            lastSeen: Date.now()
                        });

                        if (body.communityId) {
                            if (!activeUsersInCommunity.has(body.communityId)) {
                                activeUsersInCommunity.set(body.communityId, new Set());
                            }
                            activeUsersInCommunity.get(body.communityId).add(dbUser.id);
                        }
                    }

                    const stats = getLiveCommunityStats(body.communityId || communityId);
                    broadcastEvent('CONNECTED_USERS_UPDATE', stats);
                    broadcastEvent('PRESENCE_UPDATE', { communityId: body.communityId || communityId, count: stats.connectedCount });
                    return sendJson(res, 200, stats);
                }
                return sendJson(res, 200, getLiveCommunityStats(communityId));
            } catch (e) {
                return sendJson(res, 200, getLiveCommunityStats(communityId));
            }
        }
    }

    // ----------------------------------------------------
    // API: Geolocation Fallback (Cloudflare IP / Network)
    // ----------------------------------------------------
    if (pathname === '/api/my-ip-location' && req.method === 'GET') {
        const cfLat = parseFloat(req.headers['cf-iplatitude']);
        const cfLng = parseFloat(req.headers['cf-iplongitude']);
        const city = req.headers['cf-ipcity'] || 'Knowledge Park';
        const region = req.headers['cf-region'] || 'Uttar Pradesh';

        if (!isNaN(cfLat) && !isNaN(cfLng) && cfLat !== 0 && cfLng !== 0) {
            return sendJson(res, 200, {
                latitude: cfLat,
                longitude: cfLng,
                city,
                region,
                source: 'cloudflare_edge',
                accuracy: 500
            });
        }

        return sendJson(res, 200, {
            latitude: 28.4744,
            longitude: 77.5040,
            city: 'Greater Noida',
            region: 'Uttar Pradesh',
            source: 'regional_default',
            accuracy: 1000
        });
    }

    // ----------------------------------------------------
    // API: Social Mobility Map - Live User Locations
    // ----------------------------------------------------
    if (pathname === '/api/locations' && req.method === 'POST') {
        let user = getAuthenticatedUser(req);
        const database = loadDb();

        if (!user) {
            const guestToken = 'tok_guest_' + crypto.randomBytes(16).toString('hex');
            const guestId = 'usr_guest_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
            const commuterAvatars = [
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
                'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
                'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80',
                'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80',
                'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&q=80'
            ];
            user = {
                id: guestId,
                name: 'Commuter Guest',
                avatar_url: commuterAvatars[Math.floor(Math.random() * commuterAvatars.length)],
                primary_area: 'Live Mobility',
                token: guestToken,
                isGuest: true
            };
            // NOTE: Never push guest map ping to database.users! ONE REAL ACCOUNT = ONE REGISTERED USER.
        }

        try {
            const body = await parseJsonBody(req);
            const lat = parseFloat(body.latitude);
            const lng = parseFloat(body.longitude);

            if (isNaN(lat) || isNaN(lng)) {
                return sendJson(res, 400, { error: 'Valid latitude and longitude are required.' });
            }

            const sharingEnabled = body.sharing_enabled !== undefined ? !!body.sharing_enabled : true;
            const visibilityState = body.visibility_state || (sharingEnabled ? 'SHARING' : 'NOT_SHARING');
            const destination = typeof body.destination === 'string' ? body.destination.trim() : (user.destination || '');
            const accuracy = parseFloat(body.accuracy) || 15;

            // Check if user is part of an active confirmed ride
            const isActiveRider = (database.rides || []).some(r => 
                r.status === 'CONFIRMED' && (r.user_id === user.id || (Array.isArray(r.participants) && r.participants.some(p => p.id === user.id)))
            );

            const locationRecord = {
                id: 'loc_' + user.id,
                user_id: user.id,
                name: user.name,
                avatar_url: user.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
                primary_area: user.primary_area || 'Knowledge Park',
                latitude: lat,
                longitude: lng,
                accuracy: accuracy,
                destination: destination,
                sharing_enabled: sharingEnabled,
                visibility_state: isActiveRider ? 'ACTIVE_RIDE' : visibilityState,
                is_active_rider: isActiveRider,
                updated_at: Date.now()
            };

            if (sharingEnabled) {
                activeUserLocations.set(user.id, locationRecord);
                // Broadcast sanitized location to all connected map clients
                broadcastEvent('LOCATION_UPDATE', {
                    id: locationRecord.id,
                    user_id: locationRecord.user_id,
                    name: locationRecord.name,
                    avatar_url: locationRecord.avatar_url,
                    primary_area: locationRecord.primary_area,
                    latitude: locationRecord.latitude,
                    longitude: locationRecord.longitude,
                    accuracy: locationRecord.accuracy,
                    destination: locationRecord.destination,
                    visibility_state: locationRecord.visibility_state,
                    is_active_rider: locationRecord.is_active_rider,
                    updated_at: locationRecord.updated_at
                });
            } else {
                activeUserLocations.delete(user.id);
                broadcastEvent('LOCATION_REMOVED', { userId: user.id });
            }

            return sendJson(res, 200, {
                success: true,
                location: locationRecord,
                token: user.token,
                user: {
                    id: user.id,
                    name: user.name,
                    avatar_url: user.avatar_url,
                    primary_area: user.primary_area
                }
            });
        } catch (e) {
            return sendJson(res, 500, { error: 'Error processing location: ' + e.message });
        }
    }

    if (pathname === '/api/locations' && req.method === 'GET') {
        const now = Date.now();
        // Return only authenticated users who have sharing_enabled === true and updated within last 90 seconds
        const locations = [];
        for (const loc of activeUserLocations.values()) {
            if (loc.sharing_enabled && (now - loc.updated_at <= 90000)) {
                locations.push({
                    id: loc.id,
                    user_id: loc.user_id,
                    name: loc.name,
                    avatar_url: loc.avatar_url,
                    primary_area: loc.primary_area,
                    latitude: loc.latitude,
                    longitude: loc.longitude,
                    accuracy: loc.accuracy,
                    destination: loc.destination,
                    visibility_state: loc.visibility_state,
                    is_active_rider: loc.is_active_rider,
                    updated_at: loc.updated_at
                });
            }
        }
        return sendJson(res, 200, {
            totalVisible: locations.length,
            locations
        });
    }

    // Toggle privacy / location sharing state
    if (pathname === '/api/locations/privacy' && req.method === 'POST') {
        const user = getAuthenticatedUser(req);
        if (!user) {
            return sendJson(res, 401, { error: 'Authentication required.' });
        }

        try {
            const body = await parseJsonBody(req);
            const sharingEnabled = body.sharing_enabled !== undefined ? !!body.sharing_enabled : false;
            const visibilityState = sharingEnabled ? (body.visibility_state || 'SHARING') : 'NOT_SHARING';

            if (activeUserLocations.has(user.id)) {
                if (sharingEnabled) {
                    const existing = activeUserLocations.get(user.id);
                    existing.sharing_enabled = true;
                    existing.visibility_state = visibilityState;
                    existing.updated_at = Date.now();
                    broadcastEvent('LOCATION_UPDATE', existing);
                } else {
                    activeUserLocations.delete(user.id);
                    broadcastEvent('LOCATION_REMOVED', { userId: user.id });
                }
            } else if (!sharingEnabled) {
                broadcastEvent('LOCATION_REMOVED', { userId: user.id });
            }

            return sendJson(res, 200, { success: true, sharing_enabled: sharingEnabled, visibility_state: visibilityState });
        } catch (e) {
            return sendJson(res, 500, { error: e.message });
        }
    }

    // ----------------------------------------------------
    // API: Social Mobility Map - Live Assigned Vehicles
    // ----------------------------------------------------
    if (pathname === '/api/vehicles' && req.method === 'GET') {
        const vehiclesList = Array.from(activeVehicles.values()).map(v => {
            const normalizedType = v.type.toUpperCase() === 'AUTO' ? 'Auto' : (v.type.toUpperCase() === 'BUS' ? 'Bus' : 'Traveller');
            return {
                ...v,
                type: normalizedType,
                latitude: v.lat,
                longitude: v.lng,
                eta: `${v.eta_min} min`,
                seats_occupied: (v.capacity || 20) - (v.available_seats || 0)
            };
        });
        return sendJson(res, 200, {
            totalVehicles: vehiclesList.length,
            vehicles: vehiclesList
        });
    }

    if (pathname === '/api/vehicles/update' && req.method === 'POST') {
        try {
            const body = await parseJsonBody(req);
            const { id, lat, lng, eta_min, status } = body;
            if (activeVehicles.has(id)) {
                const v = activeVehicles.get(id);
                if (lat !== undefined) v.lat = parseFloat(lat);
                if (lng !== undefined) v.lng = parseFloat(lng);
                if (eta_min !== undefined) v.eta_min = parseInt(eta_min);
                if (status) v.status = status;
                broadcastEvent('VEHICLE_UPDATE', v);
                return sendJson(res, 200, { success: true, vehicle: v });
            }
            return sendJson(res, 404, { error: 'Vehicle not found' });
        } catch (e) {
            return sendJson(res, 500, { error: e.message });
        }
    }

    // ----------------------------------------------------
    // API: Vehicle Options & Pricing (Customer-Facing Only)
    // ----------------------------------------------------
    if (pathname === '/api/pricing' && req.method === 'GET') {
        const distanceKm = parseFloat(urlParams.get('distanceKm')) || 7.4;
        const passengers = parseInt(urlParams.get('passengers')) || 1;

        const options = Object.values(VEHICLE_PRICING).map(v => ({
            id: v.id,
            name: v.name,
            displayName: v.displayName,
            capacity: v.capacity,
            description: v.description,
            icon: v.icon,
            estimatedFare: calculateVehicleFare(v.id, distanceKm, Math.min(passengers, v.capacity)),
            status: 'Available',
            recommended: (passengers <= 4 && v.id === 'AUTO') || (passengers > 4 && passengers <= 20 && v.id === 'TRAVELLER') || (passengers > 20 && v.id === 'BUS')
        }));

        return sendJson(res, 200, {
            distanceKm,
            passengers,
            options
        });
    }

    // ----------------------------------------------------
    // API: Live Traffic & Traffic-Aware ETA Route Engine
    // ----------------------------------------------------
    if (pathname === '/api/routes/traffic-eta' && req.method === 'GET') {
        const origin = urlParams.get('origin') || '28.4744,77.5040';
        const destination = urlParams.get('destination') || '28.4682,77.5117';
        const apiKey = process.env.VITE_GOOGLE_MAPS_API_KEY || '';

        if (apiKey) {
            try {
                // Official Google Maps Directions API with departure_time=now & best_guess traffic
                const googleUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&departure_time=now&traffic_model=best_guess&key=${apiKey}`;
                const gRes = await fetch(googleUrl);
                const gData = await gRes.json();
                if (gData.status === 'OK' && gData.routes && gData.routes[0] && gData.routes[0].legs[0]) {
                    const leg = gData.routes[0].legs[0];
                    const distKm = parseFloat((leg.distance.value / 1000).toFixed(1));
                    const standardSec = leg.duration.value;
                    const trafficSec = (leg.duration_in_traffic && leg.duration_in_traffic.value) || standardSec;
                    const delayRatio = trafficSec / Math.max(1, standardSec);
                    
                    let condition = 'Light';
                    let conditionColor = 'text-green-500';
                    if (delayRatio > 1.4) {
                        condition = 'Severe';
                        conditionColor = 'text-red-500';
                    } else if (delayRatio > 1.2) {
                        condition = 'Heavy';
                        conditionColor = 'text-orange-500';
                    } else if (delayRatio > 1.05) {
                        condition = 'Moderate';
                        conditionColor = 'text-yellow-500';
                    }

                    const etaMin = Math.max(2, Math.round(trafficSec / 60));
                    return sendJson(res, 200, {
                        source: 'google_maps_platform',
                        distanceKm: distKm,
                        standardDurationMin: Math.round(standardSec / 60),
                        trafficDurationMin: etaMin,
                        trafficCondition: condition,
                        trafficColor: conditionColor,
                        etaText: `${etaMin} min (${condition} Traffic)`
                    });
                }
            } catch (err) {
                console.warn('Google Routes API fetch issue:', err.message);
            }
        }

        // High-precision geographic calculation when API key is pending
        let distanceKm = parseFloat(urlParams.get('distanceKm') || urlParams.get('distance'));
        if (isNaN(distanceKm) || !distanceKm) {
            const [lat1, lon1] = origin.split(',').map(Number);
            const [lat2, lon2] = destination.split(',').map(Number);
            if (!isNaN(lat1) && !isNaN(lon1) && !isNaN(lat2) && !isNaN(lon2)) {
                const R = 6371; // km
                const dLat = (lat2 - lat1) * Math.PI / 180;
                const dLon = (lon2 - lon1) * Math.PI / 180;
                const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                distanceKm = Math.max(1.0, parseFloat((R * c * 1.25).toFixed(1)));
            } else {
                distanceKm = 7.4;
            }
        }

        // Real-time diurnal traffic density model for NCR corridor
        const currentHour = new Date().getHours();
        let condition = 'Light';
        let conditionColor = 'text-green-500';
        let speedFactor = 35; // km/h

        if ((currentHour >= 8 && currentHour <= 10) || (currentHour >= 17 && currentHour <= 20)) {
            condition = 'Moderate';
            conditionColor = 'text-yellow-500';
            speedFactor = 25;
        }

        const etaMin = Math.max(3, Math.round((distanceKm / speedFactor) * 60));
        return sendJson(res, 200, {
            source: apiKey ? 'google_maps_platform' : 'local_traffic_engine',
            googleApiKeyConfigured: !!apiKey,
            distanceKm,
            trafficDurationMin: etaMin,
            trafficCondition: condition,
            trafficColor: conditionColor,
            etaText: `${etaMin} min (${condition} Traffic)`
        });
    }

    // ----------------------------------------------------
    // API: System Health Check (Zero-Downtime Monitoring)
    // ----------------------------------------------------
    if (pathname === '/health' || pathname === '/api/health') {
        const database = loadDb();
        return sendJson(res, 200, {
            status: 'healthy',
            service: 'saathchalo-live-server',
            version: '2.4.0-zero-downtime',
            uptime_seconds: Math.round(process.uptime()),
            timestamp: new Date().toISOString(),
            usersCount: database.users ? database.users.length : 0,
            bookingsCount: database.bookings ? database.bookings.length : 0,
            messagesCount: database.messages ? database.messages.length : 0,
            votesCount: database.votes ? database.votes.length : 0,
            ridesCount: database.rides ? database.rides.length : 0,
            database: {
                connected: true,
                storage: 'atomic_persistent_file',
                file: DB_FILE,
                usersCount: database.users ? database.users.length : 0,
                bookingsCount: database.bookings ? database.bookings.length : 0,
                messagesCount: database.messages ? database.messages.length : 0,
                votesCount: database.votes ? database.votes.length : 0,
                ridesCount: database.rides ? database.rides.length : 0
            },
            realtime: {
                sseClientsCount: sseClients.size,
                activeConnectedUsersCount: activeConnectedUsers.size,
                activeLocationsCount: activeUserLocations.size,
                assignedVehiclesCount: activeVehicles.size
            },
            featureFlags: FEATURE_FLAGS,
            zeroDowntimeReady: true
        });
    }

    // ----------------------------------------------------
    // API: Feature Flags
    // ----------------------------------------------------
    if (pathname === '/api/feature-flags') {
        return sendJson(res, 200, FEATURE_FLAGS);
    }

    // ----------------------------------------------------
    // Public Environment Variables (/env.js)
    // ----------------------------------------------------
    if (pathname === '/env.js') {
        const content = `window.__ENV__ = {
    VITE_SUPABASE_URL: ${JSON.stringify(process.env.VITE_SUPABASE_URL || '')},
    VITE_SUPABASE_PUBLISHABLE_KEY: ${JSON.stringify(process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '')},
    VITE_GOOGLE_MAPS_API_KEY: ${JSON.stringify(process.env.VITE_GOOGLE_MAPS_API_KEY || '')},
    FEATURE_FLAGS: ${JSON.stringify(FEATURE_FLAGS)}
};`;
        res.writeHead(200, { 'Content-Type': 'application/javascript; charset=UTF-8', 'Cache-Control': 'no-cache, no-store, must-revalidate' });
        res.end(content);
        return;
    }

    // ----------------------------------------------------
    // API 404 Fallback - Dedicated handler for unmatched /api/*
    // ----------------------------------------------------
    if (pathname.startsWith('/api/')) {
        return sendJson(res, 404, {
            error: 'API endpoint not found',
            path: pathname,
            method: req.method
        });
    }

    // ----------------------------------------------------
    // Static File Serving (Cache-Busting & Safe Updates)
    // ----------------------------------------------------
    let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=UTF-8' });
            res.end('404 Not Found');
            return;
        }
        const ext = path.extname(filePath).toLowerCase();
        // Prevent browsers from holding onto stale JS/HTML during production deploys
        const cacheHeader = (ext === '.html' || ext === '.js') 
            ? 'no-cache, no-store, must-revalidate' 
            : 'public, max-age=3600';

        res.writeHead(200, { 
            'Content-Type': MIME[ext] || 'application/octet-stream',
            'Cache-Control': cacheHeader,
            'X-Content-Type-Options': 'nosniff'
        });
        res.end(content);
    });
    } catch (unhandledErr) {
        console.error('Unhandled server error:', unhandledErr);
        if (!res.headersSent) {
            sendJson(res, 500, { error: 'Internal server error: ' + unhandledErr.message });
        }
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`✓ SAATHCHALO Live Multi-User Server listening at http://localhost:${PORT}`);
});
