/**
 * Poker in two real browsers: lobby host/guest views, a full hand played by
 * clicking the canvas buttons, next hand, a refresh mid-hand, and the 30s
 * turn timeout. Screenshots go to e2e-results/poker-*.png.
 */
import {chromium} from 'playwright';
import {join} from 'node:path';
import {OUT_DIR, WEB_URL, check, createPokerRoom, finish, sleep} from './lib.mjs';

// Canvas-space centers of the action buttons (packages/games/poker/game.json).
const CANVAS = {width: 1120, height: 620};
const BTN = {fold: [910, 414], check: [1030, 414], call: [910, 476], raise: [1030, 476]};

const shot = (page, name) => page.screenshot({path: join(OUT_DIR, `poker-${name}.png`)});
const myTurn = (page) => page.getByText('Your turn').isVisible();
const nextHandButton = (page) => page.getByRole('button', {name: 'Next Hand'});

async function clickButton(page, [x, y]) {
  const box = await page.locator('canvas').boundingBox();
  await page.mouse.click(
    box.x + (x * box.width) / CANVAS.width,
    box.y + (y * box.height) / CANVAS.height
  );
}

const roomId = await createPokerRoom('Alice');
const browser = await chromium.launch();

async function openAs(name) {
  const ctx = await browser.newContext({viewport: {width: 1400, height: 950}});
  await ctx.addInitScript(([k, v]) => localStorage.setItem(k, v), [`poker_name_${roomId}`, name]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(`  [${name} page error]`, e.message));
  await page.goto(`${WEB_URL}/play/poker/${roomId}`);
  return page;
}

try {
  const alice = await openAs('Alice');
  await sleep(500);
  const bob = await openAs('Bob');
  await alice.getByText('Players (2)').waitFor({timeout: 15_000});

  check('host sees Start Game', await alice.getByRole('button', {name: 'Start Game'}).isVisible());
  check(
    'guest sees a waiting message instead',
    (await bob.getByText('Waiting for Alice to start').isVisible()) &&
      !(await bob.getByRole('button', {name: 'Start Game'}).isVisible())
  );
  await shot(bob, '1-guest-lobby');

  await alice.getByRole('button', {name: 'Start Game'}).click();
  await alice.locator('canvas').waitFor();
  await bob.locator('canvas').waitFor();
  await sleep(1000);
  check('exactly one player has the turn', (await myTurn(alice)) !== (await myTurn(bob)));
  await shot(alice, '2-start');

  // Play the hand through the canvas: check when free, otherwise call.
  for (let i = 0; i < 20 && !(await nextHandButton(alice).isVisible()); i++) {
    const page = (await myTurn(alice)) ? alice : (await myTurn(bob)) ? bob : null;
    if (!page) {
      await sleep(300);
      continue;
    }
    await clickButton(page, BTN.check);
    await sleep(600);
    if (await myTurn(page)) {
      await clickButton(page, BTN.call);
      await sleep(600);
    }
  }
  check(
    'canvas clicks reach the server and the hand finishes',
    (await nextHandButton(alice).isVisible()) && (await nextHandButton(bob).isVisible())
  );
  await shot(alice, '3-showdown-alice');
  await shot(bob, '3-showdown-bob');

  await nextHandButton(bob).click();
  await sleep(1000);
  check(
    'next hand dealt to both',
    !(await nextHandButton(alice).isVisible()) && (await myTurn(alice)) !== (await myTurn(bob))
  );

  const waiting = (await myTurn(alice)) ? bob : alice;
  const acting = waiting === bob ? alice : bob;
  await waiting.reload();
  await waiting.locator('canvas').waitFor({timeout: 15_000});
  await sleep(1000);
  check('refreshed player is back in the hand', await waiting.getByText(/to act/).isVisible());
  await shot(waiting, '4-after-refresh');

  const t0 = Date.now();
  while (Date.now() - t0 < 40_000 && (await myTurn(acting))) await sleep(1000);
  const secs = Math.round((Date.now() - t0) / 1000);
  check(
    `idle player's turn times out (~30s, took ${secs}s)`,
    !(await myTurn(acting)) && secs >= 20
  );
  await shot(acting, '5-after-timeout');
} finally {
  await browser.close();
}
finish();
