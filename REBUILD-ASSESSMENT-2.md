# Solara Bay — Rebuild Assessment 2 (2026-11-18, pass 2)

Lyso's order: rebuild again after updating all skills and learning from
Marisol Heat. Then Lyso reacted to the rebuild-1 mission shot
("Duh kok masih jelek banget ga susuai") — this pass had to fix those
5 concrete complaints, not just add features.

## Lyso's 5 complaints about rebuild-1 (4-mission.jpg) — before / after

| # | Complaint (rebuild-1 shot) | Pass-2 fix | Verdict in the new shots |
|---|---|---|---|
| 1 | Characters are literal block figures — cube heads, rectangular bodies, stick legs. Player is a blue block with a crosshair on his head. No face or hands visible at gameplay distance. | Real faces (eyes with whites/irises/pupils/highlights, modelled nose, lips, brows, ears, 4 sculpted hair variants), articulated hands (palm + 3 fingers + thumb), clothing detail (collar, pockets, seams, belt+buckle, shoes), richer poses (torso twist, head bob/tracking, breathing, sway). Mission preset camera tightened. | PROVEN in close-up (review/closeup-face.jpg): face + fingers + zipper + belt all legible. At gameplay distance the player from behind still reads blocky — a rear view cannot show a face. Gang at 15 m still read as small figures (distance reality). Honest limit, not a camera trick. |
| 2 | Dock containers are flat solid-colored cubes with zero detail. | Corrugation (procedural canvas texture), labels (PIER 9 CARGO / BAY FREIGHT / SOLARA LINES / FRAGILE + serials), rust/streak variation, varied stacking, a dock gantry crane. | FIXED — visible in new 4-mission.jpg. |
| 3 | Ground is a huge flat empty tan expanse — no texture, no props. | Procedural dock ground texture (concrete panels, seams, stains, tire marks) + dock props (crates, barrels, pallets, fences, bollards). Plaza entries closed by bollards + planters. | FIXED at the docks. Plaza ground is still mostly flat tan, broken up by planters/stalls/trees/fountain. |
| 4 | The car is a flat black box with two red rectangles. | Mission + driving presets now feature a BRIGHT red car (not black-on-black-asphalt); wheels/hubcaps + glowing headlights/taillights read. | FIXED — red car with lights in 2-play.jpg and 4-mission.jpg. |
| 5 | Lighting is flat and washed out. | Exposure 1.05→1.15, hemi 0.95→1.25, sun 1.6→2.2, sky/fog lightened, warm CSS grade + vignette, vendored UnrealBloomPass (0.7/0.5/0.85), gradient sunset sky dome + fog matched to horizon. | FIXED — warm sunset gradient sky, visible building shadows, bright clear scene in all 4 shots. |

## What changed per skill

- **3d-character-design** (characters.js, player.js): faces, hands, clothing,
  poses, MeshStandardMaterial skin/cloth/hair. makePerson() signature and
  parts={head,torso,legL,legR,armL,armR} exact; makeCar() untouched.
  Cost: ~51 meshes/person (was ~7), ≈2,350 character draw calls for 45
  peds + player — the main cost of the pass; desktop GPU fine, SwiftShader slow.
- **threejs-sky-clouds** (city.js): gradient sky dome (violet→pink→orange),
  sun disc + glow, fog matched to horizon, 10 drifting billboard clouds.
  No volumetric clouds (cheap tier).
- **threejs-water** (city.js): ShaderMaterial ocean (3 sine waves, teal→
  shallow, capped Fresnel, sun glitter, foam, ripple), wet-sand band.
  Fixed road bands drawing across the sand into the sea (roads clip at beachZ).
- **threejs-vegetation** (city.js): palms instanced (~260 draws → 2
  InstancedMeshes), 15 broadleaf trees, 390 grass tufts, 60 flowers,
  44 bushes. No wind sway (no city update hook; judged not worth SwiftShader cost).
- **threejs-rocks** (city.js): 23 boulders + 2 hero outcrops + 140 scree
  pebbles, half-buried, z>240, clear of roads/docks; large boulders colliders.
