/**
 * SAATHCHALO — Real Multi-User Live Platform Client Service
 * 
 * High-performance real-time client providing:
 * - Real User Registration & Login with persistent authentication sessions
 * - Real-time Server-Sent Events (SSE) synchronization across all phones & laptops
 * - Multi-Device Group Chat with instant delivery (zero reloads)
 * - Flexible Community Group Choice: Join & Leave any regional community
 * - Real-time Community Destination Voting with unique vote constraint enforcement
 * - Dynamic Vehicle Allocation & Pooling into shared rides
 * - Shared Live Shuttle Capacity counters with overbooking prevention
 * - Resilient HTTP handling: Defends against tunnel timeouts, Bad Gateway (502/504)
 * - Zero configuration required: Works instantly out-of-the-box!
 */

class SaathLiveService {
    constructor() {
        this.currentUser = null;
        this.currentProfile = null;
        this.token = null;
        this.isReady = true;
        this.sse = null;
        this.reconnectAttempts = 0;
        this.reconnectTimer = null;
        
        // Listeners
        this.chatListeners = new Map();     // communityId -> Callback
        this.voteListeners = new Map();     // sessionId -> Callback
        this.shuttleListeners = [];
        this.presenceListeners = new Map(); // communityId -> Callback
        this.rideListeners = new Map();     // rideId -> Callback
        this.communityListeners = [];       // Membership changes
        this.connectedUsersListeners = [];  // Real-time connected user directory
        this.locationListeners = [];        // Social Mobility Map: live user coordinates
        this.locationRemovedListeners = []; // Social Mobility Map: user left / went private
        this.vehicleListeners = [];         // Live vehicle movement
    }

    init() {
        // 1. Restore local session if available
        if (typeof localStorage !== 'undefined') {
            const savedToken = localStorage.getItem('saath_auth_token');
            const savedUser = localStorage.getItem('saath_auth_user');
            if (savedToken && savedUser) {
                try {
                    this.token = savedToken;
                    this.currentUser = JSON.parse(savedUser);
                    this.currentProfile = this.currentUser;
                    if (!Array.isArray(this.currentProfile.joined_communities)) {
                        this.currentProfile.joined_communities = ['knowledge-park'];
                    }
                } catch (e) {}
            }
        }

        // 2. Connect to Real-Time SSE Stream
        this.connectRealtimeEvents();

        this.isReady = true;
        return true;
    }

    isConfigured() {
        return true; // Always ready with zero external configuration needed
    }

    getApiBase() {
        if (typeof window === 'undefined') return '';
        if (window.SAATH_CONFIG && window.SAATH_CONFIG.API_BASE_URL) {
            return window.SAATH_CONFIG.API_BASE_URL.replace(/\/$/, '');
        }
        const origin = window.location.origin || '';
        const host = window.location.host || '';
        // If opened on GitHub Pages, file://, or non-backend dev port (5500, 3000), route to live tunnel
        if (origin.startsWith('file:') || origin === 'null' || host.includes('github.io') || host.includes(':5500') || host.includes(':3000')) {
            return 'https://direction-billy-voting-trends.trycloudflare.com';
        }
        return origin;
    }

    // Safe API client defending against HTML / 502 Bad Gateway responses with auto-retry
    async safeFetchJson(url, options = {}, retries = 2) {
        options.headers = options.headers || {};
        options.headers['Bypass-Tunnel-Reminder'] = 'true';
        options.headers['Accept'] = 'application/json';

        let targetUrl = url;
        if (targetUrl.startsWith('/')) {
            const base = this.getApiBase();
            if (base && !targetUrl.startsWith(base)) {
                targetUrl = base + targetUrl;
            }
        }

        let res;
        try {
            res = await fetch(targetUrl, options);
        } catch (netErr) {
            console.warn('Network issue fetching ' + targetUrl, netErr);
            if (retries > 0) {
                await new Promise(r => setTimeout(r, 1000));
                return this.safeFetchJson(url, options, retries - 1);
            }
            throw new Error('Connection re-establishing. Please check internet connection.');
        }

        const text = await res.text();
        let data = null;

        if (text) {
            try {
                data = JSON.parse(text);
            } catch (e) {
                // If Cloudflare or network proxy returned an HTML error, auto-retry
                if (retries > 0 && (res.status >= 500 || text.includes('Cloudflare') || text.includes('<!DOCTYPE') || text.includes('Bad Gateway') || text.includes('Origin DNS'))) {
                    console.log(`[SAATH SYNC] Connection warming up (${res.status}), retrying in 1s...`);
                    await new Promise(r => setTimeout(r, 1000));
                    return this.safeFetchJson(url, options, retries - 1);
                }

                if (text.includes('Bad Gateway') || res.status === 502 || res.status === 504 || res.status === 530) {
                    throw new Error('Connection to live server temporarily reconnecting. Please wait 5 seconds and tap Log In again.');
                }
                throw new Error('Server connection was interrupted. Please try again.');
            }
        }

        if (!res.ok) {
            const errorMsg = (data && (data.error || data.message)) || `Server returned ${res.status}`;
            throw new Error(errorMsg);
        }

        return data;
    }

