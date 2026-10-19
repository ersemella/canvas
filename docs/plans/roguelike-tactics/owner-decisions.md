# Roguelike tactics: open issues and the owner's decisions

What's wrong or unfinished in the built game, and what only the owner can
decide, after Phase 1 was built and merged (2026-10-19). Ordered by what
blocks most. When a decision is made, record it in the topic file it
belongs to, as the README says, and remove it here.

> Part of the roguelike tactics plan. Start at [README.md](README.md).
> What the builder chose in Phase 1 is in
> [phase-1-brief.md](phase-1-brief.md#11-as-built-2026-10-19).

## Issues

### 1. Some fights can never end (needs a decision)

A fight ends only when one side is eliminated. The Yadachy Storm Caller
has no damaging ability, so once the side that could still win can't
out-damage the healing (typically a Storm Caller, alone or beside a
Champion, against a Storm Caller), turns go on forever: one side calls
hail, the other clears the storm. In AI-vs-AI fights from random
deployments, about 1 in 20 stalled this way. A player can hit it too.

**Today:** the page's **Abandon run** button ends it as a defeat (D3).

**Options:**
- **A fight limit:** the fight ends when the track reaches a set slot;
  decide who wins then (most health left, or a defeat for the player).
- **Damage for the Storm Caller:** a little base damage on Gale or hail.
- **A surrender rule:** a side that can't damage the other concedes, or
  the player may claim the win when no enemy can damage them.
- **Stronger finishers:** Clear the Storm heals less, or the Champion
  and Outrider deal more (numbers, section 2 below).

### 2. Hero numbers are placeholders (decision: section 2)

Every stat and ability value marked TBD in the brief's section 4 has a
guess in `packages/games/silk-road-tactics/src/rules/config.ts`, so the
fight can be played. Balance means nothing until the real numbers are in.

### 3. CPU per request: capped (watch)

The enemy AI runs inside the request. Its search is now capped (owner's
call, 2026-10-19): one AI turn simulates at most 150 options and all the
AI turns in one request share 300, each getting at least 40 (`AI` in
`config.ts`). Over about 3,800 AI-vs-AI requests: median 1.3 ms, 99th
percentile 5.7 ms, worst 10.0 ms, none over the Free plan's 10 ms
([architecture.md](architecture.md#long-lived-storage-and-cost)); fight
results were the same as uncapped. More heroes, bigger maps or more
abilities will need the cap revisited, or Workers Paid ($5/month). Watch
for errors `1102` or `exceededCpu` in the dashboard.

### 4. `pnpm lint` fails across the repository (cleanup, no decision)

A `no-restricted-imports` rule rejects the relative imports every package
uses; CI doesn't run lint. Fixing the rule (or the imports) is mechanical;
it only needs doing.

## Decisions needed

### 1. How a stalled fight ends

See issue 1. Blocks a fair fight against the AI, not the build.

### 2. The prototype heroes' numbers

Replace the placeholders in `config.ts` (brief section 4). Current guesses:

| Hero | Health | Speed | Defence | Power | Armour |
|---|---|---|---|---|---|
| Bökh Champion | 540 | 4 | 10 | 10 | medium (+8 defence, −1 speed) |
| Mangudai Outrider | 300 | 7 | 5 | 40 | light (+3 defence) |
| Yadachy Storm Caller | 420 | 4 | 10 | 25 | medium |

| Ability | Placeholder values |
|---|---|
| Composite Bow | range 5, damage 80 |
| Dash | 3 hexes, quick (60) |
| Volley (ultimate) | range 5, radius 1, damage 90, charge 40, recovery 100 |
| Clear the Storm | radius 2, heal 25 |
| Hail | range 4, lasts 20 slots, Slowed 2, Vulnerable 25% for 10 slots |
| Gale | Displace 1, Slowed 1 for 10 slots, no damage |
| Freeze (ultimate) | range 4, radius 1, Immobilized and Vulnerable 25% for 15 slots, charge 40, recovery 100 |
| Throw | damage 80 |
| Pin | 12 slots, Vulnerable 25% |
| Rampage (ultimate) | 3 hexes, damage 100, Displace 1, slow (150) |

Damage is scaled by power: `base × (1 + power / 50)`.

### 3. Rampage details (brief section 10)

Built as proposed: allies in the path are displaced but take no damage; a
unit that couldn't be displaced, or was pushed ahead, is passed through;
if the last hex is taken, the Champion stops on the last free hex it
passed. Confirm or change.

### 4. The builder's choices in Phase 1

Each is in [phase-1-brief.md](phase-1-brief.md#11-as-built-2026-10-19);
confirm or change:

- **Gale displaces an Immobilized target**, following the 2026-10-19
  rule; the brief's section 4 still says "slowed but not moved" and
  should be corrected whichever way you decide.
- **Dash goes exactly 3 hexes** (not "up to 3").
- **Pin targets enemies only; Throw and Gale any adjacent unit,** allies
  included (so you can throw an ally out of danger).
- **The AI's additions:** a pull toward the nearest enemy, and counting
  the quicksand it will take next turn. Without the pull, units with
  nothing in reach hold forever.
- **The page plans move-then-act only;** the server accepts act-then-move.
- **The enemy's starting layout** is one of three, picked by the run's
  seed.

### 5. Before Phase 2 (not blocking now)

- **The route map:** node types and layout, the Phase 2 design work
  ([phases.md](phases.md#phase-2-a-run-on-the-route-map)).
- **More heroes and enemy bands** for Phase 2, and their numbers.
- **Push and pull limits** (open question 5), needed when the Jinn Binder
  arrives.

### 6. Art (not blocking)

From [art-direction.md](art-direction.md#open-questions): the internal
resolution and scale (300×200 at 2× proposed), the palette and team rim
colours, pixel font or full-resolution text, and who makes the art. The
engine already supports sprites and scaled pixel-art rendering.

### 7. Platform clean-up (permanent, so yours)

The retired `ManifestRegistry` Durable Object is still deployed. Removing
it is a `deleted_classes` migration, which is permanent and blocks rolling
back past that deploy ([engine-platform-split.md](../engine-platform-split.md)).
