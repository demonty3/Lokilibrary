#!/usr/bin/env node
// CDP driver for the Lokilibrary Electron desktop app.
//
// Connects to the app's renderer over the Chrome DevTools Protocol (the app
// must have been launched with --remote-debugging-port=9222, which launch.sh
// does). Gives you four verified verbs plus a screenshot verb:
//
//   node drive.mjs state                 → print the live Zustand store state
//   node drive.mjs eval "<js expr>"      → evaluate an expression in the page
//   node drive.mjs key <KeyName> [n]     → dispatch a key n times (default 1)
//   node drive.mjs window | wallpaper    → flip the desktop window mode (IPC)
//   node drive.mjs shot <out.png>        → native screencapture of the window
//
// Why these mechanics (so you can extend it safely):
//   * State is read by dynamically importing the Vite-served ES source
//     (`/src/state/store.ts`) IN the page — no need to expose the store on
//     window. This is how we verified region cycling end-to-end.
//   * Keybinds are gated by `wallpaperMode` in App.tsx (the wallpaper layer
//     never consumes input), so `key` only does anything in WINDOW mode. Run
//     `node drive.mjs window` first if the app booted as a wallpaper.
//   * Screenshots use the macOS `screencapture` CLI against the window's
//     on-screen bounds — NOT CDP Page.captureScreenshot, which hangs on this
//     app (hardware-GPU surface stall) and renders blank under --disable-gpu /
//     SwiftShader because PixiJS's WebGL context then fails to create.
//     `screencapture` needs a one-time Screen Recording grant for the
//     terminal/host app (System Settings → Privacy & Security → Screen
//     Recording), else it errors "could not create image from display".

import { execFileSync } from 'node:child_process';

const PORT = process.env.LOKI_CDP_PORT || '9222';
const [verb, arg1, arg2] = process.argv.slice(2);

async function connect() {
  const list = await (await fetch(`http://localhost:${PORT}/json/list`)).json();
  const page = list.find((t) => t.type === 'page');
  if (!page) throw new Error(`no page target on :${PORT} — is the app running with --remote-debugging-port=${PORT}?`);
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('ws connect failed')); });
  let id = 1;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
    }
  };
  const send = (method, params = {}) =>
    new Promise((res, rej) => { pending.set(id, { resolve: res, reject: rej }); ws.send(JSON.stringify({ id: id++, method, params })); });
  await send('Runtime.enable');
  await send('Page.enable');
  return { send, close: () => ws.close() };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function evalInPage(send, expression, awaitPromise = true) {
  const r = await send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text || 'eval threw');
  return r.result.value;
}

async function main() {
  const { send, close } = await connect();
  try {
    if (verb === 'state') {
      const v = await evalInPage(send, `(async()=>{const {useAppStore}=await import('/src/state/store.ts');const s=useAppStore.getState();const f=s.panes.find(p=>p.id===s.focusedPaneId);return JSON.stringify({wallpaper:s.wallpaperMode,throttle:s.throttleState,level:f&&f.level,region:(f&&f.regionId)||null,focusedPane:s.focusedPaneId,panes:s.panes.length});})()`);
      console.log(v);
    } else if (verb === 'eval') {
      console.log(JSON.stringify(await evalInPage(send, `(async()=>{return (${arg1});})()`)));
    } else if (verb === 'key') {
      const n = Number(arg2 || 1);
      // App.tsx reads e.key; supply a sensible code/text for letters + brackets.
      const key = arg1;
      const code = /^[a-zA-Z]$/.test(key) ? 'Key' + key.toUpperCase() : key;
      for (let i = 0; i < n; i++) {
        await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, text: key.length === 1 ? key : undefined });
        await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code });
        await sleep(2200); // a region/level remount needs WFC + cohort respawn
      }
      console.log(`dispatched '${key}' ×${n}`);
    } else if (verb === 'window' || verb === 'wallpaper') {
      const ok = await evalInPage(send, `(async()=>{const {ipcRenderer}=require('electron');return await ipcRenderer.invoke('wallpaper:setMode','${verb}');})()`);
      await sleep(1500);
      console.log(`setMode('${verb}') -> ${ok}`);
    } else if (verb === 'shot') {
      const out = arg1 || '/tmp/loki-shot.png';
      // Capture the app's OWN window by CGWindowID, not a screen region —
      // `screencapture -l<id>` grabs that window's bitmap regardless of z-order,
      // so an overlapping window can't land in the shot. The id comes from the
      // bundled Swift helper (largest "Electron"-owned on-screen window).
      const here = new URL('.', import.meta.url).pathname;
      let wid;
      try {
        wid = execFileSync('swift', [`${here}winid.swift`, process.env.LOKI_APP_OWNER || 'Electron'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
      } catch {
        console.error('could not resolve the app window id (is the app on-screen, in window mode? run `drive.mjs window`).');
        process.exitCode = 1; return;
      }
      try {
        execFileSync('screencapture', ['-x', `-l${wid}`, out], { stdio: 'pipe' });
        console.log(`wrote ${out} (window id ${wid})`);
      } catch (e) {
        console.error(`screencapture failed: ${String(e.stderr || e.message).trim()}`);
        console.error('→ Grant Screen Recording to your terminal/host app (System Settings → Privacy & Security → Screen Recording) and relaunch it.');
        process.exitCode = 1;
      }
    } else {
      console.error('usage: drive.mjs state | eval <expr> | key <Key> [n] | window | wallpaper | shot <out.png>');
      process.exitCode = 2;
    }
  } finally {
    close();
  }
}

main().catch((e) => { console.error('error:', e.message); process.exit(1); });
