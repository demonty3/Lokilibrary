/**
 * Pure per-rung panel composition for the scale ladder (ladder identity
 * pass, spec 2026-07-17). Builds each rung's character panel as a
 * TintCanvas — gold frames, warm engagement ramp, being letters, and a
 * YOU marker COMPOSED into the home card's border (never overlaid; the
 * overstrike bug can't come back) — with home following the pane's bound
 * wing (`LadderIdentity.homeWingId`) and beings placed per the live
 * presence map.
 *
 * NO pixi imports: the smoke pins every rung headlessly. The level
 * renderers (district/island/continent) are thin PIXI shells over this.
 *
 * Determinism: same (games, seed, identity) → byte-identical layer map.
 */

import type { TintCanvas } from './tintPanel';
import { createCanvas, stamp, stampLines } from './tintPanel';
import type { ClusterGame, Continent, District } from '../../procedural/clusters';
import {
  activityGlyphFor,
  aggregateActivity,
  blobCells,
  clusterLibrary,
  continentGameCount,
  districtLabel,
  findContinentOf,
  flattenDistricts,
  flattenIslands,
  homeDistrictId,
  islandGameCount,
  layoutClusterPositions,
  truncateLabel,
  LAYOUT_SALT,
} from '../../procedural/clusters';
import { COHORT } from '../../agents/cohort';

/** Card + map geometry — unchanged from the pre-identity renderers. */
export const CARD_W = 11;
export const CARD_H = 5;
export const HEADER_ROWS = 2; // header line + blank line before the grid
export const CELL_BLOCK = 14; // continent block (radius-6 blob + label budget)

const LEGEND_CARDS = '[ zooms out · ] zooms in   ▓ loved · ▒ engaged · ░ tried · · dusty';
const LEGEND_SEA = '[ zooms out · ] zooms in   ▓ core · ▒ engaged · · sea';

/** Being id → its cell-sprite letter (the SAME letters the room renders,
 *  so the map and the world speak one glyph vocabulary). */
export const AGENT_LETTERS: ReadonlyMap<string, string> = new Map(
  COHORT.map((d) => [d.id, d.glyph]),
);

export interface LadderIdentity {
  /** The pane's bound wing (raw regionId). Unresolvable/absent → canonical
   *  home, and the header omits the wing segment. */
  homeWingId?: string;
  /** district id → agent ids present (from presenceByDistrict). */
  presence?: ReadonlyMap<string, readonly string[]>;
}

export interface ComposedPanel {
  canvas: TintCanvas;
  cols: number;
  rows: number;
}

export interface ContinentLabelSpec {
  text: string;
  /** Grid-local start column (already centred on the blob + clamped). */
  startCol: number;
  /** Grid-local row (the renderer adds HEADER_ROWS). */
  row: number;
  home: boolean;
}

// ---------- shared card stamping ----------

interface CardSlot {
  label: string;
  count: number;
  glyph: string;
  home: boolean;
  /** agent ids present in this district (letters, in id order) */
  agentIds: readonly string[];
}

/** Stamp one CARD_W×CARD_H card. Home cards write their frame/name/count
 *  into the 'home' layer with YOU composed into the top border; being
 *  letters always keep their own 'being.<id>' layers (beings outrank
 *  home-brightness); the ramp stays 'ramp' on every card so engagement
 *  reads uniformly across the grid. */
function stampCard(c: TintCanvas, ox: number, oy: number, slot: CardSlot): void {
  const inner = CARD_W - 2;
  const frame = slot.home ? 'home' : 'frame';
  const top = slot.home
    ? '┌─ YOU ' + '─'.repeat(inner - 6) + '┐'
    : '┌' + '─'.repeat(inner) + '┐';
  stamp(c, ox, oy, top, frame);
  stamp(c, ox, oy + 4, '└' + '─'.repeat(inner) + '┘', frame);
  for (const r of [1, 2, 3]) {
    stamp(c, ox, oy + r, '│', frame);
    stamp(c, ox + CARD_W - 1, oy + r, '│', frame);
  }
  stamp(c, ox + 1, oy + 1, pad(truncateLabel(slot.label, inner), inner), slot.home ? 'home' : 'name');
  const countText = `${slot.count} game${slot.count === 1 ? '' : 's'}`;
  stamp(c, ox + 1, oy + 2, center(truncateLabel(countText, inner), inner), slot.home ? 'home' : 'dim');

  // Fill row: being letters (left segment, one layer per being), a one-cell
  // gap, then the activity ramp, dot-padded. Letters cap at inner-2 so at
  // least one ramp glyph always fits.
  const letters = slot.agentIds
    .map((id) => ({ id, glyph: AGENT_LETTERS.get(id) }))
    .filter((l): l is { id: string; glyph: string } => l.glyph !== undefined)
    .slice(0, inner - 2);
  for (let i = 0; i < letters.length; i++) {
    stamp(c, ox + 1 + i, oy + 3, letters[i].glyph, `being.${letters[i].id}`);
  }
  const rampStart = letters.length > 0 ? letters.length + 1 : 0;
  const rampBudget = inner - rampStart;
  const fillLen = Math.max(1, Math.min(rampBudget, slot.count));
  stamp(c, ox + 1 + rampStart, oy + 3, slot.glyph.repeat(fillLen), 'ramp');
  const dots = rampBudget - fillLen;
  if (dots > 0) stamp(c, ox + 1 + rampStart + fillLen, oy + 3, '·'.repeat(dots), 'dim');
}

