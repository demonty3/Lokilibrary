/**
 * Floating "[E] play {name}" prompt above a bookshelf. The cell
 * renderer instantiates one of these when the player walks adjacent
 * to a known-game shelf and destroys it when the player steps away
 * or the prompt's target changes.
 *
 * Positioning: prompt sits one cell-row ABOVE the shelf (negative Y
 * in pixel space). If the shelf is already at the top row, we fall
 * back to one cell below — better than rendering off-screen. The
 * prompt's container is a child of the cell's agentLayer so it
 * inherits the integer-scale-to-fit transform.
 */

import { BitmapText, Container } from 'pixi.js';
import type { CellPoint } from '../../procedural/cell';
import type { Theme } from '../../themes/types';
import {
  COZETTE_CELL_HEIGHT,
  COZETTE_CELL_WIDTH,
  COZETTE_FONT_FAMILY,
  COZETTE_FONT_SIZE,
  hexToInt,
} from '../fonts';

export interface BookshelfPromptHandle {
  /** Currently-shown shelf position. Cell renderer compares against
   *  the adjacency-check result to decide whether to re-spawn. */
  readonly slot: CellPoint;
  /** Currently-shown game name. */
  readonly name: string;
  /** Remove the BitmapText + Container from the parent. Idempotent. */
  destroy(): void;
}

export interface MountPromptOptions {
  parent: Container;
  theme: Theme;
  slot: CellPoint;
  name: string;
  /** Maximum characters in the name before truncation with "…". The
   *  bookshelf prompt visually occupies ~6-12 cells, depending on
   *  cell scale; long names like "Disco Elysium - The Final Cut" wrap
   *  to a second line otherwise. */
  maxNameChars?: number;
}

const DEFAULT_MAX_NAME_CHARS = 16;

export function mountBookshelfPrompt(opts: MountPromptOptions): BookshelfPromptHandle {
  const container = new Container();
  // Always sit one row above the shelf; if shelf is at y=0, drop below.
  const promptY = opts.slot.y === 0 ? opts.slot.y + 1 : opts.slot.y - 1;
  container.x = opts.slot.x * COZETTE_CELL_WIDTH - COZETTE_CELL_WIDTH; // shift left so '[E]' frames the shelf column
  container.y = promptY * COZETTE_CELL_HEIGHT;

  const maxChars = opts.maxNameChars ?? DEFAULT_MAX_NAME_CHARS;
  const truncated = opts.name.length > maxChars
    ? `${opts.name.slice(0, maxChars - 1)}…`
    : opts.name;

  const text = new BitmapText({
    text: `[E] play ${truncated}`,
    style: {
      fontFamily: COZETTE_FONT_FAMILY,
      fontSize: COZETTE_FONT_SIZE,
      fill: hexToInt(opts.theme.palette.fgBright),
    },
  });
  container.addChild(text);
  opts.parent.addChild(container);

  let destroyed = false;
  return {
    slot: opts.slot,
    name: opts.name,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      container.destroy({ children: true });
    },
  };
}
