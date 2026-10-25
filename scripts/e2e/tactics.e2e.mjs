/**
 * Silk Road Run end to end, in Chromium: the run plays in the browser, so
 * the page sends no `/runs` request (docs/plans/client-side-runs.md). Start,
 * a turn played with real taps and its preview, an enemy's stat sheet, a
 * reload that resumes exactly, a second tab refused while the first has
 * the run (and taking it over once that one closes), and the fight played
 * to victory or defeat (the remaining turns chosen by the AI through a
 * dev-server hook). The rules behind the page are unit-tested in the game
 * package (`src/rules/*.test.ts`).
 *
 * Against production (no dev hook) the page part only starts a fight.
 */
import {chromium, devices} from 'playwright';
import {join} from 'node:path';
import {OUT_DIR, WEB_URL, check, finish, sleep} from './lib.mjs';

/** The board canvas's scene size (game.json). */
const SCENE_W = 594;
const SCENE_H = 826;
const shot = (page, name) => page.screenshot({path: join(OUT_DIR, `tactics-${name}.png`)});
/** Where the page saves its run (`localRuns.ts`). */
const RUN_STORAGE = 'canvas:tactics:run';
const sameHex = (a, b) => a.q === b.q && a.r === b.r;

// ── The page ─────────────────────────────────────────────────────────────────
const browser = await chromium.launch();
// One context for the desktop's tabs, which share the run's storage and its tab lock.
const desktop = await browser.newContext({viewport: {width: 1300, height: 900}});
const page = await desktop.newPage();
const pageErrors = [];
page.on('pageerror', (e) => {
  pageErrors.push(e.message);
  console.log('  [page error]', e.message);
});
/** Requests to the Worker's old `/runs` routes: the run never leaves the browser. */
const runRequests = [];
desktop.on('request', (r) => {
  if (/\/runs(\/|$|\?)/.test(new URL(r.url()).pathname)) runRequests.push(r.url());
});

/** Clicks a hex on the board canvas, scaled from the 594×760 scene to the canvas on screen. */
/** Where a hex's centre is on the screen. */
async function hexPoint(hex) {
  const {x, y} = await page.evaluate((h) => window.__tactics.hexToCanvas(h), hex);
  const box = await page.locator('canvas').boundingBox();
  return {x: box.x + (x * box.width) / SCENE_W, y: box.y + (y * box.height) / SCENE_H};
}
async function tapHex(hex) {
  const {x, y} = await hexPoint(hex);
  await page.mouse.click(x, y);
  await sleep(150);
}
/**
 * Taps the first of `hexes` that nothing covers, for a tap meant only to
 * look: the board's Confirm sits under the hex picked last, so on a covered
 * hex the tap would press it and commit the turn.
 */
async function tapUncovered(...hexes) {
  for (const hex of hexes) {
    const point = await hexPoint(hex);
    const bare = await page.evaluate(
      ({x, y}) => document.elementFromPoint(x, y)?.tagName === 'CANVAS',
      point
    );
    if (bare) return tapHex(hex);
  }
  throw new Error(`every hex to tap is covered: ${JSON.stringify(hexes)}`);
}
const state = () => page.evaluate(() => window.__tactics?.run);
const waitIdle = () =>
  page.waitForFunction(() => window.__tactics && !window.__tactics.busy, null, {timeout: 15_000});

/** Abandons the page's saved run (quicker than the page's two-tap Reset run): a reload then opens the start menu. */
async function abandonOn(p) {
  await p.evaluate((key) => {
    const run = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (run?.status === 'active')
      localStorage.setItem(key, JSON.stringify({...run, status: 'abandoned'}));
  }, RUN_STORAGE);
}

