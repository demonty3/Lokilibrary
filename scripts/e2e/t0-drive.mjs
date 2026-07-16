#!/usr/bin/env node
// T0 spike driver — snapping terminals (docs/PRD-snapping-terminals.md).
//
// The terminals build has MULTIPLE renderer windows, so unlike the
// launch-desktop-app driver this one picks CDP page targets by their
// `?terminal=<id>` URL. The broker's debug IPC is reachable from any
// renderer (nodeIntegration) via ipcRenderer.invoke.
//
//   node t0-drive.mjs state                       → broker debugState + each window's __terminal.state()
//   node t0-drive.mjs move <tid> <x> <y>          → debugMove a window (broker then snaps + re-joins)
//   node t0-drive.mjs place <tid> <being> <x> <d> → teleport a being (e.g. next to an open edge)
//   node t0-drive.mjs waitcross <being> [sec]     → poll roster until the being changes terminal
//   node t0-drive.mjs shot <out.png>              → screencapture of the union of all terminal bounds
//
// Launch first:  cd desktop && npx tsc && LOKILIBRARY_TERMINALS=2 \
//   LOKILIBRARY_RENDERER_URL=http://localhost:5183 \
//   ./node_modules/.bin/electron . --remote-debugging-port=9222

import { execFileSync } from 'node:child_process';

const PORT = process.env.LOKI_CDP_PORT || '9222';
const [verb, a1, a2, a3, a4] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function targets() {
  const list = await (await fetch(`http://localhost:${PORT}/json/list`)).json();
  return list.filter((t) => t.type === 'page' && t.url.includes('terminal='));
}

async function attach(target) {
  const ws = new WebSocket(target.webSocketDebuggerUrl);
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
  return { send, close: () => ws.close() };
}

async function evalIn(send, expression) {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}

/** Eval in the first terminal window (broker IPC is window-agnostic). */
async function evalAny(expression) {
  const ts = await targets();
  if (!ts.length) throw new Error('no terminal windows on CDP — launch with LOKILIBRARY_TERMINALS=2');
  const { send, close } = await attach(ts[0]);
  try { return await evalIn(send, expression); } finally { close(); }
}

const brokerState = () =>
  evalAny(`(async()=>{const {ipcRenderer}=require('electron');return await ipcRenderer.invoke('terminal:debugState');})()`);

async function main() {
  if (verb === 'state') {
    const broker = await brokerState();
    const windows = {};
    for (const t of await targets()) {
      const tid = new URL(t.url).searchParams.get('terminal');
      const { send, close } = await attach(t);
      try { windows[tid] = await evalIn(send, `window.__terminal ? window.__terminal.state() : null`); }
      finally { close(); }
    }
    console.log(JSON.stringify({ broker, windows }, null, 1));
  } else if (verb === 'move') {
    const ok = await evalAny(`(async()=>{const {ipcRenderer}=require('electron');return await ipcRenderer.invoke('terminal:debugMove',{terminalId:${JSON.stringify(a1)},x:${Number(a2)},y:${Number(a3)}});})()`);
    await sleep(400); // settle debounce + snap
    console.log(JSON.stringify({ moved: ok, joins: (await brokerState()).joins }));
  } else if (verb === 'place') {
    const ts = await targets();
    const t = ts.find((x) => new URL(x.url).searchParams.get('terminal') === a1);
    if (!t) throw new Error(`no window for terminal ${a1}`);
    const { send, close } = await attach(t);
    try {
      console.log(JSON.stringify(await evalIn(send, `window.__terminal.debugPlace(${JSON.stringify(a2)}, ${Number(a3)}, ${Number(a4)})`)));
    } finally { close(); }
  } else if (verb === 'waitcross') {
    const being = a1;
    const deadline = Date.now() + Number(a2 || 60) * 1000;
    const start = (await brokerState()).roster[being];
    if (!start) throw new Error(`being ${being} not in roster`);
    console.log(`watching ${being} (in ${start})…`);
    for (;;) {
      await sleep(700);
      const roster = (await brokerState()).roster;
      if (roster[being] !== start) { console.log(`CROSSED: ${being} ${start} → ${roster[being]}`); return; }
      if (Date.now() > deadline) { console.error(`timeout — ${being} still in ${start}`); process.exitCode = 1; return; }
    }
  } else if (verb === 'eval') {
    const ts = await targets();
    const t = ts.find((x) => new URL(x.url).searchParams.get('terminal') === a1);
    if (!t) throw new Error(`no window for terminal ${a1}`);
    const { send, close } = await attach(t);
    try { console.log(JSON.stringify(await evalIn(send, a2))); } finally { close(); }
  } else if (verb === 'shot') {
    const out = a1 || '/tmp/loki-t0.png';
    const { bounds } = await brokerState();
    const x = Math.min(...bounds.map((b) => b.x)) - 12;
    const y = Math.min(...bounds.map((b) => b.y)) - 36; // include title bars
    const w = Math.max(...bounds.map((b) => b.x + b.width)) - x + 12;
    const h = Math.max(...bounds.map((b) => b.y + b.height)) - y + 12;
    execFileSync('screencapture', ['-x', `-R${x},${y},${w},${h}`, out], { stdio: 'pipe' });
    console.log(`wrote ${out} (${w}x${h} @ ${x},${y})`);
  } else {
    console.error('usage: t0-drive.mjs state | move <tid> <x> <y> | place <tid> <being> <x> <dir> | waitcross <being> [sec] | eval <tid> <js> | shot <out.png>');
    process.exitCode = 2;
  }
}

main().catch((e) => { console.error('error:', e.message); process.exit(1); });