- **stylized-city-art** (city.js): facades warmed to locked neon-sunset,
  amber lit windows, 2 new billboards (SUNSET MOTEL, EAT AT SAL'S).
- **game-ui-hud-design** (hud.js, index.html, style.css): dialogue portrait
  (color-coded initials), live police-unit list (callsigns + PURSUIT/SEARCH/
  ROADBLOCK + live distances, wanted≥1), boxed speedometer with gear,
  radio split station/track, mission-card/dialogue overlap fixed.
- **threejs-post-processing** (main.js, vendor/addons/): genuine three r160
  addon modules vendored locally (EffectComposer, RenderPass,
  UnrealBloomPass, OutputPass, ShaderPass, Pass, MaskPass + 3 shaders),
  chain RenderPass → UnrealBloomPass(0.7/0.5/0.85) → OutputPass,
  dynamic import with try/catch fallback to renderer grading.
  window.__bloomActive exposes the result (true in all runs).

## Other fixes in this pass

- **Traffic through the plaza** (traffic.js, integration): AI cars no longer
  spawn on or enter the plaza road — verified by E2E (no AI car entered
  [-24,24]^2 all run; no AI car spawned on plaza road 0).
- **Driving shot** (main.js): two AI traffic cars placed directly ahead in
  the 'play' preset (verified 7 m and 47 m ahead; yellow taxi visible ahead
  in 2-play.jpg).
- **Bark gate** (hud.js): NPC barks suppressed while wanted ≥ 2.
- **Ambient sound bed** (audio.js): brown-noise city rumble + 52 Hz hum +
  distant siren wash every ~20–35 s, all synthesised; M mute works.

## Verification

- **E2E 30/30 PASS** (headless Chromium, /tmp/e2e_pass2_results.json,
  /tmp/e2e_v2.log, run 2026-11-18 18:59 WIB): boot, bloom active, zero
  errors at boot and end, zero pageerrors, zero console errors, 45 peds,
  7 archetypes, 26 moving AI cars, walk 13.8 m, mission 1 complete ($200+$300
  =$500), steal car, drive, exit car, punch → wanted 1, police spawn,
  save → reload → continue (money $500 preserved, mission index 1),
  plaza clean, 50 requests all local static (127.0.0.1:8080), zero non-local.
- **Screenshots** (1280×720, all ≤262,144 B): 1-start.jpg 113,250 B
  (plaza, sunset, stall, bollards), 2-play.jpg 109,999 B (driving 97 km/h,
  taxi ahead), 3-chase.jpg 130,179 B (3 stars, police-unit list, ramming),
  4-mission.jpg 98,298 B (docks, labelled containers, crane, red car).
  Plus review/closeup-face.jpg 87,898 B (face + fingers proof, NOT part of
  the 4-shot dossier).
- **Caps**: game/ 25 files, 956K (limits 993 files / 48 MiB). out/ regenerated
  via main.ts; dossier.json 770,869 B.
- **APIs kept**: makePerson() + parts, buildCity(scene, SEED) + {colliders,
  group}, createHud/updateHud/drawMinimap/showToast, shot presets, E2E hooks
  (window.__game, window.__errors, window.__shotReady), save/load, missions.

## Still thin (honest)

- Player from behind still reads blocky at gameplay distance (rear view
  shows no face by definition); gang at 15 m are small figures. The close-up
  is the proof of detail, not the wide shots.
- Plaza ground still mostly flat tan (props break it up, texture is light).
- Clouds are subtle in low-pitch shots; far sea band reads pink-violet at
  grazing angles (Fresnel + fog).
- Bloom is subtle in daylight (signs are MeshBasicMaterial, mostly below the
  0.85 threshold); only the brightest whites/lamp bulbs glow.
- Brows are low-contrast on the darkest hair colours; nose is subtle dead-on.
- posePanic head movement is time-synced across all panicking peds.
- In the chase preset the player car gets rammed to ~1–5 km/h by pursuing
  police in headless (pre-existing preset behaviour).
- Headless SwiftShader runs at ~0.25× real time; E2E/screenshots need long
  waits (120 s screenshot timeouts). Character draw calls (≈2,350) are the
  main perf cost to watch on a real GPU.

## Not done

- No make.fun submission. Lyso reviews first, then approves the resubmit
  (deadline Tue 24 Nov 2026 22:00 WIB). Previous submission
  01a1ed5a-bde8-7300-8392-092cff62bd6e is superseded by this push once he approves.
