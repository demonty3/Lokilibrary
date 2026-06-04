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

/** Role -> theme palette key. The whole point of the side-on look: layers
 *  separate by hue, not by glyph density. */
const ROLE_KEY: Record<LandRole, keyof Theme['palette']> = {
  sky: 'bg',
  star: 'fgDim',
  sun: 'yellow',
  cloud: 'fgDim',
  ridge: 'bgAlt',
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
 *  space (origin 0,0); the caller positions + scales it. */
export function buildLandContainer(theme: Theme, model: LandModel): {
  container: Container;
  contentW: number;
  contentH: number;
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

  for (const r of roles) {
    const rows: string[] = [];
    for (let y = 0; y < model.height; y++) {
      let line = '';
      for (let x = 0; x < model.width; x++) line += model.role[y][x] === r ? model.char[y][x] : ' ';
      rows.push(line.replace(/\s+$/u, ''));
    }
    const text = rows.join('\n');
    if (!text.trim()) continue;
    const layer = new BitmapText({
      text,
      style: { fontFamily: COZETTE_FONT_FAMILY, fontSize: COZETTE_FONT_SIZE, fill: hexToInt(theme.palette[ROLE_KEY[r]]) },
    });
    container.addChild(layer);
  }

  return { container, contentW, contentH };
}

export interface MountLandOptions {
  readonly seed?: number;
  readonly games?: readonly LandGame[];
}

/**
 * PROTOTYPE mount — compose + tint a land and drop it full-screen onto the
 * stage (above everything). Returns a teardown. For harness screenshots only;
 * not wired into the pane system yet.
 */
export function mountLandPreview(app: Application, theme: Theme, opts: MountLandOptions = {}): () => void {
  const model = composeLand(opts.seed ?? 0xca11ed, opts.games);
  const { container, contentW, contentH } = buildLandContainer(theme, model);

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
