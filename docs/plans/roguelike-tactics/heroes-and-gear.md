# Roguelike tactics: stats, gear, party and heroes

Stats, gear, consumables, party size, heroes, recruitment, milestone upgrades, ultimates and recovery.

> Part of the roguelike tactics plan. Start at [README.md](README.md),
> which maps every combat-design section number ("section 3.4") to its
> file and indexes every decision. Abandoned approaches are in
> [history.md](history.md).

Rules are marked **Decided** or **Proposed**; numbers marked TBD are
tuning. Section numbers are the combat design's.

## 9. Stats, Gear and Consumables

### 9.1 Stats (Decided; redefined by the owner 2026-10-23)
The stat set is kept small, so every unit's stat sheet, enemies' included (D11), reads at a glance.

**Scale (Decided 2026-10-23):** stats are small whole numbers, 0 to 3 for the prototype heroes, and so are damage and health: a hit deals 1 or 2, a hero has 4 to 8 health. Every number on the board can be counted. (Until 2026-10-23 stats read Low 10 / Medium 25 / High 40, with hits of tens to a hundred or so and health in the hundreds; [history.md](history.md).)

| Stat | Role | Modified by gear? |
|---|---|---|
| **Speed** | Sets the action cost: 60 ÷ (speed + 5) slots, rounded ([timeline.md](timeline.md), 3.2). | Yes, and weighed against defence (4.2). |
| **Defence** | Sets health: **health = (1 + defence) × 2**. Reduces no damage itself. | TBD (see below). |
| **Power** | The damage each of the unit's abilities deals, exactly (9.2). | Yes. |
| **Health** | Hit points, from defence. | Through defence only (TBD). |

- **Damage reduction is Armour**, a keyword ([keywords.md](keywords.md), 17.6): a flat amount taken off each hit, which Pierce ignores. No prototype hero has any.
- **The prototype heroes (owner, 2026-10-23):**

  | Hero | Speed | Defence | Power | Health |
  |---|---|---|---|---|
  | Grappler | 2 | 3 | 1 | 8 |
  | Horse Archer | 3 | 1 | 2 | 4 |
  | Storm Caller | 2 | 2 | 2 | 6 |

  The wolf (2, 1, 1: health 4) and Temee (defence 9: health 20) are the builder's placeholders on the same scale ([owner-decisions.md](owner-decisions.md)).
- **Health and gear:** health was fixed per hero (2026-10-18), never raised by gear. With health now following defence, gear that adds defence would raise it; whether defence gear exists, or health stays fixed by keeping defence off gear, is open question 58.
- **No movement stat.** Every unit walks up to 2 spaces (5.1; 3 until 2026-10-24), except the Horse Archer, which moves the way Snap Shot flies: any number of spaces straight along one of the six directions, up to the first unit, yurts or the map's edge, stopping in hail (owner, 2026-10-25).
- **No accuracy, evasion or critical hits**, since every attack hits (section 8).

