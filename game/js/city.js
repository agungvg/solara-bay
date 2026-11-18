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
  // Sand strip (south edge) and a wet-sand band hugging the waterline.
  g.fillStyle = '#e8d39a';
  g.fillRect(0, pz(CITY.beachZ), S, S - pz(CITY.beachZ));
  g.fillStyle = '#d9bd72';
  g.fillRect(0, pz(288), S, pz(302) - pz(288));
  g.fillStyle = '#c8a558';
  g.fillRect(0, pz(298), S, pz(302) - pz(298));
  // Sand detail: the beach / dock expanse must not read as flat tan.
  // Speckle + pebbles + stains + cracks break it up at every distance.
  for (let k = 0; k < 2600; k++) {
    const x = rng() * S, y = pz(240) + rng() * (S - pz(240));
    const v = rng();
    g.fillStyle = v < 0.5 ? 'rgba(120,95,50,0.20)' : v < 0.8 ? 'rgba(255,240,200,0.22)' : 'rgba(90,70,40,0.28)';
    const r = 1 + rng() * 3;
    g.fillRect(x, y, r, r);
  }
  for (let k = 0; k < 18; k++) { // cracks in the dry sand
    let x = rng() * S, y = pz(242) + rng() * (S - pz(242));
    g.strokeStyle = 'rgba(90,70,40,0.30)';
    g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(x, y);
    for (let s = 0; s < 6; s++) { x += (rng() - 0.5) * 60; y += (rng() - 0.5) * 40; g.lineTo(x, y); }
    g.stroke();
  }
  // Dock yard concrete apron around PIER 9 (x -64..64, z 238..292):
  // grey concrete with expansion joints, oil stains, tyre tracks and
  // painted markings. Mission positions are unchanged; the apron is
  // ground paint only, and props sit at its edges, never in the lane.
  g.fillStyle = '#9a938a';
  g.fillRect(px(-64), pz(238), px(128) - px(0), pz(54) - pz(0));
  g.strokeStyle = 'rgba(0,0,0,0.16)'; g.lineWidth = 2;
  for (let v = -64; v <= 64; v += 8) {
    g.beginPath(); g.moveTo(px(v), pz(238)); g.lineTo(px(v), pz(292)); g.stroke();
  }
  for (let v = 238; v <= 292; v += 9) {
    g.beginPath(); g.moveTo(px(-64), pz(v)); g.lineTo(px(64), pz(v)); g.stroke();
  }
  for (let k = 0; k < 1400; k++) { // concrete speckle
    const x = px(-64) + rng() * (px(128) - px(0));
    const y = pz(238) + rng() * (pz(54) - pz(0));
    g.fillStyle = rng() < 0.5 ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.08)';
    g.fillRect(x, y, 1 + rng() * 2, 1 + rng() * 2);
  }
  for (let k = 0; k < 12; k++) { // oil stains
    const x = px(-60 + rng() * 120), y = pz(242 + rng() * 44);
    const r = (2 + rng() * 4) * (S / 580);
    const grad = g.createRadialGradient(x, y, 1, x, y, r);
    grad.addColorStop(0, 'rgba(25,20,16,0.34)');
    grad.addColorStop(1, 'rgba(25,20,16,0)');
    g.fillStyle = grad;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  g.strokeStyle = 'rgba(30,28,26,0.30)'; g.lineWidth = 2.5; // tyre tracks
  for (let k = 0; k < 7; k++) {
    const x0 = px(-60 + rng() * 110), y0 = pz(240 + rng() * 10);
    g.beginPath(); g.moveTo(x0, y0);
    g.quadraticCurveTo(x0 + (rng() - 0.5) * 160, y0 + 60 + rng() * 60,
      x0 + (rng() - 0.5) * 220, pz(282 + rng() * 8));
    g.stroke();
  }
  g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 2; // container slots
  for (const sx of [-48, -34, -20, -4, 12, 28]) {
    g.strokeRect(px(sx - 3.4), pz(282.6), px(6.8) - px(0), pz(6.8) - pz(0));
  }
  // Painted PIER 9 marking on the apron — rotated 180° so it reads
  // correctly from the north (the mission camera looks south). Kept to
  // the east side of the yard, away from the player's feet: at (0, 247)
  // it filled the whole foreground as a white blob.
  g.save();
  g.translate(px(34), pz(252));
  g.rotate(Math.PI);
  g.font = 'bold 36px sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.fillText('PIER 9', 0, 0);
  g.restore();
  // Hazard striping along the pier edge.
  for (let x = -30; x < 30; x += 4) {
    g.fillStyle = (Math.floor(x / 4) % 2 === 0) ? '#e8c832' : '#222222';
    g.beginPath();
    g.moveTo(px(x), pz(269)); g.lineTo(px(x + 2), pz(269));
    g.lineTo(px(x + 4), pz(271)); g.lineTo(px(x + 2), pz(271));
    g.closePath(); g.fill();
  }
  // Roads: asphalt bands. Vertical bands stop at the beach (240) so no
  // road runs across the sand into the sea; the docks stay reachable
  // on foot over the sand. (Horizontal bands already end at z = 232.)
  g.fillStyle = '#3a3d42';
  for (const r of CITY.roads) {
    g.fillRect(0, pz(r - 7), S, pz(14) - pz(0));
    g.fillRect(px(r - 7), 0, px(14) - px(0), pz(CITY.beachZ));
  }
  // Yellow centre dashes (short, so they read as dashes up close).
  g.fillStyle = '#e8c832';
  for (const r of CITY.roads) {
    for (let v = -280; v < 280; v += 12) {
      g.fillRect(px(v), pz(r - 0.3), px(4) - px(0), pz(0.6) - pz(0));
    }
    for (let v = -280; v < 238; v += 12) {
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
    ['#e0c9a0', '#2e3d55', '#ffd166'],
    ['#c2ccd4', '#24344a', '#ffe9a8'],
    ['#d0a58c', '#31404f', '#ffe9a8'],
    ['#b0c09a', '#2a3542', '#fff2c0'], // sage green block
    ['#dd9d8a', '#3a2e3e', '#ffe9a8'], // terracotta block
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

  // Neon-sunset art direction: one sun shared by sky, ocean and fog.
  // Fog MUST match the sky horizon colour (0xff9e57) or the far skyline
  // shows a seam. Game clock starts 08:32 — warm late-afternoon, not night.
  const SUN_DIR = new THREE.Vector3(120, 180, 60).normalize();
  scene.background = new THREE.Color(0xff9e57);
  scene.fog = new THREE.Fog(0xff9e57, 200, 620);

  // Ground plane (covers city + beach).
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(580, 580),
    new THREE.MeshLambertMaterial({ map: makeGroundTexture(rng) }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 15);
  ground.receiveShadow = true;
  group.add(ground);

  // Ocean beyond the beach: one ShaderMaterial, analytic waves + normals
  // (normals come from the same waves that displace the surface), sun
  // glitter on the sunset path, animated foam at the waterline. Cheap:
  // 90x26 grid, one draw call, time advanced via onBeforeRender below
  // (main.js has no per-frame city hook).
  const oceanUniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0 },
      uSunDir: { value: SUN_DIR },
      uDeep: { value: new THREE.Color(0x0a4a66) },
      uShallow: { value: new THREE.Color(0x1e8fb5) },
      uSky: { value: new THREE.Color(0xff9e57) },
      uFoam: { value: new THREE.Color(0xeaf6f2) },
    },
  ]);
  const oceanMat = new THREE.ShaderMaterial({
    uniforms: oceanUniforms,
    fog: true,
    vertexShader: `
      uniform float uTime;
      varying vec3 vWorldPos;
      varying vec3 vNormalW;
      #include <fog_pars_vertex>
      void main() {
        vec3 pos = position;
        float t = uTime;
        float p1 = pos.x * 0.11 + t * 1.1;
        float p2 = pos.y * 0.16 - t * 0.8 + pos.x * 0.05;
        float p3 = (pos.x + pos.y) * 0.31 + t * 1.7;
        float h = 0.35 * sin(p1) + 0.22 * sin(p2) + 0.12 * sin(p3);
        float dx = 0.35 * 0.11 * cos(p1) + 0.22 * 0.05 * cos(p2) + 0.12 * 0.31 * cos(p3);
        float dy = 0.22 * 0.16 * cos(p2) + 0.12 * 0.31 * cos(p3);
        // Gentle lap at the shoreline (local +Y edge is the waterline).
        float att = 0.25 + 0.75 * (1.0 - smoothstep(80.0, 130.0, pos.y));
        pos.z += h * att;
        vec3 n = normalize(vec3(-dx * att, -dy * att, 1.0));
        vec4 wp = modelMatrix * vec4(pos, 1.0);
        vWorldPos = wp.xyz;
        vNormalW = normalize(mat3(modelMatrix) * n);
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uSunDir;
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uSky;
      uniform vec3 uFoam;
      varying vec3 vWorldPos;
      varying vec3 vNormalW;
      #include <fog_pars_fragment>
      void main() {
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 N = normalize(vNormalW);
        // Fine ripple detail so the sea never reads as a flat slab at a
        // grazing angle (cheap sin detail, no texture).
        float rip = sin(vWorldPos.x * 0.9 + uTime * 1.3) * sin(vWorldPos.z * 1.1 - uTime * 0.9)
          + 0.5 * sin(vWorldPos.x * 2.3 - uTime * 1.7);
        N = normalize(N + vec3(rip * 0.06, 0.0, rip * 0.04));
        float shore = smoothstep(318.0, 303.0, vWorldPos.z);
        vec3 col = mix(uDeep, uShallow, shore * 0.85 + 0.1);
        float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
        col = mix(col, uSky, fres * 0.30);
        vec3 R = reflect(-uSunDir, N);
        float spec = pow(max(dot(R, V), 0.0), 120.0);
        col += vec3(1.0, 0.62, 0.3) * spec * 1.4;
        float band = sin(vWorldPos.z * 1.4 - uTime * 1.8) * 0.5 + 0.5;
        float foam = smoothstep(0.55, 0.95, shore) * (0.35 + 0.65 * band);
        col = mix(col, uFoam, clamp(foam, 0.0, 1.0) * 0.65);
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(900, 260, 90, 26), oceanMat);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, -0.4, CITY.oceanZ + 130);
  group.add(ocean);
  // Soft foam strip just past the sand edge (the shader foam is the
  // animated part; this is the still-readable white waterline).
  const foamMat = new THREE.MeshBasicMaterial({
    color: 0xeaf6f2, transparent: true, opacity: 0.22, depthWrite: false,
  });
  const foamBand = new THREE.Mesh(new THREE.PlaneGeometry(900, 5), foamMat);
  foamBand.rotation.x = -Math.PI / 2;
  foamBand.position.set(0, -0.12, CITY.oceanZ + 7);
  group.add(foamBand);

  // Sky: gradient dome (Tier 0/2 — cheapest tier that reads) with sun disc
  // + glow in-shader, horizon == fog colour. Radius 700 < camera.far 900.
  const skyMat = new THREE.ShaderMaterial({
    uniforms: {
      uSunDir: { value: SUN_DIR },
      uZen: { value: new THREE.Color(0x2b1655) },
      uMid: { value: new THREE.Color(0xc65d7b) },
      uHor: { value: new THREE.Color(0xff9e57) },
      uBelow: { value: new THREE.Color(0x1a0f2e) },
    },
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 uSunDir;
      uniform vec3 uZen;
      uniform vec3 uMid;
      uniform vec3 uHor;
      uniform vec3 uBelow;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = mix(uHor, uMid, smoothstep(0.02, 0.24, h));
        col = mix(col, uZen, smoothstep(0.20, 0.62, h));
        col = mix(uBelow, col, smoothstep(-0.08, 0.02, h));
        float s = max(dot(d, uSunDir), 0.0);
        col += vec3(1.0, 0.72, 0.38) * pow(s, 20.0) * 0.5;
        col += vec3(1.0, 0.85, 0.55) * smoothstep(0.9992, 0.99965, s) * 2.0;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(700, 32, 16), skyMat);
  skyDome.renderOrder = -1;
  skyDome.frustumCulled = false;
  group.add(skyDome);

  // Clouds: Tier 2 billboard sprites, 2 layers (high = slower, dimmer;
  // low = faster, sunset-pink). Soft radial-gradient canvas texture,
  // shared by all clouds. Drift + ocean time advance here — this runs
  // once per render, no per-frame work anywhere else.
  function makeCloudTexture() {
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 128;
    const g = cv.getContext('2d');
    for (const [x, y, r] of [[70, 80, 52], [120, 66, 62], [180, 82, 50], [100, 88, 46], [150, 90, 44]]) {
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,0.85)');
      gr.addColorStop(0.7, 'rgba(255,255,255,0.45)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
  const cloudTex = makeCloudTexture();
  const clouds = [];
  for (let i = 0; i < 10; i++) {
    const high = i < 4;
    const mat = new THREE.SpriteMaterial({
      map: cloudTex, transparent: true, depthWrite: false, fog: false,
      opacity: high ? 0.55 : 0.85,
      color: high ? 0xe8d8ff : 0xffe0c8,
    });
    const c = new THREE.Sprite(mat);
    // First three clouds sit over the ocean (south), so the docks /
    // beach views actually show sky life; the rest spread over the city.
    const overOcean = i < 3;
    c.position.set(
      overOcean ? (rng() - 0.5) * 1000 : (rng() - 0.5) * 1300,
      high ? 150 + rng() * 35 : 95 + rng() * 30,
      overOcean ? 350 + rng() * 250 : (rng() - 0.5) * 1300);
    const w = high ? 140 + rng() * 60 : 100 + rng() * 60;
    c.scale.set(w, w * 0.32, 1);
    c.userData.speed = high ? 1.2 : 2.2;
    clouds.push(c);
    group.add(c);
  }
  const envClock = { last: performance.now() };
  skyDome.onBeforeRender = () => {
    const now = performance.now();
    const dt = Math.min(0.1, (now - envClock.last) / 1000);
    envClock.last = now;
    oceanMat.uniforms.uTime.value = now / 1000;
    foamMat.opacity = 0.18 + 0.06 * Math.sin((now / 1000) * 0.9);
    for (const c of clouds) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 720) c.position.x = -720;
    }
  };

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

  // Shipping-container face: corrugated ribs (dark groove + light crest),
  // top/bottom rails, door lock-rod lines, a shipping-line label with a
  // container number, and rust streaks. A flat colour reads as a toy
  // block; ribs + label read as a container at 10–20 m.
  function makeContainerTexture(base, label, num) {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 256;
    const g = cv.getContext('2d');
    g.fillStyle = base; g.fillRect(0, 0, 512, 256);
    // Corrugation: vertical ribs every 16 px.
    for (let x = 0; x < 512; x += 16) {
      g.fillStyle = 'rgba(0,0,0,0.28)';
      g.fillRect(x, 0, 4, 256);
      g.fillStyle = 'rgba(255,255,255,0.16)';
      g.fillRect(x + 4, 0, 3, 256);
    }
    // Door lock rods (4 vertical bars, right-hand door half).
    g.fillStyle = 'rgba(0,0,0,0.35)';
    for (const x of [300, 340, 380, 420]) g.fillRect(x, 18, 5, 220);
    // Top + bottom rails.
    g.fillStyle = 'rgba(0,0,0,0.4)';
    g.fillRect(0, 0, 512, 12);
    g.fillRect(0, 244, 512, 12);
    // Label + container number, left half so the rods stay readable.
    g.fillStyle = 'rgba(255,255,255,0.92)';
    g.font = 'bold 44px sans-serif';
    g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText(label, 22, 84);
    g.font = 'bold 30px sans-serif';
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.fillText(num, 22, 132);
    g.font = '22px sans-serif';
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.fillText('MAX GROSS 30,480 KG', 22, 168);
    // Rust streaks bleeding down from the top rail + corner wear.
    for (let k = 0; k < 16; k++) {
      const x = rng() * 512, len = 20 + rng() * 90;
      const grad = g.createLinearGradient(0, 12, 0, 12 + len);
      grad.addColorStop(0, 'rgba(90,50,20,0.4)');
      grad.addColorStop(1, 'rgba(90,50,20,0)');
      g.fillStyle = grad;
      g.fillRect(x, 12, 3 + rng() * 5, len);
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // Wooden crate face: plank lines + stencil mark, so pier crates are not
  // flat tan cubes either.
  function makeCrateTexture() {
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 128;
    const g = cv.getContext('2d');
    g.fillStyle = '#a8873a'; g.fillRect(0, 0, 128, 128);
    g.strokeStyle = 'rgba(60,40,15,0.55)'; g.lineWidth = 3;
    for (let y = 0; y <= 128; y += 32) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(128, y); g.stroke();
    }
    g.strokeStyle = 'rgba(60,40,15,0.4)'; g.lineWidth = 6;
    g.strokeRect(3, 3, 122, 122);
    g.fillStyle = 'rgba(60,40,15,0.6)';
    g.font = 'bold 20px sans-serif'; g.textAlign = 'center';
    g.fillText('FRAGILE', 64, 70);
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
  const crateMat = new THREE.MeshStandardMaterial({ map: makeCrateTexture(), roughness: 0.9 });
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
  // Rocks + coast: displaced-icosahedron boulders (seeded vertex jitter
  // from a position hash, so shared vertices move together — no cracks;
  // flat-shaded, 2 variants x 1 InstancedMesh each) + scree along the
  // waterline. Outcrops sit at the west/east beach edges, clear of the
  // docks, beach bar, stalls and the beach pickup; all z > 240, so no
  // road or mission path is ever blocked.
  function displaceRockGeo(geo, seed) {
    const pos = geo.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const n = Math.sin(v.x * 3.1 + seed) * Math.sin(v.y * 2.7 + seed * 1.3)
        * Math.sin(v.z * 3.7 + seed * 0.7);
      const n2 = Math.sin(v.x * 7.3 + seed * 2.1) * 0.5;
      v.multiplyScalar(1 + n * 0.16 + n2 * 0.08);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    return geo;
  }
  const rockGeoA = displaceRockGeo(new THREE.IcosahedronGeometry(1, 1), 11);
  const rockGeoB = displaceRockGeo(new THREE.IcosahedronGeometry(1, 1), 47);
  const rockMatSand = new THREE.MeshStandardMaterial({ color: 0xb59a72, roughness: 0.95, flatShading: true });
  const rockMatGranite = new THREE.MeshStandardMaterial({ color: 0x7d7a72, roughness: 0.95, flatShading: true });
  const rockSpots = [];
  for (let k = 0; k < 6; k++) rockSpots.push([-272 + rng() * 26, 272 + rng() * 26, 2.5 + rng() * 2.0, 0]);
  for (let k = 0; k < 5; k++) rockSpots.push([246 + rng() * 26, 272 + rng() * 24, 2.5 + rng() * 1.8, 1]);
  for (let k = 0; k < 12; k++) {
    const side = rng() < 0.5 ? -1 : 1;
    rockSpots.push([side * (140 + rng() * 85), 252 + rng() * 26, 1.0 + rng() * 1.0, k % 2]);
  }
  const rockDummy = new THREE.Object3D();
  function fillRocks(inst, spots) {
    spots.forEach(([x, z, s], i) => {
      rockDummy.rotation.set((rng() - 0.5) * 0.3, rng() * Math.PI * 2, (rng() - 0.5) * 0.3);
      rockDummy.scale.set(s * (0.9 + rng() * 0.5), s * (0.55 + rng() * 0.25), s * (0.9 + rng() * 0.5));
      rockDummy.position.set(x, s * 0.32, z); // half-buried, never floating
      rockDummy.updateMatrix();
      inst.setMatrixAt(i, rockDummy.matrix);
      if (s > 2) {
        colliders.push({ x0: x - s * 1.2, x1: x + s * 1.2, z0: z - s * 1.2, z1: z + s * 1.2, h: s });
      }
    });
    inst.instanceMatrix.needsUpdate = true;
  }
  const rockSpotsA = rockSpots.filter((s) => s[3] === 0);
  const rockSpotsB = rockSpots.filter((s) => s[3] === 1);
  const rockInstA = new THREE.InstancedMesh(rockGeoA, rockMatSand, rockSpotsA.length);
  const rockInstB = new THREE.InstancedMesh(rockGeoB, rockMatGranite, rockSpotsB.length);
  rockInstA.castShadow = true; rockInstA.receiveShadow = true;
  rockInstB.castShadow = true; rockInstB.receiveShadow = true;
  fillRocks(rockInstA, rockSpotsA);
  fillRocks(rockInstB, rockSpotsB);
  group.add(rockInstA);
  group.add(rockInstB);
  // Hero outcrop rocks: 2 hand-placed, detail 2, at the far beach tips.
  const heroGeo = displaceRockGeo(new THREE.IcosahedronGeometry(1, 2), 99);
  const heroMat = new THREE.MeshStandardMaterial({ color: 0x9a7a58, roughness: 0.95, flatShading: true });
  for (const [hx, hz, hs] of [[-278, 296, 5.5], [276, 294, 4.5]]) {
    const hero = new THREE.Mesh(heroGeo, heroMat);
    hero.scale.set(hs, hs * 0.55, hs * 0.8);
    hero.rotation.y = rng() * Math.PI * 2;
    hero.position.set(hx, hs * 0.18, hz);
    hero.castShadow = true; hero.receiveShadow = true;
    group.add(hero);
    colliders.push({ x0: hx - hs, x1: hx + hs, z0: hz - hs * 0.8, z1: hz + hs * 0.8, h: hs * 0.55 });
  }
  // Scree / pebbles along the waterline: 1 InstancedMesh, no colliders,
  // no shadows.
  const screeInst = new THREE.InstancedMesh(
    displaceRockGeo(new THREE.IcosahedronGeometry(1, 0), 3), rockMatGranite, 140);
  for (let i = 0; i < 140; i++) {
    rockDummy.rotation.set(0, rng() * Math.PI * 2, 0);
    rockDummy.scale.setScalar(0.15 + rng() * 0.35);
    rockDummy.position.set(-280 + rng() * 560, 0.05, 292 + rng() * 7);
    rockDummy.updateMatrix();
    screeInst.setMatrixAt(i, rockDummy.matrix);
  }
  screeInst.instanceMatrix.needsUpdate = true;
  group.add(screeInst);
  // Plaza fountain.
  const fount = new THREE.Mesh(new THREE.CylinderGeometry(6, 7, 1.2, 16),
    new THREE.MeshLambertMaterial({ color: 0x9fb4c0 }));
  fount.position.set(0, 0.6, 0);
  group.add(fount);
  colliders.push({ x0: -7, x1: 7, z0: -7, z1: 7, h: 1.2 });

  // PLAZA FIX: the x=0 / z=0 roads used to run straight through the
  // square (the ground texture already paints plaza paving over the
  // asphalt inside [-24, 24]). Bollards + planters now close the four
  // road entries: colliders block vehicles and the player on foot, with
  // ~1.7 m gaps between bollards so pedestrians still pass through.
  // NOTE: AI traffic follows the road grid in traffic.js and does not
  // read colliders, so a car on road 0 still crosses visually — a full
  // fix needs traffic to treat the entries as blocked (not this file).
  const plazaDummy = new THREE.Object3D();
  const bollardInst = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.22, 0.26, 0.9, 8),
    new THREE.MeshLambertMaterial({ color: 0x2c2f36 }), 12);
  const bollardTops = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.23, 0.23, 0.12, 8),
    new THREE.MeshBasicMaterial({ color: 0xff8c42 }), 12);
  const planterInst = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1.2, 0.9, 2.4),
    new THREE.MeshLambertMaterial({ color: 0x8a6a4a }), 8);
  const planterBushInst = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.8, 0),
    new THREE.MeshLambertMaterial({ color: 0x4c8a3e }), 8);
  let bi = 0, pi = 0;
  for (const [ex, ez, alongX] of [[24, 0, false], [-24, 0, false], [0, 24, true], [0, -24, true]]) {
    for (const off of [-2.4, 0, 2.4]) {
      const bx = alongX ? off : ex, bz = alongX ? ez : off;
      plazaDummy.rotation.set(0, 0, 0);
      plazaDummy.scale.set(1, 1, 1);
      plazaDummy.position.set(bx, 0.45, bz);
      plazaDummy.updateMatrix();
      bollardInst.setMatrixAt(bi, plazaDummy.matrix);
      plazaDummy.position.set(bx, 0.92, bz);
      plazaDummy.updateMatrix();
      bollardTops.setMatrixAt(bi, plazaDummy.matrix);
      colliders.push({ x0: bx - 0.35, x1: bx + 0.35, z0: bz - 0.35, z1: bz + 0.35, h: 0.9 });
      bi++;
    }
    for (const off of [-5.5, 5.5]) {
      const px = alongX ? off : ex, pz = alongX ? ez : off;
      plazaDummy.rotation.set(0, alongX ? Math.PI / 2 : 0, 0);
      plazaDummy.scale.set(1, 1, 1);
      plazaDummy.position.set(px, 0.45, pz);
      plazaDummy.updateMatrix();
      planterInst.setMatrixAt(pi, plazaDummy.matrix);
      plazaDummy.position.set(px, 1.15, pz);
      plazaDummy.updateMatrix();
      planterBushInst.setMatrixAt(pi, plazaDummy.matrix);
      colliders.push({
        x0: px - (alongX ? 1.2 : 0.6), x1: px + (alongX ? 1.2 : 0.6),
        z0: pz - (alongX ? 0.6 : 1.2), z1: pz + (alongX ? 0.6 : 1.2), h: 0.9,
      });
      pi++;
    }
  }
  bollardInst.instanceMatrix.needsUpdate = true;
  bollardTops.instanceMatrix.needsUpdate = true;
  planterInst.instanceMatrix.needsUpdate = true;
  planterBushInst.instanceMatrix.needsUpdate = true;
  group.add(bollardInst);
  group.add(bollardTops);
  group.add(planterInst);
  group.add(planterBushInst);

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

  // Palm trees: instanced (was ~2 meshes per palm, ~250 draw calls).
  // Same spots, same colliders, seeded lean/scale variation per palm.
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
  const palmSpotsF = palmSpots.filter(([, z]) => z <= CITY.beachZ + 30);
  const dummy = new THREE.Object3D();
  const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, palmSpotsF.length);
  const crownInst = new THREE.InstancedMesh(crownGeo, palmMat, palmSpotsF.length);
  trunkInst.castShadow = true;
  palmSpotsF.forEach(([x, z], i) => {
    dummy.rotation.set((rng() - 0.5) * 0.12, rng() * Math.PI * 2, (rng() - 0.5) * 0.12);
    dummy.scale.setScalar(0.9 + rng() * 0.25);
    dummy.position.set(x, 2.75, z);
    dummy.updateMatrix();
    trunkInst.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, 6.4, z);
    dummy.updateMatrix();
    crownInst.setMatrixAt(i, dummy.matrix);
    colliders.push({ x0: x - 0.5, x1: x + 0.5, z0: z - 0.5, z1: z + 0.5, h: 5 });
  });
  trunkInst.instanceMatrix.needsUpdate = true;
  crownInst.instanceMatrix.needsUpdate = true;
  group.add(trunkInst);
  group.add(crownInst);

  // Broadleaf park trees: second species (trunk + puff canopy), instanced.
  const broadSpots = [];
  for (const [bx, bz] of parkBlocks) {
    for (let k = 0; k < 5; k++) {
      broadSpots.push([bx + (rng() - 0.5) * 36, bz + (rng() - 0.5) * 36]);
    }
  }
  const broadTrunkGeo = new THREE.CylinderGeometry(0.3, 0.45, 4, 6);
  const broadCanopyGeo = new THREE.IcosahedronGeometry(2.4, 0);
  const broadCanopyMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const broadTrunkInst = new THREE.InstancedMesh(broadTrunkGeo, trunkMat, broadSpots.length);
  const broadCanopyInst = new THREE.InstancedMesh(broadCanopyGeo, broadCanopyMat, broadSpots.length);
  broadCanopyInst.castShadow = true;
  const leafGreens = [new THREE.Color(0x3f8a3a), new THREE.Color(0x55a04a), new THREE.Color(0x2f7a44)];
  broadSpots.forEach(([x, z], i) => {
    dummy.rotation.set(0, rng() * Math.PI * 2, 0);
    dummy.scale.setScalar(0.85 + rng() * 0.4);
    dummy.position.set(x, 2, z);
    dummy.updateMatrix();
    broadTrunkInst.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, 5.2, z);
    dummy.scale.set(0.85 + rng() * 0.4, 0.7 + rng() * 0.25, 0.85 + rng() * 0.4);
    dummy.updateMatrix();
    broadCanopyInst.setMatrixAt(i, dummy.matrix);
    broadCanopyInst.setColorAt(i, leafGreens[Math.floor(rng() * leafGreens.length)]);
  });
  broadTrunkInst.instanceMatrix.needsUpdate = true;
  broadCanopyInst.instanceMatrix.needsUpdate = true;
  broadCanopyInst.instanceColor.needsUpdate = true;
  group.add(broadTrunkInst);
  group.add(broadCanopyInst);

  // Grass tufts: instanced cones, parks + beach edge. One draw call.
  const grassGeo = new THREE.ConeGeometry(0.45, 1.1, 5);
  grassGeo.translate(0, 0.55, 0);
  const tuftMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const grassSpots = [];
  for (const [bx, bz] of parkBlocks) {
    for (let k = 0; k < 90; k++) grassSpots.push([bx + (rng() - 0.5) * 40, bz + (rng() - 0.5) * 40]);
  }
  for (let k = 0; k < 120; k++) grassSpots.push([-280 + rng() * 560, 238 + rng() * 14]);
  const grassInst = new THREE.InstancedMesh(grassGeo, tuftMat, grassSpots.length);
  const grassGreens = [new THREE.Color(0x4a8a3f), new THREE.Color(0x67a844), new THREE.Color(0x7fb84a),
    new THREE.Color(0xc9b458)];
  grassSpots.forEach(([x, z], i) => {
    dummy.rotation.set(0, rng() * Math.PI * 2, 0);
    dummy.scale.set(0.7 + rng() * 0.9, 0.7 + rng() * 0.8, 0.7 + rng() * 0.9);
    dummy.position.set(x, 0, z);
    dummy.updateMatrix();
    grassInst.setMatrixAt(i, dummy.matrix);
    // Dry sand-grass near the beach, lush green in the parks.
    grassInst.setColorAt(i, z > 235 ? grassGreens[3] : grassGreens[Math.floor(rng() * 3)]);
  });
  grassInst.instanceMatrix.needsUpdate = true;
  grassInst.instanceColor.needsUpdate = true;
  group.add(grassInst);

  // Flower beds in the plaza: soil beds + instanced flower heads.
  const flowerSpots = [];
  for (const [bx, bz] of [[-18, 18], [18, -18]]) {
    const soil = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x4a3220 }));
    soil.scale.set(6, 0.3, 3);
    soil.position.set(bx, 0.15, bz);
    group.add(soil);
    for (let k = 0; k < 30; k++) {
      flowerSpots.push([bx + (rng() - 0.5) * 5.4, bz + (rng() - 0.5) * 2.4]);
    }
  }
  const flowerInst = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.22, 0),
    new THREE.MeshLambertMaterial({ color: 0xffffff }), flowerSpots.length);
  const flowerCols = [new THREE.Color(0xff6fa5), new THREE.Color(0xff8c42),
    new THREE.Color(0xffd166), new THREE.Color(0xfff2e0)];
  flowerSpots.forEach(([x, z], i) => {
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(0.8 + rng() * 0.5);
    dummy.position.set(x, 0.45, z);
    dummy.updateMatrix();
    flowerInst.setMatrixAt(i, dummy.matrix);
    flowerInst.setColorAt(i, flowerCols[Math.floor(rng() * flowerCols.length)]);
  });
  flowerInst.instanceMatrix.needsUpdate = true;
  flowerInst.instanceColor.needsUpdate = true;
  group.add(flowerInst);

  // Bushes: instanced squashed blobs — park edges, plaza corners, beach
  // bar. (Planter-top bushes live with the plaza fix, below.)
  const bushSpots = [];
  for (const [bx, bz] of parkBlocks) {
    for (let k = 0; k < 10; k++) bushSpots.push([bx + (rng() - 0.5) * 40, bz + (rng() - 0.5) * 40]);
  }
  for (const [bx, bz] of [[-20, -20], [20, 20], [-20, 20], [20, -20]]) {
    bushSpots.push([bx + (rng() - 0.5) * 2, bz + (rng() - 0.5) * 2]);
    bushSpots.push([bx + (rng() - 0.5) * 2, bz + (rng() - 0.5) * 2]);
  }
  for (let k = 0; k < 6; k++) bushSpots.push([-160 + rng() * 30, 252 + rng() * 12]);
  const bushInst = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1, 0),
    new THREE.MeshLambertMaterial({ color: 0xffffff }), bushSpots.length);
  const bushGreens = [new THREE.Color(0x3a7a34), new THREE.Color(0x4c8a3e)];
  bushSpots.forEach(([x, z], i) => {
    dummy.rotation.set(0, rng() * Math.PI * 2, 0);
    dummy.scale.set(0.8 + rng() * 0.7, 0.55 + rng() * 0.3, 0.8 + rng() * 0.7);
    dummy.position.set(x, 0.35, z);
    dummy.updateMatrix();
    bushInst.setMatrixAt(i, dummy.matrix);
    bushInst.setColorAt(i, bushGreens[Math.floor(rng() * bushGreens.length)]);
  });
  bushInst.instanceMatrix.needsUpdate = true;
  bushInst.instanceColor.needsUpdate = true;
  group.add(bushInst);

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
  addBillboard(-174, -10.8, 'SUNSET MOTEL', '#7a3fd1', '#ffe9a8', Math.PI);
  addBillboard(174, 10.8, "EAT AT SAL'S", '#e87a2e', '#ffffff', 0);
  // Shipping containers at the docks: ribbed + labelled, varied stacking
  // (not a flat row — two singles, three stacks, one askew), so they read
  // as containers at 10–20 m instead of coloured blocks. Row sits at
  // z = 286, clear of the pier slab (ends z = 283). Ground-level boxes
  // keep colliders; the shootout lane (z 250–266) stays open.
  const contDefs = [
    // [x, z, colour, label, number, stacked?, rotY]
    [-48, 286, '#b03a2e', 'SOLARA LINES', 'SBXU 482 110 7', false, 0],
    [-34, 286, '#2e5cb0', 'BAY FREIGHT', 'BFXU 117 904 2', false, 0],
    [-20, 286, '#3aa655', 'PIER 9 CARGO', 'P9CU 305 771 4', false, 0.05],
    [-4, 286, '#e8c832', 'SOLARA LINES', 'SBXU 482 110 9', false, 0],
    [12, 286, '#b03a2e', 'BAY FREIGHT', 'BFXU 117 904 6', false, 0],
    [28, 286, '#2e5cb0', 'PIER 9 CARGO', 'P9CU 305 771 8', false, -0.04],
    [-34, 285, '#3aa655', 'SOLARA LINES', 'SBXU 482 111 1', true, 0],
    [-4, 287, '#b03a2e', 'BAY FREIGHT', 'BFXU 117 905 3', true, 0.08],
    [12, 286, '#e8c832', 'PIER 9 CARGO', 'P9CU 305 772 0', true, 0],
  ];
  for (const [cx, cz, col, label, num, stacked, rotY] of contDefs) {
    const w = 6, d = 2.6, h = 2.6;
    const c = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({
      map: makeContainerTexture(col, label, num), roughness: 0.8, metalness: 0.15,
    }));
    c.scale.set(w, h, d);
    c.position.set(cx, h / 2 + (stacked ? h : 0), cz);
    c.rotation.y = rotY;
    c.castShadow = true; c.receiveShadow = true;
    group.add(c);
    if (!stacked) {
      colliders.push({ x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2, h: h * 2 });
    }
  }
  // Dock crane: A-frame legs, top beam, jib reaching over the containers,
  // cable + hook block. West end of the yard, clear of every mission path.
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: 0.7, metalness: 0.5 });
  const hazardMat = new THREE.MeshStandardMaterial({ color: 0xe8c832, roughness: 0.6, metalness: 0.2 });
  for (const lx of [-62, -54]) {
    const leg = new THREE.Mesh(boxGeo, steelMat);
    leg.scale.set(0.9, 16, 0.9);
    leg.position.set(lx, 8, 286);
    leg.castShadow = true;
    group.add(leg);
    colliders.push({ x0: lx - 0.6, x1: lx + 0.6, z0: 285.4, z1: 286.6, h: 16 });
  }
  const craneBeam = new THREE.Mesh(boxGeo, steelMat);
  craneBeam.scale.set(18, 1, 1);
  craneBeam.position.set(-58, 16, 286);
  craneBeam.castShadow = true;
  group.add(craneBeam);
  const craneJib = new THREE.Mesh(boxGeo, hazardMat);
  craneJib.scale.set(16, 0.8, 0.8);
  craneJib.position.set(-42, 15.6, 286);
  craneJib.castShadow = true;
  group.add(craneJib);
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 6, 5),
    new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 }));
  cable.position.set(-36, 12.4, 286);
  group.add(cable);
  const hook = new THREE.Mesh(boxGeo, hazardMat);
  hook.scale.set(1, 1, 0.6);
  hook.position.set(-36, 9, 286);
  hook.castShadow = true;
  group.add(hook);
  const counterweight = new THREE.Mesh(boxGeo, steelMat);
  counterweight.scale.set(2.5, 3, 1.5);
  counterweight.position.set(-66, 14.5, 286);
  group.add(counterweight);

  // Dock props: barrels, pallets, gate fences, pier bollards. All at the
  // yard edges — the shootout lane and the beach-pickup path stay open.
  const barrelCols = [0x8a3a2a, 0x2a4a7a, 0xc8a020];
  for (const [bx, bz] of [[-28, 270], [26, 272]]) {
    for (let k = 0; k < 4; k++) {
      const b = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 0.45, 1.1, 10),
        new THREE.MeshStandardMaterial({ color: barrelCols[(k + Math.abs(bx)) % 3], roughness: 0.75, metalness: 0.3 }));
      b.position.set(bx + (k % 2) * 1.1 - 0.5, 0.55, bz + Math.floor(k / 2) * 1.1 - 0.5);
      b.castShadow = true;
      group.add(b);
    }
    colliders.push({ x0: bx - 1.2, x1: bx + 1.2, z0: bz - 1.2, z1: bz + 1.2, h: 1.1 });
  }
  const palletMat = new THREE.MeshStandardMaterial({ color: 0x8a6b45, roughness: 0.95 });
  for (const [px2, pz2] of [[-40, 266], [36, 266]]) {
    for (let k = 0; k < 2; k++) {
      const p = new THREE.Mesh(boxGeo, palletMat);
      p.scale.set(1.6, 0.15, 1.2);
      p.position.set(px2, 0.08 + k * 0.16, pz2);
      p.rotation.y = k * 0.2;
      p.castShadow = true;
      group.add(p);
    }
  }
  // Gate fences along the yard's north edge (z = 240), open in the middle
  // (x -24..24) so the docks stay reachable on foot.
  const fenceMat = new THREE.MeshStandardMaterial({ color: 0x4a4a52, roughness: 0.8, metalness: 0.4 });
  for (const [fx0, fx1] of [[-60, -24], [24, 60]]) {
    for (let x = fx0; x <= fx1; x += 6) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.2, 6), fenceMat);
      post.position.set(x, 1.1, 240);
      group.add(post);
    }
    for (const ry of [0.7, 1.9]) {
      const rail = new THREE.Mesh(boxGeo, fenceMat);
      rail.scale.set(fx1 - fx0, 0.1, 0.1);
      rail.position.set((fx0 + fx1) / 2, ry, 240);
      group.add(rail);
    }
    colliders.push({ x0: fx0, x1: fx1, z0: 239.7, z1: 240.3, h: 2.2 });
  }
  // Yellow bollards along the pier edge.
  const bollMat = new THREE.MeshStandardMaterial({ color: 0xe8c832, roughness: 0.6 });
  for (let x = -25; x <= 25; x += 10) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.9, 8), bollMat);
    b.position.set(x, 0.45, 268);
    b.castShadow = true;
    group.add(b);
  }

  scene.add(group);
  return { colliders, group };
}
