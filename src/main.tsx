import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { TerminalApp } from './terminal/TerminalApp';

// T0 spike — snapping-terminals mode (docs/PRD-snapping-terminals.md).
// The Electron terminals broker loads each window with ?terminal=<id>&wing=…;
// such windows mount the standalone terminal land instead of the palace.
const isTerminalWindow = new URLSearchParams(window.location.search).has('terminal');

// E2E debug hook (scripts/e2e/). Gated to dev + `VITE_E2E=1` builds; the
// condition is statically false in the shipped build, so the dynamic import is
// dead-code-eliminated and `window.__loki` never reaches users. Terminal
// windows skip it — they expose their own `window.__terminal` surface.
if (!isTerminalWindow && (import.meta.env.DEV || import.meta.env.VITE_E2E)) {
  void import('./debug/e2eHook').then((m) => m.installE2EHook());
}

// Terminal windows render OUTSIDE StrictMode: its dev double-effect runs two
// concurrent async land mounts whose interleaved teardown can delete the
// survivor's `__terminal`/roster registrations (the palace's mount is
// idempotent against this; the terminal spike keeps it simple instead).
ReactDOM.createRoot(document.getElementById('root')!).render(
  isTerminalWindow ? (
    <TerminalApp />
  ) : (
    <React.StrictMode>
      <App />
    </React.StrictMode>
  ),
);
