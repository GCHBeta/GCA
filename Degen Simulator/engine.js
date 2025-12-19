// ===== INFINITE DEGEN SIMULATION ENGINE v2.1 =====
class DegenStoryEngine {
    constructor() {
        this.state = {
            portfolio: 100000,
            survivalScore: 100,
            correctChoices: 0,
            badChoices: 0,
            scenarioCount: 1,
            previousChoices: [],
            consequences: {
                trustIssues: 0,
                gasPTSD: 0,
                rugMemory: 0,
                fomoLevel: 0,
                paperHands: 0
            },
            liveData: {
                gasPrice: 0,
                ethPrice: 0,
                marketSentiment: 'neutral'
            }
        };

        this.storyArchetypes = [
            {
                name: "RUGPULL NIGHTMARE",
                trigger: (state) => state.portfolio > 30000 || state.consequences.rugMemory > 0,
                weight: 0.3,
                scenarios: this.generateRugpullScenarios()
            },
            {
                name: "DAO GOVERNANCE DRAMA",
                trigger: (state) => state.correctChoices > 2,
                weight: 0.25,
                scenarios: this.generateDAOScenarios()
            },
            {
                name: "MEV BOT HELL",
                trigger: (state) => state.consequences.gasPTSD > 20,
                weight: 0.25,
                scenarios: this.generateMEVScenarios()
            },
            {
                name: "LAYER 2 ODYSSEY",
                trigger: (state) => state.scenarioCount > 5,
                weight: 0.2,
                scenarios: this.generateL2Scenarios()
            }
        ];

        this.memeTemplates = [
            "https://api.memegen.link/images/ds/{top}/{bottom}.png",
            "https://api.memegen.link/images/buzz/{top}/{bottom}.png",
            "https://api.memegen.link/images/drake/{top}/{bottom}.png",
            "https://api.memegen.link/images/ermg/{top}/{bottom}.png"
        ];

        this.init();
    }

    async init() {
        await this.fetchLiveData();
        this.startLiveUpdates();
    }

async fetchLiveData() {
    try {
        // Fallback: Use simulated data to avoid CORS errors
        this.state.liveData = {
            gasPrice: Math.random() * 100 + 20, // Random gas between 20-120 gwei
            ethPrice: 2500 + Math.random() * 500, // Random ETH price
            marketSentiment: ['bullish', 'bearish', 'neutral'][Math.floor(Math.random() * 3)]
        };
        
        // Update UI with simulated data
        document.getElementById('liveGas').textContent = `${this.state.liveData.gasPrice.toFixed(0)} gwei`;
        document.getElementById('liveGas').style.color = this.getGasColor(this.state.liveData.gasPrice);
        
    } catch (error) {
        console.warn('Using simulated live data', error);
        // Keep the same fallback logic here
    }
}

    getGasColor(gasPrice) {
        if (gasPrice < 30) return '#00ff88';
        if (gasPrice < 100) return '#ffcc00';
        return '#ff3366';
    }

    startLiveUpdates() {
        setInterval(() => {
            this.updateLiveData();
        }, 30000); // Update every 30 seconds
    }

    updateLiveData() {
        // Simulate gas price volatility
        const change = (Math.random() - 0.5) * 20;
        this.state.liveData.gasPrice = Math.max(10, this.state.liveData.gasPrice + change);
        
        // Update ETH price
        const ethChange = (Math.random() - 0.5) * 100;
        this.state.liveData.ethPrice += ethChange;
        
        // Update UI
        document.getElementById('liveGas').textContent = `${this.state.liveData.gasPrice.toFixed(0)} gwei`;
        document.getElementById('liveGas').style.color = this.getGasColor(this.state.liveData.gasPrice);
    }

    generateNextScenario() {
        // Select story archetype based on weights and triggers
        const availableArchetypes = this.storyArchetypes.filter(archetype => 
            archetype.trigger(this.state)
        );
        
        if (availableArchetypes.length === 0) {
            // Fallback to any archetype
            availableArchetypes.push(...this.storyArchetypes);
        }
        
        // Weighted random selection
        const totalWeight = availableArchetypes.reduce((sum, a) => sum + a.weight, 0);
        let random = Math.random() * totalWeight;
        
        let selectedArchetype;
        for (const archetype of availableArchetypes) {
            random -= archetype.weight;
            if (random <= 0) {
                selectedArchetype = archetype;
                break;
            }
        }
        
        // Select specific scenario from archetype
        const scenarios = selectedArchetype.scenarios;
        const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
        
        // Personalize scenario based on state
        const personalizedScenario = this.personalizeScenario(scenario, selectedArchetype.name);
        
        this.state.scenarioCount++;
        this.updateStateUI();
        
        return personalizedScenario;
    }

