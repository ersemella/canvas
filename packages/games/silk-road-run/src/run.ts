/**
 * Caravan's run rules, DOM-free, for the page's run host
 * (`@canvas/engine/server`, `playRun`), in the browser and its AI's Web
 * Worker: a run is its stages' fights, one after another.
 */
import type {RunSystem} from '@canvas/engine/server';
import {createRun, handleRunAction, runOutdated, runStatus, runView} from './rules/run';
import type {RunState, RunView} from './rules/run';
import type {RunAction} from './rules/types';

export const silkRoadRunRunSystem: RunSystem<RunState, RunAction, RunView> = {
  kind: 'run',
  systemName: 'SilkRoadRunRunSystem',
  createRun,
  handleAction: handleRunAction,
  getView: runView,
  status: runStatus,
  outdated: runOutdated,
};

export default silkRoadRunRunSystem;
