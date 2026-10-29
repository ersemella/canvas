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

### 19.1 Regions and Stages (Decided, owner 2026-10-24; four regions since 2026-10-26)
- A run passes through the **four regions** in their fixed order
  ([setting.md](setting.md), 15.3a): Steppe, China, Persia, Byzantine.
  With six regions, each had **3 stages**, except the last, the
  Byzantine, which had **4**: 19 stages in a run. How many stages each of
  the four has is open (question 66): kept at 3 (the Byzantine 4), a run
  is 13 stages.
- **Four stages a region (owner, 2026-10-28; built):** stages 1, 2 and 3
  each award a provision; stage 4 is the region's **boss** (enemies.md),
  and winning it offers the upgrade (built: the passive offer, three of the
  pool at random, one taken), except after the run's last. The Steppe's
  boss is the Cyclops with two wolves, in its cave (enemies.md, 11.3a;
  each boss fight on a map of its own, owner, 2026-10-28); China's the
  Bull Demon King and Princess Iron Fan in the Flaming Mountains
  (11.3b, owner, 2026-10-28); Persia's Zahhak and his two serpents in
  his palace (11.3c, 2026-10-29). The rhythm below, of three stages, is superseded.
- Every stage is a fight. Stage numbers count across regions, as
  the glossary's **stage** already does.
- **The rhythm of a region:** stages 1 and 2 each award provisions
  (19.2); stage 3 is the region's high point, the hardest fight (19.5),
  after which the region's provisions are reassigned and then locked and an
  upgrade is offered (19.3), setting the build for the next region. The Byzantine's stage 4 is the final boss
  (19.6).
