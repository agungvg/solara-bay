// audio.js — all sound is synthesised with WebAudio. No audio files.
// Engine hum, police siren, gunshots, punches, pickups, mission jingles
// and a small original chord+bass music loop. Starts on a user gesture.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.musicTimer = null;
    this.musicStep = 0;
    this.noiseBuf = null;
    this.ambientStarted = false;
    this.ambientTimer = null;
    this.ambientNodes = null;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    // Shared noise buffer for gunshots / explosions.
    const len = this.ctx.sampleRate * 0.5;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    // Engine hum (sawtooth through a lowpass).
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    const engineFilter = this.ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 320;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(engineFilter);
    engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
    // Two-tone police siren.
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 700;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    this.sirenOsc.start();
    this.startMusic();
  }

  // Ambient city bed: all synthesised, no audio files. A looped low
  // filtered-noise wash (distant traffic / city air) + a soft low hum,
  // with an occasional distant siren wash drifting past. Quiet in the
  // mix by design — it beds the scene, it never competes with dialogue.
  // Routed through the master gain, so the M mute toggle silences it.
  startAmbient() {
    if (this.ambientStarted || !this.ctx) return;
    this.ambientStarted = true;
    // 2 s looped noise buffer, lowpassed to a city rumble.
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02; // brown-ish, no harsh hiss
      data[i] = last * 3.2;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 320; filter.Q.value = 0.4;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.045;
    src.connect(filter); filter.connect(gain); gain.connect(this.master);
    src.start();
    // Low traffic hum, gently breathing.
    const hum = this.ctx.createOscillator();
    hum.type = 'sine'; hum.frequency.value = 52;
    const humGain = this.ctx.createGain();
    humGain.gain.value = 0.02;
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine'; lfo.frequency.value = 0.07;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.008;
    lfo.connect(lfoGain); lfoGain.connect(humGain.gain);
    hum.connect(humGain); humGain.connect(this.master);
    hum.start(); lfo.start();
    this.ambientNodes = { src, hum, lfo };
    // Distant siren wash every ~20–35 s: a quiet two-tone swell that
    // rises, wails twice, and fades — far away, never the near siren.
    const wash = () => {
      if (!this.ctx) return;
      const t = this.ctx.currentTime + 0.1;
      const o = this.ctx.createOscillator();
      o.type = 'triangle'; o.frequency.value = 660;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.022, t + 1.2);
      o.frequency.setValueAtTime(660, t + 1.2);
      o.frequency.setValueAtTime(880, t + 2.0);
      o.frequency.setValueAtTime(660, t + 2.8);
      o.frequency.setValueAtTime(880, t + 3.6);
      g.gain.linearRampToValueAtTime(0.0001, t + 5.0);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + 5.2);
      this.ambientTimer = setTimeout(wash, 20000 + Math.random() * 15000);
    };
    this.ambientTimer = setTimeout(wash, 9000 + Math.random() * 8000);
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  engine(speedRatio) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(0.05 + speedRatio * 0.09, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(55 + speedRatio * 140, t, 0.1);
  }
  engineStart() {
    if (!this.ctx) return;
    this.engineGain.gain.setTargetAtTime(0.08, this.ctx.currentTime, 0.05);
  }
  engineStop() {
    if (!this.ctx) return;
    this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
  }

  // Siren gain follows whether police are near; the two-tone wail is a
  // slow LFO on the oscillator frequency, updated in the tick.
  siren(near, time) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.sirenGain.gain.setTargetAtTime(near ? 0.05 : 0, t, 0.2);
    if (near) {
      const tone = Math.floor(time * 1.6) % 2 === 0 ? 720 : 960;
      this.sirenOsc.frequency.setTargetAtTime(tone, t, 0.05);
    }
  }
  sirenBurst() {
    if (!this.ctx) return;
    this.sirenGain.gain.setTargetAtTime(0.06, this.ctx.currentTime, 0.02);
    this.sirenGain.gain.setTargetAtTime(0, this.ctx.currentTime + 0.5, 0.2);
  }

  blip(freq, dur, type = 'sine', vol = 0.2) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur);
  }

  noiseBurst(dur, vol, filterFreq = 1200) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + dur);
  }

  gunshot() { this.noiseBurst(0.16, 0.5, 3000); this.blip(160, 0.08, 'square', 0.15); }
  honk() {
    // Two-tone car horn.
    this.blip(370, 0.16, 'square', 0.22);
    setTimeout(() => this.blip(466, 0.2, 'square', 0.22), 140);
  }
  scream() {
    // Pedestrian scream: high sawtooth falling fast, quiet in the mix.
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(880, t);
    o.frequency.exponentialRampToValueAtTime(320, t + 0.4);
    g.gain.setValueAtTime(0.1, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.5);
  }
  gunshotFar() { this.noiseBurst(0.12, 0.15, 1800); }
  punch() { this.noiseBurst(0.08, 0.3, 500); }
  thud() { this.blip(70, 0.15, 'sine', 0.35); }
  hurt() { this.blip(220, 0.2, 'sawtooth', 0.2); }
  pickup() { this.blip(880, 0.09); setTimeout(() => this.blip(1320, 0.12), 90); }
  emptyClick() { this.blip(300, 0.05, 'square', 0.12); }
  checkpoint() { this.blip(660, 0.1); setTimeout(() => this.blip(990, 0.14), 100); }
  explosion() { this.noiseBurst(0.7, 0.6, 500); this.blip(50, 0.5, 'sine', 0.4); }
  missionStart() { [523, 659, 784].forEach((f, i) => setTimeout(() => this.blip(f, 0.16), i * 110)); }
  missionComplete() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.blip(f, 0.2), i * 130)); }

  // Original music loop: Am – F – C – G, bass root notes, soft pad.
  startMusic() {
    if (this.musicTimer || !this.ctx) return;
    const chords = [
      [220.0, 261.6, 329.6], // Am
      [174.6, 220.0, 261.6], // F
      [130.8, 196.0, 261.6], // C
      [196.0, 246.9, 293.7], // G
    ];
    const bass = [55.0, 43.7, 65.4, 49.0];
    this.musicTimer = setInterval(() => {
      if (!this.ctx || this.muted) return;
      const bar = Math.floor(this.musicStep / 4) % 4;
      const beat = this.musicStep % 4;
      const t = this.ctx.currentTime;
      if (beat === 0) {
        // Pad chord.
        for (const f of chords[bar]) {
          const o = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          o.type = 'triangle'; o.frequency.value = f;
          g.gain.setValueAtTime(0.035, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 1.9);
          o.connect(g); g.connect(this.master);
          o.start(t); o.stop(t + 2);
        }
        // Bass note.
        const b = this.ctx.createOscillator();
        const bg = this.ctx.createGain();
        b.type = 'sine'; b.frequency.value = bass[bar];
        bg.gain.setValueAtTime(0.09, t);
        bg.gain.exponentialRampToValueAtTime(0.001, t + 1.8);
        b.connect(bg); bg.connect(this.master);
        b.start(t); b.stop(t + 1.9);
      }
      // Light hat tick on off-beats.
      if (beat % 2 === 1) this.noiseBurst(0.03, 0.03, 6000);
      this.musicStep += 1;
    }, 480);
  }
}
