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

```json
{
  "seed": null,
  "ruins": "random",
  "camel": {},
  "player": [
    {"hero": "bokh"},
    {"hero": "mangudai", "abilities": ["longshot", "skirmish"]},
    {"hero": "storm", "power": 2, "abilities": ["hail", "sunlight"]}
  ],
  "enemy": [
    {"hero": "wolf"},
    {"hero": "wolf", "speed": 3, "power": 2},
    {"hero": "mangudai", "at": {"col": 7, "row": 2}}
  ]
}
```

## Fields

| Field | What it is | Left out |
|---|---|---|
| `seed` | A whole number: the same seed lays out the mountains and units the same way every time. `null`: a new scatter each time. | `null` |
| `ruins` | `"random"` (as in a normal fight: no ruins, and a range of 3 to 5 mountains in about half of fights), `"none"`, `"map"` (the map's fixed four), or a list of spaces, e.g. `[{"col": 3, "row": 3}]`. | `"random"` |
| `camel` | Temee: `{}` for the usual camel, or with `speed`, `defence` or `at` of its own. `false`: no camel, so the fight ends only when a side is beaten. | `{}` |
| `player` | Your units, 1 to 9, in party order (at most 5 without an `at`: the starting column's spaces). You control every one. | required |
| `enemy` | The AI's units, 1 to 9 (at most 5 without an `at`). | required |

Any field starting with `$` (like `$comment`) is ignored, for notes.

### A unit

| Field | What it is | Left out |
|---|---|---|
| `hero` | `"bokh"` (Bökh Champion), `"mangudai"` (Mangudai Outrider), `"storm"` (Yadachy Storm Caller) or `"wolf"`. A hero may appear more than once, on either side. | required |
| `speed` | 0 to 30. Its card goes 60 ÷ (speed + 5) slots on after each turn, rounded. | the hero's |
| `defence` | 0 to 30. Health is (1 + defence) × 2. | the hero's |
| `power` | 0 to 30. Every ability deals exactly this. | the hero's |
| `abilities` | Up to 3 of `"longshot"`, `"skirmish"`, `"volley"`, `"feignedRetreat"`, `"hail"`, `"sunlight"`, `"gale"`, `"grapple"` (which throws, once it holds a unit), `"haul"`, `"shove"`, `"bite"`, on any hero (a unit has at most 3 abilities besides Hold). Hold (and so moving) is always there. `[]`: Hold only. | the hero's starting kit |
| `at` | Its starting space, `{"col": c, "row": r}`. | a random space on its side's starting column (yours the left edge, the enemy's the right) |

The heroes' own numbers and starting kits are `HEROES` in
[`src/rules/config.ts`](src/rules/config.ts); ability shapes (ranges,
Sunlight's Enhance, Skirmish's charge) are `ABILITY` there, and apply to
the test stage too.

### Spaces

The board is a hexagon of flat-top hexes in nine columns, `0` (left) to
`8` (right), 5, 6, 7, 8, 9, 8, 7, 6 and 5 hexes long. A space's `row`
counts down its column from `0` at that column's top, so column 0 has rows
`0` to `4`, column 4 (the middle) `0` to `8`. Your units start on column 0,
the enemy's on column 8. The camel starts at the top point, `{"col": 4,
"row": 0}`, and walks to the only exit, the bottom point, `{"col": 4,
"row": 8}`. A unit placed on a random mountain or one of the map's ruins clears it;
two things on one space (ruins you list included) is an error.