- Whether other route map nodes (caravanserais, bazaars, recruitment) sit
  between stages is unchanged by this: Phase 2's route map design
  ([phases.md](phases.md#phase-2-a-run-on-the-route-map)).

### 19.2 Provisions (Decided, owner 2026-10-24)
**Provisions** are stat points the party earns and assigns to its heroes.
Each one adds 1 to one hero's speed, defence or power (9.1).

- **Earned:** 1 at the end of stage 1 and 1 at the end of stage 2 of each
  region, so **2 per region** (8 in a run of four regions; 12 with six), plus any taken from the
  wildcard slot (19.3).
- **Assigned when earned**, to any hero in the party and any stat.
- **Reassigned after stage 3, then locked (owner, 2026-10-24):** after
  winning a region's third stage, the provisions earned **in that
  region** can be moved freely between heroes and stats. After that they
  are locked for the rest of the run. Stage 3 itself is fought with them
  where they were assigned when earned. Earlier
  regions' provisions never move again.
- Rationale: each region's provisions are a small decision as they arrive
  and a bigger one after stage 3: having seen the region's hardest fight,
  the party commits to a build for the next region (in the Byzantine, for
  the final boss). Locking keeps the build a series of commitments, not
  a sheet re-tuned before every fight, and keeps the reassignment to two
  points rather than the whole run's.
- **Built (2026-10-25), for the run's three stages:** winning stage 1 or
  2 (`STAGES[stage].provision` in `src/rules/config.ts`) leads, through
  Next stage, to the **caravanserai** screen (`Caravanserai.tsx` in the
  web package), where one surviving hero takes +1 speed, power or defence
  before Set out (`next` with its `provision`; the run keeps them in
  `RunState.provisions`, each unit in `Unit.provisions`), or the provision
  heals Humphrey 4 instead (`RULES.camelHeal`) (`next` with `heal`, owner,
  2026-10-28; [camel.md](camel.md), 18.4). Humphrey taking no damage in
  a stage earns an **extra provision** at any caravanserai (`extra` or
  `extraHeal`, owner, 2026-10-28; camel.md, 18.4). **No stat goes
  above 10** (owner, 2026-10-25; `RULES.statMax`): a stat at 10 can't
  take a provision, and with every stat of every hero standing at 10 there
  is none to take. Nothing happens
  there after stage 3 yet: the reassignment and the upgrade offer (19.3)
  aren't built, and stage 3 is the run's last.
- **What this changes:** until 2026-10-24 heroes had no stat growth
  outside gear (10.9). Provisions are deliberate, small stat growth: on the
  0-to-3 scale, about +4 per hero over a run with three heroes, so
  per-hero caps may be needed (question 61).

### 19.3 The Upgrade Offer (Decided, owner 2026-10-24)
After winning each region's third stage, together with the reassignment
(19.2), the party is offered **3 upgrades and picks 1**: 6 offers in a
run, the last just before the final boss. The offer is built from fixed slots, not drawn at
random from one pool:

| Slot | Contents |
|---|---|
| **Hero** | An upgrade for one hero in the party: a **new ability**, or a change to an existing ability that is **more than a stat increase** (its shape, its range, an added keyword, a new rule). |
| **Passive** | A **hero-agnostic passive**: a rule, not a stat increase, that works on whichever hero carries it, and can be moved to another hero. The proposed pool is in 19.8. |
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
- **Built (2026-10-26): the passive slot alone, between regions.**
  Winning a region's last stage short of the run's last (the Steppe's
  stage 3; `STAGES[stage].passive`) leads, through Next stage, to the
  caravanserai, which offers **3 passives** of the pool (19.8) at random
  (`passiveOffer` in run.ts, from the run's seed and the stage, so a
  reload offers the same three; `PASSIVE_OFFER` in config.ts; a passive
  every hero standing already carries isn't offered). The player picks one
  and the hero standing who carries it (`next` with its `passive`), for
  the rest of the run (`RunState.passives`, each unit's `passives`). The
  hero and wildcard slots, the provisions' reassignment, and moving a
  passive between heroes (question 63) aren't built; a fallen hero's
  passive goes with them.
- **19.3a The passive draft (Decided, owner 2026-10-28; built).** The
  caravanserai between regions offers **4 passives** (`PASSIVE_OFFER`),
  drafted: the player picks one and its carrier; the rival (the enemy
  AI) then takes the one left that best supplements the **first hero of
  the next region** (the first of its heroes in the run's order,
  `draftRivals` in run.ts); the player picks another; and the last goes
  to the rival for the next region's **second hero**. The rival's picks
  follow from the party's (`rivalPicks`). **The heroes ahead stay hidden (owner,
  2026-10-28):** the caravanserai says only that a rival caravan takes a
  passive, never which hero carries it. **The first pick is final (owner,
  2026-10-28):** it is its own action (`draft`), kept in the run
  (`RunState.drafted`) and never undone, and only then does the view show
  the rival's answer (`rivalTook`), so a player can't try picks to learn
  the rival's preferences; `next` carries the second pick (`passive`),
  which can change until the caravan sets out. The rival's picks are kept in
  `RunState.rivalPassives`, and that enemy hero carries its passive in
  every stage it fights for the rest of the run, as an outsider in later
  regions too. How the rival judges "supplements most" is
  `DRAFT_FIT` in passives.ts: per hero, a list of the passives it likes,
  best first, and those that do it no good (last); the builder's first
  reading of each kit, **not yet measured** (the balance runs could rank
  them by win rate). The last passive goes to the second hero whatever it
  is, so a poor fit (Steady Gait on the Duelist) can be forced on it:
  that is the draft's denial play.
- **At most two abilities** besides moving and Hold (owner, 2026-10-25;
  three from 2026-10-24; [roster.md](roster.md)): the hero slot offers a
  new ability only to a hero with fewer than two (`hasRoomForAbility` in
  board.ts); a change to an ability it has is still offered. Whether a hero at two could swap
  one out for a new one is open.

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
| 4 | The region's boss (owner, 2026-10-28; the Steppe's the Cyclops and 2 wolves, in its cave; China's the Bull Demon King and Princess Iron Fan, in the Flaming Mountains; until a region's boss is built, its 3 heroes); the Byzantine's, the final boss (19.6) |

- **Wolves** may be reskinned per region (the setting's creatures, 15.7)
  and get a **small stat increase each region**. Their numbers per region
  are TBD.
- **Reskins (Proposed, 2026-10-24):** each region's basic creature is a
  small, common pest that preys on travellers, never a famous monster; the
  setting's great creatures (15.5) stay for elites and bosses. Each is the
  wolf's unit with that region's stats, so the basic enemy reads the same
  everywhere.

  | Region | Basic creature | Why it fits | Alternative |
  |---|---|---|---|
  | Steppe | **Grey wolf** (built) | The Mongols' mythic ancestor in the *Secret History*; the real threat to steppe herds | — |
  | China | **Fox spirit** (huli jing, one-tailed; built 2026-10-25 as the `fox` unit, the wolf's stats, on the test stage) | A trickster preying on travellers; leaves the nine-tailed fox for a boss | Jiangshi, iconic but from later folklore |
  | Persia | **Lesser div** | The *Shahnameh*'s rank-and-file demons, before the White Div as a boss | Cheetah, the Sasanian royal hunting cat; the ghul, the *Nights*' desert shapeshifter (Arabia's basic creature until the region was cut, 2026-10-26) |
  | Byzantine | **Kallikantzaros** | Greek folk goblins, small and swarming; leaves the griffin and drakos for the endgame | Wild boar, the Byzantine hunting animal |

  Every region also supplies heroes, so no culture supplies only monsters
  (15.7).
- **Enemy heroes** are built from the player's own systems (11.1): random
  hero upgrades and stat increases, up to **10 stat points and 4 upgrades**
  at most. The player's party could end a run of six regions with 12
  provisions and 6 upgrades, so the strongest enemy heroes stayed a step
  behind it; with four regions (8 and 4) the cap needs revisiting
  (question 62). How the
  enemy's budget grows region by region is question 62.
- Difficulty therefore rises two ways: within a region, as wolves give
  way to heroes; across regions, as wolves' stats and enemy heroes'
  upgrades and stats grow.
- **Built (2026-10-26), for two regions:** the game runs the Steppe's
  three stages and China's three (`STAGES` and `REGIONS` in
  `src/rules/config.ts`): each region's first enemy (the Horse Archer
  on the Steppe, the Swordsman in China) and 2 of its creatures
  (wolves, fox spirits); that hero, another and 1 creature; 3 heroes. A
  region's heroes come in one order drawn from the whole roster, so each
  stage brings the last one's and one more. China's stages are on the
  Flaming Mountains. The creatures' stat increase per region and enemy
  heroes' upgrades and stats aren't built: China's fights are the Steppe's
  with other units.
- **Built (2026-10-28), for three regions, no fox spirits:** each region
  has its own three heroes (`REGIONS`): the Steppe's the Outrider,
  the Grappler and the Storm Caller; China's the Duelist, the Vanguard and the Alchemist;
  Persia's the Ranger, the Juggernaut and the Magus. The Steppe
  brings 1 of its heroes and 2 wolves, 2 and 1 wolf, then its 3; China
  brings 1 of its heroes and 2 of the Steppe's, 2 and 1 of the Steppe's,
  then its 3; Persia (on the Salt Flats) 1 of its heroes and 2 of the
  Steppe's or China's, 2 and 1 of them, then its 3 (owner). A region's own
  heroes come in one random order from the run's seed, the first too
  (owner, 2026-10-28; each region's damage hero first before), and
  so do the heroes of the regions before (`outsiders` in `STAGES`), so
  each stage brings the last one's and one more. China's last stage now
  offers a passive; Persia's is the run's last.

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
| 3 Persia | 6 | 3 | |
| 4 Byzantine (before stage 4) | 8 | 4 | the enemy's most built heroes (question 62); then the boss |

Counts assume every wildcard is taken as an upgrade, and the region
rhythm of 19.1 (question 66).

### 19.8 Passives (Proposed, owner 2026-10-24; built 2026-10-25, offered between regions 2026-10-26)
The pool for the offer's passive slot (19.3). Each is a rule that works
on whichever hero carries it ("this hero"), in the keywords' terms
([keywords.md](keywords.md)); every one is public and previewable (D11).
Numbers are TBD tuning; none is measured yet.

**Built (2026-10-25), on no hero:** every passive below works in the
rules (`src/rules/passives.ts`, its effects in resolve.ts, fight.ts and
board.ts; tested in `passives.test.ts`), shown on the stat sheet, and can
be given to any unit on the test stage (`"passives"`, test-stage.md). No
hero starts with one; since 2026-10-26 the caravanserai between regions
offers three, one taken (19.3). Built with them: **Haste** and **Inevitable** (Steady Gait),
**Shield** (Rally), **Armour** and **Pierce** (Hardened, Piercing Eye)
([keywords.md](keywords.md)). The builder's readings, where the text left a
choice:

- **"First" passives** (Second Wind, Hardened, Last Stand, Iron Will) are
  spent once each fight, even when the effect is nothing (a Pierced first
  hit still spends Hardened).
- **A hit** is an ability's damage (and a charged shot's); a grapple's
  squeeze is damage but not a hit, so Hardened, Bulwark, Opportunist and
  Flanker ignore it. Glass Cannon's and Lone Wolf's Empower add to the
  squeeze, as an Empower does (owner, 2026-10-23).
- **Taking damage** means health lost: damage a Shield absorbs whole
  doesn't break a grapple, set off Shake Loose or count for Second Wind.
- **Haste during the hero's own turn** (Momentum, a Second Wind or
  Vengeance from its own Gale or Cleave) is taken off as its card is
  placed at the turn's end. Steady Gait blocks the hero's own Haste too.
  Neither the delay nor the haste limit (17.3) is built.
- **Patient** counts any turn without a move or an ability: Hold, and a
  skipped turn, a Stunned one included.
- **Momentum** counts a kill on the hero's turn (a squeeze at its start
  included), not one by a charged shot landing, which isn't a turn.
- **Light Step's swap** puts the ally on the space the walk came from,
  which must be free (so not an ally walked through); an Horse Archer's
  straight walk passes allies too. The ally is Moved (Rebound triggers).
- **Rebound** triggers only when the hero actually changes space; a
  Grapple's throw and swap Move the held unit. Rebounds can set off
  Rebounds, to a safety depth of 12.
- **Opportunist** compares turns: the target's last turn came before the
  hero's last one (its previous one, during its own turn), or the target
  hasn't had one. A skipped turn is a turn (17.5).
- **Flanker** needs the target in a straight line from the hero; the ally
  is on the next space beyond it along that line.
- **Bulwark** follows each ally's first hit between the Bulwark's turns
  wherever it is; only a hit landing next to the Bulwark is shared, and
  the first such Bulwark (party order) takes the 1. Its 1 isn't a hit.
- **Last Stand's Stun** goes after the one turn it skips; Iron Will turns
  it, Shake Loose doesn't (it is given after the damage).
- **Vengeance's Empower** keeps a stronger one the hero has, and lasts
  until the end of its next turn.
- **Glass Cannon** starts at half health, rounded up.

**Track**

| Passive | Rule |
|---|---|
| **Steady Gait** | Inevitable: this hero's card can't be Delayed or Hastened. |
| **Second Wind** | The first time each fight this hero is at half its health or less, its card is Hastened 2. |
| **Patient** | When this hero ends a turn without moving or using an ability, its card goes 2 fewer slots on. |
| **Momentum** | After a turn in which this hero takes a unit off the board, its card is Hastened 1. |

**Board**

| Passive | Rule |
|---|---|
| **Rooted** | This hero can't be Pushed or Pulled; unlike Unstoppable, it can still be Immobilized and Moved. |
| **Light Step** | This hero walks through allies, and may swap places with an ally at the end of its move. |
| **Rebound** | When this hero is Pushed, Pulled or Moved, by an ally or an enemy, each unit next to its final position, allies included, is Pushed 1 space away from it, one at a time as for any area (17.4). |

**Damage and survival**

| Passive | Rule |
|---|---|
| **Hardened** | Armour 1 against the first hit this hero takes each fight. |
| **Last Stand** | The first time each fight this hero would die, it is left at 1 health instead and is Stunned for its next turn. |
| **Piercing Eye** | This hero's attacks Pierce against a unit that is Immobilized or Stunned. |
| **Opportunist** | This hero's attacks deal 1 more damage (as Empower 1) to a unit that hasn't had a turn since this hero's last turn. |
| **Bulwark** | When an ally next to this hero takes its first hit between this hero's turns, the ally takes 1 less damage and this hero takes that 1. |
| **Glass Cannon** | Empower 1 always, but this hero starts each fight at half its health. |

**Control**

| Passive | Rule |
|---|---|
| **Iron Will** | The first time each fight this hero would be Stunned, it isn't. |
| **Shake Loose** | When this hero takes damage while Stunned, the Stun ends. |

**Position and allies**

| Passive | Rule |
|---|---|
| **Flanker** | This hero's attacks deal 1 more damage when an ally stands on the far side of the target, opposite this hero. |
| **Lone Wolf** | Empower 1 while no ally is within 2 spaces. |
| **Rally** | At the start of this hero's turn, each ally next to it gains Shield 1 until that ally's next turn. |
| **Vengeance** | When an ally dies, this hero's card is Hastened 3 and it gains Empower 1 for its next turn. |

- Rationale: each bends one rule rather than adding a system (17.7), and
  several answer a measured problem: Iron Will and Shake Loose counter
  Grapple, which decides fights ([owner-decisions.md](owner-decisions.md));
  Piercing Eye rewards pairing Hail or Grapple with damage.
- **To watch:** passives that act on the other side's turns (Bulwark,
  Rebound, Iron Will, Shake Loose, Vengeance) can't be ablated by a
  one-sided ban, as with Hold the Line ([balance.md](balance.md));
  Vengeance softens the death spiral (10.6); Glass Cannon and Lone Wolf
  are deliberate risk picks.

