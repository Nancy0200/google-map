/**
 * quickbtn.js — Main menu toggle, option click,
 *               and preset quick-action bubbles.
 */

(function () {
    // ===================== DOM References =====================
    const menuToggle = document.getElementById('menu-toggle');
    const menuPanel  = document.getElementById('menu-panel');
    const menuOptions = document.querySelectorAll('.menu-option');
    const presetBtns  = document.querySelectorAll('.preset-btn');

    let menuOpen = false;

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

    // ===================== Shared send helper =====================
    function sendReport(key, triggerEl) {
        const opt = window.REPORT_OPTIONS && window.REPORT_OPTIONS[key];
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

        // Visual tap feedback
        if (triggerEl) {
            triggerEl.classList.add('tapped');
            setTimeout(() => triggerEl.classList.remove('tapped'), 320);
        }
    }

    // ===================== Menu Option Click =====================
    menuOptions.forEach((btn) => {
        const key = btn.dataset.key;
        btn.addEventListener('click', () => {
            sendReport(key, btn);
            closeMenu();
        });
    });

    // ===================== Preset Quick Bubbles =====================
    presetBtns.forEach((btn) => {
        const key = btn.dataset.key;

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            sendReport(key, btn);
        });
    });

})();