    personalizeScenario(scenario, archetypeName) {
        const personalized = { ...scenario };
        
        // Add live data context
        personalized.description = personalized.description
            .replace('{GAS_PRICE}', this.state.liveData.gasPrice.toFixed(0))
            .replace('{ETH_PRICE}', this.state.liveData.ethPrice.toFixed(0))
            .replace('{PORTFOLIO}', this.formatCurrency(this.state.portfolio));
        
        // Adjust options based on consequences
        personalized.options = personalized.options.map(option => {
            const modifiedOption = { ...option };
            
            // Increase damage if user has relevant trauma
            if (modifiedOption.effect?.trustIssues && this.state.consequences.trustIssues > 0) {
                modifiedOption.effect.portfolio *= (1 + this.state.consequences.trustIssues / 100);
            }
            
            if (modifiedOption.effect?.gasPTSD && this.state.consequences.gasPTSD > 0) {
                modifiedOption.effect.portfolio *= (1 + this.state.consequences.gasPTSD / 50);
            }
            
            return modifiedOption;
        });
        
        // Generate meme
        personalized.memeUrl = this.generateMeme(
            archetypeName,
            `Portfolio: $${this.formatCurrency(this.state.portfolio)}`
        );
        
        return personalized;
    }

    generateRugpullScenarios() {
        return [
            {
                id: "RUG_001",
                title: "INFI-RUG 2.0 LAUNCH",
                description: "A pseudonymous dev named 'BasedAnon69' launches Infi-Rug 2.0 with 838% APY. The Telegram is pumping, but the contract has a hidden mint function. Gas is {GAS_PRICE} gwei. What's your play?",
                difficulty: "hard",
                options: [
                    {
                        text: "🦍 APE 50% PORTFOLIO - YOLO!",
                        icon: "🦍",
                        effect: {
                            portfolio: -0.65,
                            trustIssues: +15,
                            rugMemory: +25,
                            fomoLevel: +20
                        },
                        outcome: {
                            title: "ABSOLUTELY REKT",
                            text: "The mint() function was called. Liquidity vanished. You're left with worthless tokens and a valuable lesson.",
                            icon: "💀"
                        }
                    },
                    {
                        text: "🔍 AUDIT CONTRACT QUICKLY",
                        icon: "🔍",
                        effect: {
                            portfolio: -0.05,
                            survivalScore: +10,
                            gasPTSD: +5
                        },
                        outcome: {
                            title: "CLOSE CALL",
                            text: "You spotted the mint function but paid {GAS_PRICE} gwei in gas for the audit. Saved most of your portfolio!",
                            icon: "🎯"
                        }
                    },
                    {
                        text: "📊 CHECK DEXTOOLS & WAIT",
                        icon: "📊",
                        effect: {
                            portfolio: +0.02,
                            survivalScore: +5,
                            correctChoices: +1
                        },
                        outcome: {
                            title: "WISE DEGEN",
                            text: "You waited 5 minutes. The chart pumped 1000% then dumped to zero. You avoided disaster and even shorted the top!",
                            icon: "🧠"
                        }
                    }
                ]
            }
        ];
    }

    generateDAOScenarios() {
        return [
            {
                id: "DAO_001",
                title: "DAO TAKEOVER ATTEMPT",
                description: "A whale is proposing to drain the DAO treasury to fund 'Moonbase Alpha 2.0'. You hold 0.05% voting power. Voting ends in 2 hours.",
                difficulty: "medium",
                options: [
                    {
                        text: "🗳️ VOTE NO & CONVINCE OTHERS",
                        icon: "🗳️",
                        effect: {
                            portfolio: +0.08,
                            survivalScore: +15,
                            correctChoices: +1
                        },
                        outcome: {
                            title: "GOVERNANCE CHAD",
                            text: "Your Twitter thread went viral. The proposal failed 65-35. The DAO rewarded active voters!",
                            icon: "👑"
                        }
                    },
                    {
                        text: "SELL ALL TOKENS & EXIT",
                        icon: "🏃",
                        effect: {
                            portfolio: -0.10,
                            trustIssues: +10,
                            paperHands: +20
                        },
                        outcome: {
                            title: "PAPER HANDS",
                            text: "You sold at the bottom of the FUD. The proposal actually failed and token pumped 80%.",
                            icon: "📜"
                        }
                    },
                    {
                        text: "BUY MORE & SUPPORT WHALE",
                        icon: "🐋",
                        effect: {
                            portfolio: -0.40,
                            rugMemory: +30
                        },
                        outcome: {
                            title: "EXIT LIQUIDITY",
                            text: "The whale was the dev's alt. Treasury drained. Your 'governance tokens' are now governance-less.",
                            icon: "🎣"
                        }
                    }
                ]
            }
        ];
    }

