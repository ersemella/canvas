# Budgeted AI lookahead

Implemented 2026-10-20 in `src/rules/ai.ts`. The AI searches actual future
decisions, using selective minimax with alpha-beta pruning and iterative
deepening. It remains deterministic: no randomness or clock-based cutoff.

## Search

- Rank up to 48 root actions with the existing heuristic, including its
  cached threat map. Keep the best four, with stable ties.
- At future decisions, rank up to eight actions and keep four. This uses
  immediate effects, status, positioning and action time, without building
  another speculative threat map: these replies are simulated explicitly.
- Try a horizon of two decisions, including the root action. If work
  remains, try three. Only a fully completed iteration replaces the choice;
  interruption returns the previous iteration, or the greedy root choice.
- Use one evaluation from the root team's perspective: living health,
  casualties, statuses and fog. Victory or defeat dominates other scores.
  Time costs and progress toward combat are signed for the acting team.
  Progress is evaluated per action; subtracting both teams' absolute
  distances would cancel out in a duel and encourage Holding.
- Maximize for the root side and minimize for the opposing side, regardless
  of controller. The timeline can give several consecutive turns to allies.
- Alpha-beta avoids expanding branches that cannot improve the result.
  Successor timelines and subsequent reply sets are generated only when
  visited. A small candidate pool is still simulated up front at each
  visited decision to establish the heuristic order. Screening limits
  breadth, so this is approximate search; pruning preserves minimax within
  that selected tree.

`advanceToDecision()` in `fight.ts` is shared with live play. It advances
slot damage, status expiry, hail and charges before pausing for either
side's next decision. Resuming a paused decision does not tick effects
again. Search uses faithful successors; the instant resolution of a charge
used by previews exists on a separate copy and never enters the search
as already-dealt damage.

## Separate movement integration

Ordinary walking now blocks on either side’s units and is a separate action
costing 20 plus 10 per hex, capped at four hexes. Dash goes up to three.
Candidate generation and threat estimates respect these rules. The search’s
per-action time calculation uses the same authoritative movement cost as the
server and previews; the Hold scoring adjustment applies only to idle Hold,
not move-only turns. The lethal-reply regression checks a legal escape that
survives all immediate replies rather than requiring the former move-and-Pin
sequence, which is no longer legal in one turn.

## Work caps

`AI` in `config.ts` sets 110 work units per AI turn and 220 across all AI
turns triggered by one player request. Each simulated action, charged
preview and automatic card advanced during search spends one unit. The
old minimum search after exhaustion is gone: a depleted budget uses Hold,
which is legal even under a binding Taunt. Actual live turns still resolve
normally. Candidate generation, evaluation and threat-map setup have
bounded overhead outside this counter.

These are calibrated work caps, not a proof of a 10 ms CPU ceiling for
arbitrary positions or machines. Deployed Workers do not advance timer
APIs during synchronous computation, so `performance.now()` is unsuitable
as a search deadline. Check Cloudflare CPU logs and `exceededCpu`/1102
errors after deployment, especially as maps and kits grow.

## Validation

Tests in `ai.test.ts` cover matching pruned and unpruned minimax results
at equal horizons (including three decisions), actual pruning savings,
retaining the last complete iteration, shared-budget exhaustion, legal
fallbacks, source-state immutability, lethal retaliation, consecutive-ally
finishing attacks, terminal outcomes, delayed charges and target escape,
and start-of-turn damage/expiry applied once. Existing rules and preview
tests also continue to pass. Repository package-boundary and generated-game
checks, workspace typechecks, all unit tests, and the full local browser/API
end-to-end suite passed.

Local measurements compare the previous AI from revision `7f1ce79` with
the new AI on **identical whole-request inputs**. The corpus has 992 player
requests collected from 40 seeds with default deployments (three enemy
layouts, repeated); each request was measured three times, alternating
which implementation ran first. Measurements include the player's action,
all subsequent AI turns and recorded playback events, excluding the time
spent selecting the human action.

| Local measurement, 2,976 requests each | Previous AI | New search |
|---|---:|---:|
| Median elapsed time | 1.15 ms | 1.64 ms |
| p99 elapsed time | 6.24 ms | 5.36 ms |
| Maximum elapsed time | 32.16 ms | 10.40 ms |
| Elapsed samples over 10 ms | 3 | 1 |
| p99 process CPU time | 9.13 ms | 9.08 ms |

Elapsed measurements include scheduling and GC; process CPU includes
runtime/background work and is not Cloudflare's per-invocation CPU meter.
The comparison supports the chosen caps but does not establish a hard
production guarantee. Separately, 40 self-play fights with the new AI all
finished within 150 player requests (1,606 requests; median 1.41 ms,
p99 5.95 ms). This is a regression sample, not a win-rate claim or a
comprehensive search over deployments.

For repeatable local throughput checks of the current implementation, run
`pnpm --filter @canvas/games-silk-road-tactics bench:ai`. The benchmark
prepares all three default enemy layouts and human choices before timing
individual whole requests. Its corpus follows the current AI's self-play,
so use a fixed saved corpus when comparing different implementations.
