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
    headers: {
      'Content-Type': 'application/json',
      ...(playerKey ? {Authorization: `Bearer ${playerKey}`} : {}),
    },
  });
  return {status: res.status, body: await res.json().catch(() => null)};
};
const shot = (page, name) => page.screenshot({path: join(OUT_DIR, `tactics-${name}.png`)});

// ── The API ──────────────────────────────────────────────────────────────────
const alice = key();
const bob = key();

check(
  'a run needs a player key',
  (await api('/runs', null, {method: 'POST', body: '{"game":"silk-road-tactics"}'})).status === 401
);
const started = await api('/runs', alice, {
  method: 'POST',
  body: JSON.stringify({game: 'silk-road-tactics'}),
});
check(
  'starting a run returns its view',
  started.status === 201 && started.body?.view?.fight?.phase === 'deploy',
  started
);
const runId = started.body.runId;
const raw = JSON.stringify(started.body);
check('the view never carries the seed', !/seed/i.test(raw));

check('another key can’t see the run', (await api(`/runs/${runId}`, bob)).status === 403);
const placements = (fight) =>
  fight.units
    .filter((u) => u.side === 'player')
    .map((u, i) => ({
      unitId: u.id,
      hex: [
        {q: 0, r: 2},
        {q: -1, r: 3},
        {q: -1, r: 4},
      ][i],
    }));
check(
  'another key can’t act on the run',
  (
    await api(`/runs/${runId}/deploy`, bob, {
      method: 'POST',
      body: JSON.stringify({placements: placements(started.body.view.fight)}),
    })
  ).status === 403
);
check(
  'the key’s active run is remembered',
  (await api('/runs/active', alice)).body?.activeRunId === runId
);

const outside = await api(`/runs/${runId}/deploy`, alice, {
  method: 'POST',
  body: JSON.stringify({
    placements: started.body.view.fight.units
      .filter((u) => u.side === 'player')
      .map((u, i) => ({unitId: u.id, hex: {q: 4 + i, r: 3}})),
  }),
});
check('deploying outside the zone is refused', outside.status === 400, outside.body);

// The map's default placement (odd-r: (col 1,row 2), (0,3), (0,4)).
const deployed = await api(`/runs/${runId}/deploy`, alice, {
  method: 'POST',
  body: JSON.stringify({placements: placements(started.body.view.fight)}),
});
check(
  'deploying starts the fight',
  deployed.status === 200 && deployed.body.view.fight.phase === 'fight',
  deployed.body
);
check(
  'the response stops on one of your units',
  /^p-/.test(deployed.body.view.fight.awaiting ?? ''),
  deployed.body.view.fight.awaiting
);
const version = deployed.body.view.version;

const bad = await api(`/runs/${runId}/turn`, alice, {
  method: 'POST',
  body: JSON.stringify({action: {ability: 'rampage', target: {hex: {q: 50, r: 50}}}}),
});
check(
  'an illegal turn is refused with a reason',
  bad.status === 400 && typeof bad.body?.message === 'string',
  bad.body
);
check(
  'a refused turn changes nothing',
  (await api(`/runs/${runId}`, alice)).body.view.version === version
);

const held = await api(`/runs/${runId}/turn`, alice, {
  method: 'POST',
  body: JSON.stringify({action: {ability: 'hold'}}),
});
check(
  'a turn returns the next view, AI turns included',
  held.status === 200 && held.body.view.version === version + 1,
  held.body?.message
);

const second = await api('/runs', alice, {
  method: 'POST',
  body: JSON.stringify({game: 'silk-road-tactics'}),
});
check(
  'starting another run abandons the first',
  (await api(`/runs/${runId}`, alice)).body?.status === 'abandoned'
);
check(
  'the new run is the active one',
  (await api('/runs/active', alice)).body?.activeRunId === second.body.runId
);
const abandoned = await api(`/runs/${second.body.runId}/abandon`, alice, {method: 'POST'});
check('a run can be abandoned', abandoned.body?.status === 'abandoned', abandoned.body);
check(
  'an abandoned run is no longer active',
  (await api('/runs/active', alice)).body?.activeRunId === null
);

