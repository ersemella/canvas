# Roguelike tactics: stats, gear, party and heroes

Stats, gear, consumables, party size, heroes, recruitment, milestone upgrades, ultimates and recovery.

> Part of the roguelike tactics plan — start at [README.md](README.md),
> which maps every combat-design section number ("section 3.4") to its
> file and indexes every decision.

From the combat design document (draft v1.7, owner, 2026-10-15). Rules
are marked **Decided** or **Proposed**; numbers marked TBD are tuning.
Section numbers are the original document's.

## 9. Stats, Gear and Consumables

### 9.1 Stats (Decided)
The stat set is kept small, because stats are hidden and players learn them through previews. Fewer stats are easier to discover.

| Stat | Role | Modified by gear? |
|---|---|---|
| **Health** | Hit points. | Mostly fixed. Each hero has a different health value, but it does not scale meaningfully during a run. |
| **Speed** | Starting order, tie-breaking, and a small action cost reduction (section 4). | Yes, and weighed against defence (4.5). |
| **Defence** | Reduces incoming damage by a percentage (formula below). | Yes. |
| **Power** | Scales direct damage. | Yes. |
| **Influence** | Scales effect strength (9.2). | Yes. |

- **Health is mostly fixed** because scaling health during a run interacts poorly with permanent death and recruitment: a recruit joining mid-run would be far behind, and losing a hero would cost accumulated health as well as the hero.
- **No movement stat.** It was not distinct enough from speed. How far a unit moves is governed by per-hex movement cost (6.2), which boots can modify. Whether there is a hard maximum on hexes per turn is TBD.
- **No accuracy, evasion or critical hits**, since every attack hits (section 8).

**Defence formula (Decided)**
```
damageReduction = defence / (defence + defenceConstant)
damageTaken     = roundDown(incomingDamage × (1 − damageReduction))
```
- `defenceConstant` is a single global value, TBD.
- Properties: defence equal to the constant gives 50% reduction; reduction approaches but never reaches 100%; each additional point of defence is worth slightly less than the last (diminishing returns), so stacking defence cannot make a unit invulnerable.
- Rounding follows the global rule (round down). Whether a minimum of 1 damage applies is TBD.

### 9.2 Power and Influence (Decided)
The offensive stat is split in two:
- **Power:** scales direct damage.
- **Influence:** scales effect strength: status effect magnitude and duration, push distance, healing and shields.

"Influence" is a working name, chosen over "Potency" because Potency reads as a synonym for Power. Alternatives considered: Finesse, Control, Efficacy.

Rationale: this split follows the keyword system, giving damage-focused and effect-focused builds distinct stats. A physical versus magical split was considered and not recommended: it would require a matching split of defence and would halve how many gear pieces are relevant to each hero.

### 9.3 Gear Slots (Decided)
Each hero has four gear slots:

| Slot | Typical role (to be confirmed per item design) |
|---|---|
| **Boots** | Movement and per-hex movement cost. |
| **Gloves** | Ability modifiers and damage. |
| **Armour** | Defence; main source of the speed versus defence tradeoff. |
| **Helmet** | Ability and keyword modifiers. |

- **Weapons are not a gear slot.** Each hero has a unique signature weapon, closely tied to their abilities and to the visual design language. It cannot be swapped.
- Which slots can carry keyword modifiers (conditions and effects) is TBD.

### 9.4 Gear Rarity (Decided)
- Rarity **reliably** indicates strength: higher-rarity gear is always stronger than lower-rarity gear of the same type.
- The advantage can be **narrow**: a higher-rarity item may be stronger in one specific dimension rather than across the board.
- Rarity is communicated through the diegetic design language.
- Number of tiers and visual treatment TBD.

