/**
 * SAATHCHALO — Centralized Vehicle Pricing, Capacity & Fair Fare Engine
 * 
 * CORE ARCHITECTURAL PRINCIPLES:
 * 1. Single source of truth for vehicle types, fuel tiers, capacities, and rates.
 * 2. Fuel Hierarchy: EV (Lowest) <= CNG (Medium) <= PETROL (Higher).
 * 3. Fair Distance-Ratio Fare Model:
 *    - ONE SHARED VEHICLE -> ONE TOTAL VEHICLE FARE (F)
 *    - PASSENGER JOURNEY DISTANCES: d1, d2, ... dn
 *    - RATIO BASE: D = sum(di)
 *    - INDIVIDUAL PASSENGER FARE: fare_i = F * (di / D)
 *    - Deterministic rounding reconciling exactly to sum(fare_i) === F.
 * 4. Customer Pricing Privacy:
 *    - Customers only see: Assigned Vehicle (e.g. "Traveller • EV"), Traffic, ETA, and Estimated Fare.
 *    - Internal formulas, per-km rates, base rates, distance ratios, and thresholds are strictly backend-only.
 */

// 1. Configurable Vehicle Capacities (Section 25 & 41)
const VEHICLE_CAPACITIES = {
    AUTO: 4,
    TRAVELLER: 20,
    BUS: 50
};

// 2. Centralized Vehicle & Fuel Hierarchy Configuration (Sections 26, 28, 29, 30)
// Commercial hierarchy: EV <= CNG <= PETROL
const VEHICLE_FARE_CONFIG = {
    AUTO: {
        EV: {
            baseFare: 15,
            perKm: 8.0,
            label: 'Auto • EV',
            fuelName: 'Electric',
            speedKmh: 35
        },
        CNG: {
            baseFare: 20,
            perKm: 10.0,
            label: 'Auto • CNG',
            fuelName: 'CNG',
            speedKmh: 35
        },
        PETROL: {
            baseFare: 25,
            perKm: 12.0,
            label: 'Auto • Petrol',
            fuelName: 'Petrol',
            speedKmh: 35
        }
    },
    TRAVELLER: {
        EV: {
            baseFare: 25,
            perKm: 5.5,
            label: 'Traveller • EV',
            fuelName: 'Electric',
            speedKmh: 45
        },
        CNG: {
            baseFare: 30,
            perKm: 6.5,
            label: 'Traveller • CNG',
            fuelName: 'CNG',
            speedKmh: 45
        }
    },
    BUS: {
        EV: {
            baseFare: 12,
            perKm: 2.8,
            label: 'Bus • EV',
            fuelName: 'Electric',
            speedKmh: 40
        },
        CNG: {
            baseFare: 15,
            perKm: 3.5,
            label: 'Bus • CNG',
            fuelName: 'CNG',
            speedKmh: 40
        }
    }
};

// 3. Backwards-compatible pricing definitions
const VEHICLE_PRICING = {
    AUTO: {
        id: 'AUTO',
        name: 'Auto',
        displayName: 'Shared Auto',
        capacity: VEHICLE_CAPACITIES.AUTO,
        description: 'Small pooled ride for quick campus & neighborhood hops',
        icon: 'fa-taxi',
        baseFare: VEHICLE_FARE_CONFIG.AUTO.CNG.baseFare,
        perKm: VEHICLE_FARE_CONFIG.AUTO.CNG.perKm,
        speedKmh: 35,
        defaultSharingCount: 3
    },
    TRAVELLER: {
        id: 'TRAVELLER',
        name: 'Traveller/Shuttle',
        displayName: 'Shared Traveller / Shuttle Van',
        capacity: VEHICLE_CAPACITIES.TRAVELLER,
        description: 'Medium shared commuter van with air-conditioning & guaranteed seating',
        icon: 'fa-van-shuttle',
        baseFare: VEHICLE_FARE_CONFIG.TRAVELLER.CNG.baseFare,
        perKm: VEHICLE_FARE_CONFIG.TRAVELLER.CNG.perKm,
        speedKmh: 45,
        defaultSharingCount: 12
    },
    BUS: {
        id: 'BUS',
        name: 'Bus',
        displayName: 'Campus & Transit Express Bus',
        capacity: VEHICLE_CAPACITIES.BUS,
        description: 'High-capacity inter-hub express pooling between major stations',
        icon: 'fa-bus',
        baseFare: VEHICLE_FARE_CONFIG.BUS.CNG.baseFare,
        perKm: VEHICLE_FARE_CONFIG.BUS.CNG.perKm,
        speedKmh: 40,
        defaultSharingCount: 30
    }
};

