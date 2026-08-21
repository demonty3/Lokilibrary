/**
 * Probe — "double the grid, same scene drawn finer" (2026-08-21).
 *
 * Runs the unpark check frozen in IDEAS.md § The detail thread, written before
 * any render: hold feature size constant on screen and spend the extra cells on
 * the feature's own edge, rather than composing more world.
 *
 * Three panels at the SAME physical size (1440 x 806 px), same wing, same seed:
 *   A  today            120x31 cells @ 12x26 px   — the shipped lattice
 *   B  2x, no new rules 240x62 cells @  6x13 px   — CONTROL: pure upscale
 *   C  2x, scale-aware  240x62 cells @  6x13 px   — the candidate
 *
 * B exists so the variable is isolated. A vs B asks "does the grid alone buy
 * anything?"; B vs C asks "does a finer RULE buy anything?".
 *
 * Emits docs/design-reviews/2026-08-21-scale-aware.html.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { composeLand, DESK_SURFACE, SAMPLE_LAND, type LandGame, type LandModel, type LandRole } from '../src/procedural/land.ts';
import { landRoleFill, landRoleGlyph, skyInkOf, strataMaterialGlyph } from '../src/render/levels/land.ts';
import { THEMES } from '../src/themes/index.ts';
import { COHORT } from '../src/agents/cohort.ts';

const theme = THEMES['phosphor'];
const P = (k: keyof typeof theme.palette): number => parseInt(theme.palette[k].replace('#', ''), 16);
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
/** Small deterministic hash for sub-cell placement — no PRNG stream, so the
 *  candidate is a pure function of the source cell. */
const hash2 = (x: number, y: number, salt: number): number => {
  let h = (0x811c9dc5 ^ salt) >>> 0;
  h = Math.imul(h ^ x, 0x01000193) >>> 0;
  h = Math.imul(h ^ y, 0x01000193) >>> 0;
  return (h ^ (h >>> 15)) >>> 0;
};

const WING = 'd0';
const seed = fnv1a(`terminal:${WING}`);
const rot = fnv1a(WING) % SAMPLE_LAND.length;
const games: LandGame[] = Array.from({ length: 5 }, (_, i) => SAMPLE_LAND[(rot + i) % SAMPLE_LAND.length]);

const COLS = 120;
const ROWS = 31;
const skyInk = skyInkOf(theme, 0);
const skyH = Math.round(ROWS * (DESK_SURFACE.skyH / DESK_SURFACE.rows));
const surfaceBand = Math.round(ROWS * (DESK_SURFACE.surfaceBand / DESK_SURFACE.rows));
const underH = ROWS - 1 - skyH - surfaceBand;

const M: LandModel = composeLand(seed, games, {
  width: COLS, skyH, surfaceBand, underH, withPlayer: false, mural: false,
});

type Cell = { ch: string; fill: number } | null;
type Grid = Cell[][];

/** How a character upscales onto a 2x lattice.
 *
 *  This is per-CHARACTER, not per-role, because that is what the medium
 *  actually allows. A full-cell fill tiles into all four sub-cells and holds
 *  its size exactly. A half or quadrant block already encodes a sub-cell edge,
 *  so it expands EXACTLY into full blocks — no information is invented and none
 *  is lost. Anything else is a drawn glyph (a letter, a cottage, a star, a
 *  being) and cannot be tiled at all: it is drawn once, at half the size.
 *
 *  Returns a 2x2 array of chars (null = empty), or null for "this is a glyph".
 */
const FILL = ['█', '░', '▒', '▓'];
function expand(ch: string): (string | null)[][] | null {
  if (FILL.includes(ch)) return [[ch, ch], [ch, ch]];
  switch (ch) {
    case '▀': return [['█', '█'], [null, null]];
    case '▄': return [[null, null], ['█', '█']];
    case '▌': return [['█', null], ['█', null]];
    case '▐': return [[null, '█'], [null, '█']];
    case '▖': return [[null, null], ['█', null]];
    case '▗': return [[null, null], [null, '█']];
    case '▘': return [['█', null], [null, null]];
    case '▝': return [[null, '█'], [null, null]];
    case '▙': return [['█', null], ['█', '█']];
    case '▛': return [['█', '█'], ['█', null]];
    case '▜': return [['█', '█'], [null, '█']];
    case '▟': return [[null, '█'], ['█', '█']];
    case '▚': return [['█', null], [null, '█']];
    case '▞': return [[null, '█'], ['█', null]];
    case '▔': return [['▀', '▀'], [null, null]];
    case '▁': return [[null, null], ['▄', '▄']];
    case '─': return [[null, null], ['─', '─']];
    default: return null; // a drawn glyph
  }
}