### 9.5 Rarity Rationale
- Because stats are not directly shown, rarity gives a dependable shortcut for evaluating gear. *(Since D11, 2026-10-15, your own heroes' stats are shown, so rarity matters most for reading enemies' gear; see the open question in [README.md](README.md) on gear you're offered.)*
- Narrow advantages keep lower-rarity gear relevant for builds that do not need the improved dimension.

### 9.6 Consumables (Decided)
- Consumables exist, but are limited.
- **In combat,** using a consumable is an action with its own action cost, so the timeline prices it like any other action.
- **A small shared party inventory** limits how many can be carried, preventing hoarding.
- **Out of combat,** consumables are one of the sources of recovery between fights (10.11).
- Whether consumables are allowed in PvP and in ghost builds is TBD.

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
- The same hero can appear on **opposing** sides: in PvP, and when fighting a ghost team (a saved player build), if ghost teams are used.
- Whether a single party can contain duplicates of the same hero is TBD.

### 10.5 Rationale
- Composition (which heroes) and gear (what they carry) form two clearly separate build layers, supporting the goal of distinguishing build from play.
- Fixed hero identities make the diegetic design language easier to learn for allies and opponents.
- A known hero pool keeps PvP opponents readable before the first turn.
- Permanent death raises the stakes of every fight and forces adaptation within a run.

### 10.6 Recruitment (Decided)
- The party is **built up during the run.** Players start with a subset of their final party and recruit the rest between fights.
- Recruitment offers are **limited and random**: each offer presents a small, randomly selected set of heroes.
- Rejected alternative: offering a random subset of heroes to choose from at the start of the run. Players could restart repeatedly until they got the team they wanted, adding friction without adding variety.

### 10.7 Open Questions on Recruitment
- **Starting heroes:** how many (1 or 2), and whether they are chosen freely. A free choice removes any reason to restart at the very beginning, since randomness only enters once restarting costs progress.
- **Offer frequency and size:** how often offers appear and how many heroes each shows.
- **Recruit gear:** recruits join without milestone upgrades and earn them by reaching milestones (decided, 10.9). Whether they come with any gear is TBD.
- **Guaranteed relevance:** whether each offer must include at least one hero sharing a keyword with the current team. Bad offers drive restarts, so usable offers reduce the incentive.
- **Seeded offers:** whether offers are determined by the run's seed, so restarting does not reroll the same run, and fixed seeds (e.g., daily runs) are comparable between players.
- **Progression rewards:** whether unlocks come from fights won rather than runs started, so abandoning a run always costs something.
- **Replacing lost heroes:** recruitment offers are the natural path to replacing heroes lost to permanent death. Whether any special replacement mechanic is needed is TBD.

### 10.8 Open Questions on Heroes
- **Keyword vocabulary:** a defined set of common conditions and effects (for example burn, push, on-flank, on-kill) that abilities and gear both reference. This is the key enabler of hero synergies and broadly useful gear, and should be designed before individual heroes.
- **Preventing solved compositions:** 12 heroes give 495 possible teams of 4, and fixed synergies tend to concentrate play on a few dominant teams.
- **Prototype scope:** validating the system with 6 to 8 heroes before building all 12.
- Duplicates within a single party (10.4).

**Ideas for preventing solved compositions and improving run variety (Proposed, not adopted)**
- **Multiple keyword hooks per hero:** each hero connects to at least two keywords, so it fits several teams rather than one exclusive pairing.
- **Bridge gear:** gear that converts or links keywords (for example, "push effects also apply burn"), letting unexpected pairings work.
- **Avoid stacking team-wide auras,** which compound with 4 heroes and push teams toward the same picks.
- **Hero variants:** alternative starting kits or upgrade paths, so a hero can fill different roles across runs.
- **Run modifiers:** run-wide rules that favour certain keywords, shifting which teams are strong.
- **Varied bosses** testing different axes (burst, sustain, positioning, tempo).
- **Drafted gear offers** (choices between limited options) rather than shops with full access.
- **Track win rates by team** to find and tune dominant compositions.
- Already adopted: recruitment during the run from limited, random offers (10.6).

### 10.9 Milestone Upgrades (Decided)
- Heroes are customized during a run through **choice-based upgrades**, not experience-based stat growth.
- At a few milestones per run, each hero is offered a choice of upgrades that modify their abilities, generally along keyword lines.
- The offered upgrades are **randomized but specific to each hero**, drawn from that hero's own upgrade pool. This is similar to how boons are offered in Hades.
- **No raw stat growth from upgrades**, keeping gear and rarity meaningful and matching the principle of minimal stat inflation.
- **Recruits earn upgrades too, but not on joining.** A hero recruited mid-run starts with no milestone upgrades and must reach milestones like any other hero to earn them.
- Because recruits must reach milestones themselves, milestones are tracked per hero (for example, fights participated in or survived). Exact milestone criteria TBD.
- Permanent death also loses a hero's upgrades, raising the stakes further.
- Number of milestones per run and number of choices per offer are TBD (working assumption: 2 or 3 milestones, choice of 2).

### 10.10 Ultimates (Decided)
- Each hero has an **ultimate**: their most powerful ability.
- **Charged, not on cooldown:** each hero has an ultimate meter, filled by actions tied to that hero's keywords (for example, applying burn). This is consistent with having no cooldowns.
- **Visible:** charge levels are shown for all units, enemies included, consistent with complete information.
- **Priced on the timeline:** using an ultimate is an action with its own action cost, and may be a delayed action (3.7) so opponents can answer it.
- **Gear can modify ultimates** like any other ability.
- Whether charge carries between fights or resets each fight is TBD.

### 10.11 Recovery Between Fights (Decided)
- **Partial recovery:** heroes recover a portion of their health after each fight.
- **Full recovery** comes from occasional rest opportunities or from consumables (9.6).
- Rationale: damage from each fight carries forward (attrition), giving every fight and every optional risk weight, without a single bad fight ending the run on its own. Combined with permanent death, this makes resource management a core part of the run.
- Recovery amount and rest frequency are TBD.

## Decision log (from section 13)

| Area | Decision | Alternatives considered | Reason |
|---|---|---|---|
| Rarity | Reliably stronger, possibly narrowly | Rarity loosely related to power | Dependable proxy when stats are hidden |
| Party size | Up to 4 | Solo, larger squads | Balances composition depth and turn speed |
| Heroes | Pool of ~12 heroes with unique abilities and base stats; gear modifies stats and common conditions/effects | Generic classes; fully custom characters | Separates composition and gear into clear build layers; fixed identities aid readability |
| Hero death | Permanent for the run | Revive between fights with a penalty | Raises stakes; forces adaptation |
| Stats | Health (mostly fixed per hero), speed, defence, power, influence | Larger stat sets; movement stat; accuracy and evasion | Hidden stats must stay discoverable; movement was not distinct from speed |
| Health scaling | Mostly fixed per hero | Upgradeable constitution stat | Scaling health interacts poorly with permanent death and mid-run recruits |
| Defence formula | Percentage reduction: defence / (defence + constant) | Flat reduction | Diminishing returns; never reaches full immunity; works across all damage sizes |
| Power split | Power (direct damage) and Influence (effect strength) | Single power stat; physical/magical split | Follows the keyword system; a physical/magical split would need two defence stats and halve gear relevance |
| Gear slots | Boots, gloves, armour, helmet | Including a weapon slot | Weapons are unique per hero and tied to abilities and visual language |
| Consumables | Limited; actions with costs in combat; shared party inventory; part of recovery | No consumables; unlimited consumables | Flexibility without hoarding; priced by the timeline |
| Hero progression | Milestone upgrades from a randomized, hero-specific pool; no stat growth; recruits start without upgrades and earn them by reaching milestones | Experience levels with stat growth | Build variety without stat inflation |
| Ultimates | Charge meter filled by keyword actions; visible to all; action cost on the timeline | Cooldown-based ultimates; no ultimates | Hero identity and fight arcs, consistent with no cooldowns and complete information |
| Recovery | Partial after each fight; full from rests or consumables | Full heal after each fight; no healing between fights | Meaningful attrition without single-fight run losses |
| Party formation | Recruit heroes during the run from limited, random offers | Full team chosen at start; random subset of heroes offered at start | Adds a draft layer and run-to-run variety; a random starting subset encourages restarting until the desired team appears |
| Duplicates | Allowed across opposing sides (PvP, ghost teams) | Unique heroes across both sides | Avoids blocking picks based on the opponent |

## Open questions (from section 14, original numbers)

14. Number of rarity tiers and their visual treatment.
20. Recruitment and hero questions listed in sections 10.7 and 10.8.
22. Final name for the Influence stat (section 9.2).
23. Value of `defenceConstant`, and whether a minimum of 1 damage applies (section 9.1).
24. Which gear slots carry keyword modifiers, and whether any gear modifies health.
25. Whether consumables are allowed in PvP and ghost builds.
26. Number of milestone upgrades per run, choices per offer, and the per-hero milestone criteria.
27. Whether ultimate charge carries between fights.
