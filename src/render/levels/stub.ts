import { BitmapText, Container } from 'pixi.js';
import type { Application } from 'pixi.js';
import type { Theme } from '../../themes/types';
import type { ScaleLevel } from '../../types';
import {
  COZETTE_FONT_FAMILY,
  COZETTE_FONT_SIZE,
  hexToInt,
} from '../fonts';

/**
 * "Not yet built" stub for scale levels Phase 1 hasn't implemented
 * (island, continent, planet, solar_system). Doubles as a bitmap-font
 * smoke test at every level — if the panel renders here, the renderer
 * pipeline + font load works end-to-end. Higher-level rendering lands
 * in Phase 2+ as the agent + map terminals come online.
 */
export function mountStubLevel(
  app: Application,
  theme: Theme,
  level: ScaleLevel,
): () => void {
  const container = new Container();
  app.stage.addChild(container);

  const label = level.replace(/_/g, ' ');
  const panel = new BitmapText({
    text:
      '╔════════════════════════════════════════╗\n' +
      '║                                        ║\n' +
      `║   ${label.padEnd(36)}║\n` +
      '║                                        ║\n' +
      '║   not yet built. keep playing.         ║\n' +
      '║                                        ║\n' +
      '║   [ zooms out · ] zooms in             ║\n' +
      '║                                        ║\n' +
      '╚════════════════════════════════════════╝',
    style: {
      fontFamily: COZETTE_FONT_FAMILY,
      fontSize: COZETTE_FONT_SIZE,
      fill: hexToInt(theme.palette.fgDim),
    },
  });
  container.addChild(panel);

  const fit = () => {
    // Integer-scale to ~⅓ of the smallest screen dimension so the
    // panel is readable on any monitor without antialiasing.
    const desired = Math.min(app.screen.width, app.screen.height) / 3;
    const scale = Math.max(1, Math.floor(desired / panel.height));
    container.scale.set(scale);
    container.x = Math.floor((app.screen.width - panel.width * scale) / 2);
    container.y = Math.floor((app.screen.height - panel.height * scale) / 2);
  };
  fit();
  app.renderer.on('resize', fit);

  return () => {
    app.renderer.off('resize', fit);
    container.destroy({ children: true });
  };
}
