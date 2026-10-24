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
 * the camel's first steps up to the first decision, once the board is up
 * (`boardReady`). While an AI turn is due (`view.aiDue`) the page asks for
 * it, one request each (`continue`), as soon as the view says so, and
 * plays the answers back in turn: an answer that comes during a playback
 * waits for it (`queue`). Also whether the start menu is open over it.
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
  /** The last answer from the server, which may be ahead of the run shown. */
  const latest = useRef<RunResponse | null>(null);
  /** Answers waiting for the playback before them, each with its own. */
  const queue = useRef<{response: RunResponse; payload: PlaybackPayload | null}[]>([]);
  /** An AI turn is being asked for; `continue` turns it on and off for renders. */
  const asking = useRef(false);
  const [aiPending, setAiPending] = useState(false);
  /**
   * A new run's opening, played on its board once that mounts
   * (`boardReady`), and kept until it has played: a board mounted twice (as
   * in development) plays it on the second.
   */
  const opening = useRef<PlaybackPayload | null>(null);

  /** `playing`, as soon as it changes: two answers can come before a render. */
  const playingRef = useRef(false);
  const setPlayback = useCallback((on: boolean) => {
    playingRef.current = on;
    setPlaying(on);
  }, []);

  /** Shows an answer: the run it holds, and its playback, if any; whether one started. */
  const show = useCallback(
    (r: RunResponse, payload: PlaybackPayload | null, deferred = false): boolean => {
      setRun(r);
      if (payload && deferred) {
        // A new run's board mounts only once the start menu closes, so its
        // opening waits for it (`boardReady`).
        setPlayback(true);
        opening.current = payload;
        return true;
      }
      if (!payload || !events.current) return false;
      setPlayback(true);
      events.current.emit('tactics:playback', payload);
      return true;
    },
    [events, setPlayback]
  );

  /** Takes an answer from the server: shown now, or after the playbacks before it. */
  const receive = useCallback(
    (r: RunResponse, playback: 'turn' | 'stage' | 'run') => {
      const before = latest.current?.view.fight;
      latest.current = r;
      // What the action set off, from the last answer; a new fight, its opening.
      const payload =
        playback === 'turn'
          ? before && r.view.fight.events?.length
            ? {from: before, to: r.view.fight}
            : null
          : openingPlayback(r.view.fight);
      if (playback !== 'turn') queue.current = [];
      if (playback === 'turn' && (queue.current.length > 0 || playingRef.current))
        queue.current.push({response: r, payload});
      else show(r, payload, playback === 'run');
    },
    [show]
  );

  // Resume the key's active run, if any.
  useEffect(() => {
    runsApi
      .active()
      .then(({activeRunId}) =>
        activeRunId
          ? runsApi.get(activeRunId).then((r) => {
              latest.current = r;
              setRun(r);
            })
          : undefined
      )
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const send = useCallback(
    async (request: () => Promise<RunResponse>, playback: 'turn' | 'stage' | 'run') => {
      setBusy(true);
      try {
        receive(await request(), playback);
        setStartMenu(false);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong.');
      } finally {
        setBusy(false);
      }
    },
    [receive, setStartMenu]
  );

  // An AI turn is due in the last answer: ask for it now, while the board
  // may still be playing back the one before. Stops at an error, until the
  // next answer.
  const latestVersion = latest.current?.view.version ?? -1;
  useEffect(() => {
    const r = latest.current;
    if (!r || r.status !== 'active' || !r.view.aiDue || asking.current || error) return;
    asking.current = true;
    setAiPending(true);
    runsApi
      .continue(r.runId)
      .then((next) => {
        // Unless a new run or stage has started since.
        if (latest.current !== r) return;
        receive(next, 'turn');
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => {
        asking.current = false;
        setAiPending(false);
      });
  }, [latestVersion, aiPending, error, receive, run]);

  const startRun = useCallback(
    (party: HeroId[]) => void send(() => runsApi.start(party), 'run'),
    [send]
  );

  /** The run is waiting on the server or the board: an AI turn asked for or queued. */
  const waiting = busy || aiPending || queue.current.length > 0;

  /** Sends a turn, unless one is being sent or played back. */
  const sendTurn = useCallback(
    (turn: TurnInput) => {
      if (!run || waiting || playing) return;
      void send(() => runsApi.turn(run.runId, turn), 'turn');
    },
    [run, send, waiting, playing]
  );

  /** On to the run's next stage, once this one is won: a new board, its opening played back. */
  const nextStage = useCallback(() => {
    if (!run || busy) return;
    void send(() => runsApi.next(run.runId), 'stage');
  }, [run, send, busy]);

  /** The board has played back an answer: the next one waiting shows, or the page is free. */
  const playbackDone = useCallback(() => {
    opening.current = null;
    for (let next = queue.current.shift(); next; next = queue.current.shift())
      if (show(next.response, next.payload)) return;
    setPlayback(false);
  }, [show, setPlayback]);

  /** The board has mounted: a new run's opening plays back on it. */
  const boardReady = useCallback(() => {
    if (opening.current) events.current?.emit('tactics:playback', opening.current);
  }, [events]);

  return {
    run,
    fight,
    loading,
    busy: waiting,
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
