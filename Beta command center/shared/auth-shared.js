// GCAB Ecosystem - Shared Authentication System
// Use in BOTH panel and game for seamless login

class GCABAuth {
    constructor() {
        this.playerId = null;
        this.walletAddress = null;
        this.sessionToken = null;
        this.isAuthenticated = false;
        this.authListeners = [];
        
        // Check for existing session on init
        this.restoreSession();
    }

    // ========== PUBLIC METHODS ==========

    async connectWallet(provider = 'auto') {
        try {
            console.log('🔄 GCABAuth: Connecting wallet...');
            
            // Detect wallet
            const ethereum = await this.detectWallet(provider);
            if (!ethereum) {
                throw new Error('No wallet found. Install MetaMask or Coinbase Wallet.');
            }

            // Request accounts
            const accounts = await ethereum.request({ 
                method: 'eth_requestAccounts' 
            });
            
            this.walletAddress = accounts[0];
            this.playerId = this.generatePlayerId(this.walletAddress);
            this.sessionToken = this.createSessionToken();
            this.isAuthenticated = true;
            
            // Save to shared storage
            this.saveSession();
            
            // Notify listeners
            this.notifyAuthChange({
                type: 'connected',
                wallet: this.walletAddress,
                playerId: this.playerId
            });
            
            console.log('✅ GCABAuth: Wallet connected:', this.walletAddress);
            return this.walletAddress;
            
        } catch (error) {
            console.error('❌ GCABAuth: Connection failed:', error);
            this.notifyAuthChange({ type: 'error', error: error.message });
            throw error;
        }
    }

    disconnect() {
        this.playerId = null;
        this.walletAddress = null;
        this.sessionToken = null;
        this.isAuthenticated = false;
        
        // Clear storage
        localStorage.removeItem('gcab_auth_session');
        localStorage.removeItem('gcab_player_data');
        
        // Notify listeners
        this.notifyAuthChange({ type: 'disconnected' });
        
        console.log('👋 GCABAuth: Disconnected');
    }

    getPlayerData() {
        if (!this.isAuthenticated) return null;
        
        return {
            playerId: this.playerId,
            wallet: this.walletAddress,
            sessionToken: this.sessionToken,
            isAuthenticated: this.isAuthenticated
        };
    }

    onAuthChange(callback) {
        this.authListeners.push(callback);
        return () => {
            this.authListeners = this.authListeners.filter(cb => cb !== callback);
        };
    }

    // ========== PRIVATE METHODS ==========

    async detectWallet(provider) {
        if (provider === 'auto' || provider === 'metamask') {
            if (window.ethereum) return window.ethereum;
        }
        
        if (provider === 'coinbase' || provider === 'auto') {
            if (window.coinbaseWalletExtension) return window.coinbaseWalletExtension;
            if (window.ethereum?.isCoinbaseWallet) return window.ethereum;
        }
        
        // Check for injected providers
        if (window.ethereum?.providers?.length) {
            return window.ethereum.providers.find(p => 
                p.isMetaMask || p.isCoinbaseWallet
            ) || window.ethereum.providers[0];
        }
        
        return window.ethereum;
    }

    generatePlayerId(walletAddress) {
        // Create deterministic player ID from wallet
        const hash = this.simpleHash(walletAddress.toLowerCase());
        return `gcab_player_${hash.slice(0, 8)}`;
    }

    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16);
    }

    createSessionToken() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 15);
        return `gcab_sess_${timestamp}_${random}`;
    }

    saveSession() {
        const sessionData = {
            playerId: this.playerId,
            wallet: this.walletAddress,
            sessionToken: this.sessionToken,
            timestamp: Date.now(),
            expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
        };
        
        localStorage.setItem('gcab_auth_session', JSON.stringify(sessionData));
        
        // Also set a flag for cross-tab detection
        localStorage.setItem('gcab_auth_active', 'true');
    }

    restoreSession() {
        try {
            const saved = localStorage.getItem('gcab_auth_session');
            if (!saved) return false;
            
            const session = JSON.parse(saved);
            
            // Check if session is expired
            if (session.expiresAt < Date.now()) {
                localStorage.removeItem('gcab_auth_session');
                return false;
            }
            
            this.playerId = session.playerId;
            this.walletAddress = session.wallet;
            this.sessionToken = session.sessionToken;
            this.isAuthenticated = true;
            
            console.log('🔄 GCABAuth: Session restored for', this.playerId);
            return true;
            
        } catch (error) {
            console.error('❌ GCABAuth: Failed to restore session:', error);
            return false;
        }
    }

    notifyAuthChange(event) {
        this.authListeners.forEach(callback => {
            try {
                callback(event);
            } catch (error) {
                console.error('Auth listener error:', error);
            }
        });
        
        // Also dispatch global event
        window.dispatchEvent(new CustomEvent('gcab:auth:changed', {
            detail: event
        }));
    }

    // ========== STATIC METHODS ==========

    static isAvailable() {
        return !!(window.ethereum || window.coinbaseWalletExtension);
    }

    static getCurrentSession() {
        try {
            const saved = localStorage.getItem('gcab_auth_session');
            return saved ? JSON.parse(saved) : null;
        } catch {
            return null;
        }
    }
}

// Initialize global instance
window.GCABAuth = new GCABAuth();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GCABAuth };
}