import { BitmapText, Container } from 'pixi.js';
import type { Theme } from '../../themes/types';
import type { ClusterGame } from '../../procedural/clusters';
import type { PixelRect } from '../PixiApp';
import { composeIslandPanel, type LadderIdentity } from './ladderCompose';
import { fitGrid, ladderLayerTint, layerStrings } from './tintPanel';
import {
  COZETTE_CELL_HEIGHT,
  COZETTE_CELL_WIDTH,
  COZETTE_FONT_FAMILY,
  COZETTE_FONT_SIZE,
  hexToInt,
} from '../fonts';

/**
 * Island-level renderer — since the ladder identity pass (spec 2026-07-17)
 * a THIN PIXI shell over `ladderCompose.ts:composeIslandPanel` (which also
 * owns continent picking: the continent CONTAINING the pane's bound wing,
 * falling back to the largest). Disjoint tint layers → one BitmapText per
 * layer via `ladderLayerTint`; the cell room's `fitGrid` composition rule.
 * The empty-library double-frame panel arrives from composition in the
 * dim layer.
 *
 * Read-only: no ticker, no keydown; paints at mount + refit only, so it
 * renders correctly under the `paused`/`sleeping` throttle. Teardown:
 * destroy the per-level Container, NEVER app.destroy(). Pane-scoped
 * (Phase 7-B): parents to the per-pane root, fits within `rect`.
 */
export function mountIsland(
  parent: Container,
  rect: PixelRect,
  theme: Theme,
  games: readonly ClusterGame[],
  seed: number,
  identity?: LadderIdentity,
): { teardown: () => void; refit: (rect: PixelRect) => void } {
  const container = new Container();
  parent.addChild(container);

  const { canvas, cols, rows } = composeIslandPanel(games, seed, identity);
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
