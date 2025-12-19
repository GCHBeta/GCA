// ===== GAME CONTROLLER =====
class DegenGame {
    constructor() {
        this.engine = window.degenEngine;
        this.currentScenario = null;
        this.isProcessingChoice = false;
        
        // Bind methods to preserve 'this' context
        this.generateNextScenario = this.generateNextScenario.bind(this);
        this.panicSell = this.panicSell.bind(this);
        this.apeIn = this.apeIn.bind(this);
        this.clearLog = this.clearLog.bind(this);
        
        this.init();
    }
    
    async init() {
        console.log('🎮 DegenGame initializing...');
        
        // Wait for engine to initialize
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Make sure engine is ready
        if (!this.engine || !this.engine.generateNextScenario) {
            console.error('❌ Engine not loaded!');
            await new Promise(resolve => setTimeout(resolve, 1000));
            this.engine = window.degenEngine;
        }
        
        // Generate first scenario
        this.generateNextScenario();
        
        // Set up ALL event listeners
        this.setupEventListeners();
        
        console.log('✅ DegenGame ready!');
    }
    
    generateNextScenario() {
        console.log('🔄 Generating next scenario...');
        
        if (!this.engine) {
            console.error('No engine found!');
            this.engine = window.degenEngine;
            if (!this.engine) {
                document.getElementById('scenarioTitle').textContent = 'ERROR: Engine not loaded!';
                return;
            }
        }
        
        try {
            this.currentScenario = this.engine.generateNextScenario();
            this.renderScenario();
        } catch (error) {
            console.error('Error generating scenario:', error);
            document.getElementById('scenarioTitle').textContent = 'ERROR: ' + error.message;
        }
    }
    
    renderScenario() {
        if (!this.currentScenario) {
            console.error('No scenario to render!');
            return;
        }
        
        const scenario = this.currentScenario;
        
        // Update scenario info
        document.getElementById('scenarioType').textContent = scenario.id.split('_')[0] + ' SIMULATION';
        document.getElementById('scenarioTitle').textContent = scenario.title;
        document.getElementById('scenarioDescription').textContent = scenario.description;
        document.getElementById('scenarioDifficulty').textContent = scenario.difficulty.toUpperCase();
        document.getElementById('scenarioDifficulty').className = `difficulty-${scenario.difficulty}`;
        
        // Update scenario image
        const scenarioImage = document.getElementById('scenarioImage');
        if (scenario.memeUrl) {
            scenarioImage.src = scenario.memeUrl;
        } else {
            // Fallback meme
            scenarioImage.src = 'https://api.memegen.link/images/ds/No_Meme/No_Problem.png';
        }
        scenarioImage.alt = scenario.title;
        
        // Update overlay with live data
        if (this.engine.state.liveData) {
            document.getElementById('imageOverlay').innerHTML = `
                Gas: ${this.engine.state.liveData.gasPrice?.toFixed(0) || '??'} gwei
                | ETH: $${this.engine.state.liveData.ethPrice?.toFixed(0) || '???'}
                | ${(this.engine.state.liveData.marketSentiment || 'neutral').toUpperCase()}
            `;
        }
        
        // Render options
        this.renderOptions(scenario.options);
        
        // Reset outcome display
        this.resetOutcomeDisplay();
        
        // Add to log
        this.engine.addToLog(`New scenario: ${scenario.title}`);
    }
    
    renderOptions(options) {
        const container = document.getElementById('optionsContainer');
        if (!container) {
            console.error('Options container not found!');
            return;
        }
        
        container.innerHTML = '';
        
        options.forEach((option, index) => {
            const button = document.createElement('button');
            button.className = 'option-btn';
            button.onclick = () => this.processChoice(index);
            
            // Determine risk color
            const portfolioChange = option.effect.portfolio * this.engine.state.portfolio;
            const riskLevel = this.engine.getRiskLevel(Math.abs(portfolioChange));
            
            button.innerHTML = `
                <span class="option-icon">${option.icon}</span>
                <span class="option-text">${option.text}</span>
                <span class="option-risk risk-${riskLevel}">${riskLevel.toUpperCase()}</span>
            `;
            
            container.appendChild(button);
        });
    }
    
