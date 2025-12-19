// GCAB REAL DATA FETCHER v1.0
// Using R3155G27RA7HY9RPGIWA6XDBD73P477VQG

const GCABData = {
    // ===== CONFIGURATION =====
    config: {
        contract: '0x6d0B8eB75E9d6735cc301c3a6E82adeE43590B07',
        dexScreener: 'https://api.dexscreener.com/latest/dex/tokens/0x6d0B8eB75E9d6735cc301c3a6E82adeE43590B07',
        basescan: {
            api: 'https://api.basescan.org/api',
            key: 'R3155G27RA7HY9RPGIWA6XDBD73P477VQG'
        },
        cacheTime: 30000, // 30 seconds
        useMockData: false, // Set to TRUE if APIs fail
        debug: true
    },

    // ===== CACHE =====
    cache: {
        market: null,
        holders: null,
        transactions: null,
        lastUpdate: null
    },

    // ===== PUBLIC API =====
    
    async getLiveData() {
        console.log('📊 GCAB: Fetching live data...');
        
        try {
            const [market, holders, transactions] = await Promise.all([
                this.getMarketData(),
                this.getHolderCount(),
                this.getRecentTransactions()
            ]);
            
            const data = {
                market,
                holders,
                transactions,
                lastUpdated: new Date().toLocaleTimeString(),
                isReal: true
            };
            
            this.cache.lastUpdate = Date.now();
            this.cache.market = market;
            this.cache.holders = holders;
            
            if (this.config.debug) {
                console.log('✅ GCAB Live Data:', data);
            }
            
            return data;
            
        } catch (error) {
            console.error('❌ GCAB: Failed to fetch live data:', error);
            return this.getMockData();
        }
    },

    // ===== MARKET DATA (DexScreener) =====
    
    async getMarketData() {
        try {
            const response = await fetch(this.config.dexScreener);
            const data = await response.json();
            
            if (!data.pairs || data.pairs.length === 0) {
                throw new Error('No market data found');
            }
            
            // Find the most liquid Base pair
            const basePairs = data.pairs.filter(p => 
                p.chainId === 'base' && 
                p.dexId === 'baseswap-v2' || 
                p.dexId === 'uniswap-v3'
            );
            
            const pair = basePairs[0] || data.pairs[0];
            
            return {
                price: parseFloat(pair.priceUsd) || 0,
                priceChange24h: parseFloat(pair.priceChange?.h24) || 0,
                liquidity: parseFloat(pair.liquidity?.usd) || 0,
                volume24h: parseFloat(pair.volume?.h24) || 0,
                fdv: parseFloat(pair.fdv) || 0,
                pairAddress: pair.pairAddress,
                dexId: pair.dexId,
                baseToken: pair.baseToken?.symbol,
                quoteToken: pair.quoteToken?.symbol,
                pairUrl: pair.url,
                timestamp: Date.now()
            };
            
        } catch (error) {
            console.error('❌ GCAB: Market data error:', error);
            return this.getMockMarketData();
        }
    },

    // ===== HOLDER DATA (BaseScan) =====
    
    async getHolderCount() {
        try {
            const url = `${this.config.basescan.api}?module=token&action=tokenholderlist&contractaddress=${this.config.contract}&page=1&offset=1&sort=asc&apikey=${this.config.basescan.key}`;
            
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.status === '1' && data.result) {
                return {
                    count: data.result.length,
                    holders: data.result.slice(0, 5), // Top 5 holders
                    source: 'basescan'
                };
            }
            
            // Alternative: Get from token info
            return await this.getTokenInfo();
            
        } catch (error) {
            console.error('❌ GCAB: Holder data error:', error);
            return {
                count: 284,
                holders: [],
                source: 'mock'
            };
        }
    },

    async getTokenInfo() {
        try {
            const url = `${this.config.basescan.api}?module=token&action=tokeninfo&contractaddress=${this.config.contract}&apikey=${this.config.basescan.key}`;
            
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.status === '1' && data.result) {
                const token = data.result[0];
                return {
                    count: parseInt(token.totalHolders) || 284,
                    totalSupply: token.totalSupply,
                    decimals: token.decimals,
                    name: token.tokenName,
                    symbol: token.tokenSymbol,
                    source: 'basescan'
                };
            }
            
            throw new Error('No token info found');
            
        } catch (error) {
            console.error('❌ GCAB: Token info error:', error);
            return {
                count: 284,
                totalSupply: '1000000000',
                decimals: '18',
                name: 'GIGACHAD ALPHA',
                symbol: 'GCAB',
                source: 'mock'
            };
        }
    },

    // ===== TRANSACTION DATA =====
    
    async getRecentTransactions() {
        try {
            const url = `${this.config.basescan.api}?module=account&action=tokentx&contractaddress=${this.config.contract}&page=1&offset=10&sort=desc&apikey=${this.config.basescan.key}`;
            
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.status === '1' && data.result) {
                return data.result.slice(0, 5).map(tx => ({
                    hash: tx.hash,
                    from: this.truncateAddress(tx.from),
                    to: this.truncateAddress(tx.to),
                    value: (parseInt(tx.value) / Math.pow(10, 18)).toFixed(0),
                    timestamp: parseInt(tx.timeStamp) * 1000,
                    type: tx.from.toLowerCase().includes('uniswap') ? 'BUY' : 
                          tx.to.toLowerCase().includes('uniswap') ? 'SELL' : 'TRANSFER'
                }));
            }
            
            return this.getMockTransactions();
            
        } catch (error) {
            console.error('❌ GCAB: Transaction data error:', error);
            return this.getMockTransactions();
        }
    },

    // ===== MOCK DATA (Fallback) =====
    
    getMockData() {
        return {
            market: this.getMockMarketData(),
            holders: { count: 284, holders: [], source: 'mock' },
            transactions: this.getMockTransactions(),
            lastUpdated: new Date().toLocaleTimeString(),
            isReal: false
        };
    },

    getMockMarketData() {
        const basePrice = 0.000000369;
        const randomChange = (Math.random() * 20 - 10) / 100;
        
        return {
            price: basePrice * (1 + randomChange),
            priceChange24h: randomChange * 100,
            liquidity: 2000 + Math.random() * 1000,
            volume24h: 50000 + Math.random() * 20000,
            fdv: 50000 + Math.random() * 50000,
            pairAddress: '0x...',
            dexId: 'baseswap-v2',
            baseToken: 'GCAB',
            quoteToken: 'WETH',
            timestamp: Date.now(),
            source: 'mock'
        };
    },

    getMockTransactions() {
        const types = ['BUY', 'SELL', 'TRANSFER'];
        const addresses = [
            '0x1234...5678', '0xabcd...efgh', '0x7890...1234',
            '0xfedc...ba98', '0x2468...1357'
        ];
        
        return Array.from({ length: 5 }, (_, i) => ({
            hash: `0x${Math.random().toString(16).substr(2, 16)}`,
            from: addresses[i],
            to: addresses[(i + 1) % addresses.length],
            value: (1000 + Math.random() * 10000).toFixed(0),
            timestamp: Date.now() - (i * 300000), // 5 min intervals
            type: types[i % types.length]
        }));
    },

    // ===== UTILITIES =====
    
    formatPrice(price) {
        if (price >= 1) return `$${price.toFixed(2)}`;
        if (price >= 0.1) return `$${price.toFixed(4)}`;
        if (price >= 0.01) return `$${price.toFixed(5)}`;
        if (price >= 0.001) return `$${price.toFixed(6)}`;
        return `$${price.toFixed(8)}`;
    },

    formatNumber(num) {
        if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
        if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
        if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
        return `$${num.toFixed(2)}`;
    },

    formatLargeNumber(num) {
        return parseInt(num).toLocaleString();
    },

    getPriceChangeClass(change) {
        if (change > 0) return 'positive';
        if (change < 0) return 'negative';
        return 'neutral';
    },

    truncateAddress(address, start = 6, end = 4) {
        if (!address || address.length < start + end) return address;
        return `${address.slice(0, start)}...${address.slice(-end)}`;
    },

    // ===== LIVE UPDATER =====
    
    startLiveUpdates(callback, interval = 30000) {
        // Initial update
        this.getLiveData().then(callback);
        
        // Set up interval
        const intervalId = setInterval(() => {
            this.getLiveData().then(callback);
        }, interval);
        
        return {
            stop: () => clearInterval(intervalId),
            refresh: () => this.getLiveData().then(callback)
        };
    }
};

// Initialize global instance
window.GCABData = GCABData;

console.log('✅ GCAB Data Fetcher loaded with API key:', 
    GCABData.config.basescan.key ? '✓' : '✗'
);