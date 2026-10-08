/**
 * Single-player games in a real browser: the game list, Snake (score counts,
 * food never spawns on the snake, game over shows the score), Sudoku (solved
 * with real key presses, ends on a "You win!" screen), and Blackjack (dealer
 * blackjack ends the hand before the player acts, naturals pay 3:2, the shoe
 * reshuffles between hands).
 *
 * Reads game state through `window.__canvasWorld`, which GameCanvas only sets
 * on the Vite dev server — so this suite skips itself against production.
 */
import {chromium} from 'playwright';
import {join} from 'node:path';
import {OUT_DIR, WEB_URL, check, finish, sleep} from './lib.mjs';

const shot = (page, name) => page.screenshot({path: join(OUT_DIR, `games-${name}.png`)});

const browser = await chromium.launch();
const page = await browser.newPage({viewport: {width: 1300, height: 900}});
page.on('pageerror', (e) => console.log('  [page error]', e.message));

async function openGame(id) {
  await page.goto(`${WEB_URL}/play/${id}`);
  await page.locator('canvas').waitFor({timeout: 15_000});
  await page.waitForFunction(() => window.__canvasWorld?.getScene(), null, {timeout: 10_000});
}

try {
  await page.goto(WEB_URL);
  await page.getByRole('heading', {name: 'Games'}).waitFor();
  await page.getByRole('link', {name: /play/i}).first().waitFor({timeout: 15_000});
  const cards = await page.getByRole('link', {name: /play/i}).count();
  check('game list shows all 5 games', cards === 5, cards);

  await openGame('snake');
  if (!(await page.evaluate(() => Boolean(window.__canvasWorld)))) {
    console.log('  (skipped: no __canvasWorld — not a dev-server build)');
    await browser.close();
    finish();
  }

  // ── Snake ────────────────────────────────────────────────────────────────
  check('Snake shows a live score', await page.getByText('Score: 0').isVisible());
  const snakeState = () =>
    page.evaluate(() => {
      const scene = window.__canvasWorld.getScene();
      const pos = (id) => {
        const p = scene.getEntity(id)?.getComponent('Transform')?.position;
        return p ? {x: p.x, y: p.y} : null;
      };
      const head = scene.getEntity('snake-head');
      return {
        head: pos('snake-head'),
        food: pos('food'),
        dir: head.getComponent('GridMovement').data.direction,
        segs: head.getComponent('Trail').data.segments.map(pos).filter(Boolean),
      };
    });
  const KEY = {up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight'};
  const OPP = {up: 'down', down: 'up', left: 'right', right: 'left'};

  let eaten = 0;
  let foodOnSnake = false;
  let lastFood = null;
  const start = Date.now();
  while (eaten < 3 && Date.now() - start < 30_000) {
    const s = await snakeState();
    if (lastFood && (s.food.x !== lastFood.x || s.food.y !== lastFood.y)) {
      eaten++;
      if (
        s.segs.some((p) => p.x === s.food.x && p.y === s.food.y) ||
        (s.head.x === s.food.x && s.head.y === s.food.y)
      )
        foodOnSnake = true;
    }
    lastFood = s.food;
    const dx = s.food.x - s.head.x;
    const dy = s.food.y - s.head.y;
    let want = dx > 0 ? 'right' : dx < 0 ? 'left' : dy > 0 ? 'down' : dy < 0 ? 'up' : s.dir;
    if (want === OPP[s.dir]) want = dy >= 0 ? 'down' : 'up';
    if (want === OPP[s.dir] || want === s.dir) want = s.dir;
    if (want !== s.dir) await page.keyboard.press(KEY[want]);
    await sleep(30);
  }
  check('Snake ate 3 food', eaten === 3, eaten);
  check('score counts each food', await page.getByText('Score: 3').isVisible());
  check('food never respawned on the snake', !foodOnSnake);

  // Steer into the top wall.
  const s = await snakeState();
  if (s.dir === 'down') (await page.keyboard.press('ArrowLeft'), await sleep(200));
  await page.keyboard.press('ArrowUp');
  await page.getByText('Game Over').waitFor({timeout: 10_000});
  check('death shows Game Over with the final score', await page.getByText('Score: 3').isVisible());
  await shot(page, 'snake-game-over');

  // ── Sudoku ───────────────────────────────────────────────────────────────
  await openGame('sudoku');
  const given = await page.evaluate(() => {
    const scene = window.__canvasWorld.getScene();
    return scene.query({all: ['GridPuzzle']})[0].getComponent('GridPuzzle').data.given;
  });
  const grid = given.map((r) => [...r]);
  const ok = (r, c, v) => {
    for (let i = 0; i < 9; i++) if (grid[r][i] === v || grid[i][c] === v) return false;
    const br = r - (r % 3),
      bc = c - (c % 3);
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++) if (grid[br + i][bc + j] === v) return false;
    return true;
  };
  const solve = () => {
    for (let r = 0; r < 9; r++)
      for (let c = 0; c < 9; c++)
        if (grid[r][c] === 0) {
          for (let v = 1; v <= 9; v++)
            if (ok(r, c, v)) {
              grid[r][c] = v;
              if (solve()) return true;
              grid[r][c] = 0;
            }
          return false;
        }
    return true;
  };
  check('Sudoku puzzle is solvable', solve());
  let typed = 0;
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (given[r][c] === 0) {
        await page.evaluate(
          ([row, col]) => window.__canvasWorld.events.emit('cursor:moved', {row, col}),
          [r, c]
        );
        await page.keyboard.down(`Digit${grid[r][c]}`);
        await sleep(40);
        await page.keyboard.up(`Digit${grid[r][c]}`);
        await sleep(20);
        typed++;
      }
  await page
    .getByText('You win!')
    .waitFor({timeout: 10_000})
    .catch(() => {});
  check(
    `solving Sudoku (${typed} digits typed) shows "You win!"`,
    await page.getByText('You win!').isVisible()
  );
  check('Sudoku win does not say Game Over', !(await page.getByText('Game Over').isVisible()));
  await shot(page, 'sudoku-win');

  // ── Blackjack ────────────────────────────────────────────────────────────
  await openGame('blackjack');
  // Cards are dealt from the end: player, dealer up, player, dealer hole.
  const rigAndDeal = (hand) =>
    page.evaluate(
      ([cards]) => {
        const world = window.__canvasWorld;
        const sys = world.systems.find((x) => x.constructor.name === 'BlackjackSystem');
        if (cards) {
          const filler = Array.from({length: 30}, (_, i) => ({rank: (i % 13) + 1, suit: '♣'}));
          const [p1, up, p2, hole] = cards.map(([rank, suit]) => ({rank, suit}));
          sys.shoe.cards = [...filler, hole, p2, up, p1];
        }
        world.events.emit('click', {entityId: 'deal-btn'});
      },
      [hand]
    );
  const bjState = () =>
    page.evaluate(() => {
      const world = window.__canvasWorld;
      const scene = world.getScene();
      const text = (id) => scene.getEntity(id)?.getComponent('Renderable')?.text;
      const sys = world.systems.find((x) => x.constructor.name === 'BlackjackSystem');
      return {
        status: text('status-text'),
        balance: text('balance-text'),
        phase: sys.phase,
        shoe: sys.shoe.cards.length,
      };
    });
  const nextRound = () =>
    page.evaluate(() => window.__canvasWorld.events.emit('click', {entityId: 'deal-btn'}));

  await rigAndDeal([
    [10, '♠'],
    [1, '♥'],
    [7, '♦'],
    [13, '♣'],
  ]);
  await sleep(200);
  let bj = await bjState();
  check(
    'dealer blackjack ends the hand before the player acts',
    bj.phase === 'result' && bj.status === 'Dealer has Blackjack.',
    bj
  );
  check('player loses the $10 bet', bj.balance === 'Balance: $990', bj.balance);
  await shot(page, 'blackjack-dealer-natural');

  await nextRound();
  await sleep(100);
  await rigAndDeal([
    [1, '♠'],
    [9, '♥'],
    [13, '♦'],
    [7, '♣'],
  ]);
  await sleep(200);
  bj = await bjState();
  check(
    'player blackjack pays 3:2',
    /Blackjack!/.test(bj.status) && bj.balance === 'Balance: $1005',
    bj
  );

  await nextRound();
  await sleep(100);
  await page.evaluate(() => {
    const sys = window.__canvasWorld.systems.find((x) => x.constructor.name === 'BlackjackSystem');
    sys.shoe.cards = sys.shoe.cards.slice(0, 10); // shoe nearly empty
  });
  await rigAndDeal(null);
  await sleep(200);
  bj = await bjState();
  check('a low shoe is reshuffled before the deal, not mid-hand', bj.shoe === 48, bj.shoe);

  // Cards must be drawn on the scene that's on screen — once per World, even
  // after Play Again (systems used to be reused across Worlds and drew into a
  // stale scene).
  const cardsShown = () =>
    page.evaluate(() => {
      const world = window.__canvasWorld;
      const sys = world.systems.find((x) => x.constructor.name === 'BlackjackSystem');
      const visible = world
        .getScene()
        .query({all: ['Renderable']})
        .filter((e) => /^p-card-\d+$/.test(e.id) && e.getComponent('Renderable').visible).length;
      return {visible, hand: sys.playerHand.length, slots: sys.playerSlots.length};
    });
  let shown = await cardsShown();
  check('player cards are drawn on screen', shown.visible === shown.hand && shown.hand >= 2, shown);
  check('card slots are cached once (10, not doubled)', shown.slots === 10, shown.slots);
  await shot(page, 'blackjack-cards');

  // Go broke to reach Game Over, then Play Again.
  await page.evaluate(() => {
    const sys = window.__canvasWorld.systems.find((x) => x.constructor.name === 'BlackjackSystem');
    sys.phase = 'result';
    sys.balance = 0;
    window.__canvasWorld.events.emit('click', {entityId: 'deal-btn'});
  });
  await page.getByText('Game Over').waitFor({timeout: 5000});
  await page.getByRole('button', {name: 'Play Again'}).click();
  await page.waitForFunction(
    () =>
      window.__canvasWorld.systems.find((x) => x.constructor.name === 'BlackjackSystem')
        ?.balance === 1000
  );
  await nextRound();
  await sleep(300);
  shown = await cardsShown();
  check(
    'cards still drawn after Play Again',
    shown.visible === shown.hand && shown.hand >= 2,
    shown
  );
  await shot(page, 'blackjack-after-play-again');
} finally {
  await browser.close();
}
finish();
