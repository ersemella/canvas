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
| **Health** | Hit points. Each hero has a different base value. | Yes. |
| **Speed** | Divides action and movement cost, so it sets how often a unit acts; also its starting slot (section 4). | Yes, and weighed against defence (4.2). |
| **Defence** | Reduces incoming damage by a percentage (formula below). | Yes. |
| **Power** | Scales direct damage. | Yes. |
| **Influence** | Scales effect strength (9.2). | Yes. |

- **Health and defence both grow with gear,** so a hero's defensive side keeps pace with damage, which grows through power and gear bonuses. If health stayed fixed, damage would outgrow it late in a run and fights would collapse into whoever strikes first. Defence is a percentage reduction (formula below), so it holds its value as incoming damage grows. Recruits join with gear and upgrades (10.6), so growing health doesn't leave them far behind.
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
- Rarity gives a dependable shortcut for comparing gear at a glance, on your heroes and on enemies; exact stats are shown too (D11).
- Narrow advantages keep lower-rarity gear relevant for builds that do not need the improved dimension.

### 9.6 Consumables (Decided)
- Consumables exist, but are limited.
- **Used only between fights,** never in combat. Each one does one of:
  - **a stat buff** for the next combat (for example +defence),
  - **a status effect** applied at the start of the next combat (for example Guard on the first turn),
  - **health recovery**, one of the sources of recovery between fights (10.11).
- **A small shared party inventory** limits how many can be carried, preventing hoarding.
- Buffs and statuses from consumables last for the next combat only, and are shown on the affected heroes' stat sheets and cards.
- Rationale: keeping consumables out of combat keeps every in-combat turn about the heroes' own abilities and the track, and makes using one a planning decision between fights (prepare for a known encounter on the route map, or heal now).

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
- **Recruits join at the party's level:** with as many milestone upgrades as the party's heroes have earned (10.9), but with lower-level gear than the party's. The player can then equip them from the party's gear inventory. This includes a beaten rival caravan's hero ([ghosts.md](ghosts.md), D2).
- Rationale: a recruit who joined with nothing would make each permanent death weaken the party further, making the next death more likely (a death spiral). Joining at the party's level keeps a death costly (the lost hero's gear, and a weaker replacement until re-equipped) without deciding the run.
- **Offers are seeded:** the route map, encounters and offers all come from the run's seed, so restarting does not reroll them, and fixed seeds (for example daily runs) are comparable between players.
- **Unlocks come from two sources:** progression unlocks from fights won, so abandoning a run always costs something; recognition unlocks (cosmetics, titles) from your rival caravans' kills ([ghosts.md](ghosts.md), D9), so power never depends on other players dying.

### 10.7 Open Questions on Recruitment
- **Starting heroes:** how many (1 or 2), and whether they are chosen freely. A free choice removes any reason to restart at the very beginning, since randomness only enters once restarting costs progress.
- **Offer frequency and size:** how often offers appear and how many heroes each shows.
- **Guaranteed relevance:** whether each offer must include at least one hero sharing a keyword with the current team. Bad offers drive restarts, so usable offers reduce the incentive.

### 10.8 Open Questions on Heroes
- **Keyword vocabulary:** a defined set of common conditions and effects (for example burn, push, on-flank, on-kill) that abilities and gear both reference. This is the key enabler of hero synergies and broadly useful gear, and should be designed before individual heroes.
- **Preventing solved compositions:** 12 heroes give 495 possible teams of 4, and fixed synergies tend to concentrate play on a few dominant teams.
- **Prototype scope:** validating the system with 6 to 8 heroes before building all 12.

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
- **Recruits join with upgrades.** A recruit joins with as many milestone upgrades as the party has earned (10.6), chosen from its own pool, and earns later milestones like any other hero.
- Milestones are tracked per hero (for example, fights participated in or survived). Exact milestone criteria TBD.
- Permanent death also loses a hero's upgrades, raising the stakes further.
- Number of milestones per run and number of choices per offer are TBD (working assumption: 2 or 3 milestones, choice of 2).

### 10.10 Ultimates (Decided)
- Each hero has an **ultimate**: their most powerful ability.
- **Once per combat.** Each ultimate can be used once per fight. This is the ultimate's whole limit: there is no charge meter and no cooldown.
- **Priced on the track:** an ultimate may be an ordinary action with its own cost, a charged ability, or a track entity (3.7); that is defined per ultimate. Charged and track-entity ultimates are visible on the track, so opponents can answer them.
- **Visible:** whether each unit, enemies included, still has its ultimate is shown, consistent with complete information.
- **Gear can modify ultimates** like any other ability.

