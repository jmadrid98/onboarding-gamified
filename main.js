import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { installRealisticWorld, createHumanoidCharacter } from './realistic-assets.js?v=65.0.0';

const $ = id => document.getElementById(id);
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = THREE.MathUtils.clamp;

// ── Mission Checkpoints Catalog (9 Unique Stations: Balanced Flat & Hill Biomes) ───
const SEED = [
  { id: 1, name: 'Arsenal y Equipos', desc: 'Entrega y verificación del equipamiento inicial: Laptop corporativa, tarjeta de acceso, periféricos tech y kit de bienvenida.', region: 'Puesto de Inicio', x: -115, z: 38, baseY: 0.0, type: 'camp' },
  { id: 2, name: 'Firma de Contrato y Beneficios', desc: 'Formalización del pacto laboral, firma de contrato, pólizas de salud, vales y catálogo de beneficios corporativos.', region: 'Santuario del Pacto', x: -82, z: -35, baseY: 3.2, type: 'sanctuary' },
  { id: 3, name: 'Humand y Comedor', desc: 'Guía de uso de la App Humand para checar entradas/salidas, reporte de incidencias, turnos y normas del comedor corporativo.', region: 'Valle del Refectorio', x: -45, z: 22, baseY: 0.0, type: 'garden' },
  { id: 4, name: 'NPS y Voz del Cliente', desc: 'Importancia del NPS, la experiencia y la obsesión por el cliente.', region: 'Valle de Beneficios', x: -12, z: 52, baseY: 5.8, type: 'observatory' },
  { id: 5, name: 'Sindicato y Ecosistema Laboral', desc: 'Contexto, reglas y entendimiento del entorno sindical.', region: 'Consejo Laboral', x: 22, z: 26, baseY: 0.0, type: 'plaza' },
  { id: 6, name: 'Negocio y Producto', desc: 'Cómo genera valor la empresa, qué ofrece y dónde impacta tu función.', region: 'Bahía de Comercio', x: 55, z: -32, baseY: 0.0, type: 'harbor' },
  { id: 7, name: 'Compliance Quest', desc: 'Riesgo, ética, políticas y decisiones críticas del negocio.', region: 'Gran Archivo de Ética', x: 90, z: -38, baseY: 3.5, type: 'archive' },
  { id: 8, name: 'Herramientas y Operación', desc: 'Sistemas, accesos, canales y operación del día a día.', region: 'Forja Operativa', x: 115, z: 18, baseY: 5.5, type: 'forge' },
  { id: 9, name: 'Boss Final', desc: 'Cierre integral, último checkpoint y símbolo de pertenencia.', region: 'Bastión de Cierre', x: 148, z: 45, baseY: 11.5, type: 'castle' }
];

// ── State Management ─────────────────────────────────────────────────────────
const KEY = 'nextGenOnboardingDay.v65_lush_fog';
let saved = {};
try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch {}
let missions = structuredClone(SEED);
if (Array.isArray(saved.missions) && saved.missions.length === SEED.length) {
  saved.missions.forEach((m, idx) => {
    if (m && m.name && m.id === SEED[idx].id) {
      missions[idx] = { ...SEED[idx], ...m };
    }
  });
}
let current = clamp(Number(saved.current) || 1, 1, missions.length);
const colors = ['#0e807f', '#d69c39', '#7257c8', '#be6150', '#3677c9', '#668e4f', '#c64e91', '#e47b30'];
const initials = n => String(n || '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || 'AV';

let players = [];
if (Array.isArray(saved.players)) {
  players = saved.players.filter(p => p && p.name).map((p, idx) => ({
    id: (Number.isFinite(Number(p.id)) && Number(p.id) > 0) ? Number(p.id) : (idx + 1),
    name: String(p.name).trim(),
    initials: p.initials || initials(p.name),
    color: p.color || colors[idx % colors.length],
    points: Math.max(0, Number(p.points) || 0),
    missionId: clamp(Number(p.missionId) || current, 1, missions.length)
  }));
}
function getCleanMissions() {
  return missions.map(m => ({
    id: m.id,
    name: m.name,
    desc: m.desc,
    region: m.region,
    x: m.x,
    z: m.z,
    baseY: m.baseY,
    type: m.type
  }));
}

function getCleanPlayers() {
  return players.map(p => ({
    id: p.id,
    name: p.name,
    initials: p.initials,
    color: p.color,
    points: p.points,
    missionId: p.missionId
  }));
}

let gearChecklist = saved.gearChecklist || { laptop: false, access: false, tech: false, swag: false };
let contractChecklist = saved.contractChecklist || { contract: false, health: false, perks: false, vacation: false };
let humandChecklist = saved.humandChecklist || { appHumand: false, incidents: false, dining: false, hygiene: false };

const save = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      missions: getCleanMissions(),
      current,
      players: getCleanPlayers(),
      gearChecklist,
      contractChecklist,
      humandChecklist
    }));
  } catch (err) {
    console.error('Error saving state to localStorage:', err);
  }
};
const status = id => id < current ? 'done' : id === current ? 'active' : 'locked';

// ── Continuous Terrain Math with Flat Foundations ───────────────────────────
const frc = x => x - Math.floor(x);
const h2 = (x, y) => frc(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
function vnoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = frc(x), fy = frc(y);
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), L = THREE.MathUtils.lerp;
  return L(L(h2(ix, iy), h2(ix + 1, iy), u), L(h2(ix, iy + 1), h2(ix + 1, iy + 1), u), v);
}
function fbm(x, y, oct = 4) {
  let val = 0, amp = 0.5, freq = 1, sum = 0;
  for (let i = 0; i < oct; i++) { val += vnoise(x * freq, y * freq) * amp; sum += amp; amp *= 0.5; freq *= 2.0; }
  return val / sum;
}

function getTerrainY(wx, wz) {
  // 1. Natural Organic Terrain Baseline
  const s = 0.015;
  let h = fbm(wx * s + 3.7, wz * s + 1.4) * 4.8 - 0.7;
  h += fbm(wx * s * 3.5 + 7.1, wz * s * 3.5 + 2.9) * 0.7 - 0.25;

  // Mountain boundaries
  if (wz < -45) { const t = clamp((-45 - wz) / 38, 0, 1); h += t * t * (fbm(wx * s * 1.6 + 1.3, wz * s * 1.6 + 5.2) * 22 + 12); }
  if (wz > 58) { const t = clamp((wz - 58) / 32, 0, 1); h += t * t * (fbm(wx * s * 2.1 + 4.5, wz * s * 2.1 + 0.8) * 16 + 8); }
  if (wx < -135) { const t = clamp((-135 - wx) / 30, 0, 1); h += t * t * (fbm(wx * s * 1.7 + 2.1, wz * s * 1.7 + 6.3) * 18 + 9); }
  if (wx > 165) { const t = clamp((wx - 165) / 28, 0, 1); h += t * t * (fbm(wx * s * 1.7 + 8.5, wz * s * 1.7 + 3.1) * 22 + 14); }

  // 2. Lake Basin in the bay at (x = 55, z = -32)
  const ld = Math.hypot((wx - 55) * 0.7, wz + 32);
  if (ld < 38) {
    const lf = clamp(1 - ld / 38, 0, 1);
    h -= lf * lf * 7.5;
  }

  // 3. Winding River Channel carved from mountains to bay
  const riverCurve = Math.sin(wx * 0.035) * 16.0 + 8.0 - wx * 0.35;
  const rDist = Math.abs(wz - riverCurve);
  if (wx > -70 && wx < 65 && rDist < 9.0) {
    const rf = clamp(1.0 - (rDist / 9.0), 0, 1);
    h -= rf * rf * 2.6;
  }

  // 4. Smooth Plateau Blending for Each Unique Station Base Height
  let maxWeight = 0;
  let blendedH = h;
  for (const q of SEED) {
    const d = Math.hypot(wx - q.x, wz - q.z);
    const rFlat = q.type === 'castle' ? 15.0 : (q.type === 'harbor' || q.type === 'camp') ? 9.5 : 10.5;
    const rBlend = q.type === 'castle' ? 32.0 : 22.0;

    if (d <= rFlat) {
      return q.baseY;
    } else if (d < rBlend) {
      const t = (d - rFlat) / (rBlend - rFlat);
      const smooth = 1.0 - (t * t * (3 - 2 * t));
      if (smooth > maxWeight) {
        maxWeight = smooth;
        blendedH = THREE.MathUtils.lerp(h, q.baseY, smooth);
      }
    }
  }

  return blendedH;
}

// ── Scene, Camera & Renderer ─────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x8eb9c0, 0.009);

const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 3000);
const isLowEnd = (navigator.hardwareConcurrency || 4) <= 4;
const renderer = new THREE.WebGLRenderer({ canvas: $('game'), antialias: !isLowEnd, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, isLowEnd ? 1 : 1.25));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

