/**
 * Silk Road Tactics end to end: the `/runs` API against the Worker (player
 * keys, ownership, the view never carrying the seed, one active run per
 * key, illegal turns refused), then the page in Chromium: start, deploy,
 * a turn played with real taps and its preview, an enemy's stat sheet, a
 * reload that resumes exactly, and the fight played to victory or defeat
 * (the remaining turns chosen by the AI through a dev-server hook).
 *
 * Against production (no dev hook) the page part only starts and deploys
 * a fight. Every run the suite starts is abandoned at the end, so smoke
 * tests don't leave active runs behind.
 */
import {chromium, devices} from 'playwright';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {API_URL, OUT_DIR, WEB_URL, check, finish, sleep} from './lib.mjs';

const key = () => randomBytes(32).toString('base64url');
const api = async (path, playerKey, init = {}) => {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {'Content-Type': 'application/json', ...(playerKey ? {Authorization: `Bearer ${playerKey}`} : {})},
  });
  return {status: res.status, body: await res.json().catch(() => null)};
};
const shot = (page, name) => page.screenshot({path: join(OUT_DIR, `tactics-${name}.png`)});

// ── The API ──────────────────────────────────────────────────────────────────
const alice = key();
const bob = key();

check('a run needs a player key', (await api('/runs', null, {method: 'POST', body: '{"game":"silk-road-tactics"}'})).status === 401);
const started = await api('/runs', alice, {method: 'POST', body: JSON.stringify({game: 'silk-road-tactics'})});
check('starting a run returns its view', started.status === 201 && started.body?.view?.fight?.phase === 'deploy', started);
const runId = started.body.runId;
const raw = JSON.stringify(started.body);
check('the view never carries the seed', !/seed/i.test(raw));

check('another key can’t see the run', (await api(`/runs/${runId}`, bob)).status === 403);
const placements = (fight) =>
  fight.units.filter((u) => u.side === 'player').map((u, i) => ({unitId: u.id, hex: [{q: 0, r: 2}, {q: 0, r: 3}, {q: -2, r: 4}][i]}));
check(
  'another key can’t act on the run',
  (await api(`/runs/${runId}/deploy`, bob, {method: 'POST', body: JSON.stringify({placements: placements(started.body.view.fight)})})).status === 403
);
check('the key’s active run is remembered', (await api('/runs/active', alice)).body?.activeRunId === runId);

const outside = await api(`/runs/${runId}/deploy`, alice, {
  method: 'POST',
  body: JSON.stringify({placements: started.body.view.fight.units.filter((u) => u.side === 'player').map((u, i) => ({unitId: u.id, hex: {q: 4 + i, r: 3}}))}),
});
check('deploying outside the zone is refused', outside.status === 400, outside.body);

// The map's default placement (odd-r: (col 1,row 2), (1,3), (0,4)).
const deployed = await api(`/runs/${runId}/deploy`, alice, {method: 'POST', body: JSON.stringify({placements: placements(started.body.view.fight)})});
check('deploying starts the fight', deployed.status === 200 && deployed.body.view.fight.phase === 'fight', deployed.body);
check('the response stops on one of your units', /^p-/.test(deployed.body.view.fight.awaiting ?? ''), deployed.body.view.fight.awaiting);
const version = deployed.body.view.version;

const bad = await api(`/runs/${runId}/turn`, alice, {method: 'POST', body: JSON.stringify({action: {ability: 'rampage', target: {hex: {q: 50, r: 50}}}})});
check('an illegal turn is refused with a reason', bad.status === 400 && typeof bad.body?.message === 'string', bad.body);
check('a refused turn changes nothing', (await api(`/runs/${runId}`, alice)).body.view.version === version);

const held = await api(`/runs/${runId}/turn`, alice, {method: 'POST', body: JSON.stringify({action: {ability: 'hold'}})});
check('a turn returns the next view, AI turns included', held.status === 200 && held.body.view.version === version + 1, held.body?.message);

