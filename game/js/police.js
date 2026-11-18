// police.js — wanted level state machine, police cars that chase and ram,
// foot cops that chase, punch and arrest. Wanted decays when quiet.
import * as THREE from 'three';
import { clamp, dist2, mulberry32, nearestRoad } from './utils.js';
import { makeCarEntity } from './traffic.js';
import { makePerson, poseWalk, posePunch } from './characters.js';
import { damagePlayer } from './traffic.js';

export function createWanted() {
  return {
    level: 0,
    quietTimer: 0, // seconds since last crime
    lastCrime: '',
  };
}

export function addCrime(G, amount, reason) {
  const w = G.wanted;
  w.level = clamp(w.level + amount, 0, 5);
  w.quietTimer = 0;
  w.lastCrime = reason;
  G.toast(`Wanted level ${w.level} — ${reason}`);
  G.audio.sirenBurst();
}

// Per-tick wanted decay + police spawning.
export function updateWanted(G, dt) {
  const w = G.wanted;
  w.quietTimer += dt;
  const nearPolice = G.policeCars.some((c) => !c.dead &&
    dist2(c.x, c.z, G.player.x, G.player.z) < 40) || G.footCops.length > 0;
  // Wanted decays after a quiet spell: one star per 12s while police are
  // near, per 6s once they are far. It is never fully blocked by proximity —
  // the player can always lose the heat by laying low. During Heat Wave
  // (mission 4, survive step) the heat is held so the mission is fair.
  const heatHold = G.missions.state === 'active' && G.missions.index === 3 && G.missions.step === 0;
  if (w.level > 0 && !heatHold) {
    const threshold = nearPolice ? 12 : 6;
    if (w.quietTimer > threshold) {
      w.level -= 1;
      w.quietTimer = 0;
      if (w.level === 0) G.toast('You lost the cops.');
    }
  }
  // Spawn police cars up to the wanted level (max 4).
  const wantCars = Math.min(4, w.level);
  const alive = G.policeCars.filter((c) => !c.dead).length;
  if (alive < wantCars && G.spawnCooldown <= 0) {
    spawnPoliceCar(G);
    G.spawnCooldown = 2.5;
  }
  if (G.spawnCooldown > 0) G.spawnCooldown -= dt;
  // Foot cops at 2 stars and up (max 3).
  const wantCops = w.level >= 2 ? Math.min(3, w.level - 1) : 0;
  if (G.footCops.length < wantCops && G.copCooldown <= 0) {
    spawnFootCop(G);
    G.copCooldown = 3;
  }
  if (G.copCooldown > 0) G.copCooldown -= dt;
  // Roadblocks at 4 stars and up: the Bay PD seals the road ahead.
  if (w.level >= 4 && !G.roadblock) spawnRoadblock(G);
  if (w.level < 3 && G.roadblock) clearRoadblock(G);
}

// At 4+ stars the police park two cruisers across the road ahead of the
// player, nose to nose, and hold the line until the heat drops.
function spawnRoadblock(G) {
  const p = G.player;
  const px = p.mode === 'car' && p.car ? p.car.x : p.x;
  const pz = p.mode === 'car' && p.car ? p.car.z : p.z;
  // Nearest road ahead of the player, in the direction they're facing.
  const heading = p.mode === 'car' && p.car ? p.car.heading : p.heading;
  const ax = px + Math.sin(heading) * 45;
  const az = pz + Math.cos(heading) * 45;
  const roadX = nearestRoad(ax), roadZ = nearestRoad(az);
  const horizontal = Math.abs(ax - roadX) < Math.abs(az - roadZ);
  const bx = horizontal ? roadX : px;
  const bz = horizontal ? pz : roadZ;
  const cars = [];
  for (const off of [-4, 4]) {
    // Parked side by side ACROSS the road (offset along the road's
    // cross-axis), nose to nose, so the lanes are sealed.
    const car = makeCarEntity(G.scene, 'police', 0,
      horizontal ? bx : bx + off,
      horizontal ? bz + off : bz,
      horizontal ? 0 : Math.PI / 2);
    car.driver = 'none'; // parked: holds the line, never chases
    car.roadblock = true;
    car.topSpeed = 0;
    G.traffic.push(car);
    cars.push(car);
  }
  G.roadblock = cars;
  G.toast('ROADBLOCK AHEAD — the Bay PD sealed the road!');
  G.audio.sirenBurst();
}
function clearRoadblock(G) {
  if (!G.roadblock) return;
  for (const car of G.roadblock) {
    G.scene.remove(car.mesh);
    const i = G.traffic.indexOf(car);
    if (i >= 0) G.traffic.splice(i, 1);
  }
  G.roadblock = null;
}

function spawnPoliceCar(G) {
  const p = G.player;
  const px = p.mode === 'car' && p.car ? p.car.x : p.x;
  const pz = p.mode === 'car' && p.car ? p.car.z : p.z;
  // Spawn on a road 60-90 m away.
  const ang = G.rng() * Math.PI * 2;
  const car = makeCarEntity(G.scene, 'police', 0,
    clamp(px + Math.sin(ang) * 70, -230, 230),
    clamp(pz + Math.cos(ang) * 70, -230, 230),
    ang);
  car.topSpeed = 36;
  car.driver = 'police';
  car.speed = 10;
  G.policeCars.push(car);
  G.traffic.push(car);
}

