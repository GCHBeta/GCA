// ===== GAME CONTROLLER =====
class DegenGame {
    constructor() {
        this.engine = window.degenEngine;
        this.currentScenario = null;
        this.isProcessingChoice = false;
        
        this.init();
    }
    
    async init() {
        // Wait for engine to initialize
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Generate first scenario
        this.generateNextScenario();
        
        // Enable quick actions after first scenario
        setTimeout(() => {
            document.getElementById('panicSellBtn').disabled = false;
            document.getElementById('apeInBtn').disabled = false;
        }, 2000);
        document.getElementById('nextScenarioBtn').addEventListener('click', () => {
    this.generateNextScenario();
});
        // Set up quick action handlers
        this.setupQuickActions();
    }
    
    generateNextScenario() {
        this.currentScenario = this.engine.generateNextScenario();
        this.renderScenario();
    }
    
    renderScenario() {
        const scenario = this.currentScenario;
        
        // Update scenario info
        document.getElementById('scenarioType').textContent = scenario.id.split('_')[0] + ' SIMULATION';
        document.getElementById('scenarioTitle').textContent = scenario.title;
        document.getElementById('scenarioDescription').textContent = scenario.description;
        document.getElementById('scenarioDifficulty').textContent = scenario.difficulty.toUpperCase();
        document.getElementById('scenarioDifficulty').className = `difficulty-${scenario.difficulty}`;
        
        // Update scenario image
        const scenarioImage = document.getElementById('scenarioImage');
        scenarioImage.src = scenario.memeUrl;
        scenarioImage.alt = scenario.title;
        
        // Update overlay with live data
        document.getElementById('imageOverlay').innerHTML = `
            Gas: ${this.engine.state.liveData.gasPrice.toFixed(0)} gwei
            | ETH: $${this.engine.state.liveData.ethPrice.toFixed(0)}
            | ${this.engine.state.liveData.marketSentiment.toUpperCase()}
        `;
        
        // Render options
        this.renderOptions(scenario.options);
        
        // Reset outcome display
        this.resetOutcomeDisplay();
        
        // Add to log
        this.engine.addToLog(`New scenario: ${scenario.title}`);
    }
    
    renderOptions(options) {
        const container = document.getElementById('optionsContainer');
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
        const originalColor = portfolioElement.style.color;
        
        // Flash color based on change
        portfolioElement.style.color = change >= 0 ? '#00ff88' : '#ff3366';
        portfolioElement.style.transform = 'scale(1.1)';
        
        setTimeout(() => {
            portfolioElement.style.color = originalColor;
            portfolioElement.style.transform = 'scale(1)';
        }, 1000);
    }
    
    setupQuickActions() {
        document.getElementById('panicSellBtn').addEventListener('click', () => {
            this.panicSell();
        });
        
        document.getElementById('apeInBtn').addEventListener('click', () => {
            this.apeIn();
        });
        
        document.getElementById('nextScenarioBtn').addEventListener('click', () => {
            this.generateNextScenario();
        });
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
    window.degenGame = new DegenGame();
});

// ===== EXPORT FOR CONSOLE DEBUGGING =====
window.DegenSimulator = {
    engine: window.degenEngine,
    game: window.degenGame,
    cheat: {
        addMoney: (amount) => {
            window.degenEngine.state.portfolio += amount;
            window.degenEngine.updateStateUI();
            console.log(`💰 Added $${amount}. New portfolio: $${window.degenEngine.state.portfolio}`);
        },
        reset: () => {
            window.degenEngine = new DegenStoryEngine();
            window.degenGame = new DegenGame();
            console.log('🔄 Simulation reset!');
        },
        stats: () => {
            console.table(window.degenEngine.state);
        }
    }
};
window.generateNextScenario = () => window.degenGame.generateNextScenario();

console.log(`
╔══════════════════════════════════════════════╗
║   INFINITE DEGEN SIMULATOR v2.1 - LOADED    ║
║                                              ║
║   Commands:                                  ║
║   • DegenSimulator.cheat.addMoney(10000)     ║
║   • DegenSimulator.cheat.reset()             ║
║   • DegenSimulator.cheat.stats()             ║
║                                              ║
║   Good luck, degen. You'll need it. 🚀       ║
╚══════════════════════════════════════════════╝
`);