    connectRealtimeEvents() {
        if (typeof window === 'undefined' || !window.EventSource) return;

        if (this.sse) {
            try { this.sse.close(); } catch (e) {}
            this.sse = null;
        }

        try {
            const sseUrl = window.location.origin + '/api/events';
            this.sse = new EventSource(sseUrl);

            this.sse.onopen = () => {
                if (this.disconnectDebounceTimer) {
                    clearTimeout(this.disconnectDebounceTimer);
                    this.disconnectDebounceTimer = null;
                }
                const hadDisconnected = this.reconnectAttempts > 0;
                this.reconnectAttempts = 0;
                
                const pill = document.getElementById('saathConnectionStatusPill');
                const dot = document.getElementById('saathConnectionDot');
                const text = document.getElementById('saathConnectionText');

                if (pill && text && hadDisconnected) {
                    pill.className = 'fixed top-24 right-6 z-[9999] px-3.5 py-1.5 rounded-full text-xs font-bold shadow-xl transition-all duration-300 flex items-center gap-2 pointer-events-auto border backdrop-blur-md bg-darkTheme/95 text-emerald-400 border-emerald-500/60';
                    if (dot) dot.className = 'w-2 h-2 rounded-full bg-emerald-400';
                    text.innerText = '✓ Live Sync Active';
                    setTimeout(() => {
                        pill.classList.add('hidden');
                    }, 1800);
                } else if (pill) {
                    pill.classList.add('hidden');
                }

                // If reconnecting, re-fetch authoritative state from server so nothing is missed
                if (hadDisconnected) {
                    this.refetchAuthoritativeState();
                }
            };

            this.sse.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleRealtimeEvent(data.type, data.payload);
                } catch (err) {
                    // Ignore keepalive comments or non-json lines
                }
            };

