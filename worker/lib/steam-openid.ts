/**
 * Steam OpenID 2.0 — the standard handshake SPEC §7.1 names.
 *
 *   1. We redirect the browser to Steam's checkid_setup endpoint.
 *   2. Steam authenticates the user and redirects back to our return_to URL
 *      with signed openid.* params.
 *   3. We verify by re-POSTing those params (only openid.mode changes, to
 *      `check_authentication`). Steam returns `is_valid:true` if the signature
 *      it issued is genuine. We MUST forward the params byte-for-byte —
 *      including the original encoding — or Steam's signature check fails.
 *   4. The Steam ID is the trailing 17 digits of openid.claimed_id.
 *
 * STEAM_WEB_API_KEY is NOT used here — OpenID is a public protocol. The key
 * starts being load-bearing at slice 2 (GetOwnedGames).
 */

const STEAM_OPENID = 'https://steamcommunity.com/openid/login';
const CLAIMED_ID_RE = /^https?:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/;

export function buildSteamLoginUrl(returnTo: string, realm: string): string {
  const params = new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'checkid_setup',
    'openid.return_to': returnTo,
    'openid.realm': realm,
    'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
  });
  return `${STEAM_OPENID}?${params.toString()}`;
}

export type VerifyResult =
  | { ok: true; steamId: string }
  | { ok: false; reason: string };

export async function verifySteamReturn(returnParams: URLSearchParams): Promise<VerifyResult> {
  const claimedId = returnParams.get('openid.claimed_id');
  if (!claimedId) return { ok: false, reason: 'missing claimed_id' };

  const body = new URLSearchParams();
  for (const [k, v] of returnParams) body.append(k, v);
  body.set('openid.mode', 'check_authentication');

  const res = await fetch(STEAM_OPENID, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) return { ok: false, reason: `steam ${res.status}` };

  const text = await res.text();
  if (!/is_valid\s*:\s*true/i.test(text)) {
    return { ok: false, reason: 'steam returned is_valid:false' };
  }

  const m = CLAIMED_ID_RE.exec(claimedId);
  if (!m) return { ok: false, reason: 'claimed_id format mismatch' };
  return { ok: true, steamId: m[1] };
}
