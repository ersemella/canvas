import {useCallback, useEffect, useRef, useState} from 'react';
import type {MutableRefObject} from 'react';
import type {EventBus} from '@canvas/engine';
import type {HeroId, TurnInput} from '@canvas/games-silk-road-run';
import {runsApi} from './runsApi';
import type {RunResponse} from './runsApi';

/** Remembers, for this tab, that the start menu is open over the fight. */
const START_MENU_STORAGE = 'canvas:tactics:startMenu';

function savedStartMenu(): boolean {
  try {
    return sessionStorage.getItem(START_MENU_STORAGE) === '1';
  } catch {
    return false;
  }
}

/**
 * The run on the server, as the page sees it: resumed on load, then one
 * request per action (`/runs`), each answered with the whole view. What an
 * action sets off is played back on the board (`tactics:playback` on
 * `events`), and the page waits for it (`playing`) until the board says
 * it's done (`playbackDone`). Also whether the start menu is open over it.
 */
export function useRun(events: MutableRefObject<EventBus | null>) {
  const [run, setRun] = useState<RunResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  /** The board is playing back what the last turn set off; the page waits for it. */
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The start menu, over the fight (New run, Reset run) until a new run
  // starts; there's no going back to the old one, which is abandoned then. A
  // refresh keeps it open.
  const [startMenu, setStartMenuState] = useState(savedStartMenu);
  const setStartMenu = useCallback((open: boolean) => {
    setStartMenuState(open);
    try {
      if (open) sessionStorage.setItem(START_MENU_STORAGE, '1');
      else sessionStorage.removeItem(START_MENU_STORAGE);
    } catch {
      // storage blocked: a refresh shows the fight
    }
  }, []);

  const fight = run?.view.fight ?? null;
  const fightRef = useRef(fight);
  fightRef.current = fight;

  // Resume the key's active run, if any.
  useEffect(() => {
    runsApi
      .active()
      .then(({activeRunId}) => (activeRunId ? runsApi.get(activeRunId).then(setRun) : undefined))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const send = useCallback(
    async (request: () => Promise<RunResponse>, playback = true) => {
      setBusy(true);
      try {
        const before = fightRef.current;
        const r = await request();
        // Play back what the action set off (the player's turn, then the AI's).
        // A new run isn't played back: it starts from the start menu, with no board.
        if (playback && before && r.view.fight.events?.length && events.current) {
          setPlaying(true);
          events.current.emit('tactics:playback', {from: before, to: r.view.fight});
        }
        setRun(r);
        setStartMenu(false);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong.');
      } finally {
        setBusy(false);
      }
    },
    [events, setStartMenu]
  );

  const startRun = useCallback(
    (party: HeroId[]) => void send(() => runsApi.start(party), false),
    [send]
  );

  /** Sends a turn, unless one is being sent or played back. */
  const sendTurn = useCallback(
    (turn: TurnInput) => {
      if (!run || busy || playing) return;
      void send(() => runsApi.turn(run.runId, turn));
    },
    [run, send, busy, playing]
  );

  /** On to the run's next stage, once this one is won: a new board, nothing to play back. */
  const nextStage = useCallback(() => {
    if (!run || busy) return;
    void send(() => runsApi.next(run.runId), false);
  }, [run, send, busy]);

  const playbackDone = useCallback(() => setPlaying(false), []);

  return {
    run,
    fight,
    loading,
    busy,
    playing,
    error,
    setError,
    startMenu,
    setStartMenu,
    startRun,
    sendTurn,
    nextStage,
    playbackDone,
  };
}
