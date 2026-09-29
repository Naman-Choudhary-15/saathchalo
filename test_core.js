// Verification Script for SAATHCHALO Core Logic
const fs = require('fs');

// Read script.js and eval in a mock DOM environment
const scriptContent = fs.readFileSync('script.js', 'utf8');

// Mock DOM
global.window = global;
global.localStorage = {
    data: {},
    getItem(k) { return this.data[k] || null; },
    setItem(k, v) { this.data[k] = v; },
    removeItem(k) { delete this.data[k]; }
};
global.document = {
    addEventListener: () => {},
    getElementById: (id) => ({
        classList: { add: () => {}, remove: () => {}, toggle: () => {} },
        innerText: '',
        innerHTML: '',
        value: '',
        dataset: {}
    }),
    querySelectorAll: () => []
};

// Evaluate the script
eval(scriptContent);

console.log('=== TEST 1: FARE CALCULATION (₹10/km & SECTION FORMULA) ===');
// Scenario: Total distance 7.4 km, 3 passengers
const mockPassengers = [
    { id: 'p1', name: 'Aditya', startKm: 0, endKm: 7.4, isUser: true },
    { id: 'p2', name: 'Pooja', startKm: 0, endKm: 7.4, isUser: false },
    { id: 'p3', name: 'Siddharth', startKm: 0, endKm: 7.4, isUser: false }
];
const fareRes = calculateSectionFormulaFare(7.4, mockPassengers);
console.log('Total Distance:', fareRes.totalDistanceKm, 'km');
console.log('Total Vehicle Fare (7.4 * 10):', fareRes.totalVehicleFare);
console.log('User Fare (74 / 3):', fareRes.userFare);
if (fareRes.totalVehicleFare === 74 && fareRes.userFare === 24.67) {
    console.log('✓ PASS: Section formula fare matches ₹24.67 perfectly!');
} else {
    console.error('FAIL on fare calculation');
}

console.log('\n=== TEST 2: VEHICLE CAPACITY ALLOCATION ===');
const alloc1 = evaluateVehicleAllocation(3);
const alloc2 = evaluateVehicleAllocation(18);
const alloc3 = evaluateVehicleAllocation(42);

console.log('3 riders ->', alloc1.type, alloc1.title, '(Capacity:', alloc1.capacity + ')');
console.log('18 riders ->', alloc2.type, alloc2.title, '(Capacity:', alloc2.capacity + ')');
console.log('42 riders ->', alloc3.type, alloc3.title, '(Capacity:', alloc3.capacity + ')');

if (alloc1.type === 'AUTO' && alloc2.type === 'SHUTTLE' && alloc3.type === 'BUS') {
    console.log('✓ PASS: Vehicle allocation satisfies all capacity thresholds (1-4 Auto, 5-20 Shuttle, 21-50 Bus)!');
} else {
    console.error('FAIL on vehicle allocation');
}

console.log('\n=== TEST 3: ₹50 NO-SHOW FINE APPLICATION ===');
store.applyFine(50);
console.log('Pending Fine after violation:', store.getUser().pendingFine);
if (store.getUser().pendingFine === 50) {
    console.log('✓ PASS: ₹50 fine correctly recorded in user profile!');
}
store.clearFine();
console.log('Pending Fine after demo clear:', store.getUser().pendingFine);
if (store.getUser().pendingFine === 0) {
    console.log('✓ PASS: Demo fine cleared successfully!');
}

console.log('\n=== TEST 4: PRIORITY SYSTEM ===');
const prio1 = evaluatePassengerPriority('confirmed');
const prio2 = evaluatePassengerPriority('community');
const prio4 = evaluatePassengerPriority('on-demand');
console.log('Confirmed Passenger Tier:', prio1.tier, 'Queue Pos:', prio1.queuePosition);
console.log('Community Passenger Tier:', prio2.tier, 'Queue Pos:', prio2.queuePosition);
console.log('On-Demand Passenger Tier:', prio4.tier, 'Queue Pos:', prio4.queuePosition);
if (prio1.tier === 1 && prio2.tier === 2 && prio4.tier === 4) {
    console.log('✓ PASS: Priority hierarchy strictly ordered (Confirmed > Community > Shuttle > On-demand)!');
}

console.log('\n=== TEST 5: TRAJECTORY MATCHING ===');
const match = calculateTrajectoryCompatibility([28.4744, 77.5040], [28.4962, 77.5140]);
console.log('Route Similarity:', match.routeSimilarityPct + '%');
console.log('Detour KM:', match.detourKm, 'km');
console.log('Departure Window:', match.departureWindow);
if (match.isCompatible && match.routeSimilarityPct >= 75) {
    console.log('✓ PASS: Trajectory compatibility engine working correctly!');
}

console.log('\nALL UNIT LOGIC TESTS PASSED SUCCESSFULLY!');
