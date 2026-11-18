// characters.js — builders for people and cars. Simple shapes, shared
// geometries and materials; each builder returns a Group with named parts.
// People vary: height, skin, clothes, hats, vests, aprons, backpacks —
// no two pedestrians on a street should read as clones.
import * as THREE from 'three';

const MAT = {};
function mat(name, material) {
  if (!MAT[name]) MAT[name] = material;
  return MAT[name];
}
function lam(name, color) {
  return mat(name, new THREE.MeshLambertMaterial({ color }));
}
function std(name, color, roughness, metalness) {
  return mat(name, new THREE.MeshStandardMaterial({ color, roughness, metalness }));
}
const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  head: new THREE.SphereGeometry(0.22, 10, 8),
  wheel: new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10),
  hub: new THREE.CylinderGeometry(0.18, 0.18, 0.32, 8),
  leg: new THREE.BoxGeometry(0.16, 0.5, 0.16),
  arm: new THREE.BoxGeometry(0.13, 0.5, 0.13),
};

const SKINS = [0xe8b98a, 0xc98d5f, 0x8a5a3b, 0xf0c8a0, 0x6b4226];
const SHIRTS = [0x3a7bd5, 0xd53a3a, 0x3aa655, 0xe8c832, 0x8a5ad5, 0xeeeeee, 0x222222,
  0xe87a2e, 0x2ec8b8, 0xd53a8a, 0x7a9a3a, 0x9a6a3a];
const PANTS = [0x2c3e50, 0x4a4a4a, 0x5a3a2a, 0x1e2a4a, 0x6a6a6a, 0x3a2a3a];
const HAIRS = [0x2a1a10, 0x111111, 0x6a4a2a, 0x8a8a8a, 0xc8a040, 0x5a2a1a];

// A person ~1.8 m tall (scaled by opts.scale). parts:
// {head, torso, armL, armR, legL, legR}
export function makePerson(opts = {}) {
  const g = new THREE.Group();
  const skin = lam('skin' + (opts.skin ?? 0), SKINS[(opts.skin ?? 0) % SKINS.length]);
  const shirt = lam('shirt' + (opts.shirt ?? 0), SHIRTS[(opts.shirt ?? 0) % SHIRTS.length]);
  const pants = lam('pants' + (opts.pants ?? 0), PANTS[(opts.pants ?? 0) % PANTS.length]);
  const hair = lam('hair' + (opts.hairColor ?? 0), opts.hairColor ?? HAIRS[(opts.skin ?? 0) % HAIRS.length]);

  const head = new THREE.Mesh(GEO.head, skin);
  head.position.y = 1.62; head.castShadow = true;
  const hairM = new THREE.Mesh(new THREE.SphereGeometry(0.23, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
  hairM.position.y = 1.66;
  const torso = new THREE.Mesh(GEO.box, shirt);
  torso.scale.set(0.55, 0.62, 0.3); torso.position.y = 1.12; torso.castShadow = true;
  const legL = new THREE.Mesh(GEO.leg, pants);
  legL.position.set(-0.14, 0.55, 0);
  const legR = new THREE.Mesh(GEO.leg, pants);
  legR.position.set(0.14, 0.55, 0);
  const armL = new THREE.Mesh(GEO.arm, shirt);
  armL.position.set(-0.36, 1.18, 0);
  const armR = new THREE.Mesh(GEO.arm, shirt);
  armR.position.set(0.36, 1.18, 0);
  g.add(head, hairM, torso, legL, legR, armL, armR);

  // Accessories — the cheap way a pedestrian reads as a person with a job.
  if (opts.hat === 'cap') {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.1, 10),
      lam('cap' + (opts.shirt ?? 0), SHIRTS[(opts.shirt ?? 0) % SHIRTS.length]));
    cap.position.y = 1.82;
    g.add(cap);
    const brim = new THREE.Mesh(GEO.box, lam('capBrim', 0x222222));
    brim.scale.set(0.3, 0.04, 0.2);
    brim.position.set(0, 1.79, 0.24);
    g.add(brim);
  } else if (opts.hat === 'beanie') {
    const bn = new THREE.Mesh(new THREE.SphereGeometry(0.23, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.5),
      lam('beanie', 0xd53a3a));
    bn.position.y = 1.68;
    g.add(bn);
  }
  if (opts.vest) { // hi-vis work vest
    const vest = new THREE.Mesh(GEO.box, lam('hivis', 0xe8e020));
    vest.scale.set(0.58, 0.4, 0.33);
    vest.position.y = 1.2;
    g.add(vest);
  }
  if (opts.apron) { // shopkeeper apron
    const apron = new THREE.Mesh(GEO.box, lam('apron', 0xf2f2f2));
    apron.scale.set(0.5, 0.55, 0.06);
    apron.position.set(0, 1.05, 0.17);
    g.add(apron);
  }
  if (opts.backpack) {
    const pack = new THREE.Mesh(GEO.box, lam('pack' + (opts.shirt ?? 0), SHIRTS[(opts.shirt ?? 0) % SHIRTS.length]));
    pack.scale.set(0.36, 0.44, 0.18);
    pack.position.set(0, 1.2, -0.24);
    g.add(pack);
  }
  if (opts.jacket) { // open jacket: darker torso overlay, wider shoulders
    const jk = new THREE.Mesh(GEO.box, lam('jacket', 0x2a2a34));
    jk.scale.set(0.6, 0.5, 0.34);
    jk.position.y = 1.2;
    g.add(jk);
  }
  const scale = opts.scale ?? 1;
  g.scale.setScalar(scale);
  g.userData.parts = { head, torso, legL, legR, armL, armR };
  g.userData.baseScale = scale;
  return g;
}