const STRATA = new Set<LandRole>(['topsoil', 'stone', 'bedrock', 'deep', 'cavern']);

/** The two material glyphs a strata role alternates between, recovered by
 *  sampling the shipped run-coherent picker rather than re-declaring them. */
function materialPair(role: LandRole): string[] {
  const seen = new Set<string>();
  for (let x = 0; x < 400; x++) {
    for (let y = 0; y < 8; y++) {
      const g = strataMaterialGlyph(role, x, y);
      if (g) seen.add(g);
    }
  }
  return [...seen];
}
const PAIRS = new Map<LandRole, string[]>([...STRATA].map((r) => [r, materialPair(r)]));

function glyphOf(role: LandRole, x: number, y: number): string | null {
  const dialect = landRoleGlyph(theme, role);
  const ch = dialect ?? strataMaterialGlyph(role, x, y) ?? M.char[y][x];
  return !ch || ch === ' ' ? null : ch;
}
const fillOf = (role: LandRole): number => landRoleFill(theme, role, undefined, skyInk);

/** Beings, stamped the way addBeing draws them. Returned as source-cell coords
 *  so each panel can place them in its own lattice. */
const beings = COHORT.map((def, i) => {
  const col = Math.floor(((i + 0.5) / COHORT.length) * COLS);
  return { col, row: (M.surface[col] ?? 0) - 1, ch: def.glyph, fill: P(def.paletteKey as keyof typeof theme.palette) };
});

/** Text cannot be tiled and cannot be letter-spaced: a label run is re-laid
 *  contiguously at the finer cell, which means it occupies HALF the screen
 *  width it does today. That size loss is the finding, not a mock artefact. */
function drawLabels2x(g: Grid): void {
  const fill = fillOf('label');
  for (let y = 0; y < ROWS; y++) {
    let x = 0;
    while (x < COLS) {
      if (M.role[y][x] !== 'label') { x++; continue; }
      let end = x;
      while (end < COLS && M.role[y][end] === 'label') end++;
      const text = M.char[y].slice(x, end).join('');
      for (let i = 0; i < text.length; i++) {
        const tx = x * 2 + i;
        if (tx < COLS * 2 && text[i] !== ' ') g[y * 2][tx] = { ch: text[i], fill };
      }
      x = end;
    }
  }
}

// ── A · today ───────────────────────────────────────────────────────────────
function panelA(): Grid {
  const g: Grid = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => null as Cell));
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++) {
      const role = M.role[y][x];
      if (role === 'sky') continue;
      const ch = glyphOf(role, x, y);
      if (ch) g[y][x] = { ch, fill: fillOf(role) };
    }
  for (const b of beings) if (b.row >= 0) g[b.row][b.col] = { ch: b.ch, fill: b.fill };
  return g;
}

// ── B · 2x, no new rules (CONTROL) ──────────────────────────────────────────
// Block matter tiles into its 2x2 block, holding screen size. Glyph matter is
// drawn once at the finer cell, because a glyph cannot be tiled — that is not a
// modelling shortcut, it is the medium.
function panelB(): Grid {
  const W2 = COLS * 2;
  const H2 = ROWS * 2;
  const g: Grid = Array.from({ length: H2 }, () => Array.from({ length: W2 }, () => null as Cell));
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++) {
      const role = M.role[y][x];
      if (role === 'sky' || role === 'label') continue;
      const ch = glyphOf(role, x, y);
      if (!ch) continue;
      const fill = fillOf(role);
      const e = expand(ch);
      if (!e) { g[y * 2][x * 2] = { ch, fill }; continue; } // a glyph — drawn once
      for (let dy = 0; dy < 2; dy++)
        for (let dx = 0; dx < 2; dx++)
          if (e[dy][dx]) g[y * 2 + dy][x * 2 + dx] = { ch: e[dy][dx] as string, fill };
    }
  drawLabels2x(g);
  for (const b of beings) if (b.row >= 0) g[b.row * 2][b.col * 2] = { ch: b.ch, fill: b.fill };
  return g;
}

