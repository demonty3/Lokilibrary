import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';

// E2E debug hook (scripts/e2e/). Gated to dev + `VITE_E2E=1` builds; the
// condition is statically false in the shipped build, so the dynamic import is
// dead-code-eliminated and `window.__loki` never reaches users.
if (import.meta.env.DEV || import.meta.env.VITE_E2E) {
  void import('./debug/e2eHook').then((m) => m.installE2EHook());
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
