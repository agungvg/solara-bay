// traffic.js — AI road traffic, pedestrians, parked cars, pickups and
// car damage (smoke then explosion). Traffic follows the road grid.
import * as THREE from 'three';
import { CITY, NAMED, clamp, collideCircle, mulberry32, dist2, nearestRoad } from './utils.js';
import { makeCar, makePerson, poseWalk } from './characters.js';

const TRAFFIC_TYPES = ['sedan', 'sedan', 'sedan', 'sport', 'taxi', 'truck', 'van'];

export function makeCarEntity(scene, type, colorIdx, x, z, heading) {
  const mesh = makeCar(type, colorIdx);
  scene.add(mesh);
  const car = {
    mesh, type, x, z, heading, speed: 0,
    topSpeed: type === 'sport' ? 34 : type === 'truck' ? 20 : 27,
    health: 100, driver: 'ai', // 'ai' | 'player' | null (parked) | 'none'
    smoke: null, dead: false, explodeTimer: 0,
    // traffic AI state
    axis: 'x', dir: 1, target: 0, wait: 0,
  };
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  return car;
}

export function createTraffic(scene, rng, colliders) {
  const cars = [];
  // Parked cars on the sidewalk south of the garage (in view of the start).
  const parked = [
    [185, 182, 0.15],
    [203, 184, -0.1],
    [221, 182, 0.3],
  ];
  for (const [x, z, h] of parked) {
    const c = makeCarEntity(scene, 'sedan', Math.floor(rng() * 5), x, z, h);
    c.driver = null;
    cars.push(c);
  }
  // Distinctive magenta sports car at the docks (mission 2 target).
  const magenta = makeCarEntity(scene, 'sport', 0, NAMED_DOCKS.x + 14, NAMED_DOCKS.z - 4, Math.PI / 2);
  magenta.driver = null;
  magenta.missionCar = true;
  cars.push(magenta);
  // Moving traffic on the grid.
  for (let i = 0; i < 20; i++) {
    const type = TRAFFIC_TYPES[Math.floor(rng() * TRAFFIC_TYPES.length)];
    const horizontal = rng() < 0.5;
    const road = CITY.roads[Math.floor(rng() * CITY.roads.length)];
    const along = CITY.roads[Math.floor(rng() * CITY.roads.length)];
    const dir = rng() < 0.5 ? 1 : -1;
    const x = horizontal ? along : road;
    const z = horizontal ? road : along;
    const heading = horizontal ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    const car = makeCarEntity(scene, type, Math.floor(rng() * 5), x, z, heading);
    car.axis = horizontal ? 'x' : 'z';
    car.dir = dir;
    car.speed = 7 + rng() * 5;
    car.target = nextIntersection(horizontal ? along : road, dir);
    cars.push(car);
  }
  return cars;
}
const NAMED_GARAGE = { x: 203, z: 145 };
const NAMED_DOCKS = { x: 0, z: 268 };

function nextIntersection(pos, dir) {
  // Next road coordinate in the driving direction.
  let best = dir > 0 ? 232 : -232;
  for (const r of CITY.roads) {
    if (dir > 0 && r > pos + 1 && r < best) best = r;
    if (dir < 0 && r < pos - 1 && r > best) best = r;
  }
  return best;
}

