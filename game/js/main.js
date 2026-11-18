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
// Restrained grade: ACES filmic tone mapping, no blown-out whites.
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.getElementById('game-canvas').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b5d6);
scene.fog = new THREE.Fog(0x9fc3dd, 220, 520);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
camera.position.set(0, 8, 20);

// Warm sun vs cool sky fill: the cheapest way the scene reads as designed.
const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x9a8a6a, 0.95);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe3b3, 1.6);
sun.position.set(120, 180, 60);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -280; sun.shadow.camera.right = 280;
sun.shadow.camera.top = 280; sun.shadow.camera.bottom = -280;
sun.shadow.camera.far = 600;
scene.add(sun);

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
  G.audio.init(); G.audio.resume();
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
  G.audio.init(); G.audio.resume();
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
  let px, pz, py;
  if (p.mode === 'car' && p.car) {
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
  const dist = p.mode === 'car' ? 10.5 : 5.5;
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
  G.audio.init();
  if (shot === 'start') {
    // On foot at Solara Plaza, in the middle of the living city: the taco
    // stall and its shopkeeper, a pair of locals mid-conversation, a
    // jogger and sitters on the fountain edge, parked cars ahead.
    // Player stands ON the open plaza (no buildings there), facing the stall.
    G.player.x = -10; G.player.z = -12;
    G.player.heading = 0.83;
    G.camYaw = Math.PI + 0.83; G.camPitch = 0.2;
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
    G.player.x = NAMED.docks.x - 6; G.player.z = NAMED.docks.z - 12;
    G.player.heading = 0.1;
    G.camYaw = Math.PI - 0.1; G.camPitch = 0.24;
    G.player.mesh.position.set(G.player.x, 0, G.player.z);
    G.weapon = 'pistol';
    startMission(G, 4);
    // Stand inside the arrival radius so the mission's own step logic
    // spawns the four gang members through its normal path, then step
    // back a little so all four are in frame.
    updateMissions(G, 0.01);
    G.player.x = NAMED.docks.x - 8; G.player.z = NAMED.docks.z - 18;
    G.player.heading = 0.2;
    G.camYaw = Math.PI - 0.2; G.camPitch = 0.18;
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
  renderer.render(scene, camera);
  G.framesRendered += 1;
}
requestAnimationFrame(frame);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
