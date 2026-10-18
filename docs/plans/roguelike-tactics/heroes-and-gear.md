# Roguelike tactics: stats, gear, party and heroes

Stats, gear, consumables, party size, heroes, recruitment, milestone upgrades, ultimates and recovery.

> Part of the roguelike tactics plan. Start at [README.md](README.md),
> which maps every combat-design section number ("section 3.4") to its
> file and indexes every decision. Abandoned approaches are in
> [history.md](history.md).

Rules are marked **Decided** or **Proposed**; numbers marked TBD are
tuning. Section numbers are the combat design's.

## 9. Stats, Gear and Consumables

### 9.1 Stats (Decided)
The stat set is kept small, so every unit's stat sheet, enemies' included (D11), reads at a glance.

**Scale (Decided):** health and damage use a ×10 scale (hits of tens to a hundred or so, health in the hundreds), so percentage bonuses from stats and gear survive rounding. Action costs (about 100 for a typical action) and track slots are separate scales (3.2).

| Stat | Role | Modified by gear? |
|---|---|---|
| **Health** | Hit points. Fixed per hero: each hero has its own value. | **No** (Decided 2026-10-18). |
| **Speed** | Divides action and movement cost, so it sets how often a unit acts; also its starting slot (section 4). | Yes, and weighed against defence (4.2). |
| **Defence** | Reduces incoming damage by a percentage (formula below). | Yes. |
| **Power** | Scales an ability's base damage and base healing (9.2). | Yes. |

- **Health is fixed per hero (Decided 2026-10-18):** it varies between heroes but is not a core stat to build: gear, milestone upgrades and stat changes (17.9) never raise max health. Health is part of who a hero is, like the signature weapon. Healing, overhealth and Barrier restore or protect health; they don't raise the maximum.
  - **Three tiers (Decided 2026-10-18):** every hero's health is **Low, Medium or High** (numbers set during tuning). The one exception is the Mahout Bulwark, whose war elephant gives it **Very high** health ([roster.md](roster.md)). Few distinct values keep kill thresholds easy to learn, while the gap between tiers stays: with health fixed, a High hero always has about 1.8× a Low hero's health, at every point in a run (defence multiplies both alike), so the gap matters as much at the end of a run as at the start. Uniform health was considered and rejected: tanks would depend on armour alone, and a tank in light armour would be as fragile as an archer.
  - **Why it holds now:** health was once made to grow with gear because damage outgrew fixed health late in a run ([history.md](history.md)). Damage now grows far less: power scales only an ability's base damage (9.2), keyword effects don't scale with any stat, gear carries keywords first (9.7), and difficulty comes from better-built enemies (11.4). Defence still grows with gear and, as a percentage reduction (formula below), holds its value as incoming damage grows.
  - **Watch:** if late fights still collapse into whoever strikes first, limit power from gear before reconsidering health.
  - A recruit joins at base level (10.6), so it starts behind the party's equipped heroes in speed, defence and power, not in health; that is intended.
- **No movement stat.** It was not distinct enough from speed. How far a unit moves is governed by per-hex movement cost (6.2), which boots can modify. Whether there is a hard maximum on hexes per turn is TBD.
- **No accuracy, evasion or critical hits**, since every attack hits (section 8).

**Defence formula (Decided)**
```
damageReduction = defence / (defence + defenceConstant)
damageTaken     = roundDown(incomingDamage × (1 − damageReduction))
```
- `defenceConstant` is a single global value, TBD.
- Properties: defence equal to the constant gives 50% reduction; reduction approaches but never reaches 100%; each additional point of defence is worth slightly less than the last (diminishing returns), so stacking defence cannot make a unit invulnerable.
- Rounding follows the global rule (round down). Whether a minimum of 1 damage applies is TBD (Phase 1: yes).

### 9.2 Power (Decided 2026-10-18)
There is **one offensive stat, power.** Influence, a second stat for effect strength, was folded into it ([history.md](history.md)).

- **Power scales an ability's base damage and base healing:** the damage of a hit and the healing of a heal that the ability itself states.
  `value = roundDown(base × (1 + power / 50))`.
