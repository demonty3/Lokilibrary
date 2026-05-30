import { BitmapText, Container } from 'pixi.js';
import type { Theme } from '../../themes/types';
import type { ClusterGame } from '../../procedural/clusters';
import type { PixelRect } from '../PixiApp';
import {
  activityGlyphFor,
  clusterLibrary,
  districtLabel,
  flattenDistricts,
  truncateLabel,
} from '../../procedural/clusters';
import {
  COZETTE_FONT_FAMILY,
  COZETTE_FONT_SIZE,
  hexToInt,
} from '../fonts';

/**
 * District-level renderer (Phase 7-A — upgraded from the static 3×3
 * placeholder). Renders the player's HOME district (the canonical first
 * district, d0 — the most-played game's bucket; there is no persistent
 * player-district state yet) as the centre card surrounded by up to eight
 * REAL neighbour districts derived from the clustering layer. Each card
 * shows the district's representative game name, its game count, and an
 * activity glyph (▓ loved · ▒ engaged · ░ tried · · dusty). The centre card
 * is the YOU card (bright tint + YOU marker).
 *
 * Read-only beyond the `[` / `]` zoom transitions owned by App.tsx; this
 * view adds no ticker and no keydown listener. Layout is precomputed by pure
 * helpers (clusterLibrary) and painted once at mount + on resize, so it
 * renders correctly under the `paused`/`sleeping` throttle.
 *
 * Glyph vocabulary + palette shared with cell/island/continent (box-drawing
 * frames `fg`, shade-ramp activity glyphs, the floor dot for empty cells) —
 * one recoloured alphabet across rungs, ONE palette per scene.
 *
 * Teardown: destroy the per-level Container. NEVER app.destroy() — the
 * Application is owned by mountPalace.
 *
 * Phase 7-B — pane-scoped: adds its Container to the supplied `parent` (a
 * per-pane root, NOT app.stage) and fits within `rect` (pixel rect in the
 * parent's LOCAL space) instead of the full screen. PixiApp drives resize via
 * the returned `refit`. Single full-grid pane ⇒ rect === full screen ⇒
 * identical to the pre-7-B path.
 */
