import { Application, Text, TextStyle } from 'pixi.js';
import type { Theme } from '../themes/types';

/**
 * Phase 0 PixiJS bootstrap. Mounts a PIXI.Application into the given DOM
 * container, paints the theme background, and renders a box-drawing-glyph
 * panel using a system monospace font.
 *
 * Phase 1 swaps the system font for a bitmap font (PIXI.BitmapText) so the
 * pixel grid is locked and palette swaps are JSON-cheap. For Commit 2 the
 * only goal is: PixiJS boots in Electron + browser, renders unicode, and
 * tears down cleanly on hot-reload.
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

  const style = new TextStyle({
    fontFamily: 'ui-monospace, "Cascadia Mono", "Fira Code", monospace',
    fontSize: 18,
    fill: theme.palette.fg,
    lineHeight: 22,
    whiteSpace: 'pre',
  });

  const panel = new Text({
    text:
      '╔══════════════════════════════════════╗\n' +
      '║                                      ║\n' +
      '║         memory palace                ║\n' +
      '║         phase 0 spike                ║\n' +
      '║                                      ║\n' +
      `║         theme: ${theme.id.padEnd(22)}║\n` +
      '║                                      ║\n' +
      '╚══════════════════════════════════════╝',
    style,
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
