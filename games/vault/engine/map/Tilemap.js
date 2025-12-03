// engine/map/Tilemap.js
export default class Tilemap {
  constructor(data) {
    this.width = data.width;
    this.height = data.height;
    this.tileSize = data.tileSize;
    this.tiles = data.tiles.map(row => row.split(""));
  }

  isPath(x, y) {
    return this.tiles[y] && this.tiles[y][x] === "P";
  }

  isBuildable(x, y) {
    return this.tiles[y] && this.tiles[y][x] === "G";
  }

  draw(ctx) {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const tile = this.tiles[y][x];

        if (tile === "G") ctx.fillStyle = "#2b8a3e";      // grass
        if (tile === "P") ctx.fillStyle = "#b08968";      // dirt path

        ctx.fillRect(
          x * this.tileSize,
          y * this.tileSize,
          this.tileSize,
          this.tileSize
        );
      }
    }
  }
}
