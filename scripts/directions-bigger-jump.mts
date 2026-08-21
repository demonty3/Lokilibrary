/**
 * Direction round — "the bigger jump" (2026-08-21).
 *
 * Every panel starts from the SAME real composed land (composeLand at the
 * height-elastic geometry Harry kept: 120x31, wing d0, phosphor, midnight) and
 * applies ONE direction on top. Baseline is engine output; only the proposal is
 * authored — per brain/learnings/generate-the-mockup-from-the-real-system.md.
 *
 * Emits docs/design-reviews/2026-08-21-bigger-jump.html.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { composeLand, DESK_SURFACE, SAMPLE_LAND, type LandGame, type LandModel } from '../src/procedural/land.ts';
import { landRoleFill, landRoleGlyph, mixTowardInt, skyInkOf, strataMaterialGlyph } from '../src/render/levels/land.ts';
import { THEMES } from '../src/themes/index.ts';
import { COHORT } from '../src/agents/cohort.ts';
import { mulberry32 } from '../src/procedural/prng.ts';

const theme = THEMES['phosphor'];
const P = (k: keyof typeof theme.palette): number => parseInt(theme.palette[k].replace('#', ''), 16);

function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

const WING = 'd0';
const seed = fnv1a(`terminal:${WING}`);
const rot = fnv1a(WING) % SAMPLE_LAND.length;
const games: LandGame[] = Array.from({ length: 5 }, (_, i) => SAMPLE_LAND[(rot + i) % SAMPLE_LAND.length]);

const COLS = 120;
const ROWS = 31;
const skyInk = skyInkOf(theme, 0);

/** The band proportions from the height-elastic probe's panel B. */
const skyH = Math.round(ROWS * (DESK_SURFACE.skyH / DESK_SURFACE.rows));
const surfaceBand = Math.round(ROWS * (DESK_SURFACE.surfaceBand / DESK_SURFACE.rows));
const underH = ROWS - 1 - skyH - surfaceBand;
const groundRow = skyH + surfaceBand;

const model: LandModel = composeLand(seed, games, {
  width: COLS, skyH, surfaceBand, underH, withPlayer: false, mural: false,
});

type Cell = { ch: string; fill: number } | null;
type Grid = Cell[][];

function baseGrid(): Grid {
  const g: Grid = [];
  for (let y = 0; y < model.height; y++) {
    const row: Cell[] = [];
    for (let x = 0; x < model.width; x++) {
      const role = model.role[y][x];
      if (role === 'sky') { row.push(null); continue; }
      const ch = landRoleGlyph(theme, role) ?? strataMaterialGlyph(role, x, y) ?? model.char[y][x];
      row.push(!ch || ch === ' ' ? null : { ch, fill: landRoleFill(theme, role, undefined, skyInk) });
    }
    g.push(row);
  }
  for (let i = 0; i < COHORT.length; i++) {
    const def = COHORT[i];
    const col = Math.floor(((i + 0.5) / COHORT.length) * model.width);
    const row = (model.surface[col] ?? 0) - 1;
    if (row >= 0 && row < model.height) g[row][col] = { ch: def.glyph, fill: P(def.paletteKey as keyof typeof theme.palette) };
  }
  return g;
}

const clone = (g: Grid): Grid => g.map((r) => r.map((c) => (c ? { ...c } : null)));
const put = (g: Grid, x: number, y: number, ch: string, fill: number): void => {
  if (y < 0 || y >= g.length || x < 0 || x >= COLS) return;
  g[y][x] = { ch, fill };
};
const surfaceAt = (x: number): number => model.surface[Math.min(COLS - 1, Math.max(0, x))] ?? groundRow;

