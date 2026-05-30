import { BitmapText, Container } from 'pixi.js';
import type { Application } from 'pixi.js';
import type { Theme } from '../../themes/types';
import type { ClusterGame, Continent } from '../../procedural/clusters';
import {
  aggregateActivity,
  activityGlyphFor,
  blobCells,
  clusterLibrary,
  continentGameCount,
  flattenIslands,
  islandGameCount,
  layoutClusterPositions,
  truncateLabel,
  LAYOUT_SALT,
} from '../../procedural/clusters';
import {
  COZETTE_FONT_FAMILY,
  COZETTE_FONT_SIZE,
  hexToInt,
} from '../fonts';

/**
 * Continent-level renderer (Phase 7-A) — the highest REAL rung (planet +
 * solar_system stay stubs). Renders the library's continents as land-masses:
 * each continent is a filled blob of islands floating on a dot sea, blob
 * SIZE scaling with the continent's game count. The land/sea contrast is
 * filled-glyph-vs-dot, not a new ocean glyph (vocabulary stays shared with
 * cell/district/island).
 *
 * Read-only: no ticker, no keydown listener. All layout is precomputed by
 * pure helpers (clusterLibrary + blobCells + layoutClusterPositions) and
 * painted once at mount + on resize, so it renders correctly under the
 * `paused`/`sleeping` throttle (ticker stopped).
 *
 * One theme palette: the continent frame + labels tint `fg`, the home
 * island + YOU marker tint `fgBright`, the sea + non-home islands tint
 * `fgDim`. No off-palette colours. Same accent vocabulary as island.
 *
 * Teardown contract identical to mountDistrict/mountStubLevel: off resize +
 * destroy the per-level Container. NEVER app.destroy().
 */
export function mountContinent(
  app: Application,
  theme: Theme,
  games: readonly ClusterGame[],
  seed: number,
): () => void {
  const container = new Container();
  app.stage.addChild(container);

  const tree = clusterLibrary(games, seed);

  if (tree.continents.length === 0) {
    const panel = emptyPanel(theme, 'continent', 'no library loaded yet.');
    container.addChild(panel);
    const fitEmpty = makeFit(app, container, panel, 0.45);
    fitEmpty();
    app.renderer.on('resize', fitEmpty);
    return () => {
      app.renderer.off('resize', fitEmpty);
      container.destroy({ children: true });
    };
  }

  // Map canvas sized to the continent count. A small fixed grid keeps masses
  // distinct + labelled; the "home" continent (the one holding the first
  // island/district — canonical c0) gets the YOU marker.
  const continents = tree.continents;
  const cols = Math.max(1, Math.ceil(Math.sqrt(continents.length)));
  const positions = layoutClusterPositions(
    continents.map((c) => c.id),
    seed,
    LAYOUT_SALT,
    cols,
  );

  // Each continent occupies a CELL_BLOCK × CELL_BLOCK region of the map so
  // its blob has room to grow without colliding with a neighbour's.
  const maxRow = positions.reduce((m, p) => Math.max(m, p.y), 0);
  const blockCols = cols;
  const blockRows = maxRow + 1;
  const canvasW = blockCols * CELL_BLOCK;
  const canvasH = blockRows * CELL_BLOCK;

  // Land grid: glyph + tint key per cell, default sea (dot / fgDim).
  const glyphGrid: string[][] = Array.from({ length: canvasH }, () =>
    Array.from({ length: canvasW }, () => '·'),
  );

  const labels: Array<{
    text: string;
    cx: number;
    cy: number;
    home: boolean;
  }> = [];

  const homeId = continents.length > 0 ? continents[0].id : null;

  for (let k = 0; k < continents.length; k++) {
    const c = continents[k];
    const pos = positions[k];
    // Centroid = center of this continent's block.
    const cx = pos.x * CELL_BLOCK + Math.floor(CELL_BLOCK / 2);
    const cy = pos.y * CELL_BLOCK + Math.floor(CELL_BLOCK / 2);
    const area = continentGameCount(c);
    const fillGlyph = activityGlyphFor(
      aggregateActivity(c.islands.flatMap((i) => i.districts)),
    );
    const cells = blobCells(cx, cy, area, canvasW, canvasH, seed, LAYOUT_SALT);
    for (const cell of cells) {
      glyphGrid[cell.y][cell.x] = fillGlyph;
    }
    const islandCount = c.islands.length;
    labels.push({
      text: truncateLabel(
        `${continentName(c)} ${area}g/${islandCount}i`,
        canvasW,
      ),
      cx,
      cy,
      home: c.id === homeId,
    });
  }

  const text = glyphGrid.map((row) => row.join('')).join('\n');
  const header =
    `continent · ${continents.length} land-mass${continents.length === 1 ? '' : 'es'} · ${tree.gameCount} games`;
  const footer = '[ zooms out · ] zooms in   ▓ core · ▒ engaged · · sea';

  const panel = new BitmapText({
    text: `${header}\n\n${text}\n\n${footer}`,
    style: {
      fontFamily: COZETTE_FONT_FAMILY,
      fontSize: COZETTE_FONT_SIZE,
      fill: hexToInt(theme.palette.fg),
    },
  });
  container.addChild(panel);

  // Land-mass labels as small bright/dim children positioned at the blob
  // centroid. Home continent's label tints fgBright; others fgDim.
  const labelNodes: BitmapText[] = [];
  for (const l of labels) {
    const node = new BitmapText({
      text: l.text,
      style: {
        fontFamily: COZETTE_FONT_FAMILY,
        fontSize: COZETTE_FONT_SIZE,
        fill: hexToInt(l.home ? theme.palette.fgBright : theme.palette.fgDim),
      },
    });
    container.addChild(node);
    labelNodes.push(node);
  }

  const fit = makeFit(app, container, panel, 0.6);
  const placeLabels = () => {
    const scale = container.scale.x;
    for (let i = 0; i < labels.length; i++) {
      const l = labels[i];
      // +HEADER_ROWS for the header + blank line; place just below centroid.
      const gx = l.cx * GLYPH_W;
      const gy = (l.cy + 1 + HEADER_ROWS) * GLYPH_H;
      labelNodes[i].x = container.x + gx * scale;
      labelNodes[i].y = container.y + gy * scale;
      labelNodes[i].scale.set(scale);
    }
  };
  const fitAll = () => {
    fit();
    placeLabels();
  };
  fitAll();
  app.renderer.on('resize', fitAll);

  return () => {
    app.renderer.off('resize', fitAll);
    container.destroy({ children: true });
  };
}

