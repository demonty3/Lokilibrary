/**
 * Probe generator — height-elastic sky (2026-08-21).
 *
 * Three panels at the measured work area (1440x811), all from the REAL
 * composer and the REAL render rules (composeLand / composeLandExtension /
 * strataMaterialGlyph / landRoleFill / skyInkOf) — no hand-drawing.
 *
 *   A  today, full-screen      120x31 @ 12x26 px  (20 world rows + 11 rock)
 *   B  height-elastic sky      120x31 @ 12x26 px  (all 31 rows world)
 *   C  full-screen at scale 1  240x62 @  6x13 px  (all 62 rows world)
 *
 * Bars: docs/design-reviews/2026-08-21-height-elastic-sky.md §3 (frozen first).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { composeLand, composeLandExtension, DESK_SURFACE, SAMPLE_LAND, type LandGame, type LandModel } from '../src/procedural/land.ts';
import { landRoleFill, landRoleGlyph, skyInkOf, strataMaterialGlyph } from '../src/render/levels/land.ts';
import { THEMES } from '../src/themes/index.ts';
import { COHORT } from '../src/agents/cohort.ts';

/** FNV-1a 32-bit — the wing→seed hash, copied verbatim from
 *  terminalLand.ts:651 so the probe seeds the same land the desk does. */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const theme = THEMES['phosphor'];
const WING = 'd0';
const seed = fnv1a(`terminal:${WING}`);
const rot = fnv1a(WING) % SAMPLE_LAND.length;
const games: LandGame[] = Array.from({ length: 5 }, (_, i) => SAMPLE_LAND[(rot + i) % SAMPLE_LAND.length]);

/** The desk's own hour-0 sky ink (midnight = the pack's bg, the register both
 *  reference artworks sit in). */
const DAY = 0;
const skyInk = skyInkOf(theme, DAY);

/** Band proportions read off DESK_SURFACE (sky 55%, band 20%) so a taller
 *  aperture is "more of the same world" rather than a re-proportioned one. */
function bands(rows: number): { skyH: number; surfaceBand: number; underH: number } {
  const skyH = Math.round(rows * (DESK_SURFACE.skyH / DESK_SURFACE.rows));
  const surfaceBand = Math.round(rows * (DESK_SURFACE.surfaceBand / DESK_SURFACE.rows));
  return { skyH, surfaceBand, underH: rows - 1 - skyH - surfaceBand };
}

function composeAt(cols: number, rows: number, elastic: boolean): LandModel {
  if (elastic) {
    const b = bands(rows);
    return composeLand(seed, games, { width: cols, ...b, withPlayer: false, mural: false });
  }
  // Today's path, verbatim: canonical 20 rows + aperture-rock extension.
  const m = composeLand(seed, games, {
    width: cols,
    skyH: DESK_SURFACE.skyH,
    surfaceBand: DESK_SURFACE.surfaceBand,
    underH: DESK_SURFACE.underH,
    withPlayer: false,
    mural: false,
  });
  const extraRows = rows - DESK_SURFACE.rows;
  if (extraRows <= 0) return m;
  const ext = composeLandExtension(seed, games, { width: cols, extraRows });
  return { ...m, height: m.height + extraRows, char: [...m.char, ...ext.char], role: [...m.role, ...ext.role] };
}

/** Per-cell glyph + fill, exactly as buildLandContainer resolves them for a
 *  pack with no landGlyphs / landRamp / landOmit and no shade grid. */
function cellOf(model: LandModel, x: number, y: number): { ch: string; fill: number } | null {
  const role = model.role[y][x];
  if (role === 'sky') return null;
  const dialect = landRoleGlyph(theme, role);
  const ch = dialect ?? strataMaterialGlyph(role, x, y) ?? model.char[y][x];
  if (!ch || ch === ' ') return null;
  return { ch, fill: landRoleFill(theme, role, undefined, skyInk) };
}

/** Beings, drawn the way addBeing does: the cohort def's glyph in the def's
 *  palette accent, standing at `surface[col] - 1`. K1 is judged on these. */
function overlayBeings(model: LandModel, grid: ({ ch: string; fill: number } | null)[][]): void {
  const n = COHORT.length;
  for (let i = 0; i < n; i++) {
    const def = COHORT[i];
    const col = Math.floor(((i + 0.5) / n) * model.width);
    const row = (model.surface[col] ?? 0) - 1;
    if (row < 0 || row >= model.height) continue;
    grid[row][col] = { ch: def.glyph, fill: hexToInt(theme.palette[def.paletteKey]) };
  }
}

const hexToInt = (h: string): number => parseInt(h.replace('#', ''), 16);

const esc = (s: string) => s.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;');
const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

