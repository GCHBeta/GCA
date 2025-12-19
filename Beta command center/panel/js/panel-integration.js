// When panel loads
window.addEventListener('load', async () => {
    // Check if player is already authenticated
    const player = GCABAuth.getCurrentPlayer();
    
    if (player) {
        // Show connected state
        document.getElementById('player-wallet').textContent = 
            `${player.wallet.slice(0, 6)}...${player.wallet.slice(-4)}`;
        
        // Load player stats
        const stats = await GCABAPI.getPlayerStats(player.wallet);
        updatePanelWithStats(stats);
        
        // Listen for game events
        window.addEventListener('gcab:game:win', (e) => {
            showNotification(`🎉 You won ${e.detail.amount} GCAB in the game!`);
            updateGCABBalance(e.detail.newBalance);
        });
    }
    
    // Connect wallet button
    document.getElementById('connect-wallet').addEventListener('click', async () => {
        const wallet = await GCABAuth.connectWallet();
        showNotification(`✅ Connected! Opening game session...`);
        
        // Auto-open game in new tab with session
        const gameUrl = `game.html?session=${GCABAuth.sessionToken}`;
        window.open(gameUrl, '_blank');
    });
});