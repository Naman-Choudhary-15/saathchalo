# SAATHCHALO 🛺
> **What if Empty Seats could become Affordable Rides?**  
> *Ek Raah, Kai Manzilein | Smarter • Safer • Shared Commutes*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-brightgreen.svg)](https://nodejs.org/)
[![Status](https://img.shields.io/badge/Status-Live%20Multi--User-blue.svg)](https://github.com/Naman-Choudhary-15/saathchalo)

**SAATHCHALO** is an intelligent, route-based shared transportation web platform designed for university students and daily commuters. It bridges the gap between stranded commuters and underutilized vehicles across high-frequency student hubs in Delhi-NCR (Greater Noida, Noida, Ghaziabad).

This version is a **Real Multi-User Live Platform** featuring zero-configuration real-time communication: commuters across different phones, tablets, and laptops can register, log in, join regional community groups of their choice, chat in real time, cast destination votes, pool into shared rides with automated vehicle allocation, and reserve shuttle seats with instant multi-device synchronization.

---

## 🌟 Key Features & Capabilities

### 1. 💬 Instant Real-Time Community Group Chat
- **0ms Optimistic UI Delivery:** Messages appear immediately on the sender's screen with zero latency or loading delay.
- **Cross-Device Synchronization:** Powered by Server-Sent Events (SSE) with 10s keepalive heartbeats and background sync fallback.
- **Mobile Keyboard Compatibility:** Native support for virtual keyboard `Enter` and touch submission across Android Chrome and iOS Safari.
- **Clean Slate (Zero Demo Chats):** Pure commuter-driven conversations with a welcoming empty-state card for newly activated hubs.
- **Strict Privacy Guarantee:** Only the commuter's **Display Name** and **Avatar** are visible to peers in community feeds; private emails and phone numbers remain strictly confidential.

### 2. 👥 Choice to Join Any Community Group
Commuters have complete freedom to join, leave, and switch between regional transit communities:
- **Supported Regional Communities:**
  1. 🎓 **Knowledge Park** (Greater Noida) — College campuses, hostels & student housing
  2. 🔄 **Pari Chowk** (Greater Noida) — Major transit interchange & Aqua Line metro terminal
  3. 🏢 **Alpha 1 & 2** (Greater Noida) — Residential sectors & commercial markets
  4. 🏙️ **Noida Sector 62** (Noida) — IT corridor, institutions & Blue Line metro
  5. 🚆 **Ghaziabad Terminal** (Ghaziabad) — Railway junction & intercity connector
- **Interactive Header Controls:** Dynamic `[+ Join Group]` / `Member ✓` button in the community chat header. Hovering over a joined badge gives the option to leave the group.
- **Visual Status Badges:** Area tabs display a `✓ Joined` badge for every community the commuter is enrolled in.
- **"Explore All Groups" Modal:** A comprehensive directory modal allowing commuters to view member counts, transit descriptions, and join or switch to any regional hub with a single tap.
- **Multi-Group Membership:** Commuters traveling between campus and home can join multiple communities simultaneously.

### 3. 🗳️ Real-Time Community Destination Voting
- Backed by persistent sessions and active daily polls across all 5 communities.
- **One Vote per Account:** Guaranteed enforcement prevents ballot manipulation.
- **Pre-Vote Policy Modal:** Displays the chosen destination and communicates the ₹50 cancellation/no-show policy before recording the vote.
- **Synchronous Telemetry:** Vote counts, bar percentages, and active voter statistics update across all screens in real time.

### 4. 🚐 Automated Vehicle Allocation & Pooling
- When commuters agree on a shared destination, the system pools them into a single ride.
- **Dynamic Capacity & Allocation:**
  - 1 – 4 Riders → **Shared Auto** (e.g. `UP16-AT-1411`)
  - 5 – 6 Riders → **Shared Cab**
  - 7 – 20 Riders → **Mini Shuttle Van**
- Confirmed rides broadcast immediately to all participants with driver information, vehicle license plate, and live Leaflet route tracking.

### 5. 📅 Live Campus Shuttle Availability
- Fixed-route campus shuttles with real-time seat decrementing.
- Prevents overbooking at the server level.
- Live status tags (`Available`, `Filling Fast`, `Full`) update across all devices without page reloads.

### 6. 🔐 Real Authentication & Persistent Profiles
- Email and password registration with encrypted credentials.
- Persistent sessions stored securely across browser reloads.
- Dedicated profile modal to manage display name, avatar, and view commuter standing.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Frontend Structure & Styling** | Semantic HTML5, Vanilla JavaScript (ES6+), Vanilla CSS & Tailwind CSS |
| **Typography & Icons** | Google Fonts (*Inter*), Font Awesome 6 Pro |
| **Interactive Maps** | Leaflet.js, OpenStreetMap Nominatim Geocoding |
| **Realtime Engine** | Server-Sent Events (SSE) with QUIC stream keepalives & smart sync |
| **Integrated Backend** | Zero-dependency Node.js HTTP server (`serve.js`) |
| **Persistence** | Embedded persistent database engine (`saath-db.json`) |
| **Cloud Database (Optional)** | Supabase (PostgreSQL with RLS, Supabase Auth, Storage) via `supabase-schema.sql` |

---

## 🚀 Quickstart Guide

### 1. Clone the Repository
```bash
git clone https://github.com/Naman-Choudhary-15/saathchalo.git
cd saathchalo
```

### 2. Start the Live Platform
No external database or API key setup is required to run the full application:
```bash
npm start
```
*(Or run `node serve.js` directly)*.

The application starts immediately on:
- **Local Machine:** `http://localhost:8085`
- **Local Network (Phones & Tablets on same Wi-Fi):** `http://<YOUR_LOCAL_IP>:8085`

---

## 🌐 Public Access & Multi-Device Testing

To share the application publicly with other users across cellular data (4G/5G) and home Wi-Fi:

### Using Cloudflare Tunnel:
```bash
cloudflared tunnel --url http://127.0.0.1:8085
```
This generates a secure public URL (e.g. `https://your-tunnel.trycloudflare.com`) accessible from any smartphone or computer worldwide.

### Multi-Device Verification Scenario:
1. **Device A (Laptop):** Open the URL, click **Register**, create account `Aditya`, select `Knowledge Park`.
2. **Device B (Phone):** Open the URL, click **Register**, create account `Anshika`, select `Knowledge Park`.
3. **Instant Chat:** Send a message from Device A. Watch it appear instantly on Device B.
4. **Community Choice:** On Device B, click `Pari Chowk`, then click **`[+ Join Group]`**. The button updates to **`Member ✓`** and the tab shows **`✓ Joined`**.
5. **Destination Vote:** Both vote on an active departure option. See the vote count and progress bars synchronize in real time.
6. **Ride Pooling:** Finalize the poll to see the shared auto/cab allocated with driver details and route tracking!

---

## 📁 Repository Structure

```
saathchalo/
├── index.html              # Main customer-facing web application
├── script.js               # Application logic, optimistic chat, community membership & map
├── supabase-client.js      # Unified real-time client service (SSE & API integration)
├── serve.js                # Embedded HTTP server, REST endpoints & SSE broadcast engine
├── saath-db.json           # Seed database schema (users, communities, vote sessions, shuttles)
├── supabase-schema.sql     # Complete PostgreSQL schema & RLS policies for cloud Supabase
├── SUPABASE_SETUP.md       # Step-by-step setup guide for optional Supabase hosting
├── test_core.js            # Automated unit tests for route matching and fare algorithms
├── package.json            # Project manifest and start scripts
└── README.md               # Product documentation & usage guide
```

---

## 📜 License

This project is licensed under the [MIT License](LICENSE).

---
*SAATHCHALO — Ek Raah, Kai Manzilein | Smarter • Safer • Shared Commutes*
