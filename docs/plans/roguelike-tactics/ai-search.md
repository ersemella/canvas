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
  Each completed iteration re-sorts the root options by their values, so
  the next one searches the previous best first (2026-10-21).
- Use one evaluation from the root team's perspective: living health,
  casualties, statuses (Stunned and Immobilized, in turns lost) and the
  camel's road. Victory or defeat dominates other scores. Progress toward
  combat is signed for the acting team (since 2026-10-23 every turn places
  the card the same, so time has no cost to weigh).
  Progress is evaluated per action; subtracting both teams' absolute
  distances would cancel out in a duel and encourage Holding.
- Maximize for the root side and minimize for the opposing side, regardless
  of controller. The timeline can give several consecutive turns to allies.
  Each decision node is whoever's card comes next on the track
  (`advanceToDecision`), never an assumed alternation; Temee's walk and
  skipped turns happen in between as on the live track. A test pins this
  down (two wolves due back to back finish the last hero).
- **Temee is the enemy's quarry (2026-10-23).** An enemy unit closes in on
  Temee while it lives, not on the nearest hero (`quarryGap`, used by both
  the screening score and the per-action progress term), and Temee's
  health counts 2 a point (`AI.camelHealthWeight`, was 1): at least what
  any other unit's point is worth with its kill value spread over its
  health, so only a finishing blow outranks a hit on Temee; its death is
  the enemy's victory. Over 700 AI-vs-AI fights (stage shapes in turn),
  Temee's share of the enemy's damage rose from 25% to 36% and its deaths
  from 18 to 27, but the enemy's wins fell from 15% to 9%: chasing Temee
  past the party costs it more units (party wipes 87 to 36).
- Alpha-beta avoids expanding branches that cannot improve the result.
  Successor timelines and subsequent reply sets are generated only when
  visited. A small candidate pool is still simulated up front at each
  visited decision to establish the heuristic order. Screening limits
  breadth, so this is approximate search; pruning preserves minimax within
  that selected tree.

`advanceToDecision()` in `fight.ts` is shared with live play. It advances
the camel's walk, skipped turns and the lifting of hail before pausing for
either side's next decision. Resuming a paused decision does not apply
them again. (Charged abilities, and the separate preview copies they
needed, went with action costs on 2026-10-23.)

## Separate movement integration

Ordinary walking now blocks on either side’s units and is a separate action
costing 20 plus 10 per hex, capped at four hexes. Leap jumps exactly two, over one hex.
Candidate generation and threat estimates respect these rules. The search’s
per-action time calculation uses the same authoritative movement cost as the
server and previews; the Hold scoring adjustment applies only to idle Hold,
not move-only turns. The lethal-reply regression checks a legal escape that
survives all immediate replies rather than requiring the former move-and-Pin
sequence, which is no longer legal in one turn.

## Work caps

`AI` in `config.ts` sets 110 work units per AI turn and 220 across all AI
turns triggered by one player request. Each simulated action and
automatic card advanced during search spends one unit. The old minimum
search after exhaustion is gone: a depleted budget uses Hold, which is
always legal. Actual live turns still resolve
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
finishing attacks (until 2026-10-23), terminal outcomes, delayed charges
and target escape (until 2026-10-23), hail lifting at its caster's turn
applied once, and hail aimed only where a unit stands. Existing rules and preview
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

## Tuning, 2026-10-21

A CPU profile of `bench:ai` put most of the time in candidate generation:
`reachableHexes` (about 19%), `statusPoints` (13%, mostly for units with
no status) and string-keyed tile and unit lookups. Number-keyed tiles,
one occupancy map per `reachableHexes` call and an early return for
status-free units left every decision unchanged (12 full self-play fights
compared turn by turn). Over three alternating `bench:ai` runs, mean
request time fell from 2.83 to 1.66 ms and p99 from about 10.4 to 6.0 ms.

Measured on 3,050 AI turns from 60 self-play fights, depth three completes
on only 7.9% of turns: the work cap is nearly always spent (106 of 110 on
average), so the AI mostly plays at a horizon of two. Re-sorting the root
raises that to 8.4%. Head-to-head over 1,000 fights against the previous
AI (each seed played from both sides), the re-sort and the pending-charge
evaluation are even (480–480; 40 stalled fights against 38). Choosing the
best root option finished by an interrupted iteration (sound once the
previous best is searched first) applied on 24% of turns, but was rejected:
no gain in wins (479–476) and more stalled fights (45) and longer ones.
A deeper search therefore needs a larger work cap, which the faster
candidate generation now leaves room for; that is the owner's call
(owner-decisions.md, section 3).

For repeatable local throughput checks of the current implementation, run
`pnpm --filter @canvas/games-silk-road-run bench:ai`. The benchmark
prepares all three default enemy layouts and human choices before timing
individual whole requests. Its corpus follows the current AI's self-play,
so use a fixed saved corpus when comparing different implementations.
