# The test stage

A single fight you set up by hand in [`test-stage.json`](test-stage.json),
for play-testing a line-up, stats or an ability the run's stages don't
bring. Start it from the start menu's **Test stage** button (under Back to
Canvas). It is a run of one fight: win it and the run is won; there is no
next stage.

The server reads the file when the stage starts, so after an edit start
the stage again (locally, `wrangler dev` reloads on its own; the deployed
site uses the committed file). If the file has a mistake, the start menu
says what and where, e.g. `test-stage.json: enemy[1] has an unknown field
"powr"`.

## Example

The committed file (2026-10-29), durations in slots (`"rules"`, below):
China's three heroes against the Steppe's, on the Gobi. Every effect
that lasted until a unit's next turn (here the Elixir's Empower and
Weaken) lasts 10 slots, hail 18, whatever turns come in between: the
abilities' text, the turn preview and a unit's statuses say so. Delete
`"rules"` to play the same fight by turns.

```json
{
  "seed": null,
  "map": "gobi",
  "yurts": "random",
  "camel": {},
  "rules": {"slots": {"turn": 10, "hail": 18, "stun": 6}},
  "player": [
    {"hero": "modao"},
    {"hero": "youxia"},
    {"hero": "alchemist"}
  ],
  "enemy": [
    {"hero": "bokh"},
    {"hero": "mangudai"},
    {"hero": "storm"}
  ]
}
```

To fight Persia's boss, Zahhak and his two serpents, in his palace
(committed until 2026-10-29; also Persia's stage 4): `"map": "palace"`,
Persia's three heroes (`archer`, `mahout`, `magus`) against `zahhak` and
two `serpent`, no `"rules"`.

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
next to it catch fire until her next turn; entering fire, walking or
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
| `map` | The map, which sets the board's look: `"steppe"` (grass and yurts, every stage of a run so far), `"gobi"` (the Gobi Desert, the China region's: sand and oases, which block as yurts do, two or three a fight within 3 of the centre, and never mountains, whatever `yurts` says; yurts placed by hand are oases too), `"flaming"` (the Flaming Mountains, China's before the Gobi, no region's now: red earth, four or five patches of scorched ground of one or two spaces, spread over the board off the starting columns and the camel's road, burning 1 on a unit Moved onto it or ending its turn there, and one beacon tower in place of yurts, whenever `yurts` is `"random"` or `"mountains"`, and never mountains; yurts placed by hand are beacon towers too), `"salt"` (the Salt Flats, the Persia region's: a salt crust and one large salt dome over the centre and the six spaces around it, in every fight whatever `yurts` says, and nothing else: no yurts unless placed by hand, drawn as sandstone ruins; no unit can start inside the dome), `"fireMountain"` (the Flaming Mountains for China's boss: the same red earth with nothing on it, no beacon tower, scorched ground or mountains, unless yurts are placed by hand, drawn as beacon towers), `"cave"` (the Cyclops's cave, the Steppe's boss fight: a cave's stone floor with nothing on it, no yurts or mountains, unless yurts are placed by hand, drawn as yurts), `"palace"` (Zahhak's palace, Persia's boss fight: nothing on it, no yurts or mountains, unless yurts are placed by hand, drawn as sandstone ruins) or `"tuff"` (the Fairy Chimneys, the Byzantine region's: pale tuff and seven or eight fairy chimneys anywhere out to the edge but the starting columns, no two side by side in place of yurts, whenever `yurts` is `"random"` or `"mountains"`, and never mountains; yurts placed by hand are fairy chimneys too). The board itself is the same. | `"steppe"` |
| `yurts` | `"random"` (as in a normal fight: two or three yurts near the middle, and a range of 3 to 5 mountains in about half of fights), `"mountains"` (the same, always with the mountains, as in a run's first three stages), `"none"`, `"map"` (the map's fixed four), or a list of spaces, e.g. `[{"col": 3, "row": 3}]`. | `"random"` |
| `camel` | Temee: `{}` for the usual camel, or with `speed`, `defence` or `at` of its own. `false`: no camel, so the fight ends only when a side is beaten. | `{}` |
| `player` | Your units, 1 to 9, in party order (at most 11 without an `at`: the starting columns' spaces, fewer where a mountain stands). You control every one. | required |
| `enemy` | The AI’s units, 1 to 9 (at most 11 without an `at`). | required |
| `rules` | This fight's own rules, which no run has. `{"slots": {"turn": t, "hail": h, "stun": s}}`: durations in slots in place of turns (2026-10-29). Every effect that lasted until a unit's next turn (Empower, Weaken, a Shield but a lasting one, Fortify's Armour, the Immobilized of a pin or Hamstring, Princess Iron Fan's fire) lasts `t` slots from the slot it is given, hail `h`; each ends as the track passes its last slot, whatever turns come in between, so a fast unit can fit two Empowered turns in and a Delay can carry a card past its Weaken. A Stun for a unit's next turn (Last Stand, Concussive, Lockdown, Defy Fate, a slam with `ABILITY.charge.slam` at `stun`) is a Delay of `s` instead, which Unstoppable and Iron Will still stop. Whole numbers 1 to 60; left out, 10, 18 and 6. A grapple's hold, which lasts until the Grappler is hit, is unchanged. | none: every duration by turns |

Any field starting with `$` (like `$comment`) is ignored, for notes.

### A unit

| Field | What it is | Left out |
|---|---|---|
| `hero` | `"bokh"` (Grappler), `"mangudai"` (Outrider), `"storm"` (Storm Caller), `"modao"` (Vanguard), `"alchemist"` (Alchemist), `"youxia"` (Duelist), `"magus"` (Magus, Inevitable from the start), `"mahout"` (Juggernaut, Unstoppable from the start), `"archer"` (Ranger), `"varangian"` (Barbarian), `"cataphract"` (Cataphract, no walk of its own: it moves by Charge), `"wolf"` or `"fox"` (the Fox Spirit: the wolf's stats and Bite, the China region's creature) `"giant"` (the Cyclops, above, One Eye from the start), `"oxKing"` or `"fanLady"` (China's boss, above, Devoted from the start). A hero may appear more than once, on either side. | required |
| `speed` | 0 to 30. Its card goes 60 ÷ (speed + 5) slots on after each turn, rounded. | the hero's |
| `defence` | 0 to 30. Health is (1 + defence) × 2. | the hero's |
| `power` | 0 to 30. Every ability deals exactly this. | the hero's |
| `abilities` | Up to 2 of `"snapShot"`, `"skirmish"`, `"volley"`, `"feignedRetreat"`, `"hail"`, `"sunlight"`, `"gale"`, `"grapple"` (which throws, once it holds a unit), `"haul"`, `"shove"`, `"bite"`, `"cleave"`, `"elixir"`, `"swiftStrike"`, `"omen"`, `"stomp"`, `"longshot"`, `"charge"`, `"blessing"`, `"reave"`, `"smash"`, `"boulder"`, `"gore"`, `"bananaFan"`, `"fanFlames"`, on any hero (a unit has at most 2 abilities besides Hold). Hold (and so moving) is always there. `[]`: Hold only. | the hero's starting kit |
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
