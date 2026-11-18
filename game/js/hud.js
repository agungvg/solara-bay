// hud.js — DOM HUD updates and the canvas minimap.
// The HUD only presents state owned by other systems; it never mutates it.
import { CITY, NAMED, dist2 } from './utils.js';

export function createHud() {
  const $ = (id) => document.getElementById(id);
  return {
    money: $('hud-money'),
    healthBar: $('hud-health-fill'),
    healthText: $('hud-health-text'),
    stars: $('hud-stars'),
    objective: $('hud-objective'),
    objectiveDist: $('hud-objective-dist'),
    weapon: $('hud-weapon'),
    ammo: $('hud-ammo'),
    speed: $('hud-speed'),
    speedUnit: $('hud-speed-unit'),
    radio: $('hud-radio'),
    prompt: $('hud-prompt'),
    toast: $('hud-toast'),
    dialogue: $('hud-dialogue'),
    dialogueWho: $('hud-dialogue-who'),
    dialogueText: $('hud-dialogue-text'),
    dialoguePortrait: $('hud-dialogue-portrait'),
    dialogueInitial: $('hud-dialogue-initial'),
    policeUnits: $('hud-police-units'),
    policeUnitsList: $('hud-police-units-list'),
    speedo: $('hud-speedo'),
    speedFill: $('hud-speed-fill'),
    speedGear: $('hud-speed-gear'),
    radioStation: $('hud-radio-station'),
    radioTrack: $('hud-radio-track'),
    damageFlash: $('damage-flash'),
    crosshair: $('crosshair'),
    bark: $('hud-bark'),
    missionCard: $('mission-card'),
    missionCardTitle: $('mission-card-title'),
    missionCardBody: $('mission-card-body'),
    clock: $('hud-clock'),
    minimap: $('minimap'),
    menu: $('menu'),
    pauseMenu: $('pause-menu'),
    endOverlay: $('end-overlay'),
    endTitle: $('end-title'),
    endText: $('end-text'),
  };
}

let toastTimer = null;
export function showToast(hud, text) {
  hud.toast.textContent = text;
  hud.toast.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => hud.toast.classList.remove('show'), 3200);
}

