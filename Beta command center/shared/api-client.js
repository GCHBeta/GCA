// GCAB Ecosystem - Unified API Client
// Handles all API communications with error handling and retries

class GCABAPIClient {
    constructor(config = {}) {
        this.config = {
            baseURL: 'https://api.gcab-ecosystem.com', // Your backend
            timeout: 10000, // 10 seconds
            retries: 3,
            retryDelay: 1000,
            enableCache: true,
            cacheTTL: 30000, // 30 seconds
            ...config
        };
        
        this.cache = new Map();
        this.requestQueue = [];
        this.isProcessingQueue = false;
        
        // Initialize interceptors
        this.interceptors = {
            request: [],
            response: [],
            error: []
        };
    }

    // ========== PUBLIC METHODS ==========

    // Player endpoints
    async getPlayerStats(wallet) {
        return this.request(`/player/${wallet}/stats`);
    }

    async updatePlayerProfile(data) {
        return this.request('/player/profile', {
            method: 'POST',
            body: data
        });
    }

    async getPlayerAchievements(wallet) {
        return this.request(`/player/${wallet}/achievements`);
    }

    async submitAchievement(achievement) {
        return this.request('/player/achievements', {
            method: 'POST',
            body: achievement
        });
    }

    // Game endpoints
    async getGameState(gameId = 'current') {
        return this.request(`/game/${gameId}/state`);
    }

    async submitGameResult(result) {
        return this.request('/game/results', {
            method: 'POST',
            body: result
        });
    }

    async getLeaderboard(type = 'all-time', limit = 100) {
        return this.request(`/leaderboard/${type}?limit=${limit}`);
    }

    async joinTournament(tournamentId) {
        return this.request(`/tournament/${tournamentId}/join`, {
            method: 'POST'
        });
    }

    // Market endpoints
    async getGCABPrice() {
        return this.request('/market/price');
    }

    async getMarketStats() {
        return this.request('/market/stats');
    }

    async getHolderDistribution() {
        return this.request('/market/holders/distribution');
    }

    async getRecentTrades(limit = 50) {
        return this.request(`/market/trades?limit=${limit}`);
    }

    // Meme endpoints
    async submitMeme(memeData) {
        const formData = new FormData();
        
        // Add all fields
        Object.keys(memeData).forEach(key => {
            if (memeData[key] !== undefined) {
                formData.append(key, memeData[key]);
            }
        });
        
        return this.request('/memes/submit', {
            method: 'POST',
            body: formData,
            headers: {} // Let browser set multipart headers
        });
    }

    async getMemes(sort = 'latest', limit = 20) {
        return this.request(`/memes?sort=${sort}&limit=${limit}`);
    }

    async voteMeme(memeId, vote) {
        return this.request(`/memes/${memeId}/vote`, {
            method: 'POST',
            body: { vote }
        });
    }

    // Ecosystem endpoints
    async getEcosystemStats() {
        return this.request('/ecosystem/stats');
    }

    async getActivePlayers() {
        return this.request('/ecosystem/players/active');
    }

    // ========== CORE REQUEST METHOD ==========

    async request(endpoint, options = {}) {
        const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        const cacheKey = this.getCacheKey(endpoint, options);
        
        // Check cache first
        if (this.config.enableCache && options.method !== 'POST') {
            const cached = this.getFromCache(cacheKey);
            if (cached) {
                console.log(`📦 API: Cache hit for ${endpoint}`);
                return cached;
            }
        }
        
        // Prepare request
        const url = this.config.baseURL + endpoint;
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-GCAB-Request-ID': requestId,
            'X-GCAB-Player-ID': this.getPlayerId(),
            'X-GCAB-Session': this.getSessionToken(),
            ...options.headers
        };
        
        const requestOptions = {
            method: options.method || 'GET',
            headers,
            timeout: this.config.timeout,
            ...options
        };
        
        // Remove Content-Type for FormData (let browser set it)
        if (options.body instanceof FormData) {
            delete requestOptions.headers['Content-Type'];
        } else if (requestOptions.body && typeof requestOptions.body !== 'string') {
            requestOptions.body = JSON.stringify(requestOptions.body);
        }
        
