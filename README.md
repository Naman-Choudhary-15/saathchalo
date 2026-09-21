# SAATHCHALO 🛺

> **What if Empty Seats could become Affordable Rides?**  
> *Ek Raah, Kai Manzilein | Smarter • Safer • Shared Commutes*

SAATHCHALO is a Design Thinking Project proposing a route-based shared auto platform designed specifically for students and daily commuters. It aims to solve the daily friction of long waits, unpredictable surge pricing, and unsafe solo travels.

## ✨ Project Features & Booking Modes
We have built a fully functional interactive web prototype that demonstrates all the core booking methods of the platform:

1. **⚡ Live Booking / Live Pooling (NEW!):** 
   - A dedicated feature allowing users to hop into an auto *already en route* to their destination.
   - Includes a hovering floating action button (FAB) all around the page for quick access.
   - Features a live map simulation dropping 3 pins (Active Auto Location, Your Pickup, and Drop-off).
   - Helps fill empty seats on the fly, offering heavily discounted fares (e.g., ₹15).

2. **🚐 Shuttle Service:**
   - Fixed-route campus shuttles running on scheduled timings. 
   - Best for regular large-group commutes to standard campus locations.

3. **🚕 Auto Service:**
   - Dynamic route-matching for shared auto-rickshaws.
   - Fast, affordable, and on-demand matching for 3-4 students heading the exact same way.

4. **🤝 Community Service:**
   - Student-driven carpooling and community rides built on trust and mutual help.

## 🗺️ Interactive Maps & Technology
- **Real-World Routing:** Type real city locations (e.g., "Knowledge Park" to "Alpha 1") and the app plots a real-world route using the **OpenStreetMap Nominatim Geocoding API**.
- **Interactive UI:** A full-screen interactive map modal pops up, simulating an Uber/Rapido-like booking experience, built entirely using **Leaflet.js** and **Leaflet Routing Machine**.

## 🌟 The Core Problem
From the college gate to home, students face a long, uncertain, and costly journey. Current ride-hailing apps are car-centric and lack real-time dynamic route matching optimized for auto-rickshaws at a micro-level.

## 🚀 How it Works
1. **Input Location:** Enter pickup & drop locations in the app.
2. **Smart Match:** The app instantly matches nearby riders on the same trajectory.
3. **Route Gen:** System finds the most efficient, detour-free route (inspired by Dijkstra's algorithm).
4. **Pickup:** Auto collects passengers sequentially in the shortest path.
5. **Auto-Pay:** Each student pays only their fraction of the total fare automatically.

## 🛠️ Tech Stack
This prototype is intentionally designed to be lightweight and zero-build for easy demonstration:
- **Frontend:** HTML5, Tailwind CSS (via CDN), Vanilla JavaScript (`script.js`)
- **Icons & Graphics:** FontAwesome 6.5.1, Unsplash
- **Map & Routing:** Leaflet.js, OpenStreetMap API

## 💻 How to Run Locally
This is a static website, which means no complex installations or servers are required!
1. Clone this repository or download the ZIP.
2. Double-click on `index.html` to open it in any web browser (Chrome, Safari, Edge, etc.).
3. Try clicking any booking option or the floating "LIVE BOOKING" button and type in real city locations to see the map in action!

---
*Design Thinking Project Prototype. Developed for every student commuter.*