// ── C · 2x, scale-aware ─────────────────────────────────────────────────────
// Same layout, same feature sizes. Three rules get to be finer:
//   · the horizon is drawn to half-cell precision instead of whole cells
//   · strata keep their patch SIZE but re-grain within it
//   · sky marks keep their apparent DENSITY but sit at sub-cell positions
function panelC(): Grid {
  const W2 = COLS * 2;
  const H2 = ROWS * 2;
  const g: Grid = Array.from({ length: H2 }, () => Array.from({ length: W2 }, () => null as Cell));

  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++) {
      const role = M.role[y][x];
      if (role === 'sky' || role === 'label') continue;
      if (role === 'crust') continue; // redrawn below at half-cell precision
      const fill = fillOf(role);

      if (STRATA.has(role)) {
        // Same patch layout as the source (the run length doubles with the
        // grid), but the glyph varies per sub-cell — same material, finer grain.
        const pair = PAIRS.get(role) ?? [];
        if (!pair.length) continue;
        for (let dy = 0; dy < 2; dy++)
          for (let dx = 0; dx < 2; dx++) {
            const x2 = x * 2 + dx;
            const y2 = y * 2 + dy;
            const patch = Math.floor(x2 / 12);
            g[y2][x2] = { ch: pair[hash2(patch * 2 + dx, y2, 0x5721) % pair.length], fill };
          }
        continue;
      }

      const ch = glyphOf(role, x, y);
      if (!ch) continue;
      const e = expand(ch);
      if (!e) {
        // A glyph: one per source cell, but free to sit in any quarter — its
        // apparent density is held, its size halves.
        const h = hash2(x, y, 0x5217);
        g[y * 2 + ((h >> 1) & 1)][x * 2 + (h & 1)] = { ch, fill };
        continue;
      }
      for (let dy = 0; dy < 2; dy++)
        for (let dx = 0; dx < 2; dx++)
          if (e[dy][dx]) g[y * 2 + dy][x * 2 + dx] = { ch: e[dy][dx] as string, fill };
    }

  // The horizon, at half-cell precision: the source surface profile linearly
  // resampled to 2x columns, the fractional row carried by ▀ / ▄.
  const crustFill = fillOf('crust');
  for (let x2 = 0; x2 < W2; x2++) {
    const sx = x2 / 2;
    const i0 = Math.min(COLS - 1, Math.floor(sx));
    const i1 = Math.min(COLS - 1, i0 + 1);
    const t = sx - i0;
    const v = ((M.surface[i0] ?? 0) * (1 - t) + (M.surface[i1] ?? 0) * t) * 2;
    const r = Math.floor(v);
    const frac = v - r;
    if (r >= 0 && r < H2) g[r][x2] = { ch: frac < 0.5 ? '▀' : '▄', fill: crustFill };
  }

  drawLabels2x(g);
  for (const b of beings) if (b.row >= 0) g[b.row * 2][b.col * 2] = { ch: b.ch, fill: b.fill };
  return g;
}

