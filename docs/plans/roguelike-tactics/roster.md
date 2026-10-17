# Roguelike tactics: hero roster

The twelve heroes: identity, roles, stat profiles, mounts, and what was considered.

> Part of the roguelike tactics plan. Start at [README.md](README.md),
> which maps every combat-design section number ("section 3.4") to its
> file and indexes every decision. Abandoned approaches are in
> [history.md](history.md).

Rules are marked **Decided** or **Proposed**; numbers marked TBD are
tuning. Section numbers are the combat design's.

### 15.8 Hero Roster (Decided, working roster)
Twelve heroes drawn from **six cultures**, two heroes each. One slot is **open**: Tang China's tank, since the Xiangxi Corpse Driver was removed (candidates in open question 33). Every hero is based on a **role** (a profession, unit or folklore type) or a **named fictional character** (from a novel, epic or folk tale); never a real historical individual, since real figures can be culturally sensitive. Figures still worshipped today stay out (15.5).

**Mechanical roles**
- **Tank:** protects allies, absorbs or prevents damage, holds space.
- **Damage:** primary source of kills.
- **Support:** heals, buffs, or controls the board and the track.

The roster is balanced at **4 tanks, 4 damage, 4 support** (3 tanks until the open slot is filled), so that limited, random recruitment offers (10.6) can usually supply each role.

**Identity and role**

| # | Name | Culture | Inspiration (historical, folklore or mythical role) | Type | Fantasy RPG archetype | Mechanical role | Specialty | Mount | Signature weapon (proposed) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Fangshi | Tang China | The fangshi ("masters of methods"), Chinese alchemists and healers seeking elixirs, whose work led to gunpowder | Historical | Alchemist | Support | Healer: elixirs and remedies | None | Elixir gourd |
| 2 | Savar | Persia and Sogdiana | The savaran (aswaran), the Sasanian armoured noble cavalry; heavy cavalry of this kind (cataphracts) served many armies on the road | Historical | Knight / paladin | Tank | Mobile charger | Armoured horse | Heavy lance |
| 3 | Simurgh Caller | Persia and Sogdiana | The Simurgh of the *Shahnameh*, the great bird that comes when one of its feathers is burned | Folklore | Summoner / sorcerer | Damage | Area caster: burns Simurgh feathers to call down sweeping strikes and fire (Burn) | None | Simurgh feathers and a brazier |
| 4 | Baatar | Mongol | The baatar (Turkic batyr), the steppe's renowned warrior, who fought as a mounted archer | Historical | Ranger | Damage | Ranged: line of fire matters most | Horse | Composite bow |
| 5 | Bökh | Mongol | Champion wrestlers (bökh), the highlight of the naadam games and of feasts in the epics | Historical | Brawler / grappler | Tank | Grappler: grabs, pins and throws enemies to hold the front line | None | Bare hands (wrestling vest) |
| 6 | Djinn-Binder | Abbasid Arabia | Djinn sealed in vessels and bound to serve, from the *Arabian Nights* tradition (for example "The Fisherman and the Jinni") | Folklore | Wizard | Support | Controller: a bound djinn pushes back and disrupts enemy turns | None | Sealed brass vessel |
| 7 | Sha'ir | Abbasid Arabia | The pre-Islamic Arab poet, believed to be inspired by jinn, whose satire was feared as a curse on enemies | Historical and folklore | Bard | Support | Buffer and curser: verses inspire allies, satire weakens enemies | None | Recited verse (no weapon; a rebab as a possible prop) |
| 8 | Strategos | Byzantium | The Byzantine general and military governor | Historical | Warlord / commander | Support | Commander: directs allies, pulls their turns earlier | Optional horse | Sword and banner |
| 9 | Kalari Duelist | South India | Practitioners of kalaripayattu, the martial art of Kerala | Historical | Martial artist | Damage | Fast melee: cheap, quick actions | None | Urumi (flexible sword) |
| 10 | Mahout | South India | The mahout, driver of the war elephants of Indian armies | Historical | Juggernaut / beast rider | Tank | Immovable wall: resists Displace (passive) | War elephant | Ankus (elephant goad) and spear |
| 11 | Varangian Guard | Byzantium | The Varangian Guard, the Norse axe-bearing bodyguard of the Byzantine emperors | Historical | Barbarian / heavy warrior | Damage | Heavy melee: slow, hard-hitting burst | None | Great axe |

**Stat profiles (relative, untuned)**

