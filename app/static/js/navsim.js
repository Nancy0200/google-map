/**
 * navsim.js — Leaflet + OpenStreetMap Navigation Simulation Engine
 *
 * Replaces the former Google Maps implementation.
 * Uses Leaflet.js with CartoDB Dark Matter tiles (no API key required).
 *
 * Exports via window.NavSim:
 *   - getCurrentLocation()  → returns current road name string
 */

(function () {
    'use strict';

    // ===================== State =====================
    let map = null;
    let marker = null;
    let routePolyline = null;
    let routePath = [];       // Array of [lat, lng]
    let totalDistance = 0;    // meters
    let distanceTravelled = 0;
    let animFrameId = null;
    let lastTimestamp = null;
    let running = false;
    let paused = false;

    // ===================== DOM Elements =====================
    const simBtn = document.getElementById('sim-start-btn');
    const simBtnLabel = simBtn ? simBtn.querySelector('.sim-btn-label') : null;
    const simBtnIcon = simBtn ? simBtn.querySelector('.sim-btn-icon') : null;
    const greenPanel = document.getElementById('nav-turn-card');
    const bottomPanel = document.getElementById('nav-hud-gmap');
    const gpDistance = document.getElementById('turn-dist');
    const gpRoad = document.getElementById('turn-road');
    const bpTime = document.getElementById('bottom-time');
    const bpDist = document.getElementById('bottom-dist');
    const bpEta = document.getElementById('bottom-eta');
    const speedCircle = document.getElementById('speed-circle');
    const speedValue = document.getElementById('speed-value');

    const SPEED_KMHR = 40;
    const SPEED_MS = SPEED_KMHR / 3.6;

    // ===================== Geometry Helpers =====================
    // (Replace google.maps.geometry.spherical.*)

    /** Convert degrees to radians. */
    function toRad(deg) { return deg * Math.PI / 180; }
    /** Convert radians to degrees. */
    function toDeg(rad) { return rad * 180 / Math.PI; }

    /**
     * Haversine distance between two [lat, lng] points. Returns meters.
     */
    function haversineDistance(a, b) {
        const R = 6371000;
        const dLat = toRad(b[0] - a[0]);
        const dLng = toRad(b[1] - a[1]);
        const sinLat = Math.sin(dLat / 2);
        const sinLng = Math.sin(dLng / 2);
        const h = sinLat * sinLat + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * sinLng * sinLng;
        return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    }

    /**
     * Compute bearing (heading) from point a to point b. Returns degrees [0, 360).
     */
    function computeBearing(a, b) {
        const lat1 = toRad(a[0]);
        const lat2 = toRad(b[0]);
        const dLng = toRad(b[1] - a[1]);
        const y = Math.sin(dLng) * Math.cos(lat2);
        const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
        return (toDeg(Math.atan2(y, x)) + 360) % 360;
    }

    /**
     * Interpolate between two [lat, lng] points by fraction t ∈ [0, 1].
     */
    function interpolate(a, b, t) {
        return [
            a[0] + (b[0] - a[0]) * t,
            a[1] + (b[1] - a[1]) * t
        ];
    }

    // ===================== Map Initialization =====================

    function initMap() {
        const mapElement = document.getElementById('navsim-map');
        if (!mapElement || typeof L === 'undefined') return;

        const center = [24.1696768, 120.6976512];

        map = L.map(mapElement, {
            center: center,
            zoom: 17,
            zoomControl: false,
            attributionControl: false,
            dragging: true,
            scrollWheelZoom: true,
            doubleClickZoom: false,
            boxZoom: false,
            keyboard: false,
            touchZoom: true,
        });

        // CartoDB Voyager — bright, clean style similar to Google Maps
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            maxZoom: 20,
            subdomains: 'abcd',
        }).addTo(map);

        // Custom arrow marker using a rotatable div icon
        const arrowIcon = L.divIcon({
            className: 'nav-arrow-icon',
            html: '<div class="nav-arrow-inner">▲</div>',
            iconSize: [32, 32],
            iconAnchor: [16, 16],
        });

        marker = L.marker(center, {
            icon: arrowIcon,
            zIndexOffset: 1000,
        }).addTo(map);

        // Route polyline (will be set after requestRoute)
        routePolyline = L.polyline([], {
            color: '#4285F4',
            weight: 6,
            opacity: 0.85,
            lineJoin: 'round',
            lineCap: 'round',
        }).addTo(map);

        if (simBtn) simBtn.addEventListener('click', toggleSim);

        requestRoute();
    }

    // ===================== Route Loading =====================

    function requestRoute() {
        if (typeof REAL_ROUTE === 'undefined' || REAL_ROUTE.length === 0) {
            console.error('REAL_ROUTE not found!');
            return;
        }

        routePath = REAL_ROUTE.map(p => [p.lat, p.lng]);
        routePolyline.setLatLngs(routePath);

        // Total distance in meters (REAL_ROUTE.dist is in km)
        totalDistance = REAL_ROUTE[REAL_ROUTE.length - 1].dist * 1000;
        distanceTravelled = 0;

        if (greenPanel) greenPanel.classList.remove('hidden');
        if (bottomPanel) bottomPanel.style.display = 'block';

        updateHUD();

        marker.setLatLng(routePath[0]);
        map.setView(routePath[0], 17);

        // Fit route on map initially
        if (routePath.length > 1) {
            const bounds = L.latLngBounds(routePath);
            map.fitBounds(bounds, { padding: [30, 30] });
        }
    }

    // ===================== Position Helpers =====================

    function getPositionAtDistance(dist) {
        if (routePath.length === 0) return null;
        let d = 0;
        for (let i = 0; i < routePath.length - 1; i++) {
            const segLen = haversineDistance(routePath[i], routePath[i + 1]);
            if (d + segLen >= dist) {
                const fraction = (dist - d) / segLen;
                return interpolate(routePath[i], routePath[i + 1], fraction);
            }
            d += segLen;
        }
        return routePath[routePath.length - 1];
    }

    function getHeadingAtDistance(dist) {
        if (routePath.length === 0) return 0;
        let d = 0;
        for (let i = 0; i < routePath.length - 1; i++) {
            const segLen = haversineDistance(routePath[i], routePath[i + 1]);
            if (d + segLen >= dist) {
                return computeBearing(routePath[i], routePath[i + 1]);
            }
            d += segLen;
        }
        return 0;
    }

    // ===================== HUD Updates =====================

    function getCurrentRoadName() {
        if (typeof REAL_ROUTE === 'undefined') return '未知路段';
        const dtKm = distanceTravelled / 1000;
        for (let i = 0; i < REAL_ROUTE.length; i++) {
            if (REAL_ROUTE[i].dist > dtKm) {
                return REAL_ROUTE[i].road;
            }
        }
        return '目的地';
    }

    function updateHUD() {
        const remaining = totalDistance - distanceTravelled;

        if (gpDistance && gpRoad && routePath.length > 0) {
            if (remaining > 1000) {
                gpDistance.textContent = (remaining / 1000).toFixed(1) + ' 公里後';
            } else {
                gpDistance.textContent = Math.round(remaining) + ' 公尺後';
            }
            gpRoad.textContent = getCurrentRoadName();
        }

        if (bpDist && bpTime && bpEta) {
            bpDist.textContent = (remaining / 1000).toFixed(1) + ' 公里';
            const remainingSec = remaining / SPEED_MS;
            bpTime.textContent = Math.ceil(remainingSec / 60) + ' 分';

            const now = new Date();
            now.setSeconds(now.getSeconds() + remainingSec);
            bpEta.textContent =
                now.getHours().toString().padStart(2, '0') + ':' +
                now.getMinutes().toString().padStart(2, '0');
        }

        // Update speed display
        if (speedValue) {
            speedValue.textContent = running && !paused ? SPEED_KMHR : 0;
        }
    }

    // ===================== Animation =====================

    function animate(timestamp) {
        if (!running || paused) return;
        if (!lastTimestamp) lastTimestamp = timestamp;
        const dt = (timestamp - lastTimestamp) / 1000;
        lastTimestamp = timestamp;

        distanceTravelled += SPEED_MS * dt;
        if (distanceTravelled >= totalDistance) {
            distanceTravelled = totalDistance;
            running = false;
            updateSimButton();
            // Hide speed circle
            if (speedCircle) speedCircle.classList.remove('visible');
        }

        const pos = getPositionAtDistance(distanceTravelled);
        const heading = getHeadingAtDistance(distanceTravelled);

        if (pos) {
            marker.setLatLng(pos);
            // Keep the arrow always pointing UP (forward)
            // Instead, rotate the entire map so the road ahead is always "up"
            const el = marker.getElement();
            if (el) {
                const inner = el.querySelector('.nav-arrow-inner');
                if (inner) {
                    // Arrow always points up (0 deg) — the map rotates instead
                    inner.style.transform = 'rotate(0deg)';
                }
            }
            
            // Rotate the entire map container so the heading direction faces up
            const mapContainer = document.getElementById('navsim-map');
            if (mapContainer) {
                mapContainer.style.transform = `rotate(${-heading}deg)`;
                mapContainer.style.transformOrigin = 'center center';
            }
            
            map.panTo(pos, { animate: true, duration: 0.3 });
        }

        updateHUD();

        if (running) {
            animFrameId = requestAnimationFrame(animate);
        }
    }

    // ===================== Simulation Control =====================

    function toggleSim() {
        if (!running) {
            running = true;
            paused = false;
            if (distanceTravelled >= totalDistance) {
                distanceTravelled = 0;
            }
            lastTimestamp = null;
            // Show speed circle
            if (speedCircle) speedCircle.classList.add('visible');
            // Show bottom bar
            if (bottomPanel) bottomPanel.classList.add('visible');
            // Zoom in for navigation view
            map.setZoom(17);
            animFrameId = requestAnimationFrame(animate);
        } else if (!paused) {
            paused = true;
        } else {
            paused = false;
            lastTimestamp = null;
            animFrameId = requestAnimationFrame(animate);
        }
        updateSimButton();
    }

    function updateSimButton() {
        if (!simBtn) return;
        if (!running) {
            simBtn.className = '';
            if (simBtnIcon) simBtnIcon.textContent = '▶';
            if (simBtnLabel) simBtnLabel.textContent = '開始模擬';
        } else if (paused) {
            simBtn.className = 'paused';
            if (simBtnIcon) simBtnIcon.textContent = '▶';
            if (simBtnLabel) simBtnLabel.textContent = '繼續模擬';
        } else {
            simBtn.className = 'running';
            if (simBtnIcon) simBtnIcon.textContent = '⏸';
            if (simBtnLabel) simBtnLabel.textContent = '暫停模擬';
        }
    }

    // ===================== Public API =====================

    window.NavSim = {
        getCurrentLocation: function () {
            return getCurrentRoadName();
        },
        getCurrentSegment: function () {
            const road = getCurrentRoadName();
            return { road: road, city: '台中市' };
        },
    };

    // Also expose as window.Navigation for copilot-chat.js compatibility
    window.Navigation = {
        getCurrentSegment: function () {
            const road = getCurrentRoadName();
            return { road: road, city: '台中市' };
        },
    };

    // ===================== Auto-init =====================

    window.addEventListener('load', () => {
        if (typeof L !== 'undefined') {
            initMap();
        } else {
            console.error('Leaflet not loaded!');
        }
    });
})();
