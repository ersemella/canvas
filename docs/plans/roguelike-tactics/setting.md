# Roguelike tactics: setting

The fantasy Silk Road: premise, why caravans race, how the setting maps onto the systems, cultures, folklore and care notes. The hero roster is in [roster.md](roster.md).

> Part of the roguelike tactics plan. Start at [README.md](README.md),
> which maps every combat-design section number ("section 3.4") to its
> file and indexes every decision. Abandoned approaches are in
> [history.md](history.md).

Rules are marked **Decided** or **Proposed**; numbers marked TBD are
tuning. Section numbers are the combat design's.

## 15. Setting (Draft)

### 15.1 Premise (Decided)
A **fantasy Silk Road**. Caravans of travellers from many cultures race along the trade routes and try to stop each other from advancing. The world is fantastical: creatures and figures from the folklore of each culture along the road are present.

### 15.2 Why Caravans Race and Fight (Proposed)
- **The Charter:** once a generation, the ruler at the road's end grants the trade monopoly to the first caravan to arrive with its cargo intact. Arriving second means nothing, so every rival has a reason to fight.
- **The Closing Road:** the passes are open for only one season. On the sea routes, sailing depended on the monsoon winds, so missing the season means waiting months. This gives the run urgency.
- Alternative considered: **The Secret**, a prize every caravan carries or chases, inspired by the account in Procopius of monks smuggling silkworm eggs to Byzantium.
- Thematic tie: on the road, the caravan that loses time loses everything, which reinforces the track as a shared resource (Design Goal 4).

### 15.3 How the Setting Maps onto the Systems (Proposed)

| System | Silk Road version |
|---|---|
| Run stages | Stretches of road: steppe, desert, mountain pass, oasis city, river crossing, sea crossing; grouped into four **regions**, one per civilization (15.3a). |
| Recovery between fights (10.11) | **Caravanserais** (historical roadside inns) as rest points: partial recovery plus occasional full rests. |
| Gear offers and consumables (9) | Bazaars and traders along the route. |
| Recruitment (10.6) | Hiring travellers at caravanserais: guards, scholars, exiles, mystics from many cultures. |
| Regular enemies and ghost teams (11.1) | **Rival caravans**, built from the same heroes and gear as the player's. |
| Distinct monsters and bosses (11.1) | Folklore creatures and guardians of the road. |
| Map tiles (6.4) | Sandstorms and smoke as conceal; quicksand and salt flats as hazards; ruins and rocks as obstacles. |
| Heroes and signature weapons (10.2) | Each hero's culture gives a distinct silhouette and weapon, supporting the diegetic design language. |

### 15.3a Regions (Decided, owner's call 2026-10-17; four since 2026-10-26)
The road is divided into four **regions**, one for each civilization the caravan passes. Each region is a part of the route map made of several levels (stages), and a run passes through them in this order:

| # | Region | Culture (15.5) | Home heroes (15.8) |
|---|---|---|---|
| 1 | **Steppe** | Mongol and Turkic | Mangudai Outrider, Bökh Champion (Mongol); Yadachy Storm Caller (Turkic) |
| 2 | **China** | Tang China | Modao Vanguard, Youxia Swordsman, Waidan Alchemist |
| 3 | **Persia** | Persia and Sogdiana, with the Abbasid *Nights*' folklore | Mahout Bulwark, Sasanian Cataphract, Magus Astrologer |
| 4 | **Byzantine** | Byzantium | Varangian Guard (tank and support open, question 33 in [roster.md](roster.md)) |

