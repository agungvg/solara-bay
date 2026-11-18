// main.js — Solara Bay bootstrap: renderer, fixed 60 Hz logical tick,
// collision-aware third-person camera, input -> semantic actions,
// state machine (menu / playing / paused / busted / wasted), save/load
// wiring and the screenshot presets (?shot=start|play|chase|mission).
import * as THREE from 'three';
import { CITY, NAMED, clamp, dist2, mulberry32, segmentBlocked, angleLerp } from './utils.js';
import { buildCity } from './city.js';
import { createPlayer, updatePlayerFoot, updatePlayerCar, enterCar, exitCar } from './player.js';
import { createTraffic, createPedestrians, updateTraffic, updatePedestrians, updateCarDamage, createPickups, updatePickups, damagePlayer, makeCarEntity, witnessCrime } from './traffic.js';
import { createWanted, addCrime, updateWanted, updatePolice, clearPolice } from './police.js';
import { shoot, punch, updateEffects } from './combat.js';
import { createMissions, startMission, updateMissions, onStealMagenta, MISSION_DEFS } from './missions.js';
import { createHud, updateHud, drawMinimap, showToast } from './hud.js';
import { AudioEngine } from './audio.js';
import { saveGameData, loadGameData, hasSave } from './save.js';
import { makePerson } from './characters.js';

window.__errors = [];
window.addEventListener('error', (e) => window.__errors.push(String(e.message || e.error)));
window.addEventListener('unhandledrejection', (e) => window.__errors.push('rejection: ' + String(e.reason)));

const params = new URLSearchParams(location.search);
const SEED = Number(params.get('seed') || 20261118);
const SHOT = params.get('shot') || null;

// --- Renderer / scene -------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// Brighter, HD, clear (Lyso: the competitor read "too dim, not HD/clear"):
// ACES filmic, exposure raised 1.05 -> 1.15, sun + hemisphere lifted so
// the street reads bright, not murky. Fog matches the sky dome's horizon
// (city.js owns it: 0xff9e57, 200–620) so the far skyline melts into the
// sunset instead of greying the near street.
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
document.getElementById('game-canvas').appendChild(renderer.domElement);

const scene = new THREE.Scene();
// Fog / background seed: city.js (buildCity) is the source of truth and
// sets these to the sky dome's horizon colour (0xff9e57, 200–620) right
// after this; these identical values just keep the first frames coherent.
scene.background = new THREE.Color(0xff9e57);
scene.fog = new THREE.Fog(0xff9e57, 200, 620);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
camera.position.set(0, 8, 20);

// Warm sun vs cool sky fill: the cheapest way the scene reads as designed.
const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x9a8a6a, 1.25);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe3b3, 2.2);
sun.position.set(120, 180, 60);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -280; sun.shadow.camera.right = 280;
sun.shadow.camera.top = 280; sun.shadow.camera.bottom = -280;
sun.shadow.camera.far = 600;
scene.add(sun);

// Post-processing (Solara Bay preset: bloom 0.7 / 0.5 / 0.85 + OutputPass).
// The vendored three r160 does NOT ship the composer, so the r160 addon
// modules are vendored locally under game/vendor/addons/ and loaded here
// with a dynamic import: if anything in the chain fails, the game falls
// back to renderer-level grading above instead of failing to load.
let composer = null;
try {
  const { EffectComposer } = await import('three/addons/postprocessing/EffectComposer.js');
  const { RenderPass } = await import('three/addons/postprocessing/RenderPass.js');
  const { UnrealBloomPass } = await import('three/addons/postprocessing/UnrealBloomPass.js');
  const { OutputPass } = await import('three/addons/postprocessing/OutputPass.js');
  composer = new EffectComposer(renderer,
    new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
      type: THREE.HalfFloatType, // HDR bloom + no sky-gradient banding
      samples: 4,                // MSAA on the composer's buffers
    }));
  composer.setSize(window.innerWidth, window.innerHeight);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.7,  // strength — neon glow without washing the street
    0.5,  // radius
    0.85, // threshold — only HDR-bright pixels bloom
  ));
  composer.addPass(new OutputPass()); // LAST: tone mapping + sRGB, once
} catch (err) {
  // Fallback: renderer-level grading carries the look; the game must load.
  composer = null;
}
window.__bloomActive = !!composer;

