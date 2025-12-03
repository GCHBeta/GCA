// engine/map/Map.js
import Tilemap from "./Tilemap.js";
import Pathfinding from "./Pathfinding.js";

export default class Map {
  constructor(data) {
    this.tilemap = new Tilemap(data);
    this.pathfinding = new Pathfinding(this.tilemap, data.paths);
  }

  getEnemyPath() {
    return this.pathfinding.getRandomPath();
  }

  isBuildableTile(x, y) {
    return this.tilemap.isBuildable(x, y);
  }

  draw(ctx) {
    this.tilemap.draw(ctx);
  }
}
