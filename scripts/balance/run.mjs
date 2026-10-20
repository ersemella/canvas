// Vite loads the game's TypeScript and workspace engine source without a build.
import {createRequire} from 'node:module';
import process from 'node:process';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {mkdirSync, writeFileSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(resolve(repo, 'packages/games/silk-road-tactics/package.json'));
const {createServer} = await import(
  pathToFileURL(resolve(dirname(require.resolve('vite/package.json')), 'dist/node/index.js')).href
);
const args = process.argv.slice(2);
const value = (flag, fallback) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback);
if (args.includes('--help')) {
  console.log(`Usage: node scripts/balance/run.mjs [options]
  --samples N     Random deployment pairs per variant (default 100)
  --seed N        Deployment RNG seed (default 20261020)
  --max-turns N   Chosen-action cutoff per fight (default 400)
  --move-cost N   Move-only base timeline cost (default 60)
  --out PATH     JSON output (default work/balance-results.json)
Each sample runs twice, swapping starting speed-tie priority, in four variants.
See scripts/balance/README.md for assumptions and metric definitions.`);
  process.exit(0);
}
const known = new Set(['--samples', '--seed', '--max-turns', '--move-cost', '--out']);
for (let i = 0; i < args.length; i += 2) {
  if (!known.has(args[i]) || args[i + 1] === undefined || args[i + 1].startsWith('--'))
    throw new Error(`Invalid argument near ${args[i]}; use --help.`);
}
const samples = Number(value('--samples', '100'));
const seed = Number(value('--seed', '20261020'));
const maxTurns = Number(value('--max-turns', '400'));
const moveCost = Number(value('--move-cost', '60'));
const out = resolve(value('--out', resolve(repo, 'work/balance-results.json')));
if (
  ![samples, maxTurns].every((n) => Number.isInteger(n) && n > 0) ||
  !Number.isInteger(seed) ||
  !Number.isFinite(moveCost) ||
  moveCost < 0
)
  throw new Error(
    'Expected positive integer samples/max-turns, integer seed, and nonnegative move-cost.'
  );
const server = await createServer({
  configFile: false,
  root: repo,
  server: {middlewareMode: true, ws: false, watch: null},
  resolve: {
    alias: {
      '@canvas/engine/server': resolve(repo, 'packages/engine/src/server.ts'),
      '@balance-rules': resolve(repo, 'packages/games/silk-road-tactics/src/rules'),
    },
  },
});
try {
  const {runBalance} = await server.ssrLoadModule('/scripts/balance/simulate.ts');
  const result = runBalance({samples, seed, maxTurns, moveCost});
  mkdirSync(dirname(out), {recursive: true});
  writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
  console.table(result.summary);
  console.log(`Saved ${out}`);
} finally {
  await server.close();
}