// ── Sky & Atmosphere ─────────────────────────────────────────────────────────
const sky = new Sky();
sky.scale.setScalar(2500);
scene.add(sky);
const skyU = sky.material.uniforms;
skyU['turbidity'].value = 4.2;
skyU['rayleigh'].value = 1.4;
skyU['mieCoefficient'].value = 0.003;
skyU['mieDirectionalG'].value = 0.85;

// ── Clean Stylized Sunlight & Shadows ────────────────────────────────────────
const hemisphere = new THREE.HemisphereLight(0xfff7ec, 0x3b4c34, 2.0);
scene.add(hemisphere);

const sun = new THREE.DirectionalLight(0xffeed8, 3.5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0002;
sun.shadow.radius = 1.8;
scene.add(sun);
scene.add(sun.target);

const fill = new THREE.DirectionalLight(0x76a8bc, 0.5);
fill.position.set(70, 35, -55);
scene.add(fill);

function updateShadowTracker(targetVec) {
  sun.target.position.copy(targetVec);
  sun.position.set(targetVec.x + 30, targetVec.y + 45, targetVec.z + 30);
  sun.shadow.camera.left = -30;
  sun.shadow.camera.right = 30;
  sun.shadow.camera.top = 30;
  sun.shadow.camera.bottom = -30;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 120;
  sun.shadow.camera.updateProjectionMatrix();
}

function updateSky(elevation = 38, azimuth = -152) {
  const phi = THREE.MathUtils.degToRad(90 - elevation), theta = THREE.MathUtils.degToRad(azimuth);
  const sv = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
  skyU['sunPosition'].value.copy(sv);
}
updateSky();

// ── 5 Tiling Textures: Grass, Dirt, Cobblestone, Rock, Sand ──────────────────

function createProceduralTile(drawFn) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  drawFn(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  return tex;
}

const grassTile = createProceduralTile((ctx, size) => {
  ctx.fillStyle = '#569b35';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 450; i++) {
    const gx = Math.random() * size, gy = Math.random() * size;
    ctx.strokeStyle = Math.random() > 0.45 ? '#6ebb44' : '#45832a';
    ctx.lineWidth = 1.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + (Math.random() - 0.5) * 4, gy - 7); ctx.stroke();
  }
  for (let i = 0; i < 120; i++) {
    const cx = Math.random() * size, cy = Math.random() * size;
    ctx.fillStyle = Math.random() > 0.5 ? '#7ad44e' : '#3d7224';
    ctx.beginPath(); ctx.arc(cx, cy, 2, 0, Math.PI * 2); ctx.fill();
  }
  for (let i = 0; i < 20; i++) {
    const fx = Math.random() * size, fy = Math.random() * size;
    ctx.fillStyle = '#fffdf5';
    for (let p = 0; p < 5; p++) {
      const pa = (p / 5) * Math.PI * 2;
      ctx.beginPath(); ctx.arc(fx + Math.cos(pa) * 2, fy + Math.sin(pa) * 2, 1.2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#ffd53d';
    ctx.beginPath(); ctx.arc(fx, fy, 1.2, 0, Math.PI * 2); ctx.fill();
  }
});

const dirtTile = createProceduralTile((ctx, size) => {
  ctx.fillStyle = '#685038';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 600; i++) {
    const x = Math.random() * size, y = Math.random() * size;
    ctx.fillStyle = Math.random() > 0.5 ? '#7c6246' : '#523e2a';
    ctx.beginPath(); ctx.arc(x, y, 1.5 + Math.random() * 2.5, 0, Math.PI * 2); ctx.fill();
  }
  for (let i = 0; i < 80; i++) {
    const px = Math.random() * size, py = Math.random() * size;
    ctx.fillStyle = '#9e9282';
    ctx.beginPath(); ctx.arc(px, py, 2.5 + Math.random() * 2, 0, Math.PI * 2); ctx.fill();
  }
});

const cobbleTile = createProceduralTile((ctx, size) => {
  ctx.fillStyle = '#544638';
  ctx.fillRect(0, 0, size, size);
  const rows = 6, cols = 6;
  const rw = size / cols, rh = size / rows;
  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (rw * 0.5);
    for (let c = -1; c <= cols; c++) {
      const x = c * rw + offset + 3;
      const y = r * rh + 3;
      ctx.fillStyle = ((r + c) % 3 === 0) ? '#a29c92' : ((r + c) % 2 === 0) ? '#8e887e' : '#7c766a';
      ctx.beginPath();
      ctx.roundRect(x, y, rw - 6, rh - 6, 6);
      ctx.fill();
    }
  }
});

const rockTile = createProceduralTile((ctx, size) => {
  ctx.fillStyle = '#6e6c66';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 300; i++) {
    const x = Math.random() * size, y = Math.random() * size;
    ctx.fillStyle = Math.random() > 0.5 ? '#84827c' : '#585652';
    ctx.fillRect(x, y, 12 + Math.random() * 20, 6 + Math.random() * 10);
  }
});

const sandTile = createProceduralTile((ctx, size) => {
  ctx.fillStyle = '#c8b282';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 500; i++) {
    const x = Math.random() * size, y = Math.random() * size;
    ctx.fillStyle = Math.random() > 0.5 ? '#dbca9c' : '#b59e6c';
    ctx.beginPath(); ctx.arc(x, y, 1.2, 0, Math.PI * 2); ctx.fill();
  }
});

// ── Rustic Organic Trail Waypoints ───────────────────────────────────────────
const roadWaypoints = [
  new THREE.Vector3(-115, 0, 38),   // M1: Puesto de Inicio (Camp)
  new THREE.Vector3(-100, 0, 2),    // Valley pass
  new THREE.Vector3(-82, 0, -35),   // M2: Santuario del Pacto
  new THREE.Vector3(-66, 0, -8),    // River approach (Bridge 1)
  new THREE.Vector3(-45, 0, 22),    // M3: Humand & Comedor
  new THREE.Vector3(-28, 0, 40),    // Valley slope
  new THREE.Vector3(-12, 0, 52),    // M4: NPS y Voz del Cliente (Observatory cliff)
  new THREE.Vector3(5, 0, 42),      // Hilltop ridge
  new THREE.Vector3(22, 0, 26),     // M5: Consejo Laboral (Town Plaza)
  new THREE.Vector3(38, 0, -4),     // River crossing (Bridge 2)
  new THREE.Vector3(55, 0, -32),    // M6: Bahía de Comercio (Harbor)
  new THREE.Vector3(74, 0, -36),    // Coastal road
  new THREE.Vector3(90, 0, -38),    // M7: Gran Archivo de Ética
  new THREE.Vector3(104, 0, -8),    // Mountain pass climb
  new THREE.Vector3(115, 0, 18),    // M8: Forja Operativa (Forge & Windmill)
  new THREE.Vector3(132, 0, 34),    // Grand Mountain Ramp
  new THREE.Vector3(148, 0, 45)     // M9: Bastión de Cierre (Castle Peak)
];

const roadCurve = new THREE.CatmullRomCurve3(roadWaypoints, false, 'catmullrom', 0.25);
const trailPoints2D = roadCurve.getPoints(32).map(p => new THREE.Vector2(p.x, p.z));

// ── Multi-Texture Terrain Material with GPU Shader Splatting ─────────────────

const stationPositions = SEED.map(s => new THREE.Vector2(s.x, s.z));

const terrainMat = new THREE.MeshStandardMaterial({
  roughness: 1.0,
  metalness: 0.0,
  envMapIntensity: 0.0
});