// --- Game state -------------------------------------------------------------
const rng = mulberry32(SEED);
const city = buildCity(scene, SEED);
const G = {
  scene, camera, renderer, rng, city,
  time: 0, tick: 0,
  state: 'menu', // menu | playing | paused | busted | wasted
  money: 200,
  wanted: createWanted(),
  player: null,
  traffic: [],
  peds: [],
  policeCars: [],
  footCops: [],
  gang: [],
  pickups: [],
  missions: null,
  hud: createHud(),
  audio: new AudioEngine(),
  input: { moveX: 0, moveZ: 0, forward: false, back: false, left: false, right: false, sprint: false, jump: false, handbrake: false },
  keys: {},
  camYaw: Math.PI, camPitch: 0.32,
  ammo: { mag: 12, reserve: 48 },
  weapon: 'pistol',
  nearCar: null,
  events: [],
  effects: [],
  dialogue: null,
  bark: null,          // NPC bark line {who, text, ttl}
  missionCard: null,   // mission intro/outro card {title, body, ttl}
  clockMin: 8 * 60 + 32, // in-game clock, starts 08:32
  roadblock: null,     // police roadblock cars at wanted >= 4
  hudFlash: 0,
  gunshotFlash: 0,
  spawnCooldown: 0,
  copCooldown: 0,
  shotMode: SHOT,
  shotTimer: 0,
  shotReady: false,
  framesRendered: 0,
  closeupPed: null, // ?shot=closeup: the ped the camera frames, not the player
};
G.player = createPlayer(scene, { x: NAMED.garage.x - 6, z: NAMED.garage.z + 24 });
G.traffic = createTraffic(scene, rng, city.colliders);
G.peds = createPedestrians(scene, rng);
G.pickups = createPickups(scene);
G.missions = createMissions(G);
G.toast = (t) => showToast(G.hud, t);
G.saveGame = () => { if (saveGameData(G)) G.toast('Game saved'); };
// traffic.js needs addCrime but cannot import police.js (cycle:
// police imports traffic). Wire it here instead.
G.addCrime = (n, reason) => addCrime(G, n, reason);
G.damagePlayer = (n) => damagePlayer(G, n);
window.__game = G;

// --- Input ------------------------------------------------------------------
const keyMap = {
  KeyW: 'forward', KeyS: 'back', KeyA: 'left', KeyD: 'right',
  ArrowUp: 'forward', ArrowDown: 'back', ArrowLeft: 'left', ArrowRight: 'right',
  ShiftLeft: 'sprint', ShiftRight: 'sprint', Space: 'jump',
};
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') e.preventDefault();
  G.keys[e.code] = true;
  if (G.state !== 'playing') return;
  if (e.code === 'KeyE') tryEnterExitCar();
  if (e.code === 'KeyF') punch(G);
  if (e.code === 'KeyQ') {
    G.weapon = G.weapon === 'pistol' ? 'fists' : 'pistol';
    G.toast(G.weapon === 'pistol' ? 'Pistol out' : 'Fists out');
  }
  if (e.code === 'KeyR') reload();
  if (e.code === 'KeyM') {
    G.audio.setMuted(!G.audio.muted);
    G.toast(G.audio.muted ? 'Muted' : 'Sound on');
  }
  if (e.code === 'KeyP' || e.code === 'Escape') pauseGame();
});
window.addEventListener('keyup', (e) => { G.keys[e.code] = false; });

