// ===== GLOBAL CONFIG =====
const API_BASE =
  location.hostname === "localhost"
    ? "http://localhost:8787"
    : ""; // keep empty until Render URL exists


// Backend toggles
const BACKEND = {
  sidekicks: true,
  siwe: true,
  buy: true
};

(() => {
  // ========= CONFIG =========
  const BASE_CHAIN_ID_HEX = "0x2105"; // 8453
  const BASE_CHAIN_PARAMS = {
    chainId: BASE_CHAIN_ID_HEX,
    chainName: "Base",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://mainnet.base.org"],
    blockExplorerUrls: ["https://basescan.org"]
  };

  const GCAB_TOKEN_ADDRESS = "0x6d0B8eB75E9d6735cc301c3a6E82adeE43590B07";

  // Minimal ERC20 ABI for transfers + metadata
  const ERC20_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
    "function transfer(address to, uint256 value) returns (bool)"
  ];

  // ========= DOM =========
  const $ = (id) => document.getElementById(id) || null;

  const connectBtn = $("connectBtn");
  const addTokenBtn = $("addTokenBtn");

  const statusText = $("statusText");
  const netName = $("netName");

  const addrShort = $("addrShort");
  const addrFull = $("addrFull");
  const chainText = $("chainText");

  const balText = $("balText");
  const balHint = $("balHint");

  const rankText = $("rankText");
  const titleText = $("titleText");
  const powerText = $("powerText");

  const roomsEl = $("rooms");

  const sidekickInput = $("sidekickInput");
  const claimBtn = $("claimBtn");
  const releaseBtn = $("releaseBtn");
  const sidekickText = $("sidekickText");

  const loadCandidatesBtn = $("loadCandidatesBtn");
  const candidatesList = $("candidatesList");
  const candCount = $("candCount");

  const checkinBtn = $("checkinBtn");
  const streakText = $("streakText");
  const checkinHint = $("checkinHint");

  // ========= STATE =========
  let provider = null;
  let signer = null;
  let userAddress = null;

  let gcab = { symbol: "GCAb", decimals: 18, balance: 0 };
  let siweDone = false;
  let isBusy = false;

  // Lore Helper
  function setModeUI() {
  const modeTextEl = document.getElementById("modeText");
  const isLive = typeof API_BASE === "string" && API_BASE.startsWith("http");

  document.body.classList.toggle("mode-live", isLive);
  document.body.classList.toggle("mode-lore", !isLive);

  if (modeTextEl) modeTextEl.textContent = isLive ? "LIVE" : "LORE";
}


  // ========= UI HELPERS =========
  function setStatus(msg) {
    if (statusText) statusText.textContent = msg;
  }
  function shortAddr(a) {
    return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—";
  }
  function fmt(n, max = 6) {
    return Number(n).toLocaleString(undefined, { maximumFractionDigits: max });
  }
  function assertTokenSet() {
    return !!GCAB_TOKEN_ADDRESS && GCAB_TOKEN_ADDRESS.startsWith("0x");
  }
  function busy(on, msg) {
    isBusy = !!on;
    if (connectBtn) connectBtn.disabled = isBusy;
    if (loadCandidatesBtn) loadCandidatesBtn.disabled = isBusy || !userAddress;
    if (addTokenBtn) addTokenBtn.disabled = isBusy || !userAddress;
    if (claimBtn) claimBtn.disabled = true; // este botão é “legacy” no teu UI
    if (releaseBtn) releaseBtn.disabled = isBusy || !userAddress;
    if (msg) setStatus(msg);
  }

  // ========= GAME LOGIC (Power/Rank) =========
  const TIERS = [
    { min: 1_000_000_000, rank: "MYTHIC WHALE", title: "β Vault Council", power: 9000 },
    { min: 100_000_000, rank: "WHALE", title: "Liquidity Oracle", power: 5000 },
    { min: 10_000_000, rank: "SHARK", title: "Market Predator", power: 2500 },
    { min: 1_000_000, rank: "DOLPHIN", title: "Signal Rider", power: 1200 },
    { min: 100_000, rank: "ALPHA HOLDER", title: "Candle Guard", power: 600 },
    { min: 10_000, rank: "β GRINDER", title: "Trend Survivor", power: 300 },
    { min: 1, rank: "INITIATE", title: "Meme Spark", power: 50 },
    { min: 0, rank: "NPC", title: "No Aura Detected", power: 0 }
  ];

  const ROOMS = [
    { name: "Forge Lobby", minRank: "INITIATE" },
    { name: "β Grinder Pit", minRank: "β GRINDER" },
    { name: "Candle Guard", minRank: "ALPHA HOLDER" },
    { name: "Shark Tank", minRank: "SHARK" },
    { name: "Whale Court", minRank: "WHALE" },
    { name: "β Vault", minRank: "MYTHIC WHALE" }
  ];

  function tierFromBalance(b) {
    return TIERS.find((t) => b >= t.min) || TIERS[TIERS.length - 1];
  }
  function rankIndex(rank) {
    return TIERS.findIndex((t) => t.rank === rank);
  }
  function canAccess(currentRank, requiredRank) {
    return rankIndex(currentRank) <= rankIndex(requiredRank);
  }
  function renderRooms(currentRank) {
    if (!roomsEl) return;
    roomsEl.innerHTML = "";
    ROOMS.forEach((r) => {
      const open = canAccess(currentRank, r.minRank);
      const div = document.createElement("div");
      div.className = "room";
      div.innerHTML = `
        <div>
          <div style="font-weight:800">${r.name}</div>
          <div class="small muted">Requires: ${r.minRank}</div>
        </div>
        <div class="badge ${open ? "open" : "locked"}">${open ? "OPEN" : "LOCKED"}</div>
      `;
      roomsEl.appendChild(div);
    });
  }
  // Wallet helpers
async function tryAutoConnect() {
  const { ethereum } = window;
  if (!ethereum) return;

  try {
    // ✅ silent: returns accounts only if already approved
    const accounts = await ethereum.request({ method: "eth_accounts" });
    if (!accounts || !accounts[0]) return;

    provider = new ethers.BrowserProvider(ethereum);
    userAddress = accounts[0];

    // ✅ getSigner(address) should NOT prompt if already authorized
    signer = await provider.getSigner(userAddress);

    if (addrShort) addrShort.textContent = shortAddr(userAddress);
    if (addrFull) addrFull.textContent = userAddress;

    await refreshNetworkLabel();

    // ✅ do NOT force network switch on auto
    const chainId = await ethereum.request({ method: "eth_chainId" });
    if (chainId !== BASE_CHAIN_ID_HEX) {
      setStatus("Wallet detected · Switch to Base to play.");
      if (connectBtn) connectBtn.textContent = "Switch to Base";
      // Make the button do the prompting switch
      connectBtn.onclick = async () => {
        try {
          await ensureBaseNetwork();
          // after switch, user can click Connect again if needed
          setStatus("Switched to Base. Click Connect to authenticate.");
          connectBtn.textContent = "Connect MetaMask";
          connectBtn.onclick = connect;
        } catch (e) {
          setStatus(e?.message || "Network switch cancelled.");
        }
      };
      return;
    }

    // ✅ read-only actions are okay
    await refreshAura();

    if (connectBtn) connectBtn.textContent = "Connected";
    if (addTokenBtn) addTokenBtn.disabled = false;
    if (loadCandidatesBtn) loadCandidatesBtn.disabled = false;
    if (checkinBtn) checkinBtn.disabled = false;

    setStatus("Reconnected · (No prompts) · Ready.");
  } catch (e) {
    console.warn("Auto-connect skipped:", e);
  }
}


  // ========= WALLET =========
  
  async function ensureBaseNetwork() {
    const { ethereum } = window;
    if (!ethereum) throw new Error("MetaMask not detected.");

    const current = await ethereum.request({ method: "eth_chainId" });
    if (current === BASE_CHAIN_ID_HEX) return;

    try {
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: BASE_CHAIN_ID_HEX }]
      });
    } catch (err) {
      if (err && err.code === 4902) {
        await ethereum.request({
          method: "wallet_addEthereumChain",
          params: [BASE_CHAIN_PARAMS]
        });
      } else {
        throw err;
      }
    }
  }

  async function refreshNetworkLabel() {
    if (!provider) return;
    const net = await provider.getNetwork();
    if (netName) netName.textContent = `${net.name} (${net.chainId})`;
    if (chainText) chainText.textContent = `${net.name} (chainId ${net.chainId})`;
  }

  async function readBalance() {
    if (!assertTokenSet() || !provider || !userAddress) return 0;

    const c = new ethers.Contract(GCAB_TOKEN_ADDRESS, ERC20_ABI, provider);
    const [raw, decimals, symbol] = await Promise.all([
      c.balanceOf(userAddress),
      c.decimals(),
      c.symbol()
    ]);

    gcab.decimals = Number(decimals);
    gcab.symbol = symbol;

    const human = Number(ethers.formatUnits(raw, gcab.decimals));
    gcab.balance = human;

    if (balText) balText.textContent = `${fmt(human, 6)} ${symbol}`;
    if (balHint) balHint.textContent = "Synced from Base. Your aura is alive.";
    return human;
  }

  function updateAura(balance) {
    const tier = tierFromBalance(balance);

    if (rankText) rankText.textContent = tier.rank;
    if (titleText) titleText.textContent = tier.title;

    const power = tier.power + Math.floor(Math.log10(balance + 1) * 42);
    if (powerText) powerText.textContent = Number.isFinite(power) ? power.toLocaleString() : "0";

    renderRooms(tier.rank);
  }

  async function addTokenToWallet() {
    const { ethereum } = window;
    if (!ethereum || !userAddress) return;

    try {
      await ethereum.request({
        method: "wallet_watchAsset",
        params: {
          type: "ERC20",
          options: {
            address: GCAB_TOKEN_ADDRESS,
            symbol: gcab.symbol || "GCAb",
            decimals: gcab.decimals || 18
          }
        }
      });
      setStatus("Sigil bound: GCAb added to MetaMask.");
    } catch (e) {
      console.error(e);
      setStatus("Could not add token.");
    }
  }


  // ========= SIWE-LITE =========
  async function siweLiteLogin(address) {
    if (!BACKEND.siwe) return true;
    if (!signer) throw new Error("Signer not ready.");

    const r = await fetch(`${API_BASE}/auth/nonce?address=${address}`);
    const data = await r.json();
    if (!r.ok) throw new Error(data?.error || "nonce failed");

    const signature = await signer.signMessage(data.message);

    const vr = await fetch(`${API_BASE}/auth/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, signature })
    });

    const vdata = await vr.json();
    if (!vr.ok) throw new Error(vdata?.error || "verify failed");

    return true;
  }

  // ========= CANDIDATES (LIST) =========
  function ensurePanelDoesntGrow() {
    // não mexe no CSS file; apenas força scroll interno
    if (!candidatesList) return;
    candidatesList.style.maxHeight = "360px";
    candidatesList.style.overflowY = "auto";
  }

  async function fetchCandidates(owner, limit = 12) {
    const url = `${API_BASE}/sidekick/candidates?owner=${owner}&min=1&limit=${limit}`;
    const r = await fetch(url);
    const data = await r.json();
    if (!r.ok) throw new Error(data?.error || "Failed to load candidates");
    return data; // { owner, ownerBal, candidates }
  }

  function auraTag(bal) {
    if (bal < 1_000) return "🟦 SPARK";
    if (bal < 100_000) return "🟨 SIGNAL";
    if (bal < 1_000_000) return "🟪 MYTH";
    return "🟫 TITAN";
  }

  async function loadAndRenderCandidates() {
    if (!userAddress) return;
    busy(true, "Scanning the realm… (candidates)");

    try {
      ensurePanelDoesntGrow();

      const payload = await fetchCandidates(userAddress, 12);
      const rows = payload?.candidates || [];

      if (candCount) candCount.textContent = String(rows.length);
      if (!candidatesList) return;

      candidatesList.innerHTML = "";

      if (!rows.length) {
        candidatesList.innerHTML = `<div class="small muted">No candidates yet. Backfill more blocks or wait for transfers.</div>`;
        setStatus("No candidates found. The realm is quiet (for now).");
        return;
      }

      for (const row of rows) {
        const addr = row.address;
        const bal = Number(row.balance);

        const item = document.createElement("div");
        item.className = "room";

        // “elevator pitch”
        const pitch =
          bal < 10_000
            ? "Cheap spark. Easy to awaken."
            : bal < 1_000_000
            ? "Solid signal. Worth binding."
            : "Myth-grade. Claim carefully.";

        item.innerHTML = `
          <div>
            <div style="font-weight:800">
              ${addr.slice(0, 6)}…${addr.slice(-4)}
              <span class="small muted">${auraTag(bal)}</span>
            </div>
            <div class="small muted">${fmt(bal)} GCAb · ${pitch}</div>
          </div>

          <button class="btn primary" data-claim="${addr}" style="white-space:nowrap">
            Claim Sidekick
          </button>
        `;

        candidatesList.appendChild(item);
      }

      // bind claim buttons (single pass)
      candidatesList.querySelectorAll("[data-claim]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const target = btn.getAttribute("data-claim");
          await buyAndClaimTarget(target, btn);
        });
      });

      setStatus(`Candidates ready. Your aura eclipses ${fmt(payload.ownerBal)} GCAb.`);
    } catch (e) {
      console.error(e);
      setStatus(e?.message || "Failed to load candidates.");
    } finally {
      busy(false);
    }
  }

  // ========= BUY + CLAIM (REAL) =========
  async function buyQuote(target) {
    const r = await fetch(
      `${API_BASE}/buy/quote?buyer=${userAddress}&target=${target}`
    );
    const data = await r.json();
    if (!r.ok) throw new Error(data?.error || "Quote failed");
    return data; // { price, payTo, split }
  }

  async function buyCommit(target, txHash) {
    const r = await fetch(`${API_BASE}/buy/commit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ buyer: userAddress, target, txHash })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data?.error || "Commit failed");
    return data;
  }

  async function buyAndClaimTarget(target, btnEl) {
    if (isBusy) return;
    if (!signer || !userAddress) return;

    busy(true, "Summoning quote…");
    if (btnEl) btnEl.disabled = true;

    try {
      // 1) Quote from backend
      const q = await buyQuote(target);

      // 2) Transfer GCAb -> Treasury (1 tx)
      setStatus(`Offer: ${fmt(q.price)} GCAb → Treasury. Sign the transfer.`);

      const tokenWithSigner = new ethers.Contract(GCAB_TOKEN_ADDRESS, ERC20_ABI, signer);
      const amountRaw = ethers.parseUnits(String(q.price), gcab.decimals || 18);

      const tx = await tokenWithSigner.transfer(q.payTo, amountRaw);
      setStatus(`The Forge accepts… waiting confirmation (${tx.hash.slice(0, 10)}…)`);

      const receipt = await tx.wait();
      if (!receipt || receipt.status !== 1) throw new Error("Transfer failed");

      // 3) Commit on backend (records split + claims)
      setStatus("Binding complete… writing into the ledger.");
      const committed = await buyCommit(target, tx.hash);

      // 4) Refresh UI
      await refreshAura();
      await loadAndRenderCandidates();

      setStatus(`Claim sealed. 20% burn confirmed. Sidekick bound.`);
    } catch (e) {
      console.error(e);
      setStatus(e?.message || "Buy/Claim failed.");
    } finally {
      if (btnEl) btnEl.disabled = false;
      busy(false);
    }
  }

  // ========= SANDBOX STREAK (local only) =========
  function streakKey() {
    return userAddress ? `gcab_streak_${userAddress.toLowerCase()}` : "gcab_streak_none";
  }
  function todayKey() {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  }
  function loadStreak() {
    const raw = localStorage.getItem(streakKey());
    const obj = raw ? JSON.parse(raw) : { streak: 0, last: null };
    if (streakText) streakText.textContent = obj.streak || 0;
    return obj;
  }
  function saveStreak(obj) {
    localStorage.setItem(streakKey(), JSON.stringify(obj));
    if (streakText) streakText.textContent = obj.streak || 0;
  }

  // ========= MAIN FLOW =========
  async function refreshAura() {
    const bal = await readBalance();
    updateAura(bal);
  }

