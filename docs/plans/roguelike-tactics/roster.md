# Roguelike tactics: hero roster

The twelve heroes: identity, roles, stat profiles, mounts, and what was considered.

> Part of the roguelike tactics plan. Start at [README.md](README.md),
> which maps every combat-design section number ("section 3.4") to its
> file and indexes every decision. Abandoned approaches are in
> [history.md](history.md).

Rules are marked **Decided** or **Proposed**; numbers marked TBD are
tuning. Section numbers are the combat design's.

### 15.8 Hero Roster (Decided, working roster)
Twelve heroes drawn from **six cultures**, two heroes each except the **Mongol**, which has three, and **Byzantium**, which has one since the Strategos was removed and the Yadachi Storm Caller added (open question 33). Every hero is based on a **role** (a profession, unit or folklore type) or a **named fictional character** (from a novel, epic or folk tale); never a real historical individual, since real figures can be culturally sensitive. Figures still worshipped today stay out (15.5).

**Mechanical roles**
- **Tank:** protects allies, absorbs or prevents damage, holds space.
- **Damage:** primary source of kills.
- **Support:** heals, buffs, or controls the board and the track.

The roster is balanced at **4 tanks, 4 damage, 4 support**, so that limited, random recruitment offers (10.6) can usually supply each role.

**Identity and role**

| # | Name | Culture | Inspiration (historical, folklore or mythical role) | Type | Fantasy RPG archetype | Mechanical role | Specialty | Mount | Signature weapon (proposed) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Waidan Alchemist | Tang China | The fangshi ("masters of methods"), Chinese alchemists and healers, and *waidan* ("external alchemy"), the making of elixirs by heating minerals and metals in sealed crucibles; Chinese alchemists seeking an elixir of life discovered gunpowder | Historical | Alchemist | Support | Healer: elixirs and remedies | None | Elixir gourd |
| 2 | Persian Cataphract | Persia and Sogdiana | The cataphracts, armoured heavy cavalry; in Persia the savaran (aswaran), the Sasanian armoured noble cavalry. Heavy cavalry of this kind served many armies on the road | Historical | Knight / paladin | Tank | Mobile charger | Armoured horse | Heavy lance |
| 3 | Simurgh Summoner | Persia and Sogdiana | The Simurgh of the *Shahnameh*, the great bird that comes when one of its feathers is burned | Folklore | Summoner / sorcerer | Damage | Area caster: burns Simurgh feathers to call down sweeping strikes and fire (Burn) | None | Simurgh feathers and a brazier |
| 4 | Mangudai Outrider | Mongol | The mangudai, units of the Mongol army (sources disagree on what they were: light cavalry, vanguards or "suicide troops"); Mongol warriors fought as mounted archers | Historical | Ranger | Damage | Ranged: line of fire matters most | Horse | Composite bow |
| 5 | Bökh Champion | Mongol | Champion wrestlers (bökh), the highlight of the naadam games and of feasts in the epics | Historical | Brawler / grappler | Tank | Grappler: grabs, pins and throws enemies to hold the front line | None | Bare hands (wrestling vest) |
| 6 | Yadachi Storm Caller | Mongol | The yadachi, Turkic and Mongol weather-workers believed born with the power to steer storms and hail, and the rain stone (*yada*, *jada*) poured over with water to summon them; in the *Secret History of the Mongols* (143) a storm called this way turns back on its casters | Folklore | Druid / storm caller | Support | Storm controller (Proposed): storms and hail over areas slow enemies and drive them across the board (Slowed, Displace); bad weather can be turned away from allies | None | Rain stone and water |
| 7 | Jinn Binder | Abbasid Arabia | Jinn sealed in vessels and bound to serve, from the *Arabian Nights* tradition (for example "The Fisherman and the Jinni") | Folklore | Wizard | Support | Controller: a bound jinn pushes back and disrupts enemy turns | None | Sealed brass vessel |
| 8 | Sahira Enchantress | Abbasid Arabia | The enchantresses (Arabic *sāḥira*, sorceress) of the *Arabian Nights*: Queen Lab, who turned the men of her city into beasts, and the king's daughter in "The Second Kalandar's Tale", who fought an ifrit in a battle of transformations | Folklore | Witch / enchanter | Support | Curser (Proposed): transformations weaken enemies (stats down, Slowed) | None | Spells and enchanted water (proposed, unverified) |
| 9 | Kalari Duelist | South India | Practitioners of kalaripayattu, the martial art of Kerala | Historical | Martial artist | Damage | Fast melee: cheap, quick actions | None | Urumi (flexible sword) |
| 10 | Mahout Bulwark | South India | The mahout, driver of the war elephants of Indian armies | Historical | Juggernaut / beast rider | Tank | Immovable wall: resists Displace (passive) | War elephant | Ankus (elephant goad) and spear |
| 11 | Varangian Guard | Byzantium | The Varangian Guard, the Norse axe-bearing bodyguard of the Byzantine emperors | Historical | Barbarian / heavy warrior | Damage | Heavy melee: slow, hard-hitting burst | None | Great axe |
| 12 | Modao Vanguard | Tang China | The modao troops, elite Tang infantry armed with the modao, a long two-handed blade, and placed at the front of the army as spearheads | Historical | Guardian / polearm warrior | Tank | Challenger (Proposed): taunts enemies onto itself and cuts down those who close in with wide sweeps | None | Modao (long two-handed blade) |