/** A continent's display name: its largest island's representative game, or
 *  the continent id. Pure-ish (depends only on the tree). */
function continentName(c: Continent): string {
  const islands = flattenIslands({
    continents: [c],
    districtCount: 0,
    islandCount: 0,
    continentCount: 0,
    gameCount: 0,
  });
  let best = '';
  let bestCount = -1;
  for (const isl of islands) {
    const n = islandGameCount(isl);
    if (n > bestCount && isl.districts.length > 0) {
      const d = isl.districts[0];
      if (d.games.length > 0) {
        best = d.games[0].name;
        bestCount = n;
      }
    }
  }
  return best || c.id;
}

/** Each continent's block on the map. Big enough for a radius-6 blob. */
const CELL_BLOCK = 14;
const HEADER_ROWS = 2;
const GLYPH_W = 6;
const GLYPH_H = 13;

function makeFit(
  app: Application,
  container: Container,
  panel: BitmapText,
  frac: number,
): () => void {
  return () => {
    const desired = Math.min(app.screen.width, app.screen.height) * frac;
    const scale = Math.max(1, Math.floor(desired / Math.max(1, panel.height)));
    container.scale.set(scale);
    container.x = Math.floor((app.screen.width - panel.width * scale) / 2);
    container.y = Math.floor((app.screen.height - panel.height * scale) / 2);
  };
}

function emptyPanel(theme: Theme, level: string, note: string): BitmapText {
  const pad = (s: string, w: number): string =>
    s.length >= w ? s.slice(0, w) : s + ' '.repeat(w - s.length);
  return new BitmapText({
    text:
      '╔════════════════════════════════════════╗\n' +
      '║                                        ║\n' +
      `║   ${pad(level, 36)}║\n` +
      '║                                        ║\n' +
      `║   ${pad(note, 36)}║\n` +
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
}