/**
 * Calculates the total vehicle fare for a given trip
 * @param {string} vehicleType - 'AUTO', 'TRAVELLER', or 'BUS'
 * @param {string} fuelType - 'EV', 'CNG', or 'PETROL'
 * @param {number} distanceKm - Total trip corridor distance in km
 * @returns {number} Total vehicle trip cost F
 */
function calculateTotalVehicleFare(vehicleType, fuelType = 'CNG', distanceKm = 7.4) {
    const vKey = (vehicleType || 'AUTO').toUpperCase().includes('BUS') ? 'BUS'
               : (vehicleType || '').toUpperCase().includes('TRAVELL') || (vehicleType || '').toUpperCase().includes('SHUTTLE') ? 'TRAVELLER'
               : 'AUTO';
    
    const fKey = (fuelType || 'CNG').toUpperCase();
    const group = VEHICLE_FARE_CONFIG[vKey] || VEHICLE_FARE_CONFIG.AUTO;
    const config = group[fKey] || group.CNG || Object.values(group)[0];
    const dist = Math.max(1.0, parseFloat(distanceKm) || 1.0);

    const totalFare = config.baseFare + (config.perKm * dist);
    return Math.round(totalFare * 100) / 100;
}

/**
 * FAIR FARE ENGINE — Section 32, 33, 34, 35, 36, 37
 * Distributes total vehicle fare F proportionally based on each passenger's journey distance.
 * 
 * Formula:
 * D = sum(di)
 * fare_i = F * (di / D)
 * Deterministic rounding reconciliation ensures sum(fare_i) === F.
 * 
 * @param {number} totalVehicleFare - F (e.g. ₹100)
 * @param {Array<{id: string, distanceKm: number}>} passengers - List of passengers with their journey distance
 * @returns {Array<{id: string, distanceKm: number, fare: number}>}
 */
function calculateSharedFare(totalVehicleFare, passengers) {
    if (!Array.isArray(passengers) || passengers.length === 0) {
        return [];
    }

    const F = Math.round((parseFloat(totalVehicleFare) || 0) * 100) / 100;

    if (passengers.length === 1) {
        return [{
            ...passengers[0],
            fare: F
        }];
    }

    const totalD = passengers.reduce((sum, p) => sum + (parseFloat(p.distanceKm || p.distance || 1.0)), 0);

    if (totalD <= 0) {
        const equalSplit = Math.round((F / passengers.length) * 100) / 100;
        return passengers.map(p => ({ ...p, fare: equalSplit }));
    }

    let allocatedSum = 0;
    const results = passengers.map(p => {
        const d = parseFloat(p.distanceKm || p.distance || 1.0);
        const rawFare = F * (d / totalD);
        const roundedFare = Math.round(rawFare * 100) / 100;
        allocatedSum += roundedFare;
        return {
            ...p,
            rawFare,
            fare: roundedFare
        };
    });

    // Reconcile deterministic rounding so sum(fares) === F precisely
    allocatedSum = Math.round(allocatedSum * 100) / 100;
    const diff = Math.round((F - allocatedSum) * 100) / 100;

    if (diff !== 0) {
        // Adjust the passenger with the largest journey distance
        let maxIdx = 0;
        let maxDist = -1;
        for (let i = 0; i < passengers.length; i++) {
            const dist = parseFloat(passengers[i].distanceKm || passengers[i].distance || 1.0);
            if (dist > maxDist) {
                maxDist = dist;
                maxIdx = i;
            }
        }
        results[maxIdx].fare = Math.round((results[maxIdx].fare + diff) * 100) / 100;
    }

    return results;
}

