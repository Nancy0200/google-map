/**
 * pinned.js — Pinned button management (localStorage).
 *
 * Manages 3 pinned slots. Users can:
 *   - Long-press a menu option → choose a slot → save to localStorage
 *   - Click a pinned slot → immediately send that option's message
 *
 * Exports via window.Pinned:
 *   - init()           → load from localStorage and render
 *   - startPinFlow(key) → begin the "choose a slot" flow for the given option key
 *   - getSlot(index)   → get the option stored in slot index (0–2)
 */

(function () {
    const STORAGE_KEY = 'rb_pinned_buttons';

    // Current pinned data: [slot0, slot1, slot2] — each is an option key string or null
    let slots = [null, null, null];

    /** Load from localStorage. */
    function load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length === 3) {
                    slots = parsed;
                }
            }
        } catch {
            slots = [null, null, null];
        }
    }

    /** Save to localStorage. */
    function save() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(slots));
    }

    /** Render all 3 pinned buttons based on current `slots` state. */
    function render() {
        const btns = document.querySelectorAll('.pinned-btn');
        btns.forEach((btn) => {
            const idx = parseInt(btn.dataset.slot, 10);
            const key = slots[idx];
            const opt = key ? window.REPORT_OPTIONS[key] : null;
            const iconEl = btn.querySelector('.pinned-icon');

            if (opt) {
                iconEl.textContent = opt.icon;
                btn.classList.add('has-pin');
                btn.title = opt.label;
            } else {
                iconEl.textContent = '📌';
                btn.classList.remove('has-pin');
                btn.title = `釘選格 ${idx + 1}`;
            }
        });
    }

    /** Get the option data for a pinned slot. Returns the option object or null. */
    function getSlot(index) {
        const key = slots[index];
        return key ? window.REPORT_OPTIONS[key] : null;
    }

    // --- Pin Flow (slot selection via overlay) ---

    let pendingKey = null;

    function startPinFlow(optionKey) {
        pendingKey = optionKey;
        const overlay = document.getElementById('pin-overlay');
        overlay.classList.remove('hidden');
    }

    function endPinFlow() {
        pendingKey = null;
        const overlay = document.getElementById('pin-overlay');
        overlay.classList.add('hidden');
    }

    /** Initialise: load, render, bind slot-choice events. */
    function init() {
        load();
        render();

        // Slot choice buttons inside the overlay
        document.querySelectorAll('.pin-slot-choice').forEach((btn) => {
            btn.addEventListener('click', () => {
                if (!pendingKey) return;
                const idx = parseInt(btn.dataset.slot, 10);
                slots[idx] = pendingKey;
                save();
                render();
                endPinFlow();
            });
        });

        // Cancel
        const cancelBtn = document.getElementById('pin-cancel');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', endPinFlow);
        }

        // Click pinned slot → send message
        document.querySelectorAll('.pinned-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.slot, 10);
                const opt = getSlot(idx);
                if (!opt) return; // empty slot, do nothing

                // Cooldown check
                if (!window.Cooldown.canSend()) {
                    window.Cooldown.showToast();
                    return;
                }

                window.Cooldown.record();
                window.Socket.sendMessage({
                    content: opt.content,
                    category: opt.category,
                    speed_level: opt.speed_level,
                });

                // Visual feedback
                btn.style.transform = 'scale(0.85)';
                setTimeout(() => {
                    btn.style.transform = '';
                }, 150);
            });
        });
    }

    window.Pinned = { init, startPinFlow, getSlot };
})();