/** The dotted "nothing built here yet" terrain card (empty slots). */
function stampEmptyCard(c: TintCanvas, ox: number, oy: number): void {
  stamp(c, ox, oy, '·'.repeat(CARD_W), 'dim');
  stamp(c, ox, oy + 4, '·'.repeat(CARD_W), 'dim');
  for (const r of [1, 2, 3]) {
    stamp(c, ox, oy + r, '·', 'dim');
    stamp(c, ox + CARD_W - 1, oy + r, '·', 'dim');
  }
}

// ---------- district ----------

export function composeDistrictPanel(
  games: readonly ClusterGame[],
  seed: number,
  identity?: LadderIdentity,
): ComposedPanel {
  const tree = clusterLibrary(games, seed);
  const districts = flattenDistricts(tree);
  const homeId = homeDistrictId(tree, identity?.homeWingId);
  const home = districts.find((d) => d.id === homeId) ?? null;
  const neighbours = districts.filter((d) => d.id !== homeId);
  const bound = identity?.homeWingId !== undefined && homeId === identity.homeWingId;

  const slots: Array<District | null> = [];
  let ni = 0;
  for (let i = 0; i < 9; i++) {
    if (i === 4) {
      slots.push(home);
      continue;
    }
    slots.push(ni < neighbours.length ? neighbours[ni++] : null);
  }

  const gridW = 3 * CARD_W;
  const gridH = 3 * CARD_H;
  const wingSeg = bound ? `wing ${homeId} · ` : '';
  const header =
    `district · ${wingSeg}${districts.length} neighbourhood${districts.length === 1 ? '' : 's'} · ${tree.gameCount} games`;
  const cols = Math.max(gridW, header.length, LEGEND_CARDS.length);
  const rows = HEADER_ROWS + gridH + 2;
  const canvas = createCanvas(cols, rows, 'dim');
  stamp(canvas, 0, 0, header, 'name');
  stamp(canvas, 0, rows - 1, LEGEND_CARDS, 'dim');

  for (let i = 0; i < 9; i++) {
    const ox = (i % 3) * CARD_W;
    const oy = HEADER_ROWS + Math.floor(i / 3) * CARD_H;
    const d = slots[i];
    if (!d) {
      stampEmptyCard(canvas, ox, oy);
      continue;
    }
    stampCard(canvas, ox, oy, {
      label: districtLabel(d),
      count: d.games.length,
      glyph: activityGlyphFor(d.activity),
      home: d.id === homeId,
      agentIds: identity?.presence?.get(d.id) ?? [],
    });
  }
  return { canvas, cols, rows };
}

// ---------- island ----------

/** Largest continent by game count, lexical-id tiebreak. Null when empty.
 *  (Moved here from island.ts — composition owns continent picking now.) */
