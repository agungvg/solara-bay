// utils.js — seeded RNG, math helpers, collision helpers for Solara Bay.
// All gameplay collisions use authored volumes (rects / circles / spheres),
// never raycasts against render meshes.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
export function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
export const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

// City layout constants (shared by every module).
export const CITY = {
  roads: [-232, -174, -116, -58, 0, 58, 116, 174, 232],
  spacing: 58,
  roadWidth: 14,
  extent: 232,
  bound: 258, // hard playfield bound (beach / ocean edge included)
  beachZ: 240, // south of this is sand
  oceanZ: 300,
};
export const NAMED = {
  plaza: { x: 0, z: 0, label: 'Solara Plaza' },
  garage: { x: 203, z: 145, label: 'Mara\u2019s Garage' },
  police: { x: -203, z: -145, label: 'Bay Police HQ' },
  hospital: { x: 203, z: -203, label: 'Solara General' },
  docks: { x: 0, z: 268, label: 'South Docks' },
  beachBar: { x: -145, z: 262, label: 'Tide Bar' },
  beachPickup: { x: 87, z: 266, label: 'Beach pickup' },
};

// Push a circle (x,z,r) out of every rect collider and the city bounds.
// Returns true when a push happened. Mutates p in place.
export function collideCircle(p, r, colliders) {
  let hit = false;
  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    const cx = clamp(p.x, c.x0, c.x1);
    const cz = clamp(p.z, c.z0, c.z1);
    const dx = p.x - cx, dz = p.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        p.x = cx + (dx / d) * r;
        p.z = cz + (dz / d) * r;
      } else {
        // centre inside the rect: push out along the smallest penetration axis
        const pl = p.x - c.x0 + r, pr = c.x1 - p.x + r;
        const pt = p.z - c.z0 + r, pb = c.z1 - p.z + r;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) p.x = c.x0 - r;
        else if (m === pr) p.x = c.x1 + r;
        else if (m === pt) p.z = c.z0 - r;
        else p.z = c.z1 + r;
      }
      hit = true;
    }
  }
  const b = CITY.bound;
  if (p.x < -b) { p.x = -b; hit = true; }
  if (p.x > b) { p.x = b; hit = true; }
  if (p.z < -b) { p.z = -b; hit = true; }
  if (p.z > CITY.oceanZ + 8) { p.z = CITY.oceanZ + 8; hit = true; }
  return hit;
}

// True when the 2D segment (ax,az)->(bx,bz) crosses any rect collider.
// Used for camera de-collision and for shots blocked by buildings.
export function segmentBlocked(ax, az, bx, bz, colliders) {
  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    if (segmentRect(ax, az, bx, bz, c)) return true;
  }
  return false;
}
function segmentRect(ax, az, bx, bz, c) {
  // Slab test in 2D; treat the segment as a line with a small thickness.
  const dx = bx - ax, dz = bz - az;
  let t0 = 0, t1 = 1;
  const axes = [
    [dx, ax, c.x0, c.x1],
    [dz, az, c.z0, c.z1],
  ];
  for (let k = 0; k < 2; k++) {
    const d = axes[k][0], o = axes[k][1], lo = axes[k][2], hi = axes[k][3];
    if (Math.abs(d) < 1e-9) {
      if (o < lo || o > hi) return false;
    } else {
      let ta = (lo - o) / d, tb = (hi - o) / d;
      if (ta > tb) { const t = ta; ta = tb; tb = t; }
      if (ta > t0) t0 = ta;
      if (tb < t1) t1 = tb;
      if (t0 > t1) return false;
    }
  }
  return true;
}

// Nearest road coordinate to a value (for traffic / sidewalk placement).
export function nearestRoad(v) {
  let best = CITY.roads[0], bd = 1e9;
  for (const r of CITY.roads) {
    const d = Math.abs(r - v);
    if (d < bd) { bd = d; best = r; }
  }
  return best;
}
export function onRoad(x, z) {
  const hw = CITY.roadWidth / 2;
  for (const r of CITY.roads) {
    if (Math.abs(x - r) < hw || Math.abs(z - r) < hw) return true;
  }
  return false;
}
