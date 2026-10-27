# Roguelike tactics: hero roster

The heroes, three per region: identity, roles, stat profiles, mounts, and what was considered.

> Part of the roguelike tactics plan. Start at [README.md](README.md),
> which maps every combat-design section number ("section 3.4") to its
> file and indexes every decision. Abandoned approaches are in
> [history.md](history.md).

Rules are marked **Decided** or **Proposed**; numbers marked TBD are
tuning. Section numbers are the combat design's.

### 15.8 Hero Roster (Decided, working roster)
Each of the four regions ([setting.md](setting.md), 15.3a) has **three heroes: a tank, a damage hero and a support** (owner, 2026-10-26). Ten are chosen, from **five cultures**: the Steppe's Mongol heroes and the Turkic Storm Caller, three from Tang China, three from Persia and Sogdiana, and one from Byzantium, whose tank and support are open (open question 33). The India and Arabia heroes went with their regions (2026-10-26; the Elephant Rider returned as Persia's tank). Every hero is based on a **role** (a profession, unit or folklore type) or a **named fictional character** (from a novel, epic or folk tale); never a real historical individual, since real figures can be culturally sensitive. Figures still worshipped today stay out (15.5).

**Mechanical roles**
- **Tank:** protects allies, absorbs or prevents damage, holds space.
- **Damage:** primary source of kills.
- **Support:** heals, buffs, or controls the board and the track.

The roster is balanced at **4 tanks, 4 damage, 4 support**, one of each per region, so that limited, random recruitment offers (10.6) can usually supply each role. Until Byzantium's tank and support are chosen it has 3 tanks, 4 damage and 3 supports.

**Identity and role**

| # | Name | Culture | Inspiration (historical, folklore or mythical role) | Type | Fantasy RPG archetype | Mechanical role | Specialty | Mount | Signature weapon (proposed) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Alchemist | Tang China | The fangshi ("masters of methods"), Chinese alchemists and healers, and *waidan* ("external alchemy"), the making of elixirs by heating minerals and metals in sealed crucibles; Chinese alchemists seeking an elixir of life discovered gunpowder | Historical | Alchemist | Support | Elixirs: heals and Empowers an ally, hits and Weakens an enemy (2026-10-27; heal, Empower and Haste on an ally late 2026-10-26; Haste and Delay in a burst earlier that day, Empower and Weaken before that, a healer before) | None | Elixir gourd |
| 2 | Cataphract | Persia and Sogdiana | The cataphracts, armoured heavy cavalry; in Persia the savaran (aswaran), the Sasanian armoured noble cavalry, shock troops whose lance charge broke enemy lines. Heavy cavalry of this kind served many armies on the road | Historical | Knight / lancer | Damage (Tank until 2026-10-26) | Charger: a lance charge, burst damage at the end of a run in | Armoured horse | Heavy lance |
| 3 | Magus | Persia and Sogdiana | The magi as star-readers: the *Shahnameh*'s astrologers and sages, who read the stars at a king's command (they foretell Zahhak's fall and read the stars over Zal and Rudaba's marriage), and the Greek and Roman picture of the *magos* as astrologer, from which "magic" comes | Historical | Astrologer / seer | Support | Track controller: reads the stars to move turns, Delaying enemies and Hastening allies (Proposed) | None | Astrolabe and star charts (proposed, unverified) |
| 4 | Horse Archer | Mongol | The mangudai, units of the Mongol army (sources disagree on what they were: light cavalry, vanguards or "suicide troops"); Mongol warriors fought as mounted archers | Historical | Ranger | Damage | Ranged: line of fire matters most | Horse | Composite bow |
| 5 | Grappler | Mongol | Champion wrestlers (bökh), the highlight of the naadam games and of feasts in the epics | Historical | Brawler / grappler | Tank | Grappler: grabs, pins and throws enemies to hold the front line | None | Bare hands (wrestling vest) |
| 6 | Storm Caller | Turkic | The yadachy of Turkic folk belief (in Turkish, Azeri, Kazakh, Kyrgyz and Bashkir traditions): weather-workers born with the power, marked by a caul, to lead storms and hail away from their land, send them onto rivals' fields, and fight storm-bringing demons and rival yadachy with their souls while they sleep; tied to the rain stone (*yada tashy*). The Mongols shared the stone (*jada*): in the *Secret History of the Mongols* (143) a storm raised with it turns back on its casters | Folklore | Druid / storm caller | Support | Storm controller: hail that Immobilizes whoever it catches until the Storm Caller's turn after next (2026-10-25; its next turn from 2026-10-23; earlier kits with Slowed, fog, a track Push, healing Sunlight and a freezing ultimate are in [history.md](history.md)) | None | Rain stone and water |
| 7 | Elephant Rider | Persia and Sogdiana (South India until 2026-10-26) | The mahout, driver of war elephants, here of the Sasanian war elephants (*pīlbān*, "elephant keeper", in Persian), which fought the Romans, the Armenians at Avarayr (451) and the Arabs at al-Qadisiyyah (636), where they scattered the cavalry; the elephants and many of their drivers came from India. In the *Shahnameh*, the young Rostam's first feat is killing a raging white elephant | Historical | Juggernaut / beast rider | Tank | Immovable wall: Unstoppable (passive: no Push, Pull, Immobilized or Stunned, so no grapple); Trample drives units back (2026-10-27) | War elephant | Ankus (elephant goad) and spear |
| 8 | Barbarian | Byzantium | The Varangian Guard, the Norse axe-bearing bodyguard of the Byzantine emperors, whom Byzantine writers called the "axe-bearing barbarians" (Anna Komnene's *Alexiad*) | Historical | Barbarian / heavy warrior | Damage | Heavy melee: slow, hard-hitting burst | None | Great axe |
| 9 | Vanguard | Tang China | The modao troops, elite Tang infantry armed with the modao, a long two-handed blade, and placed at the front of the army as spearheads | Historical | Guardian / polearm warrior | Tank | Challenger: draws enemies onto itself and punishes those who close in. Its first kit (built 2026-10-22, removed 2026-10-23 with action costs; [history.md](history.md)) punished enemies walking away from it, taunted, guarded itself with a Barrier and pushed what it hit back on the track | None | Modao (long two-handed blade) |
| 10 | Swordsman | Tang China | The youxia ("wandering knights-errant"), free swordsmen who kept their word and avenged wrongs, given a chapter of Sima Qian's *Records of the Grand Historian* and celebrated in Tang poetry (Li Bai's *Ballad of the Knight-Errant*); the swordswomen of Tang *chuanqi* tales inspire its abilities | Historical | Swordsman / rogue | Damage | Fast melee: cheap, quick actions; striking unseen (Proposed) | None | Jian (straight double-edged sword) |

