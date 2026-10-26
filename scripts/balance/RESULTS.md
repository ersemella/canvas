# Caravan: movement balance experiment

500 random deployments × two starting tie priorities × four rulesets × two movement costs = **8,000 simulated fights**. Seed: `20261020`. Both movement-cost runs repeat the same baseline and blocking fights, so these are **6,000 distinct experimental cases**, not 8,000 independent observations. Each deployment pair is also correlated.

**Adopted after these measurements (2026-10-20):** production defaults now block ordinary walking through units and make movement a separate action at **20 + 10 per hex**. The ordinary walking cap was subsequently restored to **4**, and Dash to **3**. The results below used walking cap **3** and Dash distance **2**, describe the historical comparisons, and have not been rerun for cap 4. These measurements also predate the alpha-beta AI update. The runner supplies explicit rule overrides; exact reproduction requires the earlier AI revision (see below).

## Results

### Quick move action: base cost 60

Move-only cost is the base cost plus 10 per walked hex, then converted to timeline delay using the unit’s speed.

| Rules                  | Unfinished at 400 actions | Median actions, completed fights | Median timeline slots, completed fights | Turns with walking | Idle Hold turns |
| ---------------------- | ------------------------: | -------------------------------: | --------------------------------------: | -----------------: | --------------: |
| Current rules          |                        0% |                             43.5 |                                      88 |              44.1% |              6% |
| Blocking only          |                      0.1% |                               43 |                                      87 |              44.3% |            6.3% |
| Separate movement only |                      2.4% |                               68 |                                     129 |              15.3% |           17.6% |
| Both changes           |                      1.7% |                               68 |                                     129 |              15.8% |           16.1% |

Walking and idle percentages above include capped fights, so long stalls receive more weight. For completed fights only:

| Rules                  | Turns with walking | Idle Hold turns |
| ---------------------- | -----------------: | --------------: |
| Current rules          |              44.1% |            6.0% |
| Blocking only          |              44.6% |            5.6% |
| Separate movement only |              16.9% |           12.3% |
| Both changes           |              17.0% |           12.6% |

Opening damage and starting tie priority:

| Rules                  | Median first damage slot | Starting-priority side wins, completed fights |
| ---------------------- | -----------------------: | --------------------------------------------: |
| Current rules          |                        8 |                                         43.3% |
| Blocking only          |                        8 |                                         43.4% |
| Separate movement only |                       15 |                                         48.7% |
| Both changes           |                       15 |                                         48.6% |

Hero survival at completion or the action cutoff (per starting unit):

| Rules                  | Grappler | Horse Archer | Storm Caller |
| ---------------------- | ------------: | ----------------: | -----------: |
| Current rules          |           40% |             33.1% |        48.1% |
| Blocking only          |           39% |             33.5% |        47.8% |
| Separate movement only |         25.1% |             28.9% |        49.6% |
| Both changes           |         25.4% |             27.3% |        49.5% |

### Typical move action: base cost 100

Move-only cost is the base cost plus 10 per walked hex, then converted to timeline delay using the unit’s speed.

| Rules                  | Unfinished at 400 actions | Median actions, completed fights | Median timeline slots, completed fights | Turns with walking | Idle Hold turns |
| ---------------------- | ------------------------: | -------------------------------: | --------------------------------------: | -----------------: | --------------: |
| Current rules          |                        0% |                             43.5 |                                      88 |              44.1% |              6% |
| Blocking only          |                      0.1% |                               43 |                                      87 |              44.3% |            6.3% |
| Separate movement only |                     88.1% |                              150 |                                     170 |               0.2% |           79.8% |
| Both changes           |                     88.1% |                              151 |                                     171 |               0.2% |           79.7% |

Walking and idle percentages above include capped fights, so long stalls receive more weight. For completed fights only:

| Rules                  | Turns with walking | Idle Hold turns |
| ---------------------- | -----------------: | --------------: |
| Current rules          |              44.1% |            6.0% |
| Blocking only          |              44.6% |            5.6% |
| Separate movement only |               0.6% |           60.0% |
| Both changes           |               0.6% |           60.3% |

Opening damage and starting tie priority:

| Rules                  | Median first damage slot | Starting-priority side wins, completed fights |
| ---------------------- | -----------------------: | --------------------------------------------: |
| Current rules          |                        8 |                                         43.3% |
| Blocking only          |                        8 |                                         43.4% |
| Separate movement only |                       20 |                                         47.9% |
| Both changes           |                       20 |                                         47.1% |

