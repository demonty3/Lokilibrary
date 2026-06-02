/**
 * "The Reveal" — first-run cinematic flythrough.
 *
 * A self-contained scene mounted into the existing single PIXI.Application
 * (the interactive level renderers are untouched). One root container acts as a
 * camera over a stack of per-level "stages"; a ticker-driven phase timeline
 * choreographs three acts:
 *
 *   1. BUILD       — the real cell (layoutCell) assembles itself: tiles fade in
 *                    as a wavefront sweeps out from the door, bookshelf spines
 *                    fill in reading order, then hero header.jpg covers fade on.
 *   2. PULL-BACK   — five transitions zoom out through the scale ladder. Each
 *                    shrinks the current stage to a dot at centre while the next
 *                    (impressionistic glyph field from procedural/macro.ts) grows
 *                    from that same point — a bounded Powers-of-Ten crossfade
 *                    that never hits float-precision limits.
 *   3. POSTER      — holds on the solar-system frame with a title card.
 *
 * Skippable at any time (key / click → jump to poster; from the poster → end).
 * Honors prefers-reduced-motion (shorter, no per-tile build). Determinism is
 * inherited wholesale: everything keys off ctx.seed.
 *
 * mountReveal returns a teardown that cleans up WITHOUT firing onComplete (for
 * external unmount). The natural end / skip path calls onComplete (which the
 * router uses to drop into the live cell).
 */

import { BitmapText, Container, Sprite, type Application, type Ticker } from 'pixi.js';
import type { Theme } from '../../themes/types';
import { SCALE_ORDER, type ScaleLevel } from '../../types';
import { layoutCell, type CellLayout } from '../../procedural/cell';
import { TILE_BY_ID } from '../../procedural/tiles/library';
import { macroFieldFor, type LibraryStats } from '../../procedural/macro';
import {
  COZETTE_CELL_HEIGHT,
  COZETTE_CELL_WIDTH,
  COZETTE_FONT_FAMILY,
  COZETTE_FONT_SIZE,
  hexToInt,
} from '../fonts';
import { clamp01, easeInOutCubic, lerp } from './ease';
import { loadHeroCovers } from './covers';

/** Everything the reveal needs about the world it's drawing — built by the
 *  caller from the library snapshot so this module stays render-only. */
export interface RevealContext {
  seed: number;
  spines: readonly string[];
  heroAppids: readonly number[];
  stats: LibraryStats;
  title: string;
  gamesLabel: string;
  hoursLabel: string;
}

/** Abstract-grid spacing for macro glyph fields (square; reads round enough). */
const MACRO_GAP = 13;

type Phase =
  | { kind: 'build'; durMs: number }
  | { kind: 'transition'; level: ScaleLevel; durMs: number }
  | { kind: 'poster'; durMs: number };

const PHASES: readonly Phase[] = [
  { kind: 'build', durMs: 3400 },
  { kind: 'transition', level: 'district', durMs: 2100 },
  { kind: 'transition', level: 'island', durMs: 2100 },
  { kind: 'transition', level: 'continent', durMs: 2100 },
  { kind: 'transition', level: 'planet', durMs: 2100 },
  { kind: 'transition', level: 'solar_system', durMs: 2400 },
  { kind: 'poster', durMs: Infinity },
];
const POSTER_IDX = PHASES.length - 1;

interface Stage {
  key: 'cell' | ScaleLevel;
  /** Animated (scale + alpha), positioned at screen centre. */
  holder: Container;
  /** Pre-fit to the screen at holder.scale = 1. */
  art: Container;
  fit: (w: number, h: number) => void;
  /** Cell only — drives the wavefront build (0..1). */
  revealTile?: (p: number) => void;
  /** Cell only — slots for async cover placement. */
  coverLayer?: Container;
  layout?: CellLayout;
  origin?: { ox: number; oy: number };
}

function glyph(ch: string, fill: number, alpha: number, centered: boolean): BitmapText {
  const t = new BitmapText({
    text: ch,
    style: { fontFamily: COZETTE_FONT_FAMILY, fontSize: COZETTE_FONT_SIZE, fill },
  });
  if (centered) t.anchor.set(0.5);
  t.alpha = alpha;
  return t;
}

function buildMacroStage(level: ScaleLevel, theme: Theme, ctx: RevealContext): Stage {
  const holder = new Container();
  const art = new Container();
  holder.addChild(art);
  let extent = 1;
  for (const c of macroFieldFor(level, ctx.seed, ctx.stats)) {
    const t = glyph(c.glyph, hexToInt(theme.palette[c.tintKey]), 0.35 + 0.6 * c.weight, true);
    t.x = c.x * MACRO_GAP;
    t.y = c.y * MACRO_GAP;
    art.addChild(t);
    const e = Math.max(Math.abs(c.x), Math.abs(c.y)) * MACRO_GAP;
    if (e > extent) extent = e;
  }
  const fit = (w: number, h: number) => {
    art.scale.set((Math.min(w, h) * 0.42) / (extent + MACRO_GAP));
  };
  return { key: level, holder, art, fit };
}