### 19.9 Generic Ability Upgrades (Decided, owner 2026-10-29; not built)
Upgrades that change **how a hero's abilities work, whatever they are**:
each keys off a keyword an ability already applies (17.1) or a kind of
ability (an attack, a heal, a ranged attack, a single target), not off a named
ability, so any hero can carry one. They sit between the hero slot's
upgrades, which change one named ability (19.3), and the passives, which
mostly bend rules outside abilities (19.8). Values marked TBD are the
builder's first reading, not the owner's.

**Offered with the passives (owner, 2026-10-29):** the caravanserai at a
region's end draws its offer from the passives and these upgrades
together, **still 4 offerings at a time**, drafted as the passives are
(19.3a): the player's picks and their carriers, the rival's for the next
region's heroes. An upgrade, like a passive, is carried by the hero it
goes to for the rest of the run. Whether either can later move to another
hero is still question 63.

**Track**

| Upgrade | Rule |
|---|---|
| **Wearying** | When this hero's ability Delays an enemy, the enemy is also Weakened 1 (TBD). |
| **Lethargy** | When this hero's ability Weakens an enemy, the enemy is also Delayed 2 (TBD). |
| **Inspire** | When this hero's ability Empowers an ally, the ally is also Hastened 2 (TBD). |
| **Fervour** | When this hero's ability Hastens an ally, the ally is also Empowered 1 (TBD). |

