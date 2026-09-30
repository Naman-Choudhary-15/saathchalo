# SAATHCHALO 🛺
> **What if Empty Seats could become Affordable Rides?**  
> *Ek Raah, Kai Manzilein | Smarter • Safer • Shared Commutes*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-brightgreen.svg)](https://nodejs.org/)
[![Build: RC](https://img.shields.io/badge/Release%20Candidate-v2.4.0--rc-success.svg)](https://github.com/Naman-Choudhary-15/saathchalo)
[![Tests: 15/15 Passed](https://img.shields.io/badge/Tests-15%2F15%20Passing-brightgreen.svg)](./scripts/test_master_finalization.js)

**SAATHCHALO** is a production-grade, real-time shared mobility and transit platform engineered for university students and daily commuters. It pools commuters traveling along compatible corridors into single shared vehicles (Auto, Traveller, Bus), allocates vehicles dynamically based on real rider count and fuel tier preferences (EV, CNG, Petrol), calculates mathematically fair fares based on individual journey distance ratios, and provides live traffic-aware routing.

---

## 🌟 Key Capabilities & Product Features

### 1. 🧮 Fair Distance-Ratio Fare Engine
- **Formula:** $F \times \frac{d_i}{D} = \text{fare}_i$ where $F$ is the total vehicle fare, $d_i$ is passenger $i$'s journey distance, and $D = \sum d_k$ is the sum of all passenger distances.
- **Strict Conservation:** $\sum \text{fare}_i = F$ guaranteed through deterministic 2-decimal currency rounding reconciliation.
- **Pricing Privacy:** Commuters see only their individual calculated fare (e.g. `₹30`); internal formulas, distance ratios, and cost markups remain strictly server-side.
- **Commercial Fuel Hierarchy:** Configured centralized pricing in [`pricing.config.js`](./pricing.config.js) enforces `EV ≤ CNG ≤ Petrol`.

### 2. 🚐 Corridor Pooling & Vehicle Allocation
- **Dynamic Vehicle Tiers:**
  - 1 – 4 Riders → **Auto** (Capacity: 4)
  - 5 – 20 Riders → **Traveller / Shuttle** (Capacity: 20)
  - 21 – 50 Riders → **Transit Bus** (Capacity: 50)
- **One Shared Ride = One Shared Vehicle:** All pooled commuters share the exact same `ride_id`, `vehicle_id`, and vehicle type label (e.g. `Traveller • EV`).
- **Fuel Preference Support:** Commuters can request EV, CNG, Petrol, or No Preference during booking.

### 3. 🗺️ Social Mobility Map & Live Traffic Routing
- **Device Geolocation:** Detects commuter's real-time device location (`YOU` pin) with graceful permission fallbacks.
- **Opt-In Location Privacy:** Strict separation between active online status and map visibility; commuters can toggle visibility anytime.
- **Google Maps Traffic-Aware Routing:** Multi-colored route polylines reflecting real-time traffic conditions:
  - 🟦 **Blue:** Normal / Low Traffic
  - 🟨 **Yellow:** Slow / Moderate Traffic
  - 🟥 **Red:** Traffic Jam / Congestion
- **Traffic-Aware ETA:** Dynamic ETAs based on real live road conditions.

### 4. 👥 Strict Canonical User Accounting ($R = A + O$)
- **One Person = One Permanent Account:** User identity rooted in canonical `usr_<hex>`.
- **Zero Synthetic Counts:** Complete removal of fake offsets (`+14`, `+16`) and demo counters.
- **Mathematical Identity:** Registered Members = Active Now + Offline Members ($R = A + O$) enforced at the database level.
- **Multi-Session Deduplication:** Multiple open tabs or devices for the same user count as exactly 1 person.

### 5. 🗳️ Real-Time Community Hubs & Destination Polls
- **5 High-Frequency Regional Hubs:** Knowledge Park, Pari Chowk, Alpha 1 & 2, Noida Sector 62, Ghaziabad Terminal.
- **Real-Time Group Chat:** Instant multi-device messaging with user-generated content (UGC) reporting & moderation.
- **One Person = One Vote:** Server-enforced idempotent voting with pre-vote ₹50 cancellation policy notice and persistent personal vote state ("✓ You voted").

### 6. 🛡️ User Privacy & Account Management
- **In-App Account Deletion:** Permanent account deletion (`DELETE /api/auth/account`) satisfying Google Play Store requirements.
- **Privacy Policy & Community Guidelines:** In-app modals detailing data protection, encryption, and geolocation usage.

---

## 🛠️ Technology Stack

| Layer | Implementation |
|---|---|
| **Frontend** | Semantic HTML5, Vanilla JavaScript (ES6+), Vanilla CSS (SAATHCHALO Dark Navy / Gold Identity) |
| **Typography & Assets** | Google Fonts (*Outfit*, *Plus Jakarta Sans*), Font Awesome 6 Pro, Authentic Wikimedia Commons Photography |
| **Mapping Engine** | Leaflet.js, Google Maps Platform (Maps JS API, Routes API, TrafficLayer) |
| **Realtime Engine** | Server-Sent Events (SSE) with QUIC keepalives & smart reconnect |
| **Backend Service** | Node.js Zero-Dependency HTTP Server (`serve.js`) |
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
Open [http://localhost:8085](http://localhost:8085) in your browser.

### 2. Run Verification Test Suite
```bash
npm test
```
Executes the 15-point automated acceptance suite covering:
- Distance ratio fare calculations (10/6/4, 10/5, equal distances, rounding).
- Vehicle allocation thresholds and fuel tiers.
- System health check & data preservation.
- Strict $R = A + O$ member identity.
- One person = one vote idempotency.
- Shared corridor pooling and booking engine.
- Account deletion lifecycle.
- UGC content reporting.

---

## 📚 Deployment Documentation

- 📱 [**Google Play Store Deployment Guide**](./PLAYSTORE_DEPLOYMENT.md): Step-by-step instructions for Android packaging, signing keystores, target SDK 34/35, and Play Console submission.
- 🌐 [**Production Deployment & Operations Guide**](./PRODUCTION_DEPLOYMENT.md): High-availability setup, zero-downtime updates with PM2, Nginx reverse proxy configuration, and automated backups.
- 🗄️ [**Database Migration & Schema Guide**](./DATABASE_MIGRATION.md): Additive schema migrations, entity specifications, and Supabase PostgreSQL replication.

---

## 📄 License
MIT License. Developed by the SAATHCHALO Engineering Team.