export function updateHud(G) {
  const hud = G.hud;
  const p = G.player;
  hud.money.textContent = '$' + G.money.toLocaleString('en-US');
  // In-game clock: a Solara Bay day runs from the 08:32 start.
  if (hud.clock) {
    const mins = Math.floor(G.clockMin) % (24 * 60);
    const hh = String(Math.floor(mins / 60)).padStart(2, '0');
    const mm = String(mins % 60).padStart(2, '0');
    hud.clock.textContent = `${hh}:${mm}  ·  Solara Bay`;
  }
  hud.healthBar.style.width = Math.max(0, p.health) + '%';
  hud.healthBar.style.background = p.health > 50 ? '#37d67a' : p.health > 25 ? '#ffb020' : '#ff4444';
  hud.healthText.textContent = Math.ceil(Math.max(0, p.health)) + ' HP';
  hud.stars.textContent = '★'.repeat(G.wanted.level) + '☆'.repeat(5 - G.wanted.level);
  hud.stars.classList.toggle('hot', G.wanted.level >= 3);
  const m = G.missions;
  if (m.state === 'active' && m.objective) {
    hud.objective.textContent = `Mission ${m.index + 1}/6 — ${m.objective}`;
    if (m.target) {
      const pos = p.mode === 'car' && p.car ? { x: p.car.x, z: p.car.z } : { x: p.x, z: p.z };
      const d = Math.round(dist2(pos.x, pos.z, m.target.x, m.target.z));
      hud.objectiveDist.textContent = d + ' m';
    } else hud.objectiveDist.textContent = '';
  } else if (m.state === 'complete') {
    hud.objective.textContent = 'Story complete — free roam';
    hud.objectiveDist.textContent = '';
  } else {
    hud.objective.textContent = 'Free roam — explore Solara Bay';
    hud.objectiveDist.textContent = '';
  }
  hud.weapon.textContent = G.weapon === 'pistol' ? 'PISTOL' : 'FISTS';
  hud.ammo.textContent = G.weapon === 'pistol' ? `${G.ammo.mag} / ${G.ammo.reserve}` : '—';
  hud.crosshair.style.display = (G.weapon === 'pistol' && p.mode === 'foot' && G.state === 'playing') ? 'block' : 'none';
  if (p.mode === 'car' && p.car) {
    const kmh = Math.round(Math.abs(p.car.speed) * 3.6);
    hud.speed.textContent = kmh;
    hud.speedUnit.textContent = 'km/h';
    if (hud.speedo) hud.speedo.style.display = 'block';
    if (hud.speedFill) hud.speedFill.style.width = Math.min(100, Math.round(kmh / 180 * 100)) + '%';
    if (hud.speedGear) hud.speedGear.textContent = p.car.speed < -0.5 ? 'GEAR R' : p.car.speed > 0.5 ? 'GEAR D' : 'GEAR N';
    if (hud.radioStation) hud.radioStation.textContent = '♪ BAY FM 98.4';
    if (hud.radioTrack) hud.radioTrack.textContent = 'Solara Sunset Drive';
    if (hud.radio) hud.radio.style.display = 'block';
  } else {
    hud.speed.textContent = '';
    hud.speedUnit.textContent = '';
    if (hud.speedo) hud.speedo.style.display = 'none';
    if (hud.radio) hud.radio.style.display = 'none';
  }
  // Interaction prompt.
  if (G.nearCar && p.mode === 'foot' && G.state === 'playing') {
    hud.prompt.textContent = G.nearCar.driver === 'ai' ? 'E — Steal car' : 'E — Get in car';
    hud.prompt.style.display = 'block';
  } else if (p.mode === 'car' && G.state === 'playing') {
    hud.prompt.textContent = 'E — Get out';
    hud.prompt.style.display = 'block';
  } else {
    hud.prompt.style.display = 'none';
  }
  // Dialogue bar (story characters) with a portrait: initial + per-speaker
  // colour so the player learns who is talking without reading the name.
  if (G.dialogue && G.dialogue.ttl > 0) {
    hud.dialogue.style.display = 'flex';
    hud.dialogueWho.textContent = G.dialogue.who;
    hud.dialogueText.textContent = G.dialogue.text;
    if (hud.dialogueInitial) hud.dialogueInitial.textContent = (G.dialogue.who || '?')[0].toUpperCase();
    if (hud.dialoguePortrait) {
      const who = (G.dialogue.who || '').toLowerCase();
      hud.dialoguePortrait.className = who === 'mara' ? 'speaker-mara' : who === 'sal' ? 'speaker-sal' : '';
    }
  } else {
    hud.dialogue.style.display = 'none';
  }
  // Police-unit list (left edge, only while wanted): named units with a
  // live status, read from the real police cars — never invented positions.
  // Callsigns are display labels only; the cars/distances are real.
  if (hud.policeUnits && hud.policeUnitsList) {
    const level = G.wanted.level;
    if (level >= 1) {
      hud.policeUnits.style.display = 'block';
      const px = p.mode === 'car' && p.car ? p.car.x : p.x;
      const pz = p.mode === 'car' && p.car ? p.car.z : p.z;
      const callsigns = ['UNIT 7 — INTERCEPTOR', 'UNIT 12 — CRUISER', 'UNIT 3 — PURSUIT', 'UNIT 21 — K-9'];
      const rows = [];
      const alive = G.policeCars.filter((c) => !c.dead).slice(0, 4);
      alive.forEach((car, i) => {
        const d = Math.round(dist2(car.x, car.z, px, pz));
        const status = d < 60 ? 'PURSUIT' : d > 130 ? 'SEARCH' : 'PURSUIT';
        const cls = d < 60 ? 'pursuit' : d > 130 ? 'search' : 'pursuit';
        rows.push({ name: callsigns[i % callsigns.length], status, cls, dist: d + ' m' });
      });
      if (G.roadblock) rows.push({ name: 'ROADBLOCK — BAY PD', status: 'ROADBLOCK', cls: 'roadblock', dist: 'ahead' });
      if (rows.length === 0) rows.push({ name: 'UNIT 7 — INTERCEPTOR', status: 'RESPONDING', cls: 'respond', dist: '—' });
      hud.policeUnitsList.innerHTML = '';
      for (const r of rows.slice(0, 4)) {
        const row = document.createElement('div');
        row.className = 'hud-unit-row';
        const n = document.createElement('span'); n.className = 'u-name'; n.textContent = r.name;
        const s = document.createElement('span'); s.className = 'u-status ' + r.cls; s.textContent = r.status;
        const d = document.createElement('span'); d.className = 'u-dist'; d.textContent = r.dist;
        row.appendChild(n); row.appendChild(s); row.appendChild(d);
        hud.policeUnitsList.appendChild(row);
      }
    } else {
      hud.policeUnits.style.display = 'none';
    }
  }
  // NPC bark line (the city talking back — pedestrians, drivers, witnesses).
  // GATED: barks are suppressed while wanted >= 2 — a shopkeeper hawking
  // fish mid-chase reads as incongruous. The bark data is untouched; only
  // the display is gated.
  if (hud.bark) {
    if (G.bark && G.bark.ttl > 0 && !(G.dialogue && G.dialogue.ttl > 0) && G.wanted.level < 2) {
      hud.bark.style.display = 'block';
      hud.bark.innerHTML = '';
      const b = document.createElement('b');
      b.textContent = G.bark.who;
      hud.bark.appendChild(b);
      hud.bark.appendChild(document.createTextNode(G.bark.text));
    } else {
      hud.bark.style.display = 'none';
    }
  }
  // Mission intro / outro card.
  if (hud.missionCard) {
    if (G.missionCard && G.missionCard.ttl > 0) {
      hud.missionCard.style.display = 'block';
      hud.missionCardTitle.textContent = G.missionCard.title;
      hud.missionCardBody.textContent = G.missionCard.body;
    } else {
      hud.missionCard.style.display = 'none';
    }
  }
  // Damage flash.
  hud.damageFlash.style.opacity = G.hudFlash > 0 ? String(Math.min(0.7, G.hudFlash)) : '0';
  // Mission timer.
  const timerEl = document.getElementById('hud-timer');
  if (timerEl) {
    if (m.state === 'active' && m.timerLimit > 0) {
      timerEl.textContent = '⏱ ' + Math.max(0, Math.ceil(m.timerLimit - m.timer)) + 's';
      timerEl.style.display = 'block';
    } else timerEl.style.display = 'none';
  }
}

