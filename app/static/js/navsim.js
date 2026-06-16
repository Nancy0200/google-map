/**
 * navsim.js — MapLibre GL JS Navigation Simulation Engine
 *
 * Uses MapLibre GL JS with CartoDB Voyager vector tiles.
 * Vector tiles allow native map rotation with labels staying upright.
 * No API key required.
 *
 * Exports: window.NavSim, window.Navigation
 */

(function () {
    'use strict';

    // ===================== State =====================
    let map = null;
    let marker = null;
    let routeCoords = [];     // Array of [lat, lng] for internal geometry
    let totalDistance = 0;
    let distanceTravelled = 0;
    let animFrameId = null;
    let lastTimestamp = null;
    let running = false;
    let paused = false;
    let currentHeading = 0;

    // Speed fluctuation state
    const BASE_SPEED = 40;
    let currentSpeedKmhr = 0;
    let targetSpeedKmhr = BASE_SPEED;
    let lastSpeedChangeTime = 0;

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

    const BASE_SPEED_KMHR = 40;
    const BASE_SPEED_MS = BASE_SPEED_KMHR / 3.6;

    // ===================== Geometry Helpers =====================

    function toRad(deg) { return deg * Math.PI / 180; }
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
        const h = sinLat * sinLat +
                  Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) *
                  sinLng * sinLng;
        return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    }

    /**
     * Compute bearing from point a to point b. Returns degrees [0, 360).
     */
    function computeBearing(a, b) {
        const lat1 = toRad(a[0]);
        const lat2 = toRad(b[0]);
        const dLng = toRad(b[1] - a[1]);
        const y = Math.sin(dLng) * Math.cos(lat2);
        const x = Math.cos(lat1) * Math.sin(lat2) -
                  Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
        return (toDeg(Math.atan2(y, x)) + 360) % 360;
    }

    /**
     * Interpolate between two [lat, lng] points by fraction t.
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
        if (!mapElement || typeof maplibregl === 'undefined') return;

        const center = [120.6976512, 24.1696768]; // MapLibre uses [lng, lat]

        map = new maplibregl.Map({
            container: mapElement,
            style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
            center: center,
            zoom: 17,
            pitch: 0,
            bearing: 0,
            attributionControl: false,
            dragRotate: true,
        });

        // Custom arrow marker — stays pointing UP on screen (viewport-aligned)
        const arrowEl = document.createElement('div');
        arrowEl.className = 'nav-arrow-icon';
        arrowEl.innerHTML = '<div class="nav-arrow-inner"></div>';

        marker = new maplibregl.Marker({
            element: arrowEl,
            rotationAlignment: 'viewport',
            pitchAlignment: 'viewport',
        }).setLngLat(center).addTo(map);

        // Add route source/layer once the map style loads
        map.on('load', () => {
            requestRoute();
        });

        if (simBtn) simBtn.addEventListener('click', toggleSim);
    }

    // ===================== Route Loading =====================

    function requestRoute() {
        if (typeof REAL_ROUTE === 'undefined' || REAL_ROUTE.length === 0) {
            console.error('REAL_ROUTE not found!');
            return;
        }

        // Internal: [lat, lng] for geometry math
        routeCoords = REAL_ROUTE.map(p => [p.lat, p.lng]);
        totalDistance = REAL_ROUTE[REAL_ROUTE.length - 1].dist * 1000;
        distanceTravelled = 0;

        // MapLibre GeoJSON: [lng, lat]
        const geojsonCoords = REAL_ROUTE.map(p => [p.lng, p.lat]);

        map.addSource('route', {
            type: 'geojson',
            data: {
                type: 'Feature',
                properties: {},
                geometry: {
                    type: 'LineString',
                    coordinates: geojsonCoords,
                }
            }
        });

        // Outer glow
        map.addLayer({
            id: 'route-glow',
            type: 'line',
            source: 'route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
                'line-color': '#4285F4',
                'line-width': 12,
                'line-opacity': 0.25,
            }
        });

        // Main route line
        map.addLayer({
            id: 'route-line',
            type: 'line',
            source: 'route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
                'line-color': '#4285F4',
                'line-width': 6,
                'line-opacity': 0.9,
            }
        });

        if (greenPanel) greenPanel.classList.remove('hidden');
        if (bottomPanel) bottomPanel.style.display = 'block';

        updateHUD();

        // Set marker at start
        marker.setLngLat([routeCoords[0][1], routeCoords[0][0]]);

        // Fit the route into view
        const bounds = geojsonCoords.reduce(
            (b, c) => b.extend(c),
            new maplibregl.LngLatBounds(geojsonCoords[0], geojsonCoords[0])
        );
        map.fitBounds(bounds, { padding: 40 });
    }

    // ===================== Position Helpers =====================

    function getPositionAtDistance(dist) {
        if (routeCoords.length === 0) return null;
        let d = 0;
        for (let i = 0; i < routeCoords.length - 1; i++) {
            const segLen = haversineDistance(routeCoords[i], routeCoords[i + 1]);
            if (d + segLen >= dist) {
                const fraction = (dist - d) / segLen;
                return interpolate(routeCoords[i], routeCoords[i + 1], fraction);
            }
            d += segLen;
        }
        return routeCoords[routeCoords.length - 1];
    }

    function getHeadingAtDistance(dist) {
        if (routeCoords.length === 0) return 0;
        let d = 0;
        for (let i = 0; i < routeCoords.length - 1; i++) {
            const segLen = haversineDistance(routeCoords[i], routeCoords[i + 1]);
            if (d + segLen >= dist) {
                return computeBearing(routeCoords[i], routeCoords[i + 1]);
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

        if (gpDistance && gpRoad && routeCoords.length > 0) {
            if (remaining > 1000) {
                gpDistance.textContent = (remaining / 1000).toFixed(1) + ' 公里後';
            } else {
                gpDistance.textContent = Math.round(remaining) + ' 公尺後';
            }
            gpRoad.textContent = getCurrentRoadName();
        }

        if (bpDist && bpTime && bpEta) {
            bpDist.textContent = (remaining / 1000).toFixed(1) + ' 公里';
            
            // Use base speed for ETA to avoid fluctuating arrival times
            const remainingSec = remaining / BASE_SPEED_MS;
            bpTime.textContent = Math.ceil(remainingSec / 60) + ' 分';

            const now = new Date();
            now.setSeconds(now.getSeconds() + remainingSec);
            bpEta.textContent =
                now.getHours().toString().padStart(2, '0') + ':' +
                now.getMinutes().toString().padStart(2, '0');
        }

        if (speedValue) {
            speedValue.textContent = running && !paused ? Math.round(currentSpeedKmhr) : 0;
        }
    }

    // ===================== Animation =====================

    function animate(timestamp) {
        if (!running || paused) return;
        if (!lastTimestamp) {
            lastTimestamp = timestamp;
            lastSpeedChangeTime = timestamp;
        }
        const dt = (timestamp - lastTimestamp) / 1000;
        lastTimestamp = timestamp;

        // Context-aware speed fluctuation (evaluate every 1 second)
        if (timestamp - lastSpeedChangeTime > 1000) {
            // Look ahead 40 meters to anticipate curves/intersections earlier
            const currentHdg = getHeadingAtDistance(distanceTravelled);
            const futureHdg = getHeadingAtDistance(distanceTravelled + 40);
            
            let diff = Math.abs(futureHdg - currentHdg);
            while (diff > 180) diff = Math.abs(diff - 360);
            
            if (diff > 15) {
                // Approaching a turn -> target 25 km/h
                targetSpeedKmhr = 25;
            } else {
                // Straight ahead -> maintain 55+ (55 to 60 km/h)
                targetSpeedKmhr = 55 + Math.random() * 5;
            }
            lastSpeedChangeTime = timestamp;
        }

        // Smoothly interpolate current speed towards target speed
        // Use a smaller factor (0.015) for a very gradual, realistic acceleration/deceleration
        currentSpeedKmhr += (targetSpeedKmhr - currentSpeedKmhr) * 0.015;
        const currentSpeedMs = currentSpeedKmhr / 3.6;

        distanceTravelled += currentSpeedMs * dt;
        if (distanceTravelled >= totalDistance) {
            distanceTravelled = totalDistance;
            running = false;
            updateSimButton();
            if (speedCircle) speedCircle.classList.remove('visible');
        }

        const pos = getPositionAtDistance(distanceTravelled);
        const targetHeading = getHeadingAtDistance(distanceTravelled);

        // Smooth heading interpolation — gentle lerp avoids jitter
        let diff = targetHeading - currentHeading;
        while (diff > 180) diff -= 360;
        while (diff < -180) diff += 360;
        currentHeading += diff * 0.08;
        currentHeading = ((currentHeading % 360) + 360) % 360;

        if (pos) {
            const lngLat = [pos[1], pos[0]]; // Convert [lat,lng] → [lng,lat]
            marker.setLngLat(lngLat);

            // MapLibre natively rotates the map while keeping labels upright!
            // Arrow stays pointing UP (viewport-aligned), map rotates underneath.
            map.easeTo({
                center: lngLat,
                bearing: currentHeading,
                duration: 100,
                easing: function (t) { return t; }, // linear for continuous updates
            });
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
            // Initialize heading to current direction
            currentHeading = getHeadingAtDistance(distanceTravelled);
            // Initialize speed when starting/resuming
            currentSpeedKmhr = BASE_SPEED_KMHR;
            targetSpeedKmhr = BASE_SPEED_KMHR;
            
            if (speedCircle) speedCircle.classList.add('visible');
            if (bottomPanel) bottomPanel.classList.add('visible');
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
            return { road: getCurrentRoadName(), city: '台中市' };
        },
    };

    window.Navigation = {
        getCurrentSegment: function () {
            return { road: getCurrentRoadName(), city: '台中市' };
        },
    };

    // ===================== Auto-init =====================

    window.addEventListener('load', () => {
        if (typeof maplibregl !== 'undefined') {
            initMap();
        } else {
            console.error('MapLibre GL JS not loaded!');
        }
    });
})();
