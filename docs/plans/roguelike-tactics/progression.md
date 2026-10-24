# Roguelike tactics: run progression

How a run is laid out in regions and stages, how the party grows
(provisions and upgrades), what the enemy fields at each stage, and the
final boss. Decided by the owner on 2026-10-24; not built yet.

> Part of the roguelike tactics plan. Start at [README.md](README.md),
> which maps every combat-design section number ("section 3.4") to its
> file and indexes every decision. Abandoned approaches are in
> [history.md](history.md).

Rules are marked **Decided** or **Proposed**; numbers marked TBD are
tuning. Section numbers are the combat design's.

## 19. Run Progression

### 19.1 Regions and Stages (Decided, owner 2026-10-24)
- A run passes through the **six regions** in their fixed order
  ([setting.md](setting.md), 15.3a). Each region has **3 stages**, except
  the last, the Byzantine, which has **4**: **19 stages** in a run.
- Every stage is a fight. Stage numbers count across regions (1 to 19), as
  the glossary's **stage** already does.
- **The rhythm of a region:** stages 1 and 2 each award provisions
  (19.2); stage 3 is the region's high point, the hardest fight (19.5),
  where the region's provisions are reassigned and then locked and an
  upgrade is offered (19.3). The Byzantine's stage 4 is the final boss
  (19.6).
