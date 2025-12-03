// engine/core/Game.js
import Loop from "./Loop.js";
import Map from "../map/Map.js";

export default class Game {
  constructor(canvasId = "game", level = 1) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) {
      throw new Error(`Canvas element with id "${canvasId}" not found`);
    }

    this.ctx = this.canvas.getContext("2d");

    this.level = level;
    this.state = "loading"; // loading, running, paused, gameover, error

    this.width = this.canvas.width;
    this.height = this.canvas.height;

    // Core game state
    this.map = null;
    this.enemies = [];
    this.towers = [];
    this.projectiles = [];
    this.waveSystem = null;

    this.player = {
      coins: 100,
      hp: 20,
      score: 0,
      address: null // wallet address (set from vault.js)
    };

    // Vault state (used by vault.js UI)
    this.vault = {
      energy: 0,
      energyMax: 100,
      chargesUsed: 0,
      chargesMax: 1
    };

    this.loop = new Loop(
      (dt) => this.update(dt),
      () => this.render()
    );
  }

  async load() {
    try {
      // Path is relative to the page URL (…/games/vault/)
      const res = await fetch("./data/maps/level_1.json");
      if (!res.ok) {
        throw new Error(
          `Failed to load map JSON: ${res.status} ${res.statusText}`
        );
      }

      const mapData = await res.json();
      this.map = new Map(mapData);

      this.state = "running";
    } catch (err) {
      console.error("[Game.load] Error loading resources:", err);
      this.state = "error";
    }
  }

  start() {
    this.load().then(() => {
      if (this.state === "running") {
        this.loop.start();
      } else {
        // Optional: draw an error screen
        this.renderError();
      }
    });
  }

  update(dt) {
    if (this.state !== "running") return;

    // Update enemies
    for (const e of this.enemies) e.update(dt);

    // Update towers
    for (const t of this.towers) t.update(dt, this.enemies);

    // Update projectiles
    for (const p of this.projectiles) p.update(dt, this.enemies);

    // Wave manager
    if (this.waveSystem) this.waveSystem.update(dt);
  }

  render() {
    const ctx = this.ctx;

    ctx.clearRect(0, 0, this.width, this.height);

    if (this.state === "error") {
      this.renderError();
      return;
    }

    // Draw map
    if (this.map) this.map.draw(ctx);

    // Draw enemies
    for (const e of this.enemies) e.draw(ctx);

    // Draw towers
    for (const t of this.towers) t.draw(ctx);

    // Draw projectiles
    for (const p of this.projectiles) p.draw(ctx);

    // HUD will be handled by external UI for now
  }

  renderError() {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = "#200";
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.fillStyle = "#f55";
    ctx.font = "24px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Error loading game resources.", this.width / 2, this.height / 2);
    ctx.restore();
  }
}