### 10.11 Recovery Between Fights (Decided)
- **Partial recovery:** heroes recover a portion of their health after each fight.
- **Full recovery** comes from occasional rest opportunities or from consumables (9.6).
- Rationale: damage from each fight carries forward (attrition), giving every fight and every optional risk weight, without a single bad fight ending the run on its own. Combined with permanent death, this makes resource management a core part of the run.
- Recovery amount and rest frequency are TBD.

## Decision log (from section 13)

| Area | Decision | Alternatives considered | Reason |
|---|---|---|---|
| Rarity | Reliably stronger, possibly narrowly | Rarity loosely related to power | Dependable shortcut for comparing gear at a glance |
| Party size | Up to 4 | Solo, larger squads | Balances composition depth and turn speed |
| Heroes | Pool of ~12 heroes with unique abilities and base stats; gear modifies stats and common conditions/effects | Generic classes; fully custom characters | Separates composition and gear into clear build layers; fixed identities aid readability |
| Hero death | Permanent for the run | Revive between fights with a penalty | Raises stakes; forces adaptation |
| Stats | Health, speed, defence, power, influence; all modified by gear | Larger stat sets; movement stat; accuracy and evasion | Small enough to read on every unit's stat sheet; movement was not distinct from speed |
| Health scaling | Modified by gear, like defence | Mostly fixed per hero; upgradeable constitution stat | Fixed health let damage outgrow it, so late fights collapsed into whoever strikes first; recruits join with gear, so they aren't left behind |
| Defence formula | Percentage reduction: defence / (defence + constant) | Flat reduction | Diminishing returns; never reaches full immunity; works across all damage sizes |
| Power split | Power (direct damage) and Influence (effect strength) | Single power stat; physical/magical split | Follows the keyword system; a physical/magical split would need two defence stats and halve gear relevance |
| Gear slots | Boots, gloves, armour, helmet | Including a weapon slot | Weapons are unique per hero and tied to abilities and visual language |
| Consumables | Limited; used only between fights; stat buffs or statuses for the next combat, or health recovery; shared party inventory | Usable in combat as actions with their own cost; no consumables; unlimited consumables | Keeps combat about abilities and the track; makes preparation between fights a decision; no hoarding |
| Hero progression | Milestone upgrades from a randomized, hero-specific pool; no stat growth; recruits join with as many upgrades as the party has earned | Experience levels with stat growth | Build variety without stat inflation |
| Ultimates | Once per combat; an action, a charged ability or a track entity, defined per ultimate | Charge meter filled by keyword actions; cooldown-based ultimates; no ultimates | Hero identity and fight arcs; a simple, visible limit makes each use a decision |
| Recovery | Partial after each fight; full from rests or consumables | Full heal after each fight; no healing between fights | Meaningful attrition without single-fight run losses |
| Recruits | Join at the party's upgrade level, with lower-level gear; equipped from the party's gear inventory | Join with nothing | Prevents a death spiral after permanent death |
| Party formation | Recruit heroes during the run from limited, random offers | Full team chosen at start; random subset of heroes offered at start | Adds a draft layer and run-to-run variety; a random starting subset encourages restarting until the desired team appears |
| Duplicates | Allowed across opposing sides (PvP, ghost teams) | Unique heroes across both sides | Avoids blocking picks based on the opponent |

## Open questions (from section 14, original numbers)

14. Number of rarity tiers and their visual treatment.
20. Recruitment and hero questions listed in sections 10.7 and 10.8.
22. Final name for the Influence stat (section 9.2).
23. Value of `defenceConstant`, and whether a minimum of 1 damage applies (section 9.1).
24. Which gear slots carry keyword modifiers.
25. Whether a rival caravan copy carries the consumable buffs active when it was copied ([ghosts.md](ghosts.md)).
38. Whether consumables can be used before a PvP duel, and which ones ([pvp.md](pvp.md)).
39. Recruits (10.6): how "the party's level" is counted when heroes have earned different numbers of upgrades; how much lower a recruit's gear is; whether a dead hero's gear returns to the party's gear inventory.
26. Number of milestone upgrades per run, choices per offer, and the per-hero milestone criteria.
37. **Damage buckets:** whether bonuses are grouped so that those in the same group add together and the groups multiply, in a fixed order (for example base, power and gear percentages, situation such as flanking and conceal, then target defence and guard), making stacking predictable and tuning a matter of which group a bonus joins. Phase 1 uses a fixed multiplicative order ([phase-1-brief.md](phase-1-brief.md), section 2).
