// What each ability and stat is worth: production rules, AI against AI.
// An experiment may patch the config for both sides (`patch`), and may
// modify one side only (`mod`: abilities removed, stats added). With `mod`,
// every seed is played twice, once with each side modified, and the modified
// side's win rate is the measure: 50% means the modification changes nothing.
import {createFight, advance, applyTurn, actingUnit} from '@balance-rules/fight';
import {placeStartingCards} from '@balance-rules/track';
import {chooseAiTurn} from '@balance-rules/ai';
import {ABILITY, AI, CAMEL, HEROES, RULES} from '@balance-rules/config';
import {ABILITIES} from '@balance-rules/abilities';
import type {AbilityId, FightState, HeroId, Side} from '@balance-rules/types';

/** Mutable views of the config, for experiments to patch. */
export type Config = {
  ABILITY: any;
  AI: any;
  HEROES: any;
  RULES: any;
  ABILITIES: any;
};
export type Mod = {
  /** Abilities the modified side can't use. */
  ban?: AbilityId[];
  /** Added to the modified side's units, by hero: speed, defence, power, hp (hp also raises max). */
  stats?: Partial<Record<HeroId, Partial<Record<'speed' | 'defence' | 'power' | 'hp', number>>>>;
  /** The modified side's party, in place of the experiment's. */
  party?: HeroId[];
};
export type Experiment = {
  patch?: (config: Config) => void;
  mod?: Mod;
  /**
   * The player's heroes (the camel is added) and the enemy's units: PARTY
   * by default, the enemy's `party` when only that is given.
   */
  party?: HeroId[];
  enemies?: HeroId[];
};
type Options = Experiment & {fights: number; seed: number; maxTurns: number};

