import { BitmapText, Container } from 'pixi.js';
import type { Theme } from '../../themes/types';
import type { ClusterGame } from '../../procedural/clusters';
import type { PixelRect } from '../PixiApp';
import { composeDistrictPanel, type LadderIdentity } from './ladderCompose';
import { fitGrid, ladderLayerTint, layerStrings } from './tintPanel';
import {
  COZETTE_CELL_HEIGHT,
  COZETTE_CELL_WIDTH,
  COZETTE_FONT_FAMILY,
  COZETTE_FONT_SIZE,
  hexToInt,
} from '../fonts';

/**
 * District-level renderer — since the ladder identity pass (spec
 * 2026-07-17) a THIN PIXI shell over the pure composition in
 * `ladderCompose.ts:composeDistrictPanel`. The panel arrives as disjoint
 * tint layers (gold frames, warm ramp, being letters, a composed YOU on
 * the home card); this file only turns each layer into one BitmapText
 * (`ladderLayerTint` maps layer → palette key) and applies the cell
 * room's composition rule (`fitGrid` — integer scale, centred, fills the
 * pane). Home follows the pane's bound wing via `identity.homeWingId`.
 *
 * Read-only beyond the `[` / `]` zoom transitions owned by App.tsx; no
 * ticker, no keydown — paints once at mount + on refit, so it renders
 * correctly under the `paused`/`sleeping` throttle.
 *
 * Teardown: destroy the per-level Container. NEVER app.destroy() — the
 * Application is owned by mountPalace. Pane-scoped (Phase 7-B): parents
 * to the supplied per-pane root and fits within `rect`.
 */
export function mountDistrict(
  parent: Container,
  rect: PixelRect,
  theme: Theme,
  games: readonly ClusterGame[],
  seed: number,
  identity?: LadderIdentity,
): { teardown: () => void; refit: (rect: PixelRect) => void } {
  const container = new Container();
  parent.addChild(container);

  const { canvas, cols, rows } = composeDistrictPanel(games, seed, identity);
  for (const [layer, text] of layerStrings(canvas)) {
    container.addChild(
      new BitmapText({
        text,
        style: {
          fontFamily: COZETTE_FONT_FAMILY,
          fontSize: COZETTE_FONT_SIZE,
          fill: hexToInt(theme.palette[ladderLayerTint(theme, layer)]),
        },
      }),
    );
  }

  const fit = (r: PixelRect) => {
    const f = fitGrid(cols * COZETTE_CELL_WIDTH, rows * COZETTE_CELL_HEIGHT, r);
    container.scale.set(f.scale);
    container.x = f.x;
    container.y = f.y;
  };
  fit(rect);

  return {
    refit: fit,
    teardown: () => {
      container.destroy({ children: true });
    },
  };
}
