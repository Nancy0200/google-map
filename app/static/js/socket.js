/**
 * socket.js — SocketIO connection & message handling.
 *
 * Exports via window.Socket:
 *   - sendMessage(data)  → emits 'post_message' to server
 *   - onNewMessage(cb)   → register callback for incoming messages
 */

(function () {
    const socket = io();
    const listeners = [];

    // --- Connection ---
    socket.on('connect', () => {
        console.log('[SocketIO] Connected');
        socket.emit('request_history');
    });

    socket.on('disconnect', () => {
        console.log('[SocketIO] Disconnected');
    });

    // --- Incoming messages ---
    socket.on('new_message', (msg) => {
        listeners.forEach((cb) => cb(msg));
    });

    // --- History (initial load) ---
    socket.on('message_history', (messages) => {
        // Reverse so oldest appear first (they come DESC from server)
        const sorted = [...messages].reverse();
        sorted.forEach((msg) => {
            listeners.forEach((cb) => cb(msg, /* isHistory */ true));
        });
    });

    // --- Error ---
    socket.on('error', (data) => {
        console.warn('[SocketIO] Error:', data.message);
    });

    // --- Public API ---
    function sendMessage(data) {
        socket.emit('post_message', data);
    }

    function onNewMessage(callback) {
        listeners.push(callback);
    }

    window.Socket = { sendMessage, onNewMessage };
})();
