# Budgeted AI lookahead

Implemented 2026-10-20 in `src/rules/ai.ts`. The AI searches actual future
decisions, using selective minimax with alpha-beta pruning and iterative
deepening. It remains deterministic: no randomness or clock-based cutoff.

## Search

- Rank up to 48 root actions with the existing heuristic, including its
  cached threat map. Keep the best four, with stable ties.
- At future decisions, play up to six actions, best guess first, and keep
  four (eight, in the order listed, until 2026-10-24; see "Searching
  smarter"). Scoring uses immediate effects, status and positioning,
  without building another speculative threat map: these replies are
  simulated explicitly.
- At the last decision of an iteration, each action is evaluated as it is
  played, from the fight it leaves, with no track run on after it, and the
  rest go unplayed once one settles the decision (alpha-beta, 2026-10-24).
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
- **Temee is the enemy's quarry (2026-10-23).** Temee's health counts 2 a
  point (`AI.camelHealthWeight`, was 1): at least what any other unit's
  point is worth with its kill value spread over its health, so only a
  finishing blow outranks a hit on Temee; its death is the enemy's
  victory. An enemy unit with no hero within a walk and a hit (its move cap
  plus one) closes in on Temee rather than the nearest hero (`huntsTemee`
  and `quarryGap`, used by both the screening score and the per-action
  progress term). Whether it hunts is decided where its turn starts, so a
  move that brings a hero into reach isn't scored as a leap of progress.
  Over 2,100 AI-vs-AI fights (stage shapes in turn, seeds 9000 on):

  | Enemy rule                                           | Enemy wins | Temee killed | Temee's share of enemy damage |
  | ---------------------------------------------------- | ---------: | -----------: | ----------------------------: |
  | Nearest unit, weight 1 (before)                      |      16.0% |          111 |                         26.5% |
  | Nearest unit, weight 2                               |      13.8% |           95 |                         29.3% |
  | Always Temee, weight 2                               |       9.7% |           90 |                         36.5% |
  | **Temee once no hero is in reach, weight 2 (built)** |  **13.9%** |      **104** |                     **30.1%** |

  Always hunting Temee had the enemy cut down walking past the party.
  The party here is the AI too, guarding Temee harder at weight 2, which
  accounts for most of the drop from 16%.

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

`AI` in `config.ts` sets 220 work units per AI turn, which has a request
of its own (owner, 2026-10-24; see "Each AI turn a request"; it was 110 a
turn and 220 shared by a request's AI turns). Each simulated action and
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
| -------------------------------------- | ----------: | ---------: |
| Median elapsed time                    |     1.15 ms |    1.64 ms |
| p99 elapsed time                       |     6.24 ms |    5.36 ms |
| Maximum elapsed time                   |    32.16 ms |   10.40 ms |
| Elapsed samples over 10 ms             |           3 |          1 |
| p99 process CPU time                   |     9.13 ms |    9.08 ms |

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

## Searching smarter, 2026-10-24

Four ways to look further on the same work were built and measured
against the previous AI; two were kept.

- **Best guess first (kept).** A reply plays only its first few
  candidates, which were the first listed: abilities, then the shortest
  walks. On 322 self-play positions the reply's best action, by its own
  score, was outside the eight played in 109; walks of two or three spaces
  were never considered. `guessValue` now ranks every candidate without
  playing it (a hit's damage, kill and status on an enemy, against an
  ally; an Empower from Sunlight; the spaces left to the quarry,
  `quarryGap`), and the best guesses are played. The best action is then
  among the six played in every one of 333 positions (a test pins this
  down over four runs); of the true top four, 8 in 1,332 were missed (626
  before).
- **The last decision scored as played (kept).** At the iteration's last
  decision the actions are evaluated from the fight right after each
  (`evaluatePosition`), without copying it, running the track on or
  scoring it with the heuristic, and alpha-beta stops playing them once
  one settles the decision. Together with the ordering, depth three now
  completes on 69% of turns, up from 10%, for the same CPU per turn
  (2.82 ms against 2.81, alternating runs on 242 positions).
- **Narrower deeper decisions (removed).** Searching four, three, then
  two actions per decision only matters from depth four, which 110 units
  of work never reached: no change in play.
- **Reusing the previous turn's search (removed).** The next AI turn in a
  request took over the decisions the previous turn's search had already
  played and searched after its choice. Within the noise in win rate
  (below), so not worth the machinery.

Head-to-head (`mirror.mjs`-style duels on mirrored pairs, each team's
consecutive turns sharing a request's 220 units of work as in live play,
600 pairs from seed 5000, about 1,060 finished fights each):

| New AI vs                      | As team a | As team b |  Mean |
| ------------------------------ | --------: | --------: | ----: |
| Previous AI                    |     64.9% |     58.6% | 61.8% |
| Previous AI with 30% more work |     64.0% |     58.0% | 61.0% |
| (with reuse) Previous AI       |     63.0% |     58.8% | 60.9% |

The previous AI against itself gives team a 54.4%: in a mirrored pair the
cards keep their slots, so team a has the speed ties in both fights. Each
matchup was therefore played with each AI as team a, and the mean is the
fair figure. On a first, smaller round (300 pairs, the new AI as team b
only) ordering alone and the last-decision scoring alone were each no
better than the previous AI; together they won, and six replies beat
eight (59.9% against 56.4% as team b).

Whole requests (413, from 20 runs, three alternating runs each): mean
1.12 → 1.29 ms, p99 5.29 → 6.35 ms, maximum 9.15 → 8.20 ms.

One test changed: a wolf with a hero two spaces off now waits a step
nearer Temee, keeping the hero two spaces off; the test checked "not
within 6 of Temee" and now checks that it doesn't move away from the hero.
The previous AI held where it stood even at depth three: the new one sees
the Champion's best replies, which the old order of play left out.

An undo journal in place of copying the fight (rolling back each line
rather than copying it) was also tried: identical decisions, within noise
of the copying search's time, since a fight is too small for copying to
matter. Not merged.

## Per-fight geometry, 2026-10-24

What never changes in a fight is worked out once per tile layout
(`geometry` in `board.ts`; a fight's ruins are random, so not once per
map): each space's walkable neighbours, its six lanes up to ruins or the
map's edge, and the spaces within a range of it, sorted. Walking, the
camel's road, the bow's and Skirmish's lanes, shots in the air, Throw's
landings and Hail's targets read them. Candidate turns no longer build a
text key for every walk to drop duplicates (one path per space already);
only ability targets are checked. Decisions are identical (475 turns over
24 self-play runs, every chosen turn and resulting fight compared) and an
AI turn is 16% faster: 2.07 → 1.74 ms, best of four passes over the same
positions.

A cache across requests was considered and not built (owner, 2026-10-24).
A Durable Object's memory is evicted at any time, so to keep the AI
deterministic the cache could only return the exact result a fresh search
would, for an identical position; identical positions hardly recur
outside retries.

## Each AI turn a request, 2026-10-24

All the AI turns after a player's turn used to run in that turn's
request, sharing 220 units of work (at most 110 each). Now the server
runs the track on to the next decision of either side and answers; while
an AI turn is due the view says so (`aiDue`, with no `awaiting` unit for
the page to control) and the page asks for it, `POST /runs/:id/continue`,
one AI turn a request, each with 220 units (owner, 2026-10-24). A turn of
the player's is refused while an AI turn is due, and `continue` while
none is. The page asks as soon as an answer says one is due, while the
board may still be playing back the one before, and plays the answers
back in order (`useRun`); its turn controls stay up, greyed, for the
party's unit whose card comes next.

Requests on the same positions (30 fights, three runs each, an idle
machine): before, the player's turn and every AI turn after it, median
1.67 ms, p99 7.29 ms, maximum 16.43 ms; now an AI turn, median 2.39 ms,
p99 5.65 ms, maximum 9.11 ms (a player's turn alone, p99 0.06 ms). Twice
the work per AI turn for a smaller worst request. Head-to-head against
the AI before (both on mirrored pairs, each AI's consecutive turns as
the live requests had them; 500 pairs from seed 7000, about 870 finished
fights each way): 53.8% as team b and 59.8% as team a, 56.8% on average.

The guess that orders a decision's turns (`orderedInputs`) also learned,
on the way, what a walk's end is worth to statuses and shots in the air
(`standing`: out of an Empowered Champion's reach, into reach of the
Champion grappling an ally, out of a drawn arrow's lane) and that a drawn
arrow can be dodged and costs its charge: the best turn is again among
the six played on every decision of 12 runs, both sides'.

A fight now takes about twice the requests (one per AI turn), against
the Free plan's 100,000 a day ([architecture.md](architecture.md)).

## Looking deeper with narrower decisions, 2026-10-24

With 220 units a turn, depth three (`AI.searchDepth`) completes on every
turn and stops there with work left (831 positions, 2.15 ms a turn).
A deeper horizon with fewer options per decision further from the root
was measured (branch `claude/ai-width-taper`, `AI.searchWidths`; widths
listed from the root, the last for any deeper), against today's search
on mirrored pairs, each as team a in turn:

| Search | Units | Mean win share | AI request p99 | Over 10 ms |
|---|---:|---:|---:|---:|
| Today: width 4, depth 3 | 220 | — | 4.83 ms | 0–2 of 3,681 |
| 4, depth 5 | 220 | 53.4% | | |
| 4, 3, 2, depth 5 | 220 | 56.0% | 10.34 ms | 44 of 3,681 |
| 4, 4, 2, depth 5 | 220 | 55.4% | 9.16 ms | 16 of 3,681 |
| 3, 3, 2, depth 5 | 220 | 53.5% | | |
| 4, 3, 2, depth 5 | 150 | 49.6% | 6.72 ms | 6 of 3,681 |
| 4, 3, 2, depth 5 | 110 | 50.2% | 4.79 ms | 0 of 3,681 |

(300–400 pairs each way; about ±3 points at 95%. Today's own maximum
had one-off spikes to 21 ms from the machine; the p99 is the figure to
trust.)

Narrowing pays only with the CPU to go deeper: at 220 units, 4, 3, 2 to
depth five wins 56% but puts about 1 in 100 AI turns over the Free plan's
10 ms; at a budget as safe as today's it is even. Not built. On Workers
Paid (30 s a request) it is the next step: `searchWidths` [4, 3, 2],
`searchDepth` 5, 220 units or more ([owner-decisions.md](owner-decisions.md),
section 3).

## As deep as the device gets, 2026-10-25

The run plays in the browser now ([../client-side-runs.md](../client-side-runs.md),
L5), so the 10 ms ceiling is gone, and the owner chose to look as deep as
the device allows. Given a clock (`RunContext.now`, from the page's Web
Worker) an AI turn searches until `AI.browser.thinkMs` (400 ms) has
passed, reading it every 32nd unit of work; it narrows further from the
root (`AI.browser.widths` [4, 3, 2], the width taper of
`claude/ai-width-taper`, now `AI.searchWidths`) up to 24 decisions and
24,000 units, which bound the search's memory. An iteration that plays
nothing new (every line ended) stops the deepening. Iterative deepening
still only commits a completed depth.

This gives up determinism in the browser: a faster device looks deeper.
Without a clock (tests, balance scripts, `autoTurn`) the search keeps
`maxSimulations` 220 and `searchDepth` 3, unchanged, with widths [4].

Measured in Node on 40 AI turns from six runs: 11 to 24 decisions
completed in 400 ms, median 13 (3 before), about 15,000 units of work and
up to 63 MB. Head-to-head against the AI before (`mirror.mjs`, variants
`browser` and `browser-slow`, the latter a quarter of the time; 80 pairs
from seed 7000 each way, the machine shared with other runs), at 100 ms:

| Browser AI (100 ms) vs AI before | As team a | As team b |  Mean | Unfinished |
| -------------------------------- | --------: | --------: | ----: | ---------: |
| Share of decided fights          |     90.3% |     84.2% | 87.3% |   25–29%   |

More fights go unfinished (400 actions without a winner) than the AI
before's 10.7 to 13.7% against other AIs: seeing far enough that every
attack is answered, it may wait. To watch in play.
