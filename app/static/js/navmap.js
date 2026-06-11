/**
 * navmap.js — Animated GPS Navigation Simulation
 *
 * Features:
 *   - Procedural city grid (roads, blocks, parks, crosswalks)
 *   - Heading-up rotating camera that follows the car
 *   - Predefined looping route with L/R turns and straights
 *   - Smooth speed control (slow at turns, fast on straights)
 *   - HUD: speed, next-turn arrow, compass
 *   - Animated route overlay with flowing dashes
 */

(function () {
    const canvas = document.getElementById('map-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // ─── Resize ───────────────────────────────────────────────
    function resize() {
        canvas.width  = canvas.offsetWidth  || 430;
        canvas.height = canvas.offsetHeight || window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    // ─── Route Waypoints ─────────────────────────────────────
    // World-space coords: x = east (+right), y = south (+down)
    // So "going north" means y decreasing.
    // Road centers: 240n+25  (STEP=240, ROAD_W=50)
    // Straight sections extended ~4x vs previous route
    const WP = [
        { x:    25, y:     25 },   // 0 start        (n=0,  m=0)
        { x:    25, y:  -2855 },   // 1 north 2880   (n=0,  m=-12)
        { x:  2185, y:  -2855 },   // 2 right→east 2160 (n=9, m=-12)
        { x:  2185, y:    745 },   // 3 right→south 3600 (n=9, m=3)
        { x:   265, y:    745 },   // 4 right→west 1920 (n=1, m=3)
        { x:   265, y:    985 },   // 5 left→south 240  (n=1, m=4)
        { x:  -215, y:    985 },   // 6 right→west 480  (n=-1,m=4)
        { x:  -215, y:     25 },   // 7 right→north 960 (n=-1,m=0)
        { x:    25, y:     25 },   // 8 right→east 240  close loop
    ];

    // Build segments + cumulative lengths
    const SEGS = [];
    let ROUTE_LEN = 0;
    for (let i = 0; i < WP.length - 1; i++) {
        const a = WP[i], b = WP[i + 1];
        const dx = b.x - a.x, dy = b.y - a.y;
        const len = Math.hypot(dx, dy);
        SEGS.push({ a, b, dx, dy, len, start: ROUTE_LEN, idx: i });
        ROUTE_LEN += len;
    }

    // Turn direction lookup for HUD
    const TURN_DIR = SEGS.map((seg, i) => {
        if (i >= SEGS.length - 1) return 'none';
        const next = SEGS[i + 1];
        const cross = seg.dx * next.dy - seg.dy * next.dx;
        return cross > 0 ? 'right' : 'left';
    });

    function posAt(traveled) {
        const d = ((traveled % ROUTE_LEN) + ROUTE_LEN) % ROUTE_LEN;
        let seg = SEGS[SEGS.length - 1];
        for (const s of SEGS) {
            if (d <= s.start + s.len + 0.01) { seg = s; break; }
        }
        const t   = Math.min((d - seg.start) / seg.len, 1);
        const x   = seg.a.x + seg.dx * t;
        const y   = seg.a.y + seg.dy * t;
        const hdg = Math.atan2(seg.dx, -seg.dy);   // 0 = north (up)
        const rem = seg.len * (1 - t);              // dist to end of segment
        const turn = TURN_DIR[seg.idx] || 'none';
        return { x, y, hdg, rem, turn };
    }

    // ─── State ────────────────────────────────────────────────
    let traveled  = 0;
    let speed     = 65;         // world-units / sec (slower, more realistic)
    let camHdg    = 0;          // smoothed heading (radians)
    let lastTs    = null;
    let animOff   = 0;          // for route dash animation

    // ─── Map Constants ────────────────────────────────────────
    const ROAD_W = 50;           // road width
    const BLOCK  = 190;          // city block side
    const STEP   = BLOCK + ROAD_W;

    // Deterministic pseudo-random from grid coords
    function blockHash(gx, gy) {
        return Math.abs(Math.sin(gx * 127.1 + gy * 311.7) * 43758.5) | 0;
    }

    // ─── Drawing ─────────────────────────────────────────────

    function draw(ts) {
        if (!lastTs) lastTs = ts;
        const dt = Math.min((ts - lastTs) / 1000, 0.06);
        lastTs = ts;
        animOff = (animOff + dt * 120) % 40;

        // Update position
        const state = posAt(traveled);
        const slowZone = state.rem < 100;
        const targetSpd = slowZone ? 32 : 70;
        speed += (targetSpd - speed) * dt * 2.8;
        traveled += speed * dt;

        // Smooth heading (shortest arc)
        let dh = posAt(traveled).hdg - camHdg;
        while (dh >  Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        camHdg += dh * Math.min(dt * 3.8, 1);

        // Clear
        ctx.fillStyle = '#080b14';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // World scene
        drawWorld(state.x, state.y, camHdg);

        // HUD overlays
        drawHUD(state, ts);

        requestAnimationFrame(draw);
    }

    // ── World Scene ──────────────────────────────────────────
    function drawWorld(cx, cy, hdg) {
        const W = canvas.width, H = canvas.height;
        // Right-lane driving:
        // Camera anchors on road center (slightly left of screen centre)
        // so the car arrow appears in the right half of the road.
        const laneOff = ROAD_W * 0.28;          // ≈ 14 px right-lane offset
        const carScreenX = W * 0.5;             // car always drawn here
        const ox = carScreenX - laneOff;        // camera tracks road-centre
        const oy = H * 0.58;

        ctx.save();
        ctx.translate(ox, oy);
        ctx.rotate(-hdg);
        ctx.translate(-cx, -cy);

        const VIEW = 1200;
        const gx0 = Math.floor((cx - VIEW) / STEP) * STEP;
        const gy0 = Math.floor((cy - VIEW) / STEP) * STEP;
        const gx1 = Math.ceil( (cx + VIEW) / STEP) * STEP;
        const gy1 = Math.ceil( (cy + VIEW) / STEP) * STEP;

        // 1. City blocks
        for (let gx = gx0; gx <= gx1; gx += STEP) {
            for (let gy = gy0; gy <= gy1; gy += STEP) {
                const bx = gx + ROAD_W;
                const by = gy + ROAD_W;
                const h  = blockHash(gx, gy);
                if (h % 10 === 0) {
                    drawPark(bx, by, h);
                } else {
                    drawBlock(bx, by, h);
                }
            }
        }

        // 2. Road surface
        ctx.fillStyle = '#151b28';
        for (let gy = gy0; gy <= gy1; gy += STEP) {
            ctx.fillRect(gx0, gy, gx1 - gx0, ROAD_W);
        }
        for (let gx = gx0; gx <= gx1; gx += STEP) {
            ctx.fillRect(gx, gy0, ROAD_W, gy1 - gy0);
        }

        // 3. Road edge lines
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([]);
        for (let gy = gy0; gy <= gy1; gy += STEP) {
            ctx.beginPath();
            ctx.moveTo(gx0, gy);          ctx.lineTo(gx1, gy);
            ctx.moveTo(gx0, gy + ROAD_W); ctx.lineTo(gx1, gy + ROAD_W);
            ctx.stroke();
        }
        for (let gx = gx0; gx <= gx1; gx += STEP) {
            ctx.beginPath();
            ctx.moveTo(gx, gy0);          ctx.lineTo(gx, gy1);
            ctx.moveTo(gx + ROAD_W, gy0); ctx.lineTo(gx + ROAD_W, gy1);
            ctx.stroke();
        }

        // 4. Center dashes
        ctx.strokeStyle = 'rgba(255,255,255,0.28)';
        ctx.lineWidth = 2;
        ctx.setLineDash([18, 16]);
        for (let gy = gy0; gy <= gy1; gy += STEP) {
            ctx.beginPath();
            ctx.moveTo(gx0, gy + ROAD_W / 2);
            ctx.lineTo(gx1, gy + ROAD_W / 2);
            ctx.stroke();
        }
        for (let gx = gx0; gx <= gx1; gx += STEP) {
            ctx.beginPath();
            ctx.moveTo(gx + ROAD_W / 2, gy0);
            ctx.lineTo(gx + ROAD_W / 2, gy1);
            ctx.stroke();
        }
        ctx.setLineDash([]);

        // 5. Crosswalks
        drawCrosswalks(gx0, gy0, gx1, gy1);

        // 6. Route overlay — shifted to right lane (same offset as car)
        ctx.save();
        ctx.translate(
            Math.cos(hdg) * laneOff,
            Math.sin(hdg) * laneOff
        );
        drawRoute();
        ctx.restore();

        ctx.restore();

        // 7. Car — drawn at screen centre (right of road-centre anchor)
        drawCar(carScreenX, oy);

        // 8. Vignette
        drawVignette(W, H);
    }

    function drawBlock(bx, by, h) {
        // Block background
        ctx.fillStyle = '#0b0e18';
        ctx.fillRect(bx, by, BLOCK, BLOCK);

        // 2×2 buildings inside
        const pad = 7, bw = (BLOCK - pad * 3) / 2;
        for (let r = 0; r < 2; r++) {
            for (let c = 0; c < 2; c++) {
                const bldH = (h ^ (r * 13 + c * 7)) % 14;
                const shade = 12 + bldH;
                ctx.fillStyle = `rgb(${shade},${shade + 2},${shade + 10})`;
                const x = bx + pad + c * (bw + pad);
                const y = by + pad + r * (bw + pad);
                ctx.fillRect(x, y, bw, bw);

                // Window glow
                if ((h + r + c) % 4 !== 0) {
                    ctx.fillStyle = 'rgba(255,210,110,0.055)';
                    ctx.fillRect(x + 4, y + 4, bw - 8, bw - 8);
                }
            }
        }
    }

    function drawPark(bx, by, h) {
        ctx.fillStyle = '#0c1a0e';
        ctx.fillRect(bx, by, BLOCK, BLOCK);

        // Trees (circles)
        const positions = [
            [0.2, 0.2], [0.5, 0.15], [0.8, 0.25],
            [0.15, 0.6], [0.5, 0.55], [0.85, 0.65],
            [0.3, 0.85], [0.7, 0.8],
        ];
        positions.forEach(([rx, ry], i) => {
            const tx = bx + rx * BLOCK;
            const ty = by + ry * BLOCK;
            const r  = 14 + ((h + i) % 6);
            ctx.fillStyle = (i % 3 === 0) ? '#112614' : '#0f2010';
            ctx.beginPath();
            ctx.arc(tx, ty, r, 0, Math.PI * 2);
            ctx.fill();
        });

        // Paths
        ctx.strokeStyle = 'rgba(180,160,120,0.07)';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(bx + BLOCK * 0.5, by);
        ctx.lineTo(bx + BLOCK * 0.5, by + BLOCK);
        ctx.moveTo(bx, by + BLOCK * 0.5);
        ctx.lineTo(bx + BLOCK, by + BLOCK * 0.5);
        ctx.stroke();
    }

    function drawCrosswalks(gx0, gy0, gx1, gy1) {
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        const sw = 5, sg = 5, cnt = 4;
        for (let gx = gx0; gx <= gx1; gx += STEP) {
            for (let gy = gy0; gy <= gy1; gy += STEP) {
                // Top side of intersection (horizontal stripes)
                for (let s = 0; s < cnt; s++) {
                    const sx = gx + ROAD_W + 5 + s * (sw + sg);
                    ctx.fillRect(sx, gy + 3, sw, ROAD_W - 6);
                    ctx.fillRect(sx, gy + ROAD_W + BLOCK + 3, sw, ROAD_W - 6);
                }
                // Left side (vertical stripes)
                for (let s = 0; s < cnt; s++) {
                    const sy = gy + ROAD_W + 5 + s * (sw + sg);
                    ctx.fillRect(gx + 3, sy, ROAD_W - 6, sw);
                    ctx.fillRect(gx + ROAD_W + BLOCK + 3, sy, ROAD_W - 6, sw);
                }
            }
        }
    }

    function drawStreetLights(gx0, gy0, gx1, gy1) {
        for (let gx = gx0; gx <= gx1; gx += STEP) {
            for (let gy = gy0; gy <= gy1; gy += STEP) {
                // Corner positions
                const corners = [
                    [gx + ROAD_W - 4,      gy + ROAD_W - 4],
                    [gx + ROAD_W + BLOCK + 4, gy + ROAD_W - 4],
                    [gx + ROAD_W - 4,      gy + ROAD_W + BLOCK + 4],
                    [gx + ROAD_W + BLOCK + 4, gy + ROAD_W + BLOCK + 4],
                ];
                corners.forEach(([lx, ly]) => {
                    const grd = ctx.createRadialGradient(lx, ly, 0, lx, ly, 22);
                    grd.addColorStop(0, 'rgba(255, 230, 150, 0.22)');
                    grd.addColorStop(1, 'rgba(255, 230, 150, 0)');
                    ctx.fillStyle = grd;
                    ctx.beginPath();
                    ctx.arc(lx, ly, 22, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.fillStyle = 'rgba(255, 230, 150, 0.9)';
                    ctx.beginPath();
                    ctx.arc(lx, ly, 2, 0, Math.PI * 2);
                    ctx.fill();
                });
            }
        }
    }

    function drawRoute() {
        // Outer glow
        ctx.strokeStyle = 'rgba(108, 99, 255, 0.18)';
        ctx.lineWidth = 24;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.setLineDash([]);
        traceRoute();
        ctx.stroke();

        // Main solid line
        ctx.strokeStyle = 'rgba(108, 99, 255, 0.72)';
        ctx.lineWidth = 11;
        traceRoute();
        ctx.stroke();
    }

    function traceRoute() {
        ctx.beginPath();
        WP.forEach((p, i) => {
            if (i === 0) ctx.moveTo(p.x, p.y);
            else         ctx.lineTo(p.x, p.y);
        });
    }

    function drawCar(ox, oy) {
        ctx.save();
        ctx.translate(ox, oy);

        // Headlight cone
        const cone = ctx.createRadialGradient(0, -20, 0, 0, -20, 55);
        cone.addColorStop(0, 'rgba(220, 235, 255, 0.14)');
        cone.addColorStop(1, 'rgba(220, 235, 255, 0)');
        ctx.fillStyle = cone;
        ctx.beginPath();
        ctx.arc(0, -20, 55, 0, Math.PI * 2);
        ctx.fill();

        // Accuracy ring
        const ring = ctx.createRadialGradient(0, 0, 14, 0, 0, 30);
        ring.addColorStop(0, 'rgba(108, 99, 255, 0.32)');
        ring.addColorStop(1, 'rgba(108, 99, 255, 0)');
        ctx.fillStyle = ring;
        ctx.beginPath();
        ctx.arc(0, 0, 30, 0, Math.PI * 2);
        ctx.fill();

        // Shadow
        ctx.shadowColor = '#6c63ff';
        ctx.shadowBlur = 14;

        // Arrow body
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = 'rgba(108, 99, 255, 0.8)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0,   -16);   // tip
        ctx.lineTo(10,   10);   // rear-right
        ctx.lineTo(0,    4);    // rear-indent
        ctx.lineTo(-10,  10);   // rear-left
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.restore();
    }

    function drawVignette(W, H) {
        const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.82);
        vg.addColorStop(0, 'rgba(0,0,0,0)');
        vg.addColorStop(1, 'rgba(0,0,0,0.52)');
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, W, H);
    }

    // ── HUD ─────────────────────────────────────────────────
    function drawHUD(state, ts) {
        const W = canvas.width, H = canvas.height;
        const kmh = Math.round(speed * 0.62);

        // ── Speed badge (right side, above quick buttons) ──
        drawSpeedBadge(W, H, kmh);

        // ── Turn indicator (top center) ──
        if (state.rem < 200) {
            drawTurnCard(W, state.rem, state.turn);
        }

        // ── Compass (top right) ──
        drawCompass(W, camHdg);
    }

    function drawSpeedBadge(W, H, kmh) {
        const bx = 14, by = 14;
        const bw = 70, bh = 54;

        ctx.save();
        // Pill background (top-left)
        roundRect(ctx, bx, by, bw, bh, 12);
        ctx.fillStyle = 'rgba(14, 17, 28, 0.85)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(108, 99, 255, 0.35)';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Speed number
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 26px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(kmh, bx + bw / 2, by + bh / 2 - 5);

        ctx.fillStyle = 'rgba(255,255,255,0.38)';
        ctx.font = '9px Inter, sans-serif';
        ctx.fillText('km/h', bx + bw / 2, by + bh - 9);

        ctx.restore();
    }

    function drawTurnCard(W, rem, turn) {
        if (turn === 'none') return;
        const dist = Math.round(rem);
        const label = turn === 'right' ? '右轉' : '左轉';
        const arrow = turn === 'right' ? '→' : '←';

        const cardW = 160, cardH = 52;
        const cx = W / 2, cy = 14;

        ctx.save();
        roundRect(ctx, cx - cardW / 2, cy, cardW, cardH, 14);
        ctx.fillStyle = 'rgba(14, 17, 28, 0.88)';
        ctx.fill();
        ctx.strokeStyle = turn === 'right'
            ? 'rgba(0, 210, 255, 0.5)'
            : 'rgba(108, 99, 255, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Arrow icon
        ctx.fillStyle = turn === 'right' ? '#00d2ff' : '#a09aff';
        ctx.font = 'bold 22px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(arrow, cx - cardW / 2 + 14, cy + cardH / 2);

        // Label + distance
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(label, cx - cardW / 2 + 46, cy + cardH / 2 - 7);

        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.font = '11px Inter, sans-serif';
        ctx.fillText(`${dist} m`, cx - cardW / 2 + 46, cy + cardH / 2 + 10);

        ctx.restore();
    }

    function drawCompass(W, hdg) {
        const cx = W - 30, cy = 68, r = 22;

        ctx.save();
        ctx.translate(cx, cy);

        // Background circle
        ctx.fillStyle = 'rgba(14,17,28,0.82)';
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Rotate so N always points to true north on screen
        ctx.rotate(hdg);

        // N (red)
        ctx.fillStyle = '#ff5252';
        ctx.font = 'bold 10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('N', 0, -(r - 8));

        // S
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.fillText('S', 0, r - 8);

        // Tick marks
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1;
        for (let a = 0; a < 360; a += 45) {
            const rad = (a * Math.PI) / 180;
            const inner = a % 90 === 0 ? r - 5 : r - 3;
            ctx.beginPath();
            ctx.moveTo(Math.sin(rad) * inner, -Math.cos(rad) * inner);
            ctx.lineTo(Math.sin(rad) * (r - 1), -Math.cos(rad) * (r - 1));
            ctx.stroke();
        }

        ctx.restore();
    }

    // ── Utility ────────────────────────────────────────────
    function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    // ── Start ─────────────────────────────────────────────
    requestAnimationFrame(draw);
})();
