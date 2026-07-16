/**
 * Side-on "wide land" renderer (2026-06 perspective realignment) — PROTOTYPE.
 *
 * Tints the role-tagged grid from `src/procedural/land.ts` by the active theme
 * palette, so each layer reads in its own hue (warm earth, dim stone, cool
 * deep, bright relics/structures) — the colour separation the monochrome ASCII
 * proto couldn't show. Built as one BitmapText PER ROLE (a full-grid text with
 * only that role's glyphs, the rest spaces) and stacked: ~20 tinted text
 * objects instead of one-per-cell.
 *
 * Mounted today via the E2E debug hook (`__loki.previewLand`) for screenshot
 * iteration; promotes to a real pane level (parent + rect signature, the
 * district.ts pattern) once the look is signed off.
 */

import { Application, BitmapText, Container, Graphics } from 'pixi.js';
import type { Theme } from '../../themes/types';
import { COZETTE_CELL_HEIGHT, COZETTE_CELL_WIDTH, COZETTE_FONT_FAMILY, COZETTE_FONT_SIZE, hexToInt } from '../fonts';
import { composeLand, type LandGame, type LandModel, type LandRole } from '../../procedural/land';
import { buildMuralContainer, capsuleToCells } from '../ansiSpike';

// ── V0 spike knobs (PRD: Terminal Terraria visual direction) ──────────────
const MURAL_APPID = 1145360; // Hades — SAMPLE_LAND's first surface game, so hall + capsule match
const GRADIENT_FACTORS = [0.35, 0.55, 0.78, 1.0] as const; // shade 0..3 → tint scale (steepness knob)
const SHADED_ROLES: ReadonlySet<LandRole> = new Set<LandRole>(['hall']);
/** PRD V0 scene: ~200×56 cells — tall sky for the hall + poster, shallow strata. */
const V0_SCENE = { width: 200, skyH: 38, surfaceBand: 4, underH: 13, hall: true } as const;

/** Scale a theme colour's RGB channels — the per-step tint for shaded roles.
 *  Derived from the ACTIVE theme (not hard-coded hexes) so setTheme hot-swap
 *  re-tints the gradient along with everything else. */
function shadeOf(hex: string, f: number): number {
  const n = hexToInt(hex);
  const r = Math.round(((n >> 16) & 0xff) * f);
  const g = Math.round(((n >> 8) & 0xff) * f);
  const b = Math.round((n & 0xff) * f);
  return (r << 16) | (g << 8) | b;
}

/** Linear per-channel mix from `hexA`'s ink toward `hexB` by t∈[0,1] — the
 *  atmospheric-perspective primitive (t=0 pure ink, t=1 vanishes into hexB).
 *  Both ends come from the ACTIVE theme, so setTheme hot-swap re-fades. */
