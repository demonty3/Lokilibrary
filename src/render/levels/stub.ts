import { BitmapText, Container } from 'pixi.js';
import type { Theme } from '../../themes/types';
import type { ScaleLevel } from '../../types';
import type { PixelRect } from '../PixiApp';
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
 *
 * Phase 7-B — pane-scoped. Adds its Container to the supplied `parent` (a
 * per-pane root, NOT app.stage) and fits to `rect` (a pixel rectangle in the
 * parent's LOCAL space, origin 0,0) instead of the full screen. The PixiApp
 * router owns the resize → re-fit by calling the returned `refit`. With a
 * single full-grid pane rect === full screen and the output is identical to
 * the pre-7-B path.
 */
export function mountStubLevel(
  parent: Container,
  rect: PixelRect,
  theme: Theme,
  level: ScaleLevel,
  aggregateNote?: string,
): { teardown: () => void; refit: (rect: PixelRect) => void } {
  const container = new Container();
  parent.addChild(container);

  const label = level.replace(/_/g, ' ');
  // Phase 7-A: planet/solar_system stay stubs, but carry a one-line library
  // aggregate (game / continent count) so the highest rungs aren't empty.
  const note = (aggregateNote ?? 'keep playing.').slice(0, 36);
  const panel = new BitmapText({
    text:
      '╔════════════════════════════════════════╗\n' +
      '║                                        ║\n' +
      `║   ${label.padEnd(36)}║\n` +
      '║                                        ║\n' +
      `║   not yet built.                       ║\n` +
      `║   ${note.padEnd(36)}║\n` +
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

  const fit = (r: PixelRect) => {
    // Integer-scale to ~⅓ of the smallest rect dimension so the panel is
    // readable on any monitor without antialiasing. Centre within the rect.
    const desired = Math.min(r.pw, r.ph) / 3;
    const scale = Math.max(1, Math.floor(desired / panel.height));
    container.scale.set(scale);
    container.x = Math.floor((r.pw - panel.width * scale) / 2);
    container.y = Math.floor((r.ph - panel.height * scale) / 2);
  };
  fit(rect);

  return {
    refit: fit,
    teardown: () => {
      container.destroy({ children: true });
    },
  };
}