    async processChoice(choiceIndex) {
        if (this.isProcessingChoice) return;
        this.isProcessingChoice = true;
        
        if (!this.currentScenario) {
            console.error('No current scenario!');
            this.isProcessingChoice = false;
            return;
        }
        
        const scenario = this.currentScenario;
        const choice = scenario.options[choiceIndex];
        
        // Disable all options during processing
        const optionButtons = document.querySelectorAll('.option-btn');
        optionButtons.forEach(btn => btn.disabled = true);
        
        // Process choice through engine
        const result = this.engine.processChoice(choiceIndex, scenario);
        
        // Display outcome
        this.displayOutcome(choice.outcome, result.portfolioChange);
        
        // Visual feedback
        this.animatePortfolioChange(result.portfolioChange);
        
        // Wait a bit then enable next scenario
        setTimeout(() => {
            this.isProcessingChoice = false;
            document.getElementById('nextScenarioBtn').style.animation = 'pulse-glow 1s infinite';
        }, 3000);
    }
    
    displayOutcome(outcome, portfolioChange) {
        const outcomeContainer = document.getElementById('outcomeContainer');
        const portfolioChangeElement = document.getElementById('portfolioChange');
        const riskLevelElement = document.getElementById('riskLevel');
        
        if (!outcomeContainer || !portfolioChangeElement || !riskLevelElement) {
            console.error('Outcome elements not found!');
            return;
        }
        
        // Update outcome display
        document.getElementById('outcomeIcon').textContent = outcome.icon;
        document.getElementById('outcomeTitle').textContent = outcome.title;
        document.getElementById('outcomeText').textContent = outcome.text;
        
        // Update stats
        portfolioChangeElement.textContent = 
            `${portfolioChange >= 0 ? '+' : '-'}$${this.engine.formatCurrency(Math.abs(portfolioChange))}`;
        portfolioChangeElement.className = 
            portfolioChange >= 0 ? 'change-positive' : 'change-negative';
        
        const riskLevel = this.engine.getRiskLevel(Math.abs(portfolioChange));
        riskLevelElement.textContent = riskLevel.toUpperCase();
        riskLevelElement.className = `risk-${riskLevel}`;
        
        // Show outcome with animation
        outcomeContainer.style.display = 'block';
        outcomeContainer.style.animation = 'slide-in 0.5s ease-out';
    }
    
    resetOutcomeDisplay() {
        const outcomeContainer = document.getElementById('outcomeContainer');
        if (!outcomeContainer) return;
        
        outcomeContainer.style.display = 'block';
        
        document.getElementById('outcomeIcon').textContent = '⚡';
        document.getElementById('outcomeTitle').textContent = 'CHOOSE YOUR FATE';
        document.getElementById('outcomeText').textContent = 
            'Each decision permanently alters your simulation. Choose wisely, degen.';
        
        document.getElementById('portfolioChange').textContent = '$0';
        document.getElementById('portfolioChange').className = 'change-neutral';
        document.getElementById('riskLevel').textContent = 'LOW';
        document.getElementById('riskLevel').className = 'risk-low';
        
        // Re-enable option buttons
        const optionButtons = document.querySelectorAll('.option-btn');
        optionButtons.forEach(btn => btn.disabled = false);
        
        // Remove pulse animation from next button
        document.getElementById('nextScenarioBtn').style.animation = '';
    }
    
    animatePortfolioChange(change) {
        const portfolioElement = document.getElementById('portfolioValue');
        if (!portfolioElement) return;
        
        const originalColor = portfolioElement.style.color;
        
        // Flash color based on change
        portfolioElement.style.color = change >= 0 ? '#00ff88' : '#ff3366';
        portfolioElement.style.transform = 'scale(1.1)';
        
        setTimeout(() => {
            portfolioElement.style.color = originalColor;
            portfolioElement.style.transform = 'scale(1)';
        }, 1000);
    }
    
    setupEventListeners() {
        console.log('🔧 Setting up event listeners...');
        
        // Remove any existing inline onclick handlers
        const nextBtn = document.getElementById('nextScenarioBtn');
        if (nextBtn) {
            nextBtn.removeAttribute('onclick');
            nextBtn.addEventListener('click', this.generateNextScenario);
        }
        
        const panicBtn = document.getElementById('panicSellBtn');
        if (panicBtn) {
            panicBtn.removeAttribute('onclick');
            panicBtn.addEventListener('click', this.panicSell);
            panicBtn.disabled = false;
        }
        
        const apeBtn = document.getElementById('apeInBtn');
        if (apeBtn) {
            apeBtn.removeAttribute('onclick');
            apeBtn.addEventListener('click', this.apeIn);
            apeBtn.disabled = false;
        }
        
        const clearBtn = document.querySelector('.clear-log');
        if (clearBtn) {
            clearBtn.removeAttribute('onclick');
            clearBtn.addEventListener('click', this.clearLog);
        }
        
        // Expose to window for debugging
        window.debugGenerateNext = this.generateNextScenario;
    }
    
