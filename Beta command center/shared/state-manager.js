// GCAB Ecosystem - Shared State Manager
// Manages synchronized state between Panel and Game

class GCABStateManager {
    constructor(config = {}) {
        this.config = {
            syncInterval: 30000, // 30 seconds
            maxHistory: 100,
            enableCrossTab: true,
            ...config
        };
        
        this.state = {
            version: '1.0.0',
            lastUpdated: null,
            player: {
                wallet: null,
                gcabBalance: 0,
                usdValue: 0,
                gameScore: 0,
                achievements: [],
                level: 1,
                lastActive: null
            },
            game: {
                active: false,
                currentGame: null,
                score: 0,
                timeRemaining: 0,
                opponents: [],
                tournamentId: null
            },
            market: {
                gcabPrice: 0,
                priceChange24h: 0,
                marketCap: 0,
                holders: 0,
                liquidity: 0,
                lastUpdated: null
            },
            ecosystem: {
                totalPlayers: 0,
                activePlayers: 0,
                totalTransactions: 0,
                memesSubmitted: 0
            },
            ui: {
                theme: 'dark',
                notifications: true,
                sounds: true
            }
        };
        
        this.history = [];
        this.stateListeners = new Map();
        this.syncTimer = null;
        
        this.init();
    }

    // ========== INITIALIZATION ==========

    init() {
        // Load saved state
        this.load();
        
        // Set up cross-tab synchronization
        if (this.config.enableCrossTab) {
            window.addEventListener('storage', this.handleStorageChange.bind(this));
        }
        
        // Start sync timer
        this.startSyncTimer();
        
        // Listen for auth changes
        if (window.GCABAuth) {
            window.GCABAuth.onAuthChange(this.handleAuthChange.bind(this));
        }
        
        // Listen for events
        if (window.GCABEventBridge) {
            window.GCABEventBridge.on('*', this.handleEvent.bind(this));
        }
        
        console.log('🔄 GCABStateManager: Initialized');
    }

    // ========== PUBLIC METHODS ==========

    getState(path = '') {
        if (!path) return { ...this.state };
        
        const parts = path.split('.');
        let value = this.state;
        
        for (const part of parts) {
            if (value && typeof value === 'object' && part in value) {
                value = value[part];
            } else {
                return undefined;
            }
        }
        
        return value;
    }

    setState(updates, source = 'local') {
        const oldState = { ...this.state };
        
        // Deep merge updates
        this.mergeState(this.state, updates);
        
        // Update timestamp
        this.state.lastUpdated = Date.now();
        
        // Save to history
        this.addToHistory(oldState, this.state, source);
        
        // Save to storage
        this.save();
        
        // Notify listeners
        this.notifyStateChange(oldState, this.state, source);
        
        // Broadcast change to other tabs
        if (source !== 'storage') {
            this.broadcastStateChange();
        }
        
        console.log(`📝 GCABStateManager: State updated by ${source}`);
        return this.state;
    }

    updatePlayer(data) {
        return this.setState({
            player: { ...this.state.player, ...data, lastActive: Date.now() }
        }, 'player');
    }

    updateGame(data) {
        return this.setState({
            game: { ...this.state.game, ...data }
        }, 'game');
    }

    updateMarket(data) {
        return this.setState({
            market: { ...this.state.market, ...data, lastUpdated: Date.now() }
        }, 'market');
    }

