/**
 * The anonymous player key (docs/plans/roguelike-tactics/architecture.md,
 * D4): a random secret the browser makes once and sends as
 * `Authorization: Bearer <key>`. The server keeps only its SHA-256 hash.
 */

const KEY_FORMAT = /^[A-Za-z0-9_-]{32,128}$/;

/** The SHA-256 hex of the request's player key, or null if it has none (or a malformed one). */
export async function playerKeyHash(request: Request): Promise<string | null> {
  const match = request.headers.get('Authorization')?.match(/^Bearer (\S+)$/);
  const key = match?.[1];
  if (!key || !KEY_FORMAT.test(key)) return null;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
