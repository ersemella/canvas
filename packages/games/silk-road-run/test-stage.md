# The test stage

A single fight you set up by hand in [`test-stage.json`](test-stage.json),
for play-testing a line-up, stats or an ability the run's stages don't
bring. Start it from the start menu's **Test stage** button (under Back to
Canvas). It is a run of one fight: win it and the run is won; there is no
next stage. Your side is the party picked on the start menu, each hero as
it starts a run on a random space of your starting columns, in place of
the file's `player`, which applies only to a test stage started without a
party (the unit tests).

The server reads the file when the stage starts, so after an edit start
the stage again (locally, `wrangler dev` reloads on its own; the deployed
site uses the committed file). If the file has a mistake, the start menu
says what and where, e.g. `test-stage.json: enemy[1] has an unknown field
"powr"`.

## Example

The committed file (2026-10-31): China's three heroes against
Byzantium's, on the Cyclops's Cave, a map with nothing on it (no yurts,
obstacles or mountains; the Fairy Chimneys before), with Wait on
(`"wait": true`) for play-testing it. The Duelist plays as in a run since
2026-10-31: a straight walk of up to 3 and Swift Strike a dash of 2 or 3
through a unit (aimed at the space he lands on); `"swiftStrike"`, below,
tries other versions of him.
The Priest plays as in a run since 2026-10-31: speed 1, defence 2,
power 3, with Invocation in place of Blessing (a space within 3 and the
spaces next to it, charged as a Hold costs; when his card comes back,
enemies there take his power and allies there heal it, an Empower adding
to both; with Wait on, as here, the charge is a Wait's 2/3 of a turn). `"blessing"`,
below, applies only to a Priest given Blessing with `"abilities"`.
The Elixir (named Overdose since 2026-10-31) plays as in a run since
2026-10-31, an overdose on one unit within 3 (balance.md, "The Elixir as an overdose"); `"elixir"`, below,
aims it in lines or sets the overdose's damage.
**Byzantium's tank and damage hero swapped** (`"heroes"` and `"leap"`,
below; owner, 2026-10-31; balance.md, "The Barbarian and the Cataphract
swapped"), on both sides, the party picked on the start menu too: the
Barbarian a tank, speed 1, defence 3 (health 8), power 2, the AI playing
him as one (`"caution": 0`), with **Hew** in place of Leap (later
2026-10-31): his axe through a funnel, the two spaces next to him either
side of one way and the space past them that touches both (2 away, off
his lines; where Hew is aimed), every unit there hit for his power,
allies too, and he gains Shield 1 for each enemy hit, added to any he
has, for 10 slots (his turn's at speed 1, so it lasts to his next;
`ABILITY.hew`; an Empower of 1 each until later 2026-10-31). Leap with
the four spaces in front and Shield 1 an enemy hit for 8 slots
(`"leap"`, below) until then. The
Cataphract Byzantium's damage hero, speed 2, defence 2 (health 6), power
2, without Armoured, Charge as built, and Armour 1 for 8 slots after
each charge (`"charge"`, below; owner, later 2026-10-31), where it leaves
him in melee. The Steppe's three were the enemy
until 2026-10-31.
**The Magus has Syzygy in place of Omen** (`"heroes"`, below; owner,
2026-10-31): one of his six lines, any distance, through anything (units,
yurts), and the cards of every unit on it, of either side, Humphrey too,
not Inevitable, rearranged on the track: each put on any blank card of the
deck (from the slot after his turn to 12 slots on, or the furthest card if
that is further), or several swapped among themselves in any order
(`ABILITY.syzygy`). No Magus is in the committed line-up: take him on the
start menu to play it. Aim it by tapping a line, then arrange on the
track: tap a card of the line (outlined in gold) to pick it up, then a
blank card (lit) to put it there, or another of the line's cards to swap
the two; its own card puts it back down. The preview's arrows show every
move; the button confirms once a card has moved. Esc or a right-click puts
a picked-up card down, then undoes the arrangement, then the line.

```json
{
  "seed": null,
  "map": "cave",
  "wait": true,
  "heroes": {
    "varangian": {"speed": 1, "defence": 3, "power": 2, "abilities": ["hew"], "caution": 0},
    "cataphract": {"speed": 2, "defence": 2, "power": 2, "passives": [], "caution": 1},
    "magus": {"abilities": ["syzygy"]}
  },
  "charge": {"armour": 1},
  "yurts": "none",
  "camel": {},
  "player": [
    {"hero": "modao"},
    {"hero": "youxia"},
    {"hero": "alchemist"}
  ],
  "enemy": [
    {"hero": "varangian"},
    {"hero": "cataphract"},
    {"hero": "priest"}
  ]
}
```

To fight Persia's boss, Zahhak and his two serpents, in his palace
(committed until 2026-10-29; also Persia's stage 4): `"map": "palace"`,
Persia's three heroes (`archer`, `mahout`, `magus`) against `zahhak` and
two `serpent`.

**Zahhak** (`zahhak`): speed 1, defence 4 (health 10), power 3. **Feed the
Serpents**: melee, his power. **Regrow**: his turn's action, a fallen
serpent grows back on an open space next to him at full health.
**Serpent King**: while either serpent is on the board, no damage reaches
his health. **The serpents** (`serpent`, two): speed 3, defence 0 (health
2), power 1, **Bite** (melee). Cut down, a serpent stays down until
Zahhak regrows it; once he falls, the fight is won. To beat him: cut both
serpents down, then hit him before his next turn.

To fight China's boss instead, the Bull Demon King and Princess Iron Fan:
`"map": "fireMountain"`, China's three heroes (`youxia`, `modao`,
`alchemist`) against `oxKing` and `fanLady`.

**The Bull Demon King** (`oxKing`): speed 1, defence 5 (health 12), power 3.
**Gore**: a charge of up to 2 in a line, every unit in its way hit and
Pushed back ahead of him. **Princess Iron Fan** (`fanLady`): speed 3, defence
2 (health 6), power 1. **Iron Fan**: every unit in a line of 3
from her Pushed 2. **Fan the Flames**: a space within 3 and the spaces
next to it catch fire for 8 slots; entering fire, walking or
Pushed, deals 1. **Devoted**, both: whenever one is hit, the other's card is
Hastened 3. When she falls she drops her fan; a hero entering its space
picks it up and may spend a turn with it (**Borrowed Fan**) putting out
every fire.

To fight the Steppe's boss instead, the Cyclops (`giant`): `"map":
"cave"`, the Steppe's three heroes against
`giant` and two `wolf`. Speed 1, defence 5 (health 12), power 3. **One
Eye**: Armour 3 against a hit (or a grapple's squeeze) from any unit not
standing in its front lane, straight out the way its eye faces at any
distance; a Piercing hit (Longshot) ignores it. The eye is drawn on the
edge of its hex it faces. It starts facing across the board, and turns
the way it last stepped on a walk, or toward what it aims at; being
Pushed or Pulled doesn't turn it. **Smash**: melee, its power.
**Boulder**: down any of Snap Shot's lanes, the first unit hit for its
power, then every other unit next to where it lands Pushed 1 away from
it, unhurt.

## Fields

| Field | What it is | Left out |
|---|---|---|
| `seed` | A whole number: the same seed lays out the yurts, mountains and units the same way every time. `null`: a new scatter each time. | `null` |
| `map` | The map, which sets the board's look: `"steppe"` (grass and yurts, every stage of a run so far), `"gobi"` (the Gobi Desert, the China region's: sand and oases, which block as yurts do, two or three a fight within 3 of the centre, and never mountains, whatever `yurts` says; yurts placed by hand are oases too), `"flaming"` (the Flaming Mountains, China's before the Gobi, no region's now: red earth, four or five patches of scorched ground of one or two spaces, spread over the board off the starting columns and the camel's road, burning 1 on a unit Moved onto it or ending its turn there, and one beacon tower in place of yurts, whenever `yurts` is `"random"` or `"mountains"`, and never mountains; yurts placed by hand are beacon towers too), `"salt"` (the Salt Flats, the Persia region's: a salt crust and one large salt dome over the centre and the six spaces around it, in every fight whatever `yurts` says, and nothing else: no yurts unless placed by hand, drawn as sandstone ruins; no unit can start inside the dome), `"fireMountain"` (the Flaming Mountains for China's boss: the same red earth with nothing on it, no beacon tower, scorched ground or mountains, unless yurts are placed by hand, drawn as beacon towers), `"cave"` (the Cyclops's cave, the Steppe's boss fight: a cave's stone floor with nothing on it, no yurts or mountains, unless yurts are placed by hand, drawn as yurts), `"palace"` (Zahhak's palace, Persia's boss fight: nothing on it, no yurts or mountains, unless yurts are placed by hand, drawn as sandstone ruins) or `"tuff"` (the Fairy Chimneys, the Byzantine region's: pale tuff and four or five fairy chimneys anywhere out to the edge but the starting columns, no two side by side in place of yurts, whenever `yurts` is `"random"` or `"mountains"`, and never mountains; yurts placed by hand are fairy chimneys too). The board itself is the same. | `"steppe"` |
| `yurts` | `"random"` (as in a normal fight: two or three yurts near the middle, and a range of 3 to 5 mountains in about half of fights), `"mountains"` (the same, always with the mountains, as in a run's first three stages), `"none"`, `"map"` (the map's fixed four), or a list of spaces, e.g. `[{"col": 3, "row": 3}]`. | `"random"` |
| `camel` | Temee: `{}` for the usual camel, or with `speed`, `defence` or `at` of its own. `false`: no camel, so the fight ends only when a side is beaten. | `{}` |
| `player` | Replaced by the start menu's party when started from there. Your units, 1 to 9, in party order (at most 11 without an `at`: the starting columns' spaces, fewer where a mountain stands). You control every one. | required |
| `enemy` | The AI’s units, 1 to 9 (at most 11 without an `at`). | required |
| `wait` | **Wait** (proposed, timeline.md 3.2): `true` and a turn that does nothing (Skip turn, or a turn skipped with only Hold to choose; not a Stunned one, nor Temee's) sends the card two thirds of its action cost on, rounded: 5, 6 and 7 slots for speeds 3, 2 and 1 in place of 8, 9 and 10, so Skip turn reads +6 beside an ability's +9. A number above 0 and at most 1 sets the share instead (`0.5`). Both sides play by it; the AI's search doesn't weigh the time a Wait saves, so it Waits only when that happens to look best, and an AI that does weigh it was measured Waiting in place of walking (balance.md, "Wait"). `false`: today's rule. | `false` |
| `swiftStrike` | Every Duelist's Swift Strike, both sides (the dash and the straight walk as in a run since 2026-10-31, the rest switches off there; balance.md, "The Duelist's lunge and streak"): `lunge`, up to that many spaces straight at the first unit in line before the strike, stopped by yurts, units and the map's edge, ending next to it; `passThrough`, `true` and the lunge may also pass through the units on its way, each hit, to a free space past them (aimed at that space), striking the unit in front of it too; `jump`, `true` and it may also jump a unit next to it to the free space past it (aimed at that space), hitting it, and from there jump another unit next to it in the same turn, never the same one twice, the turn going on until no jump is left or Skip turn ends it (with `lunge` 1, the unit 2 away in line is hit stepping one space in); `chain`, `false` and a jump ends the turn; `dash`, Swift Strike only a dash of up to that many spaces straight, through the units on the spaces before the last, each hit, to the free space it lands on (aimed at), from `dashMin` out (`2`; `0`, exactly `dash`, or with yurts or the map's edge on that space one fewer); no strike in place (`3`; `0`, the strike next to him, with `lunge` and `jump`); `walk`, the Duelist's own walk; `straight`, `true` and it walks straight along one of the six directions, as the Outrider does, at most `walk` spaces; `haste`, the slots his card is Hastened when he hits (`0`: none); `streak`, the Haste on turns striking running, the first strike's, the second's and so on, the last held while it lasts (`[2, 3, 4]`), a turn without a strike, a walk included, starting it again. `streakResets`, `false` and it isn't started again, each hit of the fight raising the Haste. Each part left out keeps its own rule. | Swift Strike as in a run: a dash of 2 or 3 through a unit (`dash` 3, `dashMin` 2), Haste 3, a straight walk of 3; `"dash": 0` for the strikes next to him (a lunge, jumps) |
| `blessing` | Every Priest's Blessing, both sides: `self`, `false` and it leaves him out, blessing only the units on the line aimed (an empty line then does nothing). | Blessing as built: he is blessed too, whatever line he aims |
| `elixir` | Every Elixir, both sides, a hero's or one given in `abilities`: `line`, a number from 1 to 8 and it is aimed as Axe Throw is, at any unit on one of the six lines out from its user within that many spaces, over units and yurts, its effects as built (so the Alchemist can't give one to himself); `0`, as built. `overdose`, a number from 0 to 20: above 0, the unit given it, ally or enemy, is Empowered until its hits deal that much, for 8 slots, then hit for its user's power, no heal, hit or Weaken besides (6 as built); `0`, the Elixir before it (an ally healed his power and Empowered 2, an enemy hit and Weakened 2), at the built range of 3. | Elixir as built: an overdose to 6, any unit within 3, himself too |
| `heroes` | Every unit of a hero, both sides, the party picked on the start menu too, by the hero's id: `speed`, `defence`, `power`, `abilities` as a unit's (below), each under a unit's own; `passives`, its hero's own in place of config.ts's (`[]`: none, the Cataphract without Armoured; a unit's `passives` are added beside them); `caution`, how much the AI shies from enemy reach with it, 0 (a tank's: it walks into reach) to 5, 1 the other heroes'. E.g. `{"cataphract": {"power": 2, "passives": []}}`. | each hero as config.ts has it |
| `leap` | Every Leap, both sides, a hero's or one given in `abilities`: `shape`, the spaces its axe strikes next to where he lands, `"front"` (the two ahead), `"forward"` (four, all but the two he flew over) or `"splash"` (the front two for his power, the other four for 1); `shieldPerHit`, 0 to 8, the Shield he gains for each enemy hit, Humphrey and allies not counted, for 8 slots, added to any he has. | Leap as built: `"front"`, no Shield |
| `charge` | Every Charge, both sides, a hero's or one given in `abilities`: `armour`, 0 to 8, the Armour its user gains after each charge, for 8 slots (a hit on it that much less, unless it Pierces). | Charge as built: no Armour after it |

Any field starting with `$` (like `$comment`) is ignored, for notes.

### A unit

| Field | What it is | Left out |
|---|---|---|
| `hero` | `"bokh"` (Grappler), `"mangudai"` (Outrider), `"storm"` (Storm Caller), `"modao"` (Vanguard), `"alchemist"` (Alchemist), `"youxia"` (Duelist), `"magus"` (Magus, Inevitable from the start), `"mahout"` (Juggernaut, Unstoppable from the start), `"archer"` (Ranger), `"varangian"` (Barbarian), `"cataphract"` (Cataphract, no walk of its own: it moves by Charge), `"wolf"` or `"fox"` (the Fox Spirit: the wolf's stats and Bite, the China region's creature) `"giant"` (the Cyclops, above, One Eye from the start), `"oxKing"` or `"fanLady"` (China's boss, above, Devoted from the start). A hero may appear more than once, on either side. | required |
| `speed` | 0 to 30. Its card goes 60 ÷ (speed + 5) slots on after each turn, rounded. | the hero's |
| `defence` | 0 to 30. Health is (1 + defence) × 2. | the hero's |
| `power` | 0 to 30. Every ability deals exactly this. | the hero's |
| `abilities` | Up to 2 of `"snapShot"`, `"skirmish"`, `"volley"`, `"feignedRetreat"`, `"hail"`, `"sunlight"`, `"gale"`, `"grapple"` (which throws, once it holds a unit), `"haul"`, `"shove"`, `"bite"`, `"cleave"`, `"elixir"`, `"swiftStrike"`, `"omen"`, `"syzygy"`, `"stomp"`, `"longshot"`, `"charge"`, `"blessing"`, `"invocation"`, `"reave"`, `"smash"`, `"boulder"`, `"gore"`, `"bananaFan"`, `"fanFlames"`, `"hew"`, on any hero (a unit has at most 2 abilities besides Hold). Hold (and so moving) is always there. `[]`: Hold only. | the hero's starting kit |
| `passives` | Any of the passives (progression.md, 19.8; no hero has one in a run yet): `"steadyGait"`, `"secondWind"`, `"patient"`, `"momentum"`, `"rooted"`, `"unstoppable"`, `"lightStep"`, `"rebound"`, `"hardened"`, `"lastStand"`, `"piercingEye"`, `"opportunist"`, `"bulwark"`, `"glassCannon"`, `"ironWill"`, `"shakeLoose"`, `"flanker"`, `"loneWolf"`, `"rally"`, `"vengeance"`, `"oneEye"` (the giant's: it faces a way only with it) or `"devoted"` (the Bull Demon King's and Princess Iron Fan's: a hit on one Hastens every other Devoted unit of its side 3), on any unit. Shown on its stat sheet. | none |
| `at` | Its starting space, `{"col": c, "row": r}`. | a random space on its side's two starting columns (yours the two on the right edge, the enemy's the two on the left), never the camel's starting corner or its exit |

The heroes' own numbers and starting kits are `HEROES` in
[`src/rules/config.ts`](src/rules/config.ts); ability shapes (ranges,
Sunlight's Empower, Skirmish's charge) are `ABILITY` there, and apply to
the test stage too.

### Spaces

The board is a hexagon of flat-top hexes in nine columns, `0` (left) to
`8` (right), 5, 6, 7, 8, 9, 8, 7, 6 and 5 hexes long. A space's `row`
counts down its column from `0` at that column's top, so column 0 has rows
`0` to `4`, column 4 (the middle) `0` to `8`. Your units start on columns 7
and 8, facing left, the enemy's on columns 0 and 1, facing right. The camel
starts at the top-right corner, `{"col": 8, "row": 0}`, and walks to the
only exit, the bottom-left corner, `{"col": 0, "row": 4}`, or starts at the
bottom-right corner, `{"col": 8, "row": 4}`, and walks to the top-left one,
`{"col": 0, "row": 0}`: the seed picks which (a corner a unit is placed on
is left out). A unit placed on one of the random or the map's yurts (or mountains)
clears it;
two things on one space (yurts you list included) is an error.
