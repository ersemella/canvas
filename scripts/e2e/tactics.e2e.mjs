/**
 * Silk Road Tactics end to end: the `/runs` API against the Worker (player
 * keys, ownership, the view never carrying the seed, one active run per
 * key, illegal turns refused), then the page in Chromium: start,
 * a turn played with real taps and its preview, an enemy's stat sheet, a
 * reload that resumes exactly, and the fight played to victory or defeat
 * (the remaining turns chosen by the AI through a dev-server hook).
 *
 * Against production (no dev hook) the page part only starts a fight. Every run the suite starts is abandoned at the end, so smoke
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
/** The board canvas's scene height (game.json); its width is 672. */
const SCENE_H = 760;
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
/** The leftmost hex of row `r`, in axial coordinates (odd rows reach column −1). */
const leftEdge = (r) => ({q: (r & 1 ? -1 : 0) - (r - (r & 1)) / 2, r});
const rightEdge = (r) => ({q: 7 - (r - (r & 1)) / 2, r});
const sameHex = (a, b) => a.q === b.q && a.r === b.r;
const startedFight = started.body?.view?.fight;
check(
  'starting a run returns a fight already under way',
  started.status === 201 && startedFight?.phase === 'fight',
  started
);
// An enemy that wins a starting speed tie (shuffled) may already have had
// its turn; every other unit (the awaited one included) is still where it started.
const actedFirst = new Set(
  (startedFight.events ?? [])
    .filter((e) => e.kind === 'turn' && e.unitId !== startedFight.awaiting)
    .map((e) => e.unitId)
);
check(
  'each side starts on its outermost column',
  startedFight.units
    .filter((u) => !actedFirst.has(u.id))
    .every((u) => sameHex(u.hex, (u.side === 'player' ? leftEdge : rightEdge)(u.hex.r))) &&
    startedFight.units.every((u) => u.side === 'enemy' || !actedFirst.has(u.id)),
  startedFight.units.map((u) => [u.id, u.hex, actedFirst.has(u.id)])
);
check(
  'the response stops on one of your units',
  /^p-/.test(startedFight.awaiting ?? ''),
  startedFight.awaiting
);
const runId = started.body.runId;
const raw = JSON.stringify(started.body);
check('the view never carries the seed', !/seed/i.test(raw));

check('another key can’t see the run', (await api(`/runs/${runId}`, bob)).status === 403);
check(
  'another key can’t act on the run',
  (
    await api(`/runs/${runId}/turn`, bob, {
      method: 'POST',
      body: JSON.stringify({action: {ability: 'hold'}}),
    })
  ).status === 403
);
check(
  'the key’s active run is remembered',
  (await api('/runs/active', alice)).body?.activeRunId === runId
);
check(
  'there is no deployment step',
  (await api(`/runs/${runId}/deploy`, alice, {method: 'POST', body: '{}'})).status === 404
);
const version = started.body.view.version;

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

// The camel always acts first (camel.md): it walks one hex, and the turn
// stops on a hero, whose turn the checks below use.
check('the camel acts first', startedFight.awaiting === 'p-camel', startedFight.awaiting);
const camelHex = startedFight.units.find((u) => u.id === 'p-camel').hex;
const walked = await api(`/runs/${runId}/turn`, alice, {
  method: 'POST',
  body: JSON.stringify({move: [{q: camelHex.q + 1, r: camelHex.r}], action: {ability: 'hold'}}),
});
const heroView = walked.body?.view;
const heroFight = heroView?.fight;
check(
  'the camel walks one hex, and the turn stops on a hero',
  walked.status === 200 && /^p-/.test(heroFight?.awaiting) && heroFight.awaiting !== 'p-camel',
  walked.body?.message ?? heroFight?.awaiting
);

// The server enforces the same exclusive-action rule as the page, in either order.
const actor = heroFight.units.find((u) => u.id === heroFight.awaiting);
for (const actFirst of [false, true]) {
  const combined = await api(`/runs/${runId}/turn`, alice, {
    method: 'POST',
    body: JSON.stringify({
      move: [{q: actor.hex.q + 1, r: actor.hex.r}],
      action: {ability: 'leap', target: {hex: {q: actor.hex.q + 2, r: actor.hex.r}}},
      actFirst,
    }),
  });
  check(
    `walking plus ability is refused (actFirst=${actFirst})`,
    combined.status === 400 && combined.body?.message?.includes('separate turns'),
    combined.body
  );
}
// Walk up the column into the nearest ally, when it is within a move's reach (4 hexes).
const ally = heroFight.units
  .filter((u) => u.side === 'player' && u !== actor && u.hero !== 'camel')
  .sort((a, b) => Math.abs(a.hex.r - actor.hex.r) - Math.abs(b.hex.r - actor.hex.r))[0];
const gap = ally.hex.r - actor.hex.r;
if (Math.abs(gap) <= 4) {
  const throughAlly = await api(`/runs/${runId}/turn`, alice, {
    method: 'POST',
    body: JSON.stringify({
      move: Array.from({length: Math.abs(gap)}, (_, i) =>
        leftEdge(actor.hex.r + Math.sign(gap) * (i + 1))
      ),
      action: {ability: 'hold'},
    }),
  });
  check(
    'the server refuses walking through an ally',
    throughAlly.status === 400 && throughAlly.body?.message?.includes('Units block'),
    throughAlly.body
  );
} else {
  console.log('  (no ally within reach of the first hero; walking-through check skipped)');
}
check(
  'refused movement changes neither fight nor version',
  JSON.stringify((await api(`/runs/${runId}`, alice)).body.view) === JSON.stringify(heroView)
);

