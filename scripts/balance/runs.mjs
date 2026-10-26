// Runs whole-run experiments (runs.ts) under the production rules.
// Vite loads the game's TypeScript and workspace engine source without a build.
import {createRequire} from 'node:module';
import process from 'node:process';
import {fork} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const value = (flag, fallback) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback);
const file = args[0];
if (!file || file.startsWith('--')) {
  console.log(`Usage: node scripts/balance/runs.mjs EXPERIMENTS.mjs [options]
  --runs N        Runs per experiment (default 100)
  --seed N        First run seed (default 1000)
  --max-turns N   Chosen-action cutoff per fight (default 400)
  --only NAMES    Run only these experiments from the file (comma-separated)
  --jobs N        Processes to share the experiments between (default 1)
  --out PATH      JSON output (default work/runs-results.json)
EXPERIMENTS.mjs exports \`experiments\`: {name: {party, group?, patch?, provision?}}; see
scripts/balance/experiments/roles.mjs and scripts/balance/README.md.`);
  process.exit(0);
}
const runs = Number(value('--runs', '100'));
const seed = Number(value('--seed', '1000'));
const maxTurns = Number(value('--max-turns', '400'));
const jobs = Number(value('--jobs', '1'));
const out = resolve(value('--out', resolve(repo, 'work/runs-results.json')));
const {experiments} = await import(pathToFileURL(resolve(file)).href);
const only = value('--only', undefined)?.split(',');
const names = Object.keys(experiments).filter((n) => !only || only.includes(n));

const summary = (name, r) =>
  `${name}: wins ${r.runWinPct}% of runs; stage win % ` + r.stages.map((s) => s.winPct).join(', ');
/** Each `group`'s mean run win rate and its spread, its experiments weighted equally. */
const printGroups = (results) => {
  const groups = {};
  for (const [name, r] of Object.entries(results)) {
    const g = experiments[name].group;
    if (g) (groups[g] ??= []).push(r.runWinPct);
  }
  for (const [g, rates] of Object.entries(groups)) {
    const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
    console.log(
      `${g}: mean ${mean.toFixed(1)}% of runs won over ${rates.length} parties ` +
        `(${Math.min(...rates)}–${Math.max(...rates)}%)`
    );
  }
};

if (jobs > 1) {
  // Each child runs every jobs-th experiment, so long and short ones mix.
  const parts = Array.from({length: jobs}, (_, j) => names.filter((_, i) => i % jobs === j));
  const shards = parts
    .map((part, j) => ({part, path: `${out}.${j}`}))
    .filter(({part}) => part.length);
  const passed = args.filter((a, i) => {
    const flag = ['--jobs', '--only', '--out'].find((f) => args[i] === f || args[i - 1] === f);
    return i > 0 && !flag;
  });
  await Promise.all(
    shards.map(
      ({part, path}) =>
        new Promise((done, fail) =>
          fork(fileURLToPath(import.meta.url), [
            file,
            ...passed,
            '--only',
            part.join(','),
            '--out',
            path,
          ]).on('exit', (code) => (code ? fail(new Error(`a shard exited ${code}`)) : done()))
        )
    )
  );
  const results = {};
  for (const {path} of shards) {
    Object.assign(results, JSON.parse(readFileSync(path, 'utf8')));
    rmSync(path);
  }
  // In the file's order, whichever shard ran them.
  const ordered = Object.fromEntries(names.map((n) => [n, results[n]]));
  mkdirSync(dirname(out), {recursive: true});
  writeFileSync(out, JSON.stringify(ordered, null, 2) + '\n');
  printGroups(ordered);
  console.log(`Saved ${out}`);
  process.exit(0);
}

const require = createRequire(resolve(repo, 'packages/games/silk-road-run/package.json'));
const {createServer} = await import(
  pathToFileURL(resolve(dirname(require.resolve('vite/package.json')), 'dist/node/index.js')).href
);
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
  const {simulateRuns} = await server.ssrLoadModule('/scripts/balance/runs.ts');
  const results = {};
  for (const name of names) {
    const start = performance.now();
    results[name] = simulateRuns({runs, seed, maxTurns, ...experiments[name]});
    console.log(
      `${summary(name, results[name])} (${((performance.now() - start) / 1000).toFixed(0)}s)`
    );
  }
  mkdirSync(dirname(out), {recursive: true});
  writeFileSync(out, JSON.stringify(results, null, 2) + '\n');
  if (!only) printGroups(results);
  console.log(`Saved ${out}`);
} finally {
  await server.close();
}