**Stat profiles (relative, untuned)**

These bands predate the stats' rework (owner, 2026-10-23; [heroes-and-gear.md](heroes-and-gear.md), 9.1): stats are now small whole numbers, health is (1 + defence) × 2 and power is exactly an ability's damage. The three prototype heroes' numbers are set (below); the others' bands are a guide for when they are built. Power is the damage of every ability, so control supports keep low power.

| Name | Health | Speed | Defence | Power |
|---|---|---|---|---|
| Alchemist | Medium | Medium | Low | Medium |
| Cataphract | Medium | Medium | Medium | High |
| Magus | Low | Medium | Low | None (set, owner 2026-10-27: speed 2, defence 1, power 0, so health 4) |
| Horse Archer | Low | High | Low | High |
| Grappler | High | Medium | Medium | Low |
| Storm Caller | Medium | Medium | Medium | Medium |
| Elephant Rider | High | Very low | High | Medium (set, owner 2026-10-27: speed 1, defence 3, power 2, so health 8) |
| Barbarian | High | Low | Medium | High |
| Vanguard | Medium | Low | High | Medium |
| Swordsman | Medium | High | Low | High |

**The prototype heroes' kits (owner, 2026-10-23; built)**

Every ability deals exactly its user's power in damage (9.2). Each hero
also has Hold. Skirmish and Sunlight are **upgrades**, not in the starting
kits (owner, 2026-10-24), and so are Shove and Haul (the Grappler),
Volley and Feigned Retreat (the Horse Archer) and Gale (the Storm Caller),
added the same day as measured ([balance.md](balance.md#second-abilities-measured-2026-10-24)): a hero earns one from the hero slot of a
region's upgrade offer ([progression.md](progression.md), 19.3), each
worth a second ability (a side without it wins 40–50%). Until offers are
built, no hero has them in play (`upgrades` in config.ts).

**At most two abilities** besides moving and Hold (owner, 2026-10-25;
three from 2026-10-24; `RULES.maxAbilities`): a hero with two takes no
new ability from an upgrade. So each hero takes one of its upgrades: the
Grappler (Grapple, Throw folded in) Shove or Haul; the Horse Archer (Snap Shot)
one of Skirmish, Volley and Feigned Retreat; the Storm Caller (Hail)
Sunlight or Gale. The test stage holds a unit to
two too.

| Hero | Speed | Defence | Power | Health | Ability | Effect |
|---|---|---|---|---|---|---|
| Grappler | 2 | 3 | 1 | 8 | Grapple | **Melee**: a unit next to the Grappler (owner, 2026-10-23; until then it reached 2 spaces, stepping in first). It takes 1 damage and is **Stunned** until the grapple ends: the Grappler takes damage, is Stunned, or the two are no longer next to each other (either moved; the Grappler may walk while it grapples, and the grapple holds if the walk ends next to the target). At the start of each of the Grappler's turns while it lasts, the target takes 1 more, plus the Grappler's Empower if it has one (owner, 2026-10-23). Never an Unstoppable unit, which can't be Stunned, such as the Elephant Rider (owner, 2026-10-27). One target at a time: a new grapple lets the last go, and it can't target the unit it already grapples. Two clenched fists on the board between the two show it while it lasts, and are its icon (owner, 2026-10-24; a chain until then). |
| | | | | | Grapple's throw | Part of Grapple since 2026-10-24 (owner; its own ability before, aimed at the grappled unit then its landing): while the Grappler grapples a unit, Grapple also offers each landing, one tap with the held unit implied. Only the unit it grapples: **Moves** it to a free space next to the Grappler, or swaps places with it (the Grappler's own space as the landing; even while the Grappler is Immobilized, owner, 2026-10-25). No damage (owner, 2026-10-26; 1 before): the squeeze is the grapple's damage, so a held unit takes the Grappler's power once a turn. The grapple holds (owner, 2026-10-23; the swap added the same day). |
| | | | | | Shove (upgrade) | **Melee**: **Push 2**, no damage; stopped by ruins, a unit or the map's edge, with no collision damage. Owner, 2026-10-24 (a side without it wins 49.6%). |
| | | | | | Haul (upgrade) | The first unit in a straight line 2 or 3 spaces away: **Pull 2** toward the Grappler, no damage. Owner, 2026-10-24 (a side without it wins 47.8%). |
| Horse Archer | 3 | 1 | 2 | 4 | Snap Shot | Named the Bow, then Longshot in the code, until 2026-10-27 (owner), when the Archer took Longshot. Unchanged in shape: six straight lanes with no range limit, hitting the first unit in a lane (an ally included), stopped by ruins. 2 damage. |
| | | | | | Skirmish (upgrade) | One step to a free space next to the Horse Archer (not while Immobilized), then Snap Shot's shot from there, along any of its six lanes. **Charged**: the Horse Archer's card goes half its action cost on (4 slots), greyed, and the arrow flies when it comes back, in place of a turn: the first unit in that lane then takes 2 (the Horse Archer's power), so its target can step out, and another unit can step in. The lane shows marked while the arrow is drawn; it is lost if the Horse Archer falls or is Stunned first (owner, 2026-10-24: a grapple before the card comes back spoils the shot), and the card then comes back as an ordinary turn. Owner, 2026-10-23: in place of Volley ([balance.md](balance.md#skirmish-in-place-of-volley-2026-10-23)). |
| | | | | | Volley (upgrade) | Any space within 3 (not ruins), no line of fire. **Charged** as Skirmish (4 slots): when the Horse Archer's card comes back the arrows land, and whoever stands there then takes 2. Lost if the Horse Archer falls or is Stunned first. Owner, 2026-10-24: back as an upgrade beside Skirmish (a side without it wins 41.1%). |
| | | | | | Feigned Retreat (upgrade) | Snap Shot's shot (2 damage), then a walk of 1 or 2 spaces (not while Immobilized). Owner, 2026-10-24 (a side without it wins 42.5%). |
| Storm Caller | 2 | 2 | 1 | 6 | Hail | One space exactly 2 away (not ruins): a ring, so the spaces next to the Storm Caller and 3 or more away are safe (owner, 2026-10-24; within 3 before; [balance.md](balance.md#walk-2-and-the-ring-of-hail-2026-10-24)). It stays until the Storm Caller's turn after next begins (owner, 2026-10-25; its next turn before), or it falls. **Two hails** stand at once, each lifting on its own, a third replacing the oldest (owner, 2026-10-26; one before). A unit in the space when it lands, or that enters it (walking, which stops there, or Moved), is **Immobilized** until the hail disappears, and one that **enters** it is hit too (owner, 2026-10-26; both as measured, changing little: [balance.md](balance.md#two-hails-hail-on-entry-and-a-melee-elixir-2026-10-26)). Its damage is the Storm Caller's power, 1 (owner, 2026-10-23; 0 before). |
| | | | | | Sunlight (upgrade) | One space within 3 (not ruins). Hail there melts, freeing whoever it held. A unit there that hits (not Temee), ally or enemy, the Storm Caller itself included, not already Empowered, is **Empowered 2** until the end of its next turn. No damage. A player is offered only its own side and spaces of hail. Owner, 2026-10-23: added as measured (a trap for today's AI), then with self-targeting and melting ([balance.md](balance.md#sunlight-as-empower-2026-10-23)). |
| | | | | | Gale (upgrade) | One space within 3 (not ruins): each unit next to it, ally or enemy, the Storm Caller included, takes 1 and is **Pushed 1** away from it. Owner, 2026-10-24 (a side without it wins 40.6%). |

The Grappler's Inevitable (2026-10-22) went with this rework: the
owner's notes leave it out, and nothing Delays any more. The kits they
replace (Hail as an area with damage and a track Push; Grapple Immobilizing
for 12 slots with base 60 damage; Throw landing beside the Grappler for
base 120) are in [history.md](history.md).

**Added 2026-10-23 (owner):** Skirmish for the Horse Archer, in place of
Volley ([history.md](history.md)). Earlier the same day: Volley for the Horse Archer (range 2) and the
swap as one of Throw's landings (rather than an ability of its own, so the
Grappler keeps one button for it). Overwatch, the first Sunlight (heal and
cleanse) and Fog were built, measured and removed with their code
([history.md](history.md), [balance.md](balance.md#new-abilities-2026-10-23)).

**Added 2026-10-23 (owner):** Sunlight as Empower 2 for the Storm Caller,
as measured, though the AI misuses it
([balance.md](balance.md#sunlight-as-empower-2026-10-23)); then (owner, the
same day) targeting itself, melting hail, and an Empowered Grappler's
squeeze dealing its Empower more.

**First measurements (2026-10-23, [balance.md](balance.md#the-2026-10-23-rework)):**
Grapple decides fights (a side without it wins 6% of AI-vs-AI fights),
Throw is almost never used (3% of the Grappler's turns; a side without it
wins 50%), and Hail is worth having (34% without it).

**Removed from the game (2026-10-23):** the Vanguard's kit (Hold the
Line, Challenge, Reap, Advance; built 2026-10-22 for playtesting and then
parked) and the parked abilities (Leap, Volley, Sunlight, Freeze, Lunge,
Shove), with their code. They were built on action costs and the old
numbers; their designs are in git history and [history.md](history.md),
and the Vanguard stays in the roster above as a hero to build again.

**Built 2026-10-25 (owner): the Vanguard and the Alchemist**,
in the roster with the prototype heroes (`ROSTER` in config.ts), with the
builder's first numbers, untested; neither is measured yet (principle 12
in [balance.md](balance.md)).

| Hero | Speed | Defence | Power | Health | Ability | Effect |
|---|---|---|---|---|---|---|
| Vanguard | 1 | 3 | 2 | 8 | Cleave | A line of 2 spaces straight out from the Vanguard in any of the six directions, stopped by ruins but not by units (owner, 2026-10-27, as measured in [balance.md](balance.md#cleave-as-a-line-of-2-six-ways-on-todays-rules-2026-10-27); from 2026-10-26 a line up or down or a cone of 3 to one side, a line six ways before that). Each unit in it, ally or enemy, takes the Vanguard's power, and each one left standing is **Delayed 8** (owner, 2026-10-26, as measured in [balance.md](balance.md#the-vanguards-buffs-other-than-speed-2026-10-26); 5 from 2026-10-25). No Push: it would undo the Vanguard's job, and in a full line the first unit is blocked by the second. The sprite and portrait are the first kit's (2026-10-22). |
| Alchemist | 3 (2 until 2026-10-25, owner; [balance.md](balance.md#elixirs-shape-and-cleaves-delay-2026-10-25)) | 1 | 1 (owner, 2026-10-26; 0 with the burst earlier that day, 1 before it, 2 before that; [balance.md](balance.md#two-hails-hail-on-entry-and-a-melee-elixir-2026-10-26)); the Elixir's heal and hit | 4 | Elixir | **One unit within 2**, the Alchemist itself too (owner, 2026-10-27), no line of fire: an ally **heals** the Alchemist's power (1; the camel too) and is **Empowered 2**; an enemy is **hit** for the Alchemist's power and **Weakened 2** (each until the end of its next turn, so the Alchemist's own Empower, given on its turn, lasts through the end of its next one; owner, 2026-10-27, as measured: [balance.md](balance.md#the-elixir-on-one-unit-within-2-empower-2-and-weaken-2-2026-10-27)). From late 2026-10-26 until then, one ally within 3, healed 1, **Empowered 1** and **Hastened 3**, nothing on an enemy ([balance.md](balance.md#elixir-on-one-ally-within-3-a-heal-and-unstoppable-2026-10-26)). Before that, a **burst** (owner, 2026-10-26, as measured: [balance.md](balance.md#two-hails-hail-on-entry-and-a-melee-elixir-2026-10-26)): a space next to the Alchemist, or its own, no line of fire, and every unit within 1 of it but the Alchemist, either side: an ally is **Hastened 3**, an enemy **Delayed 3** (owner, 2026-10-26, as measured: [balance.md](balance.md#elixir-as-haste-and-delay-other-shapes-2026-10-26); the Alchemist kept out of it, since taking its own it Hastened itself on every Elixir and kept the enemy beside it from acting). No damage and no heal. Earlier that day an ally was **Empowered 2** and an enemy **Weakened 1**, a unit that hits only, each until the end of its next turn. Earlier the same day, a unit within 2, the Alchemist itself too: an ally **healed** the Alchemist's power and was Empowered 1, an enemy took the Alchemist's power and was Weakened 1, the camel healed too ([balance.md](balance.md#elixir-fixed-at-1-with-a-hit-2026-10-26)); before that the Empower and Weaken were the Alchemist's power, with no hit or heal. An ability whose effect depends on whose unit it lands on, against [map.md](map.md) 6.7. Art by the owner (ChatGPT), shrunk with scripts/shrink-sprite.py. |

**Built 2026-10-26 (owner): the Swordsman**, in the roster
(`ROSTER`), with the owner's stats; Swift Strike's Haste 3 is the owner's
(2026-10-26; 2 the builder's first, [balance.md](balance.md#the-vanguards-buffs-other-than-speed-2026-10-26)). Art by the owner (ChatGPT,
2026-10-26), shrunk with scripts/shrink-sprite.py (the portrait cropped
without `--lines`), a 2-frame idle split at row 20, the figure shrunk to 85% of the frame
(owner: smaller than the Vanguard). A wide bamboo hat
(*douli*) and no beard since the same day (owner): with a topknot and a
beard it read as the Alchemist.

| Hero | Speed | Defence | Power | Health | Walk | Ability | Effect |
|---|---|---|---|---|---|---|---|
| Swordsman | 3 | 1 | 2 | 4 | 3 (the ordinary cap is 2) | Swift Strike | Melee, a *jian* stroke for the Swordsman's power (named Ten Paces, after Li Bai's swordsman who "kills one man every ten paces", until the owner asked for a more familiar name the same day); when it hits, the Swordsman's card is **Hastened 3** ([keywords.md](keywords.md) 17.3; 2 until 2026-10-26), taken off as its card is placed after the turn: 5 slots to its next turn after a strike instead of its usual 8. |

**Mounts (Decided)**
- Mounts have **no mechanics of their own**. Mounted heroes follow all normal rules (one hex, conceal, line of fire).
- A mount is reflected only in the hero's **base stats**: a horse raises speed; the Cataphract's armoured horse offsets the speed cost of its armour; the Elephant Rider's war elephant gives very high defence and health at very low speed.

**Notes**
- **Distinct tanks:** the Elephant Rider cannot be moved (Unstoppable as a passive: no Push, Pull, Immobilized or Stunned, so no grapple, but it can still be Delayed) and drives units back with Trample, the Grappler holds the front line by grappling (on foot, unlike the mounted Horse Archer), and the Vanguard draws attacks onto itself and punishes enemies who close in (its Taunt went with the 2026-10-23 keywords; its kit is to be redesigned).
- **Support needs:** buffs and curses (Alchemist's Elixir, a heal and Empower 2 on an ally or a hit and Weaken 2 on an enemy since 2026-10-27, a heal, Empower and Haste on one ally late 2026-10-26, a burst of Haste and Delay earlier that day, Empower and Weaken before; healing has no keyword since 2026-10-23, and no hero heals since that day), control on the track (Magus, Delay and Haste) and control in space (Storm Caller, hail that Immobilizes, and Sunlight's Empower). Weaken comes from the Elixir alone (again since 2026-10-27; from no hero while the Elixir was Haste and Delay, then Haste on allies only, 2026-10-26), since the Sahira Enchantress was removed (2026-10-26). Shield is uncovered: a candidate for Byzantium's support.
- **The Storm Caller:** a storm controller, not a damage caster (power 2, its hail's sting, since 2026-10-27; 1 from 2026-10-23, 0 before): its hail holds enemies fast on the board, while the Magus moves them on the track. The *Secret History*'s storm that turns back on its casters suggests a risk mechanic (a storm that can hit its own side). The yadachy tradition is folk belief rather than an organised religion, but it sits near steppe shamanism, which is still practised; keep it to weather-working and away from shamanic ritual (15.5).
- **Damage covers four niches:** mounted charger (Cataphract), ranged (Horse Archer), fast melee (Swordsman), heavy melee (Barbarian). No hero deals area damage since the Simurgh became a support (2026-10-26).
- **The Magus (owner, 2026-10-26; stats set 2026-10-27):** Persia's support, a track controller where the Storm Caller controls space. Foresight is no power here: information is already complete (D11).
  - **Stats (owner, 2026-10-27):** speed 2 (9 slots a turn), defence 1 (health 4), **power 0**: no ability of his deals damage (9.2), so everything he does is tempo. **Inevitable by default** (17.3): the stars keep their course, so nothing moves his card, his own abilities included. He is the first hero to start with a passive; proposed that it is innate, not his passive slot (19.3), and that Steady Gait is never offered to him.
  - **Built (owner, 2026-10-27): Conjunction, his starting ability** (`ABILITY.conjunction`, `swapCards` in resolve.ts): two units within **2** of him, of either side, Humphrey too (owner), neither Inevitable, whose cards both come before his next turn (his action cost on from now), swap places on the track: one Hastened and the other Delayed by the same gap, in one action, no turns created, and every swapped unit still acts before he does again (the fixed-star limit). No damage. The page aims one unit then the other; the AI weighs each card's move as the share of a turn it gains or loses, as Cleave's Delay, and tries each pair once. **Collisions still bump an Inevitable card** (owner, 2026-10-27; 3.3, as built): his card can't be Delayed or Hastened, but a faster card landing on its slot moves it on. In 12 AI fights with a Magus on each side, every fight ended and the Magus cast it 35 times; not measured for balance yet. His sprite and portrait are the owner's AI-assisted art (2026-10-27), shrunk to 32×32 with `shrink-sprite.py`, the sprite's beard put back by hand and its idle split at its waist (row 18).
  - **The fixed star, for his other ability:** his effects measure from his own card, which no one can Delay or Haste, so "just after the Magus's next turn" is a slot both sides can plan around, and a built-in limit against lockouts while the delay limit (3.6) isn't built.
  - **Ideas for an upgrade (none decided; two abilities at most):**
    1. **Ill Omen:** an enemy within 3 has its card moved to just after the Magus's next turn, if that is later (up to 9 slots, Cleave's Delay 8).
    2. **Favourable Stars:** an ally within 3 Hastened to act just after the Magus's turn, by at most 4 slots (Tailwind's Haste 3 measured 57.2%, [balance.md](balance.md)).
    3. **Eclipse:** every unit within 1 of a space within 3, allies too, has its card moved to just after the Magus's next turn: Gale for the track.
    4. **Appointed Hour:** a space within 3 foretold, marked on the board and at the Magus's next slot; a unit on it when that turn comes has its next turn skipped.
  - **Interactions to measure:** a swap with a charging Horse Archer moves when its arrow lands; Hastening the Storm Caller ends its hail sooner (hail lasts until its next turn); Hastening the Grappler squeezes sooner; swapping Humphrey forward walks it out sooner, and an enemy Magus swapping it back slows the fight's clock; two Magi can't swap each other.
  - **Open:** whether his range for other abilities is 3 on the board or anywhere; the delay and haste limits (17.3) before an upgrade that Delays or Hastens outright.
- **The Cataphract as damage** (2026-10-26, owner; named the Persian Cataphract, then the Sasanian Cataphract, until the same day): the savaran were shock cavalry, so its lance charge is a burst of damage rather than a way to hold a line. Mounted like the Horse Archer, but it closes in where the Horse Archer shoots from afar.
- **The Archer (owner, 2026-10-27; built the same day, `archer`, on the start menu and in the enemy's draw; its sprite and portrait from the owner's art, from the prompts in [art-direction.md](art-direction.md)):** a candidate for Persia's damage hero beside the Cataphract, which holds the slot. The Sasanian foot archers, whose massed arrows Byzantine writers describe; a bow, not a crossbow, which was Tang China's weapon in the setting's century and reached the west later. Stats: speed 2, defence 1 (health 4), power 3, the highest power on the roster.
  - **Longshot** (its starting ability, `ABILITY.longshot`; the name taken from the Horse Archer's ability, now Snap Shot): aimed at a **space** along any of the six straight lines from the Archer, at any range, hitting whoever stands there, ally or enemy. **Nothing blocks it**: units and ruins in between are passed over. Snap Shot hits the first unit in a lane, so a front line soaks it; Longshot reaches past the front line to any unit on the Archer's lines, and staying off them is the counterplay.
  - **Measured (2026-10-27, [balance.md](balance.md#the-archer-and-longshot-2026-10-27)):** too strong as built, its side winning 56–67% in every seat; Longshot's range 4 brings it to 48.5–52% with power 3 kept (power 2: 48–54%). Not changed yet: the owner's call.
  - **Measured against before:** power 3 at any range on six lines against the 4-health heroes (two shots kill the Horse Archer or the Magus, three the Grappler or the Elephant Rider), and an enemy Archer shooting over the guards at Humphrey, whose health carries from stage to stage; if it is too much, Longshot could leave out the camel or the spaces next to the Archer.
- **The Elephant Rider in Persia** (2026-10-26, owner): removed with the India region, then brought back the same day as Persia's tank, with the same war elephant and kit: the Sasanians fielded war elephants from India, many with Indian drivers, so some of India's flavour returns through Persia. Named Pilban Bulwark (from the Persian *pīlbān*) for a few hours, then the Mahout again: the mahout is the familiar name, and historians use it for the Sasanian drivers too. The Elephant Rider since the same day, when every hero took a plain English name (decision log).
- **The Elephant Rider's kit (owner, 2026-10-27; built the same day, `mahout` in config.ts, untested in balance; its sprite and portrait the owner's AI-assisted art, shrunk with `shrink-sprite.py`, the portrait's turban recoloured saffron (owner, 2026-10-27) so it no longer reads like the Magus's cream one, the sprite to a 44×44 frame (owner: larger than the camel's 36, so it outsizes the other units; its head and rider rise above its hex) with its dark lines kept (`--lines 0.3`), its idle split at the knees (row 34)):**
  - **Stats (owner, 2026-10-27):** speed 1 (a turn every 10 slots), defence 3 (health 8, the Grappler's and the Vanguard's), power 2.
  - **Unstoppable** (passive, 17.4): no Push, Pull, Immobilized or Stunned. No special case for the elephant (owner, 2026-10-27): it can't be grappled because Grapple's hold is a Stun, and it walks through hail (taking its hit) because hail stops a walk by Immobilizing. Any unit made Unstoppable gets the same. With no grapple, nothing in the game can Move it, so open question 54 doesn't touch it today.
  - **Trample** (its starting ability): the elephant walks 1 or 2 spaces in a straight line, in any of the six directions, stopped by ruins and the map's edge; with no unit in the way it is just that walk (owner, 2026-10-27). Units in its way, ally or enemy, are **Pushed back** ahead of it along the same line (owner: back, not aside), **all of them** when they stand in a row (owner, 2026-10-27), so they stay just in front of the elephant: a Trample of 2 into a unit next to it Pushes that unit, and any lined up behind it, 2. Each unit it Pushes takes the Elephant Rider's power. If the front unit's Push is stopped (ruins, a unit not in the row, the map's edge), the row stops there and the elephant behind it, with no collision damage (open question 55, [keywords.md](keywords.md)). A unit Pushed into hail is Immobilized and hit, as any unit entering it is; the elephant itself walks through hail.
  - **Damage and hail (owner, 2026-10-27):** every unit in the row takes the Elephant Rider's power, also when the row can't be Pushed; walking into hail it is hit but not Immobilized.
  - **Built as:** Unstoppable is a passive (`unstoppable`) the caravanserai doesn't offer; it's not in 19.8's pool. The AI weighs a Trample by the units it would hit and where it would end.
  - **Open:** Upgrades considered, none chosen: Bodyguard (it takes an adjacent ally's damage until its next turn), Shelter (adjacent allies Shield 1), Trumpet (units within 1 Pushed 1 away), Goad (Hastes its own card 4 for 1 damage to itself), Crush (double damage to a unit that can't step away), and Rampage, a risk upgrade: below half health its next turn is a forced Trample away from its last attacker.
- **The magi as religious-adjacent material:** the magi were Zoroastrian priests, and Zoroastrianism is still practised (Parsis, Zoroastrians in Iran). The hero is the magus as **star-reader** only, the *Shahnameh*'s court astrologer and the Greek *magos*: astrolabe and star charts, no fire temple, sacred fire, *haoma* or rite, and no priestly dress beyond what reads as a scholar (15.5). The Magi of the Gospel of Matthew are also venerated in Christianity; keep away from that imagery (the three kings, the star over Bethlehem, gifts).
- **The Swordsman (Proposed, 2026-10-26):** the *youxia*, free swordsmen who kept their word and avenged wrongs; Sima Qian gives them a chapter, and Tang poets sang of them (Li Bai's swordsman "kills one man every ten paces" and leaves without giving his name). A fast melee striker with cheap, quick actions, possibly striking from Stealth, like the *chuanqi* swordswomen (Nie Yinniang, Hongxian) who inspire its abilities without being the hero. Plain travelling clothes and a light *jian* keep it apart from the armoured Vanguard and the Barbarian's slow, heavy blows. Built 2026-10-26: speed 3, power 2, defence 1, a walk of 3, and Swift Strike (above).
- **Speed:** two heroes have high speed (Horse Archer, Swordsman). The Barbarian pays for its damage with low speed, the Vanguard for its armour. Speed sets how often a hero acts: every 60 ÷ (speed + 5) slots ([timeline.md](timeline.md), 3.2).
- **Only four damage heroes:** gear and upgrades can shift tanks and supports toward damage; guaranteed role coverage in recruitment offers would also help (10.7).
- **The Alchemist's ultimate (Proposed): the hand cannon.** A single shot, direct ranged at long range, needing line of fire, for large damage with **Pierce**. Based on the Heilongjiang hand cannon (about 1288, Yuan dynasty), the oldest surviving metal gun, and on the alchemists' discovery of gunpowder; an era stretch like the Mongols'. It gives the healer one decisive shot without making it a damage hero; the ultimate rules (10.10) would keep it to once per fight (ultimates are out of the game since 2026-10-23).
- **Area damage:** no hero has it since 2026-10-26; areas would follow the friendly-fire rules like any other.
- **Every ability reaches both sides** ([map.md](map.md), 6.7, 2026-10-19): heals, cleanses and buffs reach enemies too, so area supports must position away from the melee, and new support kits should lean on single targets or small radii.
- **Unverified details:** signature weapons are proposals and need research for accuracy (for example, the Magus's astrolabe, which reached the Islamic world from Greek astronomy).

**Cultures without heroes**
Egypt, Silla Korea, Nara Japan, Tibet, Srivijaya and Java, the Swahili coast (with Aksum), and since 2026-10-26 South India and Abbasid Arabia have no heroes in this roster. With Egypt removed, no African culture has a hero; Egypt, Aksum and the Swahili coast should be well represented as places and neutral characters, and are strong expansion candidates. They remain part of the setting as places (Nara at the eastern end, the Tibetan passes, the Strait of Malacca, Swahili ports), as neutral characters (traders, innkeepers, guides), and as candidates for expansion heroes. They should not appear only as monsters (15.7).

**Rejected or replaced along the way**
- Named figures (Abe no Seimei, King Gesar, Zal, Gajah Mada, Fumo Liyongo) replaced by roles, for cultural sensitivity. Since 2026-10-16 named **fictional** characters are allowed (owner's call); historical figures and figures still worshipped remain out.
- Paladin and crusader merged; "crusader" dropped because of its association with the Crusades.
- Greek fire engineer rejected: it described a weapon, not a role or figure.
- Simurgh Feather Burner removed (2026-10-26, owner): Persia's area-damage hero until that day, then a healing support for a few hours, replaced by the Magus. The Simurgh stays in the setting as folklore (15.5); it is benevolent, so a candidate for a caravanserai blessing (a heal) rather than a boss.
- Jinn Binder replaced by the Div Binder (2026-10-26, owner): more distinctly Persian once the hero moved to Persia. The Div Binder was then removed the same day, when the Cataphract became Persia's damage hero, the Simurgh Feather Burner its support and the Elephant Rider its tank. Also weighed: keeping the Div Binder as support and taking the Simurgh off the roster (a caravanserai blessing instead).
- Star-Reader replaced by the Jinn Binder (a stronger fantasy wizard than real astronomers); Geomancer (Arabic sand divination) considered.
- Hakawati replaced by the Sha'ir; Naqqal (Persian epic storyteller) and Akyn (steppe poet-singer) considered.
- Batyr replaced by the Bökh Champion (wrestler; the Grappler since 2026-10-26): *batyr* is a title for any renowned steppe warrior, and those warriors were mostly mounted archers, so it didn't stand apart from the horse archer. The title moved to the horse archer, renamed the Baatar (the Mongol form), then the Mangudai Outrider (2026-10-17), and the Horse Archer since 2026-10-26.
- Tomb Robber replaced by the Varangian Guard (the Barbarian since 2026-10-26; heavy melee damage); Medjay (Egyptian desert scouts) considered.
- Nizari "Assassins" avoided: the term originated as a slur against a religious community that still exists.
- Xiangxi Corpse Driver removed: its legends (and the hopping jiangshi) are Qing-era, after the Silk Road, and set in Hunan, off the road. The jiangshi stays available as a creature.
- Fox-Spirit Sorcerer replaced by the Simurgh Feather Burner: as a trickster it played as support, and even recast as a fox-fire caster it left Tang China with three heroes and Persia with one. The fox remains a setting motif (15.6).
- Kalari Duelist (fast melee damage), Mahout Bulwark (an immovable tank on a war elephant) and Sahira Enchantress (a curser) removed with the India and Arabia regions (2026-10-26, owner); the Jinn Binder moved to Persia instead, as the Div Binder (itself removed the same day), and the Mahout Bulwark returned as Persia's tank (the Elephant Rider since 2026-10-26). Their designs are in git history.
- A *chuanqi* swordswoman (Nie Yinniang or Hongxian, named fictional characters of Tang tales) set aside for the Swordsman, a role rather than a person (2026-10-26, owner); also weighed: a Tang crossbowman with Pierce (overlaps the Horse Archer's lanes), a Daoist flying-sword adept (near living religion), a *cike* assassin (its famous examples are historical people).
- Shadow Puppeteer, Caravan Guard, Senapati, Monsoon Navigator and others considered and not used; several remain options for expansion.

## Decision log (from section 13)

| Area | Decision | Alternatives considered | Reason |
|---|---|---|---|
| Persia's heroes | The Elephant Rider (war elephant, tank), the Cataphract (damage), the Magus (track control, support); 2026-10-26 | The Cataphract as tank and the Simurgh as area damage, with the Div Binder (once the Jinn Binder) as support; the Simurgh Feather Burner as a healing support (for a few hours, 2026-10-26) | Sasanian war elephants and shock cavalry; the magus fills the track control the Div Binder left, and healing is the Alchemist's; owner's calls |
| The Elephant Rider's kit (2026-10-27) | Speed 1, defence 3, power 2; Unstoppable (no Push, Pull, Immobilized or Stunned, so no grapple, and hail doesn't stop it); Trample, a walk of up to 2 in a line Pushing every unit in its way back ahead of it, or a plain walk | Speed 0 and defence 4; grapple immunity as a hero trait; Trample Pushing units aside, or only the first unit; Tusk Sweep (melee Push 2); Bodyguard as the starting ability | An immovable tank that controls space with Push, which no starting kit uses; owner's call |
| The Magus's stats (2026-10-27) | Speed 2, defence 1 (health 4), power 0, Inevitable from the start | Low power (the band before) | A pure track controller: no damage, and a card nothing moves, from which his kit can measure; owner's call |
| The Magus's starting ability (2026-10-27) | Conjunction, range 2, Humphrey a target; an Inevitable card still bumped by collisions | Ill Omen as the starter; range 3; an Inevitable card never moving | Owner's call: the swap creates no turns and needs no delay limit |
| Hero roster | Three heroes per region, a tank, a damage hero and a support (2026-10-26; before, 12 heroes from 7 cultures, two each), based on roles or named fictional characters; 4 tanks, 4 damage, 4 support | One hero per culture across 12 cultures; named historical figures; roles only (until 2026-10-16) | Every region gets a full party's worth of heroes; real figures can be culturally sensitive, fictional ones are fair game (owner's call); balanced roles suit random recruitment |
| The Archer and Longshot (2026-10-27) | A Persian foot archer, speed 2, defence 1, power 3, Proposed beside the Cataphract; Longshot, a space on any of six lines at any range, never blocked. The Horse Archer's ability renamed Snap Shot (Longshot in the code before) | A Persian crossbowman (crossbows were Tang China's, not Persia's); a plunging shot at a space 2 or 3 away over any unit; a Nawak Archer with Pierce; a Naphtha Thrower with Burn | Owner's call: a second archer that reaches past the front line where Snap Shot stops at it |
| China damage hero | The Swordsman, a wandering knight-errant with a *jian*: fast melee (2026-10-26) | A *chuanqi* swordswoman (Nie Yinniang, Hongxian); a Tang crossbowman; a Daoist flying-sword adept; a *cike* assassin | A role, not a person, like the Kalari Duelist whose fast-melee niche it takes; very Tang (Li Bai's *Ballad of the Knight-Errant*); owner's call |
| Area-damage caster | None since 2026-10-26, when the Simurgh Feather Burner left the damage role (and then the roster); until then the Simurgh (Persia and Sogdiana), its kit (area strikes and Burn) Proposed | Fox-Spirit Sorcerer as a trickster (illusions, decoys, conceal), then as a fox-fire caster; a thunder-rite master; a gu sorcerer; an Egyptian magician; an onmyōji | The trickster read as support; moving the slot to Persia gives every culture two heroes; owner's call, 2026-10-16 |
| Steppe heroes | The Grappler, a wrestler fighting on foot (tank), and the Horse Archer; the Bökh Champion and the Mangudai Outrider until 2026-10-26 | Batyr (steppe hero-warrior) as the tank beside a Horse Archer; the archer named Baatar (until 2026-10-17); wolf guard (böri); shaman-protector | Batyr is a generic title and steppe warriors were horse archers, so the title fits the archer; the proper Mongol terms; owner's calls, 2026-10-16 and 2026-10-17 |
| Hero names | Plain English role names: Alchemist, Cataphract, Magus, Horse Archer, Grappler, Storm Caller, Elephant Rider, Barbarian, Vanguard, Swordsman (owner, 2026-10-26) | A native term paired with an English role (Waidan Alchemist, Bökh Champion, Mangudai Outrider and the rest, 2026-10-17 to 2026-10-26); Astrologer for the Magus; Axeman for the Barbarian; Wrestler, Strongman or Brawler for the Grappler; Lancer for the Cataphract; Mahout for the Elephant Rider | Plain names read at a glance, and the native terms stay in each hero's inspiration and description; Barbarian is what Byzantine writers called the Varangians ("axe-bearing barbarians"), and the Grappler is the hero's specialty; owner's calls |
| The game's text | No real names, places or cultures in what the player reads: hero stories, the start menu, stage and tile names, the log (owner, 2026-10-26). Cultures and places show only in the art; the docs keep them. So the stages are the Grassland Crossing, the Desert Crossing and the Burning Mountains, a yurt is a Tent, the Swordsman's *jian* a sword, and the camel Humphrey (Temee before) | Stories naming each hero's people and craft ("A Mongol wrestler famed at the naadam games") | The art carries the setting; owner's call |
| Mounts | Reflected only in base stats | Dedicated mount mechanics (cheaper movement, charge, dismounting) | Simplicity; the speed versus defence tradeoff already expresses mounts |

## Open questions (from section 14, original numbers)

33. Hero roster. **Byzantium's tank and support** (since 2026-10-26, three heroes per region): Byzantium has only the Barbarian (damage). Ideas: an *akritas*, a border warrior of the Taurus frontier from the *Digenis Akritas* epic, as the tank; a Byzantine automaton engineer (*mechanikos*) as the support, perhaps with Shield or Haste, which no hero gives. The Steppe, China (the Swordsman filled its damage slot, 2026-10-26) and Persia (the Elephant Rider, Cataphract and Magus) are complete. Also open: signature weapon accuracy, tuned stat values, each hero's abilities and ultimate, and which heroes to prototype first (6 to 8, per 10.8).

**Passives:** an always-on trait rather than an action. The Vanguard's Hold the Line and the Grappler's Inevitable (2026-10-22)
were built and removed again on 2026-10-23; no hero has one now. The
Elephant Rider's Unstoppable is the next candidate. Whether other heroes
get one is open.

**The Storm Caller's second ability** (owner, 2026-10-23): Sunlight,
Empower 2 for a turn, added as measured. Empower 1 (with self-targeting, the
squeeze and melting hail as variants) was worth nothing; at Empower 2 it is
a trap with that day's AI, which counted its +2 at about twice what it
delivered ([balance.md](balance.md#sunlight-as-empower-2026-10-23)). With
the AI's valuation fixed and the kit as it plays (self, melts, squeeze), it
is no longer a trap but still adds nothing, takes Hail's turns, and makes
enemy Storm Callers stronger ([balance.md](balance.md#sunlight-as-it-plays-and-the-ais-valuation-2026-10-23)).
Open: whether it stays.
