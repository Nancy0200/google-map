/**
 * quickbtn.js — Main menu toggle, option click, long-press to pin,
 *               bottom-sheet drawer, message board rendering,
 *               manual input, and filter.
 *
 * This is the main orchestration script that ties everything together.
 */

(function () {
    // ===================== DOM References =====================
    const menuToggle = document.getElementById('menu-toggle');
    const menuPanel = document.getElementById('menu-panel');
    const menuOptions = document.querySelectorAll('.menu-option');
    const msgList = document.getElementById('message-list');
    const emptyState = document.getElementById('empty-state');
    const msgInput = document.getElementById('msg-input');
    const msgSend = document.getElementById('msg-send');
    const filterBtns = document.querySelectorAll('.filter-btn');

    // Bottom sheet elements
    const sheet = document.getElementById('message-panel');
    const sheetHandle = document.getElementById('sheet-handle');
    const panelHeader = document.getElementById('panel-header');
    const backdrop = document.getElementById('sheet-backdrop');
    const msgCountEl = document.getElementById('msg-count');

    let menuOpen = false;
    let currentFilter = '';
    let longPressTimer = null;
    let messageCount = 0;
    const LONG_PRESS_MS = 800;

    // ===================== Bottom Sheet Drawer =====================
    let sheetOpen = false;

    function openSheet() {
        sheetOpen = true;
        sheet.classList.add('open');
        backdrop.classList.add('visible');
    }

    function closeSheet() {
        sheetOpen = false;
        sheet.classList.remove('open');
        backdrop.classList.remove('visible');
    }

    function toggleSheet() {
        if (sheetOpen) closeSheet();
        else openSheet();
    }

    // Click handle or header to toggle
    if (sheetHandle) sheetHandle.addEventListener('click', toggleSheet);
    if (panelHeader) panelHeader.addEventListener('click', toggleSheet);

    // Click backdrop to close
    if (backdrop) backdrop.addEventListener('click', closeSheet);

    // --- Swipe-down to close (touch support) ---
    let touchStartY = 0;
    let touchDeltaY = 0;
    let isDragging = false;

    if (sheetHandle) {
        sheetHandle.addEventListener('touchstart', (e) => {
            if (!sheetOpen) return;
            touchStartY = e.touches[0].clientY;
            isDragging = true;
            sheet.style.transition = 'none';
        }, { passive: true });
    }

    document.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        touchDeltaY = e.touches[0].clientY - touchStartY;
        if (touchDeltaY > 0) {
            sheet.style.transform = `translateY(${touchDeltaY}px)`;
        }
    }, { passive: true });

    document.addEventListener('touchend', () => {
        if (!isDragging) return;
        isDragging = false;
        sheet.style.transition = '';
        sheet.style.transform = '';
        if (touchDeltaY > 80) {
            closeSheet();
        }
        touchDeltaY = 0;
    });

    // ===================== Menu Toggle =====================
    function toggleMenu() {
        menuOpen = !menuOpen;
        menuPanel.classList.toggle('collapsed', !menuOpen);
        menuToggle.classList.toggle('open', menuOpen);
    }

    function closeMenu() {
        if (!menuOpen) return;
        menuOpen = false;
        menuPanel.classList.add('collapsed');
        menuToggle.classList.remove('open');
    }

    menuToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMenu();
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!menuPanel.contains(e.target) && e.target !== menuToggle) {
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
                window.Pinned.startPinFlow(key);
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

    // ===================== Message Board =====================

    const CATEGORY_LABELS = {
        speed: '速度',
        accident: '車禍',
        debris: '掉落物',
        other: '其他',
    };

    /** Update the message count badge. */
    function updateCount() {
        if (msgCountEl) {
            msgCountEl.textContent = messageCount;
        }
    }

    /** Create a message card DOM element. */
    function createMsgCard(msg) {
        const card = document.createElement('div');
        card.className = 'msg-card';
        card.dataset.category = msg.category || 'other';

        const catLabel = CATEGORY_LABELS[msg.category] || '其他';
        const time = msg.created_at
            ? new Date(msg.created_at + 'Z').toLocaleTimeString('zh-TW', {
                  hour: '2-digit',
                  minute: '2-digit',
              })
            : '';

        card.innerHTML = `
            <div class="msg-meta">
                <span class="msg-category" data-cat="${msg.category || 'other'}">${catLabel}</span>
                <span class="msg-time">${time}</span>
            </div>
            <div class="msg-content">${escapeHtml(msg.content)}</div>
        `;
        return card;
    }

    /** Simple HTML escape. */
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /** Add a message to the board (prepend = newest on top). */
    function addMessage(msg) {
        // Remove empty state
        if (emptyState) emptyState.remove();

        messageCount++;
        updateCount();

        const card = createMsgCard(msg);

        // If filter active and category doesn't match, hide
        if (currentFilter && msg.category !== currentFilter) {
            card.style.display = 'none';
        }

        msgList.prepend(card);
    }

    // Listen for messages from SocketIO
    if (window.Socket) {
        window.Socket.onNewMessage((msg, isHistory) => {
            addMessage(msg);
        });
    }

    // ===================== Manual Input =====================

    function sendManualMessage() {
        const content = msgInput.value.trim();
        if (!content) return;
        if (content.length > 100) {
            msgInput.style.borderColor = 'var(--danger)';
            setTimeout(() => {
                msgInput.style.borderColor = '';
            }, 1500);
            return;
        }

        if (!window.Cooldown.canSend()) {
            window.Cooldown.showToast();
            return;
        }

        window.Cooldown.record();
        window.Socket.sendMessage({
            content: content,
            category: 'other',
            speed_level: null,
        });

        msgInput.value = '';
    }

    msgSend.addEventListener('click', sendManualMessage);
    msgInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            sendManualMessage();
        }
    });

    // ===================== Filter =====================

    filterBtns.forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Don't toggle sheet when clicking filter
            filterBtns.forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.category || '';

            // Show/hide cards
            document.querySelectorAll('.msg-card').forEach((card) => {
                if (!currentFilter || card.dataset.category === currentFilter) {
                    card.style.display = '';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    });

    // ===================== Init Pinned =====================
    if (window.Pinned) {
        window.Pinned.init();
    }
})();