try {
  await page.goto(`${WEB_URL}/play/silk-road-run`);
  // The start menu: the game in brief, the five heroes (the three
  // prototype heroes taken at first), Start.
  const picks = page.getByTestId('hero-picks').getByRole('button');
  await picks.first().waitFor({timeout: 15_000});
  check('the start menu offers the five heroes', (await picks.count()) === 5);
  check(
    'the three prototype heroes start in the party',
    JSON.stringify(
      await picks.evaluateAll((bs) => bs.map((b) => b.getAttribute('aria-pressed')))
    ) === JSON.stringify(['true', 'true', 'true', 'false', 'false'])
  );
  await shot(page, 'start-menu');
  const startButton = page.getByRole('button', {name: 'Start', exact: true});
  for (let i = 0; i < 3; i++) await picks.nth(i).click();
  check('with no hero taken, Start is disabled', await startButton.isDisabled());
  for (let i = 0; i < 3; i++) await picks.nth(i).click();
  // A phone: the heroes stack, with no sideways scroll; one is left behind.
  await page.setViewportSize({width: 390, height: 844});
  await picks.nth(1).click();
  check(
    'phone: the start menu doesn’t scroll sideways',
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
  );
  await shot(page, 'start-menu-phone');
  await picks.nth(1).click();
  await page.setViewportSize({width: 1300, height: 900});
  await startButton.click();
  await page
    .getByTestId('turn-controls')
    .getByRole('button', {name: /^Move/})
    .waitFor({timeout: 15_000});
  const devServer = await page
    .waitForFunction(() => window.__tactics, null, {timeout: 3_000})
    .then(() => true)
    .catch(() => false);
  await sleep(300);
  // Desktop: the board as tall as the 900px screen allows (less the page's 24px).
  const desktopBoard = await page.locator('canvas').boundingBox();
  check('desktop: the board fills the screen’s height', desktopBoard.height >= 870, desktopBoard);
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
    await browser.close();
    finish();
  }

  await waitIdle();
  let run = await state();
  const stormCaller = 'p-storm';

  // The camel walks itself, so the page stops on a hero: walk it a hex with
  // a real click (on desktop no Move first) and Enter.
  check(
    'the camel walks itself: the page stops on a hero',
    /^p-/.test(run.view.fight.awaiting) && run.view.fight.awaiting !== 'p-camel',
    run.view.fight.awaiting
  );
  {
    const heroMove = page.locator('[data-choice="move"]');
    const walker = run.view.fight.awaiting;
    const step = (await page.evaluate(() => window.__tactics.reaches.map((r) => r.hex))).find(
      (h) => !sameHex(h, run.view.fight.units.find((u) => u.id === walker).hex)
    );
    await tapHex(step);
    check(
      'desktop: a click on a reachable hex plans the move, with no Move first',
      /^Confirm/.test(await heroMove.textContent()),
      await heroMove.textContent()
    );
    check(
      'desktop: the planned turn’s Confirm shows on the board too',
      /^Confirm \+\d+/.test(await page.getByTestId('board-confirm').textContent())
    );
    check(
      'desktop: the choices show their keys',
      (await heroMove.getAttribute('data-key')) === '1' &&
        (await page.getByTestId('skip-turn').getAttribute('data-key')) === 'S'
    );
    // Pressed, the board's Confirm stays where it is, so a click anywhere on
    // it lands (pressing once dropped its centring, and a press on its left
    // half let go over the board). Let go off it: Enter confirms below.
    const confirmBox = await page.getByTestId('board-confirm').boundingBox();
    const press = {x: confirmBox.x + 8, y: confirmBox.y + confirmBox.height / 2};
    await page.mouse.move(press.x, press.y);
    await page.mouse.down();
    const pressedBox = await page.getByTestId('board-confirm').boundingBox();
    const underPress = await page.evaluate(
      ({x, y}) => document.elementFromPoint(x, y)?.closest('[data-testid]')?.dataset.testid,
      press
    );
    await page.mouse.move(press.x, confirmBox.y + confirmBox.height + 200);
    await page.mouse.up();
    // Pressing focused it; Enter below is the page's, not the button's.
    await page.evaluate(() => document.activeElement?.blur());
    check(
      'desktop: the board’s Confirm stays under the pointer while pressed, at its left edge too',
      underPress === 'board-confirm' &&
        Math.abs(pressedBox.x - confirmBox.x) < 2 &&
        (await state()).view.version === run.view.version,
      {underPress, confirmBox, pressedBox}
    );
    const v = run.view.version;
    await page.keyboard.press('Enter');
    await page.waitForFunction((v) => window.__tactics.run.view.version > v, v, {
      timeout: 15_000,
    });
    await waitIdle();
    run = await state();
    const walked = run.view.fight.units.find((u) => u.id === walker);
    check('the hero walked one hex', !walked.alive || sameHex(walked.hex, step));
  }

  // No top bar: the board gets the whole screen, on desktop too.
  check('no top bar', (await page.locator('header').count()) === 0);

  // One turn with real taps: select Hail, replace it with Move, confirm.
  // Hail is aimed at a space, a unit there or not, so it's the Storm
  // Caller's turn: let the AI play until it comes. It starts somewhere on
  // the left edge, so the hexes come from the page: Hail's farthest target,
  // and a move off its reach if one is.
  for (let i = 0; i < 20 && run.view.fight.awaiting !== stormCaller; i++) {
    await page.evaluate(() => window.__tactics.autoTurn());
    await page.waitForFunction((x) => window.__tactics.run.view.version > x, run.view.version, {
      timeout: 15_000,
    });
    await waitIdle();
    run = await state();
  }
  const before = run.view.version;
  const acting = run.view.fight.units.find((u) => u.id === run.view.fight.awaiting);
  check('the Storm Caller’s turn comes', acting.id === stormCaller, acting.id);
  const hexDistance = (a, b) =>
    (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2;
  await page.getByTestId('turn-controls').getByRole('button', {name: /^Hail/}).click();
  await page.waitForFunction(() => window.__tactics.targets.length > 0);
  const hailTargets = await page.evaluate(() => window.__tactics.targets.map((t) => t.hex));
  await page.getByTestId('turn-controls').getByRole('button', {name: /^Hail/}).click(); // and off again
  const hailTo = hailTargets.sort(
    (a, b) => hexDistance(b, acting.hex) - hexDistance(a, acting.hex)
  )[0];
  // The nearest reachable hex, off Hail's reach if one is.
  const dest = (await page.evaluate(() => window.__tactics.reaches.map((r) => r.hex)))
    .filter((h) => hexDistance(h, acting.hex) > 0 && !sameHex(h, hailTo))
    .sort(
      (a, b) =>
        hailTargets.some((t) => sameHex(t, a)) - hailTargets.some((t) => sameHex(t, b)) ||
        hexDistance(a, acting.hex) - hexDistance(b, acting.hex)
    )[0];
  // On desktop a click plans a move without Move; Esc puts it down.
  await tapHex(dest);
  const moveButton = page.locator('[data-choice="move"]');
  check(
    'desktop: a click on a reachable hex plans a move',
    (await moveButton.getAttribute('aria-pressed')) === 'true' &&
      (await state()).view.version === before
  );
  await page.keyboard.press('Escape');
  check(
    'desktop: Esc puts the move down',
    (await moveButton.getAttribute('aria-pressed')) === 'false' &&
      !(await page.getByTestId('board-confirm').count())
  );
  check('there is no Hold button', !(await page.getByRole('button', {name: /^Hold/}).count()));
  // Select Hail and its target, then replace it with Move and a hex. Picked,
  // Hail is explained under the details; nothing is before.
  const chosen = page.getByTestId('chosen-ability');
  const chosenBefore = await chosen.count();
  await page.getByTestId('turn-controls').getByRole('button', {name: /^Hail/}).click();
  check(
    'picking an ability explains it under the details (and nothing before)',
    chosenBefore === 0 && (await chosen.textContent()).startsWith('Hail'),
    await chosen.textContent().catch(() => null)
  );
  const hailButton = page.locator('[data-choice="hail"]');
  check(
    'a picked ability without a target asks for one',
    /^HailPick a target$/.test(await hailButton.textContent()),
    await hailButton.textContent()
  );
  // Aimed, its button confirms it; a right-click un-picks the target.
  await tapHex(hailTo);
  check(
    'once its target is picked, the ability’s button confirms it',
    /^Confirm\+\d+( → \+\d+)?$/.test(await hailButton.textContent()),
    await hailButton.textContent()
  );
  {
    const {x, y} = await page.evaluate((h) => window.__tactics.hexToCanvas(h), hailTo);
    const box = await page.locator('canvas').boundingBox();
    await page.mouse.click(box.x + (x * box.width) / SCENE_W, box.y + (y * box.height) / SCENE_H, {
      button: 'right',
    });
    await sleep(150);
  }
  check(
    'desktop: a right-click un-picks the target, without committing',
    (await state()).view.version === before &&
      /^HailPick a target$/.test(await hailButton.textContent()) &&
      (await hailButton.getAttribute('aria-pressed')) === 'true',
    await hailButton.textContent()
  );
  // Before a target, tapping the ability again puts it down; so does its key.
  await hailButton.click();
  check(
    'tapping an ability with no target again puts it down',
    (await hailButton.getAttribute('aria-pressed')) === 'false'
  );
  await page.keyboard.press(await hailButton.getAttribute('data-key'));
  check(
    'desktop: an ability’s key picks it',
    (await hailButton.getAttribute('aria-pressed')) === 'true'
  );
  await page.keyboard.press('Escape');
  check(
    'desktop: Esc puts an ability with no target down',
    (await hailButton.getAttribute('aria-pressed')) === 'false'
  );
  await hailButton.click();
  await tapHex(hailTo);
  await moveButton.click();
  await tapHex(dest);
  check(
    'Move replaces the ability selection',
    (await hailButton.getAttribute('aria-pressed')) === 'false'
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
  // Esc un-picks the hex; then tapping Move puts it down.
  await page.keyboard.press('Escape');
  check(
    'desktop: Esc un-picks the destination, without committing',
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
  await hailButton.click();
  await tapHex(hailTo);
  check(
    'an ability replaces a planned move',
    (await hailButton.getAttribute('aria-pressed')) === 'true' &&
      (await moveButton.getAttribute('aria-pressed')) === 'false'
  );
  // Like an ability's target, the destination can be changed by tapping
  // another reachable hex.
  await moveButton.click();
  await tapHex(hailTo);
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
  // With the turn ready to confirm, Skip turn is its Cancel: one tap puts it down.
  const skip = page.getByTestId('skip-turn');
  check(
    'with a turn ready, Skip turn reads Cancel',
    (await skip.textContent()) === 'Cancel',
    await skip.textContent()
  );
  await skip.click();
  check(
    'a tap on Cancel puts the move down, without committing',
    (await state()).view.version === before &&
      (await moveButton.getAttribute('aria-pressed')) === 'false',
    await moveButton.textContent()
  );
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
  // A tap anywhere else disarms it (here, on the board: the unit, or an enemy).
  const enemyHexes = (await state()).view.fight.units
    .filter((u) => u.side === 'enemy' && u.alive)
    .map((u) => u.hex);
  await tapUncovered(acting.hex, ...enemyHexes);
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
    'desktop: S arms Skip turn',
    (await page.keyboard.press('s'), await skip.textContent()) === 'Tap again to skip'
  );
  await tapUncovered(acting.hex, ...enemyHexes); // disarm it again
  await sleep(200);
  // Plan the move again.
  await tapHex(dest);
  check(
    'only the picked button confirms, and the board’s Confirm',
    (await page
      .getByTestId('turn-controls')
      .getByRole('button', {name: /^Confirm/})
      .count()) === 1 && (await page.getByRole('button', {name: /^Confirm/}).count()) === 2
  );
  await shot(page, 'preview');
  // A second click on the destination commits the move.
  await tapHex(dest);
  await page.waitForFunction((v) => window.__tactics.run.view.version > v, before, {
    timeout: 15_000,
  });
  // While the turn plays back (the empty slots and the enemies' turns), the
  // next unit's choices show but can't be picked (the ⋯ menu and the
  // portrait, which only looks at the unit, stay).
  const turnButtonsEnabled = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('[data-testid="turn-controls"] button')]
        .filter(
          (b) => b.getAttribute('aria-label') !== 'Menu' && b.dataset.testid !== 'turn-portrait'
        )
        .map((b) => !b.disabled)
    );
  const playingBack = await page.evaluate(() => window.__tactics.busy);
  const during = await turnButtonsEnabled();
  // The enemy's turns, asked for one request each, playing back.
  await shot(page, 'ai-turns');
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
  // Abilities by name; a click explains one, with its damage (the user's power).
  await sheet.locator('[data-ability]').first().click();
  const about = page.getByTestId('ability-info');
  check(
    'a click on an ability’s name explains it, with its damage and no cost',
    /Damage \d+/.test(await about.textContent()) && !/Cost/.test(await about.textContent()),
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
  {
    // Desktop: explained beside the abilities' names, not under them.
    const list = await sheet.locator('[data-ability]').last().boundingBox();
    const info = await sheet.getByTestId('keyword-info').boundingBox();
    check(
      'desktop: the explanation sits beside the abilities, not under them',
      info.x > list.x + list.width && info.y < list.y + list.height,
      {list, info}
    );
  }
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
  // Each fight pitches its own yurts (two or three near the middle): find one in the view.
  const [yq, yr] = Object.entries((await state()).view.fight.tiles)
    .find(([, t]) => t === 'obstacle')[0]
    .split(',')
    .map(Number);
  const yurt = {q: yq, r: yr};
  const versionBeforeHover = (await state()).view.version;
  {
    const {x, y} = await page.evaluate((h) => window.__tactics.hexToCanvas(h), yurt);
    const box = await page.locator('canvas').boundingBox();
    await page.mouse.move(box.x + (x * box.width) / SCENE_W, box.y + (y * box.height) / SCENE_H);
    await sleep(150);
  }
  const info = page.getByTestId('hex-info');
  check('hovering a yurt shows its rule', (await info.textContent()).includes('Yurt'));
  check('hovering changes nothing', (await state()).view.version === versionBeforeHover);
  await shot(page, 'hover');

  // A reload resumes the run exactly.
  const snapshot = JSON.stringify(run.view);
  await page.reload();
  await page.waitForFunction(() => window.__tactics?.run);
  check('a reload resumes the run exactly', JSON.stringify((await state()).view) === snapshot);

  // Only one tab plays the run (owner, 2026-10-25): a second one says so.
  {
    const second = await desktop.newPage();
    await second.goto(`${WEB_URL}/play/silk-road-run`);
    check(
      'a second tab is refused while the first has the run',
      await second
        .getByTestId('run-elsewhere')
        .waitFor({timeout: 15_000})
        .then(() => true)
        .catch(() => false)
    );
    check(
      'the refused tab offers no turn or start menu',
      !(await second.getByTestId('turn-controls').count()) &&
        !(await second.getByTestId('hero-picks').count())
    );
    await shot(second, 'elsewhere');
    await second.close();
  }

  // Reset run, in the menu: the first tap only arms it; the second opens the
  // start menu, which can't go back to the fight but can go back to the Canvas
  // home page; Start there starts a fresh run.
  const beforeReset = (await state()).runId;
  await page.getByRole('button', {name: 'Menu'}).click();
  await page.getByRole('menuitem', {name: 'Reset run'}).click();
  await sleep(300);
  check('one tap on Reset run changes nothing', (await state()).runId === beforeReset);
  await page.getByRole('menuitem', {name: 'Tap again to reset'}).click();
  await page.getByTestId('hero-picks').waitFor({timeout: 5_000});
  check(
    'a second tap on Reset run opens the start menu, the run untouched',
    (await state()).runId === beforeReset
  );
  await page.reload();
  await page.getByTestId('hero-picks').waitFor({timeout: 5_000});
  check(
    'a reload on the start menu stays on it',
    !(await page.getByTestId('turn-controls').count())
  );
  check(
    'the start menu has no way back to the fight',
    !(await page.getByRole('button', {name: 'Back to the fight'}).count())
  );
  check(
    'the start menu links back to the Canvas home page',
    (await page.getByRole('link', {name: 'Back to Canvas'}).getAttribute('href')) === '/'
  );
  await page.getByRole('button', {name: 'Start', exact: true}).click();
  await page.waitForFunction((id) => window.__tactics.run?.runId !== id, beforeReset, {
    timeout: 15_000,
  });
  await waitIdle();
  check(
    'Start, after Reset run, starts a fresh fight',
    (await state()).view.fight.phase === 'fight'
  );
  check(
    'the fresh run is the one saved',
    (await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).runId, RUN_STORAGE)) ===
      (await state()).runId
  );

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

  // Play the rest with the AI choosing for you. With placeholder numbers a
  // fight can stall, so after 150 turns
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
    await page.getByRole('button', {name: 'Start', exact: true}).click();
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
  // A won stage before the run's last offers the next; anything else, a new run.
  const nextAhead = run.view.fight.phase === 'won' && run.view.stage < run.view.stages - 1;
  check(
    `${nextAhead ? 'Next stage' : 'New run'} takes the turn’s buttons’ place`,
    await page.getByRole('button', {name: nextAhead ? 'Next stage' : 'New run'}).isVisible()
  );
  // Only the run's last stage won says there's more to come.
  const runWon = run.view.fight.phase === 'won' && !nextAhead;
  check(
    `the more-to-come message ${runWon ? 'shown' : 'not shown'}`,
    (await page.getByTestId('more-to-come').isVisible()) === runWon
  );
  // On a phone the finished fight keeps the action section's height, so the board stays put.
  await page.setViewportSize({width: 390, height: 664});
  await sleep(300);
  const endButton = nextAhead ? 'Next stage' : 'New run';
  {
    const box = await page.locator('canvas').boundingBox();
    const bar = await page
      .getByRole('button', {name: endButton})
      .evaluate((el) => el.closest('section').getBoundingClientRect());
    check(
      `phone, fight over: ${endButton} in the action section, the board against it`,
      // A row of choices and the turn's buttons, at least: every starting kit
      // fits one row (the Champion's since Throw is part of Grapple).
      Math.abs(bar.top - (box.y + box.height)) <= 12 && bar.height >= 100,
      [box, bar]
    );
    await shot(page, 'end-phone');
  }
  // Next stage opens the caravanserai, where one survivor takes a provision
  // (1 more of a stat); Set out there starts the run's next stage, against a
  // bigger band, with the survivors.
  if (nextAhead) {
    const before = (await state()).view;
    const survivors = before.fight.units
      .filter((u) => u.side === 'player' && u.alive)
      .map((u) => u.hero);
    const raised = before.fight.units.find(
      (u) => u.side === 'player' && u.alive && u.hero !== 'camel'
    );
    await page.getByRole('button', {name: 'Next stage'}).click();
    await page.getByTestId('caravanserai').waitFor({timeout: 15_000});
    const setOut = page.getByRole('button', {name: 'Set out'});
    check(
      'the caravanserai: a choice for each stat of each hero standing, Set out waiting on one',
      (await page.locator('[data-testid^="provision-"][aria-pressed]').count()) ===
        3 * survivors.filter((h) => h !== 'camel').length &&
        (await page.getByTestId('provision-camel-power').count()) === 0 &&
        (await setOut.isDisabled()),
      survivors
    );
    await page.getByTestId(`provision-${raised.hero}-power`).click();
    check('a stat picked, Set out is ready', await setOut.isEnabled());
    await shot(page, 'caravanserai-phone');
    await setOut.click();
    await page.waitForFunction((x) => window.__tactics.run.view.stage > x, before.stage, {
      timeout: 15_000,
    });
    await waitIdle();
    const after = (await state()).view;
    const enemies = after.fight.units.filter((u) => u.side === 'enemy');
    check(
      'Next stage: the next stage, under way, with the survivors against more heroes',
      after.fight.phase === 'fight' &&
        after.stage === before.stage + 1 &&
        JSON.stringify(after.fight.units.filter((u) => u.side === 'player').map((u) => u.hero)) ===
          JSON.stringify(survivors) &&
        enemies.filter((u) => u.hero !== 'wolf').length === after.stage + 1,
      after.fight.units.map((u) => u.id)
    );
    check(
      'Set out: the hero picked at the caravanserai has 1 more power',
      after.fight.units.find((u) => u.id === raised.id)?.power === raised.power + 1,
      after.fight.units.find((u) => u.id === raised.id)
    );
  }
  // New run opens the start menu; Start there starts a fresh fight, ready for a turn.
  if (!nextAhead) {
    const ended = (await state()).runId;
    await page.getByRole('button', {name: 'New run'}).click();
    await page.getByRole('button', {name: 'Start', exact: true}).click();
    await page.waitForFunction((id) => window.__tactics.run?.runId !== id, ended, {
      timeout: 15_000,
    });
    await waitIdle();
    check(
      'New run, then Start, starts a fresh fight',
      (await state()).view.fight.phase === 'fight'
    );
  }

  // A tab refused for another takes the run over once that one closes.
  {
    const runId = (await state()).runId;
    const second = await desktop.newPage();
    second.on('pageerror', (e) => pageErrors.push(e.message));
    await second.goto(`${WEB_URL}/play/silk-road-run`);
    await second.getByTestId('run-elsewhere').waitFor({timeout: 15_000});
    await page.close();
    check(
      'once the first tab closes, the second takes the run over',
      await second
        .waitForFunction((id) => window.__tactics?.run?.runId === id, runId, {timeout: 15_000})
        .then(() => true)
        .catch(() => false)
    );
    await second.close();
  }

  // Without Web Workers the AI plays its turns on the page, with its quick fixed search.
  {
    const noWorkers = await browser.newContext({viewport: {width: 1300, height: 900}});
    await noWorkers.addInitScript(() => delete window.Worker);
    const p = await noWorkers.newPage();
    p.on('pageerror', (e) => pageErrors.push(e.message));
    await p.goto(`${WEB_URL}/play/silk-road-run`);
    await p.getByRole('button', {name: 'Start', exact: true}).click();
    await p.getByTestId('turn-controls').waitFor({timeout: 15_000});
    const settled = (v) =>
      p.waitForFunction(
        (x) =>
          window.__tactics.run.view.version > x &&
          !window.__tactics.busy &&
          !window.__tactics.run.view.aiDue,
        v,
        {timeout: 15_000}
      );
    await settled(-1);
    let aiPlayed = false;
    for (let i = 0; i < 20 && !aiPlayed; i++) {
      const {view} = await p.evaluate(() => window.__tactics.run);
      if (view.fight.phase !== 'fight') break;
      await p.evaluate(() => window.__tactics.autoTurn());
      await settled(view.version);
      // One version for the turn played, one more for each AI turn after it.
      aiPlayed = (await p.evaluate(() => window.__tactics.run.view.version)) > view.version + 1;
    }
    check('without Web Workers, the AI still plays its turns', aiPlayed);
    await noWorkers.close();
  }
  check('no page errors', pageErrors.length === 0, pageErrors);
  check('the page sends no request to /runs', runRequests.length === 0, runRequests);

  // A phone: board on top, details in a tooltip over it, the action section
  // pinned to the bottom of the screen; no heading or hints; no scrolling.
  const phone = await browser.newPage({...devices['iPhone 13']});
  await phone.goto(`${WEB_URL}/play/silk-road-run`);
  await phone.getByRole('button', {name: 'Start', exact: true}).click();
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
  // No double-tap zoom, and the board left pinchable, so a zoomed-in page can be pinched back out.
  check(
    'phone: double-tap zoom off, pinch zoom kept on the board',
    await phone.evaluate(
      () =>
        getComputedStyle(document.querySelector('canvas')).touchAction === 'manipulation' &&
        getComputedStyle(document.querySelector('[data-choice="move"]')).touchAction ===
          'manipulation'
    )
  );
  // Whose turn it is: the unit's portrait before Skip turn (no arrow on the board).
  {
    const portrait = phone.getByTestId('turn-portrait');
    const name = await phone.evaluate(() => {
      const f = window.__tactics.run.view.fight;
      return f.units.find((u) => u.id === f.awaiting)?.name ?? null;
    });
    check(
      'phone: the action bar shows whose turn it is',
      (await portrait.count()) === 1 && (await portrait.getAttribute('title')) !== null,
      [await portrait.getAttribute('title').catch(() => null), name]
    );
    await shot(phone, 'phone-turn');
    // A tap on it looks at the unit, as its track card does; another closes it.
    await portrait.tap();
    await sleep(300);
    const own = phone.getByTestId('hex-tooltip').getByTestId('stat-sheet');
    check(
      'phone: tapping the portrait shows the acting unit’s details',
      (await own.locator('[data-side="player"]').count()) === 1 &&
        (await portrait.getAttribute('aria-pressed')) === 'true'
    );
    await shot(phone, 'phone-portrait');
    await portrait.tap();
    await sleep(300);
    check(
      'phone: tapping it again closes them',
      !(await phone.getByTestId('hex-tooltip').count()) &&
        (await portrait.getAttribute('aria-pressed')) === 'false'
    );
  }
  const canvasBox = await phone.locator('canvas').boundingBox();
  const viewportWidth = phone.viewportSize().width;
  // Edge to edge, or, where the screen is too short for that (an iPhone 13
  // since the 64-hex board of 2026-10-24), as tall as it fits, centred.
  check(
    'phone: the board runs edge to edge, or fills the height centred',
    (Math.abs(canvasBox.x) <= 1 && Math.abs(canvasBox.width - viewportWidth) <= 1) ||
      (canvasBox.y <= 1 &&
        Math.abs(canvasBox.x - (viewportWidth - canvasBox.x - canvasBox.width)) <= 1),
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
    return {x: box.x + (x * box.width) / SCENE_W, y: box.y + (y * box.height) / SCENE_H};
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
  // Always complete: every ability, nothing to expand.
  // At least 1: the unit shown may be a wolf, which has only Bite.
  check(
    'phone: the tooltip lists the abilities by name, nothing to expand',
    (await tooltip.locator('[data-ability]').count()) >= 1 &&
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
    /**
     * Where on the screen a hex of plain sand shows with nothing over it.
     * The whole board's sand, as the page sees it now: a tap on sand under
     * the tooltip would land on the tooltip, and one there on an ability's
     * name or a keyword keeps it open (a big tooltip can cover most of a
     * phone's board, so there's no falling back to a covered hex).
     */
    const bareSand = async () => {
      for (const h of await phone.evaluate(() => window.__tactics.sandHexes())) {
        const p = await onPhone(h);
        const bare = await phone.evaluate(
          ({x, y}) => document.elementFromPoint(x, y)?.tagName === 'CANVAS',
          p
        );
        if (bare) return p;
      }
      throw new Error('no plain sand left uncovered to tap');
    };
    const at = await bareSand();
    await phone.touchscreen.tap(at.x, at.y);
    await sleep(200);
    check('phone: tapping plain sand shows no tooltip', !(await tooltip.count()));
    // And with a tooltip open, tapping plain sand closes it.
    await phone.touchscreen.tap(foeAt.x, foeAt.y);
    await sleep(200);
    check('phone: the tooltip is open again to close', (await tooltip.count()) === 1);
    const open = await bareSand();
    await phone.touchscreen.tap(open.x, open.y);
    await sleep(200);
    check('phone: tapping plain sand closes the tooltip', !(await tooltip.count()));
    await phone.touchscreen.tap(foeAt.x, foeAt.y);
    await sleep(200);
    // Tapping away from the board (here, the space above it, or beside it
    // when it fills the height: the board sits down against the action bar)
    // closes it too.
    const box = await phone.locator('canvas').boundingBox();
    check(
      'phone: the board sits against the action section',
      (box.y > 2 || box.x > 2) && actionBarTop - (box.y + box.height) <= 12,
      [box, actionBarTop]
    );
    await phone.touchscreen.tap(box.x / 2, box.y > 8 ? box.y / 2 : box.y + box.height / 2);
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
      // Put the move down again: Skip turn is its Cancel now.
      await phone.getByTestId('skip-turn').tap();
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
        x: canvasBox.x + (c.x * canvasBox.width) / SCENE_W,
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
    const at = {x: (x * box.width) / SCENE_W, y: (y * box.height) / SCENE_H};
    await phone.tap('canvas', {position: at});
    await sleep(250);
    check(
      'phone: a planned move turns the Move button into its Confirm, with its slots',
      /^Confirm\+\d+( → \+\d+)?$/.test(await phoneMove.textContent()),
      await phoneMove.textContent()
    );
    await phone.getByTestId('skip-turn').tap(); // Cancel puts Move down
    await sleep(250);
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
  // Tapping a target twice commits it, as a second click does on desktop.
  const tapOn = async (hex) => {
    const {x, y} = await phone.evaluate((h) => window.__tactics.hexToCanvas(h), hex);
    const box = await phone.locator('canvas').boundingBox();
    await phone.tap('canvas', {
      position: {x: (x * box.width) / SCENE_W, y: (y * box.height) / SCENE_H},
    });
    await sleep(250);
  };
  // The camel walks itself; the AI plays on until the Storm Caller, with
  // Hail (aimed at a space), is up.
  for (
    let i = 0;
    i < 20 && (await phone.evaluate(() => window.__tactics.run.view.fight.awaiting)) !== 'p-storm';
    i++
  ) {
    const v = await phone.evaluate(() => window.__tactics.run.view.version);
    await phone.evaluate(() => window.__tactics.autoTurn());
    await phone.waitForFunction(
      (v) => window.__tactics.run.view.version > v && !window.__tactics.busy,
      v,
      {timeout: 15_000}
    );
  }
  await phone.locator('[data-choice="hail"]').waitFor({timeout: 15_000});
  const phoneVersion = await phone.evaluate(() => window.__tactics.run.view.version);
  const moveBoxBefore = await phoneMove.boundingBox();
  const phoneHail = phone.locator('[data-choice="hail"]');
  const hailCost = await phoneHail.textContent();
  await phoneHail.click();
  await phone.waitForFunction(() => window.__tactics.targets.length > 0);
  check(
    'phone: with no target yet, the ability’s button asks for one',
    /^HailPick a target$/.test(await phoneHail.textContent()),
    await phoneHail.textContent()
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
  const phoneConfirm = await phoneHail.textContent();
  check(
    'phone: aimed, the ability’s button confirms it, saying when the next turn comes',
    /^Confirm\+\d+( → \+\d+)?$/.test(phoneConfirm),
    phoneConfirm
  );
  check(
    'phone: the ability button showed the same slots as its Confirm',
    hailCost.endsWith(phoneConfirm.match(/^Confirm(\+\d+)/)[1]),
    [hailCost, phoneConfirm]
  );
  // Aimed, Skip turn is its Cancel: one tap puts Hail down.
  const phoneSkip = phone.getByTestId('skip-turn');
  check(
    'phone: aimed, Skip turn reads Cancel',
    (await phoneSkip.textContent()) === 'Cancel',
    await phoneSkip.textContent()
  );
  await phoneSkip.tap();
  await sleep(250);
  check(
    'phone: a tap on Cancel puts the ability down, without committing',
    (await phone.evaluate(() => window.__tactics.run.view.version)) === phoneVersion &&
      (await phoneHail.getAttribute('aria-pressed')) === 'false' &&
      /^Skip turn/.test(await phoneSkip.textContent()),
    await phoneSkip.textContent()
  );
  await phoneHail.click();
  await phone.waitForFunction(() => window.__tactics.targets.length > 0);
  await tapOn(aim);
  await tapOn(aim);
  await phone.waitForFunction((v) => window.__tactics.run.view.version > v, phoneVersion, {
    timeout: 15_000,
  });
  check(
    'phone: a second tap on the target commits the turn',
    (await phone.evaluate(() => window.__tactics.run.view.version)) > phoneVersion
  );
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
  // Reset run, then a new fight: the board, mounted afresh, still fits the screen.
  {
    const resetId = await phone.evaluate(() => window.__tactics.run.runId);
    await phone.getByRole('button', {name: 'Menu'}).tap();
    await phone.getByRole('menuitem', {name: 'Reset run'}).tap();
    await phone.getByRole('menuitem', {name: 'Tap again to reset'}).tap();
    await phone.getByRole('button', {name: 'Start', exact: true}).tap();
    await phone.waitForFunction((id) => window.__tactics?.run?.runId !== id, resetId, {
      timeout: 15_000,
    });
    await phoneMove.waitFor({timeout: 15_000});
    await sleep(300);
    const box = await phone.locator('canvas').boundingBox();
    check(
      'phone: after Reset run, the new fight’s board still fits the screen',
      box.x >= -1 && box.width <= 376 && box.y >= -1,
      box
    );
  }
} finally {
  await browser.close();
}
finish();