function readInput() {
  const k = G.keys;
  const inp = G.input;
  inp.forward = !!(k.KeyW || k.ArrowUp);
  inp.back = !!(k.KeyS || k.ArrowDown);
  inp.left = !!(k.KeyA || k.ArrowLeft);
  inp.right = !!(k.KeyD || k.ArrowRight);
  inp.sprint = !!(k.ShiftLeft || k.ShiftRight);
  inp.jump = !!k.Space;
  inp.handbrake = !!k.Space;
  // Camera-relative movement on foot.
  const f = (inp.forward ? 1 : 0) - (inp.back ? 1 : 0);
  const r = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
  const sin = Math.sin(G.camYaw), cos = Math.cos(G.camYaw);
  // Forward on screen = away from camera (camera looks along -sin/-cos).
  inp.moveX = -sin * f + cos * r;
  inp.moveZ = -cos * f - sin * r;
}

// Mouse: pointer lock orbit + click to shoot.
let dragging = false, lastX = 0, lastY = 0;
renderer.domElement.addEventListener('mousedown', (e) => {
  if (G.state !== 'playing') return;
  if (document.pointerLockElement !== renderer.domElement) {
    renderer.domElement.requestPointerLock();
  }
  dragging = true; lastX = e.clientX; lastY = e.clientY;
  if (G.weapon === 'pistol' && G.player.mode === 'foot') shoot(G);
});
window.addEventListener('mouseup', () => { dragging = false; });
window.addEventListener('mousemove', (e) => {
  if (G.state !== 'playing') return;
  if (document.pointerLockElement === renderer.domElement) {
    G.camYaw -= e.movementX * 0.0032;
    G.camPitch = clamp(G.camPitch + e.movementY * 0.0032, -0.15, 1.1);
  } else if (dragging) {
    G.camYaw -= (e.clientX - lastX) * 0.005;
    G.camPitch = clamp(G.camPitch + (e.clientY - lastY) * 0.005, -0.15, 1.1);
    lastX = e.clientX; lastY = e.clientY;
  }
});

function reload() {
  if (G.weapon !== 'pistol') return;
  if (G.ammo.mag === 12 || G.ammo.reserve <= 0) return;
  const need = 12 - G.ammo.mag;
  const take = Math.min(need, G.ammo.reserve);
  G.ammo.mag += take;
  G.ammo.reserve -= take;
  G.audio.blip(520, 0.1);
  G.toast('Reloaded');
}

function nearestCar(maxD) {
  const p = G.player;
  let best = null, bd = maxD;
  for (const car of G.traffic) {
    if (car.dead) continue;
    const d = dist2(p.x, p.z, car.x, car.z);
    if (d < bd) { bd = d; best = car; }
  }
  return best;
}

function tryEnterExitCar() {
  const p = G.player;
  if (p.mode === 'car') {
    exitCar(G);
    G.audio.engineStop();
    return;
  }
  const car = nearestCar(4.5);
  if (!car) return;
  if (car.driver === 'ai') {
    // Steal: the driver bails out and flees on foot.
    const ped = {
      mesh: null, parts: null, marker: null,
      name: 'Driver', archetype: 'walker',
      x: car.x + 2, z: car.z + 2, heading: 0,
      speed: 4.5, baseSpeed: 4.5, phase: 0,
      state: 'flee', fleeTimer: 4, dest: null, stateTimer: 0,
      witnessTimer: 0, witnessCooldown: 0, barkCooldown: 0, bumpCooldown: 0,
      partner: null, anchor: { x: car.x + 2, z: car.z + 2 },
      dead: false, horizontal: false, road: 0,
    };
    const mesh = makePerson({ skin: 1, shirt: 3, pants: 0 });
    mesh.position.set(ped.x, 0, ped.z);
    scene.add(mesh);
    ped.mesh = mesh; ped.parts = mesh.userData.parts;
    G.peds.push(ped);
    addCrime(G, 1, 'Car stolen');
    witnessCrime(G, car.x, car.z); // bystanders saw the theft — they call it in
    if (car.missionCar) onStealMagenta(G);
    G.toast('You stole the car!');
  }
  enterCar(G, car);
}

// --- State machine ----------------------------------------------------------
function showHud() { G.hud.menu.style.display = 'none'; document.getElementById('hud').classList.remove('hidden'); }

