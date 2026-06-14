/**
 * navsim.js — Navigation Simulation Engine (Google Maps-style driving view)
 *
 * Simulates driving from 逢甲大學 to 台北101 at 100 km/hr.
 * Renders a perspective follow-cam view matching Google Maps navigation UI.
 *
 * Exports via window.NavSim
 */

(function () {
    // ===================== Route Data =====================
    const ROUTE = [
        { lat: 24.1790, lng: 120.6462, road: '逢甲路', km: 0, label: '🏫 逢甲大學', dist: 0 },
        { lat: 24.1750, lng: 120.6480, road: '逢甲路', km: 0.5, dist: 0.5 },
        { lat: 24.1710, lng: 120.6530, road: '台灣大道', km: 1.2, dist: 1.2 },
        { lat: 24.1680, lng: 120.6590, road: '台灣大道', km: 2.0, dist: 2.0 },
        { lat: 24.1665, lng: 120.6650, road: '台灣大道', km: 3.0, dist: 3.0 },
        { lat: 24.1660, lng: 120.6750, road: '台74線', km: 0, label: '🛣️ 台74線交流道', dist: 5.0 },
        { lat: 24.1700, lng: 120.6900, road: '台74線', km: 3, dist: 8.0 },
        { lat: 24.1770, lng: 120.7050, road: '台74線', km: 6, dist: 11.0 },
        { lat: 24.1830, lng: 120.7150, road: '國道一號', km: 178, label: '🔀 台中系統交流道', dist: 13.0 },
        { lat: 24.2200, lng: 120.7100, road: '國道一號', km: 170, dist: 21.0 },
        { lat: 24.2600, lng: 120.7050, road: '國道一號', km: 162, label: '⛽ 泰安服務區', dist: 29.0 },
        { lat: 24.3000, lng: 120.6900, road: '國道一號', km: 153, dist: 38.0 },
        { lat: 24.3300, lng: 120.6700, road: '國道一號', km: 145, dist: 46.0 },
        { lat: 24.3600, lng: 120.6500, road: '國道一號', km: 137, label: '🏙️ 苗栗', dist: 54.0 },
        { lat: 24.4000, lng: 120.6300, road: '國道一號', km: 128, dist: 63.0 },
        { lat: 24.4500, lng: 120.6100, road: '國道一號', km: 118, dist: 73.0 },
        { lat: 24.5000, lng: 120.5900, road: '國道一號', km: 108, dist: 83.0 },
        { lat: 24.5500, lng: 120.5800, road: '國道一號', km: 100, dist: 91.0 },
        { lat: 24.6000, lng: 120.5700, road: '國道一號', km: 95, dist: 96.0 },
        { lat: 24.6500, lng: 120.5600, road: '國道一號', km: 90, dist: 101.0 },
        { lat: 24.7000, lng: 120.5500, road: '國道一號', km: 85, label: '⛽ 湖口服務區', dist: 106.0 },
        { lat: 24.7500, lng: 120.5450, road: '國道一號', km: 78, dist: 113.0 },
        { lat: 24.7800, lng: 120.5600, road: '國道一號', km: 73, label: '🏙️ 新竹', dist: 118.0 },
        { lat: 24.8200, lng: 120.5800, road: '國道一號', km: 65, dist: 126.0 },
        { lat: 24.8600, lng: 120.6000, road: '國道一號', km: 58, dist: 133.0 },
        { lat: 24.9000, lng: 120.6200, road: '國道一號', km: 50, dist: 141.0 },
        { lat: 24.9400, lng: 120.6500, road: '國道一號', km: 43, label: '🏙️ 中壢', dist: 148.0 },
        { lat: 24.9700, lng: 120.7000, road: '國道一號', km: 37, dist: 154.0 },
        { lat: 24.9900, lng: 120.7500, road: '國道一號', km: 30, label: '🏙️ 桃園', dist: 161.0 },
        { lat: 25.0100, lng: 120.8000, road: '國道一號', km: 23, dist: 167.0 },
        { lat: 25.0300, lng: 120.8500, road: '國道一號', km: 17, dist: 173.0 },
        { lat: 25.0500, lng: 120.9000, road: '國道一號', km: 10, label: '🔀 五股交流道', dist: 178.0 },
        { lat: 25.0500, lng: 120.9300, road: '台北市區道路', km: 0, dist: 181.0 },
        { lat: 25.0450, lng: 120.9600, road: '環河快速道路', km: 3, dist: 184.0 },
        { lat: 25.0400, lng: 120.9800, road: '市民大道', km: 5, dist: 186.0 },
        { lat: 25.0380, lng: 121.0000, road: '市民大道', km: 7, dist: 188.0 },
        { lat: 25.0350, lng: 121.0200, road: '忠孝東路', km: 9, dist: 190.0 },
        { lat: 25.0330, lng: 121.0400, road: '信義路', km: 1, label: '🏙️ 台北市信義區', dist: 193.0 },
        { lat: 25.0336, lng: 121.0500, road: '信義路', km: 2, dist: 194.0 },
        { lat: 25.0339, lng: 121.0645, road: '信義路五段', km: 0, label: '🏛️ 台北101', dist: 196.0 },
    ];

    const TOTAL_DISTANCE = ROUTE[ROUTE.length - 1].dist;
    const SPEED_KMHR = 100;
    const SPEED_KMS = SPEED_KMHR / 3600;

    // ===================== Perspective Constants =====================
    const VIEW_DIST = 2.5;       // km ahead to render
    const FOCAL = 0.55;          // perspective focal length (km)
    const ROAD_HW_KM = 0.018;   // road half-width in km (18m = 36m total)
    const SAMPLE_STEP = 0.012;   // km between samples (12m)
    const BEHIND_DIST = 0.15;    // km behind car to render

    // ===================== State =====================
    let running = false;
    let paused = false;
    let distanceTravelled = 0;
    let lastTimestamp = null;
    let animFrameId = null;
    let renderMode = 'overview'; // 'overview' | 'follow'
    let dpr = window.devicePixelRatio || 1;

    // ===================== DOM =====================
    const canvas = document.getElementById('navsim-canvas');
    const ctx = canvas ? canvas.getContext('2d') : null;
    const simBtn = document.getElementById('sim-start-btn');

    // HUD elements (Google Maps style - managed via HTML overlays)
    const hudTurnCard = document.getElementById('nav-turn-card');
    const hudTurnIcon = document.getElementById('turn-icon');
    const hudTurnDist = document.getElementById('turn-dist');
    const hudTurnRoad = document.getElementById('turn-road');
    const hudSpeedVal = document.getElementById('speed-value');
    const hudBottomTime = document.getElementById('bottom-time');
    const hudBottomDist = document.getElementById('bottom-dist');
    const hudBottomEta = document.getElementById('bottom-eta');
    const hudOverlay = document.getElementById('nav-hud-gmap');
    const hudSpeedCircle = document.getElementById('speed-circle');

    // Legacy HUD elements (keep for compatibility)
    const hudRoad = document.getElementById('hud-road');
    const hudKm = document.getElementById('hud-km');
    const hudSpeed = document.getElementById('hud-speed');
    const hudEta = document.getElementById('hud-eta');
    const hudDist = document.getElementById('hud-dist');
    const hudPanel = document.getElementById('nav-hud');

    // ===================== Utility =====================

    function getPositionAtDist(dist) {
        if (dist <= 0) return { ...ROUTE[0], segIdx: 0, frac: 0 };
        if (dist >= TOTAL_DISTANCE) return { ...ROUTE[ROUTE.length - 1], segIdx: ROUTE.length - 2, frac: 1 };
        for (let i = 0; i < ROUTE.length - 1; i++) {
            const a = ROUTE[i], b = ROUTE[i + 1];
            if (dist >= a.dist && dist <= b.dist) {
                const f = b.dist - a.dist > 0 ? (dist - a.dist) / (b.dist - a.dist) : 0;
                return {
                    lat: a.lat + (b.lat - a.lat) * f,
                    lng: a.lng + (b.lng - a.lng) * f,
                    road: f < 0.5 ? a.road : b.road,
                    km: Math.round(a.km + (b.km - a.km) * f),
                    segIdx: i, frac: f,
                };
            }
        }
        return { ...ROUTE[ROUTE.length - 1] };
    }

    /** Get smoothed heading at distance (radians from north, clockwise positive) */
    function getHeading(dist) {
        let sinS = 0, cosS = 0;
        const steps = 5, window = 0.3;
        for (let i = 0; i < steps; i++) {
            const d1 = dist + window * i / steps;
            const d2 = d1 + 0.08;
            const p1 = getPositionAtDist(Math.min(d1, TOTAL_DISTANCE));
            const p2 = getPositionAtDist(Math.min(d2, TOTAL_DISTANCE));
            const dLat = p2.lat - p1.lat;
            const dLng = (p2.lng - p1.lng) * Math.cos(p1.lat * Math.PI / 180);
            const h = Math.atan2(dLng, dLat);
            sinS += Math.sin(h);
            cosS += Math.cos(h);
        }
        return Math.atan2(sinS, cosS);
    }

    /** Convert lat/lng to local car-relative coords (meters) */
    function toLocal(lat, lng, carLat, carLng, heading) {
        const mN = (lat - carLat) * 111000;
        const mE = (lng - carLng) * 111000 * Math.cos(carLat * Math.PI / 180);
        const cos = Math.cos(heading), sin = Math.sin(heading);
        return {
            x: (mE * cos - mN * sin) / 1000, // lateral (km)
            y: (mN * cos + mE * sin) / 1000,  // forward (km)
        };
    }

    /** Detect upcoming turn direction based on heading change */
    function getNextTurn(dist) {
        const currentRoad = getPositionAtDist(dist).road;
        let nextRoadName = null;
        let nextRoadDist = 0;
        let turnAngle = 0;

        for (let d = 0.1; d < 10; d += 0.1) {
            const pos = getPositionAtDist(Math.min(dist + d, TOTAL_DISTANCE));
            if (pos.road !== currentRoad) {
                nextRoadName = pos.road;
                nextRoadDist = d;
                // Calculate heading change
                const h1 = getHeading(dist + d - 0.2);
                const h2 = getHeading(dist + d + 0.2);
                turnAngle = h2 - h1;
                // Normalize to -PI..PI
                while (turnAngle > Math.PI) turnAngle -= 2 * Math.PI;
                while (turnAngle < -Math.PI) turnAngle += 2 * Math.PI;
                break;
            }
        }
        return { roadName: nextRoadName, distance: nextRoadDist, angle: turnAngle };
    }

    /** Get turn arrow character based on angle */
    function getTurnArrow(angle) {
        if (angle === 0) return { icon: '⬆', text: '直行' };
        const absDeg = Math.abs(angle) * 180 / Math.PI;
        if (absDeg < 20) return { icon: '⬆', text: '直行' };
        if (angle > 0) {
            if (absDeg < 50) return { icon: '↗', text: '靠右行駛' };
            return { icon: '➡', text: '右轉' };
        } else {
            if (absDeg < 50) return { icon: '↖', text: '靠左行駛' };
            return { icon: '⬅', text: '左轉' };
        }
    }

    // ===================== Canvas =====================

    let cw = 400, ch = 700;

    function resizeCanvas() {
        if (!canvas) return;
        const cont = canvas.parentElement;
        dpr = window.devicePixelRatio || 1;
        cw = cont.clientWidth;
        ch = cont.clientHeight;
        canvas.width = cw * dpr;
        canvas.height = ch * dpr;
        canvas.style.width = cw + 'px';
        canvas.style.height = ch + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // ===================== Google Maps Follow-Cam Rendering =====================

    function drawFollowView() {
        const w = cw, h = ch;
        const horizonY = h * 0.28;
        const carY = h * 0.72;
        const centerX = w / 2;

        // H_SCALE: road takes ~60% of width at car
        const H_SCALE = (w * 0.60) / (ROAD_HW_KM * 2);

        const carPos = getPositionAtDist(distanceTravelled);
        const heading = getHeading(distanceTravelled);

        // --- Perspective projection ---
        function project(lx, ly) {
            const absY = Math.abs(ly);
            const scale = FOCAL / (FOCAL + absY);
            const sx = centerX + lx * scale * H_SCALE;
            let sy;
            if (ly >= 0) {
                sy = carY - (carY - horizonY) * (1 - scale);
            } else {
                sy = carY + (h - carY) * (1 - scale);
            }
            return { x: sx, y: sy, scale };
        }

        // === 1. SKY — Light blue gradient (Google Maps daytime) ===
        const skyG = ctx.createLinearGradient(0, 0, 0, horizonY + 20);
        skyG.addColorStop(0, '#87CEEB');    // Sky blue
        skyG.addColorStop(0.4, '#a8d8f0');  // Lighter blue
        skyG.addColorStop(0.8, '#c8e6f5');  // Very light blue
        skyG.addColorStop(1, '#d4e8d0');    // Hint of green at horizon
        ctx.fillStyle = skyG;
        ctx.fillRect(0, 0, w, horizonY + 20);

        // Subtle clouds
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        const cloudY = horizonY * 0.3;
        drawCloud(w * 0.15, cloudY, 40, 18);
        drawCloud(w * 0.55, cloudY * 0.7, 55, 22);
        drawCloud(w * 0.8, cloudY * 1.2, 35, 15);

        // === 2. TERRAIN — Light green (Google Maps style) ===
        const terG = ctx.createLinearGradient(0, horizonY, 0, h);
        terG.addColorStop(0, '#a8c99e');   // Lighter green at horizon
        terG.addColorStop(0.1, '#8fba82'); // Medium green
        terG.addColorStop(0.4, '#7aad6d'); // Deeper green
        terG.addColorStop(1, '#6a9d5d');   // Saturated green near camera
        ctx.fillStyle = terG;
        ctx.fillRect(0, horizonY, w, h - horizonY);

        // Horizon haze — soft blend between sky and ground
        const hHaze = ctx.createLinearGradient(0, horizonY - 10, 0, horizonY + 25);
        hHaze.addColorStop(0, 'rgba(200, 220, 200, 0.4)');
        hHaze.addColorStop(1, 'rgba(200, 220, 200, 0)');
        ctx.fillStyle = hHaze;
        ctx.fillRect(0, horizonY - 10, w, 35);

        // === 3. Build projected road points ===
        const pts = [];
        for (let d = -BEHIND_DIST; d <= VIEW_DIST; d += SAMPLE_STEP) {
            const actDist = Math.max(0, Math.min(distanceTravelled + d, TOTAL_DISTANCE));
            const pos = getPositionAtDist(actDist);
            const loc = toLocal(pos.lat, pos.lng, carPos.lat, carPos.lng, heading);
            const p = project(loc.x, loc.y);
            pts.push({ ...p, d, road: pos.road, km: pos.km, dist: actDist });
        }

        // === 4. Road shoulders (darker edge strip) ===
        const shoulderW = 0.005; // 5m in km
        ctx.fillStyle = '#7a7a7a';
        ctx.beginPath();
        for (let i = 0; i < pts.length; i++) {
            const hw = (ROAD_HW_KM + shoulderW) * pts[i].scale * H_SCALE;
            if (i === 0) ctx.moveTo(pts[i].x - hw, pts[i].y);
            else ctx.lineTo(pts[i].x - hw, pts[i].y);
        }
        for (let i = pts.length - 1; i >= 0; i--) {
            const hw = (ROAD_HW_KM + shoulderW) * pts[i].scale * H_SCALE;
            ctx.lineTo(pts[i].x + hw, pts[i].y);
        }
        ctx.closePath();
        ctx.fill();

        // === 5. Road surface — Grey asphalt ===
        const roadColor = ctx.createLinearGradient(0, horizonY, 0, h);
        roadColor.addColorStop(0, '#b0b0b0');   // Lighter grey far away
        roadColor.addColorStop(0.3, '#9a9a9a');  // Medium grey
        roadColor.addColorStop(1, '#888888');     // Slightly darker near camera
        ctx.fillStyle = roadColor;
        ctx.beginPath();
        for (let i = 0; i < pts.length; i++) {
            const hw = ROAD_HW_KM * pts[i].scale * H_SCALE;
            const lx = pts[i].x - hw;
            if (i === 0) ctx.moveTo(lx, pts[i].y);
            else ctx.lineTo(lx, pts[i].y);
        }
        for (let i = pts.length - 1; i >= 0; i--) {
            const hw = ROAD_HW_KM * pts[i].scale * H_SCALE;
            ctx.lineTo(pts[i].x + hw, pts[i].y);
        }
        ctx.closePath();
        ctx.fill();

        // === 6. Lane markings — White lines ===
        // Edge lines (solid white)
        drawLaneLine(pts, ROAD_HW_KM, 'solid', 'rgba(255,255,255,0.85)', 2, H_SCALE);
        drawLaneLine(pts, -ROAD_HW_KM, 'solid', 'rgba(255,255,255,0.85)', 2, H_SCALE);

        // Lane dividers (dashed white)
        const laneOff = ROAD_HW_KM / 2;
        drawLaneLine(pts, laneOff, 'dashed', 'rgba(255,255,255,0.7)', 1.5, H_SCALE);
        drawLaneLine(pts, -laneOff, 'dashed', 'rgba(255,255,255,0.7)', 1.5, H_SCALE);

        // Center line (solid yellow for opposite direction)
        drawLaneLine(pts, 0, 'solid', 'rgba(255, 200, 0, 0.6)', 2, H_SCALE);

        // === 7. THICK BLUE ROUTE LINE — Google Maps signature ===
        const routeHW = 0.006; // 6m half-width = 12m total (thick blue band)
        // Draw blue route shadow first
        ctx.fillStyle = 'rgba(30, 80, 180, 0.25)';
        ctx.beginPath();
        for (let i = 0; i < pts.length; i++) {
            const hw = (routeHW + 0.002) * pts[i].scale * H_SCALE;
            if (i === 0) ctx.moveTo(pts[i].x - hw, pts[i].y);
            else ctx.lineTo(pts[i].x - hw, pts[i].y);
        }
        for (let i = pts.length - 1; i >= 0; i--) {
            const hw = (routeHW + 0.002) * pts[i].scale * H_SCALE;
            ctx.lineTo(pts[i].x + hw, pts[i].y);
        }
        ctx.closePath();
        ctx.fill();

        // Main blue route
        ctx.fillStyle = '#4285F4';
        ctx.beginPath();
        for (let i = 0; i < pts.length; i++) {
            const hw = routeHW * pts[i].scale * H_SCALE;
            if (i === 0) ctx.moveTo(pts[i].x - hw, pts[i].y);
            else ctx.lineTo(pts[i].x - hw, pts[i].y);
        }
        for (let i = pts.length - 1; i >= 0; i--) {
            const hw = routeHW * pts[i].scale * H_SCALE;
            ctx.lineTo(pts[i].x + hw, pts[i].y);
        }
        ctx.closePath();
        ctx.fill();

        // Lighter center highlight on route
        ctx.strokeStyle = 'rgba(130, 180, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < pts.length; i++) {
            if (i === 0) ctx.moveTo(pts[i].x, pts[i].y);
            else ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.stroke();

        // === 8. Roadside terrain details ===
        // Light green grass patches on sides
        for (let d = 0.05; d < VIEW_DIST; d += 0.06) {
            const idx = Math.round((d + BEHIND_DIST) / SAMPLE_STEP);
            if (idx >= pts.length || idx < 0) continue;
            const pt = pts[idx];
            if (!pt || pt.scale < 0.05) continue;
            const offset = (ROAD_HW_KM + shoulderW + 0.01) * pt.scale * H_SCALE;

            // Draw small bush/tree shapes on sides
            const bushSize = 4 + 8 * pt.scale;
            const side = (Math.floor(d * 100) % 2 === 0) ? 1 : -1;
            const tx = pt.x + offset * side + (side * bushSize * 0.5);
            const alpha = 0.3 + pt.scale * 0.4;

            // Darker green circles for bushes/trees
            ctx.fillStyle = `rgba(60, 130, 50, ${alpha})`;
            ctx.beginPath();
            ctx.arc(tx, pt.y, bushSize, 0, Math.PI * 2);
            ctx.fill();

            // Lighter highlight
            ctx.fillStyle = `rgba(90, 160, 70, ${alpha * 0.5})`;
            ctx.beginPath();
            ctx.arc(tx - bushSize * 0.2, pt.y - bushSize * 0.2, bushSize * 0.6, 0, Math.PI * 2);
            ctx.fill();
        }

        // === 9. Upcoming landmarks as Google Maps-style white cards ===
        for (const wp of ROUTE) {
            if (!wp.label) continue;
            const ahead = wp.dist - distanceTravelled;
            if (ahead < 0.05 || ahead > VIEW_DIST) continue;
            const loc = toLocal(wp.lat, wp.lng, carPos.lat, carPos.lng, heading);
            const p = project(loc.x, loc.y);
            if (!p || p.scale < 0.06) continue;

            const sw = Math.max(80, 140 * p.scale);
            const sh = Math.max(22, 34 * p.scale);
            const sx = p.x - sw / 2;
            const sy = p.y - sh - 22 * p.scale;
            const fs1 = Math.max(8, 12 * p.scale);
            const fs2 = Math.max(7, 10 * p.scale);
            const r = 6 * p.scale;

            // White card background with shadow
            ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
            ctx.shadowBlur = 8 * p.scale;
            ctx.shadowOffsetY = 2 * p.scale;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
            ctx.beginPath();
            ctx.roundRect(sx, sy, sw, sh, r);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.shadowOffsetY = 0;

            // Card text — dark text on white
            ctx.fillStyle = '#333';
            ctx.font = `600 ${fs1}px Inter, Noto Sans TC, sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(wp.label, p.x, sy + sh * 0.45);

            // Distance in muted color
            ctx.fillStyle = '#666';
            ctx.font = `500 ${fs2}px Inter, sans-serif`;
            const distLabel = ahead < 1 ? `${Math.round(ahead * 1000)}m` : `${ahead.toFixed(1)}km`;
            ctx.fillText(distLabel, p.x, sy + sh * 0.82);

            // Small connecting line from card to road
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(p.x, sy + sh);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
        }

        // === 10. VEHICLE INDICATOR — Google Maps blue navigation arrow ===
        // Glow circle
        const glowR = 30;
        const glow = ctx.createRadialGradient(centerX, carY, 0, centerX, carY, glowR);
        glow.addColorStop(0, 'rgba(66, 133, 244, 0.35)');
        glow.addColorStop(0.5, 'rgba(66, 133, 244, 0.12)');
        glow.addColorStop(1, 'rgba(66, 133, 244, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(centerX, carY, glowR, 0, Math.PI * 2);
        ctx.fill();

        // Blue navigation arrow (pointing up)
        ctx.save();
        ctx.translate(centerX, carY);

        // Arrow shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 2;

        // Arrow body (blue)
        ctx.fillStyle = '#4285F4';
        ctx.beginPath();
        ctx.moveTo(0, -20);       // Top point
        ctx.lineTo(-12, 10);      // Bottom left
        ctx.lineTo(-4, 4);        // Inner left
        ctx.lineTo(0, 6);         // Bottom center
        ctx.lineTo(4, 4);         // Inner right
        ctx.lineTo(12, 10);       // Bottom right
        ctx.closePath();
        ctx.fill();

        // White border
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        // White center dot
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(0, -2, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    /** Draw simple cloud shape */
    function drawCloud(x, y, w, h) {
        ctx.beginPath();
        ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(x - w * 0.5, y + h * 0.2, w * 0.5, h * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(x + w * 0.4, y + h * 0.1, w * 0.6, h * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    /** Draw a lane line (solid or dashed) along the projected road points */
    function drawLaneLine(pts, offsetKm, style, color, baseW, hScale) {
        ctx.strokeStyle = color;
        if (style === 'solid') {
            ctx.beginPath();
            for (let i = 0; i < pts.length; i++) {
                const off = offsetKm * pts[i].scale * hScale;
                const px = pts[i].x + off;
                ctx.lineWidth = Math.max(0.5, baseW * pts[i].scale);
                if (i === 0) ctx.moveTo(px, pts[i].y);
                else ctx.lineTo(px, pts[i].y);
            }
            ctx.stroke();
        } else {
            const CYCLE = 0.025;
            for (let i = 0; i < pts.length - 1; i++) {
                if (pts[i].d < 0) continue;
                const isDash = Math.floor(pts[i].d / CYCLE) % 2 === 0;
                if (!isDash) continue;
                const off1 = offsetKm * pts[i].scale * hScale;
                const off2 = offsetKm * pts[i + 1].scale * hScale;
                ctx.lineWidth = Math.max(0.3, baseW * pts[i].scale);
                ctx.beginPath();
                ctx.moveTo(pts[i].x + off1, pts[i].y);
                ctx.lineTo(pts[i + 1].x + off2, pts[i + 1].y);
                ctx.stroke();
            }
        }
    }

    // ===================== Overview Rendering =====================

    let bounds = null;
    function getCanvasBounds() {
        let mnLa = Infinity, mxLa = -Infinity, mnLo = Infinity, mxLo = -Infinity;
        for (const p of ROUTE) {
            if (p.lat < mnLa) mnLa = p.lat;
            if (p.lat > mxLa) mxLa = p.lat;
            if (p.lng < mnLo) mnLo = p.lng;
            if (p.lng > mxLo) mxLo = p.lng;
        }
        const pLa = (mxLa - mnLa) * 0.12, pLo = (mxLo - mnLo) * 0.12;
        return { minLat: mnLa - pLa, maxLat: mxLa + pLa, minLng: mnLo - pLo, maxLng: mxLo + pLo };
    }

    function toCanvasCoord(lat, lng) {
        if (!bounds) bounds = getCanvasBounds();
        return {
            x: ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * cw,
            y: ch - ((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * ch,
        };
    }

    function drawOverviewMap() {
        const w = cw, h = ch;
        ctx.clearRect(0, 0, w, h);

        // Background — Google Maps light style
        const bg = ctx.createRadialGradient(w * 0.3, h * 0.4, 0, w * 0.5, h * 0.5, w * 0.8);
        bg.addColorStop(0, '#e8f0e8');
        bg.addColorStop(1, '#d4e4d0');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);

        // Grid (subtle)
        ctx.strokeStyle = 'rgba(180, 200, 180, 0.3)';
        ctx.lineWidth = 0.5;
        for (let x = 0; x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
        for (let y = 0; y < h; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

        // Route line (undriven) — grey
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(150, 160, 150, 0.5)';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (let i = 0; i < ROUTE.length; i++) {
            const p = toCanvasCoord(ROUTE[i].lat, ROUTE[i].lng);
            if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();

        // Route line (driven) — Google blue
        if (distanceTravelled > 0) {
            ctx.beginPath();
            ctx.strokeStyle = '#4285F4';
            ctx.lineWidth = 5;
            ctx.shadowColor = 'rgba(66, 133, 244, 0.4)';
            ctx.shadowBlur = 10;
            for (let i = 0; i < ROUTE.length; i++) {
                if (ROUTE[i].dist > distanceTravelled) {
                    if (i > 0) { const ep = getPositionAtDist(distanceTravelled); const epc = toCanvasCoord(ep.lat, ep.lng); ctx.lineTo(epc.x, epc.y); }
                    break;
                }
                const p = toCanvasCoord(ROUTE[i].lat, ROUTE[i].lng);
                if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
            }
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        // Labels
        for (const wp of ROUTE) {
            if (!wp.label) continue;
            const p = toCanvasCoord(wp.lat, wp.lng);
            ctx.beginPath();
            ctx.fillStyle = wp.dist <= distanceTravelled ? '#4285F4' : 'rgba(100,100,100,0.6)';
            ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
            ctx.fill();
            if (wp.dist <= distanceTravelled) {
                ctx.beginPath();
                ctx.fillStyle = 'rgba(66, 133, 244, 0.2)';
                ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.font = '500 11px Inter, Noto Sans TC, sans-serif';
            ctx.fillStyle = wp.dist <= distanceTravelled ? '#333' : 'rgba(80, 80, 80, 0.8)';
            ctx.textAlign = 'left';
            ctx.fillText(wp.label, p.x + 12, p.y + 4);
        }

        // km markers
        for (let d = 30; d < TOTAL_DISTANCE; d += 30) {
            const pos = getPositionAtDist(d);
            const p = toCanvasCoord(pos.lat, pos.lng);
            ctx.fillStyle = 'rgba(100,100,100,0.35)';
            ctx.beginPath();
            ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.font = '400 9px Inter, sans-serif';
            ctx.fillStyle = 'rgba(100,100,100,0.5)';
            ctx.textAlign = 'center';
            ctx.fillText(`${Math.round(d)}km`, p.x, p.y - 8);
        }

        // Vehicle
        const carPos2 = getPositionAtDist(distanceTravelled);
        const cp = toCanvasCoord(carPos2.lat, carPos2.lng);
        const vGlow = ctx.createRadialGradient(cp.x, cp.y, 0, cp.x, cp.y, 25);
        vGlow.addColorStop(0, 'rgba(66, 133, 244, 0.4)');
        vGlow.addColorStop(1, 'rgba(66, 133, 244, 0)');
        ctx.fillStyle = vGlow;
        ctx.beginPath();
        ctx.arc(cp.x, cp.y, 25, 0, Math.PI * 2);
        ctx.fill();

        let angle = 0;
        if (distanceTravelled < TOTAL_DISTANCE) {
            const np = getPositionAtDist(Math.min(distanceTravelled + 2, TOTAL_DISTANCE));
            const npc = toCanvasCoord(np.lat, np.lng);
            angle = Math.atan2(npc.y - cp.y, npc.x - cp.x);
        }
        ctx.save();
        ctx.translate(cp.x, cp.y);
        ctx.rotate(angle);
        ctx.fillStyle = '#4285F4';
        ctx.shadowColor = 'rgba(66, 133, 244, 0.5)';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(12, 0); ctx.lineTo(-8, -7); ctx.lineTo(-5, 0); ctx.lineTo(-8, 7);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(2, 0, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Start/End markers
        const sp = toCanvasCoord(ROUTE[0].lat, ROUTE[0].lng);
        ctx.fillStyle = '#0d904f';
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = '700 10px Inter, sans-serif';
        ctx.fillStyle = '#0d904f';
        ctx.textAlign = 'center';
        ctx.fillText('START', sp.x, sp.y - 13);

        const ep = toCanvasCoord(ROUTE[ROUTE.length - 1].lat, ROUTE[ROUTE.length - 1].lng);
        ctx.fillStyle = '#EA4335';
        ctx.beginPath();
        ctx.arc(ep.x, ep.y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = '700 10px Inter, sans-serif';
        ctx.fillStyle = '#EA4335';
        ctx.textAlign = 'center';
        ctx.fillText('FINISH', ep.x, ep.y - 13);
    }

    // ===================== Main Draw Dispatcher =====================

    function drawMap() {
        if (!ctx) return;
        ctx.clearRect(0, 0, cw, ch);
        if (renderMode === 'follow') {
            drawFollowView();
        } else {
            drawOverviewMap();
        }
    }

    // ===================== HUD Update (Google Maps style) =====================

    function updateHUD() {
        const pos = getPositionAtDist(distanceTravelled);
        const remaining = Math.max(0, TOTAL_DISTANCE - distanceTravelled);
        const etaMin = Math.round((remaining / SPEED_KMHR) * 60);
        const currentSpeed = running && !paused ? SPEED_KMHR : 0;

        // Only show Google Maps HUD during follow mode
        if (renderMode !== 'follow') {
            if (hudTurnCard) hudTurnCard.classList.add('hidden');
            if (hudOverlay) hudOverlay.classList.remove('visible');
            if (hudSpeedCircle) hudSpeedCircle.classList.remove('visible');
            // Still update legacy HUD
            if (hudRoad) hudRoad.textContent = pos.road;
            if (hudKm) {
                hudKm.textContent = pos.road.includes('國道') ? `${pos.km}K` : `${Math.round(distanceTravelled)}km`;
            }
            if (hudSpeed) hudSpeed.textContent = currentSpeed;
            if (hudEta) {
                hudEta.textContent = etaMin > 60
                    ? `${Math.floor(etaMin / 60)}時${etaMin % 60}分`
                    : `${etaMin}分`;
            }
            if (hudDist) hudDist.textContent = `${remaining.toFixed(1)}`;
            return;
        }

        // Update speed circle
        if (hudSpeedVal) hudSpeedVal.textContent = currentSpeed;

        // Update bottom info bar
        if (hudBottomTime) {
            hudBottomTime.textContent = etaMin > 60
                ? `${Math.floor(etaMin / 60)} 時 ${etaMin % 60} 分`
                : `${etaMin} 分`;
        }
        if (hudBottomDist) {
            hudBottomDist.textContent = remaining >= 1
                ? `${remaining.toFixed(1)} 公里`
                : `${Math.round(remaining * 1000)} 公尺`;
        }
        if (hudBottomEta) {
            const now = new Date();
            now.setMinutes(now.getMinutes() + etaMin);
            const hh = now.getHours().toString().padStart(2, '0');
            const mm = now.getMinutes().toString().padStart(2, '0');
            hudBottomEta.textContent = `${hh}:${mm}`;
        }

        // Update turn card
        const turn = getNextTurn(distanceTravelled);
        if (turn.roadName && turn.distance < 8) {
            const arrow = getTurnArrow(turn.angle);
            if (hudTurnIcon) hudTurnIcon.textContent = arrow.icon;
            if (hudTurnDist) {
                hudTurnDist.textContent = turn.distance < 1
                    ? `${Math.round(turn.distance * 1000)} 公尺後`
                    : `${turn.distance.toFixed(1)} 公里後`;
            }
            if (hudTurnRoad) hudTurnRoad.textContent = turn.roadName;
            if (hudTurnCard) hudTurnCard.classList.remove('hidden');
        } else {
            // Show current road info when no upcoming turn
            if (hudTurnIcon) hudTurnIcon.textContent = '⬆';
            if (hudTurnDist) {
                hudTurnDist.textContent = pos.road.includes('國道')
                    ? `${pos.road} ${pos.km}K`
                    : pos.road;
            }
            if (hudTurnRoad) hudTurnRoad.textContent = '持續直行';
            if (hudTurnCard) hudTurnCard.classList.remove('hidden');
        }

        // Legacy HUD (keep for compatibility)
        if (hudRoad) hudRoad.textContent = pos.road;
        if (hudKm) {
            hudKm.textContent = pos.road.includes('國道') ? `${pos.km}K` : `${Math.round(distanceTravelled)}km`;
        }
        if (hudSpeed) hudSpeed.textContent = currentSpeed;
        if (hudEta) {
            hudEta.textContent = etaMin > 60
                ? `${Math.floor(etaMin / 60)}時${etaMin % 60}分`
                : `${etaMin}分`;
        }
        if (hudDist) hudDist.textContent = `${remaining.toFixed(1)}`;
    }

    // ===================== Animation Loop =====================

    function tick(timestamp) {
        if (!running || paused) return;
        if (lastTimestamp === null) lastTimestamp = timestamp;
        const dt = (timestamp - lastTimestamp) / 1000;
        lastTimestamp = timestamp;
        distanceTravelled += SPEED_KMS * dt;

        if (distanceTravelled >= TOTAL_DISTANCE) {
            distanceTravelled = TOTAL_DISTANCE;
            running = false;
            paused = false;
            drawMap();
            updateHUD();
            onArrival();
            updateSimButton();
            return;
        }
        drawMap();
        updateHUD();
        animFrameId = requestAnimationFrame(tick);
    }

    function onArrival() {
        if (hudRoad) hudRoad.textContent = '🎉 已到達台北101！';
        if (hudKm) hudKm.textContent = '到達';
        if (hudSpeed) hudSpeed.textContent = '0';
        if (hudEta) hudEta.textContent = '0分';
        if (hudDist) hudDist.textContent = '0';
        if (hudTurnIcon) hudTurnIcon.textContent = '🏁';
        if (hudTurnDist) hudTurnDist.textContent = '已到達目的地';
        if (hudTurnRoad) hudTurnRoad.textContent = '台北101';
        if (hudSpeedVal) hudSpeedVal.textContent = '0';
        if (hudBottomTime) hudBottomTime.textContent = '0 分';
        if (hudBottomDist) hudBottomDist.textContent = '0 公尺';
        if (window.Socket) {
            window.Socket.sendMessage({
                content: '🎉 已到達目的地：台北101！全程約 196 公里。📍 信義路五段',
                category: 'other', speed_level: null,
            });
        }
    }

    // ===================== Controls =====================

    function showGmapHud() {
        if (hudOverlay) hudOverlay.classList.add('visible');
        if (hudSpeedCircle) hudSpeedCircle.classList.add('visible');
    }

    function hideGmapHud() {
        if (hudOverlay) hudOverlay.classList.remove('visible');
        if (hudSpeedCircle) hudSpeedCircle.classList.remove('visible');
        if (hudTurnCard) hudTurnCard.classList.add('hidden');
    }

    function updateSimButton() {
        if (!simBtn) return;
        const label = simBtn.querySelector('.sim-btn-label');
        const icon = simBtn.querySelector('.sim-btn-icon');
        if (running && !paused) {
            if (label) label.textContent = '暫停模擬';
            if (icon) icon.textContent = '⏸';
            simBtn.classList.add('running');
            simBtn.classList.remove('paused');
        } else if (running && paused) {
            if (label) label.textContent = '繼續模擬';
            if (icon) icon.textContent = '▶';
            simBtn.classList.remove('running');
            simBtn.classList.add('paused');
        } else if (distanceTravelled >= TOTAL_DISTANCE) {
            if (label) label.textContent = '重新模擬';
            if (icon) icon.textContent = '🔄';
            simBtn.classList.remove('running', 'paused');
        } else {
            if (label) label.textContent = '開始模擬';
            if (icon) icon.textContent = '▶';
            simBtn.classList.remove('running', 'paused');
        }
    }

    function start() {
        if (distanceTravelled >= TOTAL_DISTANCE) distanceTravelled = 0;
        running = true;
        paused = false;
        lastTimestamp = null;
        renderMode = 'follow'; // Switch to follow-cam view
        if (hudPanel) hudPanel.classList.add('visible');
        showGmapHud();
        updateSimButton();
        animFrameId = requestAnimationFrame(tick);
        if (distanceTravelled === 0 && window.Socket) {
            window.Socket.sendMessage({
                content: '🚗 開始導航模擬：逢甲大學 → 台北101（約196公里）📍 逢甲路',
                category: 'other', speed_level: null,
            });
        }
    }

    function pause() {
        paused = true;
        lastTimestamp = null;
        if (animFrameId) cancelAnimationFrame(animFrameId);
        updateSimButton();
    }

    function reset() {
        running = false;
        paused = false;
        distanceTravelled = 0;
        lastTimestamp = null;
        renderMode = 'overview';
        if (animFrameId) cancelAnimationFrame(animFrameId);
        bounds = null;
        hideGmapHud();
        updateSimButton();
        drawMap();
        updateHUD();
    }

    function toggleSim() {
        if (!running) {
            start();
        } else if (running && !paused) {
            pause();
        } else {
            running = true;
            paused = false;
            lastTimestamp = null;
            updateSimButton();
            animFrameId = requestAnimationFrame(tick);
        }
    }

    function getCurrentLocation() {
        const pos = getPositionAtDist(distanceTravelled);
        return pos.road.includes('國道') ? `${pos.road} ${pos.km}K` : `${pos.road} ${Math.round(distanceTravelled)}km處`;
    }

    function isRunning() { return running && !paused; }

    // ===================== Init =====================

    function init() {
        if (!canvas || !ctx) return;
        resizeCanvas();
        window.addEventListener('resize', () => { resizeCanvas(); bounds = null; drawMap(); });
        if (simBtn) simBtn.addEventListener('click', toggleSim);
        drawMap();
        updateHUD();
        updateSimButton();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.NavSim = { start, pause, reset, toggleSim, getCurrentLocation, isRunning };
})();