// ── The page ─────────────────────────────────────────────────────────────────
const browser = await chromium.launch();
const page = await browser.newPage({viewport: {width: 1300, height: 900}});
const pageErrors = [];
page.on('pageerror', (e) => {
  pageErrors.push(e.message);
  console.log('  [page error]', e.message);
});

/** Clicks a hex on the board canvas, scaled from the 672×633 scene to the canvas on screen. */
async function tapHex(hex) {
  const {x, y} = await page.evaluate((h) => window.__tactics.hexToCanvas(h), hex);
  const box = await page.locator('canvas').boundingBox();
  await page.mouse.click(box.x + (x * box.width) / 672, box.y + (y * box.height) / 633);
  await sleep(150);
}
const state = () => page.evaluate(() => window.__tactics?.run);
const waitIdle = () =>
  page.waitForFunction(() => window.__tactics && !window.__tactics.busy, null, {timeout: 15_000});

/** Abandons the page's active run through the API (the page has no button for it), so none is left behind. */
async function abandonOn(p) {
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
    await page.getByRole('button', {name: /^Move/}).waitFor({timeout: 15_000});
    await sleep(300);
    await shot(page, 'fight');
    check('the page starts and deploys a fight', true);
    check('no page errors', pageErrors.length === 0, pageErrors);
    console.log('  (deep checks skipped: no __tactics hook — not a dev-server build)');
    await abandonOn(page);
    await browser.close();
    finish();
  }

  // Move the Outrider (default at col 0, row 3) to another zone hex by tapping.
  let run = await state();
  const outrider = 'p-mangudai';
  await tapHex({q: -1, r: 3}); // select it (axial of col 0, row 3)
  await tapHex({q: -2, r: 6}); // col 1, row 6
  await page.getByRole('button', {name: 'Start the fight'}).click();
  await page.getByRole('button', {name: /^Move/}).waitFor({timeout: 15_000});
  await waitIdle();
  run = await state();
  const placed = run.view.fight.units.find((u) => u.id === outrider).hex;
  check(
    'tapping a hero then a zone hex moves it before the fight',
    placed.q === -2 && placed.r === 6,
    placed
  );
  await sleep(300);
  await shot(page, 'fight');

  // The top bar: Back and the game's title, on desktop too.
  const bar = page.locator('header');
  check(
    'the top bar has Back and the title, not the site name',
    (await bar.getByRole('link', {name: 'Back'}).isVisible()) &&
      (await bar.getByText('Silk Road Tactics').isVisible()) &&
      !(await bar.getByText('Canvas Games').count()),
    await bar.textContent()
  );
  check(
    'the page doesn’t repeat the title',
    (await page.getByText('Silk Road Tactics').count()) === 1
  );

  // One turn with real taps: Dash first, then Move, Confirm. The Outrider
  // (fastest, so first) is at col 1, row 6 after the deployment above.
  const before = run.view.version;
  const acting = run.view.fight.units.find((u) => u.id === run.view.fight.awaiting);
  check('the Outrider acts first', acting.id === outrider, acting.id);
  const dashTo = {q: 0, r: 6}; // 2 hexes east along row 6 (Dash goes up to 2)
  const dest = {q: -2, r: 5}; // col 0, row 5: next to where it started, off the Dash line
  // Without Move, a tap only looks at the hex.
  await tapHex(dest);
  const moveButton = page.getByRole('button', {name: /^Move/});
  check(
    'a tap without Move plans nothing',
    (await moveButton.getAttribute('aria-pressed')) === 'false'
  );
  check('there is no Hold button', !(await page.getByRole('button', {name: /^Hold/}).count()));
  // Act first, then move: Dash and its hex, then Move and a hex.
  await page.getByRole('button', {name: /^Dash/}).click();
  await tapHex(dashTo);
  await tapHex(dashTo); // a second tap on the target doesn't commit
  check('a second tap on the target doesn’t commit', (await state()).view.version === before);
  await moveButton.click();
  await tapHex(dest);
  const stepsText = () => page.getByTestId('turn-steps').textContent();
  check(
    'Move after the action plans act-then-move',
    (await stepsText()) === '1Dash2Move',
    await stepsText()
  );
  check(
    'Move stays highlighted while a move is planned',
    (await moveButton.getAttribute('aria-pressed')) === 'true'
  );
  check(
    'the Move button shows what the move adds',
    /^Move\+\d+$/.test(await moveButton.textContent()),
    await moveButton.textContent()
  );
  // Tapping it again undoes the move and keeps the action; plan it again.
  await moveButton.click();
  check(
    'tapping Move again undoes the move',
    (await moveButton.getAttribute('aria-pressed')) === 'false' && (await stepsText()) === '1Dash'
  );
  await moveButton.click();
  await tapHex(dest);
  // Moving first would leave the Dash off its line: no Swap order.
  check(
    'Swap order is offered only when the other order is legal',
    !(await page.getByRole('button', {name: /Swap order/}).count())
  );
  const confirm = page.getByRole('button', {name: /^Confirm/});
  const confirmText = await confirm.textContent();
  check(
    'Confirm says when the next turn comes, in slots from now',
    /^Confirm · next turn \+\d+( → \+\d+)?$/.test(confirmText),
    confirmText
  );
  const dashText = await page.getByRole('button', {name: /^Dash/}).textContent();
  check(
    'the ability button shows the same slots as Confirm',
    dashText.endsWith(confirmText.match(/next turn (\+\d+)/)[1]),
    [dashText, confirmText]
  );
  await sleep(200);
  await shot(page, 'preview');
  await confirm.click();
  await page.waitForFunction((v) => window.__tactics.run.view.version > v, before, {
    timeout: 15_000,
  });
  run = await state();
  const movedUnit = run.view.fight.units.find((u) => u.id === acting.id);
  check(
    'the turn moved the unit with real taps',
    !movedUnit.alive || (movedUnit.hex.q === dest.q && movedUnit.hex.r === dest.r),
    movedUnit.hex
  );

  // An enemy's stat sheet.
  const enemy = run.view.fight.units.find((u) => u.side === 'enemy' && u.alive);
  await tapHex(enemy.hex);
  const sheet = page.getByTestId('stat-sheet');
  check(
    'tapping an enemy shows its stat sheet, its name a badge in the enemy’s colour',
    (await sheet.locator('[data-side="enemy"]').count()) === 1
  );
  check(
    'the sheet leaves out what it could do next turn',
    !(await sheet.textContent()).includes('Could do next turn')
  );
  check('the sheet doesn’t list Hold', !(await sheet.textContent()).includes('Hold'));
  check(
    'the sheet gives abilities in slots, not costs',
    /· \+\d+/.test(await sheet.textContent()) && !/· \d{2,}/.test(await sheet.textContent()),
    (await sheet.textContent()).slice(0, 200)
  );
  await shot(page, 'enemy-sheet');

  // Hovering a hex shows what it does, without planning a move.
  const quicksand = {q: 1, r: 3}; // col 2, row 3
  const versionBeforeHover = (await state()).view.version;
  {
    const {x, y} = await page.evaluate((h) => window.__tactics.hexToCanvas(h), quicksand);
    const box = await page.locator('canvas').boundingBox();
    await page.mouse.move(box.x + (x * box.width) / 672, box.y + (y * box.height) / 633);
    await sleep(150);
  }
  const info = page.getByTestId('hex-info');
  check('hovering quicksand shows its rule', (await info.textContent()).includes('Quicksand'));
  check('hovering changes nothing', (await state()).view.version === versionBeforeHover);
  await shot(page, 'hover');

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
      await page.waitForFunction((x) => window.__tactics.run.view.version > x, v, {
        timeout: 15_000,
      });
    }
    return (await state()).view.fight.phase !== 'fight';
  };
  for (let attempt = 0; attempt < 3 && !(await playOut()); attempt++) {
    console.log('  (fight stalled; abandoning it for a fresh one)');
    const stalled = (await state()).runId;
    await abandonOn(page);
    await page.reload();
    await page.getByRole('button', {name: 'Start a fight'}).click();
    await page.getByRole('button', {name: 'Start the fight'}).click({timeout: 15_000});
    await page.getByRole('button', {name: /^Move/}).waitFor({timeout: 15_000});
    check('abandoning starts a fresh run', (await state()).runId !== stalled);
  }
  run = await state();
  check(
    'the fight ends in victory or defeat',
    ['won', 'lost'].includes(run.view.fight.phase),
    run.view.fight.phase
  );
  check('the result is shown', await page.getByText(/^(Victory|Defeat)$/).isVisible());
  await sleep(300);
  await shot(page, 'end');
  check('no page errors', pageErrors.length === 0, pageErrors);

  // A phone: board on top, details below, the action section pinned to the
  // bottom of the screen; no heading or hints; no sideways scroll.
  const phone = await browser.newPage({...devices['iPhone 13']});
  await phone.goto(`${WEB_URL}/play/silk-road-tactics`);
  await phone.getByRole('button', {name: 'Start a fight'}).click();
  await phone.getByRole('button', {name: 'Start the fight'}).click();
  const phoneMove = phone.getByRole('button', {name: 'Move', exact: true});
  await phoneMove.waitFor({timeout: 15_000});
  await phone.waitForFunction(() => window.__tactics && !window.__tactics.busy, null, {
    timeout: 15_000,
  });
  await sleep(300);
  check(
    'phone: no turn heading or hints',
    !(await phone.getByText(/^Your turn:|Tap a hex to look/).count())
  );
  const phoneBar = phone.locator('header');
  check(
    'phone: the top bar has Back and the title, not the site name',
    (await phoneBar.getByRole('link', {name: 'Back'}).isVisible()) &&
      (await phoneBar.getByText('Silk Road Tactics').isVisible()) &&
      !(await phoneBar.getByText('Canvas Games').count()),
    await phoneBar.textContent()
  );
  check(
    'phone: the page doesn’t repeat the title',
    (await phone.getByText('Silk Road Tactics').count()) === 1
  );
  const canvasBox = await phone.locator('canvas').boundingBox();
  const viewportWidth = phone.viewportSize().width;
  check(
    'phone: the board runs edge to edge',
    Math.abs(canvasBox.x) <= 1 && Math.abs(canvasBox.width - viewportWidth) <= 1,
    [canvasBox, viewportWidth]
  );
  const inViewport = (locator) =>
    locator.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.top >= 0 && r.bottom <= window.innerHeight + 1;
    });
  // Tap an enemy: its details show right under the board, the actions stay on screen.
  const phoneFight = await phone.evaluate(() => window.__tactics.run.view.fight);
  const foe = phoneFight.units.find((u) => u.side === 'enemy' && u.alive).hex;
  {
    const {x, y} = await phone.evaluate((h) => window.__tactics.hexToCanvas(h), foe);
    const box = await phone.locator('canvas').boundingBox();
    await phone.tap('canvas', {position: {x: (x * box.width) / 672, y: (y * box.height) / 633}});
    await sleep(300);
  }
  const phoneSheet = phone.getByTestId('stat-sheet');
  check(
    'phone: tapping an enemy shows its details',
    (await phoneSheet.locator('[data-side="enemy"]').count()) === 1
  );
  check(
    'phone: no “could do next turn” on an enemy',
    !(await phoneSheet.textContent()).includes('Could do next turn')
  );
  check(
    'phone: the details start on screen',
    await phoneSheet.evaluate((el) => el.getBoundingClientRect().top < window.innerHeight)
  );
  check('phone: the action section stays on screen', await inViewport(phoneMove));
  // Tapping away from the board (here, on the details) goes back to the unit whose turn it is.
  await phoneSheet.tap();
  await sleep(200);
  const backTo = await phoneSheet.textContent();
  check(
    'phone: tapping away shows the acting unit again',
    (await phoneSheet.locator('[data-side="player"]').textContent()) === 'Mangudai Outrider',
    backTo.slice(0, 60)
  );
  // A planned move shows what it adds, in slots, inside the Move button.
  {
    await phoneMove.click();
    const {x, y} = await phone.evaluate((h) => window.__tactics.hexToCanvas(h), {q: 0, r: 3}); // col 1, row 3: free sand
    const box = await phone.locator('canvas').boundingBox();
    await phone.tap('canvas', {position: {x: (x * box.width) / 672, y: (y * box.height) / 633}});
    await sleep(250);
    const planned = phone.getByRole('button', {name: /^Move/});
    check(
      'phone: a planned move shows its slots in the Move button',
      /^Move\+\d+$/.test(await planned.textContent()),
      await planned.textContent()
    );
    await planned.click(); // undo it
    check('phone: undoing the move clears them', (await planned.textContent()) === 'Move');
  }
  // No Hold button: with nothing picked, the big button ends the turn.
  check('phone: no Hold button', !(await phone.getByRole('button', {name: /^Hold/}).count()));
  check(
    'phone: with nothing picked, the button ends the turn',
    /^End turn · next turn \+\d+( → \+\d+)?$/.test(
      await phone.getByRole('button', {name: /^End turn/}).textContent()
    )
  );
  // Tapping a target twice doesn't commit: only the button does.
  const tapOn = async (hex) => {
    const {x, y} = await phone.evaluate((h) => window.__tactics.hexToCanvas(h), hex);
    const box = await phone.locator('canvas').boundingBox();
    await phone.tap('canvas', {position: {x: (x * box.width) / 672, y: (y * box.height) / 633}});
    await sleep(250);
  };
  const phoneVersion = await phone.evaluate(() => window.__tactics.run.view.version);
  const mine = phoneFight.units.find((u) => u.id === 'p-bokh').hex; // in the Outrider's line at the start
  await phone.getByRole('button', {name: /^Composite Bow/}).click();
  await tapOn(mine);
  await tapOn(mine);
  check(
    'phone: a second tap on the target doesn’t commit',
    (await phone.evaluate(() => window.__tactics.run.view.version)) === phoneVersion
  );
  const phoneConfirm = await phone.getByRole('button', {name: /^Confirm/}).textContent();
  check(
    'phone: Confirm says when the next turn comes, in slots from now',
    /^Confirm · next turn \+\d+( → \+\d+)?$/.test(phoneConfirm),
    phoneConfirm
  );
  const bowText = await phone.getByRole('button', {name: /^Composite Bow/}).textContent();
  check(
    'phone: the ability button shows the same slots as Confirm',
    bowText.endsWith(phoneConfirm.match(/next turn (\+\d+)/)[1]),
    [bowText, phoneConfirm]
  );
  check(
    'phone: steps name only the action',
    (await phone.getByTestId('turn-steps').textContent()) === '1Composite Bow'
  );
  {
    const y = async (l) => (await l.boundingBox()).y;
    const stepsY = await y(phone.getByTestId('turn-steps'));
    check(
      'phone: the steps sit below the buttons and above Confirm',
      stepsY > (await y(phoneMove)) &&
        stepsY < (await y(phone.getByRole('button', {name: /^Confirm/}))),
      stepsY
    );
  }
  await phone.screenshot({path: join(OUT_DIR, 'tactics-phone.png')});
  await phone.screenshot({path: join(OUT_DIR, 'tactics-phone-full.png'), fullPage: true});
  const overflow = await phone.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  check('phone: no sideways scroll', overflow <= 1, overflow);
  await abandonOn(phone);
} finally {
  await browser.close();
}
finish();
