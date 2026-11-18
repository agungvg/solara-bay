// traffic.js — AI road traffic, LIVING pedestrians, parked cars, pickups
// and car damage (smoke then explosion). Traffic follows the road grid.
//
// NPC LIFE: pedestrians are not background props. Each one has an
// archetype (walker, jogger, tourist, worker, shopkeeper, talker, sitter),
// a daily routine (walk to a destination -> wait / work / chat / sit ->
// next destination, crossing at intersections), and reactions: they flee
// gunfire and speeding cars, panic and call the police when they witness
// a crime, and complain when the player bumps into them. Drivers honk
// and brake when the player blocks the road. Barks surface through G.bark.
import * as THREE from 'three';
import { CITY, NAMED, clamp, collideCircle, mulberry32, dist2, nearestRoad, onRoad } from './utils.js';
import { makeCar, makePerson, poseWalk, poseIdle, posePanic, poseTalk, poseSit } from './characters.js';

const TRAFFIC_TYPES = ['sedan', 'sedan', 'sedan', 'sport', 'taxi', 'truck', 'van', 'pickup', 'convertible'];

export function makeCarEntity(scene, type, colorIdx, x, z, heading) {
  const mesh = makeCar(type, colorIdx);
  scene.add(mesh);
  const car = {
    mesh, type, x, z, heading, speed: 0,
    topSpeed: type === 'sport' ? 34 : type === 'convertible' ? 33 : type === 'truck' ? 20 : 27,
    health: 100, driver: 'ai', // 'ai' | 'player' | null (parked) | 'none'
    smoke: null, dead: false, explodeTimer: 0,
    honkCooldown: 0,
    // traffic AI state
    axis: 'x', dir: 1, target: 0, wait: 0,
  };
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  return car;
}

export function createTraffic(scene, rng, colliders) {
  const cars = [];
  // Parked cars: by the garage, the plaza and the beach (in view of the start).
  const parked = [
    [185, 182, 0.15, 'sedan'],
    [203, 184, -0.1, 'sedan'],
    [221, 182, 0.3, 'convertible'],
    [-24, 30, 1.6, 'pickup'],
    [24, -30, -1.5, 'sedan'],
    [-160, 240, 0.2, 'sedan'],
  ];
  for (const [x, z, h, type] of parked) {
    const c = makeCarEntity(scene, type, Math.floor(rng() * 5), x, z, h);
    c.driver = null;
    cars.push(c);
  }
  // Distinctive magenta sports car at the docks (mission 2 target).
  const magenta = makeCarEntity(scene, 'sport', 0, NAMED_DOCKS.x + 14, NAMED_DOCKS.z - 4, Math.PI / 2);
  magenta.driver = null;
  magenta.missionCar = true;
  cars.push(magenta);
  // Moving traffic on the grid.
  for (let i = 0; i < 26; i++) {
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

// Traffic update: follow grid, random turns at intersections, slow for the
// car ahead — and react to the player: honk + brake when blocked.
export function updateTraffic(G, dt) {
  const rng = G.rng;
  const p = G.player;
  const pCar = p.mode === 'car' && p.car ? p.car : null;
  for (const car of G.traffic) {
    if (car.dead || car.driver === 'player' || car.driver === null) continue;
    if (car.honkCooldown > 0) car.honkCooldown -= dt;
    // Car ahead check.
    let ahead = null, aheadD = 1e9;
    for (const other of G.traffic) {
      if (other === car || other.dead) continue;
      const d = dist2(car.x, car.z, other.x, other.z);
      if (d < aheadD) { aheadD = d; ahead = other; }
    }
    if (pCar) {
      const d = dist2(car.x, car.z, pCar.x, pCar.z);
      if (d < aheadD) { aheadD = d; ahead = pCar; }
    }
    let want = car.topSpeed * 0.45;
    if (ahead && aheadD < 14) want = Math.max(0, (aheadD - 7) * 0.8);
    // The player blocking the road ahead: brake and honk.
    if (pCar && ahead === pCar && aheadD < 11 && Math.abs(pCar.speed) < 4) {
      want = 0;
      if (car.honkCooldown <= 0) {
        car.honkCooldown = 4;
        G.audio.honk();
        if (G.rng() < 0.5) sayBark(G, null, 'Driver', 'Move it! Out of the road!');
      }
    }
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
        ped.dead = true; ped.mesh.visible = false; if (ped.marker) ped.marker.visible = false;
        G.events.push({ type: 'pedDown', x: ped.x, z: ped.z, byTraffic: true });
      }
    }
  }
  // Player car vs pedestrians (crime).
  if (pCar && Math.abs(pCar.speed) > 4) {
    for (const ped of G.peds) {
      if (ped.dead) continue;
      if (dist2(pCar.x, pCar.z, ped.x, ped.z) < 2.0) {
        ped.dead = true; ped.mesh.visible = false; if (ped.marker) ped.marker.visible = false;
        G.events.push({ type: 'pedDown', x: ped.x, z: ped.z });
      }
    }
  }
}

