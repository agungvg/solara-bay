// combat.js — pistol hitscan (authored spheres + building footprints),
// melee punch, tracers and impact flashes. Never raycasts render meshes.
import * as THREE from 'three';
import { dist2, segmentBlocked } from './utils.js';
import { damageCar, damagePlayer, witnessCrime } from './traffic.js';
import { addCrime } from './police.js';

const PISTOL_DAMAGE = 34;

// Shoot from the camera through the crosshair. Returns a hit description.
export function shoot(G) {
  const p = G.player;
  if (G.ammo.mag <= 0) {
    G.audio.emptyClick();
    G.toast('No ammo — press R to reload');
    return null;
  }
  G.ammo.mag -= 1;
  G.audio.gunshot();
  G.gunshotFlash = 0.25;
  // Ray origin: camera position, direction: camera forward.
  const cam = G.camera;
  const origin = cam.position.clone();
  const dir = new THREE.Vector3();
  cam.getWorldDirection(dir);
  const end = origin.clone().addScaledVector(dir, 120);

  // Find the nearest hit among authored volumes.
  let bestT = 120, best = null;
  const consider = (t, hit) => {
    if (t < bestT && t > 0) { bestT = t; best = hit; }
  };
  // Buildings block shots: if the segment hits a footprint, cap the range.
  let range = 120;
  for (const c of G.city.colliders) {
    const t = segmentRectHit(origin, dir, c);
    if (t !== null && t < range) range = t;
  }
  // People: sphere radius 0.9 at chest height.
  const targets = [];
  for (const ped of G.peds) if (!ped.dead) targets.push({ kind: 'ped', obj: ped, x: ped.x, y: 1.1, z: ped.z, r: 0.9 });
  for (const cop of G.footCops) if (!cop.dead) targets.push({ kind: 'cop', obj: cop, x: cop.x, y: 1.1, z: cop.z, r: 0.9 });
  for (const g of G.gang) if (!g.dead) targets.push({ kind: 'gang', obj: g, x: g.x, y: 1.1, z: g.z, r: 0.9 });
  for (const t of targets) {
    const hit = raySphere(origin, dir, t.x, t.y, t.z, t.r);
    if (hit !== null && hit <= range) consider(hit, { kind: t.kind, obj: t.obj });
  }
  // Cars: sphere radius 1.6 at body height.
  for (const car of G.traffic) {
    if (car.dead || car === p.car) continue;
    const hit = raySphere(origin, dir, car.x, 0.9, car.z, 1.8);
    if (hit !== null && hit <= range) consider(hit, { kind: 'car', obj: car });
  }
  // Police cars too (they are in G.traffic).
  const hitPoint = origin.clone().addScaledVector(dir, Math.min(bestT, range));
  spawnTracer(G, origin, hitPoint);
  spawnImpact(G, hitPoint);
  if (!best) return { kind: 'miss', point: hitPoint };
  if (best.kind === 'ped') {
    best.obj.dead = true; best.obj.mesh.visible = false; if (best.obj.marker) best.obj.marker.visible = false;
    addCrime(G, 1, 'Pedestrian shot');
    G.toast('Pedestrian down — the cops noticed');
    witnessCrime(G, best.obj.x, best.obj.z); // nearby NPCs saw it — they call it in
  } else if (best.kind === 'cop') {
    best.obj.dead = true; best.obj.mesh.visible = false;
    addCrime(G, 2, 'Officer shot');
  } else if (best.kind === 'gang') {
    best.obj.health -= PISTOL_DAMAGE;
    if (best.obj.health <= 0) {
      best.obj.dead = true; best.obj.mesh.visible = false;
      G.events.push({ type: 'gangDown', gang: best.obj });
    }
  } else if (best.kind === 'car') {
    damageCar(G, best.obj, PISTOL_DAMAGE);
  }
  return { kind: best.kind, point: hitPoint };
}

// Ray vs sphere: returns distance t or null.
function raySphere(o, d, cx, cy, cz, r) {
  const ox = o.x - cx, oy = o.y - cy, oz = o.z - cz;
  const b = ox * d.x + oy * d.y + oz * d.z;
  const c = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - c;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  return t > 0 ? t : null;
}

// Ray vs building footprint rect (2D slab test, returns t or null).
function segmentRectHit(o, d, c) {
  let t0 = 0, t1 = 1e9;
  const axes = [
    [d.x, o.x, c.x0, c.x1],
    [d.z, o.z, c.z0, c.z1],
  ];
  for (let k = 0; k < 2; k++) {
    const dd = axes[k][0], oo = axes[k][1], lo = axes[k][2], hi = axes[k][3];
    if (Math.abs(dd) < 1e-9) {
      if (oo < lo || oo > hi) return null;
    } else {
      let ta = (lo - oo) / dd, tb = (hi - oo) / dd;
      if (ta > tb) { const t = ta; ta = tb; tb = t; }
      if (ta > t0) t0 = ta;
      if (tb < t1) t1 = tb;
      if (t0 > t1) return null;
    }
  }
  return t0;
}

function spawnTracer(G, from, to) {
  const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a0 }));
  G.scene.add(line);
  G.effects.push({ mesh: line, ttl: 0.08, kind: 'line' });
}
function spawnImpact(G, point) {
  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffcc44 }),
  );
  flash.position.copy(point);
  G.scene.add(flash);
  G.effects.push({ mesh: flash, ttl: 0.15, kind: 'flash' });
}

// Melee punch: arc in front of the player.
export function punch(G) {
  const p = G.player;
  if (p.punchCooldown > 0 || p.mode !== 'foot') return;
  p.punchTimer = 0.35;
  p.punchCooldown = 0.45;
  G.audio.punch();
  const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
  const hitList = [];
  for (const ped of G.peds) if (!ped.dead) hitList.push({ kind: 'ped', obj: ped, x: ped.x, z: ped.z });
  for (const cop of G.footCops) if (!cop.dead) hitList.push({ kind: 'cop', obj: cop, x: cop.x, z: cop.z });
  for (const g of G.gang) if (!g.dead) hitList.push({ kind: 'gang', obj: g, x: g.x, z: g.z });
  for (const t of hitList) {
    const dx = t.x - p.x, dz = t.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d < 2.2 && (dx * fx + dz * fz) / Math.max(d, 0.01) > 0.3) {
      if (t.kind === 'ped') {
        t.obj.dead = true; t.obj.mesh.visible = false; if (t.obj.marker) t.obj.marker.visible = false;
        addCrime(G, 1, 'Pedestrian punched');
        witnessCrime(G, t.obj.x, t.obj.z); // nearby NPCs saw it
      } else if (t.kind === 'cop') {
        addCrime(G, 2, 'Officer punched');
        damagePlayer(G, 0); // no self damage; cop retaliates via its own AI
        t.obj.x += fx * 1.5; t.obj.z += fz * 1.5;
      } else if (t.kind === 'gang') {
        t.obj.health -= 20;
        if (t.obj.health <= 0) {
          t.obj.dead = true; t.obj.mesh.visible = false;
          G.events.push({ type: 'gangDown', gang: t.obj });
        }
      }
    }
  }
}

export function updateEffects(G, dt) {
  for (let i = G.effects.length - 1; i >= 0; i--) {
    const e = G.effects[i];
    e.ttl -= dt;
    if (e.ttl <= 0) {
      G.scene.remove(e.mesh);
      if (e.mesh.geometry) e.mesh.geometry.dispose();
      if (e.mesh.material) e.mesh.material.dispose();
      G.effects.splice(i, 1);
    }
  }
  if (G.gunshotFlash > 0) G.gunshotFlash -= dt;
}
