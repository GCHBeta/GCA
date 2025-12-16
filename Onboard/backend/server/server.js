console.log("SERVER FILE:", import.meta.url);

import express from "express";
import cors from "cors";
import { ethers } from "ethers";
import crypto from "crypto";

import { db } from "./db.js";
import { indexHoldersOnce } from "./holders_rpc_indexer.js";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8787;

/* =========================================================
   CORE CONFIG
   ========================================================= */
const GCAB_TOKEN = "0x6d0B8eB75E9d6735cc301c3a6E82adeE43590B07";
const BASE_RPC = "https://mainnet.base.org";
const provider = new ethers.JsonRpcProvider(BASE_RPC);

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)"
];
const token = new ethers.Contract(GCAB_TOKEN, ERC20_ABI, provider);

/* =========================================================
   BUY CONFIG (CONFIRMADO)
   - 1 transferência do utilizador -> TREASURY
   - split automático (ledger) + burn diferido (v2)
   ========================================================= */
const REWARDS_WALLET  = "0x746763aF2d8CD9d626432EfC8fA0280534601b50";
const TREASURY_WALLET = "0x9CeeE5f7Ac511b771A4fe3EAD2a6FFB4BE321bFF";
const DEAD_WALLET     = "0x000000000000000000000000000000000000dEaD";

const SPLIT = { burn: 20, rewards: 50, treasury: 30 }; // 20% burn confirmado
const MIN_BUY_TOKENS = 1; // min 1 GCAb

/* =========================================================
   ENERGY CONFIG (v1)
   ========================================================= */
const ENERGY_DAILY_BUDGET = Number(process.env.ENERGY_DAILY_BUDGET || 1_000_000); // cap diário global
const ENERGY_FORMULA = "sqrt"; // (mvp)

/* =========================================================
   DB BOOTSTRAP (cria tabelas se faltarem)
   ========================================================= */
db.exec(`
CREATE TABLE IF NOT EXISTS kv (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  address TEXT PRIMARY KEY,
  nonce TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sidekicks (
  owner TEXT PRIMARY KEY,
  sidekick TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS buy_intents (
  intent_id TEXT PRIMARY KEY,
  buyer TEXT NOT NULL,
  candidate TEXT NOT NULL,
  price_raw TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS buy_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day TEXT NOT NULL,
  buyer TEXT NOT NULL,
  candidate TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  price_raw TEXT NOT NULL,
  burn_raw TEXT NOT NULL,
  rewards_raw TEXT NOT NULL,
  treasury_raw TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_buy_ledger_buyer ON buy_ledger(buyer);

CREATE TABLE IF NOT EXISTS players (
  address TEXT PRIMARY KEY,
  last_seen_utc INTEGER NOT NULL,
  energy_balance INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS energy_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day TEXT NOT NULL,
  address TEXT NOT NULL,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  meta TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS mint_log (
  day TEXT PRIMARY KEY,
  minted_total INTEGER NOT NULL,
  minted_at INTEGER NOT NULL
);
`);

/* =========================================================
   PREPARED STATEMENTS
   ========================================================= */
const upsertSession = db.prepare(`
INSERT INTO sessions(address, nonce, updated_at)
VALUES(?, ?, ?)
ON CONFLICT(address) DO UPDATE SET nonce=excluded.nonce, updated_at=excluded.updated_at
`);
const getSession = db.prepare(`SELECT address, nonce FROM sessions WHERE address = ?`);

const upsertSidekick = db.prepare(`
INSERT INTO sidekicks(owner, sidekick, updated_at)
VALUES(?, ?, ?)
ON CONFLICT(owner) DO UPDATE SET sidekick=excluded.sidekick, updated_at=excluded.updated_at
`);
const deleteSidekick = db.prepare(`DELETE FROM sidekicks WHERE owner = ?`);
const listSidekicks = db.prepare(`
SELECT owner, sidekick, updated_at
FROM sidekicks
ORDER BY updated_at DESC
LIMIT 200
`);

const insIntent = db.prepare(`
INSERT INTO buy_intents(intent_id,buyer,candidate,price_raw,created_at,expires_at,used)
VALUES(?,?,?,?,?,?,0)
`);
const getIntent = db.prepare(`SELECT * FROM buy_intents WHERE intent_id = ?`);
const markIntentUsed = db.prepare(`UPDATE buy_intents SET used=1 WHERE intent_id = ?`);