- Whether other route map nodes (caravanserais, bazaars, recruitment) sit
  between stages is unchanged by this: Phase 2's route map design
  ([phases.md](phases.md#phase-2-a-run-on-the-route-map)).

### 19.2 Provisions (Decided, owner 2026-10-24; name is a working name)
**Provisions** are stat points the party earns and assigns to its heroes.
Each one adds 1 to one hero's speed, defence or power (9.1).

- **Earned:** 1 at the end of stage 1 and 1 at the end of stage 2 of each
  region, so **2 per region, 12 in a run**, plus any taken from the
  wildcard slot (19.3).
- **Assigned when earned**, to any hero in the party and any stat.
- **Reassigned at stage 3, then locked:** at a region's third stage, the
  provisions earned **in that region** can be moved freely between heroes
  and stats. After that they are locked for the rest of the run. Earlier
  regions' provisions never move again.
- Rationale: each region's provisions are a small decision as they arrive
  and a bigger one at stage 3, where the party commits to a build before
  its hardest fight. Locking keeps the build a series of commitments, not
  a sheet re-tuned before every fight, and keeps the reassignment to two
  points rather than the whole run's.
- **What this changes:** until 2026-10-24 heroes had no stat growth
  outside gear (10.9). Provisions are deliberate, small stat growth: on the
  0-to-3 scale, about +4 per hero over a run with three heroes, so
  per-hero caps may be needed (question 61).

### 19.3 The Upgrade Offer (Decided, owner 2026-10-24)
At each region's third stage the party is offered **3 upgrades and picks
1**: 6 offers in a run. The offer is built from fixed slots, not drawn at
random from one pool:

| Slot | Contents |
|---|---|
| **Hero** | An upgrade for one hero in the party: a **new ability**, or a change to an existing ability that is **more than a stat increase** (its shape, its range, an added keyword, a new rule). |
| **Passive** | A **hero-agnostic passive**: a rule, not a stat increase, that works on whichever hero carries it, and can be moved to another hero. |
| **Wildcard** | Either another upgrade (hero or passive) or provisions. |

- **This replaces milestone upgrades** (10.9): offers come per region, not
  per hero's milestones, and the hero slot may add a new ability, not
  only adjust one.
- **A new ability is held to a second ability's worth** (owner,
  2026-10-24): a side without it wins 40–50% ([balance.md](balance.md),
  principle 2). Skirmish (44%) and Sunlight (48.8%) both fit, so either
  can be a hero upgrade rather than start in the kit.
- Rationale: a fixed slot per kind means every offer has something for
  the build's identity (hero), something flexible (passive) and a
  swing pick (wildcard), and is never three upgrades for a hero the
  player doesn't care about.
- **Proposed:** the hero slot favours heroes with the fewest upgrades so
  far, so no hero goes the whole run without one.

### 19.4 Recruits and Death (Proposed)
Follows the death spiral rule (10.6): a hero who dies takes their
provisions, hero upgrades and passives with them; a recruit joins with
none and grows from the next provisions and offers. Whether a dead hero's
passive is lost or returns to the party is question 63.

### 19.5 What the Enemy Fields (Decided, owner 2026-10-24)

| Stage of a region | Enemy |
|---|---|
| 1 | 2 wolves and 1 hero |
| 2 | 1 wolf and 2 heroes |
| 3 | 3 heroes |
| 4 (Byzantine only) | The final boss (19.6) |

- **Wolves** may be reskinned per region (the setting's creatures, 15.7)
  and get a **small stat increase each region**. Their numbers per region
  are TBD.
- **Enemy heroes** are built from the player's own systems (11.1): random
  hero upgrades and stat increases, up to **10 stat points and 4 upgrades**
  at most. The player's party can end a run with 12 provisions and 6
  upgrades, so the strongest enemy heroes stay a step behind it. How the
  enemy's budget grows region by region is question 62.
- Difficulty therefore rises two ways: within a region, as wolves give
  way to heroes; across regions, as wolves' stats and enemy heroes'
  upgrades and stats grow.
- **Not built yet:** the game today runs four stages: 3 wolves; 1 hero and
  2 wolves; 2 heroes and 1 wolf; 3 heroes (`STAGES` in
  `src/rules/config.ts`).

### 19.6 The Final Boss (Decided, owner 2026-10-24)
The Byzantine's stage 4, the run's last fight, is a boss that **counters
the build the player made**: its traits are chosen against the party's
heroes, provisions, upgrades and passives. As with every boss (11.1), each
counter should bend an existing rule rather than add a system, and stay
readable through the track, the map and previews.

**Proposed** examples of counters, by what the build leans on:

| Build leans on | Boss counter |
|---|---|
| Defence (high health) | Pierce, or damage that grows with the fight's length |
| Speed (many turns) | Delay, or a Tempo tax aura (11.3) |
| Power (burst) | Shield, or Armour |
| One carry hero | Attacks aimed at that hero, or Stunned |
| A keyword family (Push, Immobilized) | Unstoppable, or immunity to it |

Since information is complete (D11), the boss's counters are shown before
the fight, so the last decision of the run is how to beat a known answer
to your build.

### 19.7 The Shape of a Run

| After region | Provisions | Upgrades | Enemy at its stage 3 |
|---|---|---|---|
| 1 Steppe | 2 | 1 | 3 heroes, lightly built |
| 2 China | 4 | 2 | |
| 3 India | 6 | 3 | |
| 4 Persia | 8 | 4 | |
| 5 Arabia | 10 | 5 | |
| 6 Byzantine (before stage 4) | 12 | 6 | up to 10 points, 4 upgrades each; then the boss |

Counts assume every wildcard is taken as an upgrade.

## Decision log

| Area | Decision | Alternatives considered | Reason |
|---|---|---|---|
| Run length (2026-10-24, owner) | 6 regions of 3 stages, the last of 4: 19 fights | Several levels per region, TBD (15.3a); 3 to 4 stages per region | A fixed rhythm per region: build up, commit, the hard fight |
| Stat growth (2026-10-24, owner) | Provisions: 2 per region, assigned when earned, reassignable at stage 3 within the region, then locked | No stat growth outside gear (10.9); 1 point per stage, swappable every stage; swappable only between regions | Small, steady growth with one commitment per region |
| Upgrades (2026-10-24, owner) | One offer of 3 per region, pick 1, from slots: hero, passive, wildcard | Milestone upgrades per hero (10.9); picking 1 or 2 of 3 random upgrades | Every offer useful; a real choice each time |
| Enemy line-up (2026-10-24, owner) | Per region: 2 wolves and a hero, a wolf and 2 heroes, 3 heroes; wolves grow per region; enemy heroes up to 10 points and 4 upgrades | Four fixed stages for a whole run (built 2026-10-24) | Difficulty rises within each region and across the run |
| Final boss (2026-10-24, owner) | Counters the player's build | A fixed boss | The run ends on a test of the build the player made |

## Open questions

59. The provisions' final name (working name: provisions; others: favour,
    tribute, silk).
60. Whether stage 3's reassignment and upgrade offer come before its fight
    (the build is set for the hardest fight; read so here) or after it.
61. Per-hero, per-stat caps on provisions, and how many provisions the
    wildcard gives (1 assumed).
62. How enemy heroes' 10 points and 4 upgrades ramp across regions, and
    the wolves' increase per region.
63. Passives: when they can be moved between heroes (at stage 3, as
    provisions?), whether a dead hero's passive is lost, and how they
    relate to gear's transferable modifiers (9.7): alongside gear, or in
    place of it.
64. How the final boss reads the build: which counters exist, how many it
    takes, and whether it is one unit or a unit with support.
