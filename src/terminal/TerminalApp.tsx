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
import { mountTerminalLand } from './terminalLand';

/** Terminals default to the phosphor palette (the near-black saturated
 *  look); ?theme= overrides for side-by-side comparisons. */
const TERMINAL_THEME = 'phosphor';

const params = new URLSearchParams(window.location.search);
const TERMINAL_ID = params.get('terminal') ?? 't1';
const WING = params.get('wing') ?? 'd0';
const THEME_ID = params.get('theme') ?? TERMINAL_THEME;

/** Frameless windows need an explicit OS drag region. A thin glyph strip at
 *  the very top doubles as the title and the drag handle; the world (and any
 *  seam continuity) lives at the BOTTOM, untouched. */
const dragStrip = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  height: 20,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  font: '12px monospace',
  letterSpacing: '2px',
  color: '#8a8a8a',
  background: 'rgba(0,0,0,0.35)',
  userSelect: 'none',
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
      <div style={dragStrip}>{`┤ ${WING} ├`}</div>
      <div ref={host} style={{ position: 'fixed', inset: 0 }} />
    </div>
  );
}
