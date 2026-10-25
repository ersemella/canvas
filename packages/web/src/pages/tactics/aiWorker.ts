/**
 * The run's actions, off the page's thread (`localRuns.ts`): an AI turn
 * looks as deep as this device gets in its time (AI.browser), which would
 * otherwise stall the board's playback.
 */
import {RunError, playRun} from '@canvas/engine/server';
import silkRoadRun from '@canvas/games-silk-road-run/run';
import type {PlayRequest, PlayAnswer} from './localRuns';

self.onmessage = (e: MessageEvent<PlayRequest>) => {
  const {id, record, action} = e.data;
  let answer: PlayAnswer;
  try {
    answer = {id, record: playRun(silkRoadRun, record, action, {now: () => performance.now()})};
  } catch (err) {
    if (!(err instanceof RunError)) console.error(err);
    answer = {id, error: err instanceof RunError ? err.message : 'Something went wrong.'};
  }
  self.postMessage(answer);
};