const second = await api('/runs', alice, {method: 'POST', body: JSON.stringify({game: 'silk-road-tactics'})});
check('starting another run abandons the first', (await api(`/runs/${runId}`, alice)).body?.status === 'abandoned');
check('the new run is the active one', (await api('/runs/active', alice)).body?.activeRunId === second.body.runId);
const abandoned = await api(`/runs/${second.body.runId}/abandon`, alice, {method: 'POST'});
check('a run can be abandoned', abandoned.body?.status === 'abandoned', abandoned.body);
check('an abandoned run is no longer active', (await api('/runs/active', alice)).body?.activeRunId === null);

// ── The page ─────────────────────────────────────────────────────────────────
const browser = await chromium.launch();
const page = await browser.newPage({viewport: {width: 1300, height: 900}});
const pageErrors = [];
page.on('pageerror', (e) => {
  pageErrors.push(e.message);
  console.log('  [page error]', e.message);
});

/** Clicks a hex on the board canvas, scaled from the 600×400 scene to the canvas on screen. */
async function tapHex(hex) {
  const {x, y} = await page.evaluate((h) => window.__tactics.hexToCanvas(h), hex);
  const box = await page.locator('canvas').boundingBox();
  await page.mouse.click(box.x + (x * box.width) / 600, box.y + (y * box.height) / 400);
  await sleep(150);
}
const state = () => page.evaluate(() => window.__tactics?.run);
const waitIdle = () => page.waitForFunction(() => window.__tactics && !window.__tactics.busy, null, {timeout: 15_000});

/** Abandons the page's active run (the button asks twice), so none is left behind. */
async function abandonOn(p) {
  const button = p.getByRole('button', {name: 'Abandon run'});
  if (!(await button.isVisible().catch(() => false))) return;
  await button.click();
  await p.getByRole('button', {name: /Tap again/}).click();
  await p.getByRole('button', {name: 'Start the fight'}).waitFor({timeout: 15_000});
  // That started a fresh run in deployment; it ends with the page's key, unplayed.
  const key = await p.evaluate(() => localStorage.getItem('canvas:playerKey'));
  const {body} = await api('/runs/active', key);
  if (body?.activeRunId) await api(`/runs/${body.activeRunId}/abandon`, key, {method: 'POST'});
}