**Stat profiles (relative, untuned)**

Influence was folded into power (2026-10-18; [heroes-and-gear.md](heroes-and-gear.md), 9.2). Power scales only base damage and base healing, so the control supports (Yadachi Storm Caller, Jinn Binder, Sahira Enchantress), whose effects no longer scale with any stat, keep low power; the Waidan Alchemist, a healer, rises from low to medium because power now scales its heals. Health is fixed per hero, in three tiers (Low 240, Medium 320, High 440) plus the war elephant's Very high (9.1).

| Name | Health | Speed | Defence | Power |
|---|---|---|---|---|
| Waidan Alchemist | Medium | Medium | Low | Medium |
| Persian Cataphract | High | Medium | High | Medium |
| Simurgh Summoner | Low | Medium | Low | High |
| Mangudai Outrider | Low | High | Low | High |
| Bökh Champion | High | Medium | High | Medium |
| Yadachi Storm Caller | Low | Medium | Low | Low |
| Jinn Binder | Low | Medium | Low | Low |
| Sahira Enchantress | Medium | Medium | Low | Low |
| Kalari Duelist | Medium | High | Low | High |
| Mahout Bulwark | Very high | Very low | Very high | Medium |
| Varangian Guard | High | Low | Medium | High |
| Modao Vanguard | High | Low | High | Medium |

**Mounts (Decided)**
- Mounts have **no mechanics of their own**. Mounted heroes follow all normal rules (one hex, conceal, line of fire).
- A mount is reflected only in the hero's **base stats**: a horse raises speed; the Persian Cataphract's armoured horse offsets the speed cost of its armour; the war elephant gives very high defence and health at very low speed. A mount's speed divides the hero's costs like any speed (section 4).

