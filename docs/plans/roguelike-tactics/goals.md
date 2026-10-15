# Roguelike tactics: design goals

Design goals, intended feel and the types of fun the game aims for. Read first for any design work.

> Part of the roguelike tactics plan. Start at [README.md](README.md),
> which maps every combat-design section number ("section 3.4") to its
> file and indexes every decision. Abandoned approaches are in
> [history.md](history.md).

Rules are marked **Decided** or **Proposed**; numbers marked TBD are
tuning. Section numbers are the combat design's.

## 1. Design Goals

1. **Reward strategy at two distinct levels.** Players should clearly understand that success depends on both:
   - **Build:** choosing the right gear for each character and the right combination of characters in the party.
   - **Play:** making good decisions during combat.
2. **Make outcomes attributable.** After a win or loss, a player should be able to tell whether the build or the in-combat decisions were responsible. Randomness inside combat is kept small and visible for this reason.
3. **Avoid a "solved" feeling.** Combat should not reduce to identical, precise arithmetic every turn. Small, visible variance and hidden-but-discoverable enemy stats support this (your own units' stats are shown, D11).
4. **Treat time as a shared resource.** Turn order is a single timeline that every player is trying to manipulate. Deciding how much to do on a turn, and affecting when other units act, are core strategic decisions.
5. **Stay PvP-ready.** The system may later support player-versus-player matches, so it must not depend on information or mechanics that only work against a computer-controlled opponent.

### 1.1 Intended Feel
A readable tactical duel about tempo, wrapped in a drafting roguelike.

- **In combat:** chess with a clock. Nothing on the board is hidden and nothing is left to chance, so every turn asks what an action is worth and how much time to spend on it. The timeline is the centrepiece: players trade tempo for power, push enemies back and line up delayed actions. A lost fight should make clear why: the team could not answer something, or time was spent badly.
- **Between fights:** building a band rather than a deck. The party starts small, grows through recruitment offers, and each hero develops along their own path through gear and upgrades. Permanent death and limited recovery give the run weight.
- **Tone:** tense, but rarely surprising. Difficulty comes from smarter, better-built enemies and tighter situations, not from bigger numbers or bad luck.
- **Short pitch:** Into the Breach with a Final Fantasy Tactics timeline and a Darkest Dungeon roster.
- **Setting:** a fantasy Silk Road, where rival caravans from many cultures race along the road and try to stop each other (section 15).

### 1.2 Types of Fun
Using the eight types of fun from the MDA framework (Hunicke, LeBlanc and Zubek):

| Type of fun | Fit | Where it comes from |
|---|---|---|
| **Challenge** (game as obstacle course) | **Primary** | Deterministic combat, full information, previews, clear attribution of outcomes, permanent death, difficulty from better enemies rather than bigger numbers. |
| **Expression** (game as self-discovery) | Strong secondary | Team building through recruitment, gear and milestone upgrades; the main source of run-to-run identity. |
| **Discovery** (game as uncharted territory) | Secondary | Hidden enemy stats learned through previews (own stats are shown, D11); finding combinations of heroes and keywords. |
| **Fellowship** (game as social framework) | Secondary | Rival caravans ([ghosts.md](ghosts.md)): other players' runs appear in yours, and your caravan's kills earn recognition. More if PvP ships. |
| **Fantasy** (game as make-believe) | Light | Heroes with signature weapons and distinct identities; the design is mechanics-first. |
| **Narrative** (game as drama) | Low | Only emergent stories from runs, such as a hero lost at a bad moment. |
| **Sensation** (game as sense-pleasure) | Low | Turn-based and readable by design, with few moment-to-moment thrills. |
| **Submission** (game as pastime) | Low | Fights demand attention; not designed to be played on autopilot. |

**Design test:** a feature that mainly serves challenge or expression fits the game. A feature that mainly serves sensation or submission (spectacle, grinding, idle progression) probably pulls against it.

## Open questions (from section 14, original numbers)

35. Whether the "Fantasy" type of fun (1.2) should be raised from Light now that the setting and folklore-based roster are defined.
