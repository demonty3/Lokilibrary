/**
 * Shared sky (2026-08-18) — pure maths for the desk-global sky content:
 * one ☼, one ☾, and wisps that cross seams. Spec + frozen bars:
 * docs/superpowers/specs/2026-08-18-shared-sky-design.md.
 *
 * No broker, by construction: every window receives the FULL joins list +
 * wings map (applyJoins), so every window derives the same left-to-right
 * chain from the same inputs; positions run on the wall clock the same way
 * the wisps and the sway already do. Same inputs → same sky, no messages.
 *
 * Pure + Pixi-free so scripts/smoke-shared-sky.mts can run it.
 */
import { fnv1a32 } from '../procedural/seed';
import { WISP_SHAPES } from './clouds';

export interface DeskChainSpec {
  /** Terminal ids, leftmost first, of this window's horizontal chain. */
  readonly order: readonly string[];
  /** This window's position in `order`. */
  readonly index: number;
  /** The chain's wings in order — the seed for every shared pick. Wing-based
   *  rather than terminal-id-based so the sky is stable across sessions for
   *  the same arrangement of wings. */
  readonly key: string;
}

/** Walk the joins into this window's chain. Every window computes this from
 *  the same broker payload, so all agree without talking. A window with no
 *  joins is a chain of one (the shared branch is unreachable — solo control). */
export function deskChain(
  terminalId: string,
  joins: ReadonlyArray<{ left: string; right: string }>,
  wings: Readonly<Record<string, string>>,
): DeskChainSpec {
  const leftOf = new Map(joins.map((j) => [j.right, j.left] as const));
  const rightOf = new Map(joins.map((j) => [j.left, j.right] as const));
  const seen = new Set<string>([terminalId]);
  let head = terminalId;
  for (let l = leftOf.get(head); l !== undefined && !seen.has(l); l = leftOf.get(head)) {
    head = l;
    seen.add(l);
  }
  const order: string[] = [head];
  for (let r = rightOf.get(head); r !== undefined && !order.includes(r); r = rightOf.get(order[order.length - 1])) {
    order.push(r);
  }
  return {
    order,
    index: order.indexOf(terminalId),
    key: order.map((id) => wings[id] ?? id).join('>'),
  };
}

/** Which chain index draws this body. Only the host renders its ☼/☾; the
 *  others show sky. Deliberately blind to pack omissions (spec §2): only
 *  gameboy-dmg omits bodies and it is excluded from the auto-assign pool. */
export function bodyHost(key: string, role: 'sun' | 'moon', chainLen: number): number {
  return fnv1a32(`sharedSky:${key}:${role}`) % chainLen;
}

export interface SharedWisp {
  readonly row: number;
  readonly text: string;
  /** Cells per second — the judged 0.25..0.45 band (clouds.ts, 2026-08-06). */
  readonly speed: number;
  /** Starting offset in DESK cells. */
  readonly phase: number;
}

/** Rows shared wisps may ride: 1..SHARED_WISP_ROW_MAX. Row 0 is the drag
 *  strip; local occlusion (each window's own blocked spans and omissions)
 *  handles whatever else lives on the row — the world always wins, per
 *  window. */
export const SHARED_WISP_ROW_MAX = 7;

/** The desk's wisps, authored from the chain key alone: 2 per window (the
 *  composer's per-window density, preserved), positions in desk-space
 *  [0, chainLen × width) so a run exits one window's right edge as it enters
 *  the neighbour's left. */
export function sharedWisps(key: string, chainLen: number, width: number): SharedWisp[] {
  const deskW = chainLen * width;
  const out: SharedWisp[] = [];
  for (let i = 0; i < 2 * chainLen; i++) {
    const h = fnv1a32(`sharedSky:${key}:wisp:${i}`);
    const text = WISP_SHAPES[i % WISP_SHAPES.length];
    out.push({
      row: 1 + ((h >>> 8) % SHARED_WISP_ROW_MAX),
      text,
      speed: 0.25 + (h % 61) / 300,
      phase: h % (deskW + text.length),
    });
  }
  return out;
}