const insBuy = db.prepare(`
INSERT INTO buy_ledger(day,buyer,candidate,tx_hash,price_raw,burn_raw,rewards_raw,treasury_raw,created_at)
VALUES (?,?,?,?,?,?,?,?,?)
`);
const listBuysByBuyer = db.prepare(`
SELECT day,buyer,candidate,tx_hash,price_raw,burn_raw,rewards_raw,treasury_raw,created_at
FROM buy_ledger
WHERE buyer = ?
ORDER BY created_at DESC
LIMIT 50
`);

const upsertPlayerSeen = db.prepare(`
INSERT INTO players(address,last_seen_utc,energy_balance)
VALUES(?,?,0)
ON CONFLICT(address) DO UPDATE SET last_seen_utc=excluded.last_seen_utc
`);
const getPlayer = db.prepare(`SELECT address,last_seen_utc,energy_balance FROM players WHERE address=?`);
const setEnergy = db.prepare(`UPDATE players SET energy_balance=? WHERE address=?`);

const addEnergyLedger = db.prepare(`
INSERT INTO energy_ledger(day,address,delta,reason,meta,created_at)
VALUES(?,?,?,?,?,?)
`);
const hasClaimedToday = db.prepare(`
SELECT 1 FROM energy_ledger
WHERE day=? AND address=? AND reason='DAILY_CLAIM'
LIMIT 1
`);

const getMintLog = db.prepare(`SELECT day,minted_total FROM mint_log WHERE day=?`);
const upsertMintLog = db.prepare(`
INSERT INTO mint_log(day,minted_total,minted_at)
VALUES(?,?,?)
ON CONFLICT(day) DO UPDATE SET minted_total=excluded.minted_total, minted_at=excluded.minted_at
`);

/* =========================================================
   HELPERS
   ========================================================= */
