/**
 * Single-player games in a real browser: the game list; Snake (score, speed-up,
 * best score, food never on the snake); Sudoku (number pad, solved with real
 * key presses, "You win!"); Solitaire (draw 1/3, undo, double-click to
 * foundation, auto-finish, no-moves message); Blackjack (dealer peek, 3:2
 * naturals, reshuffle between hands, split, insurance, surrender, cards drawn
 * after Play Again); and touch play on an emulated phone.
 *
 * The deep checks read game state through `window.__canvasWorld`, which
 * GameCanvas only sets on the Vite dev server. Against production the suite
 * still checks the game list and that every game renders without errors,
 * then skips the rest.
 */
import {chromium} from 'playwright';
import {join} from 'node:path';
import {OUT_DIR, WEB_URL, check, finish, sleep} from './lib.mjs';

const shot = (page, name) => page.screenshot({path: join(OUT_DIR, `games-${name}.png`)});

const browser = await chromium.launch();
const page = await browser.newPage({viewport: {width: 1300, height: 900}});
const pageErrors = [];
page.on('pageerror', (e) => {
  pageErrors.push(e.message);
  console.log('  [page error]', e.message);
});

async function openGame(id) {
  await page.goto(`${WEB_URL}/play/${id}`);
  await page.locator('canvas').waitFor({timeout: 15_000});
  // Only the dev server exposes the world; don't wait long for it elsewhere.
  await page
    .waitForFunction(() => window.__canvasWorld?.getScene(), null, {timeout: 3_000})
    .catch(() => {});
}