// ── page ────────────────────────────────────────────────────────────────────
const esc = (s: string) => s.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;');
const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
const keys = new Map<number, string>();
function render(g: Grid): string {
  const lines: string[] = [];
  for (const row of g) {
    let out = '';
    let run = '';
    let runFill = -1;
    const flush = () => {
      if (!run) return;
      out += runFill < 0 ? esc(run) : `<span class="${keys.get(runFill)}">${esc(run)}</span>`;
      run = '';
    };
    for (let x = 0; x < row.length; x++) {
      const c = row[x];
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

const A = render(panelA());
const B = render(panelB());
const C = render(panelC());
const woff2 = readFileSync('public/fonts/CozetteVector.woff2').toString('base64');
const css = [...keys.entries()].map(([fill, k]) => `.${k}{color:${hex(fill)}}`).join('');
const W = COLS * 12;

const html = `<meta charset="utf-8">
<title>Same Scene, Twice the Grid</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<style>@font-face{font-family:'Cozette';src:url(data:font/woff2;base64,${woff2}) format('woff2')}
:root{--ground:#0b0d0c;--panel:#121614;--ink:#c6cec6;--ink-dim:#79857a;--ink-bright:#eef5ee;
  --rule:#1e2420;--accent:#3dff8c;--accent-dim:#1f7a48;--warn:#ffe14d}
*{margin:0;padding:0;box-sizing:border-box}
body{background:var(--ground);color:var(--ink);
  font:400 15px/1.62 'IBM Plex Sans',ui-sans-serif,system-ui,sans-serif;padding:64px 0 120px;-webkit-font-smoothing:antialiased}
main{width:max-content;max-width:100%;margin:0 auto;padding:0 32px;display:flex;flex-direction:column}
header{max-width:${W}px;display:flex;flex-direction:column;gap:14px}
.eyebrow{font:500 12px/1 'IBM Plex Mono',monospace;letter-spacing:.16em;text-transform:uppercase;color:var(--accent-dim)}
h1{font:600 40px/1.06 'IBM Plex Sans',sans-serif;letter-spacing:-.022em;color:var(--ink-bright);text-wrap:balance}
.lede{max-width:68ch;font-size:16.5px}
.lede b{color:var(--ink-bright);font-weight:600}
.note{max-width:68ch;color:var(--ink-dim);font-size:14px}
.barbox{border:1px solid var(--rule);background:var(--panel);border-radius:3px;padding:20px 22px;
  display:flex;flex-direction:column;gap:10px;max-width:${W}px;margin-top:32px}
.barbox h3{font:600 15px/1.2 'IBM Plex Sans',sans-serif;color:var(--ink-bright)}
.barbox p{max-width:70ch;font-size:14px}
.rule{height:1px;background:var(--rule);margin:44px 0 0}
section{display:flex;flex-direction:column;gap:12px;padding-top:40px}
.head{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap}
.n{font:600 13px/1 'IBM Plex Mono',monospace;color:var(--accent);letter-spacing:.08em;
  border:1px solid var(--accent-dim);border-radius:2px;padding:5px 7px}
h2{font:600 23px/1.15 'IBM Plex Sans',sans-serif;letter-spacing:-.012em;color:var(--ink-bright)}
.kind{font:500 11.5px/1 'IBM Plex Mono',monospace;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-dim)}
.thesis{max-width:70ch}
figure{margin:6px 0 0;overflow-x:auto;max-width:100%}
pre.term{font-family:'Cozette',ui-monospace,Menlo,monospace;letter-spacing:0;background:${theme.palette.bg};width:${W}px}
pre.s2{font-size:26px;line-height:26px}
pre.s1{font-size:13px;line-height:13px}
figcaption{font:400 12.5px/1.5 'IBM Plex Mono',monospace;color:var(--ink-dim);margin-top:10px;max-width:${W}px}
code{font:500 13px/1 'IBM Plex Mono',monospace;color:var(--ink);background:var(--panel);padding:2px 5px;border-radius:2px}
${css}</style>
<main>
<header>
  <p class="eyebrow">Lokilibrary · probe · 21 August 2026</p>
  <h1>Same scene, twice the grid</h1>
  <p class="lede">The check you asked for: <b>double the grid and draw the same thing more finely</b> —
  hold every feature at the size it is on screen now, and spend the extra cells on the feature's own
  edge. Neither earlier probe tested this; both shrank everything, because the composer scales its
  content <i>count</i> with the grid.</p>
  <p class="note">All three panels are the same wing, the same seed and the same physical size —
  1440 × 806 px. Only the lattice under them changes. Judge at wallpaper distance.</p>
  <div class="barbox">
    <h3>The bars, frozen in IDEAS.md before this was rendered</h3>
    <p><b>Confirms:</b> it reads as the same place drawn better — then this, not the five directions,
    is the answer to the whole thread.</p>
    <p><b>Kills:</b> the extra cells only make the <i>marks</i> finer while the <i>shapes</i> stay as
    crude as they are now — then doubling is dead and the content problem is primitives, not
    resolution.</p>
    <p><b>Panel B is a control.</b> A vs B asks whether the grid alone buys anything. B vs C asks
    whether a finer <i>rule</i> buys anything. Without B, any improvement in C could be the grid.</p>
  </div>
</header>

<div class="rule"></div>
<section>
  <div class="head"><span class="n">A</span><h2>Today</h2><span class="kind">120 × 31 · 12×26 px</span></div>
  <p class="thesis">The shipped lattice, at the height-elastic bands you kept.</p>
  <figure><pre class="term s2">${A}</pre><figcaption>1,060-cell window scaled to full screen · 3,720 cells</figcaption></figure>
</section>

<div class="rule"></div>
<section>
  <div class="head"><span class="n">B</span><h2>Twice the grid, no new rules</h2><span class="kind">Control · 240 × 62 · 6×13 px</span></div>
  <p class="thesis">The same scene on a lattice with four times the cells and <b>nothing else changed</b>.
  Block matter — terrain, buildings, silhouettes — tiles into its 2×2 block and holds its size. Glyph
  matter — stars, beings, labels, foliage — is drawn once, because a glyph cannot be tiled into four
  cells. That is not a shortcut in the mock; it is the medium.</p>
  <figure><pre class="term s1">${B}</pre><figcaption>14,880 cells · same picture, four times the addressable points, none of them used</figcaption></figure>
</section>

<div class="rule"></div>
<section>
  <div class="head"><span class="n">C</span><h2>Twice the grid, scale-aware</h2><span class="kind">Candidate · 240 × 62 · 6×13 px</span></div>
  <p class="thesis">Same layout, same feature sizes, three rules allowed to be finer: the horizon is
  drawn to <b>half-cell precision</b> rather than whole cells; strata keep their patch <b>size</b> but
  re-grain within it; sky marks keep their apparent <b>density</b> but sit at sub-cell positions.</p>
  <figure><pre class="term s1">${C}</pre><figcaption>14,880 cells · the horizon and the ground texture are the only things that could change — everything drawn as a glyph is unchanged from B</figcaption></figure>
</section>

<div class="rule"></div>
<div class="barbox" style="margin-top:40px">
  <h3>What the check actually shows</h3>
  <p><b>A → B: the grid alone buys nothing, and it costs something.</b> This is not a judgement
  call — it is provable from how the panels are built. A block element already encodes a sub-cell
  edge, so it expands onto the finer lattice <i>exactly</i>: <code>▀</code> becomes two full cells,
  <code>▙</code> becomes three. No information is invented and none is lost, so every shape in B is
  identical in outline to A. What is <i>not</i> identical is everything drawn as a glyph — the
  beings, the site labels, the foliage, the stars, the ☼. A glyph cannot be tiled into four cells,
  so it is drawn once and lands at <b>half its screen size</b>.</p>
  <p><b>B → C: a finer rule changes texture, not shape.</b> The ground re-grains and the horizon can
  land on a half-cell. The hills are the same hills, the cottages are the same cottages, the crust
  runs the same profile. Nothing about the <i>drawing</i> got better.</p>
  <p><b>So the frozen kill clause is met on its measurable half:</b> <i>"the extra cells only make
  the marks finer while the shapes stay as crude as they are now."</i> The shapes provably did not
  change. Whether the finer grain alone is worth the legibility cost is the half only your eye can
  settle.</p>
  <p><b>The asymmetry is the real finding, and it is new.</b> The scene is made of two kinds of
  matter. <b>Block matter</b> — terrain, silhouettes, buildings — tiles, holds its size, and can
  take a finer edge. <b>Glyph matter</b> — every being, every label, every star — cannot tile at
  all, and on a finer lattice it either shrinks or stays chunky. That is the mechanism behind the
  glance-value failure that ended the scale-1 question in August, now named rather than observed.
  Any future resolution move has to answer it.</p>
</div>
</main>
`;

writeFileSync('docs/design-reviews/2026-08-21-scale-aware.html', html);
console.log(`A ${COLS}x${ROWS} · B/C ${COLS * 2}x${ROWS * 2} · colours ${keys.size} · strata pairs ${[...PAIRS].map(([r, p]) => `${r}:${p.join('')}`).join(' ')}`);