async function connect() {
  const { ethereum } = window;
  if (!ethereum) {
    setStatus("MetaMask not detected. Install it to ascend.");
    return;
  }

  busy(true, "Opening the gate…");

  try {
    // ✅ this prompts, but only because user clicked the button
    await ethereum.request({ method: "eth_requestAccounts" });

    // ✅ only switch network on user click
    await ensureBaseNetwork();

    provider = new ethers.BrowserProvider(ethereum);
    signer = await provider.getSigner();
    userAddress = await signer.getAddress();

    if (addrShort) addrShort.textContent = shortAddr(userAddress);
    if (addrFull) addrFull.textContent = userAddress;

    await refreshNetworkLabel();

    // ✅ SIWE only on explicit connect (never during auto)
    if (BACKEND.siwe && !siweDone) {
      setStatus("Proving sovereignty… (signature)");
      await siweLiteLogin(userAddress);
      siweDone = true;
    }

    await refreshAura();

    if (connectBtn) connectBtn.textContent = "Connected";
    if (addTokenBtn) addTokenBtn.disabled = false;
    if (loadCandidatesBtn) loadCandidatesBtn.disabled = false;

    if (checkinBtn) checkinBtn.disabled = false;
    const s = loadStreak();
    if (checkinHint) checkinHint.textContent = `UTC check-in. Last: ${s.last || "never"}.`;

    setStatus("Connected · Authenticated · The realm is alive.");
  } catch (e) {
    console.error(e);
    setStatus(e?.message || "Connection failed.");
  } finally {
    busy(false);
  }
}


  function resetUI() {
    userAddress = null;
    provider = null;
    signer = null;
    siweDone = false;

    if (addrShort) addrShort.textContent = "—";
    if (addrFull) addrFull.textContent = "—";
    if (netName) netName.textContent = "—";
    if (chainText) chainText.textContent = "—";

    if (balText) balText.textContent = "—";
    if (rankText) rankText.textContent = "—";
    if (titleText) titleText.textContent = "—";
    if (powerText) powerText.textContent = "—";

    if (roomsEl) roomsEl.innerHTML = "";
    renderRooms("NPC");

    if (connectBtn) {
      connectBtn.textContent = "Connect MetaMask";
      connectBtn.disabled = false;
    }
    if (addTokenBtn) addTokenBtn.disabled = true;
    if (loadCandidatesBtn) loadCandidatesBtn.disabled = true;

    if (candidatesList) candidatesList.innerHTML = "";
    if (candCount) candCount.textContent = "0";

    if (checkinBtn) checkinBtn.disabled = true;

    setStatus("Not connected.");
  }

  function bindWalletEvents() {
    const { ethereum } = window;
    if (!ethereum) return;

ethereum.on("accountsChanged", async (accounts) => {
  if (!accounts || !accounts[0]) {
    resetUI();
    return;
  }
  // ✅ silent refresh, no prompts
  userAddress = accounts[0];
  siweDone = false;

  if (addrShort) addrShort.textContent = shortAddr(userAddress);
  if (addrFull) addrFull.textContent = userAddress;

  provider = new ethers.BrowserProvider(window.ethereum);
  signer = await provider.getSigner(userAddress);

  await refreshNetworkLabel();
  await refreshAura();

  setStatus("Account changed · Synced.");
});


    ethereum.on("chainChanged", async () => {
      if (!window.ethereum) return;
      provider = new ethers.BrowserProvider(window.ethereum);
      await refreshNetworkLabel();
      if (userAddress) await refreshAura();
    });
  }

  // ========= EVENTS =========
  if (connectBtn) connectBtn.addEventListener("click", connect);
  if (addTokenBtn) addTokenBtn.addEventListener("click", addTokenToWallet);
  if (loadCandidatesBtn) loadCandidatesBtn.addEventListener("click", loadAndRenderCandidates);

  if (checkinBtn) {
    checkinBtn.addEventListener("click", () => {
      if (!userAddress) return;

      const now = todayKey();
      const obj = loadStreak();

      if (obj.last === now) {
        setStatus("Already checked in today (UTC).");
        return;
      }

      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const yKey = `${yesterday.getUTCFullYear()}-${String(yesterday.getUTCMonth() + 1).padStart(2, "0")}-${String(yesterday.getUTCDate()).padStart(2, "0")}`;

      if (obj.last === yKey) obj.streak = (obj.streak || 0) + 1;
      else obj.streak = 1;

      obj.last = now;
      saveStreak(obj);

      if (checkinHint) checkinHint.textContent = `UTC check-in. Last: ${obj.last}.`;
      setStatus(`Streak sealed. Day ${obj.streak}.`);
    });
  }

  // Boot
  setModeUI();

  bindWalletEvents();
  renderRooms("NPC");
  if (addTokenBtn) addTokenBtn.disabled = true;
  if (loadCandidatesBtn) loadCandidatesBtn.disabled = true;
  if (checkinBtn) checkinBtn.disabled = true;
  setStatus("Not connected.");
  tryAutoConnect();
})();