export function mountDistrict(
  parent: Container,
  rect: PixelRect,
  theme: Theme,
  games: readonly ClusterGame[],
  seed: number,
): { teardown: () => void; refit: (rect: PixelRect) => void } {
  const container = new Container();
  parent.addChild(container);

  const tree = clusterLibrary(games, seed);
  const districts = flattenDistricts(tree);

  // Home district = the canonical first (d0). Its eight neighbours are the
  // next districts in canonical order, wrapping around so the 3×3 is always
  // full when there are >1 districts. With a single district, the neighbour
  // slots read as empty (the floor dot) — conceptually "nothing built there
  // yet" but data-driven, not a hard-coded stub.
  const home = districts.length > 0 ? districts[0] : null;
  const neighbours = districts.slice(1); // everything but home

  // Build the 3×3 of mini-cards. Centre (index 4) is home; the other slots
  // are filled from `neighbours` in canonical order, then padded with empty
  // cards. Empty cards render as the floor-dot terrain.
  const slots: Array<{ label: string; count: number; glyph: string; home: boolean } | null> =
    [];
  let ni = 0;
  for (let i = 0; i < 9; i++) {
    if (i === 4) {
      slots.push(
        home
          ? {
              label: districtLabel(home),
              count: home.games.length,
              glyph: activityGlyphFor(home.activity),
              home: true,
            }
          : null,
      );
      continue;
    }
    if (ni < neighbours.length) {
      const d = neighbours[ni++];
      slots.push({
        label: districtLabel(d),
        count: d.games.length,
        glyph: activityGlyphFor(d.activity),
        home: false,
      });
    } else {
      slots.push(null);
    }
  }

  // Compose the 3×3 grid into one character grid → one BitmapText panel.
  // Each card is CARD_W × CARD_H glyphs.
  const canvasW = 3 * CARD_W;
  const canvasH = 3 * CARD_H;
  const grid: string[][] = Array.from({ length: canvasH }, () =>
    Array.from({ length: canvasW }, () => ' '),
  );
  let homeOx = 0;
  let homeOy = 0;
  for (let i = 0; i < 9; i++) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const ox = col * CARD_W;
    const oy = row * CARD_H;
    const card = renderDistrictCard(slots[i]);
    for (let r = 0; r < CARD_H; r++) {
      for (let c = 0; c < CARD_W; c++) {
        grid[oy + r][ox + c] = card[r][c];
      }
    }
    if (i === 4) {
      homeOx = ox;
      homeOy = oy;
    }
  }

  const text = grid.map((r) => r.join('')).join('\n');
  const header = `district · ${districts.length} neighbourhood${districts.length === 1 ? '' : 's'} · ${tree.gameCount} games`;
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

  const youHighlight = new BitmapText({
    text: 'YOU',
    style: {
      fontFamily: COZETTE_FONT_FAMILY,
      fontSize: COZETTE_FONT_SIZE,
      fill: hexToInt(theme.palette.fgBright),
    },
  });
  if (home) container.addChild(youHighlight);

  const fit = (r: PixelRect) => {
    const desired = Math.min(r.pw, r.ph) * 0.55;
    const scale = Math.max(1, Math.floor(desired / Math.max(1, panel.height)));
    container.scale.set(scale);
    container.x = Math.floor((r.pw - panel.width * scale) / 2);
    container.y = Math.floor((r.ph - panel.height * scale) / 2);
    if (home) {
      // YOU marker just inside the home card's top border. +HEADER_ROWS for
      // the header + blank line preceding the card grid. The marker is a
      // CHILD of `container`, so it lives in the container's LOCAL glyph
      // space — the parent already applies `container.x/y` + `container.scale`.
      // (Earlier code added `container.x` + multiplied by `scale` here too,
      // which double-applied both the centering offset and the scale and
      // flung the marker off-screen.)
      const gx = (homeOx + 1) * GLYPH_W;
      const gy = (homeOy + 1 + HEADER_ROWS) * GLYPH_H;
      youHighlight.x = gx;
      youHighlight.y = gy;
    }
  };
  fit(rect);

  return {
    refit: fit,
    teardown: () => {
      container.destroy({ children: true });
    },
  };
}

const CARD_W = 11;
const CARD_H = 5;
const HEADER_ROWS = 2;
const GLYPH_W = 6;
const GLYPH_H = 13;

/** Render one district mini-card, or an empty terrain card when null. Pure:
 *  same input → same lines. */
function renderDistrictCard(
  slot: { label: string; count: number; glyph: string; home: boolean } | null,
): string[] {
  const inner = CARD_W - 2;
  if (!slot) {
    // Empty neighbour: a dotted terrain card (no border) so the eye reads
    // "nothing here yet" without a hard "not built" stub.
    const dotRow = ' '.repeat(inner);
    const dots = '·'.repeat(inner);
    return [
      `·${dots}·`.slice(0, CARD_W),
      `·${dotRow}·`.slice(0, CARD_W),
      `·${dotRow}·`.slice(0, CARD_W),
      `·${dotRow}·`.slice(0, CARD_W),
      `·${dots}·`.slice(0, CARD_W),
    ];
  }
  const top = '┌' + '─'.repeat(inner) + '┐';
  const bottom = '└' + '─'.repeat(inner) + '┘';
  const name = pad(truncateLabel(slot.label, inner), inner);
  const countText = `${slot.count} game${slot.count === 1 ? '' : 's'}`;
  const countLine = center(truncateLabel(countText, inner), inner);
  const fillLen = Math.max(1, Math.min(inner, slot.count));
  const fill = pad(slot.glyph.repeat(fillLen), inner, '·');
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