export function mixToward(hexA: string, hexB: string, t: number): number {
  const a = hexToInt(hexA);
  const b = hexToInt(hexB);
  const ch = (shift: number): number => {
    const ca = (a >> shift) & 0xff;
    const cb = (b >> shift) & 0xff;
    return Math.round(ca + (cb - ca) * t);
  };
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/** Atmospheric perspective (Tier 2): how far each DISTANT role's ink is
 *  pulled toward the sky (bg) colour — farther planes lose contrast.
 *  Palette maths only (mixToward), no new palette entries, so the
 *  one-theme-per-scene rule stays structural. Exported for the smoke. */
export const FAR_FADE: Partial<Record<LandRole, number>> = {
  ridgeFar: 0.72,
  ridge: 0.45,
  cloud: 0.4,
  star: 0.35,
  skyDither: 0.55,
};

/** Role -> theme palette key. The whole point of the side-on look: layers
 *  separate by hue, not by glyph density. */
const ROLE_KEY: Record<LandRole, keyof Theme['palette']> = {
  sky: 'bg',
  star: 'fgDim',
  starBright: 'fg',
  hall: 'violet',
  sun: 'yellow',
  cloud: 'fgDim',
  ridge: 'fgDim',
  ridgeFar: 'fgDim',
  skyDither: 'fgDim',
  crust: 'green',
  topsoil: 'orange',
  stone: 'fgDim',
  deep: 'violet',
  bedrock: 'bgAlt',
  cavern: 'bgAlt',
  shelf: 'yellow',
  roof: 'orange',
  monument: 'cyan',
  cottage: 'orange',
  foliage: 'green',
  relic: 'magenta',
  being: 'violet',
  player: 'fgBright',
  label: 'fgDim',
  shaft: 'orange',
  edge: 'fgDim',
};

/** Build the stacked-by-role tinted container for a land model. Local glyph
 *  space (origin 0,0); the caller positions + scales it. `layers` carries the
 *  tinted BitmapText objects per drawn role (multi-text roles — shaded hall
 *  steps — carry >1 entry) so the terminal renderer can animate a layer
 *  (glow / sway / wear) without rebuilding the scene. */
export function buildLandContainer(theme: Theme, model: LandModel): {
  container: Container;
  contentW: number;
  contentH: number;
  layers: Partial<Record<LandRole, BitmapText[]>>;
} {
  const container = new Container();
  const contentW = model.width * COZETTE_CELL_WIDTH;
  const contentH = model.height * COZETTE_CELL_HEIGHT;

  // A bg panel so terrain reads against its own ground (blends with the stage
  // bg when they share a theme; gives the land a body either way).
  const bg = new Graphics().rect(0, 0, contentW, contentH).fill(hexToInt(theme.palette.bg));
  container.addChild(bg);

  // Which roles actually appear — one tinted BitmapText each.
  const roles = new Set<LandRole>();
  for (let y = 0; y < model.height; y++) for (let x = 0; x < model.width; x++) roles.add(model.role[y][x]);
  roles.delete('sky'); // background, never drawn

  const layerFor = (pred: (x: number, y: number) => boolean): string => {
    const rows: string[] = [];
    for (let y = 0; y < model.height; y++) {
      let line = '';
      for (let x = 0; x < model.width; x++) line += pred(x, y) ? model.char[y][x] : ' ';
      rows.push(line.replace(/\s+$/u, ''));
    }
    return rows.join('\n');
  };
  const layers: Partial<Record<LandRole, BitmapText[]>> = {};
  const addLayer = (r: LandRole, text: string, fill: number) => {
    if (!text.trim()) return;
    const bt = new BitmapText({
      text,
      style: { fontFamily: COZETTE_FONT_FAMILY, fontSize: COZETTE_FONT_SIZE, fill },
    });
    container.addChild(bt);
    (layers[r] ??= []).push(bt);
  };
  for (const r of roles) {
    const shadeGrid = model.shade;
    if (shadeGrid && SHADED_ROLES.has(r)) {
      // V0: vertical gradient — one layer per luminance step (≤4 extra
      // objects), tint scaled from the role's theme colour.
      for (let s = 0; s < GRADIENT_FACTORS.length; s++) {
        addLayer(
          r,
          layerFor((x, y) => model.role[y][x] === r && shadeGrid[y][x] === s),
          shadeOf(theme.palette[ROLE_KEY[r]], GRADIENT_FACTORS[s]),
        );
      }
    } else {
      const fade = FAR_FADE[r];
      const fill =
        fade !== undefined
          ? mixToward(theme.palette[ROLE_KEY[r]], theme.palette.bg, fade)
          : hexToInt(theme.palette[ROLE_KEY[r]]);
      addLayer(r, layerFor((x, y) => model.role[y][x] === r), fill);
    }
  }

  return { container, contentW, contentH, layers };
}

export interface MountLandOptions {
  readonly seed?: number;
  readonly games?: readonly LandGame[];
  /** The dynamic-edge dial: 'porous' draws a LIVING terminal frame (foliage
   *  crown, vine-sprouting sides, soil mound) — the window-mode look; 'bleed'
   *  draws nothing so the world runs to the screen edges — the wallpaper look.
   *  Default 'porous'. */
  readonly frame?: 'porous' | 'bleed';
}

/** The dynamic-edge "porous living frame": the terminal border IS terrain —
 *  built in screen space (doesn't scroll), in the glyph vocabulary, so the
 *  chrome and the world read as one living thing. Deterministic index pattern
 *  (decoration, not seeded geometry). */
function buildPorousFrame(theme: Theme, screenW: number, screenH: number, scale: number): Container {
  const cols = Math.ceil(screenW / (COZETTE_CELL_WIDTH * scale));
  const rows = Math.ceil(screenH / (COZETTE_CELL_HEIGHT * scale));
  type Key = keyof Theme['palette'];
  const grid: Array<Array<{ ch: string; key: Key }>> = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ ch: ' ', key: 'green' as Key })),
  );
  const setc = (x: number, y: number, ch: string, key: Key) => {
    if (grid[y] && grid[y][x]) grid[y][x] = { ch, key };
  };
  for (let c = 0; c < cols; c++) {
    if (c % 5 === 0) setc(c, 0, '♣', 'green'); // foliage crown
    else if (c % 5 === 2) setc(c, 0, '▁', 'green'); // hilltop bumps (sky between)
    if (c % 7 === 3) setc(c, 1, '♣', 'green'); // a few hanging vines
    setc(c, rows - 1, c % 2 ? '▒' : '░', 'orange'); // soil mound
    if (c % 3 === 0) setc(c, rows - 2, '♣', 'green'); // grass tufts on the mound
  }
  for (let r = 1; r < rows - 1; r++) {
    const sprout = r % 4 === 0;
    setc(0, r, sprout ? '♣' : '║', sprout ? 'green' : 'fgDim'); // trunk + sprouts
    setc(cols - 1, r, sprout ? '♣' : '║', sprout ? 'green' : 'fgDim');
  }
  const cont = new Container();
  cont.scale.set(scale);
  const keys = new Set<Key>(grid.flat().map((g) => g.key));
  for (const key of keys) {
    const text = grid
      .map((row) => row.map((g) => (g.key === key ? g.ch : ' ')).join('').replace(/\s+$/u, ''))
      .join('\n');
    if (!text.trim()) continue;
    cont.addChild(
      new BitmapText({
        text,
        style: { fontFamily: COZETTE_FONT_FAMILY, fontSize: COZETTE_FONT_SIZE, fill: hexToInt(theme.palette[key]) },
      }),
    );
  }
  return cont;
}

