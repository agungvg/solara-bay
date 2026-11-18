# Solara Bay — Rebuild Assessment (2026-11-18)

Read of every module before the maximal rebuild. Scores vs the gta6-01 brief
("most complete open-world crime game") plus Lyso's hard requirement that
NPCs feel ALIVE like main characters.

## Scores

| Brief item | Score | Evidence |
|---|---|---|
| City density + variety | THIN | 3 facade palettes on plain boxes; height varies only by distance from centre; props = palms, lamps, crates, umbrellas, fountain. No signs, no hydrants/bins/benches/stalls, no traffic lights, no billboards, no rooftop detail, no shopfronts. All buildings use MeshLambertMaterial (flat plastic look). |
| Driving feel | SOLID core / THIN feel | Arcade handling works (accel/brake/handbrake, speed FOV, engine hum). Cars have no interiors, no taillights, no skid/damage feedback beyond smoke; traffic never stops or honks. |
| Traffic density | THIN | 20 moving cars + 3 parked + 1 mission car on a 9x9 grid (464 m). Roads read empty in wide shots. Drivers are invisible — no honk, no braking reaction to the player, no bailing except on steal. |
| Pedestrian variety | STUBBED | 24 walkers, same body shape, 4 skins / 7 shirts / 4 pants. They walk back and forth on one sidewalk forever. No jobs, no waiting, no talking, no sitting, no barks, no witness behaviour, no routines. Flee only from a fast car / gunshot. This is the biggest gap vs Lyso's "NPCs must live like main characters". |
| Steal car | SOLID | Driver bails and flees on foot, wanted +1, toast. Magenta mission car works. |
| Wanted / police | THIN | Levels 0–5, decay when quiet, police cars chase + ram, foot cops punch + arrest at low health. NO roadblocks, NO search/last-known-position behaviour, NO escalation beyond spawn counts, NO lose-them-by-distance (decay is time-only). |
| Mission chain | SOLID core / THIN narrative | All 6 missions are real (objectives, timers, checkpoints, shootout, rewards, fail/restart). But story = one Sal line per mission; no intro/outro cards, no story text, no mission roster anywhere. |
| Combat | SOLID | Hitscan pistol with tracers/impacts, punch arc, gang AI that shoots back, car damage smoke → explosion. THIN: peds die instantly with no reaction; no hit feedback on peds. |
| HUD / minimap | THIN | Money, health bar, stars, objective + distance, weapon/ammo, speed, radio line, circular minimap with roads + player arrow + mission pin + police blips. NO street/site labels, NO clock, NO mission progress (2/6), NO ped/gang blips, NO bark/dialogue channel for NPCs. |
| Start screen | THIN | Plain panel: title, blurb, 2 buttons, controls list. No mission roster, no stats, no save info. |
| Save / continue | SOLID core / THIN surface | Persists money/mission/health/ammo/position, autosaves on mission complete. Continue button shows no save info (mission, money, time). |
| Audio | SOLID core / THIN ambience | Synthesised engine, siren, gunshots, punches, pickups, mission jingles, original Am–F–C–G music loop. No honk, no pedestrian scream, no ambient city bed. |
| Polish / materials | THIN | Everything MeshLambertMaterial, one sun + hemisphere, no tonemapping, no warm/cool contrast tuning, no wear (adjacent buildings can be identical), no signage. |

## What the rebuild changes (breadth first, then depth)

1. **NPC life (hard requirement)** — new `npc.js`-style system inside
   `traffic.js`: archetypes (walker, jogger, tourist, worker, shopkeeper,
   talker pair, sitter), routines (walk to a destination → idle/wait/work/chat
   → next destination, crosswalks at intersections), reactions (flee gunfire
   and speeding cars with arms-up panic + "!" marker, panic barks, witness a
   crime → call the police after a delay which feeds wanted, bump reaction),
   ambient barks shown in a HUD bark line, varied bodies (height, hats,
   aprons, hi-vis vests, backpacks). Drivers honk + brake when blocked.
   Pedestrian count 24 → 44, traffic 20 → 26.
2. **City detail** — 5 facade palettes + per-building value jitter, rooftop
   props (AC boxes, tanks, antennas), canvas-texture shop signs with original
   names, food stalls at plaza + beach bar, hydrants, bins, benches, bus stops,
   traffic lights at intersections, billboards, containers at the docks.
3. **Materials / light (realism skill)** — car paint becomes glossy
   MeshStandardMaterial (metalness/roughness), glass, asphalt matte, concrete;
   ACES tone mapping; warm sun vs cool sky fill; lamp bulbs as practicals.
4. **Vehicles** — interiors (seats, wheel, dash), taillights, bumpers,
   hubcaps, two new body shapes (convertible, pickup).
5. **Police escalation** — roadblocks at wanted ≥ 4 (police cars parked across
   the road ahead), search behaviour when the player is far (last known
   position), faster/more cars at 5 stars.
6. **Missions as story** — intro/outro cards with story text per mission,
   extra Sal/Mara/Viper dialogue beats, mission roster on the start menu.
7. **HUD** — in-game clock, mission progress (Mission 2/6), named-site labels
   + ped/gang blips on the minimap, NPC bark line, save info on Continue.
8. **Audio** — honk, pedestrian scream, ambient city bed (distant traffic hum).

## Must not break

E2E verb chain: walk → steal car → drive → wanted → escape → mission → save →
reload → continue. Zero network requests, zero uncaught errors. 4 screenshots
≤ 262,144 B each, one clearly showing lively NPCs.
