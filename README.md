# SAATHCHALO 🛺

> **What if Empty Seats could become Affordable Rides?**  
> *Ek Raah, Kai Manzilein | Smarter • Safer • Shared Commutes*

SAATHCHALO is a Design Thinking Project proposing a route-based shared auto platform designed specifically for students and daily commuters. It aims to solve the daily friction of long waits, unpredictable surge pricing, and unsafe solo travels.

## ✨ Prototype Features
We have built a fully functional interactive web prototype to demonstrate the core features of the platform:
- **Live Pooling Simulation:** Experience a real-time simulation of hopping into an active auto en route to your destination to fill empty seats and save money.
- **Interactive Maps:** Fully functional, embedded map interface modeled after popular ride-sharing apps, powered by OpenStreetMap and Leaflet.js.
- **Dynamic Real-World Routing:** Search for real locations (e.g., "Connaught Place, Delhi") using the live Nominatim Geocoding API, and the platform will dynamically plot a real-world route.
- **Floating Action Button:** Persistent "Live Booking" UI element for quick access to the pooling feature across the page.
- **Modern UI:** Responsive, clean, and interactive design built with Tailwind CSS.

## 🌟 The Core Problem
From the college gate to home, students face a long, uncertain, and costly journey. Current ride-hailing apps are car-centric and lack real-time dynamic route matching optimized for auto-rickshaws at a micro-level.

## 💡 The Solution
A simple, trusted, student-friendly shared auto ecosystem featuring:
- **Smart Matching:** Instantly find co-passengers heading on the exact same route.
- **Shared Fare:** Pay only your fair share. No haggling, no surge pricing anxiety.
- **Less Waiting:** Get picked up faster as autos dynamically route to high-density requests.
- **Safer Commute:** Travel safely with known, verified campus co-riders.

## 🚀 How it Works
1. **Input Location:** Enter pickup & drop locations in the app.
2. **Smart Match:** The app instantly matches nearby riders on the same trajectory.
3. **Route Gen:** System finds the most efficient, detour-free route (inspired by Dijkstra's algorithm).
4. **Pickup:** Auto collects passengers sequentially in the shortest path.
5. **Auto-Pay:** Each student pays only their fraction of the total fare automatically.

## 🛠️ Tech Stack
This prototype is intentionally designed to be lightweight and zero-build for easy demonstration:
- **Frontend:** HTML5, Tailwind CSS (via CDN)
- **Icons & Graphics:** FontAwesome 6, Unsplash
- **Map & Routing:** Leaflet.js, Leaflet Routing Machine
- **Geocoding API:** OpenStreetMap Nominatim API (Real-world location search)
- **Logic:** Vanilla JavaScript (`script.js`)

## 💻 How to Run Locally
This is a static website, which means no complex installations or servers are required!
1. Clone this repository or download the ZIP.
2. Double-click on `index.html` to open it in any web browser (Chrome, Safari, Edge, etc.).
3. Try clicking the "Book a Ride Now" or the "LIVE BOOKING" floating button and type in real city locations!

---
*Design Thinking Project Prototype. Developed for every student commuter.*
