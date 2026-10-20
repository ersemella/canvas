import {describe, expect, it} from 'vitest';
import {createRun, handleRunAction} from '../rules/run';
import {Playback, eventSeconds} from './playback';

/** A fight at the player's first turn and one turn after it, as the page sees them. */
function played() {
  let run = createRun(0);
  const from = run.fight;
  run = handleRunAction(run, {type: 'turn', action: {ability: 'hold'}});
  return {from, to: run.fight};
}

describe('playback', () => {
  it('shows every event, in order, then ends on the fight after the turn', () => {
    const {from, to} = played();
    const play = new Playback({from, to});
    const total = to.events!.reduce(
      (t, e, i) => t + eventSeconds(e, i === to.events!.length - 1),
      0
    );
    const seen: number[] = [];
    let going = true;
    for (let t = 0; t < total + 1 && going; t += 0.05) {
      if (seen[seen.length - 1] !== play.index) seen.push(play.index);
      going = play.step(0.05);
    }
    expect(going).toBe(false);
    // Indices only go forward, and the last event's board is the fight after the turn.
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
    for (const u of to.units) {
      expect(play.display.units.find((v) => v.id === u.id)).toMatchObject({
        hex: u.hex,
        hp: u.hp,
        alive: u.alive,
      });
    }
  });

  it('skips a Hold and the player’s own turn coming up', () => {
    const {to} = played();
    const events = to.events!;
    const last = events[events.length - 1]!;
    expect(last.kind).toBe('turn');
    expect(eventSeconds(last, true)).toBe(0);
    expect(eventSeconds(events[0]!, false)).toBe(0); // the player's Hold
  });

  it('shows the unit whose turn it is as acting', () => {
    const {from, to} = played();
    const play = new Playback({from, to});
    const firstTurn = to.events!.findIndex((e) => e.kind === 'turn');
    play.step(
      to.events!.slice(0, firstTurn).reduce((t, e) => t + eventSeconds(e, false), 0) + 0.01
    );
    expect(play.display.awaiting).toBe(to.events![firstTurn]!.unitId);
  });
});
