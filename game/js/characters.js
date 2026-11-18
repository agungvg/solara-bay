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
  leg: new THREE.BoxGeometry(0.19, 0.5, 0.19),
  arm: new THREE.BoxGeometry(0.16, 0.5, 0.16),
  // Face (shared — every person reuses these, so 46 people cost ~no new geometry).
  // Sized to read at gameplay distance (5–8 m), not just in close-up:
  // eyes/brows/nose/smile are ~35% larger than a realistic scale, so a
  // face still resolves at 720p instead of collapsing into a blank ball.
  eyeWhite: new THREE.SphereGeometry(0.052, 8, 6),
  iris: new THREE.SphereGeometry(0.03, 8, 6),
  pupil: new THREE.SphereGeometry(0.015, 6, 5),
  eyeHi: new THREE.SphereGeometry(0.01, 6, 5),
  nose: new THREE.ConeGeometry(0.055, 0.14, 6),
  ear: new THREE.SphereGeometry(0.05, 6, 5),
  chin: new THREE.SphereGeometry(0.07, 8, 6),
  smile: new THREE.TorusGeometry(0.05, 0.009, 6, 12, Math.PI),
  hairCap: new THREE.SphereGeometry(0.235, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.45),
  bun: new THREE.SphereGeometry(0.09, 8, 6),
  collar: new THREE.TorusGeometry(0.17, 0.028, 6, 14),
  // Hands: palm + 3 articulated fingers + thumb (no mitten blobs).
  // Slightly oversized, like the face — hands must read at arm's length.
  palm: new THREE.BoxGeometry(0.13, 0.11, 0.05),
  finger: new THREE.BoxGeometry(0.034, 0.11, 0.034),
  thumb: new THREE.BoxGeometry(0.036, 0.08, 0.036),
  shoe: new THREE.BoxGeometry(0.17, 0.09, 0.3),
  sole: new THREE.BoxGeometry(0.18, 0.03, 0.32),
};

// Darker shade of a palette colour, cached (pockets, collars, seams, belts).
function shade(name, base, f) {
  if (!MAT[name]) {
    const c = new THREE.Color(base);
    c.offsetHSL(0, 0, f);
    MAT[name] = new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, metalness: 0 });
  }
  return MAT[name];
}
const IRIS = [0x4a2a12, 0x2a5a8a, 0x2a6a4a]; // brown / blue / green

const SKINS = [0xe8b98a, 0xc98d5f, 0x8a5a3b, 0xf0c8a0, 0x6b4226];
const SHIRTS = [0x3a7bd5, 0xd53a3a, 0x3aa655, 0xe8c832, 0x8a5ad5, 0xeeeeee, 0x222222,
  0xe87a2e, 0x2ec8b8, 0xd53a8a, 0x7a9a3a, 0x9a6a3a];
const PANTS = [0x2c3e50, 0x4a4a4a, 0x5a3a2a, 0x1e2a4a, 0x6a6a6a, 0x3a2a3a];
const HAIRS = [0x2a1a10, 0x111111, 0x6a4a2a, 0x8a8a8a, 0xc8a040, 0x5a2a1a];

