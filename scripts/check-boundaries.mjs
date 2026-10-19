/**
 * Enforces the package boundaries from docs/plans/engine-platform-split.md:
 *
 *   - The engine imports no other workspace package (no game, no platform).
 *   - A game imports only the engine's public entries (`@canvas/engine`,
 *     `@canvas/engine/server`) and its own files — no deep engine paths, no
 *     other game, no `@canvas/web` or `@canvas/server`.
 *
 * Checks every import/export specifier (static, dynamic, and type-only) in
 * the packages' TypeScript sources. Exits non-zero listing each violation.
 *
 *   node scripts/check-boundaries.mjs
 */
import {readdirSync, readFileSync, statSync} from 'node:fs';
import {dirname, join, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const ENGINE_PUBLIC = new Set(['@canvas/engine', '@canvas/engine/server']);

function sourceFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist') continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
    else if (/\.(ts|tsx|mts)$/.test(name) && !name.endsWith('.d.ts')) out.push(path);
  }
  return out;
}

const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)(['"])([^'"]+)\1/g;

function specifiers(file) {
  // Drop comments so examples in docs don't count as imports.
  const code = readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  return [...code.matchAll(SPECIFIER)].map((m) => m[2]);
}

/** A relative import that stays inside `pkgDir`. */
function staysInside(file, spec, pkgDir) {
  const target = resolve(dirname(file), spec);
  return target === pkgDir || target.startsWith(pkgDir + sep);
}

const violations = [];
const report = (file, spec, why) => violations.push(`${relative(root, file)}: '${spec}' — ${why}`);

// Engine: nothing from the workspace, and relative imports stay in the engine.
const engineDir = join(root, 'packages/engine');
for (const file of sourceFiles(join(engineDir, 'src'))) {
  for (const spec of specifiers(file)) {
    if (spec.startsWith('@canvas/'))
      report(file, spec, 'the engine must not import workspace packages');
    else if (spec.startsWith('.') && !staysInside(file, spec, engineDir))
      report(file, spec, 'relative import leaves the engine package');
  }
}

// Games: only the engine's public entries plus their own files.
const gamesDir = join(root, 'packages/games');
for (const game of readdirSync(gamesDir)) {
  const gameDir = join(gamesDir, game);
  if (!statSync(gameDir).isDirectory()) continue;
  for (const sub of ['src', 'dev']) {
    let files;
    try {
      files = sourceFiles(join(gameDir, sub));
    } catch {
      continue; // no such folder
    }
    for (const file of files) {
      for (const spec of specifiers(file)) {
        if (spec.startsWith('.')) {
          if (!staysInside(file, spec, gameDir))
            report(file, spec, 'relative import leaves the game package');
        } else if (spec.startsWith('@canvas/engine')) {
          if (!ENGINE_PUBLIC.has(spec))
            report(file, spec, 'deep engine import; use @canvas/engine');
        } else if (spec.startsWith('@canvas/')) {
          report(file, spec, 'games may import only @canvas/engine');
        }
      }
    }
  }
}

if (violations.length) {
  console.error(`✗ ${violations.length} package boundary violation(s):`);
  for (const v of violations) console.error(`  ${v}`);
  process.exit(1);
}
console.log('✓ package boundaries hold (engine ← games ← platform)');