    panicSell() {
        const penalty = this.engine.state.portfolio * 0.20;
        this.engine.state.portfolio -= penalty;
        this.engine.state.consequences.paperHands += 30;
        
        this.engine.addToLog(`🚨 PANIC SOLD!`, -penalty);
        this.engine.updateStateUI();
        this.engine.updateConsequencesUI();
        
        // Visual feedback
        this.animatePortfolioChange(-penalty);
        
        // Play fail sound
        this.engine.playSound('fail');
    }
    
    apeIn() {
        // 50/50 chance of winning or losing big
        const win = Math.random() > 0.5;
        const multiplier = win ? 1.0 : -1.0;
        const change = this.engine.state.portfolio * multiplier;
        
        this.engine.state.portfolio += change;
        this.engine.state.consequences.fomoLevel += 40;
        
        const action = win ? 'APED IN & WON!' : 'APED IN & REKT!';
        this.engine.addToLog(`🦍 ${action}`, change);
        this.engine.updateStateUI();
        this.engine.updateConsequencesUI();
        
        // Visual feedback
        this.animatePortfolioChange(change);
        
        // Play appropriate sound
        this.engine.playSound(win ? 'success' : 'fail');
    }
    
    clearLog() {
        document.getElementById('logEntries').innerHTML = `
            <div class="log-entry">
                <span class="log-time">[${new Date().getHours().toString().padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')}]</span>
                <span class="log-text">Log cleared. The simulation continues...</span>
            </div>
        `;
    }
}

// ===== INITIALIZE GAME =====
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM loaded, initializing game...');
    
    // Wait a moment for engine to load
    setTimeout(() => {
        if (!window.degenEngine) {
            console.warn('⚠️ Engine not yet loaded, retrying...');
            // Try to create engine if it doesn't exist
            if (typeof DegenStoryEngine !== 'undefined') {
                window.degenEngine = new DegenStoryEngine();
            }
        }
        
        window.degenGame = new DegenGame();
        
        // Global helper for console debugging
        window.generateNextScenario = function() {
            if (window.degenGame && window.degenGame.generateNextScenario) {
                window.degenGame.generateNextScenario();
            } else {
                console.error('Game not ready!');
            }
        };
        
        console.log('🎲 Game instance created!');
    }, 100);
});

// ===== EXPORT FOR CONSOLE DEBUGGING =====
setTimeout(() => {
    window.DegenSimulator = {
        engine: window.degenEngine,
        game: window.degenGame,
        cheat: {
            addMoney: (amount) => {
                if (window.degenEngine) {
                    window.degenEngine.state.portfolio += amount;
                    window.degenEngine.updateStateUI();
                    console.log(`💰 Added $${amount}. New portfolio: $${window.degenEngine.state.portfolio}`);
                }
            },
            reset: () => {
                if (typeof DegenStoryEngine !== 'undefined') {
                    window.degenEngine = new DegenStoryEngine();
                    window.degenGame = new DegenGame();
                    console.log('🔄 Simulation reset!');
                }
            },
            stats: () => {
                if (window.degenEngine) {
                    console.table(window.degenEngine.state);
                }
            },
            next: () => {
                if (window.degenGame && window.degenGame.generateNextScenario) {
                    window.degenGame.generateNextScenario();
                }
            }
        }
    };
    
    console.log(`
╔══════════════════════════════════════════════╗
║   INFINITE DEGEN SIMULATOR v2.1 - LOADED    ║
║                                              ║
║   Commands:                                  ║
║   • DegenSimulator.cheat.addMoney(10000)     ║
║   • DegenSimulator.cheat.reset()             ║
║   • DegenSimulator.cheat.stats()             ║
║   • DegenSimulator.cheat.next()              ║
║                                              ║
║   Good luck, degen. You'll need it. 🚀       ║
╚══════════════════════════════════════════════╝
    `);
}, 1000);