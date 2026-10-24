# Roguelike tactics: open issues and the owner's decisions

What's wrong or unfinished in the built game, and what only the owner can
decide, after Phase 1 was built and merged (2026-10-19). Ordered by what
blocks most. When a decision is made, record it in the topic file it
belongs to, as the README says, and remove it here.

> Part of the roguelike tactics plan. Start at [README.md](README.md).
> What the builder chose in Phase 1 is in
> [phase-1-brief.md](phase-1-brief.md#11-as-built-2026-10-19).

## Issues

### 1. Some fights could never end (decided; built 2026-10-21)

A fight ends only when one side is eliminated, and nothing guarantees
that: a heal can undo damage forever. Tuning brought stalls to a few
percent of AI-vs-AI fights, not zero ([balance.md](balance.md)), and
nothing on the page ends one: the **Abandon run** button was removed
(owner, 2026-10-19), and only `POST /runs/:id/abandon` does (a defeat,
D3).

**Decided (owner, 2026-10-21): the caravan's camel**
([camel.md](camel.md)). Every fight has a camel, a unit on the board and
the track that the player moves one hex a turn but that can't attack.
Reaching one of four exit hexes on the enemy's edge wins the fight, as
defeating every enemy still does; the camel's death is game over. The
player can always end a fight by walking it out. A fight limit, a
surrender rule and weaker heals were the other options
([history.md](history.md)). Built in the fight on 2026-10-21: over 200
AI-vs-AI fights none went unfinished ([camel.md](camel.md), 18.6).

### 2. Hero numbers (set by the owner, 2026-10-23)

The three prototype heroes' stats and kits are the owner's (2026-10-23;
[roster.md](roster.md), [heroes-and-gear.md](heroes-and-gear.md), 9.1).
The wolf's and the camel's numbers are still the builder's placeholders
(decision 1 below).

### 3. CPU per request: capped (watch)

The enemy AI runs inside the request, one AI turn a request since
2026-10-24 (`POST /runs/:id/continue`). It uses selective alpha-beta
lookahead (2026-10-20): four candidates, two decisions including the root,
then three if work remains; 220 work units per AI turn (owner,
2026-10-24; 110 a turn and 220 shared per request before), with Hold
when exhausted. Automatic turns (the camel's, skipped
ones) use the real timeline. See [ai-search.md](ai-search.md) for the algorithm,
regressions and local whole-request comparison (p99 elapsed 6.24 →
5.36 ms; p99 process CPU 9.13 → 9.08 ms). This is local calibration, not a
hard production CPU guarantee; continue watching 1102/`exceededCpu`.

Before this search, the cap was set by the owner's
call (2026-10-19): one AI turn simulated at most 130 options and all the
AI turns in one request shared 260, each getting at least 40 (`AI` in
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

### 1. The rework of 2026-10-23: what the builder chose

The owner's notes were rough; where they left a choice, the builder
picked the reading below. Confirm or change each:

- **Placement** (owner, 2026-10-23, replacing Temee's rounds): every
  action costs 60 ÷ (speed + 5) slots, rounded, Temee's included
  (owner, 2026-10-23, replacing 12 − 2 × speed so speed can scale to 10): speed 0, so 12
  slots a turn, whether it stepped or waited (owner, 2026-10-23).
- **Starting order** (owner, 2026-10-23): from slot 0, fastest first, ties
  the player's first, equal speeds side by side, a free slot between
  speeds; Temee last at slot 12. The builder puts Temee just after the
  other cards should they ever reach slot 12 (no fight has enough units).
- **Collisions** (owner, 2026-10-23): the faster card keeps the slot. The
  builder keeps the old rule for equal speeds (the arriving card yields)
  and lets a moved-on card collide again by the same rule.
- **Hail Immobilizes a unit standing in its space when it lands**, as well
  as one that enters it, and **any unit**, allies and the Storm Caller
  included. A walk that enters it ends there. It disappears when the
  Storm Caller's next turn starts, or when the Storm Caller falls.
- **Immobilized still lets others displace the unit** (the 2026-10-19
  rule kept), and **Stunned has no lockout guard** (keywords.md, open
  questions 54 and 56).
- **Grapple is melee** (owner, 2026-10-23; it reached 2 spaces,
  stepping in next to the target first).
- **Grapple squeezes, and the Champion may walk while grappling**
  (owner, 2026-10-23): at the start of each of the Champion's turns
  while the grapple lasts, its target takes 1; a walk ends the grapple
  only if it ends away from the target, not partway;
  Grapple isn't offered on the unit already grappled; the board shows a
  chain between the two while the grapple lasts.
- **Throw Moves the target to a free space next to the Champion**, and
  the grapple holds (owner, 2026-10-23; the builder's first reading was a
  space next to the target, which could end the grapple); the damage
  comes after the Move.
- **A Stunned Outrider loses its drawn arrow** (owner, 2026-10-24): a
  grapple (or any Stun) landing between Skirmish and the arrow flying
  cancels the shot; the card comes back as an ordinary turn, skipped
  while Stunned. Damage alone doesn't cancel it, nor Immobilized.
- **"Bökh takes damage" means any damage to its health.** Hail does
  count since the Storm Caller's power became 1 (owner, 2026-10-23).
- **The Bökh Champion lost Inevitable**, which the notes left out and
  nothing would use (nothing Delays any more).
- **Placeholders:** the wolf at speed 2, defence 1 (health 4), power 1;
  Temee at defence 9 (health 20; "very high health"). The AI's weights
  were rescaled to the new health scale (`AI` in `config.ts`: a kill
  worth 4, a space from the enemy 0.2, a space of the camel's road 0.75;
  Temee's health 2 a point, and the enemy closes in on Temee once no
  hero is in its reach, since
  2026-10-23, [ai-search.md](ai-search.md)).
- **Deleted:** every parked ability and the Modao Vanguard's kit, with
  their code (owner, 2026-10-23); the Modao Vanguard stays in the roster
  as a hero to rebuild.

### 2. What the first measurements show (2026-10-23)

Over 200 AI-vs-AI fights each ([balance.md](balance.md#the-2026-10-23-rework)):

- **Grapple decides fights.** A side without it wins 6%: the Stunned
  target loses every turn while the grapple lasts, and Grapple is used on
  69% of the Champion's turns. Options: a lockout guard on Stunned
  (keywords.md, open question 56), a duration, or letting the target's
  allies break it more easily.
- **Throw is almost never used** (3% of the Champion's turns; a side
  without it wins exactly as often): it trades a held Stun for 1 damage
  and a space. Options: Throw keeps hold wherever it lands, deals more,
  or does something a Stun can't.
- **Hail is worth its turn** (a side without it wins 34%), at power 0.
  **Decided (owner, 2026-10-23): the Storm Caller's power is 1**, so
  Hail deals 1 and can break a grapple
  ([balance.md](balance.md#hail-deals-1-2026-10-23)).
- **Stages:** a full party beats one enemy hero and two wolves 87–99% of
  the time, two heroes and a wolf 39–97% (two Champions are the hardest,
  39%), and all three 73%.

### 3. The builder's choices in Phase 1

Each is in [phase-1-brief.md](phase-1-brief.md#11-as-built-2026-10-19);
confirm or change:

- **The AI's additions:** a pull toward the nearest enemy. Without the pull, units with
  nothing in reach hold forever. Since 2026-10-20, a one-step **lookahead**:
  the damage the enemies acting within its next turn could deal it where
  it ends, weighed by the share of its health and by a per-hero caution
  (0 for the Bökh Champion, a tank). Without it the AI walked into an
  archer's reach, and on speed ties the side that moved first lost 60–67%
  of AI-vs-AI fights; with it, 49–51%.
- **Movement is a separate action, capped at 3** (owner, 2026-10-20 and
  2026-10-22). Allies and enemies block ordinary walking. An ability
  cannot share the turn with walking; the page replaces one selection
  with the other.
- **The enemy's starting layout** is one of three, picked by the run's
  seed.

### 4. Before Phase 2 (not blocking now)

- **Taunt on allies:** under the 2026-10-19 rule every ability reaches
  allies, so a Taunt that catches an ally forces it to attack the taunter,
  your own tank. Grapple taunts (2026-10-19) and can target an ally, so this
  happens now (the preview shows it): accept it, or rule it out
  explicitly.
- **The exemption keyword:** its name, and how often gear and upgrades
  offer it (open question 31). Too common and it becomes a must-pick.

- **The route map:** node types and layout, the Phase 2 design work
  ([phases.md](phases.md#phase-2-a-run-on-the-route-map)).
- **More heroes and enemy bands** for Phase 2, and their numbers.
- **Push and pull limits** (open question 5), needed when the Jinn Binder
  arrives.

### 5. Art (not blocking)

From [art-direction.md](art-direction.md#open-questions): the internal
resolution and scale (300×200 at 2× proposed), the palette and team rim
colours, pixel font or full-resolution text, and who makes the art. The
engine already supports sprites and scaled pixel-art rendering.

### 6. Platform clean-up (permanent, so yours)

The retired `ManifestRegistry` Durable Object is still deployed. Removing
it is a `deleted_classes` migration, which is permanent and blocks rolling
back past that deploy ([engine-platform-split.md](../engine-platform-split.md)).