terrainMat.onBeforeCompile = shader => {
  shader.uniforms.tGrass = { value: grassTile };
  shader.uniforms.tDirt = { value: dirtTile };
  shader.uniforms.tCobble = { value: cobbleTile };
  shader.uniforms.tRock = { value: rockTile };
  shader.uniforms.tSand = { value: sandTile };
  shader.uniforms.uStations = { value: stationPositions };
  shader.uniforms.uTrailPoints = { value: trailPoints2D };

  shader.vertexShader = `
    varying vec3 vWorldPos;
    varying vec3 vWorldNormal;
    ${shader.vertexShader}
  `.replace(
    '#include <worldpos_vertex>',
    `#include <worldpos_vertex>
     vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
     vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);`
  );

  shader.fragmentShader = `
    uniform sampler2D tGrass;
    uniform sampler2D tDirt;
    uniform sampler2D tCobble;
    uniform sampler2D tRock;
    uniform sampler2D tSand;
    uniform vec2 uStations[9];
    uniform vec2 uTrailPoints[33];
    varying vec3 vWorldPos;
    varying vec3 vWorldNormal;
    ${shader.fragmentShader}
  `.replace(
    '#include <map_fragment>',
    `
    vec2 uvGrass = vWorldPos.xz * 0.24;
    vec2 uvDirt = vWorldPos.xz * 0.24;
    vec2 uvCobble = vWorldPos.xz * 0.32;
    vec2 uvRock = vWorldPos.xz * 0.18;
    vec2 uvSand = vWorldPos.xz * 0.24;

    vec4 colGrass = texture2D(tGrass, uvGrass);
    vec4 colDirt = texture2D(tDirt, uvDirt);
    vec4 colCobble = texture2D(tCobble, uvCobble);
    vec4 colRock = texture2D(tRock, uvRock);
    vec4 colSand = texture2D(tSand, uvSand);

    // Distance to Trail Segments (Rustic Meandering Trail)
    float distToTrail = 999.0;
    for (int i = 0; i < 32; i++) {
      vec2 a = uTrailPoints[i];
      vec2 b = uTrailPoints[i + 1];
      vec2 pa = vWorldPos.xz - a, ba = b - a;
      float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
      float d = length(pa - ba * h);
      if (d < distToTrail) distToTrail = d;
    }

    // Procedural noise distortion on trail edges for rustic, frayed, organic feel
    float trailNoise = sin(vWorldPos.x * 0.38 + vWorldPos.z * 0.28) * 0.45 + cos(vWorldPos.x * 0.75 - vWorldPos.z * 0.55) * 0.25;
    float effectiveTrailDist = distToTrail + trailNoise;

    // Rustic worn pathway (~1.6m width, cobblestone + dirt blend with grass creeping in)
    float wTrail = smoothstep(1.65, 0.25, effectiveTrailDist);
    vec4 trailSurface = mix(colDirt, colCobble, 0.42);

    float minStationDist = 999.0;
    for (int i = 0; i < 9; i++) {
      float d = length(vWorldPos.xz - uStations[i]);
      if (d < minStationDist) minStationDist = d;
    }

    // Organic station clearings (subtle dirt/cobble courtyard)
    float stationNoise = sin(vWorldPos.x * 0.25 + vWorldPos.z * 0.25) * 0.6;
    float wStation = clamp(1.0 - ((minStationDist + stationNoise) / 7.5), 0.0, 1.0);
    wStation = smoothstep(0.0, 1.0, wStation);

    // Mountains are 100% vibrant green; only extreme vertical cliffs show subtle rock
    float slope = 1.0 - vWorldNormal.y;
    float wRock = smoothstep(0.72, 0.95, slope);

    float wSand = smoothstep(0.35, -0.2, vWorldPos.y);

    vec4 stationSurface = mix(colDirt, colCobble, 0.55);
    vec4 meadowSurface = colGrass;
    
    vec4 finalTerrain = mix(meadowSurface, trailSurface, wTrail * 0.88);
    finalTerrain = mix(finalTerrain, stationSurface, wStation * 0.85);
    finalTerrain = mix(finalTerrain, colRock, wRock * 0.55);
    finalTerrain = mix(finalTerrain, colSand, wSand * 0.95);

    diffuseColor *= finalTerrain;
    `
  );
};

// ── 100% Solid 3D Terrain Plane (Optimized for High Framerate) ───────────────
const terrainGeo = new THREE.PlaneGeometry(340, 220, 130, 85);
const posAttr = terrainGeo.attributes.position;
for (let i = 0; i < posAttr.count; i++) {
  const lx = posAttr.getX(i), ly = posAttr.getY(i);
  const wx = lx, wz = -ly;
  const h = getTerrainY(wx, wz);
  posAttr.setZ(i, h);
}
terrainGeo.computeVertexNormals();

const ground = new THREE.Mesh(terrainGeo, terrainMat);
ground.rotation.x = -Math.PI / 2;
ground.position.set(0, 0, 0);
ground.receiveShadow = true;
scene.add(ground);

// Volumetric Solid Rock Base / Skirt
{
  const skirtMat = new THREE.MeshStandardMaterial({ color: 0x3e3226, roughness: 1.0, metalness: 0.0, envMapIntensity: 0.0 });
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(340.2, 24, 220.2), skirtMat);
  skirt.position.set(0, -12.05, 0);
  skirt.receiveShadow = true;
  scene.add(skirt);
}

// ── Rustic 3D Trail Elements (Stepping Stones, Bridges, Lanterns) ─────────────
function createRusticTrailDetails() {
  const points = roadCurve.getPoints(160);

  // 1. Natural Stepping Stones embedded along the path
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8a8478, roughness: 0.95, metalness: 0.0 });
  for (let i = 4; i < points.length - 4; i += 2) {
    const pt = points[i];
    const nextPt = points[Math.min(points.length - 1, i + 1)];
    const dir = new THREE.Vector3().subVectors(nextPt, pt).normalize();
    const side = new THREE.Vector3(-dir.z, 0, dir.x).normalize();

    const sideOffset = (Math.sin(i * 1.8) * 0.65);
    const sx = pt.x + side.x * sideOffset;
    const sz = pt.z + side.z * sideOffset;
    const sy = getTerrainY(sx, sz);

    const stone = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28 + Math.sin(i) * 0.08, 0.35, 0.08, 6),
      stoneMat
    );
    stone.position.set(sx, sy + 0.03, sz);
    stone.rotation.y = i * 0.7;
    stone.rotation.x = (Math.sin(i * 3) * 0.08);
    stone.receiveShadow = true;
    scene.add(stone);
  }

  // 2. Spawn Wooden Bridges over the river crossings
  function createBridge(x, z, angle, length = 12) {
    const bridgeGroup = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x5b3e2b, roughness: 0.9, metalness: 0.0 });
    const postMat = new THREE.MeshStandardMaterial({ color: 0x3d281a, roughness: 0.95, metalness: 0.0 });

    const plankCount = Math.floor(length / 0.45);
    for (let p = 0; p < plankCount; p++) {
      const pOffset = -length * 0.5 + p * 0.45;
      const plank = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.16, 0.38), woodMat);
      const arch = Math.sin((p / (plankCount - 1)) * Math.PI) * 0.45;
      plank.position.set(0, arch + 0.15, pOffset);
      plank.castShadow = true;
      plank.receiveShadow = true;
      bridgeGroup.add(plank);
    }

    for (const sideX of [-1.45, 1.45]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, length), woodMat);
      rail.position.set(sideX, 0.9, 0);
      bridgeGroup.add(rail);

      for (let p = -length * 0.5; p <= length * 0.5; p += 2.2) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 1.1, 8), postMat);
        post.position.set(sideX, 0.45, p);
        post.castShadow = true;
        bridgeGroup.add(post);
      }
    }

    const y = getTerrainY(x, z);
    bridgeGroup.position.set(x, y + 0.02, z);
    bridgeGroup.rotation.y = angle;
    scene.add(bridgeGroup);
  }

  createBridge(-66, -8, 0.35, 14);
  createBridge(38, -4, -0.42, 14);

  // 3. Spawn Trail Lanterns along road curves
  const lanternIndices = [12, 32, 54, 76, 98, 120, 142];
  lanternIndices.forEach(idx => {
    if (idx >= points.length) return;
    const pt = points[idx];
    const nextPt = points[Math.min(points.length - 1, idx + 1)];
    const dir = new THREE.Vector3().subVectors(nextPt, pt).normalize();
    const side = new THREE.Vector3(-dir.z, 0, dir.x).normalize();

    const lx = pt.x + side.x * 2.0;
    const lz = pt.z + side.z * 2.0;
    const ly = getTerrainY(lx, lz);

    const postGroup = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a3220, roughness: 0.9 });
    const lampMat = new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xd49b29, emissiveIntensity: 2.5, roughness: 0.3 });

    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.10, 2.2, 8), woodMat);
    post.position.y = 1.1;
    post.castShadow = true;
    postGroup.add(post);

    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.45), woodMat);
    arm.position.set(0, 2.0, -0.2);
    postGroup.add(arm);

    const lantern = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), lampMat);
    lantern.position.set(0, 1.85, -0.4);
    postGroup.add(lantern);

    const light = new THREE.PointLight(0xffb84d, 1.8, 8);
    light.position.set(0, 1.85, -0.4);
    postGroup.add(light);

    postGroup.position.set(lx, ly, lz);
    scene.add(postGroup);
  });
}
createRusticTrailDetails();

