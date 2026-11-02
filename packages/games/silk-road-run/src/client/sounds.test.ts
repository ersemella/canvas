import {describe, expect, it} from 'vitest';
import {createRun, handleRunAction} from '../rules/run';
import {cuePriority, eventCue, SOUNDS} from './sounds';

describe('sounds', () => {
  it('gives every recorded event of a turn a known cue or none', () => {
    let run = createRun(0);
    run = handleRunAction(run, {type: 'turn', action: {ability: 'hold'}});
    const events = run.fight.events ?? [];
    expect(events.length).toBeGreaterThan(0);
    for (const e of events) {
      const cue = eventCue(e, run.fight);
      if (cue) expect(SOUNDS[cue].length).toBeGreaterThan(0);
    }
  });

  it('sounds a fallen hero apart from a fallen enemy, and ranks deaths over hits', () => {
    const run = createRun(0);
    const hero = run.fight.units.find((u) => u.side === 'player')!;
    const enemy = run.fight.units.find((u) => u.side === 'enemy')!;
    const death = (unitId: string) => ({kind: 'death', unitId, hex: {q: 0, r: 0}}) as const;
    expect(eventCue({...death(hero.id), after: run.fight.events![0]!.after}, run.fight)).toBe(
      'fallen'
    );
    expect(eventCue({...death(enemy.id), after: run.fight.events![0]!.after}, run.fight)).toBe(
      'death'
    );
    expect(cuePriority('death')).toBeGreaterThan(cuePriority('hit'));
    expect(cuePriority('hit')).toBeGreaterThan(cuePriority('step'));
  });
});