Hero survival at completion or the action cutoff (per starting unit):

| Rules                  | Grappler | Horse Archer | Storm Caller |
| ---------------------- | ------------: | ----------------: | -----------: |
| Current rules          |           40% |             33.1% |        48.1% |
| Blocking only          |           39% |             33.5% |        47.8% |
| Separate movement only |         65.5% |             17.3% |        90.3% |
| Both changes           |         65.7% |             17.6% |        90.3% |

## Interpretation

**Blocking alone has little effect on aggregate pacing on this map.** This is a reasonable candidate for manual playtesting if stronger formations are desirable. It can still change individual outcomes; similar aggregate results do not mean every battle plays the same.

**Separating movement from abilities is the consequential change.** At quick movement cost, completed-fight median actions rise from 43.5 to 68 (about 56%), and median timeline duration rises from 88 to 129 slots (about 47%). Walking appears on 15.3% of turns instead of 44.1%, and idle Holds rise from 6.0% to 17.6%. Opening damage shifts from median slot 8 to 15. These results support a slower and more stationary game under the current AI.

**The combination does not show an additional pacing penalty at quick cost.** Both variants have the same medians; the combination has 17 unfinished fights versus 24 with separate movement alone. That small gap is not sufficient to claim that blocking improves the game. It does mean the proposed compounded slowdown did not materialize in this experiment.

**The melee Grappler is particularly affected in the quick-cost comparison.** Survival drops from 40.0% to 25.1% with separate movement, while the Storm Caller stays near 50%. This suggests checking the Grappler’s approach tools and engagement opportunities before adopting separate movement. Survival alone does not establish each hero’s contribution or value.

**The typical-cost movement action fails badly with the current AI.** With a base cost of 100, 88.1% of fights remain unfinished at 400 actions, with or without blocking. Walking falls to 0.2% of chosen turns and idle Holds occupy about 80%. This is an AI compatibility failure as well as a warning about the price of movement: the one-turn evaluator charges timeline delay at 10 score per slot but rewards approaching by only 15 per hex. It can prefer repeated Hold over paying for an approach whose payoff comes next turn. These runs do not prove that 88.1% of human games would stall.

**Recommendation:** playtest blocking on its own first. Keep combined movement and abilities as the default unless slower pacing is a deliberate goal. The follow-up cost sweep below supports a cheaper base cost of 20 for faster play; improve the AI’s ability to value an approach before assessing hero balance. The base cost of 100 is unsuitable for the existing AI without further work.

## Follow-up: movement action cost sweep

The follow-up ran 3,200 additional simulations: costs 20, 30, 40, and 50, each on the same 100 random deployment pairs in all four rulesets. Cost 60 below uses the matching first 100 pairs from the original run. Each table entry covers 200 fights. Baseline and blocking controls were identical across costs, and deployment lists were verified identical. These repeated controls and paired fights are not independent observations.

### Separate movement, allies can be passed

| Base move cost | Median chosen actions, completed fights | Median timeline slots, completed fights | Unfinished at 400 actions | Walking turns, all fights | Idle Hold turns, all fights |
| -------------- | --------------------------------------: | --------------------------------------: | ------------------------: | ------------------------: | --------------------------: |
| 20             |                                      61 |                                     100 |                      1.5% |                     41.9% |                        3.1% |
| 30             |                                      63 |                                     110 |                      1.5% |                     35.8% |                        4.2% |
| 40             |                                      62 |                                     114 |                      2.0% |                     30.2% |                       10.6% |
| 50             |                                      62 |                                     116 |                      1.5% |                     15.9% |                       13.8% |
| 60             |                                      67 |                                     129 |                      1.5% |                     15.9% |                       15.8% |

### Separate movement and unit blocking

| Base move cost | Median chosen actions, completed fights | Median timeline slots, completed fights | Unfinished at 400 actions | Walking turns, all fights | Idle Hold turns, all fights |
| -------------- | --------------------------------------: | --------------------------------------: | ------------------------: | ------------------------: | --------------------------: |
| 20             |                                      62 |                                     101 |                      1.5% |                     42.0% |                        3.0% |
| 30             |                                      63 |                                   109.5 |                      2.0% |                     37.3% |                        4.7% |
| 40             |                                      62 |                                     117 |                      1.5% |                     30.0% |                        8.6% |
| 50             |                                      62 |                                     117 |                      0.5% |                     16.8% |                       12.3% |
| 60             |                                      67 |                                     130 |                      1.0% |                     16.2% |                       13.3% |

