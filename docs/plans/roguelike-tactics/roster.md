# Roguelike tactics: hero roster

The twelve heroes: identity, roles, stat profiles, mounts, and what was considered.

> Part of the roguelike tactics plan. Start at [README.md](README.md),
> which maps every combat-design section number ("section 3.4") to its
> file and indexes every decision. Abandoned approaches are in
> [history.md](history.md).

Rules are marked **Decided** or **Proposed**; numbers marked TBD are
tuning. Section numbers are the combat design's.

### 15.8 Hero Roster (Decided, working roster)
Twelve heroes drawn from **six cultures**. Cultures most central to the Silk Road carry more than one hero. Every hero is based on a **role** (a profession, unit or folklore type), never a specific named historical, legendary or mythical individual, since named figures can be culturally sensitive.

**Mechanical roles**
- **Tank:** protects allies, absorbs or prevents damage, holds space.
- **Damage:** primary source of kills.
- **Support:** heals, buffs, or controls the board and the track.

The roster is balanced at **4 tanks, 4 damage, 4 support**, so that limited, random recruitment offers (10.6) can usually supply each role.

**Identity and role**

| # | Name | Culture | Inspiration (historical, folklore or mythical role) | Type | Fantasy RPG archetype | Mechanical role | Specialty | Mount | Signature weapon (proposed) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Corpse Driver | Tang China | Jiangshi (hopping corpses) and the folk profession of escorting corpses home | Folklore | Necromancer | Tank | Minion screen: jiangshi block lines of fire and melee | None | Bell and staff |
| 2 | Fox-Spirit Sorcerer | Tang China | Huli jing, fox spirits who take human form | Folklore | Sorcerer | Damage | Fox-fire caster: area damage and Burn; trickery only keeps itself alive | None | Fan |
| 3 | Alchemist | Tang China | Chinese alchemists seeking elixirs, whose work led to gunpowder | Historical | Alchemist | Support | Healer: elixirs and remedies | None | Elixir gourd |
| 4 | Cataphract | Persia and Sogdiana | Sasanian heavily armoured cavalry (savaran) | Historical | Knight / paladin | Tank | Mobile charger | Armoured horse | Heavy lance |
| 5 | Horse Archer | Steppe peoples | Mounted archers of the Turkic and Mongol steppe | Historical | Ranger | Damage | Ranged: line of fire matters most | Horse | Composite bow |
| 6 | Batyr | Steppe peoples | The batyr or baatar, the hero-warrior of steppe tradition | Historical | Barbarian | Tank | Frontline holder | None | Sabre |
| 7 | Djinn-Binder | Abbasid Arabia | Djinn sealed in vessels and bound to serve, from the *Arabian Nights* tradition (for example "The Fisherman and the Jinni") | Folklore | Wizard | Support | Controller: a bound djinn pushes back and disrupts enemy turns | None | Sealed brass vessel |
| 8 | Sha'ir | Abbasid Arabia | The pre-Islamic Arab poet, believed to be inspired by jinn, whose satire was feared as a curse on enemies | Historical and folklore | Bard | Support | Buffer and curser: verses inspire allies, satire weakens enemies | None | Recited verse (no weapon; a rebab as a possible prop) |
| 9 | Strategos | Byzantium | The Byzantine general and military governor | Historical | Warlord / commander | Support | Commander: directs allies, pulls their turns earlier | Optional horse | Sword and banner |
| 10 | Kalari Duelist | South India | Practitioners of kalaripayattu, the martial art of Kerala | Historical | Martial artist | Damage | Fast melee: cheap, quick actions | None | Urumi (flexible sword) |
| 11 | Elephant Rider | South India | The war elephants of Indian armies | Historical | Juggernaut / beast rider | Tank | Immovable wall: resists Displace (passive) | War elephant | Ankus (elephant goad) and spear |
| 12 | Varangian Guard | Byzantium | The Varangian Guard, the Norse axe-bearing bodyguard of the Byzantine emperors | Historical | Barbarian / heavy warrior | Damage | Heavy melee: slow, hard-hitting burst | None | Great axe |

**Stat profiles (relative, untuned)**

| Name | Health | Speed | Defence | Power | Influence |
|---|---|---|---|---|---|
| Corpse Driver | Medium | Medium | Low | Low | High |
| Fox-Spirit Sorcerer | Low | Medium | Low | High | Medium |
| Alchemist | Medium | Medium | Low | Low | High |
| Cataphract | High | Medium | High | Medium | Low |
| Horse Archer | Low | High | Low | High | Low |
| Batyr | High | Medium | High | Medium | Low |
| Djinn-Binder | Low | Medium | Low | Low | High |
| Sha'ir | Medium | Medium | Medium | Low | High |
| Strategos | Medium | Medium (High if mounted) | Medium | Medium | High |
| Kalari Duelist | Medium | High | Low | High | Low |
| Elephant Rider | Very high | Very low | Very high | Medium | Medium |
| Varangian Guard | High | Low | Medium | High | Low |

**Mounts (Decided)**
- Mounts have **no mechanics of their own**. Mounted heroes follow all normal rules (one hex, conceal, line of fire).
- A mount is reflected only in the hero's **base stats**: a horse raises speed; the Cataphract's armoured horse offsets the speed cost of its armour; the war elephant gives very high defence and health at very low speed. A mount's speed divides the hero's costs like any speed (section 4).

