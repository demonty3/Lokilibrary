import { BitmapText, Container, Graphics } from 'pixi.js';
import type { Theme } from '../../themes/types';
import type { ClusterGame } from '../../procedural/clusters';
import type { PixelRect } from '../PixiApp';
import { composeContinentPanel, type LadderIdentity } from './ladderCompose';
import { fitGrid, ladderLayerTint, layerStrings } from './tintPanel';
import {
  COZETTE_CELL_HEIGHT,
  COZETTE_CELL_WIDTH,
  COZETTE_FONT_FAMILY,
  COZETTE_FONT_SIZE,
  hexToInt,
} from '../fonts';

/**
 * Continent-level renderer — since the ladder identity pass (spec
 * 2026-07-17) a THIN PIXI shell over
 * `ladderCompose.ts:composeContinentPanel`: gold land-mass blobs (the ramp
 * layer — the glyph still encodes aggregate activity) on a dim dot sea,
 * home continent = the one containing the pane's bound wing, its label
 * `YOU · `-prefixed. Layers → one BitmapText each via `ladderLayerTint`;
 * the cell room's `fitGrid` composition rule.
 *
 * Land-mass labels stay SEPARATE backed nodes (not canvas layers): they
 * overprint the blob glyphs, so each needs the opaque theme-bg backing
 * rect (the cell.ts caption pattern) to stay legible. Composition returns
 * final clamped positions; this file only draws.
 *
 * Read-only: no ticker, no keydown. Teardown: destroy the per-level
 * Container, NEVER app.destroy(). Pane-scoped (Phase 7-B).
 */
export function mountContinent(
  parent: Container,
  rect: PixelRect,
  theme: Theme,
  games: readonly ClusterGame[],
  seed: number,
  identity?: LadderIdentity,
): { teardown: () => void; refit: (rect: PixelRect) => void } {
  const container = new Container();
  parent.addChild(container);

  const { panel, labels } = composeContinentPanel(games, seed, identity);
  const { canvas, cols, rows } = panel;
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

  // Labels in container-LOCAL glyph space (the container carries scale +
  // centering, so no double transform — the 7-A must-fix stands). Backing
  // first, text after (above).
  for (const l of labels) {
    const gx = l.startCol * COZETTE_CELL_WIDTH;
    const gy = l.row * COZETTE_CELL_HEIGHT;
    const backing = new Graphics()
      .rect(gx - 2, gy - 1, l.text.length * COZETTE_CELL_WIDTH + 4, COZETTE_CELL_HEIGHT + 2)
      .fill({ color: hexToInt(theme.palette.bg) });
    container.addChild(backing);
    const node = new BitmapText({
      text: l.text,
      style: {
        fontFamily: COZETTE_FONT_FAMILY,
        fontSize: COZETTE_FONT_SIZE,
        fill: hexToInt(l.home ? theme.palette.fgBright : theme.palette.fgDim),
      },
    });
    node.x = gx;
    node.y = gy;
    container.addChild(node);
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
