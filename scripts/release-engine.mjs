/**
 * Builds the tree for an engine release: a self-contained `@canvas/engine`
 * package (package.json + built dist/) that another repository can install
 * as a git dependency, e.g.
 *
 *   "@canvas/engine": "github:ersemella/canvas#engine-v0.0.1"
 *
 * The release workflow (.github/workflows/release-engine.yml) commits this
 * tree on its own (no branch) and pushes it as the tag `engine-v<version>`,
 * the version being packages/engine/package.json's.
 *
 *   node scripts/release-engine.mjs <outDir>   build the engine, write the tree
 *   node scripts/release-engine.mjs --version  print the tag name only
 */
import {execFileSync} from 'node:child_process';
import {cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const engineDir = join(root, 'packages/engine');
const pkg = JSON.parse(readFileSync(join(engineDir, 'package.json'), 'utf8'));
const tag = `engine-v${pkg.version}`;

if (process.argv[2] === '--version') {
  console.log(tag);
  process.exit(0);
}

const outDir = process.argv[2] ? resolve(process.argv[2]) : null;
if (!outDir) {
  console.error('usage: node scripts/release-engine.mjs <outDir> | --version');
  process.exit(1);
}
if (existsSync(outDir) && readdirSync(outDir).length > 0) {
  console.error(`✗ ${outDir} is not empty`);
  process.exit(1);
}

execFileSync('pnpm', ['--filter', '@canvas/engine', 'build'], {cwd: root, stdio: 'inherit'});

// The published package.json: what consumers need and nothing that only
// resolves inside this workspace (workspace: devDependencies, scripts).
const {devDependencies: _dev, scripts: _scripts, private: _private, ...published} = pkg;
const source = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim();

mkdirSync(outDir, {recursive: true});
cpSync(join(engineDir, 'dist'), join(outDir, 'dist'), {recursive: true});
writeFileSync(join(outDir, 'package.json'), JSON.stringify(published, null, 2) + '\n');
writeFileSync(
  join(outDir, 'README.md'),
  `# @canvas/engine ${pkg.version}\n\n` +
    `Built from ersemella/canvas@${source} (packages/engine) by scripts/release-engine.mjs.\n` +
    `Install as a git dependency: \`"@canvas/engine": "github:ersemella/canvas#${tag}"\`.\n` +
    `The JavaScript uses extensionless relative imports, so load it through a bundler ` +
    `(Vite, esbuild, Wrangler), not plain Node.\n`,
);
console.log(`✓ ${tag} written to ${outDir} (source ${source.slice(0, 7)})`);
