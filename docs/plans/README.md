# Plans

Read only the plan your task needs; each says what else to read.

| Plan | Status | Read when |
|---|---|---|
| [roguelike-tactics/](roguelike-tactics/README.md) | Phase 1 built and deployed (a three-stage run against the AI); stats, keywords, track and kits reworked by the owner (2026-10-23); every action costs 60 ÷ (speed + 5) slots, rounded; the camel starts last and ends stalled fights; the Storm Caller's power is 1; walks of 2 and Hail on a ring 2 away (2026-10-24); a caravanserai between stages, a provision after stages 1 and 2 (2026-10-25); a map per region, the Gobi Crossing built for China, shown on the test stage (2026-10-25); the passives built, on no hero yet, given on the test stage (2026-10-25) | Working on Silk Road Run, the tactical roguelike (combat design, rival caravans, architecture). Split by topic: start at its README, which says which file a task needs |
| [client-side-runs.md](client-side-runs.md) | Built 2026-10-25: Silk Road Run plays in the browser, its AI in a Web Worker as deep as the device gets; the Worker's runs removed | Working on how a run is hosted and saved (`localRuns.ts`, the engine's `runs.ts`), the browser AI's budget (`AI.browser`), or one tab per run |
| [async-games.md](async-games.md) | Parked until an async game exists | Building a game whose turns take hours (seat tokens, push, "my games") |
| [engine-platform-split.md](engine-platform-split.md) | Done 2026-10-11; history and follow-ups | Revisiting why the engine, games and platform are separate packages, or picking up one of its follow-ups |