// ── 1 · Depth planes ────────────────────────────────────────────────────────
function depthPlanes(g: Grid): Grid {
  const planes = [
    { amp: 5.5, base: groundRow - 1, f1: 0.031, f2: 0.084, phase: 0.0, fade: 0.80 },
    { amp: 3.6, base: groundRow - 3, f1: 0.052, f2: 0.131, phase: 2.1, fade: 0.62 },
    { amp: 2.4, base: groundRow - 5, f1: 0.089, f2: 0.212, phase: 4.3, fade: 0.44 },
  ];
  for (const p of planes) {
    const ink = mixTowardInt(P('fgDim'), skyInk, p.fade);
    for (let x = 0; x < COLS; x++) {
      const top = Math.round(p.base - p.amp * (Math.sin(x * p.f1 + p.phase) + 0.45 * Math.sin(x * p.f2 + p.phase * 1.7)));
      for (let y = top; y < groundRow; y++) if (!g[y][x]) put(g, x, y, '█', ink);
      if (top - 1 >= 0 && !g[top - 1][x]) put(g, x, top - 1, '▄', mixTowardInt(ink, skyInk, 0.35));
    }
  }
  return g;
}

// ── 2 · Near plane ──────────────────────────────────────────────────────────
function nearPlane(g: Grid): Grid {
  const rng = mulberry32(seed ^ 0x4e17).next;
  const ink = mixTowardInt(P('bg'), P('green'), 0.07);
  const inkHi = mixTowardInt(P('bg'), P('green'), 0.14);
  const bottom = model.height - 1;
  for (let x = 0; x < COLS; x++) {
    const h = 1 + Math.round(2.8 * (0.5 + 0.5 * Math.sin(x * 0.11 + 0.7 * Math.sin(x * 0.31))) + rng() * 1.9);
    for (let y = bottom - h + 1; y <= bottom; y++) put(g, x, y, '█', ink);
    put(g, x, bottom - h, rng() < 0.45 ? '♣' : '▀', rng() < 0.3 ? inkHi : ink);
  }
  // A leaf mass in the top-left corner: an elliptical quadrant with a ragged
  // ♣ edge. The classic framing gesture — near, dark, unmistakably in front.
  const RX = 21;
  const RY = 8;
  for (let y = 0; y <= RY; y++) {
    for (let x = 0; x <= RX; x++) {
      const d = (x / RX) ** 2 + (y / RY) ** 2;
      if (d > 1.0) continue;
      if (d > 0.62) { if (rng() < 0.55) put(g, x, y, '♣', rng() < 0.35 ? inkHi : ink); continue; }
      put(g, x, y, rng() < 0.22 ? '♣' : '█', ink);
    }
  }
  return g;
}

// ── 3 · Authored set-pieces ─────────────────────────────────────────────────
const LIGHTHOUSE = [
  '  ▄▄▄  ',
  ' ▐███▌ ',
  ' ▐█o█▌ ',
  ' ▐███▌ ',
  '▗█████▖',
  '▐██o██▌',
  '▐█████▌',
  '▐██o██▌',
  '███████',
];
const GATEHOUSE = [
  '▄▄▄▄▄▄▄▄▄▄▄',
  '█▛▀▀▀▀▀▀▀▜█',
  '█▌ ▗▄▄▖  ▐█',
  '█▌ ▐oo▌  ▐█',
  '█▙▄▄▄▄▄▄▄▄█',
  '█▌       ▐█',
  '█▌  ▓▓▓  ▐█',
  '██▄▄███▄▄██',
];
const AQUEDUCT = [
  '▄▄▄▄▄▄▄▄▄▄▄▄▄',
  '█████████████',
  '█▛▀▜█▛▀▜█▛▀▜█',
  '█▌ ▐█▌ ▐█▌ ▐█',
  '█▌o▐█▌ ▐█▌o▐█',
  '█▌ ▐█▌ ▐█▌ ▐█',
];
function stampArt(g: Grid, art: readonly string[], cx: number, baseY: number, ink: number, lit: number): void {
  const w = art[0].length;
  const x0 = Math.max(0, Math.min(COLS - w, cx - Math.floor(w / 2)));
  const y0 = baseY - art.length + 1;
  for (let r = 0; r < art.length; r++) {
    for (let c = 0; c < w; c++) {
      const ch = art[r][c];
      if (ch === ' ') continue;
      if (ch === 'o') { put(g, x0 + c, y0 + r, '▪', lit); continue; }
      put(g, x0 + c, y0 + r, ch, ink);
    }
  }
}
function setPieces(g: Grid): Grid {
  const surfaceSites = model.sites.filter((s) => s.kind === 'surface').slice(0, 3);
  const arts = [LIGHTHOUSE, GATEHOUSE, AQUEDUCT];
  surfaceSites.forEach((s, i) => {
    const cx = s.x;
    const baseY = surfaceAt(cx) - 1;
    for (let x = Math.max(0, cx - 7); x <= Math.min(COLS - 1, cx + 7); x++) {
      const top = surfaceAt(x) - 1;
      for (let y = Math.max(0, top - 9); y <= top; y++) g[y][x] = null;
    }
    stampArt(g, arts[i % arts.length], cx, baseY, mixTowardInt(P('fgDim'), skyInk, 0.12), P('yellow'));
  });
  return g;
}