- **Power scales nothing else.** Keyword effects keep the value their source states: Burn, collision damage, Barrier, overhealth, Cursed and other extra damage or protection, Push and Pull slots, Displace distances, stat changes and every duration. Keyword modifiers from gear and milestone upgrades are separate from power, and change these values directly ("Burn +10", "Push +2", "lasts 5 slots longer").
- **Roles come from base values, not stats.** A healer's heal has a high base and its attack a low one, so power makes it heal well and hit weakly. Power is a hero's overall strength; the kit decides where it goes.

Rationale:
- **Gear relevance:** a second offensive stat made every item for it useless on heroes built around the other, the reason a physical versus magical split was rejected.
- **Build identity comes from keywords** now that gear carries keyword modifiers (9.7), so a separate effect stat added little.
- **Nothing counts twice:** one stat scales one kind of number. Influence scaled magnitude for some effects and duration for others; with gear adding both its stat and its effects, the same stat could amplify an item's own effect, and influence-scaled damage (Burn) skipped defence while power-scaled damage didn't.
- **Readability:** one fewer number on every unit's stat sheet (D11).
- **Track control stays a build choice:** Push and Pull slots, the track's most sensitive numbers, change only through deliberate gear and upgrade choices, not as a side effect of stat growth.

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

The ×10 scale stays: the defence formula, the power formula (9.2) and keyword values such as Burn need it whatever gear does. Gear is Expression in the types of fun (1.2), not Submission.

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
- Each side fields **up to 4 units.**
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

### 10.9 Milestone Upgrades (Decided)
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

### 10.10 Ultimates (Decided)
- Each hero has an **ultimate**: their most powerful ability.
- **Unlocked by turns taken.** An ultimate becomes usable only once its hero has completed a set number of turns in the current fight. Every completed turn counts, whatever action it used, except a turn lost to Dazed ([keywords.md](keywords.md), 17.5). The count starts at zero each fight.
- **Once per combat.** Once unlocked, each ultimate can be used once per fight. There is no charge meter and no cooldown.
- **Priced on the track:** an ultimate may be an ordinary action with its own cost, a charged ability, or a track entity (3.7); that is defined per ultimate. Charged and track-entity ultimates are visible on the track, so opponents can answer them.
- **Public:** for every unit, on both sides, its progress toward its ultimate (turns completed and turns needed), whether it is ready, and whether it has been used are shown on its card and stat sheet, consistent with complete information.
- Rationale: ultimates are held back from the opening, so a fight builds toward them, and an ultimate that is about to unlock is a visible threat the other side can play around: pushing the hero's card also delays the unlock, and defeating it first prevents it. Counting turns, rather than filling a meter from specific actions, keeps the rule simple and the count easy to read. Fast units unlock sooner, since they take turns more often.
- **Gear can modify ultimates** like any other ability.

