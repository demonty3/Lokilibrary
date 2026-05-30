import { BitmapText, Container } from 'pixi.js';
import type { Theme } from '../../themes/types';
import type { ClusterGame, Continent } from '../../procedural/clusters';
import type { PixelRect } from '../PixiApp';
import {
  activityGlyphFor,
  clusterLibrary,
  continentGameCount,
  districtLabel,
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
 * Island-level renderer (Phase 7-A). One step up from district: shows the
 * neighbourhood-cards of ONE parent continent — each district in that
 * continent is a bordered card carrying its name, game count, and an
 * activity glyph. The card containing the "home" district (district 0, the
 * lowest-id district = the most-played game's bucket — there is no
 * persistent player-district state yet, so the seed-canonical first district
 * is "YOU") gets the bright YOU marker.
 *
 * Read-only: no ticker, no keydown listener — App.tsx owns the `[` / `]`
 * zoom transitions. The renderer paints precomputed pure-helper output
 * (clusterLibrary + layoutClusterPositions) once at mount + on resize, so it
 * renders correctly even when mounted under the `paused`/`sleeping` throttle
 * (the ticker is stopped there; we never defer layout to a ticker callback).
 *
 * Glyph vocabulary + palette are shared with cell/district (box-drawing
 * frames tinted `fg`, shade-ramp activity glyphs, the floor dot for empty
 * space) so the four rungs read as one recoloured alphabet, not four broken
 * maps (CLAUDE.md aesthetic-coherence rule). ONE theme palette per scene.
 *
 * Teardown contract is identical to mountDistrict/mountStubLevel: destroy the
 * per-level Container. NEVER app.destroy() — the Application is owned by
 * mountPalace.
 *
 * Phase 7-B — pane-scoped: adds its Container to `parent` (a per-pane root)
 * and fits within `rect` (pixel rect, local origin) instead of the full
 * screen; PixiApp drives resize via the returned `refit`. Single full-grid
 * pane ⇒ rect === full screen ⇒ identical to the pre-7-B path.
 */
export function mountIsland(
  parent: Container,
  rect: PixelRect,
  theme: Theme,
  games: readonly ClusterGame[],
  seed: number,
): { teardown: () => void; refit: (rect: PixelRect) => void } {
  const container = new Container();
  parent.addChild(container);

  const tree = clusterLibrary(games, seed);

  // Pick the parent continent to show: the largest by game count (lexical id
  // tiebreak), so the island view always lands on the most substantial
  // neighbourhood. Deterministic. Empty library → null → empty panel.
  const activeContinent = pickPrimaryContinent(tree.continents);

  if (!activeContinent) {
    const panel = emptyPanel(theme, 'island', 'no library loaded yet.');
    container.addChild(panel);
    const fitEmpty = makeFit(container, panel, 0.45);
    fitEmpty(rect);
    return {
      refit: fitEmpty,
      teardown: () => {
        container.destroy({ children: true });
      },
    };
  }

  // Districts of the active continent, in canonical (continent→island→
  // district) order. The first district is "home" (YOU).
  const districts = activeContinent.islands.flatMap((i) => i.districts);
  const homeId = districts.length > 0 ? districts[0].id : null;

  // Deterministic card placement. cols = ceil(sqrt(n)) keeps the card grid
  // square-ish; layoutClusterPositions jitters rows per seed.
  const cols = Math.max(1, Math.ceil(Math.sqrt(districts.length)));
  const positions = layoutClusterPositions(
    districts.map((d) => d.id),
    seed,
    LAYOUT_SALT,
    cols,
  );

  // Compose the card grid into one character grid → one BitmapText panel.
  // Each card is CARD_W × CARD_H glyphs; the grid is rows×cols of cards.
  const maxRow = positions.reduce((m, p) => Math.max(m, p.y), 0);
  const gridCols = cols;
  const gridRows = maxRow + 1;
  const canvasW = gridCols * CARD_W;
  const canvasH = gridRows * CARD_H;

  const grid: string[][] = Array.from({ length: canvasH }, () =>
    Array.from({ length: canvasW }, () => ' '),
  );

  let homeOriginX = 0;
  let homeOriginY = 0;
  for (let k = 0; k < districts.length; k++) {
    const d = districts[k];
    const pos = positions[k];
    const ox = pos.x * CARD_W;
    const oy = pos.y * CARD_H;
    const card = renderIslandCard(districtLabel(d), d.games.length, d.activity);
    for (let r = 0; r < CARD_H; r++) {
      for (let c = 0; c < CARD_W; c++) {
        grid[oy + r][ox + c] = card[r][c];
      }
    }
    if (d.id === homeId) {
      homeOriginX = ox;
      homeOriginY = oy;
    }
  }

  const text = grid.map((row) => row.join('')).join('\n');
  const header =
    `island · ${activeContinent.id} · ${districts.length} neighbourhood${districts.length === 1 ? '' : 's'}`;
  const footer = '[ zooms out · ] zooms in   ▓ loved · ▒ engaged · ░ tried · · dusty';

  const panel = new BitmapText({
    text: `${header}\n\n${text}\n\n${footer}`,
    style: {
      fontFamily: COZETTE_FONT_FAMILY,
      fontSize: COZETTE_FONT_SIZE,
      fill: hexToInt(theme.palette.fg),
    },
  });
  container.addChild(panel);

  // YOU marker over the home card's header row. The panel prepends a header
  // line + a blank line (2 rows) before the card grid begins.
  const youHighlight = new BitmapText({
    text: 'YOU',
    style: {
      fontFamily: COZETTE_FONT_FAMILY,
      fontSize: COZETTE_FONT_SIZE,
      fill: hexToInt(theme.palette.fgBright),
    },
  });
  if (homeId) container.addChild(youHighlight);

  const fit = makeFit(container, panel, 0.6);
  const placeYou = () => {
    if (!homeId) return;
    // +2 grid rows for the header + blank line; +1 col / +1 row inside the
    // card to sit just inside its top border. The marker is a CHILD of
    // `container`, so it lives in the container's LOCAL glyph space — the
    // parent already applies `container.x/y` + `container.scale`. (Earlier
    // code added `container.x` + multiplied by `scale` here too, which
    // double-applied both the centering offset and the scale and flung the
    // marker off-screen.)
    const gx = (homeOriginX + 1) * GLYPH_W;
    const gy = (homeOriginY + 1 + HEADER_ROWS) * GLYPH_H;
    youHighlight.x = gx;
    youHighlight.y = gy;
  };
  const fitAll = (r: PixelRect) => {
    fit(r);
    placeYou();
  };
  fitAll(rect);

  return {
    refit: fitAll,
    teardown: () => {
      container.destroy({ children: true });
    },
  };
}

// --- pure-ish card rendering (string layout) -------------------------------

/** Card glyph dimensions. Wide enough for a truncated name + a count line. */
const CARD_W = 11;
const CARD_H = 5;
const HEADER_ROWS = 2; // header line + blank line before the card grid
const GLYPH_W = 6; // Cozette cell width
const GLYPH_H = 13; // Cozette cell height

/**
 * Render one neighbourhood card as a CARD_H × CARD_W grid of glyphs:
 *
 *   ┌─────────┐
 *   │Disco El…│   ← truncated district label
 *   │ 4 games │   ← member count
 *   │ ▓▓▒░·   │   ← activity fill (density ~ count, glyph ~ activity)
 *   └─────────┘
 *
 * Pure: same (label, count, activity) → same lines. Exported-shaped (kept
 * module-local; the smoke covers the pure helpers it depends on —
 * districtLabel / activityGlyphFor / truncateLabel — directly).
 */
function renderIslandCard(
  label: string,
  count: number,
  activity: import('../../procedural/clusters').ClusterActivity,
): string[] {
  const inner = CARD_W - 2; // chars between the │ borders
  const top = '┌' + '─'.repeat(inner) + '┐';
  const bottom = '└' + '─'.repeat(inner) + '┘';

  const name = pad(truncateLabel(label, inner), inner);

  const countText = `${count} game${count === 1 ? '' : 's'}`;
  const countLine = center(truncateLabel(countText, inner), inner);

  // Activity fill: a short run of the activity glyph, length scaled by count
  // (1..inner), padded with the floor dot so the card body reads as terrain.
  const glyph = activityGlyphFor(activity);
  const fillLen = Math.max(1, Math.min(inner, count));
  const fill = pad(glyph.repeat(fillLen), inner, '·');

  return [
    top,
    '│' + name + '│',
    '│' + countLine + '│',
    '│' + fill + '│',
    bottom,
  ];
}

function pad(s: string, width: number, fillChar = ' '): string {
  if (s.length >= width) return s.slice(0, width);
  return s + fillChar.repeat(width - s.length);
}

function center(s: string, width: number): string {
  if (s.length >= width) return s.slice(0, width);
  const left = Math.floor((width - s.length) / 2);
  const right = width - s.length - left;
  return ' '.repeat(left) + s + ' '.repeat(right);
}

// --- shared helpers (island + continent) -----------------------------------

/** Largest continent by game count, lexical-id tiebreak. Null when empty. */
export function pickPrimaryContinent(
  continents: readonly Continent[],
): Continent | null {
  if (continents.length === 0) return null;
  let best = continents[0];
  let bestCount = continentGameCount(best);
  for (const c of continents) {
    const n = continentGameCount(c);
    if (n > bestCount || (n === bestCount && c.id < best.id)) {
      best = c;
      bestCount = n;
    }
  }
  return best;
}

/** Integer-scale + center a panel to `frac` of the smaller RECT dimension.
 *  Mirrors mountDistrict/mountStubLevel's fit(). Phase 7-B: fits to the pane
 *  rect (local origin), not the full screen. */
function makeFit(
  container: Container,
  panel: BitmapText,
  frac: number,
): (rect: PixelRect) => void {
  return (rect: PixelRect) => {
    const desired = Math.min(rect.pw, rect.ph) * frac;
    const scale = Math.max(1, Math.floor(desired / Math.max(1, panel.height)));
    container.scale.set(scale);
    container.x = Math.floor((rect.pw - panel.width * scale) / 2);
    container.y = Math.floor((rect.ph - panel.height * scale) / 2);
  };
}

/** Minimal "nothing to show" panel, mirroring mountStubLevel's frame. */
function emptyPanel(theme: Theme, level: string, note: string): BitmapText {
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