**Updated recommendation for faster play: start with base 20 plus 10 per hex, keeping the cap at 3 hexes.** This gives move actions total costs of 30, 40, or 50 before speed conversion. A one-hex move costs the same as pure Hold, so approaching does not carry an extra fixed charge over waiting. All moves still take time and a separate turn. This is the fastest tested starting point, not a demonstrated optimum; costs below 20 were not tested.

Without blocking, median timeline duration falls from 129 at base 60 to 100 at base 20 (about 22% shorter). With blocking it falls from 130 to 101. Walking occurs on about 42% of chosen turns at base 20, close to the current combined-action game’s 44.9% on these same deployments. No increase in movement above the baseline share was observed, though this does not rule out human kiting strategies.

Cheaper movement does not eliminate the extra decisions imposed by separate movement. Current rules take median 43 chosen actions and 91 timeline slots on this subset; separate movement at base 20 takes 61 actions and 100 slots. With blocking, the corresponding comparison is 42 actions/89 slots versus 62 actions/101 slots. If the aim is shorter real-world sessions, chosen-action count and human play time matter alongside timeline duration.

Small differences between stall rates (1–4 unfinished fights per 200 here) are too small to rank these costs confidently on stalemate risk. This is an exploratory sweep with the same map, roster, and one-turn AI limitations as the original experiment. This sweep itself did not change live rules; the owner subsequently adopted blocking and separate movement at base 20.

Reproduce a cost-20 run with:

```sh
node scripts/balance/run.mjs --samples 100 --move-cost 20 --out work/balance-cost-20.json
```

## Method and limits

- The existing Salt Flats map and three-hero prototype roster are used, with unchanged stats and ability values. The broad random deployments are legal, but may differ from how humans deploy.
- Each team gets one of each hero. Both teams use the current deterministic capped AI. These results assess pacing and behavior, not composition win rates or overall human balance.
- Each deployment is played with both starting speed-tie priorities. Side labels are swapped only while allocating initial cards, then restored. Each variant reuses the same geometry and teams.
- Ordinary walking cannot pass allies under blocking. Dash and Rampage keep their current traversal rules. Under separate movement, they are still abilities, but cannot combine with ordinary walking.
- A move-only turn is represented as move + Hold. Its base cost is 60 or 100 instead of Hold’s usual 30; pure Hold keeps cost 30. Walking still counts toward ultimate unlock. Other interpretations require another experiment.
- Pathfinding, submitted paths, legal AI options, taunt reach, and the immediate threat model respect the variant. The movement-only action is scored using its chosen cost; pure Hold keeps the production AI’s existing scoring adjustment.
- The production AI searches movement before action. It does not search action-then-move in baseline, plan several turns ahead, or retune its positional weights for the new action economy. Separate-movement outcomes can reflect the AI’s limited planning as well as the rules.
- Both sides receive the same per-turn AI search cap. This differs from the live server’s shared per-request AI budget.
- “Unfinished” means still fighting after 400 chosen actions; it is not proof of an infinite stalemate. Automatic charge triggers do not consume this action count. Completed-fight medians exclude unfinished fights. Walking percentages exclude Dash/Rampage movement.
- First damage includes hazards and friendly fire. Hero survival is measured at completion or the cap, so it is affected by censoring. Per-hero damage/healing in raw JSON includes immediate chosen-action resolution only, not delayed effect or charged-trigger damage.
- Same-roster side win rates cannot establish hero balance. No human experience, narrower map, alternative roster, or gear build is modeled.

## Reproduce

Use revision `094fe0c` for the pre-alpha-beta AI used in these historical results. These results used `RULES.movementCap = 3`. Restore that value and `ABILITY.dash.distance = 2` to reproduce the exact measurements; the current game cap is 4 and Dash distance is 3.

From the repository root:

```sh
node scripts/balance/run.mjs --samples 500 --seed 20261020 --max-turns 400 --move-cost 60 --out work/balance-quick.json
node scripts/balance/run.mjs --samples 500 --seed 20261020 --max-turns 400 --move-cost 100 --out work/balance-typical.json
```

The runner also has a `balance:tactics` package script and `--help`. Full metric definitions are in `scripts/balance/README.md`.

## Verification

- 57 game tests passed, including experiment-specific movement, action validation, cost, and threat-model tests.
- Game and simulator typechecking passed; changed source files passed ESLint; package boundaries passed.
- Repeated smoke runs produced byte-identical JSON, including after final runner cleanup.
- Baseline and blocking results were identical across the two movement-cost runs, and both reused identical deployment lists.
