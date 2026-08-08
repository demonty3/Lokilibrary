/**
 * Sweep the world clock across EVERY terminal window on the desk, so a capture
 * can show the daylight sky register travelling (docs/superpowers/specs/
 * 2026-08-08-daylight-sky-register-design.md).
 *
 * Usage:
 *   node scripts/e2e/clock-sweep.mjs <fromHour> <toHour> <seconds> [stepMs]
 *   node scripts/e2e/clock-sweep.mjs 3.5 13 12          # night -> full day over 12s
 *   node scripts/e2e/clock-sweep.mjs --release          # hand the desk back to real time
 *
 * Why one process rather than a shell loop: each `term-drive` invocation pays a
 * fresh CDP connect (~200ms per window), which at demo cadence would visibly
 * stutter the sweep. This connects once per window and holds the sockets open.
 *
 * Every window is driven with the SAME hour on the same tick. They would agree
 * anyway — the clock derives from the wall clock in each renderer, with no
 * broker — but a forced hour is per-window state, so a sweep has to set them
 * all or a joined desk would show two different times of day across a seam.
 */
import { WebSocket } from 'ws';

const PORT = process.env.LOKI_CDP_PORT || '9222';
const args = process.argv.slice(2);
const release = args[0] === '--release';
const [from, to, secs] = release ? [0, 0, 0] : args.slice(0, 3).map(Number);
const stepMs = Number(args[3] ?? 120);

if (!release && (!Number.isFinite(from) || !Number.isFinite(to) || !Number.isFinite(secs))) {
  console.error('usage: clock-sweep.mjs <fromHour> <toHour> <seconds> [stepMs] | --release');
  process.exit(2);
}

const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const targets = list.filter((t) => t.type === 'page' && t.url.includes('terminal='));
if (targets.length === 0) {
  console.error(`no terminal windows on :${PORT} — is the desk running?`);
  process.exit(1);
}

const conns = await Promise.all(targets.map(async (t) => {
  const ws = new WebSocket(t.webSocketDebuggerUrl, { perMessageDeflate: false });
  await new Promise((res, rej) => { ws.once('open', res); ws.once('error', rej); });
  return { ws, id: (t.url.match(/terminal=(\w+)/) ?? [, '?'])[1], seq: 0 };
}));

const setHour = (h) => {
  for (const c of conns) {
    c.ws.send(JSON.stringify({
      id: ++c.seq,
      method: 'Runtime.evaluate',
      params: { expression: `window.__terminal && window.__terminal.debugClock(${h})`, returnByValue: true },
    }));
  }
};

if (release) {
  setHour(null);
  console.log(`clock released to real time on ${conns.length} window(s)`);
} else {
  const steps = Math.max(1, Math.round((secs * 1000) / stepMs));
  console.log(`sweeping ${from}h → ${to}h over ${secs}s on ${conns.length} window(s) (${steps} steps)`);
  for (let i = 0; i <= steps; i++) {
    setHour(from + ((to - from) * i) / steps);
    await new Promise((r) => setTimeout(r, stepMs));
  }
  console.log('sweep done (clock left FORCED — run with --release to hand it back)');
}
for (const c of conns) c.ws.close();
