import {useCallback, useEffect, useRef, useState} from 'react';
import type {MutableRefObject} from 'react';
import type {EventBus} from '@canvas/engine';
import {openingPlayback} from '@canvas/games-silk-road-run';
import type {HeroId, PlaybackPayload, TurnInput} from '@canvas/games-silk-road-run';
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
 * it's done (`playbackDone`); a new run or stage plays back its opening,
 * the camel's first step and any enemy turns before the player's, once the
 * board is up (`boardReady`). Also whether the start menu is open over it.
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
  /**
   * A new run's opening, played on its board once that mounts
   * (`boardReady`), and kept until it has played: a board mounted twice (as
   * in development) plays it on the second.
   */
  const opening = useRef<PlaybackPayload | null>(null);

  // Resume the key's active run, if any.
  useEffect(() => {
    runsApi
      .active()
      .then(({activeRunId}) => (activeRunId ? runsApi.get(activeRunId).then(setRun) : undefined))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const send = useCallback(
    async (request: () => Promise<RunResponse>, playback: 'turn' | 'stage' | 'run') => {
      setBusy(true);
      try {
        const before = fightRef.current;
        const r = await request();
        // Play back what the action set off (the player's turn, then the AI's),
        // or a new fight's opening. A new run's board mounts only once the
        // start menu closes, so its opening waits for it (`boardReady`).
        const payload =
          playback === 'turn'
            ? before && r.view.fight.events?.length
              ? {from: before, to: r.view.fight}
              : null
            : openingPlayback(r.view.fight);
        if (payload && playback === 'run') {
          setPlaying(true);
          opening.current = payload;
        } else if (payload && events.current) {
          setPlaying(true);
          events.current.emit('tactics:playback', payload);
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
    (party: HeroId[]) => void send(() => runsApi.start(party), 'run'),
    [send]
  );

  /** Sends a turn, unless one is being sent or played back. */
  const sendTurn = useCallback(
    (turn: TurnInput) => {
      if (!run || busy || playing) return;
      void send(() => runsApi.turn(run.runId, turn), 'turn');
    },
    [run, send, busy, playing]
  );

  /** On to the run's next stage, once this one is won: a new board, its opening played back. */
  const nextStage = useCallback(() => {
    if (!run || busy) return;
    void send(() => runsApi.next(run.runId), 'stage');
  }, [run, send, busy]);

  const playbackDone = useCallback(() => {
    opening.current = null;
    setPlaying(false);
  }, []);

  /** The board has mounted: a new run's opening plays back on it. */
  const boardReady = useCallback(() => {
    if (opening.current) events.current?.emit('tactics:playback', opening.current);
  }, [events]);

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
    boardReady,
  };
}
