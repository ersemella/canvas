# Roguelike tactics: hero roster

The twelve heroes: identity, roles, stat profiles, mounts, and what was considered.

> Part of the roguelike tactics plan. Start at [README.md](README.md),
> which maps every combat-design section number ("section 3.4") to its
> file and indexes every decision. Abandoned approaches are in
> [history.md](history.md).

Rules are marked **Decided** or **Proposed**; numbers marked TBD are
tuning. Section numbers are the combat design's.

### 15.8 Hero Roster (Decided, working roster)
Twelve heroes drawn from **seven cultures**, two heroes each except **Turkic** (the Yadachy Storm Caller, who shares the Steppe region with the Mongol heroes) and **Byzantium** (since the Strategos was removed), which have one each (open question 33). Every hero is based on a **role** (a profession, unit or folklore type) or a **named fictional character** (from a novel, epic or folk tale); never a real historical individual, since real figures can be culturally sensitive. Figures still worshipped today stay out (15.5).

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
| 6 | Yadachy Storm Caller | Turkic | The yadachy of Turkic folk belief (in Turkish, Azeri, Kazakh, Kyrgyz and Bashkir traditions): weather-workers born with the power, marked by a caul, to lead storms and hail away from their land, send them onto rivals' fields, and fight storm-bringing demons and rival yadachy with their souls while they sleep; tied to the rain stone (*yada tashy*). The Mongols shared the stone (*jada*): in the *Secret History of the Mongols* (143) a storm raised with it turns back on its casters | Folklore | Druid / storm caller | Support | Storm controller: hail that Immobilizes whoever it catches until the Storm Caller's next turn (2026-10-23; earlier kits with Slowed, fog, a track Push, healing Sunlight and a freezing ultimate are in [history.md](history.md)) | None | Rain stone and water |
| 7 | Jinn Binder | Abbasid Arabia | Jinn sealed in vessels and bound to serve, from the *Arabian Nights* tradition (for example "The Fisherman and the Jinni") | Folklore | Wizard | Support | Controller: a bound jinn pushes back and disrupts enemy turns | None | Sealed brass vessel |
| 8 | Sahira Enchantress | Abbasid Arabia | The enchantresses (Arabic *sāḥira*, sorceress) of the *Arabian Nights*: Queen Lab, who turned the men of her city into beasts, and the king's daughter in "The Second Kalandar's Tale", who fought an ifrit in a battle of transformations | Folklore | Witch / enchanter | Support | Curser (Proposed): transformations weaken enemies (Degrade, stats down) | None | Spells and enchanted water (proposed, unverified) |
| 9 | Kalari Duelist | South India | Practitioners of kalaripayattu, the martial art of Kerala | Historical | Martial artist | Damage | Fast melee: cheap, quick actions | None | Urumi (flexible sword) |
| 10 | Mahout Bulwark | South India | The mahout, driver of the war elephants of Indian armies | Historical | Juggernaut / beast rider | Tank | Immovable wall: Unstoppable (passive) | War elephant | Ankus (elephant goad) and spear |
| 11 | Varangian Guard | Byzantium | The Varangian Guard, the Norse axe-bearing bodyguard of the Byzantine emperors | Historical | Barbarian / heavy warrior | Damage | Heavy melee: slow, hard-hitting burst | None | Great axe |
| 12 | Modao Vanguard | Tang China | The modao troops, elite Tang infantry armed with the modao, a long two-handed blade, and placed at the front of the army as spearheads | Historical | Guardian / polearm warrior | Tank | Challenger: draws enemies onto itself and punishes those who close in. Its first kit (built 2026-10-22, removed 2026-10-23 with action costs; [history.md](history.md)) punished enemies walking away from it, taunted, guarded itself with a Barrier and pushed what it hit back on the track | None | Modao (long two-handed blade) |

**Stat profiles (relative, untuned)**

These bands predate the stats' rework (owner, 2026-10-23; [heroes-and-gear.md](heroes-and-gear.md), 9.1): stats are now small whole numbers, health is (1 + defence) × 2 and power is exactly an ability's damage. The three prototype heroes' numbers are set (below); the others' bands are a guide for when they are built. Power is the damage of every ability, so the control supports (Jinn Binder, Sahira Enchantress) keep low power.

