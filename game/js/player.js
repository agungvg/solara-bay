// player.js — Mara on foot and behind the wheel.
// One authority controls the player at a time: onFoot or driving.
import * as THREE from 'three';
import { clamp, collideCircle, CITY } from './utils.js';
import { makePerson, poseWalk, posePunch } from './characters.js';

export function createPlayer(scene, start) {
  const mesh = makePerson({ skin: 1, shirt: 0, pants: 0, hairColor: 0x1a0f08 });
  scene.add(mesh);
  return {
    mesh, parts: mesh.userData.parts,
    x: start.x, z: start.z, y: 0, vy: 0,
    heading: 0, // facing angle (radians, 0 = -z)
    walkPhase: 0,
    speed: 0,
    onGround: true,
    health: 100,
    mode: 'foot', // 'foot' | 'car'
    car: null,
    punchTimer: 0,
    punchCooldown: 0,
    invuln: 0,
  };
}

// Per-tick on-foot update. input: {moveX, moveZ (camera-relative), sprint, jump}
export function updatePlayerFoot(G, dt) {
  const p = G.player;
  const inp = G.input;
  const sprint = inp.sprint ? 1.7 : 1;
  const targetSpeed = 7.2 * sprint;
  const mx = inp.moveX, mz = inp.moveZ;
  const len = Math.hypot(mx, mz);
  let vx = 0, vz = 0;
  if (len > 0.01) {
    const nx = mx / len, nz = mz / len;
    vx = nx * targetSpeed; vz = nz * targetSpeed;
    p.heading = Math.atan2(nx, nz);
    p.walkPhase += dt * (sprint > 1 ? 13 : 9);
    p.speed = targetSpeed;
  } else {
    p.speed = 0;
  }
  p.x += vx * dt; p.z += vz * dt;
  collideCircle(p, 0.55, G.city.colliders);
  // Jump / gravity.
  if (inp.jump && p.onGround) { p.vy = 7.5; p.onGround = false; }
  if (!p.onGround) {
    p.vy -= 22 * dt;
    p.y += p.vy * dt;
    if (p.y <= 0) { p.y = 0; p.vy = 0; p.onGround = true; }
  }
  p.mesh.position.set(p.x, p.y, p.z);
  p.mesh.rotation.y = p.heading;
  if (p.punchTimer > 0) {
    p.punchTimer -= dt;
    posePunch(p.parts, 1 - p.punchTimer / 0.35);
  } else if (p.speed > 0.1) {
    poseWalk(p.parts, p.walkPhase, 1);
  } else {
    p.parts.legL.rotation.x = 0; p.parts.legR.rotation.x = 0;
    p.parts.armL.rotation.x = 0; p.parts.armR.rotation.x = 0;
  }
  if (p.punchCooldown > 0) p.punchCooldown -= dt;
  if (p.invuln > 0) p.invuln -= dt;
}

// --- Driving (arcade) -------------------------------------------------------
export function enterCar(G, car) {
  const p = G.player;
  p.mode = 'car';
  p.car = car;
  car.driver = 'player';
  car.mesh.visible = true;
  p.mesh.visible = false;
  G.audio.engineStart();
}

export function exitCar(G) {
  const p = G.player;
  const car = p.car;
  if (!car) return;
  // Step out to the car's left side onto valid ground.
  const side = car.heading + Math.PI / 2;
  const nx = car.x + Math.sin(side) * 2.2;
  const nz = car.z + Math.cos(side) * 2.2;
  const probe = { x: nx, z: nz };
  const before = { x: probe.x, z: probe.z };
  collideCircle(probe, 0.55, G.city.colliders);
  if (Math.hypot(probe.x - before.x, probe.z - before.z) > 0.4) {
    // Left side blocked: try the right side.
    const side2 = car.heading - Math.PI / 2;
    probe.x = car.x + Math.sin(side2) * 2.2;
    probe.z = car.z + Math.cos(side2) * 2.2;
    collideCircle(probe, 0.55, G.city.colliders);
  }
  car.driver = null;
  car.speed = 0;
  p.car = null;
  p.mode = 'foot';
  p.x = probe.x; p.z = probe.z; p.y = 0; p.vy = 0; p.onGround = true;
  p.heading = car.heading;
  p.mesh.visible = true;
  p.mesh.position.set(p.x, 0, p.z);
  p.mesh.rotation.y = p.heading;
}

// Per-tick driving update. input: forward/back (W/S), steer (A/D), handbrake.
export function updatePlayerCar(G, dt) {
  const car = G.player.car;
  if (!car) return;
  const inp = G.input;
  const topSpeed = car.topSpeed || 32;
  const accel = 16;
  if (inp.forward) car.speed += accel * dt;
  else if (inp.back) {
    if (car.speed > 0.5) car.speed -= 26 * dt; // brake
    else car.speed -= 9 * dt; // reverse
  } else {
    car.speed -= Math.sign(car.speed) * 6 * dt;
    if (Math.abs(car.speed) < 0.2) car.speed = 0;
  }
  if (inp.handbrake) car.speed -= Math.sign(car.speed) * 22 * dt;
  car.speed = clamp(car.speed, -10, topSpeed);
  // Steering weakens at speed.
  const steerAuthority = clamp(1 - Math.abs(car.speed) / (topSpeed * 1.6), 0.35, 1);
  const steer = (inp.left ? 1 : 0) - (inp.right ? 1 : 0);
  car.heading += steer * 1.9 * steerAuthority * dt * (car.speed >= 0 ? 1 : -1) * clamp(Math.abs(car.speed) / 6, 0.25, 1);
  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  // Car collision: circle vs buildings; bounce and lose speed on impact.
  const probe = { x: nx, z: nz };
  const hit = collideCircle(probe, 1.6, G.city.colliders);
  if (hit) {
    // Pedestrian hit check happens in traffic.js; here just stop the car.
    car.speed *= 0.35;
    G.audio.thud();
  }
  car.x = probe.x; car.z = probe.z;
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  // Engine sound follows speed.
  G.audio.engine(Math.abs(car.speed) / topSpeed);
  // Smoke / explosion handled in traffic.js update for all cars.
}
