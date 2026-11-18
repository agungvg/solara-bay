// missions.js — six sequential story missions with objectives, beacons,
// dialogue subtitles, timers and cash rewards. Failing a timed step
// restarts that mission; the next starts a few seconds after the last.
import * as THREE from 'three';
import { NAMED, dist2 } from './utils.js';
import { makePerson, poseWalk } from './characters.js';
import { addCrime, clearPolice } from './police.js';

export const MISSION_DEFS = [
  { name: 'Back in the Bay', reward: 300 },
  { name: 'Hot Wheels', reward: 600 },
  { name: 'The Pickup', reward: 800 },
  { name: 'Heat Wave', reward: 1000 },
  { name: 'The Exchange', reward: 1500 },
  { name: 'Bay Run', reward: 3000 },
];

export function createMissions(G) {
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(1.0, 1.0, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xffd700, transparent: true, opacity: 0.28,
      side: THREE.DoubleSide, depthWrite: false,
    }),
  );
  beacon.visible = false;
  G.scene.add(beacon);
  return {
    index: 0,
    step: 0,
    state: 'idle', // idle | active | done | complete
    timer: 0,
    timerLimit: 0,
    target: null,
    objective: '',
    surviveTimer: 0,
    betweenTimer: 0,
    beacon,
    gangSpawned: false,
    checkpoints: [],
    checkpointIndex: 0,
    sal: null,
  };
}

function say(G, who, text, seconds = 4) {
  G.dialogue = { who, text, ttl: seconds };
}

function setTarget(G, x, z, objective) {
  const m = G.missions;
  m.target = { x, z };
  m.objective = objective;
  m.beacon.visible = true;
  m.beacon.position.set(x, 30, z);
}

function playerPos(G) {
  const p = G.player;
  return p.mode === 'car' && p.car ? { x: p.car.x, z: p.car.z } : { x: p.x, z: p.z };
}

function spawnSal(G) {
  if (G.missions.sal) return;
  const mesh = makePerson({ skin: 0, shirt: 4, pants: 2 });
  mesh.position.set(NAMED.plaza.x + 3, 0, NAMED.plaza.z + 3);
  G.scene.add(mesh);
  G.missions.sal = { mesh, x: NAMED.plaza.x + 3, z: NAMED.plaza.z + 3 };
}

export function startMission(G, index) {
  const m = G.missions;
  m.index = index;
  m.step = 0;
  m.state = 'active';
  m.timer = 0;
  m.timerLimit = 0;
  m.gangSpawned = false;
  m.checkpointIndex = 0;
  m.checkpoints = [];
  spawnSal(G);
  if (index === 0) {
    setTarget(G, NAMED.plaza.x + 3, NAMED.plaza.z + 3, 'Meet Sal at Solara Plaza');
    say(G, 'Sal', 'Mara! Back in the Bay at last. The garage is yours again — go see it.', 5);
  } else if (index === 1) {
    setTarget(G, NAMED.docks.x + 14, NAMED.docks.z - 4, 'Steal the magenta sports car at the docks');
    say(G, 'Sal', 'A magenta sportscar is sitting at the docks, keys in it. Bring it to the garage.', 5);
  } else if (index === 2) {
    m.timerLimit = 150;
    setTarget(G, NAMED.beachPickup.x, NAMED.beachPickup.z, 'Pick up the package at the beach (150s)');
    say(G, 'Sal', 'Package on the beach, by the umbrellas. Grab it and bring it back to me. Fast.', 5);
  } else if (index === 3) {
    m.surviveTimer = 0;
    setTarget(G, playerPos(G).x, playerPos(G).z, 'Survive 75s at wanted level 3, then lose the cops');
    say(G, 'Sal', 'The Vipers tipped off the cops. Survive the heat, then shake them.', 5);
    G.wanted.level = 3;
    G.wanted.quietTimer = -30; // hold the heat for a while
  } else if (index === 4) {
    setTarget(G, NAMED.docks.x, NAMED.docks.z, 'Go to the docks for the exchange');
    say(G, 'Sal', 'The Vipers want their case back. Meet them at the docks — and keep the case.', 5);
  } else if (index === 5) {
    m.checkpoints = [
      { x: -203, z: -203 },
      { x: 203, z: -58 },
      { x: -58, z: 203 },
    ];
    m.checkpointIndex = 0;
    setTarget(G, m.checkpoints[0].x, m.checkpoints[0].z, 'Bay Run: reach checkpoint 1 of 3 (in a car)');
    say(G, 'Sal', 'One last run across the Bay. Three checkpoints. The cops are already on you.', 5);
    G.wanted.level = 2;
    G.wanted.quietTimer = -20;
  }
  G.toast(`Mission ${index + 1}: ${MISSION_DEFS[index].name} — $${MISSION_DEFS[index].reward}`);
  G.audio.missionStart();
}