/** Emit the panel as run-length spans keyed to a shared colour table. */
function renderPanel(model: LandModel, keys: Map<number, string>): string {
  const grid: ({ ch: string; fill: number } | null)[][] = Array.from({ length: model.height }, (_, y) =>
    Array.from({ length: model.width }, (_, x) => cellOf(model, x, y)),
  );
  overlayBeings(model, grid);
  const lines: string[] = [];
  for (let y = 0; y < model.height; y++) {
    let out = '';
    let run = '';
    let runFill = -1;
    const flush = () => {
      if (!run) return;
      if (runFill < 0) out += esc(run);
      else out += `<span class="${keys.get(runFill)}">${esc(run)}</span>`;
      run = '';
    };
    for (let x = 0; x < model.width; x++) {
      const c = grid[y][x];
      const f = c ? c.fill : -1;
      if (f !== runFill) { flush(); runFill = f; }
      if (f >= 0 && !keys.has(f)) keys.set(f, `k${keys.size}`);
      run += c ? c.ch : ' ';
    }
    flush();
    lines.push(out.replace(/\s+$/u, ''));
  }
  return lines.join('\n');
}

const W = 1440;
const H = 811;
const panels = [
  { id: 'A', title: 'A · Today, full-screen', cols: Math.floor(W / 12), rows: Math.floor(H / 26), px: 26, elastic: false },
  { id: 'B', title: 'B · Height-elastic sky', cols: Math.floor(W / 12), rows: Math.floor(H / 26), px: 26, elastic: true },
  { id: 'C', title: 'C · Full-screen at scale 1', cols: Math.floor(W / 6), rows: Math.floor(H / 13), px: 13, elastic: true },
];

const keys = new Map<number, string>();
const bodies = panels.map((p) => {
  const model = composeAt(p.cols, p.rows, p.elastic);
  const b = p.elastic ? bands(p.rows) : { skyH: DESK_SURFACE.skyH, surfaceBand: DESK_SURFACE.surfaceBand, underH: DESK_SURFACE.underH };
  return { ...p, body: renderPanel(model, keys), b, cells: p.cols * p.rows, height: model.height };
});

const woff2 = readFileSync('public/fonts/CozetteVector.woff2').toString('base64');
const css = [...keys.entries()].map(([fill, k]) => `.${k}{color:${hex(fill)}}`).join('');

const note = (p: (typeof bodies)[number]) =>
  p.id === 'A'
    ? `${p.cols}×${p.rows} = ${p.cells.toLocaleString()} cells at 12×26 px · <b>20 rows of world, ${p.rows - DESK_SURFACE.rows} rows of bare aperture rock</b> · the honest status quo`
    : p.id === 'B'
      ? `${p.cols}×${p.rows} = ${p.cells.toLocaleString()} cells at 12×26 px · all ${p.rows} rows composed as world (skyH ${p.b.skyH}, band ${p.b.surfaceBand}, underH ${p.b.underH}) · <b>same glyph size as A</b>`
      : `${p.cols}×${p.rows} = ${p.cells.toLocaleString()} cells at 6×13 px · skyH ${p.b.skyH}, band ${p.b.surfaceBand}, underH ${p.b.underH} · <b>the density ceiling — the 08-17 question re-asked full-screen</b>`;

const html = `<meta charset="utf-8">
<title>Height-elastic sky · three lattices</title>
<style>@font-face{font-family:'Cozette';src:url(data:font/woff2;base64,${woff2}) format('woff2')}
*{margin:0;padding:0;box-sizing:border-box}
body{background:#26282b;color:#c9ccd1;font:14px/1.5 -apple-system,system-ui,sans-serif;padding:48px 0 96px}
main{width:max-content;margin:0 auto}
h1{font-size:18px;font-weight:600;margin-bottom:4px}
.sub{color:#7c8187;margin-bottom:28px;max-width:${W}px}
h2{font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#7c8187;margin:40px 0 8px}
pre.term{font-family:'Cozette',ui-monospace,Menlo,monospace;letter-spacing:0;background:${theme.palette.bg};width:${W}px;overflow:hidden}
.cap{color:#7c8187;font-size:12.5px;max-width:${W}px;margin-top:10px}
${css}</style>
<main>
<h1>Height-elastic sky — the same wing, three lattices</h1>
<p class="sub">Wing d0, phosphor, one seed, midnight. Composed by the real composer with the real
render rules — every glyph and every colour below is engine output. All three panels are the
measured work area, 1440×811. Judge at <b>wallpaper distance</b> against §3 of
<b>2026-08-21-height-elastic-sky.md</b>: K1 — can you still find and read the beings and site
labels at a glance? K2 — does it read as a richer PLACE or collapse into texture? K3 — does B's
taller sky read as MORE WORLD or as a bigger void? K4 — detailed, or merely busy?</p>
${bodies.map((p) => `<h2>${p.title}</h2><pre class="term" style="font-size:${p.px}px;line-height:${p.px}px">${p.body}</pre><p class="cap">${note(p)}</p>`).join('\n')}
</main>
`;

writeFileSync('docs/design-reviews/2026-08-21-height-elastic-sky.html', html);
console.log(
  bodies.map((p) => `${p.id}: ${p.cols}x${p.rows} (${p.cells} cells), model.height=${p.height}, bands=${JSON.stringify(p.b)}`).join('\n'),
);
console.log(`colours: ${keys.size}`);
