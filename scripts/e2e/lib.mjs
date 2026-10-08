/** Small shared helpers for the e2e suites (no test framework needed). */

export const API_URL = process.env.E2E_API_URL ?? 'http://127.0.0.1:8787';
export const WEB_URL = process.env.E2E_WEB_URL ?? 'http://localhost:3000';
export const OUT_DIR = process.env.E2E_OUT_DIR ?? 'e2e-results';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
export function check(name, cond, detail) {
  if (cond) console.log('  ✓', name);
  else {
    failures++;
    console.log('  ✗', name, detail === undefined ? '' : JSON.stringify(detail));
  }
}

export function finish() {
  console.log(failures ? `  ${failures} check(s) failed` : '  all checks passed');
  process.exit(failures ? 1 : 0);
}

export async function createPokerRoom(hostName) {
  const res = await fetch(`${API_URL}/rooms`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({hostName, serverSystem: 'PokerServerSystem', maxPlayers: 6}),
  });
  if (!res.ok) throw new Error(`create room failed: ${res.status} ${await res.text()}`);
  return (await res.json()).roomId;
}
