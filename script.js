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

        let isLivePoolingMode = false;

        function openBookingModal(serviceName, price, iconClass, iconColor, isLive = false) {
            isLivePoolingMode = isLive;
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
            
            if (isLive) {
                document.getElementById('modalTitle').innerText = 'Join an Active Ride';
                document.getElementById('modalSubtitle').innerText = 'Finding autos currently en route to your destination...';
                document.getElementById('confirmRideBtn').innerText = 'Join Ride Now';
            } else {
                document.getElementById('modalTitle').innerText = 'Book a Ride';
                document.getElementById('modalSubtitle').innerText = 'Select your pickup and drop locations.';
            }

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
            
            let waypoints = [];
            let rideDetailText = '';

            if (isLivePoolingMode) {
                // Add a simulated auto location slightly before the pickup point to show it's en-route
                let autoLocation = L.latLng(pickupLatLng.lat - 0.015, pickupLatLng.lng - 0.015);
                waypoints = [autoLocation, pickupLatLng, dropoffLatLng];
                rideDetailText = "Found Auto UP16-AB-1234 • Arriving in 2 mins • 2 seats left";
            } else {
                waypoints = [pickupLatLng, dropoffLatLng];
                rideDetailText = "Shared ride • 3 mins away";
            }
            
            routingControl = L.Routing.control({
                waypoints: waypoints,
                routeWhileDragging: false,
                addWaypoints: false,
                fitSelectedRoutes: true,
                show: false,
                lineOptions: {
                    styles: [{color: '#0f172a', opacity: 0.8, weight: 5}, {color: '#eab308', opacity: 1, weight: 3, dashArray: '10,10'}]
                },
                createMarker: function(i, wp, nWps) {
                    if (isLivePoolingMode && i === 0) {
                        // Custom Marker for the en-route Auto
                        return L.marker(wp.latLng, {
                            icon: L.divIcon({
                                className: 'bg-transparent',
                                html: `<div class="w-10 h-10 bg-purple-600 text-white rounded-full border-2 border-white shadow-lg flex items-center justify-center font-bold text-lg"><i class="fa-solid fa-taxi"></i></div>`,
                                iconSize: [40, 40],
                                iconAnchor: [20, 20]
                            })
                        });
                    }
                    
                    let iconHtml = '';
                    if (i === 0 || (isLivePoolingMode && i === 1)) {
                        iconHtml = `<div class="w-8 h-8 bg-brandYellow text-darkTheme rounded-full border-2 border-white shadow-lg flex items-center justify-center font-bold text-xs"><i class="fa-solid fa-location-dot"></i></div>`;
                    } else {
                        iconHtml = `<div class="w-8 h-8 bg-darkTheme text-white rounded-full border-2 border-white shadow-lg flex items-center justify-center font-bold text-xs"><i class="fa-solid fa-flag-checkered"></i></div>`;
                    }
                    
                    return L.marker(wp.latLng, {
                        icon: L.divIcon({
                            className: 'bg-transparent',
                            html: iconHtml,
                            iconSize: [32, 32],
                            iconAnchor: [16, 16]
                        })
                    });
                }
            }).addTo(map);

            // Update details UI
            const detailParagraph = document.querySelector('#rideDetails p');
            if (detailParagraph) {
                detailParagraph.innerText = rideDetailText;
            }

            document.getElementById('rideDetails').classList.remove('hidden');
            document.getElementById('rideDetails').classList.add('flex');
            
            setTimeout(() => {
                btn.disabled = false;
                btn.classList.remove('opacity-50', 'cursor-not-allowed');
                btn.innerText = isLivePoolingMode ? 'Join Ride Now' : 'Confirm Ride';
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