try {
  await page.goto(`${WEB_URL}/play/silk-road-tactics`);
  await page.getByRole('button', {name: 'Start a fight'}).click();
  await page.getByRole('button', {name: 'Start the fight'}).waitFor({timeout: 15_000});
  const devServer = await page
    .waitForFunction(() => window.__tactics, null, {timeout: 3_000})
    .then(() => true)
    .catch(() => false);
  await sleep(300);
  await shot(page, 'deploy');

  if (!devServer) {
    // Production: no dev hook, so just start a fight and leave it.
    await page.getByRole('button', {name: 'Start the fight'}).click();
    await page.getByText(/^Your turn:/).waitFor({timeout: 15_000});
    await sleep(300);
    await shot(page, 'fight');
    check('the page starts and deploys a fight', true);
    check('no page errors', pageErrors.length === 0, pageErrors);
    console.log('  (deep checks skipped: no __tactics hook — not a dev-server build)');
    await abandonOn(page);
    await browser.close();
    finish();
  }

  // Move the Outrider (default at col 1,row 3) to another zone hex by tapping.
  let run = await state();
  const outrider = 'p-mangudai';
  await tapHex({q: 0, r: 3}); // select it (axial of col 1,row 3... see below)
  await tapHex({q: -3, r: 6}); // col 0, row 6
  await page.getByRole('button', {name: 'Start the fight'}).click();
  await page.getByText(/^Your turn:/).waitFor({timeout: 15_000});
  await waitIdle();
  run = await state();
  const placed = run.view.fight.units.find((u) => u.id === outrider).hex;
  check('tapping a hero then a zone hex moves it before the fight', placed.q === -3 && placed.r === 6, placed);
  await sleep(300);
  await shot(page, 'fight');

  // One turn with real taps: move one hex, pick Hold, see the preview, confirm.
  const before = run.view.version;
  const acting = run.view.fight.units.find((u) => u.id === run.view.fight.awaiting);
  const dest = await page.evaluate(() => {
    const t = window.__tactics.run.view.fight;
    const me = t.units.find((u) => u.id === t.awaiting);
    // A free neighbouring zone-side hex: try each direction.
    const dirs = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
    for (const [dq, dr] of dirs) {
      const h = {q: me.hex.q + dq, r: me.hex.r + dr};
      const col = h.q + (h.r - (h.r & 1)) / 2;
      if (h.r < 0 || h.r > 6 || col < 0 || col > 8) continue;
      if (t.units.some((u) => u.alive && u.hex && u.hex.q === h.q && u.hex.r === h.r)) continue;
      if (['3,2', '2,4', '3,3', '5,3'].includes(`${col},${h.r}`)) continue;
      return h;
    }
    return null;
  });
  await tapHex(dest);
  check('a planned move shows its cost', await page.getByText(/Move 1 hex/).isVisible());
  await page.getByRole('button', {name: /^Hold/}).click();
  check('the preview shows where the card lands', await page.getByText(/Your card → slot \d+/).isVisible());
  await sleep(200);
  await shot(page, 'preview');
  await page.getByRole('button', {name: 'Confirm'}).click();
  await page.waitForFunction((v) => window.__tactics.run.view.version > v, before, {timeout: 15_000});
  run = await state();
  const movedUnit = run.view.fight.units.find((u) => u.id === acting.id);
  check('the turn moved the unit with real taps', !movedUnit.alive || (movedUnit.hex.q === dest.q && movedUnit.hex.r === dest.r), movedUnit.hex);

  // An enemy's stat sheet, with its options (D11).
  const enemy = run.view.fight.units.find((u) => u.side === 'enemy' && u.alive);
  await tapHex(enemy.hex);
  const sheet = page.getByTestId('stat-sheet');
  check('tapping an enemy shows its stat sheet', (await sheet.textContent()).includes('enemy'));
  check('the sheet lists what it could do', await sheet.getByText(/Could do next turn/).isVisible());
  await shot(page, 'enemy-sheet');

  // A reload resumes the run exactly.
  const snapshot = JSON.stringify(run.view);
  await page.reload();
  await page.waitForFunction(() => window.__tactics?.run);
  check('a reload resumes the run exactly', JSON.stringify((await state()).view) === snapshot);

  // Play the rest with the AI choosing for you. With placeholder numbers a
  // fight can stall (Storm Callers out-heal what's left), so after 150 turns
  // abandon it and play a fresh one, at most three times.
  const playOut = async () => {
    for (let i = 0; i < 150; i++) {
      const r = await state();
      if (r.view.fight.phase !== 'fight') return true;
      await waitIdle();
      const v = r.view.version;
      await page.evaluate(() => window.__tactics.autoTurn());
      await page.waitForFunction((x) => window.__tactics.run.view.version > x, v, {timeout: 15_000});
    }
    return (await state()).view.fight.phase !== 'fight';
  };
  for (let attempt = 0; attempt < 3 && !(await playOut()); attempt++) {
    console.log('  (fight stalled; abandoning it for a fresh one)');
    const stalled = (await state()).runId;
    await page.getByRole('button', {name: 'Abandon run'}).click();
    await page.getByRole('button', {name: /Tap again/}).click();
    await page.getByRole('button', {name: 'Start the fight'}).click({timeout: 15_000});
    await page.getByText(/^Your turn:/).waitFor({timeout: 15_000});
    check('abandoning starts a fresh run', (await state()).runId !== stalled);
  }
  run = await state();
  check('the fight ends in victory or defeat', ['won', 'lost'].includes(run.view.fight.phase), run.view.fight.phase);
  check('the result is shown', await page.getByText(/^(Victory|Defeat)$/).isVisible());
  await sleep(300);
  await shot(page, 'end');
  check('no page errors', pageErrors.length === 0, pageErrors);

  // A phone: board on top, panels below, no sideways scroll.
  const phone = await browser.newPage({...devices['iPhone 13']});
  await phone.goto(`${WEB_URL}/play/silk-road-tactics`);
  await phone.getByRole('button', {name: 'Start a fight'}).click();
  await phone.getByRole('button', {name: 'Start the fight'}).click();
  await phone.getByText(/^Your turn:/).waitFor({timeout: 15_000});
  await sleep(300);
  await phone.screenshot({path: join(OUT_DIR, 'tactics-phone.png'), fullPage: true});
  const overflow = await phone.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('phone: no sideways scroll', overflow <= 1, overflow);
  await abandonOn(phone);
} finally {
  await browser.close();
}
finish();