// ── Water, Motes & Atmosphere ────────────────────────────────────────────────
const anim = { water: [], poi: [], players: [], clouds: [], motes: null, streamer: null };
{
  const wGeo = new THREE.PlaneGeometry(120, 90, 40, 30);
  wGeo.rotateX(-Math.PI / 2);
  const waterMat = new THREE.MeshPhysicalMaterial({
    color: 0x1a728a,
    roughness: 0.08,
    metalness: 0.04,
    clearcoat: 0.8,
    clearcoatRoughness: 0.08,
    transparent: true,
    opacity: 0.88,
    transmission: 0.35,
    ior: 1.333
  });
  waterMat.onBeforeCompile = shader => {
    shader.uniforms.uTime = { value: 0 };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.y+=sin(uTime*1.2+position.x*0.2+position.z*0.18)*0.12+cos(uTime*0.8+position.x*0.12-position.z*0.2)*0.08;');
    waterMat.userData.shader = shader;
  };
  const water = new THREE.Mesh(wGeo, waterMat);
  water.position.set(55, 0.05, -32);
  scene.add(water);
  anim.water.push(water);
}

{
  const moteCount = 180;
  const motePos = new Float32Array(moteCount * 3);
  const motePhases = new Float32Array(moteCount);
  for (let i = 0; i < moteCount; i++) {
    motePos[i * 3] = rnd(-100, 105);
    motePos[i * 3 + 1] = rnd(1.5, 12);
    motePos[i * 3 + 2] = rnd(-55, 60);
    motePhases[i] = rnd(0, Math.PI * 2);
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  const moteMat = new THREE.PointsMaterial({
    color: 0xffea9f,
    size: 0.22,
    transparent: true,
    opacity: 0.75,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const moteSystem = new THREE.Points(moteGeo, moteMat);
  scene.add(moteSystem);
  anim.motes = { system: moteSystem, phases: motePhases, count: moteCount };
}

function cloud() {
  const g = new THREE.Group(), ma = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.42, depthWrite: false });
  for (let i = 0; i < 5; i++) {
    const c = new THREE.Mesh(new THREE.SphereGeometry(rnd(3.5, 6.5), 8, 5), ma);
    c.position.set(rnd(-6, 6), rnd(-1, 1), rnd(-3, 3));
    c.scale.y = 0.45;
    g.add(c);
  }
  g.position.set(rnd(-110, 110), rnd(24, 35), rnd(-60, 60));
  g.userData.speed = rnd(0.25, 0.55);
  scene.add(g); anim.clouds.push(g);
}
for (let i = 0; i < 8; i++) cloud();

// ── Install World & Progressive Streamer ─────────────────────────────────────
const worldReady = installRealisticWorld({
  scene,
  missions,
  getTerrainY,
  onProgress: (value, label) => {
    const p = $('boot')?.querySelector('p'), bar = $('boot')?.querySelector('.boot-line i');
    if (p) p.textContent = label;
    if (bar) bar.style.width = Math.round(value * 100) + '%';
  }
}).then(streamer => {
  anim.streamer = streamer;
  missions.forEach(q => {
    if (q.structGroup) anim.poi.push(q.structGroup);
  });
}).catch(error => console.error('Error inicializando streaming:', error));

// ── Players / Adventurers Management ──────────────────────────────────────────
function rebuildPlayers(startMission = null, targetMission = null) {
  const toRemove = [];
  scene.traverse(obj => {
    if (obj && obj.name && typeof obj.name === 'string' && obj.name.startsWith('Player_')) {
      toRemove.push(obj);
    }
  });
  toRemove.forEach(obj => scene.remove(obj));
  anim.players.forEach(x => scene.remove(x));
  anim.players = [];

  players.forEach((p, i) => {
    const q = missions[(p.missionId || current) - 1] || missions[0];
    p.totalInStation = players.filter(o => (o.missionId || current) === (p.missionId || current)).length;
    const char = createHumanoidCharacter(p, i, q, getTerrainY, targetMission, startMission);
    scene.add(char);
    anim.players.push(char);
  });
}

function updateNavButtons() {
  const isFirst = current <= 1;
  const isLast = current >= missions.length;

  const cardBack = document.getElementById('cardBackBtn');
  if (cardBack) {
    cardBack.disabled = isFirst;
    cardBack.style.opacity = isFirst ? '0.35' : '1.0';
    cardBack.style.cursor = isFirst ? 'not-allowed' : 'pointer';
    cardBack.title = isFirst ? 'Estás en la primera misión' : `Ir a Misión ${current - 1}`;
  }

  const cardNext = document.getElementById('cardNextBtn');
  if (cardNext) {
    cardNext.disabled = isLast;
    cardNext.style.opacity = isLast ? '0.35' : '1.0';
    cardNext.style.cursor = isLast ? 'not-allowed' : 'pointer';
    cardNext.title = isLast ? 'Has llegado a la última misión' : `Ir a Misión ${current + 1}`;
  }

  const hudPrev = document.getElementById('hudPrevBtn');
  if (hudPrev) {
    hudPrev.disabled = isFirst;
    hudPrev.style.opacity = isFirst ? '0.35' : '1.0';
  }

  const hudNext = document.getElementById('hudNextBtn');
  if (hudNext) {
    hudNext.disabled = isLast;
    hudNext.style.opacity = isLast ? '0.35' : '1.0';
  }
}

function applyStates() {
  renderUI();
}

function renderUI() {
  const q = missions[current - 1] || missions[0];
  const pct = Math.round((current / missions.length) * 100);

  // Update Mission Card in Sidebar
  const mEyebrow = document.getElementById('missionEyebrow');
  if (mEyebrow) {
    mEyebrow.textContent = `CHECKPOINT ${String(current).padStart(2, '0')}/09 · ${q.region.toUpperCase()}`;
  }

  const mName = document.getElementById('missionName');
  if (mName) {
    mName.textContent = q.name;
    mName.classList.remove('pulse-update');
    void mName.offsetWidth;
    mName.classList.add('pulse-update');
  }

  const mDesc = document.getElementById('missionDesc');
  if (mDesc) {
    mDesc.textContent = q.desc;
    mDesc.classList.remove('pulse-update');
    void mDesc.offsetWidth;
    mDesc.classList.add('pulse-update');
  }

  const mNum = document.getElementById('missionNumber');
  if (mNum) mNum.textContent = String(current).padStart(2, '0');

  const pPct = document.getElementById('progressPct');
  if (pPct) pPct.textContent = pct + '%';

  const mStatus = document.getElementById('missionStatus');
  if (mStatus) mStatus.textContent = current === missions.length ? 'Último Checkpoint' : 'En curso';

  const numEl = document.getElementById('skyMissionNum');
  if (numEl) numEl.textContent = `MISIÓN ${String(current).padStart(2, '0')}`;

  const nameEl = document.getElementById('skyMissionName');
  if (nameEl) nameEl.textContent = q.name.toUpperCase();

  const regEl = document.getElementById('skyMissionRegion');
  if (regEl) regEl.textContent = q.region;

  // Navigation button states
  updateNavButtons();

  // Render clickable missions list
  renderMissionsList();

  // Render Clean Scoreboard / Ranking Leaderboard
  const rankList = document.getElementById('rankingList');
  if (rankList) {
    rankList.innerHTML = players.length
      ? [...players].sort((a, b) => b.points - a.points).map((p, i) => `
        <div class="rank">
          <b style="font-size:${i === 0 ? '1rem' : '0.8rem'}">${i === 0 ? '👑' : i + 1}</b>
          <span class="avatar-dot" style="background:${p.color}">${p.initials}</span>
          <div class="rank-info">
            <b>${p.name}</b>
            <small>${i === 0 ? '👑 Líder de la expedición' : 'En travesía'}</small>
          </div>
          <span class="xp-pill">${p.points} XP</span>
        </div>`).join('')
      : '<p style="color:var(--muted);font-size:.78rem;padding:8px;text-align:center">No hay aventureros aún. Regístralos en el Panel de Control.</p>';
  }

  // Render Admin Interactive Players List (Direct buttons)
  const adminPList = document.getElementById('adminPlayersList');
  if (adminPList) {
    adminPList.innerHTML = players.length
      ? players.map(p => `
        <div class="admin-player-row">
          <div class="admin-player-info">
            <span class="avatar-dot" style="background:${p.color};width:26px;height:26px;font-size:0.68rem">${p.initials}</span>
            <b style="font-size:0.8rem">${p.name}</b>
            <span class="xp-pill" style="font-size:0.72rem;padding:2px 7px">${p.points} XP</span>
          </div>
          <div class="admin-player-actions">
            <button class="quick-xp-btn" onclick="window.modifyXp(${p.id}, 5)" type="button" title="Sumar 5 XP a ${p.name}">+5 XP</button>
            <button class="quick-xp-btn" onclick="window.modifyXp(${p.id}, 10)" type="button" title="Sumar 10 XP a ${p.name}">+10 XP</button>
            <button class="quick-xp-btn" onclick="window.modifyXp(${p.id}, -5)" type="button" title="Restar 5 XP a ${p.name}">-5 XP</button>
            <button class="quick-xp-btn del" onclick="window.deletePlayer(${p.id})" type="button" title="Eliminar a ${p.name}">🗑️</button>
          </div>
        </div>`).join('')
      : '<p style="color:var(--muted);font-size:.78rem;padding:8px;text-align:center">No hay aventureros registrados aún. Usa el campo de arriba para añadir.</p>';
  }

  const opts = missions.map(x => `<option value="${x.id}">${String(x.id).padStart(2, '0')} · ${x.name}</option>`).join('');
  const sessSel = document.getElementById('sessionSelect');
  if (sessSel) {
    sessSel.innerHTML = opts;
    sessSel.value = current;
  }

  const editSel = document.getElementById('missionEditorSelect');
  if (editSel) {
    const prevEditVal = editSel.value;
    editSel.innerHTML = opts;
    if (prevEditVal && missions.some(m => String(m.id) === prevEditVal)) {
      editSel.value = prevEditVal;
    } else {
      editSel.value = current;
    }
  }

  updatePlayerSelect();
  loadEditor(+(editSel?.value || current));
}

function updatePlayerSelect(selectedId = null) {
  const pSel = document.getElementById('playerSelect');
  if (!pSel) return;

  if (!players.length) {
    pSel.innerHTML = '<option value="">(No hay participantes registrados)</option>';
    pSel.disabled = true;
    return;
  }

  pSel.disabled = false;
  pSel.innerHTML = players.map(p => `<option value="${p.id}">👤 ${p.name} · ${p.points} XP</option>`).join('');

  if (selectedId && players.some(p => p.id === selectedId)) {
    pSel.value = String(selectedId);
  } else if (pSel.value && players.some(p => String(p.id) === pSel.value)) {
    // keep valid current selection
  } else {
    pSel.value = String(players[0].id);
  }
}

function renderMissionsList() {
  const mList = document.getElementById('missionsList');
  if (!mList) return;
  mList.innerHTML = missions.map(x => {
    const isDone = x.id < current;
    const isActive = x.id === current;
    const stateClass = isDone ? 'done' : isActive ? 'active' : 'available';
    const badgeContent = isDone ? '✓' : String(x.id);
    const statusText = isDone ? '✓ Completada' : isActive ? '📍 En curso' : 'Explorar';
    return `
      <div class="mission-row ${stateClass}" data-id="${x.id}" role="button" tabindex="0" title="Haz clic para volar a ${x.name}">
        <span class="badge">${badgeContent}</span>
        <span class="mission-info"><b>${x.name}</b><small>${x.region}</small></span>
        <span class="status-pill">${statusText}</span>
      </div>`;
  }).join('');

  mList.querySelectorAll('.mission-row').forEach(row => {
    row.onclick = () => {
      const id = +row.getAttribute('data-id');
      if (id) setMission(id, true);
    };
  });
}

function setJourneyCopy(msg) {
  const el = document.getElementById('journeyCopy');
  if (el) el.textContent = msg;
}

// ── Cinematic Camera Shots ───────────────────────────────────────────────────
let travel = null;
const SHOTS = {
  1: { o: [4.2, 5.8, 8.5], h: 1.2 },
  2: { o: [4.8, 6.8, 9.2], h: 1.5 },
  3: { o: [4.5, 6.5, 9.0], h: 1.4 },
  4: { o: [5.2, 7.8, 10.2], h: 2.0 },
  5: { o: [5.2, 7.8, 10.2], h: 2.0 },
  6: { o: [4.8, 6.8, 9.2], h: 1.5 },
  7: { o: [5.2, 7.5, 10.2], h: 2.0 },
  8: { o: [5.0, 7.2, 9.8], h: 1.8 },
  9: { o: [7.0, 10.5, -13.0], h: 4.2 }
};

function cameraPose(q) {
  const s = SHOTS[q.id] || SHOTS[1];
  const wy = getTerrainY(q.x, q.z);
  return {
    pos: new THREE.Vector3(q.x + s.o[0], wy + s.o[1], q.z + s.o[2]),
    look: new THREE.Vector3(q.x, wy + s.h, q.z)
  };
}

function cinematicEase(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

function startTravel(id, show = true) {
  if (freeCamera) setFreeCamera(false);
  const destination = missions[id - 1];
  const targetPose = cameraPose(destination);

  travel = {
    startPos: camera.position.clone(),
    endPos: targetPose.pos.clone(),
    startLook: lookTarget.clone(),
    endLook: targetPose.look.clone(),
    t: 0,
    duration: 2.4
  };

  cinematicUI(true);
}

function cinematicUI(active, phase = '') {
  const layer = document.getElementById('cinematicSequence'), stage = document.getElementById('stage');
  if (layer) layer.classList.toggle('active', active);
  if (stage) stage.classList.toggle('cinematic-running', active);
  const label = document.getElementById('cinematicPhase'), bar = document.getElementById('cinematicBar');
  if (label && phase) label.textContent = phase;
  if (bar && !active) bar.style.width = '0%';
}

const first = cameraPose(missions[current - 1]);
camera.position.copy(first.pos);
let lookTarget = first.look.clone();
updateShadowTracker(lookTarget);

const labelLayer = document.getElementById('characterLabels');
const checkpointLabelsLayer = document.getElementById('checkpointLabels');

// ── Free Camera Orbit & WASD Controls (100% Unconstrained) ───────────────────
let freeCamera = false;
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enabled = false;
orbit.enableDamping = true;
orbit.dampingFactor = 0.08;
orbit.rotateSpeed = 0.85;
orbit.zoomSpeed = 1.2;
orbit.panSpeed = 1.2;
orbit.screenSpacePanning = true;
orbit.minDistance = 1.8;
orbit.maxDistance = 350;
orbit.minPolarAngle = 0.04;
orbit.maxPolarAngle = Math.PI / 2 - 0.02;
orbit.target.copy(lookTarget);

// Keyboard WASD Flight Controls for Free Camera
const keys = { w: false, a: false, s: false, d: false, q: false, e: false, shift: false };
window.addEventListener('keydown', e => {
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
  const k = e.key.toLowerCase();
  if (k === 'w' || e.key === 'ArrowUp') keys.w = true;
  if (k === 's' || e.key === 'ArrowDown') keys.s = true;
  if (k === 'a' || e.key === 'ArrowLeft') keys.a = true;
  if (k === 'd' || e.key === 'ArrowRight') keys.d = true;
  if (k === 'q') keys.q = true;
  if (k === 'e') keys.e = true;
  if (e.shiftKey) keys.shift = true;
});
window.addEventListener('keyup', e => {
  const k = e.key.toLowerCase();
  if (k === 'w' || e.key === 'ArrowUp') keys.w = false;
  if (k === 's' || e.key === 'ArrowDown') keys.s = false;
  if (k === 'a' || e.key === 'ArrowLeft') keys.a = false;
  if (k === 'd' || e.key === 'ArrowRight') keys.d = false;
  if (k === 'q') keys.q = false;
  if (k === 'e') keys.e = false;
  if (!e.shiftKey) keys.shift = false;
});

const freeCameraBtn = document.getElementById('freeCameraBtn');
function setFreeCamera(enabled) {
  freeCamera = enabled;
  orbit.enabled = enabled;
  if (freeCameraBtn) {
    freeCameraBtn.classList.toggle('active', enabled);
    freeCameraBtn.setAttribute('aria-pressed', String(enabled));
    freeCameraBtn.title = enabled
      ? 'Cámara libre: Activada (Usa ratón o teclas W,A,S,D para volar libremente)'
      : 'Cámara libre: Desactivada (Clic para explorar libremente)';
  }
  if (enabled) {
    travel = null;
    cinematicUI(false);
    orbit.target.copy(lookTarget);
    orbit.update();
  }
}
freeCameraBtn?.addEventListener('click', () => setFreeCamera(!freeCamera));

// ── Weather & Atmospheric Presets ───────────────────────────────────────────
const weatherNames = ['Día claro', 'Nublado', 'Lluvia', 'Atardecer'];
const weatherIcons = ['☀️', '☁️', '🌧️', '🌅'];
let weatherIndex = 0, weatherBlend = 0, weatherTarget = 0, lastLightning = 0;
const weatherBtn = document.getElementById('weatherBtn'), weatherOverlay = document.getElementById('weatherOverlay'), lightningFlash = document.getElementById('lightningFlash');
const rainCount = 1000, rainPos = new Float32Array(rainCount * 3);
for (let i = 0; i < rainCount; i++) {
  rainPos[i * 3] = rnd(-110, 110);
  rainPos[i * 3 + 1] = rnd(2, 42);
  rainPos[i * 3 + 2] = rnd(-65, 65);
}
const rainGeo = new THREE.BufferGeometry();
rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
const rainMat = new THREE.PointsMaterial({ color: 0xcde8ef, size: 0.08, transparent: true, opacity: 0, depthWrite: false });
const rainSystem = new THREE.Points(rainGeo, rainMat);
rainSystem.visible = false;
scene.add(rainSystem);

const SKY_PRESETS = [
  { turbidity: 4.5, rayleigh: 1.6, mie: 0.005, mieG: 0.85, elevation: 36, azimuth: -152, sunHex: 0xffeed8, sunInt: 3.5, hemiInt: 2.0, exp: 1.05, fogExp: 0.009 },
  { turbidity: 14, rayleigh: 0.95, mie: 0.006, mieG: 0.79, elevation: 28, azimuth: -155, sunHex: 0xd8e4e4, sunInt: 2.0, hemiInt: 1.6, exp: 0.95, fogExp: 0.014 },
  { turbidity: 24, rayleigh: 0.45, mie: 0.007, mieG: 0.74, elevation: 15, azimuth: -155, sunHex: 0xc2d4d4, sunInt: 1.1, hemiInt: 1.2, exp: 0.82, fogExp: 0.018 },
  { turbidity: 8, rayleigh: 4.5, mie: 0.009, mieG: 0.86, elevation: 6, azimuth: -148, sunHex: 0xffa95e, sunInt: 3.4, hemiInt: 1.8, exp: 1.04, fogExp: 0.012 }
];
const FOG_COLORS = [0x8eb9c0, 0x829698, 0x647e82, 0xc4956e];

function applyWeather(index) {
  weatherIndex = index; weatherTarget = index;
  if (weatherBtn) {
    weatherBtn.textContent = weatherIcons[index];
    weatherBtn.title = 'Clima: ' + weatherNames[index] + ' (Clic para cambiar)';
  }
  if (weatherOverlay) weatherOverlay.className = 'weather-overlay ' + (['', 'cloudy', 'rain', 'golden'][index]);
  rainSystem.visible = index === 2;
  const p = SKY_PRESETS[index];
  skyU['turbidity'].value = p.turbidity;
  skyU['rayleigh'].value = p.rayleigh;
  skyU['mieCoefficient'].value = p.mie;
  skyU['mieDirectionalG'].value = p.mieG;
  updateSky(p.elevation, p.azimuth);
  sun.color.setHex(p.sunHex);
  sun.intensity = p.sunInt;
  hemisphere.intensity = p.hemiInt;
  renderer.toneMappingExposure = p.exp;
}
weatherBtn?.addEventListener('click', () => applyWeather((weatherIndex + 1) % weatherNames.length));

// ── Fullscreen Controls (Oculta la barra lateral y expande el mapa al 100%) ──
const fullscreenBtn = document.getElementById('fullscreenBtn');
const screenEl = document.getElementById('screen');
function toggleFullscreenMode() {
  const isFs = screenEl?.classList.toggle('fullscreen-mode');
  if (fullscreenBtn) {
    fullscreenBtn.textContent = isFs ? '🗗' : '⛶';
    fullscreenBtn.title = isFs ? 'Salir de Pantalla Completa' : 'Pantalla Completa';
    fullscreenBtn.classList.toggle('active', isFs);
  }
  if (isFs && !document.fullscreenElement) {
    document.documentElement.requestFullscreen?.().catch(() => {});
  } else if (!isFs && document.fullscreenElement) {
    document.exitFullscreen?.().catch(() => {});
  }
  setTimeout(resize, 40);
}

if (fullscreenBtn) {
  fullscreenBtn.addEventListener('click', toggleFullscreenMode);
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && screenEl?.classList.contains('fullscreen-mode')) {
      toggleFullscreenMode();
    }
  });
}

