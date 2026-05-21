'use strict';

/* ── FAB 狀態 ── */
const fab = document.getElementById('fab');
const ballBadge = document.getElementById('ball-badge');
let isPanel = false;
let unread = 3;

function openPanel() {
  isPanel = true;
  fab.classList.remove('is-ball');
  fab.classList.add('is-panel');
  unread = 0;
  ballBadge.textContent = '0';
  ballBadge.style.display = 'none';
}

function closePanel() {
  isPanel = false;
  fab.classList.remove('is-panel');
  fab.classList.add('is-ball');
}

// 點球 → 展開
document.getElementById('ball-view').addEventListener('click', (e) => {
  e.stopPropagation();
  openPanel();
});

// ✕ 按鈕 → 收回
document.getElementById('btn-close').addEventListener('click', (e) => {
  e.stopPropagation();
  closePanel();
});

/* ── 左下滑動手勢收起 ── */
let touchSX = 0, touchSY = 0;
fab.addEventListener('touchstart', (e) => {
  touchSX = e.touches[0].clientX;
  touchSY = e.touches[0].clientY;
}, { passive: true });

fab.addEventListener('touchend', (e) => {
  if (!isPanel) return;
  const dx = e.changedTouches[0].clientX - touchSX;
  const dy = e.changedTouches[0].clientY - touchSY;
  // 往左 + 往下 → 收起
  if (dx < -40 && dy > 30) closePanel();
}, { passive: true });

/* ── Tab 切換 ── */
const tabs = document.querySelectorAll('.tab');
const panes = document.querySelectorAll('.tab-pane');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    panes.forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('pane-' + tab.dataset.tab).classList.add('active');
  });
});

/* ── 路況篩選 ── */
document.querySelectorAll('.filter-chips .chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.filter-chips .chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    const f = chip.dataset.f;
    document.querySelectorAll('.msg-card').forEach(card => {
      card.style.display = (f === 'all' || card.dataset.type === f) ? 'flex' : 'none';
    });
  });
});

/* ── 確認按鈕 ── */
document.querySelectorAll('.mc-confirm').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.classList.contains('done')) return;
    const b = btn.querySelector('b');
    b.textContent = +b.textContent + 1;
    btn.classList.add('done');
    btn.innerHTML = '✅ 已確認 <b>' + b.textContent + '</b>';
  });
});

/* ── 快速回報 ── */
let sentCount = 0;
const cdLeft = document.getElementById('cd-left');

document.querySelectorAll('.qbtn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (sentCount >= 3) { showToast('⚠️ 已達上限，請 60 秒後再試'); return; }
    sentCount++;
    cdLeft.textContent = 3 - sentCount;
    if (sentCount >= 3) cdLeft.style.color = '#ef4444';
    btn.classList.add('sent');
    showToast('✅ 已發送：' + btn.dataset.msg.slice(0, 14));
    addCard(btn.dataset.msg, btn.dataset.type, '主駕駛');
    addMapToast(emojiOf(btn.dataset.type) + ' ' + btn.dataset.msg.slice(0, 10));
    setTimeout(() => {
      if (sentCount >= 3) { sentCount = 0; cdLeft.textContent = 3; cdLeft.style.color = ''; document.querySelectorAll('.qbtn').forEach(b => b.classList.remove('sent')); }
    }, 60000);
  });
});

/* ── 輸入 ── */
const msgInput = document.getElementById('msg-input');
const charCnt = document.getElementById('char-cnt');
let selType = 'traffic';

msgInput.addEventListener('input', () => {
  const l = msgInput.value.length;
  charCnt.textContent = l + '/100';
  charCnt.classList.toggle('warn', l >= 85);
});

document.querySelectorAll('.tchip').forEach(c => {
  c.addEventListener('click', () => {
    document.querySelectorAll('.tchip').forEach(x => x.classList.remove('active'));
    c.classList.add('active');
    selType = c.dataset.t;
  });
});

document.getElementById('btn-clear').addEventListener('click', () => {
  msgInput.value = ''; charCnt.textContent = '0/100'; charCnt.classList.remove('warn');
});

document.getElementById('btn-send').addEventListener('click', () => {
  const v = msgInput.value.trim();
  if (!v) { showToast('⚠️ 請輸入留言內容'); return; }
  addCard(v, selType, '副駕駛');
  addMapToast(emojiOf(selType) + ' ' + v.slice(0, 10));
  showToast('✅ 留言已發送！');
  msgInput.value = ''; charCnt.textContent = '0/100';
});

/* ── 前方橫幅關閉 ── */
document.getElementById('ahead-close').addEventListener('click', () => {
  document.getElementById('ahead-banner').style.opacity = '0';
  setTimeout(() => { document.getElementById('ahead-banner').style.display = 'none'; }, 300);
});