function spawnFootCop(G) {
  const p = G.player;
  const ang = G.rng() * Math.PI * 2;
  const mesh = makePerson({ skin: 2, shirt: 6, pants: 3 });
  // Navy cap.
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.1, 10),
    new THREE.MeshLambertMaterial({ color: 0x1a2a5a }));
  cap.position.y = 1.82;
  mesh.add(cap);
  G.scene.add(mesh);
  const cop = {
    mesh, parts: mesh.userData.parts,
    x: clamp(p.x + Math.sin(ang) * 25, -240, 240),
    z: clamp(p.z + Math.cos(ang) * 25, -240, 240),
    heading: 0, phase: 0, punchTimer: 0, arrestTimer: 0, dead: false,
  };
  mesh.position.set(cop.x, 0, cop.z);
  G.footCops.push(cop);
}

export function updatePolice(G, dt) {
  const p = G.player;
  const px = p.mode === 'car' && p.car ? p.car.x : p.x;
  const pz = p.mode === 'car' && p.car ? p.car.z : p.z;
  // Police cars: steer toward the player, ram on contact. If the player
  // is far away they search the last known position instead of beelining
  // across the whole map (leash + search, not omniscience).
  for (const car of G.policeCars) {
    if (car.dead || car.roadblock) continue;
    const d = dist2(car.x, car.z, px, pz);
    if (d < 60) { G.wanted.lastKnown = { x: px, z: pz }; }
    const tx = d > 130 && G.wanted.lastKnown ? G.wanted.lastKnown.x : px;
    const tz = d > 130 && G.wanted.lastKnown ? G.wanted.lastKnown.z : pz;
    const wantHeading = Math.atan2(tx - car.x, tz - car.z);
    let dh = wantHeading - car.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    car.heading += clamp(dh, -2.2 * dt, 2.2 * dt);
    car.speed = clamp(car.speed + 10 * dt, 0, car.topSpeed);
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    // Flashing light bar.
    if (car.mesh.userData.parts) {
      const on = Math.floor(G.time * 6) % 2 === 0;
      car.mesh.userData.parts.lightL.material.color.setHex(on ? 0xff2222 : 0x550000);
      car.mesh.userData.parts.lightR.material.color.setHex(on ? 0x000055 : 0x2266ff);
    }
    // Ram the player.
    if (d < 3.2) {
      if (p.mode === 'car' && p.car) {
        p.car.speed *= 0.5;
        p.car.x += Math.sin(car.heading) * 2;
        p.car.z += Math.cos(car.heading) * 2;
        damagePlayer(G, 4);
        G.audio.thud();
      } else if (d < 2.2) {
        damagePlayer(G, 8);
        // Shove the player.
        p.x += Math.sin(car.heading) * 1.5;
        p.z += Math.cos(car.heading) * 1.5;
      }
    }
  }
  // Foot cops: chase, punch in range, arrest when the player is weak.
  for (const cop of G.footCops) {
    if (cop.dead) continue;
    const d = dist2(cop.x, cop.z, p.x, p.z);
    if (p.mode === 'car') {
      // Cops cannot catch a car: hold position, watch.
      continue;
    }
    const wantHeading = Math.atan2(p.x - cop.x, p.z - cop.z);
    cop.heading = wantHeading;
    if (d > 1.6) {
      const sp = 6.5;
      cop.x += Math.sin(cop.heading) * sp * dt;
      cop.z += Math.cos(cop.heading) * sp * dt;
      cop.phase += dt * 11;
      poseWalk(cop.parts, cop.phase, 1);
      cop.arrestTimer = 0;
    } else {
      // In range: punch, and start the arrest clock when the player is weak.
      if (cop.punchTimer <= 0) {
        cop.punchTimer = 0.8;
        damagePlayer(G, 7);
        G.audio.punch();
      }
      posePunch(cop.parts, 1 - cop.punchTimer / 0.8);
      if (p.health <= 30) {
        cop.arrestTimer += dt;
        if (cop.arrestTimer > 2.5) {
          G.events.push({ type: 'busted' });
          return;
        }
      } else {
        cop.arrestTimer = 0;
      }
    }
    if (cop.punchTimer > 0) cop.punchTimer -= dt;
    cop.mesh.position.set(cop.x, 0, cop.z);
    cop.mesh.rotation.y = cop.heading;
  }
}

export function clearPolice(G) {
  for (const car of G.policeCars) {
    G.scene.remove(car.mesh);
    const i = G.traffic.indexOf(car);
    if (i >= 0) G.traffic.splice(i, 1);
  }
  G.policeCars = [];
  for (const cop of G.footCops) G.scene.remove(cop.mesh);
  G.footCops = [];
  clearRoadblock(G);
}