function buildCellStage(theme: Theme, ctx: RevealContext): Stage {
  const holder = new Container();
  const art = new Container();
  holder.addChild(art);

  const layout = layoutCell(ctx.seed);
  const roomW = layout.width * COZETTE_CELL_WIDTH;
  const roomH = layout.height * COZETTE_CELL_HEIGHT;
  const ox = -roomW / 2;
  const oy = -roomH / 2;

  const baseLayer = new Container();
  const spineLayer = new Container();
  const coverLayer = new Container();
  art.addChild(baseLayer, spineLayer, coverLayer);

  // Wavefront build order: normalized distance from the door.
  let maxDist = 1;
  for (let y = 0; y < layout.height; y++) {
    for (let x = 0; x < layout.width; x++) {
      const d = Math.hypot(x - layout.doorAt.x, y - layout.doorAt.y);
      if (d > maxDist) maxDist = d;
    }
  }
  const tileRefs: Array<{ bt: BitmapText; thr: number }> = [];
  for (let y = 0; y < layout.height; y++) {
    for (let x = 0; x < layout.width; x++) {
      const tile = TILE_BY_ID.get(layout.tiles[y][x]);
      if (!tile) continue;
      const bt = glyph(tile.glyph, hexToInt(theme.palette[tile.fgKey]), 0, false);
      bt.x = ox + x * COZETTE_CELL_WIDTH;
      bt.y = oy + y * COZETTE_CELL_HEIGHT;
      baseLayer.addChild(bt);
      tileRefs.push({ bt, thr: Math.hypot(x - layout.doorAt.x, y - layout.doorAt.y) / maxDist });
    }
  }

  const spineFill = hexToInt(theme.palette.fgBright);
  const usable = ctx.spines.slice(0, layout.bookshelfSlots.length);
  const spineRefs: BitmapText[] = [];
  for (let i = 0; i < usable.length; i++) {
    const slot = layout.bookshelfSlots[i];
    const bt = glyph(usable[i].slice(0, 1).toUpperCase() || '?', spineFill, 0, false);
    bt.x = ox + slot.x * COZETTE_CELL_WIDTH;
    bt.y = oy + slot.y * COZETTE_CELL_HEIGHT;
    spineLayer.addChild(bt);
    spineRefs.push(bt);
  }

  const fit = (w: number, h: number) => {
    art.scale.set(Math.min(w / roomW, h / roomH) * 0.82);
  };

  const revealTile = (p: number) => {
    for (const tr of tileRefs) tr.bt.alpha = clamp01((p - tr.thr * 0.7) * 6);
    const sp = clamp01((p - 0.6) / 0.4);
    const shown = Math.floor(sp * spineRefs.length + 1e-4);
    for (let i = 0; i < spineRefs.length; i++) spineRefs[i].alpha = i < shown ? 1 : 0;
  };

  return { key: 'cell', holder, art, fit, revealTile, coverLayer, layout, origin: { ox, oy } };
}