function newGame() {
  showHud();
  G.money = 200;
  G.clockMin = 8 * 60 + 32;
  G.player.health = 100;
  G.ammo = { mag: 12, reserve: 48 };
  G.wanted.level = 0; G.wanted.quietTimer = 0;
  clearPolice(G);
  G.player.x = NAMED.garage.x - 6; G.player.z = NAMED.garage.z + 24;
  G.player.y = 0; G.player.mode = 'foot'; G.player.car = null;
  G.player.mesh.visible = true;
  G.player.mesh.position.set(G.player.x, 0, G.player.z);
  G.missions.index = 0; G.missions.state = 'idle';
  G.state = 'playing';
  G.hud.menu.style.display = 'none';
  G.hud.endOverlay.style.display = 'none';
  G.audio.init(); G.audio.resume(); G.audio.startAmbient();
  startMission(G, 0);
}

function continueGame() {
  showHud();
  const data = loadGameData();
  if (!data) { newGame(); return; }
  G.money = data.money;
  G.player.health = data.health;
  G.clockMin = typeof data.clockMin === 'number' ? data.clockMin : 8 * 60 + 32;
  G.ammo = { mag: data.ammo.mag, reserve: data.ammo.reserve };
  G.player.x = data.x; G.player.z = data.z;
  G.player.y = 0; G.player.mode = 'foot'; G.player.car = null;
  G.player.mesh.visible = true;
  G.player.mesh.position.set(G.player.x, 0, G.player.z);
  G.wanted.level = 0; G.wanted.quietTimer = 0;
  clearPolice(G);
  G.state = 'playing';
  G.hud.menu.style.display = 'none';
  G.audio.init(); G.audio.resume(); G.audio.startAmbient();
  const idx = Math.min(data.missionIndex, 5);
  if (data.missionState === 'complete') {
    G.missions.state = 'complete';
    G.missions.index = 5;
    G.toast('Story complete — free roam');
  } else {
    startMission(G, idx);
  }
}

function pauseGame() {
  if (G.state !== 'playing') return;
  G.state = 'paused';
  G.hud.pauseMenu.style.display = 'flex';
  if (document.pointerLockElement) document.exitPointerLock();
}
function resumeGame() {
  G.state = 'playing';
  G.hud.pauseMenu.style.display = 'none';
  G.audio.resume();
}

function endPlayer(kind) {
  // Busted or wasted: -$150, respawn at police station / hospital, clean slate.
  G.money = Math.max(0, G.money - 150);
  clearPolice(G);
  G.wanted.level = 0; G.wanted.quietTimer = 0;
  const p = G.player;
  p.health = 100;
  p.mode = 'foot'; p.car = null;
  p.mesh.visible = true;
  if (kind === 'busted') {
    p.x = NAMED.police.x + 20; p.z = NAMED.police.z;
    G.hud.endTitle.textContent = 'BUSTED';
    G.hud.endText.textContent = 'The Bay PD hauled you in. -$150. The city is still yours, Mara.';
  } else {
    p.x = NAMED.hospital.x; p.z = NAMED.hospital.z + 22;
    G.hud.endTitle.textContent = 'WASTED';
    G.hud.endText.textContent = 'Solara General patched you up. -$150. Get back out there.';
  }
  p.y = 0; p.vy = 0;
  p.mesh.position.set(p.x, 0, p.z);
  G.state = kind;
  G.hud.endOverlay.style.display = 'flex';
  if (document.pointerLockElement) document.exitPointerLock();
  G.audio.engineStop();
  G.audio.siren(false, 0);
}