// Traffic update: follow grid, random turns at intersections, slow for the car ahead.
export function updateTraffic(G, dt) {
  const rng = G.rng;
  for (const car of G.traffic) {
    if (car.dead || car.driver === 'player' || car.driver === null) continue;
    // Car ahead check.
    let ahead = null, aheadD = 1e9;
    for (const other of G.traffic) {
      if (other === car || other.dead) continue;
      const d = dist2(car.x, car.z, other.x, other.z);
      if (d < aheadD) { aheadD = d; ahead = other; }
    }
    const p = G.player;
    if (p.mode === 'car' && p.car) {
      const d = dist2(car.x, car.z, p.car.x, p.car.z);
      if (d < aheadD) { aheadD = d; ahead = p.car; }
    }
    let want = car.topSpeed * 0.45;
    if (ahead && aheadD < 14) want = Math.max(0, (aheadD - 7) * 0.8);
    car.speed += clamp(want - car.speed, -8 * dt, 5 * dt);
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
    // Reached the target intersection: random turn or straight on.
    const along = car.axis === 'x' ? car.x : car.z;
    const arrived = car.dir > 0 ? along >= car.target : along <= car.target;
    if (arrived) {
      const road = car.axis === 'x' ? car.z : car.x;
      const roll = rng();
      if (roll < 0.3) {
        // Turn left or right onto the cross road.
        const turn = rng() < 0.5 ? 1 : -1;
        const oldAxis = car.axis;
        car.axis = oldAxis === 'x' ? 'z' : 'x';
        car.dir = turn;
        car.heading = car.axis === 'x'
          ? (turn > 0 ? Math.PI / 2 : -Math.PI / 2)
          : (turn > 0 ? 0 : Math.PI);
        // Snap onto the cross road.
        if (oldAxis === 'x') car.z = nearestRoad(road);
        else car.x = nearestRoad(road);
        car.target = nextIntersection(car.axis === 'x' ? car.x : car.z, car.dir);
      } else {
        car.target = nextIntersection(along, car.dir);
      }
      if (car.dir > 0 && car.target >= 232) car.dir = -1, car.target = nextIntersection(along, -1);
      if (car.dir < 0 && car.target <= -232) car.dir = 1, car.target = nextIntersection(along, 1);
    }
    // Keep on the road (correct drift).
    if (car.axis === 'x') car.z = nearestRoad(car.z);
    else car.x = nearestRoad(car.x);
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    // Hit a pedestrian? (traffic cars run them over)
    for (const ped of G.peds) {
      if (ped.dead) continue;
      if (dist2(car.x, car.z, ped.x, ped.z) < 1.6 && Math.abs(car.speed) > 2) {
        ped.dead = true; ped.mesh.visible = false;
        G.events.push({ type: 'pedDown', x: ped.x, z: ped.z, byTraffic: true });
      }
    }
  }
  // Player car vs pedestrians (crime).
  const p = G.player;
  if (p.mode === 'car' && p.car && Math.abs(p.car.speed) > 4) {
    for (const ped of G.peds) {
      if (ped.dead) continue;
      if (dist2(p.car.x, p.car.z, ped.x, ped.z) < 2.0) {
        ped.dead = true; ped.mesh.visible = false;
        G.events.push({ type: 'pedDown', x: ped.x, z: ped.z });
      }
    }
  }
}

// --- Pedestrians ------------------------------------------------------------
export function createPedestrians(scene, rng) {
  const peds = [];
  for (let i = 0; i < 24; i++) {
    const mesh = makePerson({
      skin: Math.floor(rng() * 4),
      shirt: Math.floor(rng() * 7),
      pants: Math.floor(rng() * 4),
    });
    scene.add(mesh);
    const road = CITY.roads[Math.floor(rng() * CITY.roads.length)];
    const along = -220 + rng() * 440;
    const horizontal = rng() < 0.5;
    const ped = {
      mesh, parts: mesh.userData.parts,
      x: horizontal ? along : road + 10.5,
      z: horizontal ? road + 10.5 : along,
      heading: rng() * Math.PI * 2,
      speed: 1.2 + rng() * 0.8,
      phase: rng() * 10,
      flee: 0, dead: false, horizontal,
      road,
    };
    mesh.position.set(ped.x, 0, ped.z);
    peds.push(ped);
  }
  return peds;
}

export function updatePedestrians(G, dt) {
  const p = G.player;
  for (const ped of G.peds) {
    if (ped.dead) continue;
    // Flee from gunshots and fast cars.
    let fleeX = 0, fleeZ = 0, fleeing = false;
    const px = p.mode === 'car' && p.car ? p.car.x : p.x;
    const pz = p.mode === 'car' && p.car ? p.car.z : p.z;
    const dPlayer = dist2(ped.x, ped.z, px, pz);
    const playerFast = (p.mode === 'car' && Math.abs(p.car.speed) > 10) || G.gunshotFlash > 0;
    if (dPlayer < 14 && playerFast) {
      fleeing = true;
      const d = Math.max(dPlayer, 0.5);
      fleeX = (ped.x - px) / d; fleeZ = (ped.z - pz) / d;
    }
    if (G.gunshotFlash > 0 && dPlayer < 30) fleeing = true;
    let vx, vz;
    if (fleeing) {
      vx = fleeX * 4.5; vz = fleeZ * 4.5;
      ped.heading = Math.atan2(vx, vz);
    } else {
      const dir = ped.horizontal ? 1 : 0;
      vx = dir ? Math.cos(ped.heading) * ped.speed : 0;
      vz = dir ? 0 : Math.sin(ped.heading) * ped.speed;
      // Walk along the sidewalk; bounce at the ends.
      if (ped.horizontal) {
        if (ped.x > 240 || ped.x < -240) ped.heading += Math.PI;
        vx = Math.cos(ped.heading) * ped.speed; vz = 0;
      } else {
        if (ped.z > 240 || ped.z < -240) ped.heading += Math.PI;
        vx = 0; vz = Math.sin(ped.heading) * ped.speed;
      }
      ped.heading = Math.atan2(vx, vz);
    }
    ped.x += vx * dt; ped.z += vz * dt;
    collideCircle(ped, 0.5, G.city.colliders);
    ped.phase += dt * (fleeing ? 12 : 8);
    poseWalk(ped.parts, ped.phase, fleeing ? 1 : 0.6);
    ped.mesh.position.set(ped.x, 0, ped.z);
    ped.mesh.rotation.y = ped.heading;
  }
}

