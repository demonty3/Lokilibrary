/**
 * UUIDv7 generator. Lexicographically sortable by creation time — gives
 * `ORDER BY id DESC` the same ordering as `ORDER BY created_at DESC`
 * without a separate index, and lets the vault filename
 * `<created_at>--<kind>--<uuid>.md` collate naturally.
 *
 * Layout (RFC 9562 §5.7):
 *   - 48 bits unix-ms
 *   - 4 bits version (7)
 *   - 12 bits sub-ms random
 *   - 2 bits variant (10)
 *   - 62 bits random
 *
 * Per-process monotonic counter ensures uuids generated within the same
 * ms stay ordered — without it, two memories recorded in the same tick
 * could swap in iteration order across restarts.
 */

let lastMs = 0;
let subMsCounter = 0;

function randomByte(): number {
  // crypto.getRandomValues is available in both Node 18+ and browsers.
  const buf = new Uint8Array(1);
  crypto.getRandomValues(buf);
  return buf[0];
}

function randomBytes(n: number): Uint8Array {
  const buf = new Uint8Array(n);
  crypto.getRandomValues(buf);
  return buf;
}

export function uuidv7(): string {
  const now = Date.now();
  if (now === lastMs) {
    subMsCounter = (subMsCounter + 1) & 0xfff;
  } else {
    lastMs = now;
    subMsCounter = randomByte() & 0xfff;
  }

  // 16 bytes total.
  const bytes = new Uint8Array(16);
  // Bytes 0..5 — 48-bit big-endian timestamp.
  // JS bitops are 32-bit; split high/low.
  const tHigh = Math.floor(now / 0x100000000);
  const tLow = now >>> 0;
  bytes[0] = (tHigh >>> 8) & 0xff;
  bytes[1] = tHigh & 0xff;
  bytes[2] = (tLow >>> 24) & 0xff;
  bytes[3] = (tLow >>> 16) & 0xff;
  bytes[4] = (tLow >>> 8) & 0xff;
  bytes[5] = tLow & 0xff;
  // Bytes 6..7 — version (4 bits) + sub-ms counter (12 bits).
  bytes[6] = 0x70 | ((subMsCounter >> 8) & 0x0f);
  bytes[7] = subMsCounter & 0xff;
  // Bytes 8..15 — variant (2 bits) + 62 bits random.
  const tail = randomBytes(8);
  bytes[8] = (tail[0] & 0x3f) | 0x80;
  for (let i = 1; i < 8; i++) bytes[8 + i] = tail[i];

  return formatHex(bytes);
}

function formatHex(bytes: Uint8Array): string {
  const hex: string[] = [];
  for (let i = 0; i < bytes.length; i++) {
    hex.push(bytes[i].toString(16).padStart(2, '0'));
  }
  return (
    hex.slice(0, 4).join('') +
    '-' +
    hex.slice(4, 6).join('') +
    '-' +
    hex.slice(6, 8).join('') +
    '-' +
    hex.slice(8, 10).join('') +
    '-' +
    hex.slice(10, 16).join('')
  );
}