// Menu buttons.
document.getElementById('btn-new').addEventListener('click', newGame);
document.getElementById('btn-continue').addEventListener('click', continueGame);
document.getElementById('btn-resume').addEventListener('click', resumeGame);
document.getElementById('btn-save').addEventListener('click', () => { G.saveGame(); });
document.getElementById('btn-restart-mission').addEventListener('click', () => {
  G.hud.pauseMenu.style.display = 'none';
  G.state = 'playing';
  startMission(G, G.missions.index);
});
document.getElementById('btn-quit').addEventListener('click', () => {
  G.state = 'menu';
  G.hud.pauseMenu.style.display = 'none';
  G.hud.menu.style.display = 'flex';
  refreshMenu();
});
document.getElementById('btn-end-continue').addEventListener('click', () => {
  G.hud.endOverlay.style.display = 'none';
  G.state = 'playing';
  // Restart the current mission so the player is never stuck.
  if (G.missions.state === 'active') startMission(G, G.missions.index);
});
function refreshMenu() {
  const btn = document.getElementById('btn-continue');
  const data = loadGameData();
  if (!data) { btn.style.display = 'none'; return; }
  btn.style.display = 'block';
  const mission = data.missionIndex >= 6
    ? 'Story complete'
    : `Mission ${data.missionIndex + 1}/6 — ${MISSION_DEFS[Math.min(data.missionIndex, 5)].name}`;
  const when = data.savedAt ? new Date(data.savedAt).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  }) : '';
  btn.textContent = `Continue — ${mission} · $${data.money.toLocaleString('en-US')}${when ? ' · saved ' + when : ''}`;
}
refreshMenu();

// --- Camera (collision-aware) -----------------------------------------------
const camTarget = new THREE.Vector3();
function updateCamera(dt) {
  const p = G.player;
  // Close-up shot: frame a pedestrian's face + hands, not the player.
  const isCloseup = G.shotMode === 'closeup' && G.closeupPed && !G.closeupPed.dead;
  let px, pz, py;
  if (isCloseup) {
    px = G.closeupPed.x; pz = G.closeupPed.z; py = 1.55;
    camera.fov = 50; // mild telephoto: head + shoulders + hands, not a full body
    camera.updateProjectionMatrix();
  } else if (p.mode === 'car' && p.car) {
    px = p.car.x; pz = p.car.z; py = 1.6;
    // Chase camera: behind the car, FOV widens with speed.
    const speedRatio = Math.abs(p.car.speed) / (p.car.topSpeed || 32);
    const wantYaw = p.car.heading + Math.PI;
    G.camYaw = angleLerp(G.camYaw, wantYaw, 1 - Math.pow(0.001, dt));
    camera.fov = 62 + speedRatio * 12;
    camera.updateProjectionMatrix();
  } else {
    px = p.x; pz = p.z; py = 1.7;
    camera.fov = 62;
    camera.updateProjectionMatrix();
  }
  const dist = isCloseup ? 1.9 : (G.shotCamDist || (p.mode === 'car' ? 10.5 : 5.5));
  const cp = Math.cos(G.camPitch), sp = Math.sin(G.camPitch);
  const dx = Math.sin(G.camYaw) * cp * dist;
  const dz = Math.cos(G.camYaw) * cp * dist;
  const dy = sp * dist + 1.2;
  const desired = new THREE.Vector3(px + dx, py + dy, pz + dz);
  // Collision-aware: walk from the pivot toward the desired pose; stop
  // just before any building footprint blocks the line.
  let t = 1;
  const steps = 16;
  for (let i = 1; i <= steps; i++) {
    const f = i / steps;
    const x = px + dx * f, z = pz + dz * f;
    if (segmentBlocked(px, pz, x, z, G.city.colliders)) { t = Math.max(0.12, (i - 1) / steps); break; }
  }
  const cx = px + dx * t, cz = pz + dz * t;
  const cy = Math.max(0.6, py + dy * t);
  camTarget.set(px, py, pz);
  // Shot framing: look past the player at the action ahead, so Mara drops
  // below centre and the crosshair lands on the target instead of on her
  // head (the old mission shot had the crosshair sitting on her skull).
  // The close-up frames a face, so it keeps its own target.
  if (G.shotMode && !isCloseup) camTarget.y += 0.7;
  // In shot mode the camera snaps to its pose at once (headless capture
  // runs at low FPS, so per-frame smoothing would never converge).
  const k = G.shotMode ? 1 : 1 - Math.pow(0.0001, dt);
  camera.position.x += (cx - camera.position.x) * k;
  camera.position.y += (cy - camera.position.y) * k;
  camera.position.z += (cz - camera.position.z) * k;
  camera.lookAt(camTarget);
}

