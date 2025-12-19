// When game loads
window.addEventListener('load', async () => {
    // Check URL for session token
    const urlParams = new URLSearchParams(window.location.search);
    const sessionToken = urlParams.get('session');
    
    if (sessionToken) {
        // Validate session and restore player
        await restorePlayerSession(sessionToken);
        
        // Welcome player with their panel stats
        const player = GCABAuth.getCurrentPlayer();
        showWelcomeMessage(`Welcome back, ${player.playerId}!`);
        
        // Load game state
        const gameState = await GCABAPI.getGameState();
        initializeGame(gameState);
    }
    
    // When player wins in game
    function onGameWin(amount) {
        // Update local state
        playerScore += amount;
        
        // Broadcast to panel
        window.dispatchEvent(new CustomEvent('gcab:game:win', {
            detail: { amount, newBalance: playerScore }
        }));
        
        // Sync with backend
        GCABAPI.submitGameResult({
            playerId: GCABAuth.playerId,
            amount: amount,
            timestamp: Date.now()
        });
    }
});