// ── 4 · A second grammar (night city) ───────────────────────────────────────
function secondGrammar(_g: Grid): Grid {
  const g: Grid = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => null as Cell));
  const rng = mulberry32(seed ^ 0x6317).next;
  const waterTop = ROWS - 7;

  // Banded sky: density and mark shorten with altitude, hue held, value ramped.
  for (let y = 0; y < waterTop - 6; y++) {
    const t = y / Math.max(1, waterTop - 7);
    const density = 0.04 + t * 0.20;
    const ink = mixTowardInt(P('fgDim'), skyInk, 0.82 - t * 0.30);
    for (let x = 0; x < COLS; x++) {
      if (rng() > density) continue;
      put(g, x, y, t < 0.35 ? '·' : t < 0.7 ? '-' : '─', ink);
    }
  }
  put(g, 26, 3, '☾', mixTowardInt(P('fg'), skyInk, 0.15));
  for (let i = 0; i < 7; i++) put(g, 10 + Math.floor(rng() * 100), 1 + Math.floor(rng() * 5), '*', mixTowardInt(P('fg'), skyInk, 0.45));

  // Three depth ranks of towers; nearer ranks are darker, taller, and lit.
  const ranks = [
    { fade: 0.22, hMin: 3, hMax: 7, wMin: 3, wMax: 7, litFade: 0.55, lit: 0.14, base: waterTop - 2 },
    { fade: 0.50, hMin: 5, hMax: 12, wMin: 3, wMax: 6, litFade: 0.28, lit: 0.28, base: waterTop - 1 },
    { fade: 0.78, hMin: 6, hMax: 16, wMin: 4, wMax: 8, litFade: 0.05, lit: 0.44, base: waterTop },
  ];
  const litKeys: (keyof typeof theme.palette)[] = ['yellow', 'orange', 'cyan', 'green'];
  for (const r of ranks) {
    const ink = mixTowardInt(P('fgDim'), skyInk, r.fade);
    let x = -2 - Math.floor(rng() * 3);
    while (x < COLS) {
      const w = r.wMin + Math.floor(rng() * (r.wMax - r.wMin + 1));
      const h = r.hMin + Math.floor(rng() * (r.hMax - r.hMin + 1));
      const top = r.base - h;
      for (let yy = top; yy <= r.base; yy++)
        for (let xx = x; xx < x + w; xx++) put(g, xx, yy, '█', ink);
      // Window grid — every other column, every other row, a fraction lit.
      for (let yy = top + 1; yy < r.base; yy += 2)
        for (let xx = x + 1; xx < x + w - 1; xx += 2) {
          if (rng() > r.lit) continue;
          const k = litKeys[Math.floor(rng() * litKeys.length)];
          put(g, xx, yy, rng() < 0.5 ? '▪' : '·', mixTowardInt(P(k), skyInk, r.litFade));
        }
      // An occasional mast, so the roofline is not all flat.
      if (rng() < 0.22) {
        const mx = x + Math.floor(w / 2);
        put(g, mx, top - 1, '╽', ink);
        if (rng() < 0.5) put(g, mx, top - 2, '·', P('red'));
      }
      x += w + (rng() < 0.5 ? 0 : 1);
    }
  }

  // Water: the city's own lights, smeared downward and thinning.
  for (let y = waterTop + 1; y < ROWS; y++) {
    const t = (y - waterTop) / (ROWS - waterTop);
    const ink = mixTowardInt(P('fgDim'), skyInk, 0.55 + t * 0.32);
    for (let x = 0; x < COLS; x++) {
      if (rng() < 0.55 - t * 0.3) put(g, x, y, rng() < 0.6 ? '─' : '▁', ink);
    }
  }
  for (let x = 0; x < COLS; x++) {
    const src = g[waterTop - 1]?.[x] ?? g[waterTop - 2]?.[x];
    if (!src || src.ch === '█') continue;
    const depth = 1 + Math.floor(rng() * 3);
    for (let d = 1; d <= depth; d++)
      put(g, x, waterTop + d, d === 1 ? '▪' : '·', mixTowardInt(src.fill, skyInk, 0.35 + d * 0.18));
  }
  return g;
}