// --- Pedestrian life ---------------------------------------------------------
const NAMES = ['Rosa', 'Dante', 'Mira', 'Kiko', 'Ana', 'Ben', 'Luz', 'Tomas',
  'Ivy', 'Marco', 'Nia', 'Omar', 'Pia', 'Rex', 'Sofia', 'Leo', 'June', 'Hana',
  'Felix', 'Cora', 'Dario', 'Elena', 'Sam', 'Tara'];
const BARKS = {
  panic: ['AAAH!', 'Somebody help!', 'Run!', 'What was that?!', 'Get down!'],
  witness: ["I'm calling the cops!", 'Did you see that?!', 'Police! Over here!'],
  bump: ['Hey! Watch it!', 'Sorry, sorry!', 'Eyes up, pal!', 'Ouch!'],
  walker: ["Beautiful day in the Bay.", "Gotta get to work.", 'The Vipers are bad news.',
    "Sal's garage does good work.", 'Did you hear about the race?'],
  tourist: ['This place is beautiful!', "Where's the beach?", 'Take my picture!',
    'Best sunset in the state!'],
  jogger: ['Morning run, same as always.', 'Out of my way!', 'Five more laps!'],
  worker: ['Another long shift.', "This pier won't fix itself.", 'Break time in ten.'],
  shopkeeper: ['Fresh fish, get your fish!', 'Cold drinks here!',
    'Best tacos in Solara Bay!', 'Souvenirs! Take a look!'],
  talker: ['You hear what happened at the docks?', "Mara's back in town, they say.",
    'The cops are everywhere tonight.', "I heard Sal's hiring drivers."],
  sitter: ['Nice spot, huh?', 'Just watching the world go by.'],
  driver: ['Move it!', 'Learn to drive!', 'My insurance!'],
};
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

// Show a bark line in the HUD (name + text, a few seconds). Ped barks are
// throttled per-ped so the line is readable, not a spam feed.
export function sayBark(G, ped, who, text) {
  if (ped) {
    if (ped.barkCooldown > 0) return;
    ped.barkCooldown = 4 + G.rng() * 4;
  }
  G.bark = { who: who || (ped && ped.name) || 'Local', text, ttl: 3.5 };
}
export function sayPedBark(G, ped, kind) {
  sayBark(G, ped, null, pick(G.rng, BARKS[kind] || BARKS.walker));
}

// "!" marker above a panicking / fleeing ped (shared texture, one sprite each).
let exclaimTex = null;
function makeMarker(scene) {
  if (!exclaimTex) {
    const cv = document.createElement('canvas');
    cv.width = 64; cv.height = 64;
    const g = cv.getContext('2d');
    g.font = 'bold 52px sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 8; g.strokeStyle = '#000';
    g.strokeText('!', 32, 34);
    g.fillStyle = '#ffd700';
    g.fillText('!', 32, 34);
    exclaimTex = new THREE.CanvasTexture(cv);
  }
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: exclaimTex, transparent: true, depthTest: false }));
  sp.scale.set(0.9, 0.9, 1);
  sp.visible = false;
  scene.add(sp);
  return sp;
}

// Sidewalk anchor points: a point on a sidewalk line near (x, z).
function sidewalkSpot(rng, cx, cz, spread) {
  const road = CITY.roads[Math.floor(rng() * CITY.roads.length)];
  const along = clamp(cx + (rng() - 0.5) * spread, -230, 230);
  const horizontal = rng() < 0.5;
  return horizontal
    ? { x: along, z: road + 10.5 }
    : { x: road + 10.5, z: clamp(cz + (rng() - 0.5) * spread, -230, 230) };
}

const STALL_SPOTS = [
  { x: -145, z: 256, label: 'Tide Bar' },   // beach bar
  { x: 14, z: 10, label: 'Solara Plaza' },  // plaza stall
  { x: 12, z: 262, label: 'South Docks' },  // docks stall
];
const SIT_SPOTS = [
  { x: 8, z: 8 }, { x: -8, z: -8 }, { x: -116, z: 52 }, { x: 116, z: -52 },
  { x: -180, z: 250 }, { x: 58, z: 168 },
];

