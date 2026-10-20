/** Local calibration only: deployed Worker timers cannot measure synchronous search. */
import {bench} from 'vitest';
import {chooseAiTurn} from './ai';
import {actingUnit, defaultDeployment} from './fight';
import {createRun, handleRunAction} from './run';
import type {RunState} from './run';
import type {RunAction} from './types';

const requests: {run: RunState; action: RunAction}[] = [];
for (let seed = 0; seed < 3; seed++) {
  let run = createRun(seed);
  run = handleRunAction(run, {type: 'deploy', placements: defaultDeployment(run.fight)});
  for (let turn = 0; turn < 150 && run.fight.phase === 'fight'; turn++) {
    // Prepare the human decision outside the measured request.
    const input = chooseAiTurn(run.fight, actingUnit(run.fight)!);
    const action: RunAction = {type: 'turn', ...input};
    requests.push({run, action});
    run = handleRunAction(run, action);
  }
}

let index = 0;
bench(
  'whole player request, including AI turns and playback events',
  () => {
    const {run, action} = requests[index++ % requests.length]!;
    handleRunAction(run, action);
  },
  {iterations: 1000, time: 3000, warmupTime: 1000}
);