- **The order is fixed,** the same in every run; route choices (the route map) vary within a region, not the order of regions.
- **The road runs east to west** and ends in the Byzantine region, where the ruler at the road's end grants the Charter (15.2).
- **The four regions are home to the hero cultures,** one each except the Steppe, home to both the Mongol and the Turkic peoples, so every hero has a home region, and every region supplies both heroes and creatures (15.7). Each region has three heroes, a tank, a damage hero and a support (15.8; owner, 2026-10-26).
- **Why four** (owner, 2026-10-26; six from 2026-10-17: Steppe, China, India, Persia, Arabia, Byzantine): the four are the most familiar civilizations of the road, look nothing alike (horse nomads, Tang silk and lacquer, Sasanian silver and cataphracts, mosaics and Greek fire), and lie along the overland road from Mongolia across the Gobi, west through China to Turpan, through Sogdiana into Persia, and on to Anatolia and Constantinople. India sat off that line, south of the Himalayas. Arabia's folklore (jinn, peris, ghuls, the roc, Sinbad) goes to Persia, honestly: the *Nights* grew from the Persian *Hazār Afsān*, and jinn and peris are shared Perso-Arabic folklore.
- **The Steppe comes first:** it is Mongolia, and the Turkic peoples belong there too (the Göktürk and Uyghur khaganates ruled from the Orkhon valley in the setting's 7th to 8th century core). Putting China first would send the caravan back northeast from Turpan.
- **Levels and stages:** a region's levels are stages of the route map (glossary), so stage numbers keep counting across regions and rival caravan pools stay per stage ([ghosts.md](ghosts.md), D8). With six regions each had 3 stages and the Byzantine 4, the last a boss (owner, 2026-10-24); how many each of the four has is open ([progression.md](progression.md), 19.1, question 66).
- **Cultures without a region** (Silla Korea, Nara Japan, Tibet, South India, Srivijaya and Java, Egypt, Aksum) remain sources for places, neutral characters, creatures and bosses inside the four regions; Abbasid Arabia's folklore is Persia's. Where each appears is open (question 33).

### 15.3b Biomes (Proposed, owner 2026-10-26)
Each region's maps follow the road's real landscape, and the regions' colours change along the run, so a glance tells the player where on the road a fight is: steppe grass, then sand and red earth, then white salt, then Mediterranean green and blue. Terrain stays low in saturation, so units stand out ([art-direction.md](art-direction.md), Palette).

| Region | Biome | Maps and features | Palette |
|---|---|---|---|
| **Steppe** | Grassland and the Gobi's gravel desert | The Steppe (built: grass, yurts, mountains on the edge); the **Gobi Crossing** (built, no region since 2026-10-26) as the Steppe's last stage, the crossing south into China | Grass green, felt white, gravel and sand |
| **China** | The Hexi Corridor and the Turpan basin | The **Flaming Mountains** (built: red earth, three side-by-side pairs of burning ridges and one or two Han rammed-earth **beacon towers**, the Hexi Corridor's watchtowers, so the board reads as China's; owner, 2026-10-26) | Red earth, ochre |
| **Persia** | Salt desert and oasis gardens, from Sogdiana across the Iranian plateau | **Salt flats** of the Dasht-e Kavir, which the Khorasan road skirted: a white crust over mud that can give way, a natural hazard tile (15.3). **Oasis gardens** for cover and obstacles: qanat channels (underground canals surfacing), poplars, walled *chahar bagh* gardens; they also stand for Sogdiana's irrigated Zarafshan valley around Samarkand. The **Alborz** for a late or boss stage: in the *Shahnameh* the Simurgh raises Zal on Alborz, and Zahhak is chained under Mount Damavand | White salt, ochre, turquoise tile |
| **Byzantine** | Anatolia: Cappadocia, the Taurus passes, Constantinople | **Cappadocia's volcanic tuff**: fairy chimneys as obstacles, rock-cut churches, underground cities such as Derinkuyu. **The Taurus passes** (the Cilician Gates), the Byzantine frontier with the Caliphate and the world of *Digenis Akritas*, for a rival-caravan stage. **Constantinople** for the final boss: the Theodosian Walls or the shore of the Golden Horn, with cypress, olive and Mediterranean scrub | Pale tuff, grey limestone, sea blue, olive green |

- **The run ends somewhere new:** Constantinople is the only green-and-blue map, so the last fight looks like the end of the road.
- **Hazards and obstacles** (6.4) are named here as candidates; none is designed yet. Which stage of a region uses which map is open, as is whether a region's maps are chosen by the route map or fixed per stage.

### 15.4 Historical Reach of the Road
The Silk Road was a network, not a single route. The overland core ran through China, Central Asia, Persia and the Middle East; the wider network, including the Maritime Silk Road, reached:
- **Korea:** Silla (capital Gyeongju) at the eastern end. Roman and Persian glass has been found in Silla royal tombs, Sogdian traders lived in Silla, and Sogdian warrior statues guard the tombs of two Silla kings (died 798 and 836).
- **Japan:** the Shōsōin in Nara, an 8th-century storehouse, is described as the eastern terminus. Its holdings include a Roman glass cup, an Egyptian chest, and lutes from Iran and India.
- **Southeast Asia (maritime):** Srivijaya (Sumatra) controlled the Strait of Malacca from the late 7th century. Modern countries involved include Indonesia, Malaysia, southern Thailand, Vietnam (Óc Eo, a probable Funan port, active roughly 1st to 7th century, where Roman gold medallions were found; and Champa), Cambodia (Funan's heartland) and the Philippines (Butuan, trading with China and Champa from at least the 11th century).
- **Africa (western sea routes):** Egypt's Red Sea port of Berenike (about 3rd century BC to before the mid-6th century AD) traded regularly with India and Sri Lanka. Aksum (modern Ethiopia and Eritrea) was a middleman between Rome and India through its port of Adulis. On the Swahili coast, envoys from Malindi presented a giraffe to the Yongle Emperor in 1414.
- **Mediterranean and Europe:** Rome and Byzantium were major buyers of silk; Venice and Genoa were the key European trading powers in the medieval period.
- **Tibet:** the Tibetan Empire took the Tarim Basin from the Tang in 670 and held it for about two decades.

### 15.5 Cultures and Folklore (Proposed working list)
Twelve cultures, chosen for both historical relevance and variety in culture, aesthetic and folklore. Twelve matches the hero pool size, if one hero per culture is ever wanted (not decided).

**Folklore over religion (Decided):** creatures, epic heroes and folk tales are the source material. Deities, saints and figures still worshipped today are left out.

This list is the wider setting palette. Heroes come from four of these cultures (Mongol, Tang China, Persia and Sogdiana, Byzantium), plus the Turkic steppe for the Yadachy Storm Caller (15.8); the folklore below remains a source for creatures, bosses, places and neutral characters.

| # | Culture | Role on the road | Aesthetic | Folklore creatures | Heroes and tales |
|---|---|---|---|---|---|
| 1 | **Tang China** | Source of silk; eastern heart of the road | Silk, lacquer, jade, Tang armour | Huli jing (fox spirits), qilin, jiangshi, the bestiary of the *Classic of Mountains and Seas* | *Journey to the West* and Sun Wukong, a novel inspired by the monk Xuanzang's real Silk Road journey to India |
| 2 | **Silla Korea** | Eastern end; Roman and Persian glass in royal tombs | Gold crowns, jade ornaments, tomb guardians | Dokkaebi (mischievous goblins with clubs), gumiho, bulgae (fire dogs that chase the sun and moon), imugi (serpents trying to become dragons) | Folk tales of tricking dokkaebi out of their treasure |
| 3 | **Nara Japan** | Eastern terminus (the Shōsōin) | Early court style, before the samurai era | Kitsune, tengu, oni, kappa, tsukumogami (objects that come alive after a hundred years) | Tales of fox wives and oni-slaying heroes |
| 4 | **Mongol** | The steppe horse empire that united and policed the road | Gers (felt tents), horse archers, horsetail banners, steppe gold | Almas (wildman), mangus (many-headed ogre of the epics) | *Epic of Jangar*, the grey wolf and fallow doe (ancestors in the *Secret History of the Mongols*), wrestling at the naadam games |
| 5 | **Tibet** | Controlled the Tarim Basin for about two decades from 670 | High-altitude fortresses, distinctive armour | Migoi (the yeti), mountain spirits | *Epic of King Gesar* |
| 6 | **Persia and Sogdiana** | Sogdians were the road's merchant class; Persia the empire behind them | Sasanian silver, armoured savaran cavalry, Sogdian murals | Simurgh, divs (such as the White Div), peris, the manticore (originally Persian "man-eater") | *Shahnameh*: Rostam's Seven Labours, Zahhak the serpent-shouldered king |
| 7 | **South India** | Maritime trade hub; the Chola raided Srivijaya in 1025 | Temple carving, bronze, chakram and urumi | Vetala (corpse-dwelling spirits), yali (lion-like guardians on temple pillars), makara (sea beasts) | *Vikram and the Vetala*, the *Panchatantra* fables |
| 8 | **Srivijaya and Java** | Controlled the Strait of Malacca | Keris, wayang puppetry, temple architecture such as Borobudur | Pontianak, orang bunian (hidden people of the forest), nagas | Nyai Roro Kidul, Queen of the Southern Sea |
| 9 | **Abbasid Arabia** | Baghdad, desert caravans, ocean-going dhows | Astrolabes, geometric art, desert caravans | Jinn and ifrit, ghul, roc | *One Thousand and One Nights*: Sinbad's voyages, the City of Brass |
| 10 | **Byzantium** | Western market for silk; the silkworm smuggling story | Mosaics, gold, Greek fire | Griffins guarding gold, Arimaspians (one-eyed people, per Herodotus), kallikantzaroi (Greek goblins), drakos | *Digenis Akritas*, the Byzantine epic of a border warrior |
| 11 | **Egypt** | Red Sea gateway between the Mediterranean and India | Iconic and instantly readable; era is a choice (see notes) | The sphinx as a creature; jinn guardians of buried treasure | *Tale of the Shipwrecked Sailor* (a giant serpent on a magic island); medieval Arabic treasure-hunting manuals listing hidden treasures with spirit guardians, traps and rituals to get past them |
| 12 | **Aksum (or Swahili coast)** | Red Sea middleman between Rome and India (Aksum); Indian Ocean trade (Swahili coast) | Towering stelae, early coinage, highland stonework (Aksum) | Arwe, a serpent king said to have ruled for 400 years, demanding sacrifices until a stranger killed him | Swahili alternative: Fumo Liyongo, a giant archer-poet who could only be killed by a copper pin through his navel, and was betrayed by his son |

**Merged or cut**
- **Sogdiana merged with Persia:** both are Iranian cultures with overlapping folklore.
- **Swahili coast:** alternate for slot 12. Its folklore blends Bantu and Arab traditions, overlapping with Arabia, but it carries the Zheng He connection and the Liyongo epic.
- **Khmer and Cham:** alternates. Visually striking, but their folklore overlaps heavily with India's.
- **Venice and Genoa:** alternates. Late medieval, and visually close enough to Byzantium to blur the design language.

### 15.6 Design Hooks
- **Journey stories:** many of these traditions centre on a journey (*Journey to the West*, Sinbad, the Shipwrecked Sailor, Rostam's labours), which fits a game about travelling the road.
- **The travelling fox:** fox spirits appear in Chinese (huli jing), Korean (gumiho) and Japanese (kitsune) folklore. A creature that changes as it travels along the road would make a strong Silk Road motif, as a recurring boss now that no hero is a fox spirit (see the nine-tailed fox below).
- **Treasure manuals:** Egypt's treasure-hunting manuals suit a bazaar or loot mechanic: hidden treasures, spirit guardians and rituals to get past them.
- **Tsukumogami** suit gear: heirloom items that come alive.
- **Arwe and Liyongo** are strong boss and hero material. Arwe's recorded versions include later Christian additions; keep to the pre-Christian serpent-king core.

### 15.6a Boss candidates (Proposed, owner's list 2026-10-16)
Named fictional characters and folklore creatures. Each suggests a mechanic from the boss toolkit (11.3); the pairing is a starting point, not decided.

| Boss | Culture | Source | Suggested mechanic (11.3) |
|---|---|---|---|
| **Sun Wukong**, the Monkey King | Tang China | *Journey to the West*, a novel about a Silk Road journey | Mimic or Summoner: clones from his hairs; an extending staff hits along a line; a cloud-somersault leap across the map |
| **Bull Demon King and Princess Iron Fan** | Tang China | *Journey to the West* | Two heads, two turns (two units, two track entries); her fan's gale displaces the party, his fire mountain shapes terrain |
| **The nine-tailed fox** | India, China, Japan | The legend of one fox spirit moving along the road: Lady Kayō in India, Daji in China (*Investiture of the Gods*), Tamamo-no-Mae in Japan | A recurring boss in a new form at each stage of the road (the travelling fox, 15.6) |
| **Lutsen, the demon king of the north** | Tibet | *Epic of King Gesar* | Multi-hex body or two heads, two turns: a many-headed man-eating giant |
| **The kings of Hor** | Tibet | *Epic of King Gesar*: they raid Gesar's kingdom and abduct his queen while he is away | Summoner: a raiding host; a rescue objective |
| **Tepegöz** | Turkic steppe | *Book of Dede Korkut*: the one-eyed giant slain by Basat | Vulnerable only when flanked, or only in its one eye |
| **The White Div** | Persia | *Shahnameh*: the last of Rostam's Seven Labours | Terrain shaper: a div's darkness and sorcery over the map |
| **Zahhak**, the serpent-shouldered king | Persia | *Shahnameh* | Two heads, two turns: the serpents on his shoulders act on their own entries |

- **Gesar himself is never fought.** He is venerated in Tibetan and Mongolian tradition (15.5) and his epic is still performed as a sacred tradition; the bosses are his enemies, and he stays off-screen as the epic's hero.
- **Sun Wukong** is a boss, not a hero, since he is also worshipped in some temples (15.5); keep to the novel's trickster, not the deity. Owner's call.
- **Daji** is based on a historical consort; present the fox through its fictional versions.
- **Tibet** gets a boss stage from the Gesar epic, though it has no hero (15.7: cultures should not only supply monsters, so pair it with Tibetan places and neutral characters).

### 15.7 Care Notes
- **Balance across cultures:** each culture should contribute both heroes and creatures. If one culture only ever supplies monsters, that reads badly.
- **Folklore over living religion:** see 15.5.
- **Readability over authenticity:** cultural variety must not break the design language. A burn effect should look the same whether it comes from a Persian mage or a Chinese alchemist.
- **Weighting:** in the hero roster (15.8), each region has three heroes, one per role (2026-10-26): the Steppe's are two Mongol and one Turkic, and Byzantium has one until its tank and support are chosen. Other cultures can be strengthened through places, neutral characters and expansion heroes.
- **The Mongols' era:** the Mongol Empire's Pax Mongolica is 13th to 14th century, centuries after Tang China, Nara and the early Abbasids; in their time the steppe was ruled by Turkic khaganates. The Mongols are chosen as the iconic steppe empire of the Silk Road; fantasy allows the mix.
- **Egypt's era:** during the Silk Road period Egypt was Ptolemaic, Roman, then Islamic. The pharaonic look is more iconic but anachronistic; fantasy allows either.
- **Research gaps:** Aksumite and Swahili folklore need proper research before design work.
- **Consultation:** if the project goes beyond a prototype, cultural consultants for each region are recommended.

## Decision log (from section 13)

| Area | Decision | Alternatives considered | Reason |
|---|---|---|---|
| Setting | Fantasy Silk Road; folklore over religion as source material | Stopped Clock, Fallen Star, Succession, Last Refuge, Grand Melee, Ascent | Rivalry between caravans explains rival bands and ghost teams; folklore supplies creatures and bosses; caravanserais and bazaars map onto recovery and gear |
| Run structure | Four **regions** of several levels each, in a fixed order: Steppe, China, Persia, Byzantine (15.3a; six until 2026-10-26, with India after China and Arabia after Persia) | Stretches of road only, with no grouping by culture; "worlds" as the name (owner preferred "region") | One region per hero culture gives each culture a home and the run a journey from east to west; owner's call, 2026-10-17. The first region, Mongolia, widened to the **Steppe** (Mongol and Turkic) when the Turkic Yadachy Storm Caller joined; the Turkic khaganates ruled the Mongolian steppe in the setting's 7th to 8th century core; owner's call, 2026-10-18. Cut to four on 2026-10-26 (owner): the most familiar, most distinct civilizations along the overland road; Arabia's folklore folded into Persia, India off the overland line |
| Steppe culture | **Mongol**, with Mongol folklore; since 2026-10-18 the Steppe region also holds Turkic heroes and folklore (the Yadachy Storm Caller) | Steppe peoples (Turkic and Mongol); Turkic khaganates (period-accurate) | The iconic steppe empire of the Silk Road, matching the heroes' Mongol names (Bökh Champion, Mangudai Outrider); owner's call, 2026-10-16 |

## Open questions (from section 14, original numbers)

32. Setting: confirm the prize (Charter and Closing Road are proposed) and Egypt's era.
33. Regions (15.3a): ~~how many levels each region has; whether each region ends in a boss~~ (answered 2026-10-24 for six regions: 3 stages, the Byzantine 4 ending in the final boss; with four regions the count is open again, [progression.md](progression.md) question 66); and where the cultures without a region appear (for example Tibet's Gesar bosses in the China region's mountain passes, the nine-tailed fox arriving from India into China, South India's vetala and yali as travellers' tales or creatures, Egypt and Aksum through Persia's sea trade).