### 10.11 Recovery Between Fights (Decided)
- **Partial recovery:** heroes recover a portion of their health after each fight.
- **Full recovery** comes from occasional rest opportunities or from consumables (9.6).
- Rationale: damage from each fight carries forward (attrition), giving every fight and every optional risk weight, without a single bad fight ending the run on its own. Combined with permanent death, this makes resource management a core part of the run.
- Recovery amount and rest frequency are TBD.

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
| Party size | Up to 4 | Solo, larger squads | Balances composition depth and turn speed |
| Heroes | Pool of ~12 heroes with unique abilities and base stats; gear modifies stats and common conditions/effects | Generic classes; fully custom characters | Separates composition and gear into clear build layers; fixed identities aid readability |
| Hero death | Permanent for the run | Revive between fights with a penalty | Raises stakes; forces adaptation |
| Stats (2026-10-18) | Health, speed, defence, power; gear modifies speed, defence and power; health is fixed per hero | Larger stat sets; movement stat; accuracy and evasion; a separate influence stat | Small enough to read on every unit's stat sheet; movement was not distinct from speed |
| Health scaling (2026-10-18) | Fixed per hero, in three tiers (Low, Medium, High) plus the war elephant's Very high; not modified by gear, upgrades or stat changes | Uniform health for every hero; modified by gear, like defence (the previous decision); upgradeable constitution stat | Health is part of a hero's identity; with power scaling only base damage and keyword effects unscaled, damage no longer outgrows it; tiers keep thresholds learnable while the gap between them stays constant through a run |
| Defence formula | Percentage reduction: defence / (defence + constant) | Flat reduction | Diminishing returns; never reaches full immunity; works across all damage sizes |
| Power (2026-10-18) | One offensive stat: power scales an ability's base damage and base healing; keyword effects and durations are unscaled | Power plus influence (effect strength, the previous decision); physical/magical split | Keeps every offensive item relevant to every hero; build identity comes from keywords; nothing scales twice |
| Gear slots | Boots, gloves, armour, helmet | Including a weapon slot | Weapons are unique per hero and tied to abilities and visual language |
| Consumables | Limited; used only between fights; stat buffs or statuses for the next combat, or health recovery; shared party inventory | Usable in combat as actions with their own cost; no consumables; unlimited consumables | Keeps combat about abilities and the track; makes preparation between fights a decision; no hoarding |
| Hero progression | Milestone upgrades from a randomized, hero-specific pool; no stat growth; recruits join without upgrades and earn them by reaching milestones | Experience levels with stat growth | Build variety without stat inflation |
| Ultimates | Unlocked after the hero completes a set number of turns in the fight, shown publicly; then once per combat; an action, a charged ability or a track entity, defined per ultimate | Usable from the start of the fight; charge meter filled by keyword actions; cooldown-based ultimates; no ultimates | Fights build toward ultimates; a visible unlock gives the other side a threat to play around; once per combat makes each use a decision |
| Recovery | Partial after each fight; full from rests or consumables | Full heal after each fight; no healing between fights | Meaningful attrition without single-fight run losses |
| Recruits | Join at base level with basic gear; offers unaffected by deaths | Join at the party's upgrade level; special replacement mechanics after a death | A death is meant to start a death spiral with a low chance of recovery, giving permanent death its weight |
| Party formation | Recruit heroes during the run from limited, random offers | Full team chosen at start; random subset of heroes offered at start | Adds a draft layer and run-to-run variety; a random starting subset encourages restarting until the desired team appears |
| Duplicates | Allowed across opposing sides (PvP, ghost teams) | Unique heroes across both sides | Avoids blocking picks based on the opponent |
| Gear content (2026-10-17) | Gear carries keyword or rule modifiers; the goal is theorycrafting as problem solving | Gear as stat sticks; a gear grind of many small percentage bonuses (not ruled out yet, 9.7 proposes against it) | A choice about what a hero does is a decision; comparing small numbers is not |

## Open questions (from section 14, original numbers)

14. Number of rarity tiers and their visual treatment.
20. Recruitment and hero questions listed in sections 10.7 and 10.8.
23. Value of `defenceConstant`, and whether a minimum of 1 damage applies (section 9.1).
24. Which gear slots carry keyword modifiers. Gear carries them (9.7, decided 2026-10-17); whether every slot does, and which modifiers suit which slot, is still open (see question 49).
25. Whether a rival caravan copy carries the consumable buffs active when it was copied ([ghosts.md](ghosts.md)).
26. Number of milestone upgrades per run, choices per offer, and the per-hero milestone criteria.
37. **Damage buckets** (9.7 proposes publishing the rule, in the style of Path of Exile's "increased" and "more"): whether bonuses are grouped so that those in the same group add together and the groups multiply, in a fixed order (for example base, power and gear percentages, situation such as flanking and conceal, then target defence and barrier), making stacking predictable and tuning a matter of which group a bonus joins. Phase 1 uses a fixed multiplicative order ([phase-1-brief.md](phase-1-brief.md), section 2).
38. Whether consumables can be used before a PvP duel, and which ones ([pvp.md](pvp.md)).
39. The number of turns that unlocks an ultimate (10.10): one value for every hero, or set per ultimate.
49. Whether each gear slot modifies one verb (9.3), and the mapping; the proposed gear rules in 9.7 (stat line count and steps, the cap on gear's share of stats, bridge gear prerequisites, what top-rarity items are).
50. Steering offers across runs (10.12): which tools, how large the rarity bonus is, whether a difficulty dial offsets it, and how rerolls stay compatible with seeded and daily runs.
