/**
 * map-canvas.js — Google Maps 導航畫面完整還原
 *
 * 模擬真實 Google Maps 手機導航畫面：
 * 上半部：第一人稱行車視角（街景感）
 * 下半部：2D 俯視地圖 + 藍色路線（逢甲大學→台北101）
 *
 * 與 navigation.js 的路段資料連動更新 HUD。
 */

(function () {
    const canvas = document.getElementById('map-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // ===================== 畫布尺寸 =====================
    function resize() {
        canvas.width  = canvas.parentElement.clientWidth  || 430;
        canvas.height = canvas.parentElement.clientHeight || 520;
    }
    resize();
    window.addEventListener('resize', resize);

    // ===================== 動畫狀態 =====================
    let scrollY    = 0;
    let frameCount = 0;
    const SCROLL   = 1.2;

    // ===================== 路線定義（逢甲→台北101） =====================
    // 座標為比例值 [0,1]，模擬台灣西部路線
    const ROUTE_PTS = [
        [0.48, 0.92], // 逢甲大學（台中西屯）
        [0.47, 0.88], // 黎明路
        [0.46, 0.84], // 環中路
        [0.44, 0.78], // 中港交流道
        [0.43, 0.72], // 國道1號入口
        [0.42, 0.66], // 苗栗頭份
        [0.41, 0.60], // 苗栗
        [0.40, 0.54], // 竹南
        [0.40, 0.47], // 新竹
        [0.41, 0.40], // 桃園
        [0.42, 0.33], // 林口
        [0.43, 0.26], // 五股
        [0.44, 0.20], // 承德路
        [0.46, 0.14], // 中山北路
        [0.48, 0.10], // 忠孝東路
        [0.50, 0.07], // 信義路
        [0.51, 0.05], // 台北101
    ];

    // 路線上各城市標籤
    const CITY_LABELS = [
        { pt: 12, text: '五股' },
        { pt: 10, text: '林口' },
        { pt: 9,  text: '桃園' },
        { pt: 8,  text: '新竹' },
        { pt: 6,  text: '苗栗' },
        { pt: 4,  text: '豐原' },
    ];

    // ===================== 地圖物件（俯視） =====================
    // 道路（水平/垂直線）
    const ROADS = [
        { x1:0.0, y1:0.88, x2:1.0, y2:0.88 }, // 台中橫向
        { x1:0.0, y1:0.47, x2:1.0, y2:0.47 }, // 新竹橫向
        { x1:0.0, y1:0.20, x2:1.0, y2:0.20 }, // 台北橫向
        { x1:0.0, y1:0.07, x2:1.0, y2:0.07 }, // 信義區橫向
        { x1:0.20, y1:0.0, x2:0.20, y2:1.0 }, // 縱向1
        { x1:0.60, y1:0.0, x2:0.60, y2:1.0 }, // 縱向2
        { x1:0.75, y1:0.0, x2:0.75, y2:1.0 }, // 縱向3
    ];

    // 城市區塊（綠地/建成區）
    const CITY_BLOCKS = [
        { x:0.05, y:0.82, w:0.12, h:0.14, color:'#d8ebd0' },
        { x:0.62, y:0.82, w:0.20, h:0.12, color:'#d8ebd0' },
        { x:0.05, y:0.40, w:0.14, h:0.14, color:'#d4e8cc' },
        { x:0.62, y:0.38, w:0.22, h:0.16, color:'#d4e8cc' },
        { x:0.05, y:0.10, w:0.15, h:0.18, color:'#cce4c8' },
        { x:0.55, y:0.08, w:0.30, h:0.18, color:'#cce4c8' },
        { x:0.25, y:0.04, w:0.20, h:0.10, color:'#c8e2c4' },
    ];

    // ======================== 繪製：俯視地圖 ========================

    function drawMapBackground(W, H, offsetY) {
        // 白底地圖背景
        ctx.fillStyle = '#f0ede8'; // Google Maps 淺黃灰底色
        ctx.fillRect(0, offsetY, W, H - offsetY);

        // 綠地/城市區塊
        CITY_BLOCKS.forEach(b => {
            ctx.fillStyle = b.color;
            ctx.fillRect(b.x * W, offsetY + b.y * (H - offsetY), b.w * W, b.h * (H - offsetY));
        });

        // 背景道路（灰色細線）
        ROADS.forEach(r => {
            ctx.beginPath();
            ctx.moveTo(r.x1 * W, offsetY + r.y1 * (H - offsetY));
            ctx.lineTo(r.x2 * W, offsetY + r.y2 * (H - offsetY));
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 5;
            ctx.stroke();
            ctx.strokeStyle = '#d0ccc5';
            ctx.lineWidth = 2;
            ctx.stroke();
        });
    }

    function drawRouteOnMap(W, H, offsetY, carProgress) {
        const mapH = H - offsetY;

        // 路線陰影（Google Maps 藍色路線的深藍邊框）
        ctx.beginPath();
        ROUTE_PTS.forEach(([x, y], i) => {
            const sx = x * W;
            const sy = offsetY + y * mapH;
            if (i === 0) ctx.moveTo(sx, sy);
            else ctx.lineTo(sx, sy);
        });
        ctx.strokeStyle = '#1a56b8';
        ctx.lineWidth = 11;
        ctx.lineCap  = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        // 路線主體（藍色）
        ctx.beginPath();
        ROUTE_PTS.forEach(([x, y], i) => {
            const sx = x * W;
            const sy = offsetY + y * mapH;
            if (i === 0) ctx.moveTo(sx, sy);
            else ctx.lineTo(sx, sy);
        });
        ctx.strokeStyle = '#4285f4';
        ctx.lineWidth = 8;
        ctx.stroke();

        // 已走過的路段（較淡）
        const passedIdx = Math.floor(carProgress * (ROUTE_PTS.length - 1));
        if (passedIdx > 0) {
            ctx.beginPath();
            ROUTE_PTS.slice(0, passedIdx + 1).forEach(([x, y], i) => {
                const sx = x * W;
                const sy = offsetY + y * mapH;
                if (i === 0) ctx.moveTo(sx, sy);
                else ctx.lineTo(sx, sy);
            });
            ctx.strokeStyle = '#8ab4f8';
            ctx.lineWidth = 8;
            ctx.stroke();
        }
    }

    function drawMapLabels(W, H, offsetY) {
        const mapH = H - offsetY;

        // 城市名標籤
        CITY_LABELS.forEach(({ pt, text }) => {
            const [x, y] = ROUTE_PTS[pt];
            const sx = x * W + 10;
            const sy = offsetY + y * mapH;

            ctx.font = `bold 10px Inter, 'Noto Sans TC', sans-serif`;
            ctx.fillStyle = '#444';
            ctx.fillText(text, sx, sy + 3);
        });

        // 起點標籤
        const [sx0, sy0] = ROUTE_PTS[0];
        drawMapPin(sx0 * W, offsetY + sy0 * mapH, '#34a853', '逢甲大學');

        // 終點標籤
        const [sx1, sy1] = ROUTE_PTS[ROUTE_PTS.length - 1];
        drawMapPin(sx1 * W, offsetY + sy1 * mapH, '#ea4335', '台北101');

        // 路名標記（台灣主要路段）
        const roadLabels = [
            { x: 0.35, y: 0.62, text: '國道1號' },
            { x: 0.32, y: 0.35, text: '五楊快速' },
        ];
        roadLabels.forEach(({ x, y, text }) => {
            const sx = x * W;
            const sy = offsetY + y * mapH;
            const tw = ctx.measureText(text).width + 12;
            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            ctx.beginPath();
            ctx.roundRect(sx - 4, sy - 10, tw, 15, 4);
            ctx.fill();
            ctx.font = `bold 9px Inter, sans-serif`;
            ctx.fillStyle = '#555';
            ctx.fillText(text, sx + 2, sy);
        });
    }

    function drawMapPin(x, y, color, label) {
        // 圓點
        ctx.beginPath();
        ctx.arc(x, y, 7, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 標籤
        const text = label;
        ctx.font = `bold 10px Inter, 'Noto Sans TC', sans-serif`;
        const tw = ctx.measureText(text).width + 12;
        const lx = x + 10, ly = y;

        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(lx - 4, ly - 11, tw, 16, 5);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#222';
        ctx.fillText(text, lx + 2, ly);
    }

    function drawCarOnMap(W, H, offsetY, progress) {
        const idx   = Math.min(Math.floor(progress * (ROUTE_PTS.length - 1)), ROUTE_PTS.length - 2);
        const t     = (progress * (ROUTE_PTS.length - 1)) - idx;
        const [x0, y0] = ROUTE_PTS[idx];
        const [x1, y1] = ROUTE_PTS[idx + 1];
        const cx = (x0 + (x1 - x0) * t) * W;
        const cy = offsetY + (y0 + (y1 - y0) * t) * (H - offsetY);

        // 精準度光暈
        ctx.beginPath();
        ctx.arc(cx, cy, 18, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(66,133,244,0.18)';
        ctx.fill();

        // 方向計算
        const angle = Math.atan2(y1 - y0, x1 - x0);

        // 白底藍箭頭（Google Maps 車輛指示器）
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle + Math.PI / 2);

        // 白外圈
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;

        // 藍圓
        ctx.beginPath();
        ctx.arc(0, 0, 7, 0, Math.PI * 2);
        ctx.fillStyle = '#4285f4';
        ctx.fill();

        // 方向三角
        ctx.beginPath();
        ctx.moveTo(0, -12);
        ctx.lineTo(-5, -5);
        ctx.lineTo(5, -5);
        ctx.closePath();
        ctx.fillStyle = '#4285f4';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.restore();
    }

    // ======================== 繪製：街景視角 ========================

    function drawStreetView(W, viewH) {
        // 天空
        const skyGrad = ctx.createLinearGradient(0, 0, 0, viewH * 0.55);
        skyGrad.addColorStop(0, '#c8dcf0');
        skyGrad.addColorStop(1, '#ddeeff');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, W, viewH * 0.55);

        // 遠景山脈/地平線
        ctx.fillStyle = '#b8cce0';
        ctx.beginPath();
        ctx.moveTo(0, viewH * 0.42);
        ctx.lineTo(W * 0.15, viewH * 0.35);
        ctx.lineTo(W * 0.3,  viewH * 0.40);
        ctx.lineTo(W * 0.45, viewH * 0.33);
        ctx.lineTo(W * 0.6,  viewH * 0.38);
        ctx.lineTo(W * 0.75, viewH * 0.36);
        ctx.lineTo(W,         viewH * 0.42);
        ctx.lineTo(W, viewH * 0.55);
        ctx.lineTo(0, viewH * 0.55);
        ctx.closePath();
        ctx.fill();

        // 地面（路面）
        const roadGrad = ctx.createLinearGradient(0, viewH * 0.55, 0, viewH);
        roadGrad.addColorStop(0, '#8a9090');
        roadGrad.addColorStop(1, '#707878');
        ctx.fillStyle = roadGrad;
        ctx.fillRect(0, viewH * 0.55, W, viewH * 0.45);

        // 透視路面梯形
        const horizonY = viewH * 0.56;
        const carY     = viewH + 5;
        const vpX      = W * 0.5;

        // 暗色路面底
        ctx.beginPath();
        ctx.moveTo(vpX - W * 0.03, horizonY);
        ctx.lineTo(vpX + W * 0.03, horizonY);
        ctx.lineTo(W, carY);
        ctx.lineTo(0, carY);
        ctx.closePath();
        ctx.fillStyle = '#6a7272';
        ctx.fill();

        // 路緣石
        ctx.beginPath();
        ctx.moveTo(vpX - W * 0.03, horizonY);
        ctx.lineTo(0, carY);
        ctx.strokeStyle = '#888';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(vpX + W * 0.03, horizonY);
        ctx.lineTo(W, carY);
        ctx.stroke();

        // 車道中線（動畫）
        drawPerspectiveLanes(W, horizonY, carY, vpX);

        // 左側建物（台灣街道樣式）
        drawStreetBuildings(W, viewH, horizonY, vpX, false);
        // 右側建物
        drawStreetBuildings(W, viewH, horizonY, vpX, true);

        // 天際線電線/招牌模擬
        drawStreetDetails(W, viewH, horizonY);
    }

    function drawPerspectiveLanes(W, horizonY, carY, vpX) {
        const DASH_SPACING = 65;
        const DASH_LEN     = 30;
        const phase = (scrollY * 1.5) % DASH_SPACING;

        for (let i = 0; i < 8; i++) {
            const rawFrac = (i * DASH_SPACING - phase) / (DASH_SPACING * 5);
            if (rawFrac <= 0.02 || rawFrac >= 0.96) continue;

            const y0 = horizonY + (carY - horizonY) * rawFrac;
            const y1 = horizonY + (carY - horizonY) * Math.min(rawFrac + DASH_LEN / (DASH_SPACING * 5), 0.98);
            const hw = 1.5 + rawFrac * 4;

            ctx.beginPath();
            ctx.moveTo(vpX - hw, y0);
            ctx.lineTo(vpX - hw, y1);
            ctx.strokeStyle = `rgba(255,255,255,${0.6 * rawFrac + 0.1})`;
            ctx.lineWidth = Math.max(1, hw * 0.5);
            ctx.stroke();
        }
    }

    function drawStreetBuildings(W, viewH, horizonY, vpX, isRight) {
        const sign    = isRight ? 1 : -1;
        const roadEdgeX = vpX + sign * W * 0.035;

        const BLDGS = [0.95, 0.85, 0.75, 0.60, 0.45, 0.30, 0.18];
        const HEIGHTS = [0.22, 0.28, 0.20, 0.32, 0.25, 0.24, 0.18];
        const COLORS  = ['#c4b8a8','#b8b0a0','#c8c0b0','#bab2a2','#d0c8b8','#c0b8a8','#bcb4a4'];
        const WIDTHS  = [0.12, 0.14, 0.10, 0.16, 0.12, 0.14, 0.10];

        BLDGS.forEach((depth, i) => {
            const groundY = horizonY + (viewH - horizonY) * depth;
            const scale   = depth;
            const bW      = WIDTHS[i] * W * scale;
            const bH      = HEIGHTS[i] * viewH * scale;
            const bX      = isRight ? roadEdgeX + scale * W * 0.02 : roadEdgeX - scale * W * 0.02 - bW;
            const bY      = groundY - bH;

            if (bY > viewH || bX < 0 || bX + bW > W) return;

            ctx.fillStyle = COLORS[i];
            ctx.fillRect(bX, bY, bW, bH);

            // 建物陰影面
            ctx.fillStyle = isRight ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.05)';
            ctx.fillRect(isRight ? bX + bW - bW * 0.12 : bX, bY, bW * 0.12, bH);

            // 窗戶
            const winRows = Math.floor(bH / (12 * scale));
            const winCols = Math.max(1, Math.floor(bW / (14 * scale)));
            for (let r = 0; r < Math.min(winRows, 4); r++) {
                for (let c = 0; c < Math.min(winCols, 3); c++) {
                    const wx = bX + (c + 0.5) * bW / (winCols + 0.5);
                    const wy = bY + (r + 0.6) * bH / (winRows + 0.5);
                    const ww = Math.max(2, 5 * scale);
                    const wh = Math.max(2, 7 * scale);
                    ctx.fillStyle = Math.random() > 0.3 ? 'rgba(255,240,180,0.6)' : 'rgba(150,180,220,0.5)';
                    ctx.fillRect(wx - ww / 2, wy - wh / 2, ww, wh);
                }
            }

            // 路緣
            ctx.fillStyle = '#a09890';
            ctx.fillRect(bX, groundY, bW, 3 * scale);
        });
    }

    function drawStreetDetails(W, viewH, horizonY) {
        // 電線桿
        const polePositions = [0.12, 0.88];
        polePositions.forEach(px => {
            const x = px * W;
            const groundY = viewH * 0.9;
            ctx.strokeStyle = '#666';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(x, groundY);
            ctx.lineTo(x, horizonY + 5);
            ctx.stroke();
        });

        // 距離指引箭頭覆蓋（模擬 Google Maps 路線引導）
        const arrowY = horizonY + (viewH - horizonY) * 0.3;
        ctx.fillStyle = 'rgba(66,133,244,0.75)';
        ctx.beginPath();
        ctx.moveTo(W * 0.5, arrowY - 14);
        ctx.lineTo(W * 0.5 - 8, arrowY);
        ctx.lineTo(W * 0.5 + 8, arrowY);
        ctx.closePath();
        ctx.fill();
    }

    // ======================== 分隔線 ========================

    function drawDivider(W, divY) {
        // Google Maps 的街景/地圖分隔條
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, divY - 2, W, 4);

        // 拖拉把手
        const bw = 40, bh = 4;
        ctx.fillStyle = '#ccc';
        ctx.beginPath();
        ctx.roundRect(W / 2 - bw / 2, divY - bh / 2, bw, bh, 3);
        ctx.fill();
    }

    // ======================== 主渲染 ========================
    let carProgress = 0;

    function render() {
        resize();
        const W = canvas.width, H = canvas.height;

        // 分隔點：上 45% 街景，下 55% 地圖
        const divY = Math.floor(H * 0.44);

        ctx.clearRect(0, 0, W, H);

        // 1. 街景視角（上半）
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, W, divY);
        ctx.clip();
        drawStreetView(W, divY);
        ctx.restore();

        // 2. 俯視地圖（下半）
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, divY, W, H - divY);
        ctx.clip();
        drawMapBackground(W, H, divY);
        drawRouteOnMap(W, H, divY, carProgress);
        drawMapLabels(W, H, divY);
        drawCarOnMap(W, H, divY, carProgress);
        ctx.restore();

        // 3. 分隔線
        drawDivider(W, divY);

        // 推進動畫
        scrollY += SCROLL;
        frameCount++;
        carProgress = ((frameCount * 0.0004) % 1);

        requestAnimationFrame(render);
    }

    render();

    // ======================== 與 Navigation 模組連動 ========================
    if (window.Navigation) {
        window.Navigation.onRoadChange((info) => {
            const distEl   = document.getElementById('gmaps-turn-dist');
            const nameEl   = document.getElementById('gmaps-turn-name');
            const nextEl   = document.getElementById('gmaps-next-text');
            const progFill = document.getElementById('route-progress-fill');
            const carDot   = document.getElementById('route-car-dot');

            const remainKm = Math.round((1 - info.progress) * 158);
            const distStr  = info.isHighway
                ? `繼續直行 ${remainKm} km`
                : `直行 ${(Math.random() * 0.7 + 0.3).toFixed(1)} km`;

            if (distEl) distEl.textContent = distStr;
            if (nameEl) nameEl.textContent = info.road;
            if (nextEl) nextEl.textContent = `然後 ${info.nextTurnLabel || '直行'} ${info.nextRoad || ''}`;

            const pct = info.progress * 100;
            if (progFill) progFill.style.width = pct + '%';
            if (carDot)   carDot.style.left    = `calc(${pct}% - 10px)`;

            // 底部 ETA
            const etaMin = document.getElementById('gmaps-eta-min');
            const etaKm  = document.getElementById('gmaps-eta-km');
            const arrEl  = document.getElementById('gmaps-arrive-time');
            const minLeft = Math.round(remainKm * 0.75);
            const arrTime = new Date();
            arrTime.setMinutes(arrTime.getMinutes() + minLeft);
            if (etaMin) etaMin.textContent = minLeft;
            if (etaKm)  etaKm.textContent  = remainKm;
            if (arrEl)  arrEl.textContent  = arrTime.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });

            // 速限
            const spd = document.getElementById('gmaps-speed-num');
            if (spd) spd.textContent = info.isHighway ? '110' : '60';

            // 轉向箭頭
            updateArrow(info.turnType || 'straight');
        });
    }

    function updateArrow(type) {
        const svg = document.getElementById('gmaps-arrow-svg');
        if (!svg) return;
        const ARROWS = {
            'straight':   '<path d="M20 50L20 16M20 16L11 26M20 16L29 26" stroke="white" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>',
            'turn-right': '<path d="M13 50L13 30Q13 16 27 16M21 9L27 16L21 23" stroke="white" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>',
            'turn-left':  '<path d="M27 50L27 30Q27 16 13 16M19 9L13 16L19 23" stroke="white" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>',
            'ramp':       '<path d="M16 50L16 28Q18 16 26 16M20 9L26 16L20 23" stroke="white" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>',
            'arrive':     '<circle cx="20" cy="14" r="9" fill="white"/><path d="M20 23L20 50" stroke="white" stroke-width="5.5" stroke-linecap="round"/>',
        };
        svg.innerHTML = ARROWS[type] || ARROWS['straight'];
    }
})();
