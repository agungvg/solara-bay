// characters.js — builders for people and cars. Simple shapes, shared
// geometries and materials; each builder returns a Group with named parts.
import * as THREE from 'three';

const MAT = {};
function mat(name, color) {
  if (!MAT[name]) MAT[name] = new THREE.MeshLambertMaterial({ color });
  return MAT[name];
}
const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  head: new THREE.SphereGeometry(0.22, 10, 8),
  wheel: new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10),
  leg: new THREE.BoxGeometry(0.16, 0.5, 0.16),
  arm: new THREE.BoxGeometry(0.13, 0.5, 0.13),
};

const SKINS = [0xe8b98a, 0xc98d5f, 0x8a5a3b, 0xf0c8a0];
const SHIRTS = [0x3a7bd5, 0xd53a3a, 0x3aa655, 0xe8c832, 0x8a5ad5, 0xeeeeee, 0x222222];
const PANTS = [0x2c3e50, 0x4a4a4a, 0x5a3a2a, 0x1e2a4a];

// A person ~1.8 m tall. parts: {head, torso, armL, armR, legL, legR}
export function makePerson(opts = {}) {
  const g = new THREE.Group();
  const skin = mat('skin' + (opts.skin ?? 0), SKINS[(opts.skin ?? 0) % SKINS.length]);
  const shirt = mat('shirt' + (opts.shirt ?? 0), SHIRTS[(opts.shirt ?? 0) % SHIRTS.length]);
  const pants = mat('pants' + (opts.pants ?? 0), PANTS[(opts.pants ?? 0) % PANTS.length]);
  const hair = mat('hair', opts.hairColor ?? 0x2a1a10);

  const head = new THREE.Mesh(GEO.head, skin);
  head.position.y = 1.62; head.castShadow = true;
  const hairM = new THREE.Mesh(new THREE.SphereGeometry(0.23, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
  hairM.position.y = 1.66;
  const torso = new THREE.Mesh(GEO.box, shirt);
  torso.scale.set(0.55, 0.62, 0.3); torso.position.y = 1.12; torso.castShadow = true;
  const legL = new THREE.Mesh(GEO.leg, pants);
  legL.position.set(-0.14, 0.55, 0); legL.geometry = GEO.leg;
  const legR = new THREE.Mesh(GEO.leg, pants);
  legR.position.set(0.14, 0.55, 0);
  const armL = new THREE.Mesh(GEO.arm, shirt);
  armL.position.set(-0.36, 1.18, 0);
  const armR = new THREE.Mesh(GEO.arm, shirt);
  armR.position.set(0.36, 1.18, 0);
  g.add(head, hairM, torso, legL, legR, armL, armR);
  g.userData.parts = { head, torso, legL, legR, armL, armR };
  return g;
}

// Walk-cycle pose: t = phase, speed 0..1.
export function poseWalk(parts, t, speed) {
  const s = Math.sin(t) * 0.6 * speed;
  parts.legL.rotation.x = s;
  parts.legR.rotation.x = -s;
  parts.armL.rotation.x = -s * 0.8;
  parts.armR.rotation.x = s * 0.8;
}
export function posePunch(parts, t) {
  // t 0..1 through the punch: right arm extends forward.
  const ext = Math.sin(Math.min(t, 1) * Math.PI);
  parts.armR.rotation.x = -1.5 * ext;
  parts.armL.rotation.x = 0.4 * ext;
}

const CAR_COLORS = {
  sedan: [0xb03a2e, 0x2e5cb0, 0xd8d8d8, 0x3a3a3a, 0x2e8b57],
  sport: [0xe02060, 0xffd700, 0x18c8e8, 0xff5a1f],
  taxi: [0xf2c200],
  truck: [0x7a7a7a, 0x4a6fa5],
  van: [0xd8d8d8, 0x8a5ad5],
  police: [0x1a1a1a],
};

// A car ~4.4 m long. parts: {body, lightL, lightR, roof}
export function makeCar(type = 'sedan', colorIdx = 0) {
  const g = new THREE.Group();
  const palette = CAR_COLORS[type] || CAR_COLORS.sedan;
  const color = palette[colorIdx % palette.length];
  const bodyMat = mat('car' + type + color, color);
  const glassMat = mat('glass', 0x1a2a3a);
  const tireMat = mat('tire', 0x181818);
  const darkMat = mat('dark', 0x222222);

  const len = type === 'truck' ? 6.4 : type === 'van' ? 5.2 : 4.4;
  const wid = type === 'truck' ? 2.4 : 2.0;
  const bodyH = type === 'truck' ? 1.5 : 0.75;
  const body = new THREE.Mesh(GEO.box, bodyMat);
  body.scale.set(wid, bodyH, len);
  body.position.y = 0.55 + bodyH / 2 - 0.35;
  body.castShadow = true;
  g.add(body);

  const cabin = new THREE.Mesh(GEO.box, type === 'truck' ? bodyMat : glassMat);
  const cabLen = type === 'truck' ? 1.4 : len * 0.45;
  cabin.scale.set(wid * 0.85, 0.6, cabLen);
  cabin.position.set(0, body.position.y + bodyH / 2 + 0.28, type === 'truck' ? len / 2 - 1.0 : -0.2);
  cabin.castShadow = true;
  g.add(cabin);

  if (type === 'truck') {
    const bed = new THREE.Mesh(GEO.box, darkMat);
    bed.scale.set(wid * 0.9, 0.9, len * 0.55);
    bed.position.set(0, body.position.y + bodyH / 2 + 0.45, -len * 0.18);
    g.add(bed);
  }
  if (type === 'taxi') {
    const sign = new THREE.Mesh(GEO.box, mat('taxiSign', 0xffe600));
    sign.scale.set(0.7, 0.18, 0.4);
    sign.position.set(0, cabin.position.y + 0.4, -0.2);
    g.add(sign);
  }
  if (type === 'police') {
    const bar = new THREE.Mesh(GEO.box, mat('policeBar', 0xdddddd));
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
  // Wheels.
  const wheelPos = [
    [-wid / 2, len / 2 - 0.9], [wid / 2, len / 2 - 0.9],
    [-wid / 2, -len / 2 + 0.9], [wid / 2, -len / 2 + 0.9],
  ];
  for (const [x, z] of wheelPos) {
    const w = new THREE.Mesh(GEO.wheel, tireMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.36, z);
    g.add(w);
  }
  // Headlights.
  const hlMat = new THREE.MeshBasicMaterial({ color: 0xfff8c0 });
  for (const x of [-wid / 2 + 0.35, wid / 2 - 0.35]) {
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), hlMat);
    hl.position.set(x, 0.75, len / 2 + 0.02);
    g.add(hl);
  }
  g.userData.len = len;
  g.userData.wid = wid;
  g.userData.type = type;
  return g;
}
