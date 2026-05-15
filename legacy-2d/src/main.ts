import Phaser from 'phaser';
import { ArcadeScene } from './scenes/ArcadeScene';

const config: Phaser.Types.Core.GameConfig = {
  // Use CANVAS (not AUTO/WebGL) so that hotlinked Steam CDN images render even if
  // those responses don't carry permissive CORS headers — WebGL textures require
  // CORS-clean cross-origin images; Canvas2D doesn't. Switch to AUTO once we've
  // confirmed Steam's header.jpg responses include Access-Control-Allow-Origin
  // (or once we have a backend proxy in place).
  type: Phaser.CANVAS,
  parent: 'app',
  width: 960,
  height: 600,
  backgroundColor: '#08080f',
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 0 }, debug: false },
  },
  scene: [ArcadeScene],
};

new Phaser.Game(config);