// ── Boot Loading Screen ─────────────────────────────────────────────────────
const bootScreen = document.getElementById('boot');
if (bootScreen) {
  setTimeout(() => {
    bootScreen.classList.add('hidden');
    setTimeout(() => { try { bootScreen.remove(); } catch {} }, 700);
  }, 900);
}

function updateWeather(t, dt) {
  weatherBlend += (weatherTarget - weatherBlend) * Math.min(1, dt * 1.2);
  const lo = Math.floor(weatherBlend), hi = Math.min(3, Math.ceil(weatherBlend)), f = weatherBlend - lo;
  scene.fog.color.lerpColors(new THREE.Color(FOG_COLORS[lo]), new THREE.Color(FOG_COLORS[hi]), f);
  scene.fog.density = THREE.MathUtils.lerp(SKY_PRESETS[lo].fogExp, SKY_PRESETS[hi].fogExp, f);
  if (weatherIndex === 2) {
    const a = rainGeo.attributes.position;
    for (let i = 0; i < a.count; i++) {
      let y = a.getY(i) - dt * 26;
      if (y < 0) y = rnd(28, 45);
      a.setY(i, y);
    }
    a.needsUpdate = true;
    rainSystem.position.x = camera.position.x * 0.28;
    rainSystem.position.z = camera.position.z * 0.28;
    rainMat.opacity = 0.50;
    if (t - lastLightning > rnd(9, 17)) {
      lastLightning = t;
      if (lightningFlash) lightningFlash.style.opacity = '0.22';
      setTimeout(() => { if (lightningFlash) lightningFlash.style.opacity = '0'; }, 85);
    }
  } else {
    rainMat.opacity = Math.max(0, rainMat.opacity - dt * 2);
  }
}

