// GCAB Ecosystem - Event Bridge System
// Enables real-time communication between Panel and Game

class GCABEventBridge {
    constructor() {
        this.eventListeners = new Map();
        this.messageQueue = [];
        this.isInitialized = false;
        this.bridgeId = `bridge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        this.init();
    }

    // ========== INITIALIZATION ==========

    init() {
        // Listen for postMessage events
        window.addEventListener('message', this.handleIncomingMessage.bind(this));
        
        // Listen for storage events (cross-tab communication)
        window.addEventListener('storage', this.handleStorageEvent.bind(this));
        
        // Listen for broadcast events
        window.addEventListener('gcab:broadcast', this.handleBroadcastEvent.bind(this));
        
        // Cleanup old events periodically
        this.startCleanupInterval();
        
        this.isInitialized = true;
        console.log('🔗 GCABEventBridge: Initialized with ID', this.bridgeId);
    }

    // ========== EVENT REGISTRATION ==========

    on(eventName, callback, options = {}) {
        if (!this.eventListeners.has(eventName)) {
            this.eventListeners.set(eventName, []);
        }
        
        const listener = {
            callback,
            id: options.id || `listener_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            once: options.once || false
        };
        
        this.eventListeners.get(eventName).push(listener);
        
        // Return unsubscribe function
        return () => this.off(eventName, listener.id);
    }

    off(eventName, listenerId) {
        if (!this.eventListeners.has(eventName)) return;
        
        const listeners = this.eventListeners.get(eventName);
        const newListeners = listeners.filter(l => l.id !== listenerId);
        
        if (newListeners.length === 0) {
            this.eventListeners.delete(eventName);
        } else {
            this.eventListeners.set(eventName, newListeners);
        }
    }

    once(eventName, callback) {
        return this.on(eventName, callback, { once: true });
    }

    // ========== EVENT EMISSION ==========

    emit(eventName, data = {}, targetOrigin = '*') {
        const event = {
            type: 'gcab_event',
            name: eventName,
            data: data,
            source: this.bridgeId,
            timestamp: Date.now()
        };
        
        // Store for cross-tab sync
        this.storeEvent(event);
        
        // Send via postMessage
        this.postMessage(event, targetOrigin);
        
        // Trigger locally
        this.triggerLocal(eventName, data);
        
        console.log(`📤 GCABEventBridge: Emitted "${eventName}"`, data);
        return event;
    }

    emitToGame(eventName, data = {}) {
        return this.emit(eventName, data, window.GCAB_GAME_ORIGIN || '*');
    }

    emitToPanel(eventName, data = {}) {
        return this.emit(eventName, data, window.GCAB_PANEL_ORIGIN || '*');
    }

    // ========== PRIVATE METHODS ==========

    handleIncomingMessage(event) {
        // Security: Check origin if needed
        // if (event.origin !== 'https://trusted-domain.com') return;
        
        if (event.data && event.data.type === 'gcab_event') {
            this.processEvent(event.data);
        }
    }

    handleStorageEvent(event) {
        if (event.key && event.key.startsWith('gcab_event_')) {
            try {
                const storedEvent = JSON.parse(event.newValue);
                if (storedEvent && storedEvent.source !== this.bridgeId) {
                    this.processEvent(storedEvent);
                }
            } catch (error) {
                console.error('Failed to parse stored event:', error);
            }
        }
    }

    handleBroadcastEvent(event) {
        if (event.detail) {
            this.processEvent(event.detail);
        }
    }

    processEvent(event) {
        const { name, data, source, timestamp } = event;
        
        // Don't process our own events
        if (source === this.bridgeId) return;
        
        // Check if event is too old (optional)
        const maxAge = 60000; // 1 minute
        if (Date.now() - timestamp > maxAge) return;
        
        // Trigger local listeners
        this.triggerLocal(name, data);
    }

    triggerLocal(eventName, data) {
        if (!this.eventListeners.has(eventName)) return;
        
        const listeners = this.eventListeners.get(eventName);
        const remainingListeners = [];
        
        listeners.forEach(listener => {
            try {
                listener.callback(data);
                
                // Keep if not a once listener
                if (!listener.once) {
                    remainingListeners.push(listener);
                }
            } catch (error) {
                console.error(`Event listener error for "${eventName}":`, error);
                remainingListeners.push(listener); // Keep despite error
            }
        });
        
        if (remainingListeners.length === 0) {
            this.eventListeners.delete(eventName);
        } else {
            this.eventListeners.set(eventName, remainingListeners);
        }
    }

    storeEvent(event) {
        const key = `gcab_event_${event.name}_${event.timestamp}`;
        localStorage.setItem(key, JSON.stringify(event));
        
        // Set a marker for the latest event
        localStorage.setItem('gcab_latest_event', key);
        
        // Remove after 5 minutes
        setTimeout(() => {
            localStorage.removeItem(key);
        }, 5 * 60 * 1000);
    }

    postMessage(event, targetOrigin) {
        // Try to send to all iframes/windows
        if (window.parent !== window) {
            window.parent.postMessage(event, targetOrigin);
        }
        
        if (window.opener) {
            window.opener.postMessage(event, targetOrigin);
        }
        
        // Send to all iframes on the page
        document.querySelectorAll('iframe').forEach(iframe => {
            try {
                iframe.contentWindow.postMessage(event, targetOrigin);
            } catch (error) {
                // Cross-origin iframe, ignore
            }
        });
    }

    startCleanupInterval() {
        setInterval(() => {
            this.cleanupOldEvents();
        }, 60000); // Every minute
    }

    cleanupOldEvents() {
        const now = Date.now();
        const maxAge = 10 * 60 * 1000; // 10 minutes
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('gcab_event_')) {
                try {
                    const event = JSON.parse(localStorage.getItem(key));
                    if (now - event.timestamp > maxAge) {
                        localStorage.removeItem(key);
                    }
                } catch (error) {
                    localStorage.removeItem(key);
                }
            }
        }
    }

    // ========== UTILITY METHODS ==========

    getEventHistory(maxEvents = 50) {
        const events = [];
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('gcab_event_')) {
                try {
                    const event = JSON.parse(localStorage.getItem(key));
                    events.push(event);
                } catch (error) {
                    // Skip invalid events
                }
            }
        }
        
        // Sort by timestamp, newest first
        events.sort((a, b) => b.timestamp - a.timestamp);
        
        return events.slice(0, maxEvents);
    }

    clearEventHistory() {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('gcab_event_')) {
                localStorage.removeItem(key);
            }
        }
    }
}

