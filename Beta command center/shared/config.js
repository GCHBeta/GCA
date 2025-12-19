// GCAB Ecosystem - Shared Configuration
// Centralized config for Panel and Game

const GCABConfig = {
    // ========== APP CONFIG ==========
    app: {
        name: 'GIGACHAD ALPHA (Still Beta)',
        version: '0.9.9',
        environment: process.env.NODE_ENV || 'development',
        isBeta: true,
        betaTagline: 'Alpha flex, Beta vibes, Forever.'
    },

    // ========== NETWORK CONFIG ==========
    network: {
        chainId: '0x2105', // Base Mainnet: 8453
        chainName: 'Base',
        nativeCurrency: {
            name: 'Ethereum',
            symbol: 'ETH',
            decimals: 18
        },
        rpcUrls: ['https://mainnet.base.org'],
        blockExplorerUrls: ['https://basescan.org'],
        contractAddress: '0x6d0B8eb7BE9d6735cc301c3a6E82adeE43590B07'
    },

    // ========== API CONFIG ==========
    api: {
        baseURL: 'https://api.gcab-ecosystem.com',
        endpoints: {
            market: {
                price: '/market/price',
                stats: '/market/stats',
                holders: '/market/holders'
            },
            player: {
                stats: '/player/:wallet/stats',
                achievements: '/player/:wallet/achievements',
                submitScore: '/player/score'
            },
            game: {
                state: '/game/state',
                leaderboard: '/leaderboard/:type',
                submitResult: '/game/result'
            },
            memes: {
                submit: '/memes/submit',
                list: '/memes',
                vote: '/memes/:id/vote'
            }
        },
        timeout: 10000,
        retryAttempts: 3
    },

    // ========== SYNC CONFIG ==========
    sync: {
        interval: 15000, // 15 seconds
        enableCrossTab: true,
        enableOfflineQueue: true,
        maxOfflineItems: 50,
        retryDelay: 5000
    },

    // ========== UI CONFIG ==========
    ui: {
        themes: {
            dark: {
                primary: '#00eeff',
                secondary: '#ffaa00',
                accent: '#9d00ff',
                background: '#0a0a0a',
                surface: '#1a1a1a',
                text: '#ffffff'
            },
            light: {
                primary: '#0066cc',
                secondary: '#ff6600',
                accent: '#9900ff',
                background: '#f5f5f5',
                surface: '#ffffff',
                text: '#333333'
            },
            beta: {
                primary: '#ff0055',
                secondary: '#00ffaa',
                accent: '#ffaa00',
                background: '#000000',
                surface: '#111111',
                text: '#ffffff',
                glitch: true
            }
        },
        defaultTheme: 'dark',
        animations: {
            enabled: true,
            duration: 300
        }
    },

    // ========== GAME CONFIG ==========
    game: {
        defaultStake: 1000, // GCAB tokens
        maxStake: 1000000,
        minStake: 100,
        roundDuration: 300, // 5 minutes in seconds
        cooldown: 60, // 1 minute
        rewards: {
            winMultiplier: 2,
            bonusMultiplier: 1.5,
            referralBonus: 0.1 // 10%
        }
    },

    // ========== MARKET CONFIG ==========
    market: {
        defaultTokens: {
            GCAB: '0x6d0B8eb7BE9d6735cc301c3a6E82adeE43590B07',
            WETH: '0x4200000000000000000000000000000000000006',
            USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
        },
        dex: {
            uniswap: 'https://app.uniswap.org/swap?chain=base&outputCurrency=',
            baseswap: 'https://app.baseswap.fi/swap?outputCurrency='
        }
    },

    // ========== SOCIAL CONFIG ==========
    social: {
        links: {
            twitter: 'https://x.com/GCHBeta',
            telegram: 'https://t.me/GCHBeta',
            website: 'https://gchbeta.github.io/GCA/',
            github: 'https://github.com/gchbeta'
        },
        shareText: {
            win: 'I just won {amount} $GCAB in the GCAB game! 🎮🚀',
            meme: 'Check out this $GCAB meme I made! 😂',
            portfolio: 'My $GCAB portfolio is looking based! 💪'
        }
    },

    // ========== FEATURE FLAGS ==========
    features: {
        enableWalletConnect: true,
        enableGame: true,
        enableMemeGenerator: true,
        enableLeaderboard: true,
        enableNotifications: true,
        enableSounds: true,
        enableBetaEasterEggs: true
    },

    // ========== SECURITY CONFIG ==========
    security: {
        sessionDuration: 7 * 24 * 60 * 60 * 1000, // 7 days
        maxLoginAttempts: 5,
        rateLimit: {
            api: 100, // requests per minute
            game: 30,
            memes: 20
        }
    },

    // ========== ANALYTICS CONFIG ==========
    analytics: {
        enabled: true,
        providers: ['internal', 'google'],
        googleTrackingId: null, // Set in production
        internalEndpoint: '/analytics/event'
    },

    // ========== ERROR CONFIG ==========
    errors: {
        showDetails: process.env.NODE_ENV === 'development',
        reportToServer: true,
        maxLogLength: 1000
    },

    // ========== LOCALIZATION CONFIG ==========
    i18n: {
        defaultLanguage: 'en',
        supportedLanguages: ['en'],
        fallbackLanguage: 'en'
    }
};

// Environment-specific overrides
if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        // Development config
        GCABConfig.app.environment = 'development';
        GCABConfig.api.baseURL = 'https://mock-api.gcab.com';
        GCABConfig.features.enableBetaEasterEggs = true;
        GCABConfig.errors.showDetails = true;
        
    } else if (hostname.includes('beta.') || hostname.includes('staging.')) {
        // Staging config
        GCABConfig.app.environment = 'staging';
        GCABConfig.api.baseURL = 'https://staging-api.gcab-ecosystem.com';
        
    } else {
        // Production config
        GCABConfig.app.environment = 'production';
        GCABConfig.features.enableBetaEasterEggs = false;
        GCABConfig.errors.showDetails = false;
    }
}

// Freeze config to prevent accidental modification
Object.freeze(GCABConfig);

// Make available globally
window.GCABConfig = GCABConfig;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GCABConfig };
}

console.log(`✅ GCABConfig loaded: ${GCABConfig.app.name} v${GCABConfig.app.version} (${GCABConfig.app.environment})`);