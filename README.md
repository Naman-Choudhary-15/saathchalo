# SAATHCHALO 🛺
> **What if Empty Seats could become Affordable Rides?**  
> *Ek Raah, Kai Manzilein | Smarter • Safer • Shared Commutes*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-brightgreen.svg)](https://nodejs.org/)
[![Build: Production](https://img.shields.io/badge/Build-Production--Ready-success.svg)](https://github.com/Naman-Choudhary-15/saathchalo)
[![Tests: Passing](https://img.shields.io/badge/Tests-20%2F20%20Passing-brightgreen.svg)](./verify_20_points.js)

**SAATHCHALO** is an intelligent, real-time shared mobility and transit platform engineered for university students, campus corridors, and daily commuters. It pools commuters traveling along compatible corridors into single shared vehicles (Auto, Traveller, Bus), allocates vehicle types dynamically based on live rider demand and fuel tier preferences (EV, CNG, Petrol), calculates mathematically fair fares based on individual journey distance ratios, and provides live bidirectional synchronization between riders and drivers.

---

## 🌐 Live Public Portals

Access the production deployment of SAATHCHALO directly in your browser:

| Portal | Public Web Link | Description |
|---|---|---|
| 📱 **Customer & Commuter Portal** | [**Open Customer Portal**](https://naman-choudhary-15.github.io/saathchalo/) | Real-time ride booking, corridor pooling, live social mobility map, fare estimation, community hub chats, and ride tracking. |
| 🚖 **Driver & Partner Portal** | [**Open Driver Portal**](https://naman-choudhary-15.github.io/saathchalo/driver.html) | Live ride requests feed, instant ride acceptance, turn-by-turn Google Maps navigation, passenger boarding & attendance check-in, secure PIN verification, and automatic ride reset. |

> 🔗 **Direct URLs:**
> - **Customer Portal:** `https://naman-choudhary-15.github.io/saathchalo/`
> - **Driver Portal:** `https://naman-choudhary-15.github.io/saathchalo/driver.html`

---

## 🌟 Key Capabilities & Product Features

### 1. 🧮 Fair Distance-Ratio Fare Engine
- **Mathematical Formula:**  
  $$\text{fare}_i = F \times \frac{d_i}{D}$$  
  where $F$ is the total vehicle fare, $d_i$ is passenger $i$'s journey distance, and $D = \sum d_k$ is the sum of all passenger distances.
- **Strict Fare Conservation:** $\sum \text{fare}_i = F$ guaranteed through deterministic 2-decimal currency rounding reconciliation.
- **Pricing Privacy:** Commuters see only their fair individual fare (e.g. `₹30`); internal formulas, distance ratios, and cost markups remain strictly server-side.
- **Commercial Fuel Hierarchy:** Configured centralized pricing in [`pricing.config.js`](./pricing.config.js) enforces `EV ≤ CNG ≤ Petrol`.

### 2. 🚐 Corridor Pooling & Dynamic Vehicle Allocation
- **Dynamic Capacity Tiers:**
  - **1 – 4 Riders:** **Auto** (Capacity: 4)
  - **5 – 20 Riders:** **Traveller / Shuttle** (Capacity: 20)
  - **21 – 50 Riders:** **Transit Bus** (Capacity: 50)
- **One Shared Ride = One Shared Vehicle:** All pooled commuters share the exact same `ride_id`, `vehicle_id`, and vehicle type label (e.g. `Traveller • EV`).
- **Fuel Preference Support:** Commuters can choose EV, CNG, Petrol, or No Preference during booking.

### 3. 🚖 Real-Time Driver Operations & Multi-Client Sync
- **Instant Booking Broadcast:** When a customer books a ride, the driver portal receives the new booking in real time via Server-Sent Events (SSE) without manual refresh.
- **Driver Action Workflow:** Accept Ride → Navigate to Pickup via Google Maps → Mark Arrived → Board Passengers → Drop-off & Enter Secure PIN → Complete Ride.
- **Real Dynamic Accounts:** Real customer names, pickup/drop locations, and individual fares are displayed directly on the driver console.
- **Automatic State Reset:** Completing a ride automatically clears the driver's active state and seamlessly opens up availability for the next ride assignment.

### 4. 🗺️ Social Mobility Map & Live Traffic Routing
- **Device Geolocation:** Detects commuter's real-time device location (`YOU` pin) with graceful fallback handling.
- **Opt-In Location Privacy:** Strict separation between active online status and map visibility; commuters can toggle visibility anytime.
- **Traffic-Aware Polylines:** Dynamic color-coded routes reflecting live road conditions (Blue: Normal, Yellow: Moderate, Red: Congested).
- **Accurate ETAs:** Traffic-calibrated arrival estimations.

### 5. 👥 Strict Canonical User Accounting ($R = A + O$)
- **One Person = One Permanent Account:** Canonical persistent identity rooted in `usr_<hex>`.
- **Zero Synthetic Counts:** Complete removal of fake offsets and demo counters.
- **Mathematical Identity:** Registered Members = Active Now + Offline Members ($R = A + O$) enforced at database level.
- **Multi-Session Deduplication:** Multiple open tabs or devices for the same user count as exactly 1 member.

### 6. 🗳️ Real-Time Community Hubs & Destination Polls
- **5 High-Frequency Regional Hubs:** Knowledge Park, Pari Chowk, Alpha 1 & 2, Noida Sector 62, Ghaziabad Terminal.
- **Real-Time Group Chat:** Instant multi-device messaging with user-generated content (UGC) reporting & moderation.
- **One Person = One Vote:** Server-enforced idempotent voting with pre-vote reliability & reward policy notice and persistent personal vote state ("✓ You voted").

### 7. 🛡️ User Privacy & Account Management
- **In-App Account Deletion:** Permanent account deletion (`DELETE /api/auth/account`) satisfying Google Play Store requirements.
- **Privacy Policy & Community Guidelines:** In-app modals detailing data protection, encryption, and geolocation usage.

---

## 🛠️ Technology Stack

| Layer | Technology / Framework |
|---|---|
| **Frontend** | Semantic HTML5, Vanilla JavaScript (ES6+), Vanilla CSS (SAATHCHALO Dark Navy / Gold Brand Identity) |
| **Typography & Icons** | Google Fonts (*Outfit*, *Plus Jakarta Sans*), Font Awesome 6 Pro |
| **Mapping Engine** | Leaflet.js, Google Maps Platform (Maps JS API, Routes API, TrafficLayer) |
| **Realtime Engine** | Server-Sent Events (SSE) with bidirectional event streams & smart reconnection |
| **Backend Service** | Node.js High-Performance HTTP Server (`serve.js`) |
| **Persistence** | Embedded Atomic Persistent Database Engine (`saath-db.json`) |
| **Cloud Database** | Supabase (PostgreSQL with RLS, Auth, Realtime) via `supabase-schema.sql` |
| **Mobile Packaging** | Capacitor (`@capacitor/core`, `@capacitor/android`, `capacitor.config.json`) |

---

## 🚀 Getting Started

### 1. Install & Run Locally
```bash
git clone https://github.com/Naman-Choudhary-15/saathchalo.git
cd saathchalo
npm start
```
Open [http://localhost:8085](http://localhost:8085) for Customer View or [http://localhost:8085/driver.html](http://localhost:8085/driver.html) for Driver View.

### 2. Run Verification Test Suite
```bash
# Run the 20-point end-to-end integration suite
node verify_20_points.js

# Or run the master acceptance suite
npm test
```

The verification suite validates:
- Real-time SSE multi-client synchronization between customer and driver.
- Distance-ratio fair fare calculations and 2-decimal conservation.
- Vehicle allocation thresholds (Auto 4, Traveller 20, Bus 50) and fuel tier ranking.
- System health check & persistent atomic database integrity.
- Strict $R = A + O$ canonical member accounting.
- Idempotent one person = one vote community polling.
- Driver workflow (accept, arrive, board, PIN completion, state reset).
- Account deletion and UGC moderation compliance.

---

## 📚 Deployment Documentation

- 📱 [**Google Play Store Deployment Guide**](./PLAYSTORE_DEPLOYMENT.md): Step-by-step instructions for Android packaging, signing keystores, target SDK 34/35, and Play Console submission.
- 🌐 [**Production Deployment & Operations Guide**](./PRODUCTION_DEPLOYMENT.md): High-availability setup, zero-downtime updates with PM2, Nginx reverse proxy configuration, and automated backups.
- 🗄️ [**Database Migration & Schema Guide**](./DATABASE_MIGRATION.md): Additive schema migrations, entity specifications, and Supabase PostgreSQL replication.

---

## 📄 License
MIT License. Developed with ❤️ by the SAATHCHALO Engineering Team.
