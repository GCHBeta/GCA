// engine/map/Pathfinding.js
export default class Pathfinding {
  constructor(tilemap, pathData) {
    this.tilemap = tilemap;
    this.paths = [];

    for (const p of pathData) {
      this.paths.push(this.computePath(p.start, p.end));
    }
  }

  computePath(start, end) {
    const [sx, sy] = start;
    const [ex, ey] = end;

    let path = [];

    // Straight vertical / horizontal walking (simple maps)
    let x = sx;
    let y = sy;

    path.push({ x, y });

    // Horizontal
    while (x !== ex) {
      x += (ex > x ? 1 : -1);
      path.push({ x, y });
    }

    // Vertical
    while (y !== ey) {
      y += (ey > y ? 1 : -1);
      path.push({ x, y });
    }

    return path.map(p => ({
      px: p.x * this.tilemap.tileSize + this.tilemap.tileSize / 2,
      py: p.y * this.tilemap.tileSize + this.tilemap.tileSize / 2
    }));
  }

  getRandomPath() {
    return this.paths[Math.floor(Math.random() * this.paths.length)];
  }
}