// ── 5 · Structural grammar ──────────────────────────────────────────────────
function structuralGrammar(g: Grid): Grid {
  const rng = mulberry32(seed ^ 0x571c).next;
  for (const s of model.sites.filter((x) => x.kind === 'surface')) {
    const cx = s.x;
    const baseY = surfaceAt(cx) - 1;
    const storeys = 2 + Math.floor(rng() * 4);
    const w = 5 + 2 * Math.floor(rng() * 3);
    const x0 = Math.max(0, Math.min(COLS - w, cx - Math.floor(w / 2)));
    const ink = mixTowardInt(P('fgDim'), skyInk, 0.08);
    for (let y = Math.max(0, baseY - storeys * 2 - 2); y <= baseY; y++)
      for (let x = Math.max(0, x0 - 1); x <= Math.min(COLS - 1, x0 + w); x++)
        if (y < groundRow) g[y][x] = null;
    for (let st = 0; st < storeys; st++) {
      const yTop = baseY - st * 2 - 1;
      for (let x = x0; x < x0 + w; x++) put(g, x, yTop + 1, '█', ink);
      for (let x = x0; x < x0 + w; x++) {
        const isWin = (x - x0) % 2 === 1;
        const on = isWin && rng() < 0.55;
        put(g, x, yTop, isWin ? (on ? '▪' : '·') : '█', on ? P('yellow') : ink);
      }
    }
    const roofY = baseY - storeys * 2;
    for (let x = x0; x < x0 + w; x++) put(g, x, roofY, '▀', mixTowardInt(ink, skyInk, 0.22));
    put(g, x0 + Math.floor(w / 2), roofY - 1, '╽', mixTowardInt(ink, skyInk, 0.38));
  }
  return g;
}

// ── page ────────────────────────────────────────────────────────────────────
const esc = (s: string) => s.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;');
const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
const keys = new Map<number, string>();

