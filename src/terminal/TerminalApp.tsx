/**
 * T0 spike — React shell for a snapping-terminal window
 * (docs/PRD-snapping-terminals.md). Mounted by main.tsx instead of <App/>
 * when the URL carries `?terminal=<id>&wing=<wing>` (set by the Electron
 * terminals broker). Deliberately none of App.tsx's machinery: no store,
 * no auth, no panes, no wallpaper — a terminal is one side-on land plus
 * the broker wiring inside mountTerminalLand.
 */

import { useEffect, useRef, type CSSProperties } from 'react';
import { getById } from '../themes';
import { deskPackFor } from './packAssignment';
import { mountTerminalLand } from './terminalLand';

const params = new URLSearchParams(window.location.search);
const TERMINAL_ID = params.get('terminal') ?? 't1';
const WING = params.get('wing') ?? 'd0';
/** T3 slice 1: the pack comes from the WING, so terminals on one desk differ
 *  and the ten authored packs reach the product. `d0` still gets `phosphor`,
 *  so first boot looks like every judged shot. `?theme=` overrides, for
 *  side-by-side comparisons and for choosing a pack deliberately (that is how
 *  an omitting pack like gameboy-dmg is reached — it is excluded from the
 *  multi-window pool on purpose; see packAssignment.ts). */
const THEME_ID = params.get('theme') ?? deskPackFor(WING);

/** Frameless windows need an explicit OS drag region, and nothing else. T3
 *  slice 2 moved the title into the world (terminalLand.ts's masthead — Cozette,
 *  in this window's own pack), so the strip is now purely the drag handle:
 *  no text, no band, no ink of its own. Its height is one masthead row, so the
 *  row you see is the row you grab. The world (and any seam continuity) lives
 *  at the BOTTOM, untouched. */
const dragStrip = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  height: 26,
  zIndex: 1,
  WebkitAppRegion: 'drag',
} as unknown as CSSProperties;

export function TerminalApp() {
  const host = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    document.title = `${WING} — ${TERMINAL_ID}`;

    let teardown: (() => void) | null = null;
    let cancelled = false;
    void (async () => {
      if (!host.current) return;
      const fn = await mountTerminalLand(host.current, getById(THEME_ID), TERMINAL_ID, WING);
      if (cancelled) fn();
      else teardown = fn;
    })();
    return () => {
      cancelled = true;
      teardown?.();
    };
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <div style={dragStrip} />
      <div ref={host} style={{ position: 'fixed', inset: 0 }} />
    </div>
  );
}
