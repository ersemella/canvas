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
    {"hero": "mangudai", "at": {"col": 5, "row": 3}}
  ]
}
```

## Fields

| Field | What it is | Left out |
|---|---|---|
| `seed` | A whole number: the same seed scatters the ruins and units the same way every time. `null`: a new scatter each time. | `null` |
| `ruins` | `"random"` (six, scattered as in a normal fight), `"none"`, `"map"` (the map's fixed four), or a list of spaces, e.g. `[{"col": 3, "row": 3}]`. | `"random"` |
| `camel` | Temee: `{}` for the usual camel, or with `speed`, `defence` or `at` of its own. `false`: no camel, so the fight ends only when a side is beaten. | `{}` |
| `player` | Your units, 1 to 9, in party order. You control every one. | required |
| `enemy` | The AI's units, 1 to 9. | required |

Any field starting with `$` (like `$comment`) is ignored, for notes.

### A unit

| Field | What it is | Left out |
|---|---|---|
| `hero` | `"bokh"` (Bökh Champion), `"mangudai"` (Mangudai Outrider), `"storm"` (Yadachy Storm Caller) or `"wolf"`. A hero may appear more than once, on either side. | required |
| `speed` | 0 to 30. Its card goes 60 ÷ (speed + 5) slots on after each turn, rounded. | the hero's |
| `defence` | 0 to 30. Health is (1 + defence) × 2. | the hero's |
| `power` | 0 to 30. Every ability deals exactly this. | the hero's |
| `abilities` | Any of `"longshot"`, `"skirmish"`, `"hail"`, `"sunlight"`, `"grapple"`, `"throw"`, `"bite"`, on any hero. Hold (and so moving) is always there. `[]`: Hold only. | the hero's starting kit |
| `at` | Its starting space, `{"col": c, "row": r}`. | a random space on its side's starting column (yours the left edge, the enemy's the right) |

The heroes' own numbers and starting kits are `HEROES` in
[`src/rules/config.ts`](src/rules/config.ts); ability shapes (ranges,
Sunlight's Enhance, Skirmish's charge) are `ABILITY` there, and apply to
the test stage too.

### Spaces

Rows run from `-1` (top) to `7` (bottom). On even rows (0, 2, 4, 6) columns
run `0` to `6`; on odd rows `-1` to `6`, except the top and bottom rows
(`-1` and `7`), which run `0` to `5`. The camel starts at `{"col": 0, "row":
-1}` (top left) and walks to the only exit, `{"col": 5, "row": 7}` (bottom
right). A unit placed on one of the random or the map's ruins clears it;
two things on one space (ruins you list included) is an error.
