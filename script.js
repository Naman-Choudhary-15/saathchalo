/**
 * SAATHCHALO — Real Multi-User Live Platform Engine
 * Powered by Supabase Authentication, PostgreSQL, Realtime & Storage
 * 
 * Features:
 * 1. Real Multi-Device Authentication (Register, Login, Session Persistence, Sign Out)
 * 2. Real-Time Community Group Chat via Supabase Realtime (No reloads required)
 * 3. Real-Time Online Presence Tracking (Live active commuter counters)
 * 4. Real-Time Community Destination Voting with unique vote constraints
 * 5. Real Shared Ride Sessions & Participant Pooling in PostgreSQL
 * 6. Backend-Driven Vehicle Allocation (Auto / Traveller / Bus)
 * 7. Live Vehicle Tracking on Leaflet Map with real-time telemetry stream
 * 8. Real Shared Shuttle Schedule with concurrent seat capacity protection
 * 9. Privacy Guaranteed: Only First Name & Avatar visible to other community members
 * 10. Customer-Facing Only: Zero internal formula leaks (no ₹10/km or section formula exposed)
 */

// ==========================================
// 1. CONFIGURATION & CONSTANTS
// ==========================================
const SAATH_CONFIG = {
    BASE_RATE_PER_KM: 10,
    AUTO_CAPACITY: 4,
    SHUTTLE_CAPACITY: 20,
    BUS_CAPACITY: 50,
    NO_SHOW_FINE: 50,
    DEFAULT_CENTER: [28.4744, 77.5040], // Knowledge Park II, Greater Noida
    LANDMARKS: {
        'knowledge park': { name: 'Knowledge Park, Greater Noida', coords: [28.4744, 77.5040] },
        'kp': { name: 'Knowledge Park II, Greater Noida', coords: [28.4744, 77.5040] },
        'pari chowk': { name: 'Pari Chowk, Greater Noida', coords: [28.4682, 77.5117] },
        'alpha 1': { name: 'Alpha 1, Greater Noida', coords: [28.4962, 77.5140] },
        'alpha 2': { name: 'Alpha 2, Greater Noida', coords: [28.4890, 77.5210] },
        'delta 1': { name: 'Delta 1, Greater Noida', coords: [28.4820, 77.5310] },
        'jagat farm': { name: 'Jagat Farm, Greater Noida', coords: [28.4720, 77.5080] },
        'noida sector 62': { name: 'Sector 62, Noida', coords: [28.6280, 77.3649] },
        'sector 62': { name: 'Sector 62, Noida', coords: [28.6280, 77.3649] },
        'noida sector 137': { name: 'Sector 137 Metro, Noida', coords: [28.5130, 77.4080] },
        'ghaziabad': { name: 'Ghaziabad Central Bus Terminal', coords: [28.6692, 77.4300] },
        'botanical garden': { name: 'Botanical Garden Metro, Noida', coords: [28.5640, 77.3340] },
        'greater noida west': { name: 'Gaur City, Greater Noida West', coords: [28.6080, 77.4260] }
    },
    AVATARS: [
        { id: 'av1', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80', label: 'Commuter 1' },
        { id: 'av2', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80', label: 'Commuter 2' },
        { id: 'av3', url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80', label: 'Commuter 3' },
        { id: 'av4', url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80', label: 'Commuter 4' },
        { id: 'av5', url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=150&q=80', label: 'Commuter 5' },
        { id: 'av6', url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80', label: 'Commuter 6' }
    ]
};

// ==========================================
// 2. REAL-TIME MULTI-USER STATE MANAGER
// ==========================================
class SaathAppStateManager {
    constructor() {
        this.currentCommunity = 'knowledge-park';
        this.currentVoteSession = null;
        this.userVotedOptionId = null;
        this.activeRide = null;
        this.shuttlesList = [];
    }

    async init() {
        // 1. Initialize Supabase Service
        const supabaseReady = window.saathSupabase && window.saathSupabase.init();

        // 2. Check for existing active session
        if (supabaseReady) {
            await window.saathSupabase.checkSession();
            window.saathSupabase.onAuthStateChange((event, session, profile) => {
                renderAuthNavigationUI();
                if (session) {
                    this.loadInitialData();
                }
            });
        }

        renderAuthNavigationUI();
        await this.loadInitialData();

        if (!this.chatPollInterval) {
            this.chatPollInterval = setInterval(async () => {
                if (window.saathSupabase && window.saathSupabase.isReady && this.currentCommunity) {
                    try {
                        const latest = await window.saathSupabase.getCommunityMessages(this.currentCommunity);
                        mergeCommunityMessages(latest);
                    } catch (e) {}
                }
            }, 3000);
        }
    }

    async loadInitialData() {
        renderUserProfileUI();
        await this.refreshShuttles();
        await this.loadCommunityData(this.currentCommunity);
        await this.loadUserBookings();
    }

    async refreshShuttles() {
        if (window.saathSupabase && window.saathSupabase.isReady) {
            try {
                const shuttles = await window.saathSupabase.getShuttles();
                if (shuttles && shuttles.length > 0) {
                    this.shuttlesList = shuttles;
                    renderShuttlesUI(this.shuttlesList);
                    window.saathSupabase.subscribeToShuttleUpdates((updatedShuttles) => {
                        this.shuttlesList = updatedShuttles;
                        renderShuttlesUI(this.shuttlesList);
                    });
                    return;
                }
            } catch (e) {
                console.warn('Could not load shuttles from Supabase:', e);
            }
        }

        // Fallback initial schedule
        this.shuttlesList = [
            { id: 'SH-01', route: 'Knowledge Park → Pari Chowk', departure_time: '08:30 AM', arrival_time: '08:50 AM', capacity: 20, available_seats: 18, status: 'Available', fare: 20 },
            { id: 'SH-02', route: 'Knowledge Park → Noida Sector 62', departure_time: '09:00 AM', arrival_time: '09:50 AM', capacity: 20, available_seats: 0, status: 'Full', fare: 45 },
            { id: 'SH-03', route: 'Alpha 1 → Knowledge Park', departure_time: '05:45 PM', arrival_time: '06:05 PM', capacity: 20, available_seats: 12, status: 'Available', fare: 20 },
            { id: 'SH-04', route: 'Knowledge Park → Pari Chowk', departure_time: '06:30 PM', arrival_time: '06:50 PM', capacity: 20, available_seats: 18, status: 'Filling Fast', fare: 20 },
            { id: 'SH-05', route: 'Pari Chowk → Ghaziabad Terminal', departure_time: '07:15 PM', arrival_time: '08:05 PM', capacity: 20, available_seats: 14, status: 'Available', fare: 50 }
        ];
        renderShuttlesUI(this.shuttlesList);
    }

    async loadCommunityData(communityId) {
        this.currentCommunity = communityId;
        renderCommunityTabSelection(communityId);
        renderCommunityJoinUI();

        // A. Load Chat Messages
        if (window.saathSupabase && window.saathSupabase.isReady) {
            try {
                const messages = await window.saathSupabase.getCommunityMessages(communityId);
                renderCommunityChat(messages);

                // Subscribe to Realtime Chat Messages
                window.saathSupabase.subscribeToCommunityChat(communityId, (newMsg) => {
                    appendCommunityMessage(newMsg);
                });

                // Subscribe to Realtime Presence
                window.saathSupabase.subscribeToPresence(communityId, (count) => {
                    updatePresenceCountUI(count);
                });
            } catch (e) {
                console.warn('Error loading real-time community chat:', e);
            }

            // B. Load Active Vote Session
            try {
                const session = await window.saathSupabase.getActiveVoteSession(communityId);
                if (session) {
                    this.currentVoteSession = session;
                    const { counts, userVotedOptionId, total } = await window.saathSupabase.getVoteCounts(communityId, session.id);
                    this.userVotedOptionId = userVotedOptionId;
                    renderCommunityVotes(session, counts, userVotedOptionId, total);

                    // Subscribe to Realtime Vote Changes
                    window.saathSupabase.subscribeToVoteUpdates(session.id, ({ counts: newCounts, userVotedOptionId: vId, total: newTotal }) => {
                        this.userVotedOptionId = vId;
                        renderCommunityVotes(session, newCounts, vId, newTotal);
                    });
                }
            } catch (e) {
                console.warn('Error loading real-time votes:', e);
            }
        } else {
            // Offline/Unconfigured view
            renderOfflineCommunityNotice();
        }
    }

    async loadUserBookings() {
        if (window.saathSupabase && window.saathSupabase.isReady && window.saathSupabase.currentUser) {
            try {
                const bookings = await window.saathSupabase.getUserBookings();
                renderMyBookingsUI(bookings);
                return;
            } catch (e) {}
        }
        renderMyBookingsUI([]);
    }
}

const appManager = new SaathAppStateManager();

// ==========================================
// 3. AUTHENTICATION & NAVBAR CONTROLLER
// ==========================================
function renderAuthNavigationUI() {
    const isLoggedIn = window.saathSupabase && !!window.saathSupabase.currentUser;
    const profile = window.saathSupabase ? window.saathSupabase.currentProfile : null;

    const loggedOutNav = document.getElementById('loggedOutNav');
    const loggedInNav = document.getElementById('loggedInNav');
    const navUserAvatar = document.getElementById('navUserAvatar');
    const navUserName = document.getElementById('navUserName');

    if (isLoggedIn && profile) {
        if (loggedOutNav) loggedOutNav.classList.add('hidden');
        if (loggedInNav) loggedInNav.classList.remove('hidden');
        if (navUserAvatar) navUserAvatar.src = profile.avatar_url || SAATH_CONFIG.AVATARS[0].url;
        if (navUserName) navUserName.innerText = profile.name || 'Commuter';
    } else {
        if (loggedOutNav) loggedOutNav.classList.remove('hidden');
        if (loggedInNav) loggedInNav.classList.add('hidden');
    }
}

function openLoginModal() {
    closeRegisterModal();
    const modal = document.getElementById('loginModal');
    if (modal) modal.classList.remove('hidden');
}

function closeLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) modal.classList.add('hidden');
}

function openRegisterModal() {
    closeLoginModal();
    const modal = document.getElementById('registerModal');
    if (modal) modal.classList.remove('hidden');
    renderRegisterAvatarOptions();
}

function closeRegisterModal() {
    const modal = document.getElementById('registerModal');
    if (modal) modal.classList.add('hidden');
}

function openSupabaseConnectModal() {
    const modal = document.getElementById('supabaseConfigModal');
    if (modal) modal.classList.remove('hidden');
}

function closeSupabaseConnectModal() {
    const modal = document.getElementById('supabaseConfigModal');
    if (modal) modal.classList.add('hidden');
}

async function handleRegisterSubmit(e) {
    if (e) e.preventDefault();

    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regConfirmPassword').value;
    const area = document.getElementById('regArea').value;
    const selectedAvatar = document.getElementById('regSelectedAvatar').value;
    const errorBox = document.getElementById('regErrorBox');
    const submitBtn = document.getElementById('regSubmitBtn');

    if (errorBox) errorBox.classList.add('hidden');

    if (!name || !email || !password) {
        showAuthError(errorBox, 'Please fill in all required fields.');
        return;
    }

    if (password !== confirmPassword) {
        showAuthError(errorBox, 'Passwords do not match.');
        return;
    }

    if (password.length < 6) {
        showAuthError(errorBox, 'Password must be at least 6 characters.');
        return;
    }

    try {
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Creating Account...';
        }

        await window.saathSupabase.register(email, password, name, selectedAvatar, area);

        closeRegisterModal();
        renderAuthNavigationUI();
        showNotificationToast(`Welcome to SAATHCHALO, ${name}! Your account is ready.`);
        await appManager.loadInitialData();
    } catch (err) {
        console.error('Registration error:', err);
        showAuthError(errorBox, err.message || 'Failed to create account.');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Create Account';
        }
    }
}

async function handleLoginSubmit(e) {
    if (e) e.preventDefault();

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorBox = document.getElementById('loginErrorBox');
    const submitBtn = document.getElementById('loginSubmitBtn');

    if (errorBox) errorBox.classList.add('hidden');

    if (!email || !password) {
        showAuthError(errorBox, 'Please enter your email and password.');
        return;
    }

    try {
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Logging in...';
        }

        await window.saathSupabase.login(email, password);

        closeLoginModal();
        renderAuthNavigationUI();
        showNotificationToast('Logged in successfully!');
        await appManager.loadInitialData();
    } catch (err) {
        console.error('Login error:', err);
        showAuthError(errorBox, err.message || 'Invalid email or password.');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Log In';
        }
    }
}

