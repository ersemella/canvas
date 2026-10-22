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
};
export type Experiment = {
  patch?: (config: Config) => void;
  mod?: Mod;
  /** The player's heroes (the camel is added) and the enemy's units; both default to PARTY. */
  party?: HeroId[];
  enemies?: HeroId[];
};
type Options = Experiment & {fights: number; seed: number; maxTurns: number};

/** Damage sources, recognised by the fight log's wording. */
const SOURCES: [RegExp, string][] = [
  [/'s arrow hits/, 'bow'],
  [/^The Volley hits/, 'volley'],
  [/^The Freeze hits/, 'freeze'],
  [/^The throw hits/, 'throw'],
  [/^The Lunge hits/, 'lunge'],
  [/^Hail strikes/, 'hail'],
  [/^Quicksand drags/, 'quicksand'],
  [/^The grapple crushes/, 'grapple'],
  [/slams into|from the collision|is slammed into/, 'collision'],
];
/** Sources whose caster the log doesn't name: counted as damage to the enemy. */
const UNOWNED = new Set(['quicksand', 'hail', 'grapple']);
const ACTOR =
  /^(Your|Enemy) .+?(?:'s (?:Volley lands|Freeze takes hold|arrow hits)| lunges at| calls down (?:hail|sunlight)| throws| grapples)/;

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
  const defs = Object.entries(config.ABILITIES).map(([id, d]: [string, any]) => [
    id,
    d.cost,
    d.recoveryCost,
  ]);
  return () => {
    const restore = (target: any, from: any) => {
      for (const [k, v] of Object.entries(from)) {
        if (v && typeof v === 'object' && !Array.isArray(v)) restore(target[k], v);
        else target[k] = v;
      }
    };
    for (const key of ['ABILITY', 'AI', 'HEROES', 'RULES'] as const)
      restore(config[key], saved[key]);
    for (const [id, cost, recovery] of defs) {
      config.ABILITIES[id].cost = cost;
      config.ABILITIES[id].recoveryCost = recovery;
    }
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
  const healing = {ally: 0, enemy: 0};
  const ultimateSlots: Record<string, number[]> = {};
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
    const state = createFight(seed + (mod ? f >> 1 : f), party, enemies);
    const modSide: Side | null = mod ? (f & 1 ? 'enemy' : 'player') : null;
    for (const u of state.units) u.controller = 'human';
    if (mod?.stats) {
      for (const u of state.units.filter((u) => u.side === modSide)) {
        const extra = mod.stats[u.hero] ?? {};
        for (const [stat, n] of Object.entries(extra)) u[stat as 'hp'] += n!;
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
          const target: Side = named.at(-1)?.[1] === 'Your' ? 'player' : 'enemy';
          const friendly = !UNOWNED.has(source) && actor === target;
          (damage[source] ??= {enemy: 0, ally: 0})[friendly ? 'ally' : 'enemy'] += n;
          lastSource = source;
        }
        const healed = /^(Your|Enemy) .* heals (\d+)\.$/.exec(text);
        if (healed) {
          const side: Side = healed[1] === 'Your' ? 'player' : 'enemy';
          healing[side === actor ? 'ally' : 'enemy'] += Number(healed[2]);
        }
        if (/ falls\.$/.test(text) && lastSource) add(kills, lastSource);
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
      add((uses[u.hero] ??= {}), moving ? 'move' : input.action.ability);
      add(uses[u.hero]!, 'turns');
      if (moving) {
        moveTurns++;
        movedHexes += input.move!.length;
      }
      if (ABILITIES[input.action.ability].ultimate)
        (ultimateSlots[u.hero] ??= []).push(state.currentSlot);
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
    healingPerFight: {ally: perFight(healing.ally), enemy: perFight(healing.enemy)},
    killsPerFight: Object.fromEntries(
      Object.entries(kills).map(([k, n]) => [k, round(n / fights, 2)])
    ),
    ultimatesPerUnit: Object.fromEntries(
      Object.entries(ultimateSlots).map(([h, a]) => [h, perUnit(a.length)])
    ),
    medianUltimateSlot: Object.fromEntries(
      Object.entries(ultimateSlots).map(([h, a]) => [h, median(a)])
    ),
    survivalPct: Object.fromEntries(
      Object.entries(units).map(([h, n]) => [h, round((100 * (survivors[h] ?? 0)) / n)])
    ),
  };
}