/* ── 新增卡片 ── */
const typeInfo = {
  traffic:      { label:'塞車',   emoji:'🚗', cls:'traffic' },
  incident:     { label:'突發',   emoji:'⚠️', cls:'incident' },
  construction: { label:'施工',   emoji:'🚧', cls:'construction' },
  police:       { label:'執法',   emoji:'🚔', cls:'police' },
  slow:         { label:'車速慢', emoji:'🐢', cls:'traffic' },
};

function emojiOf(type) { return (typeInfo[type] || typeInfo.traffic).emoji; }

function addCard(msg, type, role) {
  const t = typeInfo[type] || typeInfo.traffic;
  const now = new Date();
  const time = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');
  const dists = ['0.3 km','0.5 km','0.7 km','1.0 km'];
  const dist = '前方 ' + dists[Math.floor(Math.random() * dists.length)];
  const roleClass = role === '主駕駛' ? 'dr' : 'ps';

  const card = document.createElement('div');
  card.className = 'msg-card new';
  card.dataset.type = type;
  card.innerHTML = `
    <div class="mc-accent ${t.cls}"></div>
    <div class="mc-icon ${t.cls}">${t.emoji}</div>
    <div class="mc-body">
      <div class="mc-top">
        <span class="mc-tag ${t.cls}">${t.label}</span>
        <span class="mc-dist">${dist}</span>
        <span class="mc-time">${time}</span>
      </div>
      <p class="mc-text">${esc(msg)}</p>
      <div class="mc-foot">
        <button class="mc-confirm">✅ 確認 <b>0</b></button>
        <span class="mc-role ${roleClass}">${role}</span>
      </div>
    </div>`;
  card.querySelector('.mc-confirm').addEventListener('click', function() {
    if (this.classList.contains('done')) return;
    const b = this.querySelector('b'); b.textContent = +b.textContent + 1;
    this.classList.add('done'); this.innerHTML = '✅ 已確認 <b>' + b.textContent + '</b>';
  });
  document.getElementById('msg-list').prepend(card);

  // 更新 tab badge
  const dot = document.getElementById('tab-dot-bulletin');
  const cnt = +dot.textContent + 1;
  dot.textContent = cnt;

  // 更新球 badge
  if (!isPanel) {
    unread++;
    ballBadge.textContent = unread;
    ballBadge.style.display = '';
  }

  // 加歷史
  const hi = document.createElement('div');
  hi.className = 'hi';
  hi.innerHTML = `<span class="hd ${t.cls}"></span><div class="hb"><div class="ht"><span class="htag ${t.cls}">${t.emoji} ${t.label}</span><span class="hdist">${dist}</span><span class="htime">${time}</span></div><p class="hmsg">${esc(msg)}</p></div>`;
  document.getElementById('hist-list').prepend(hi);
}

function addMapToast(text) {
  const c = document.getElementById('map-toasts');
  const t = document.createElement('div');
  t.className = 'map-toast'; t.textContent = text;
  c.appendChild(t);
  setTimeout(() => t.remove(), 4200);
}

function esc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

/* ── Global Toast ── */
const gToast = document.getElementById('g-toast');
let gTimer;
function showToast(text) {
  gToast.textContent = text;
  gToast.classList.remove('hidden','show');
  void gToast.offsetWidth;
  gToast.classList.add('show');
  clearTimeout(gTimer);
  gTimer = setTimeout(() => { gToast.classList.replace('show','hidden'); }, 2700);
}

/* ── 模擬速度 ── */
const speedEl = document.getElementById('gps-speed');
const phSpeed = document.getElementById('ph-speed');
let spd = 87;
setInterval(() => {
  spd = Math.max(60, Math.min(110, spd + Math.round((Math.random()-.5)*6)));
  speedEl.textContent = spd;
  phSpeed.textContent = spd;
  speedEl.style.color = spd > 100 ? '#ef4444' : '#22c55e';
}, 2000);

/* ── 自動收到新留言 ── */
const autoMsgs = [
  { msg:'三重交流道車多，行車緩慢。', type:'traffic', role:'副駕駛' },
  { msg:'前方 LED 警告牌：施工中。', type:'construction', role:'主駕駛' },
  { msg:'前方測速照相，注意速限！', type:'police', role:'主駕駛' },
  { msg:'國道一號 34K 有事故。', type:'incident', role:'副駕駛' },
];
let ai = 0;
setTimeout(() => {
  const iv = setInterval(() => {
    const m = autoMsgs[ai % autoMsgs.length];
    addCard(m.msg, m.type, m.role);
    addMapToast(emojiOf(m.type) + ' ' + m.msg.slice(0,10));
    ai++;
    if (ai >= 8) clearInterval(iv);
  }, 14000);
}, 10000);
