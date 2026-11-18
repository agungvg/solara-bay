// save.js — localStorage save / load for Solara Bay.
const KEY = 'solara-bay-save-v1';

export function saveGameData(G) {
  const p = G.player;
  const data = {
    money: G.money,
    missionIndex: G.missions.state === 'complete' ? 6 : G.missions.index,
    missionState: G.missions.state,
    clockMin: G.clockMin,
    health: Math.max(1, Math.round(p.health)),
    ammo: { mag: G.ammo.mag, reserve: G.ammo.reserve },
    x: p.mode === 'car' && p.car ? p.car.x : p.x,
    z: p.mode === 'car' && p.car ? p.car.z : p.z,
    wanted: 0,
    savedAt: Date.now(),
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGameData() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.money !== 'number' || typeof data.x !== 'number') return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function hasSave() {
  return loadGameData() !== null;
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
}
