/**
 * quickbtn.js — Main menu toggle, option click, long-press to pin,
 *               and pinned slots orchestration.
 */

(function () {
    // ===================== DOM References =====================
    const menuToggle = document.getElementById('menu-toggle');
    const menuPanel = document.getElementById('menu-panel');
    const menuOptions = document.querySelectorAll('.menu-option');

    let menuOpen = false;
    let longPressTimer = null;
    const LONG_PRESS_MS = 800;

    // ===================== Menu Toggle =====================
    function toggleMenu() {
        if (!menuPanel || !menuToggle) return;
        menuOpen = !menuOpen;
        menuPanel.classList.toggle('collapsed', !menuOpen);
        menuToggle.classList.toggle('open', menuOpen);
    }

    function closeMenu() {
        if (!menuOpen || !menuPanel || !menuToggle) return;
        menuOpen = false;
        menuPanel.classList.add('collapsed');
        menuToggle.classList.remove('open');
    }

    if (menuToggle) {
        menuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleMenu();
        });
    }

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (menuPanel && !menuPanel.contains(e.target) && e.target !== menuToggle) {
            closeMenu();
        }
    });

    // ===================== Menu Option Click =====================
    menuOptions.forEach((btn) => {
        const key = btn.dataset.key;

        // --- Normal click: send message ---
        btn.addEventListener('click', () => {
            const opt = window.REPORT_OPTIONS[key];
            if (!opt) return;

            if (window.Cooldown && !window.Cooldown.canSend()) {
                window.Cooldown.showToast();
                return;
            }

            if (window.Cooldown) window.Cooldown.record();
            if (window.Socket) {
                window.Socket.sendMessage({
                    content: opt.content,
                    category: opt.category,
                    speed_level: opt.speed_level,
                });
            }

            // Brief visual feedback
            btn.style.transform = 'scale(0.93)';
            setTimeout(() => {
                btn.style.transform = '';
            }, 150);

            closeMenu();
        });

        // --- Long press: pin flow ---
        btn.addEventListener('pointerdown', (e) => {
            btn.classList.remove('long-pressing');
            longPressTimer = setTimeout(() => {
                btn.classList.remove('long-pressing');
                if (window.Pinned) window.Pinned.startPinFlow(key);
                closeMenu();
            }, LONG_PRESS_MS);
            // Add visual feedback after a tiny delay so it doesn't flash on normal clicks
            setTimeout(() => {
                if (longPressTimer) btn.classList.add('long-pressing');
            }, 150);
        });

        btn.addEventListener('pointerup', () => {
            clearTimeout(longPressTimer);
            longPressTimer = null;
            btn.classList.remove('long-pressing');
        });

        btn.addEventListener('pointerleave', () => {
            clearTimeout(longPressTimer);
            longPressTimer = null;
            btn.classList.remove('long-pressing');
        });
    });

    // ===================== Init Pinned =====================
    if (window.Pinned) {
        window.Pinned.init();
    }
})();