**Notes**
- **Distinct tanks:** the Persian Cataphract charges in, the Bökh Champion holds the front line by grappling (on foot, unlike the mounted Mangudai Outrider), and the Mahout Bulwark cannot be moved (it resists Displace as a passive, but not Push). The Modao Vanguard draws attacks onto itself (Taunt, including redirecting charged abilities, 17.5) and punishes enemies who close in.
- **Support needs:** healing (Waidan Alchemist), control on the track (Jinn Binder, pushing enemies back), curses (Sahira Enchantress) and control in space (Yadachi Storm Caller, storms that slow and displace). Buffs and turn-order acceleration are uncovered.
- **The Yadachi Storm Caller (Proposed):** a storm controller, not a damage caster: its storms slow and move enemies, while the Simurgh Summoner's strikes hurt and burn. The *Secret History*'s storm that turns back on its casters suggests a risk mechanic (a storm that can hit its own side). The yadachi tradition is folk belief rather than an organised religion, but it sits near steppe shamanism, which is still practised; keep it to weather-working and away from shamanic ritual (15.5).
- **Two Arabian Nights magic users:** the Jinn Binder acts through a bound spirit that moves enemies on the track; the Sahira Enchantress casts directly, transforming enemies to weaken them. Keep their visual language distinct (a smoky spirit from a brass vessel versus spells that change a unit's shape).
- **The Sahira Enchantress (Proposed):** a fictional role drawn from the *Nights*' enchantresses, who are mostly villains there; the hero keeps their transformation magic and turns it on the party's enemies. Its signature props need research.
- **Damage covers four niches:** area caster (Simurgh Summoner), ranged (Mangudai Outrider), fast melee (Kalari Duelist), heavy melee (Varangian Guard).
- **The Simurgh Summoner (Proposed):** each ability burns a feather; the Simurgh's strikes sweep areas and leave fire (Burn), so its damage comes in two parts: a big hit up front, scaled by power, and burns left behind, whose values are set by the abilities. The Simurgh appears for the strike and leaves; it never stays on the board which keeps it apart from the Jinn Binder's bound jinn. Its abilities hurt; control stays with the supports. Fragile (low health and defence) is the price of its damage.
- **Two summoners of great spirits:** the Jinn Binder's jinn pushes and disrupts; the Simurgh strikes and burns. Keep their visual language distinct (a smoky spirit from a brass vessel versus a vast bird from the sky).
- **The Simurgh as religious-adjacent material:** it has roots in Zoroastrian texts, a living religion. Keep to the *Shahnameh*'s epic framing (15.5).
- **Jinn as religious-adjacent material:** jinn also appear in the Qur'an. Keep to the *Arabian Nights* folklore framing (15.5). In "The Fisherman and the Jinni", the jinni was sealed in his jar by Solomon, a prophet in Islam; use the motif of a jinn sealed in a vessel without the religious figure.
- **Speed:** two heroes have high speed (Mangudai Outrider, Kalari Duelist). The Varangian Guard pays for its damage with low speed, the Modao Vanguard for its armour. Speed divides every cost, so it sets how often a hero acts (4.1, with diminishing returns); keep high speed rare.
- **Only four damage heroes:** gear and upgrades can shift tanks and supports toward damage; guaranteed role coverage in recruitment offers would also help (10.7).
- **The Waidan Alchemist's ultimate (Proposed): the hand cannon.** A single shot, direct ranged at long range, needing line of fire, for large damage with **Pierce**. Based on the Heilongjiang hand cannon (about 1288, Yuan dynasty), the oldest surviving metal gun, and on the alchemists' discovery of gunpowder; an era stretch like the Mongols'. It gives the healer one decisive shot without making it a damage hero; the ultimate rules (10.10) keep it to once per fight, unlocked by turns.
- **Area damage:** the Simurgh Summoner is the area-damage hero; its areas follow the friendly-fire rules like any other.
- **Boss conflict:** the multi-hex boss example (11.3) should use a creature other than a war elephant, so it reads differently from the Mahout Bulwark.
- **Unverified details:** signature weapons are proposals and need research for accuracy (for example, the Simurgh Summoner's brazier).

**Cultures without heroes**
Egypt, Silla Korea, Nara Japan, Tibet, Srivijaya and Java, and the Swahili coast (with Aksum) have no heroes in this roster. With Egypt removed, no African culture has a hero; Egypt, Aksum and the Swahili coast should be well represented as places and neutral characters, and are strong expansion candidates. They remain part of the setting as places (Nara at the eastern end, the Tibetan passes, the Strait of Malacca, Swahili ports), as neutral characters (traders, innkeepers, guides), and as candidates for expansion heroes. They should not appear only as monsters (15.7).

**Rejected or replaced along the way**
- Named figures (Abe no Seimei, King Gesar, Zal, Gajah Mada, Fumo Liyongo) replaced by roles, for cultural sensitivity. Since 2026-10-16 named **fictional** characters are allowed (owner's call); historical figures and figures still worshipped remain out.
- Paladin and crusader merged; "crusader" dropped because of its association with the Crusades.
- Greek fire engineer rejected: it described a weapon, not a role or figure.
- Star-Reader replaced by the Jinn Binder (a stronger fantasy wizard than real astronomers); Geomancer (Arabic sand divination) considered.
- Hakawati replaced by the Sha'ir; Naqqal (Persian epic storyteller) and Akyn (steppe poet-singer) considered.
- Batyr replaced by the Bökh Champion (wrestler): *batyr* is a title for any renowned steppe warrior, and those warriors were mostly mounted archers, so it didn't stand apart from the horse archer. The title moved to the horse archer, renamed the Baatar (the Mongol form), then the Mangudai Outrider (2026-10-17).
- Tomb Robber replaced by the Varangian Guard (heavy melee damage); Medjay (Egyptian desert scouts) considered.
- Nizari "Assassins" avoided: the term originated as a slur against a religious community that still exists.
- Xiangxi Corpse Driver removed: its legends (and the hopping jiangshi) are Qing-era, after the Silk Road, and set in Hunan, off the road. The jiangshi stays available as a creature.
- Fox-Spirit Sorcerer replaced by the Simurgh Summoner: as a trickster it played as support, and even recast as a fox-fire caster it left Tang China with three heroes and Persia with one. The fox remains a setting motif (15.6).
- Shadow Puppeteer, Caravan Guard, Senapati, Monsoon Navigator and others considered and not used; several remain options for expansion.

## Decision log (from section 13)

| Area | Decision | Alternatives considered | Reason |
|---|---|---|---|
| Hero roster | 12 heroes from 6 cultures, two each, based on roles or named fictional characters; 4 tanks, 4 damage, 4 support (since 2026-10-17 the Mongol has three heroes and Byzantium one) | One hero per culture across 12 cultures; named historical figures; roles only (until 2026-10-16) | Every culture gets depth; real figures can be culturally sensitive, fictional ones are fair game (owner's call); balanced roles suit random recruitment |
| Area-damage caster | The Simurgh Summoner (Persia and Sogdiana); its kit (area strikes and Burn) Proposed | Fox-Spirit Sorcerer as a trickster (illusions, decoys, conceal), then as a fox-fire caster; a thunder-rite master; a gu sorcerer; an Egyptian magician; an onmyōji | The trickster read as support; moving the slot to Persia gives every culture two heroes; owner's call, 2026-10-16 |
| Steppe heroes | Bökh Champion, a wrestler and grappler fighting on foot (tank); the horse archer is named Mangudai Outrider | Batyr (steppe hero-warrior) as the tank beside a Horse Archer; the archer named Baatar (until 2026-10-17); wolf guard (böri); shaman-protector | Batyr is a generic title and steppe warriors were horse archers, so the title fits the archer; the proper Mongol terms; owner's calls, 2026-10-16 and 2026-10-17 |
| Mounts | Reflected only in base stats | Dedicated mount mechanics (cheaper movement, charge, dismounting) | Simplicity; the speed versus defence tradeoff already expresses mounts |

## Open questions (from section 14, original numbers)

33. Hero roster. **Culture balance** (since 2026-10-17): the Yadachi Storm Caller made the Mongol three heroes and Byzantium has one (the Strategos was removed; the Abbasid slot went to the Sahira Enchantress). Options: accept it, or add a second Byzantine hero (ideas: a Byzantine automaton engineer, mechanikos; an akrites-style scout; Digenis Akritas, replacing the Varangian Guard as a local damage hero). The Tang China tank slot is filled by the Modao Vanguard (2026-10-17); a Shaolin warrior monk was the earlier candidate (Sun Wukong goes to bosses instead, 15.6). Tabled 2026-10-16: a Tang China damage hero, such as a *chuanqi* swordswoman-assassin striking from Stealth, a Tang crossbowman with Pierce, or a Daoist flying-sword adept, as a replacement or expansion): signature weapon accuracy, tuned stat values, each hero's abilities and ultimate, and which heroes to prototype first (6 to 8, per 10.8).

**Passives:** the Mahout Bulwark's Displace resistance is the first
**passive**, an always-on trait rather than an action. The
combat design has no passive abilities yet; how passives are shown
(design language, 7.1) and whether other heroes get one is open.