**Notes**
- **Four distinct tanks:** the Cataphract charges in, the Batyr holds the front line, the Elephant Rider cannot be moved (it resists Displace as a passive, but not Push), and the Corpse Driver protects with jiangshi rather than its own body. The Corpse Driver's minion strength comes from high influence; its own health is medium so that permanent death is not too punishing.
- **Support covers three needs:** healing (Alchemist), buffs and curses (Sha'ir), and control (Strategos in space and turn order, Djinn-Binder by pushing enemies back on the track).
- **Two djinn-related heroes:** the Djinn-Binder commands a bound djinn; the Sha'ir draws inspiration from jinn through words. Keep their visual language and abilities distinct (a spirit acting on the board versus spoken verse).
- **Damage covers four niches:** area caster (Fox-Spirit Sorcerer), ranged (Horse Archer), fast melee (Kalari Duelist), heavy melee (Varangian Guard).
- **The Fox-Spirit Sorcerer is damage, not support (Proposed):** its kit is fox fire (huli jing and kitsune are both linked to spirit fire): area attacks and Burn, so its damage comes from power up front and influence over time. Its trickery serves only itself, slipping away after it strikes (Stealth, short Displace of itself, swapping places with an illusion), never decoys or cover for allies; those would make it a third controller beside the Strategos and Djinn-Binder. Fragile (low health and defence) is the price of its damage.
- **Djinn as religious-adjacent material:** djinn also appear in the Qur'an. Keep to the *Arabian Nights* folklore framing (15.5). In "The Fisherman and the Jinni", the jinni was sealed in his jar by Solomon, a prophet in Islam; use the motif of a djinn sealed in a vessel without the religious figure.
- **Speed:** three heroes can have high speed (Horse Archer, Kalari Duelist, mounted Strategos). The Varangian Guard pays for its damage with low speed. Speed divides every cost, so it sets how often a hero acts (4.1, with diminishing returns); keep high speed rare.
- **Only four damage heroes:** gear and upgrades can shift tanks and supports toward damage; guaranteed role coverage in recruitment offers would also help (10.7).
- **Area damage:** the Fox-Spirit Sorcerer is the area-damage hero; its areas follow the friendly-fire rules like any other.
- **Boss conflict:** the multi-hex boss example (11.3) should use a creature other than a war elephant, so it reads differently from the Elephant Rider.
- **Unverified details:** signature weapons are proposals and need research for accuracy (for example, what corpse drivers carried).

**Cultures without heroes**
Egypt, Silla Korea, Nara Japan, Tibet, Srivijaya and Java, and the Swahili coast (with Aksum) have no heroes in this roster. With Egypt removed, no African culture has a hero; Egypt, Aksum and the Swahili coast should be well represented as places and neutral characters, and are strong expansion candidates. They remain part of the setting as places (Nara at the eastern end, the Tibetan passes, the Strait of Malacca, Swahili ports), as neutral characters (traders, innkeepers, guides), and as candidates for expansion heroes. They should not appear only as monsters (15.7).

**Rejected or replaced along the way**
- Named figures (Abe no Seimei, King Gesar, Zal, Gajah Mada, Fumo Liyongo) replaced by roles, for cultural sensitivity.
- Paladin and crusader merged; "crusader" dropped because of its association with the Crusades.
- Greek fire engineer rejected: it described a weapon, not a role or figure.
- Star-Reader replaced by the Djinn-Binder (a stronger fantasy wizard than real astronomers); Geomancer (Arabic sand divination) considered.
- Hakawati replaced by the Sha'ir; Naqqal (Persian epic storyteller) and Akyn (steppe poet-singer) considered.
- Tomb Robber replaced by the Varangian Guard (heavy melee damage); Medjay (Egyptian desert scouts) considered.
- Nizari "Assassins" avoided: the term originated as a slur against a religious community that still exists.
- Shadow Puppeteer, Simurgh Caller, Caravan Guard, Senapati, Monsoon Navigator and others considered and not used; several remain options for expansion.

## Decision log (from section 13)

| Area | Decision | Alternatives considered | Reason |
|---|---|---|---|
| Hero roster | 12 heroes from 6 cultures, based on roles rather than named figures; 4 tanks, 4 damage, 4 support | One hero per culture across 12 cultures; named historical and legendary figures | Central cultures get more depth; named figures can be culturally sensitive; balanced roles suit random recruitment |
| Fox-Spirit Sorcerer | Proposed: an area-damage and Burn caster whose tricks protect only itself | Trickster caster with illusions, decoys and conceal | Its specialty read as support while its role is damage; leaves control to the Strategos and Djinn-Binder |
| Mounts | Reflected only in base stats | Dedicated mount mechanics (cheaper movement, charge, dismounting) | Simplicity; the speed versus defence tradeoff already expresses mounts |

## Open questions (from section 14, original numbers)

33. Hero roster: signature weapon accuracy, tuned stat values, each hero's abilities and ultimate, and which heroes to prototype first (6 to 8, per 10.8).

**Passives:** the Elephant Rider's Displace resistance is the first
**passive**, an always-on trait rather than an action. The
combat design has no passive abilities yet; how passives are shown
(design language, 7.1) and whether other heroes get one is open.