try {
  await page.goto(WEB_URL);
  await page.getByRole('heading', {name: 'Games'}).waitFor();
  await page.getByRole('link', {name: /play/i}).first().waitFor({timeout: 15_000});
  const cards = await page.getByRole('link', {name: /play/i}).count();
  check('game list shows all 5 games', cards === 5, cards);

  // Every game opens to a canvas without throwing (works against production).
  for (const id of ['snake', 'solitaire', 'sudoku', 'blackjack']) {
    const errorsBefore = pageErrors.length;
    await openGame(id);
    await sleep(500);
    check(
      `${id} renders without errors`,
      pageErrors.length === errorsBefore,
      pageErrors.slice(errorsBefore)
    );
  }

  await openGame('snake');
  if (!(await page.evaluate(() => Boolean(window.__canvasWorld)))) {
    console.log('  (deep checks skipped: no __canvasWorld — not a dev-server build)');
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
    // Pick the safe direction (no wall, no body, no reversing) that gets
    // closest to the food.
    const STEP = {up: [0, -20], down: [0, 20], left: [-20, 0], right: [20, 0]};
    const blocked = new Set(s.segs.map((p) => `${p.x},${p.y}`));
    const options = Object.entries(STEP)
      .filter(([d]) => d !== OPP[s.dir])
      .map(([d, [mx, my]]) => ({d, x: s.head.x + mx, y: s.head.y + my}))
      .filter((o) => o.x > 0 && o.x < 600 && o.y > 0 && o.y < 400 && !blocked.has(`${o.x},${o.y}`))
      .sort(
        (a, b) =>
          Math.abs(a.x - s.food.x) +
          Math.abs(a.y - s.food.y) -
          (Math.abs(b.x - s.food.x) + Math.abs(b.y - s.food.y))
      );
    const want = options[0]?.d ?? s.dir;
    if (want !== s.dir) await page.keyboard.press(KEY[want]);
    await sleep(15);
  }
  check('Snake ate 3 food', eaten === 3, eaten);
  check('score counts each food', await page.getByText('Score: 3').isVisible());
  check('food never respawned on the snake', !foodOnSnake);
  const speedAfter3 = await page.evaluate(
    () =>
      window.__canvasWorld.getScene().getEntity('snake-head').getComponent('GridMovement').data
        .speed
  );
  check('Snake speeds up as it eats (8 → 9.5)', speedAfter3 === 9.5, speedAfter3);

  // Steer into the top wall.
  const s = await snakeState();
  if (s.dir === 'down') (await page.keyboard.press('ArrowLeft'), await sleep(200));
  await page.keyboard.press('ArrowUp');
  await page.getByText('Game Over').waitFor({timeout: 10_000});
  check('death shows Game Over with the final score', await page.getByText('Score: 3').isVisible());
  check('a first scored game is a new best', await page.getByText('New best!').isVisible());
  await shot(page, 'snake-game-over');
  await page.getByRole('button', {name: 'Play Again'}).click();
  await sleep(300);
  const speedReset = await page.evaluate(
    () =>
      window.__canvasWorld.getScene().getEntity('snake-head').getComponent('GridMovement').data
        .speed
  );
  check('Play Again resets the speed', speedReset === 8, speedReset);
  check('best score is shown during the next game', await page.getByText('Best: 3').isVisible());
  await page.reload();
  await page.locator('canvas').waitFor();
  check('best score survives a reload', await page.getByText('Best: 3').isVisible());

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

  // Number pad: real clicks on the canvas buttons fill and clear a cell.
  const clickEntity = async (id, canvasW, canvasH) => {
    const pos = await page.evaluate(
      (id) => window.__canvasWorld.getScene().getEntity(id).getComponent('Transform').position,
      id
    );
    const box = await page.locator('canvas').boundingBox();
    await page.mouse.click(
      box.x + (pos.x * box.width) / canvasW,
      box.y + (pos.y * box.height) / canvasH
    );
    await sleep(80);
  };
  const cellValue = (r, c) =>
    page.evaluate(
      ([r, c]) =>
        window.__canvasWorld
          .getScene()
          .query({all: ['GridPuzzle']})[0]
          .getComponent('GridPuzzle').data.board[r][c],
      [r, c]
    );
  let er = -1,
    ec = -1;
  outer: for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (given[r][c] === 0) {
        er = r;
        ec = c;
        break outer;
      }
  await clickEntity(`cell-${er}-${ec}`, 500, 600);
  await clickEntity(`numpad-${grid[er][ec]}`, 500, 600);
  check('number pad fills the selected cell', (await cellValue(er, ec)) === grid[er][ec]);
  await clickEntity('numpad-clear', 500, 600);
  check('number pad ✕ clears the cell', (await cellValue(er, ec)) === 0);
  await shot(page, 'sudoku-numpad');
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

  // ── Solitaire ────────────────────────────────────────────────────────────
  await openGame('solitaire');
  const solSys = `window.__canvasWorld.systems.find((x) => x.constructor.name === 'CardPileSystem')`;
  const solState = () =>
    page.evaluate(`(() => {
      const sys = ${solSys};
      const scene = window.__canvasWorld.getScene();
      return {
        piles: Object.fromEntries([...sys.piles].map(([k, v]) => [k, v.length])),
        drawLabel: scene.getEntity('draw-btn-label').getComponent('Renderable').text,
        status: scene.getEntity('status-text').getComponent('Renderable').text,
      };
    })()`);
  const solClick = (id) =>
    page.evaluate((id) => window.__canvasWorld.events.emit('click', {entityId: id}), id);

  await solClick('stock');
  let sol = await solState();
  check('Solitaire draws 1 by default', sol.piles.waste === 1 && sol.piles.stock === 23, sol.piles);
  await solClick('draw-btn');
  await solClick('stock');
  sol = await solState();
  check(
    'Draw 3 toggle deals three cards',
    sol.drawLabel === 'Draw 3' && sol.piles.waste === 4,
    sol
  );
  await solClick('undo-btn');
  sol = await solState();
  check(
    'Undo restores the previous position',
    sol.piles.waste === 1 && sol.piles.stock === 23,
    sol.piles
  );

  // Double-click a tableau Ace with real mouse clicks; redeal until one is on top.
  let aceMoved = null;
  for (let attempt = 0; attempt < 25 && aceMoved === null; attempt++) {
    if (attempt > 0) await openGame('solitaire');
    const ace = await page.evaluate(`(() => {
      const sys = ${solSys};
      const scene = window.__canvasWorld.getScene();
      for (const [pid, ids] of sys.piles) {
        if (!pid.startsWith('t')) continue;
        const top = ids[ids.length - 1];
        if (scene.getEntity(top).getComponent('Card').data.rank === 1)
          return {id: top, ...scene.getEntity(top).getComponent('Transform').position};
      }
      return null;
    })()`);
    if (!ace) continue;
    const box = await page.locator('canvas').boundingBox();
    await page.mouse.dblclick(
      box.x + (ace.x * box.width) / 700,
      box.y + (ace.y * box.height) / 580
    );
    await sleep(200);
    aceMoved = await page.evaluate(
      (id) => window.__canvasWorld.getScene().getEntity(id).getComponent('Card').data.pileId,
      ace.id
    );
  }
  check('double-clicking an Ace sends it to a foundation', /^f\d$/.test(aceMoved ?? ''), aceMoved);

  // Rig positions: put every card where the layout says (bottom → top).
  const rigSolitaire = (layout) =>
    page.evaluate((layout) => {
      const sys = window.__canvasWorld.systems.find((x) => x.constructor.name === 'CardPileSystem');
      const scene = window.__canvasWorld.getScene();
      for (const pid of sys.piles.keys()) sys.piles.set(pid, []);
      for (const [pid, cards] of Object.entries(layout)) {
        cards.forEach(([cardId, faceUp], i) => {
          sys.piles.get(pid).push(cardId);
          const cd = scene.getEntity(cardId).getComponent('Card').data;
          cd.pileId = pid;
          cd.posInPile = i;
          cd.faceUp = faceUp;
          sys.updateCardVisuals(cardId);
          sys.setDragGroup(cardId, sys.isGroupPile(pid) ? pid : '', i);
        });
      }
      sys.history = [];
      sys.refreshDraggable();
      sys.syncPileMembers();
      sys.updateStatus();
    }, layout);
  const SUITS = ['♠', '♥', '♦', '♣'];
  const id = (suit, rank) => `card-${suit}-${rank}`;

  // Endgame: foundations hold A–Q, the four Kings sit face up in the tableau.
  await openGame('solitaire');
  const endgame = {};
  SUITS.forEach((suit, i) => {
    endgame[`f${i}`] = Array.from({length: 12}, (_, r) => [id(suit, r + 1), true]);
    endgame[`t${i}`] = [[id(suit, 13), true]];
  });
  await rigSolitaire(endgame);
  await page
    .getByText('You win!')
    .waitFor({timeout: 5000})
    .catch(() => {});
  check(
    'auto-finish plays out a solved board to "You win!"',
    await page.getByText('You win!').isVisible()
  );
  await shot(page, 'solitaire-auto-finish');

  // Stuck: A♠ face down under 2♠, every other card buried in a foundation.
  await openGame('solitaire');
  const rest = [];
  for (const suit of SUITS)
    for (let r = 1; r <= 13; r++) {
      if (suit === '♠' && r <= 2) continue;
      rest.push([id(suit, r), true]);
    }
  await rigSolitaire({
    f0: rest,
    t0: [
      [id('♠', 1), false],
      [id('♠', 2), true],
    ],
  });
  sol = await solState();
  check('a dead position says "No moves left"', /No moves left/.test(sol.status), sol.status);
  await shot(page, 'solitaire-stuck');

  // ── Blackjack ────────────────────────────────────────────────────────────
  await openGame('blackjack');
  const bjSys = `window.__canvasWorld.systems.find((x) => x.constructor.name === 'BlackjackSystem')`;
  // `draws` are in deal order: player, dealer up, player, dealer hole, then
  // any later cards. The shoe deals from its end.
  const rigShoe = (draws) =>
    page.evaluate((draws) => {
      const sys = window.__canvasWorld.systems.find(
        (x) => x.constructor.name === 'BlackjackSystem'
      );
      const filler = Array.from({length: 30}, (_, i) => ({rank: (i % 13) + 1, suit: '♣'}));
      sys.shoe.cards = [...filler, ...draws.map(([rank, suit]) => ({rank, suit})).reverse()];
    }, draws);
  const bjClick = (id) =>
    page.evaluate((id) => window.__canvasWorld.events.emit('click', {entityId: id}), id);
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
        hands: sys.hands.length,
        cards: sys.hands.reduce((a, h) => a + h.cards.length, 0),
        visible: scene
          .query({all: ['Renderable']})
          .filter((e) => /^p-card-\d+$/.test(e.id) && e.getComponent('Renderable').visible).length,
        slots: sys.playerSlots.length,
      };
    });
  const newRound = async () => {
    const st = await bjState();
    if (st.phase === 'result') await bjClick('deal-btn'); // back to betting
  };
  const deal = async (draws) => {
    await newRound();
    if (draws) await rigShoe(draws);
    await bjClick('deal-btn');
    await sleep(150);
    return bjState();
  };

  // Dealer Ace + King: insurance is offered first; declining reveals the blackjack.
  let bj = await deal([
    [10, '♠'],
    [1, '♥'],
    [7, '♦'],
    [13, '♣'],
  ]);
  check('dealer Ace offers insurance before anything else', bj.phase === 'insurance', bj);
  await bjClick('no-insurance-btn');
  await sleep(100);
  bj = await bjState();
  check(
    'dealer blackjack ends the hand before the player acts',
    bj.phase === 'result' && bj.status === 'Dealer has Blackjack.',
    bj
  );
  check('player loses the $10 bet', bj.balance === 'Balance: $990', bj.balance);
  await shot(page, 'blackjack-dealer-natural');

  bj = await deal([
    [1, '♠'],
    [9, '♥'],
    [13, '♦'],
    [7, '♣'],
  ]);
  check(
    'player blackjack pays 3:2',
    /Blackjack!/.test(bj.status) && bj.balance === 'Balance: $1005',
    bj
  );

  // Insurance taken against a dealer blackjack pays 2:1 (net: break even).
  bj = await deal([
    [10, '♠'],
    [1, '♥'],
    [7, '♦'],
    [12, '♣'],
  ]);
  await bjClick('insurance-btn');
  await sleep(100);
  bj = await bjState();
  check(
    'insurance pays 2:1 when the dealer has blackjack',
    /Insurance pays 2:1/.test(bj.status) && bj.balance === 'Balance: $1005',
    bj
  );

  // Surrender on a hard 16 returns half the bet.
  bj = await deal([
    [10, '♠'],
    [10, '♥'],
    [6, '♦'],
    [7, '♣'],
  ]);
  await bjClick('surrender-btn');
  await sleep(100);
  bj = await bjState();
  check(
    'surrender returns half the bet',
    /surrender/.test(bj.status) && bj.balance === 'Balance: $1000',
    bj
  );

  // Split 8s: each hand gets a card, dealer 16 draws a 10 and busts → both win.
  bj = await deal([
    [8, '♠'],
    [6, '♥'],
    [8, '♦'],
    [10, '♣'],
    [3, '♥'],
    [2, '♠'],
    [10, '♦'],
  ]);
  await bjClick('split-btn');
  await sleep(100);
  bj = await bjState();
  check(
    'split makes two hands, both drawn on screen',
    bj.hands === 2 && bj.visible === bj.cards && bj.cards === 4,
    bj
  );
  await shot(page, 'blackjack-split');
  await bjClick('stand-btn');
  await bjClick('stand-btn');
  await sleep(150);
  bj = await bjState();
  check(
    'both split hands are settled',
    bj.status === 'Hand 1: win · Hand 2: win' && bj.balance === 'Balance: $1020',
    bj
  );

  // Reshuffle between hands when the shoe runs low.
  await newRound();
  await page.evaluate(
    `(() => { const sys = ${bjSys}; sys.shoe.cards = sys.shoe.cards.slice(0, 10); })()`
  );
  bj = await deal(null);
  check('a low shoe is reshuffled before the deal, not mid-hand', bj.shoe === 48, bj.shoe);
  check('player cards are drawn on screen', bj.visible === bj.cards && bj.cards >= 2, bj);
  check('card slots are cached once (24, not doubled)', bj.slots === 24, bj.slots);
  await shot(page, 'blackjack-cards');

  // Go broke to reach Game Over, then Play Again.
  await page.evaluate(
    `(() => { const sys = ${bjSys}; sys.phase = 'result'; sys.balance = 0; sys.render(); })()`
  );
  await bjClick('deal-btn');
  await page.getByText('Game Over').waitFor({timeout: 5000});
  await page.getByRole('button', {name: 'Play Again'}).click();
  await page.waitForFunction(`(${bjSys})?.balance === 1000`);
  bj = await deal(null);
  check('cards still drawn after Play Again', bj.visible === bj.cards && bj.cards >= 2, bj);
  await shot(page, 'blackjack-after-play-again');

  // ── Touch (emulated phone) ───────────────────────────────────────────────
  const phone = await browser.newContext({
    viewport: {width: 390, height: 844},
    hasTouch: true,
    isMobile: true,
  });
  const tp = await phone.newPage();
  tp.on('pageerror', (e) => console.log('  [touch page error]', e.message));
  const openTouch = async (gameId) => {
    await tp.goto(`${WEB_URL}/play/${gameId}`);
    await tp.waitForFunction(() => window.__canvasWorld?.getScene(), null, {timeout: 15_000});
    await sleep(300);
  };
  const tapEntity = async (entityId, canvasW, canvasH) => {
    const pos = await tp.evaluate(
      (id) => window.__canvasWorld.getScene().getEntity(id).getComponent('Transform').position,
      entityId
    );
    const box = await tp.locator('canvas').boundingBox();
    await tp.touchscreen.tap(
      box.x + (pos.x * box.width) / canvasW,
      box.y + (pos.y * box.height) / canvasH
    );
    await sleep(120);
  };

  await openTouch('sudoku');
  const tGiven = await tp.evaluate(
    () =>
      window.__canvasWorld
        .getScene()
        .query({all: ['GridPuzzle']})[0]
        .getComponent('GridPuzzle').data.given
  );
  let tr = -1,
    tc = -1;
  outer2: for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (tGiven[r][c] === 0) {
        tr = r;
        tc = c;
        break outer2;
      }
  await tapEntity(`cell-${tr}-${tc}`, 500, 600);
  await tapEntity('numpad-5', 500, 600);
  const tapped = await tp.evaluate(
    ([r, c]) =>
      window.__canvasWorld
        .getScene()
        .query({all: ['GridPuzzle']})[0]
        .getComponent('GridPuzzle').data.board[r][c],
    [tr, tc]
  );
  check('touch: tapping a cell then a number fills it', tapped === 5, tapped);
  await tp.screenshot({path: join(OUT_DIR, 'games-touch-sudoku.png')});

  await openTouch('solitaire');
  await tapEntity('stock', 700, 580);
  const tWaste = await tp.evaluate(`(${solSys}).piles.get('waste').length`);
  check('touch: tapping the stock draws a card', tWaste === 1, tWaste);

  await openTouch('snake');
  const dirBefore = await tp.evaluate(
    () =>
      window.__canvasWorld.getScene().getEntity('snake-head').getComponent('GridMovement').data
        .direction
  );
  // A real touch swipe down via CDP, so the browser produces pointer events itself.
  const cdp = await phone.newCDPSession(tp);
  const box = await tp.locator('canvas').boundingBox();
  const sx = box.x + box.width / 2,
    sy = box.y + box.height / 3;
  await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: sx, y: sy}]});
  for (let i = 1; i <= 5; i++)
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{x: sx, y: sy + i * 15}],
    });
  await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
  await sleep(250);
  const dirAfter = await tp.evaluate(
    () =>
      window.__canvasWorld.getScene().getEntity('snake-head').getComponent('GridMovement').data
        .direction
  );
  check('touch: swiping down turns the snake', dirBefore === 'right' && dirAfter === 'down', {
    dirBefore,
    dirAfter,
  });
  const scrolled = await tp.evaluate(() => window.scrollY);
  check('touch: swiping on the canvas does not scroll the page', scrolled === 0, scrolled);
  await phone.close();
} finally {
  await browser.close();
}
finish();
