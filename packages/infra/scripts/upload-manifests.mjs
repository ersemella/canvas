/**
 * Uploads game manifests to S3 and writes an index.json listing.
 *
 * Required env vars:
 *   MANIFESTS_BUCKET   — S3 bucket name (from CDK output ManifestsBucketName)
 *
 * Optional env vars:
 *   MANIFESTS_BASE_URL — Public base URL for the bucket. Defaults to the
 *                        standard S3 REST endpoint for the bucket + region.
 *   AWS_DEFAULT_REGION — AWS region. Defaults to us-east-1.
 *
 * Usage:
 *   MANIFESTS_BUCKET=my-bucket node packages/infra/scripts/upload-manifests.mjs
 */

import {S3Client, PutObjectCommand} from '@aws-sdk/client-s3';
import {readFileSync} from 'fs';
import {resolve, dirname} from 'path';
import {fileURLToPath} from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../../..');

const BUCKET = process.env.MANIFESTS_BUCKET;
if (!BUCKET) throw new Error('MANIFESTS_BUCKET env var is required (see CDK output ManifestsBucketName)');

const REGION = process.env.AWS_DEFAULT_REGION ?? 'us-east-1';
const BASE_URL = process.env.MANIFESTS_BASE_URL ?? `https://${BUCKET}.s3.${REGION}.amazonaws.com`;

const s3 = new S3Client({region: REGION});

/** Games to upload. Add new manifest games here. */
const MANIFEST_GAMES = [
  {id: 'snake',      path: 'packages/games/snake/game.json'},
  {id: 'solitaire',  path: 'packages/games/solitaire/game.json'},
  {id: 'sudoku',     path: 'packages/games/sudoku/game.json'},
  {id: 'blackjack',  path: 'packages/games/blackjack/game.json'},
];

async function putObject(key, body, contentType = 'application/json') {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
    CacheControl: 'no-cache',
  }));
  console.log(`  uploaded: ${key}`);
}

const index = [];

for (const game of MANIFEST_GAMES) {
  const raw = readFileSync(resolve(root, game.path), 'utf8');
  const manifest = JSON.parse(raw);
  const key = `manifests/${game.id}/game.json`;

  await putObject(key, raw);

  index.push({
    id: game.id,
    title: manifest.meta?.title ?? game.id,
    description: manifest.meta?.description ?? '',
    url: `${BASE_URL}/${key}`,
  });
}

await putObject('index.json', JSON.stringify(index, null, 2));

console.log(`\nDone. Uploaded ${MANIFEST_GAMES.length} manifests + index.json`);
console.log(`Set VITE_MANIFESTS_BASE_URL=${BASE_URL} in your Cloudflare Pages environment.`);