// ── Control Panel & Left Sidebar Navigation ──────────────────────────────────

function prevMission() {
  if (current <= 1) return;
  setMission(current - 1, true);
}

function nextMission() {
  if (current >= missions.length) return;
  setMission(current + 1, true);
}

function setMission(id, move = true) {
  const targetId = clamp(Number(id) || 1, 1, missions.length);
  const startMission = missions[current - 1];
  current = targetId;
  const targetMission = missions[current - 1];

  // Direct DOM updates for instant responsiveness
  const mEyebrow = document.getElementById('missionEyebrow');
  if (mEyebrow) mEyebrow.textContent = `CHECKPOINT ${String(current).padStart(2, '0')}/09 · ${targetMission.region.toUpperCase()}`;

  const mName = document.getElementById('missionName');
  if (mName) {
    mName.textContent = targetMission.name;
    mName.classList.remove('pulse-update');
    void mName.offsetWidth;
    mName.classList.add('pulse-update');
  }

  const mDesc = document.getElementById('missionDesc');
  if (mDesc) {
    mDesc.textContent = targetMission.desc;
    mDesc.classList.remove('pulse-update');
    void mDesc.offsetWidth;
    mDesc.classList.add('pulse-update');
  }

  const mNum = document.getElementById('missionNumber');
  if (mNum) mNum.textContent = String(current).padStart(2, '0');

  const pPct = document.getElementById('progressPct');
  if (pPct) pPct.textContent = Math.round((current / missions.length) * 100) + '%';

  const mStatus = document.getElementById('missionStatus');
  if (mStatus) mStatus.textContent = current === missions.length ? 'Último Checkpoint' : 'En curso';

  renderMissionsList();
  updateNavButtons();

  if (move) {
    players.forEach(p => p.missionId = current);
    rebuildPlayers(startMission, targetMission);
  }

  save();
  applyStates();
  startTravel(current, true);
}

function loadEditor(id) {
  const q = missions[id - 1];
  if (!q) return;
  const editN = document.getElementById('missionEditName');
  if (editN) editN.value = q.name;
  const editD = document.getElementById('missionEditDesc');
  if (editD) editD.value = q.desc;
  const editR = document.getElementById('missionEditRegion');
  if (editR) editR.value = q.region;
}

// Attach event listeners reliably using addEventListener
document.getElementById('advanceMissionBtn')?.addEventListener('click', nextMission);
document.getElementById('backMissionBtn')?.addEventListener('click', prevMission);
document.getElementById('cardNextBtn')?.addEventListener('click', nextMission);
document.getElementById('cardBackBtn')?.addEventListener('click', prevMission);
document.getElementById('hudNextBtn')?.addEventListener('click', nextMission);
document.getElementById('hudPrevBtn')?.addEventListener('click', prevMission);

// ── 3D Interactive Raycasting Click Detection on Map Stations ────────────────
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let pointerDownPos = { x: 0, y: 0 };

renderer.domElement.addEventListener('pointerdown', e => {
  pointerDownPos = { x: e.clientX, y: e.clientY };
});

renderer.domElement.addEventListener('pointerup', e => {
  const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
  if (dist > 8) return;

  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(scene.children, true);

  for (const hit of intersects) {
    let obj = hit.object;
    while (obj && obj !== scene) {
      if (obj.userData?.mission) {
        setMission(obj.userData.mission.id, true);
        return;
      }
      obj = obj.parent;
    }
  }
});