**Board**

| Upgrade | Rule |
|---|---|
| **Forceful** | This hero's attacks Push the target 1. An attack that already Pushes doesn't Push further. |
| **Reel In** | This hero's ranged attacks (a target not next to it) Pull the target 1. |

**Attacks** (owner, 2026-10-29, later)

| Upgrade | Rule |
|---|---|
| **Staggering** | This hero's attacks Delay the target 2 (TBD). |
| **Hamstring** | This hero's attacks Immobilize the target until the end of its next turn (TBD). |
| **Concussive** | This hero's attacks Stun the target for its next turn. |
| **Sundering** | This hero's attacks Pierce. |
| **Crippling** | This hero's attacks Weaken the target 1 (TBD). |

**Control**

| Upgrade | Rule |
|---|---|
| **Lockdown** | When this hero's ability Immobilizes a unit, the unit is also Stunned for its next turn. |
| **Defy Fate** | This hero's attacks Stun an Inevitable target for its next turn. |
| **Immovable Object** | This hero's attacks Delay an Unstoppable target 2 (TBD). |

**Healing** (Invigorate to Ward: owner, 2026-10-29, later)

| Upgrade | Rule |
|---|---|
| **Invigorate** | When this hero's ability heals an ally, the ally is also Empowered 1 (TBD). |
| **Quickening** | When this hero's ability heals an ally, the ally is also Hastened 2 (TBD). |
| **Fortify** | When this hero's ability heals an ally, the ally also gains Armour 1 (TBD) until its next turn. |
| **Ward** | When this hero's ability heals an ally, the ally also gains Shield 1 (TBD) until its next turn. |
| **Mending Strike** | This hero's melee attacks can be used on an ally, healing it this hero's power instead of damaging it. |
| **Mending Shot** | This hero's ranged attacks can be used on an ally, healing it this hero's power instead of damaging it. |

