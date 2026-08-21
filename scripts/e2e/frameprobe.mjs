// Frame-time probe: attach to one terminal renderer target, sample rAF deltas.
import { WebSocket } from 'ws';
const PORT = 9222;
const [id, framesArg] = process.argv.slice(2);
const FRAMES = Number(framesArg || 240);

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

const expr = `(async()=>{
  const N=${FRAMES};
  const ds=[];
  await new Promise((done)=>{
    let last=null,n=0;
    const step=(ts)=>{ if(last!==null) ds.push(ts-last); last=ts; if(++n>=N) return done(); requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
  ds.sort((a,b)=>a-b);
  const q=(p)=>ds[Math.min(ds.length-1,Math.floor(ds.length*p))];
  const mean=ds.reduce((a,b)=>a+b,0)/ds.length;
  const g=(window.__terminal&&window.__terminal.debugThrottle)?window.__terminal.debugThrottle():null;
  return JSON.stringify({
    id:${JSON.stringify(id)},
    screen:{w:innerWidth,h:innerHeight,dpr:devicePixelRatio},
    cols:Math.floor(innerWidth/12), rows:Math.floor(innerHeight/26),
    cells:Math.floor(innerWidth/12)*Math.floor(innerHeight/26),
    frames:ds.length, mean:+mean.toFixed(2), p50:+q(0.5).toFixed(2), p95:+q(0.95).toFixed(2), max:+ds[ds.length-1].toFixed(2),
    over16_7:ds.filter(d=>d>16.7).length, throttle:g
  });
})()`;
const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
if (r.exceptionDetails) { console.error(r.exceptionDetails.text || JSON.stringify(r.exceptionDetails)); process.exit(1); }
console.log(r.result.value);
ws.close();