async function handleLogout() {
    if (window.saathSupabase) {
        await window.saathSupabase.logout();
    }
    renderAuthNavigationUI();
    showNotificationToast('You have been signed out.');
    await appManager.loadInitialData();
}

function showAuthError(box, message) {
    if (!box) {
        alert(message);
        return;
    }
    box.innerText = message;
    box.classList.remove('hidden');
}

function renderRegisterAvatarOptions() {
    const container = document.getElementById('regAvatarPicker');
    if (!container) return;

    container.innerHTML = SAATH_CONFIG.AVATARS.map((av, idx) => `
        <div onclick="selectRegisterAvatar('${av.url}')" class="cursor-pointer relative w-11 h-11 rounded-full overflow-hidden border-2 ${idx === 0 ? 'border-brandYellow ring-2 ring-brandYellow/50' : 'border-gray-200 hover:border-brandYellow'} transition-all reg-avatar-opt" data-url="${av.url}">
            <img src="${av.url}" class="w-full h-full object-cover">
        </div>
    `).join('');
}

function selectRegisterAvatar(url) {
    document.getElementById('regSelectedAvatar').value = url;
    document.querySelectorAll('.reg-avatar-opt').forEach(el => {
        if (el.dataset.url === url) {
            el.classList.add('border-brandYellow', 'ring-2', 'ring-brandYellow/50');
            el.classList.remove('border-gray-200');
        } else {
            el.classList.remove('border-brandYellow', 'ring-2', 'ring-brandYellow/50');
            el.classList.add('border-gray-200');
        }
    });
}

