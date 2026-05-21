/**
 * danmaku.js — Bullet-comment overlay on the navigation panel.
 *
 * Listens for new messages and spawns horizontal-scrolling DOM elements.
 */

(function () {
    const layer = document.getElementById('danmaku-layer');
    if (!layer) return;

    const TRACK_COUNT = 6;       // number of vertical "lanes"
    const MIN_DURATION = 8;      // seconds (fastest)
    const MAX_DURATION = 14;     // seconds (slowest)
    const trackLastTime = new Array(TRACK_COUNT).fill(0);

    /** Pick a track that isn't too recently used. */
    function pickTrack() {
        const now = Date.now();
        let best = 0;
        let bestAge = 0;
        for (let i = 0; i < TRACK_COUNT; i++) {
            const age = now - trackLastTime[i];
            if (age > bestAge) {
                bestAge = age;
                best = i;
            }
        }
        trackLastTime[best] = now;
        return best;
    }

    /** Spawn a danmaku element for the given message. */
    function fire(msg) {
        const el = document.createElement('div');
        el.className = 'danmaku-item';
        el.textContent = msg.content;
        if (msg.category) {
            el.setAttribute('data-cat', msg.category);
        }

        const track = pickTrack();
        const topPct = 8 + (track / TRACK_COUNT) * 65; // spread across 8%–73% height
        el.style.top = topPct + '%';

        const duration = MIN_DURATION + Math.random() * (MAX_DURATION - MIN_DURATION);
        el.style.setProperty('--duration', duration + 's');

        layer.appendChild(el);

        // Remove after animation
        el.addEventListener('animationend', () => el.remove());
    }

    // Listen for messages
    if (window.Socket) {
        window.Socket.onNewMessage((msg, isHistory) => {
            if (isHistory) return; // don't replay old danmaku
            fire(msg);
        });
    }

    window.Danmaku = { fire };
})();
