import {createFight, advance, applyTurn, actingUnit} from '@balance-rules/fight';
import {chooseAiTurn} from '@balance-rules/ai';
import {placeStartingCards} from '@balance-rules/track';
import {SALT_FLATS} from '@balance-rules/map';
import type {HeroId, Side} from '@balance-rules/types';
import {ABILITY, AI, CAMEL, PARTY, RULES} from '@balance-rules/config';
import {hexEquals} from '@canvas/engine/server';

type Options = {samples: number; seed: number; maxTurns: number; moveCost: number};
type HeroMetrics = {
  turns: number;
  moves: number;
  holds: number;
  abilities: number;
  damage: number;
  healing: number;
};
type FightResult = {
  variant: string;
  sample: number;
  priority: Side;
  winner: Side | null;
  turns: number;
  slots: number;
  moves: number;
  moveOnly: number;
  holds: number;
  hexes: number;
  firstDamageSlot: number | null;
  byHero: Record<HeroId, HeroMetrics>;
  abilities: Record<string, number>;
  survivors: Record<HeroId, number>;
};
const variants = [
  {name: 'baseline', blockAllUnits: false, separateMovement: false},
  {name: 'blocking', blockAllUnits: true, separateMovement: false},
  {name: 'separate', blockAllUnits: false, separateMovement: true},
  {name: 'both', blockAllUnits: true, separateMovement: true},
];
export function runBalance(options: Options) {
  let rng = options.seed >>> 0;
  const random = () => {
    rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
    return rng / 4294967296;
  };
  const shuffle = <T>(items: T[]) => {
    const a = [...items];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [a[i], a[j]] = [a[j]!, a[i]!];
    }
    return a;
  };
  // Independent random legal placements for both teams, reused in all variants.
  const deployments = Array.from({length: options.samples}, () => ({
    // The camel keeps its own starting hex (camel.md).
    player: shuffle(
      SALT_FLATS.startColumns.player.filter((h) => !hexEquals(h, SALT_FLATS.camelStart))
    ).slice(0, PARTY.length),
    enemy: shuffle(SALT_FLATS.startColumns.enemy).slice(0, PARTY.length),
  }));
  const fights: FightResult[] = [];
  for (const variant of variants) {
    const start = performance.now();
    for (let sample = 0; sample < deployments.length; sample++) {
      for (const priority of ['player', 'enemy'] as const) {
        // The sample's own ruins and quicksand, the same in every variant.
        const state = createFight(sample);
        state.experiment = {
          blockAllUnits: variant.blockAllUnits,
          separateMovement: variant.separateMovement,
          moveActionCost: options.moveCost,
        };
        const positions = deployments[sample]!;
        for (const side of ['player', 'enemy'] as const)
          state.units
            .filter((u) => u.side === side && u.hero !== CAMEL)
            .forEach((u, i) => {
              u.hex = positions[side][i]!;
            });
        // The fixed tie order (no shuffle), so `priority` decides starting speed ties.
        if (priority === 'enemy') {
          // Swap side labels only while allocating the starting track. Geometry,
          // team identities, and AI tie-breaking remain identical across the pair.
          for (const u of state.units) u.side = u.side === 'player' ? 'enemy' : 'player';
          placeStartingCards(state);
          for (const u of state.units) u.side = u.side === 'player' ? 'enemy' : 'player';
        } else placeStartingCards(state);
        // Stop at every unit to measure and bound the fight; both sides use the same AI.
        for (const u of state.units) u.controller = 'human';
        let turns = 0,
          moves = 0,
          moveOnly = 0,
          holds = 0,
          hexes = 0,
          firstDamageSlot: number | null = null;
        const byHero = Object.fromEntries(
          [...PARTY, CAMEL].map((h) => [
            h,
            {turns: 0, moves: 0, holds: 0, abilities: 0, damage: 0, healing: 0},
          ])
        );
        const heroMetrics = byHero as Record<HeroId, HeroMetrics>;
        const abilities: Record<string, number> = {};
        const observeDamage = () => {
          if (firstDamageSlot === null && state.units.some((u) => u.hp < u.maxHp))
            firstDamageSlot = state.currentSlot;
        };
        advance(state, chooseAiTurn);
        while (state.phase === 'fight' && turns < options.maxTurns) {
          observeDamage();
          const u = actingUnit(state);
          if (!u) throw new Error('Fight did not yield an acting unit');
          const input = chooseAiTurn(state, u);
          const moving = (input.move?.length ?? 0) > 0;
          const hold = input.action.ability === 'hold';
          const stats = heroMetrics[u.hero];
          stats.turns++;
          if (moving) {
            moves++;
            stats.moves++;
            hexes += input.move!.length;
          }
          if (hold && !moving) {
            holds++;
            stats.holds++;
          }
          if (hold && moving) moveOnly++;
          if (!hold) stats.abilities++;
          abilities[input.action.ability] = (abilities[input.action.ability] ?? 0) + 1;
          const before = state.units.map((x) => ({side: x.side, hp: x.hp}));
          applyTurn(state, u, input);
          state.units.forEach((x, i) => {
            if (x.side !== u.side) stats.damage += Math.max(0, before[i]!.hp - x.hp);
            else stats.healing += Math.max(0, x.hp - before[i]!.hp);
          });
          turns++;
          observeDamage();
          state.log = [];
          advance(state, chooseAiTurn);
        }
        observeDamage();
        fights.push({
          variant: variant.name,
          sample,
          priority,
          winner: state.phase === 'won' ? 'player' : state.phase === 'lost' ? 'enemy' : null,
          turns,
          slots: state.currentSlot,
          moves,
          moveOnly,
          holds,
          hexes,
          firstDamageSlot,
          byHero: heroMetrics,
          abilities,
          survivors: Object.fromEntries(
            PARTY.map((h) => [h, state.units.filter((u) => u.hero === h && u.alive).length])
          ) as Record<HeroId, number>,
        });
      }
    }
    console.log(
      `${variant.name}: ${options.samples * 2} fights in ${((performance.now() - start) / 1000).toFixed(1)}s`
    );
  }
  const median = (ns: number[]) => {
    if (ns.length === 0) return null;
    const a = [...ns].sort((a, b) => a - b);
    const i = Math.floor(a.length / 2);
    return a.length % 2 ? a[i] : (a[i - 1]! + a[i]!) / 2;
  };
  const pct = (n: number, d: number) => +((100 * n) / (d || 1)).toFixed(1);
  const summary = variants.map((v) => {
    const fs = fights.filter((f) => f.variant === v.name);
    const ended = fs.filter((f) => f.winner);
    const sum = (key: 'moves' | 'turns' | 'holds' | 'moveOnly') =>
      fs.reduce((a, f) => a + f[key], 0);
    return {
      variant: v.name,
      fights: fs.length,
      stallPct: pct(fs.length - ended.length, fs.length),
      medianTurnsEnded: ended.length ? median(ended.map((f) => f.turns)) : null,
      medianSlotsEnded: ended.length ? median(ended.map((f) => f.slots)) : null,
      medianFirstDamageSlot: median(
        fs.filter((f) => f.firstDamageSlot !== null).map((f) => f.firstDamageSlot!)
      ),
      moveTurnPct: pct(sum('moves'), sum('turns')),
      idleHoldPct: pct(sum('holds'), sum('turns')),
      moveOnlyPct: pct(sum('moveOnly'), sum('turns')),
      priorityWinPctEnded: pct(ended.filter((f) => f.winner === f.priority).length, ended.length),
      heroSurvivalPct: Object.fromEntries(
        PARTY.map((h) => [
          h,
          pct(
            fs.reduce((n, f) => n + f.survivors[h], 0),
            fs.length * 2
          ),
        ])
      ),
    };
  });
  return {
    options,
    methodology: {
      map: SALT_FLATS.id,
      roster: PARTY,
      movementCap: RULES.movementCap,
      aiSettings: {
        maxSimulations: AI.maxSimulations,
        rootSimulations: AI.rootSimulations,
        replySimulations: AI.replySimulations,
        searchWidth: AI.searchWidth,
        searchDepth: AI.searchDepth,
      },
      movement:
        'move-only = Hold with experiment moveActionCost plus per-hex cost; counts toward ultimate as before',
      blocking: 'ordinary walking only; Leap and Rampage retain their ability rules',
      pairing: 'same random placements, twice with opposite starting speed-tie priority',
      ai: 'current deterministic budgeted alpha-beta AI on both teams; threat model respects variants; historical combined options move first',
      stalls: `still fighting after ${options.maxTurns} chosen turns; charged trigger turns not counted`,
      damage:
        'byHero damage/healing measures immediate resolution only, excluding later status/charge ticks',
    },
    summary,
    fights,
    deployments,
  };
}