    generateMEVScenarios() {
        return [
            {
                id: "MEV_001",
                title: "SANDWICH ATTACK IN PROGRESS",
                description: "You're trying to swap 10 ETH for a new memecoin. You see pending transactions ahead of you with identical slippage. Gas: {GAS_PRICE} gwei.",
                difficulty: "hard",
                options: [
                    {
                        text: "SET 20% SLIPPAGE & SEND",
                        icon: "🚀",
                        effect: {
                            portfolio: -0.25,
                            gasPTSD: +25
                        },
                        outcome: {
                            title: "SANDWICHED",
                            text: "An MEV bot frontran you, pumped the price, and your swap executed at 19.8% slippage. Classic sandwich.",
                            icon: "🥪"
                        }
                    },
                    {
                        text: "USE PRIVATE RPC & LOW SLIPPAGE",
                        icon: "🕵️",
                        effect: {
                            portfolio: +0.03,
                            survivalScore: +20,
                            gasPTSD: +5
                        },
                        outcome: {
                            title: "MEV EVASION SUCCESS",
                            text: "The private RPC saved you from frontrunning. You paid more gas but saved thousands in slippage!",
                            icon: "🎭"
                        }
                    },
                    {
                        text: "WAIT 5 BLOCKS & RETRY",
                        icon: "⏱️",
                        effect: {
                            portfolio: -0.02,
                            gasPTSD: +10
                        },
                        outcome: {
                            title: "TOO SLOW",
                            text: "The token pumped 300% while you waited. You bought the top instead of the bottom.",
                            icon: "🐌"
                        }
                    }
                ]
            }
        ];
    }

    generateL2Scenarios() {
        return [
            {
                id: "L2_001",
                title: "BRIDGE TO L2 HELL",
                description: "You need to bridge {PORTFOLIO} to a new L2 with 'near-zero fees'. 3 bridges available: Official (slow), Third-party (fast), Experimental (cheap).",
                difficulty: "medium",
                options: [
                    {
                        text: "USE OFFICIAL BRIDGE (7 DAYS)",
                        icon: "🐢",
                        effect: {
                            portfolio: +0.01,
                            survivalScore: +5
                        },
                        outcome: {
                            title: "SAFE BUT BORING",
                            text: "Your funds arrived safely 7 days later. Missed the 500% pump but avoided all hacks.",
                            icon: "✅"
                        }
                    },
                    {
                        text: "THIRD-PARTY BRIDGE (5 MIN)",
                        icon: "⚡",
                        effect: {
                            portfolio: -0.15,
                            trustIssues: +20
                        },
                        outcome: {
                            title: "BRIDGE HACKED",
                            text: "The bridge had a 1-day old audit from 'TrustMeBro Audits'. Funds gone. Always verify!",
                            icon: "🌉"
                        }
                    },
                    {
                        text: "EXPERIMENTAL BRIDGE + INSURANCE",
                        icon: "🧪",
                        effect: {
                            portfolio: -0.05,
                            survivalScore: +10,
                            correctChoices: +1
                        },
                        outcome: {
                            title: "SMART DEGEN",
                            text: "Bridge worked! Insurance cost 5% but saved you from risk. Funds arrived in 2 minutes.",
                            icon: "🛡️"
                        }
                    }
                ]
            }
        ];
    }

    generateMeme(topText, bottomText) {
        const template = this.memeTemplates[Math.floor(Math.random() * this.memeTemplates.length)];
        return template
            .replace('{top}', encodeURIComponent(topText))
            .replace('{bottom}', encodeURIComponent(bottomText));
    }