// Walk-cycle pose: t = phase, speed 0..1.
export function poseWalk(parts, t, speed) {
  const s = Math.sin(t) * 0.6 * speed;
  parts.legL.rotation.x = s;
  parts.legR.rotation.x = -s;
  parts.armL.rotation.x = -s * 0.8;
  parts.armR.rotation.x = s * 0.8;
  parts.armL.rotation.z = 0;
  parts.armR.rotation.z = 0;
}
export function posePunch(parts, t) {
  // t 0..1 through the punch: right arm extends forward.
  const ext = Math.sin(Math.min(t, 1) * Math.PI);
  parts.armR.rotation.x = -1.5 * ext;
  parts.armL.rotation.x = 0.4 * ext;
}
// Idle: gentle breathing, arms at sides.
export function poseIdle(parts, t) {
  const b = Math.sin(t * 1.4) * 0.04;
  parts.torso.position.y = 1.12 + b;
  parts.legL.rotation.x = 0;
  parts.legR.rotation.x = 0;
  parts.armL.rotation.x = Math.sin(t * 0.9) * 0.06;
  parts.armR.rotation.x = -Math.sin(t * 0.9) * 0.06;
  parts.armL.rotation.z = 0.06;
  parts.armR.rotation.z = -0.06;
}
// Panic: both arms thrown up.
export function posePanic(parts) {
  parts.armL.rotation.z = 2.4;
  parts.armR.rotation.z = -2.4;
  parts.armL.rotation.x = 0;
  parts.armR.rotation.x = 0;
  parts.legL.rotation.x = 0.4;
  parts.legR.rotation.x = -0.4;
}
// Talking: one arm gestures while the body faces the other person.
export function poseTalk(parts, t) {
  const g = Math.sin(t * 2.2) * 0.5;
  parts.armR.rotation.x = -0.9 + g * 0.4;
  parts.armR.rotation.z = -0.3;
  parts.armL.rotation.x = -0.2;
  parts.armL.rotation.z = 0.15;
  parts.legL.rotation.x = 0;
  parts.legR.rotation.x = 0;
}
// Sitting: legs forward, torso upright (on a bench / plaza edge).
export function poseSit(parts) {
  parts.legL.rotation.x = -1.45;
  parts.legR.rotation.x = -1.45;
  parts.armL.rotation.x = -0.5;
  parts.armR.rotation.x = -0.5;
  parts.armL.rotation.z = 0.1;
  parts.armR.rotation.z = -0.1;
}