// --- Fixed-tick simulation ---------------------------------------------------
const DT = 1 / 60;
let acc = 0, last = performance.now();

function processEvents() {
  for (const ev of G.events) {
    if (ev.type === 'pedDown' && !ev.byTraffic) addCrime(G, 1, 'Pedestrian hit');
    else if (ev.type === 'wasted') endPlayer('wasted');
    else if (ev.type === 'busted') endPlayer('busted');
  }
  G.events.length = 0;
}

function tick(dt) {
  G.time += dt;
  G.tick += 1;
  // In-game clock: one game minute every 2 real seconds.
  G.clockMin += dt * 0.5;
  if (G.bark && G.bark.ttl > 0) G.bark.ttl -= dt;
  if (G.missionCard && G.missionCard.ttl > 0) G.missionCard.ttl -= dt;
  if (G.state !== 'playing') return;
  readInput();
  const p = G.player;
  if (p.mode === 'car') updatePlayerCar(G, dt);
  else updatePlayerFoot(G, dt);
  G.nearCar = p.mode === 'foot' ? nearestCar(4.5) : null;
  updateTraffic(G, dt);
  updatePedestrians(G, dt);
  updateWanted(G, dt);
  updatePolice(G, dt);
  updateMissions(G, dt);
  updateCarDamage(G, dt);
  updatePickups(G, dt);
  updateEffects(G, dt);
  if (G.dialogue && G.dialogue.ttl > 0) G.dialogue.ttl -= dt;
  if (G.hudFlash > 0) G.hudFlash -= dt * 2;
  // Siren when police are near.
  const px = p.mode === 'car' && p.car ? p.car.x : p.x;
  const pz = p.mode === 'car' && p.car ? p.car.z : p.z;
  const policeNear = G.policeCars.some((c) => !c.dead && dist2(c.x, c.z, px, pz) < 60);
  G.audio.siren(policeNear || G.wanted.level >= 2, G.time);
  if (p.mode === 'foot') G.audio.engine(0);
  processEvents();
  // Shot preset readiness: after ~1 s of play + several frames.
  if (G.shotMode && !G.shotReady) {
    G.shotTimer += dt;
    if (G.shotTimer > 1.0 && G.framesRendered > 5) {
      G.shotReady = true;
      window.__shotReady = true;
    }
  }
}

