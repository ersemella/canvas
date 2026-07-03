/**
 * Uploads game manifests to the canvas-server Worker, which forwards them to
 * the ManifestRegistry Durable Object. Replaces the S3-uploader script that
 * lived under packages/infra/scripts.
 *
 * Required env vars:
 *   SERVER_URL            — Worker base URL, e.g. https://canvas-server.<acct>.workers.dev
 *   MANIFEST_ADMIN_TOKEN  — Bearer token; matches `wrangler secret put MANIFEST_ADMIN_TOKEN`
 *
 * Usage:
 *   SERVER_URL=https://canvas-server.<acct>.workers.dev \
 *   MANIFEST_ADMIN_TOKEN=… \
 *   node packages/server/scripts/upload-manifests.mjs
 */

import {readFileSync} from 'fs';
import {resolve, dirname} from 'path';
import {fileURLToPath} from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../../..');

const SERVER_URL = process.env.SERVER_URL;
const TOKEN = process.env.MANIFEST_ADMIN_TOKEN;
if (!SERVER_URL) throw new Error('SERVER_URL env var is required');
if (!TOKEN) throw new Error('MANIFEST_ADMIN_TOKEN env var is required');

/** Games to upload. Add new manifest games here. */
const MANIFEST_GAMES = [
  {id: 'snake',      path: 'packages/games/snake/game.json'},
  {id: 'solitaire',  path: 'packages/games/solitaire/game.json'},
  {id: 'sudoku',     path: 'packages/games/sudoku/game.json'},
  {id: 'blackjack',  path: 'packages/games/blackjack/game.json'},
  {id: 'poker',      path: 'packages/games/poker/game.json'},
];

const games = MANIFEST_GAMES.map(({id, path}) => {
  const raw = readFileSync(resolve(root, path), 'utf8');
  const manifest = JSON.parse(raw);
  return {
    id,
    manifest,
    title: manifest.meta?.title ?? id,
    description: manifest.meta?.description ?? '',
  };
});

const url = `${SERVER_URL.replace(/\/$/, '')}/manifests/upload`;
const res = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${TOKEN}`,
  },
  body: JSON.stringify({games}),
});

if (!res.ok) {
  console.error(`Upload failed: ${res.status} ${await res.text()}`);
  process.exit(1);
}

const data = await res.json();
console.log(`Uploaded ${data.count} manifests + index to ${SERVER_URL}/manifests/`);
