// GCAB Ecosystem - Utility Functions
// Shared utilities for Panel and Game

const GCABUtils = {
    // ========== STRING UTILITIES ==========
    
    truncateAddress(address, start = 6, end = 4) {
        if (!address || address.length < start + end) return address;
        return `${address.slice(0, start)}...${address.slice(-end)}`;
    },
    
    formatNumber(num, decimals = 2) {
        if (num === null || num === undefined) return '0';
        
        const absNum = Math.abs(num);
        let formatted;
        
        if (absNum >= 1e9) {
            formatted = (num / 1e9).toFixed(decimals) + 'B';
        } else if (absNum >= 1e6) {
            formatted = (num / 1e6).toFixed(decimals) + 'M';
        } else if (absNum >= 1e3) {
            formatted = (num / 1e3).toFixed(decimals) + 'K';
        } else {
            formatted = num.toFixed(decimals);
        }
        
        return formatted;
    },
    
    formatCurrency(amount, currency = 'USD', decimals = 2) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency,
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }).format(amount);
    },
    
    formatPercentage(value, decimals = 2) {
        const fixed = value.toFixed(decimals);
        return `${value >= 0 ? '+' : ''}${fixed}%`;
    },
    
    generateId(prefix = 'id') {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    },
    
    // ========== VALIDATION UTILITIES ==========
    
    isValidEthereumAddress(address) {
        return /^0x[a-fA-F0-9]{40}$/.test(address);
    },
    
    isValidGCABAmount(amount) {
        const num = parseFloat(amount);
        return !isNaN(num) && num > 0 && num <= 1e12; // Reasonable upper limit
    },
    
    isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },
    
    // ========== DATE/TIME UTILITIES ==========
    
    formatDate(timestamp, format = 'relative') {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (format === 'relative') {
            const seconds = Math.floor(diff / 1000);
            const minutes = Math.floor(seconds / 60);
            const hours = Math.floor(minutes / 60);
            const days = Math.floor(hours / 24);
            
            if (days > 7) {
                return date.toLocaleDateString();
            } else if (days > 0) {
                return `${days}d ago`;
            } else if (hours > 0) {
                return `${hours}h ago`;
            } else if (minutes > 0) {
                return `${minutes}m ago`;
            } else {
                return 'Just now';
            }
        }
        
        return date.toLocaleString();
    },
    
    getTimeRemaining(endTime) {
        const now = Date.now();
        const remaining = endTime - now;
        
        if (remaining <= 0) return { expired: true };
        
        const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
        const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
        
        return {
            days,
            hours,
            minutes,
            seconds,
            total: remaining,
            expired: false
        };
    },
    
    // ========== DOM UTILITIES ==========
    
    createElement(tag, attributes = {}, children = []) {
        const element = document.createElement(tag);
        
        Object.keys(attributes).forEach(key => {
            if (key === 'style' && typeof attributes[key] === 'object') {
                Object.assign(element.style, attributes[key]);
            } else if (key === 'class') {
                element.className = attributes[key];
            } else if (key.startsWith('on') && typeof attributes[key] === 'function') {
                element.addEventListener(key.substring(2).toLowerCase(), attributes[key]);
            } else {
                element.setAttribute(key, attributes[key]);
            }
        });
        
        children.forEach(child => {
            if (typeof child === 'string') {
                element.appendChild(document.createTextNode(child));
            } else if (child instanceof Node) {
                element.appendChild(child);
            }
        });
        
        return element;
    },
    
    copyToClipboard(text) {
        return navigator.clipboard.writeText(text).then(() => {
            return true;
        }).catch(() => {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            
            try {
                document.execCommand('copy');
                return true;
            } catch (err) {
                return false;
            } finally {
                document.body.removeChild(textArea);
            }
        });
    },
    
    animateValue(element, start, end, duration = 1000, prefix = '', suffix = '') {
        const startTime = performance.now();
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const current = start + (end - start) * progress;
            element.textContent = `${prefix}${current.toFixed(2)}${suffix}`;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        requestAnimationFrame(animate);
    },
    
    // ========== STORAGE UTILITIES ==========
    
    storage: {
        set(key, value, ttl = null) {
            const item = {
                value,
                timestamp: Date.now(),
                ttl
            };
            
            localStorage.setItem(`gcab_${key}`, JSON.stringify(item));
        },
        
        get(key) {
            const itemStr = localStorage.getItem(`gcab_${key}`);
            
            if (!itemStr) return null;
            
            try {
                const item = JSON.parse(itemStr);
                
                // Check if expired
                if (item.ttl && Date.now() - item.timestamp > item.ttl) {
                    localStorage.removeItem(`gcab_${key}`);
                    return null;
                }
                
                return item.value;
            } catch {
                return null;
            }
        },
        
        remove(key) {
            localStorage.removeItem(`gcab_${key}`);
        },
        
        clear(prefix = 'gcab_') {
            for (let i = localStorage.length - 1; i >= 0; i--) {
                const key = localStorage.key(i);
                if (key.startsWith(prefix)) {
                    localStorage.removeItem(key);
                }
            }
        }
    },
    
    // ========== CRYPTO UTILITIES ==========
    
    crypto: {
        async hashString(str) {
            const encoder = new TextEncoder();
            const data = encoder.encode(str);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        },
        
        generateRandomString(length = 16) {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
            let result = '';
            
            for (let i = 0; i < length; i++) {
                result += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            
            return result;
        }
    },
    
    // ========== API UTILITIES ==========
    
    api: {
        createQueryString(params) {
            const searchParams = new URLSearchParams();
            
            Object.keys(params).forEach(key => {
                if (params[key] !== undefined && params[key] !== null) {
                    searchParams.append(key, params[key]);
                }
            });
            
            return searchParams.toString();
        },
        
        handleError(error, context = '') {
            console.error(`API Error${context ? ` in ${context}` : ''}:`, error);
            
            // Return user-friendly error message
            if (error.status === 401) {
                return 'Session expired. Please reconnect your wallet.';
            } else if (error.status === 403) {
                return 'Access denied.';
            } else if (error.status === 404) {
                return 'Resource not found.';
            } else if (error.status === 429) {
                return 'Too many requests. Please wait a moment.';
            } else if (error.status >= 500) {
                return 'Server error. Please try again later.';
            } else if (error.message.includes('timeout')) {
                return 'Request timeout. Please check your connection.';
            } else if (error.message.includes('network')) {
                return 'Network error. Please check your connection.';
            } else {
                return error.message || 'An unexpected error occurred.';
            }
        }
    },
    
    // ========== GAME UTILITIES ==========
    
    game: {
        calculateWinAmount(stake, multiplier = 2) {
            return stake * multiplier;
        },
        
        calculateLevel(score) {
            return Math.floor(Math.sqrt(score / 100)) + 1;
        },
        
        calculateRank(score, leaderboard) {
            if (!leaderboard || leaderboard.length === 0) return 'Unranked';
            
            const sorted = [...leaderboard].sort((a, b) => b.score - a.score);
            const position = sorted.findIndex(entry => entry.score <= score);
            
            if (position === -1) return 'Top 10';
            if (position < 10) return 'Top 10';
            if (position < 100) return 'Top 100';
            if (position < 1000) return 'Top 1K';
            return 'Top 10K';
        },
        
        generateAchievementName(achievementId) {
            const names = {
                first_trade: 'First Trade',
                first_win: 'First Victory',
                streak_5: 'Hot Streak',
                whale: 'GCAB Whale',
                meme_king: 'Meme King',
                beta_tester: 'Beta Tester',
                diamond_hands: 'Diamond Hands',
                based: 'Based'
            };
            
            return names[achievementId] || achievementId.replace(/_/g, ' ');
        }
    },
    
    // ========== UI/UX UTILITIES ==========
    
    ui: {
        showToast(message, type = 'info', duration = 3000) {
            const toast = document.createElement('div');
            toast.className = `gcab-toast gcab-toast-${type}`;
            toast.textContent = message;
            toast.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 12px 24px;
                border-radius: 8px;
                background: ${type === 'error' ? '#ff4444' : 
                            type === 'success' ? '#00c851' : 
                            type === 'warning' ? '#ffbb33' : '#33b5e5'};
                color: white;
                z-index: 9999;
                animation: toastIn 0.3s ease;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            `;
            
            document.body.appendChild(toast);
            
            setTimeout(() => {
                toast.style.animation = 'toastOut 0.3s ease';
                setTimeout(() => {
                    document.body.removeChild(toast);
                }, 300);
            }, duration);
        },
        
        createLoadingOverlay(text = 'Loading...') {
            const overlay = document.createElement('div');
            overlay.className = 'gcab-loading-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                z-index: 9998;
                color: white;
                font-size: 18px;
            `;
            
            const spinner = document.createElement('div');
            spinner.style.cssText = `
                width: 50px;
                height: 50px;
                border: 5px solid rgba(255, 255, 255, 0.3);
                border-radius: 50%;
                border-top-color: #00eeff;
                animation: spin 1s ease-in-out infinite;
                margin-bottom: 20px;
            `;
            
            const textEl = document.createElement('div');
            textEl.textContent = text;
            
            overlay.appendChild(spinner);
            overlay.appendChild(textEl);
            
            document.body.appendChild(overlay);
            
            // Add CSS animations if not already present
            if (!document.querySelector('#gcab-animations')) {
                const style = document.createElement('style');
                style.id = 'gcab-animations';
                style.textContent = `
                    @keyframes spin {
                        to { transform: rotate(360deg); }
                    }
                    @keyframes toastIn {
                        from { transform: translateX(100%); opacity: 0; }
                        to { transform: translateX(0); opacity: 1; }
                    }
                    @keyframes toastOut {
                        from { transform: translateX(0); opacity: 1; }
                        to { transform: translateX(100%); opacity: 0; }
                    }
                `;
                document.head.appendChild(style);
            }
            
            return {
                hide: () => {
                    overlay.style.opacity = '0';
                    setTimeout(() => {
                        if (overlay.parentNode) {
                            overlay.parentNode.removeChild(overlay);
                        }
                    }, 300);
                },
                updateText: (newText) => {
                    textEl.textContent = newText;
                }
            };
        },
        
        createConfetti() {
            const colors = ['#00eeff', '#ffaa00', '#9d00ff', '#ff0055', '#00ffaa'];
            const confettiCount = 150;
            
            for (let i = 0; i < confettiCount; i++) {
                const confetti = document.createElement('div');
                confetti.style.cssText = `
                    position: fixed;
                    width: 10px;
                    height: 10px;
                    background: ${colors[Math.floor(Math.random() * colors.length)]};
                    top: -10px;
                    left: ${Math.random() * 100}vw;
                    border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
                    z-index: 9999;
                    pointer-events: none;
                `;
                
                document.body.appendChild(confetti);
                
                const animation = confetti.animate([
                    { transform: 'translateY(0) rotate(0deg)', opacity: 1 },
                    { transform: `translateY(${window.innerHeight}px) rotate(${360 * Math.random()}deg)`, opacity: 0 }
                ], {
                    duration: 1000 + Math.random() * 2000,
                    easing: 'cubic-bezier(0.1, 0.8, 0.2, 1)'
                });
                
                animation.onfinish = () => {
                    if (confetti.parentNode) {
                        confetti.parentNode.removeChild(confetti);
                    }
                };
            }
        }
    },
    
    // ========== DEBUG UTILITIES ==========
    
    debug: {
        logComponent(name, data) {
            if (GCABConfig.app.environment === 'development') {
                console.log(`🔍 ${name}:`, data);
            }
        },
        
        logEvent(eventName, data) {
            if (GCABConfig.app.environment === 'development') {
                console.log(`📢 ${eventName}:`, data);
            }
        },
        
        logStateChange(path, oldValue, newValue) {
            if (GCABConfig.app.environment === 'development') {
                console.log(`🔄 State "${path}":`, oldValue, '→', newValue);
            }
        }
    }
};

// Make available globally
window.GCABUtils = GCABUtils;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GCABUtils };
}

console.log('✅ GCABUtils loaded');