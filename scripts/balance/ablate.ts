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
import {unitName} from '@balance-rules/resolve';
import {MAPS} from '@balance-rules/map';
import type {AbilityId, FightState, HeroId, PassiveId, Side} from '@balance-rules/types';
import {snapshot, type Config} from './snapshot';

export type {Config};

export type Mod = {
  /** Abilities the modified side can't use. */
  ban?: AbilityId[];
  /** Added to the modified side's units, by hero: speed, defence, power, hp (hp also raises max). */
  stats?: Partial<Record<HeroId, Partial<Record<'speed' | 'defence' | 'power' | 'hp', number>>>>;
  /** The modified side's party, in place of the experiment's. */
  party?: HeroId[];
  /**
   * The modified side's kits, by hero, in place of the config's: an
   * ability changed (Hold Loose for Grapple) against the original.
   */
  kits?: Partial<Record<HeroId, AbilityId[]>>;
  /**
   * The modified side's search in place of production's: a horizon in
   * decisions and a work cap a turn (mirror.ts's `deep` is 4 and 4 × the cap).
   */
  search?: {depth: number; work: number};
  /** Only these heroes of the modified side use `search`; the rest, production's. */
  searchHeroes?: HeroId[];
  /** Passives added to the modified side's units, by hero. */
  passives?: Partial<Record<HeroId, PassiveId[]>>;
  /** AI settings (config.ts's `AI`) in place of production's while the modified side chooses. */
  ai?: Record<string, unknown>;
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
  /** The map (`MAPS` in map.ts): `steppe` by default; `gobi` never has mountains. */
  map?: string;
};
type Options = Experiment & {fights: number; seed: number; maxTurns: number};

