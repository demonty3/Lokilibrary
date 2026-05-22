import { Application, BitmapText } from 'pixi.js';
import type { Theme } from '../themes/types';
import {
  COZETTE_FONT_FAMILY,
  COZETTE_FONT_SIZE,
  hexToInt,
  waitForCozette,
} from './fonts';

/**
 * Phase 1 PixiJS bootstrap. Mounts a PIXI.Application into the given DOM
 * container, paints the theme background, and renders a box-drawing-glyph
 * panel using the Cozette bitmap font (woff2 + CSS @font-face from
 * index.html; PixiJS v8's BitmapText lazily bakes the atlas).
 *
 * Phase 1C/1D promotes this into a level router (cell / district / stub)
 * driven by the Zustand `scale` slice; for Phase 1B the panel still just
 * proves the bitmap font path works end-to-end.
 */
export async function mountPalace(
  container: HTMLDivElement,
  theme: Theme,
): Promise<() => void> {
  const app = new Application();
  await app.init({
    resizeTo: container,
    background: theme.palette.bg,
    antialias: false,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });

  container.appendChild(app.canvas);

  await waitForCozette();

  const panel = new BitmapText({
    text:
      '╔══════════════════════════════════════╗\n' +
      '║                                      ║\n' +
      '║         memory palace                ║\n' +
      '║         phase 1B                     ║\n' +
      '║                                      ║\n' +
      `║         theme: ${theme.id.padEnd(22)}║\n` +
      '║                                      ║\n' +
      '╚══════════════════════════════════════╝',
    style: {
      fontFamily: COZETTE_FONT_FAMILY,
      fontSize: COZETTE_FONT_SIZE,
      fill: hexToInt(theme.palette.fg),
    },
  });
  app.stage.addChild(panel);

  const position = () => {
    panel.x = Math.floor((app.screen.width - panel.width) / 2);
    panel.y = Math.floor((app.screen.height - panel.height) / 2);
  };
  position();
  app.renderer.on('resize', position);

  return () => {
    app.renderer.off('resize', position);
    // app.destroy(true, …) detaches the canvas from the DOM and nulls the
    // renderer. Don't reach for app.canvas afterwards — the getter throws.
    app.destroy(true, { children: true, texture: true });
  };
}
