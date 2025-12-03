// engine/core/Loop.js
export default class Loop {
  constructor(updateFn, renderFn) {
    this.updateFn = updateFn;   // game.update(dt)
    this.renderFn = renderFn;   // game.render(ctx)
    this.lastTime = 0;
    this.delta = 0;

    this.running = false;
    this.raf = null;
  }

  start() {
    if (this.running) return;
    this.running = true;

    this.lastTime = performance.now();
    this._loop(this.lastTime);
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
  }

  _loop(time) {
    if (!this.running) return;

    const dt = (time - this.lastTime) / 1000; // convert ms → seconds
    this.lastTime = time;

    // UPDATE
    this.updateFn(dt);

    // RENDER
    this.renderFn();

    this.raf = requestAnimationFrame((t) => this._loop(t));
  }
}