// Predefined event types for consistency
GCABEventBridge.EVENTS = {
    // Auth events
    AUTH_CONNECTED: 'auth:connected',
    AUTH_DISCONNECTED: 'auth:disconnected',
    
    // Game events
    GAME_STARTED: 'game:started',
    GAME_ENDED: 'game:ended',
    GAME_WIN: 'game:win',
    GAME_LOSS: 'game:loss',
    SCORE_UPDATE: 'score:update',
    ACHIEVEMENT_UNLOCKED: 'achievement:unlocked',
    
    // Panel events
    PORTFOLIO_UPDATE: 'portfolio:update',
    TRADE_EXECUTED: 'trade:executed',
    SETTINGS_CHANGED: 'settings:changed',
    
    // Market events
    PRICE_UPDATE: 'price:update',
    HOLDERS_UPDATE: 'holders:update',
    
    // Social events
    MEME_SUBMITTED: 'meme:submitted',
    LEADERBOARD_UPDATE: 'leaderboard:updated',
    CHAT_MESSAGE: 'chat:message',
    
    // System events
    SYNC_STARTED: 'sync:started',
    SYNC_COMPLETED: 'sync:completed',
    ERROR_OCCURRED: 'error:occurred'
};

// Initialize global instance
window.GCABEventBridge = new GCABEventBridge();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GCABEventBridge };
}