/** Damage sources, recognised by the fight log's wording. */
const SOURCES: [RegExp, string][] = [
  [/'s arrow hits/, 'snapShot'],
  [/'s volley hits/, 'volley'],
  [/'s skirmish arrow hits/, 'skirmish'],
  [/^The throw hits/, 'throw'],
  [/^The grapple hits/, 'grapple'],
  [/^The hail hits/, 'hail'],
  [/'s parting arrow hits/, 'feignedRetreat'],
  [/^The gale hits/, 'gale'],
  [/^The bite hits/, 'bite'],
  [/^The cleave hits/, 'cleave'],
  [/^The jian hits/, 'swiftStrike'],
];
const ACTOR =
  /^(Your|Enemy) .+?(?:'s arrow hits| calls down hail| calls down sunlight| looses a volley|'s volley lands|'s skirmish arrow hits| draws on| throws| swaps places| grapples| bites|'s parting arrow hits| calls up a gale| shoves| hauls| cleaves| strikes .+ with the jian| gives .+ an elixir)/;

/** Runs `choose` with `settings` in place of production's AI settings (`Mod.ai`). */
function withAi<T>(settings: Record<string, unknown> | undefined, choose: () => T): T {
  if (!settings) return choose();
  const ai = AI as Record<string, unknown>;
  const saved = Object.fromEntries(Object.keys(settings).map((k) => [k, ai[k]]));
  Object.assign(ai, settings);
  try {
    return choose();
  } finally {
    Object.assign(ai, saved);
  }
}

/** chooseAiTurn with its own horizon and work cap (as mirror.ts's `chooser`). */
function searchWith({depth, work}: {depth: number; work: number}) {
  const ai = AI as {maxSimulations: number};
  return (state: FightState, unit: Parameters<typeof chooseAiTurn>[1]) => {
    const saved = ai.maxSimulations;
    ai.maxSimulations = work;
    try {
      return chooseAiTurn(state, unit, {left: work}, undefined, {depth, work});
    } finally {
      ai.maxSimulations = saved;
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

function run({fights, seed, maxTurns, mod, party, enemies, map}: Options) {
  const kits = Object.fromEntries(Object.entries(HEROES).map(([h, s]) => [h, [...s.abilities]]));
  // Abilities are listed per hero, not per unit, so the modified side's kit is
  // swapped in for its own decisions only. Its search then also assumes the
  // other side lacks the banned abilities; the other side's search doesn't.
  const useKits = (side: Side | null, modSide: Side | null) => {
    for (const [h, s] of Object.entries(HEROES) as [HeroId, {abilities: AbilityId[]}][]) {
      const mine = side === modSide;
      const banned = mine && mod?.ban ? mod.ban : [];
      s.abilities = ((mine && mod?.kits?.[h]) || kits[h]!).filter((a) => !banned.includes(a));
    }
  };
  const add = (o: Record<string, number>, k: string, n = 1) => (o[k] = (o[k] ?? 0) + n);
  const uses: Record<string, Record<string, number>> = {};
  const damage: Record<string, {enemy: number; ally: number}> = {};
  const kills: Record<string, number> = {};
  /** Units hit, by source and side, for an area's catch per use. */
  const hits: Record<string, {enemy: number; ally: number}> = {};
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
  /** Sunlight's targets (self, ally hero, camel, enemy, or hail alone) and what it added. */
  const sunlight: Record<string, number> = {};
  let empowerDamage = 0;
  let melts = 0;
  /** Turns begun Immobilized by hail, by whose hail: the unit's side's, or the other's. */
  const held = {ally: 0, enemy: 0};
  /**
   * Track effects, by the ability that gave them: Delays, the slots they
   * moved, and those on a unit already Delayed since its last turn (the
   * lockout the delay limit, 3.6, would stop); Hastes, those its user
   * gave itself, and how many each unit took, by name without its side.
   */
  const delays: Record<string, {count: number; slots: number; again: number}> = {};
  const hastes: Record<
    string,
    {count: number; slots: number; self: number; to: Record<string, number>}
  > = {};
  const swaps = {count: 0, fellBack: 0, to: {} as Record<string, number>};
  const immortals = {given: 0, blocked: 0};

  for (let f = 0; f < fights; f++) {
    const modSide: Side | null = mod ? (f & 1 ? 'enemy' : 'player') : null;
    const sideParty = (side: Side) =>
      side === modSide && mod?.party ? mod.party : side === 'player' ? party : (enemies ?? party);
    const state = createFight(
      seed + (mod ? f >> 1 : f),
      sideParty('player'),
      sideParty('enemy'),
      false,
      [],
      MAPS[map ?? 'steppe']
    );
    for (const u of state.units) u.controller = 'human';
    if (mod?.passives)
      for (const u of state.units.filter((u) => u.side === modSide))
        u.passives = [...(u.passives ?? []), ...(mod.passives[u.hero] ?? [])];
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
    let swappingBack = false;
    let actor: Side | null = null;
    let lastSource: string | null = null;
    /** The acting unit and its ability, for the track effects it gives. */
    let acting: {name: string; ability: string} | null = null;
    /** Units Delayed since their last turn, by name (unique in the experiments that count it). */
    const delayedSince = new Set<string>();
    // Turns and skipped turns, read from the fight's events to clear `delayedSince`.
    state.events = [];
    const readLog = (s: FightState) => {
      // A turn is recorded as it starts, before the acting unit's own Delays and Hastes.
      for (const e of s.events ?? [])
        if (e.kind === 'turn' || e.kind === 'skip')
          delayedSince.delete(unitName(s.units.find((u) => u.id === e.unitId)!));
      s.events = [];
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
          (hits[source] ??= {enemy: 0, ally: 0})[friendly ? 'ally' : 'enemy']++;
          lastSource = source;
        }
        if (/ falls\.$/.test(text) && lastSource) add(kills, lastSource);
        const added = /^Empower adds (\d+)\.$/.exec(text);
        if (added) empowerDamage += Number(added[1]);
        if (text === 'The sunlight melts the hail.') melts++;
        // An Elixir's swap (`ABILITY.elixir.swap`): on whom, and units falling as it ends.
        const swapped = /^(.+) swaps its speed and health/.exec(text);
        if (swapped) {
          swaps.count++;
          add(swaps.to, swapped[1]!.replace(/^(Your|Enemy) /, ''));
        }
        // An Elixir's Immortal (`ABILITY.elixir.immortal`): given, and hits it turned to nothing.
        if (/ is Immortal until its next turn\.$/.test(text)) immortals.given++;
        if (/ is Immortal: no damage\.$/.test(text)) immortals.blocked++;
        if (/speed and health swap back/.test(text)) swappingBack = true;
        else if (swappingBack && / falls\.$/.test(text)) swaps.fellBack++;
        else swappingBack = false;
        const track = /^(.+) is (Delayed|Hastened) (\d+)\.$/.exec(text);
        if (track && acting) {
          const [, name, kind, n] = track;
          if (kind === 'Delayed') {
            const d = (delays[acting.ability] ??= {count: 0, slots: 0, again: 0});
            d.count++;
            d.slots += Number(n);
            if (delayedSince.has(name!)) d.again++;
            delayedSince.add(name!);
          } else {
            const h = (hastes[acting.ability] ??= {count: 0, slots: 0, self: 0, to: {}});
            h.count++;
            add(h.to, name!.replace(/^(Your|Enemy) /, ''));
            h.slots += Number(n);
            if (name === acting.name) h.self++;
          }
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
      const hold = u.statuses.find((x) => x.hail);
      if (hold) {
        const caster = state.units.find((v) => v.id === hold.hail);
        held[caster?.side === u.side ? 'ally' : 'enemy']++;
      }
      const input = withAi(u.side === modSide ? mod?.ai : undefined, () =>
        u.side === modSide &&
        mod?.search &&
        (!mod.searchHeroes || mod.searchHeroes.includes(u.hero))
          ? searchWith(mod.search)(state, u)
          : chooseAiTurn(state, u)
      );
      const moving = (input.move?.length ?? 0) > 0;
      const swap =
        input.action.ability === 'grapple' &&
        input.action.target?.hex?.q === u.hex?.q &&
        input.action.target?.hex?.r === u.hex?.r;
      add((uses[u.hero] ??= {}), moving ? 'move' : swap ? 'swap' : input.action.ability);
      add(uses[u.hero]!, 'turns');
      if (input.action.ability === 'sunlight') {
        const at = input.action.target!.hex!;
        const t = state.units.find((v) => v.alive && v.hex?.q === at.q && v.hex.r === at.r);
        add(
          sunlight,
          !t
            ? 'hailOnly'
            : t === u
              ? 'self'
              : t.side !== u.side
                ? 'enemy'
                : t.hero === CAMEL
                  ? 'camel'
                  : `ally:${t.hero}`
        );
      }
      if (moving) {
        moveTurns++;
        movedHexes += input.move!.length;
      }
      actor = u.side;
      acting = {name: unitName(u), ability: moving ? 'move' : input.action.ability};
      applyTurn(state, u, input);
      useKits(null, modSide);
      readLog(state);
      acting = null;
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
    /** Turns a fight begun Immobilized by hail: the other side's, or its own side's. */
    heldTurnsPerFight: {enemy: round(held.enemy / fights, 2), ally: round(held.ally / fights, 2)},
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
    /** Delays a fight by source: how many, slots moved, and how many on a unit already Delayed since its last turn. */
    delaysPerFight: Object.fromEntries(
      Object.entries(delays).map(([k, v]) => [
        k,
        {
          count: round(v.count / fights, 2),
          slots: perFight(v.slots),
          again: round(v.again / fights, 2),
        },
      ])
    ),
    /** Hastes a fight by source: how many, slots gained, how many the user gave itself, and by unit. */
    hastesPerFight: Object.fromEntries(
      Object.entries(hastes).map(([k, v]) => [
        k,
        {
          count: round(v.count / fights, 2),
          slots: perFight(v.slots),
          self: round(v.self / fights, 2),
          to: Object.fromEntries(Object.entries(v.to).map(([u, n]) => [u, round(n / fights, 2)])),
        },
      ])
    ),
    /** Elixir's swaps a fight (`ABILITY.elixir.swap`): how many, by unit, and units falling as one ends. */
    swapsPerFight: {
      count: round(swaps.count / fights, 2),
      fellBack: round(swaps.fellBack / fights, 2),
      to: Object.fromEntries(Object.entries(swaps.to).map(([u, n]) => [u, round(n / fights, 2)])),
    },
    /** Elixir's Immortals a fight (`ABILITY.elixir.immortal`): given, and hits that took no health. */
    immortalsPerFight: {
      given: round(immortals.given / fights, 2),
      blocked: round(immortals.blocked / fights, 2),
    },
    hitsPerFight: Object.fromEntries(
      Object.entries(hits).map(([k, v]) => [
        k,
        {enemy: round(v.enemy / fights, 2), ally: round(v.ally / fights, 2)},
      ])
    ),
    damagePerFight: Object.fromEntries(
      Object.entries(damage).map(([k, v]) => [
        k,
        {enemy: perFight(v.enemy), ally: perFight(v.ally)},
      ])
    ),
    killsPerFight: Object.fromEntries(
      Object.entries(kills).map(([k, n]) => [k, round(n / fights, 2)])
    ),
    sunlightTargets: sunlight,
    empowerDamagePerFight: perFight(empowerDamage),
    meltsPerFight: round(melts / fights, 2),
    survivalPct: Object.fromEntries(
      Object.entries(units).map(([h, n]) => [h, round((100 * (survivors[h] ?? 0)) / n)])
    ),
  };
}