    processChoice(choiceIndex, scenario) {
        const choice = scenario.options[choiceIndex];
        
        // Play sound
        this.playSound(choice.effect.portfolio > 0 ? 'success' : 'fail');
        
        // Update portfolio
        const portfolioChange = choice.effect.portfolio * this.state.portfolio;
        this.state.portfolio += portfolioChange;
        
        // Update survival score
        this.state.survivalScore += choice.effect.survivalScore || 0;
        this.state.survivalScore = Math.max(0, Math.min(200, this.state.survivalScore));
        
        // Update counters
        if (choice.effect.correctChoices) {
            this.state.correctChoices++;
        } else {
            this.state.badChoices++;
        }
        
        // Update consequences
        Object.keys(choice.effect).forEach(key => {
            if (this.state.consequences[key] !== undefined) {
                this.state.consequences[key] += choice.effect[key] || 0;
            }
        });
        
        // Add to history
        this.state.previousChoices.push({
            scenario: scenario.id,
            choice: choice.text,
            outcome: choice.outcome.title,
            portfolioChange,
            timestamp: new Date().toISOString()
        });
        
        // Log the event
        this.addToLog(`Chose: ${choice.text}`, portfolioChange);
        
        // Update UI
        this.updateStateUI();
        this.updateConsequencesUI();
        
        return {
            choice,
            portfolioChange,
            newPortfolio: this.state.portfolio,
            newScore: this.state.survivalScore
        };
    }

    updateStateUI() {
        document.getElementById('portfolioValue').textContent = 
            `$${this.formatCurrency(this.state.portfolio)}`;
        document.getElementById('survivalScore').textContent = 
            this.state.survivalScore.toFixed(0);
        document.getElementById('scenarioCount').textContent = 
            `#${this.state.scenarioCount}`;
        document.getElementById('correctChoices').textContent = 
            `✓ ${this.state.correctChoices}`;
        document.getElementById('badChoices').textContent = 
            `✗ ${this.state.badChoices}`;
    }

    updateConsequencesUI() {
        const cons = this.state.consequences;
        
        document.getElementById('consequence1').textContent = 
            `Trust Issues: ${cons.trustIssues > 0 ? 'High' : 'None'}`;
        document.getElementById('consequence2').textContent = 
            `Gas PTSD: ${cons.gasPTSD > 15 ? 'Severe' : cons.gasPTSD > 5 ? 'Mild' : 'None'}`;
        document.getElementById('consequence3').textContent = 
            `Rug Memory: ${cons.rugMemory > 20 ? 'Traumatized' : cons.rugMemory > 5 ? 'Wary' : 'None'}`;
        
        // Style based on levels
        const styleElement = (id, value, thresholds) => {
            const element = document.getElementById(id);
            if (value > thresholds.high) {
                element.style.color = '#ff3366';
                element.style.borderColor = '#ff3366';
            } else if (value > thresholds.medium) {
                element.style.color = '#ffcc00';
                element.style.borderColor = '#ffcc00';
            } else {
                element.style.color = '#00ff88';
                element.style.borderColor = '#00ff88';
            }
        };
        
        styleElement('consequence1', cons.trustIssues, { medium: 10, high: 25 });
        styleElement('consequence2', cons.gasPTSD, { medium: 10, high: 20 });
        styleElement('consequence3', cons.rugMemory, { medium: 10, high: 20 });
    }

    addToLog(message, change = 0) {
        const logEntries = document.getElementById('logEntries');
        const now = new Date();
        const timeString = `[${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}]`;
        
        const logEntry = document.createElement('div');
        logEntry.className = 'log-entry';
        
        let changeText = '';
        if (change > 0) {
            changeText = `<span style="color: #00ff88"> (+$${this.formatCurrency(change)})</span>`;
        } else if (change < 0) {
            changeText = `<span style="color: #ff3366"> ($${this.formatCurrency(change)})</span>`;
        }
        
        logEntry.innerHTML = `
            <span class="log-time">${timeString}</span>
            <span class="log-text">${message}${changeText}</span>
        `;
        
        logEntries.prepend(logEntry);
        
        // Keep log manageable
        if (logEntries.children.length > 20) {
            logEntries.removeChild(logEntries.lastChild);
        }
    }

    playSound(type) {
        const audio = document.getElementById(`sound${type.charAt(0).toUpperCase() + type.slice(1)}`);
        if (audio) {
            audio.currentTime = 0;
            audio.play().catch(e => console.log('Audio play failed:', e));
        }
    }

    formatCurrency(value) {
        if (Math.abs(value) >= 1000000) {
            return `$${(value / 1000000).toFixed(2)}M`;
        }
        if (Math.abs(value) >= 1000) {
            return `$${(value / 1000).toFixed(1)}K`;
        }
        return `$${Math.abs(value).toFixed(0)}`;
    }

    getRiskLevel(portfolioChange) {
        const percentChange = Math.abs(portfolioChange) / this.state.portfolio * 100;
        if (percentChange > 20) return 'high';
        if (percentChange > 5) return 'medium';
        return 'low';
    }
}

// ===== GLOBAL ENGINE INSTANCE =====
window.degenEngine = new DegenStoryEngine();