export function createPedestrians(scene, rng) {
  const peds = [];
  let nameI = 0;
  function basePed(archetype, x, z, opts) {
    const mesh = makePerson({
      skin: Math.floor(rng() * 5),
      shirt: Math.floor(rng() * 12),
      pants: Math.floor(rng() * 6),
      hairColor: [0x2a1a10, 0x111111, 0x6a4a2a, 0x8a8a8a, 0xc8a040][Math.floor(rng() * 5)],
      scale: 0.92 + rng() * 0.16,
      hat: opts.hat,
      vest: opts.vest,
      apron: opts.apron,
      backpack: opts.backpack,
      jacket: opts.jacket,
    });
    scene.add(mesh);
    const ped = {
      mesh, parts: mesh.userData.parts,
      marker: makeMarker(scene),
      name: NAMES[nameI++ % NAMES.length],
      archetype,
      x, z, heading: rng() * Math.PI * 2,
      speed: opts.speed ?? (1.2 + rng() * 0.8),
      baseSpeed: opts.speed ?? 1.4,
      phase: rng() * 10,
      dead: false,
      state: opts.state || 'walk',
      dest: null,
      stateTimer: 0,
      waitTimer: 0,
      fleeTimer: 0,
      witnessTimer: 0,
      witnessCooldown: 0,
      barkCooldown: rng() * 4,
      bumpCooldown: 0,
      partner: null,
      anchor: { x, z },
    };
    ped.dest = sidewalkSpot(rng, x, z, 120);
    mesh.position.set(x, 0, z);
    peds.push(ped);
    return ped;
  }
  // 16 everyday walkers all over the city.
  for (let i = 0; i < 16; i++) {
    const s = sidewalkSpot(rng, 0, 0, 440);
    basePed('walker', s.x, s.z, { backpack: rng() < 0.4, hat: rng() < 0.25 ? 'cap' : undefined, jacket: rng() < 0.3 });
  }
  // 4 joggers looping the plaza and the beach front.
  for (let i = 0; i < 4; i++) {
    const cx = i % 2 === 0 ? 0 : -100, cz = i % 2 === 0 ? 0 : 250;
    basePed('jogger', cx + (rng() - 0.5) * 40, cz + (rng() - 0.5) * 20,
      { speed: 3.0 + rng() * 0.6, hat: 'cap', backpack: false });
  }
  // 6 tourists around the plaza, beach and docks — slow, always stopping.
  for (let i = 0; i < 6; i++) {
    const spot = [NAMED.plaza, NAMED.beachBar, NAMED.docks][i % 3];
    basePed('tourist', spot.x + (rng() - 0.5) * 24, spot.z + (rng() - 0.5) * 24,
      { speed: 0.85 + rng() * 0.3, hat: rng() < 0.5 ? 'beanie' : 'cap', backpack: true });
  }
  // 4 dock/garage workers in hi-vis.
  for (let i = 0; i < 4; i++) {
    const spot = i < 3 ? NAMED.docks : NAMED.garage;
    basePed('worker', spot.x + (rng() - 0.5) * 20, spot.z + (rng() - 0.5) * 16,
      { speed: 1.3, vest: true, hat: 'cap' });
  }
  // 3 shopkeepers who stand at their stalls and hawk their goods.
  for (const spot of STALL_SPOTS) {
    const ped = basePed('shopkeeper', spot.x, spot.z, { speed: 1.0, apron: true });
    ped.state = 'work';
    ped.anchor = { x: spot.x, z: spot.z };
    ped.dest = null;
  }
  // 4 sitters on the plaza, in the parks and on the beach.
  for (const spot of SIT_SPOTS.slice(0, 4)) {
    const ped = basePed('sitter', spot.x, spot.z, { speed: 1.1, hat: rng() < 0.4 ? 'beanie' : undefined });
    ped.state = 'sit';
    ped.stateTimer = 20 + rng() * 20;
    ped.dest = null;
  }
  // 4 pairs of talkers — two people facing each other, mid-conversation.
  const pairSpots = [[6, 6], [-12, 4], [-170, 252], [10, 258]];
  for (const [px, pz] of pairSpots) {
    const a = basePed('talker', px, pz, { speed: 1.2 });
    const b = basePed('talker', px + 1.4, pz + 0.4, { speed: 1.2, jacket: true });
    a.state = 'chat'; b.state = 'chat';
    a.partner = b; b.partner = a;
    a.heading = Math.atan2(b.x - a.x, b.z - a.z);
    b.heading = Math.atan2(a.x - b.x, a.z - b.z);
    a.stateTimer = 25 + rng() * 20; b.stateTimer = a.stateTimer;
    a.dest = null; b.dest = null;
  }
  return peds;
}

