# Roguelike tactics: references

Games the combat design draws on, and sources for the setting and roster. Other players'-copies prior art is in [prior-art.md](prior-art.md).

> Part of the roguelike tactics plan. Start at [README.md](README.md),
> which maps every combat-design section number ("section 3.4") to its
> file and indexes every decision. Abandoned approaches are in
> [history.md](history.md).

Rules are marked **Decided** or **Proposed**; numbers marked TBD are
tuning. Section numbers are the combat design's.

## 16. References

- **Mana Khemia: Alchemists of Al-Revis:** visible card-based timeline, choosing a later turn position, pushing enemies back, spells placed on the timeline as their own entries. Known weakness: knockback chains that keep enemies from acting.
- **Final Fantasy Tactics:** charge-time turn order; moving and acting both use up the turn gauge; spells with charge times that resolve later.
- **Fell Seal: Arbiter's Mark:** faster next turn for skipping the action; abilities that knock back an enemy's turn gauge.
- **Final Fantasy X:** visible turn order with action-dependent placement.
- **Slice & Dice:** combat-only roguelike structure with a distinct monster roster.
- **Backpack Battles, Super Auto Pets:** combat-only runs against other players' saved builds.
- **Overwatch (Stadium mode):** fixed hero kits modified by upgrades acquired during a match.
- **Hades:** randomized, source-specific upgrade offers (boons), the model for how milestone upgrades are offered and for gear choices; the Daedalus Hammer's weapon-specific upgrades, the model for what milestone upgrades contain (10.9); the Mirror of Night, the model for steering offers (10.12). Lessons below.
- **Path of Exile:** deep gear and passive systems that support theorycrafting. Lessons below.
- **Slay the Spire, Monster Train, Balatro:** theorycrafting inside a run, by adapting to drafted offers from a known pool.
- **XCOM, Divinity: Original Sin 2, Baldur's Gate 3:** area effects that damage allies.
- **Into the Breach, Tactical Breach Wizards:** deterministic, previewed tactical turns built around positioning and displacement.
- **Darkest Dungeon:** permanent death, attrition between fights, and a roster of distinct heroes.
- **MDA framework (Hunicke, LeBlanc, Zubek, 2004):** source of the eight types of fun used in section 1.2.

## Gear and build lessons

Written 2026-10-17 from memory; details not checked against each game. The rules they led to are in [heroes-and-gear.md](heroes-and-gear.md) (9.3, 9.4, 9.7, 10.12).

**Path of Exile: what makes it theorycraftable**

| What it does | Lesson |
|---|---|
| Every skill carries tags (Fire, Projectile, Spell, Area, Minion) and every modifier applies by tag | Keywords work as tags; ability and gear keywords share names (9.7) |
| Keystones (Chaos Inoculation, Resolute Technique) remove a rule at a cost; damage conversion lets fire modifiers apply to a physical attack; triggers (Cast on Crit); build-enabling uniques (Headhunter, Mjölner) | Builds start from rule-changers, and the drawback is the puzzle: bridge gear and top-rarity build-enablers (9.4, 9.7) |
| "Increased" bonuses add together, "more" bonuses multiply, and the rule is public | Players can reason about a bonus's marginal value; publish the stacking rule (question 37) |
| Hundreds of passive nodes and over ten gear slots, so small bonuses add up | Small bonuses only matter at scale; this game has at most 16 items per party, so take the structure, not the granularity |

**Path of Exile: what to avoid**

| Problem | Lesson |
|---|---|
| Serious players plan in Path of Building, an outside tool, because the game can't show its own math (Diablo 2's speed breakpoints lived in fan-made tables) | Build-aware previews show what an item does to the hero's abilities |
| Every item needs life and resistances before it can be interesting | Keep survival stats from becoming a tax on every slot; cap gear's share of stats |
| Most drops are junk; players filter loot | Drafted offers of real options |
| Damage and defence escalate together until fights are decided in one shot | Cap stat growth from gear (9.1, 9.7) |
| A few players solve builds and most copy them from guides | Make a run's best answer depend on what it offered, especially on seeded runs |
| Builds are planned before playing, with trade giving access to any item | A roguelike can't promise an item: plan around a public, stable gear pool and adapt, as in Slay the Spire |

**Hades: why boons always matter**

| What it does | Lesson |
|---|---|
| A boon changes a verb (Zeus's attack chains lightning, Poseidon's knocks back) | An item that only changes numbers isn't a choice (9.7) |
| Each god owns a theme (Zeus Jolted, Ares Doom, Demeter Chill) | Each keyword family has one clear identity |
| One boon per verb slot (Attack, Special, Cast, Dash, Call) | Tie each gear slot to a verb, so items compete (9.3) |
| Boons are transferable (the same Zeus boon on any weapon); Daedalus Hammer upgrades change one weapon's behaviour | Gear holds transferable modifiers; milestone upgrades hold hero-specific adjustments (10.9) |
| Rarity scales the same effect | The fine-grained numbers live inside a qualitative choice (9.4) |
| Duo and legendary boons need specific prerequisites | Bridge gear with prerequisites; taking an item early is a bet (9.7) |
| Doors show which god's boon is behind them | Route nodes show their keyword family (9.7) |
| Pom of Power only levels a boon, and is taken instead of a new one | A numeric-only upgrade competes with a real alternative (9.7) |
| Keepsakes, rerolls and the Mirror of Night steer offers and soften bad runs | Steering offers across runs (10.12) |

**Hades: where it doesn't carry over**
- **Builds are meant to break the game:** one character in real time against fixed encounters. Here rival caravans copy builds and PvP may follow, so power stays bounded.
- **Scale:** about 20 or more boons per run for one hero, against far fewer items split across four heroes; an offer says which hero it's for.
- **Some Mirror upgrades are raw power** (extra health, Death Defiance); only the ones that influence chance carry over (10.12).

