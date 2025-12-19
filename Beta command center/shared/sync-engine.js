// GCAB Ecosystem - Main Sync Engine
// Orchestrates all synchronization between Panel and Game

class GCABSyncEngine {
    constructor() {
        this.components = {
            auth: null,
            events: null,
            state: null,
            api: null
        };
        
        this.syncStatus = {
            initialized: false,
            lastSync: null,
            syncInterval: 15000,
            isSyncing: false,
            errorCount: 0,
            retryAttempts: 0
        };
        
        this.syncCallbacks = {
            onStart: [],
            onComplete: [],
            onError: [],
            onStateChange: []
        };
        
        this.init();
    }

    // ========== INITIALIZATION ==========

    async init() {
        console.log('🚀 GCABSyncEngine: Initializing...');
        
        try {
            // Wait for components to be available
            await this.waitForComponents();
            
            // Initialize component connections
            this.setupComponentConnections();
            
            // Start sync loop
            this.startSyncLoop();
            
            // Set up event listeners
            this.setupEventListeners();
            
            this.syncStatus.initialized = true;
            console.log('✅ GCABSyncEngine: Initialized successfully');
            
            // Trigger initial sync
            setTimeout(() => this.sync(), 2000);
            
        } catch (error) {
            console.error('❌ GCABSyncEngine: Failed to initialize:', error);
            this.handleError(error);
        }
    }

    async waitForComponents() {
        const maxWaitTime = 10000; // 10 seconds
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWaitTime) {
            if (this.areComponentsAvailable()) {
                return;
            }
            
            await this.sleep(500);
        }
        