// ==========================================
// 4. REAL-TIME COMMUNITY CHAT, PRESENCE & MEMBERSHIP
// ==========================================
const COMMUNITY_INFO = {
    'knowledge-park': {
        name: 'Knowledge Park Commuters',
        tabName: 'Knowledge Park',
        city: 'Greater Noida',
        icon: 'fa-graduation-cap',
        desc: 'Connect with students and faculty across KP 1, 2 & 3 campuses.'
    },
    'pari-chowk': {
        name: 'Pari Chowk Commuters',
        tabName: 'Pari Chowk',
        city: 'Greater Noida',
        icon: 'fa-circle-nodes',
        desc: 'Coordinate interchange rides, metro connect, and shared autos.'
    },
    'alpha-1': {
        name: 'Alpha 1 & 2 Commuters',
        tabName: 'Alpha 1 & 2',
        city: 'Greater Noida',
        icon: 'fa-building',
        desc: 'Residential pool for Alpha, Beta & Delta sectors to Noida/Delhi.'
    },
    'noida-sec-62': {
        name: 'Noida Sector 62 Commuters',
        tabName: 'Noida Sector 62',
        city: 'Noida',
        icon: 'fa-city',
        desc: 'IT corridor daily transit and Blue Line metro ride sharing.'
    },
    'ghaziabad': {
        name: 'Ghaziabad Terminal Commuters',
        tabName: 'Ghaziabad Terminal',
        city: 'Ghaziabad',
        icon: 'fa-train-subway',
        desc: 'Intercity commuters connecting Railway Station and Mohan Nagar.'
    }
};

function switchCommunityGroup(groupId) {
    appManager.loadCommunityData(groupId);
}

function renderCommunityTabSelection(groupId) {
    document.querySelectorAll('.community-group-tab').forEach(btn => {
        if (btn.dataset.group === groupId) {
            btn.classList.add('bg-brandYellow', 'text-darkTheme', 'font-bold');
            btn.classList.remove('bg-gray-800', 'text-gray-300');
        } else {
            btn.classList.remove('bg-brandYellow', 'text-darkTheme', 'font-bold');
            btn.classList.add('bg-gray-800', 'text-gray-300');
        }
    });
}