const held = await api(`/runs/${runId}/turn`, alice, {
  method: 'POST',
  body: JSON.stringify({action: {ability: 'hold'}}),
});
check(
  'a turn returns the next view, AI turns included',
  held.status === 200 && held.body.view.version === heroView.version + 1,
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

/** Clicks a hex on the board canvas, scaled from the 672×760 scene to the canvas on screen. */
async function tapHex(hex) {
  const {x, y} = await page.evaluate((h) => window.__tactics.hexToCanvas(h), hex);
  const box = await page.locator('canvas').boundingBox();
  await page.mouse.click(box.x + (x * box.width) / 672, box.y + (y * box.height) / SCENE_H);
  await sleep(150);
}
const state = () => page.evaluate(() => window.__tactics?.run);
const waitIdle = () =>
  page.waitForFunction(() => window.__tactics && !window.__tactics.busy, null, {timeout: 15_000});

/** Abandons the page's active run through the API (quicker than the page's two-tap Reset run), so none is left behind. */
async function abandonOn(p) {
  const key = await p.evaluate(() => localStorage.getItem('canvas:playerKey'));
  const {body} = await api('/runs/active', key);
  if (body?.activeRunId) await api(`/runs/${body.activeRunId}/abandon`, key, {method: 'POST'});
}

try {
  await page.goto(`${WEB_URL}/play/silk-road-tactics`);
  await page.getByRole('button', {name: 'Start a fight'}).click();
  await page
    .getByTestId('turn-controls')
    .getByRole('button', {name: /^Move/})
    .waitFor({timeout: 15_000});
  const devServer = await page
    .waitForFunction(() => window.__tactics, null, {timeout: 3_000})
    .then(() => true)
    .catch(() => false);
  await sleep(300);
  await shot(page, 'fight');
  check(
    'the page goes straight to the fight, with no deployment step',
    !(await page.getByText('Deploy your heroes').count())
  );

  if (!devServer) {
    // Production: no dev hook, so just start a fight and leave it.
    check('the page starts a fight', true);
    check('no page errors', pageErrors.length === 0, pageErrors);
    console.log('  (deep checks skipped: no __tactics hook — not a dev-server build)');
    await abandonOn(page);
    await browser.close();
    finish();
  }

  await waitIdle();
  let run = await state();
  const outrider = 'p-mangudai';

  // The camel always acts first: walk it a hex with real taps (Move, a hex,
  // Move again, now its Confirm); its Move shows its own cost, 14 slots.
  check('the camel acts first', run.view.fight.awaiting === 'p-camel', run.view.fight.awaiting);
  {
    const camelMove = page.locator('[data-choice="move"]');
    check('the camel’s Move shows its 14 slots', (await camelMove.textContent()).endsWith('+14'));
    await camelMove.click();
    const step = (await page.evaluate(() => window.__tactics.reaches.map((r) => r.hex))).find(
      (h) => !sameHex(h, run.view.fight.units.find((u) => u.id === 'p-camel').hex)
    );
    await tapHex(step);
    const v = run.view.version;
    await camelMove.click();
    await page.waitForFunction((v) => window.__tactics.run.view.version > v, v, {
      timeout: 15_000,
    });
    await waitIdle();
    run = await state();
    check(
      'the camel walked one hex',
      sameHex(run.view.fight.units.find((u) => u.id === 'p-camel').hex, step)
    );
  }

  // No top bar: the board gets the whole screen, on desktop too.
  check('no top bar', (await page.locator('header').count()) === 0);

  // One turn with real taps: select Leap, replace it with Move, confirm. The
  // Outrider (fastest, so first) starts somewhere on the left edge, so the
  // hexes come from the page: Leap's farthest target, and a move off its line.
  const before = run.view.version;
  const acting = run.view.fight.units.find((u) => u.id === run.view.fight.awaiting);
  check('the Outrider acts first', acting.id === outrider, acting.id);
  const hexDistance = (a, b) =>
    (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2;
  await page.getByTestId('turn-controls').getByRole('button', {name: /^Leap/}).click();
  await page.waitForFunction(() => window.__tactics.targets.length > 0);
  const leapTargets = await page.evaluate(() => window.__tactics.targets.map((t) => t.hex));
  await page.getByTestId('turn-controls').getByRole('button', {name: /^Leap/}).click(); // and off again
  const leapTo = leapTargets.sort(
    (a, b) => hexDistance(b, acting.hex) - hexDistance(a, acting.hex)
  )[0];
  // The nearest reachable hex, off Leap's lines if one is.
  const dest = (await page.evaluate(() => window.__tactics.reaches.map((r) => r.hex)))
    .filter((h) => hexDistance(h, acting.hex) > 0 && !sameHex(h, leapTo))
    .sort(
      (a, b) =>
        leapTargets.some((t) => sameHex(t, a)) - leapTargets.some((t) => sameHex(t, b)) ||
        hexDistance(a, acting.hex) - hexDistance(b, acting.hex)
    )[0];
  // Without Move, a tap only looks at the hex.
  await tapHex(dest);
  const moveButton = page.locator('[data-choice="move"]');
  check(
    'a tap without Move plans nothing',
    (await moveButton.getAttribute('aria-pressed')) === 'false'
  );
  check('there is no Hold button', !(await page.getByRole('button', {name: /^Hold/}).count()));
  // Select Leap and its target, then replace it with Move and a hex. Picked,
  // Leap is explained under the details; nothing is before.
  const chosen = page.getByTestId('chosen-ability');
  const chosenBefore = await chosen.count();
  await page.getByTestId('turn-controls').getByRole('button', {name: /^Leap/}).click();
  check(
    'picking an ability explains it under the details (and nothing before)',
    chosenBefore === 0 && (await chosen.textContent()).startsWith('Leap'),
    await chosen.textContent().catch(() => null)
  );
  const leapButton = page.locator('[data-choice="leap"]');
  check(
    'a picked ability without a target asks for one',
    /^LeapPick a target$/.test(await leapButton.textContent()),
    await leapButton.textContent()
  );
  // Aimed, its button confirms it; a second tap on the target un-picks it.
  await tapHex(leapTo);
  check(
    'once its target is picked, the ability’s button confirms it',
    /^Confirm\+\d+( → \+\d+)?$/.test(await leapButton.textContent()),
    await leapButton.textContent()
  );
  await tapHex(leapTo);
  check(
    'a second tap on the target un-picks it, without committing',
    (await state()).view.version === before &&
      /^LeapPick a target$/.test(await leapButton.textContent()) &&
      (await leapButton.getAttribute('aria-pressed')) === 'true',
    await leapButton.textContent()
  );
  // Before a target, tapping the ability again puts it down.
  await leapButton.click();
  check(
    'tapping an ability with no target again puts it down',
    (await leapButton.getAttribute('aria-pressed')) === 'false'
  );
  await leapButton.click();
  await tapHex(leapTo);
  await moveButton.click();
  await tapHex(dest);
  check(
    'Move replaces the ability selection',
    (await leapButton.getAttribute('aria-pressed')) === 'false'
  );
  check('putting the ability down hides its explanation', !(await chosen.count()));
  check('there are no numbered steps', !(await page.getByTestId('turn-steps').count()));
  check(
    'Move stays highlighted while a move is planned',
    (await moveButton.getAttribute('aria-pressed')) === 'true'
  );
  check(
    'once its hex is picked, Move’s button confirms it, saying when the next turn comes',
    /^Confirm\+\d+( → \+\d+)?$/.test(await moveButton.textContent()),
    await moveButton.textContent()
  );
  // A second tap on the hex un-picks it; then tapping Move puts it down.
  await tapHex(dest);
  check(
    'a second tap on the destination un-picks it, without committing',
    (await state()).view.version === before &&
      /^MovePick where to move$/.test(await moveButton.textContent()),
    await moveButton.textContent()
  );
  await moveButton.click();
  check(
    'tapping Move with no hex again puts it down',
    (await moveButton.getAttribute('aria-pressed')) === 'false'
  );
  check(
    'with no hex picked, the Move button shows its range of slots',
    /^Move\+\d+(–\d+)?$/.test(await moveButton.textContent()),
    await moveButton.textContent()
  );
  await moveButton.click();
  await tapHex(dest);
  await leapButton.click();
  await tapHex(leapTo);
  check(
    'an ability replaces a planned move',
    (await leapButton.getAttribute('aria-pressed')) === 'true' &&
      (await moveButton.getAttribute('aria-pressed')) === 'false'
  );
  // Like an ability's target, the destination can be changed by tapping
  // another reachable hex.
  await moveButton.click();
  await tapHex(leapTo);
  await tapHex(dest);
  check(
    'tapping another reachable hex changes the destination',
    (await state()).view.version === before &&
      (await moveButton.getAttribute('aria-pressed')) === 'true' &&
      /^Confirm/.test(await moveButton.textContent())
  );
  // A turn has one action, so there is no order to swap.
  check(
    'Swap order is offered only when the other order is legal',
    !(await page.getByRole('button', {name: /Swap order/}).count())
  );
  const skip = page.getByTestId('skip-turn');
  check(
    'Skip turn says when the next turn comes, in slots from now',
    /^Skip turn · \+\d+( → \+\d+)?$/.test(await skip.textContent()),
    await skip.textContent()
  );
  // Its first tap only arms it, and it disarms on its own.
  await skip.click();
  check(
    'a first tap on Skip turn only arms it',
    (await skip.textContent()) === 'Tap again to skip' && (await state()).view.version === before,
    await skip.textContent()
  );
  // A tap anywhere else disarms it (here, on the board).
  await tapHex(acting.hex);
  check(
    'a tap elsewhere disarms Skip turn',
    /^Skip turn/.test(await skip.textContent()) && (await state()).view.version === before,
    await skip.textContent()
  );
  await skip.click();
  await sleep(3300);
  check(
    'an armed Skip turn disarms after a while',
    /^Skip turn/.test(await skip.textContent()),
    await skip.textContent()
  );
  check(
    'only the picked button confirms: there’s no other Confirm',
    (await page.getByRole('button', {name: /^Confirm/}).count()) === 1
  );
  await sleep(200);
  await shot(page, 'preview');
  await moveButton.click();
  await page.waitForFunction((v) => window.__tactics.run.view.version > v, before, {
    timeout: 15_000,
  });
  // While the turn plays back (the empty slots and the enemies' turns), the
  // next unit's choices show but can't be picked (the ⋯ menu stays).
  const turnButtonsEnabled = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('[data-testid="turn-controls"] button')]
        .filter((b) => b.getAttribute('aria-label') !== 'Menu')
        .map((b) => !b.disabled)
    );
  const playingBack = await page.evaluate(() => window.__tactics.busy);
  const during = await turnButtonsEnabled();
  if (playingBack)
    check(
      'during a playback every turn button is disabled',
      during.length > 0 && during.every((on) => !on),
      during
    );
  run = await state();
  const movedUnit = run.view.fight.units.find((u) => u.id === acting.id);
  check(
    'the turn moved the unit with real taps',
    !movedUnit.alive || (movedUnit.hex.q === dest.q && movedUnit.hex.r === dest.r),
    movedUnit.hex
  );

  // An enemy's stat sheet.
  // After the turn's playback: a click during one only skips it.
  await waitIdle();
  const after = await turnButtonsEnabled();
  check(
    'after the playback, the turn buttons work again',
    after.some((on) => on),
    after
  );
  run = await state();
  const enemy = run.view.fight.units.find((u) => u.side === 'enemy' && u.alive);
  await tapHex(enemy.hex);
  const sheet = page.getByTestId('stat-sheet');
  check(
    'tapping an enemy shows its stat sheet, its name in the enemy’s colour',
    (await sheet.locator('[data-side="enemy"]').count()) === 1
  );
  check(
    'the sheet leaves out what it could do next turn',
    !(await sheet.textContent()).includes('Could do next turn')
  );
  check('the sheet doesn’t list Hold', !(await sheet.textContent()).includes('Hold'));
  // Abilities by name; a click explains one, in slots, not costs.
  await sheet.locator('[data-ability]').first().click();
  const about = page.getByTestId('ability-info');
  check(
    'a click on an ability’s name explains it, in slots, not costs',
    /(Cost|Charge) \+\d+/.test(await about.textContent()) &&
      !/(Cost|Charge|Recovery) \d/.test(await about.textContent()),
    await about.textContent().catch(() => null)
  );
  // A keyword clicked on the enemy's sheet explains itself there, the
  // enemy's sheet staying (not going back to the unit whose turn it is).
  await sheet.locator('[data-keyword="speed"]').click();
  check(
    'a click on a keyword keeps the enemy’s sheet, explaining it',
    (await sheet.locator('[data-side="enemy"]').count()) === 1 &&
      (await page.getByTestId('keyword-info').textContent()).startsWith('Speed.')
  );
  check(
    'the sheet says spaces, not hexes, and has no next turn',
    !/\bhex|Next turn/i.test(await sheet.textContent()),
    (await sheet.textContent()).slice(0, 200)
  );
  await shot(page, 'enemy-sheet');

  check(
    'the page is the board’s black',
    (await page.evaluate(
      () => getComputedStyle(document.querySelector('[class*="page"]')).backgroundColor
    )) === 'rgb(0, 0, 0)'
  );

  // Hovering a hex shows what it does, without planning a move.
  // Each fight places its own quicksand: find one in the view.
  const [qq, qr] = Object.entries((await state()).view.fight.tiles)
    .find(([, t]) => t === 'hazard')[0]
    .split(',')
    .map(Number);
  const quicksand = {q: qq, r: qr};
  const versionBeforeHover = (await state()).view.version;
  {
    const {x, y} = await page.evaluate((h) => window.__tactics.hexToCanvas(h), quicksand);
    const box = await page.locator('canvas').boundingBox();
    await page.mouse.move(box.x + (x * box.width) / 672, box.y + (y * box.height) / SCENE_H);
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

  // Reset run, in the menu: the first tap only arms it; the second starts a fresh run.
  const beforeReset = (await state()).runId;
  await page.getByRole('button', {name: 'Menu'}).click();
  await page.getByRole('menuitem', {name: 'Reset run'}).click();
  await sleep(300);
  check('one tap on Reset run changes nothing', (await state()).runId === beforeReset);
  await page.getByRole('menuitem', {name: 'Tap again to reset'}).click();
  await page.waitForFunction((id) => window.__tactics.run?.runId !== id, beforeReset, {
    timeout: 15_000,
  });
  await waitIdle();
  check(
    'a second tap on Reset run starts a fresh fight',
    (await state()).view.fight.phase === 'fight'
  );
  const resetOld = await api(
    `/runs/${beforeReset}`,
    await page.evaluate(() => localStorage.getItem('canvas:playerKey'))
  );
  check('the reset run is abandoned', resetOld.body?.status === 'abandoned', resetOld.body);

  // Skip turn, tapped twice, ends the turn with Hold.
  {
    await waitIdle();
    const r = await state();
    if (r.view.fight.phase === 'fight') {
      const unit = r.view.fight.awaiting;
      const skipButton = page.getByTestId('skip-turn');
      await skipButton.click();
      check(
        'its first tap arms it',
        (await skipButton.textContent()) === 'Tap again to skip',
        await skipButton.textContent()
      );
      await skipButton.click();
      await page.waitForFunction((v) => window.__tactics.run.view.version > v, r.view.version, {
        timeout: 15_000,
      });
      const after = await state();
      check(
        'a second tap on Skip turn ends the turn',
        after.view.fight.phase !== 'fight' ||
          after.view.fight.awaiting !== unit ||
          after.view.fight.currentSlot > r.view.fight.currentSlot,
        [unit, after.view.fight.awaiting]
      );
    }
  }

  // Pin may step one hex first (2026-10-21): play on until the Champion can
  // pin a unit only after a step, then pick it and its step with real taps.
  {
    const sameH = (a, b) => a.q === b.q && a.r === b.r;
    let found = null;
    for (let i = 0; i < 80 && !found; i++) {
      await waitIdle();
      const r = await state();
      if (r.view.fight.phase !== 'fight') break;
      const pinButton = page.locator('[data-choice="pin"]');
      if (r.view.fight.awaiting === 'p-bokh' && !(await pinButton.isDisabled())) {
        await pinButton.click();
        const ts = await page.evaluate(() => window.__tactics.targets);
        const stepOnly = ts.find((t) => t.to && !ts.some((u) => !u.to && sameH(u.hex, t.hex)));
        if (stepOnly) found = {targets: ts, target: stepOnly.hex};
        else await pinButton.click();
      }
      if (found) break;
      const v = r.view.version;
      await page.evaluate(() => window.__tactics.autoTurn());
      await page.waitForFunction((x) => window.__tactics.run.view.version > x, v, {
        timeout: 15_000,
      });
    }
    if (!found) console.log('  (no step-only Pin came up; step checks skipped)');
    else {
      const steps = found.targets.filter((t) => t.to && sameH(t.hex, found.target));
      await tapHex(found.target);
      // The picked button asks for what's missing, then confirms.
      const confirm = page.locator('[data-choice="pin"]');
      if (steps.length > 1) {
        check(
          'Pin asks where to step first',
          (await confirm.textContent()).includes('Pick where to step'),
          await confirm.textContent()
        );
        await tapHex(steps[0].to);
      }
      check(
        'Pin with its step is ready to confirm',
        /^Confirm/.test(await confirm.textContent()),
        await confirm.textContent()
      );
      const v = (await state()).view.version;
      await confirm.click();
      await page.waitForFunction((x) => window.__tactics.run.view.version > x, v, {
        timeout: 15_000,
      });
      // The reply lands before its playback starts: wait until it stays idle.
      await waitIdle();
      await sleep(500);
      await waitIdle();
      // What the turn did, from its events (the enemy's replies may move units after).
      const events = (await state()).view.fight.events ?? [];
      const stepAt = events.findIndex(
        (e) => e.kind === 'step' && e.unitId === 'p-bokh' && sameH(e.to, steps[0].to)
      );
      const pinAt = events.findIndex(
        (e) =>
          e.kind === 'action' &&
          e.unitId === 'p-bokh' &&
          e.ability === 'pin' &&
          sameH(e.target, found.target)
      );
      check(
        'Pin stepped, then pinned',
        stepAt >= 0 && pinAt >= 0,
        events.filter((e) => e.unitId === 'p-bokh').map((e) => [e.kind, e.ability, e.to])
      );
    }
  }

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
    await page
      .getByTestId('turn-controls')
      .getByRole('button', {name: /^Move/})
      .waitFor({timeout: 15_000});
    check('abandoning starts a fresh run', (await state()).runId !== stalled);
  }
  run = await state();
  check(
    'the fight ends in victory or defeat',
    ['won', 'lost'].includes(run.view.fight.phase),
    run.view.fight.phase
  );
  // The result waits for the last turn's playback to show how the fight ended.
  check(
    'the result is shown',
    await page
      .getByText(/^(Victory|Defeat)$/)
      .waitFor({timeout: 15_000})
      .then(() => true)
      .catch(() => false)
  );
  await sleep(300);
  await shot(page, 'end');
  check(
    'New fight takes the turn’s buttons’ place',
    await page.getByRole('button', {name: 'New fight'}).isVisible()
  );
  // On a phone the finished fight keeps the action section's height, so the board stays put.
  await page.setViewportSize({width: 390, height: 664});
  await sleep(300);
  {
    const box = await page.locator('canvas').boundingBox();
    const bar = await page
      .getByRole('button', {name: 'New fight'})
      .evaluate((el) => el.closest('section').getBoundingClientRect());
    check(
      'phone, fight over: New fight in the action section, the board against it',
      Math.abs(bar.top - (box.y + box.height)) <= 12 && bar.height > 150,
      [box, bar]
    );
    await shot(page, 'end-phone');
  }
  check('no page errors', pageErrors.length === 0, pageErrors);

  // A phone: board on top, details in a tooltip over it, the action section
  // pinned to the bottom of the screen; no heading or hints; no scrolling.
  const phone = await browser.newPage({...devices['iPhone 13']});
  await phone.goto(`${WEB_URL}/play/silk-road-tactics`);
  await phone.getByRole('button', {name: 'Start a fight'}).click();
  const phoneMove = phone.locator('[data-choice="move"]');
  await phoneMove.waitFor({timeout: 15_000});
  await phone.waitForFunction(() => window.__tactics && !window.__tactics.busy, null, {
    timeout: 15_000,
  });
  await sleep(300);
  check(
    'phone: no turn heading or hints',
    !(await phone.getByText(/^Your turn:|Tap a hex to look/).count())
  );
  check('phone: no top bar', (await phone.locator('header').count()) === 0);
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
  // Tap an enemy: its details show in a tooltip beside it, with as much
  // detail as fits on screen, and the actions stay on screen.
  const phoneFight = await phone.evaluate(() => window.__tactics.run.view.fight);
  const onPhone = async (hex) => {
    const {x, y} = await phone.evaluate((h) => window.__tactics.hexToCanvas(h), hex);
    const box = await phone.locator('canvas').boundingBox();
    return {x: box.x + (x * box.width) / 672, y: box.y + (y * box.height) / SCENE_H};
  };
  const foe = phoneFight.units.find((u) => u.side === 'enemy' && u.alive).hex;
  const foeAt = await onPhone(foe);
  await phone.touchscreen.tap(foeAt.x, foeAt.y);
  await sleep(300);
  const tooltip = phone.getByTestId('hex-tooltip');
  const phoneSheet = tooltip.getByTestId('stat-sheet');
  check(
    'phone: tapping an enemy shows its details in a tooltip',
    (await phoneSheet.locator('[data-side="enemy"]').count()) === 1
  );
  const actionBarTop = await phoneMove.evaluate(
    (el) => el.closest('section').getBoundingClientRect().top
  );
  {
    const t = await tooltip.boundingBox();
    const vw = phone.viewportSize().width;
    check(
      'phone: the tooltip is on screen (over the action bar only if it needs the room), clear of the tapped hex',
      t.x >= 0 &&
        t.x + t.width <= vw + 1 &&
        t.y >= 0 &&
        t.y + t.height <= phone.viewportSize().height + 1 &&
        !(
          foeAt.x >= t.x &&
          foeAt.x <= t.x + t.width &&
          foeAt.y >= t.y &&
          foeAt.y <= t.y + t.height
        ),
      [t, foeAt, actionBarTop]
    );
  }
  check('phone: the action section stays on screen', await inViewport(phoneMove));
  {
    const colours = await phoneMove.evaluate((el) => {
      const page = getComputedStyle(el.closest('section').parentElement.closest('[class*="page"]'));
      return [
        page.backgroundColor,
        getComputedStyle(document.querySelector('canvas')).backgroundColor,
      ];
    });
    check(
      'phone: the actions share the board’s black',
      colours[0] === 'rgb(0, 0, 0)' && colours[1] === 'rgb(0, 0, 0)',
      colours
    );
  }
  await shot(phone, 'phone-tooltip');
  // Always complete: every ability, the ultimate's keyword, nothing to expand.
  check(
    'phone: the tooltip lists the abilities by name, nothing to expand',
    (await tooltip.locator('[data-ability]').count()) >= 3 &&
      !(await tooltip.getByText(/^Tap for/).count()) &&
      !(await tooltip.getByText('Health', {exact: true}).locator('[data-keyword]').count())
  );
  // An ability's name explains it on a tap; a keyword in that explanation
  // adds its rule under it, the ability's staying.
  {
    const chip = tooltip.locator('[data-ability]').first();
    const name = await chip.textContent();
    await chip.tap();
    await sleep(150);
    const about = tooltip.getByTestId('ability-info');
    check(
      'phone: tapping an ability’s name explains it',
      (await about.count()) === 1 && (await about.textContent()).startsWith(name),
      await about.textContent().catch(() => null)
    );
    check(
      'phone: the ability is explained inside the unit’s card',
      (await phoneSheet.getByTestId('ability-info').count()) === 1
    );
    await about.locator('[data-keyword]').last().tap();
    await sleep(150);
    check(
      'phone: a keyword in it adds its rule, the ability’s staying',
      (await about.count()) === 1 && (await tooltip.getByTestId('keyword-info').count()) === 1
    );
    await shot(phone, 'phone-ability');
    await chip.tap();
    await sleep(150);
    check('phone: tapping the name again hides it', !(await about.count()));
  }
  // A keyword shows its rule on a tap, in the tooltip; another tap hides it.
  await tooltip.locator('[data-keyword="speed"]').tap();
  await sleep(150);
  const rule = tooltip.getByTestId('keyword-info');
  check(
    'phone: tapping a keyword shows its rule',
    (await rule.count()) === 1 && (await rule.textContent()).startsWith('Speed.'),
    await rule.textContent().catch(() => null)
  );
  await shot(phone, 'phone-keyword');
  await tooltip.locator('[data-keyword="speed"]').tap();
  await sleep(150);
  check('phone: tapping it again hides the rule', !(await rule.count()));
  check(
    'phone: no “could do next turn” on an enemy',
    !(await tooltip.textContent()).includes('Could do next turn')
  );
  // Tapping the same hex again closes the tooltip.
  await phone.touchscreen.tap(foeAt.x, foeAt.y);
  await sleep(200);
  check('phone: tapping the hex again closes the tooltip', !(await tooltip.count()));
  // So does tapping the tooltip itself, anywhere but a keyword or an ability's name.
  await phone.touchscreen.tap(foeAt.x, foeAt.y);
  await sleep(200);
  {
    const name = await tooltip.getByTestId('stat-sheet').locator('[data-side]').boundingBox();
    await phone.touchscreen.tap(name.x + name.width / 2, name.y + name.height / 2);
    await sleep(200);
    check('phone: tapping the tooltip closes it', !(await tooltip.count()));
  }
  // Every unit: the tooltip never covers the hex or the unit's health bar and
  // statuses, and only scrolls when neither side of them has room for it all
  // (below, down over the action bar to the screen's bottom).
  {
    const squeezed = [];
    const covering = [];
    for (const u of phoneFight.units.filter((x) => x.alive)) {
      const at = await onPhone(u.hex);
      await phone.touchscreen.tap(at.x, at.y);
      await sleep(200);
      const m = await tooltip.evaluate((el) => ({
        full: el.scrollHeight,
        shown: el.clientHeight,
        room: Number(el.dataset.room),
      }));
      if (m.full > m.shown + 1 && m.room >= m.full + 2) squeezed.push({unit: u.id, ...m});
      const span = await phone.evaluate((h) => window.__tactics.overlaySpan(h), u.hex);
      const canvas = await phone.locator('canvas').boundingBox();
      const t = await tooltip.boundingBox();
      const top = canvas.y + (span.top * canvas.height) / SCENE_H;
      const bottom = canvas.y + (span.bottom * canvas.height) / SCENE_H;
      if (t.y < bottom - 1 && t.y + t.height > top + 1)
        covering.push({unit: u.id, tooltip: [t.y, t.y + t.height], unitSpan: [top, bottom]});
      await phone.touchscreen.tap(at.x, at.y); // close it
      await sleep(150);
    }
    check('phone: no tooltip squeezed while there’s room for it', !squeezed.length, squeezed);
    check('phone: no tooltip covers a unit’s health bar or statuses', !covering.length, covering);
  }
  // Plain sand has nothing to explain: tapping it shows no tooltip.
  {
    const quiet = phoneFight.units.map((u) => u.hex && `${u.hex.q},${u.hex.r}`);
    const busyHexes = new Set([
      ...quiet,
      ...Object.keys(phoneFight.tiles ?? {}),
      ...phoneFight.effects.map((e) => `${e.hex.q},${e.hex.r}`),
    ]);
    const reaches = await phone.evaluate(() => window.__tactics.reaches.map((r) => r.hex));
    const sand = reaches.find((h) => !busyHexes.has(`${h.q},${h.r}`));
    const at = await onPhone(sand);
    await phone.touchscreen.tap(at.x, at.y);
    await sleep(200);
    check('phone: tapping plain sand shows no tooltip', !(await tooltip.count()));
    // And with a tooltip open, tapping plain sand closes it.
    await phone.touchscreen.tap(foeAt.x, foeAt.y);
    await sleep(200);
    await phone.touchscreen.tap(at.x, at.y);
    await sleep(200);
    check('phone: tapping plain sand closes the tooltip', !(await tooltip.count()));
    await phone.touchscreen.tap(foeAt.x, foeAt.y);
    await sleep(200);
    // Tapping away from the board (here, the space above it: the board
    // sits down against the action bar) closes it too.
    const box = await phone.locator('canvas').boundingBox();
    check(
      'phone: the board sits against the action section',
      box.y > 8 && actionBarTop - (box.y + box.height) <= 12,
      [box, actionBarTop]
    );
    await phone.touchscreen.tap(4, box.y / 2);
    await sleep(200);
    check('phone: tapping away closes the tooltip', !(await tooltip.count()));
    // Any tap outside the tooltip closes it, a turn button's too.
    await phone.touchscreen.tap(foeAt.x, foeAt.y);
    await sleep(200);
    const moveBox = await phoneMove.boundingBox();
    const moveAt = {x: moveBox.x + moveBox.width / 2, y: moveBox.y + moveBox.height / 2};
    await phone.touchscreen.tap(moveAt.x, moveAt.y);
    await sleep(200);
    check('phone: tapping a turn button closes the tooltip', !(await tooltip.count()));
    // And a hex to move to (one the tooltip doesn't cover, nor sit just
    // beside: a touch there snaps to the tooltip, which closes it instead).
    await phone.touchscreen.tap(foeAt.x, foeAt.y);
    await sleep(200);
    const tipNow = await tooltip.boundingBox();
    const clear = (p, m = 24) =>
      !tipNow ||
      p.x < tipNow.x - m ||
      p.x > tipNow.x + tipNow.width + m ||
      p.y < tipNow.y - m ||
      p.y > tipNow.y + tipNow.height + m;
    let stepAt = null;
    for (const r of await phone.evaluate(() => window.__tactics.reaches)) {
      if (r.path.length === 0) continue;
      const p = await onPhone(r.hex);
      if (clear(p)) {
        stepAt = p;
        break;
      }
    }
    if (stepAt) {
      const version = await phone.evaluate(() => window.__tactics.run.view.version);
      await phone.touchscreen.tap(stepAt.x, stepAt.y);
      await sleep(200);
      check(
        'phone: tapping a hex to move to closes the tooltip (and plans the move)',
        !(await tooltip.count()) && /^Confirm/.test(await phoneMove.textContent()),
        await phoneMove.textContent()
      );
      // Put the move down again: un-pick the hex (Move's button now
      // confirms it), then Move.
      await phone.touchscreen.tap(stepAt.x, stepAt.y);
      await sleep(200);
      await phone.touchscreen.tap(moveAt.x, moveAt.y);
      await sleep(200);
      check(
        'phone: the move is put down again, nothing committed',
        (await phoneMove.getAttribute('aria-pressed')) === 'false' &&
          (await phone.evaluate(() => window.__tactics.run.view.version)) === version
      );
    } else {
      console.log('  (move-tap check skipped: the tooltip covers every reachable hex)');
      await phone.touchscreen.tap(moveAt.x, moveAt.y); // Move down again
      await sleep(200);
    }
    // A track card shows its unit, not the hex looked at before (which could
    // have emptied since, leaving an empty box).
    await phone.touchscreen.tap(foeAt.x, foeAt.y);
    await sleep(200);
    // The tooltip may reach up over the track: a card it covers isn't
    // tappable, nor one just beside it (a touch snaps to the tooltip).
    const canvasBox = await phone.locator('canvas').boundingBox();
    const tipBox = await tooltip.boundingBox();
    let picked = null;
    for (const u of phoneFight.units.filter((v) => v.side === 'player' && v.alive)) {
      const c = await phone.evaluate((id) => window.__tactics.cardCenter(id), u.id);
      if (!c) continue;
      const at = {
        x: canvasBox.x + (c.x * canvasBox.width) / 672,
        y: canvasBox.y + (c.y * canvasBox.height) / SCENE_H,
      };
      const m = 24;
      const covered =
        at.x >= tipBox.x - m &&
        at.x <= tipBox.x + tipBox.width + m &&
        at.y >= tipBox.y - m &&
        at.y <= tipBox.y + tipBox.height + m;
      if (!covered) {
        picked = {unit: u.id, at};
        break;
      }
    }
    if (picked) {
      await phone.touchscreen.tap(picked.at.x, picked.at.y);
      await sleep(300);
      check(
        'phone: tapping a track card shows its unit, in place of the hex tapped before',
        (await phoneSheet.locator('[data-side="player"]').count()) === 1,
        {picked, tooltip: await tooltip.innerText().catch(() => null)}
      );
    } else {
      console.log('  (track card check skipped: the tooltip covers every ally card)');
    }
    await phone.touchscreen.tap(4, canvasBox.y / 2);
    await sleep(200);
  }
  // The run's menu: back to the games, and Reset run, which one tap only arms.
  check(
    'phone: no Reset run button on the page',
    !(await phone.getByRole('button', {name: 'Reset run'}).count())
  );
  await phone.getByRole('button', {name: 'Menu'}).tap();
  const allGames = phone.getByRole('menuitem', {name: 'All games'});
  await allGames.waitFor({timeout: 5_000});
  const phoneRunId = await phone.evaluate(() => window.__tactics.run.runId);
  await phone.getByRole('menuitem', {name: 'Reset run'}).tap();
  await sleep(150);
  check(
    'phone: Reset run in the menu only arms on the first tap',
    (await phone.getByRole('menuitem', {name: 'Tap again to reset'}).isVisible()) &&
      (await phone.evaluate(() => window.__tactics.run.runId)) === phoneRunId
  );
  await phone.keyboard.press('Escape');
  await sleep(150);
  {
    const scroll = await phone.evaluate(
      () => document.documentElement.scrollHeight - window.innerHeight
    );
    check('phone: the page doesn’t scroll', scroll <= 1, scroll);
  }
  // Move on and no hex yet: its button asks for one; once picked, it
  // confirms, saying when the next turn comes.
  {
    await phoneMove.click();
    check(
      'phone: with Move on and no hex yet, its button asks for one',
      /^MovePick where to move$/.test(await phoneMove.textContent()),
      await phoneMove.textContent()
    );
    const free = await phone.evaluate(
      () => window.__tactics.reaches.find((r) => r.path.length > 0).hex
    );
    const {x, y} = await phone.evaluate((h) => window.__tactics.hexToCanvas(h), free);
    const box = await phone.locator('canvas').boundingBox();
    const at = {x: (x * box.width) / 672, y: (y * box.height) / SCENE_H};
    await phone.tap('canvas', {position: at});
    await sleep(250);
    check(
      'phone: a planned move turns the Move button into its Confirm, with its slots',
      /^Confirm\+\d+( → \+\d+)?$/.test(await phoneMove.textContent()),
      await phoneMove.textContent()
    );
    await phone.tap('canvas', {position: at}); // un-pick the hex
    await sleep(250);
    await phoneMove.click(); // and put Move down
    check(
      'phone: putting the move down shows the range again',
      (await phoneMove.getAttribute('aria-pressed')) === 'false' &&
        /^Move\+\d+(–\d+)?$/.test(await phoneMove.textContent()),
      await phoneMove.textContent()
    );
  }
  // No Hold button: Skip turn, at the bottom, ends the turn with Hold.
  check('phone: no Hold button', !(await phone.getByRole('button', {name: /^Hold/}).count()));
  check(
    'phone: Skip turn says when the next turn comes',
    /^Skip turn · \+\d+( → \+\d+)?$/.test(
      await phone.getByRole('button', {name: /^Skip turn/}).textContent()
    )
  );
  // Tapping a target twice un-picks it: only the button commits.
  const tapOn = async (hex) => {
    const {x, y} = await phone.evaluate((h) => window.__tactics.hexToCanvas(h), hex);
    const box = await phone.locator('canvas').boundingBox();
    await phone.tap('canvas', {
      position: {x: (x * box.width) / 672, y: (y * box.height) / SCENE_H},
    });
    await sleep(250);
  };
  // The camel acts first: the AI plays it, so a hero with Leap is up. Its
  // turn (Move alone) keeps the heroes' room, so the board doesn't move.
  const camelBoard = await phone.locator('canvas').boundingBox();
  await shot(phone, 'phone-camel');
  const camelUp =
    (await phone.evaluate(() => window.__tactics.run.view.fight.awaiting)) === 'p-camel';
  while ((await phone.evaluate(() => window.__tactics.run.view.fight.awaiting)) === 'p-camel') {
    const v = await phone.evaluate(() => window.__tactics.run.view.version);
    await phone.evaluate(() => window.__tactics.autoTurn());
    await phone.waitForFunction(
      (v) => window.__tactics.run.view.version > v && !window.__tactics.busy,
      v,
      {timeout: 15_000}
    );
  }
  await phone.locator('[data-choice="leap"]').waitFor({timeout: 15_000});
  if (camelUp) {
    const heroBoard = await phone.locator('canvas').boundingBox();
    check(
      'phone: the board stays put from the camel’s turn to a hero’s',
      Math.abs(heroBoard.y - camelBoard.y) < 1 &&
        Math.abs(heroBoard.height - camelBoard.height) < 1,
      [camelBoard, heroBoard]
    );
  }
  const phoneVersion = await phone.evaluate(() => window.__tactics.run.view.version);
  const moveBoxBefore = await phoneMove.boundingBox();
  const phoneLeap = phone.locator('[data-choice="leap"]');
  const leapCost = await phoneLeap.textContent();
  await phoneLeap.click();
  await phone.waitForFunction(() => window.__tactics.targets.length > 0);
  check(
    'phone: with no target yet, the ability’s button asks for one',
    /^LeapPick a target$/.test(await phoneLeap.textContent()),
    await phoneLeap.textContent()
  );
  {
    const after = await phoneMove.boundingBox();
    check(
      'phone: picking an ability doesn’t move the buttons',
      Math.abs(after.y - moveBoxBefore.y) < 1,
      [moveBoxBefore.y, after.y]
    );
    check('phone: the action buttons are big', after.height >= 50, after.height);
  }
  const aim = await phone.evaluate(() => window.__tactics.targets[0].hex);
  await tapOn(aim);
  const phoneConfirm = await phoneLeap.textContent();
  check(
    'phone: aimed, the ability’s button confirms it, saying when the next turn comes',
    /^Confirm\+\d+( → \+\d+)?$/.test(phoneConfirm),
    phoneConfirm
  );
  check(
    'phone: the ability button showed the same slots as its Confirm',
    leapCost.endsWith(phoneConfirm.match(/^Confirm(\+\d+)/)[1]),
    [leapCost, phoneConfirm]
  );
  await tapOn(aim);
  check(
    'phone: a second tap on the target un-picks it, without committing',
    (await phone.evaluate(() => window.__tactics.run.view.version)) === phoneVersion &&
      /^LeapPick a target$/.test(await phoneLeap.textContent())
  );
  await tapOn(aim);
  check('phone: there are no numbered steps', !(await phone.getByTestId('turn-steps').count()));
  await phone.screenshot({path: join(OUT_DIR, 'tactics-phone.png')});
  await phone.screenshot({path: join(OUT_DIR, 'tactics-phone-full.png'), fullPage: true});
  const overflow = await phone.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  check('phone: no sideways scroll', overflow <= 1, overflow);
  // A smaller phone (iPhone SE's screen less Safari's bars): still no scrolling.
  await phone.setViewportSize({width: 375, height: 553});
  await sleep(300);
  {
    const scroll = await phone.evaluate(
      () => document.documentElement.scrollHeight - window.innerHeight
    );
    check('small phone: the page doesn’t scroll', scroll <= 1, scroll);
    const box = await phone.locator('canvas').boundingBox();
    const barTop = await phoneMove.evaluate(
      (el) => el.closest('section').getBoundingClientRect().top
    );
    check(
      'small phone: the board shrinks to fit above the action section, centred',
      box.y + box.height <= barTop + 1 && Math.abs(box.x * 2 + box.width - 375) <= 2,
      [box, barTop]
    );
  }
  await phone.screenshot({path: join(OUT_DIR, 'tactics-phone-small.png')});
  await abandonOn(phone);
} finally {
  await browser.close();
}
finish();
