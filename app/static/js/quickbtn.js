/**
 * quickbtn.js — Main menu toggle, option click, and fixed shortcut buttons.
 *
 * Shortcut buttons are fixed to: red (車速<30), accident (前方車禍), debris (前方掉落物).
 * All messages automatically include current simulated location.
 */

(function () {
    // ===================== DOM References =====================
    const menuToggle = document.getElementById('menu-toggle');
    const menuPanel = document.getElementById('menu-panel');
    const menuOptions = document.querySelectorAll('.menu-option');
    const shortcutBtns = document.querySelectorAll('.shortcut-btn');

    let menuOpen = false;

    // ===================== Location Helper =====================

    function getLocationTag() {
        const road = document.getElementById('turn-road');
        if (road && road.textContent && road.textContent !== '持續直行' && road.textContent !== '準備出發') {
            return road.textContent;
        }
        return '未知位置';
    }

    /** Append location to message content */
    function appendLocation(content) {
        const loc = getLocationTag();
        return `${content} 📍 ${loc}`;
    }

    // ===================== Send Helper =====================

    function sendReport(key) {
        const opt = window.REPORT_OPTIONS[key];
        if (!opt) return;

        if (window.Cooldown && !window.Cooldown.canSend()) {
            window.Cooldown.showToast();
            return;
        }

        if (window.Cooldown) window.Cooldown.record();
        if (window.Socket) {
            window.Socket.sendMessage({
                content: appendLocation(opt.content),
                category: opt.category,
                speed_level: opt.speed_level,
            });
        }
    }

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

        btn.addEventListener('click', () => {
            sendReport(key);

            // Brief visual feedback
            btn.style.transform = 'scale(0.93)';
            setTimeout(() => {
                btn.style.transform = '';
            }, 150);

            closeMenu();
        });
    });

    // ===================== Shortcut Button Click =====================
    shortcutBtns.forEach((btn) => {
        const key = btn.dataset.key;

        btn.addEventListener('click', () => {
            sendReport(key);

            // Visual feedback
            btn.style.transform = 'scale(0.85)';
            setTimeout(() => {
                btn.style.transform = '';
            }, 150);
        });
    });
})();