/** Damage sources, recognised by the fight log's wording. */
const SOURCES: [RegExp, string][] = [
  [/'s arrow hits/, 'bow'],
  [/'s overwatch shot hits/, 'overwatch'],
  [/'s volley hits/, 'volley'],
  [/^The throw hits/, 'throw'],
  [/^The grapple hits/, 'grapple'],
  [/^The hail hits/, 'hail'],
  [/^The bite hits/, 'bite'],
];
const ACTOR =
  /^(Your|Enemy) .+?(?:'s arrow hits| calls down hail| looses a volley| calls down sunlight| calls down fog| throws| swaps places| grapples| bites)/;
/** Healing, by the fight log's wording: amount healed per fight. */
const HEAL = /^The sunlight heals .+ for (\d+)\.$/;

function snapshot(config: Config) {
  const copy = (x: unknown) =>
    JSON.parse(
      JSON.stringify(x, (_k, v) => (v === Infinity ? 'Infinity' : v)),
      (_k, v) => (v === 'Infinity' ? Infinity : v)
    );
  const saved = copy({
    ABILITY: config.ABILITY,
    AI: config.AI,
    HEROES: config.HEROES,
    RULES: config.RULES,
  });
  return () => {
    const restore = (target: any, from: any) => {
      for (const [k, v] of Object.entries(from)) {
        if (v && typeof v === 'object' && !Array.isArray(v)) restore(target[k], v);
        else target[k] = v;
      }
    };
    for (const key of ['ABILITY', 'AI', 'HEROES', 'RULES'] as const)
      restore(config[key], saved[key]);
  };
}

export function ablate(options: Options) {
  const config: Config = {ABILITY, AI, HEROES, RULES, ABILITIES};
  const restore = snapshot(config);
  try {
    options.patch?.(config);
    return run(options);
  } finally {
    restore();
  }
}

function run({fights, seed, maxTurns, mod, party, enemies}: Options) {
  const kits = Object.fromEntries(Object.entries(HEROES).map(([h, s]) => [h, [...s.abilities]]));
  // Abilities are listed per hero, not per unit, so the modified side's kit is
  // swapped in for its own decisions only. Its search then also assumes the
  // other side lacks the banned abilities; the other side's search doesn't.
  const useKits = (side: Side | null, modSide: Side | null) => {
    for (const [h, s] of Object.entries(HEROES) as [HeroId, {abilities: AbilityId[]}][]) {
      const banned = side === modSide && mod?.ban ? mod.ban : [];
      s.abilities = kits[h]!.filter((a) => !banned.includes(a));
    }
  };
  const add = (o: Record<string, number>, k: string, n = 1) => (o[k] = (o[k] ?? 0) + n);
  const uses: Record<string, Record<string, number>> = {};
  const damage: Record<string, {enemy: number; ally: number}> = {};
  const kills: Record<string, number> = {};
  /** Health restored to the healer's own side, and to the other side. */
  const healed = {ally: 0, enemy: 0};
  /** Overwatch: lanes set, and shots they fired. */
  let overwatchShots = 0;
  /** Damage fog took off hits, by whose hit it was. */
  const fogged = {ally: 0, enemy: 0};
  const units: Record<string, number> = {};
  const survivors: Record<string, number> = {};
  const lengths: number[] = [];
  const slots: number[] = [];
  let stalls = 0;
  /** How finished fights ended, from the player's side. */
  const outcomes = {enemiesBeaten: 0, camelOut: 0, camelKilled: 0, partyKilled: 0};
  /** Player heroes standing at the end of the fights the player won. */
  let heroesLeftAfterWins = 0;
  const playerUnits: Record<string, number> = {};
  const playerSurvivors: Record<string, number> = {};
  let modWins = 0;
  let modLosses = 0;
  let moveTurns = 0;
  let movedHexes = 0;

  for (let f = 0; f < fights; f++) {
    const modSide: Side | null = mod ? (f & 1 ? 'enemy' : 'player') : null;
    const sideParty = (side: Side) =>
      side === modSide && mod?.party ? mod.party : side === 'player' ? party : (enemies ?? party);
    const state = createFight(seed + (mod ? f >> 1 : f), sideParty('player'), sideParty('enemy'));
    for (const u of state.units) u.controller = 'human';
    if (mod?.stats) {
      for (const u of state.units.filter((u) => u.side === modSide)) {
        const extra = mod.stats[u.hero] ?? {};
        // Defence sets health ((1 + defence) × 2), so adding it adds health too.
        for (const [stat, n] of Object.entries(extra)) {
          u[stat as 'hp'] += n!;
          if (stat === 'defence') u.hp += 2 * n!;
        }
        u.maxHp = u.hp;
      }
      placeStartingCards(state);
    }
    let actor: Side | null = null;
    let lastSource: string | null = null;
    const readLog = (s: FightState) => {
      for (const {text} of s.log) {
        const who = ACTOR.exec(text);
        if (who) actor = who[1] === 'Your' ? 'player' : 'enemy';
        for (const [pattern, source] of SOURCES) {
          if (!pattern.test(text)) continue;
          const n = Number((/for (\d+)\.?$/.exec(text) ?? /takes (\d+) from/.exec(text))?.[1] ?? 0);
          const named = [...text.matchAll(/(Your|Enemy) [^']+?(?= for| takes|$|\.)/g)];
          // Temee, the player's camel, is named without "Your" (unitName).
          const target: Side =
            named.length === 0 && text.includes(HEROES.camel.name)
              ? 'player'
              : named.at(-1)?.[1] === 'Your'
                ? 'player'
                : 'enemy';
          const friendly = actor === target;
          (damage[source] ??= {enemy: 0, ally: 0})[friendly ? 'ally' : 'enemy'] += n;
          lastSource = source;
        }
        if (/ falls\.$/.test(text) && lastSource) add(kills, lastSource);
        const heal = HEAL.exec(text);
        if (heal) {
          const target: Side = /heals (Your|Temee)/.test(text) ? 'player' : 'enemy';
          healed[actor === target ? 'ally' : 'enemy'] += Number(heal[1]);
        }
        if (/'s overwatch shot hits/.test(text)) overwatchShots++;
        const dulled = /^The fog dulls (.+) by (\d+)\.$/.exec(text);
        if (dulled) {
          // A hit named for its user ("Your X's arrow"), else the acting side's.
          const by = /^(Your|Enemy) /.exec(dulled[1]!);
          const side: Side = by ? (by[1] === 'Your' ? 'player' : 'enemy') : actor!;
          fogged[side === 'player' ? 'ally' : 'enemy'] += Number(dulled[2]);
        }
      }
      s.log = [];
    };

    advance(state, chooseAiTurn);
    readLog(state);
    let turns = 0;
    while (state.phase === 'fight' && turns < maxTurns) {
      const u = actingUnit(state)!;
      useKits(u.side, modSide);
      const input = chooseAiTurn(state, u);
      const moving = (input.move?.length ?? 0) > 0;
      const swap =
        input.action.ability === 'throw' &&
        input.action.target?.to?.q === u.hex?.q &&
        input.action.target?.to?.r === u.hex?.r;
      add((uses[u.hero] ??= {}), moving ? 'move' : swap ? 'swap' : input.action.ability);
      add(uses[u.hero]!, 'turns');
      if (moving) {
        moveTurns++;
        movedHexes += input.move!.length;
      }
      actor = u.side;
      applyTurn(state, u, input);
      useKits(null, modSide);
      readLog(state);
      turns++;
      advance(state, chooseAiTurn);
      readLog(state);
    }
    useKits(null, modSide);
    for (const u of state.units) {
      add(units, u.hero);
      if (u.alive) add(survivors, u.hero);
      if (u.side !== 'player') continue;
      add(playerUnits, u.hero);
      if (u.alive) add(playerSurvivors, u.hero);
    }
    if (state.phase === 'fight') {
      stalls++;
      continue;
    }
    const camel = state.units.find((u) => u.hero === CAMEL);
    const heroesLeft = state.units.filter(
      (u) => u.side === 'player' && u !== camel && u.alive
    ).length;
    if (state.phase === 'won') {
      heroesLeftAfterWins += heroesLeft;
      if (state.units.some((u) => u.side === 'enemy' && u.alive)) outcomes.camelOut++;
      else outcomes.enemiesBeaten++;
    } else if (camel && !camel.alive) outcomes.camelKilled++;
    else outcomes.partyKilled++;
    lengths.push(turns);
    slots.push(state.currentSlot);
    if (modSide) (state.phase === 'won') === (modSide === 'player') ? modWins++ : modLosses++;
  }

  const median = (a: number[]) => (a.length ? [...a].sort((x, y) => x - y)[a.length >> 1] : null);
  const round = (n: number, places = 1) => +n.toFixed(places);
  const perFight = (n: number) => round(n / fights);
  const perUnit = (n: number) => round(n / (2 * fights), 2);
  return {
    fights,
    modWinPct: mod ? round((100 * modWins) / (modWins + modLosses || 1)) : undefined,
    stallPct: round((100 * stalls) / fights),
    /** The player side's share of finished fights. */
    playerWinPct: round(
      (100 * (outcomes.enemiesBeaten + outcomes.camelOut)) / (lengths.length || 1)
    ),
    outcomes,
    heroesLeftPerWin: round(
      heroesLeftAfterWins / (outcomes.enemiesBeaten + outcomes.camelOut || 1),
      2
    ),
    /** Survival of the player side's units, by hero. */
    playerSurvivalPct: Object.fromEntries(
      Object.entries(playerUnits).map(([h, n]) => [h, round((100 * (playerSurvivors[h] ?? 0)) / n)])
    ),
    medianTurns: median(lengths),
    medianSlots: median(slots),
    hexesPerMove: round(movedHexes / (moveTurns || 1), 2),
    turnsPerUnit: Object.fromEntries(Object.entries(uses).map(([h, m]) => [h, perUnit(m.turns!)])),
    /** Share of each hero's turns spent on each ability, a move, or Hold. */
    usePct: Object.fromEntries(
      Object.entries(uses).map(([h, m]) => [
        h,
        Object.fromEntries(
          Object.entries(m)
            .filter(([k]) => k !== 'turns')
            .sort(([, a], [, b]) => b - a)
            .map(([k, n]) => [k, round((100 * n) / m.turns!)])
        ),
      ])
    ),
    damagePerFight: Object.fromEntries(
      Object.entries(damage).map(([k, v]) => [
        k,
        {enemy: perFight(v.enemy), ally: perFight(v.ally)},
      ])
    ),
    healedPerFight: {ally: perFight(healed.ally), enemy: perFight(healed.enemy)},
    overwatchShotsPerFight: perFight(overwatchShots),
    /** Damage fog took off the player side's hits (ally) and the enemy's. */
    foggedPerFight: {player: perFight(fogged.ally), enemy: perFight(fogged.enemy)},
    killsPerFight: Object.fromEntries(
      Object.entries(kills).map(([k, n]) => [k, round(n / fights, 2)])
    ),
    survivalPct: Object.fromEntries(
      Object.entries(units).map(([h, n]) => [h, round((100 * (survivors[h] ?? 0)) / n)])
    ),
  };
}