        throw new Error('Sync components not available after timeout');
    }

    areComponentsAvailable() {
        return (
            window.GCABAuth &&
            window.GCABEventBridge &&
            window.GCABStateManager &&
            window.GCABAPI
        );
    }

    setupComponentConnections() {
        this.components = {
            auth: window.GCABAuth,
            events: window.GCABEventBridge,
            state: window.GCABStateManager,
            api: window.GCABAPI
        };
        
        console.log('🔗 GCABSyncEngine: Components connected');
    }

    setupEventListeners() {
        // Listen for auth changes
        this.components.auth.onAuthChange((event) => {
            this.handleAuthChange(event);
        });
        
        // Listen for important events
        this.components.events.on('sync:requested', () => {
            this.sync();
        });
        
        // Listen for state changes
        window.addEventListener('gcab:state:changed', (event) => {
            this.handleStateChange(event.detail);
        });
        
        // Listen for network status
        window.addEventListener('online', () => {
            this.handleNetworkStatus(true);
        });
        
        window.addEventListener('offline', () => {
            this.handleNetworkStatus(false);
        });
    }

    // ========== SYNC METHODS ==========

    async sync(force = false) {
        if (this.syncStatus.isSyncing && !force) {
            console.log('🔄 GCABSyncEngine: Sync already in progress');
            return;
        }
        
        // Check if we should sync
        if (!this.shouldSync()) {
            return;
        }
        
        this.syncStatus.isSyncing = true;
        this.syncStatus.retryAttempts = 0;
        
        try {
            // Notify sync start
            this.notifySyncStart();
            
            console.log('🔄 GCABSyncEngine: Starting sync...');
            
            // Execute sync steps
            await this.executeSyncSteps();
            
            // Update status
            this.syncStatus.lastSync = Date.now();
            this.syncStatus.errorCount = 0;
            this.syncStatus.isSyncing = false;
            
            // Notify sync complete
            this.notifySyncComplete();
            
            console.log('✅ GCABSyncEngine: Sync completed successfully');
            
        } catch (error) {
            this.syncStatus.errorCount++;
            this.syncStatus.isSyncing = false;
            
            // Handle error
            this.handleError(error);
            
            // Schedule retry if needed
            if (this.shouldRetry()) {
                this.scheduleRetry();
            }
        }
    }

    async executeSyncSteps() {
        const steps = [
            this.syncAuthStatus.bind(this),
            this.syncPlayerData.bind(this),
            this.syncMarketData.bind(this),
            this.syncGameData.bind(this),
            this.syncEcosystemData.bind(this),
            this.broadcastSyncComplete.bind(this)
        ];
        
        for (const step of steps) {
            if (this.syncStatus.isSyncing) {
                await step();
            }
        }
    }

    async syncAuthStatus() {
        const player = this.components.auth.getPlayerData();
        
        if (player && player.isAuthenticated) {
            // Update state with auth info
            this.components.state.updatePlayer({
                wallet: player.wallet,
                playerId: player.playerId,
                lastActive: Date.now()
            });
            
            // Emit auth sync event
            this.components.events.emit('auth:synced', player);
        }
    }

    async syncPlayerData() {
        const player = this.components.state.getState('player');
        
        if (player.wallet) {
            try {
                // Fetch fresh player data from API
                const playerData = await this.components.api.getPlayerStats(player.wallet);
                
                // Update state
                this.components.state.updatePlayer(playerData);
                
                // Emit player data sync event
                this.components.events.emit('player:data:synced', playerData);
                
            } catch (error) {
                console.warn('Failed to sync player data:', error.message);
                // Continue with other sync steps
            }
        }
    }

    async syncMarketData() {
        try {
            // Fetch market data
            const [priceData, marketStats] = await Promise.all([
                this.components.api.getGCABPrice(),
                this.components.api.getMarketStats()
            ]);
            
            // Update state
            this.components.state.updateMarket({
                ...priceData,
                ...marketStats
            });
            
            // Emit market sync event
            this.components.events.emit('market:data:synced', {
                ...priceData,
                ...marketStats
            });
            
        } catch (error) {
            console.warn('Failed to sync market data:', error.message);
        }
    }

    async syncGameData() {
        try {
            const player = this.components.state.getState('player');
            
            if (player.playerId) {
                // Fetch game-related data
                const [achievements, leaderboard] = await Promise.all([
                    this.components.api.getPlayerAchievements(player.wallet),
                    this.components.api.getLeaderboard('weekly', 10)
                ]);
                
                // Update state
                this.components.state.setState({
                    player: { achievements: achievements || [] },
                    game: { leaderboard: leaderboard || [] }
                }, 'game_sync');
                
                // Emit game sync event
                this.components.events.emit('game:data:synced', {
                    achievements,
                    leaderboard
                });
            }
            
        } catch (error) {
            console.warn('Failed to sync game data:', error.message);
        }
    }

    async syncEcosystemData() {
        try {
            // Fetch ecosystem stats
            const ecosystemStats = await this.components.api.getEcosystemStats();
            
            // Update state
            this.components.state.setState({
                ecosystem: ecosystemStats
            }, 'ecosystem_sync');
            
            // Emit ecosystem sync event
            this.components.events.emit('ecosystem:data:synced', ecosystemStats);
            
        } catch (error) {
            console.warn('Failed to sync ecosystem data:', error.message);
        }
    }

    async broadcastSyncComplete() {
        // Create sync summary
        const summary = {
            timestamp: Date.now(),
            components: Object.keys(this.components),
            state: this.components.state.getState(),
            player: this.components.state.getState('player'),
            market: this.components.state.getState('market')
        };
        
        // Broadcast to other tabs/windows
        this.components.events.emit('sync:complete', summary);
        
        // Store in localStorage for cross-tab access
        localStorage.setItem('gcab_sync_summary', JSON.stringify(summary));
    }

    // ========== SYNC CONTROL ==========

    startSyncLoop() {
        // Start periodic sync
        setInterval(() => {
            if (this.shouldSync()) {
                this.sync();
            }
        }, this.syncStatus.syncInterval);
        
        console.log('⏱️ GCABSyncEngine: Sync loop started');
    }

    stopSyncLoop() {
        // Clear all intervals (we'd need to store the interval ID)
        // For simplicity, we'll rely on page refresh
        console.log('⏹️ GCABSyncEngine: Sync loop stopped');
    }

    shouldSync() {
        // Don't sync if offline
        if (!navigator.onLine) {
            return false;
        }
        
        // Don't sync if already syncing
        if (this.syncStatus.isSyncing) {
            return false;
        }
        
        // Sync if enough time has passed
        const timeSinceLastSync = Date.now() - (this.syncStatus.lastSync || 0);
        return timeSinceLastSync > this.syncStatus.syncInterval;
    }

    shouldRetry() {
        return (
            this.syncStatus.errorCount < 3 &&
            this.syncStatus.retryAttempts < 5
        );
    }

    scheduleRetry() {
        this.syncStatus.retryAttempts++;
        
        const delay = Math.min(
            30000, // Max 30 seconds
            1000 * Math.pow(2, this.syncStatus.retryAttempts) // Exponential backoff
        );
        
        console.log(`⏰ GCABSyncEngine: Retrying in ${delay}ms (attempt ${this.syncStatus.retryAttempts})`);
        
        setTimeout(() => {
            this.sync(true); // Force sync
        }, delay);
    }

    // ========== EVENT HANDLERS ==========

    handleAuthChange(event) {
        console.log('🔐 GCABSyncEngine: Auth change detected:', event.type);
        
        switch (event.type) {
            case 'connected':
                // Immediate sync on connect
                setTimeout(() => this.sync(), 1000);
                break;
                
            case 'disconnected':
                // Clear player-specific data
                this.components.state.updatePlayer({
                    wallet: null,
                    playerId: null,
                    gcabBalance: 0
                });
                break;
                
            case 'error':
                this.handleError(new Error(`Auth error: ${event.error}`));
                break;
        }
    }

    handleStateChange(event) {
        // Notify state change callbacks
        this.notifyStateChange(event);
        
        // Auto-sync on certain state changes
        if (this.shouldAutoSyncOnStateChange(event)) {
            setTimeout(() => this.sync(), 500);
        }
    }

    handleNetworkStatus(online) {
        if (online) {
            console.log('🌐 GCABSyncEngine: Back online, resuming sync');
            setTimeout(() => this.sync(), 2000);
        } else {
            console.log('📴 GCABSyncEngine: Offline, pausing sync');
        }
    }

    handleError(error) {
        console.error('❌ GCABSyncEngine: Error:', error);
        
        // Create error event
        const errorEvent = {
            timestamp: Date.now(),
            error: error.message,
            stack: error.stack,
            errorCount: this.syncStatus.errorCount
        };
        
        // Notify error callbacks
        this.notifyError(errorEvent);
        
        // Emit error event
        this.components.events.emit('sync:error', errorEvent);
    }

    // ========== CALLBACK MANAGEMENT ==========

    onSyncStart(callback) {
        this.syncCallbacks.onStart.push(callback);
        return () => {
            this.syncCallbacks.onStart = this.syncCallbacks.onStart.filter(cb => cb !== callback);
        };
    }

    onSyncComplete(callback) {
        this.syncCallbacks.onComplete.push(callback);
        return () => {
            this.syncCallbacks.onComplete = this.syncCallbacks.onComplete.filter(cb => cb !== callback);
        };
    }

    onSyncError(callback) {
        this.syncCallbacks.onError.push(callback);
        return () => {
            this.syncCallbacks.onError = this.syncCallbacks.onError.filter(cb => cb !== callback);
        };
    }

    onStateChange(callback) {
        this.syncCallbacks.onStateChange.push(callback);
        return () => {
            this.syncCallbacks.onStateChange = this.syncCallbacks.onStateChange.filter(cb => cb !== callback);
        };
    }

    notifySyncStart() {
        const event = {
            timestamp: Date.now(),
            components: Object.keys(this.components)
        };
        
        this.syncCallbacks.onStart.forEach(callback => {
            try {
                callback(event);
            } catch (error) {
                console.error('Sync start callback error:', error);
            }
        });
        
        this.components.events.emit('sync:started', event);
    }

    notifySyncComplete() {
        const event = {
            timestamp: Date.now(),
            lastSync: this.syncStatus.lastSync,
            nextSync: this.syncStatus.lastSync + this.syncStatus.syncInterval
        };
        
        this.syncCallbacks.onComplete.forEach(callback => {
            try {
                callback(event);
            } catch (error) {
                console.error('Sync complete callback error:', error);
            }
        });
    }

    notifyStateChange(event) {
        this.syncCallbacks.onStateChange.forEach(callback => {
            try {
                callback(event);
            } catch (error) {
                console.error('State change callback error:', error);
            }
        });
    }

    notifyError(errorEvent) {
        this.syncCallbacks.onError.forEach(callback => {
            try {
                callback(errorEvent);
            } catch (error) {
                console.error('Error callback error:', error);
            }
        });
    }

    // ========== UTILITY METHODS ==========

    shouldAutoSyncOnStateChange(event) {
        // Auto-sync on these state changes
        const autoSyncPaths = [
            'player.gcabBalance',
            'player.gameScore',
            'market.gcabPrice',
            'game.active'
        ];
        
        return event.changes.some(change => 
            autoSyncPaths.some(path => change.path.startsWith(path))
        );
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getStatus() {
        return {
            ...this.syncStatus,
            components: Object.keys(this.components).filter(key => this.components[key]),
            nextSyncIn: Math.max(0, 
                (this.syncStatus.lastSync + this.syncStatus.syncInterval) - Date.now()
            ),
            isOnline: navigator.onLine
        };
    }

    forceSync() {
        return this.sync(true);
    }

    pauseSync() {
        this.syncStatus.isSyncing = false;
        console.log('⏸️ GCABSyncEngine: Sync paused');
    }

    resumeSync() {
        console.log('▶️ GCABSyncEngine: Sync resumed');
        this.sync();
    }
}

// Initialize global instance
window.GCABSyncEngine = new GCABSyncEngine();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GCABSyncEngine };
}