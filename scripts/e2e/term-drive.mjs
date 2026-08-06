/**
 * Drive a TERMINAL window of the running desk over CDP (the launch-desktop-app
 * skill's drive.mjs targets the palace's mainWindow; the desk's windows are
 * separate renderer targets keyed by `?terminal=<id>`).
 *
 * Usage:
 *   node scripts/e2e/term-drive.mjs t1 'JSON.stringify(__terminal.debugLaunch())'
 *   node scripts/e2e/term-drive.mjs list
 *
 * The expression is evaluated in the terminal renderer with awaitPromise, so
 * `__terminal.*` debug hooks are directly reachable.
 */
import { WebSocket } from 'ws';

const PORT = 9222;

async function targets() {
  const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
  return (await r.json()).filter((t) => t.type === 'page' && t.url.includes('terminal='));
}

/** Send raw CDP commands, then evaluate. `moves` are real browser-level mouse
 *  events (Input.dispatchMouseEvent) — the only way to test pointer geometry
 *  honestly: a synthetic PointerEvent's offsetX is not the page's own. */
async function evalIn(target, expr, moves = []) {
  const ws = new WebSocket(target.webSocketDebuggerUrl, { perMessageDeflate: false });
  await new Promise((res, rej) => {
    ws.once('open', res);
    ws.once('error', rej);
  });
  let nextId = 1;
  const send = (method, params) =>
    new Promise((res, rej) => {
      const id = ++nextId + 100;
      const onMsg = (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.id !== id) return;
        ws.off('message', onMsg);
        msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result);
      };
      ws.on('message', onMsg);
      ws.send(JSON.stringify({ id, method, params }));
    });
  for (const [x, y, type] of moves) {
    await send('Input.dispatchMouseEvent', {
      type: type ?? 'mouseMoved',
      x,
      y,
      button: type === 'mousePressed' || type === 'mouseReleased' ? 'left' : 'none',
      clickCount: type === 'mousePressed' || type === 'mouseReleased' ? 1 : 0,
      buttons: 0,
    });
  }
  const out = await new Promise((res, rej) => {
    const id = 1;
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id !== id) return;
      if (msg.error) rej(new Error(JSON.stringify(msg.error)));
      else if (msg.result?.exceptionDetails) rej(new Error(JSON.stringify(msg.result.exceptionDetails)));
      else res(msg.result.result.value);
    });
    ws.send(JSON.stringify({
      id,
      method: 'Runtime.evaluate',
      params: { expression: expr, awaitPromise: true, returnByValue: true },
    }));
    setTimeout(() => rej(new Error('timeout')), Number(process.env.TERM_DRIVE_TIMEOUT_MS ?? 15000));
  });
  ws.close();
  return out;
}

const [which, expr] = process.argv.slice(2);
const list = await targets();
if (which === 'list' || !which) {
  console.log(list.map((t) => `${t.url.match(/terminal=(\w+)/)[1]}  ${t.title}`).join('\n'));
  process.exit(0);
}
const target = list.find((t) => t.url.includes(`terminal=${which}`));
if (!target) {
  console.error(`no terminal target "${which}" (have: ${list.map((t) => t.url).join(', ')})`);
  process.exit(1);
}
// Optional trailing arg: JSON array of [x, y, type?] mouse events to dispatch
// (real input) before the expression runs.
const moves = process.argv[4] ? JSON.parse(process.argv[4]) : [];
console.log(await evalIn(target, expr, moves));