function now() { return Date.now(); }
function normAddr(a) { return ethers.getAddress(a); }
function makeNonce() { return crypto.randomBytes(16).toString("hex"); }
function utcDayKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`;
}

function buildLoginMessage(address, nonce) {
  return [
    "GCAb Social Login",
    "",
    `Address: ${address}`,
    `Nonce: ${nonce}`,
    "Chain: Base (8453)",
    "Statement: Sign to prove wallet ownership. No gas."
  ].join("\n");
}

function requireAuthSignature(address, signature) {
  const row = getSession.get(address);
  if (!row) return { ok: false, code: 400, error: "No nonce. Call /auth/nonce first." };

  const msg = buildLoginMessage(address, row.nonce);
  const recovered = ethers.verifyMessage(msg, signature);
  if (normAddr(recovered) !== address) return { ok: false, code: 401, error: "Not authorized" };

  // rotate nonce after auth for safety
  upsertSession.run(address, makeNonce(), now());
  return { ok: true };
}

async function getDecimals() {
  return Number(await token.decimals());
}

function splitRaw(totalRaw) {
  const t = BigInt(totalRaw);
  const burnRaw = (t * BigInt(SPLIT.burn)) / 100n;
  const rewardsRaw = (t * BigInt(SPLIT.rewards)) / 100n;
  const treasuryRaw = t - burnRaw - rewardsRaw;
  return { burnRaw, rewardsRaw, treasuryRaw };
}

function energyFromBalance(balanceNum) {
  // MVP: sqrt(balance) capped
  const v = Math.max(0, Number(balanceNum) || 0);
  const amt = Math.floor(Math.sqrt(v));
  return Math.min(amt, 50_000); // safety cap per user/day
}

/* =========================================================
   ROUTES
   ========================================================= */
app.get("/health", (req, res) => res.json({ ok: true }));

/* --- Admin: holders --- */
app.get("/admin/index-holders", async (req, res) => {
  try {
    const r = await indexHoldersOnce();
    res.json(r);
  } catch (e) {
    res.status(500).json({ error: e?.message || "index failed" });
  }
});

app.get("/admin/holders/reset", (req, res) => {
  // mantém a tua lógica anterior se quiseres (kv/holders_last_block)
  const to = Number(req.query.to || 38866093);
  db.prepare(`
    INSERT INTO kv(key,value) VALUES('holders_last_block',?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value
  `).run(String(to));
  res.json({ ok: true, holders_last_block: to });
});

/* --- Auth --- */
app.get("/auth/nonce", (req, res) => {
  try {
    const address = normAddr(req.query.address);
    const nonce = makeNonce();
    upsertSession.run(address, nonce, now());
    res.json({ address, nonce, message: buildLoginMessage(address, nonce) });
  } catch {
    res.status(400).json({ error: "Bad address" });
  }
});

app.post("/auth/verify", (req, res) => {
  try {
    const address = normAddr(req.body.address);
    const signature = req.body.signature;

    const row = getSession.get(address);
    if (!row) return res.status(400).json({ error: "No nonce. Call /auth/nonce first." });

    const msg = buildLoginMessage(address, row.nonce);
    const recovered = ethers.verifyMessage(msg, signature);

    if (normAddr(recovered) !== address) return res.status(401).json({ error: "Signature invalid" });

    upsertSession.run(address, makeNonce(), now());
    upsertPlayerSeen.run(address, now());
    res.json({ ok: true, address });
  } catch {
    res.status(400).json({ error: "Verify failed" });
  }
});

/* --- Holders (cached) --- */
app.get("/holders", (req, res) => {
  const min = Number(req.query.min || 0);
  const limit = Math.min(Number(req.query.limit || 100), 200);

  const rows = db.prepare(`
    SELECT address, balance_num AS balance
    FROM holders_cache
    WHERE is_contract = 0
      AND balance_num > 0
      AND address != '0x000000000000000000000000000000000000dead'
      AND address != '0x0000000000000000000000000000000000000000'
      AND balance_num >= ?
    ORDER BY balance_num DESC
    LIMIT ?
  `).all(min, limit);

  res.json(rows);
});

/* --- Candidates: limited by default (prevents infinite panel) --- */
app.get("/sidekick/candidates", (req, res) => {
  try {
    const owner = normAddr(req.query.owner).toLowerCase();
    const min = Number(req.query.min || 0);
    const limit = Math.min(Number(req.query.limit || 12), 30); // ✅ default 12

    const ownerRow = db.prepare(`
      SELECT balance_num AS balance
      FROM holders_cache
      WHERE address = ?
      LIMIT 1
    `).get(owner);

    const ownerBal = ownerRow ? Number(ownerRow.balance) : 0;
    if (!Number.isFinite(ownerBal) || ownerBal <= 0) {
      return res.json({ owner, ownerBal: ownerBal || 0, candidates: [] });
    }

    const rows = db.prepare(`
     SELECT h.address, h.balance_num AS balance
    FROM holders_cache h
    LEFT JOIN sidekicks s ON s.target = h.address
    WHERE h.is_contract = 0
    AND h.balance_num >= ?
    AND h.balance_num < ?
    AND h.address != ?
    AND s.target IS NULL
    ORDER BY h.balance_num ASC
    LIMIT ?
`     ).all(min, ownerBal, owner, limit);


    res.json({ owner, ownerBal, candidates: rows });
  } catch {
    res.status(400).json({ error: "Bad owner address" });
  }
});

/* --- Sidekicks (manual name claim/release - mantém) --- */
app.post("/sidekick/claim", async (req, res) => {
  try {
    const address = normAddr(req.body.address);
    const signature = req.body.signature;
    const sidekick = String(req.body.sidekick || "").trim();

    if (!sidekick || sidekick.length > 64) {
      return res.status(400).json({ error: "Sidekick required (max 64 chars)" });
    }

    const auth = requireAuthSignature(address, signature);
    if (!auth.ok) return res.status(auth.code).json({ error: auth.error });

    upsertSidekick.run(address, sidekick, now());
    res.json({ ok: true, owner: address, sidekick });
  } catch {
    res.status(400).json({ error: "Claim failed" });
  }
});

app.post("/sidekick/release", (req, res) => {
  try {
    const address = normAddr(req.body.address);
    deleteSidekick.run(address);
    res.json({ ok: true });
  } catch {
    res.status(400).json({ error: "Release failed" });
  }
});

app.get("/sidekicks", (req, res) => res.json(listSidekicks.all()));

/* =========================================================
   BUY FLOW (1 TRANSFER)
   - intent: calcula preço e devolve amount + to(TREASURY) + intentId
   - confirm: verifica receipt on-chain e regista split automatico
   ========================================================= */
app.post("/buy/intent", async (req, res) => {
  try {
    const buyer = normAddr(req.body.address);
    const signature = req.body.signature;
    const candidate = normAddr(req.body.candidate).toLowerCase();

    const auth = requireAuthSignature(buyer, signature);
    if (!auth.ok) return res.status(auth.code).json({ error: auth.error });

    const cand = db.prepare(`
      SELECT balance_raw, balance_num, is_contract
      FROM holders_cache
      WHERE address = ?
      LIMIT 1
    `).get(candidate);

    if (!cand) return res.status(404).json({ error: "Candidate not indexed (run indexer / wait)" });
    if (cand.is_contract) return res.status(400).json({ error: "Candidate is contract" });

    const decimals = await getDecimals();
    const balRaw = BigInt(String(cand.balance_raw || "0"));
    if (balRaw <= 0n) return res.status(400).json({ error: "Candidate has 0 balance" });

    let priceRaw = balRaw / 100n; // 1%
    const minRaw = BigInt(ethers.parseUnits(String(MIN_BUY_TOKENS), decimals));
    if (priceRaw < minRaw) priceRaw = minRaw;

    const { burnRaw, rewardsRaw, treasuryRaw } = splitRaw(priceRaw);

    const intentId = crypto.randomBytes(16).toString("hex");
    const createdAt = now();
    const expiresAt = createdAt + 10 * 60 * 1000; // 10 min

    insIntent.run(intentId, buyer.toLowerCase(), candidate, priceRaw.toString(), createdAt, expiresAt);

    res.json({
      ok: true,
      intentId,
      to: TREASURY_WALLET,
      token: GCAB_TOKEN,
      amount: ethers.formatUnits(priceRaw, decimals),
      amountRaw: priceRaw.toString(),
      note: "Send ONE transfer to TREASURY. Split is automatic in ledger (burn deferred).",
      split_preview: {
        burn_to: DEAD_WALLET,
        rewards_to: REWARDS_WALLET,
        treasury_to: TREASURY_WALLET,
        burn: ethers.formatUnits(burnRaw, decimals),
        rewards: ethers.formatUnits(rewardsRaw, decimals),
        treasury: ethers.formatUnits(treasuryRaw, decimals)
      }
    });
  } catch (e) {
    res.status(400).json({ error: e?.message || "Intent failed" });
  }
});

app.post("/buy/confirm", async (req, res) => {
  try {
    const buyer = normAddr(req.body.address);
    const signature = req.body.signature;
    const intentId = String(req.body.intentId || "").trim();
    const txHash = String(req.body.txHash || "").trim();

    if (!intentId || !txHash) return res.status(400).json({ error: "intentId + txHash required" });

    const auth = requireAuthSignature(buyer, signature);
    if (!auth.ok) return res.status(auth.code).json({ error: auth.error });

    const intent = getIntent.get(intentId);
    if (!intent) return res.status(404).json({ error: "Intent not found" });
    if (intent.used) return res.status(400).json({ error: "Intent already used" });
    if (Number(intent.expires_at) < now()) return res.status(400).json({ error: "Intent expired (make new intent)" });

    if (String(intent.buyer).toLowerCase() !== buyer.toLowerCase()) {
      return res.status(403).json({ error: "Intent buyer mismatch" });
    }

    const decimals = await getDecimals();
    const expectedRaw = BigInt(intent.price_raw);

    // Fetch receipt and verify ERC20 Transfer from buyer -> TREASURY >= expectedRaw
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) return res.status(400).json({ error: "Tx not found yet (wait a bit and retry)" });
    if (receipt.status !== 1) return res.status(400).json({ error: "Tx failed on-chain" });

    const iface = new ethers.Interface([
      "event Transfer(address indexed from, address indexed to, uint256 value)"
    ]);

    let paidRaw = 0n;
    for (const log of receipt.logs) {
      if (String(log.address).toLowerCase() !== GCAB_TOKEN.toLowerCase()) continue;
      let parsed;
      try { parsed = iface.parseLog(log); } catch { continue; }
      if (!parsed || parsed.name !== "Transfer") continue;

      const from = String(parsed.args.from).toLowerCase();
      const to = String(parsed.args.to).toLowerCase();
      const value = BigInt(parsed.args.value.toString());

      if (from === buyer.toLowerCase() && to === TREASURY_WALLET.toLowerCase()) {
        paidRaw += value;
      }
    }

    if (paidRaw < expectedRaw) {
      return res.status(400).json({
        error: "Payment insufficient",
        expected: ethers.formatUnits(expectedRaw, decimals),
        paid: ethers.formatUnits(paidRaw, decimals)
      });
    }

    const { burnRaw, rewardsRaw, treasuryRaw } = splitRaw(expectedRaw);

    // ledger
    insBuy.run(
      utcDayKey(),
      buyer.toLowerCase(),
      String(intent.candidate).toLowerCase(),
      txHash,
      expectedRaw.toString(),
      burnRaw.toString(),
      rewardsRaw.toString(),
      treasuryRaw.toString(),
      now()
    );

    markIntentUsed.run(intentId);

    // auto-attach sidekick to buyer (candidate address)
    upsertSidekick.run(buyer, `candidate:${String(intent.candidate).toLowerCase()}`, now());

    res.json({
      ok: true,
      buyer: buyer.toLowerCase(),
      candidate: String(intent.candidate).toLowerCase(),
      txHash,
      amount: ethers.formatUnits(expectedRaw, decimals),
      split: {
        burn: ethers.formatUnits(burnRaw, decimals),
        rewards: ethers.formatUnits(rewardsRaw, decimals),
        treasury: ethers.formatUnits(treasuryRaw, decimals)
      },
      note: "Split recorded. Burn is deferred (batch). Sidekick attached to buyer."
    });
  } catch (e) {
    res.status(400).json({ error: e?.message || "Confirm failed" });
  }
});

app.get("/buy/history", (req, res) => {
  try {
    const buyer = normAddr(req.query.owner).toLowerCase();
    const rows = listBuysByBuyer.all(buyer);
    res.json(rows);
  } catch {
    res.status(400).json({ error: "Bad owner" });
  }
});


/* =========================================================
   ENERGY v1 (claim diário UTC + budget)
   ========================================================= */
app.get("/energy/status", (req, res) => {
  try {
    const address = normAddr(req.query.owner);
    upsertPlayerSeen.run(address, now());

    const p = getPlayer.get(address) || { energy_balance: 0 };
    const day = utcDayKey();
    const claimed = !!hasClaimedToday.get(day, address.toLowerCase());
    const mint = getMintLog.get(day) || { minted_total: 0 };

    res.json({
      ok: true,
      owner: address.toLowerCase(),
      day,
      claimed_today: claimed,
      energy_balance: Number(p.energy_balance || 0),
      budget: ENERGY_DAILY_BUDGET,
      minted_today: Number(mint.minted_total || 0)
    });
  } catch {
    res.status(400).json({ error: "Bad owner" });
  }
});

app.post("/energy/claim", async (req, res) => {
  try {
    const address = normAddr(req.body.address);
    const signature = req.body.signature;

    const auth = requireAuthSignature(address, signature);
    if (!auth.ok) return res.status(auth.code).json({ error: auth.error });

    upsertPlayerSeen.run(address, now());

    const day = utcDayKey();
    if (hasClaimedToday.get(day, address.toLowerCase())) {
      return res.status(400).json({ error: "Already claimed today (UTC)" });
    }

    // Prefer cache; fallback to chain balance
    let balanceNum = 0;
    const cached = db.prepare(`
      SELECT balance_num FROM holders_cache WHERE address=? LIMIT 1
    `).get(address.toLowerCase());

    if (cached && Number.isFinite(Number(cached.balance_num))) {
      balanceNum = Number(cached.balance_num);
    } else {
      // fallback on-chain
      const decimals = await getDecimals();
      const raw = await token.balanceOf(address);
      balanceNum = Number(ethers.formatUnits(raw, decimals));
    }

    let mintAmt = energyFromBalance(balanceNum);

    const mint = getMintLog.get(day) || { minted_total: 0 };
    const mintedTotal = Number(mint.minted_total || 0);

    const remaining = Math.max(0, ENERGY_DAILY_BUDGET - mintedTotal);
    if (remaining <= 0) {
      return res.status(400).json({ error: "Daily energy budget depleted" });
    }

    if (mintAmt > remaining) mintAmt = remaining;
    if (mintAmt <= 0) return res.status(400).json({ error: "No energy available" });

    const p = getPlayer.get(address.toLowerCase()) || { energy_balance: 0 };
    const nextBal = Number(p.energy_balance || 0) + mintAmt;

    // tx-like update
    const tx = db.transaction(() => {
      setEnergy.run(nextBal, address.toLowerCase());
      addEnergyLedger.run(day, address.toLowerCase(), mintAmt, "DAILY_CLAIM", JSON.stringify({
        formula: ENERGY_FORMULA,
        balanceNum
      }), now());

      upsertMintLog.run(day, mintedTotal + mintAmt, now());
    });
    tx();

    res.json({ ok: true, day, minted: mintAmt, energy_balance: nextBal });
  } catch (e) {
    res.status(400).json({ error: e?.message || "Claim failed" });
  }
});

/* =========================================================
   SCHEDULER
   ========================================================= */
function startHolderIndexer() {
  const MIN = Number(process.env.HOLDERS_REFRESH_MIN || 60);
  const run = async (label) => {
    try {
      const r = await indexHoldersOnce();
      console.log(`[HOLDERS:${label}]`, r);
    } catch (e) {
      console.error(`[HOLDERS:${label}] ERROR`, e?.message || e);
    }
  };
  run("boot");
  setInterval(() => run("interval"), MIN * 60 * 1000);
}

/* =========================================================
   START
   ========================================================= */
app.listen(PORT, () => {
  console.log(`GCAb backend running on http://localhost:${PORT}`);
  startHolderIndexer();
});
