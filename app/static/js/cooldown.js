/**
 * cooldown.js — Front-end cooldown mechanism.
 *
 * Rule: Max 3 sends within any 60-second rolling window.
 * Uses localStorage to persist timestamps across page reloads.
 *
 * Exports via window.Cooldown:
 *   - canSend()  → boolean
 *   - record()   → void (records a send timestamp)
 *   - remaining() → number (seconds until next allowed send, 0 if ok)
 */

(function () {
    const STORAGE_KEY = 'rb_cooldown_timestamps';
    const WINDOW_MS = 60 * 1000; // 60 seconds
    const MAX_SENDS = 3;

    let toastTimer = null;

    /** Read timestamps from localStorage, prune expired ones. */
    function getTimestamps() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return [];
            const arr = JSON.parse(raw).filter(
                (t) => Date.now() - t < WINDOW_MS
            );
            // Clean up stale entries
            localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
            return arr;
        } catch {
            return [];
        }
    }

    /** Can the user send another message right now? */
    function canSend() {
        return getTimestamps().length < MAX_SENDS;
    }

    /** Record a new send event. */
    function record() {
        const stamps = getTimestamps();
        stamps.push(Date.now());
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stamps));
    }

    /** Seconds remaining until the oldest timestamp expires (0 if can send). */
    function remaining() {
        const stamps = getTimestamps();
        if (stamps.length < MAX_SENDS) return 0;
        // The oldest relevant timestamp determines when a slot opens
        const oldest = stamps[stamps.length - MAX_SENDS];
        const left = Math.ceil((oldest + WINDOW_MS - Date.now()) / 1000);
        return Math.max(0, left);
    }

    /** Show the cooldown toast with countdown. */
    function showToast() {
        const toast = document.getElementById('cooldown-toast');
        const secEl = document.getElementById('cooldown-sec');
        if (!toast || !secEl) return;

        toast.classList.remove('hidden');

        function tick() {
            const secs = remaining();
            secEl.textContent = secs;
            if (secs <= 0) {
                toast.classList.add('hidden');
                clearInterval(toastTimer);
                toastTimer = null;
                return;
            }
        }

        tick();
        if (toastTimer) clearInterval(toastTimer);
        toastTimer = setInterval(tick, 1000);
    }

    // Expose globally
    window.Cooldown = { canSend, record, remaining, showToast };
})();