// --- Car damage: smoke, then explosion ---------------------------------------
export function damageCar(G, car, amount) {
  if (car.dead) return;
  car.health -= amount;
  if (car.health <= 40 && !car.smoke) {
    const smoke = new THREE.Mesh(
      new THREE.SphereGeometry(0.8, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0x555555, transparent: true, opacity: 0.55 }),
    );
    smoke.position.set(0, 1.4, car.mesh.userData.len / 2 - 0.6);
    car.mesh.add(smoke);
    car.smoke = smoke;
  }
  if (car.health <= 0 && car.explodeTimer <= 0) {
    car.explodeTimer = 0.6;
    G.audio.explosion();
  }
}

export function updateCarDamage(G, dt) {
  for (const car of G.traffic) {
    if (car.dead) continue;
    if (car.smoke) {
      car.smoke.scale.setScalar(1 + Math.sin(G.time * 9) * 0.25 + 0.3);
    }
    if (car.explodeTimer > 0) {
      car.explodeTimer -= dt;
      if (car.explodeTimer <= 0) {
        car.dead = true;
        // Big flash, then remove.
        const flash = new THREE.Mesh(
          new THREE.SphereGeometry(3.2, 10, 8),
          new THREE.MeshBasicMaterial({ color: 0xff8822, transparent: true, opacity: 0.9 }),
        );
        flash.position.copy(car.mesh.position).y = 1.5;
        G.scene.add(flash);
        G.effects.push({ mesh: flash, ttl: 0.35, kind: 'flash' });
        car.mesh.visible = false;
        const p = G.player;
        const px = p.mode === 'car' && p.car ? p.car.x : p.x;
        const pz = p.mode === 'car' && p.car ? p.car.z : p.z;
        if (dist2(car.x, car.z, px, pz) < 6) {
          damagePlayer(G, 40);
        }
        if (car === p.car) {
          // Player's car exploded: dump them out.
          p.car = null; p.mode = 'foot';
          p.x = car.x + 3; p.z = car.z + 3;
          p.mesh.visible = true;
          p.mesh.position.set(p.x, 0, p.z);
          damagePlayer(G, 30);
        }
      }
    }
  }
}

export function damagePlayer(G, amount) {
  const p = G.player;
  if (p.invuln > 0 || G.state !== 'playing') return;
  p.health -= amount;
  p.invuln = 0.4;
  G.hudFlash = 1;
  G.audio.hurt();
  if (p.health <= 0) {
    p.health = 0;
    G.events.push({ type: 'wasted' });
  }
}

// --- Pickups -----------------------------------------------------------------
export function createPickups(scene) {
  const spots = [
    { x: NAMED.hospital?.x ?? 203, z: -190, kind: 'health' },
    { x: -190, z: -145, kind: 'ammo' },
    { x: 190, z: 145, kind: 'health' },
    { x: -14, z: 268, kind: 'ammo' },
    { x: -58, z: 58, kind: 'health' },
    { x: 116, z: -116, kind: 'ammo' },
  ];
  const pickups = [];
  const colors = { health: 0x2ecc40, ammo: 0xffdc00 };
  for (const s of spots) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.9, 0.9),
      new THREE.MeshBasicMaterial({ color: colors[s.kind] }),
    );
    mesh.position.set(s.x, 1.0, s.z);
    scene.add(mesh);
    pickups.push({ mesh, x: s.x, z: s.z, kind: s.kind, taken: false, bob: Math.random() * 6 });
  }
  return pickups;
}

export function updatePickups(G, dt) {
  const p = G.player;
  const px = p.mode === 'car' && p.car ? p.car.x : p.x;
  const pz = p.mode === 'car' && p.car ? p.car.z : p.z;
  for (const pk of G.pickups) {
    if (pk.taken) continue;
    pk.bob += dt;
    pk.mesh.position.y = 1.0 + Math.sin(pk.bob * 3) * 0.25;
    pk.mesh.rotation.y += dt * 1.5;
    if (dist2(px, pz, pk.x, pk.z) < 2.2) {
      pk.taken = true;
      pk.mesh.visible = false;
      if (pk.kind === 'health') p.health = Math.min(100, p.health + 40);
      else G.ammo.reserve += 24;
      G.audio.pickup();
      G.toast(pk.kind === 'health' ? '+40 Health' : '+24 Ammo');
    }
  }
}
