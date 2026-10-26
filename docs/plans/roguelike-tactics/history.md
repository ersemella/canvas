# Roguelike tactics: abandoned approaches

Every approach that was considered and dropped, with why. Read only when
revisiting a past choice; current decisions live in the topic files. Full
earlier texts are in git history (`docs/plans/roguelite-invasions.md`,
`docs/plans/roguelite/`, and this folder).

> Part of the roguelike tactics plan. Start at [README.md](README.md).

## Game shape

- **A dungeon crawl** (2026-10-13): one character exploring generated
  levels, finding an exit door, under fog of war. Replaced by the combat
  design (a party fighting battles on compact hex maps, complete
  information). Its open questions (run length, resting forever, map size,
  rooms and corridors, eight-direction movement, vision, the exit door,
  ghost spawn points, level contents, ghost strength) were answered or
  retired by the combat design.
- **Run structure as a pure sequence of fights** (as in Slice & Dice):
  rejected for a route map with route choices.

- **Milestone upgrades with no stat growth** (until 2026-10-24): heroes
  grew only by hero-specific adjustments to their abilities, offered at
  per-hero milestones (fights joined or survived), 2 or 3 a run, with no
  stat growth outside gear (10.9). Replaced by the owner with provisions
  (stat points) and one upgrade offer per region ([progression.md](progression.md)).
- **Four stages for a whole run** (built 2026-10-24): 3 wolves; 1 hero and
  2 wolves; 2 heroes and 1 wolf; 3 heroes. Replaced by the owner with three
  stages per region, the last region four (19.1, 19.5); the code went back
  to three (owner, 2026-10-24), dropping the all-wolf stage.
- **Progression ideas weighed before 2026-10-24's decision:** 1 stat
  point every stage, swappable between heroes every stage (busywork, and
  19 points would outweigh the upgrades); swappable only between regions;
  picking 1 or 2 of 3 random upgrades (picking 2 of 3 is only choosing
  which to skip).

## Multiplayer

- **Live invasions with mutual opt-in at the door:** at the door after a
  level, a player chose to continue alone, open their level to an invader,
  or invade; the matchmaker paired them within about 45 seconds. Dropped:
  two players at the same door within seconds would rarely happen, and it
  needed a door UI, waiting window and cancel flow.
- **Always-on live invasions:** levels timed turn by turn, untimed breaks
  between levels as the invader's safe point, an invader joining the
  host's level with a single-use ticket. Dropped for ghost-only (D1):
  live play needs timers, safe points, hand-offs and live matchmaking, and
  two players at the same point at the same moment.
- **D5, signed character snapshots** (withdrawn): breaks ran in the
  browser, so the character crossed them as an HMAC-signed snapshot with
  break actions replayed on the server. Unneeded once the whole run lives
  in one room (D3).
- **D6, per-level rooms named by run and level** (withdrawn): their
  tombstones stopped a client replaying an old snapshot to undo a death.
  No snapshots, nothing to replay.
- **Ghosts as one character invading a level** from a fixed spawn point,
  appearing after some turns and hunting. Replaced by rival caravans:
  copies of whole parties met as a fight, deploying in a deployment zone.
- **Stage as fights won:** on a route map, players at the same point on
  the road can have won different numbers of fights. Stage is position
  along the road.
- **A nemesis rule** preferring the ghost that killed you, and **total
  kills** as the score: replaced by meeting each run's caravan at most
  once and scoring unique players killed, so runs don't go stale and a
  lucky build can't block a player.
- **A kill per hero killed:** a kill is a full party wipe.
- **Rival caravan fights on ordinary encounter maps:** they use PvP-style
  mirrored maps.
- **A beaten caravan's hero joining with its gear or upgrades:** it joins
  with nothing, like any recruit.
- **Unlocks only from caravan kills:** progression unlocks come from
  fights won; caravan kills give recognition unlocks, so power never
  depends on other players dying.

## Combat

