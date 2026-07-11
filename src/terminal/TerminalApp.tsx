/**
 * T0 spike — React shell for a snapping-terminal window
 * (docs/PRD-snapping-terminals.md). Mounted by main.tsx instead of <App/>
 * when the URL carries `?terminal=<id>&wing=<wing>` (set by the Electron
 * terminals broker). Deliberately none of App.tsx's machinery: no store,
 * no auth, no panes, no wallpaper — a terminal is one side-on land plus
 * the broker wiring inside mountTerminalLand.
 */

import { useEffect, useRef } from 'react';
import { getById } from '../themes';
import { mountTerminalLand } from './terminalLand';

/** Terminals default to the phosphor palette (the near-black saturated
 *  look); ?theme= overrides for side-by-side comparisons. */
const TERMINAL_THEME = 'phosphor';

export function TerminalApp() {
  const host = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const terminalId = params.get('terminal') ?? 't1';
    const wing = params.get('wing') ?? 'd0';
    const themeId = params.get('theme') ?? TERMINAL_THEME;

    document.title = `${wing} — ${terminalId}`;

    let teardown: (() => void) | null = null;
    let cancelled = false;
    void (async () => {
      if (!host.current) return;
      const fn = await mountTerminalLand(host.current, getById(themeId), terminalId, wing);
      if (cancelled) fn();
      else teardown = fn;
    })();
    return () => {
      cancelled = true;
      teardown?.();
    };
  }, []);

  return <div ref={host} style={{ position: 'fixed', inset: 0 }} />;
}
