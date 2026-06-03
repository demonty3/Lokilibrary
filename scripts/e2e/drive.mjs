#!/usr/bin/env node
// Driver for the E2E harness (scripts/e2e/run.sh). Connects to the headless
// Chrome CDP endpoint, ensures the preview page is loaded with the
// `window.__loki` hook, and exposes verbs that read/drive the REAL app
// singletons (never `import('/src/…')`, which Vite dev splits into separate
// instances).
//
//   node drive.mjs state                  → store + per-pane players + PIXI scene
//   node drive.mjs split [vertical|horizontal]
//   node drive.mjs region <paneId> <wing> → setPaneRegion (e.g. region p2 d0)
//   node drive.mjs level  <paneId> <lvl>  → setPaneLevel
//   node drive.mjs key <Key> [n]          → REAL CDP key events (proper codes)
//   node drive.mjs eval "<js with __loki>"→ evaluate an expression in the page
//   node drive.mjs shot <out.png>         → Page.captureScreenshot (works headless)

import fs from 'node:fs';

const PORT = process.env.LOKI_E2E_CDP || '9334';
const URL = `http://localhost:${process.env.LOKI_E2E_PORT || '4173'}/`;
const [verb, a1, a2] = process.argv.slice(2);

async function connect() {
  const list = await (await fetch(`http://localhost:${PORT}/json/list`)).json();
  const page = list.find((t) => t.type === 'page');
  if (!page) throw new Error(`no page target on :${PORT} (run scripts/e2e/run.sh first)`);
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('ws connect failed')); });
  let id = 1;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); }
  };
  const send = (method, params = {}) => new Promise((res, rej) => { pending.set(id, { resolve: res, reject: rej }); ws.send(JSON.stringify({ id: id++, method, params })); });
  await send('Page.enable'); await send('Runtime.enable');
  return { send, close: () => ws.close() };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function evalPage(send, expression, awaitPromise = true) {
  const r = await send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}

async function ensureLoaded(send) {
  const has = await evalPage(send, `!!(window.__loki && document.querySelector('canvas') && location.href.startsWith(${JSON.stringify(URL)}))`);
  if (has) return;
  await send('Page.navigate', { url: URL });
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    const ready = await evalPage(send, `!!(window.__loki && document.querySelector('canvas'))`).catch(() => false);
    if (ready) { await sleep(2000); return; } // let PixiApp boot + first render settle
  }
  throw new Error('page never exposed window.__loki + canvas (is VITE_E2E build served?)');
}

// DOM code + shift for a key, so real CDP key events reach the app's handler.
function keyParams(key) {
  if (/^[a-zA-Z]$/.test(key)) return { code: 'Key' + key.toUpperCase(), mods: 0, text: key };
  const map = { '|': ['Backslash', 8], '\\': ['Backslash', 0], '[': ['BracketLeft', 0], ']': ['BracketRight', 0], '\t': ['Tab', 0] };
  const [code, mods] = map[key] || [key, 0];
  return { code, mods, text: key.length === 1 ? key : undefined };
}

async function main() {
  const { send, close } = await connect();
  try {
    await ensureLoaded(send);
    if (verb === 'state') {
      console.log(JSON.stringify(JSON.parse(await evalPage(send, `JSON.stringify(window.__loki.snapshot())`)), null, 1));
    } else if (verb === 'split') {
      await evalPage(send, `window.__loki.store.getState().splitPane(${JSON.stringify(a1 || 'vertical')})`);
      await sleep(2200);
      console.log(await evalPage(send, `JSON.stringify(window.__loki.snapshot().panes)`));
    } else if (verb === 'region') {
      await evalPage(send, `window.__loki.store.getState().setPaneRegion(${JSON.stringify(a1)}, ${JSON.stringify(a2)})`);
      await sleep(2200);
      console.log(await evalPage(send, `JSON.stringify(window.__loki.snapshot().panes)`));
    } else if (verb === 'level') {
      await evalPage(send, `window.__loki.store.getState().setPaneLevel(${JSON.stringify(a1)}, ${JSON.stringify(a2)})`);
      await sleep(2200);
      console.log(await evalPage(send, `JSON.stringify(window.__loki.snapshot().panes)`));
    } else if (verb === 'key') {
      const n = Number(a2 || 1);
      const { code, mods, text } = keyParams(a1);
      // Click the canvas first so focus is unambiguous.
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 700, y: 400, button: 'left', clickCount: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 700, y: 400, button: 'left', clickCount: 1 });
      for (let i = 0; i < n; i++) {
        await send('Input.dispatchKeyEvent', { type: 'keyDown', key: a1, code, text, modifiers: mods });
        await send('Input.dispatchKeyEvent', { type: 'keyUp', key: a1, code, modifiers: mods });
        await sleep(2200);
      }
      console.log(`dispatched '${a1}' ×${n}`);
    } else if (verb === 'eval') {
      console.log(JSON.stringify(await evalPage(send, `(()=>{const __loki=window.__loki; return (${a1});})()`)));
    } else if (verb === 'shot') {
      const out = a1 || '/tmp/loki-e2e.png';
      const { data } = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(out, Buffer.from(data, 'base64'));
      console.log(`wrote ${out}`);
    } else {
      console.error('usage: drive.mjs state | split | region <pane> <wing> | level <pane> <lvl> | key <Key> [n] | eval <expr> | shot <out>');
      process.exitCode = 2;
    }
  } finally {
    close();
  }
}

main().catch((e) => { console.error('error:', e.message); process.exit(1); });