- **The rework of 2026-10-23 (owner).** Replaced at once, with what each
  became:
  - **Action costs and cost-based placement:** a card moved
    `floor(cost × speedScale ÷ (speed + C))` slots after a turn (C 25,
    speedScale 5; a typical action 100, quick 60, Hold 30, walking 20 + 10
    a hex; starting cost 100), so cheap turns came round sooner and speed
    divided every cost. Replaced by Temee pacing the track: its card goes
    20 slots a turn and every other card 2 × speed before its next turn,
    one turn a round whatever the unit does
    ([timeline.md](timeline.md), 3.2). The camel's card had gone 14 slots a
    turn.
  - **Temee pacing the track** (the same day): Temee's card went 20 slots a
    turn and every other card 2 × speed slots before its next turn, so each
    unit acted once in each of Temee's rounds; Temee started first, at slot
    0, and the rest at 20 − 2 × speed, spaced out by one slot. Replaced
    (owner, 2026-10-23) by an action cost of 12 − 2 × speed for every unit,
    Temee's included, and a starting order from slot 0, fastest first, with
    Temee last at slot 12 ([timeline.md](timeline.md), 3.2 and 3.4).
  - **An action cost of 12 − 2 × speed** (the same day): speed 3 cost 6,
    2 cost 8, 1 cost 10, Temee 12. Each point took the same 2 slots off,
    so turns grew faster and faster with speed and the cost reached its
    1-slot floor at speed 6. Replaced (owner, 2026-10-23) by
    60 ÷ (speed + 5), rounded, so each point adds the same share of turns
    and speed can scale to 10 ([timeline.md](timeline.md), 3.2).
  - **The arriving card always yielding** (until 2026-10-23, its last
    day): a card placed on a taken slot moved on to the next free one, and
    cards on the track never moved. Replaced by the faster card keeping the
    slot (timeline.md, 3.3): fast cards kept landing in blocks of slower
    ones and yielding behind them all, so in a full fight the Outriders
    (speed 3) acted no more often than speed 2. Doubling the costs to
    24 − 4 × speed, tried the same day, didn't help.
  - **Charged abilities and ultimates:** charge and recovery costs on the
    character's own card; one ultimate per hero, unlocked after 300 action
    cost spent, once a fight. Both rested on action costs.
  - **The stat scale:** speed, defence and power read Low 10 / Medium 25
    / High 40; health came in tiers (Low 300, Medium 420, High 540; the
    camel 1,500); power scaled an ability's base damage by
    `1 + power / 50`; defence cut damage by `defence / (defence + 50)`,
    minimum 1. Replaced by small whole numbers, health (1 + defence) × 2,
    damage exactly the user's power, and Armour as a flat keyword
    ([heroes-and-gear.md](heroes-and-gear.md), 9.1).
  - **The keyword list of 2026-10-16:** Push, Pull and Swap (track),
    Displace (board), Dazed (no action, movement allowed, with a one-turn
    lockout guard), Slowed, Taunt, Pinned, Stealth, Vulnerable (and
    flanking's Vulnerable 25%), Barrier, Lifesteal, Obscured, Crushed,
    Heal, Overhealth, Antiheal, Cursed, Cleanse and Dispel, and stat ups
    and downs. Replaced by the list in [keywords.md](keywords.md) (17.1):
    track Push and Pull renamed Delay and Haste, Displace split into Push,
    Pull and Move, Barrier renamed Shield (now passing what it can't
    absorb on to health), Dazed replaced by Stunned, Vulnerable by
    Empower and Weaken, defence's reduction by Armour.
  - **The kits:** Hail as a radius-1 area within 3 that dealt base 20 and
    Pushed 5 on landing and base 20 to a unit starting its turn in it, for
    20 slots; Grapple (reach 2 with a step in) dealing base 60 and
    Immobilizing for 12 slots while adjacent; Throw (base 120) landing the
    grappled unit beside the Champion; the Champion's Inevitable passive;
    the Bow and Bite with base 120 and 100. Replaced by the kits in
    [roster.md](roster.md).
  - **Parked content, deleted with its code:** the Modao Vanguard (Hold
    the Line, Challenge, Reap, Advance), Leap, Volley, Sunlight, Freeze,
    Lunge, Shove, quicksand and the sandstorm (hexes of the map), the
    headless movement experiments (`FightState.experiment`) and their
    runner. All rested on action costs or the old numbers. Their rules and
    tests are in git history before this change.

- **Other ways to end stalled fights** (until 2026-10-21): a fight
  limit (the fight ends at a set slot, decided by health left or as a
  defeat), a surrender rule (a side that can't damage the other
  concedes), and stronger finishers or weaker heals. Replaced by the
  caravan's camel, whose walk to the exit lets the player end any fight
  ([camel.md](camel.md)). Also considered then: a camel the enemy plunders
  one load at a time, with cargo that can't be won back, dropped for a
  camel the enemy kills, since the exit already guarantees an end.
- **Partial recovery for heroes between fights** (until 2026-10-21):
  heroes recovered part of their health after each fight, and fully at
  rests or from consumables. Replaced by the party starting each fight
  fresh, with the camel's health carrying the attrition
  ([heroes-and-gear.md](heroes-and-gear.md), 10.11).

- **Frozen** (until 2026-10-18): no movement and no action, a lost turn.
  Replaced by Immobilized, which removes only movement; Dazed covers a
  lost turn ([keywords.md](keywords.md), 17.5).
- **Immobilized preventing displacement** (2026-10-18 to 2026-10-19):
  an Immobilized unit couldn't be displaced by allies or enemies.
  Removed so the Bökh Champion can Pin a target and then Throw it, and
  so Rampage isn't stopped by held units; Unstoppable remains the
  immunity to Displace ([keywords.md](keywords.md), 17.4, 17.5).
- **Gale** (the Yadachy Storm Caller, until 2026-10-20): melee, Displace 1
  away and Slowed 1 for 10 slots, no damage, meant as an escape when
  surrounded. Replaced by fog (owner): in play it rarely helped, and the AI
  chose it on 2% of the Storm Caller's turns. A burst pushing every
  adjacent unit away was tried and not taken, as the AI can't value
  escapes ([phase-1-brief.md](phase-1-brief.md), section 4).
- **Taunt forbidding Hold** (until 2026-10-20): a taunted unit that could
  reach the taunter had to attack it, since a Hold escape made Taunt the
  same as Dazed. Hold is now allowed (owner), to tone down Pin; the AI
  holds on about 19% of its taunted turns ([keywords.md](keywords.md),
  17.5).
- **Guard N%** (Phase 1 draft, until 2026-10-16): N% less damage for
  10 slots, Batyr's Hold the Line. Removed as outdated; Barrier covers
  damage protection ([keywords.md](keywords.md)).
- **A stronger status replacing a weaker one** (until 2026-10-16):
  replaced by each application running its own duration, with only the
  strongest applying at a time.
- **Narrow, capped damage variance from gear** (until 2026-10-16):
  damage ranges such as 5 to 6, previewed as a minimum and maximum.
  Replaced by set numbers so every preview is exact; critical hits, dodge
  chance, accuracy and evasion were considered and not included
  ([information.md](information.md), 8.1).
- **A shared clock of fine-grained ticks** (typical action 100, quick 60,
  slow 150, movement 7 per hex), with speed reducing action cost by a
  capped percentage. Replaced first by coarse ticks (ticks could not be
  shown visually), then by the track.
- **A shared clock of coarse whole-number ticks** (typical action 10,
  quick 6, slow 15, 1 tick per hex, minimum turn cost about 3), drawn one
  pip per tick, with speed affecting only starting order and tie-breaks:
  speed barely mattered (a percentage reduction rounds to 0 on quick
  actions, and a flat per-tier reduction was not adopted); collisions let
  the faster unit keep the tick and bump the incumbent, which needed bumps
  to count towards the delay limit; and a minimum turn cost below a short
  move made short moves free and allowed chained near-free turns. Replaced
  by the **track**: fine-grained costs divided by speed + C into coarse
  slots, so speed works in small steps while the track stays countable.
- **Starting order at tick 0 with tie rules spreading units out,** or a
  per-tier offset: replaced by the placement formula with a starting cost.
- **Units sharing a tick and acting in tie order:** replaced by one card
  per slot.
- **Move-only and wait turns** priced by a minimum turn cost: replaced by
  requiring an action on every turn.
- **Unlimited movement with an exponentially rising cost per hex:**
  considered and dropped for a movement cap, because costs are paid after
  the turn and a long dash could still strike first.
- **Delayed actions as separate timeline entries** (declared, then
  resolving at a scheduled point, cancelled if the caster died): replaced
  by charged abilities on the character's own card, plus track entities
  for effects that act independently (such as summons).
- **Ultimates charged by a meter** filled by keyword actions: replaced by
  once per combat.
- **Ultimates usable from the start of a fight:** replaced by an unlock
  after the hero completes a set number of turns, shown publicly, so
  fights build toward ultimates and the other side can see one coming.
- **An event order within a tick** (expiries, damage over time, delayed
  actions, then the unit): replaced by effects acting at the beginning of
  a slot, before that slot's card.
- **Enemy tie ranks in the derived numbers** (so the browser could preview
  who kept a contested tick): unneeded once the arriving card always
  yields.
- **Delay as the track effect and Push as board movement** (the Phase 1
  draft), then **Delay and Boost on the track with Push and Pull on the
  board** (2026-10-16): replaced by Push and Pull for the track and
  Displace for the board, so each pair of words means one thing
  ([keywords.md](keywords.md)).
- **Taunt dodged by Hold** (2026-10-16): a taunted unit could Hold
  instead of attacking the taunter. Replaced by a taunt that can't be
  dodged, because Hold made it the same as Dazed ([keywords.md](keywords.md)).
- **The timeline as the next 16 turns shown as cards,** then as one pip
  per tick: replaced by the track of slots.
- **Stats hidden for every unit,** including your own; then **enemy stats
  hidden** but discoverable through previews, with the browser sent only
  derived numbers (damage after defence, effect magnitudes). Replaced by
  complete information (D11): the first full-number preview revealed the
  stats anyway, so hiding them added a chore rather than uncertainty.
  Ways considered to keep them hidden: every preview a server request (a
  request per tap against the Free plan, with latency), and stats sent but
  hidden only in the UI (visible in network traffic).
- **Health mostly fixed per hero, then health modified by gear:** health
  was first made to grow with gear, because damage grew through the run
  and fixed health let it outgrow defence, collapsing late fights into
  whoever strikes first. Reversed 2026-10-18: health is fixed per hero
  again and gear never raises it. Damage now grows far less (power scales
  only base damage and healing, keyword effects are unscaled, gear carries
  keywords first), so the original reason no longer holds.
- **Influence, a second offensive stat** (scaling effect strength: status
  magnitude or duration, push slots, healing, Barrier), chosen so damage
  and effect builds wanted different stats. Folded into power 2026-10-18:
  every influence item was wasted on a power hero and the reverse (the
  reason a physical/magical split was rejected); build identity now comes
  from keyword modifiers on gear; and it counted twice in places (it scaled
  magnitude for some effects and duration for others, an item could carry
  both influence and an influence-scaled effect, and influence damage
  skipped defence). Power now scales only base damage and base healing;
  keyword effects are fixed by their source.
- **Recruits joining at the party's upgrade level** (with lower-level
  gear) to prevent a death spiral after a death: rejected, because a death
  is meant to start a death spiral with a low chance of recovery. Recruits
  join at base level with basic gear, and deaths don't change recruitment.