export function mountReveal(
  app: Application,
  theme: Theme,
  ctx: RevealContext,
  onComplete: () => void,
): () => void {
  const root = new Container();
  app.stage.addChild(root);
  const titleC = new Container();
  root.addChild(titleC);
  titleC.alpha = 0;

  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

  const stages = new Map<'cell' | ScaleLevel, Stage>();
  const coverSprites: Sprite[] = [];
  let coversReady = false;
  let cx = app.screen.width / 2;
  let cy = app.screen.height / 2;
  let phaseIdx = -1;
  let phaseElapsed = 0;
  let done = false;

  const layoutStage = (s: Stage): void => {
    s.holder.x = cx;
    s.holder.y = cy;
    s.fit(app.screen.width, app.screen.height);
  };

  const ensureStage = (key: 'cell' | ScaleLevel): Stage => {
    const existing = stages.get(key);
    if (existing) return existing;
    const s = key === 'cell' ? buildCellStage(theme, ctx) : buildMacroStage(key, theme, ctx);
    stages.set(key, s);
    root.addChildAt(s.holder, 0); // new stages go behind; current is raised in enter()
    layoutStage(s);
    return s;
  };

  const destroyStage = (key: 'cell' | ScaleLevel): void => {
    const s = stages.get(key);
    if (!s) return;
    if (key === 'cell') coverSprites.length = 0; // sprites die with the cell art
    s.holder.destroy({ children: true });
    stages.delete(key);
  };

  const buildTitle = (): void => {
    titleC.removeChildren();
    const text = new BitmapText({
      text: `${ctx.title}\n\n${ctx.gamesLabel}  ·  ${ctx.hoursLabel}\n\npress any key`,
      style: {
        fontFamily: COZETTE_FONT_FAMILY,
        fontSize: COZETTE_FONT_SIZE,
        fill: hexToInt(theme.palette.fgBright),
        align: 'center',
      },
    });
    text.anchor.set(0.5);
    text.scale.set(Math.max(1, Math.floor(Math.min(app.screen.width, app.screen.height) / 220)));
    text.x = app.screen.width / 2;
    text.y = app.screen.height * 0.82;
    titleC.addChild(text);
  };

  const enter = (idx: number): void => {
    phaseIdx = idx;
    phaseElapsed = 0;
    const ph = PHASES[idx];
    if (ph.kind === 'build') {
      ensureStage('cell');
    } else if (ph.kind === 'transition') {
      const next = ensureStage(ph.level);
      next.holder.alpha = 0;
      next.holder.scale.set(0.1);
      const prev = stages.get(SCALE_ORDER[idx - 1]);
      if (prev) root.addChild(prev.holder); // keep the shrinking prev on top
    } else {
      const s = ensureStage('solar_system');
      s.holder.alpha = 1;
      s.holder.scale.set(1);
      buildTitle();
    }
    root.addChild(titleC); // title always topmost
  };

  const advance = (): void => {
    if (PHASES[phaseIdx].kind === 'transition') destroyStage(SCALE_ORDER[phaseIdx - 1]);
    enter(phaseIdx + 1);
  };

  const cleanup = (): void => {
    if (done) return;
    done = true;
    app.ticker.remove(tick);
    window.removeEventListener('keydown', onSkip);
    window.removeEventListener('pointerdown', onSkip);
    app.renderer.off('resize', onResize);
    root.destroy({ children: true });
  };
  const finish = (): void => {
    cleanup();
    onComplete();
  };

  const gotoPoster = (): void => {
    for (const key of [...stages.keys()]) if (key !== 'solar_system') destroyStage(key);
    enter(POSTER_IDX);
  };

  const step = (dt: number): void => {
    if (done) return;
    phaseElapsed += dt;
    const ph = PHASES[phaseIdx];
    const dur = ph.kind === 'poster' ? Infinity : (reduceMotion ? ph.durMs * 0.4 : ph.durMs);
    const p = ph.kind === 'poster' ? 1 : clamp01(phaseElapsed / dur);

    if (ph.kind === 'build') {
      stages.get('cell')?.revealTile?.(reduceMotion ? 1 : p);
    } else if (ph.kind === 'transition') {
      const prev = stages.get(SCALE_ORDER[phaseIdx - 1]);
      const next = stages.get(ph.level);
      const pe = easeInOutCubic(p);
      if (prev) {
        prev.holder.scale.set(lerp(1, 0.1, pe));
        prev.holder.alpha = 1 - clamp01((p - 0.55) / 0.45);
      }
      if (next) {
        next.holder.scale.set(lerp(0.1, 1, pe));
        next.holder.alpha = clamp01(p / 0.55);
      }
    } else {
      titleC.alpha = clamp01(titleC.alpha + dt / 900);
    }

    // Covers ride the cell art: fade in at the build climax, vanish with the
    // cell during the first transition. Skipped entirely if none loaded.
    if (coversReady && coverSprites.length > 0) {
      const target = (ph.kind === 'build' && p > 0.62) || phaseIdx > 0 ? 1 : 0;
      for (const sp of coverSprites) sp.alpha = lerp(sp.alpha, target, 0.12);
    }

    if (ph.kind !== 'poster' && phaseElapsed >= dur) advance();
  };

  const tick = (t: Ticker): void => step(t.deltaMS);
  const onSkip = (): void => {
    if (phaseIdx >= POSTER_IDX) finish();
    else gotoPoster();
  };
  const onResize = (): void => {
    cx = app.screen.width / 2;
    cy = app.screen.height / 2;
    for (const s of stages.values()) layoutStage(s);
    if (titleC.children.length > 0) buildTitle();
  };

  // Kick off hero covers (non-blocking; reveal plays fine without them).
  void loadHeroCovers(ctx.heroAppids).then((covers) => {
    if (done) return;
    const cell = stages.get('cell');
    if (!cell?.coverLayer || !cell.layout || !cell.origin) return;
    const { ox, oy } = cell.origin;
    covers.forEach((cov, i) => {
      const slot = cell.layout!.bookshelfSlots[i];
      if (!slot) return;
      const sp = new Sprite(cov.texture);
      const w = 6 * COZETTE_CELL_WIDTH;
      sp.width = w;
      sp.height = w * (cov.texture.height / cov.texture.width || 0.47);
      sp.anchor.set(0.5);
      sp.x = ox + slot.x * COZETTE_CELL_WIDTH;
      sp.y = oy + slot.y * COZETTE_CELL_HEIGHT - sp.height * 0.2;
      sp.alpha = 0;
      cell.coverLayer!.addChild(sp);
      coverSprites.push(sp);
    });
    coversReady = coverSprites.length > 0;
  });

  window.addEventListener('keydown', onSkip);
  window.addEventListener('pointerdown', onSkip);
  app.renderer.on('resize', onResize);
  app.ticker.add(tick);
  enter(0);

  return cleanup;
}