const CAR_COLORS = {
  sedan: [0xb03a2e, 0x2e5cb0, 0xd8d8d8, 0x3a3a3a, 0x2e8b57, 0xc8a020],
  sport: [0xe02060, 0xffd700, 0x18c8e8, 0xff5a1f, 0x8a2be2],
  convertible: [0xff5a1f, 0x18c8e8, 0xe8e8e8, 0xd53a3a],
  pickup: [0x4a6fa5, 0x7a7a7a, 0xb03a2e, 0x2e8b57],
  taxi: [0xf2c200],
  truck: [0x7a7a7a, 0x4a6fa5],
  van: [0xd8d8d8, 0x8a5ad5],
  police: [0x1a1a1a],
};

// A car ~4.4 m long with a visible interior (seats, wheel, dash),
// headlights + taillights, bumpers and hubcaps.
// parts: {body, lightL, lightR, roof}
export function makeCar(type = 'sedan', colorIdx = 0) {
  const g = new THREE.Group();
  const palette = CAR_COLORS[type] || CAR_COLORS.sedan;
  const color = palette[colorIdx % palette.length];
  // Paint: glossy clearcoat read (metalness + low roughness), glass dark
  // and slick, tyres matte — the roughness contrast is what kills the
  // flat-plastic look.
  const bodyMat = std('car' + type + color, color, 0.32, 0.55);
  const glassMat = std('glass', 0x18242e, 0.08, 0.9);
  const tireMat = std('tire', 0x181818, 0.95, 0);
  const darkMat = std('dark', 0x222222, 0.7, 0.2);
  const chromeMat = std('chrome', 0xd8dde2, 0.15, 1.0);
  const seatMat = lam('seat', 0x3a2e26);
  const dashMat = lam('dash', 0x1e1e24);

  const len = type === 'truck' ? 6.4 : type === 'van' ? 5.2 : type === 'pickup' ? 5.0 : 4.4;
  const wid = type === 'truck' ? 2.4 : 2.0;
  const bodyH = type === 'truck' ? 1.5 : 0.75;
  const body = new THREE.Mesh(GEO.box, bodyMat);
  body.scale.set(wid, bodyH, len);
  body.position.y = 0.55 + bodyH / 2 - 0.35;
  body.castShadow = true;
  g.add(body);

  // Bumpers + grille.
  for (const z of [len / 2 - 0.05, -len / 2 + 0.05]) {
    const b = new THREE.Mesh(GEO.box, chromeMat);
    b.scale.set(wid * 0.96, 0.16, 0.12);
    b.position.set(0, 0.42, z);
    g.add(b);
  }
  const grille = new THREE.Mesh(GEO.box, darkMat);
  grille.scale.set(wid * 0.6, 0.18, 0.06);
  grille.position.set(0, 0.72, len / 2 + 0.02);
  g.add(grille);

  const isOpen = type === 'convertible';
  const cabin = new THREE.Mesh(GEO.box, type === 'truck' ? bodyMat : glassMat);
  const cabLen = type === 'truck' ? 1.4 : len * 0.45;
  cabin.scale.set(wid * 0.85, isOpen ? 0.34 : 0.6, cabLen);
  cabin.position.set(0, body.position.y + bodyH / 2 + (isOpen ? 0.16 : 0.28), type === 'truck' ? len / 2 - 1.0 : -0.2);
  cabin.castShadow = true;
  g.add(cabin);

  // Interior: two seats, dashboard, steering wheel — visible through glass.
  if (type !== 'truck') {
    for (const x of [-0.5, 0.5]) {
      const seat = new THREE.Mesh(GEO.box, seatMat);
      seat.scale.set(0.55, 0.55, 0.5);
      seat.position.set(x, body.position.y + 0.35, -0.35);
      g.add(seat);
      const back = new THREE.Mesh(GEO.box, seatMat);
      back.scale.set(0.55, 0.6, 0.16);
      back.position.set(x, body.position.y + 0.75, -0.62);
      g.add(back);
    }
    const dash = new THREE.Mesh(GEO.box, dashMat);
    dash.scale.set(wid * 0.8, 0.22, 0.4);
    dash.position.set(0, body.position.y + 0.55, 0.55);
    g.add(dash);
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.045, 6, 14), dashMat);
    wheel.position.set(-0.5, body.position.y + 0.72, 0.35);
    wheel.rotation.x = -0.5;
    g.add(wheel);
  }
  if (type === 'truck') {
    const bed = new THREE.Mesh(GEO.box, darkMat);
    bed.scale.set(wid * 0.9, 0.9, len * 0.55);
    bed.position.set(0, body.position.y + bodyH / 2 + 0.45, -len * 0.18);
    g.add(bed);
  }
  if (type === 'pickup') {
    const bed = new THREE.Mesh(GEO.box, darkMat);
    bed.scale.set(wid * 0.88, 0.5, len * 0.4);
    bed.position.set(0, body.position.y + bodyH / 2 + 0.25, -len * 0.22);
    g.add(bed);
    // Cargo: a crate in the bed.
    const crate = new THREE.Mesh(GEO.box, lam('crate', 0xa8873a));
    crate.scale.set(0.8, 0.6, 0.8);
    crate.position.set(0.2, body.position.y + bodyH / 2 + 0.8, -len * 0.22);
    g.add(crate);
  }
  if (type === 'taxi') {
    const sign = new THREE.Mesh(GEO.box, lam('taxiSign', 0xffe600));
    sign.scale.set(0.7, 0.18, 0.4);
    sign.position.set(0, cabin.position.y + 0.4, -0.2);
    g.add(sign);
  }
  if (type === 'police') {
    const bar = new THREE.Mesh(GEO.box, lam('policeBar', 0xdddddd));
    bar.scale.set(1.1, 0.14, 0.4);
    bar.position.set(0, cabin.position.y + 0.38, -0.2);
    g.add(bar);
    const lightL = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    lightL.position.set(-0.3, cabin.position.y + 0.45, -0.2);
    const lightR = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0x2266ff }));
    lightR.position.set(0.3, cabin.position.y + 0.45, -0.2);
    g.add(lightL, lightR);
    g.userData.parts = { lightL, lightR };
  }
  // Wheels + hubcaps.
  const wheelPos = [
    [-wid / 2, len / 2 - 0.9], [wid / 2, len / 2 - 0.9],
    [-wid / 2, -len / 2 + 0.9], [wid / 2, -len / 2 + 0.9],
  ];
  for (const [x, z] of wheelPos) {
    const w = new THREE.Mesh(GEO.wheel, tireMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.36, z);
    g.add(w);
    const hub = new THREE.Mesh(GEO.hub, chromeMat);
    hub.rotation.z = Math.PI / 2;
    hub.position.set(x + (x < 0 ? -0.02 : 0.02), 0.36, z);
    g.add(hub);
  }
  // Headlights (warm white) + taillights (red).
  const hlMat = new THREE.MeshBasicMaterial({ color: 0xfff8c0 });
  const tlMat = new THREE.MeshBasicMaterial({ color: 0xcc2222 });
  for (const x of [-wid / 2 + 0.35, wid / 2 - 0.35]) {
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), hlMat);
    hl.position.set(x, 0.75, len / 2 + 0.02);
    g.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.06), tlMat);
    tl.position.set(x, 0.75, -len / 2 - 0.02);
    g.add(tl);
  }
  g.userData.len = len;
  g.userData.wid = wid;
  g.userData.type = type;
  return g;
}
