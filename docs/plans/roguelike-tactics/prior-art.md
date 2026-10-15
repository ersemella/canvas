# Roguelike tactics: prior art

> Part of the roguelike tactics plan — start at [README.md](README.md),
> which has the status, the next step and an index of every decision.

## Prior art

Researched 2026-10-13/14 (from memory, plus web searches for the live
invasion games; details not checked against each game). No game found
does exactly this game's ghosts — AI copies of other players' characters
invading your dungeon at the same depth, at most once per run, scored by
unique players killed — but each part exists somewhere. (Researched for
the dungeon-crawl version; since 2026-10-15 ghosts are rival caravans,
copies of whole parties met as a fight, which brings the game closer to
the snapshot battlers below — Backpack Battles, Super Auto Pets, The
Bazaar.)

**Ghosts (asynchronous copies of players):**

| Game | What it does | Lesson |
|---|---|---|
| Nioh 1–3 (revenants) | A dead player's grave summons an AI copy with their level and gear; beat it for loot | Closest match. Show the owner's details before the fight (D8); Nioh 2 moved drops from exact gear copies to randomised stats (D2) |
| NetHack, Dungeon Crawl Stone Soup | A dead character's ghost and gear can appear in another player's game at the same depth; NetHack's bones file is used once | Same-depth idea; ghosts there are weak loot guardians, not full builds |
| Super Auto Pets, Backpack Battles, The Bazaar | Each round, fight a saved copy of another player's build from the same round | Structurally closest; they also match by rank/record (question 12) |
| Tekken 7/8 Ghost Battle, Killer Instinct Shadows, Forza Drivatars | AI learns a player's habits; others fight or race it | Players enjoy fighting someone's *style* — the later "ghosts copy habits" idea (D1) |
| Dragon's Dogma 1/2 (pawns) | Your AI companion is hired into others' games; you're rewarded and hear what it did | Closest to D9's reward loop; tell the ghost's story (D9) |
| Clash of Clans, The Mighty Quest for Epic Loot | Others raid your AI-defended base; you earn when defences win and can watch replays | Owner rewards for an AI proxy work; replays are a strong but costly extra (D9) |
| Spelunky, Mario Kart, Trackmania | Race against replays of other players | Ghosts that can't interact; not this mechanic |
| Middle-earth: Shadow of Mordor (Nemesis System) | An enemy that kills you is remembered, promoted and grows in renown (single-player) | Close in spirit to legends. Warner Bros. holds a US patent on the Nemesis System; this design differs (real players' ghosts, a fame score, no promotion hierarchy, nemesis rule dropped), but get legal advice before making ghosts remember and adapt to individual players |

**Live invasions** (lessons under [pvp.md](pvp.md)): Demon's Souls,
Dark Souls, Bloodborne and Elden Ring; Deathloop; Watch Dogs; Dying Light
(Be the Zombie); Sniper Elite 5; Doom Eternal (announced, cancelled);
Napoleon: Total War (a friend takes the enemy army in your campaign, real
time); Athena Crisis (turn-based).

Sources (web searches, 2026-10-14):
- Deathloop: [TechRadar](https://www.techradar.com/how-to/deathloop-invasion-tips-and-how-to-win-as-julianna),
  [Shacknews](https://www.shacknews.com/article/126631/how-to-turn-off-pvp-invasions-deathloop),
  [The AU Review](https://www.theaureview.com/games/deathloop-review-ps5/)
- Watch Dogs: [Watch Dogs Wiki](https://watchdogs.fandom.com/wiki/Online_Hacking),
  [Engadget](https://www.engadget.com/2014-06-27-watch-dogs-multiplayer-tuned-to-keep-you-playing.html),
  [GamingBolt](https://gamingbolt.com/watch-dogs-player-invasions-occur-during-free-roam-wont-disrupt-campaign-missions/amp)
- Elden Ring: [Inverse](https://inverse.com/gaming/elden-ring-co-op-details-multiplayer-coop),
  [Sportskeeda](https://sportskeeda.com/esports/top-5-features-elden-ring-s-closed-network-test-will-excite-players)
- Dying Light: [Game Informer](https://gameinformer.com/games/dying_light/b/playstation4/archive/2014/08/14/invade-the-worlds-of-your-friends-in-dying-light.aspx),
  [Gematsu](https://www.gematsu.com/2014/10/dying-light-trailer-shows-asymmetric-multiplayer)
- Sniper Elite 5: [Rebellion support](https://support.rebellion.com/hc/en-gb/articles/5232302039069-What-is-Invasion-Mode-or-can-I-turn-it-off)
- Doom Eternal: [GameSpot](https://gamespot.com/articles/doom-eternals-invasion-mode-has-been-canceled-will-be-replaced-with-horde-mode/1100-6493540/),
  [PC Gamer](https://www.pcgamer.com/doom-eternal-invasion)
- Athena Crisis: [Pocket Gamer](https://www.pocketgamer.com/athena-crisis/invasions-update);
  Napoleon: Total War: [Gaming Nexus](https://gamingnexus.com/News/16065/Napoleon-Total-War-pits-players-against-one-another2c-in-the-single-player-campaign)
- Nioh: [Nioh 2 wiki (Fextralife)](https://nioh2.wiki.fextralife.com/Online),
  [SegmentNext](https://segmentnext.com/2017/02/08/nioh-easy-glory-farming-guide-how-to-farm-glory-fast-tips),
  [SamuraiGamers](https://samurai-gamers.com/nioh/sword-mounds-bloody-graves-nioh)
