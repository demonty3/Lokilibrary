import { BitmapText, Container } from 'pixi.js';
import type { Application } from 'pixi.js';
import type { Theme } from '../../themes/types';
import {
  COZETTE_FONT_FAMILY,
  COZETTE_FONT_SIZE,
  hexToInt,
} from '../fonts';

/**
 * District-level renderer (Phase 1D minimum viable). A 3×3 minimap of
 * the cell the player is in plus eight stubbed neighbours: this cell
 * is the only one with content; the others read "—" to indicate they
 * exist conceptually but aren't built. Phase 2+ replaces this with
 * actual neighbour-cell layouts + agent activity heatmap.
 *
 * No interactivity beyond the [ / ] zoom transitions handled in
 * App.tsx; this view is read-only.
 */
export function mountDistrict(app: Application, theme: Theme): () => void {
  const container = new Container();
  app.stage.addChild(container);

  // Mini-card text per neighbour. Center holds the player's cell.
  const grid: string[][] = [
    ['─────', '─────', '─────'],
    ['  ·  ', ' YOU ', '  ·  '],
    ['─────', '─────', '─────'],
  ];

  const lines: string[] = [];
  // Header
  lines.push('╔═ district ═══════════════════════════╗');
  lines.push('║                                      ║');
  for (const row of grid) {
    lines.push(
      '║   ┌─────┬─────┬─────┐                ║',
    );
    lines.push(
      `║   │${row[0]}│${row[1]}│${row[2]}│                ║`,
    );
  }
  lines.push('║   └─────┴─────┴─────┘                ║');
  lines.push('║                                      ║');
  lines.push('║   neighbouring cells not yet built.  ║');
  lines.push('║   [ zooms out · ] zooms in           ║');
  lines.push('║                                      ║');
  lines.push('╚══════════════════════════════════════╝');

  const panel = new BitmapText({
    text: lines.join('\n'),
    style: {
      fontFamily: COZETTE_FONT_FAMILY,
      fontSize: COZETTE_FONT_SIZE,
      fill: hexToInt(theme.palette.fg),
    },
  });
  container.addChild(panel);

  const youHighlight = new BitmapText({
    text: 'YOU',
    style: {
      fontFamily: COZETTE_FONT_FAMILY,
      fontSize: COZETTE_FONT_SIZE,
      fill: hexToInt(theme.palette.fgBright),
    },
  });
  // Position the YOU highlight over the center cell of the grid in the
  // raw panel text. Done after panel is positioned in fit().
  container.addChild(youHighlight);

  const fit = () => {
    const desired = Math.min(app.screen.width, app.screen.height) * 0.5;
    const scale = Math.max(1, Math.floor(desired / panel.height));
    container.scale.set(scale);
    container.x = Math.floor((app.screen.width - panel.width * scale) / 2);
    container.y = Math.floor((app.screen.height - panel.height * scale) / 2);
    // Tuck the highlight in roughly where "YOU" sits in the ASCII.
    // (Approximate; the underlying panel already prints YOU dim so an
    // off-by-pixel overlay is graceful, not broken.)
    // panel text local coords: line 4 of the grid section, after the
    // 4-char left-padding ("║   │") + 1 cell wide (5 chars) + 1 gap.
    youHighlight.x = (panel.x ?? 0) + 4 * 6 + 5 * 6 + 1;
    youHighlight.y = (panel.y ?? 0) + 4 * 13;
  };
  fit();
  app.renderer.on('resize', fit);

  return () => {
    app.renderer.off('resize', fit);
    container.destroy({ children: true });
  };
}