- **A movement cap based on speed** (for example
  `floor(M × speed / (speed + K))`): set aside, because speed already sets
  how often a unit acts, its cost per hex and its starting slot; adding
  reach would make it the default best stat and give the largest reach to
  units that already act first. A per-hero cap modified by boots was the
  suggested alternative; the cap stays a single global value for now.
- **Consumables usable in combat** as actions with their own cost:
  replaced by consumables used only between fights (stat buffs or statuses
  for the next combat, or health recovery), keeping combat about the
  heroes' abilities and the track.
- **Health and damage in single digits:** percentage bonuses rounded away
  (for example Burn 2 with influence 15 stayed 2), so health and damage
  are on a ×10 scale.

- **Friendly fire for areas only** (until 2026-10-19): area abilities
  hit allies, but other abilities chose their side. The Composite Bow's
  arrow stopped at an ally without hurting it (owner's call, 2026-10-18),
  Rampage displaced allies without damaging them (proposed), Clear the
  Storm healed and cleansed only allies, and Pin targeted only enemies.
  Replaced by one rule, abilities don't know sides
  ([map.md](map.md), 6.7): fewer exceptions to learn, supports must
  position too, and ally exemption becomes a build lever.
- **Rampage** (the Bökh Champion's ultimate until 2026-10-22): a charge
  3 hexes in a straight line, hitting every unit in or beside its path
  once for base 160 and Displacing it 1, allies included. Replaced by
  **Lunge** (owner): a bound of up to two hexes to a unit, which it
  strikes and pins. A side without Rampage won 44.8% of AI-vs-AI fights
  ([balance.md](balance.md)).
- **Pin's step** (2026-10-21 to 2026-10-22): Pin could step one hex
  first, to a free hex next to its target, at the same cost. Pin went
  back to melee only (owner) and the reach moved to the ultimate, Lunge;
  the step had made no measurable difference (a side without Pin won
  50.0% with it, 50.4% without).

- **Barrier after defence, excess to health** (until 2026-10-22): Barrier
  absorbed the next N damage after every other reduction, defence
  included, and what it couldn't absorb carried on to health; separate
  Barriers would each have run their own duration. Replaced (owner's
  call, with the Modao Vanguard's Challenge) by a pool that takes damage
  before defence, absorbs the hit that spends it whole, and is replaced
  by a new one ([keywords.md](keywords.md), 17.6).

## Roster

- **Volley** (the Outrider, owner, 2026-10-23; removed with its code the
  same day for Skirmish, [balance.md](balance.md#skirmish-in-place-of-volley-2026-10-23)):
  arrows from above on one space within 3 with a unit on it, no line of
  fire needed; charged half the Outrider's action cost, landing on whoever
  stood there then. Instant at range 3 it was the strongest ability in the
  game; at range 2 a strong second attack; charged at range 3, a second
  ability's worth (44%). Replaced by Skirmish, a step and the Bow's shot,
  charged the same (owner).

- **Hold Loose, Hip Toss, Squall Line, Tailwind and Overwatch** (2026-10-24;
  built, measured and removed with their code the same day, owner;
  [balance.md](balance.md#second-abilities-measured-2026-10-24)), weighed
  beside the five that became upgrades (Shove, Haul, Feigned Retreat,
  Gale, Volley). *Hold Loose* (Grapple changed): its target Immobilized,
  not Stunned, the grapple holding through damage and Stuns; a nerf (39.4%
  head to head). *Hip Toss* (Throw changed): landing within 2, the grapple
  ending; no change (47.5%). *Squall Line* (Hail changed): hail on three
  spaces in a line, no damage; a big nerf (29.4%) that slowed fights.
  *Tailwind* (the Storm Caller): Haste 3 on a unit within 3, once between
  its turns; a trap (a side without it won 57.2%). *Overwatch* (the
  Outrider, a second time): a lane until its next turn, the first unit
  entering it shot; it seldom fired and lost games (57.9%), as in 2026-10-23.
- **Overwatch, Sunlight and Fog** (owner's proposals, 2026-10-23; built,
  measured and removed with their code the same day,
  [balance.md](balance.md#new-abilities-2026-10-23)). *Overwatch* (the
  Outrider): one of the bow's lanes until its next turn, the first unit
  to enter it shot; worth nothing in every variant (shooting each unit
  that enters, the shot stopping a walk) and with the AI valuing its
  lanes: on an 8 × 8 board with 3-space walks one lane is almost never in
  the way. Replaced by Volley, which was replaced in turn by Skirmish. *Sunlight* (the Storm Caller): one space
  within 3, heal 1 and cleanse every status (ending a grapple), melting
  hail; worth nothing at heal 1, worth having at heal 2 but it lengthened
  fights and made the last stage harder (42.8% player wins). *Fog* (the
  Storm Caller): one space within 3 until its next turn, Weaken 1 on a
  unit standing in it; worth nothing on one space, a little over a space
  and its neighbours (the first proposal, judged too strong on paper),
  a trap at Weaken 2. Also weighed: *Leap* for the Outrider (it mostly
  repeats a 3-space walk). The Storm Caller has Hail alone until its
  second ability is chosen.

- **Fox-Spirit Sorcerer as a trickster caster** (2026-10-16): illusions
  and decoys, using conceal tiles. Labelled damage but played as support:
  decoys and cover protect the party, and none of it kills. Replaced by
  an area-damage and Burn caster whose tricks protect only itself.
- **Fox-Spirit Sorcerer as a fox-fire caster** (2026-10-16): area damage
  and Burn, tricks protecting only itself. Replaced by the Simurgh Caller
  (Persia and Sogdiana) so every hero culture has two heroes. Also
  weighed: a thunder-rite master (Song-era, close to the Xiangxi Corpse
  Driver's Daoist ritual), a gu sorcerer (risks an ethnic stereotype of
  southern minorities), a storm-calling wu, an Egyptian lector-priest
  magician (would restore an African hero, as a seventh culture), an
  onmyōji.

- **Batyr as the steppe tank** (2026-10-16): the steppe hero-warrior
  holding the front line with a sabre. *Batyr* (baghatur) is a title for
  any renowned warrior, and steppe warriors were mounted archers, so it
  didn't stand apart from the Horse Archer. Replaced by a wrestler,
  named the Bökh, and the title went to the horse archer, renamed the
  Baatar (the Mongol forms; "Horse Archer" and "Steppe Wrestler" were
  the earlier names). Also weighed: a wolf guard (the Türk khagan's guards were
  called "wolves", böri), too close to the Varangian Guard; a
  shaman-protector, closer to support.

- **Sha'ir and Strategos** (removed 2026-10-17; owner's call): the
  Abbasid Arabia support (Bard: buffs from verse, curses from satire;
  medium health, defence and speed, high influence; recited verse) and
  the Byzantium support (Warlord: directs allies, pulls their turns
  earlier; optional horse for high speed; sword and banner). Their slots
  were opened (open question 33). The Abbasid slot went to the
  **Sorceress** (2026-10-17; owner's call), from the *Arabian Nights*'
  enchantresses; also weighed: Scheherazade, a bimaristan physician,
  a geomancer.
  The remaining support slot went to the **Yadachi** (2026-10-17;
  owner's call), a Mongol storm controller, leaving Byzantium with one
  hero; Byzantine options had been an automaton engineer and an akrites
  scout. Sources: [Britannica: shāʿir](https://www.britannica.com/art/shair);
  [Wikipedia: Strategos](https://wikipedia.com/wiki/Strategos).
  The Yadachi's culture moved from Mongol to **Turkic** (2026-10-18;
  owner's call): the yadachi and *yada tashy* are Turkic folk belief
  (Turkish, Azeri, Kazakh, Kyrgyz, Bashkir); the Mongols shared only the
  stone (*jada*, *Secret History* 143). Weighed: keeping it Mongol under
  the same name, or renaming it after the Mongol stone (Jada Storm
  Caller).
  The Mongolia region was then widened to the **Steppe** region (Mongol
  and Turkic; owner's call, 2026-10-18), so the Yadachi has a home
  without a seventh region.
  The spelling changed from **Yadachi** to **Yadachy** (2026-10-18;
  owner's call), following the Wikipedia article's form.

- **Kalari Duelist, Mahout Bulwark and Sahira Enchantress** (removed
  2026-10-26; owner's call): South India's fast melee damage hero
  (kalaripayattu, the urumi) and immovable tank (a war elephant,
  Unstoppable as a passive), and Abbasid Arabia's curser (the *Nights*'
  enchantresses, Weaken), cut with the India and Arabia regions
  ([setting.md](setting.md), 15.3a). The Jinn Binder moved to Persia
  instead, as its support. The Kalari's fast-melee niche went to the
  **Youxia Swordsman**, China's damage hero, a role rather than a named
  *chuanqi* swordswoman (Nie Yinniang, Hongxian); also weighed for that
  slot: a Tang crossbowman with Pierce, a Daoist flying-sword adept, a
  *cike* assassin. For Persia's support, a **Sogdian caravan master**
  (Haste or Shield) was weighed against moving the Jinn Binder.

## Setting

- **Six regions** (2026-10-17 to 2026-10-26): Steppe, China, India,
  Persia, Arabia, Byzantine, of 3 stages each and the Byzantine 4.
  Cut to four (owner's call): the familiar, distinct civilizations of the
  overland road; India lay south of the Himalayas, off it, and Arabia's
  folklore overlapped Persia's and moved there. Weighed: putting China
  before the Steppe, recasting the Steppe as Central Asia; rejected, as the
  Steppe is Mongolia and would send the caravan back northeast from Turpan.
  India's basic creature was the jackal (the *Panchatantra*'s schemers),
  Arabia's the ghul.

- **"Steppe peoples (Turkic and Mongol)"** as one culture (renamed
  **Mongol**, 2026-10-16): it matched the setting's 7th to 8th century
  core, when the steppe was ruled by the Göktürk and Uyghur khaganates.
  Its Turkic material left with the rename: the *Book of Dede Korkut*,
  the *Epic of Manas*, Asena (grey wolf ancestress of the Göktürks),
  albasty (a Turkic demon), Tepegöz (a one-eyed giant). The Yadachi Storm
  Caller (2026-10-18) brought the Turkic culture back as a hero culture,
  homed in the Mongolia region. Still options for
  places, creatures or an expansion culture.

## Repository (D10)

A **standalone repository** with its own Worker, Durable Objects, page and
deploy was chosen and then dropped the same day (2026-10-15). Also weighed:
a game repository built into the arcade (needs a published engine and
`gen-game-registry.mjs` taking external packages, and most of the game's
code would still live in `canvas`, so most changes span two repos).
Learned:
- **A plain git dependency on the engine installs an empty package:** the
  engine ships only its built `dist/`, which isn't committed, and nothing
  builds it on install. What works (tested locally): a tag holding only
  the built package (`package.json` without workspace-only fields, plus
  `dist/`), consumed as `github:ersemella/canvas#engine-v<version>`. A
  script and a manual *Release engine* workflow that publish such tags
  were added in `782cd97` and reverted; restore them from there.
- The built engine uses extensionless relative imports, so it only loads
  through a bundler (Vite, esbuild, Wrangler), not plain Node.
- A Claude Code cloud session's GitHub integration can't create
  repositories (403); the owner creates them.
- A separate Cloudflare account would give the game its own Free-plan
  allowance; the same account shares it with poker.

## Names

- **Corpse Driver** (2026-10-16): renamed the **Xiangxi Corpse Driver**,
  after western Hunan, where the legends are set; owner's call. "Xiangxi"
  alone (a place, not a role) and "Ganshi" (the practice) were weighed.
- **Cataphract** (2026-10-17): renamed the **Savar**. Armoured heavy
  cavalry served Persia, Byzantium, the steppe and China alike, so the
  Greek name said "heavy cavalry", not Persia. The Daylamite (Persian
  shield-wall infantry) was weighed as a replacement.
- **Corpse Driver, then Xiangxi Corpse Driver** (removed 2026-10-16): a
  tank screening allies with jiangshi minions (medium health, high
  influence). Its legends are Qing-era and set in Hunan, so it was out of
  place in time and on the road. Its slot went to the **Modao
  Vanguard** (2026-10-17), the Tang modao troops as a role; "Modao Guard"
  and "Modao Blademaster" were weighed for the name, and "infantry" was
  too plain. Also weighed for the slot: a Shaolin warrior monk, Sha
  Wujing and Zhu Bajie (*Journey to the West*), Mulan, Lu Zhishen
  (*Water Margin*). Li Siye, the best-known modao user, is a real
  general, so the hero is a role.
- **Alchemist** (2026-10-16): renamed the **Fangshi**, the Chinese name
  for the masters of alchemy, medicine and divination; owner's call.
- **Fangshi** (2026-10-17): renamed back to the **Alchemist**; owner's
  call. The fangshi remain its inspiration.
- **Savar** (2026-10-17): renamed back to the **Cataphract**; owner's
  call. The savaran remain its inspiration.
- **Djinn-Binder** (2026-10-17): renamed the **Genie Binder**; owner's
  call. The spirit it commands is still called a djinn.
- **Jinn Binder** (2026-10-26): became the **Div Binder** after moving to
  Persia; owner's call. Same role (a controller whose bound spirit pushes
  and disrupts), now from the *Shahnameh*'s divs and Tahmuras Divband
  rather than the *Arabian Nights*' sealed jinn.
- **Div Binder** (removed 2026-10-26; owner's call): Persia's support
  for a few hours, a controller whose bound div pushed enemies and
  disrupted their turns (after Tahmuras Divband of the *Shahnameh*;
  chains or a lasso). Removed when Persia was recast as the **Mahout
  Bulwark** (back from the India region, now Sasanian) as tank,
  the **Persian Cataphract** as damage, and the **Simurgh Feather Burner**
  as a healing support, as the Simurgh heals in the *Shahnameh*. The
  Simurgh's earlier kit, area strikes leaving Burn, left with its damage
  role. Notes kept for a return: a bound div must never look like an
  enemy lesser div; divs descend from Zoroastrian *daevas*, so keep to the
  *Shahnameh*'s framing.
- **Baatar** (2026-10-17): the horse archer renamed the **Mangudai**;
  owner's call. *Baatar* (baghatur) was a title for any renowned
  warrior; the mangudai were Mongol army units, though sources disagree
  on what they were (light cavalry, vanguards or "suicide troops"), and
  the name is best known from *Age of Empires II*'s horse archer.
- **Mahout, Mangudai, Yadachi, Simurgh Caller** (2026-10-17): renamed
  the **Mahout Bulwark**, **Mangudai Outrider**, **Yadachi Storm Caller**
  and **Simurgh Summoner**, so names pair a native term with an English
  role (like the Kalari Duelist and Modao Vanguard); owner's call. The
  Simurgh Caller became a Summoner so "Caller" stays with the Yadachi.
  Also weighed: Mahout Warden, Mangudai Archer, Yadachi Rainmaker,
  Yadachi Weatherworker, Bökh Wrestler.
- **Bökh** (2026-10-17): renamed the **Bökh Champion**, after the
  champion wrestlers of the naadam games; owner's call. "Bökh Wrestler"
  was redundant (bökh means wrestling) and "Bökh Grappler" was weighed.
- **Sorceress** (2026-10-17): renamed the **Sahira Enchantress**
  (*sāḥira*, Arabic for sorceress), to pair a native term with an
  English role; owner's call. "Sahira Hexer" and "Sahira Shapeshifter"
  were weighed.
- **Genie Binder** (2026-10-17): renamed the **Jinn Binder**, and the
  docs now spell the spirits "jinn" (the transliteration of the Arabic,
  as scholars use it) rather than "djinn"; owner's call. "Genie" entered
  English through 18th-century translations of the *Nights*, which ties
  it to the folklore framing, but it carries a wish-granting cartoon
  association and doesn't fit the native term plus English role pattern.
- **Alchemist, Cataphract** (2026-10-17): renamed the **Waidan
  Alchemist** (*waidan*, "external alchemy", elixirs made by heating
  minerals and metals) and the **Persian Cataphract**; owner's calls.
  Weighed: Fangshi Alchemist, Tang or Chinese Alchemist (a dynasty or
  nationality label), Daoist Alchemist (a living religion, 15.5); Savar
  Cataphract (more consistent with the native-term pattern, but
  "Persian" reads instantly).
- **Elephant Rider** (2026-10-16): renamed the **Mahout**, the historical
  name for an elephant's driver; owner's call.
- **Simurgh Summoner** (2026-10-26): renamed the **Simurgh Feather
  Burner**, after how it calls the Simurgh: in the *Shahnameh* the bird
  comes when one of its feathers is burned; owner's call.
- Package and folder names `roguelite` and `roguelike-tactics`: the game
  is **Silk Road Run** (`packages/games/silk-road-run`). Other
  titles considered: Silk Road Caravans, Caravans of the Silk Road, Silk
  Road: Rival Caravans, The Silk Road Charter, Silk Road: The Closing
  Road, Last Caravan on the Silk Road, Silk Road Gambit.