// Minimap: roads, player arrow, mission marker, police + traffic dots.
export function drawMinimap(G) {
  const cv = G.hud.minimap;
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const S = cv.width;
  const toMap = (v) => ((v + 260) / 520) * S;
  ctx.clearRect(0, 0, S, S);
  ctx.fillStyle = '#101418';
  ctx.fillRect(0, 0, S, S);
  // Sand + ocean.
  ctx.fillStyle = '#c9a86a';
  ctx.fillRect(0, toMap(CITY.beachZ), S, S - toMap(CITY.beachZ));
  ctx.fillStyle = '#1e7fa8';
  ctx.fillRect(0, toMap(CITY.oceanZ), S, S - toMap(CITY.oceanZ));
  // Roads.
  ctx.strokeStyle = '#5f666f';
  ctx.lineWidth = 5;
  for (const r of CITY.roads) {
    ctx.beginPath(); ctx.moveTo(toMap(r), 0); ctx.lineTo(toMap(r), S); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, toMap(r)); ctx.lineTo(S, toMap(r)); ctx.stroke();
  }
  // Plaza marker (small gold square, no text to collide with pins).
  ctx.fillStyle = '#ffd700';
  ctx.fillRect(toMap(-2) - 2, toMap(-2) - 2, 4, 4);
  // Named-site labels (tiny, so the map reads as a place, not a grid).
  ctx.fillStyle = '#9fd8e8';
  ctx.font = 'bold 7px sans-serif';
  ctx.textAlign = 'center';
  const labels = [
    [NAMED.plaza, 'PLAZA'], [NAMED.docks, 'DOCKS'], [NAMED.garage, 'GARAGE'],
    [NAMED.police, 'BAY PD'], [NAMED.hospital, 'HOSPITAL'], [NAMED.beachBar, 'TIDE BAR'],
  ];
  for (const [site, label] of labels) {
    ctx.fillText(label, toMap(site.x), toMap(site.z) - 6);
  }
  // Pedestrian dots (pale) — the city is inhabited, even on the map.
  ctx.fillStyle = 'rgba(230,230,220,0.85)';
  for (const ped of G.peds) {
    if (ped.dead) continue;
    ctx.fillRect(toMap(ped.x) - 1, toMap(ped.z) - 1, 2, 2);
  }
  // Gang dots (magenta) during the Exchange.
  ctx.fillStyle = '#ff2e88';
  for (const g of G.gang) {
    if (g.dead) continue;
    ctx.beginPath(); ctx.arc(toMap(g.x), toMap(g.z), 3, 0, Math.PI * 2); ctx.fill();
  }
  // Traffic dots.
  ctx.fillStyle = '#cccccc';
  for (const car of G.traffic) {
    if (car.dead) continue;
    ctx.fillRect(toMap(car.x) - 1.5, toMap(car.z) - 1.5, 3, 3);
  }
  // Police dots (red, flashing).
  if (Math.floor(G.time * 3) % 2 === 0) {
    ctx.fillStyle = '#ff3344';
    for (const car of G.policeCars) {
      if (car.dead) continue;
      ctx.beginPath(); ctx.arc(toMap(car.x), toMap(car.z), 3.5, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Mission marker (pulsing gold).
  const m = G.missions;
  if (m.state === 'active' && m.target) {
    const r = 4 + Math.sin(G.time * 5) * 1.5;
    ctx.fillStyle = '#ffd700';
    ctx.beginPath(); ctx.arc(toMap(m.target.x), toMap(m.target.z), r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  // Player arrow.
  const p = G.player;
  const px = p.mode === 'car' && p.car ? p.car.x : p.x;
  const pz = p.mode === 'car' && p.car ? p.car.z : p.z;
  const heading = p.mode === 'car' && p.car ? p.car.heading : p.heading;
  ctx.save();
  ctx.translate(toMap(px), toMap(pz));
  ctx.rotate(Math.atan2(Math.sin(heading), -Math.cos(heading)) + Math.PI);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#000000';
  ctx.stroke();
  ctx.restore();
}
