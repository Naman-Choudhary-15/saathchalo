        let map;
        let routingControl;
        
        function initMap() {
            if (map) return;
            map = L.map('mapContainer').setView([28.4744, 77.5040], 13);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; OpenStreetMap contributors & CARTO',
                maxZoom: 19
            }).addTo(map);
        }

        function openBookingModal(serviceName, price, iconClass, iconColor) {
            document.getElementById('bookingModal').classList.remove('hidden');
            document.getElementById('selectedService').innerText = serviceName;
            document.getElementById('ridePrice').innerText = price;
            
            const iconElem = document.getElementById('serviceIcon');
            iconElem.className = `fa-solid ${iconClass} ${iconColor}`;
            
            document.getElementById('rideDetails').classList.add('hidden');
            const confirmBtn = document.getElementById('confirmRideBtn');
            confirmBtn.disabled = true;
            confirmBtn.classList.add('opacity-50', 'cursor-not-allowed');
            confirmBtn.innerText = 'Confirm Ride';
            
            if (routingControl) {
                map.removeControl(routingControl);
                routingControl = null;
            }

            setTimeout(() => {
                initMap();
                map.invalidateSize();
            }, 100);
        }

        function closeModal() {
            document.getElementById('bookingModal').classList.add('hidden');
        }

        async function geocodeLocation(query) {
            try {
                // Using OpenStreetMap's Nominatim API for free geocoding
                const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
                const data = await response.json();
                if (data && data.length > 0) {
                    return L.latLng(parseFloat(data[0].lat), parseFloat(data[0].lon));
                }
            } catch (e) {
                console.error("Geocoding error:", e);
            }
            return null;
        }

        async function calculateRoute() {
            if (routingControl) {
                map.removeControl(routingControl);
            }

            const btn = document.getElementById('confirmRideBtn');
            btn.innerText = 'Searching locations...';
            btn.disabled = true;
            btn.classList.add('opacity-50', 'cursor-not-allowed');

            const pickup = document.getElementById('pickupInput').value || 'Knowledge Park, Greater Noida';
            const dropoff = document.getElementById('dropoffInput').value || 'Alpha 1, Greater Noida';

            let pickupLatLng = await geocodeLocation(pickup);
            let dropoffLatLng = await geocodeLocation(dropoff);

            if (!pickupLatLng || !dropoffLatLng) {
                alert("Location not found! Try adding the city name (e.g., 'Sector 62, Noida'). Using default route for now.");
                pickupLatLng = L.latLng(28.4744, 77.5040);
                dropoffLatLng = L.latLng(28.4962, 77.5140);
            }

            btn.innerText = 'Calculating Route...';
            
            routingControl = L.Routing.control({
                waypoints: [pickupLatLng, dropoffLatLng],
                routeWhileDragging: false,
                addWaypoints: false,
                fitSelectedRoutes: true,
                show: false,
                lineOptions: {
                    styles: [{color: '#0f172a', opacity: 0.8, weight: 5}, {color: '#eab308', opacity: 1, weight: 3, dashArray: '10,10'}]
                },
                createMarker: function(i, wp, nWps) {
                    return L.marker(wp.latLng, {
                        icon: L.divIcon({
                            className: 'bg-transparent',
                            html: `<div class="w-8 h-8 ${i===0 ? 'bg-brandYellow' : 'bg-darkTheme'} text-white rounded-full border-2 border-white shadow-lg flex items-center justify-center font-bold text-xs"><i class="fa-solid ${i===0 ? 'fa-location-dot text-darkTheme' : 'fa-flag-checkered'}"></i></div>`,
                            iconSize: [32, 32],
                            iconAnchor: [16, 16]
                        })
                    });
                }
            }).addTo(map);

            document.getElementById('rideDetails').classList.remove('hidden');
            document.getElementById('rideDetails').classList.add('flex');
            
            setTimeout(() => {
                btn.disabled = false;
                btn.classList.remove('opacity-50', 'cursor-not-allowed');
                btn.innerText = 'Confirm Ride';
            }, 800);
        }

        document.getElementById('confirmRideBtn').addEventListener('click', function() {
            if (this.disabled) return;
            this.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Booking...';
            setTimeout(() => {
                this.innerHTML = '<i class="fa-solid fa-check mr-2"></i> Ride Booked Successfully!';
                this.classList.remove('bg-brandYellow', 'text-darkTheme');
                this.classList.add('bg-green-500', 'text-white');
                
                setTimeout(() => {
                    closeModal();
                    // Reset button state for next time
                    this.classList.add('bg-brandYellow', 'text-darkTheme');
                    this.classList.remove('bg-green-500', 'text-white');
                    this.innerHTML = 'Confirm Ride';
                }, 2000);
            }, 1500);
        });