// A crime happened at (x, z): nearby pedestrians witness it. They panic,
// and after a short delay one of them calls the police — which feeds the
// wanted system. Called from combat (shoot/punch) and from car theft.
export function witnessCrime(G, x, z, radius = 26) {
  for (const ped of G.peds) {
    if (ped.dead || ped.witnessCooldown > 0) continue;
    if (dist2(ped.x, ped.z, x, z) < radius) {
      ped.witnessTimer = 1.5 + G.rng() * 1.5;
      if (ped.state !== 'flee') {
        ped.state = 'panic';
        ped.stateTimer = 2.5;
        if (ped.marker) ped.marker.visible = true;
      }
    }
  }
}

export function updatePedestrians(G, dt) {
  const p = G.player;
  const px = p.mode === 'car' && p.car ? p.car.x : p.x;
  const pz = p.mode === 'car' && p.car ? p.car.z : p.z;
  const playerFast = (p.mode === 'car' && Math.abs(p.car.speed) > 10) || G.gunshotFlash > 0;
  for (const ped of G.peds) {
    if (ped.dead) continue;
    if (ped.barkCooldown > 0) ped.barkCooldown -= dt;
    if (ped.witnessCooldown > 0) ped.witnessCooldown -= dt;
    if (ped.bumpCooldown > 0) ped.bumpCooldown -= dt;
    if (ped.stateTimer > 0) ped.stateTimer -= dt;

    const dPlayer = dist2(ped.x, ped.z, px, pz);
    // --- Danger: gunfire nearby, or a fast car bearing down. Flee! ---
    const danger = (G.gunshotFlash > 0 && dPlayer < 30) ||
      (p.mode === 'car' && Math.abs(p.car.speed) > 10 && dPlayer < 14);
    if (danger && ped.state !== 'flee') {
      ped.state = 'flee';
      ped.fleeTimer = 3 + G.rng() * 2;
      if (ped.marker) ped.marker.visible = true;
      if (G.rng() < 0.6) sayPedBark(G, ped, 'panic');
      if (G.gunshotFlash > 0) G.audio.scream();
    }
    // --- Witness: the call to the police lands a beat after the crime. ---
    if (ped.witnessTimer > 0) {
      ped.witnessTimer -= dt;
      if (ped.witnessTimer <= 0 && !ped.dead) {
        ped.witnessCooldown = 60;
        sayPedBark(G, ped, 'witness');
        // The witness call itself is the crime the cops respond to.
        // (G.addCrime is wired at boot in main.js to avoid a police<->traffic cycle.)
        if (G.addCrime) G.addCrime(1, 'Witness called the cops');
      }
    }
    // --- Bump: the player walks into someone. ---
    if (p.mode === 'foot' && dPlayer < 0.95 && p.speed > 0.5 && ped.bumpCooldown <= 0 &&
      ped.state !== 'flee' && ped.state !== 'panic') {
      ped.bumpCooldown = 5;
      ped.x += (ped.x - px) * 0.4;
      ped.z += (ped.z - pz) * 0.4;
      sayPedBark(G, ped, 'bump');
      ped.stateTimer = 1.2;
      ped.state = 'idle';
    }

    let vx = 0, vz = 0, moving = false, speedMul = 1;
    if (ped.state === 'flee') {
      ped.fleeTimer -= dt;
      const d = Math.max(dPlayer, 0.5);
      vx = ((ped.x - px) / d) * 4.6;
      vz = ((ped.z - pz) / d) * 4.6;
      ped.heading = Math.atan2(vx, vz);
      moving = true; speedMul = 1;
      posePanic(ped.parts);
      if (ped.fleeTimer <= 0) {
        ped.state = 'walk';
        if (ped.marker) ped.marker.visible = false;
        ped.dest = sidewalkSpot(G.rng, ped.x, ped.z, 100);
      }
    } else if (ped.state === 'panic') {
      posePanic(ped.parts);
      ped.heading += dt * 2; // looking around wildly
      if (ped.stateTimer <= 0) {
        ped.state = 'walk';
        if (ped.marker) ped.marker.visible = false;
        ped.dest = sidewalkSpot(G.rng, ped.x, ped.z, 100);
      }
    } else if (ped.state === 'chat' && ped.partner && !ped.partner.dead) {
      poseTalk(ped.parts, ped.phase);
      ped.heading = Math.atan2(ped.partner.x - ped.x, ped.partner.z - ped.z);
      if (ped.stateTimer <= 0 && G.rng() < 0.01) sayPedBark(G, ped, 'talker');
      if (ped.stateTimer <= 0) {
        // Conversation over: both walk off together to a new spot.
        ped.state = 'walk';
        ped.partner.state = 'walk';
        ped.dest = sidewalkSpot(G.rng, ped.x, ped.z, 120);
        ped.partner.dest = ped.dest;
        ped.stateTimer = 0; ped.partner.stateTimer = 0;
      }
    } else if (ped.state === 'work') {
      // Shopkeeper / worker on the job: small work gestures, sales barks.
      poseTalk(ped.parts, ped.phase * 0.5);
      if (ped.archetype === 'shopkeeper' && G.rng() < 0.002) sayPedBark(G, ped, 'shopkeeper');
      if (ped.archetype === 'worker' && ped.stateTimer <= 0) {
        ped.state = 'walk';
        ped.dest = sidewalkSpot(G.rng, ped.anchor.x, ped.anchor.z, 60);
        ped.stateTimer = 8 + G.rng() * 8;
      }
    } else if (ped.state === 'sit') {
      poseSit(ped.parts);
      if (G.rng() < 0.001) sayPedBark(G, ped, 'sitter');
      if (ped.stateTimer <= 0) {
        ped.state = 'walk';
        ped.dest = sidewalkSpot(G.rng, ped.x, ped.z, 120);
      }
    } else if (ped.state === 'idle') {
      poseIdle(ped.parts, ped.phase);
      if (ped.archetype === 'tourist') {
        ped.heading += dt * 0.4; // looking around, taking it in
        if (G.rng() < 0.002) sayPedBark(G, ped, 'tourist');
      }
      if (ped.stateTimer <= 0) {
        ped.state = 'walk';
        if (!ped.dest) ped.dest = sidewalkSpot(G.rng, ped.x, ped.z, 120);
      }
    } else { // walk: head for the destination along the sidewalk
      if (!ped.dest) ped.dest = sidewalkSpot(G.rng, ped.x, ped.z, 120);
      const dx = ped.dest.x - ped.x, dz = ped.dest.z - ped.z;
      const d = Math.hypot(dx, dz);
      if (d < 2) {
        // Arrived: do something human for a while.
        const roll = G.rng();
        if (ped.archetype === 'jogger') {
          ped.dest = sidewalkSpot(G.rng, ped.x, ped.z, 200); // joggers keep going
        } else if (ped.archetype === 'tourist' && roll < 0.5) {
          ped.state = 'idle'; ped.stateTimer = 4 + G.rng() * 5; // stop and gawp
        } else if (ped.archetype === 'worker' && roll < 0.5) {
          ped.state = 'work'; ped.stateTimer = 6 + G.rng() * 6; // on the job
        } else if (ped.archetype === 'sitter' && roll < 0.5) {
          ped.state = 'sit'; ped.stateTimer = 15 + G.rng() * 20;
        } else if (roll < 0.25) {
          ped.state = 'idle'; ped.stateTimer = 3 + G.rng() * 5;
        } else {
          ped.dest = sidewalkSpot(G.rng, ped.x, ped.z, 160);
        }
      } else {
        // A car coming down the road I'm about to cross: hurry.
        let hurry = 1;
        for (const car of G.traffic) {
          if (!car.dead && car.driver === 'ai' && dist2(car.x, car.z, ped.x, ped.z) < 9) { hurry = 1.8; break; }
        }
        vx = (dx / d) * ped.speed * hurry;
        vz = (dz / d) * ped.speed * hurry;
        ped.heading = Math.atan2(vx, vz);
        moving = true;
        speedMul = hurry > 1 ? 1 : 0.6;
      }
    }
    ped.x += vx * dt; ped.z += vz * dt;
    collideCircle(ped, 0.5, G.city.colliders);
    ped.phase += dt * (moving ? (ped.state === 'flee' ? 13 : 9) : 2);
    if (moving && ped.state !== 'flee' && ped.state !== 'panic') poseWalk(ped.parts, ped.phase, speedMul);
    ped.mesh.position.set(ped.x, 0, ped.z);
    ped.mesh.rotation.y = ped.heading;
    if (ped.marker) ped.marker.position.set(ped.x, 2.3, ped.z);
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
    { x: 0, z: 14, kind: 'health' },
    { x: -145, z: 250, kind: 'ammo' },
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
