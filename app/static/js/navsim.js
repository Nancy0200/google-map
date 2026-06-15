/**
 * navsim.js — Google Maps API Navigation Engine
 */

let map;
let marker;
let routePolyline;
let routePath = []; 
let totalDistance = 0; 
let distanceTravelled = 0; 
let animFrameId = null;
let lastTimestamp = null;
let running = false;
let paused = false;

// DOM Elements
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

const SPEED_KMHR = 40; // Simulation speed
const SPEED_MS = SPEED_KMHR / 3.6; 

function initGoogleMap() {
    const mapElement = document.getElementById('navsim-map');
    if (!mapElement || typeof google === 'undefined') return;

    // Default center
    const center = new google.maps.LatLng(24.1696768, 120.6976512);

    map = new google.maps.Map(mapElement, {
        center: center,
        zoom: 18.5,
        tilt: 60,          // Force 3D Isometric View
        heading: 0,
        mapTypeId: 'roadmap',
        disableDefaultUI: true, 
        keyboardShortcuts: false,
        clickableIcons: false
    });

    marker = new google.maps.Marker({
        map: map,
        position: center,
        icon: {
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 7,
            fillColor: '#4285F4',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
            rotation: 0
        },
        zIndex: 999
    });

    routePolyline = new google.maps.Polyline({
        map: map,
        path: [],
        strokeColor: '#4285F4',
        strokeOpacity: 0.8,
        strokeWeight: 10,
        zIndex: 1
    });

    if (simBtn) simBtn.addEventListener('click', toggleSim);

    requestRoute();
}

function requestRoute() {
    if (typeof REAL_ROUTE === 'undefined' || REAL_ROUTE.length === 0) {
        console.error("REAL_ROUTE not found! Cannot bypass Directions API.");
        return;
    }
    
    // Load local OSRM real route to bypass Google Directions API Key requirement
    routePath = REAL_ROUTE.map(p => new google.maps.LatLng(p.lat, p.lng));
    routePolyline.setPath(routePath);
    
    // REAL_ROUTE dist is in km, we need meters
    totalDistance = REAL_ROUTE[REAL_ROUTE.length - 1].dist * 1000;
    distanceTravelled = 0;
    
    if (greenPanel) greenPanel.classList.remove('hidden');
    if (bottomPanel) bottomPanel.style.display = 'block';

    updateHUD();

    marker.setPosition(routePath[0]);
    map.setCenter(routePath[0]);
    const initHeading = google.maps.geometry.spherical.computeHeading(routePath[0], routePath[1]);
    map.setHeading(initHeading);
    marker.setOptions({ icon: { ...marker.getIcon(), rotation: initHeading }});
}

function getPositionAtDistance(dist) {
    if (routePath.length === 0) return null;
    let d = 0;
    for (let i = 0; i < routePath.length - 1; i++) {
        const segLen = google.maps.geometry.spherical.computeDistanceBetween(routePath[i], routePath[i+1]);
        if (d + segLen >= dist) {
            const fraction = (dist - d) / segLen;
            return google.maps.geometry.spherical.interpolate(routePath[i], routePath[i+1], fraction);
        }
        d += segLen;
    }
    return routePath[routePath.length - 1];
}

function getHeadingAtDistance(dist) {
    if (routePath.length === 0) return 0;
    let d = 0;
    for (let i = 0; i < routePath.length - 1; i++) {
        const segLen = google.maps.geometry.spherical.computeDistanceBetween(routePath[i], routePath[i+1]);
        if (d + segLen >= dist) {
            return google.maps.geometry.spherical.computeHeading(routePath[i], routePath[i+1]);
        }
        d += segLen;
    }
    return 0;
}

function updateHUD() {
    if (gpDistance && gpRoad && routePath.length > 0) {
        const remaining = totalDistance - distanceTravelled;
        if (remaining > 1000) {
            gpDistance.textContent = (remaining/1000).toFixed(1) + ' 公里後';
        } else {
            gpDistance.textContent = Math.round(remaining) + ' 公尺後';
        }
        
        let currentRoad = "目的地";
        let dtKm = distanceTravelled / 1000;
        for (let i = 0; i < REAL_ROUTE.length; i++) {
            if (REAL_ROUTE[i].dist > dtKm) {
                currentRoad = REAL_ROUTE[i].road;
                break;
            }
        }
        gpRoad.textContent = currentRoad;
    }

    if (bpDist && bpTime && bpEta) {
        const remaining = totalDistance - distanceTravelled;
        bpDist.textContent = (remaining/1000).toFixed(1) + ' 公里';
        const remainingSec = remaining / (SPEED_KMHR / 3.6);
        bpTime.textContent = Math.ceil(remainingSec / 60) + ' 分';
        
        const now = new Date();
        now.setSeconds(now.getSeconds() + remainingSec);
        bpEta.textContent = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');
    }
}

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
    }

    const pos = getPositionAtDistance(distanceTravelled);
    const heading = getHeadingAtDistance(distanceTravelled);

    if (pos) {
        marker.setPosition(pos);
        marker.setOptions({ icon: { ...marker.getIcon(), rotation: heading }});
        map.setCenter(pos);
        map.setHeading(heading);
    }
    
    // Pass null so it relies on the previous leg data stored or we could save the leg globally.
    // For simplicity, we just update numbers here. The green panel needs the leg to parse steps.
    // Let's rely on updateHUD not crashing when leg is null.
    updateHUD();

    if (running) {
        animFrameId = requestAnimationFrame(animate);
    }
}

function toggleSim() {
    if (!running) {
        running = true;
        paused = false;
        if (distanceTravelled >= totalDistance) {
            distanceTravelled = 0; 
        }
        lastTimestamp = null;
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
        simBtnIcon.textContent = '▶';
        simBtnLabel.textContent = '開始模擬';
    } else if (paused) {
        simBtn.className = 'paused';
        simBtnIcon.textContent = '▶';
        simBtnLabel.textContent = '繼續模擬';
    } else {
        simBtn.className = 'running';
        simBtnIcon.textContent = '⏸';
        simBtnLabel.textContent = '暫停模擬';
    }
}

// Auto-init when Google Maps loads
window.addEventListener('load', () => {
    const checkGmap = setInterval(() => {
        if (typeof google !== 'undefined' && google.maps && google.maps.geometry) {
            clearInterval(checkGmap);
            initGoogleMap();
        }
    }, 100);
});