**Targeting**

| Upgrade | Rule |
|---|---|
| **Forked** | This hero's single-target abilities take one extra target, each target meeting the ability's own range and conditions. |

- **Removed (owner, 2026-10-29):** **Exposed** (a Stun also making the
  unit Vulnerable 1), so Vulnerable stays out of the keywords (17.1);
  **Overheal** (healing beyond a unit's missing health becoming Shield);
  and **Martyr** (this hero Weakened 1 whenever its ability targets an
  ally). Each was named on 2026-10-29 and removed the same day.
- **Rules (owner, 2026-10-29):**
  - **An attack** is an ability that damages an enemy. A **ranged
    attack** is an attack on a target not on a space next to the hero.
  - **A heal** is an ability restoring an ally's health (the builder's
    reading): today the Priest's Blessing and the Alchemist's Elixir, and
    any attack under Mending Strike or Shot. A **melee attack** is one on
    a target next to the hero (the reverse of a ranged attack).
  - **Mending Strike and Shot (owner, 2026-10-29):** the heal is the
    hero's power, Empower adding to it and Weaken taking from it (to at
    least 0), and can't take the ally above its full health. The attack's other effects reach the ally too (a Push, a
    Stun). On an area attack, every ally in the area is healed. The heal
    sets off the other Healing upgrades (Invigorate, Quickening, Fortify,
    Ward), as any heal on an ally does.
  - **An upgrade's effect applies only if the original keyword does:**
    Wearying's Weaken needs the Delay to happen, so it does nothing on an
    Inevitable enemy; Fervour's Empower likewise; Forceful does nothing on
    a Rooted or Unstoppable target, and Concussive nothing on an
    Unstoppable one.
  - **One upgrade can set off another:** Hamstring's Immobilize sets off
    Lockdown, Crippling's Weaken Lethargy, Staggering's Delay Wearying.
  - **Each upgrade fires at most once** per use of an ability, so no pair
    (Wearying with Lethargy, Inspire with Fervour) loops.
  - **Forceful with Reel In:** on a ranged attack the Push and the Pull
    cancel, and the target stays in place; a melee attack is still Pushed.
  - **Defy Fate counters Steady Gait**, the passive and the Magus's own
    (the only Inevitable hero), and any Inevitable boss to come. It is
    Concussive narrowed to Inevitable targets, so the two don't stack.