    subscribe(path, callback) {
        if (!this.stateListeners.has(path)) {
            this.stateListeners.set(path, []);
        }
        
        const listener = {
            callback,
            id: `listener_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
        };
        
        this.stateListeners.get(path).push(listener);
        
        // Return unsubscribe function
        return () => {
            const listeners = this.stateListeners.get(path);
            if (listeners) {
                const newListeners = listeners.filter(l => l.id !== listener.id);
                if (newListeners.length === 0) {
                    this.stateListeners.delete(path);
                } else {
                    this.stateListeners.set(path, newListeners);
                }
            }
        };
    }

    // ========== SYNC METHODS ==========

    async syncWithBackend() {
        try {
            console.log('🔄 GCABStateManager: Syncing with backend...');
            
            // Update market data
            await this.syncMarketData();
            
            // Update player data if authenticated
            if (this.state.player.wallet) {
                await this.syncPlayerData();
            }
            
            // Update ecosystem stats
            await this.syncEcosystemData();
            
            console.log('✅ GCABStateManager: Sync completed');
            
        } catch (error) {
            console.error('❌ GCABStateManager: Sync failed:', error);
        }
    }

    async syncMarketData() {
        // Example: Fetch from DexScreener API
        const mockMarketData = {
            gcabPrice: 0.00001 + (Math.random() * 0.000005 - 0.0000025),
            priceChange24h: (Math.random() * 20 - 10),
            marketCap: 50000 + Math.random() * 10000,
            holders: 250 + Math.floor(Math.random() * 50),
            liquidity: 2000 + Math.random() * 500
        };
        
        this.updateMarket(mockMarketData);
    }

    async syncPlayerData() {
        if (!this.state.player.wallet) return;
        
        // Example: Fetch player data from your backend
        const mockPlayerData = {
            gcabBalance: 1000000 + Math.floor(Math.random() * 100000),
            usdValue: this.state.player.gcabBalance * (this.state.market.gcabPrice || 0.00001),
            gameScore: this.state.player.gameScore,
            level: Math.floor(this.state.player.gameScore / 1000) + 1
        };
        
        this.updatePlayer(mockPlayerData);
    }

    async syncEcosystemData() {
        // Example: Fetch ecosystem stats
        const mockEcosystemData = {
            totalPlayers: 300 + Math.floor(Math.random() * 50),
            activePlayers: 50 + Math.floor(Math.random() * 30),
            totalTransactions: 1000 + Math.floor(Math.random() * 200),
            memesSubmitted: 150 + Math.floor(Math.random() * 50)
        };
        
        this.setState({
            ecosystem: { ...this.state.ecosystem, ...mockEcosystemData }
        }, 'ecosystem');
    }

    // ========== PRIVATE METHODS ==========

    mergeState(target, source) {
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                if (!target[key] || typeof target[key] !== 'object') {
                    target[key] = {};
                }
                this.mergeState(target[key], source[key]);
            } else {
                target[key] = source[key];
            }
        }
    }

    addToHistory(oldState, newState, source) {
        const historyEntry = {
            timestamp: Date.now(),
            source,
            oldState: this.cloneDeep(oldState),
            newState: this.cloneDeep(newState),
            changes: this.findChanges(oldState, newState)
        };
        
        this.history.unshift(historyEntry);
        
        // Keep history size limited
        if (this.history.length > this.config.maxHistory) {
            this.history.pop();
        }
    }

    findChanges(oldState, newState) {
        const changes = [];
        
        function compare(path, oldVal, newVal) {
            if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
                changes.push({
                    path,
                    old: oldVal,
                    new: newVal
                });
            }
            
            if (typeof oldVal === 'object' && oldVal && typeof newVal === 'object' && newVal) {
                const allKeys = new Set([...Object.keys(oldVal), ...Object.keys(newVal)]);
                for (const key of allKeys) {
                    compare(path ? `${path}.${key}` : key, oldVal[key], newVal[key]);
                }
            }
        }
        
        compare('', oldState, newState);
        return changes;
    }

    cloneDeep(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    notifyStateChange(oldState, newState, source) {
        // Notify path-specific listeners
        for (const [path, listeners] of this.stateListeners) {
            const oldValue = this.getValueByPath(oldState, path);
            const newValue = this.getValueByPath(newState, path);
            
            if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
                listeners.forEach(listener => {
                    try {
                        listener.callback(newValue, oldValue, source);
                    } catch (error) {
                        console.error(`State listener error for path "${path}":`, error);
                    }
                });
            }
        }
        
        // Dispatch global event
        window.dispatchEvent(new CustomEvent('gcab:state:changed', {
            detail: {
                state: newState,
                oldState,
                source,
                timestamp: Date.now()
            }
        }));
    }

    getValueByPath(obj, path) {
        const parts = path.split('.');
        let value = obj;
        
        for (const part of parts) {
            if (value && typeof value === 'object' && part in value) {
                value = value[part];
            } else {
                return undefined;
            }
        }
        
        return value;
    }

    broadcastStateChange() {
        if (!this.config.enableCrossTab) return;
        
        const stateUpdate = {
            type: 'gcab_state_update',
            state: this.state,
            timestamp: Date.now(),
            source: 'state_manager'
        };
        
        localStorage.setItem('gcab_state_sync', JSON.stringify(stateUpdate));
    }

    handleStorageChange(event) {
        if (event.key === 'gcab_state_sync' && event.newValue) {
            try {
                const update = JSON.parse(event.newValue);
                
                // Avoid processing our own updates
                if (update.source === 'state_manager') return;
                
                // Merge the received state
                this.setState(update.state, 'storage');
                
            } catch (error) {
                console.error('Failed to parse state update:', error);
            }
        }
    }

    handleAuthChange(event) {
        if (event.type === 'connected') {
            this.updatePlayer({
                wallet: event.wallet,
                playerId: event.playerId,
                lastActive: Date.now()
            });
        } else if (event.type === 'disconnected') {
            this.updatePlayer({
                wallet: null,
                playerId: null
            });
        }
    }

    handleEvent(eventName, data) {
        // Update state based on events
        switch (eventName) {
            case GCABEventBridge.EVENTS.GAME_WIN:
                this.updatePlayer({
                    gameScore: this.state.player.gameScore + (data.amount || 0)
                });
                break;
                
            case GCABEventBridge.EVENTS.PORTFOLIO_UPDATE:
                this.updatePlayer({
                    gcabBalance: data.balance || this.state.player.gcabBalance,
                    usdValue: data.usdValue || this.state.player.usdValue
                });
                break;
                
            case GCABEventBridge.EVENTS.PRICE_UPDATE:
                this.updateMarket({
                    gcabPrice: data.price,
                    priceChange24h: data.change24h
                });
                break;
        }
    }

    // ========== PERSISTENCE ==========

    save() {
        try {
            const saveData = {
                state: this.state,
                history: this.history.slice(0, 50), // Save limited history
                savedAt: Date.now()
            };
            
            localStorage.setItem('gcab_state', JSON.stringify(saveData));
        } catch (error) {
            console.error('Failed to save state:', error);
        }
    }

    load() {
        try {
            const saved = localStorage.getItem('gcab_state');
            if (saved) {
                const data = JSON.parse(saved);
                
                // Only load if version matches or is compatible
                if (data.state && data.state.version === this.state.version) {
                    this.state = data.state;
                    this.history = data.history || [];
                    
                    console.log('📂 GCABStateManager: State loaded from storage');
                    return true;
                }
            }
        } catch (error) {
            console.error('Failed to load state:', error);
        }
        
        return false;
    }

    clear() {
        this.state = {
            version: '1.0.0',
            lastUpdated: Date.now(),
            player: { wallet: null, gcabBalance: 0, gameScore: 0, achievements: [] },
            game: { active: false, score: 0 },
            market: { gcabPrice: 0, holders: 0 },
            ecosystem: { totalPlayers: 0, activePlayers: 0 }
        };
        
        this.history = [];
        this.save();
        
        console.log('🧹 GCABStateManager: State cleared');
    }

    // ========== TIMER MANAGEMENT ==========

    startSyncTimer() {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
        }
        
        this.syncTimer = setInterval(() => {
            this.syncWithBackend();
        }, this.config.syncInterval);
    }

    stopSyncTimer() {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
            this.syncTimer = null;
        }
    }

    // ========== UTILITY METHODS ==========

    getHistory(maxEntries = 20) {
        return this.history.slice(0, maxEntries);
    }

    getPlayerRank() {
        // Mock rank calculation
        const score = this.state.player.gameScore;
        if (score > 10000) return 'GCAB Legend';
        if (score > 5000) return 'Based Chad';
        if (score > 1000) return 'Alpha Tester';
        if (score > 100) return 'Beta Explorer';
        return 'Newcomer';
    }

    getEstimatedEarnings() {
        const balance = this.state.player.gcabBalance;
        const price = this.state.market.gcabPrice || 0.00001;
        return balance * price;
    }
}

// Initialize global instance with default config
window.GCABStateManager = new GCABStateManager({
    syncInterval: 15000, // 15 seconds for more frequent updates
    enableCrossTab: true,
    maxHistory: 50
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GCABStateManager };
}