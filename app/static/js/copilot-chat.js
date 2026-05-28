/**
 * copilot-chat.js — Co-pilot chatroom sidebar.
 *
 * Provides a right-side chat panel where the co-pilot can type messages,
 * view chat history, and use quick-tag shortcuts. Integrates with the
 * existing SocketIO system.
 *
 * On mobile: converts to a bottom sheet with 3 states:
 *   closed → open (55vh) → minimized (header only)
 *
 * Exports via window.CopilotChat:
 *   - toggle()      → cycle through states
 *   - open()        → open the panel
 *   - close()       → close the panel
 *   - minimize()    → minimize to header-only
 */

(function () {
    // ===================== DOM References =====================
    const panel = document.getElementById('copilot-panel');
    const toggleBtn = document.getElementById('copilot-toggle');
    const minimizeBtn = document.getElementById('copilot-minimize');
    const copilotHeader = document.getElementById('copilot-header');
    const messagesContainer = document.getElementById('copilot-messages');
    const emptyState = document.getElementById('copilot-empty');
    const inputEl = document.getElementById('copilot-input');
    const sendBtn = document.getElementById('copilot-send');
    const charCount = document.getElementById('copilot-char-count');
    const quickTags = document.querySelectorAll('.quick-tag');
    const typingIndicator = document.getElementById('copilot-typing');
    const unreadDot = document.getElementById('copilot-unread');

    if (!panel || !toggleBtn) return;

    // State: 'closed' | 'open' | 'minimized'
    let panelState = 'closed';
    let hasMessages = false;
    const MAX_CHARS = 100;

    /** Check if viewport is mobile-sized. */
    function isMobile() {
        return window.innerWidth <= 768;
    }

    // ===================== Panel State Management =====================

    function setPanelState(newState) {
        panelState = newState;

        // Clear all state classes
        panel.classList.remove('open', 'minimized');
        toggleBtn.classList.remove('open', 'minimized');

        switch (newState) {
            case 'open':
                panel.classList.add('open');
                toggleBtn.classList.add('open');
                // Clear unread
                if (unreadDot) unreadDot.classList.add('hidden');
                // Focus input
                setTimeout(() => {
                    if (inputEl) inputEl.focus();
                }, 400);
                scrollToBottom();
                break;

            case 'minimized':
                panel.classList.add('minimized');
                toggleBtn.classList.add('minimized');
                if (inputEl) inputEl.blur();
                break;

            case 'closed':
            default:
                if (inputEl) inputEl.blur();
                break;
        }
    }

    let welcomeShown = false;

    function openPanel() {
        setPanelState('open');
        if (!welcomeShown && messagesContainer) {
            welcomeShown = true;
            if (messagesContainer.querySelectorAll('.chat-bubble').length === 0) {
                const welcome = createSystemBubble('💬 歡迎使用副駕駛留言板！在這裡輸入訊息分享路況資訊。');
                welcome.style.animation = 'none';
                messagesContainer.appendChild(welcome);
            }
        }
    }

    function closePanel() {
        setPanelState('closed');
    }

    function minimizePanel() {
        setPanelState('minimized');
    }

    /**
     * Toggle behavior:
     * - Mobile: closed → open → minimized → open (cycle between open/minimized after first open)
     * - Desktop: closed ↔ open
     */
    function togglePanel() {
        if (isMobile()) {
            switch (panelState) {
                case 'closed':
                    openPanel();
                    break;
                case 'open':
                    minimizePanel();
                    break;
                case 'minimized':
                    openPanel();
                    break;
            }
        } else {
            // Desktop: simple toggle
            if (panelState === 'open') {
                closePanel();
            } else {
                openPanel();
            }
        }
    }

    // Toggle button click
    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePanel();
    });

    // Minimize button click (mobile header button)
    if (minimizeBtn) {
        minimizeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            minimizePanel();
        });
    }

    // On mobile: click the header when minimized to expand
    if (copilotHeader) {
        copilotHeader.addEventListener('click', (e) => {
            if (isMobile() && panelState === 'minimized') {
                e.stopPropagation();
                openPanel();
            }
        });
    }

    // ===================== Mobile Swipe Gesture =====================
    let touchStartY = 0;
    let touchDelta = 0;
    let isSwiping = false;

    panel.addEventListener('touchstart', (e) => {
        if (!isMobile()) return;
        // Only start swipe on the header/handle area
        const target = e.target;
        const isHeaderArea = copilotHeader && (copilotHeader.contains(target) || target === panel);
        if (!isHeaderArea && panelState !== 'minimized') return;

        touchStartY = e.touches[0].clientY;
        isSwiping = true;
        panel.style.transition = 'none';
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
        if (!isSwiping) return;
        touchDelta = e.touches[0].clientY - touchStartY;

        // Only allow swipe down
        if (touchDelta > 0 && panelState === 'open') {
            panel.style.transform = `translateY(${touchDelta}px)`;
        }
    }, { passive: true });

    document.addEventListener('touchend', () => {
        if (!isSwiping) return;
        isSwiping = false;
        panel.style.transition = '';
        panel.style.transform = '';

        if (touchDelta > 80 && panelState === 'open') {
            minimizePanel();
        } else if (touchDelta > 200 && panelState === 'open') {
            closePanel();
        }
        touchDelta = 0;
    });

    // ===================== Message Rendering =====================

    const CATEGORY_LABELS = {
        speed: '速度',
        accident: '車禍',
        debris: '掉落物',
        other: '其他',
    };

    /** Simple HTML escape. */
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /** Format time from ISO string */
    function formatTime(isoStr) {
        if (!isoStr) return '';
        try {
            return new Date(isoStr + 'Z').toLocaleTimeString('zh-TW', {
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch {
            return '';
        }
    }

    /** Create a chat bubble DOM element. */
    function createBubble(msg, isSent) {
        const bubble = document.createElement('div');
        bubble.className = `chat-bubble ${isSent ? 'sent' : 'received'}`;

        const catLabel = CATEGORY_LABELS[msg.category] || '其他';
        const time = formatTime(msg.created_at);
        const senderName = isSent ? '副駕駛' : '路況回報';

        bubble.innerHTML = `
            <div class="bubble-meta">
                <span class="bubble-sender">${senderName}</span>
                <span class="bubble-time">${time}</span>
            </div>
            <div class="bubble-content">
                <span class="bubble-category" data-cat="${msg.category || 'other'}">${catLabel}</span>
                ${escapeHtml(msg.content)}
            </div>
        `;
        return bubble;
    }

    /** Create a system message bubble. */
    function createSystemBubble(text) {
        const bubble = document.createElement('div');
        bubble.className = 'chat-bubble system';
        bubble.innerHTML = `<div class="bubble-content">${escapeHtml(text)}</div>`;
        return bubble;
    }

    /** Scroll messages to bottom smoothly. */
    function scrollToBottom() {
        if (messagesContainer) {
            setTimeout(() => {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }, 50);
        }
    }

    /** Remove empty state if present. */
    function removeEmptyState() {
        if (emptyState && !hasMessages) {
            emptyState.style.display = 'none';
            hasMessages = true;
        }
    }

    /** Add a message to the chatroom. */
    function addMessage(msg, isSent, isHistory) {
        removeEmptyState();

        const bubble = createBubble(msg, isSent);

        if (isHistory) {
            bubble.style.animation = 'none';
        }

        messagesContainer.appendChild(bubble);

        if (!isHistory) {
            scrollToBottom();
            // Show unread dot if panel is not fully open
            if (panelState !== 'open' && unreadDot) {
                unreadDot.classList.remove('hidden');
            }
        }
    }

    // ===================== SocketIO Integration =====================

    const sentMessageContents = new Set();

    if (window.Socket) {
        window.Socket.onNewMessage((msg, isHistory) => {
            const isSent = sentMessageContents.has(msg.content);
            if (isSent) {
                sentMessageContents.delete(msg.content);
            }
            addMessage(msg, isSent, isHistory);
        });
    }

    // ===================== Send Message =====================

    function sendMessage() {
        if (!inputEl) return;
        const content = inputEl.value.trim();
        if (!content) return;
        if (content.length > MAX_CHARS) return;

        if (window.Cooldown && !window.Cooldown.canSend()) {
            window.Cooldown.showToast();
            return;
        }

        if (window.Cooldown) window.Cooldown.record();

        sentMessageContents.add(content);

        if (window.Socket) {
            window.Socket.sendMessage({
                content: content,
                category: 'other',
                speed_level: null,
            });
        }

        inputEl.value = '';
        updateCharCount();
        updateSendButton();

        sendBtn.style.transform = 'scale(0.85)';
        setTimeout(() => {
            sendBtn.style.transform = '';
        }, 150);
    }

    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }

    if (inputEl) {
        inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        inputEl.addEventListener('input', () => {
            updateCharCount();
            updateSendButton();
        });
    }

    /** Update character counter. */
    function updateCharCount() {
        if (!charCount || !inputEl) return;
        const len = inputEl.value.length;
        charCount.textContent = `${len}/${MAX_CHARS}`;

        charCount.classList.remove('warning', 'danger');
        if (len > MAX_CHARS) {
            charCount.classList.add('danger');
        } else if (len > MAX_CHARS * 0.8) {
            charCount.classList.add('warning');
        }
    }

    /** Enable/disable send button based on input. */
    function updateSendButton() {
        if (!sendBtn || !inputEl) return;
        const content = inputEl.value.trim();
        sendBtn.disabled = !content || content.length > MAX_CHARS;
    }

    // Initial state
    updateCharCount();
    updateSendButton();

    // ===================== Quick Tags =====================

    quickTags.forEach((tag) => {
        tag.addEventListener('click', () => {
            if (!inputEl) return;
            const text = tag.dataset.text;
            if (text) {
                inputEl.value = text;
                updateCharCount();
                updateSendButton();
                inputEl.focus();
            }
        });
    });

    // ===================== Public API =====================
    window.CopilotChat = {
        toggle: togglePanel,
        open: openPanel,
        close: closePanel,
        minimize: minimizePanel,
    };
})();