function completeMission(G) {
  const m = G.missions;
  const def = MISSION_DEFS[m.index];
  G.money += def.reward;
  G.toast(`Mission complete: ${def.name} +$${def.reward}`);
  say(G, 'Sal', `Nice work, Mara. $${def.reward} is yours.`, 4);
  G.audio.missionComplete();
  m.state = 'done';
  m.beacon.visible = false;
  m.target = null;
  m.betweenTimer = 4;
  G.saveGame();
  if (m.index === 5) {
    m.state = 'complete';
    G.toast('Story complete — free roam. Solara Bay is yours, Mara.');
  }
}

function failMission(G, reason) {
  G.toast(`Mission failed: ${reason} — restarting`);
  say(G, 'Sal', 'That went sideways. Shake it off, we go again.', 4);
  const idx = G.missions.index;
  // Clean up gang members from mission 5.
  for (const g of G.gang) { G.scene.remove(g.mesh); }
  G.gang = [];
  G.missions.gangSpawned = false;
  startMission(G, idx);
}

function spawnGang(G) {
  const m = G.missions;
  m.gangSpawned = true;
  const spots = [
    [NAMED.docks.x - 12, NAMED.docks.z - 10],
    [NAMED.docks.x + 8, NAMED.docks.z - 12],
    [NAMED.docks.x - 2, NAMED.docks.z - 6],
    [NAMED.docks.x + 14, NAMED.docks.z - 8],
  ];
  for (const [x, z] of spots) {
    const mesh = makePerson({ skin: 3, shirt: 1, pants: 1 });
    mesh.position.set(x, 0, z);
    G.scene.add(mesh);
    G.gang.push({ mesh, parts: mesh.userData.parts, x, z, heading: 0, health: 100, dead: false, phase: 0, shootTimer: 1 + Math.random() * 2 });
  }
  say(G, 'Viper', 'That case is ours, Reyes. You picked the wrong crew.', 4);
  setTarget(G, NAMED.docks.x, NAMED.docks.z, 'Defeat the 4 Vipers at the docks');
}

