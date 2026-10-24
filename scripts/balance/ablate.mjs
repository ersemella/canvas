// Runs ablation and tuning experiments (ablate.ts) under the production rules.
// Vite loads the game's TypeScript and workspace engine source without a build.
import {createRequire} from 'node:module';
import process from 'node:process';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {mkdirSync, writeFileSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(resolve(repo, 'packages/games/silk-road-run/package.json'));
const {createServer} = await import(
  pathToFileURL(resolve(dirname(require.resolve('vite/package.json')), 'dist/node/index.js')).href
);
const args = process.argv.slice(2);
const value = (flag, fallback) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback);
const file = args[0];
if (!file || file.startsWith('--')) {
  console.log(`Usage: node scripts/balance/ablate.mjs EXPERIMENTS.mjs [options]
  --fights N      Fights per experiment (default 400; one-sided ones pair seeds, so 200 seeds)
  --seed N        First fight seed (default 1000)
  --max-turns N   Chosen-action cutoff per fight (default 400)
  --only NAMES    Run only these experiments from the file (comma-separated)
  --out PATH      JSON output (default work/ablate-results.json)
EXPERIMENTS.mjs exports \`experiments\`: {name: {patch?, mod?}}; see
scripts/balance/experiments/ and scripts/balance/README.md.`);
  process.exit(0);
}
const fights = Number(value('--fights', '400'));
const seed = Number(value('--seed', '1000'));
const maxTurns = Number(value('--max-turns', '400'));
const only = value('--only', undefined)?.split(',');
const out = resolve(value('--out', resolve(repo, 'work/ablate-results.json')));
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
  const {ablate} = await server.ssrLoadModule('/scripts/balance/ablate.ts');
  const {experiments} = await import(pathToFileURL(resolve(file)).href);
  const results = {};
  for (const [name, experiment] of Object.entries(experiments)) {
    if (only && !only.includes(name)) continue;
    const start = performance.now();
    results[name] = ablate({fights, seed, maxTurns, ...experiment});
    const r = results[name];
    console.log(
      `${name}: ${r.modWinPct !== undefined ? `modified side wins ${r.modWinPct}%, ` : `player wins ${r.playerWinPct}%, `}` +
        `${r.stallPct}% unfinished, median ${r.medianTurns} actions ` +
        `(${((performance.now() - start) / 1000).toFixed(0)}s)`
    );
  }
  mkdirSync(dirname(out), {recursive: true});
  writeFileSync(out, JSON.stringify(results, null, 2) + '\n');
  console.log(`Saved ${out}`);
} finally {
  await server.close();
}