- **To watch:** Concussive, and Hamstring with Lockdown, Stun on every
  attack, the lockout Grapple already shows (17.5, question 56); on an
  area attack, every unit hit. Forked doubles a single-target ability's
  reach. Either may need a cost or a limit once measured (TBD).

## Decision log

| Area | Decision | Alternatives considered | Reason |
|---|---|---|---|
| Run length (2026-10-24, owner) | 6 regions of 3 stages, the last of 4: 19 fights | Several levels per region, TBD (15.3a); 3 to 4 stages per region | A fixed rhythm per region: build up, commit, the hard fight |
| Stat growth (2026-10-24, owner) | Provisions: 2 per region, assigned when earned, reassignable after stage 3's fight within the region, then locked | No stat growth outside gear (10.9); 1 point per stage, swappable every stage; swappable only between regions | Small, steady growth with one commitment per region |
| Upgrades (2026-10-24, owner) | One offer of 3 per region, pick 1, from slots: hero, passive, wildcard | Milestone upgrades per hero (10.9); picking 1 or 2 of 3 random upgrades | Every offer useful; a real choice each time |
| Enemy line-up (2026-10-24, owner) | Per region: 2 wolves and a hero, a wolf and 2 heroes, 3 heroes; wolves grow per region; enemy heroes up to 10 points and 4 upgrades | Four fixed stages for a whole run (built 2026-10-24) | Difficulty rises within each region and across the run |
| Final boss (2026-10-24, owner) | Counters the player's build | A fixed boss | The run ends on a test of the build the player made |
| Generic ability upgrades (2026-10-29, owner) | Twenty-one upgrades keyed off keywords and kinds of ability, any hero, offered with the passives at the caravanserai, 4 offerings at a time (19.9) | Only upgrades to one named ability (10.9, 19.3) | Builds that mix keywords across heroes |