export function updateMissions(G, dt) {
  const m = G.missions;
  if (m.state === 'done') {
    m.betweenTimer -= dt;
    if (m.betweenTimer <= 0 && m.index < 5) startMission(G, m.index + 1);
    return;
  }
  if (m.state !== 'active') return;
  const pos = playerPos(G);
  // Timed missions.
  if (m.timerLimit > 0) {
    m.timer += dt;
    if (m.timer > m.timerLimit) {
      failMission(G, 'Out of time');
      return;
    }
  }
  const idx = m.index;
  if (idx === 0) {
    if (m.step === 0 && dist2(pos.x, pos.z, NAMED.plaza.x + 3, NAMED.plaza.z + 3) < 6) {
      m.step = 1;
      setTarget(G, NAMED.garage.x, NAMED.garage.z, 'Go to your garage');
      say(G, 'Mara', 'Good to see you, Sal. Let me check the garage.', 4);
    } else if (m.step === 1 && dist2(pos.x, pos.z, NAMED.garage.x, NAMED.garage.z) < 14) {
      m.step = 2;
      setTarget(G, NAMED.garage.x, NAMED.garage.z, 'Get in a car');
      say(G, 'Sal', 'There is a car waiting by the garage. Press E and drive.', 4);
    } else if (m.step === 2 && G.player.mode === 'car') {
      completeMission(G);
    }
  } else if (idx === 1) {
    const magenta = G.traffic.find((c) => c.missionCar);
    if (m.step === 0 && G.player.mode === 'car' && G.player.car === magenta) {
      m.step = 1;
      setTarget(G, NAMED.garage.x, NAMED.garage.z, 'Deliver the magenta car to the garage');
      say(G, 'Mara', 'Got it. Now get this beauty home before the cops box me in.', 4);
    } else if (m.step === 1 && dist2(pos.x, pos.z, NAMED.garage.x, NAMED.garage.z) < 14) {
      completeMission(G);
    }
  } else if (idx === 2) {
    if (m.step === 0 && dist2(pos.x, pos.z, NAMED.beachPickup.x, NAMED.beachPickup.z) < 4) {
      m.step = 1;
      setTarget(G, NAMED.plaza.x + 3, NAMED.plaza.z + 3, 'Bring the package to Sal at the plaza');
      say(G, 'Mara', 'Package secured. Back to the plaza.', 3);
    } else if (m.step === 1 && dist2(pos.x, pos.z, NAMED.plaza.x + 3, NAMED.plaza.z + 3) < 6) {
      completeMission(G);
    }
  } else if (idx === 3) {
    if (G.wanted.level >= 3) {
      m.surviveTimer += dt;
      m.objective = `Survive the heat: ${Math.ceil(75 - m.surviveTimer)}s left`;
      if (m.surviveTimer >= 75) {
        m.step = 1;
        m.objective = 'Now lose the cops (wanted back to 0)';
        say(G, 'Sal', 'You survived! Now disappear. Lay low till the heat is off.', 4);
      }
    }
    if (m.step === 1 && G.wanted.level === 0) completeMission(G);
  } else if (idx === 4) {
    if (m.step === 0 && dist2(pos.x, pos.z, NAMED.docks.x, NAMED.docks.z) < 14) {
      m.step = 1;
      spawnGang(G);
    } else if (m.step === 1) {
      if (G.gang.every((g) => g.dead)) {
        m.step = 2;
        setTarget(G, NAMED.garage.x, NAMED.garage.z, 'Take the case to the garage');
        say(G, 'Mara', 'All four down. The case is mine now.', 4);
      }
    } else if (m.step === 2 && dist2(pos.x, pos.z, NAMED.garage.x, NAMED.garage.z) < 14) {
      completeMission(G);
    }
  } else if (idx === 5) {
    const cp = m.checkpoints[m.checkpointIndex];
    if (cp && G.player.mode === 'car' && dist2(pos.x, pos.z, cp.x, cp.z) < 8) {
      m.checkpointIndex += 1;
      if (m.checkpointIndex >= m.checkpoints.length) {
        completeMission(G);
      } else {
        const next = m.checkpoints[m.checkpointIndex];
        setTarget(G, next.x, next.z, `Bay Run: reach checkpoint ${m.checkpointIndex + 1} of 3 (in a car)`);
        G.toast(`Checkpoint ${m.checkpointIndex} of 3!`);
        G.audio.checkpoint();
      }
    } else if (G.player.mode !== 'car') {
      m.objective = `Bay Run: get in a car — checkpoint ${m.checkpointIndex + 1} of 3`;
    }
  }
  // Beacon pulse.
  if (m.beacon.visible) {
    m.beacon.rotation.y += dt;
    m.beacon.material.opacity = 0.28 + Math.sin(G.time * 4) * 0.1;
  }
  // Gang AI: shoot at the player when close.
  for (const g of G.gang) {
    if (g.dead) continue;
    const d = dist2(g.x, g.z, pos.x, pos.z);
    g.heading = Math.atan2(pos.x - g.x, pos.z - g.z);
    g.mesh.rotation.y = g.heading;
    if (d < 40) {
      g.shootTimer -= dt;
      if (g.shootTimer <= 0) {
        g.shootTimer = 1.6 + Math.random() * 1.5;
        // Hit chance falls with distance.
        if (Math.random() < Math.max(0.15, 0.6 - d * 0.01)) {
          // damagePlayer imported via traffic to avoid a cycle; use G helper.
          G.damagePlayer(6);
        }
        G.audio.gunshotFar();
      }
    }
  }
}

// Stealing the magenta car raises wanted to at least 2.
export function onStealMagenta(G) {
  if (G.wanted.level < 2) {
    G.wanted.level = 2;
    G.wanted.quietTimer = 0;
    addCrime(G, 0, 'Grand theft auto');
  }
}