| Name | Health | Speed | Defence | Power | Influence |
|---|---|---|---|---|---|
| Fangshi | Medium | Medium | Low | Low | High |
| Savar | High | Medium | High | Medium | Low |
| Simurgh Caller | Low | Medium | Low | High | Medium |
| Baatar | Low | High | Low | High | Low |
| Bökh | High | Medium | High | Medium | Low |
| Djinn-Binder | Low | Medium | Low | Low | High |
| Sha'ir | Medium | Medium | Medium | Low | High |
| Strategos | Medium | Medium (High if mounted) | Medium | Medium | High |
| Kalari Duelist | Medium | High | Low | High | Low |
| Mahout | Very high | Very low | Very high | Medium | Medium |
| Varangian Guard | High | Low | Medium | High | Low |

**Mounts (Decided)**
- Mounts have **no mechanics of their own**. Mounted heroes follow all normal rules (one hex, conceal, line of fire).
- A mount is reflected only in the hero's **base stats**: a horse raises speed; the Savar's armoured horse offsets the speed cost of its armour; the war elephant gives very high defence and health at very low speed. A mount's speed divides the hero's costs like any speed (section 4).

**Notes**
- **Distinct tanks:** the Savar charges in, the Bökh holds the front line by grappling (on foot, unlike the mounted Baatar), and the Mahout cannot be moved (it resists Displace as a passive, but not Push). The fourth (the open Tang China slot) should protect in a way none of these does.
- **Support covers three needs:** healing (Fangshi), buffs and curses (Sha'ir), and control (Strategos in space and turn order, Djinn-Binder by pushing enemies back on the track).
- **Two djinn-related heroes:** the Djinn-Binder commands a bound djinn; the Sha'ir draws inspiration from jinn through words. Keep their visual language and abilities distinct (a spirit acting on the board versus spoken verse).
- **Damage covers four niches:** area caster (Simurgh Caller), ranged (Baatar), fast melee (Kalari Duelist), heavy melee (Varangian Guard).
- **The Simurgh Caller (Proposed):** each ability burns a feather; the Simurgh's strikes sweep areas and leave fire (Burn), so its damage comes from power up front and influence over time. The Simurgh appears for the strike and leaves; it never stays on the board which keeps it apart from the Djinn-Binder's bound djinn. Its abilities hurt; control stays with the Strategos and Djinn-Binder. Fragile (low health and defence) is the price of its damage.
- **Two summoners of great spirits:** the Djinn-Binder's djinn pushes and disrupts; the Simurgh strikes and burns. Keep their visual language distinct (a smoky spirit from a brass vessel versus a vast bird from the sky).
- **The Simurgh as religious-adjacent material:** it has roots in Zoroastrian texts, a living religion. Keep to the *Shahnameh*'s epic framing (15.5).
- **Djinn as religious-adjacent material:** djinn also appear in the Qur'an. Keep to the *Arabian Nights* folklore framing (15.5). In "The Fisherman and the Jinni", the jinni was sealed in his jar by Solomon, a prophet in Islam; use the motif of a djinn sealed in a vessel without the religious figure.
- **Speed:** three heroes can have high speed (Baatar, Kalari Duelist, mounted Strategos). The Varangian Guard pays for its damage with low speed. Speed divides every cost, so it sets how often a hero acts (4.1, with diminishing returns); keep high speed rare.
- **Only four damage heroes:** gear and upgrades can shift tanks and supports toward damage; guaranteed role coverage in recruitment offers would also help (10.7).
- **The Fangshi's ultimate (Proposed): the hand cannon.** A single shot, direct ranged at long range, needing line of fire, for large damage with **Pierce**. Based on the Heilongjiang hand cannon (about 1288, Yuan dynasty), the oldest surviving metal gun, and on the alchemists' discovery of gunpowder; an era stretch like the Mongols'. It gives the healer one decisive shot without making it a damage hero; the ultimate rules (10.10) keep it to once per fight, unlocked by turns.
- **Area damage:** the Simurgh Caller is the area-damage hero; its areas follow the friendly-fire rules like any other.
- **Boss conflict:** the multi-hex boss example (11.3) should use a creature other than a war elephant, so it reads differently from the Mahout.
- **Unverified details:** signature weapons are proposals and need research for accuracy (for example, the Simurgh Caller's brazier).

**Cultures without heroes**
Egypt, Silla Korea, Nara Japan, Tibet, Srivijaya and Java, and the Swahili coast (with Aksum) have no heroes in this roster. With Egypt removed, no African culture has a hero; Egypt, Aksum and the Swahili coast should be well represented as places and neutral characters, and are strong expansion candidates. They remain part of the setting as places (Nara at the eastern end, the Tibetan passes, the Strait of Malacca, Swahili ports), as neutral characters (traders, innkeepers, guides), and as candidates for expansion heroes. They should not appear only as monsters (15.7).

**Rejected or replaced along the way**
- Named figures (Abe no Seimei, King Gesar, Zal, Gajah Mada, Fumo Liyongo) replaced by roles, for cultural sensitivity. Since 2026-10-16 named **fictional** characters are allowed (owner's call); historical figures and figures still worshipped remain out.
- Paladin and crusader merged; "crusader" dropped because of its association with the Crusades.
- Greek fire engineer rejected: it described a weapon, not a role or figure.
- Star-Reader replaced by the Djinn-Binder (a stronger fantasy wizard than real astronomers); Geomancer (Arabic sand divination) considered.
- Hakawati replaced by the Sha'ir; Naqqal (Persian epic storyteller) and Akyn (steppe poet-singer) considered.
- Batyr replaced by the Bökh (wrestler): *batyr* is a title for any renowned steppe warrior, and those warriors were mostly mounted archers, so it didn't stand apart from the horse archer. The title moved to the horse archer, renamed the Baatar (the Mongol form).
- Tomb Robber replaced by the Varangian Guard (heavy melee damage); Medjay (Egyptian desert scouts) considered.
- Nizari "Assassins" avoided: the term originated as a slur against a religious community that still exists.
- Xiangxi Corpse Driver removed: its legends (and the hopping jiangshi) are Qing-era, after the Silk Road, and set in Hunan, off the road. The jiangshi stays available as a creature.
- Fox-Spirit Sorcerer replaced by the Simurgh Caller: as a trickster it played as support, and even recast as a fox-fire caster it left Tang China with three heroes and Persia with one. The fox remains a setting motif (15.6).
- Shadow Puppeteer, Caravan Guard, Senapati, Monsoon Navigator and others considered and not used; several remain options for expansion.

## Decision log (from section 13)

| Area | Decision | Alternatives considered | Reason |
|---|---|---|---|
| Hero roster | 12 heroes from 6 cultures, two each, based on roles or named fictional characters; 4 tanks, 4 damage, 4 support | One hero per culture across 12 cultures; named historical figures; roles only (until 2026-10-16) | Every culture gets depth; real figures can be culturally sensitive, fictional ones are fair game (owner's call); balanced roles suit random recruitment |
| Area-damage caster | The Simurgh Caller (Persia and Sogdiana); its kit (area strikes and Burn) Proposed | Fox-Spirit Sorcerer as a trickster (illusions, decoys, conceal), then as a fox-fire caster; a thunder-rite master; a gu sorcerer; an Egyptian magician; an onmyōji | The trickster read as support; moving the slot to Persia gives every culture two heroes; owner's call, 2026-10-16 |
| Steppe heroes | Bökh, a wrestler and grappler fighting on foot (tank); the horse archer is named Baatar | Batyr (steppe hero-warrior) as the tank beside a Horse Archer; wolf guard (böri); shaman-protector | Batyr is a generic title and steppe warriors were horse archers, so the title fits the archer; the proper Mongol terms; owner's call, 2026-10-16 |
| Mounts | Reflected only in base stats | Dedicated mount mechanics (cheaper movement, charge, dismounting) | Simplicity; the speed versus defence tradeoff already expresses mounts |

## Open questions (from section 14, original numbers)

33. Hero roster. **The open Tang China slot** (a tank, to keep 4/4/4): a Shaolin warrior monk (Sun Wukong goes to bosses instead, 15.6). Tabled 2026-10-16: a Tang China damage hero, such as a *chuanqi* swordswoman-assassin striking from Stealth, a Tang crossbowman with Pierce, or a Daoist flying-sword adept, as a replacement or expansion): signature weapon accuracy, tuned stat values, each hero's abilities and ultimate, and which heroes to prototype first (6 to 8, per 10.8).

**Passives:** the Mahout's Displace resistance is the first
**passive**, an always-on trait rather than an action. The
combat design has no passive abilities yet; how passives are shown
(design language, 7.1) and whether other heroes get one is open.
