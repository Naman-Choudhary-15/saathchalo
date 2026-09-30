/**
 * SAATHCHALO — Centralized Reward & Reliability System Configuration
 * 
 * CORE POLICY:
 * - NO monetary fines or ₹50 penalties.
 * - Confirmed community ride violation: -5 Reward Points.
 * - Voting alone, non-winning vote, valid check-in, valid cancellation, or system cancellation: 0 point change.
 * - Idempotent point deduction: exactly once per ride.
 * - Backend authoritative state with auditable transaction ledger.
 */

const REWARD_CONFIG = {
    // Configurable initial baseline points for new and existing users
    INITIAL_REWARD_POINTS: 100,

    // Points deducted for failing to attend a confirmed community ride (idempotent, once per ride)
    NO_SHOW_REWARD_PENALTY: 5,

    // Configurable point floor (recommended default: 0)
    MIN_REWARD_POINTS: 0,

    // Configurable cancellation cutoff in minutes prior to ride departure
    CANCELLATION_CUTOFF_MINUTES: 30,

    // Allowed attendance states
    ATTENDANCE_STATES: {
        NOT_REQUIRED: 'NOT_REQUIRED',
        COMMITTED: 'COMMITTED',
        CHECK_IN_OPEN: 'CHECK_IN_OPEN',
        PRESENT: 'PRESENT',
        ABSENT: 'ABSENT',
        CANCELLED: 'CANCELLED',
        EXEMPT: 'EXEMPT'
    },

    // Configurable reward tiers (placeholders for future offer system)
    REWARD_TIERS: [
        {
            id: 'TIER_STANDARD',
            name: 'Good Standing',
            minPoints: 80,
            badge: 'Good standing',
            benefits: []
        },
        {
            id: 'TIER_SILVER',
            name: 'Reliable Commuter',
            minPoints: 100,
            badge: 'Reliable',
            benefits: []
        },
        {
            id: 'TIER_GOLD',
            name: 'Community Champion',
            minPoints: 150,
            badge: 'Champion',
            benefits: []
        }
    ]
};

/**
 * Offer Engine: Evaluates user's eligible benefits based on reward points.
 * Stays separate from booking & fare engines.
 * Returns empty array or configured placeholder benefits (no fake offers).
 */
function getRewardBenefits(userOrPoints) {
    const points = typeof userOrPoints === 'number' 
        ? userOrPoints 
        : (userOrPoints?.reward_points ?? REWARD_CONFIG.INITIAL_REWARD_POINTS);
    
    // Future offer engine hooks:
    // Active offer rules will be configured here when finalized.
    // At this stage, returns empty set to avoid inventing unagreed offers.
    return [];
}

/**
 * Reward Status Helper: Returns neutral standing label (e.g. "Good standing")
 */
function getRewardStatus(userOrPoints) {
    const points = typeof userOrPoints === 'number'
        ? userOrPoints
        : (userOrPoints?.reward_points ?? REWARD_CONFIG.INITIAL_REWARD_POINTS);
    
    if (points >= 90) return 'Good standing';
    if (points >= 70) return 'Fair standing';
    return 'Needs improvement';
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        REWARD_CONFIG,
        INITIAL_REWARD_POINTS: REWARD_CONFIG.INITIAL_REWARD_POINTS,
        NO_SHOW_REWARD_PENALTY: REWARD_CONFIG.NO_SHOW_REWARD_PENALTY,
        MIN_REWARD_POINTS: REWARD_CONFIG.MIN_REWARD_POINTS,
        CANCELLATION_CUTOFF_MINUTES: REWARD_CONFIG.CANCELLATION_CUTOFF_MINUTES,
        ATTENDANCE_STATES: REWARD_CONFIG.ATTENDANCE_STATES,
        REWARD_TIERS: REWARD_CONFIG.REWARD_TIERS,
        getRewardBenefits,
        getRewardStatus
    };
}

if (typeof window !== 'undefined') {
    window.REWARD_CONFIG = REWARD_CONFIG;
    window.INITIAL_REWARD_POINTS = REWARD_CONFIG.INITIAL_REWARD_POINTS;
    window.NO_SHOW_REWARD_PENALTY = REWARD_CONFIG.NO_SHOW_REWARD_PENALTY;
    window.MIN_REWARD_POINTS = REWARD_CONFIG.MIN_REWARD_POINTS;
    window.CANCELLATION_CUTOFF_MINUTES = REWARD_CONFIG.CANCELLATION_CUTOFF_MINUTES;
    window.ATTENDANCE_STATES = REWARD_CONFIG.ATTENDANCE_STATES;
    window.REWARD_TIERS = REWARD_CONFIG.REWARD_TIERS;
    window.getRewardBenefits = getRewardBenefits;
    window.getRewardStatus = getRewardStatus;
}
