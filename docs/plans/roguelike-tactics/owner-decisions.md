# Roguelike tactics: open issues and the owner's decisions

What's wrong or unfinished in the built game, and what only the owner can
decide, after Phase 1 was built and merged (2026-10-19). Ordered by what
blocks most. When a decision is made, record it in the topic file it
belongs to, as the README says, and remove it here.

> Part of the roguelike tactics plan. Start at [README.md](README.md).
> What the builder chose in Phase 1 is in
> [phase-1-brief.md](phase-1-brief.md#11-as-built-2026-10-19).

## Issues

### 1. Some fights could never end (eased; watch)

A fight ends only when one side is eliminated. While the Yadachy Storm
Caller had no damaging ability, about 1 in 20 AI-vs-AI fights from random
deployments went on forever: one side called hail, the other healed it
off. Hail now deals base damage 50 (owner, 2026-10-19), 39 a hit on a
Yadachy, and none of 1,000 such fights stalled (58 before). Sunlight's
heal (the ability was Clear the Storm until 2026-10-19) then went from
37 to 60 (owner, 2026-10-19), because it felt weak: over 1,000 fights
from random deployments, none stalled (17 at 37), and fights got
shorter; at 90 healed, 3% stalled again. Nothing guarantees an end yet;
one of the options below would.

**Today:** nothing on the page ends it: the **Abandon run** button was
removed (owner, 2026-10-19). Only `POST /runs/:id/abandon` does (a
defeat, D3), so a stalled fight leaves the player stuck until one of the
options below is built.

**Options:**
- **A fight limit:** the fight ends when the track reaches a set slot;
  decide who wins then (most health left, or a defeat for the player).
- **A surrender rule:** a side that can't damage the other concedes, or
  the player may claim the win when no enemy can damage them.
- **Stronger finishers:** Sunlight heals less, or the Champion
  and Outrider deal more (numbers, section 2 below).

### 2. Hero numbers are placeholders (decision: section 2)

Every stat and ability value marked TBD in the brief's section 4 has a
guess in `packages/games/silk-road-tactics/src/rules/config.ts`, so the
fight can be played. Balance means nothing until the real numbers are in.

### 3. CPU per request: capped (watch)

The enemy AI runs inside the request. Its search is now capped (owner's
call, 2026-10-19): one AI turn simulates at most 130 options and all the
AI turns in one request share 260, each getting at least 40 (`AI` in
`config.ts`; 150 and 300 until the lookahead, 2026-10-20). Over about
3,800 AI-vs-AI requests before the lookahead: median 1.3 ms, 99th
percentile 5.7 ms, worst 10.0 ms, none over the Free plan's 10 ms
([architecture.md](architecture.md#long-lived-storage-and-cost)); fight
results were the same as uncapped. The lookahead (threat.ts, 2026-10-20)
adds about 0.3 ms per AI turn, which the lower caps offset: on a slower
test machine, three runs of ~4,500 to 6,700 requests each, before → after,
median 1.6 → 1.55 ms, 99th percentile 7.5–7.7 → 7.3–7.6 ms, over 10 ms
0.07–0.16% → 0.10–0.15% (that machine already put the old AI over 10 ms
now and then). More heroes, bigger maps or more
abilities will need the cap revisited, or Workers Paid ($5/month). Watch
for errors `1102` or `exceededCpu` in the dashboard.

### 4. `pnpm lint` fails across the repository (cleanup, no decision)

A `no-restricted-imports` rule rejects the relative imports every package
uses; CI doesn't run lint. Fixing the rule (or the imports) is mechanical;
it only needs doing.

## Decisions needed

### 1. How a stalled fight ends

See issue 1. Hail's damage ended the stalls seen in testing; a guaranteed
end (a fight limit, a lower heal) is still yours to decide. Hail now
deals damage but isn't charged, against rule 30 (arcing attacks are
charged): keep it uncharged, or make it charged?

### 2. The prototype heroes' numbers

Replace the placeholders in `config.ts` (brief section 4). Current guesses:

| Hero | Health | Speed | Defence | Power | Armour |
|---|---|---|---|---|---|
| Bökh Champion | 540 | 4 | 10 | 10 | medium (+8 defence, −1 speed) |
| Mangudai Outrider | **360 (owner, 2026-10-20; was 300)** | 7 | 5 | 40 | light (+3 defence) |
| Yadachy Storm Caller | **360 (owner, 2026-10-20; was 420)** | 4 | 10 | 25 | medium |

| Ability | Placeholder values |
|---|---|
| Composite Bow | range 5, **damage 120 (owner, 2026-10-19: 2 hits kill a Mangudai, 4 a Yadachy)** |
| Dash | **up to 3 hexes (owner, 2026-10-20; restored from 2 with separate movement)**, quick (60) |
| Volley (ultimate) | range 5, radius 1, **damage 135 (owner, 2026-10-19)**, charge 40, recovery 100 |
| Sunlight | radius 1 (was 2 until it reached enemies, 2026-10-19), **heal 40, 60 at its power (owner, 2026-10-19; was 25)** |
| Hail | range 4, **damage 50 (owner, 2026-10-19)**, lasts 20 slots, Slowed 2, Vulnerable 25% for 10 slots |
| Fog (replaced Gale, owner, 2026-10-20) | range 4, radius 1, 20 slots; ranged hits into or out of it deal 50% less |
| Freeze (ultimate) | range 4, radius 1, Immobilized and Vulnerable 25% for 15 slots, charge 40, recovery 100 |
| Throw | damage 80 |
| Pin | 12 slots, Vulnerable 25%; **the target is Taunted (Hold allowed, 2026-10-20), and Crushed for base 6 a slot through defence (owner; 8 until 2026-10-20)**; **the pin breaks, clearing every status it gave either unit, if the target is cleansed or knocked away from the Champion; cleansing the Champion doesn't break it or free it (owner, 2026-10-20)** |
| Rampage (ultimate) | 3 hexes, damage 100, Displace 1, slow (150) |

Damage is scaled by power: `base × (1 + power / 50)`.

### 3. Rampage details (brief section 10)

Allies in the path take the damage like anyone (the 2026-10-19 rule,
[map.md](map.md), 6.7), which makes Rampage mainly an opening move once
the front lines meet. Built as proposed: a unit that couldn't be displaced, or was pushed ahead, is passed through;
if the last hex is taken, the Champion stops on the last free hex it
passed. Confirm or change.

### 4. The builder's choices in Phase 1

Each is in [phase-1-brief.md](phase-1-brief.md#11-as-built-2026-10-19);
confirm or change:

- **The AI's additions:** a pull toward the nearest enemy, and counting
  the quicksand it will take before its next turn. Without the pull, units with
  nothing in reach hold forever. Since 2026-10-20, a one-step **lookahead**:
  the damage the enemies acting within its next turn could deal it where
  it ends, weighed by the share of its health and by a per-hero caution
  (0 for the Bökh Champion, a tank). Without it the AI walked into an
  archer's reach, and on speed ties the side that moved first lost 60–67%
  of AI-vs-AI fights; with it, 49–51%.
- **Movement is a separate action, 20 + 10 per hex, capped at 4**
  (owner, 2026-10-20). Allies and enemies block ordinary walking. An
  ability cannot share the turn with walking; the page replaces one
  selection with the other. Dash and Rampage retain their traversal rules.
- **The enemy's starting layout** is one of three, picked by the run's
  seed.

### 5. Before Phase 2 (not blocking now)

- **Taunt on allies:** under the 2026-10-19 rule every ability reaches
  allies, so a Taunt that catches an ally forces it to attack the taunter,
  your own tank. Pin taunts (2026-10-19) and can target an ally, so this
  happens now (the preview shows it): accept it, or rule it out
  explicitly.
- **The exemption keyword:** its name, and how often gear and upgrades
  offer it (open question 31). Too common and it becomes a must-pick.

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