| Name | Health | Speed | Defence | Power |
|---|---|---|---|---|
| Waidan Alchemist | Medium | Medium | Low | Medium |
| Persian Cataphract | High | Medium | High | Medium |
| Simurgh Summoner | Low | Medium | Low | High |
| Mangudai Outrider | Low | High | Low | High |
| Bökh Champion | High | Medium | Medium | Low |
| Yadachy Storm Caller | Medium | Medium | Medium | Medium |
| Jinn Binder | Low | Medium | Low | Low |
| Sahira Enchantress | Medium | Medium | Low | Low |
| Kalari Duelist | Medium | High | Low | High |
| Mahout Bulwark | Very high | Very low | Very high | Medium |
| Varangian Guard | High | Low | Medium | High |
| Modao Vanguard | Medium | Low | High | Medium |

**The prototype heroes' kits (owner, 2026-10-23; built)**

Every ability deals exactly its user's power in damage (9.2). Each hero
also has Hold.

| Hero | Speed | Defence | Power | Health | Ability | Effect |
|---|---|---|---|---|---|---|
| Bökh Champion | 2 | 3 | 1 | 8 | Grapple | **Melee**: a unit next to the Champion (owner, 2026-10-23; until then it reached 2 spaces, stepping in first). It takes 1 damage and is **Stunned** until the grapple ends: the Champion takes damage, is Stunned, or the two are no longer next to each other (either moved; the Champion may walk while it grapples, and the grapple holds if the walk ends next to the target). At the start of each of the Champion's turns while it lasts, the target takes 1 more, plus the Champion's Enhance if it has one (owner, 2026-10-23). One target at a time: a new grapple lets the last go, and it can't target the unit it already grapples. A chain on the board joins the two while it lasts (owner, 2026-10-23). |
| | | | | | Throw | Only the unit it grapples: **Moves** it to a free space next to the Champion, or swaps places with it (the Champion's own space as the landing; not while the Champion is Immobilized), then it takes 1 damage. The grapple holds (owner, 2026-10-23; the swap added the same day). |
| Mangudai Outrider | 3 | 1 | 2 | 4 | Bow | Unchanged in shape: six straight lanes with no range limit, hitting the first unit in a lane (an ally included), stopped by ruins. 2 damage. |
| | | | | | Skirmish | One step to a free space next to the Outrider (not while Immobilized), then the Bow's shot from there, along any of its six lanes. **Charged**: the Outrider's card goes half its action cost on (4 slots), greyed, and the arrow flies when it comes back, in place of a turn: the first unit in that lane then takes 2 (the Outrider's power), so its target can step out, and another unit can step in. The lane shows marked while the arrow is drawn; it is lost if the Outrider falls first. Owner, 2026-10-23: in place of Volley ([balance.md](balance.md#skirmish-in-place-of-volley-2026-10-23)). |
| Yadachy Storm Caller | 2 | 2 | 1 | 6 | Hail | One space within 3 (not ruins). It stays until the Storm Caller's next turn begins (or it falls). A unit in the space when it lands, or that enters it (walking, which stops there, or Moved), is **Immobilized** until the hail disappears. Its damage is the Storm Caller's power, 1 (owner, 2026-10-23; 0 before). |
| | | | | | Sunlight | One space within 3 (not ruins). Hail there melts, freeing whoever it held. A unit there that hits (not Temee), ally or enemy, the Storm Caller itself included, not already Enhanced, is **Enhanced 2** until the end of its next turn. No damage. A player is offered only its own side and spaces of hail. Owner, 2026-10-23: added as measured (a trap for today's AI), then with self-targeting and melting ([balance.md](balance.md#sunlight-as-enhance-2026-10-23)). |

The Bökh Champion's Inevitable (2026-10-22) went with this rework: the
owner's notes leave it out, and nothing Delays any more. The kits they
replace (Hail as an area with damage and a track Push; Grapple Immobilizing
for 12 slots with base 60 damage; Throw landing beside the Champion for
base 120) are in [history.md](history.md).

**Added 2026-10-23 (owner):** Skirmish for the Outrider, in place of
Volley ([history.md](history.md)). Earlier the same day: Volley for the Outrider (range 2) and the
swap as one of Throw's landings (rather than an ability of its own, so the
Champion keeps one button for it). Overwatch, the first Sunlight (heal and
cleanse) and Fog were built, measured and removed with their code
([history.md](history.md), [balance.md](balance.md#new-abilities-2026-10-23)).

**Added 2026-10-23 (owner):** Sunlight as Enhance 2 for the Storm Caller,
as measured, though the AI misuses it
([balance.md](balance.md#sunlight-as-enhance-2026-10-23)); then (owner, the
same day) targeting itself, melting hail, and an Enhanced Champion's
squeeze dealing its Enhance more.

**First measurements (2026-10-23, [balance.md](balance.md#the-2026-10-23-rework)):**
Grapple decides fights (a side without it wins 6% of AI-vs-AI fights),
Throw is almost never used (3% of the Champion's turns; a side without it
wins 50%), and Hail is worth having (34% without it).

**Removed from the game (2026-10-23):** the Modao Vanguard's kit (Hold the
Line, Challenge, Reap, Advance; built 2026-10-22 for playtesting and then
parked) and the parked abilities (Leap, Volley, Sunlight, Freeze, Lunge,
Shove), with their code. They were built on action costs and the old
numbers; their designs are in git history and [history.md](history.md),
and the Modao Vanguard stays in the roster above as a hero to build again.

**Mounts (Decided)**
- Mounts have **no mechanics of their own**. Mounted heroes follow all normal rules (one hex, conceal, line of fire).
- A mount is reflected only in the hero's **base stats**: a horse raises speed; the Persian Cataphract's armoured horse offsets the speed cost of its armour; the war elephant gives very high defence and health at very low speed.

**Notes**
- **Distinct tanks:** the Persian Cataphract charges in, the Bökh Champion holds the front line by grappling (on foot, unlike the mounted Mangudai Outrider), and the Mahout Bulwark cannot be moved (Unstoppable as a passive: no Push, Pull or Immobilized, but it can still be Delayed). The Modao Vanguard draws attacks onto itself and punishes enemies who close in (its Taunt went with the 2026-10-23 keywords; its kit is to be redesigned).
- **Support needs:** healing (Waidan Alchemist; healing has no keyword since 2026-10-23), control on the track (Jinn Binder, Delaying enemies), curses (Sahira Enchantress: Degrade) and control in space (Yadachy Storm Caller, hail that Immobilizes, and Sunlight's Enhance). Shield and Haste are uncovered.
- **The Yadachy Storm Caller:** a storm controller, not a damage caster (power 1, its hail's sting; 0 until 2026-10-23): its hail holds enemies fast, while the Simurgh Summoner's strikes hurt and burn. The *Secret History*'s storm that turns back on its casters suggests a risk mechanic (a storm that can hit its own side). The yadachy tradition is folk belief rather than an organised religion, but it sits near steppe shamanism, which is still practised; keep it to weather-working and away from shamanic ritual (15.5).
- **Two Arabian Nights magic users:** the Jinn Binder acts through a bound spirit that moves enemies on the track; the Sahira Enchantress casts directly, transforming enemies to weaken them. Keep their visual language distinct (a smoky spirit from a brass vessel versus spells that change a unit's shape).
- **The Sahira Enchantress (Proposed):** a fictional role drawn from the *Nights*' enchantresses, who are mostly villains there; the hero keeps their transformation magic and turns it on the party's enemies. Its signature props need research.
- **Damage covers four niches:** area caster (Simurgh Summoner), ranged (Mangudai Outrider), fast melee (Kalari Duelist), heavy melee (Varangian Guard).
- **The Simurgh Summoner (Proposed):** each ability burns a feather; the Simurgh's strikes sweep areas and leave fire (Burn), so its damage comes in two parts: a big hit up front, scaled by power, and burns left behind, whose values are set by the abilities. The Simurgh appears for the strike and leaves; it never stays on the board which keeps it apart from the Jinn Binder's bound jinn. Its abilities hurt; control stays with the supports. Fragile (low health and defence) is the price of its damage.
- **Two summoners of great spirits:** the Jinn Binder's jinn pushes and disrupts; the Simurgh strikes and burns. Keep their visual language distinct (a smoky spirit from a brass vessel versus a vast bird from the sky).
- **The Simurgh as religious-adjacent material:** it has roots in Zoroastrian texts, a living religion. Keep to the *Shahnameh*'s epic framing (15.5).
- **Jinn as religious-adjacent material:** jinn also appear in the Qur'an. Keep to the *Arabian Nights* folklore framing (15.5). In "The Fisherman and the Jinni", the jinni was sealed in his jar by Solomon, a prophet in Islam; use the motif of a jinn sealed in a vessel without the religious figure.
- **Speed:** two heroes have high speed (Mangudai Outrider, Kalari Duelist). The Varangian Guard pays for its damage with low speed, the Modao Vanguard for its armour. Speed sets how often a hero acts: every 60 ÷ (speed + 5) slots ([timeline.md](timeline.md), 3.2).
- **Only four damage heroes:** gear and upgrades can shift tanks and supports toward damage; guaranteed role coverage in recruitment offers would also help (10.7).
- **The Waidan Alchemist's ultimate (Proposed): the hand cannon.** A single shot, direct ranged at long range, needing line of fire, for large damage with **Pierce**. Based on the Heilongjiang hand cannon (about 1288, Yuan dynasty), the oldest surviving metal gun, and on the alchemists' discovery of gunpowder; an era stretch like the Mongols'. It gives the healer one decisive shot without making it a damage hero; the ultimate rules (10.10) would keep it to once per fight (ultimates are out of the game since 2026-10-23).
- **Area damage:** the Simurgh Summoner is the area-damage hero; its areas follow the friendly-fire rules like any other.
- **Every ability reaches both sides** ([map.md](map.md), 6.7, 2026-10-19): heals, cleanses and buffs reach enemies too, so area supports must position away from the melee, and new support kits should lean on single targets or small radii.
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
| Hero roster | 12 heroes from 7 cultures, two each (Turkic and Byzantium one each since 2026-10-17), based on roles or named fictional characters; 4 tanks, 4 damage, 4 support | One hero per culture across 12 cultures; named historical figures; roles only (until 2026-10-16) | Every culture gets depth; real figures can be culturally sensitive, fictional ones are fair game (owner's call); balanced roles suit random recruitment |
| Area-damage caster | The Simurgh Summoner (Persia and Sogdiana); its kit (area strikes and Burn) Proposed | Fox-Spirit Sorcerer as a trickster (illusions, decoys, conceal), then as a fox-fire caster; a thunder-rite master; a gu sorcerer; an Egyptian magician; an onmyōji | The trickster read as support; moving the slot to Persia gives every culture two heroes; owner's call, 2026-10-16 |
| Steppe heroes | Bökh Champion, a wrestler and grappler fighting on foot (tank); the horse archer is named Mangudai Outrider | Batyr (steppe hero-warrior) as the tank beside a Horse Archer; the archer named Baatar (until 2026-10-17); wolf guard (böri); shaman-protector | Batyr is a generic title and steppe warriors were horse archers, so the title fits the archer; the proper Mongol terms; owner's calls, 2026-10-16 and 2026-10-17 |
| Mounts | Reflected only in base stats | Dedicated mount mechanics (cheaper movement, charge, dismounting) | Simplicity; the speed versus defence tradeoff already expresses mounts |

## Open questions (from section 14, original numbers)

33. Hero roster. **Culture balance** (since 2026-10-17): the Yadachy Storm Caller is Turkic, a seventh hero culture sharing the Steppe region with the Mongol (the region was widened from Mongolia, 2026-10-18), so the Steppe has three heroes; Byzantium has one (the Strategos was removed; the Abbasid slot went to the Sahira Enchantress). Options: accept it, or add a second Byzantine hero (ideas: a Byzantine automaton engineer, mechanikos; an akrites-style scout; Digenis Akritas, replacing the Varangian Guard as a local damage hero). The Tang China tank slot is filled by the Modao Vanguard (2026-10-17); a Shaolin warrior monk was the earlier candidate (Sun Wukong goes to bosses instead, 15.6). Tabled 2026-10-16: a Tang China damage hero, such as a *chuanqi* swordswoman-assassin striking from Stealth, a Tang crossbowman with Pierce, or a Daoist flying-sword adept, as a replacement or expansion): signature weapon accuracy, tuned stat values, each hero's abilities and ultimate, and which heroes to prototype first (6 to 8, per 10.8).

**Passives:** an always-on trait rather than an action. The Modao
Vanguard's Hold the Line and the Bökh Champion's Inevitable (2026-10-22)
were built and removed again on 2026-10-23; no hero has one now. The
Mahout Bulwark's Unstoppable is the next candidate. Whether other heroes
get one is open.

**The Storm Caller's second ability** (owner, 2026-10-23): Sunlight,
Enhance 2 for a turn, added as measured. Enhance 1 (with self-targeting, the
squeeze and melting hail as variants) was worth nothing; at Enhance 2 it is
a trap with that day's AI, which counted its +2 at about twice what it
delivered ([balance.md](balance.md#sunlight-as-enhance-2026-10-23)). With
the AI's valuation fixed and the kit as it plays (self, melts, squeeze), it
is no longer a trap but still adds nothing, takes Hail's turns, and makes
enemy Storm Callers stronger ([balance.md](balance.md#sunlight-as-it-plays-and-the-ais-valuation-2026-10-23)).
Open: whether it stays.
