/**
 * Silk Road Tactics' server rules, DOM-free, for the platform's `RunRoom`
 * (`@canvas/server`): a Phase 1 run is a single fight.
 */
import type {RunSystem} from '@canvas/engine/server';
import {createRun, handleRunAction, runStatus, runView} from './rules/run';
import type {RunState, RunView} from './rules/run';
import type {RunAction} from './rules/types';

export const silkRoadTacticsRunSystem: RunSystem<RunState, RunAction, RunView> = {
  kind: 'run',
  systemName: 'SilkRoadTacticsRunSystem',
  createRun,
  handleAction: handleRunAction,
  getView: runView,
  status: runStatus,
};

export default silkRoadTacticsRunSystem;