## Open questions

59. ~~The provisions' final name.~~ Answered 2026-10-24 (owner): provisions.
60. ~~Whether stage 3's reassignment and upgrade offer come before its
    fight or after it.~~ Answered 2026-10-24 (owner): after (19.2, 19.3).
61. Per-hero, per-stat caps on provisions, and how many provisions the
    wildcard gives (1 assumed).
62. How enemy heroes' 10 points and 4 upgrades ramp across regions, and
    the wolves' increase per region.
63. Passives: when they can be moved between heroes (after stage 3, as
    provisions?), whether a dead hero's passive is lost, and how they
    relate to gear's transferable modifiers (9.7): alongside gear, or in
    place of it.
64. How the final boss reads the build: which counters exist, how many it
    takes, and whether it is one unit or a unit with support.
65. ~~Rebound (19.8): which enemy is Pushed, and whether an ally's
    displacement (Throw) triggers it.~~ Answered 2026-10-24 (owner): every
    unit next to the hero's final position, allies included, whoever
    displaced the hero.
66. ~~How many stages each of the four regions has~~ Answered 2026-10-28
    (owner): four, the fourth the region's boss (19.1). (2026-10-26; with six,
    3 each and the Byzantine 4). Keeping 3 makes a run of 13 stages, 8
    provisions and 4 upgrades; longer regions keep the run's length but
    need a new rhythm for provisions and the high point (19.1).
67. ~~Which slot offers the generic ability upgrades (19.9).~~ Answered
    2026-10-29 (owner): the caravanserai at a region's end, with the
    passives, 4 offerings at a time.
68. ~~Martyr's payoff, and how many targets Forked adds.~~ Answered
    2026-10-29 (owner): Martyr removed; Forked adds one.