/**
 * PROTOTYPE walkable view — a world WIDER than the screen with a movable player
 * and a camera that scrolls to follow. a/← and d/→ walk the surface (the player
 * rides the terrain height). Proves the "land you cross" feel before the full
 * pane-level + free-roam-physics integration. Returns a teardown.
 */
export function mountLandView(app: Application, theme: Theme, opts: MountLandOptions = {}): () => void {
  const CW = COZETTE_CELL_WIDTH;
  const CH = COZETTE_CELL_HEIGHT;
  const model = composeLand(opts.seed ?? 0xca11ed, opts.games, { width: 220, withPlayer: false });
  const { container: world, contentW, contentH } = buildLandContainer(theme, model);

  // Movable player — a child of `world`, so it scales + scrolls with the land.
  const player = new BitmapText({
    text: '@',
    style: { fontFamily: COZETTE_FONT_FAMILY, fontSize: COZETTE_FONT_SIZE, fill: hexToInt(theme.palette.fgBright) },
  });
  world.addChild(player);
  let px = Math.floor(model.width / 2);
  const placePlayer = () => {
    player.x = px * CW;
    player.y = (model.surface[px] - 1) * CH;
  };

  // Viewport: clip to the screen; scroll `world` horizontally to follow player.
  const viewport = new Container();
  viewport.addChild(world);
  const mask = new Graphics();
  viewport.mask = mask;
  viewport.addChild(mask);
  app.stage.addChild(viewport);

  // The dynamic edge — a living frame in screen space (window mode). 'bleed'
  // (wallpaper) leaves it null so the world runs to the screen edges.
  const frameMode = opts.frame ?? 'porous';
  let frame: Container | null = null;

  let scale = 1;
  const layout = () => {
    // Fill the screen HEIGHT (vertical presence); width scrolls.
    scale = Math.max(1, Math.floor(app.screen.height / contentH));
    world.scale.set(scale);
    world.y = Math.floor((app.screen.height - contentH * scale) / 2);
    mask.clear().rect(0, 0, app.screen.width, app.screen.height).fill(0xffffff);
    camera();
    frame?.destroy({ children: true });
    frame = null;
    if (frameMode === 'porous') {
      frame = buildPorousFrame(theme, app.screen.width, app.screen.height, scale);
      app.stage.addChild(frame); // on top of the viewport
    }
  };
  const camera = () => {
    // Centre the player; clamp so we never scroll past the world edges.
    const target = app.screen.width / 2 - px * CW * scale;
    const minX = Math.min(0, app.screen.width - contentW * scale);
    world.x = Math.floor(Math.max(minX, Math.min(0, target)));
  };

  const onKey = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (k === 'a' || k === 'arrowleft') px = Math.max(0, px - 1);
    else if (k === 'd' || k === 'arrowright') px = Math.min(model.width - 1, px + 1);
    else return;
    e.preventDefault();
    placePlayer();
    camera();
  };

  placePlayer();
  layout();
  window.addEventListener('keydown', onKey);
  const onResize = () => layout();
  app.renderer.on('resize', onResize);

  return () => {
    window.removeEventListener('keydown', onKey);
    try {
      app.renderer?.off('resize', onResize);
    } catch {
      /* app torn down */
    }
    try {
      viewport.destroy({ children: true });
      frame?.destroy({ children: true });
    } catch {
      /* already gone */
    }
  };
}

