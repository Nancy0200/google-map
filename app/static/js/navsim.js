/**
 * navsim.js — Navigation Simulation Engine (Google Maps 3D Navigation Style)
 *
 * Renders a faithful reproduction of Google Maps' 3D driving navigation:
 * - Tilted top-down map view (not first-person racing game)
 * - Flat building footprints (beige/grey polygons)
 * - Cross street grid visible
 * - White road surfaces with thin grey borders
 * - Google's exact color palette
 * - Blue route overlay
 * - Street name labels on roads
 *
 * Exports via window.NavSim
 */

(function () {
    // ===================== Random Route Generator =====================
    const ROAD_POOLS = {
        city: ['中山路','中正路','忠孝路','仁愛路','信義路','和平路','民生路','民權路','復興路','建國路','光復路','文化路','大同路','成功路','自由路','三民路','博愛路','中華路','南京路','長安路','松江路','新生路','敦化路','永康路'],
        highway: ['國道一號','國道三號','台61線','台74線','台78線','快速道路','環東快速道路','環西快速道路'],
        boulevard: ['台灣大道','文心路','黎明路','五權路','河南路','崇德路','北屯路','太原路','大墩路','青海路'],
    };
    const LANDMARK_TEMPLATES = [
        { emoji: '⛽', names: ['加油站','休息站','服務區'] },
        { emoji: '🏙️', names: ['市區','商圈','轉運站'] },
        { emoji: '🏫', names: ['大學','學校','圖書館'] },
        { emoji: '🏥', names: ['醫院','診所'] },
        { emoji: '🛒', names: ['大賣場','百貨公司','購物中心'] },
        { emoji: '🌳', names: ['公園','綠園道','森林公園'] },
        { emoji: '🏛️', names: ['文化中心','博物館','美術館'] },
        { emoji: '🔀', names: ['交流道','匝道','系統交流道'] },
        { emoji: '🚉', names: ['火車站','高鐵站','捷運站'] },
    ];
    const AREA_NAMES = ['東區','西區','南區','北區','中區','新市區','舊城區','文教區','商業區','科技園區','工業區','住宅區','港區','山區','海濱'];

    // Side street names for cross streets
    const SIDE_STREET_NAMES = ['大智街','大勇街','大仁街','文德街','文昌街','福德街','永安街','長春街','四維街','八德街','忠誠街','正義街','和平街','自強街','永樂街','福星街','天祥街','合作街','利民街','安和街','向上街','公益街','美村街','精誠街','大隆街','惠中街','市府街','太平街','康樂街','幸福街'];

    function generateRandomRoute() {
        const segmentCount = 8 + Math.floor(Math.random() * 8);
        const route = [];
        let lat = 24.0 + Math.random() * 1.5;
        let lng = 120.3 + Math.random() * 0.8;
        let dist = 0;
        let heading = Math.random() * Math.PI * 2;
        const roadSequence = [];
        const usedRoads = new Set();

        function pickRoad(pool) {
            const available = pool.filter(r => !usedRoads.has(r));
            if (available.length === 0) return pool[Math.floor(Math.random() * pool.length)];
            const r = available[Math.floor(Math.random() * available.length)];
            usedRoads.add(r);
            return r;
        }

        for (let i = 0; i < segmentCount; i++) {
            const phase = i / segmentCount;
            let road;
            if (phase < 0.2) road = pickRoad(ROAD_POOLS.city);
            else if (phase < 0.35) road = pickRoad(ROAD_POOLS.boulevard);
            else if (phase < 0.7) road = pickRoad(ROAD_POOLS.highway);
            else if (phase < 0.85) road = pickRoad(ROAD_POOLS.boulevard);
            else road = pickRoad(ROAD_POOLS.city);
            roadSequence.push({ road, ptCount: 2 + Math.floor(Math.random() * 4) });
        }

        const startArea = AREA_NAMES[Math.floor(Math.random() * AREA_NAMES.length)];
        route.push({ lat, lng, road: roadSequence[0].road, km: 0, label: `📍 ${startArea}出發`, dist: 0 });

        let kmOnRoad = 0;
        for (let si = 0; si < roadSequence.length; si++) {
            const seg = roadSequence[si];
            const isHighway = seg.road.includes('國道') || seg.road.includes('線') || seg.road.includes('快速');
            const stepDist = isHighway ? (2.0 + Math.random() * 4.0) : (0.4 + Math.random() * 1.5);
            for (let pi = 0; pi < seg.ptCount; pi++) {
                const turnFactor = isHighway ? 0.08 : 0.25;
                heading += (Math.random() - 0.5) * turnFactor;
                if (pi === 0 && si > 0) heading += (Math.random() - 0.5) * 0.6;
                const d = stepDist * (0.6 + Math.random() * 0.8);
                lat += Math.cos(heading) * d * 0.009;
                lng += Math.sin(heading) * d * 0.009 / Math.cos(lat * Math.PI / 180);
                dist += d; kmOnRoad += d;
                let label;
                if (pi === 0 && si > 0 && si < roadSequence.length - 1 && Math.random() < 0.6) {
                    const t = LANDMARK_TEMPLATES[Math.floor(Math.random() * LANDMARK_TEMPLATES.length)];
                    label = `${t.emoji} ${AREA_NAMES[Math.floor(Math.random() * AREA_NAMES.length)]}${t.names[Math.floor(Math.random() * t.names.length)]}`;
                } else if (pi > 0 && isHighway && Math.random() < 0.15) {
                    const t = LANDMARK_TEMPLATES[Math.floor(Math.random() * 3)];
                    label = `${t.emoji} ${t.names[Math.floor(Math.random() * t.names.length)]}`;
                }
                route.push({ lat, lng, road: seg.road, km: Math.round(kmOnRoad), label, dist: Math.round(dist * 10) / 10 });
            }
            if (si < roadSequence.length - 1) kmOnRoad = 0;
        }

        const destArea = AREA_NAMES[Math.floor(Math.random() * AREA_NAMES.length)];
        const destT = LANDMARK_TEMPLATES[Math.floor(Math.random() * LANDMARK_TEMPLATES.length)];
        heading += (Math.random() - 0.5) * 0.15;
        lat += Math.cos(heading) * 0.003;
        lng += Math.sin(heading) * 0.003 / Math.cos(lat * Math.PI / 180);
        dist += 0.3;
        route.push({ lat, lng, road: roadSequence[roadSequence.length - 1].road, km: 0, label: `🏁 ${destArea}${destT.names[Math.floor(Math.random() * destT.names.length)]}`, dist: Math.round(dist * 10) / 10 });
        return route;
    }

    // ===================== Seeded random =====================
    let _seed = 42;
    function srand(x) { const s = Math.sin(x * 127.1 + _seed * 311.7) * 43758.5453; return s - Math.floor(s); }

    // ===================== Route & Speed =====================
    let ROUTE = generateRandomRoute();
    let TOTAL_DISTANCE = ROUTE[ROUTE.length - 1].dist;
    const SPEED_KMHR = 80;
    const SPEED_KMS = SPEED_KMHR / 3600;

    // ===================== Google Maps 3D Perspective =====================
    // These values replicate the Google Maps tilted map view
    const VIEW_DIST = 1.8;
    const FOCAL = 0.28;
    const ROAD_HW_KM = 0.014;       // Main road half-width (14m = 28m)
    const SAMPLE_STEP = 0.006;       // 6m between samples (very smooth)
    const BEHIND_DIST = 0.08;
    const SIDE_ROAD_W = 0.008;       // Side street half-width

    // ===================== Google Maps Color Palette =====================
    const COLORS = {
        terrain:     '#eef3dc',      // Google Maps green terrain
        terrainDark: '#d4deb8',
        park:        '#c5e1a5',      // Parks
        water:       '#aadafe',
        roadFill:    '#ffffff',      // White road surface
        roadBorder:  '#d6d5d3',      // Road outline
        highway:     '#fee599',      // Yellow highway
        hwBorder:    '#e8cf70',
        routeBlue:   '#4285F4',      // Google blue route
        routeShadow: 'rgba(66,133,244,0.25)',
        building:    '#e8e0d8',      // Building footprint fill
        buildAlt:    '#ddd6cc',      // Alternate building
        buildBorder: '#d0c8be',      // Building outline
        labelText:   '#5a5a5a',      // Road label text
        labelBg:     'rgba(255,255,255,0.8)',
        skyTop:      '#b8d4f0',
        skyBot:      '#dde8d8',
    };

    // ===================== State =====================
    let running = false, paused = false, distanceTravelled = 0;
    let lastTimestamp = null, animFrameId = null;
    let renderMode = 'overview';
    let dpr = window.devicePixelRatio || 1;

    // ===================== DOM =====================
    const canvas = document.getElementById('navsim-canvas');
    const ctx = canvas ? canvas.getContext('2d') : null;
    const simBtn = document.getElementById('sim-start-btn');
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
                return { lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f, road: f < 0.5 ? a.road : b.road, km: Math.round(a.km + (b.km - a.km) * f), segIdx: i, frac: f };
            }
        }
        return { ...ROUTE[ROUTE.length - 1] };
    }

    function getHeading(dist) {
        let sinS = 0, cosS = 0;
        for (let i = 0; i < 5; i++) {
            const d1 = dist + 0.3 * i / 5, d2 = d1 + 0.06;
            const p1 = getPositionAtDist(Math.min(d1, TOTAL_DISTANCE));
            const p2 = getPositionAtDist(Math.min(d2, TOTAL_DISTANCE));
            const h = Math.atan2((p2.lng - p1.lng) * Math.cos(p1.lat * Math.PI / 180), p2.lat - p1.lat);
            sinS += Math.sin(h); cosS += Math.cos(h);
        }
        return Math.atan2(sinS, cosS);
    }

    function toLocal(lat, lng, carLat, carLng, heading) {
        const mN = (lat - carLat) * 111000, mE = (lng - carLng) * 111000 * Math.cos(carLat * Math.PI / 180);
        const cos = Math.cos(heading), sin = Math.sin(heading);
        return { x: (mE * cos - mN * sin) / 1000, y: (mN * cos + mE * sin) / 1000 };
    }

    function getNextTurn(dist) {
        const currentRoad = getPositionAtDist(dist).road;
        for (let d = 0.1; d < 10; d += 0.1) {
            const pos = getPositionAtDist(Math.min(dist + d, TOTAL_DISTANCE));
            if (pos.road !== currentRoad) {
                const h1 = getHeading(dist + d - 0.2), h2 = getHeading(dist + d + 0.2);
                let a = h2 - h1;
                while (a > Math.PI) a -= 2 * Math.PI;
                while (a < -Math.PI) a += 2 * Math.PI;
                return { roadName: pos.road, distance: d, angle: a };
            }
        }
        return { roadName: null, distance: 0, angle: 0 };
    }

    function getTurnArrow(angle) {
        if (angle === 0) return { icon: '⬆', text: '直行' };
        const deg = Math.abs(angle) * 180 / Math.PI;
        if (deg < 20) return { icon: '⬆', text: '直行' };
        if (angle > 0) return deg < 50 ? { icon: '↗', text: '靠右行駛' } : { icon: '➡', text: '右轉' };
        return deg < 50 ? { icon: '↖', text: '靠左行駛' } : { icon: '⬅', text: '左轉' };
    }

    function isHighwayAt(dist) {
        const r = getPositionAtDist(dist).road;
        return r.includes('國道') || r.includes('線') || r.includes('快速');
    }

    // ===================== Canvas =====================
    let cw = 400, ch = 700;
    function resizeCanvas() {
        if (!canvas) return;
        const cont = canvas.parentElement;
        dpr = window.devicePixelRatio || 1;
        cw = cont.clientWidth; ch = cont.clientHeight;
        canvas.width = cw * dpr; canvas.height = ch * dpr;
        canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // ===================== Google Maps 3D Navigation Rendering =====================

    function drawFollowView() {
        const w = cw, h = ch;
        const horizonY = h * 0.32;
        const carY = h * 0.80;
        const centerX = w / 2;
        const H_SCALE = (w * 0.50) / (ROAD_HW_KM * 2);
        const carPos = getPositionAtDist(distanceTravelled);
        const heading = getHeading(distanceTravelled);
        const onHighway = isHighwayAt(distanceTravelled);

        function project(lx, ly) {
            const scale = FOCAL / (FOCAL + Math.abs(ly));
            const sx = centerX + lx * scale * H_SCALE;
            const sy = ly >= 0
                ? carY - (carY - horizonY) * (1 - scale)
                : carY + (h - carY) * (1 - scale);
            return { x: sx, y: sy, scale };
        }

        // === 1. SKY — Simple, clean (Google Maps style) ===
        const skyG = ctx.createLinearGradient(0, 0, 0, horizonY + 15);
        skyG.addColorStop(0, COLORS.skyTop);
        skyG.addColorStop(1, COLORS.skyBot);
        ctx.fillStyle = skyG;
        ctx.fillRect(0, 0, w, horizonY + 15);

        // === 2. TERRAIN — Google Maps green ===
        ctx.fillStyle = COLORS.terrain;
        ctx.fillRect(0, horizonY - 2, w, h - horizonY + 2);

        // === 3. Build projected road points (very fine sampling) ===
        const pts = [];
        for (let d = -BEHIND_DIST; d <= VIEW_DIST; d += SAMPLE_STEP) {
            const actDist = Math.max(0, Math.min(distanceTravelled + d, TOTAL_DISTANCE));
            const pos = getPositionAtDist(actDist);
            const loc = toLocal(pos.lat, pos.lng, carPos.lat, carPos.lng, heading);
            const p = project(loc.x, loc.y);
            pts.push({ ...p, d, road: pos.road, dist: actDist });
        }

        // === 4. CROSS STREETS + BUILDING BLOCKS ===
        // Draw these BEFORE the main road so the main road sits on top
        const crossInterval = 0.055; // ~55m between cross streets (city blocks)
        const buildingExtent = 0.12; // How far buildings extend from road (120m)

        for (let d = 0; d < VIEW_DIST; d += crossInterval) {
            const idx = Math.round((d + BEHIND_DIST) / SAMPLE_STEP);
            const idx2 = Math.round((d + crossInterval + BEHIND_DIST) / SAMPLE_STEP);
            if (idx >= pts.length || idx < 0) continue;
            const pt = pts[idx];
            if (!pt || pt.scale < 0.02) continue;

            const roadEdgeOff = (ROAD_HW_KM + 0.004) * pt.scale * H_SCALE;
            const blockSeed = Math.floor(d * 1000);

            // --- Cross street lines ---
            const crossW = buildingExtent * pt.scale * H_SCALE;
            const streetW = Math.max(0.5, SIDE_ROAD_W * 2 * pt.scale * H_SCALE);

            // Cross street — right side
            ctx.fillStyle = COLORS.roadBorder;
            ctx.fillRect(pt.x + roadEdgeOff - 1, pt.y - streetW / 2 - 0.5, crossW + 2, streetW + 1);
            ctx.fillStyle = COLORS.roadFill;
            ctx.fillRect(pt.x + roadEdgeOff, pt.y - streetW / 2, crossW, streetW);

            // Cross street — left side
            ctx.fillStyle = COLORS.roadBorder;
            ctx.fillRect(pt.x - roadEdgeOff - crossW - 1, pt.y - streetW / 2 - 0.5, crossW + 2, streetW + 1);
            ctx.fillStyle = COLORS.roadFill;
            ctx.fillRect(pt.x - roadEdgeOff - crossW, pt.y - streetW / 2, crossW, streetW);

            // --- Building blocks between this cross street and the next ---
            if (idx2 < pts.length && pts[idx2]) {
                const pt2 = pts[idx2];
                const blockH = Math.abs(pt2.y - pt.y);
                if (blockH > 2 && blockH < 200) {
                    const topY = Math.min(pt.y, pt2.y);

                    for (let side = -1; side <= 1; side += 2) {
                        const baseOff = roadEdgeOff + 3 * pt.scale;
                        const bx = side > 0 ? pt.x + baseOff : pt.x - baseOff;

                        // Generate 2-4 building footprints per block per side
                        const numBuildings = 2 + Math.floor(srand(blockSeed + side * 100) * 3);
                        const totalW = crossW - 6 * pt.scale;

                        for (let bi = 0; bi < numBuildings; bi++) {
                            const bFrac = bi / numBuildings;
                            const bOff = bFrac * totalW;
                            const bw = totalW / numBuildings * (0.5 + srand(blockSeed + bi * 7 + side) * 0.45);
                            const bh = blockH * (0.3 + srand(blockSeed + bi * 13 + side) * 0.55);
                            const by = topY + (blockH - bh) * srand(blockSeed + bi * 23 + side) * 0.3 + streetW;

                            if (bw < 2 || bh < 2) continue;

                            const isPark = srand(blockSeed + bi * 31 + side) > 0.82;

                            if (isPark) {
                                // Park — green rectangle
                                ctx.fillStyle = COLORS.park;
                                if (side > 0) {
                                    ctx.fillRect(bx + bOff, by, bw, bh - streetW * 2);
                                } else {
                                    ctx.fillRect(bx - bOff - bw, by, bw, bh - streetW * 2);
                                }
                            } else {
                                // Building footprint with border
                                const buildColor = srand(blockSeed + bi * 41 + side) > 0.5 ? COLORS.building : COLORS.buildAlt;
                                const bx2 = side > 0 ? bx + bOff : bx - bOff - bw;
                                const by2 = by;
                                const bh2 = bh - streetW * 2;

                                // Shadow (slight offset)
                                ctx.fillStyle = 'rgba(0,0,0,0.06)';
                                ctx.fillRect(bx2 + 1, by2 + 1, bw, Math.max(1, bh2));

                                // Fill
                                ctx.fillStyle = buildColor;
                                ctx.fillRect(bx2, by2, bw, Math.max(1, bh2));

                                // Border
                                ctx.strokeStyle = COLORS.buildBorder;
                                ctx.lineWidth = Math.max(0.3, 0.8 * pt.scale);
                                ctx.strokeRect(bx2, by2, bw, Math.max(1, bh2));
                            }
                        }
                    }
                }
            }
        }

        // === 5. MAIN ROAD — White surface with grey border (Google Maps style) ===
        const roadHW = onHighway ? ROAD_HW_KM * 1.3 : ROAD_HW_KM;
        const borderExtra = 0.003;

        // Road border (grey outline)
        ctx.fillStyle = onHighway ? COLORS.hwBorder : COLORS.roadBorder;
        ctx.beginPath();
        for (let i = 0; i < pts.length; i++) {
            const hw = (roadHW + borderExtra) * pts[i].scale * H_SCALE;
            if (i === 0) ctx.moveTo(pts[i].x - hw, pts[i].y);
            else ctx.lineTo(pts[i].x - hw, pts[i].y);
        }
        for (let i = pts.length - 1; i >= 0; i--) {
            const hw = (roadHW + borderExtra) * pts[i].scale * H_SCALE;
            ctx.lineTo(pts[i].x + hw, pts[i].y);
        }
        ctx.closePath();
        ctx.fill();

        // Road surface (white or yellow for highway)
        ctx.fillStyle = onHighway ? COLORS.highway : COLORS.roadFill;
        ctx.beginPath();
        for (let i = 0; i < pts.length; i++) {
            const hw = roadHW * pts[i].scale * H_SCALE;
            if (i === 0) ctx.moveTo(pts[i].x - hw, pts[i].y);
            else ctx.lineTo(pts[i].x - hw, pts[i].y);
        }
        for (let i = pts.length - 1; i >= 0; i--) {
            const hw = roadHW * pts[i].scale * H_SCALE;
            ctx.lineTo(pts[i].x + hw, pts[i].y);
        }
        ctx.closePath();
        ctx.fill();

        // === 6. LANE MARKINGS ===
        // Center line — dashed grey
        drawLaneLine(pts, 0, 'dashed', 'rgba(180,180,180,0.6)', 1.5, H_SCALE, roadHW);

        // Edge lines — thin solid grey
        drawLaneLine(pts, roadHW * 0.95, 'solid', 'rgba(200,200,200,0.5)', 1, H_SCALE, roadHW);
        drawLaneLine(pts, -roadHW * 0.95, 'solid', 'rgba(200,200,200,0.5)', 1, H_SCALE, roadHW);

        // Lane dividers
        if (onHighway) {
            drawLaneLine(pts, roadHW * 0.33, 'dashed', 'rgba(180,180,180,0.5)', 1, H_SCALE, roadHW);
            drawLaneLine(pts, -roadHW * 0.33, 'dashed', 'rgba(180,180,180,0.5)', 1, H_SCALE, roadHW);
        }

        // === 7. BLUE ROUTE LINE — Google Maps signature ===
        const routeHW = 0.004;

        // Route shadow
        ctx.fillStyle = COLORS.routeShadow;
        ctx.beginPath();
        for (let i = 0; i < pts.length; i++) {
            const hw = (routeHW + 0.002) * pts[i].scale * H_SCALE;
            if (i === 0) ctx.moveTo(pts[i].x - hw, pts[i].y + 1);
            else ctx.lineTo(pts[i].x - hw, pts[i].y + 1);
        }
        for (let i = pts.length - 1; i >= 0; i--) {
            const hw = (routeHW + 0.002) * pts[i].scale * H_SCALE;
            ctx.lineTo(pts[i].x + hw, pts[i].y + 1);
        }
        ctx.closePath();
        ctx.fill();

        // Route fill
        ctx.fillStyle = COLORS.routeBlue;
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

        // Route highlight (lighter center line)
        ctx.strokeStyle = 'rgba(130,185,255,0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < pts.length; i++) {
            if (i === 0) ctx.moveTo(pts[i].x, pts[i].y);
            else ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.stroke();

        // === 8. STREET NAME LABELS — on the road (Google Maps style) ===
        drawStreetLabels(pts, H_SCALE, roadHW);

        // === 9. Side street name labels ===
        drawSideStreetLabels(pts, H_SCALE, roadHW, crossInterval);

        // === 10. Upcoming LANDMARK cards ===
        for (const wp of ROUTE) {
            if (!wp.label) continue;
            const ahead = wp.dist - distanceTravelled;
            if (ahead < 0.03 || ahead > VIEW_DIST) continue;
            const loc = toLocal(wp.lat, wp.lng, carPos.lat, carPos.lng, heading);
            const p = project(loc.x, loc.y);
            if (!p || p.scale < 0.05) continue;

            const sw = Math.max(85, 145 * p.scale);
            const sh = Math.max(22, 34 * p.scale);
            const sx = p.x - sw / 2, sy = p.y - sh - 20 * p.scale;
            const fs1 = Math.max(8, 12 * p.scale);
            const fs2 = Math.max(7, 10 * p.scale);
            const r = 6 * p.scale;

            ctx.shadowColor = 'rgba(0,0,0,0.2)'; ctx.shadowBlur = 8 * p.scale; ctx.shadowOffsetY = 2 * p.scale;
            ctx.fillStyle = 'rgba(255,255,255,0.96)';
            ctx.beginPath(); ctx.roundRect(sx, sy, sw, sh, r); ctx.fill();
            ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

            ctx.fillStyle = '#333'; ctx.font = `600 ${fs1}px Inter, Noto Sans TC, sans-serif`; ctx.textAlign = 'center';
            ctx.fillText(wp.label, p.x, sy + sh * 0.45);
            ctx.fillStyle = '#888'; ctx.font = `500 ${fs2}px Inter, sans-serif`;
            ctx.fillText(ahead < 1 ? `${Math.round(ahead * 1000)}m` : `${ahead.toFixed(1)}km`, p.x, sy + sh * 0.8);

            ctx.strokeStyle = 'rgba(0,0,0,0.1)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(p.x, sy + sh); ctx.lineTo(p.x, p.y); ctx.stroke();
        }

        // === 11. VEHICLE — Google Maps blue arrow ===
        const glowR = 32;
        const glow = ctx.createRadialGradient(centerX, carY, 0, centerX, carY, glowR);
        glow.addColorStop(0, 'rgba(66,133,244,0.35)');
        glow.addColorStop(0.5, 'rgba(66,133,244,0.10)');
        glow.addColorStop(1, 'rgba(66,133,244,0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(centerX, carY, glowR, 0, Math.PI * 2); ctx.fill();

        ctx.save();
        ctx.translate(centerX, carY);
        ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
        ctx.fillStyle = COLORS.routeBlue;
        ctx.beginPath();
        ctx.moveTo(0, -22); ctx.lineTo(-13, 11); ctx.lineTo(-4, 5); ctx.lineTo(0, 7); ctx.lineTo(4, 5); ctx.lineTo(13, 11);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.stroke();
        ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -2, 3, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    // ===================== Street Labels =====================

    function drawStreetLabels(pts, hScale, roadHW) {
        // Show current road name along the road at intervals
        const labelInterval = 0.3; // Every 300m
        for (let d = 0.15; d < VIEW_DIST - 0.2; d += labelInterval) {
            const idx = Math.round((d + BEHIND_DIST) / SAMPLE_STEP);
            if (idx >= pts.length - 1 || idx < 1) continue;
            const pt = pts[idx];
            if (!pt || pt.scale < 0.10) continue;

            const roadName = pt.road;
            const fontSize = Math.max(7, 11 * pt.scale);

            // Calculate angle from consecutive points
            const pt2 = pts[Math.min(idx + 5, pts.length - 1)];
            const angle = Math.atan2(pt2.y - pt.y, pt2.x - pt.x);

            ctx.save();
            ctx.translate(pt.x, pt.y - 2 * pt.scale);
            ctx.rotate(angle);

            // Background
            ctx.font = `500 ${fontSize}px Inter, Noto Sans TC, sans-serif`;
            const textW = ctx.measureText(roadName).width;
            ctx.fillStyle = COLORS.labelBg;
            ctx.fillRect(-textW / 2 - 3, -fontSize / 2 - 2, textW + 6, fontSize + 4);

            // Text
            ctx.fillStyle = COLORS.labelText;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(roadName, 0, 0);

            ctx.restore();
        }
    }

    // ===================== Side Street Labels =====================

    function drawSideStreetLabels(pts, hScale, roadHW, crossInterval) {
        let sideIdx = 0;
        for (let d = crossInterval; d < VIEW_DIST - 0.1; d += crossInterval * 2) {
            const idx = Math.round((d + BEHIND_DIST) / SAMPLE_STEP);
            if (idx >= pts.length || idx < 0) continue;
            const pt = pts[idx];
            if (!pt || pt.scale < 0.12) continue;

            const streetName = SIDE_STREET_NAMES[sideIdx % SIDE_STREET_NAMES.length];
            sideIdx++;
            const fontSize = Math.max(6, 9 * pt.scale);
            const roadEdge = (ROAD_HW_KM + 0.006) * pt.scale * hScale;

            // Label on right side, perpendicular
            ctx.save();
            ctx.translate(pt.x + roadEdge + 15 * pt.scale, pt.y);
            ctx.rotate(-Math.PI / 2);

            ctx.font = `400 ${fontSize}px Inter, Noto Sans TC, sans-serif`;
            ctx.fillStyle = 'rgba(120,120,120,0.7)';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(streetName, 0, 0);

            ctx.restore();
        }
    }

    // ===================== Lane Line Drawing =====================
    function drawLaneLine(pts, offsetKm, style, color, baseW, hScale) {
        ctx.strokeStyle = color;
        if (style === 'solid') {
            ctx.beginPath();
            for (let i = 0; i < pts.length; i++) {
                const off = offsetKm * pts[i].scale * hScale;
                ctx.lineWidth = Math.max(0.3, baseW * pts[i].scale);
                if (i === 0) ctx.moveTo(pts[i].x + off, pts[i].y);
                else ctx.lineTo(pts[i].x + off, pts[i].y);
            }
            ctx.stroke();
        } else {
            const CYCLE = 0.015;
            for (let i = 0; i < pts.length - 1; i++) {
                if (pts[i].d < 0) continue;
                if (Math.floor(pts[i].d / CYCLE) % 2 !== 0) continue;
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
        for (const p of ROUTE) { mnLa = Math.min(mnLa, p.lat); mxLa = Math.max(mxLa, p.lat); mnLo = Math.min(mnLo, p.lng); mxLo = Math.max(mxLo, p.lng); }
        const pLa = (mxLa - mnLa) * 0.12, pLo = (mxLo - mnLo) * 0.12;
        return { minLat: mnLa - pLa, maxLat: mxLa + pLa, minLng: mnLo - pLo, maxLng: mxLo + pLo };
    }
    function toCanvasCoord(lat, lng) {
        if (!bounds) bounds = getCanvasBounds();
        return { x: ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * cw, y: ch - ((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * ch };
    }

    function drawOverviewMap() {
        const w = cw, h = ch;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = COLORS.terrain; ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = 'rgba(200,210,190,0.3)'; ctx.lineWidth = 0.5;
        for (let x = 0; x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
        for (let y = 0; y < h; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

        // Route (undriven)
        ctx.beginPath(); ctx.strokeStyle = COLORS.roadBorder; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        for (let i = 0; i < ROUTE.length; i++) { const p = toCanvasCoord(ROUTE[i].lat, ROUTE[i].lng); if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }
        ctx.stroke();
        ctx.beginPath(); ctx.strokeStyle = COLORS.roadFill; ctx.lineWidth = 4;
        for (let i = 0; i < ROUTE.length; i++) { const p = toCanvasCoord(ROUTE[i].lat, ROUTE[i].lng); if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }
        ctx.stroke();

        // Driven portion
        if (distanceTravelled > 0) {
            ctx.beginPath(); ctx.strokeStyle = COLORS.routeBlue; ctx.lineWidth = 5;
            ctx.shadowColor = 'rgba(66,133,244,0.4)'; ctx.shadowBlur = 10;
            for (let i = 0; i < ROUTE.length; i++) {
                if (ROUTE[i].dist > distanceTravelled) { if (i > 0) { const ep = getPositionAtDist(distanceTravelled); const epc = toCanvasCoord(ep.lat, ep.lng); ctx.lineTo(epc.x, epc.y); } break; }
                const p = toCanvasCoord(ROUTE[i].lat, ROUTE[i].lng); if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
            }
            ctx.stroke(); ctx.shadowBlur = 0;
        }

        // Labels
        for (const wp of ROUTE) {
            if (!wp.label) continue;
            const p = toCanvasCoord(wp.lat, wp.lng);
            ctx.fillStyle = wp.dist <= distanceTravelled ? COLORS.routeBlue : 'rgba(100,100,100,0.6)';
            ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill();
            ctx.font = '500 11px Inter, Noto Sans TC, sans-serif';
            ctx.fillStyle = wp.dist <= distanceTravelled ? '#333' : 'rgba(80,80,80,0.8)';
            ctx.textAlign = 'left'; ctx.fillText(wp.label, p.x + 12, p.y + 4);
        }

        // Vehicle
        const carPos2 = getPositionAtDist(distanceTravelled);
        const cp = toCanvasCoord(carPos2.lat, carPos2.lng);
        const vGlow = ctx.createRadialGradient(cp.x, cp.y, 0, cp.x, cp.y, 25);
        vGlow.addColorStop(0, 'rgba(66,133,244,0.4)'); vGlow.addColorStop(1, 'rgba(66,133,244,0)');
        ctx.fillStyle = vGlow; ctx.beginPath(); ctx.arc(cp.x, cp.y, 25, 0, Math.PI * 2); ctx.fill();

        let angle = 0;
        if (distanceTravelled < TOTAL_DISTANCE) { const np = getPositionAtDist(Math.min(distanceTravelled + 2, TOTAL_DISTANCE)); const npc = toCanvasCoord(np.lat, np.lng); angle = Math.atan2(npc.y - cp.y, npc.x - cp.x); }
        ctx.save(); ctx.translate(cp.x, cp.y); ctx.rotate(angle);
        ctx.fillStyle = COLORS.routeBlue; ctx.shadowColor = 'rgba(66,133,244,0.5)'; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-8, -7); ctx.lineTo(-5, 0); ctx.lineTo(-8, 7); ctx.closePath(); ctx.fill();
        ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(2, 0, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        // Start/End
        const sp = toCanvasCoord(ROUTE[0].lat, ROUTE[0].lng);
        ctx.fillStyle = '#0d904f'; ctx.beginPath(); ctx.arc(sp.x, sp.y, 7, 0, Math.PI * 2); ctx.fill();
        ctx.font = '700 10px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('START', sp.x, sp.y - 13);
        const ep = toCanvasCoord(ROUTE[ROUTE.length - 1].lat, ROUTE[ROUTE.length - 1].lng);
        ctx.fillStyle = '#EA4335'; ctx.beginPath(); ctx.arc(ep.x, ep.y, 7, 0, Math.PI * 2); ctx.fill();
        ctx.font = '700 10px Inter, sans-serif'; ctx.fillStyle = '#EA4335'; ctx.fillText('FINISH', ep.x, ep.y - 13);
    }

    // ===================== Main Draw =====================
    function drawMap() {
        if (!ctx) return;
        ctx.clearRect(0, 0, cw, ch);
        renderMode === 'follow' ? drawFollowView() : drawOverviewMap();
    }

    // ===================== HUD =====================
    function updateHUD() {
        const pos = getPositionAtDist(distanceTravelled);
        const remaining = Math.max(0, TOTAL_DISTANCE - distanceTravelled);
        const etaMin = Math.round((remaining / SPEED_KMHR) * 60);
        const currentSpeed = running && !paused ? SPEED_KMHR : 0;

        if (renderMode !== 'follow') {
            if (hudTurnCard) hudTurnCard.classList.add('hidden');
            if (hudOverlay) hudOverlay.classList.remove('visible');
            if (hudSpeedCircle) hudSpeedCircle.classList.remove('visible');
            if (hudRoad) hudRoad.textContent = pos.road;
            if (hudKm) hudKm.textContent = pos.road.includes('國道') ? `${pos.km}K` : `${Math.round(distanceTravelled)}km`;
            if (hudSpeed) hudSpeed.textContent = currentSpeed;
            if (hudEta) hudEta.textContent = etaMin > 60 ? `${Math.floor(etaMin / 60)}時${etaMin % 60}分` : `${etaMin}分`;
            if (hudDist) hudDist.textContent = `${remaining.toFixed(1)}`;
            return;
        }

        if (hudSpeedVal) hudSpeedVal.textContent = currentSpeed;
        if (hudBottomTime) hudBottomTime.textContent = etaMin > 60 ? `${Math.floor(etaMin / 60)} 時 ${etaMin % 60} 分` : `${etaMin} 分`;
        if (hudBottomDist) hudBottomDist.textContent = remaining >= 1 ? `${remaining.toFixed(1)} 公里` : `${Math.round(remaining * 1000)} 公尺`;
        if (hudBottomEta) { const n = new Date(); n.setMinutes(n.getMinutes() + etaMin); hudBottomEta.textContent = `${n.getHours().toString().padStart(2,'0')}:${n.getMinutes().toString().padStart(2,'0')}`; }

        const turn = getNextTurn(distanceTravelled);
        if (turn.roadName && turn.distance < 8) {
            const arrow = getTurnArrow(turn.angle);
            if (hudTurnIcon) hudTurnIcon.textContent = arrow.icon;
            if (hudTurnDist) hudTurnDist.textContent = turn.distance < 1 ? `${Math.round(turn.distance * 1000)} 公尺後` : `${turn.distance.toFixed(1)} 公里後`;
            if (hudTurnRoad) hudTurnRoad.textContent = turn.roadName;
            if (hudTurnCard) hudTurnCard.classList.remove('hidden');
        } else {
            if (hudTurnIcon) hudTurnIcon.textContent = '⬆';
            if (hudTurnDist) hudTurnDist.textContent = pos.road.includes('國道') ? `${pos.road} ${pos.km}K` : pos.road;
            if (hudTurnRoad) hudTurnRoad.textContent = '持續直行';
            if (hudTurnCard) hudTurnCard.classList.remove('hidden');
        }

        if (hudRoad) hudRoad.textContent = pos.road;
        if (hudKm) hudKm.textContent = pos.road.includes('國道') ? `${pos.km}K` : `${Math.round(distanceTravelled)}km`;
        if (hudSpeed) hudSpeed.textContent = currentSpeed;
        if (hudEta) hudEta.textContent = etaMin > 60 ? `${Math.floor(etaMin / 60)}時${etaMin % 60}分` : `${etaMin}分`;
        if (hudDist) hudDist.textContent = `${remaining.toFixed(1)}`;
    }

    // ===================== Animation =====================
    function tick(ts) {
        if (!running || paused) return;
        if (lastTimestamp === null) lastTimestamp = ts;
        const dt = (ts - lastTimestamp) / 1000;
        lastTimestamp = ts;
        distanceTravelled += SPEED_KMS * dt;
        if (distanceTravelled >= TOTAL_DISTANCE) {
            distanceTravelled = TOTAL_DISTANCE; running = false; paused = false;
            drawMap(); updateHUD(); onArrival(); updateSimButton(); return;
        }
        drawMap(); updateHUD();
        animFrameId = requestAnimationFrame(tick);
    }

    function onArrival() {
        const dest = ROUTE[ROUTE.length - 1]; const label = dest.label || '目的地';
        if (hudRoad) hudRoad.textContent = `🎉 已到達${label}！`;
        if (hudKm) hudKm.textContent = '到達';
        if (hudSpeed) hudSpeed.textContent = '0';
        if (hudEta) hudEta.textContent = '0分';
        if (hudDist) hudDist.textContent = '0';
        if (hudTurnIcon) hudTurnIcon.textContent = '🏁';
        if (hudTurnDist) hudTurnDist.textContent = '已到達目的地';
        if (hudTurnRoad) hudTurnRoad.textContent = label;
        if (hudSpeedVal) hudSpeedVal.textContent = '0';
        if (hudBottomTime) hudBottomTime.textContent = '0 分';
        if (hudBottomDist) hudBottomDist.textContent = '0 公尺';
        if (window.Socket) window.Socket.sendMessage({ content: `🎉 已到達目的地：${label}！全程約 ${TOTAL_DISTANCE} 公里。`, category: 'other', speed_level: null });
    }

    // ===================== Controls =====================
    function showGmapHud() { if (hudOverlay) hudOverlay.classList.add('visible'); if (hudSpeedCircle) hudSpeedCircle.classList.add('visible'); }
    function hideGmapHud() { if (hudOverlay) hudOverlay.classList.remove('visible'); if (hudSpeedCircle) hudSpeedCircle.classList.remove('visible'); if (hudTurnCard) hudTurnCard.classList.add('hidden'); }

    function updateSimButton() {
        if (!simBtn) return;
        const label = simBtn.querySelector('.sim-btn-label');
        const icon = simBtn.querySelector('.sim-btn-icon');
        if (running && !paused) { if (label) label.textContent = '暫停模擬'; if (icon) icon.textContent = '⏸'; simBtn.classList.add('running'); simBtn.classList.remove('paused'); }
        else if (running && paused) { if (label) label.textContent = '繼續模擬'; if (icon) icon.textContent = '▶'; simBtn.classList.remove('running'); simBtn.classList.add('paused'); }
        else if (distanceTravelled >= TOTAL_DISTANCE) { if (label) label.textContent = '重新模擬'; if (icon) icon.textContent = '🔄'; simBtn.classList.remove('running', 'paused'); }
        else { if (label) label.textContent = '開始模擬'; if (icon) icon.textContent = '▶'; simBtn.classList.remove('running', 'paused'); }
    }

    function start() {
        if (distanceTravelled >= TOTAL_DISTANCE || distanceTravelled === 0) {
            ROUTE = generateRandomRoute(); TOTAL_DISTANCE = ROUTE[ROUTE.length - 1].dist;
            _seed = Math.floor(Math.random() * 100000); bounds = null; distanceTravelled = 0;
        }
        running = true; paused = false; lastTimestamp = null; renderMode = 'follow';
        if (hudPanel) hudPanel.classList.add('visible');
        showGmapHud(); updateSimButton();
        animFrameId = requestAnimationFrame(tick);
        if (distanceTravelled === 0 && window.Socket) {
            window.Socket.sendMessage({ content: `🚗 開始導航模擬：${ROUTE[0].label||'起點'} → ${ROUTE[ROUTE.length-1].label||'目的地'}（約${TOTAL_DISTANCE}公里）`, category: 'other', speed_level: null });
        }
    }

    function pause() { paused = true; lastTimestamp = null; if (animFrameId) cancelAnimationFrame(animFrameId); updateSimButton(); }

    function reset() {
        running = false; paused = false; distanceTravelled = 0; lastTimestamp = null; renderMode = 'overview';
        if (animFrameId) cancelAnimationFrame(animFrameId);
        ROUTE = generateRandomRoute(); TOTAL_DISTANCE = ROUTE[ROUTE.length - 1].dist;
        _seed = Math.floor(Math.random() * 100000); bounds = null;
        hideGmapHud(); updateSimButton(); drawMap(); updateHUD();
    }

    function toggleSim() {
        if (!running) start();
        else if (!paused) pause();
        else { running = true; paused = false; lastTimestamp = null; updateSimButton(); animFrameId = requestAnimationFrame(tick); }
    }

    function getCurrentLocation() { const p = getPositionAtDist(distanceTravelled); return p.road.includes('國道') ? `${p.road} ${p.km}K` : `${p.road} ${Math.round(distanceTravelled)}km處`; }
    function isRunning() { return running && !paused; }

    // ===================== Init =====================
    function init() {
        if (!canvas || !ctx) return;
        resizeCanvas();
        window.addEventListener('resize', () => { resizeCanvas(); bounds = null; drawMap(); });
        if (simBtn) simBtn.addEventListener('click', toggleSim);
        drawMap(); updateHUD(); updateSimButton();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    window.NavSim = { start, pause, reset, toggleSim, getCurrentLocation, isRunning };
})();
