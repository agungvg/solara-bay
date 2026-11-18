// city.js — builds Solara Bay: ground texture, buildings, palms, lamps,
// parks, beach, ocean and the named places. Returns colliders + named sites.
import * as THREE from 'three';
import { CITY, NAMED, mulberry32 } from './utils.js';

function makeGroundTexture(rng) {
  const S = 2048;
  const cv = document.createElement('canvas');
  cv.width = S; cv.height = S;
  const g = cv.getContext('2d');
  // The ground plane is 580x580 centred at (0, 15), so world x in [-290, 290]
  // and world z in [-275, 305] map onto the canvas; x and z need different
  // offsets (the plane's local +Y, the canvas top, is world -Z).
  const px = (v) => ((v + 290) / 580) * S;
  const pz = (v) => ((v + 275) / 580) * S;
  // Base: sidewalk / block colour.
  g.fillStyle = '#b8b0a4'; g.fillRect(0, 0, S, S);
  // Grass parks are drawn as blocks later; base block tint variation.
  const blockCentres = [];
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
    blockCentres.push([CITY.roads[i] + 29, CITY.roads[j] + 29]);
  }
  for (const [bx, bz] of blockCentres) {
    const shade = 172 + Math.floor(rng() * 18);
    g.fillStyle = `rgb(${shade},${shade + 2},${shade + 8})`;
    g.fillRect(px(bx - 22), pz(bz - 22), px(44) - px(0), pz(44) - pz(0));
    // Sidewalk tile seams.
    g.strokeStyle = 'rgba(0,0,0,0.10)';
    g.lineWidth = 1;
    for (let k = -22; k <= 22; k += 11) {
      g.beginPath(); g.moveTo(px(bx + k), pz(bz - 22)); g.lineTo(px(bx + k), pz(bz + 22)); g.stroke();
      g.beginPath(); g.moveTo(px(bx - 22), pz(bz + k)); g.lineTo(px(bx + 22), pz(bz + k)); g.stroke();
    }
  }
  // Sand strip (south edge) and a wet-sand band.
  g.fillStyle = '#e8d39a';
  g.fillRect(0, pz(CITY.beachZ), S, S - pz(CITY.beachZ));
  g.fillStyle = '#dcc27e';
  g.fillRect(0, pz(CITY.beachZ), S, pz(12) - pz(0));
  // Roads: asphalt bands.
  g.fillStyle = '#3a3d42';
  for (const r of CITY.roads) {
    g.fillRect(0, pz(r - 7), S, pz(14) - pz(0));
    g.fillRect(px(r - 7), 0, px(14) - px(0), S);
  }
  // Yellow centre dashes (short, so they read as dashes up close).
  g.fillStyle = '#e8c832';
  for (const r of CITY.roads) {
    for (let v = -280; v < 280; v += 12) {
      g.fillRect(px(v), pz(r - 0.3), px(4) - px(0), pz(0.6) - pz(0));
      g.fillRect(px(r - 0.3), pz(v), px(0.6) - px(0), pz(4) - pz(0));
    }
  }
  // White crosswalks at every intersection.
  g.fillStyle = '#e8e8e2';
  for (const rx of CITY.roads) for (const rz of CITY.roads) {
    for (let k = -3; k <= 3; k++) {
      g.fillRect(px(rx + k * 2 - 0.6), pz(rz - 9.5), px(1.2) - px(0), pz(2.2) - pz(0));
      g.fillRect(px(rx + k * 2 - 0.6), pz(rz + 7.3), px(1.2) - px(0), pz(2.2) - pz(0));
      g.fillRect(px(rx - 9.5), pz(rz + k * 2 - 0.6), px(2.2) - px(0), pz(1.2) - pz(0));
      g.fillRect(px(rx + 7.3), pz(rz + k * 2 - 0.6), px(2.2) - px(0), pz(1.2) - pz(0));
    }
  }
  // Plaza paving.
  g.fillStyle = '#c9b48a';
  g.fillRect(px(-24), pz(-24), px(48) - px(0), pz(48) - pz(0));
  g.strokeStyle = '#a98f5f'; g.lineWidth = 3;
  g.beginPath(); g.arc(px(0), pz(0), px(16) - px(0), 0, Math.PI * 2); g.stroke();
  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeFacadeTexture(rng, variant) {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 256;
  const g = cv.getContext('2d');
  const palettes = [
    ['#d8c9a8', '#2e3d55', '#f2d98c'],
    ['#b8c4cc', '#24344a', '#ffe9a8'],
    ['#c9a58e', '#31404f', '#ffe9a8'],
    ['#a8b8a0', '#2a3542', '#fff2c0'], // sage green block
    ['#d8a8a0', '#3a2e3e', '#ffe9a8'], // terracotta block
  ];
  const [base, win, lit] = palettes[variant % palettes.length];
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  // Per-facade value jitter: no two buildings share the exact tone.
  const jit = 0.9 + rng() * 0.2;
  g.fillStyle = `rgba(${jit > 1 ? '255,255,255' : '0,0,0'},${Math.abs(jit - 1) * 0.5})`;
  g.fillRect(0, 0, 256, 256);
  // Subtle vertical shading.
  const grad = g.createLinearGradient(0, 0, 256, 0);
  grad.addColorStop(0, 'rgba(0,0,0,0.18)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.06)');
  grad.addColorStop(1, 'rgba(0,0,0,0.18)');
  g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
  // Window grid.
  for (let y = 14; y < 240; y += 30) {
    for (let x = 14; x < 240; x += 30) {
      const on = rng() < 0.28;
      g.fillStyle = on ? lit : win;
      g.fillRect(x, y, 18, 20);
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.fillRect(x, y, 18, 3);
    }
  }
  // Ground floor shopfront band.
  g.fillStyle = 'rgba(40,40,50,0.85)';
  g.fillRect(0, 226, 256, 30);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCity(scene, seed) {
  const rng = mulberry32(seed);
  const colliders = [];
  const group = new THREE.Group();
  group.name = 'city';

  // Ground plane (covers city + beach).
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(580, 580),
    new THREE.MeshLambertMaterial({ map: makeGroundTexture(rng) }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 15);
  ground.receiveShadow = true;
  group.add(ground);

  // Ocean beyond the beach.
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 220),
    new THREE.MeshLambertMaterial({ color: 0x1e7fa8 }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, -0.4, CITY.oceanZ + 110);
  group.add(ocean);
  const ocean2 = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 6),
    new THREE.MeshLambertMaterial({ color: 0x9fd8e8 }),
  );
  ocean2.rotation.x = -Math.PI / 2;
  ocean2.position.set(0, -0.2, CITY.oceanZ + 2);
  group.add(ocean2);

  // Facade materials (5 variants, shared).
  const facades = [0, 1, 2, 3, 4].map((v) => new THREE.MeshStandardMaterial({
    map: makeFacadeTexture(rng, v), roughness: 0.9, metalness: 0.0,
  }));
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x6b6258, roughness: 0.95 });
  const grassMat = new THREE.MeshLambertMaterial({ color: 0x5da24a });
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a38 });
  const palmMat = new THREE.MeshLambertMaterial({ color: 0x3f9e4d });
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x2c2f36 });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });

  // Canvas-texture shop sign: original names only, no Rockstar material.
  function makeSignTexture(text, bg, fg) {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 128;
    const g = cv.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, 512, 128);
    g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(6, 6, 500, 116);
    g.fillStyle = fg;
    g.font = 'bold 56px sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 256, 66);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
  function addSign(text, bg, fg, x, y, z, w, rotY = 0) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, w / 4),
      new THREE.MeshBasicMaterial({ map: makeSignTexture(text, bg, fg) }),
    );
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    group.add(m);
  }

  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  function addBuilding(x, z, w, d, h, mat) {
    const m = new THREE.Mesh(boxGeo, mat);
    m.scale.set(w, h, d);
    m.position.set(x, h / 2, z);
    m.castShadow = true; m.receiveShadow = true;
    group.add(m);
    const roof = new THREE.Mesh(boxGeo, roofMat);
    roof.scale.set(w, +0.6, d + 0.6);
    roof.position.set(x, h + 0.25, z);
    group.add(roof);
    // Rooftop clutter: AC boxes, water tanks, antennas — buildings read
    // as used, not extruded.
    if (h > 12 && rng() < 0.7) {
      const ac = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x9a9a92 }));
      ac.scale.set(2.2, 1.0, 1.6);
      ac.position.set(x + (rng() - 0.5) * (w - 3), h + 1.0, z + (rng() - 0.5) * (d - 3));
      group.add(ac);
    }
    if (h > 20 && rng() < 0.45) {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 2.6, 10),
        new THREE.MeshLambertMaterial({ color: 0x8a6a4a }));
      tank.position.set(x + (rng() - 0.5) * (w - 4), h + 1.8, z + (rng() - 0.5) * (d - 4));
      group.add(tank);
    }
    if (rng() < 0.3) {
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 4, 5), lampMat);
      ant.position.set(x + (rng() - 0.5) * (w - 2), h + 2.5, z + (rng() - 0.5) * (d - 2));
      group.add(ant);
    }
    colliders.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, h });
    return m;
  }

  // Named-site blocks (plaza stays open).
  const parkBlocks = [[-116, 58], [116, -58], [58, 174]];
  const parkSet = new Set(parkBlocks.map(([a, b]) => a + ',' + b));
  const namedBlocks = {
    police: [-232, -174], hospital: [174, -232], garage: [174, 116],
  };
  const namedSet = new Set(Object.values(namedBlocks).map(([a, b]) => a + ',' + b));

  // Generic blocks: 1-4 buildings, taller near the centre.
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const bx = CITY.roads[i] + 29, bz = CITY.roads[j] + 29;
      const key = CITY.roads[i] + ',' + CITY.roads[j];
      if (bx === 0 && bz === 0) continue; // plaza
      if (parkSet.has(key) || namedSet.has(key)) continue;
      const centreDist = Math.hypot(bx, bz) / 330;
      const maxH = 55 - centreDist * 40;
      const count = 1 + Math.floor(rng() * 4);
      for (let k = 0; k < count; k++) {
        const w = 10 + rng() * 12, d = 10 + rng() * 12;
        const x = bx + (rng() - 0.5) * (40 - w);
        const z = bz + (rng() - 0.5) * (40 - d);
        const h = 7 + rng() * rng() * (maxH - 7);
        addBuilding(x, z, w, d, h, facades[Math.floor(rng() * 5)]);
      }
    }
  }

  // Named buildings (distinct colours, low and wide) + their signs.
  const policeMat = new THREE.MeshStandardMaterial({ color: 0x4a6fa5, roughness: 0.85 });
  const hospMat = new THREE.MeshStandardMaterial({ color: 0xe8e4da, roughness: 0.85 });
  const garageMat = new THREE.MeshStandardMaterial({ color: 0xc96a3a, roughness: 0.85 });
  addBuilding(NAMED.police.x, NAMED.police.z, 30, 18, 12, policeMat);
  addBuilding(NAMED.hospital.x, NAMED.hospital.z, 32, 20, 16, hospMat);
  addBuilding(NAMED.garage.x, NAMED.garage.z, 26, 16, 9, garageMat);
  addSign('BAY POLICE HQ', '#1a2a5a', '#ffffff', NAMED.police.x, 9.5, NAMED.police.z + 9.3, 18);
  addSign('SOLARA GENERAL', '#e8e4da', '#2a6a4a', NAMED.hospital.x, 12.5, NAMED.hospital.z + 10.3, 20);
  addSign("SAL'S GARAGE", '#c96a3a', '#ffffff', NAMED.garage.x, 7.2, NAMED.garage.z + 8.3, 16);
  addSign('PIER 9', '#2a4a5a', '#ffd700', NAMED.docks.x, 6, NAMED.docks.z - 6, 10);
  // Docks: wooden pier + crates.
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6b45 });
  const pier = new THREE.Mesh(boxGeo, pierMat);
  pier.scale.set(60, 1, 14); pier.position.set(NAMED.docks.x, 0.5, NAMED.docks.z + 8);
  group.add(pier);
  const crateMat = new THREE.MeshLambertMaterial({ color: 0xa8873a });
  for (let k = 0; k < 6; k++) {
    const c = new THREE.Mesh(boxGeo, crateMat);
    const s = 3 + rng() * 2;
    c.scale.set(s, s, s);
    // Keep crates at the pier edges so the docks shootout stays open.
    const side = k % 2 === 0 ? -1 : 1;
    c.position.set(NAMED.docks.x + side * (16 + rng() * 10), s / 2, NAMED.docks.z + 2 + rng() * 8);
    c.castShadow = true;
    group.add(c);
    colliders.push({ x0: c.position.x - s / 2, x1: c.position.x + s / 2, z0: c.position.z - s / 2, z1: c.position.z + s / 2, h: s });
  }
  // Beach bar hut + umbrellas.
  addBuilding(NAMED.beachBar.x, NAMED.beachBar.z, 12, 8, 5, new THREE.MeshLambertMaterial({ color: 0xe8b04a }));
  const umbMat = new THREE.MeshLambertMaterial({ color: 0xe85d5d });
  const umbGeo = new THREE.ConeGeometry(3, 1.6, 8);
  for (let k = 0; k < 5; k++) {
    const u = new THREE.Mesh(umbGeo, umbMat);
    u.position.set(-190 + k * 26 + rng() * 8, 2.6, 252 + rng() * 14);
    group.add(u);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.6, 6), trunkMat);
    pole.position.set(u.position.x, 1.3, u.position.z);
    group.add(pole);
  }
  // Plaza fountain.
  const fount = new THREE.Mesh(new THREE.CylinderGeometry(6, 7, 1.2, 16),
    new THREE.MeshLambertMaterial({ color: 0x9fb4c0 }));
  fount.position.set(0, 0.6, 0);
  group.add(fount);
  colliders.push({ x0: -7, x1: 7, z0: -7, z1: 7, h: 1.2 });

  // Parks: grass slab + trees.
  const treePositions = [];
  for (const [bx, bz] of parkBlocks) {
    const grass = new THREE.Mesh(boxGeo, grassMat);
    grass.scale.set(44, 0.4, 44);
    grass.position.set(bx, 0.2, bz);
    group.add(grass);
    for (let k = 0; k < 7; k++) {
      treePositions.push([bx + (rng() - 0.5) * 36, bz + (rng() - 0.5) * 36]);
    }
  }

  // Palm trees: along roads + in parks + beach.
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 5.5, 6);
  const crownGeo = new THREE.ConeGeometry(2.6, 2.2, 7);
  const palmSpots = [];
  for (const r of CITY.roads) {
    for (let v = -203; v <= 203; v += 58) {
      palmSpots.push([r + 10.5, v + 10.5]);
      if (rng() < 0.5) palmSpots.push([r - 10.5, v - 10.5]);
    }
  }
  for (const [x, z] of treePositions) palmSpots.push([x, z]);
  for (let k = 0; k < 8; k++) palmSpots.push([-220 + k * 60 + rng() * 10, 248 + rng() * 10]);
  for (const [x, z] of palmSpots) {
    if (z > CITY.beachZ + 30) continue;
    const t = new THREE.Mesh(trunkGeo, trunkMat);
    t.position.set(x, 2.75, z);
    t.castShadow = true;
    group.add(t);
    const c = new THREE.Mesh(crownGeo, palmMat);
    c.position.set(x, 6.4, z);
    group.add(c);
    colliders.push({ x0: x - 0.5, x1: x + 0.5, z0: z - 0.5, z1: z + 0.5, h: 5 });
  }

  // Street lamps along roads (solid: they also block the camera).
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 6, 6);
  const bulbGeo = new THREE.SphereGeometry(0.35, 8, 6);
  for (const r of CITY.roads) {
    for (let v = -174; v <= 174; v += 58) {
      // Sidewalk corner (10.5 m off both centrelines) — off the road.
      const lx = r - 10.5, lz = v + 10.5;
      const p = new THREE.Mesh(poleGeo, lampMat);
      p.position.set(lx, 3, lz);
      group.add(p);
      const b = new THREE.Mesh(bulbGeo, bulbMat);
      b.position.set(lx, 6.1, lz);
      group.add(b);
      colliders.push({ x0: lx - 0.5, x1: lx + 0.5, z0: lz - 0.5, z1: lz + 0.5, h: 6 });
    }
  }

  // Street props: hydrants, bins, benches, bus stops — the small things
  // that make a street read as a street in a screenshot.
  const hydrantMat = new THREE.MeshLambertMaterial({ color: 0xd53a3a });
  const binMat = new THREE.MeshLambertMaterial({ color: 0x2e5d3a });
  const benchMat = new THREE.MeshLambertMaterial({ color: 0x6a4a2a });
  const hydGeo = new THREE.CylinderGeometry(0.28, 0.34, 0.9, 8);
  const binGeo = new THREE.CylinderGeometry(0.4, 0.36, 0.9, 8);
  for (let k = 0; k < 26; k++) {
    const road = CITY.roads[Math.floor(rng() * CITY.roads.length)];
    const along = -220 + rng() * 440;
    const hx = rng() < 0.5 ? road + 10.5 : along;
    const hz = rng() < 0.5 ? along : road + 10.5;
    if (rng() < 0.5) {
      const h = new THREE.Mesh(hydGeo, hydrantMat);
      h.position.set(hx, 0.45, hz);
      group.add(h);
    } else {
      const b = new THREE.Mesh(binGeo, binMat);
      b.position.set(hx, 0.45, hz);
      group.add(b);
    }
  }
  // Benches around the plaza and parks.
  for (const [bx, bz] of [[10, 10], [-12, -6], [6, -14], [-116, 50], [116, -50], [58, 166]]) {
    const bench = new THREE.Mesh(boxGeo, benchMat);
    bench.scale.set(2.4, 0.18, 0.7);
    bench.position.set(bx, 0.5, bz);
    group.add(bench);
    for (const lx of [-1, 1]) {
      const leg = new THREE.Mesh(boxGeo, lampMat);
      leg.scale.set(0.12, 0.5, 0.6);
      leg.position.set(bx + lx, 0.25, bz);
      group.add(leg);
    }
  }
  // Food stalls: counter + striped awning, at the plaza and the beach bar.
  // (Shopkeeper NPCs stand behind these — see traffic.js.)
  function addStall(x, z, awningColor, signText) {
    const counter = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x8a6a45 }));
    counter.scale.set(4, 1.1, 1.6);
    counter.position.set(x, 0.55, z);
    counter.castShadow = true;
    group.add(counter);
    const awning = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: awningColor }));
    awning.scale.set(4.6, 0.25, 2.4);
    awning.position.set(x, 2.6, z);
    awning.rotation.x = 0.18;
    group.add(awning);
    for (const [px, pz] of [[-2.1, -1], [2.1, -1], [-2.1, 1], [2.1, 1]]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 5), lampMat);
      pole.position.set(x + px, 1.3, z + pz);
      group.add(pole);
    }
    addSign(signText, '#222222', '#ffd700', x, 3.4, z + 0.2, 6);
    colliders.push({ x0: x - 2, x1: x + 2, z0: z - 0.8, z1: z + 0.8, h: 1.1 });
  }
  addStall(14, 10, 0xd53a3a, 'TACOS');
  addStall(-145, 256, 0x2e8bb0, 'TIDE BAR');
  addStall(12, 262, 0x3aa655, 'FISH');
  // Traffic lights at the four central intersections.
  const tlPoleMat = new THREE.MeshLambertMaterial({ color: 0x1e1e1e });
  for (const [ix, iz] of [[0, 0], [58, 58], [-58, -58], [116, -58]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 5.5, 6), tlPoleMat);
    pole.position.set(ix + 9.5, 2.75, iz + 9.5);
    group.add(pole);
    const head = new THREE.Mesh(boxGeo, tlPoleMat);
    head.scale.set(0.5, 1.2, 0.4);
    head.position.set(ix + 9.5, 5.4, iz + 9.5);
    group.add(head);
    const lampOn = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6),
      new THREE.MeshBasicMaterial({ color: rng() < 0.5 ? 0x2ecc40 : 0xcc2222 }));
    lampOn.position.set(ix + 9.5, 5.7, iz + 9.5 + 0.22);
    group.add(lampOn);
  }
  // Billboards over two downtown blocks.
  function addBillboard(x, z, text, bg, fg, rotY) {
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 5),
      new THREE.MeshBasicMaterial({ map: makeSignTexture(text, bg, fg) }),
    );
    board.position.set(x, 14, z);
    board.rotation.y = rotY;
    group.add(board);
    for (const lx of [-6, 6]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 11.5, 5), tlPoleMat);
      leg.position.set(x + lx, 5.75, z);
      group.add(leg);
    }
  }
  addBillboard(-58, 10.8, 'SOLARA SUNSET DRIVE', '#e87a2e', '#ffffff', 0);
  addBillboard(116, -10.8, 'VISIT THE BAY', '#2e8bb0', '#ffffff', Math.PI);
  // Shipping containers at the docks (stacked two high, same footprint).
  const contCols = [0xb03a2e, 0x2e5cb0, 0x3aa655, 0xe8c832];
  for (let k = 0; k < 8; k++) {
    const c = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: contCols[k % 4] }));
    const w = 6, d = 2.6, h = 2.6;
    const cx = -40 + (k % 4) * 14, cz = 282;
    const stacked = k >= 4;
    c.scale.set(w, h, d);
    c.position.set(cx, h / 2 + (stacked ? h : 0), cz);
    c.castShadow = true;
    group.add(c);
    if (!stacked) {
      colliders.push({ x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2, h: h * 2 });
    }
  }

  scene.add(group);
  return { colliders, group };
}