/** V0 mural lifecycle, polled by the e2e harness (`__loki.landMuralState()`)
 *  so screenshots wait for the async capsule load. */
export type LandMuralState = 'idle' | 'loading' | 'ready' | 'failed-cors' | 'failed-load';
let muralState: LandMuralState = 'idle';
export function getLandMuralState(): LandMuralState {
  return muralState;
}

/**
 * PROTOTYPE mount — compose + tint a land and drop it full-screen onto the
 * stage (above everything). Returns a teardown. For harness screenshots only;
 * not wired into the pane system yet.
 *
 * V0 spike: composes the PRD scene (200×56, hall + poster) and mounts the
 * game's ANSI capsule mural onto the poster rect once the image resolves.
 */
export function mountLandPreview(app: Application, theme: Theme, opts: MountLandOptions = {}): () => void {
  const model = composeLand(opts.seed ?? 0xca11ed, opts.games, V0_SCENE);
  const { container, contentW, contentH } = buildLandContainer(theme, model);

  muralState = 'idle';
  let dead = false;
  if (model.poster) {
    const p = model.poster;
    muralState = 'loading';
    capsuleToCells(MURAL_APPID, p.w, p.h)
      .then((cells) => {
        if (dead) return;
        const mural = buildMuralContainer(cells, p.w, p.h);
        mural.x = p.x * COZETTE_CELL_WIDTH;
        mural.y = p.y * COZETTE_CELL_HEIGHT;
        container.addChild(mural); // child of the world → inherits scale + position
        muralState = 'ready';
      })
      .catch((err: unknown) => {
        // CORS contingency (PRD): report, leave the dim poster fill visible,
        // do NOT silently add a Worker proxy.
        muralState = err instanceof Error && err.name === 'SecurityError' ? 'failed-cors' : 'failed-load';
        console.warn('[land] capsule mural failed:', err);
      });
  }

  const fit = () => {
    const scale = Math.max(1, Math.floor(Math.min(app.screen.width / contentW, app.screen.height / contentH)));
    container.scale.set(scale);
    container.x = Math.floor((app.screen.width - contentW * scale) / 2);
    container.y = Math.floor((app.screen.height - contentH * scale) / 2);
  };
  fit();

  app.stage.addChild(container);
  const onResize = () => fit();
  app.renderer.on('resize', onResize);

  return () => {
    dead = true; // a late mural resolve must not touch the destroyed container
    // Defensive: a theme remount can destroy `app` before this teardown runs
    // (the renderer/stage go null) — don't throw on a stale handle.
    try {
      app.renderer?.off('resize', onResize);
    } catch {
      /* app already torn down */
    }
    try {
      container.destroy({ children: true });
    } catch {
      /* already destroyed with the stage */
    }
  };
}