function renderGrid(g: Grid): string {
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
    for (let x = 0; x < COLS; x++) {
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

interface Dir { n: string; title: string; thesis: string; cost: string; kind: string; grid: Grid }
const dirs: Dir[] = [
  {
    n: '01', title: 'Depth planes', kind: 'Arrangement · engine slice',
    thesis: 'Three receding silhouette ridges behind the terrain, each mixed further toward the sky ink. The scene stops being one flat cut-out and acquires distance.',
    cost: 'Small. The primitive already exists — <code>wingSil</code>, <code>ridgeFar</code>, <code>FAR_FADE</code>. What is missing is a stack of them with independent profiles.',
    grid: depthPlanes(clone(baseGrid())),
  },
  {
    n: '02', title: 'A near plane', kind: 'Arrangement · engine slice',
    thesis: 'Something in front. Near-black foliage along the bottom edge and a frond arcing in from the corner, with the beings walking behind it. The cheapest depth in the book.',
    cost: 'Small, and self-contained: one screen-space layer drawn after the world, plus a z-order rule for beings. No composer change.',
    grid: nearPlane(clone(baseGrid())),
  },
  {
    n: '03', title: 'Authored set-pieces', kind: 'Authored primitives · the rule this spends',
    thesis: 'The composer still decides where things go; it stops deciding what they look like. Hand-drawn vignettes replace the generated stamps — a lighthouse with lit storeys, a gatehouse, an aqueduct.',
    cost: 'A bible of drawn pieces plus a placement contract. This is the Stone Story lesson and the one direction that spends "as much as possible should be procedural".',
    grid: setPieces(clone(baseGrid())),
  },
  {
    n: '04', title: 'A second grammar', kind: 'New grammar · procedural instance',
    thesis: 'Not the landscape at all. A night city, composed procedurally at the same geometry: banded sky, three depth ranks of towers, a window grid lit per building, the water carrying the lights back. A wing could BE a different kind of place.',
    cost: 'Largest. A second composer beside <code>composeLand</code>, and a rule for which wing gets which. The grammar is authored once; every instance is still seeded.',
    grid: secondGrammar(baseGrid()),
  },
  {
    n: '05', title: 'Architecture, generated', kind: 'Arrangement · engine slice',
    thesis: 'Sites keep their seeded placement and gain structure: storeys, a window grid, a roofline, a mast. Same idea as 03 without giving up generation — the building is built by rule, not drawn.',
    cost: 'Medium. A small shape grammar in the composer. The honest risk: rule-built architecture reads as regular, which is exactly the failure 03 exists to avoid.',
    grid: structuralGrammar(clone(baseGrid())),
  },
];

const base = renderGrid(baseGrid());
const bodies = dirs.map((d) => ({ ...d, html: renderGrid(d.grid) }));
const woff2 = readFileSync('public/fonts/CozetteVector.woff2').toString('base64');
const css = [...keys.entries()].map(([fill, k]) => `.${k}{color:${hex(fill)}}`).join('');

const html = `<meta charset="utf-8">
<title>The Bigger Jump</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<style>@font-face{font-family:'Cozette';src:url(data:font/woff2;base64,${woff2}) format('woff2')}
:root{
  --ground:#0b0d0c; --panel:#121614; --ink:#c6cec6; --ink-dim:#79857a; --ink-bright:#eef5ee;
  --rule:#1e2420; --accent:#3dff8c; --accent-dim:#1f7a48; --warn:#ffe14d;
}
*{margin:0;padding:0;box-sizing:border-box}
body{background:var(--ground);color:var(--ink);
  font:400 15px/1.62 'IBM Plex Sans',ui-sans-serif,system-ui,sans-serif;
  padding:64px 0 120px;-webkit-font-smoothing:antialiased}
main{width:max-content;max-width:100%;margin:0 auto;padding:0 32px;display:flex;flex-direction:column;gap:0}
header{max-width:${COLS * 12}px;display:flex;flex-direction:column;gap:14px;margin-bottom:8px}
.eyebrow{font:500 12px/1 'IBM Plex Mono',ui-monospace,monospace;letter-spacing:.16em;text-transform:uppercase;color:var(--accent-dim)}
h1{font:600 40px/1.06 'IBM Plex Sans',sans-serif;letter-spacing:-.022em;color:var(--ink-bright);text-wrap:balance}
.lede{max-width:68ch;color:var(--ink);font-size:16.5px}
.lede b{color:var(--ink-bright);font-weight:600}
.note{max-width:68ch;color:var(--ink-dim);font-size:14px}
.rule{height:1px;background:var(--rule);margin:44px 0 0}
section{display:flex;flex-direction:column;gap:12px;padding-top:40px}
.head{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap}
.n{font:600 13px/1 'IBM Plex Mono',monospace;color:var(--accent);letter-spacing:.08em;
  border:1px solid var(--accent-dim);border-radius:2px;padding:5px 7px}
h2{font:600 23px/1.15 'IBM Plex Sans',sans-serif;letter-spacing:-.012em;color:var(--ink-bright)}
.kind{font:500 11.5px/1 'IBM Plex Mono',monospace;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-dim)}
.thesis{max-width:70ch}
.cost{max-width:70ch;color:var(--ink-dim);font-size:14px}
.cost code,.thesis code{font:500 13px/1 'IBM Plex Mono',monospace;color:var(--ink);background:var(--panel);padding:2px 5px;border-radius:2px}
figure{margin:6px 0 0;overflow-x:auto;max-width:100%}
pre.term{font-family:'Cozette',ui-monospace,Menlo,monospace;letter-spacing:0;background:${theme.palette.bg};
  font-size:26px;line-height:26px;width:${COLS * 12}px;padding:0}
figcaption{font:400 12.5px/1.5 'IBM Plex Mono',monospace;color:var(--ink-dim);margin-top:10px}
.verdictbox{border:1px solid var(--rule);background:var(--panel);border-radius:3px;padding:22px 24px;
  display:flex;flex-direction:column;gap:12px;max-width:${COLS * 12}px;margin-top:44px}
.verdictbox h3{font:600 17px/1.2 'IBM Plex Sans',sans-serif;color:var(--ink-bright)}
.verdictbox p{max-width:70ch;font-size:14.5px}
.tag{display:inline-block;font:600 11px/1 'IBM Plex Mono',monospace;letter-spacing:.1em;
  padding:5px 7px;border-radius:2px;background:rgba(61,255,140,.10);color:var(--accent);border:1px solid var(--accent-dim)}
.tag.warn{background:rgba(255,225,77,.09);color:var(--warn);border-color:#6b5c14}
${css}</style>
<main>
<header>
  <p class="eyebrow">Lokilibrary · direction round · 21 August 2026</p>
  <h1>The bigger jump</h1>
  <p class="lede">You like panel B of the row-budget probe, and you want the scene inside it to be
  <b>better, not reshaded</b>. Every panel below starts from the <b>same real composed land</b> —
  wing d0, phosphor, midnight, the exact geometry you kept — and changes exactly one thing.
  Judge them by number: keep, kill, or mutate.</p>
  <p class="note">Baseline is engine output. Only the proposal in each panel is authored, so anything
  that reads wrong is the direction failing, not the mock. Panels are drawn small so you can judge
  them the way you will see them — at a glance, across the room.</p>
</header>

<div class="rule"></div>

<section>
  <div class="head"><span class="n">00</span><h2>Today, the one grammar</h2><span class="kind">Shipped</span></div>
  <p class="thesis">Sky band, rolling horizon, sites stamped on the ground, strata below. This is the
  only picture the composer knows. Packs recolour it and re-voice its glyphs; they never reshape it —
  that is written into the blueprint as a contract. Which is why more packs keep reading as the same
  place in a different mood.</p>
  <figure><pre class="term">${base}</pre>
  <figcaption>120×31 · composeLand at the height-elastic bands · beings drawn where addBeing puts them</figcaption></figure>
</section>

${bodies
  .map(
    (d) => `<div class="rule"></div>
<section>
  <div class="head"><span class="n">${d.n}</span><h2>${d.title}</h2><span class="kind">${d.kind}</span></div>
  <p class="thesis">${d.thesis}</p>
  <figure><pre class="term">${d.html}</pre>
  <figcaption>${d.cost}</figcaption></figure>
</section>`,
  )
  .join('\n')}

<div class="verdictbox">
  <h3>What the prior art says, and the rule it collides with</h3>
  <p><b>Stone Story RPG</b> is the best-looking ASCII scene work that exists, and its art is drawn
  frame by frame. Its own tutorial is a drawing tutorial: references, concept, primary keyframe,
  <i>test size and composition</i>. Nobody has cracked procedurally composing a beautiful textmode
  scene — the good ones are authored. Your own repo reached the same verdict in June, at the Terminal
  Terraria gate: <i>"the hall is seeded noise; the splash-mural feeling needs hand-authored assets;
  knob iteration won't close the gap."</i> Then murals shipped authored art and passed.</p>
  <p>That points at <b>03</b>. But 03 is the one direction that spends your standing rule — <i>as much
  as possible should be procedural</i>, arrangement over curated primitives. <b>01</b>, <b>02</b> and
  <b>05</b> buy real distance without spending it; <b>04</b> spends it once, at the grammar level, and
  keeps every instance seeded.</p>
  <p><span class="tag">Recommendation</span> &nbsp;01 + 02 first — they are small, they compose with
  each other, and depth is the single biggest "this looks composed" lever in both references. Then
  <b>04</b> as the real jump, because a second grammar is the only direction that makes a wing read
  as a different <i>kind of place</i> rather than a different mood.
  &nbsp;<span class="tag warn">Watch</span> &nbsp;05 is the trap: rule-built architecture reads as
  regular, which is the exact failure 03 exists to avoid.</p>
</div>
</main>
`;

writeFileSync('docs/design-reviews/2026-08-21-bigger-jump.html', html);
console.log(`panels: ${dirs.length + 1} · colours: ${keys.size} · grid ${COLS}x${ROWS} · bands sky ${skyH} band ${surfaceBand} under ${underH}`);