### 9.2 Power (Decided; redefined 2026-10-23)
There is **one offensive stat, power**, and it is **exactly the damage each of the unit's abilities deals** (owner, 2026-10-23): the Horse Archer's Snap Shot and the Grappler's Grapple deal their user's power (Grapple's throw deals none, owner, 2026-10-26), and the Storm Caller's Hail deals its power, 2 (owner, 2026-10-27, [balance.md](balance.md#the-storm-caller-at-power-2-2026-10-27); 1 from 2026-10-23; at power 0 it dealt none, and couldn't break a grapple: [balance.md](balance.md#hail-deals-1-2026-10-23)). Abilities have no base damage of their own; an ability's worth beyond its damage is its shape and its keywords.

- **Power scales nothing else.** Keyword effects keep the value their source states ([keywords.md](keywords.md), 17.2): Burn, Shield, Delay and Haste slots, displacement distances and every duration. Empower and Weaken change the damage an ability deals directly.
- **Roles come from kits and stats together.** A control hero matters mostly through its keywords (Hail's Immobilized), but power 0 left Hail unable to break a grapple or finish a kill, and the Storm Caller weak (2026-10-23).

Rationale:
- **Readability:** the damage of every attack is a number on the stat sheet.
- **Gear relevance:** one offensive stat keeps every item that raises it useful on every hero.
- **Nothing counts twice:** one stat sets one kind of number.

### 9.3 Gear Slots (Decided)
Each hero has four gear slots:

| Slot | Typical role (to be confirmed per item design) |
|---|---|
| **Boots** | Movement and per-hex movement cost. |
| **Gloves** | Ability modifiers and damage. |
| **Armour** | Defence; main source of the speed versus defence tradeoff. |
| **Helmet** | Ability and keyword modifiers. |

- **Proposed: each slot modifies one verb** (as each Hades boon slot does: Attack, Special, Cast, Dash, Call), for example gloves the basic ability, helmet the signature ability, boots movement, armour reactions and defence. Two items for the same verb then compete for one slot, so taking one means giving up the other. Mapping TBD (question 49).
- **Weapons are not a gear slot.** Each hero has a unique signature weapon, closely tied to their abilities and to the visual design language. It cannot be swapped.
- Which slots can carry keyword modifiers (conditions and effects) is TBD.

### 9.4 Gear Rarity (Decided)
- Rarity **reliably** indicates strength: higher-rarity gear is always stronger than lower-rarity gear of the same type.
- The advantage can be **narrow**: a higher-rarity item may be stronger in one specific dimension rather than across the board.
- Rarity is communicated through the diegetic design language.
- Number of tiers and visual treatment TBD.
- **Proposed (9.7):** rarity scales the *same* effect, as Hades boon rarity does (a rare and an epic version of an item do the same thing, the epic one more of it), and the top tier holds **build-enablers**: rule-changers with a drawback, like Path of Exile's uniques. Their power is a new rule rather than bigger numbers, which needs this section's "reliably stronger" restated for that tier.

### 9.5 Rarity Rationale
- Rarity gives a dependable shortcut for comparing gear at a glance, on your heroes and on enemies; exact stats are shown too (D11).
- Narrow advantages keep lower-rarity gear relevant for builds that do not need the improved dimension.

### 9.6 Consumables (Decided)
- Consumables exist, but are limited.
- **Used only between fights,** never in combat. Each one does one of:
  - **a stat buff** for the next combat (for example +defence),
  - **a status effect** applied at the start of the next combat (for example a Barrier at the start of the fight),
  - **health recovery**, one of the sources of recovery between fights (10.11).
- **A small shared party inventory** limits how many can be carried, preventing hoarding.
- Buffs and statuses from consumables last for the next combat only, and are shown on the affected heroes' stat sheets and cards.
- Rationale: keeping consumables out of combat keeps every in-combat turn about the heroes' own abilities and the track, and makes using one a planning decision between fights (prepare for a known encounter on the route map, or heal now).

### 9.7 Gear Design: Choices, Not a Grind
Lessons from Path of Exile and Hades, and the reasons for them, are in [references.md](references.md#gear-and-build-lessons).

**Gear carries keyword or rule modifiers (Decided 2026-10-17):** a keyword an item applies, a condition it adds, a rule it bends. **Proposed:** that is an item's main job, and stats are its secondary part; an item that only changes numbers is not a choice worth offering.

**Goal: theorycrafting as problem solving (Decided 2026-10-17).** Players should be able to reason about team compositions and gear builds, between runs and inside one, as a puzzle ([goals.md](goals.md), 1.1). The theorycrafting comes from how rules interact and how bonuses stack, not from the size of small bonuses.

**No gear grind (Proposed).** Many small percentage bonuses (+6% power against +5% defence) were the original reason for fine-grained combat math. They work against strategy here:
- **They rarely make decisions:** a choice between two small numbers has an obvious answer or barely matters.
- **They blur attribution (goal 2):** a gap made of twenty small bonuses can't be traced after a loss.
- **A run is too short for a grind to pay off:** at most 16 items per party, perhaps 10 to 20 gear decisions per run, and power resets every run. A grind's reward is volume, which this game doesn't have; Path of Exile's small bonuses matter only because hundreds of them add up.
- **They push inflation:** health once had to scale with gear to keep up with damage (since reversed, 9.1).

Stats are small whole numbers since 2026-10-23 (9.1), so a single point from gear is large: a stat line on gear is a real choice, not a small bonus. Gear is Expression in the types of fun (1.2), not Submission.

**Proposed rules**
- **Stat lines are few and chunky:** at most one stat line per item, in coarse steps (for example +10% or +20%), sized around **breakpoints**. A stat line is worth having when it changes what dies or who acts first (a hit that now kills, a card that now lands a slot earlier); full information makes those breakpoints strategic.
- **Cap gear's share of a hero's stats** relative to the hero's base, so the recruit gap (10.6) stays deliberate rather than set by accident, and defence doesn't become a tax on every slot.
- **Keywords work as tags.** Gear modifiers apply by keyword, as Path of Exile's modifiers apply by skill tag ("your burn effects..."), and ability and gear keywords use the same names.
- **Bridge gear is a first-class item type:** gear that converts or links keywords ("displace effects also apply burn"), as Path of Exile's damage conversion lets fire modifiers apply to a physical attack.
- **Bridge gear can have prerequisites,** as Hades duo and legendary boons do (for example: requires a burn item and a displace item on this hero). Taking an item early is then also a bet on a later combination.
- **Rarity scales the same effect; the top tier enables builds** (9.4).
- **Publish the stacking rule** (question 37): an "increased"/"more" style rule, as in Path of Exile (bonuses in one group add, groups multiply), lets players reason about what a bonus is worth. Hidden or ad hoc stacking makes percentages noise.
- **Build-aware previews:** a gear offer shows what it does to this hero's actual abilities ("Lance now hits for 84 instead of 72, enough to kill the archer"), so evaluating a build never needs a spreadsheet or an outside calculator (Path of Exile needs Path of Building; Diablo 2's speed breakpoints lived in fan-made tables).
- **Drafted offers:** each gear offer is a choice between a few real options, never a pile of mostly useless drops; an offer says which hero each item is for, or the choice of hero is part of the decision.
- **A numeric-only upgrade competes with a real alternative,** as Hades's Pom of Power is taken instead of a new boon: upgrading an item's rarity costs the chance to take a new item.
- **Route nodes show what they offer:** a bazaar or reward node on the route map shows its keyword family before the player picks a route, as Hades doors show which god's boon is behind them, so choosing a route is also a build decision (Phase 2).
- **A public gear compendium:** the full gear pool is known and stable, so players can plan between runs ("if I find X for hero Y") and adapt to what a run offers, as in Slay the Spire, Monster Train or Balatro, rather than plan a fixed build in advance as Path of Exile players do.

**Watch**
- **Copied builds:** in Path of Exile a few players solve builds and most copy them. Seeded and daily runs (10.6) invite the same; making each run's best answer depend on what it offered keeps the problem-solving with each player.
- **Bounded power:** Hades builds are meant to break the game; here rival caravans copy builds ([ghosts.md](ghosts.md)) and PvP may follow, so build power stays bounded.

## 10. Party and Heroes

### 10.1 Party Size (Decided)
- Each side fields **up to 4 heroes.** The player's side also has the caravan's **camel**, a unit that isn't a hero and doesn't take one of the four places ([camel.md](camel.md), 18.1).
- Composition and per-character gear are the primary build levers.
- Rationale: large enough for role synergy and meaningful composition, small enough that turns stay fast and each character remains distinct.
- Enemy count in PvE encounters may differ. TBD.

### 10.2 Hero-Based Design (Decided)
- Players form their party from a pool of roughly **12 heroes**.
- Each hero has a **unique set of abilities and base stats**, a **signature weapon** (9.3) and an **ultimate** (10.10).
- **Gear found during the run** modifies a hero's stats, and modifies the common conditions and effects that most abilities use. Gear changes how a hero plays without replacing who they are.
- Each hero has obvious, fixed synergies with other heroes, while gear opens room for build variety within a run.
- Inspiration: Overwatch's Stadium mode, where purchased upgrades modify fixed hero kits.
- The current working roster is in section 15.8.

### 10.3 Hero Death (Decided)
- A hero who dies in combat is **lost for the rest of the run.**

### 10.4 Duplicates (Decided)
- The same hero can appear on **opposing** sides: in PvP, and against a rival caravan (a saved player build).
- **No duplicates within one party.** Recruitment offers never include a hero already in the party.

### 10.5 Rationale
- Composition (which heroes) and gear (what they carry) form two clearly separate build layers, supporting the goal of distinguishing build from play.
- Fixed hero identities make the diegetic design language easier to learn for allies and opponents.
- A known hero pool keeps PvP opponents readable before the first turn.
- Permanent death raises the stakes of every fight and forces adaptation within a run.

### 10.6 Recruitment (Decided)
- The party is **built up during the run.** Players start with a subset of their final party and recruit the rest between fights.
- Recruitment offers are **limited and random**: each offer presents a small, randomly selected set of heroes.
- Rejected alternative: offering a random subset of heroes to choose from at the start of the run. Players could restart repeatedly until they got the team they wanted, adding friction without adding variety.
- **Recruits join at base level:** no milestone upgrades and basic gear. They earn upgrades by reaching milestones (10.9). This includes a beaten rival caravan's hero ([ghosts.md](ghosts.md), D2).
- **Deaths don't change recruitment:** offers come at their usual points in the run, whether or not a hero has died.
- Rationale: **a hero's death is meant to start a death spiral.** The replacement is weaker than the hero it replaces, so the party is weaker in the next fight and the next death is more likely. Recovering is possible but unlikely. This gives permanent death its weight: protecting heroes matters more than any single fight's reward.
- **Offers are seeded:** the route map, encounters and offers all come from the run's seed, so restarting does not reroll them, and fixed seeds (for example daily runs) are comparable between players.
- **Unlocks come from two sources:** progression unlocks from fights won, so abandoning a run always costs something; recognition unlocks (cosmetics, titles) from your rival caravans' kills ([ghosts.md](ghosts.md), D9), so power never depends on other players dying.

### 10.7 Open Questions on Recruitment
- **Starting heroes:** how many (1 or 2), and whether they are chosen freely. A free choice removes any reason to restart at the very beginning, since randomness only enters once restarting costs progress.
- **Offer frequency and size:** how often offers appear and how many heroes each shows.
- **Guaranteed relevance:** whether each offer must include at least one hero sharing a keyword with the current team. Bad offers drive restarts, so usable offers reduce the incentive.

### 10.8 Open Questions on Heroes
- **Keyword vocabulary:** a defined set of common conditions and effects (for example burn, displace, on-flank, on-kill) that abilities and gear both reference. The effects and their rules are in [keywords.md](keywords.md); conditions (on-flank, on-kill and others) are still open. This is the key enabler of hero synergies and broadly useful gear, and should be designed before individual heroes.
- **Preventing solved compositions:** 12 heroes give 495 possible teams of 4, and fixed synergies tend to concentrate play on a few dominant teams.
- **Prototype scope:** validating the system with 6 to 8 heroes before building all 12.

**Ideas for preventing solved compositions and improving run variety (Proposed, not adopted)**
- **Multiple keyword hooks per hero:** each hero connects to at least two keywords, so it fits several teams rather than one exclusive pairing.
- **Bridge gear:** gear that converts or links keywords (for example, "displace effects also apply burn"), letting unexpected pairings work. Now proposed as a first-class item type (9.7).
- **Avoid stacking team-wide auras,** which compound with 4 heroes and push teams toward the same picks.
- **Hero variants:** alternative starting kits or upgrade paths, so a hero can fill different roles across runs.
- **Run modifiers:** run-wide rules that favour certain keywords, shifting which teams are strong.
- **Varied bosses** testing different axes (burst, sustain, positioning, tempo).
- **Drafted gear offers** (choices between limited options) rather than shops with full access. Now proposed in 9.7.
- **Track win rates by team** to find and tune dominant compositions.
- Already adopted: recruitment during the run from limited, random offers (10.6).

### 10.9 Milestone Upgrades (Replaced 2026-10-24)
**Replaced by the owner on 2026-10-24** by provisions (stat points, 2 per region) and one upgrade offer per region, whose hero slot may add a new ability ([progression.md](progression.md), 19.2 and 19.3). The rule below no longer holds where they differ: offers are per region, not per hero's milestones; heroes do grow in stats; a hero upgrade may be a new ability. The rule as it stood:

- Heroes are customized during a run through **choice-based upgrades**, not experience-based stat growth.
- At a few milestones per run, each hero is offered a choice of upgrades that modify their abilities, generally along keyword lines.
- The offered upgrades are **randomized but specific to each hero**, drawn from that hero's own upgrade pool. This is similar to how boons are offered in Hades.
- **Milestone upgrades are distinct from gear (Decided 2026-10-17).** Each one adjusts a named ability of its own hero, for example its shape (a line becomes a cone, a range grows by one) or an added effect (the Lance also pushes 1). It carries **no transferable modifier**: nothing a milestone upgrade does would mean anything on another hero. Gear's keyword and rule modifiers are transferable: they apply to whatever hero wears the item (9.7). An added effect may use a keyword, but it is attached to one ability, not a general rule ("burn effects on this hero..." is gear; "the Lance also burns" is a milestone upgrade).
- **Adjustments, not new kits:** milestone upgrades make slight changes to abilities a hero already has; they don't replace the hero's identity (10.2). In Hades terms, they play the role of the Daedalus Hammer's weapon-specific upgrades, while gear plays the role of boons.
- **No raw stat growth from upgrades**, keeping gear and rarity meaningful and matching the principle of minimal stat inflation.
- **Recruits earn upgrades too, but not on joining.** A recruit joins with no milestone upgrades (10.6) and must reach milestones like any other hero to earn them.
- Because recruits must reach milestones themselves, milestones are tracked per hero (for example, fights participated in or survived). Exact milestone criteria TBD.
- Permanent death also loses a hero's upgrades, raising the stakes further.
- Number of milestones per run and number of choices per offer are TBD (working assumption: 2 or 3 milestones, choice of 2).

### 10.10 Ultimates (Decided; out of the game since 2026-10-23)
**The owner's rework of 2026-10-23 removed action costs, and with them the unlock rule below; ultimates are out of the game and their code removed** ([history.md](history.md)). The concept stays for later: how an ultimate unlocks without action costs (rounds taken, for instance) is open question 39. The rule as it stood:

- Each hero has an **ultimate**: their most powerful ability.
- **Unlocked by action cost spent (owner, 2026-10-20; was turns taken).** An ultimate becomes usable once its hero has spent a set amount of **action cost** in the current fight (300 in Phase 1, about three typical actions). Every turn adds its cost, movement included, except a Hold without a move and a turn lost to Dazed ([keywords.md](keywords.md), 17.5). The meter starts at zero each fight.
- **Once per combat.** Once unlocked, each ultimate can be used once per fight. There is no cooldown, and the meter doesn't refill.
- **Priced on the track:** an ultimate may be an ordinary action with its own cost, a charged ability, or a track entity (3.7); that is defined per ultimate. Charged and track-entity ultimates are visible on the track, so opponents can answer them.
- **Public:** for every unit, on both sides, its progress toward its ultimate (cost spent and cost needed), whether it is ready, and whether it has been used are shown on its card and stat sheet, consistent with complete information.
- Rationale: ultimates are held back from the opening, so a fight builds toward them, and an ultimate that is about to unlock is a visible threat the other side can play around: pushing the hero's card also delays the unlock, and defeating it first prevents it. Counting cost spent, rather than filling a meter from specific actions (damage dealt, keywords), keeps the rule simple and fair to supports. Cost spent per slot is fixed for a given speed, so the meter measures time spent acting: fast units unlock a little sooner, and waiting doesn't charge it. Counting turns (until 2026-10-20) let a few cheap moves, priced as full turns, unlock it: in AI-vs-AI fights around slot 20 for the Horse Archer and Grappler and 32 for the Storm Caller, a few slots after first contact (slot 14, fights ending around 83); at 300 cost all three unlock around slot 38.
- **Gear can modify ultimates** like any other ability.

### 10.11 Recovery Between Fights (Decided)
- **The party starts each fight fresh** (owner, 2026-10-21): heroes begin every fight at full health, with no statuses. Until then, heroes recovered part of their health after each fight, and the rest at rests or from consumables ([history.md](history.md)).
- **The camel carries the damage forward:** its health carries over from fight to fight, and only its statuses are cleared ([camel.md](camel.md), 18.4). *(Proposed:* it recovers at rests and from consumables (9.6).)
- Rationale: attrition still gives every fight and every optional risk weight, through one bar, the camel's, that the whole party protects, as Into the Breach's power grid does. Heroes still die permanently (10.3), so a fight's losses still carry forward.
- Camel recovery amounts and rest frequency are TBD.

### 10.12 Steering Offers Across Runs (Proposed)
A meta layer like Hades's Mirror of Night, unlocked by the progression unlocks from fights won (10.6), that lets players influence what a run offers. It answers 10.7's problem: bad offers drive restarts.

**Influence chance, never add power**
- **Allowed:** rerolls of an offer (as Fated Persuasion), better rarity odds (as God's Pride), and a **keyword bias** chosen at the start of a run that makes one keyword family appear more often (as a Hades keepsake guarantees a god's boon).
- **Not allowed:** raw power, such as extra health or a revive (as the Mirror's Death Defiance). Rival caravans would carry their owner's upgrades into other players' runs ([ghosts.md](ghosts.md)), and a win could come from upgrades rather than build or play (goal 2).
- **Exclusive choices:** each Mirror row has two alternatives the player switches between, so the layer is a loadout choice (Expression) rather than a ladder (grinding). The same here.

**Constraints**
- **Seeded runs:** rerolls must not break comparisons between players on the same seed. Either draw rerolls from the seed's stream, so the same number of rerolls gives the same offers, or use a fixed steering loadout on daily runs. TBD (question 50).
- **Rarity odds are still power:** better odds raise a run's strength, not only its variance. Keep the bonus small, or pair it with a difficulty dial as Hades pairs the Mirror with Heat; optional risk ([enemies.md](enemies.md), 11.4) could be that dial.
- **Setting:** a diegetic name, for example trade contacts or a caravan charter ([setting.md](setting.md)). TBD.

## Decision log (from section 13)

| Area | Decision | Alternatives considered | Reason |
|---|---|---|---|
| Rarity | Reliably stronger, possibly narrowly | Rarity loosely related to power | Dependable shortcut for comparing gear at a glance |
| Party size | Up to 4 heroes, plus the caravan's camel (2026-10-21) | Solo, larger squads | Balances composition depth and turn speed |
| Heroes | Pool of ~12 heroes with unique abilities and base stats; gear modifies stats and common conditions/effects | Generic classes; fully custom characters | Separates composition and gear into clear build layers; fixed identities aid readability |
| Hero death | Permanent for the run | Revive between fights with a penalty | Raises stakes; forces adaptation |
| Stats (2026-10-23) | Speed, defence, power as small whole numbers (0 to 3 for the prototype heroes); health = (1 + defence) × 2 | Low 10 / Medium 25 / High 40 with health in three fixed tiers (2026-10-18 to 2026-10-23); larger stat sets; movement stat; accuracy and evasion; a separate influence stat | Owner's call: every number countable at a glance |
| Defence (2026-10-23) | Sets health only; damage reduction is the Armour keyword, flat | A percentage reduction, defence / (defence + constant) (until 2026-10-23) | Owner's call: with hits of 1 or 2, a percentage rounds away |
| Power (2026-10-23) | Exactly the damage each of the unit's abilities deals | Power scaling an ability's base damage and healing, ×(1 + power / 50) (2026-10-18 to 2026-10-23); power plus influence; physical/magical split | Owner's call: an attack's damage reads straight off the stat sheet |
| Gear slots | Boots, gloves, armour, helmet | Including a weapon slot | Weapons are unique per hero and tied to abilities and visual language |
| Consumables | Limited; used only between fights; stat buffs or statuses for the next combat, or health recovery; shared party inventory | Usable in combat as actions with their own cost; no consumables; unlimited consumables | Keeps combat about abilities and the track; makes preparation between fights a decision; no hoarding |
| Hero progression (2026-10-24, owner) | Provisions (stat points, 2 per region) and one upgrade offer per region from slots: hero, passive, wildcard ([progression.md](progression.md)) | Milestone upgrades from a hero-specific pool with no stat growth (until 2026-10-24); experience levels with stat growth | A steady, small stat growth with one commitment per region; every offer useful |
| Ultimates | Unlocked after the hero spends a set amount of action cost in the fight (turns taken until 2026-10-20), shown publicly; then once per combat; an action, a charged ability or a track entity, defined per ultimate | Usable from the start of the fight; charge meter filled by keyword actions; cooldown-based ultimates; no ultimates | Fights build toward ultimates; a visible unlock gives the other side a threat to play around; once per combat makes each use a decision |
| Recovery (2026-10-21, owner) | Heroes start each fight fresh; the camel's damage carries over, its statuses cleared | Heroes recover partially after each fight, fully at rests or from consumables (until 2026-10-21); no healing between fights | Attrition through the camel's health, which the whole party protects |
| Recruits | Join at base level with basic gear; offers unaffected by deaths | Join at the party's upgrade level; special replacement mechanics after a death | A death is meant to start a death spiral with a low chance of recovery, giving permanent death its weight |
| Party formation | Recruit heroes during the run from limited, random offers | Full team chosen at start; random subset of heroes offered at start | Adds a draft layer and run-to-run variety; a random starting subset encourages restarting until the desired team appears |
| Duplicates | Allowed across opposing sides (PvP, ghost teams) | Unique heroes across both sides | Avoids blocking picks based on the opponent |
| Gear content (2026-10-17) | Gear carries keyword or rule modifiers; the goal is theorycrafting as problem solving | Gear as stat sticks; a gear grind of many small percentage bonuses (not ruled out yet, 9.7 proposes against it) | A choice about what a hero does is a decision; comparing small numbers is not |

## Open questions (from section 14, original numbers)

14. Number of rarity tiers and their visual treatment.
20. Recruitment and hero questions listed in sections 10.7 and 10.8.
23. ~~Value of `defenceConstant`, and whether a minimum of 1 damage applies (section 9.1).~~ Retired 2026-10-23: defence sets health, damage is power minus Armour, and there is no minimum ([keywords.md](keywords.md), 17.6).
24. Which gear slots carry keyword modifiers. Gear carries them (9.7, decided 2026-10-17); whether every slot does, and which modifiers suit which slot, is still open (see question 49).
25. Whether a rival caravan copy carries the consumable buffs active when it was copied ([ghosts.md](ghosts.md)).
26. ~~Number of milestone upgrades per run, choices per offer, and the per-hero milestone criteria.~~ Answered 2026-10-24: one offer of 3 per region, pick 1 ([progression.md](progression.md), 19.3).
37. **Damage buckets** (9.7 proposes publishing the rule, in the style of Path of Exile's "increased" and "more"): whether bonuses are grouped so that those in the same group add together and the groups multiply, in a fixed order (for example base, power and gear percentages, situation such as flanking and conceal, then target defence and barrier), making stacking predictable and tuning a matter of which group a bonus joins. Phase 1 uses a fixed multiplicative order ([phase-1-brief.md](phase-1-brief.md), section 2).
38. Whether consumables can be used before a PvP duel, and which ones ([pvp.md](pvp.md)).
39. How an ultimate unlocks now that actions have no cost (10.10): after a number of Temee's turns, of the hero's own turns, or something else; and whether ultimates come back at all.
49. Whether each gear slot modifies one verb (9.3), and the mapping; the proposed gear rules in 9.7 (stat line count and steps, the cap on gear's share of stats, bridge gear prerequisites, what top-rarity items are).
50. Steering offers across runs (10.12): which tools, how large the rarity bonus is, whether a difficulty dial offsets it, and how rerolls stay compatible with seeded and daily runs.
58. Whether gear may raise defence, and so health (9.1), or health stays fixed per hero.
