// CPU-headroom probe: TaskDuration delta over a fixed wall window, per target.
// rAF deltas are vsync-locked so they only reveal FAILURE; this reveals MARGIN.
import { WebSocket } from 'ws';
const PORT = 9222;
const [id, secsArg] = process.argv.slice(2);
const SECS = Number(secsArg || 6);

const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const t = list.find((x) => x.type === 'page' && x.url.includes(`terminal=${id}`));
if (!t) { console.error('no target for', id); process.exit(1); }

const ws = new WebSocket(t.webSocketDebuggerUrl, { perMessageDeflate: false });
await new Promise((r, j) => { ws.once('open', r); ws.once('error', j); });
let nid = 1;
const send = (method, params) => new Promise((res, rej) => {
  const mid = ++nid;
  const on = (d) => { const m = JSON.parse(d.toString()); if (m.id !== mid) return; ws.off('message', on); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); };
  ws.on('message', on); ws.send(JSON.stringify({ id: mid, method, params }));
});

const pick = (ms) => Object.fromEntries(ms.metrics.map((m) => [m.name, m.value]));
await send('Performance.enable', {});
const a = pick(await send('Performance.getMetrics', {}));
await new Promise((r) => setTimeout(r, SECS * 1000));
const b = pick(await send('Performance.getMetrics', {}));

const wall = b.Timestamp - a.Timestamp;
const task = b.TaskDuration - a.TaskDuration;
const script = b.ScriptDuration - a.ScriptDuration;
const layout = b.LayoutDuration - a.LayoutDuration;
const frames = b.Frames !== undefined ? b.Frames - a.Frames : null;
console.log(JSON.stringify({
  id, wallS: +wall.toFixed(2), frames,
  cpuS: +task.toFixed(3), scriptS: +script.toFixed(3), layoutS: +layout.toFixed(3),
  cpuPctOfWall: +((task / wall) * 100).toFixed(1),
  msPerFrame: frames ? +((task / frames) * 1000).toFixed(2) : null,
  budgetPctOf16_7: frames ? +(((task / frames) * 1000 / 16.7) * 100).toFixed(1) : null,
  nodes: b.Nodes, jsHeapMB: +(b.JSHeapUsedSize / 1e6).toFixed(1),
}));
ws.close();
