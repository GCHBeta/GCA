// games.js — GIGACHAD ALPHA β Hub + Background
// v2.0 (still beta, obviously)
"use strict";

/* --------------------------------------------------------------------------
   1. FULL-SCREEN β BACKGROUND
   -------------------------------------------------------------------------- */

function initBetaFieldBackground() {
  const canvas = document.getElementById("betaField");
  if (!canvas) return; // page has no beta field, do nothing

  const ctx = canvas.getContext("2d");

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener("resize", resize);

  // Living meme glyphs
  const GLYPHS = [
    "β", "β", "β", "β",           // mostly beta
    "α", "A",                     // rare alphas
    "WAGMI", "NGMI",
    "REKT", "HODL",
    "GIGA", "CHAD",
    "FUD", "COPE",
    "0.01Ξ", "20x",
    "rekt?", "ATH?"
  ];

  const particles = [];
  const COUNT = 52;

  const mouse = { x: null, y: null, radius: 140 };

  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  });

  canvas.addEventListener("mouseleave", () => {
    mouse.x = null;
    mouse.y = null;
  });

  function spawnParticle() {
    const text = GLYPHS[(Math.random() * GLYPHS.length) | 0];
    const speed = 0.08 + Math.random() * 0.35;
    const angle = Math.random() * Math.PI * 2;

    return {
      text,
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 11 + Math.random() * 14,
      alpha: 0.35 + Math.random() * 0.45
    };
  }

  for (let i = 0; i < COUNT; i++) {
    particles.push(spawnParticle());
  }

  function update(dt) {
    const friction = 0.994;

    for (const p of particles) {
      // Mouse repulsion (alphas scare the betas)
      if (mouse.x != null && mouse.y != null) {
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        if (dist < mouse.radius) {
          const force = (mouse.radius - dist) / mouse.radius;
          const push = 0.38 * force;
          p.vx += (dx / dist) * push;
          p.vy += (dy / dist) * push;
        }
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= friction;
      p.vy *= friction;

      // Soft wrap: respawn when they leave the bounds
      if (
        p.x < -60 ||
        p.x > canvas.width + 60 ||
        p.y < -60 ||
        p.y > canvas.height + 60
      ) {
        const fresh = spawnParticle();
        p.text = fresh.text;
        p.x = fresh.x;
        p.y = fresh.y;
        p.vx = fresh.vx;
        p.vy = fresh.vy;
        p.size = fresh.size;
        p.alpha = fresh.alpha;
      }
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of particles) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = "#a5b4fc"; // soft indigo
      ctx.font = `${p.size}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      ctx.fillText(p.text, p.x, p.y);
      ctx.restore();
    }
  }

  let lastTime = performance.now();
  function loop(now) {
    const dt = (now - lastTime) * 0.08; // tune overall speed
    lastTime = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}

/* --------------------------------------------------------------------------
   2. HUB (CLICKER + LEADERBOARD + METRICS + HODLERS)
   Runs only on pages that have [data-games-page]
   -------------------------------------------------------------------------- */

document.addEventListener("DOMContentLoaded", () => {
  // Always try to start the β background (no-op if no canvas present)
  initBetaFieldBackground();

  // Hub root?
  const hubRoot = document.querySelector("[data-games-page]");
  if (!hubRoot) {
    // No hub markup: background only (e.g. vault page)
    return;
  }

  /* ====== CONFIG ====== */

  const STATE_KEY = "gch_beta_clicker_v1";
  const LB_KEY = "gch_beta_leaderboard_v1";

  // Same token as main site
  const TOKEN_ADDRESS = "0x6d0B8eB75E9d6735cc301c3a6E82adeE43590B07";

  /* ====== SHARED STATE (clicker) ====== */

  const defaultState = {
    progress: 0,
    crashes: 0,
    lastCrashAt: 0
  };

  function loadState() {
    try {
      const raw = localStorage.getItem(STATE_KEY);
      if (!raw) return { ...defaultState };
      const parsed = JSON.parse(raw);
      return { ...defaultState, ...parsed };
    } catch {
      return { ...defaultState };
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify(state));
    } catch {
      // user could have disabled storage; fail silently
    }
  }

  let state = loadState();
  let lastCrashSeen = state.lastCrashAt || 0;

  /* ====== LEADERBOARD STATE (local only) ====== */

  function loadLeaderboard() {
    try {
      const raw = localStorage.getItem(LB_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function saveLeaderboard() {
    try {
      localStorage.setItem(LB_KEY, JSON.stringify(leaderboard));
    } catch {
      // ignore
    }
  }

  let leaderboard = loadLeaderboard();
  let currentPlayerId = "guest";

  /* ====== DOM ELEMENTS ====== */

  const clickBtn     = document.getElementById("clickButton");
  const clickPercent = document.getElementById("clickPercent");
  const crashCountEl = document.getElementById("crashCount");
  const chargeFill   = document.getElementById("chargeFill");

  const delusionVal  = document.getElementById("delusionVal");
  const delusionFill = document.getElementById("delusionFill");
  const fomoVal      = document.getElementById("fomoVal");
  const fomoFill     = document.getElementById("fomoFill");
  const fearVal      = document.getElementById("fearVal");
  const fearFill     = document.getElementById("fearFill");
  const liqVal       = document.getElementById("liqVal");
  const liqFill      = document.getElementById("liqFill");

  const crashLog     = document.getElementById("crashLog");

  const leaderTable  = document.getElementById("leaderTable");
  const leaderBody   = leaderTable ? leaderTable.querySelector("tbody") : null;

  const walletBtn    = document.getElementById("walletConnect");
  const walletAddr   = document.getElementById("walletAddr");

  const hodlersList  = document.getElementById("hodlersList");

  /* ----------------------------------------------------------------------
     2.1 WALLET CONNECT
     ---------------------------------------------------------------------- */

  if (walletBtn && walletAddr) {
    walletBtn.addEventListener("click", async () => {
      if (!window.ethereum) {
        alert("Install MetaMask or a Base-compatible wallet to link your β stats.");
        return;
      }
      try {
        const accounts = await window.ethereum.request({
          method: "eth_requestAccounts"
        });

        if (accounts && accounts[0]) {
          const addr  = accounts[0];
          const short = addr.slice(0, 6) + "…" + addr.slice(-4);

          walletAddr.textContent = `Wallet: ${short}`;
          walletBtn.textContent  = "Wallet Connected";

          currentPlayerId = addr.toLowerCase();

          if (!leaderboard[currentPlayerId]) {
            leaderboard[currentPlayerId] = { clicks: 0, crashes: 0 };
            saveLeaderboard();
            renderLeaderboard();
          }
        }
      } catch (err) {
        console.error("Wallet connection error", err);
      }
    });
  }

  /* ----------------------------------------------------------------------
     2.2 LEADERBOARD HELPERS
     ---------------------------------------------------------------------- */

  function ensurePlayer(id) {
    if (!leaderboard[id]) {
      leaderboard[id] = { clicks: 0, crashes: 0 };
    }
  }

  function recordClick() {
    ensurePlayer(currentPlayerId);
    leaderboard[currentPlayerId].clicks += 1;
    saveLeaderboard();
    renderLeaderboard();
  }

  function recordCrash() {
    ensurePlayer(currentPlayerId);
    leaderboard[currentPlayerId].crashes += 1;
    saveLeaderboard();
    renderLeaderboard();
  }

  /* ----------------------------------------------------------------------
     2.3 RENDERING FUNCTIONS
     ---------------------------------------------------------------------- */

  function renderClicker() {
    if (!clickPercent || !crashCountEl || !chargeFill) return;

    const pct = state.progress;
    clickPercent.textContent = `${pct}%`;
    crashCountEl.textContent = state.crashes.toString();
    chargeFill.style.width   = `${pct}%`;
  }

  function addCrashLogEntry(text) {
    if (!crashLog) return;
    const row = document.createElement("div");
    row.className = "crash-entry";
    const ts = new Date().toLocaleTimeString();
    row.textContent = `[${ts}] ${text}`;
    crashLog.prepend(row);
  }

  function renderLeaderboard() {
    if (!leaderBody) return;

    leaderBody.innerHTML = "";

    const entries = Object.entries(leaderboard);
    entries.sort((a, b) => b[1].clicks - a[1].clicks);

    if (!entries.length) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="4">No β data yet. Start clicking.</td>`;
      leaderBody.appendChild(tr);
      return;
    }

    entries.forEach(([id, stats], idx) => {
      const tr = document.createElement("tr");
      const short =
        id === "guest"
          ? "Guest (this browser)"
          : id.slice(0, 6) + "…" + id.slice(-4);

      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td>${short}</td>
        <td>${stats.clicks}</td>
        <td>${stats.crashes}</td>
      `;
      leaderBody.appendChild(tr);
    });
  }

  function renderMetrics(priceChange24h) {
    if (
      !delusionVal || !delusionFill ||
      !fomoVal      || !fomoFill ||
      !fearVal      || !fearFill ||
      !liqVal       || !liqFill
    ) {
      return;
    }

    const delta = typeof priceChange24h === "number" ? priceChange24h : 0;
    const abs   = Math.abs(delta);

    const baseDelusion = 96;
    const del  = Math.min(100, baseDelusion + abs);
    const fomo = Math.min(100, 50 + delta * 2);
    const fear = Math.min(100, 50 - delta * 2);
    const liq  = 4 + Math.random() * 8;

    delusionVal.textContent = `${del.toFixed(1)}%`;
    delusionFill.style.width = `${del}%`;

    fomoVal.textContent = `${fomo.toFixed(1)}%`;
    fomoFill.style.width = `${fomo}%`;

    fearVal.textContent = `${fear.toFixed(1)}%`;
    fearFill.style.width = `${fear}%`;

    liqVal.textContent = `${liq.toFixed(1)}%`;
    liqFill.style.width = `${liq}%`;
  }

  /* ----------------------------------------------------------------------
     2.4 METRICS FROM DEXSCREENER (fails gracefully if CORS / offline)
     ---------------------------------------------------------------------- */

  async function fetchMarketForMetrics() {
    try {
      const res = await fetch(
        "https://api.dexscreener.com/latest/dex/tokens/" + TOKEN_ADDRESS
      );
      const data = await res.json();
      const pair = data && Array.isArray(data.pairs) ? data.pairs[0] : null;
      const change = pair && pair.priceChange && pair.priceChange.h24
        ? Number(pair.priceChange.h24)
        : 0;
      renderMetrics(change);
    } catch (err) {
      console.warn("Metrics price fetch failed (still beta)", err);
      renderMetrics(0);
    }
  }

  fetchMarketForMetrics();
  setInterval(fetchMarketForMetrics, 60_000);

  /* ----------------------------------------------------------------------
     2.5 HODLERS (OPTIONAL — requires BaseScan API key)
     ---------------------------------------------------------------------- */

  async function fetchHodlers() {
    if (!hodlersList) return;

    // Drop your BaseScan API key here when you want this live:
    const BASESCAN_API_KEY = ""; // "YOUR_KEY_HERE"
    if (!BASESCAN_API_KEY) {
      // Leave default placeholder text; nothing to do.
      return;
    }

    try {
      const url =
        "https://api.basescan.org/api?" +
        "module=token&action=tokenholderlist" +
        `&contractaddress=${TOKEN_ADDRESS}` +
        "&page=1&offset=20" +
        `&apikey=${BASESCAN_API_KEY}`;

      const res = await fetch(url);
      const data = await res.json();
      if (data.status !== "1" || !Array.isArray(data.result)) return;

      const holders = data.result
        .filter((h) => {
          const addr = (h.TokenHolderAddress || "").toLowerCase();
          if (!addr) return false;
          if (addr === "0x0000000000000000000000000000000000000000") return false;
          if (addr.includes("000000000000000000000000000000000000dead")) return false;
          return true;
        })
        .slice(0, 8);

      hodlersList.innerHTML = "";

      if (!holders.length) {
        hodlersList.innerHTML = "<li>No holder data available yet.</li>";
        return;
      }

      holders.forEach((h) => {
        const li    = document.createElement("li");
        const addr  = h.TokenHolderAddress;
        const pct   = Number(h.TokenHolderPercentage || 0).toFixed(2);
        const short = addr.slice(0, 6) + "…" + addr.slice(-4);
        li.textContent = `${short} — ${pct}%`;
        hodlersList.appendChild(li);
      });
    } catch (err) {
      console.warn("Hodlers fetch failed (still beta)", err);
    }
  }

  fetchHodlers();

  /* ----------------------------------------------------------------------
     2.6 CLICKER LOGIC
     ---------------------------------------------------------------------- */

  function triggerCrashVisual() {
    document.body.classList.add("beta-crash");
    setTimeout(() => document.body.classList.remove("beta-crash"), 350);
  }

  function handleClick() {
    if (!clickBtn) return;

    // Charging the ego core
    if (state.progress < 100) {
      state.progress = Math.min(100, state.progress + 5);
      saveState();
      recordClick();
      renderClicker();

      if (delusionFill) {
        delusionFill.style.boxShadow = "0 0 14px rgba(56,189,248,0.9)";
        setTimeout(() => {
          delusionFill.style.boxShadow = "none";
        }, 220);
      }

      return;
    }

    // Crash: v2.0 attempt failed, back to safe beta
    state.crashes += 1;
    state.progress  = 0;
    state.lastCrashAt = Date.now();
    saveState();
    recordCrash();
    addCrashLogEntry("β core overloaded. v2.0 reverted to safe β mode.");
    triggerCrashVisual();
    renderClicker();

    if (fearFill) {
      fearFill.style.boxShadow = "0 0 20px rgba(248,113,113,0.95)";
      setTimeout(() => {
        fearFill.style.boxShadow = "none";
      }, 420);
    }
  }

  if (clickBtn) {
    clickBtn.addEventListener("click", handleClick);
  }

  // Initial paint
  renderClicker();
  renderLeaderboard();

  /* ----------------------------------------------------------------------
     2.7 WATCH FOR EXTERNAL CRASHES (main site logo clicker)
     ---------------------------------------------------------------------- */

  setInterval(() => {
    const fresh = loadState();

    if (fresh.lastCrashAt && fresh.lastCrashAt !== lastCrashSeen) {
      lastCrashSeen = fresh.lastCrashAt;
      state = fresh;
      addCrashLogEntry("External β crash detected (main site logo).");
      triggerCrashVisual();
      renderClicker();
    } else {
      state = fresh;
      renderClicker();
    }
  }, 1500);
});