// --- Shot presets -----------------------------------------------------------
function applyShotPreset() {
  const shot = G.shotMode;
  if (!shot) return;
  showHud();
  G.state = 'playing';
  G.hud.menu.style.display = 'none';
  G.audio.init(); G.audio.startAmbient();
  if (shot === 'start') {
    // On foot at Solara Plaza, in the middle of the living city: the taco
    // stall and its shopkeeper, a pair of locals mid-conversation, a
    // jogger and sitters on the fountain edge, parked cars ahead.
    // Player stands ON the open plaza, close enough to the talkers (6, 6)
    // that faces read (~13 m) instead of 25 m away as in pass 1.
    G.shotCamDist = 4.5;
    G.player.x = 2; G.player.z = -6;
    G.player.heading = 0.64;
    G.camYaw = Math.PI + 0.64; G.camPitch = 0.15;
    G.player.mesh.position.set(G.player.x, 0, G.player.z);
    startMission(G, 0);
  } else if (shot === 'play') {
    // Driving a car through downtown, heading east on a cross street.
    const car = G.traffic.find((c) => c.driver === null && !c.missionCar);
    if (car) {
      car.x = -116; car.z = 58; car.heading = Math.PI / 2; car.speed = 16;
      enterCar(G, car);
      G.camYaw = car.heading + Math.PI;
      G.keys.KeyW = true; // keep driving through the shot
      // Traffic directly ahead: moving cars ~20 m and ~55 m east of the
      // player on the same road (z = 58), same heading, slower — so the
      // driving screenshot shows traffic ahead instead of an empty street.
      // Two cars: the player outruns the first quickly, the second keeps
      // the road populated ahead for a later capture too.
      const aheadSpots = [[-96, 12], [-60, 14]];
      let spotIdx = 0;
      for (const c of G.traffic) {
        if (spotIdx >= aheadSpots.length) break;
        if (c.driver !== 'ai' || c.dead || c.missionCar || c === car) continue;
        const [ax, spd] = aheadSpots[spotIdx++];
        c.x = ax; c.z = 58; c.heading = Math.PI / 2;
        c.axis = 'x'; c.dir = 1; c.speed = spd; c.target = 116;
        c.mesh.position.set(c.x, 0, c.z);
        c.mesh.rotation.y = c.heading;
      }
    }
    startMission(G, 0);
    // Don't let mission 1 auto-complete just because Mara is already in
    // a car (that would chain a second intro card into the shot).
    G.missions.step = 3;
    G.missions.objective = 'Cruise downtown — the Bay is open';
  } else if (shot === 'chase') {
    // Wanted 3, three police cars chasing, driving fast downtown.
    // Police spawn ahead and to the sides so they are visible in frame.
    const car = G.traffic.find((c) => c.driver === null && !c.missionCar);
    if (car) {
      car.x = 58; car.z = -58; car.heading = 0; car.speed = 24;
      enterCar(G, car);
      G.camYaw = car.heading + Math.PI;
      G.keys.KeyW = true; // keep the chase fast through the shot
    }
    G.wanted.level = 3; // 3 stars: a hard chase (roadblocks come at 4 stars in free play)
    G.wanted.quietTimer = -60;
    const spots = [[-14, 26], [14, 24], [0, 32]];
    for (let i = 0; i < 3; i++) {
      const [ox, oz] = spots[i];
      const pc = makeCarEntity(scene, 'police', 0,
        G.player.car.x + ox, G.player.car.z + oz, Math.PI);
      pc.topSpeed = 36; pc.driver = 'police'; pc.speed = 14;
      G.policeCars.push(pc);
      G.traffic.push(pc);
    }
    startMission(G, 3);
    G.missions.objective = 'Lose the cops — survive the heat';
  } else if (shot === 'mission') {
    // The Exchange shootout at the docks, pistol out, gang in the open.
    // TIGHT framing (Lyso: the old shot read as block figures at 8–15 m):
    // camera 3.6 m behind Mara instead of 5.5, look-target lifted so she
    // drops below centre and the crosshair lands on the gang, not her head.
    G.shotCamDist = 3.6;
    G.player.x = NAMED.docks.x - 6; G.player.z = NAMED.docks.z - 12;
    G.player.heading = 0.1;
    G.camYaw = Math.PI - 0.1; G.camPitch = 0.12;
    G.player.mesh.position.set(G.player.x, 0, G.player.z);
    G.weapon = 'pistol';
    startMission(G, 4);
    // Stand inside the arrival radius so the mission's own step logic
    // spawns the four gang members through its normal path, then step
    // back a little so all four are in frame. (Gang AI turns them to
    // face Mara every tick, so we see faces, not backs.)
    updateMissions(G, 0.01);
    G.player.x = NAMED.docks.x - 8; G.player.z = NAMED.docks.z - 18;
    G.player.heading = 0.2;
    G.camYaw = Math.PI - 0.2; G.camPitch = 0.12;
    G.player.mesh.position.set(G.player.x, 0, G.player.z);
    // BRIGHT car in frame: the magenta mission sports car, pulled in
    // behind the gang, nose toward the camera so headlights + paint read.
    // Never a black car on black asphalt again.
    const magenta = G.traffic.find((c) => c.missionCar);
    if (magenta) {
      magenta.x = -18; magenta.z = 264; magenta.heading = Math.PI;
      magenta.mesh.position.set(-18, 0, 264);
      magenta.mesh.rotation.y = magenta.heading;
    }
    // Push any other AI car out of the dock-yard frame so no stray black
    // car wanders into the shootout.
    for (const c of G.traffic) {
      if (c.driver !== 'ai' || c.dead || c === magenta) continue;
      if (Math.abs(c.x) < 70 && c.z > 225) {
        c.x = 116; c.z = 58; c.heading = Math.PI / 2;
        c.axis = 'x'; c.dir = 1; c.speed = 12; c.target = 174;
        c.mesh.position.set(c.x, 0, c.z);
        c.mesh.rotation.y = c.heading;
      }
    }
  } else if (shot === 'closeup') {
    // Character close-up (review only, never a dossier screenshot):
    // a walker in the OPEN, held in a talk gesture — face (eyes/nose/
    // lips/brows/hair) + both gesturing hands in frame at 1.9 m with a
    // mild telephoto, three-quarter view.
    // (The plaza shopkeeper stands INSIDE the stall collider, so the
    // collision-aware camera clamped to ~0.5 m and the face filled the
    // frame; a walker in the open has a clear camera segment.)
    G.camYaw = 0.6; G.camPitch = -0.3; // mostly level, slight top-down so the gesturing hands stay in frame
    // Prefer the fairest-skinned walker (eyes/brows read best on light
    // skin) with a clear camera segment; fall back to any living ped.
    let ped = null;
    let bestSkin = -1;
    for (const q of G.peds) {
      if (q.archetype !== 'walker' || q.dead) continue;
      const cx = q.x + Math.sin(G.camYaw) * 1.9;
      const cz = q.z + Math.cos(G.camYaw) * 1.9;
      if (segmentBlocked(q.x, q.z, cx, cz, G.city.colliders)) continue;
      const c = q.parts.head.material.color;
      const lum = 0.3 * c.r + 0.6 * c.g + 0.1 * c.b;
      if (lum > bestSkin) { bestSkin = lum; ped = q; }
    }
    ped = ped || G.peds.find((q) => !q.dead) || G.peds[0];
    G.closeupPed = ped;
    // 'work' = poseTalk: both arms gesturing, hands up near the chest
    // where the frame can see them (idle hangs them at the sides, out
    // of a head-and-shoulders frame). Non-workers never leave 'work'.
    ped.state = 'work';
    ped.stateTimer = 3600; // hold the pose for the whole capture
    ped.dest = null;
    // Camera sits south-east of the ped; the ped faces ~35° off the lens
    // for a three-quarter face view instead of flat dead-on.
    ped.heading = G.camYaw - 0.55;
    ped.mesh.rotation.y = ped.heading;
    // Park the player behind the camera so Mara is not in frame.
    G.player.x = ped.x + Math.sin(G.camYaw) * 7;
    G.player.z = ped.z + Math.cos(G.camYaw) * 7;
    G.player.mesh.position.set(G.player.x, 0, G.player.z);
  }
  G.hud.menu.style.display = 'none';
}
applyShotPreset();

// --- Render loop: fixed tick, render is presentation only --------------------
function frame(now) {
  requestAnimationFrame(frame);
  let elapsed = (now - last) / 1000;
  last = now;
  if (elapsed > 0.25) elapsed = 0.25; // clamp catch-up after resume
  acc += elapsed;
  let steps = 0;
  while (acc >= DT && steps < 5) {
    tick(DT);
    acc -= DT;
    steps += 1;
  }
  if (steps === 5) acc = 0;
  if (G.state === 'playing' || G.state === 'paused' || G.shotMode) {
    updateCamera(1 / 60);
    updateHud(G);
    drawMinimap(G);
  }
  if (composer) composer.render();
  else renderer.render(scene, camera);
  G.framesRendered += 1;
}
requestAnimationFrame(frame);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (composer) composer.setSize(window.innerWidth, window.innerHeight);
});
