/**
 * Temee's next step as the board shows it (kept apart from the drawing,
 * so it runs without a browser).
 */
import type {Hex} from '@canvas/engine';
import {isImmobilized, stepToExit} from '../../rules/board';
import {CAMEL} from '../../rules/config';
import {mapOf} from '../../rules/fight';
import type {FightState} from '../../rules/types';
import type {BoardScene} from './scene';

/**
 * Where Temee steps on its next turn (`stepToExit`, as `walkRoad` takes
 * it), with the units where the planned turn would leave them, so the
 * arrow turns as units come into its way or leave it. Undefined when it
 * would wait: Immobilized or Stunned, hemmed in, or at the exit.
 */
export function camelNextStep(
  fight: FightState,
  preview: BoardScene['preview']
): {from: Hex; to: Hex} | undefined {
  if (fight.phase !== 'fight') return undefined;
  const moved = new Map(preview.map((p) => [p.unitId, p]));
  const units = fight.units.map((u) => {
    const p = moved.get(u.id);
    if (!p) return u;
    return p.killed ? {...u, alive: false} : {...u, hex: p.to ?? u.hex};
  });
  const camel = units.find((u) => u.hero === CAMEL);
  if (!camel?.alive || !camel.hex || isImmobilized(camel)) return undefined;
  const to = stepToExit({...fight, units}, mapOf(fight), camel);
  return to && {from: camel.hex, to};
}