export function pickPrimaryContinent(continents: readonly Continent[]): Continent | null {
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

export function composeIslandPanel(
  games: readonly ClusterGame[],
  seed: number,
  identity?: LadderIdentity,
): ComposedPanel {
  const tree = clusterLibrary(games, seed);
  const homeId = homeDistrictId(tree, identity?.homeWingId);
  const continent =
    (homeId ? findContinentOf(tree, homeId) : null) ?? pickPrimaryContinent(tree.continents);
  if (!continent) return emptyPanel('island');

  const districts = continent.islands.flatMap((i) => i.districts);
  const homeInContinent = districts.some((d) => d.id === homeId)
    ? homeId
    : districts.length > 0
      ? districts[0].id
      : null;

  const gridCols = Math.max(1, Math.ceil(Math.sqrt(districts.length)));
  const positions = layoutClusterPositions(
    districts.map((d) => d.id),
    seed,
    LAYOUT_SALT,
    gridCols,
  );
  const maxRow = positions.reduce((m, p) => Math.max(m, p.y), 0);
  const gridW = gridCols * CARD_W;
  const gridH = (maxRow + 1) * CARD_H;

  const header =
    `island · ${continent.id} · ${districts.length} neighbourhood${districts.length === 1 ? '' : 's'}`;
  const cols = Math.max(gridW, header.length, LEGEND_CARDS.length);
  const rows = HEADER_ROWS + gridH + 2;
  const canvas = createCanvas(cols, rows, 'dim');
  stamp(canvas, 0, 0, header, 'name');
  stamp(canvas, 0, rows - 1, LEGEND_CARDS, 'dim');

  for (let k = 0; k < districts.length; k++) {
    const d = districts[k];
    const pos = positions[k];
    stampCard(canvas, pos.x * CARD_W, HEADER_ROWS + pos.y * CARD_H, {
      label: districtLabel(d),
      count: d.games.length,
      glyph: activityGlyphFor(d.activity),
      home: d.id === homeInContinent,
      agentIds: identity?.presence?.get(d.id) ?? [],
    });
  }
  return { canvas, cols, rows };
}

// ---------- continent ----------

/** A continent's display name: its largest island's representative game, or
 *  the continent id. (Moved here from continent.ts.) */
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

export function composeContinentPanel(
  games: readonly ClusterGame[],
  seed: number,
  identity?: LadderIdentity,
): { panel: ComposedPanel; labels: ContinentLabelSpec[] } {
  const tree = clusterLibrary(games, seed);
  if (tree.continents.length === 0) return { panel: emptyPanel('continent'), labels: [] };

  const homeId = homeDistrictId(tree, identity?.homeWingId);
  const homeContinentId =
    (homeId ? findContinentOf(tree, homeId)?.id : undefined) ?? tree.continents[0].id;

  const continents = tree.continents;
  const gridCols = Math.max(1, Math.ceil(Math.sqrt(continents.length)));
  const positions = layoutClusterPositions(
    continents.map((c) => c.id),
    seed,
    LAYOUT_SALT,
    gridCols,
  );
  const maxRow = positions.reduce((m, p) => Math.max(m, p.y), 0);
  const canvasW = gridCols * CELL_BLOCK;
  const canvasH = (maxRow + 1) * CELL_BLOCK;

  const header =
    `continent · ${continents.length} land-mass${continents.length === 1 ? '' : 'es'} · ${tree.gameCount} games`;
  const cols = Math.max(canvasW, header.length, LEGEND_SEA.length);
  const rows = HEADER_ROWS + canvasH + 2;
  const canvas = createCanvas(cols, rows, 'dim');
  stamp(canvas, 0, 0, header, 'name');
  stamp(canvas, 0, rows - 1, LEGEND_SEA, 'dim');

  // Sea: the dot field under everything (dim). Land: the blob cells in the
  // ramp layer — the GLYPH still encodes aggregate activity, the layer
  // carries the gold-land tint.
  for (let y = 0; y < canvasH; y++) stamp(canvas, 0, HEADER_ROWS + y, '·'.repeat(canvasW), 'dim');

  const labels: ContinentLabelSpec[] = [];
  for (let k = 0; k < continents.length; k++) {
    const c = continents[k];
    const pos = positions[k];
    const cx = pos.x * CELL_BLOCK + Math.floor(CELL_BLOCK / 2);
    const cy = pos.y * CELL_BLOCK + Math.floor(CELL_BLOCK / 2);
    const area = continentGameCount(c);
    const fillGlyph = activityGlyphFor(aggregateActivity(c.islands.flatMap((i) => i.districts)));
    for (const cell of blobCells(cx, cy, area, canvasW, canvasH, seed, LAYOUT_SALT)) {
      stamp(canvas, cell.x, HEADER_ROWS + cell.y, fillGlyph, 'ramp');
    }
    const home = c.id === homeContinentId;
    const text = truncateLabel(
      `${home ? 'YOU · ' : ''}${continentName(c)} ${area}g/${c.islands.length}i`,
      CELL_BLOCK,
    );
    labels.push({
      text,
      startCol: clampInt(cx - Math.floor(text.length / 2), 0, Math.max(0, canvasW - text.length)),
      row: cy + 1,
      home,
    });
  }
  return { panel: { canvas, cols, rows }, labels };
}

// ---------- empty panel + string helpers ----------

/** The double-framed "no library loaded yet." panel (island/continent),
 *  entirely in the dim layer — byte-identical text to the pre-identity
 *  emptyPanel. */
function emptyPanel(level: string): ComposedPanel {
  const lines = [
    '╔════════════════════════════════════════╗',
    '║                                        ║',
    `║   ${pad(level, 36)}║`,
    '║                                        ║',
    `║   ${pad('no library loaded yet.', 36)}║`,
    '║                                        ║',
    '║   [ zooms out · ] zooms in             ║',
    '║                                        ║',
    '╚════════════════════════════════════════╝',
  ];
  const canvas = createCanvas(lines[0].length, lines.length, 'dim');
  stampLines(canvas, 0, 0, lines, 'dim');
  return { canvas, cols: lines[0].length, rows: lines.length };
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

function clampInt(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