/**
 * Standard customer-facing fare calculation with backward compatibility
 */
function calculateVehicleFare(vehicleType, distanceKm, passengersSharing, fuelType = 'CNG') {
    const totalFare = calculateTotalVehicleFare(vehicleType, fuelType, distanceKm);
    const riders = Math.max(1, parseInt(passengersSharing) || 1);
    const split = totalFare / riders;
    return Math.max(10.00, parseFloat(split.toFixed(2)));
}

/**
 * Allocates vehicle and fuel tier based on participant count & user fuel preferences (Sections 40, 41, 42, 43, 94)
 * 1–4 -> AUTO (Capacity 4)
 * 5–20 -> TRAVELLER (Capacity 20)
 * 21–50 -> BUS (Capacity 50)
 */
function allocateVehicleForCount(totalRiders, preferredFuel = null) {
    const count = Math.max(1, parseInt(totalRiders) || 1);
    let vType = 'AUTO';
    let platePrefix = 'UP16-AT-';
    let icon = 'fa-taxi';
    let displayName = 'Shared Auto';

    if (count > VEHICLE_CAPACITIES.TRAVELLER) {
        vType = 'BUS';
        platePrefix = 'UP16-BS-';
        icon = 'fa-bus';
        displayName = 'Campus Transit Express Bus';
    } else if (count > VEHICLE_CAPACITIES.AUTO) {
        vType = 'TRAVELLER';
        platePrefix = 'UP16-SH-';
        icon = 'fa-van-shuttle';
        displayName = 'Shared Traveller / Shuttle Van';
    }

    const availableFuels = Object.keys(VEHICLE_FARE_CONFIG[vType] || {});
    let selectedFuel = 'CNG';

    if (preferredFuel && availableFuels.includes(preferredFuel.toUpperCase())) {
        selectedFuel = preferredFuel.toUpperCase();
    } else if (availableFuels.includes('EV')) {
        selectedFuel = 'EV'; // Default to cleanest & lowest cost tier
    } else if (availableFuels.includes('CNG')) {
        selectedFuel = 'CNG';
    } else {
        selectedFuel = availableFuels[0];
    }

    const capacity = VEHICLE_CAPACITIES[vType];
    const fuelConfig = VEHICLE_FARE_CONFIG[vType][selectedFuel];
    const title = vType === 'AUTO' ? 'Auto' : (vType === 'TRAVELLER' ? 'Traveller' : 'Bus');

    return {
        type: vType,
        vehicleType: title,
        fuelType: selectedFuel,
        displayName: displayName,
        label: `${title} • ${selectedFuel}`,
        capacity: capacity,
        icon: icon,
        platePrefix: platePrefix,
        baseFare: fuelConfig.baseFare,
        perKm: fuelConfig.perKm,
        speedKmh: fuelConfig.speedKmh
    };
}

/**
 * Format fare for customer-facing display in whole rupees (Prompt #23)
 * @param {number} fare 
 * @returns {string} e.g. "₹25"
 */
function formatCustomerFare(fare) {
    return '₹' + Math.round(Number(fare) || 0);
}

// Universal export (Node.js & Browser)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        VEHICLE_CAPACITIES,
        VEHICLE_FARE_CONFIG,
        VEHICLE_PRICING,
        calculateTotalVehicleFare,
        calculateSharedFare,
        calculateVehicleFare,
        allocateVehicleForCount,
        formatCustomerFare
    };
}
if (typeof window !== 'undefined') {
    window.VEHICLE_CAPACITIES = VEHICLE_CAPACITIES;
    window.VEHICLE_FARE_CONFIG = VEHICLE_FARE_CONFIG;
    window.VEHICLE_PRICING = VEHICLE_PRICING;
    window.calculateTotalVehicleFare = calculateTotalVehicleFare;
    window.calculateSharedFare = calculateSharedFare;
    window.calculateVehicleFare = calculateVehicleFare;
    window.allocateVehicleForCount = allocateVehicleForCount;
    window.formatCustomerFare = formatCustomerFare;
}