function addParticipant(name) {
  const n = String(name || '').trim();
  if (!n) {
    alert('Por favor escribe el nombre de un participante.');
    return;
  }
  const maxId = players.reduce((max, p) => Math.max(max, Number(p.id) || 0), 0);
  const id = maxId + 1;
  const newP = {
    id,
    name: n,
    initials: initials(n),
    color: colors[(id - 1) % colors.length],
    points: 0,
    missionId: current
  };
  players.push(newP);
  rebuildPlayers();
  save();
  renderUI();
  updatePlayerSelect(newP.id);
}

window.addParticipant = addParticipant;

window.modifyXp = function(id, delta) {
  const p = players.find(x => x.id === Number(id));
  if (p) {
    p.points = Math.max(0, (Number(p.points) || 0) + delta);
    rebuildPlayers();
    save();
    renderUI();
    updatePlayerSelect(p.id);
  }
};

window.deletePlayer = function(id) {
  const p = players.find(x => x.id === Number(id));
  if (p && confirm(`¿Deseas eliminar a "${p.name}" de la expedición?`)) {
    players = players.filter(x => x.id !== Number(id));
    rebuildPlayers();
    save();
    renderUI();
    updatePlayerSelect(players[0]?.id || null);
  }
};

window.addParticipantFromUI = function() {
  const inp = document.getElementById('quickPlayerName');
  const val = (inp?.value || '').trim();
  if (!val) {
    alert('Por favor escribe el nombre de un participante antes de añadir.');
    inp?.focus();
    return;
  }
  inp.value = '';
  addParticipant(val);
};

const quickAddBtn = document.getElementById('quickAddPlayerBtn');
if (quickAddBtn) {
  quickAddBtn.onclick = () => window.addParticipantFromUI();
}

const quickInput = document.getElementById('quickPlayerName');
if (quickInput) {
  quickInput.onkeydown = e => {
    if (e.key === 'Enter') {
      window.addParticipantFromUI();
    }
  };
}

// ── Control Panel Event Listeners ─────────────────────────────────────────────
document.getElementById('adminToggle')?.addEventListener('click', () => {
  document.getElementById('adminDrawer')?.classList.toggle('open');
});

document.getElementById('rankingToggle')?.addEventListener('click', () => {
  document.getElementById('rankingList')?.classList.toggle('collapsed');
});

document.getElementById('sessionSelect')?.addEventListener('change', e => {
  const targetId = +e.target.value;
  if (targetId) setMission(targetId, true);
});

window.grantTeamXp = function(amount = 10) {
  if (!players.length) {
    alert('Primero añade al menos un participante para otorgar puntos al equipo.');
    return;
  }
  players.forEach(p => {
    p.points = Math.max(0, (Number(p.points) || 0) + amount);
  });
  save();
  rebuildPlayers();
  renderUI();
  setJourneyCopy(`+${amount} XP otorgados a todos los integrantes.`);
};

window.syncAllPlayersToCurrent = function() {
  if (!players.length) {
    alert('Primero añade aventureros en la sección de Expedición.');
    return;
  }
  players.forEach(p => p.missionId = current);
  save();
  rebuildPlayers();
  setJourneyCopy('Todo el equipo ha sido reunido en: ' + missions[current - 1].name);
};

document.getElementById('syncAllBtn')?.addEventListener('click', () => window.syncAllPlayersToCurrent());
document.getElementById('grantTeamXpBtn')?.addEventListener('click', () => window.grantTeamXp(10));

window.modifyPlayerXpFromSelect = function(sign) {
  if (!players.length) {
    alert('Primero añade al menos un participante en el campo de arriba.');
    return;
  }
  const pSel = document.getElementById('playerSelect');
  let playerId = Number(pSel?.value);
  if (!playerId || !players.some(p => p.id === playerId)) {
    playerId = players[0].id;
  }
  const delta = Math.max(1, Number(document.getElementById('pointsInput')?.value) || 10);
  window.modifyXp(playerId, sign * delta);
};

window.deletePlayerFromSelect = function() {
  if (!players.length) return;
  const pSel = document.getElementById('playerSelect');
  let playerId = Number(pSel?.value);
  if (!playerId || !players.some(p => p.id === playerId)) {
    playerId = players[0].id;
  }
  window.deletePlayer(playerId);
};

document.getElementById('addPointsBtn')?.addEventListener('click', () => window.modifyPlayerXpFromSelect(1));
document.getElementById('removePointsBtn')?.addEventListener('click', () => window.modifyPlayerXpFromSelect(-1));
document.getElementById('removePlayerBtn')?.addEventListener('click', () => window.deletePlayerFromSelect());

document.getElementById('missionEditorSelect')?.addEventListener('change', e => {
  loadEditor(+e.target.value);
});

document.getElementById('saveMissionBtn')?.addEventListener('click', () => {
  const sel = document.getElementById('missionEditorSelect');
  const targetId = +(sel?.value || 1);
  const q = missions[targetId - 1];
  if (q) {
    const n = document.getElementById('missionEditName')?.value.trim();
    const d = document.getElementById('missionEditDesc')?.value.trim();
    const r = document.getElementById('missionEditRegion')?.value.trim();
    if (n) q.name = n;
    if (d) q.desc = d;
    if (r) q.region = r;
    
    save();
    renderUI();

    // Show visual confirmation pill
    const fb = document.getElementById('saveFeedback');
    if (fb) {
      fb.style.display = 'inline-block';
      setTimeout(() => { fb.style.display = 'none'; }, 2200);
    }
  }
});

document.getElementById('resetBtn')?.addEventListener('click', () => {
  if (confirm('¿Deseas reiniciar toda la experiencia a los valores iniciales?')) {
    localStorage.removeItem(KEY);
    location.reload();
  }
});

document.getElementById('exportBtn')?.addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify({ missions, current, players, gearChecklist, contractChecklist, humandChecklist }, null, 2)], { type: 'application/json' }));
  a.download = 'next-gen-onboarding-completo.json';
  a.click();
});

document.getElementById('importBtn')?.addEventListener('click', () => document.getElementById('importFile')?.click());
document.getElementById('importFile')?.addEventListener('change', e => {
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (d.missions) missions = d.missions;
      if (d.current) current = d.current;
      if (d.players) players = d.players;
      if (d.gearChecklist) gearChecklist = d.gearChecklist;
      if (d.contractChecklist) contractChecklist = d.contractChecklist;
      if (d.humandChecklist) humandChecklist = d.humandChecklist;
      save();
      location.reload();
    } catch {
      alert('El archivo de respaldo no es válido.');
    }
  };
  r.readAsText(e.target.files[0]);
});

document.getElementById('focusToggle')?.addEventListener('click', () => {
  const on = document.getElementById('screen')?.classList.toggle('focus');
  const btn = document.getElementById('focusToggle');
  if (btn) btn.textContent = on ? 'Salir de vista completa' : 'Vista completa';
  resize();
});
document.getElementById('closeDialog')?.addEventListener('click', () => document.getElementById('missionDialog')?.close());

// ── Modals Setup ─────────────────────────────────────────────────────────────
const gearDialog = document.getElementById('gearDialog');
const contractDialog = document.getElementById('contractDialog');
const humandDialog = document.getElementById('humandDialog');

document.getElementById('closeGearDialog')?.addEventListener('click', () => gearDialog?.close());
['Laptop', 'Access', 'Tech', 'Swag'].forEach(k => {
  const key = k.toLowerCase();
  const el = document.getElementById(`check${k}`);
  if (el) {
    el.onchange = () => {
      gearChecklist[key] = el.checked;
      document.getElementById(`card${k}`)?.classList.toggle('delivered', el.checked);
      save();
    };
  }
});
document.getElementById('grantGearXpBtn')?.addEventListener('click', () => {
  players.forEach(p => { p.points = (p.points || 0) + 20; });
  save();
  renderUI();
  gearDialog?.close();
});

document.getElementById('closeContractDialog')?.addEventListener('click', () => contractDialog?.close());
['Contract', 'Health', 'Perks', 'Vacation'].forEach(k => {
  const key = k.toLowerCase();
  const el = document.getElementById(`check${k}`);
  if (el) {
    el.onchange = () => {
      contractChecklist[key] = el.checked;
      document.getElementById(`card${k}`)?.classList.toggle('delivered', el.checked);
      save();
    };
  }
});
document.getElementById('grantContractXpBtn')?.addEventListener('click', () => {
  players.forEach(p => { p.points = (p.points || 0) + 25; });
  save();
  renderUI();
  contractDialog?.close();
});

document.getElementById('closeHumandDialog')?.addEventListener('click', () => humandDialog?.close());
['AppHumand', 'Incidents', 'Dining', 'Hygiene'].forEach(k => {
  const key = k[0].toLowerCase() + k.slice(1);
  const el = document.getElementById(`check${k}`);
  if (el) {
    el.onchange = () => {
      humandChecklist[key] = el.checked;
      document.getElementById(`card${k}`)?.classList.toggle('delivered', el.checked);
      save();
    };
  }
});
document.getElementById('grantHumandXpBtn')?.addEventListener('click', () => {
  players.forEach(p => { p.points = (p.points || 0) + 30; });
  save();
  renderUI();
  humandDialog?.close();
});