            this.sse.onerror = () => {
                // Debounce disconnection status indicator: only display if disconnected for > 4.5 seconds (Prompt #7)
                if (!this.disconnectDebounceTimer) {
                    this.disconnectDebounceTimer = setTimeout(() => {
                        const pill = document.getElementById('saathConnectionStatusPill');
                        const dot = document.getElementById('saathConnectionDot');
                        const text = document.getElementById('saathConnectionText');

                        if (pill && text) {
                            pill.className = 'fixed top-24 right-6 z-[9999] px-3.5 py-1.5 rounded-full text-xs font-bold shadow-xl transition-all duration-300 flex items-center gap-2 pointer-events-auto border backdrop-blur-md bg-darkTheme/95 text-brandYellow border-brandYellow/60 animate-pulse';
                            if (dot) dot.className = 'w-2 h-2 rounded-full bg-brandYellow';
                            text.innerText = 'Reconnecting to live sync...';
                            pill.classList.remove('hidden');
                        }
                    }, 4500);
                }

                if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
                const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts++), 10000);
                this.reconnectTimer = setTimeout(() => {
                    this.connectRealtimeEvents();
                }, delay);
            };
        } catch (e) {
            console.warn('Could not establish SSE stream:', e);
        }
    }

    async refetchAuthoritativeState() {
        try {
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('saath:authoritative:sync', {
                    detail: { timestamp: Date.now() }
                }));
            }

            if (typeof appManager !== 'undefined' && appManager.currentCommunity) {
                const commId = appManager.currentCommunity;
                const msgs = await this.getCommunityChat(commId);
                if (typeof mergeCommunityMessages === 'function' && Array.isArray(msgs)) {
                    mergeCommunityMessages(msgs);
                }

                const voteData = await this.getVoteSession(commId);
                if (voteData && typeof renderVotingOptions === 'function') {
                    renderVotingOptions(voteData);
                }

                this.pingPresence(commId);
            }

            if (typeof fetchAndRenderLiveUsers === 'function') {
                fetchAndRenderLiveUsers();
            }
            if (typeof fetchAndRenderLiveVehicles === 'function') {
                fetchAndRenderLiveVehicles();
            }
        } catch (e) {
            console.warn('Re-sync notice:', e.message);
        }
    }

    handleRealtimeEvent(type, payload) {
        if (!type || !payload) return;

        if (type === 'NEW_MESSAGE') {
            const listener = this.chatListeners.get(payload.communityId);
            if (listener) {
                const formatted = {
                    ...payload,
                    isUser: this.currentUser ? payload.senderId === this.currentUser.id : false
                };
                listener(formatted);
            }
        } else if (type === 'VOTE_UPDATE') {
            const listener = this.voteListeners.get(payload.sessionId);
            if (listener) {
                listener({
                    counts: payload.counts,
                    total: payload.total
                });
            }
        } else if (type === 'SHUTTLE_UPDATE') {
            this.shuttleListeners.forEach(cb => {
                try { cb(payload); } catch (e) {}
            });
        } else if (type === 'RIDE_ALLOCATED') {
            if (window.renderCommunityRideConfirmedBanner) {
                window.renderCommunityRideConfirmedBanner(payload);
            }
            if (window.showNotificationToast) {
                window.showNotificationToast(`🎉 Shared Ride Arranged! Vehicle: ${payload.vehicle_type}`);
            }
        } else if (type === 'PRESENCE_UPDATE') {
            const listener = this.presenceListeners.get(payload.communityId);
            if (listener) {
                listener(payload.count);
            }
        } else if (type === 'CONNECTED_USERS_UPDATE') {
            this.connectedUsersListeners.forEach(cb => {
                try { cb(payload); } catch (e) {}
            });
            if (window.renderLiveCommunitySection) {
                window.renderLiveCommunitySection(payload);
            }
        } else if (type === 'COMMUNITY_MEMBER_UPDATE') {
            this.communityListeners.forEach(cb => {
                try { cb(payload); } catch (e) {}
            });
            if (window.loadCommunityMembers) {
                window.loadCommunityMembers(payload?.communityId);
            }
        } else if (type === 'LOCATION_UPDATE') {
            this.locationListeners.forEach(cb => {
                try { cb(payload); } catch (e) {}
            });
            if (window.handleRealtimeLocationUpdate) {
                window.handleRealtimeLocationUpdate(payload);
            }
        } else if (type === 'LOCATION_REMOVED') {
            this.locationRemovedListeners.forEach(cb => {
                try { cb(payload); } catch (e) {}
            });
            if (window.handleRealtimeLocationRemoved) {
                window.handleRealtimeLocationRemoved(payload);
            }
        } else if (type === 'VEHICLE_UPDATE') {
            this.vehicleListeners.forEach(cb => {
                try { cb(payload); } catch (e) {}
            });
            if (window.handleRealtimeVehicleUpdate) {
                window.handleRealtimeVehicleUpdate(payload);
            }
        } else if (type === 'REWARD_UPDATED') {
            if (this.currentUser && payload.userId === this.currentUser.id) {
                this.currentUser.reward_points = payload.currentPoints;
                if (this.currentProfile) this.currentProfile.reward_points = payload.currentPoints;
                if (typeof localStorage !== 'undefined') {
                    const stored = localStorage.getItem('saath_auth_user');
                    if (stored) {
                        try {
                            const u = JSON.parse(stored);
                            u.reward_points = payload.currentPoints;
                            localStorage.setItem('saath_auth_user', JSON.stringify(u));
                        } catch(e) {}
                    }
                }
                if (typeof window.updateRewardBalanceUI === 'function') {
                    window.updateRewardBalanceUI(payload.currentPoints, payload);
                }
                if (typeof window.showNotificationToast === 'function') {
                    if (payload.pointsChange < 0) {
                        window.showNotificationToast(`${Math.abs(payload.pointsChange)} reward points were deducted because you did not attend a confirmed community ride.`);
                    } else if (payload.pointsChange > 0) {
                        window.showNotificationToast(`+${payload.pointsChange} reward points added to your balance!`);
                    }
                }
            }
        } else if (type === 'ATTENDANCE_UPDATED') {
            if (typeof window.handleAttendanceUpdated === 'function') {
                window.handleAttendanceUpdated(payload);
            }
        } else if (type === 'ATTENDANCE_FINALIZED') {
            if (typeof window.handleAttendanceFinalized === 'function') {
                window.handleAttendanceFinalized(payload);
            }
        } else if (type === 'VOTE_CANCELLED') {
            if (this.currentUser && payload.userId === this.currentUser.id) {
                if (typeof window.resetPersonalVoteState === 'function') {
                    window.resetPersonalVoteState(payload.sessionId);
                }
            }
            if (typeof appManager !== 'undefined' && typeof appManager.refreshVoting === 'function') {
                appManager.refreshVoting();
            }
        } else if (type === 'DRIVER_LOCATION_UPDATED') {
            if (typeof window.handleDriverLocationUpdate === 'function') {
                window.handleDriverLocationUpdate(payload);
            }
        } else if (type === 'DRIVER_STATUS_UPDATED') {
            if (typeof window.handleDriverStatusUpdate === 'function') {
                window.handleDriverStatusUpdate(payload);
            }
        } else if (type === 'STOP_UPDATED') {
            if (typeof window.handleStopUpdate === 'function') {
                window.handleStopUpdate(payload);
            }
        } else if (type === 'RIDE_STARTED' || type === 'RIDE_COMPLETED') {
            if (typeof window.handleRideStateUpdate === 'function') {
                window.handleRideStateUpdate(payload);
            }
        }
    }

    // ==========================================
    // AUTHENTICATION
    // ==========================================
    async register(email, password, name, avatarUrl = '', primaryArea = 'Knowledge Park') {
        const data = await this.safeFetchJson('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email,
                password,
                name,
                avatar: avatarUrl,
                area: primaryArea
            })
        });

        this.token = data.token;
        this.currentUser = data.user;
        this.currentProfile = data.user;

        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('saath_auth_token', this.token);
            localStorage.setItem('saath_auth_user', JSON.stringify(this.currentUser));
        }

        return data;
    }

    async login(email, password) {
        const data = await this.safeFetchJson('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        this.token = data.token;
        this.currentUser = data.user;
        this.currentProfile = data.user;

        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('saath_auth_token', this.token);
            localStorage.setItem('saath_auth_user', JSON.stringify(this.currentUser));
        }

        return data;
    }

    async logout() {
        const oldToken = this.token;
        const oldUserId = this.currentUser ? this.currentUser.id : null;
        this.token = null;
        this.currentUser = null;
        this.currentProfile = null;
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem('saath_auth_token');
            localStorage.removeItem('saath_auth_user');
        }
        try {
            await this.safeFetchJson('/api/auth/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(oldToken ? { 'Authorization': `Bearer ${oldToken}` } : {})
                },
                body: JSON.stringify({ userId: oldUserId })
            });
        } catch (e) {}
    }

    async checkSession() {
        if (!this.token) return null;
        try {
            const user = await this.safeFetchJson('/api/auth/me', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (user) {
                this.currentUser = user;
                this.currentProfile = user;
                if (typeof localStorage !== 'undefined') {
                    localStorage.setItem('saath_auth_user', JSON.stringify(this.currentUser));
                }
                return user;
            }
        } catch (e) {}

        return this.currentUser;
    }

    onAuthStateChange(callback) {
        if (callback) {
            callback('STATE_CHANGE', this.currentUser, this.currentProfile);
        }
    }

    async upsertProfile(userId, updates) {
        if (this.currentProfile) {
            this.currentProfile = { ...this.currentProfile, ...updates };
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem('saath_auth_user', JSON.stringify(this.currentProfile));
            }
        }
    }

    // ==========================================
    // COMMUNITY DIRECTORY & MEMBERSHIP
    // ==========================================
    async getCommunities() {
        try {
            const headers = {};
            if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
            const data = await this.safeFetchJson('/api/communities', { headers });
            if (Array.isArray(data)) return data;
        } catch (e) {
            console.warn('Error fetching communities directory:', e);
        }
        return [];
    }

    isMemberOf(communityId) {
        if (!this.currentUser || !this.currentProfile) return false;
        const joined = this.currentProfile.joined_communities;
        if (!Array.isArray(joined)) return false;
        return joined.includes(communityId);
    }

    getJoinedCommunities() {
        if (!this.currentProfile || !Array.isArray(this.currentProfile.joined_communities)) {
            return [];
        }
        return this.currentProfile.joined_communities;
    }

    async joinCommunity(communityId) {
        if (!this.currentUser || !this.token) {
            throw new Error('Please log in to join community groups.');
        }

        const data = await this.safeFetchJson(`/api/community/${communityId}/join`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.token}`
            }
        });

        if (data && data.joined_communities) {
            if (this.currentProfile) {
                this.currentProfile.joined_communities = data.joined_communities;
                if (typeof localStorage !== 'undefined') {
                    localStorage.setItem('saath_auth_user', JSON.stringify(this.currentProfile));
                }
            }
        }

        return data;
    }

    async leaveCommunity(communityId) {
        if (!this.currentUser || !this.token) {
            throw new Error('Please log in to manage community groups.');
        }

        const data = await this.safeFetchJson(`/api/community/${communityId}/leave`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.token}`
            }
        });

        if (data && data.joined_communities) {
            if (this.currentProfile) {
                this.currentProfile.joined_communities = data.joined_communities;
                if (typeof localStorage !== 'undefined') {
                    localStorage.setItem('saath_auth_user', JSON.stringify(this.currentProfile));
                }
            }
        }

        return data;
    }

    subscribeToCommunityUpdates(callback) {
        if (typeof callback === 'function') {
            this.communityListeners.push(callback);
        }
    }

    // ==========================================
    // COMMUNITY CHAT & PRESENCE
    // ==========================================
    async getCommunityMessages(communityId) {
        try {
            const list = await this.safeFetchJson(`/api/community/${communityId}/messages`);
            if (Array.isArray(list)) {
                return list.map(m => ({
                    ...m,
                    isUser: this.currentUser ? m.senderId === this.currentUser.id : false
                }));
            }
        } catch (e) {
            console.warn('Error fetching messages:', e);
        }
        return [];
    }

    async sendMessage(communityId, messageText) {
        if (!this.currentUser || !this.token) {
            throw new Error('Please log in to chat with commuters.');
        }

        const res = await this.safeFetchJson(`/api/community/${communityId}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`
            },
            body: JSON.stringify({ message: messageText })
        });

        // Ensure user is marked as joined locally
        if (this.currentProfile) {
            if (!Array.isArray(this.currentProfile.joined_communities)) {
                this.currentProfile.joined_communities = [];
            }
            if (!this.currentProfile.joined_communities.includes(communityId)) {
                this.currentProfile.joined_communities.push(communityId);
                if (typeof localStorage !== 'undefined') {
                    localStorage.setItem('saath_auth_user', JSON.stringify(this.currentProfile));
                }
            }
        }

        return res;
    }

    subscribeToCommunityChat(communityId, onNewMessage) {
        this.chatListeners.set(communityId, onNewMessage);
    }

    subscribeToPresence(communityId, onPresenceChange) {
        this.presenceListeners.set(communityId, onPresenceChange);

        // Ping real presence
        this.pingPresence(communityId);
    }

    async pingPresence(communityId = 'knowledge-park') {
        const commId = communityId || 'knowledge-park';
        const userId = this.currentUser ? this.currentUser.id : ('guest_' + (typeof window !== 'undefined' && window.name ? window.name : 'anon'));
        const name = this.currentUser ? this.currentUser.name : 'Active Commuter';
        const avatar = this.currentUser ? this.currentUser.avatar_url : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80';

        try {
            const data = await this.safeFetchJson('/api/presence', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.token ? { 'Authorization': `Bearer ${this.token}` } : {})
                },
                body: JSON.stringify({
                    communityId: commId,
                    userId,
                    name,
                    avatar
                })
            });
            if (data && this.presenceListeners.has(commId)) {
                this.presenceListeners.get(commId)(data.connectedCount);
            }
            return data;
        } catch (e) {}
    }

    async getLivePresence(communityId = 'knowledge-park') {
        try {
            const stats = await this.safeFetchJson(`/api/presence?communityId=${communityId}`);
            if (stats && (stats.totalRegisteredUsers || stats.registeredCount || stats.connectedCount)) {
                this.cachedPresence = stats;
            }
            return stats;
        } catch (e) {
            if (this.cachedPresence) return this.cachedPresence;
            return { connectedCount: 0, activeRidersCount: 0, ridesOrganizingCount: 0, connectedUsers: [] };
        }
    }

    async getCommunityMembers(communityId = 'knowledge-park') {
        try {
            const stats = await this.safeFetchJson(`/api/community/${communityId}/members`);
            if (stats && (stats.totalRegisteredUsers || stats.registeredCount || (Array.isArray(stats.members) && stats.members.length > 0))) {
                this.cachedMembers = stats;
            }
            return stats;
        } catch (e) {
            console.warn('Error fetching community members:', e);
            if (this.cachedMembers) return this.cachedMembers;
            return null;
        }
    }

    async getMemberStats(communityId = 'knowledge-park') {
        try {
            return await this.safeFetchJson(`/api/community/${communityId}/member-stats`);
        } catch (e) {
            return await this.getCommunityMembers(communityId);
        }
    }

    subscribeToConnectedUsers(callback) {
        if (callback) this.connectedUsersListeners.push(callback);
    }

    async getVehiclePricing(distanceKm = 7.4, passengers = 1) {
        try {
            return await this.safeFetchJson(`/api/pricing?distanceKm=${distanceKm}&passengers=${passengers}`);
        } catch (e) {
            return null;
        }
    }

    async getTrafficAwareETA(origin = '28.4744,77.5040', destination = '28.4682,77.5117') {
        try {
            return await this.safeFetchJson(`/api/routes/traffic-eta?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`);
        } catch (e) {
            return {
                distanceKm: 7.4,
                trafficDurationMin: 12,
                trafficCondition: 'Moderate',
                trafficColor: 'text-yellow-500',
                etaText: '12 min (Moderate Traffic)'
            };
        }
    }

    // ==========================================
    // DESTINATION VOTING & POOLING
    // ==========================================
    async getActiveVoteSession(communityId) {
        try {
            const headers = {};
            if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
            const data = await this.safeFetchJson(`/api/community/${communityId}/vote`, { headers });
            return data ? data.session : null;
        } catch (e) {
            console.warn('Error fetching vote session:', e);
        }
        return null;
    }

    async getVoteCounts(communityId, voteSessionId) {
        try {
            const headers = {};
            if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
            const comm = communityId || 'knowledge-park';
            const data = await this.safeFetchJson(`/api/community/${comm}/vote`, { headers });
            if (data) {
                return {
                    counts: data.counts || {},
                    total: data.total || 0,
                    userVotedOptionId: data.userVotedOptionId || null
                };
            }
        } catch (e) {
            console.warn('Error fetching vote counts:', e);
        }
        return { counts: {}, total: 0, userVotedOptionId: null };
    }

    async castVote(voteSessionId, optionId, communityId) {
        if (!this.currentUser || !this.token) {
            throw new Error('Please log in to vote on destination.');
        }

        return await this.safeFetchJson(`/api/community/${communityId}/vote`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`
            },
            body: JSON.stringify({ sessionId: voteSessionId, optionId })
        });
    }

    subscribeToVoteUpdates(voteSessionId, onVoteChanged) {
        this.voteListeners.set(voteSessionId, onVoteChanged);
    }

    async finalizeVoteAndAllocateRide(voteSessionId, winningDestination, communityId) {
        return await this.safeFetchJson(`/api/community/${communityId}/allocate-ride`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(this.token ? { 'Authorization': `Bearer ${this.token}` } : {})
            },
            body: JSON.stringify({
                sessionId: voteSessionId,
                winningDestination: winningDestination || 'Pari Chowk'
            })
        });
    }

    async getRideDetails(rideId) {
        try {
            const data = await this.safeFetchJson(`/api/rides/${rideId}`);
            if (data && data.id) return data;
        } catch(e) {}
        return {
            id: rideId,
            vehicle_type: 'Shared Auto',
            vehicle_id: 'Auto UP16-AB-1411',
            destination: 'Pari Chowk'
        };
    }

    // ==========================================
    // REWARD POINTS & RELIABILITY SYSTEM (Sections 5-31, 66)
    // ==========================================
    async getRewardBalance() {
        const headers = {};
        if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
        const userIdParam = this.currentUser ? `?userId=${encodeURIComponent(this.currentUser.id)}` : '';
        return await this.safeFetchJson(`/api/users/me/rewards${userIdParam}`, { headers });
    }

    async getRewardHistory() {
        const headers = {};
        if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
        const userIdParam = this.currentUser ? `?userId=${encodeURIComponent(this.currentUser.id)}` : '';
        return await this.safeFetchJson(`/api/users/me/rewards/history${userIdParam}`, { headers });
    }

    async checkInRide(rideId) {
        const headers = { 'Content-Type': 'application/json' };
        if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
        return await this.safeFetchJson(`/api/rides/${rideId}/check-in`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ userId: this.currentUser?.id })
        });
    }

    async getRideAttendance(rideId) {
        return await this.safeFetchJson(`/api/rides/${rideId}/attendance`);
    }

    async finalizeRideAttendance(rideId) {
        const headers = { 'Content-Type': 'application/json' };
        if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
        return await this.safeFetchJson(`/api/rides/${rideId}/finalize-attendance`, {
            method: 'POST',
            headers
        });
    }

    async cancelRideBooking(rideId, isLateCancellation = false) {
        const headers = { 'Content-Type': 'application/json' };
        if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
        return await this.safeFetchJson(`/api/rides/${rideId}/cancel`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                userId: this.currentUser?.id,
                isLateCancellation
            })
        });
    }

    // ==========================================
    // SHUTTLES
    // ==========================================
    async getShuttles() {
        try {
            const data = await this.safeFetchJson('/api/shuttles');
            if (Array.isArray(data)) return data;
        } catch (e) {
            console.warn('Error fetching shuttles:', e);
        }
        return [];
    }

    async bookShuttleSeat(shuttleId) {
        const headers = {};
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        const data = await this.safeFetchJson(`/api/shuttles/${shuttleId}/book`, {
            method: 'POST',
            headers
        });

        if (data && data.token && (!this.token || !this.currentUser)) {
            this.token = data.token;
            this.currentUser = data.user;
            this.currentProfile = data.user;
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem('saath_auth_token', data.token);
                localStorage.setItem('saath_auth_user', JSON.stringify(data.user));
            }
            if (typeof renderAuthNavigationUI === 'function') {
                renderAuthNavigationUI();
            }
        }
        return data;
    }

    subscribeToShuttleUpdates(onShuttlesChange) {
        this.shuttleListeners.push(onShuttlesChange);
    }

    // ==========================================
    // BOOKINGS
    // ==========================================
    async createBooking(pickup, dropoff, distanceKm, vehicleType, vehicleId, fare, fuelPreference = 'EV') {
        const headers = {
            'Content-Type': 'application/json'
        };
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        const data = await this.safeFetchJson('/api/bookings', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                pickup,
                dropoff,
                distanceKm,
                distance_km: distanceKm,
                vehicleType,
                vehicle_type: vehicleType,
                vehicleId,
                vehicle_id: vehicleId,
                fuel_preference: fuelPreference,
                fuelPreference: fuelPreference,
                fare
            })
        });

        if (data && data.token && (!this.token || !this.currentUser)) {
            this.token = data.token;
            this.currentUser = data.user;
            this.currentProfile = data.user;
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem('saath_auth_token', data.token);
                localStorage.setItem('saath_auth_user', JSON.stringify(data.user));
            }
            if (typeof renderAuthNavigationUI === 'function') {
                renderAuthNavigationUI();
            }
        }
        return data;
    }

    async getUserBookings() {
        try {
            const headers = {};
            if (this.token) {
                headers['Authorization'] = `Bearer ${this.token}`;
            }
            const list = await this.safeFetchJson('/api/bookings', { headers });
            if (Array.isArray(list)) return list;
        } catch (e) {
            console.warn('Error loading bookings:', e);
        }
        return [];
    }

    // ==========================================
    // SOCIAL MOBILITY MAP (GEOLOCATION & VEHICLES)
    // ==========================================
    async updateUserLocation(locationData) {
        const headers = { 'Content-Type': 'application/json' };
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        try {
            const data = await this.safeFetchJson('/api/locations', {
                method: 'POST',
                headers,
                body: JSON.stringify(locationData)
            });

            if (data && data.token && (!this.token || !this.currentUser)) {
                this.token = data.token;
                this.currentUser = data.user;
                this.currentProfile = data.user;
                if (typeof localStorage !== 'undefined') {
                    localStorage.setItem('saath_auth_token', data.token);
                    localStorage.setItem('saath_auth_user', JSON.stringify(data.user));
                }
                if (typeof renderAuthNavigationUI === 'function') {
                    renderAuthNavigationUI();
                }
            }
            return data;
        } catch (e) {
            console.warn('Location update error:', e);
            return null;
        }
    }

    async getLiveLocations() {
        try {
            const res = await this.safeFetchJson('/api/locations');
            return (res && Array.isArray(res.locations)) ? res.locations : (Array.isArray(res) ? res : []);
        } catch (e) {
            console.warn('Error fetching live locations:', e);
            return [];
        }
    }

    async getMyIpLocation() {
        try {
            return await this.safeFetchJson('/api/my-ip-location');
        } catch (e) {
            return null;
        }
    }

    async setLocationPrivacy(sharingEnabled, visibilityState = 'SHARING') {
        if (!this.currentUser || !this.token) return;
        return await this.safeFetchJson('/api/locations/privacy', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`
            },
            body: JSON.stringify({ sharing_enabled: sharingEnabled, visibility_state: visibilityState })
        });
    }

    async getLiveVehicles() {
        try {
            const res = await this.safeFetchJson('/api/vehicles');
            return res && Array.isArray(res.vehicles) ? res.vehicles : [];
        } catch (e) {
            console.warn('Error fetching live vehicles:', e);
            return [];
        }
    }

    subscribeToLocations(onLocationUpdate, onLocationRemoved) {
        if (typeof onLocationUpdate === 'function') this.locationListeners.push(onLocationUpdate);
        if (typeof onLocationRemoved === 'function') this.locationRemovedListeners.push(onLocationRemoved);
    }

    subscribeToVehicles(onVehicleUpdate) {
        if (typeof onVehicleUpdate === 'function') this.vehicleListeners.push(onVehicleUpdate);
    }

    // ----------------------------------------------------
    // COMMUNITY VOTE CANCELLATION (Prompt #28)
    // ----------------------------------------------------
    async cancelVote(sessionId, communityId) {
        if (!this.currentUser || !this.token) {
            throw new Error('Authentication required.');
        }
        return await this.safeFetchJson(`/api/community/${communityId || 'knowledge-park'}/vote/cancel`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`
            },
            body: JSON.stringify({ sessionId, userId: this.currentUser.id })
        });
    }

    // ----------------------------------------------------
    // DRIVER PLATFORM APIs (Prompts #31-#43)
    // ----------------------------------------------------
    async getDriverMe() {
        return await this.safeFetchJson('/api/driver/me', {
            headers: this.token ? { 'Authorization': `Bearer ${this.token}` } : {}
        });
    }

    async setDriverStatus(status) {
        return await this.safeFetchJson('/api/driver/status', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(this.token ? { 'Authorization': `Bearer ${this.token}` } : {})
            },
            body: JSON.stringify({ status })
        });
    }

    async getDriverCurrentRide() {
        return await this.safeFetchJson('/api/driver/current-ride', {
            headers: this.token ? { 'Authorization': `Bearer ${this.token}` } : {}
        });
    }

    async sendDriverAction(rideId, action, extra = {}) {
        return await this.safeFetchJson(`/api/driver/ride/${rideId}/action`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(this.token ? { 'Authorization': `Bearer ${this.token}` } : {})
            },
            body: JSON.stringify({ action, ...extra })
        });
    }

    async sendDriverLocation(latitude, longitude, heading = 0, speed = 0, rideId = null, driverId = null) {
        return await this.safeFetchJson('/api/driver/location', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(this.token ? { 'Authorization': `Bearer ${this.token}` } : {})
            },
            body: JSON.stringify({
                latitude,
                longitude,
                heading,
                speed,
                rideId,
                driverId: driverId || (this.currentUser ? this.currentUser.driver_id || this.currentUser.id : null)
            })
        });
    }

    unsubscribeAll() {
        this.chatListeners.clear();
        this.voteListeners.clear();
        this.presenceListeners.clear();
        this.shuttleListeners = [];
        this.communityListeners = [];
        this.locationListeners = [];
        this.locationRemovedListeners = [];
        this.vehicleListeners = [];
    }
}

// Instantiate global live service (named saathSupabase for seamless compatibility with script.js)
window.saathSupabase = new SaathLiveService();