        try {
            // Apply request interceptors
            const interceptedOptions = await this.applyRequestInterceptors({
                url,
                ...requestOptions
            });
            
            console.log(`🌐 API: ${interceptedOptions.method} ${endpoint}`);
            
            // Execute request with retries
            const response = await this.executeWithRetry(
                () => this.fetchWithTimeout(url, interceptedOptions),
                this.config.retries,
                this.config.retryDelay
            );
            
            // Parse response
            const data = await this.parseResponse(response);
            
            // Apply response interceptors
            const interceptedData = await this.applyResponseInterceptors(data, {
                url,
                options: interceptedOptions,
                response
            });
            
            // Cache successful GET requests
            if (this.config.enableCache && interceptedOptions.method === 'GET') {
                this.setCache(cacheKey, interceptedData);
            }
            
            return interceptedData;
            
        } catch (error) {
            // Apply error interceptors
            const interceptedError = await this.applyErrorInterceptors(error, {
                url,
                options: requestOptions,
                endpoint
            });
            
            throw interceptedError;
        }
    }

    // ========== PRIVATE METHODS ==========

    async executeWithRetry(fn, retries, delay) {
        let lastError;
        
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                
                // Don't retry on certain errors
                if (this.isFatalError(error)) {
                    break;
                }
                
                if (attempt < retries) {
                    console.log(`🔄 API: Retry attempt ${attempt}/${retries} after ${delay}ms`);
                    await this.sleep(delay);
                    delay *= 2; // Exponential backoff
                }
            }
        }
        
        throw lastError;
    }

    async fetchWithTimeout(url, options) {
        const { timeout, ...fetchOptions } = options;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        try {
            const response = await fetch(url, {
                ...fetchOptions,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            return response;
            
        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                throw new Error(`Request timeout after ${timeout}ms`);
            }
            
            throw error;
        }
    }

    async parseResponse(response) {
        const contentType = response.headers.get('content-type');
        
        if (!response.ok) {
            let errorData;
            
            if (contentType && contentType.includes('application/json')) {
                errorData = await response.json();
            } else {
                errorData = await response.text();
            }
            
            const error = new Error(`API Error: ${response.status} ${response.statusText}`);
            error.status = response.status;
            error.data = errorData;
            error.response = response;
            
            throw error;
        }
        
        if (contentType && contentType.includes('application/json')) {
            return response.json();
        }
        
        return response.text();
    }

    isFatalError(error) {
        // Don't retry on these errors
        const fatalStatuses = [400, 401, 403, 404, 422];
        return fatalStatuses.includes(error.status);
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ========== CACHE METHODS ==========

    getCacheKey(endpoint, options) {
        const method = options.method || 'GET';
        const body = options.body ? JSON.stringify(options.body) : '';
        return `${method}:${endpoint}:${body}`;
    }

    getFromCache(key) {
        const cached = this.cache.get(key);
        
        if (cached && Date.now() - cached.timestamp < this.config.cacheTTL) {
            return cached.data;
        }
        
        // Remove expired cache
        if (cached) {
            this.cache.delete(key);
        }
        
        return null;
    }

    setCache(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
        
        // Cleanup old cache entries periodically
        setTimeout(() => {
            this.cleanupCache();
        }, this.config.cacheTTL * 2);
    }

    cleanupCache() {
        const now = Date.now();
        
        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp > this.config.cacheTTL) {
                this.cache.delete(key);
            }
        }
    }

    clearCache() {
        this.cache.clear();
    }

    // ========== INTERCEPTOR METHODS ==========

    addRequestInterceptor(interceptor) {
        this.interceptors.request.push(interceptor);
    }

    addResponseInterceptor(interceptor) {
        this.interceptors.response.push(interceptor);
    }

    addErrorInterceptor(interceptor) {
        this.interceptors.error.push(interceptor);
    }

    async applyRequestInterceptors(request) {
        let processedRequest = { ...request };
        
        for (const interceptor of this.interceptors.request) {
            processedRequest = await interceptor(processedRequest);
        }
        
        return processedRequest;
    }

    async applyResponseInterceptors(data, context) {
        let processedData = data;
        
        for (const interceptor of this.interceptors.response) {
            processedData = await interceptor(processedData, context);
        }
        
        return processedData;
    }

    async applyErrorInterceptors(error, context) {
        let processedError = error;
        
        for (const interceptor of this.interceptors.error) {
            processedError = await interceptor(processedError, context);
        }
        
        return processedError;
    }

    // ========== UTILITY METHODS ==========

    getPlayerId() {
        if (window.GCABAuth) {
            return window.GCABAuth.getPlayerData()?.playerId;
        }
        
        const session = GCABAuth.getCurrentSession();
        return session?.playerId;
    }

    getSessionToken() {
        if (window.GCABAuth) {
            return window.GCABAuth.getPlayerData()?.sessionToken;
        }
        
        const session = GCABAuth.getCurrentSession();
        return session?.sessionToken;
    }

    // ========== MOCK API FOR DEVELOPMENT ==========

    static createMockClient() {
        const client = new GCABAPIClient({
            baseURL: 'https://mock-api.gcab.com'
        });
        
        // Add mock interceptors for development
        client.addRequestInterceptor(async (request) => {
            console.log(`🎭 MOCK API: ${request.method} ${request.url}`);
            
            // For development, use mock data
            if (request.url.includes('/market/price')) {
                return {
                    ...request,
                    url: 'https://api.dexscreener.com/latest/dex/tokens/0x6d0B8eb7BE9d6735cc301c3a6E82adeE43590B07'
                };
            }
            
            return request;
        });
        
        client.addResponseInterceptor(async (data, context) => {
            // If we're using a real API endpoint, pass through
            if (!context.url.includes('mock-api.gcab.com')) {
                return data;
            }
            
            // Otherwise, return mock data based on endpoint
            const endpoint = new URL(context.url).pathname;
            
            switch (endpoint) {
                case '/player/stats':
                    return {
                        wallet: '0x1234...5678',
                        gcabBalance: 1000000 + Math.floor(Math.random() * 500000),
                        usdValue: 150 + Math.random() * 50,
                        gameScore: 5000 + Math.floor(Math.random() * 2000),
                        level: 5,
                        achievements: [
                            { id: 'first_trade', name: 'First Trade', unlocked: true },
                            { id: 'game_master', name: 'Game Master', unlocked: true },
                            { id: 'meme_king', name: 'Meme King', unlocked: false }
                        ],
                        rank: 'Based Chad'
                    };
                    
                case '/market/price':
                    return {
                        price: 0.00001 + (Math.random() * 0.000005),
                        change24h: (Math.random() * 20 - 10).toFixed(2),
                        volume: 50000 + Math.random() * 20000,
                        liquidity: 2000 + Math.random() * 1000
                    };
                    
                case '/leaderboard/all-time':
                    return {
                        leaderboard: Array.from({ length: 20 }, (_, i) => ({
                            rank: i + 1,
                            playerId: `player_${Math.random().toString(36).substr(2, 8)}`,
                            score: 10000 - (i * 500),
                            wallet: `0x${Math.random().toString(36).substr(2, 10)}...`
                        }))
                    };
                    
                case '/ecosystem/stats':
                    return {
                        totalPlayers: 350,
                        activePlayers: 85,
                        totalTransactions: 1250,
                        memesSubmitted: 180,
                        totalVolume: 450000,
                        averageHoldTime: '3.2 days'
                    };
                    
                default:
                    return { success: true, message: 'Mock response', endpoint };
            }
        });
        
        return client;
    }
}

// Initialize global instance (use mock for development)
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window.GCABAPI = GCABAPIClient.createMockClient();
    console.log('🎭 GCABAPIClient: Using MOCK API for development');
} else {
    window.GCABAPI = new GCABAPIClient();
    console.log('🌐 GCABAPIClient: Using REAL API');
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GCABAPIClient };
}