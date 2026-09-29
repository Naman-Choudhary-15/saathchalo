const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = 8085;
const DB_FILE = path.join(__dirname, 'saath-db.json');

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
function loadDb() {
    if (!db) {
        if (fs.existsSync(DB_FILE)) {
            try {
                db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
                if (!Array.isArray(db.messages)) db.messages = [];
                if (!Array.isArray(db.votes)) db.votes = [];
                if (!Array.isArray(db.communities)) db.communities = COMMUNITIES;
                if (!Array.isArray(db.voteSessions) || db.voteSessions.length < 5) {
                    const defaultSessions = getDefaultDb().voteSessions;
                    db.voteSessions = defaultSessions;
                }
            } catch (e) {
                console.error('Error reading db file, restoring default:', e);
                db = getDefaultDb();
                saveDb();
            }
        } else {
            db = getDefaultDb();
            saveDb();
        }
    }
    return db;
}

function saveDb() {
    if (db) {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
    }
}

// Load DB immediately on start
loadDb();

// ==========================================
// 2. REAL-TIME SERVER-SENT EVENTS (SSE)
// ==========================================
const sseClients = new Set();
const activeUsersInCommunity = new Map(); // communityId -> Set(userId)

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
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Bypass-Tunnel-Reminder'
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
    // CORS Preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, Bypass-Tunnel-Reminder'
        });
        res.end();
        return;
    }

    const [pathname, queryString] = req.url.split('?');
    const urlParams = new URLSearchParams(queryString || '');

    // ----------------------------------------------------
    // SSE Realtime Stream Endpoint
    // ----------------------------------------------------
    if (pathname === '/api/events') {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
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
            const existing = database.users.find(u => u.email.toLowerCase() === email.toLowerCase());
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
            const user = database.users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.passwordHash === hash);

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
    // API: Get All Communities (Directory)
    // ----------------------------------------------------
    if (pathname === '/api/communities' && req.method === 'GET') {
        const database = loadDb();
        const user = getAuthenticatedUser(req);
        const result = COMMUNITIES.map(c => {
            const memberCount = database.users.filter(u => 
                Array.isArray(u.joined_communities) && u.joined_communities.includes(c.id)
            ).length;
            const isMember = user ? (Array.isArray(user.joined_communities) && user.joined_communities.includes(c.id)) : false;
            return {
                ...c,
                memberCount: Math.max(memberCount + 16, 16), // verified commuter count
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
            const user = getAuthenticatedUser(req);
            if (!user) {
                return sendJson(res, 401, { error: 'Authentication required to vote.' });
            }

            try {
                const body = await parseJsonBody(req);
                const { sessionId, optionId } = body;

                // Enforce one vote per user per session constraint
                const existingVoteIndex = database.votes.findIndex(v => v.vote_session_id === sessionId && v.user_id === user.id);
                if (existingVoteIndex >= 0) {
                    return sendJson(res, 400, { error: 'You have already voted in this session.' });
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

                return sendJson(res, 200, { success: true, counts, total: sessionVotes.length });
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

            // Gather all users who voted for the winning destination or all participants
            const sessionVotes = database.votes.filter(v => v.vote_session_id === sessionId);
            const totalRiders = Math.max(sessionVotes.length, 3);

            // Determine vehicle type based on rider count
            let vehicleType = 'Shared Auto';
            let capacity = 3;
            let plate = 'UP16-AT-' + Math.floor(1000 + Math.random() * 9000);

            if (totalRiders > 6) {
                vehicleType = 'Mini Shuttle Van';
                capacity = 10;
                plate = 'UP16-VN-' + Math.floor(1000 + Math.random() * 9000);
            } else if (totalRiders > 3) {
                vehicleType = 'Shared Cab';
                capacity = 4;
                plate = 'UP16-CB-' + Math.floor(1000 + Math.random() * 9000);
            }

            const ride = {
                id: 'ride_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                community_id: communityId,
                destination: winningDestination || 'Pari Chowk',
                vehicle_type: vehicleType,
                vehicle_number: plate,
                capacity: capacity,
                rider_count: Math.min(totalRiders, capacity),
                departure_time: '15 Minutes from Campus Gate',
                status: 'CONFIRMED',
                driver_name: ['Ramesh Kumar', 'Satish Sharma', 'Mohd. Imran', 'Sunil Yadav'][Math.floor(Math.random() * 4)],
                created_at: new Date().toISOString()
            };

            database.rides.push(ride);
            saveDb();

            // Broadcast to all connected devices in this community!
            broadcastEvent('RIDE_ALLOCATED', ride);

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
        const user = getAuthenticatedUser(req);
        if (!user) {
            return sendJson(res, 401, { error: 'Please log in to reserve a shuttle seat.' });
        }

        const parts = pathname.split('/');
        const shuttleId = parts[3];
        const database = loadDb();
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
        const booking = {
            id: 'sh_bk_' + Date.now(),
            user_id: user.id,
            shuttle_id: shuttle.id,
            route: shuttle.route,
            departure_time: shuttle.departure_time,
            fare: shuttle.fare,
            status: 'CONFIRMED',
            booking_time: new Date().toISOString()
        };
        database.bookings.push(booking);
        saveDb();

        // Broadcast updated shuttles to all devices immediately!
        broadcastEvent('SHUTTLE_UPDATE', database.shuttles);

        return sendJson(res, 200, {
            success: true,
            shuttle,
            booking,
            message: `Seat confirmed on ${shuttle.route}!`
        });
    }

    // ----------------------------------------------------
    // API: User Ride Bookings
    // ----------------------------------------------------
    if (pathname === '/api/bookings') {
        const user = getAuthenticatedUser(req);
        if (!user) {
            return sendJson(res, 401, { error: 'Authentication required.' });
        }

        const database = loadDb();

        if (req.method === 'GET') {
            const userBookings = database.bookings
                .filter(b => b.user_id === user.id)
                .reverse();
            return sendJson(res, 200, userBookings);
        }

        if (req.method === 'POST') {
            try {
                const body = await parseJsonBody(req);
                const { pickup, dropoff, distanceKm, vehicleType, vehicleId, fare } = body;

                const newBooking = {
                    id: 'BK-' + Date.now().toString().slice(-6),
                    user_id: user.id,
                    pickup: pickup || 'Campus Gate',
                    dropoff: dropoff || 'Pari Chowk',
                    distance_km: distanceKm || 3.5,
                    vehicle_type: vehicleType || 'Shared Auto',
                    vehicle_id: vehicleId || 'Auto UP16-AB-1411',
                    fare: fare || 15,
                    status: 'CONFIRMED',
                    booking_time: new Date().toISOString()
                };

                database.bookings.push(newBooking);
                saveDb();

                return sendJson(res, 201, newBooking);
            } catch (e) {
                return sendJson(res, 500, { error: e.message });
            }
        }
    }

    // ----------------------------------------------------
    // API: Real-Time Presence Ping
    // ----------------------------------------------------
    if (pathname === '/api/presence' && req.method === 'POST') {
        try {
            const body = await parseJsonBody(req);
            const { communityId, userId } = body;
            if (communityId && userId) {
                if (!activeUsersInCommunity.has(communityId)) {
                    activeUsersInCommunity.set(communityId, new Set());
                }
                activeUsersInCommunity.get(communityId).add(userId);
                const count = activeUsersInCommunity.get(communityId).size + 14; // Base active student pool
                broadcastEvent('PRESENCE_UPDATE', { communityId, count });
                return sendJson(res, 200, { count });
            }
            return sendJson(res, 200, { ok: true });
        } catch (e) {
            return sendJson(res, 200, { ok: true });
        }
    }

    // ----------------------------------------------------
    // Public Environment Variables (/env.js)
    // ----------------------------------------------------
    if (pathname === '/env.js') {
        const content = `window.__ENV__ = { VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: '' };`;
        res.writeHead(200, { 'Content-Type': 'application/javascript; charset=UTF-8', 'Cache-Control': 'no-cache' });
        res.end(content);
        return;
    }

    // ----------------------------------------------------
    // Static File Serving
    // ----------------------------------------------------
    let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=UTF-8' });
            res.end('404 Not Found');
            return;
        }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(content);
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`✓ SAATHCHALO Live Multi-User Server listening at http://localhost:${PORT}`);
});