// A person ~1.8 m tall (scaled by opts.scale). parts:
// {head, torso, armL, armR, legL, legR}
export function makePerson(opts = {}) {
  const g = new THREE.Group();
  const skinIdx = (opts.skin ?? 0) % SKINS.length;
  // Subtle per-person skin variation: same palette, two cached lightness
  // variants, so the street never reads as five cloned skin tones.
  const skinVar = ((opts.shirt ?? 0) + (opts.pants ?? 0)) % 2;
  const skinCol = new THREE.Color(SKINS[skinIdx]);
  if (skinVar) skinCol.offsetHSL(0, 0.01, 0.035);
  const skin = std('skin' + skinIdx + 'v' + skinVar, skinCol, 0.62, 0);
  const shirtCol = SHIRTS[(opts.shirt ?? 0) % SHIRTS.length];
  const shirt = std('shirt' + (opts.shirt ?? 0), shirtCol, 0.88, 0);
  const pantsCol = PANTS[(opts.pants ?? 0) % PANTS.length];
  const pants = std('pants' + (opts.pants ?? 0), pantsCol, 0.92, 0);
  const hair = std('hair' + (opts.hairColor ?? 0), opts.hairColor ?? HAIRS[(opts.skin ?? 0) % HAIRS.length], 0.85, 0);
  const irisMat = std('iris' + ((skinIdx + (opts.shirt ?? 0)) % IRIS.length), IRIS[(skinIdx + (opts.shirt ?? 0)) % IRIS.length], 0.3, 0);

  const head = new THREE.Mesh(GEO.head, skin);
  head.position.y = 1.62; head.castShadow = true;
  // Hair: sculpted variants with real volume (never a flat cap on the skull).
  // hairStyle: 0 crop / 1 side-sweep / 2 bun / 3 long; derived deterministically
  // from the outfit when not given, so the same opts always build the same head.
  const hairStyle = opts.hairStyle ?? ((skinIdx * 5 + (opts.shirt ?? 0) * 3 + (opts.pants ?? 0)) % 4);
  const hasHat = opts.hat === 'cap' || opts.hat === 'beanie';
  const hairM = new THREE.Mesh(GEO.hairCap, hair);
  hairM.position.y = 1.66;
  // Fringe strip across the forehead — frames the face under every style/hat.
  // Sits at the hairline (y 1.80), clear of the brows (1.735) and eye tops.
  const fringe = new THREE.Mesh(GEO.box, hair);
  fringe.scale.set(0.3, 0.05, 0.07);
  fringe.position.set(0, 1.8, 0.19);
  if (hairStyle === 1) { // side-sweep: cap shifted + a swept lock over one eye
    hairM.position.x = -0.02;
    const sweep = new THREE.Mesh(GEO.box, hair);
    sweep.scale.set(0.22, 0.05, 0.09);
    sweep.position.set(0.08, 1.8, 0.19);
    sweep.rotation.z = -0.3;
    g.add(sweep);
  } else if (hairStyle === 2) { // bun: cap + a knot high at the back
    const bun = new THREE.Mesh(GEO.bun, hair);
    bun.position.set(0, 1.88, -0.08);
    g.add(bun);
  } else if (hairStyle === 3) { // long: cap + back panel + side locks to the shoulders
    const back = new THREE.Mesh(GEO.box, hair);
    back.scale.set(0.4, 0.5, 0.08);
    back.position.set(0, 1.42, -0.2);
    const lockL = new THREE.Mesh(GEO.box, hair);
    lockL.scale.set(0.08, 0.35, 0.08);
    lockL.position.set(-0.2, 1.45, 0.05);
    const lockR = new THREE.Mesh(GEO.box, hair);
    lockR.scale.set(0.08, 0.35, 0.08);
    lockR.position.set(0.2, 1.45, 0.05);
    g.add(back, lockL, lockR);
  }
  if (!hasHat) g.add(hairM);
  g.add(fringe);
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
  g.add(head, torso, legL, legR, armL, armR);

  // ---- FACE (children of head, front = +z) --------------------------------
  // Real face, not a texture: white + iris + pupil + highlight per eye,
  // modelled nose, smile, ears, chin — reads clearly from 2–3 m at 720p.
  const eyeWhite = std('eyeWhite', 0xf8f8f0, 0.35, 0);
  const pupilMat = std('pupil', 0x0a0a0a, 0.25, 0);
  const hiMat = mat('eyeHi', new THREE.MeshBasicMaterial({ color: 0xbbbbbb })); // light-grey, not pure white: a pure-white dot blooms into a headlight
  const lipMat = std('lip', 0x9a4a42, 0.6, 0);
  for (const side of [-1, 1]) {
    const ew = new THREE.Mesh(GEO.eyeWhite, eyeWhite);
    ew.position.set(side * 0.08, 0.04, 0.19);
    ew.scale.set(1, 1.25, 0.45);
    const ir = new THREE.Mesh(GEO.iris, irisMat);
    ir.position.set(side * 0.08, 0.04, 0.225);
    ir.scale.set(1, 1.25, 0.4);
    const pu = new THREE.Mesh(GEO.pupil, pupilMat);
    pu.position.set(side * 0.08, 0.04, 0.245);
    pu.scale.set(1, 1.25, 0.4);
    const hi = new THREE.Mesh(GEO.eyeHi, hiMat);
    hi.position.set(side * 0.065, 0.055, 0.25);
    // Eyebrows: tapered look via a thin box, one arch a touch higher
    // (asymmetry = life; the skill's 1–3% rule).
    const brow = new THREE.Mesh(GEO.box, hair);
    brow.scale.set(0.12, 0.024, 0.02);
    brow.position.set(side * 0.085, 0.12 + (side < 0 ? 0.008 : 0), 0.195);
    brow.rotation.z = side < 0 ? -0.1 : 0.04;
    brow.rotation.x = -0.15;
    const ear = new THREE.Mesh(GEO.ear, skin);
    ear.position.set(side * 0.215, -0.01, 0);
    ear.scale.set(0.5, 1, 0.8);
    head.add(ew, ir, pu, hi, brow, ear);
  }
  const nose = new THREE.Mesh(GEO.nose, skin);
  nose.position.set(0, -0.02, 0.2);
  nose.rotation.x = Math.PI / 2; // cone tip points forward (+z)
  const chin = new THREE.Mesh(GEO.chin, skin);
  chin.position.set(0, -0.17, 0.06);
  chin.scale.set(1.1, 0.7, 0.9);
  const smile = new THREE.Mesh(GEO.smile, pupilMat);
  smile.position.set(0, -0.1, 0.2);
  smile.rotation.z = Math.PI; // lower arc = smile
  const lip = new THREE.Mesh(GEO.box, lipMat);
  lip.scale.set(0.12, 0.016, 0.015);
  lip.position.set(0, -0.135, 0.195);
  head.add(nose, chin, smile, lip);

  // ---- HANDS (children of the arms — pose rotations still drive them) -----
  // Palm + 3 separate fingers (middle longest) + an angled thumb per hand.
  function makeHand(isLeft) {
    const hand = new THREE.Group();
    hand.position.set(0, -0.28, 0);
    const palm = new THREE.Mesh(GEO.palm, skin);
    palm.position.y = -0.02;
    hand.add(palm);
    const fingerX = [-0.042, 0, 0.042];
    const fingerLen = [0.9, 1.15, 1.0];
    for (let i = 0; i < 3; i++) {
      const f = new THREE.Mesh(GEO.finger, skin);
      f.position.set(fingerX[i], -0.11, 0);
      f.scale.y = fingerLen[i];
      hand.add(f);
    }
    const thumb = new THREE.Mesh(GEO.thumb, skin);
    thumb.position.set(isLeft ? 0.085 : -0.085, -0.03, 0.01);
    thumb.rotation.z = isLeft ? -0.5 : 0.5;
    hand.add(thumb);
    return hand;
  }
  const handL = makeHand(true);
  const handR = makeHand(false);
  armL.add(handL);
  armR.add(handR);

  // ---- CLOTHING DETAIL (thin geometry, never textures) ---------------------
  const shirtDark = shade('shirtDark' + (opts.shirt ?? 0), shirtCol, -0.09);
  const pantsDark = shade('pantsDark' + (opts.pants ?? 0), pantsCol, -0.12);
  const collar = new THREE.Mesh(GEO.collar, shirtDark);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 1.44;
  const pocket = new THREE.Mesh(GEO.box, shirtDark);
  pocket.scale.set(0.13, 0.13, 0.02);
  pocket.position.set(-0.13, 1.18, 0.16);
  const pocketFlap = new THREE.Mesh(GEO.box, shirtDark);
  pocketFlap.scale.set(0.13, 0.04, 0.022);
  pocketFlap.position.set(-0.13, 1.25, 0.16);
  // Two vertical seam folds down the torso front.
  const seamL = new THREE.Mesh(GEO.box, shirtDark);
  seamL.scale.set(0.015, 0.5, 0.01);
  seamL.position.set(-0.18, 1.12, 0.155);
  const seamR = new THREE.Mesh(GEO.box, shirtDark);
  seamR.scale.set(0.015, 0.5, 0.01);
  seamR.position.set(0.18, 1.12, 0.155);
  // Belt + buckle at the waist.
  const belt = new THREE.Mesh(GEO.box, pantsDark);
  belt.scale.set(0.56, 0.07, 0.32);
  belt.position.y = 0.82;
  const buckle = new THREE.Mesh(GEO.box, std('buckle', 0xc8a040, 0.3, 0.8));
  buckle.scale.set(0.08, 0.05, 0.02);
  buckle.position.set(0, 0.82, 0.17);
  g.add(collar, pocket, pocketFlap, seamL, seamR, belt, buckle);
  // Shoes (children of the legs, so they swing with the walk cycle):
  // dark shoe + pale sole + lace bar.
  const shoeMat = std('shoe', 0x1e1e24, 0.7, 0.1);
  const soleMat = std('sole', 0xd8d8d8, 0.8, 0);
  for (const leg of [legL, legR]) {
    const shoe = new THREE.Mesh(GEO.shoe, shoeMat);
    shoe.position.set(0, -0.26, 0.06);
    const sole = new THREE.Mesh(GEO.sole, soleMat);
    sole.position.set(0, -0.31, 0.06);
    const lace = new THREE.Mesh(GEO.box, soleMat);
    lace.scale.set(0.1, 0.015, 0.05);
    lace.position.set(0, -0.21, 0.12);
    leg.add(shoe, sole, lace);
  }

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
    // Reflective stripes — the read that makes a worker a worker at distance.
    for (const y of [1.1, 1.3]) {
      const stripe = new THREE.Mesh(GEO.box, std('hivisStripe', 0xd8d8d8, 0.25, 0.6));
      stripe.scale.set(0.59, 0.05, 0.34);
      stripe.position.y = y;
      g.add(stripe);
    }
  }
  if (opts.apron) { // shopkeeper apron
    const apron = new THREE.Mesh(GEO.box, lam('apron', 0xf2f2f2));
    apron.scale.set(0.5, 0.55, 0.06);
    apron.position.set(0, 1.05, 0.17);
    g.add(apron);
    // Shoulder straps + a front pocket on the apron.
    for (const x of [-0.15, 0.15]) {
      const strap = new THREE.Mesh(GEO.box, lam('apron', 0xf2f2f2));
      strap.scale.set(0.05, 0.3, 0.02);
      strap.position.set(x, 1.38, 0.17);
      g.add(strap);
    }
    const apPocket = new THREE.Mesh(GEO.box, shade('apronDark', 0xf2f2f2, -0.12));
    apPocket.scale.set(0.2, 0.12, 0.02);
    apPocket.position.set(0, 0.95, 0.2);
    g.add(apPocket);
  }
  if (opts.backpack) {
    const pack = new THREE.Mesh(GEO.box, lam('pack' + (opts.shirt ?? 0), SHIRTS[(opts.shirt ?? 0) % SHIRTS.length]));
    pack.scale.set(0.36, 0.44, 0.18);
    pack.position.set(0, 1.2, -0.24);
    g.add(pack);
    // Shoulder straps over the chest.
    for (const x of [-0.16, 0.16]) {
      const strap = new THREE.Mesh(GEO.box, std('packStrap', 0x222222, 0.9, 0));
      strap.scale.set(0.06, 0.4, 0.02);
      strap.position.set(x, 1.2, 0.16);
      g.add(strap);
    }
  }
  if (opts.jacket) { // open jacket: darker torso overlay, wider shoulders
    const jk = new THREE.Mesh(GEO.box, lam('jacket', 0x2a2a34));
    jk.scale.set(0.6, 0.5, 0.34);
    jk.position.y = 1.2;
    g.add(jk);
    // Zipper line down the jacket front.
    const zip = new THREE.Mesh(GEO.box, std('zipper', 0x888888, 0.3, 0.8));
    zip.scale.set(0.02, 0.45, 0.01);
    zip.position.set(0, 1.18, 0.175);
    g.add(zip);
  }
  const scale = opts.scale ?? 1;
  g.scale.setScalar(scale);
  g.userData.parts = { head, torso, legL, legR, armL, armR };
  g.userData.hands = { handL, handR }; // extra detail; parts contract unchanged
  g.userData.baseScale = scale;
  return g;
}