function resize() {
  const s = document.getElementById('stage');
  if (!s) return;
  camera.aspect = s.clientWidth / s.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(s.clientWidth, s.clientHeight, false);
}
new ResizeObserver(resize).observe(document.getElementById('stage'));
resize();
rebuildPlayers();
applyStates();

// Instant Bulletproof Boot (hides within 200ms without blocking)
const hideBoot = () => {
  const b = document.getElementById('boot');
  if (b && !b.classList.contains('hidden')) {
    b.classList.add('hidden');
    startTravel(current, true);
  }
};

setTimeout(hideBoot, 200);
worldReady.then(hideBoot).catch(hideBoot);

// ── Render Loop ───────────────────────────────────────────────────────────────
const clock = new THREE.Clock();
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.035), t = clock.elapsedTime;

  if (anim.streamer) {
    anim.streamer.tickStream();
    anim.streamer.update(dt, t);
  }

  anim.water.forEach(w => {
    const s = w.material.userData.shader;
    if (s) s.uniforms.uTime.value = t;
  });

  if (anim.motes) {
    const pos = anim.motes.system.geometry.attributes.position;
    for (let i = 0; i < anim.motes.count; i++) {
      const ph = anim.motes.phases[i];
      let y = pos.getY(i) + Math.sin(t * 1.5 + ph) * 0.008;
      let x = pos.getX(i) + Math.cos(t * 0.8 + ph) * 0.006;
      pos.setY(i, y);
      pos.setX(i, x);
    }
    pos.needsUpdate = true;
  }

  anim.poi.forEach(g => {
    if (g.userData?.motion) {
      g.userData.motion.rotation.y += dt * 0.2;
    }
    if (g.userData?.fireLight) {
      g.userData.fireLight.intensity = 3.8 + Math.sin(t * 11 + (g.userData.phase ?? 0)) * 1.1;
    }
    if (g.userData?.crystal) {
      g.userData.crystal.rotation.y += dt * 1.2;
      g.userData.crystal.rotation.x = Math.sin(t * 1.8) * 0.2;
      g.userData.crystal.position.y = 1.6 + Math.sin(t * 2.2) * 0.08;
    }
    if (g.userData?.covenantSeal) {
      g.userData.covenantSeal.rotation.y += dt * 0.9;
      g.userData.covenantSeal.rotation.z = Math.sin(t * 1.5) * 0.15;
      g.userData.covenantSeal.position.y = 1.8 + Math.sin(t * 2.0) * 0.08;
    }
    if (g.userData?.humandTerminal) {
      g.userData.humandTerminal.rotation.y += dt * 1.1;
      g.userData.humandTerminal.position.y = 1.7 + Math.sin(t * 2.5) * 0.08;
    }
  });

  // Animated Procedural Adventurer Walking & Idle
  anim.players.forEach(a => {
    const u = a.userData;
    if (u.walkProgress < 1) {
      u.walkProgress = Math.min(1, u.walkProgress + dt / 2.4);
      const q = cinematicEase(u.walkProgress);
      
      const currX = THREE.MathUtils.lerp(u.startPos.x, u.endPos.x, q);
      const currZ = THREE.MathUtils.lerp(u.startPos.z, u.endPos.z, q);
      const currY = getTerrainY(currX, currZ);
      a.position.set(currX, currY, currZ);
      
      const dx = u.endPos.x - u.startPos.x;
      const dz = u.endPos.z - u.startPos.z;
      if (Math.hypot(dx, dz) > 0.1) {
        const moveAngle = Math.atan2(dx, dz);
        a.rotation.y = THREE.MathUtils.lerp(a.rotation.y, moveAngle, 0.15);
      }

      const stride = Math.sin(t * 14);
      if (u.leftLegPivot) u.leftLegPivot.rotation.x = stride * 0.65;
      if (u.rightLegPivot) u.rightLegPivot.rotation.x = -stride * 0.65;
      if (u.leftArmPivot) u.leftArmPivot.rotation.x = -stride * 0.55;
      if (u.rightArmPivot) u.rightArmPivot.rotation.x = stride * 0.55;
      if (u.bodyGroup) u.bodyGroup.position.y = Math.abs(stride) * 0.08;
    } else {
      a.rotation.y = THREE.MathUtils.lerp(a.rotation.y, u.endRot, 0.08);
      if (u.leftLegPivot) u.leftLegPivot.rotation.x = THREE.MathUtils.lerp(u.leftLegPivot.rotation.x, 0, 0.1);
      if (u.rightLegPivot) u.rightLegPivot.rotation.x = THREE.MathUtils.lerp(u.rightLegPivot.rotation.x, 0, 0.1);
      if (u.leftArmPivot) u.leftArmPivot.rotation.x = THREE.MathUtils.lerp(u.leftArmPivot.rotation.x, 0, 0.1);
      if (u.rightArmPivot) u.rightArmPivot.rotation.x = THREE.MathUtils.lerp(u.rightArmPivot.rotation.x, 0, 0.1);
      if (u.bodyGroup) u.bodyGroup.position.y = Math.sin(t * 2.0 + u.phase) * 0.03;
    }
  });

  anim.clouds.forEach(c => {
    c.position.x += c.userData.speed * dt;
    if (c.position.x > 115) c.position.x = -115;
  });

  // Smooth Camera Travel
  if (travel) {
    travel.t = Math.min(1, travel.t + dt / travel.duration);
    const q = cinematicEase(travel.t);
    camera.position.lerpVectors(travel.startPos, travel.endPos, q);
    camera.position.y += Math.sin(q * Math.PI) * 3.5;
    lookTarget.lerpVectors(travel.startLook, travel.endLook, q);
    camera.lookAt(lookTarget);
    orbit.target.copy(lookTarget);
    updateShadowTracker(lookTarget);
    const bar = document.getElementById('cinematicBar');
    if (bar) bar.style.width = (travel.t * 100).toFixed(1) + '%';
    if (travel.t >= 1) {
      travel = null;
      cinematicUI(false);
    }
  } else if (!freeCamera) {
    const pose = cameraPose(missions[current - 1]);
    camera.position.lerp(pose.pos, 0.05);
    lookTarget.lerp(pose.look, 0.05);
    camera.lookAt(lookTarget);
    orbit.target.copy(lookTarget);
    updateShadowTracker(lookTarget);
  }

  if (freeCamera) {
    const moveSpeed = (keys.shift ? 48 : 24) * dt;
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() > 0.001) forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();

    const moveDelta = new THREE.Vector3();
    if (keys.w) moveDelta.addScaledVector(forward, moveSpeed);
    if (keys.s) moveDelta.addScaledVector(forward, -moveSpeed);
    if (keys.d) moveDelta.addScaledVector(right, moveSpeed);
    if (keys.a) moveDelta.addScaledVector(right, -moveSpeed);
    if (keys.e) moveDelta.y += moveSpeed * 0.75;
    if (keys.q) moveDelta.y -= moveSpeed * 0.75;

    if (moveDelta.lengthSq() > 0) {
      camera.position.add(moveDelta);
      orbit.target.add(moveDelta);
      lookTarget.copy(orbit.target);
    }

    orbit.update();
    lookTarget.copy(orbit.target);
    updateShadowTracker(lookTarget);
  }

  if (checkpointLabelsLayer) {
    checkpointLabelsLayer.innerHTML = '';
  }

  // Projected 3D Character Nameplates
  const labelSig = players.map(p => p.id + ':' + p.name + ':' + p.points).join('|');
  if (labelLayer && labelLayer.dataset.sig !== labelSig) {
    labelLayer.dataset.sig = labelSig;
    labelLayer.innerHTML = players.map(p => `<div class="character-tag">${p.name}<small>${p.points} XP</small></div>`).join('');
  }
  if (labelLayer) {
    anim.players.forEach((a, i) => {
      const v = a.position.clone();
      v.y += 1.35;
      v.project(camera);
      const tag = labelLayer.children[i];
      if (tag) {
        const vis = v.z < 1 && Math.abs(v.x) < 1.15 && Math.abs(v.y) < 1.15;
        tag.style.display = vis ? 'block' : 'none';
        tag.style.left = ((v.x * 0.5 + 0.5) * renderer.domElement.clientWidth) + 'px';
        tag.style.top = ((-v.y * 0.5 + 0.5) * renderer.domElement.clientHeight) + 'px';
      }
    });
  }

  updateWeather(t, dt);
  renderer.render(scene, camera);
}
loop();
