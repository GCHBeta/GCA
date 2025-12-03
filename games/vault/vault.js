// vault.js
import Game from "./engine/core/Game.js";

let game;
let isHodler = false;

// Small helper to shorten addresses like 0x1234...abcd
function shortenAddress(addr) {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

// 🔒 Stub: replace this with a real on-chain check later
async function checkIsHodler(address) {
  // TODO:
  // Here you can later call a smart contract / API to verify
  // if the address holds your token/NFT.
  //
  // For now, always true so we can test the portal logic.
  return true;
}

window.addEventListener("DOMContentLoaded", () => {
  // DOM refs
  const startGameBtn = document.getElementById("startGameBtn");
  const walletConnectBtn = document.getElementById("walletConnectBtn");
  const walletStatus = document.getElementById("walletStatus");

  const vaultTapBtn = document.getElementById("vaultTapBtn");
  const vaultEnergySpan = document.getElementById("vaultEnergy");
  const vaultEnergyMaxSpan = document.getElementById("vaultEnergyMax");
  const vaultChargesUsedSpan = document.getElementById("vaultChargesUsed");
  const vaultChargesMaxSpan = document.getElementById("vaultChargesMax");
  const deployGigaChadBtn = document.getElementById("deployGigaChadBtn");

  // Stage HUD
  const stageNumberSpan = document.getElementById("stageNumber");
  const waveNumberSpan = document.getElementById("waveNumber");
  const playerHPSpan = document.getElementById("playerHP");
  const playerTokensSpan = document.getElementById("playerTokens");

  // Camp actions (for later)
  const buildCampBtn = document.getElementById("buildCampBtn");
  const openShopBtn = document.getElementById("openShopBtn");

  // Initialize game (but don't start yet)
  game = new Game("game", 1);

  // We'll store vault state on the game object for now
  game.vault = {
    energy: 0,
    energyMax: 100,
    chargesUsed: 0,
    chargesMax: 1
  };

  // Sync UI with initial values
  vaultEnergySpan.textContent = game.vault.energy;
  vaultEnergyMaxSpan.textContent = game.vault.energyMax;
  vaultChargesUsedSpan.textContent = game.vault.chargesUsed;
  vaultChargesMaxSpan.textContent = game.vault.chargesMax;

  stageNumberSpan.textContent = 1;
  waveNumberSpan.textContent = 0;
  playerHPSpan.textContent = game.player.hp;
  playerTokensSpan.textContent = game.player.coins;

  // Disable start button until hodler is confirmed
  startGameBtn.disabled = true;
  startGameBtn.textContent = "Connect wallet to enter";

  // 🦊 Wallet connect + hodler check
  walletConnectBtn.addEventListener("click", async () => {
    try {
      if (!window.ethereum) {
        alert("Please install MetaMask or a compatible wallet.");
        return;
      }

      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts"
      });

      const address = accounts[0];
      game.player.address = address;
      walletStatus.textContent = shortenAddress(address);

      // Check hodler status (stubbed)
      isHodler = await checkIsHodler(address);

      if (isHodler) {
        startGameBtn.disabled = false;
        startGameBtn.textContent = "Enter the β Vault ▸";
      } else {
        startGameBtn.disabled = true;
        startGameBtn.textContent = "Hodlers only — acquire your key";
      }
    } catch (err) {
      console.error("Wallet connect error:", err);
    }
  });

  // ▶ Wake the game (only if hodler)
  startGameBtn.addEventListener("click", () => {
    if (!isHodler) return; // soft gate

    startGameBtn.style.display = "none"; // hide overlay
    game.start();
  });

  // ⚡ Tap vault to gather energy
  vaultTapBtn.addEventListener("click", () => {
    if (game.state !== "running" && game.state !== "loading") {
      return;
    }

    const v = game.vault;
    if (v.energy >= v.energyMax) return;

    v.energy += 5; // amount per tap – tweak for feel
    if (v.energy > v.energyMax) v.energy = v.energyMax;

    vaultEnergySpan.textContent = v.energy;

    // When full and still have charges, enable GigaChad button
    if (v.energy === v.energyMax && v.chargesUsed < v.chargesMax) {
      deployGigaChadBtn.disabled = false;
      deployGigaChadBtn.classList.add("ready");
    }
  });

  // 💪 Deploy GigaChad guardian (1 per stage)
  deployGigaChadBtn.addEventListener("click", () => {
    const v = game.vault;

    if (v.chargesUsed >= v.chargesMax) return;
    if (v.energy < v.energyMax) return;

    // TODO: spawn a special hero / tower / unit in the game engine
    console.log("Deploying GigaChad Guardian!");

    v.chargesUsed += 1;
    v.energy = 0;

    vaultEnergySpan.textContent = v.energy;
    vaultChargesUsedSpan.textContent = v.chargesUsed;

    deployGigaChadBtn.disabled = true;
    deployGigaChadBtn.classList.remove("ready");
  });

  // Camp & shop – stub for later
  buildCampBtn.addEventListener("click", () => {
    console.log("Open camp building UI (not implemented yet).");
  });

  openShopBtn.addEventListener("click", () => {
    console.log("Open β token shop UI (not implemented yet).");
  });
});