**Setting sources: history of the road (15.4)**
- [Korea Herald: Sogdian warrior statues at Silla royal tombs](https://www.koreaherald.com/article/2984536)
- [University of Michigan: Hyecho's Journey, Silla](https://hyecho-buddhist-pilgrim.asian.lsa.umich.edu/silla.php)
- [Smithsonian Folklife Festival: Nara and the Shōsōin](https://festival.si.edu/2002/the-silk-road/nara-gate-treasure-house/smithsonian)
- [Everything Everywhere: The Srivijaya Empire](https://everything-everywhere.com/the-srivijaya-empire/)
- [Ancient History Sites: Óc Eo, a port site associated with Funan](https://www.ancient-history-sites.com/?p=133271)
- [SunStar: Butuan's golden glory](https://www.sunstar.com.ph/more-articles/butuans-golden-glory)
- [Honor Frost Foundation: Berenike, an ancient Red Sea port](https://honorfrostfoundation.org/?p=4731)
- [African History Extra: The Aksumite empire between Rome and India](https://www.africanhistoryextra.com/p/the-aksumite-empire-between-rome)
- [Owaahh: The giraffes Malindi gave to China in 1414](https://owaahh.com/the-giraffes-malindi-gave-to-china-in-1414/)
- [Wikipedia: Tibetan conquest of the Tarim Basin](https://en.wikipedia.org/wiki/Tibetan_conquest_of_the_Tarim_Basin)

**Setting sources: folklore palette (15.5, 15.6)**
- [Wikipedia: Arwe](https://en.wikipedia.org/wiki/Arwe)
- [Wikipedia: Fumo Liyongo](https://en.wikipedia.org/wiki/Fumo_Liyongo)
- [The Thinker's Garden: Magical treasure hunting in Islamic Egypt](https://thethinkersgarden.com/magical-treasure-hunting-in-islamic-egypt/)

**Setting sources: hero roster (15.8)**
- Simurgh Summoner: [Wikipedia: Simurgh](https://en.wikipedia.org/wiki/Simurgh)
- The travelling fox (15.6): [Wikipedia: Fox spirit](https://en.wikipedia.org/wiki/Fox_spirit)
- Waidan Alchemist's hand cannon: [Wikipedia: Heilongjiang hand cannon](https://en.wikipedia.org/wiki/Heilongjiang_hand_cannon)
- Waidan Alchemist (fangshi, waidan): [Wikipedia: Fangshi](https://en.wikipedia.org/wiki/Fangshi); [Wikipedia: Waidan](https://en.wikipedia.org/wiki/Waidan); [EBSCO Research Starters: Invention of gunpowder and guns](https://www.ebsco.com/research-starters/history/invention-gunpowder-and-guns) (Daoist alchemists seeking an elixir of life, 9th century)
- Persian Cataphract (savaran): [Wikipedia: Military of the Sasanian Empire](https://wikipedia.com/wiki/Sasanian_army)
- Mangudai Outrider: [Wikipedia: Manghud](https://en.wikipedia.org/wiki/Manghud) (sources differ on what the mangudai units were); [Wikipedia: Military of the Mongol Empire](https://en.wikipedia.org/wiki/Military_of_the_Mongol_Empire)
- Bökh Champion: [Wikipedia: Mongolian wrestling](https://en.wikipedia.org/wiki/Mongolian_wrestling)
- Yadachy Storm Caller: [Wikipedia: Yada Tashy](https://en.wikipedia.org/wiki/Yada_Tashy); [Medievalists.net: The Secret History of the Mongols and Western Literature](https://www.medievalists.net/2011/07/the-secret-history-of-the-mongols-and-western-literature/) (*Secret History* 143: a storm raised with a magic stone turns back on its casters)
- Jinn Binder: [Sacred Texts: The Fisherman and the Jinni (Burton translation)](https://sacred-texts.com/neu/burt1k1/tale02.htm)
- Modao Vanguard: [Wikipedia: Changdao](https://en.wikipedia.org/wiki/Changdao) (Tang sources equate the modao with the changdao; elite vanguard infantry); [Wikipedia: Li Siye](https://en.wikipedia.org/wiki/Li_Siye)
- Sahira Enchantress: [SparkNotes: The Story of Jullanar of the Sea](https://www.sparknotes.com/lit/arabian-nights/section13/) (Queen Lab); [Arabian Nights Wiki: The Second Kalandar's Tale](https://arabiannights.fandom.com/wiki/The_Second_Kalandar%27s_Tale)
- Kalari Duelist: [Wikipedia: Urumi](https://en.wikipedia.org/wiki/Urumi); [Kerala Tourism: Kalaripayattu](https://keralatourism.org/kalaripayattu/disciplines/angathari)
- Mahout Bulwark: [World History Encyclopedia: Elephants in ancient Indian warfare](https://www.worldhistory.org/article/1241/elephants-in-ancient-indian-warfare)
- Varangian Guard: [World History Encyclopedia: Varangian Guard](https://worldhistory.org/Varangian_Guard)

**Not yet sourced (general knowledge, check during research)**
- Venice and Genoa as medieval Silk Road trading powers; Kilwa and Mogadishu; Singapore (Temasek) and Brunei (Po-ni).
- Most folklore creatures and tales in 15.5 (Korean, Japanese, steppe, Tibetan, Persian, Indian, Javanese, Arabian and Byzantine entries), apart from those linked above.
- Signature weapons in 15.8, which are design proposals rather than historical claims.
- Tibetan Empire-era armour (only 16th-century and later lamellar armour was confirmed).
- **Battle Brothers, Jagged Alliance:** stray shots hitting units in the line of fire (rejected for this design, since it relies on hit chance).
