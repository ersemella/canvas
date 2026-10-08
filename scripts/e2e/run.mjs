/**
 * End-to-end runner: starts the Worker (`wrangler dev`) and the web app
 * (Vite), runs every suite in this folder against them, then shuts both down.
 *
 *   pnpm e2e                 # all suites
 *   pnpm e2e poker-protocol  # suites whose file name contains the filter
 *
 * To run against servers that are already up (e.g. production), set both
 * E2E_API_URL and E2E_WEB_URL; nothing is started then.
 *
 * Results, screenshots and server logs land in e2e-results/.
 */
import {spawn} from 'node:child_process';
import {mkdirSync, openSync, readdirSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const outDir = join(root, 'e2e-results');
mkdirSync(outDir, {recursive: true});

const external = Boolean(process.env.E2E_API_URL && process.env.E2E_WEB_URL);
const API_URL = (process.env.E2E_API_URL ?? 'http://127.0.0.1:8787').replace(/\/+$/, '');
const WEB_URL = (process.env.E2E_WEB_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

const servers = [];

function startServer(name, cmd, args, cwd) {
  const log = openSync(join(outDir, `${name}.log`), 'w');
  const child = spawn(cmd, args, {
    cwd,
    stdio: ['ignore', log, log],
    detached: true, // own process group, so the whole tree can be stopped
    env: {...process.env, WRANGLER_SEND_METRICS: 'false'},
  });
  servers.push({name, child});
  return child;
}

function stopServers() {
  for (const {child} of servers) {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      // already gone
    }
  }
}
process.on('SIGINT', () => {
  stopServers();
  process.exit(130);
});

async function waitFor(url, label, timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(
    `${label} did not come up at ${url} within ${timeoutMs / 1000}s (see e2e-results/)`
  );
}

function runSuite(file) {
  return new Promise((res) => {
    const child = spawn(process.execPath, [join(here, file)], {
      stdio: 'inherit',
      env: {...process.env, E2E_API_URL: API_URL, E2E_WEB_URL: WEB_URL, E2E_OUT_DIR: outDir},
    });
    child.on('exit', (code) => res(code ?? 1));
  });
}

const filter = process.argv[2] ?? '';
const suites = readdirSync(here)
  .filter((f) => f.endsWith('.e2e.mjs') && f.includes(filter))
  .sort();
if (suites.length === 0) {
  console.error(`No suites match "${filter}"`);
  process.exit(1);
}

let failed = 0;
try {
  if (!external) {
    startServer(
      'wrangler',
      'pnpm',
      ['exec', 'wrangler', 'dev', '--ip', '127.0.0.1', '--port', '8787'],
      join(root, 'packages/server')
    );
    startServer(
      'vite',
      'pnpm',
      ['exec', 'vite', '--port', '3000', '--strictPort'],
      join(root, 'packages/web')
    );
    console.log('Starting wrangler dev and vite…');
  } else {
    console.log(`Using running servers: API ${API_URL}, web ${WEB_URL}`);
  }
  await waitFor(`${API_URL}/health`, 'Worker');
  await waitFor(WEB_URL, 'Web app');
  for (const suite of suites) {
    console.log(`\n▶ ${suite}`);
    if ((await runSuite(suite)) !== 0) failed++;
  }
} catch (err) {
  console.error(String(err));
  failed++;
} finally {
  stopServers();
}

console.log(
  failed ? `\n✗ ${failed} suite(s) failed — details in e2e-results/` : '\n✓ All e2e suites passed'
);
process.exit(failed ? 1 : 0);