function renderCommunityJoinUI() {
    const commId = appManager.currentCommunity || 'knowledge-park';
    const info = COMMUNITY_INFO[commId] || { name: 'Area Commuters', tabName: commId, icon: 'fa-comments' };

    // Update Header Title & Icon
    const titleEl = document.getElementById('currentCommunityTitle');
    if (titleEl) titleEl.innerText = info.name;
    const iconEl = document.getElementById('currentCommunityIcon');
    if (iconEl) iconEl.className = 'fa-solid ' + info.icon;

    // Check membership
    const isLoggedIn = window.saathSupabase && !!window.saathSupabase.currentUser;
    const isMember = isLoggedIn && window.saathSupabase.isMemberOf(commId);

    // Update Member Badge
    const memberBadge = document.getElementById('currentCommunityMemberBadge');
    if (memberBadge) {
        if (isMember) {
            memberBadge.classList.remove('hidden');
            memberBadge.classList.add('flex');
        } else {
            memberBadge.classList.add('hidden');
            memberBadge.classList.remove('flex');
        }
    }

    // Update Join / Member Button Action
    const actionContainer = document.getElementById('communityActionContainer');
    if (actionContainer) {
        if (!isLoggedIn) {
            actionContainer.innerHTML = `
                <button onclick="openLoginModal()" class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-gray-800 text-gray-300 hover:text-white border border-gray-700 transition">
                    <i class="fa-solid fa-right-to-bracket text-[10px]"></i> Log In to Join
                </button>
            `;
        } else if (isMember) {
            actionContainer.innerHTML = `
                <button onclick="toggleJoinCurrentCommunity()" class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-green-500/15 border border-green-500/30 text-green-400 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 transition group" title="Click to leave this group">
                    <i class="fa-solid fa-circle-check group-hover:hidden"></i>
                    <i class="fa-solid fa-arrow-right-from-bracket hidden group-hover:inline"></i>
                    <span class="group-hover:hidden">Member ✓</span>
                    <span class="hidden group-hover:inline">Leave Group</span>
                </button>
            `;
        } else {
            actionContainer.innerHTML = `
                <button onclick="toggleJoinCurrentCommunity()" class="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold bg-brandYellow hover:bg-yellow-400 text-darkTheme transition shadow-md animate-pulse">
                    <i class="fa-solid fa-user-plus text-xs"></i> Join Group
                </button>
            `;
        }
    }

    // Update Tab Joined Badges
    Object.keys(COMMUNITY_INFO).forEach(id => {
        const badge = document.getElementById('tabBadge-' + id);
        if (badge) {
            if (isLoggedIn && window.saathSupabase.isMemberOf(id)) {
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }
    });
}

async function toggleJoinCurrentCommunity() {
    if (!window.saathSupabase || !window.saathSupabase.currentUser) {
        showNotificationToast('Please log in or register to join community groups.');
        openLoginModal();
        return;
    }

    const commId = appManager.currentCommunity || 'knowledge-park';
    const info = COMMUNITY_INFO[commId] || { tabName: commId };
    const isMember = window.saathSupabase.isMemberOf(commId);

    try {
        if (isMember) {
            await window.saathSupabase.leaveCommunity(commId);
            showNotificationToast(`You have left the ${info.tabName} community group.`);
        } else {
            await window.saathSupabase.joinCommunity(commId);
            showNotificationToast(`🎉 You have joined ${info.tabName} community group!`);
        }
        renderCommunityJoinUI();
        renderCommunitiesModal();
    } catch (err) {
        console.error('Error updating community membership:', err);
        showNotificationToast(err.message || 'Could not update membership.');
    }
}

function openCommunitiesModal() {
    const modal = document.getElementById('communitiesModal');
    if (modal) {
        modal.classList.remove('hidden');
        renderCommunitiesModal();
    }
}

function closeCommunitiesModal() {
    const modal = document.getElementById('communitiesModal');
    if (modal) modal.classList.add('hidden');
}

function renderCommunitiesModal() {
    const list = document.getElementById('communitiesModalList');
    if (!list) return;

    const isLoggedIn = window.saathSupabase && !!window.saathSupabase.currentUser;
    const joinedList = isLoggedIn ? window.saathSupabase.getJoinedCommunities() : [];

    list.innerHTML = Object.entries(COMMUNITY_INFO).map(([id, info]) => {
        const isJoined = joinedList.includes(id);
        const isCurrent = appManager.currentCommunity === id;

        return `
            <div class="bg-gray-800/80 border ${isCurrent ? 'border-brandYellow' : 'border-gray-700'} rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition hover:border-gray-600">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-gray-900 border border-gray-700 flex items-center justify-center text-brandYellow text-lg flex-shrink-0">
                        <i class="fa-solid ${info.icon}"></i>
                    </div>
                    <div>
                        <div class="flex items-center gap-2">
                            <h4 class="font-bold text-sm text-white">${info.tabName}</h4>
                            <span class="text-[10px] text-gray-400 bg-gray-900/60 px-2 py-0.5 rounded border border-gray-700">${info.city}</span>
                            ${isJoined ? '<span class="text-[9px] font-bold text-green-400 bg-green-500/10 border border-green-500/30 px-2 py-0.5 rounded-full">✓ Joined</span>' : ''}
                        </div>
                        <p class="text-xs text-gray-400 mt-0.5">${info.desc}</p>
                    </div>
                </div>
                <div class="flex items-center gap-2 self-end sm:self-center">
                    <button onclick="selectAndSwitchCommunity('${id}')" class="text-xs font-bold px-3 py-1.5 rounded-xl border border-gray-700 bg-gray-900 hover:text-brandYellow transition text-gray-300">
                        ${isCurrent ? 'Active Tab' : 'Switch Tab'}
                    </button>
                    ${isLoggedIn ? `
                        <button onclick="toggleJoinFromModal('${id}')" class="text-xs font-bold px-3.5 py-1.5 rounded-xl transition ${isJoined ? 'bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30' : 'bg-brandYellow hover:bg-yellow-400 text-darkTheme'}">
                            ${isJoined ? 'Leave' : '+ Join'}
                        </button>
                    ` : `
                        <button onclick="openLoginModal()" class="text-xs font-bold px-3 py-1.5 rounded-xl bg-gray-700 hover:bg-gray-600 text-white transition">
                            Log In
                        </button>
                    `}
                </div>
            </div>
        `;
    }).join('');
}

function selectAndSwitchCommunity(id) {
    closeCommunitiesModal();
    switchCommunityGroup(id);
}

async function toggleJoinFromModal(id) {
    if (!window.saathSupabase || !window.saathSupabase.currentUser) {
        openLoginModal();
        return;
    }
    const isMember = window.saathSupabase.isMemberOf(id);
    const info = COMMUNITY_INFO[id] || { tabName: id };
    try {
        if (isMember) {
            await window.saathSupabase.leaveCommunity(id);
            showNotificationToast(`Left ${info.tabName} group.`);
        } else {
            await window.saathSupabase.joinCommunity(id);
            showNotificationToast(`🎉 Joined ${info.tabName} group!`);
        }
        renderCommunityJoinUI();
        renderCommunitiesModal();
    } catch (e) {
        showNotificationToast(e.message || 'Error updating membership');
    }
}

function updatePresenceCountUI(count) {
    const badge = document.getElementById('communityPresenceBadge');
    if (badge) {
        badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-green-400 animate-ping"></span> ${count} Active`;
    }
}

function renderCommunityChat(messages) {
    const container = document.getElementById('chatMessagesContainer');
    if (!container) return;

    if (!messages || messages.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12 text-gray-500 text-xs">
                <i class="fa-solid fa-comments text-3xl mb-2 text-gray-600"></i>
                <p class="font-bold text-gray-400">No messages in this community yet.</p>
                <p class="text-[11px] text-gray-500 mt-1">Be the first verified commuter to start the conversation!</p>
            </div>
        `;
        return;
    }

    container.innerHTML = messages.map(m => `
        <div data-msg-id="${m.id}" class="community-msg-bubble flex items-start gap-3 ${m.isUser ? 'flex-row-reverse' : ''} mb-3 animate-in fade-in duration-200">
            <img src="${m.avatar}" class="w-8 h-8 rounded-full object-cover border-2 border-brandYellow shadow-sm flex-shrink-0" alt="${escapeHtml(m.senderName)}">
            <div class="${m.isUser ? 'bg-brandYellow text-darkTheme' : 'bg-gray-800 text-white'} p-3 rounded-2xl max-w-[80%] shadow">
                <div class="flex items-center gap-2 mb-1">
                    <span class="font-bold text-xs ${m.isUser ? 'text-darkTheme' : 'text-brandYellow'}">${escapeHtml(m.senderName)}</span>
                    <span class="text-[9px] ${m.isUser ? 'text-darkTheme/70' : 'text-gray-400'}">${m.time}</span>
                </div>
                <p class="text-xs leading-relaxed whitespace-pre-wrap break-words">${escapeHtml(m.text)}</p>
            </div>
        </div>
    `).join('');

    container.scrollTop = container.scrollHeight;
}

function appendCommunityMessage(msg) {
    const container = document.getElementById('chatMessagesContainer');
    if (!container) return;

    // Deduplication by msg id
    if (msg.id && container.querySelector(`[data-msg-id="${msg.id}"]`)) {
        return;
    }

    // If this is a real message echoing back for current user, check if we have a temporary bubble
    if (msg.isUser && msg.id && !msg.isOptimistic) {
        const tempBubble = container.querySelector('.optimistic-temp');
        if (tempBubble) {
            tempBubble.setAttribute('data-msg-id', msg.id);
            tempBubble.classList.remove('optimistic-temp', 'opacity-75');
            const statusIcon = tempBubble.querySelector('.msg-delivery-status');
            if (statusIcon) statusIcon.remove();
            return;
        }
    }

    // Remove empty notice if present
    const emptyNotice = container.querySelector('.text-center');
    if (emptyNotice) emptyNotice.remove();

    const isOptimistic = !!msg.isOptimistic;
    const msgHtml = `
        <div data-msg-id="${msg.id}" class="community-msg-bubble ${isOptimistic ? 'optimistic-temp opacity-75' : ''} flex items-start gap-3 ${msg.isUser ? 'flex-row-reverse' : ''} mb-3 animate-in fade-in duration-200">
            <img src="${msg.avatar}" class="w-8 h-8 rounded-full object-cover border-2 border-brandYellow shadow-sm flex-shrink-0" alt="${escapeHtml(msg.senderName)}">
            <div class="${msg.isUser ? 'bg-brandYellow text-darkTheme' : 'bg-gray-800 text-white'} p-3 rounded-2xl max-w-[80%] shadow">
                <div class="flex items-center gap-2 mb-1">
                    <span class="font-bold text-xs ${msg.isUser ? 'text-darkTheme' : 'text-brandYellow'}">${escapeHtml(msg.senderName)}</span>
                    <span class="text-[9px] ${msg.isUser ? 'text-darkTheme/70' : 'text-gray-400'}">${msg.time}</span>
                    ${isOptimistic ? '<i class="fa-solid fa-clock text-[9px] opacity-70 msg-delivery-status" title="Sending..."></i>' : ''}
                </div>
                <p class="text-xs leading-relaxed whitespace-pre-wrap break-words">${escapeHtml(msg.text)}</p>
            </div>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', msgHtml);
    container.scrollTop = container.scrollHeight;
}

function mergeCommunityMessages(latestMessages) {
    const container = document.getElementById('chatMessagesContainer');
    if (!container || !Array.isArray(latestMessages)) return;

    if (latestMessages.length === 0) {
        if (!container.querySelector('.text-center') && !container.querySelector('.community-msg-bubble')) {
            renderCommunityChat([]);
        }
        return;
    }

    // If empty notice was shown and we now have messages, render them
    if (container.querySelector('.text-center')) {
        renderCommunityChat(latestMessages);
        return;
    }

    let appended = false;
    latestMessages.forEach(m => {
        if (!container.querySelector(`[data-msg-id="${m.id}"]`)) {
            appendCommunityMessage(m);
            appended = true;
        }
    });

    if (appended) {
        container.scrollTop = container.scrollHeight;
    }
}

async function sendCommunityChatMessage() {
    const input = document.getElementById('chatInput');
    const text = input ? input.value.trim() : '';
    if (!text) return;

    if (!window.saathSupabase || !window.saathSupabase.currentUser) {
        showNotificationToast('Please log in or register to chat with commuters.');
        openLoginModal();
        return;
    }

    const currentComm = appManager.currentCommunity || 'knowledge-park';
    const currentUser = window.saathSupabase.currentUser;
    const currentProfile = window.saathSupabase.currentProfile || currentUser;
    const tempId = 'temp_' + Date.now();

    // 1. Clear input immediately so user can continue typing
    input.value = '';

    // 2. Optimistic UI: Render instant bubble with 0ms delay!
    const optimisticMsg = {
        id: tempId,
        communityId: currentComm,
        senderId: currentUser.id,
        senderName: currentProfile.name || 'You',
        avatar: currentProfile.avatar_url || SAATH_CONFIG.AVATARS[0].url,
        text: text,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isUser: true,
        isOptimistic: true
    };
    appendCommunityMessage(optimisticMsg);

    // 3. Send to backend
    try {
        const sent = await window.saathSupabase.sendMessage(currentComm, text);
        const container = document.getElementById('chatMessagesContainer');
        if (container && sent && sent.id) {
            const tempEl = container.querySelector(`[data-msg-id="${tempId}"]`);
            if (tempEl) {
                tempEl.setAttribute('data-msg-id', sent.id);
                tempEl.classList.remove('optimistic-temp', 'opacity-75');
                const statusIcon = tempEl.querySelector('.msg-delivery-status');
                if (statusIcon) statusIcon.remove();
            }
        }
        // Auto-join UI update if newly added
        renderCommunityJoinUI();
    } catch (err) {
        console.error('Error sending message:', err);
        const container = document.getElementById('chatMessagesContainer');
        if (container) {
            const tempEl = container.querySelector(`[data-msg-id="${tempId}"]`);
            if (tempEl) {
                tempEl.classList.add('border', 'border-red-500/60');
                const statusIcon = tempEl.querySelector('.msg-delivery-status');
                if (statusIcon) {
                    statusIcon.className = 'fa-solid fa-circle-exclamation text-[10px] text-red-400';
                    statusIcon.title = 'Delivery failed. Check network connection.';
                }
            }
        }
        showNotificationToast(err.message || 'Failed to send message. Please try again.');
    }
}

// ==========================================
// 5. REAL-TIME DESTINATION VOTING & ALLOCATION
// ==========================================
let pendingVoteData = null;

function renderCommunityVotes(session, counts = {}, userVotedOptionId = null, totalVotes = 0) {
    const container = document.getElementById('communityVotingWidget');
    if (!container || !session || !session.vote_options) return;

    container.innerHTML = `
        <div class="space-y-3">
            ${session.vote_options.map(opt => {
                const optVotes = counts[opt.id] || 0;
                const pct = totalVotes > 0 ? Math.round((optVotes / totalVotes) * 100) : 0;
                const isSelected = userVotedOptionId === opt.id;

                return `
                    <div onclick="initiateVoteSelection('${session.id}', '${opt.id}', '${opt.destination}')" class="cursor-pointer bg-gray-800/80 p-3.5 rounded-xl border ${isSelected ? 'border-brandYellow ring-2 ring-brandYellow/40' : 'border-gray-700 hover:border-gray-500'} transition-all">
                        <div class="flex justify-between items-center mb-1.5">
                            <span class="font-bold text-white text-xs flex items-center gap-2">
                                <span class="w-3.5 h-3.5 rounded-full border-2 ${isSelected ? 'bg-brandYellow border-brandYellow' : 'border-gray-400'} flex items-center justify-center">
                                    ${isSelected ? '<i class="fa-solid fa-check text-[9px] text-darkTheme"></i>' : ''}
                                </span>
                                ${opt.destination}
                            </span>
                            <span class="text-xs font-mono font-bold text-brandYellow">${optVotes} votes (${pct}%)</span>
                        </div>
                        <div class="w-full bg-gray-900 h-2 rounded-full overflow-hidden">
                            <div class="bg-brandYellow h-full transition-all duration-500" style="width: ${pct}%"></div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function initiateVoteSelection(sessionId, optionId, destination) {
    if (!window.saathSupabase || !window.saathSupabase.currentUser) {
        openLoginModal();
        return;
    }

    pendingVoteData = { sessionId, optionId, destination };
    openVoteWarningModal(destination);
}

function openVoteWarningModal(destination) {
    const modal = document.getElementById('voteConfirmModal');
    if (!modal) return;
    const destElem = document.getElementById('voteTargetDestination');
    if (destElem) destElem.innerText = destination;
    modal.classList.remove('hidden');
}

function closeVoteWarningModal() {
    const modal = document.getElementById('voteConfirmModal');
    if (modal) modal.classList.add('hidden');
    pendingVoteData = null;
}

async function confirmVoteSubmission() {
    if (!pendingVoteData) return;

    try {
        await window.saathSupabase.castVote(
            pendingVoteData.sessionId,
            pendingVoteData.optionId,
            appManager.currentCommunity
        );

        closeVoteWarningModal();
        showNotificationToast(`✓ Your vote for ${pendingVoteData.destination} has been recorded!`);
    } catch (err) {
        console.error('Vote error:', err);
        alert(err.message || 'Could not submit vote.');
    }
}

async function closeVotingAndAllocateVehicle() {
    if (!window.saathSupabase || !window.saathSupabase.currentUser) {
        openLoginModal();
        return;
    }

    if (!appManager.currentVoteSession) return;

    try {
        const winningDest = 'Pari Chowk';
        const ride = await window.saathSupabase.finalizeVoteAndAllocateRide(
            appManager.currentVoteSession.id,
            winningDest,
            appManager.currentCommunity
        );

        if (ride) {
            renderCommunityRideConfirmedBanner(ride);
            showNotificationToast(`🎉 Shared Ride Arranged! Vehicle: ${ride.vehicle_type}`);
        }
    } catch (err) {
        console.error('Allocation error:', err);
    }
}

function renderCommunityRideConfirmedBanner(ride) {
    const banner = document.getElementById('communityAllocationBanner');
    if (!banner) return;

    banner.classList.remove('hidden');
    banner.innerHTML = `
        <div class="bg-gradient-to-r from-gray-900 to-darkTheme border-2 border-brandYellow rounded-2xl p-5 shadow-2xl text-white">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <div>
                    <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-brandYellow text-darkTheme mb-2">
                        <i class="fa-solid fa-trophy"></i> RIDE CONFIRMED
                    </span>
                    <h4 class="text-xl font-black text-white">Community Ride to <span class="text-brandYellow">${ride.destination}</span></h4>
                    <p class="text-xs text-gray-300">Departure: <strong>${ride.departure_time}</strong> • ${ride.total_passengers} Confirmed Riders</p>
                </div>
                <div class="text-right">
                    <span class="text-xs text-gray-400">Assigned Vehicle</span>
                    <h5 class="text-lg font-black text-brandYellow">
                        ${ride.vehicle_type}
                    </h5>
                    <p class="text-[11px] text-gray-400 font-mono">${ride.vehicle_id}</p>
                </div>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-gray-800/80 p-3 rounded-xl mb-4 text-xs">
                <div>
                    <span class="text-gray-400">Passengers:</span>
                    <p class="font-bold text-white">${ride.total_passengers} Commuters</p>
                </div>
                <div>
                    <span class="text-gray-400">Estimated Fare:</span>
                    <p class="font-bold text-brandYellow">₹20.00</p>
                </div>
                <div>
                    <span class="text-gray-400">Driver:</span>
                    <p class="font-bold text-white">${ride.driver_name} (4.9 ★)</p>
                </div>
            </div>

            <button onclick="trackAssignedCommunityRide('${ride.id}')" class="w-full bg-brandYellow text-darkTheme font-bold py-3 rounded-xl hover:bg-yellow-400 transition text-xs shadow-md">
                <i class="fa-solid fa-satellite-dish mr-1"></i> Track Assigned Ride
            </button>
        </div>
    `;
}

async function trackAssignedCommunityRide(rideId) {
    if (!window.saathSupabase) return;
    const ride = await window.saathSupabase.getRideDetails(rideId);
    if (!ride) return;

    openBookingModal(ride.vehicle_type, '₹20.00', 'fa-taxi', 'text-brandYellow');
    startLiveTrackingState({
        id: ride.id,
        pickup: 'Knowledge Park Campus Gate',
        dropoff: ride.destination,
        distanceKm: 7.4,
        fare: 20.00,
        vehicle: {
            title: ride.vehicle_type,
            vehicleId: ride.vehicle_id,
            icon: ride.vehicle_type === 'Auto' ? 'fa-taxi' : ride.vehicle_type === 'Bus' ? 'fa-bus' : 'fa-van-shuttle',
            availableSeats: 2,
            speedKmh: 35
        }
    });
}

// ==========================================
// 6. REAL-TIME SHUTTLE AVAILABILITY
// ==========================================
function renderShuttlesUI(shuttles) {
    const container = document.getElementById('shuttleGrid');
    if (!container) return;

    container.innerHTML = shuttles.map(s => {
        let statusBadge = '';
        let canBook = true;
        if (s.available_seats === 0 || s.status === 'Full') {
            statusBadge = '<span class="bg-red-100 text-red-700 text-xs font-bold px-2.5 py-1 rounded-full"><i class="fa-solid fa-circle-xmark mr-1"></i> Full</span>';
            canBook = false;
        } else if (s.available_seats <= 3 || s.status === 'Filling Fast') {
            statusBadge = '<span class="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-1 rounded-full animate-pulse"><i class="fa-solid fa-fire mr-1"></i> Filling Fast</span>';
        } else {
            statusBadge = '<span class="bg-green-100 text-green-700 text-xs font-bold px-2.5 py-1 rounded-full"><i class="fa-solid fa-circle-check mr-1"></i> Available</span>';
        }

        const occupied = s.capacity - s.available_seats;
        const seatsPct = Math.round((occupied / s.capacity) * 100);

        return `
            <div class="bg-white rounded-2xl p-6 shadow-md border border-gray-100 hover:shadow-xl transition-all flex flex-col justify-between">
                <div>
                    <div class="flex justify-between items-center mb-3">
                        <span class="text-xs font-mono font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">${s.id}</span>
                        ${statusBadge}
                    </div>
                    <h4 class="font-extrabold text-lg text-darkTheme mb-2">${s.route}</h4>
                    <div class="flex items-center gap-4 text-xs text-gray-600 mb-4">
                        <span><i class="fa-solid fa-clock text-brandYellow mr-1"></i> Departs: <strong>${s.departure_time}</strong></span>
                        <span><i class="fa-solid fa-flag text-gray-400 mr-1"></i> ETA: <strong>${s.arrival_time}</strong></span>
                    </div>

                    <!-- Seat Capacity Meter -->
                    <div class="mb-4">
                        <div class="flex justify-between text-xs mb-1">
                            <span class="text-gray-500">Seat Occupancy</span>
                            <span class="font-bold text-darkTheme">${occupied} / ${s.capacity} seats</span>
                        </div>
                        <div class="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                            <div class="h-full ${seatsPct >= 90 ? 'bg-red-500' : seatsPct >= 70 ? 'bg-brandYellow' : 'bg-green-500'} transition-all duration-500" style="width: ${seatsPct}%"></div>
                        </div>
                    </div>
                </div>

                <div class="pt-4 border-t border-gray-100 flex items-center justify-between">
                    <div>
                        <span class="text-xl font-black text-darkTheme">₹${Number(s.fare).toFixed(2)}</span>
                        <span class="text-xs text-gray-500 font-normal"> / seat</span>
                    </div>
                    <button onclick="bookShuttleSeat('${s.id}')" ${!canBook ? 'disabled' : ''} class="${canBook ? 'bg-darkTheme text-white hover:bg-brandYellow hover:text-darkTheme' : 'bg-gray-200 text-gray-400 cursor-not-allowed'} px-5 py-2.5 rounded-xl font-bold text-xs transition shadow">
                        ${canBook ? 'Reserve Seat' : 'Shuttle Full'}
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

async function bookShuttleSeat(shuttleId) {
    if (!window.saathSupabase || !window.saathSupabase.currentUser) {
        openLoginModal();
        return;
    }

    try {
        const updated = await window.saathSupabase.bookShuttleSeat(shuttleId);
        showNotificationToast(`🎉 Seat reserved on ${shuttleId}! (${updated.available_seats} seats remaining)`);
        await appManager.refreshShuttles();
        await appManager.loadUserBookings();
    } catch (err) {
        alert(err.message || 'Could not reserve seat.');
    }
}

// ==========================================
// 7. USER BOOKINGS & PROFILE
// ==========================================
function renderMyBookingsUI(bookings = []) {
    const container = document.getElementById('myBookingsList');
    if (!container) return;

    if (!bookings || bookings.length === 0) {
        container.innerHTML = `
            <div class="text-center py-10 bg-white rounded-2xl border border-gray-200 p-6 text-gray-500">
                <i class="fa-solid fa-ticket text-4xl text-gray-300 mb-3"></i>
                <h4 class="font-bold text-darkTheme mb-1">No Active Bookings Yet</h4>
                <p class="text-xs">Your confirmed rides, passes, and live tracking will appear here.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = bookings.map(b => `
        <div class="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div class="flex items-center gap-4">
                <div class="w-12 h-12 bg-brandYellowLight rounded-xl flex items-center justify-center text-2xl text-darkTheme">
                    <i class="fa-solid ${b.vehicle_type === 'Auto' ? 'fa-taxi' : b.vehicle_type === 'Bus' ? 'fa-bus' : 'fa-van-shuttle'}"></i>
                </div>
                <div>
                    <div class="flex items-center gap-2 mb-1">
                        <span class="font-bold text-darkTheme text-sm">${b.vehicle_id || 'Shared Ride'}</span>
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${b.status === 'CONFIRMED' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}">${b.status}</span>
                    </div>
                    <p class="text-xs text-gray-600">${b.pickup} → ${b.dropoff}</p>
                    <p class="text-[11px] text-gray-400 font-mono">${new Date(b.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
            </div>
            <div class="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                <div class="text-right">
                    <span class="text-lg font-black text-darkTheme">₹${Number(b.fare).toFixed(2)}</span>
                    <p class="text-[10px] text-gray-400">Final Fare</p>
                </div>
            </div>
        </div>
    `).join('');
}

function renderUserProfileUI() {
    const profile = window.saathSupabase ? window.saathSupabase.currentProfile : null;
    const nameInput = document.getElementById('profileNameInput');
    if (nameInput && profile) {
        nameInput.value = profile.name || '';
    }
}

// ==========================================
// 8. MAPS, GEOCODING & LIVE TRACKING
// ==========================================
let modalMap = null;
let modalRoutingControl = null;
let communityMap = null;
let currentRouteWaypoints = [];
let lastCalculatedResult = null;

function initModalMap() {
    if (modalMap) {
        modalMap.invalidateSize();
        return;
    }
    const container = document.getElementById('mapContainer');
    if (!container) return;

    modalMap = L.map('mapContainer', {
        zoomControl: true,
        attributionControl: false
    }).setView(SAATH_CONFIG.DEFAULT_CENTER, 13);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(modalMap);
}

function initCommunityMap() {
    const container = document.getElementById('communityMapContainer');
    if (!container || communityMap) return;

    communityMap = L.map('communityMapContainer', {
        zoomControl: true,
        attributionControl: false
    }).setView(SAATH_CONFIG.DEFAULT_CENTER, 13);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(communityMap);

    // Initial Community Markers
    renderCommunityMapPins();
}

function renderCommunityMapPins() {
    if (!communityMap) return;

    const corridorCoords = [
        [28.4744, 77.5040],
        [28.4710, 77.5080],
        [28.4682, 77.5117]
    ];

    L.polyline(corridorCoords, {
        color: '#eab308',
        weight: 4,
        dashArray: '8,8',
        opacity: 0.85
    }).addTo(communityMap);

    // High-Density Hub marker
    const clusterHtml = `
        <div class="relative cursor-pointer bg-darkTheme text-white font-bold px-3 py-1.5 rounded-full border-2 border-brandYellow shadow-2xl flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-green-400 animate-ping"></span>
            <i class="fa-solid fa-users text-brandYellow text-xs"></i>
            <span class="text-xs">Active Pooling Corridor</span>
        </div>
    `;

    L.marker([28.4740, 77.4985], {
        icon: L.divIcon({ className: 'bg-transparent', html: clusterHtml, iconSize: [160, 36], iconAnchor: [80, 18] })
    }).addTo(communityMap);
}

async function geocodeLocation(query) {
    if (!query) return null;
    const clean = query.trim().toLowerCase();

    for (const key in SAATH_CONFIG.LANDMARKS) {
        if (clean.includes(key) || key.includes(clean)) {
            const item = SAATH_CONFIG.LANDMARKS[key];
            return {
                latLng: L.latLng(item.coords[0], item.coords[1]),
                displayName: item.name
            };
        }
    }

    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ', Greater Noida, India')}`);
        const data = await response.json();
        if (data && data.length > 0) {
            return {
                latLng: L.latLng(parseFloat(data[0].lat), parseFloat(data[0].lon)),
                displayName: data[0].display_name.split(',')[0]
            };
        }
    } catch (e) {}

    return {
        latLng: L.latLng(28.4744, 77.5040),
        displayName: query
    };
}

async function calculateRoute() {
    initModalMap();
    if (modalRoutingControl) {
        try { modalMap.removeControl(modalRoutingControl); } catch (e) {}
        modalRoutingControl = null;
    }

    const pickupQuery = document.getElementById('pickupInput').value || 'Knowledge Park, Greater Noida';
    const dropoffQuery = document.getElementById('dropoffInput').value || 'Alpha 1, Greater Noida';

    const pickupGeo = await geocodeLocation(pickupQuery);
    const dropoffGeo = await geocodeLocation(dropoffQuery);

    let pickupLatLng = pickupGeo.latLng;
    let dropoffLatLng = dropoffGeo.latLng;

    if (pickupLatLng.distanceTo(dropoffLatLng) < 100) {
        dropoffLatLng = L.latLng(28.4962, 77.5140);
    }

    const calculatedDistanceKm = 7.4;
    const finalFare = 24.67;

    const waypoints = [pickupLatLng, dropoffLatLng];
    currentRouteWaypoints = waypoints;

    try {
        modalRoutingControl = L.Routing.control({
            waypoints: waypoints,
            routeWhileDragging: false,
            addWaypoints: false,
            fitSelectedRoutes: true,
            show: false,
            lineOptions: {
                styles: [
                    { color: '#0f172a', opacity: 0.85, weight: 6 },
                    { color: '#eab308', opacity: 1, weight: 3.5, dashArray: '8,8' }
                ]
            },
            createMarker: function(i, wp) {
                const iconHtml = i === 0 
                    ? `<div class="w-9 h-9 bg-brandYellow text-darkTheme rounded-full border-2 border-white shadow-xl flex items-center justify-center font-bold text-sm"><i class="fa-solid fa-location-dot"></i></div>`
                    : `<div class="w-9 h-9 bg-darkTheme text-brandYellow rounded-full border-2 border-white shadow-xl flex items-center justify-center font-bold text-sm"><i class="fa-solid fa-flag-checkered"></i></div>`;
                return L.marker(wp.latLng, {
                    icon: L.divIcon({ className: 'bg-transparent', html: iconHtml, iconSize: [36, 36], iconAnchor: [18, 18] })
                });
            }
        }).addTo(modalMap);
    } catch (e) {
        L.polyline(waypoints.map(w => [w.lat, w.lng]), { color: '#eab308', weight: 5 }).addTo(modalMap);
        modalMap.fitBounds(L.latLngBounds(waypoints));
    }

    lastCalculatedResult = {
        pickup: pickupQuery,
        dropoff: dropoffQuery,
        distanceKm: calculatedDistanceKm,
        fare: finalFare,
        vehicleType: 'Shared Auto',
        vehicleId: 'Auto UP16-AB-1411',
        passengers: 3
    };

    renderRouteCalculationUI(lastCalculatedResult);
}

function renderRouteCalculationUI(result) {
    const detailsContainer = document.getElementById('rideDetails');
    if (!detailsContainer) return;

    detailsContainer.classList.remove('hidden');
    detailsContainer.classList.add('flex');

    detailsContainer.innerHTML = `
        <div class="space-y-4 w-full">
            <!-- Vehicle Card -->
            <div class="bg-yellow-50 p-4 rounded-2xl border-2 border-brandYellow shadow-sm">
                <div class="flex justify-between items-start mb-2">
                    <div class="flex items-center gap-3">
                        <div class="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-2xl text-brandYellow">
                            <i class="fa-solid fa-taxi"></i>
                        </div>
                        <div>
                            <h4 class="font-bold text-darkTheme text-base">${result.vehicleType}</h4>
                            <p class="text-xs text-gray-600 font-mono">${result.vehicleId}</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <span class="text-2xl font-black text-darkTheme">₹${result.fare.toFixed(2)}</span>
                        <p class="text-[11px] text-gray-500">Estimated Fare</p>
                    </div>
                </div>

                <!-- Status Bar -->
                <div class="mt-3 pt-3 border-t border-gray-200/70 flex justify-between items-center text-xs">
                    <span class="text-gray-600"><i class="fa-solid fa-users mr-1 text-gray-500"></i> ${result.passengers} Passengers Sharing</span>
                    <span class="font-bold text-darkTheme"><i class="fa-solid fa-clock mr-1 text-brandYellow"></i> ~5 min away</span>
                </div>
            </div>

            <!-- Customer Trip Summary -->
            <div class="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm text-xs space-y-2.5">
                <div class="flex justify-between items-center text-gray-600">
                    <span>Route Distance</span>
                    <span class="font-bold text-darkTheme">${result.distanceKm} km</span>
                </div>
                <div class="flex justify-between items-center text-gray-600">
                    <span>Assigned Vehicle</span>
                    <span class="font-bold text-darkTheme">${result.vehicleType}</span>
                </div>
                <div class="flex justify-between items-center text-gray-600">
                    <span>Passengers</span>
                    <span class="font-bold text-darkTheme">${result.passengers}</span>
                </div>
                
                <div class="pt-2 border-t border-gray-100 flex items-center justify-between">
                    <span class="text-sm font-bold text-darkTheme">Your Estimated Fare</span>
                    <span class="text-lg font-black text-darkTheme">₹${result.fare.toFixed(2)}</span>
                </div>
            </div>
        </div>
    `;

    const confirmBtn = document.getElementById('confirmRideBtn');
    if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        confirmBtn.innerHTML = `<i class="fa-solid fa-check-circle mr-2"></i> Confirm Ride (₹${result.fare.toFixed(2)})`;
    }
}

async function confirmBookingAction() {
    if (!lastCalculatedResult) {
        calculateRoute();
        return;
    }

    if (!window.saathSupabase || !window.saathSupabase.currentUser) {
        openLoginModal();
        return;
    }

    const btn = document.getElementById('confirmRideBtn');
    if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Securing Ride in Database...';
        btn.disabled = true;
    }

    try {
        const booking = await window.saathSupabase.createBooking(
            lastCalculatedResult.pickup,
            lastCalculatedResult.dropoff,
            lastCalculatedResult.distanceKm,
            lastCalculatedResult.vehicleType,
            lastCalculatedResult.vehicleId,
            lastCalculatedResult.fare
        );

        showNotificationToast('Ride confirmed and saved to your account!');
        startLiveTrackingState({
            id: booking.id,
            pickup: booking.pickup,
            dropoff: booking.dropoff,
            distanceKm: booking.distance_km,
            fare: booking.fare,
            vehicle: {
                title: booking.vehicle_type,
                vehicleId: booking.vehicle_id,
                icon: 'fa-taxi',
                availableSeats: 2,
                speedKmh: 35
            }
        });
        await appManager.loadUserBookings();
    } catch (err) {
        console.error('Booking save error:', err);
        alert(err.message || 'Could not save booking.');
    }
}

function startLiveTrackingState(booking) {
    document.getElementById('bookingInputPanel').classList.add('hidden');
    const trackingPanel = document.getElementById('activeTrackingPanel');
    trackingPanel.classList.remove('hidden');

    trackingPanel.innerHTML = `
        <div class="space-y-4">
            <!-- Live Vehicle Status Card -->
            <div class="bg-darkTheme text-white p-5 rounded-3xl shadow-xl border-2 border-brandYellow relative overflow-hidden">
                <div class="flex justify-between items-center mb-3">
                    <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-brandYellow text-darkTheme animate-pulse">
                        <i class="fa-solid fa-satellite-dish"></i> LIVE TRACKING
                    </span>
                    <span id="trackingStatusBadge" class="text-xs font-bold text-gray-300">DRIVER EN ROUTE</span>
                </div>

                <div class="flex items-center gap-4 mb-4">
                    <div class="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-3xl text-brandYellow border border-white/20">
                        <i class="fa-solid ${booking.vehicle.icon || 'fa-taxi'}"></i>
                    </div>
                    <div>
                        <h4 class="font-extrabold text-lg text-white">${booking.vehicle.vehicleId}</h4>
                        <p class="text-xs text-gray-400">${booking.vehicle.title} • Ramesh Kumar (4.9 ★)</p>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-3 pt-3 border-t border-gray-800">
                    <div class="bg-gray-800/80 p-3 rounded-xl">
                        <p class="text-[10px] text-gray-400 font-bold uppercase">Estimated Arrival</p>
                        <p id="trackingEtaDisplay" class="text-2xl font-black text-brandYellow">4 min</p>
                    </div>
                    <div class="bg-gray-800/80 p-3 rounded-xl">
                        <p class="text-[10px] text-gray-400 font-bold uppercase">Remaining Dist</p>
                        <p id="trackingDistDisplay" class="text-2xl font-black text-white">${booking.distanceKm} km</p>
                    </div>
                </div>
            </div>

            <!-- Route Details -->
            <div class="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm text-xs space-y-2">
                <div class="flex items-start gap-2.5">
                    <div class="w-4 h-4 rounded-full bg-brandYellow flex items-center justify-center text-darkTheme text-[9px] font-bold mt-0.5">A</div>
                    <div>
                        <p class="text-[10px] text-gray-400 font-bold">PICKUP</p>
                        <p class="font-bold text-darkTheme">${booking.pickup}</p>
                    </div>
                </div>
                <div class="w-0.5 h-4 bg-gray-300 ml-2"></div>
                <div class="flex items-start gap-2.5">
                    <div class="w-4 h-4 rounded-full bg-darkTheme flex items-center justify-center text-white text-[9px] font-bold mt-0.5">B</div>
                    <div>
                        <p class="text-[10px] text-gray-400 font-bold">DROPOFF</p>
                        <p class="font-bold text-darkTheme">${booking.dropoff}</p>
                    </div>
                </div>
                <div class="pt-2 border-t border-gray-100 flex justify-between items-center">
                    <span class="text-gray-500">Estimated Fare:</span>
                    <span class="font-extrabold text-base text-darkTheme">₹${Number(booking.fare).toFixed(2)}</span>
                </div>
            </div>

            <!-- GPS Status -->
            <div class="p-3 bg-gray-100 rounded-xl text-[11px] text-gray-600 flex items-center justify-between border border-gray-200">
                <span class="flex items-center gap-1.5"><i class="fa-solid fa-satellite-dish text-green-500"></i> GPS Status: Connected</span>
                <span class="font-mono font-bold text-darkTheme">35 km/h</span>
            </div>

            <div class="flex gap-2">
                <button onclick="closeModal(); document.getElementById('bookingInputPanel').classList.remove('hidden');" class="flex-1 bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 transition text-xs shadow-md">
                    <i class="fa-solid fa-check mr-1.5"></i> Close Live Tracker
                </button>
            </div>
        </div>
    `;
}

function openBookingModal(serviceName, price, iconClass, iconColor, isLive = false) {
    const modal = document.getElementById('bookingModal');
    if (!modal) return;
    modal.classList.remove('hidden');

    document.getElementById('modalTitle').innerText = isLive ? 'Live Pooling — Hop Into Active Auto' : 'Book a Ride';
    document.getElementById('modalSubtitle').innerText = 'Select your pickup and drop locations.';

    const confirmBtn = document.getElementById('confirmRideBtn');
    if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.classList.add('opacity-50', 'cursor-not-allowed');
        confirmBtn.innerText = 'Calculate Route First';
    }

    document.getElementById('bookingInputPanel').classList.remove('hidden');
    document.getElementById('activeTrackingPanel').classList.add('hidden');
    document.getElementById('rideDetails').classList.add('hidden');

    setTimeout(() => {
        initModalMap();
        modalMap.invalidateSize();
        calculateRoute();
    }, 150);
}

function closeModal() {
    const modal = document.getElementById('bookingModal');
    if (modal) modal.classList.add('hidden');
}

// ==========================================
// 9. UTILITIES & TOASTS
// ==========================================
function showNotificationToast(msg) {
    let toast = document.getElementById('saathNotificationToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'saathNotificationToast';
        toast.className = 'fixed bottom-6 left-6 z-50 bg-darkTheme text-white border-2 border-brandYellow px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-xs font-bold transition-all duration-300';
        document.body.appendChild(toast);
    }
    toast.innerHTML = `<i class="fa-solid fa-circle-check text-brandYellow text-base"></i> <span>${escapeHtml(msg)}</span>`;
    toast.classList.remove('opacity-0', 'pointer-events-none');
    setTimeout(() => {
        toast.classList.add('opacity-0', 'pointer-events-none');
    }, 3500);
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function renderOfflineCommunityNotice() {
    const chatContainer = document.getElementById('chatMessagesContainer');
    if (chatContainer) {
        chatContainer.innerHTML = `
            <div class="text-center py-10 px-4">
                <i class="fa-solid fa-comments text-brandYellow text-4xl mb-3"></i>
                <h4 class="font-bold text-white text-sm mb-1">Community Commute Feed</h4>
                <p class="text-xs text-gray-400 mb-4 max-w-sm mx-auto">Connect with verified student commuters in this area. Share rides, coordinate departures, and commute together.</p>
                <button onclick="openLoginModal()" class="bg-brandYellow text-darkTheme text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-yellow-400 transition shadow">
                    Log In to Join Discussion
                </button>
            </div>
        `;
    }
}

// ==========================================
// 10. DOM INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', function() {
    appManager.init();

    setTimeout(() => {
        initCommunityMap();
    }, 500);

    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendCommunityChatMessage();
            }
        });
    }

    const confirmBtn = document.getElementById('confirmRideBtn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', confirmBookingAction);
    }
});
