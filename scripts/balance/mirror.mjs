// Runs mirror matches (mirror.ts): the same heroes on both sides, no camel.
// Vite loads the game's TypeScript and workspace engine source without a build.
import {createRequire} from 'node:module';
import process from 'node:process';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {resolve, dirname} from 'node:path';
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(resolve(repo, 'packages/games/silk-road-run/package.json'));
const {createServer} = await import(
  pathToFileURL(resolve(dirname(require.resolve('vite/package.json')), 'dist/node/index.js')).href
);
const args = process.argv.slice(2);
const value = (flag, fallback) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback);
if (args.includes('--help')) {
  console.log(`Usage: node scripts/balance/mirror.mjs [options]
  --pairs N       Seeds, each played as dealt and mirrored with sides swapped (default 200)
  --seed N        First fight seed (default 1000)
  --max-turns N   Chosen-action cutoff per fight (default 400)
  --party A,B,C   Each side's heroes (default bokh,mangudai,storm)
  --ai A,B        Team a's and team b's AIs: production, greedy or deep (default production,production)`);
  process.exit(0);
}
const pairs = Number(value('--pairs', '200'));
const seed = Number(value('--seed', '1000'));
const maxTurns = Number(value('--max-turns', '400'));
const party = value('--party', 'bokh,mangudai,storm').split(',');
const variants = value('--ai', 'production,production').split(',');
const server = await createServer({
  configFile: false,
  root: repo,
  logLevel: 'silent',
  optimizeDeps: {noDiscovery: true, entries: []},
  server: {middlewareMode: true, ws: false, watch: null},
  resolve: {
    alias: {
      '@canvas/engine/server': resolve(repo, 'packages/engine/src/server.ts'),
      '@balance-rules': resolve(repo, 'packages/games/silk-road-run/src/rules'),
    },
  },
});
try {
  const {runMirror} = await server.ssrLoadModule('/scripts/balance/mirror.ts');
  const start = performance.now();
  console.log(runMirror({pairs, seed, maxTurns, party, variants}));
  console.log(`(${((performance.now() - start) / 1000).toFixed(0)}s)`);
} finally {
  await server.close();
}