// Walk-cycle pose: t = phase, speed 0..1. Now with torso twist, arm swing,
// head bob and a head that tracks the walk (looks where it is going).
export function poseWalk(parts, t, speed) {
  const s = Math.sin(t) * 0.6 * speed;
  const c = Math.abs(Math.cos(t));
  parts.legL.rotation.x = s;
  parts.legR.rotation.x = -s;
  parts.armL.rotation.x = -s * 0.8;
  parts.armR.rotation.x = s * 0.8;
  parts.armL.rotation.z = 0.06 + Math.sin(t) * 0.04 * speed;
  parts.armR.rotation.z = -0.06 - Math.sin(t) * 0.04 * speed;
  parts.torso.rotation.y = Math.sin(t) * 0.1 * speed;
  parts.torso.rotation.x = 0.04 * speed;
  parts.torso.rotation.z = 0;
  parts.torso.position.y = 1.12 + c * 0.035 * speed;
  parts.head.position.y = 1.62 + c * 0.04 * speed;
  parts.head.rotation.y = Math.sin(t * 0.5) * 0.12; // head tracks the walk
  parts.head.rotation.x = 0;
  parts.head.rotation.z = 0.02;
}
export function posePunch(parts, t) {
  // t 0..1 through the punch: right arm extends forward.
  const ext = Math.sin(Math.min(t, 1) * Math.PI);
  parts.armR.rotation.x = -1.5 * ext;
  parts.armL.rotation.x = 0.4 * ext;
  parts.torso.rotation.y = -0.35 * ext; // twist into the punch
  parts.torso.rotation.x = 0;
  parts.torso.rotation.z = 0;
  parts.torso.position.y = 1.12;
  parts.head.position.y = 1.62;
  parts.head.rotation.y = -0.25 * ext; // eyes follow the fist
  parts.head.rotation.x = 0.05 * ext;
  parts.head.rotation.z = 0;
}
// Idle: gentle breathing, arms at sides.
export function poseIdle(parts, t) {
  const b = Math.sin(t * 1.4) * 0.04;
  parts.torso.position.y = 1.12 + b;
  parts.torso.rotation.y = 0;
  parts.torso.rotation.x = 0;
  parts.torso.rotation.z = Math.sin(t * 0.7) * 0.02; // gentle sway
  parts.legL.rotation.x = 0;
  parts.legR.rotation.x = 0;
  parts.armL.rotation.x = Math.sin(t * 0.9) * 0.06;
  parts.armR.rotation.x = -Math.sin(t * 0.9) * 0.06;
  parts.armL.rotation.z = 0.06;
  parts.armR.rotation.z = -0.06;
  // Breathing lifts the head a touch; slow look-around, slight tilt.
  parts.head.position.y = 1.62 + b * 0.5;
  parts.head.rotation.y = Math.sin(t * 0.35) * 0.4;
  parts.head.rotation.x = 0;
  parts.head.rotation.z = 0.04;
}
// Panic: both arms thrown up. Head darts side to side (time-based: this
// pose takes no t, so it reads the wall clock — all panicking peds share
// the beat, which reads as a crowd reacting at once).
export function posePanic(parts) {
  const now = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
  parts.armL.rotation.z = 2.4;
  parts.armR.rotation.z = -2.4;
  parts.armL.rotation.x = 0;
  parts.armR.rotation.x = 0;
  parts.legL.rotation.x = 0.4;
  parts.legR.rotation.x = -0.4;
  parts.torso.position.y = 1.12;
  parts.torso.rotation.y = 0;
  parts.torso.rotation.x = -0.06;
  parts.torso.rotation.z = 0;
  parts.head.position.y = 1.62;
  parts.head.rotation.y = Math.sin(now * 2.2) * 0.55;
  parts.head.rotation.x = -0.15;
  parts.head.rotation.z = Math.sin(now * 3.1) * 0.08;
}
// Talking: both arms gesture (alternating), head nods and tracks the partner.
export function poseTalk(parts, t) {
  const g = Math.sin(t * 2.2) * 0.5;
  const g2 = Math.sin(t * 2.2 + 1.2) * 0.5;
  parts.armR.rotation.x = -0.9 + g * 0.4;
  parts.armR.rotation.z = -0.3;
  parts.armL.rotation.x = -0.5 + g2 * 0.35;
  parts.armL.rotation.z = 0.35;
  parts.legL.rotation.x = 0;
  parts.legR.rotation.x = 0;
  parts.torso.position.y = 1.12;
  parts.torso.rotation.x = 0.06; // leaning into the conversation
  parts.torso.rotation.y = 0.08;
  parts.torso.rotation.z = 0;
  parts.head.position.y = 1.62;
  parts.head.rotation.x = Math.sin(t * 2.2) * 0.07; // nodding
  parts.head.rotation.y = Math.sin(t * 0.9) * 0.25;
  parts.head.rotation.z = 0.05;
}
// Sitting: legs forward, torso upright (on a bench / plaza edge).
export function poseSit(parts) {
  parts.legL.rotation.x = -1.45;
  parts.legR.rotation.x = -1.45;
  parts.armL.rotation.x = -0.5;
  parts.armR.rotation.x = -0.5;
  parts.armL.rotation.z = 0.1;
  parts.armR.rotation.z = -0.1;
  parts.torso.position.y = 1.12;
  parts.torso.rotation.y = 0;
  parts.torso.rotation.x = -0.06; // leaning back on the seat
  parts.torso.rotation.z = 0;
  parts.head.position.y = 1.62;
  parts.head.rotation.y = 0.18; // watching the street
  parts.head.rotation.x = 0;
  parts.head.rotation.z = 0.03;
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
