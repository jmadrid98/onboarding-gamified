import * as THREE from 'three';
window.THREE = THREE;
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { installRealisticWorld, createHumanoidCharacter } from './realistic-assets.js?v=154.0.0';

const $ = id => document.getElementById(id);
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = THREE.MathUtils.clamp;

function hideBoot() {
  const b = document.getElementById('boot');
  if (b && !b.classList.contains('hidden')) {
    b.classList.add('hidden');
  }
}

// ── Mission Checkpoints Catalog (Station 0: Lobby + 9 Exploration Checkpoints) ──
const SEED = [
  { id: 0, name: 'Campamento Base & Bienvenida', desc: 'Punto de reunión inicial para todos los aventureros. Aquí se presentan los equipos, se explican las metas de la expedición y se prepara la partida hacia las 9 misiones del reino.', region: 'Lobby de Expedición', x: -248, z: 118, baseY: 0.0, type: 'lobby' },
  { id: 1, name: 'Arsenal y Equipos', desc: 'Entrega y verificación del equipamiento inicial: Laptop corporativa, tarjeta de acceso, periféricos tech y kit de bienvenida.', region: 'Puesto de Inicio', x: -220, z: 85, baseY: 0.0, type: 'camp' },
  { id: 2, name: 'Firma de Contrato y Beneficios', desc: 'Formalización del pacto laboral, firma de contrato, pólizas de salud, vales y catálogo de beneficios corporativos.', region: 'Santuario del Pacto', x: -160, z: -90, baseY: 4.5, type: 'sanctuary' },
  { id: 3, name: 'Humand y Comedor', desc: 'Guía de uso de la App Humand para checar entradas/salidas, reporte de incidencias, turnos y normas del comedor corporativo.', region: 'Valle del Refectorio', x: -85, z: 55, baseY: 0.0, type: 'garden' },
  { id: 4, name: 'Protección Civil y Estacionamiento', desc: 'Protocolos de emergencia, brigadas de auxilio, rutas de evacuación y registro de vehículos en el estacionamiento corporativo.', region: 'Altos de la Vigilancia', x: -25, z: 120, baseY: 7.5, type: 'safety' },
  { id: 5, name: 'Tarjeta Cosmos', desc: 'Beneficios, convenios comerciales, descuentos y privilegios exclusivos con la Tarjeta Cosmos.', region: 'Bóveda Cosmos', x: 45, z: 55, baseY: 0.0, type: 'vault' },
  { id: 6, name: 'Introducción a la compañía', desc: 'Historia, origen, evolución, pilares, propósito y cultura que definen el camino de nuestra organización.', region: 'Salón de las Crónicas', x: 110, z: -85, baseY: 3.2, type: 'history' },
  { id: 7, name: 'NPS', desc: 'Metodología, escala y aplicación de la encuesta NPS a clientes para medir satisfacción, lealtad y calidad de servicio.', region: 'Pabellón NPS', x: 175, z: -105, baseY: 5.0, type: 'nps' },
  { id: 8, name: 'Herramientas y Operación', desc: 'Sistemas, accesos, canales y operación del día a día.', region: 'Forja Operativa', x: 225, z: 40, baseY: 7.8, type: 'forge' },
  { id: 9, name: 'Boss Final', desc: 'Cierre integral, último checkpoint y símbolo de pertenencia.', region: 'Bastión de Cierre', x: 280, z: 115, baseY: 16.0, type: 'castle' }
];

// ── State Management ─────────────────────────────────────────────────────────
const KEY = 'nextGenOnboardingDay.v69_megamap';
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
if (missions[5]) {
  missions[5].name = 'Tarjeta Cosmos';
  missions[5].region = 'Bóveda Cosmos';
  missions[5].desc = 'Beneficios, convenios comerciales, descuentos y privilegios exclusivos con la Tarjeta Cosmos.';
  missions[5].type = 'vault';
}
if (missions[6]) {
  missions[6].name = 'Introducción a la compañía';
  missions[6].region = 'Salón de las Crónicas';
  missions[6].desc = 'Historia, origen, evolución, pilares, propósito y cultura que definen el camino de nuestra organización.';
  missions[6].type = 'history';
  missions[6].baseY = 3.2;
}
if (missions[7]) {
  missions[7].name = 'NPS';
  missions[7].region = 'Pabellón NPS';
  missions[7].desc = 'Metodología, escala y aplicación de la encuesta NPS a clientes para medir satisfacción, lealtad y calidad de servicio.';
  missions[7].type = 'nps';
  missions[7].baseY = 5.0;
}
function getMission(id) {
  const num = Number(id);
  return missions.find(m => m.id === num) || missions[0];
}
let current = (saved.current !== undefined && !isNaN(saved.current)) ? clamp(Number(saved.current), 0, 9) : 0;
const colors = ['#0e807f', '#d69c39', '#7257c8', '#be6150', '#3677c9', '#668e4f', '#c64e91', '#e47b30'];
const initials = n => String(n || '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || 'AV';

let players = [];
if (Array.isArray(saved.players) && saved.players.length > 0) {
  // If stored players are the old 3 default demo characters, start with clean empty list
  const isOldDefault = saved.players.length === 3 &&
    saved.players.some(p => p.name === 'Lucas Silva') &&
    saved.players.some(p => p.name === 'Elena Ramos');

  if (!isOldDefault) {
    players = saved.players.filter(p => p && p.name).map((p, idx) => ({
      id: (Number.isFinite(Number(p.id)) && Number(p.id) > 0) ? Number(p.id) : (idx + 1),
      name: String(p.name).trim(),
      initials: p.initials || initials(p.name),
      color: p.color || colors[idx % colors.length],
      points: Math.max(0, Number(p.points) || 0),
      missionId: clamp(Number(p.missionId) || current, 1, missions.length)
    }));
  }
} else {
  players = []; // Default clean state: user adds characters via UI
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
let safetyChecklist = saved.safetyChecklist || { evac: false, meeting: false, vehicle: false, rules: false };
let cosmosChecklist = saved.cosmosChecklist || { cosmosApp: false, cosmosPerks: false, cosmosHealth: false, cosmosRewards: false };
let companyChecklist = saved.companyChecklist || { companyOrigins: false, companyMission: false, companyValues: false, companyFuture: false };
let npsChecklist = saved.npsChecklist || { npsGoldenQuestion: false, npsCustomerSegments: false, npsFormulaScore: false, npsClosedLoop: false };

const save = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      missions: getCleanMissions(),
      current,
      players: getCleanPlayers(),
      gearChecklist,
      contractChecklist,
      humandChecklist,
      safetyChecklist,
      cosmosChecklist,
      companyChecklist,
      npsChecklist
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

// River waypoints passing directly under Bridge 1 (-125, -20), Bridge 2 (80, -20), into Lake Basin (110, -85)
const RIVER_PTS = [
  [-155, -15],
  [-125, -20],
  [-70, -26],
  [-20, -32],
  [35, -28],
  [80, -20],
  [82, -45]
];

function getRiverZ(x) {
  if (x <= RIVER_PTS[0][0]) return RIVER_PTS[0][1];
  if (x >= RIVER_PTS[RIVER_PTS.length - 1][0]) return RIVER_PTS[RIVER_PTS.length - 1][1];
  for (let i = 0; i < RIVER_PTS.length - 1; i++) {
    if (x >= RIVER_PTS[i][0] && x <= RIVER_PTS[i + 1][0]) {
      const t = (x - RIVER_PTS[i][0]) / (RIVER_PTS[i + 1][0] - RIVER_PTS[i][0]);
      const s = t * t * (3 - 2 * t);
      return RIVER_PTS[i][1] + (RIVER_PTS[i + 1][1] - RIVER_PTS[i][1]) * s;
    }
  }
  return -20;
}

function getTerrainY(wx, wz) {
  // 1. Organic Terrain Baseline
  const s = 0.0075;
  let h = fbm(wx * s + 3.7, wz * s + 1.4) * 6.5 - 0.9;
  h += fbm(wx * s * 3.2 + 7.1, wz * s * 3.2 + 2.9) * 0.9 - 0.35;

  // Mountain boundaries
  if (wz < -160) { const t = clamp((-160 - wz) / 50, 0, 1); h += t * t * (fbm(wx * s * 1.6 + 1.3, wz * s * 1.6 + 5.2) * 32 + 18); }
  if (wz > 160) { const t = clamp((wz - 160) / 50, 0, 1); h += t * t * (fbm(wx * s * 2.1 + 4.5, wz * s * 2.1 + 0.8) * 28 + 14); }
  if (wx < -280) { const t = clamp((-280 - wx) / 50, 0, 1); h += t * t * (fbm(wx * s * 1.7 + 2.1, wz * s * 1.7 + 6.3) * 30 + 16); }
  if (wx > 310) { const t = clamp((wx - 310) / 45, 0, 1); h += t * t * (fbm(wx * s * 1.7 + 8.5, wz * s * 1.7 + 3.1) * 34 + 20); }

  // Lake Basin (situated north at z = -150 so it never touches Station 6 at z = -85)
  const ld = Math.hypot((wx - 110) * 0.7, wz + 150);
  if (ld < 45) { const lf = clamp(1 - ld / 45, 0, 1); h -= lf * lf * 6.5; }

  // River Channel - smoothly passing under Bridge 1 (-125, -20), Bridge 2 (80, -20)
  if (wx > -155 && wx < 82) {
    const rz = getRiverZ(wx);
    const rDist = Math.abs(wz - rz);
    if (rDist < 12.0) {
      const rf = clamp(1.0 - (rDist / 12.0), 0, 1);
      h -= rf * rf * 3.2;
    }
  }

  // Smooth Organic Leveling for Station Base (Flat Inner Plateau 15m for solid foundation)
  const activeMissions = (typeof missions !== 'undefined' && missions && missions.length) ? missions : SEED;
  for (const q of activeMissions) {
    const d = Math.hypot(wx - q.x, wz - q.z);
    const rFlat = 15.0;
    const rBlend = q.type === 'castle' ? 40.0 : 28.0;
    if (d < rBlend) {
      if (d <= rFlat) {
        h = q.baseY;
      } else {
        const t = (d - rFlat) / (rBlend - rFlat);
        const smooth = t * t * (3 - 2 * t);
        h = THREE.MathUtils.lerp(q.baseY, h, smooth);
      }
    }
  }

  return h;
}

// ── Scene, Camera & Renderer ──────────────────────────────────────────────────
const scene = new THREE.Scene();
window.__scene = scene;
scene.fog = new THREE.FogExp2(0x8eb9c0, 0.0045);

const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 3000);
window.camera = camera;
const isLowEnd = (navigator.hardwareConcurrency || 4) <= 4;
const renderer = new THREE.WebGLRenderer({ canvas: $('game'), antialias: !isLowEnd, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, isLowEnd ? 1 : 1.25));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

// ── Sky & Atmosphere ─────────────────────────────────────────────────────────
const sky = new Sky();
sky.scale.setScalar(2500);
scene.add(sky);
const skyU = sky.material.uniforms;
skyU['turbidity'].value = 4.2;
skyU['rayleigh'].value = 1.4;
skyU['mieCoefficient'].value = 0.003;
skyU['mieDirectionalG'].value = 0.85;

// ── Clean Stylized Daylight with Realistic Shadows ───────────────────────────
const hemisphere = new THREE.HemisphereLight(0xffffff, 0x3d5a28, 0.75);
scene.add(hemisphere);

const sun = new THREE.DirectionalLight(0xfff5e4, 2.4);
sun.castShadow = true;
sun.shadow.mapSize.width = 2048;
sun.shadow.mapSize.height = 2048;
sun.shadow.camera.near = 10;
sun.shadow.camera.far = 450;
const dShadow = 95;
sun.shadow.camera.left = -dShadow;
sun.shadow.camera.right = dShadow;
sun.shadow.camera.top = dShadow;
sun.shadow.camera.bottom = -dShadow;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.025;
sun.position.set(85, 125, 75);
scene.add(sun);
scene.add(sun.target);

const fill = new THREE.DirectionalLight(0xdcf2fc, 0.35);
fill.position.set(-80, 140, -80);
scene.add(fill);

function updateSky(elevation = 38, azimuth = -152) {
  const phi = THREE.MathUtils.degToRad(90 - elevation), theta = THREE.MathUtils.degToRad(azimuth);
  const sv = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
  skyU['sunPosition'].value.copy(sv);
}
updateSky();

// ── Rustic Organic Trail Waypoints ───────────────────────────────────────────
const roadWaypoints = [
  new THREE.Vector3(-248, 0, 118),  // Station 0: Lobby de Expedición (Campamento Base)
  new THREE.Vector3(-235, 0, 100),
  new THREE.Vector3(-220, 0, 85),   // Station 1: Arsenal & Equipos (Camp center)
  new THREE.Vector3(-205, 0, 60),
  new THREE.Vector3(-190, 0, 20),
  new THREE.Vector3(-180, 0, -25),
  new THREE.Vector3(-170, 0, -60),
  new THREE.Vector3(-160, 0, -90),  // Station 2: Santuario del Pacto (Shrine center)
  new THREE.Vector3(-145, 0, -60),
  new THREE.Vector3(-135, 0, -38),
  new THREE.Vector3(-125, 0, -20),  // Bridge 1 crossing
  new THREE.Vector3(-110, 0, 10),
  new THREE.Vector3(-98, 0, 35),
  new THREE.Vector3(-85, 0, 55),    // Station 3: Humand y Comedor (Tavern & market center)
  new THREE.Vector3(-60, 0, 85),
  new THREE.Vector3(-25, 0, 120),   // Station 4: Torre de Vigilancia
  new THREE.Vector3(10, 0, 90),
  new THREE.Vector3(45, 0, 55),     // Station 5: Campamento Avanzado
  new THREE.Vector3(65, 0, 15),
  new THREE.Vector3(80, 0, -20),    // Bridge 2 crossing
  new THREE.Vector3(110, 0, -85),   // Station 6: Embarcadero del Lago
  new THREE.Vector3(145, 0, -100),
  new THREE.Vector3(175, 0, -105),  // Station 7: Granja y Molino
  new THREE.Vector3(200, 0, -35),
  new THREE.Vector3(225, 0, 40),    // Station 8: Cantera de Piedra
  new THREE.Vector3(255, 0, 80),
  new THREE.Vector3(280, 0, 115)    // Station 9: Ciudadela y Castillo
];

const roadCurve = new THREE.CatmullRomCurve3(roadWaypoints, false, 'catmullrom', 0.20);
const trailPoints2D = roadCurve.getSpacedPoints(600).map(p => new THREE.Vector2(p.x, p.z));

// ── High-Definition 512x512 Procedural Tiling Textures ───────────────────────
function createProceduralTile(drawFn) {
  const size = 512;
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

// 1. Lush Emerald Meadow with Realistic Organic Blades and Wildflowers
const grassTile = createProceduralTile((ctx, size) => {
  ctx.fillStyle = '#5ca237';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 900; i++) {
    const gx = Math.random() * size, gy = Math.random() * size;
    ctx.strokeStyle = Math.random() > 0.4 ? '#72c244' : '#498a28';
    ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + (Math.random() - 0.5) * 5, gy - 8); ctx.stroke();
  }
  for (let i = 0; i < 300; i++) {
    const cx = Math.random() * size, cy = Math.random() * size;
    ctx.fillStyle = Math.random() > 0.5 ? '#84de52' : '#3d7a22';
    ctx.beginPath(); ctx.arc(cx, cy, 2.2, 0, Math.PI * 2); ctx.fill();
  }
  for (let i = 0; i < 50; i++) {
    const fx = Math.random() * size, fy = Math.random() * size;
    ctx.fillStyle = '#fffef4';
    for (let p = 0; p < 5; p++) {
      const pa = (p / 5) * Math.PI * 2;
      ctx.beginPath(); ctx.arc(fx + Math.cos(pa) * 2.2, fy + Math.sin(pa) * 2.2, 1.4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#ffd53d';
    ctx.beginPath(); ctx.arc(fx, fy, 1.4, 0, Math.PI * 2); ctx.fill();
  }
});

// 2. Harmonious Subdued Medieval Cobblestone Pavers (Balanced Architectural Grounding)
const cobbleTile = createProceduralTile((ctx, size) => {
  // Soft, harmonious mortar base (warm neutral stone dust)
  ctx.fillStyle = '#7d776e';
  ctx.fillRect(0, 0, size, size);

  const rows = 10;
  const rh = size / rows;
  // Subdued, elegant, noble medieval stone pavers (doesn't compete with colorful buildings & characters)
  const stoneColors = ['#958e83', '#9c958a', '#8e877d', '#a19a8f', '#888278', '#a49d92'];

  for (let r = 0; r < rows; r++) {
    const y = r * rh;
    let x = (r % 2 === 0 ? -12 : -32);
    while (x < size + 40) {
      const seed = Math.sin(r * 43.1 + x * 17.3) * 0.5 + 0.5;
      const sw = 38 + seed * 30;
      const sh = rh - 5;
      const col = stoneColors[Math.floor(seed * stoneColors.length)];

      // Paver body
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.roundRect(x + 3, y + 2.5, sw - 5, sh - 3, 7);
      ctx.fill();

      // Delicate subtle highlight bevel
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x + 7, y + sh - 2);
      ctx.lineTo(x + 7, y + 5);
      ctx.lineTo(x + sw - 6, y + 5);
      ctx.stroke();

      // Delicate soft shadow bevel
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x + sw - 4, y + 6);
      ctx.lineTo(x + sw - 4, y + sh);
      ctx.lineTo(x + 9, y + sh);
      ctx.stroke();

      x += sw;
    }
  }

  // Soft fine stone grain
  for (let i = 0; i < 180; i++) {
    const px = Math.random() * size, py = Math.random() * size;
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(50,45,38,0.08)';
    ctx.beginPath();
    ctx.arc(px, py, 1.0 + Math.random() * 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
});

// 3. Warm Sunlit Country Earth Trail (Golden-Brown Packed Soil)
const dirtTile = createProceduralTile((ctx, size) => {
  // Warm golden-brown earth base (sunny countryside soil)
  ctx.fillStyle = '#877054';
  ctx.fillRect(0, 0, size, size);

  // Natural soil grain & packed wheel rut tracks
  for (let i = 0; i < 850; i++) {
    const x = Math.random() * size, y = Math.random() * size;
    ctx.fillStyle = Math.random() > 0.5 ? '#967f62' : '#786247';
    ctx.beginPath();
    ctx.arc(x, y, 1.5 + Math.random() * 3.0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Sunlit dry dust highlights
  for (let i = 0; i < 400; i++) {
    const x = Math.random() * size, y = Math.random() * size;
    ctx.fillStyle = 'rgba(180, 155, 120, 0.40)';
    ctx.beginPath();
    ctx.arc(x, y, 2.0 + Math.random() * 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Small earthy pebbles
  for (let i = 0; i < 300; i++) {
    const x = Math.random() * size, y = Math.random() * size;
    ctx.fillStyle = Math.random() > 0.5 ? '#554330' : '#68543f';
    ctx.beginPath();
    ctx.arc(x, y, 1.0 + Math.random() * 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
});

// 4. Mountain Rock
const rockTile = createProceduralTile((ctx, size) => {
  ctx.fillStyle = '#7a7872';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 400; i++) {
    const x = Math.random() * size, y = Math.random() * size;
    ctx.fillStyle = Math.random() > 0.5 ? '#8e8c85' : '#66645e';
    ctx.fillRect(x, y, 12 + Math.random() * 20, 6 + Math.random() * 10);
  }
});

// 5. Shore Sand
const sandTile = createProceduralTile((ctx, size) => {
  ctx.fillStyle = '#decda6';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 600; i++) {
    const x = Math.random() * size, y = Math.random() * size;
    ctx.fillStyle = Math.random() > 0.5 ? '#efe0bd' : '#cbba90';
    ctx.beginPath(); ctx.arc(x, y, 1.2, 0, Math.PI * 2); ctx.fill();
  }
});

// ── Solid Stylized Terrain Material with Procedural Biome Splatting ─────────
grassTile.repeat.set(54, 35);
rockTile.repeat.set(40, 26);
sandTile.repeat.set(48, 30);
dirtTile.repeat.set(48, 30);
cobbleTile.repeat.set(44, 28);

// ── Procedural Trail & Courtyard Splat Texture (Shader-Painted Roads) ──────
function createTrailSplatTexture() {
  const c = document.createElement('canvas');
  c.width = 2048;
  c.height = 2048;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, 2048, 2048);

  const toCanvas = (wx, wz) => [
    ((wx + 340) / 680) * 2048,
    ((wz + 220) / 440) * 2048
  ];

  const pts = roadCurve.getSpacedPoints(600);

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Helper to get cobblestone factor along road
  const getCobbleAlpha = (pt) => {
    let minDist = Infinity;
    for (let s = 0; s < missions.length; s++) {
      const d = Math.hypot(pt.x - missions[s].x, pt.z - missions[s].z);
      if (d < minDist) minDist = d;
    }
    const dBridge1 = Math.hypot(pt.x - (-125), pt.z - (-20));
    const dBridge2 = Math.hypot(pt.x - 80, pt.z - (-20));
    const minBridge = Math.min(dBridge1, dBridge2);

    let a = 0;
    if (minDist <= 18) {
      a = 1.0;
    } else if (minDist < 36) {
      a = 1.0 - ((minDist - 18.0) / 18.0);
    }
    if (minBridge <= 16) {
      a = Math.max(a, 1.0);
    } else if (minBridge < 26) {
      a = Math.max(a, 1.0 - ((minBridge - 16.0) / 10.0));
    }
    return a;
  };

  // 1. Soft outer transition fringe (width 14, ~4.6m envelope)
  ctx.lineWidth = 14;
  for (let i = 0; i < pts.length - 1; i++) {
    const pt = pts[i];
    const nextPt = pts[i + 1];
    const gVal = Math.round(getCobbleAlpha(pt) * 255);
    const [x1, y1] = toCanvas(pt.x, pt.z);
    const [x2, y2] = toCanvas(nextPt.x, nextPt.z);

    ctx.strokeStyle = `rgba(255, ${gVal}, 0, 0.40)`;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // 2. Solid cozy core path (width 9, ~3.0m clear trodden path)
  ctx.lineWidth = 9;
  for (let i = 0; i < pts.length - 1; i++) {
    const pt = pts[i];
    const nextPt = pts[i + 1];
    const gVal = Math.round(getCobbleAlpha(pt) * 255);
    const [x1, y1] = toCanvas(pt.x, pt.z);
    const [x2, y2] = toCanvas(nextPt.x, nextPt.z);

    ctx.strokeStyle = `rgba(255, ${gVal}, 0, 1.0)`;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(c);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.flipY = false;
  return texture;
}

const trailSplatTexture = createTrailSplatTexture();

const terrainMat = new THREE.MeshStandardMaterial({
  map: grassTile,
  roughness: 0.88,
  metalness: 0.0,
  color: 0xffffff
});

terrainMat.onBeforeCompile = shader => {
  const stationVectors = [];
  const stationRadii = [];
  for (let i = 0; i < missions.length; i++) {
    const m = (typeof missions !== 'undefined' && missions && missions[i]) ? missions[i] : SEED[i];
    stationVectors.push(new THREE.Vector2(m.x, m.z));
    stationRadii.push(m.type === 'castle' ? 17.0 : 9.5);
  }

  shader.uniforms.uGrass = { value: grassTile };
  shader.uniforms.uRock = { value: rockTile };
  shader.uniforms.uSand = { value: sandTile };
  shader.uniforms.uDirt = { value: dirtTile };
  shader.uniforms.uCobble = { value: cobbleTile };
  shader.uniforms.uTrailSplat = { value: trailSplatTexture };
  shader.uniforms.uStations = { value: stationVectors };
  shader.uniforms.uStationRadii = { value: stationRadii };

  shader.vertexShader = shader.vertexShader.replace(
    '#include <common>',
    `#include <common>
    varying vec3 vWorldPos;
    varying vec3 vWorldNorm;`
  ).replace(
    '#include <worldpos_vertex>',
    `#include <worldpos_vertex>
    vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
    vWorldNorm = normalize(mat3(modelMatrix) * normal);`
  );

  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <common>',
    `#include <common>
    varying vec3 vWorldPos;
    varying vec3 vWorldNorm;
    uniform sampler2D uGrass;
    uniform sampler2D uRock;
    uniform sampler2D uSand;
    uniform sampler2D uDirt;
    uniform sampler2D uCobble;
    uniform sampler2D uTrailSplat;
    uniform vec2 uStations[10];
    uniform float uStationRadii[10];`
  ).replace(
    '#include <map_fragment>',
    `
    // 1. Dual-Frequency Natural Grass Sampling (breaks repeating grid pattern)
    vec2 uvG1 = vWorldPos.xz * 0.075;
    vec2 uvG2 = vec2(vWorldPos.z * 0.707 - vWorldPos.x * 0.707, vWorldPos.x * 0.707 + vWorldPos.z * 0.707) * 0.024;
    vec4 grassSample1 = texture2D(uGrass, uvG1);
    vec4 grassSample2 = texture2D(uGrass, uvG2);
    vec4 baseGrass = mix(grassSample1, grassSample2, 0.42);

    // Continental Organic Biome Noise (Valleys vs Sunny Meadows vs Highlands)
    float macroA = sin(vWorldPos.x * 0.014 + cos(vWorldPos.z * 0.010) * 1.8);
    float macroB = cos(vWorldPos.z * 0.012 + sin(vWorldPos.x * 0.008) * 1.6);
    float biomeVal = macroA * 0.5 + macroB * 0.5;

    // Organic Biome Palettes
    vec3 colMossValley = vec3(0.18, 0.42, 0.20);
    vec3 colFreshMeadow = vec3(0.28, 0.62, 0.25);
    vec3 colHighlandSun = vec3(0.42, 0.60, 0.24);

    float slopeGrass = clamp((vWorldPos.y - 2.0) * 0.045 + biomeVal * 0.25, 0.0, 1.0);
    vec3 grassBiomeTint = mix(colMossValley, colFreshMeadow, clamp(biomeVal * 0.5 + 0.5, 0.0, 1.0));
    grassBiomeTint = mix(grassBiomeTint, colHighlandSun, slopeGrass);

    // Organic Living Meadow: breaks repetitive wallpaper look completely!
    vec4 colG = vec4(baseGrass.rgb * (grassBiomeTint * 2.15), baseGrass.a);

    vec2 uvR = vWorldPos.xz * 0.055;
    vec2 uvS = vWorldPos.xz * 0.075;
    vec2 uvD = vWorldPos.xz * 0.280; // Fine-grained sunny country earth
    vec2 warp = vec2(sin(vWorldPos.z * 0.18), cos(vWorldPos.x * 0.18)) * 0.008;
    vec2 uvC = (vWorldPos.xz + warp) * 0.350; // Human-scale (~28cm) crisp medieval cobblestone pavers!

    vec4 colR = texture2D(uRock, uvR);
    vec4 colS = texture2D(uSand, uvS);
    vec4 colD = texture2D(uDirt, uvD);
    vec4 colC = texture2D(uCobble, uvC);

    // 1. Mountain Rock & High Peaks
    float slope = 1.0 - clamp(vWorldNorm.y, 0.0, 1.0);
    float rockWeight = smoothstep(0.32, 0.62, slope);
    float highPeak = smoothstep(22.0, 38.0, vWorldPos.y);
    rockWeight = clamp(rockWeight + highPeak, 0.0, 1.0);

    // 2. Shoreline Sand
    float distLake = length(vec2((vWorldPos.x - 110.0) * 0.7, vWorldPos.z + 150.0));
    float lakeSand = smoothstep(45.0, 30.0, distLake);
    float riverSand = (vWorldPos.x > -155.0 && vWorldPos.x < 82.0 && vWorldPos.y < 0.1) ? smoothstep(0.1, -1.2, vWorldPos.y) : 0.0;
    float sandWeight = clamp((lakeSand + riverSand) * (1.0 - rockWeight * 0.8), 0.0, 1.0);

    // 3. Station Courtyard Plazas: Clean, elegant, noble medieval cobblestone foundation
    float stationBlend = 0.0;
    for (int i = 0; i < 10; i++) {
      float dSt = length(vWorldPos.xz - uStations[i]);
      float r = uStationRadii[i];
      float w = smoothstep(r, r - 2.0, dSt);
      stationBlend = max(stationBlend, w);
    }

    // 4. Natural Organic Trail (Solid, connected thoroughfare across the continent)
    vec2 splatUV = vec2((vWorldPos.x + 340.0) / 680.0, (vWorldPos.z + 220.0) / 440.0);
    vec4 splat = texture2D(uTrailSplat, splatUV);
    float roadPresence = max(splat.r, splat.g); // Never zero in center!
    float cobblePresence = splat.g;

    // Road surface: 100% Cobblestone near stations/bridges, warm country soil in wild
    float cobbleFactor = smoothstep(0.10, 0.65, cobblePresence);
    vec4 roadSurface = mix(colD, colC, cobbleFactor);

    // Organic broken edge with grass
    float edgeNoise = (texture2D(uGrass, vWorldPos.xz * 0.35).r - 0.5) * 0.12;
    float roadAlpha = smoothstep(0.16, 0.52, roadPresence + edgeNoise);

    // Base: Lush Emerald Meadow Grass
    vec4 mixedColor = colG;

    // Blend lake/river shoreline sand
    mixedColor = mix(mixedColor, colS, sandWeight * 0.92);

    // Blend mountain rock on slopes & peaks
    mixedColor = mix(mixedColor, colR, rockWeight);

    // Blend organic continuous road (paved near stations, trodden earth in open wild!)
    mixedColor = mix(mixedColor, roadSurface, roadAlpha * (1.0 - rockWeight * 0.5));

    // Blend Station Courtyards: Elegant, subdued, noble stone pavers that let buildings shine!
    mixedColor = mix(mixedColor, colC, stationBlend);

    diffuseColor *= mixedColor;
    `
  );
  terrainMat.userData.shader = shader;
};

// ── 100% Solid 3D Terrain Plane ──────────────────────────────────────────────
const terrainGeo = new THREE.PlaneGeometry(680, 440, 160, 110);
const posAttr = terrainGeo.attributes.position;
for (let i = 0; i < posAttr.count; i++) {
  const lx = posAttr.getX(i), ly = posAttr.getY(i);
  const wx = lx, wz = -ly;
  posAttr.setZ(i, getTerrainY(wx, wz));
}
terrainGeo.computeVertexNormals();

const ground = new THREE.Mesh(terrainGeo, terrainMat);
ground.rotation.x = -Math.PI / 2;
ground.position.set(0, 0, 0);
ground.receiveShadow = true;
scene.add(ground);

// ── Airtight Continuous Cliff Skirt (Extruded from outer terrain perimeter down to y = -35m) ──
{
  const width = 680, depth = 440, segX = 160, segZ = 110, bottomY = -35.0;
  const perimeter = [];

  // 1. North edge: z = -depth / 2, x from -width/2 to +width/2
  for (let ix = 0; ix <= segX; ix++) {
    const x = -width / 2 + (ix / segX) * width;
    perimeter.push({ x, z: -depth / 2 });
  }
  // 2. East edge: x = +width / 2, z from -depth/2 to +depth/2
  for (let iz = 1; iz <= segZ; iz++) {
    const z = -depth / 2 + (iz / segZ) * depth;
    perimeter.push({ x: width / 2, z });
  }
  // 3. South edge: z = +depth / 2, x from +width/2 down to -width/2
  for (let ix = segX - 1; ix >= 0; ix--) {
    const x = -width / 2 + (ix / segX) * width;
    perimeter.push({ x, z: depth / 2 });
  }
  // 4. West edge: x = -width / 2, z from +depth/2 down to -depth/2
  for (let iz = segZ - 1; iz >= 1; iz--) {
    const z = -depth / 2 + (iz / segZ) * depth;
    perimeter.push({ x: -width / 2, z });
  }

  const sVerts = [], sNormals = [], sUvs = [], sIndices = [];
  const pCount = perimeter.length;

  for (let i = 0; i < pCount; i++) {
    const p1 = perimeter[i];
    const p2 = perimeter[(i + 1) % pCount];
    const y1 = getTerrainY(p1.x, p1.z);
    const y2 = getTerrainY(p2.x, p2.z);

    const edx = p2.x - p1.x;
    const edz = p2.z - p1.z;
    const normLen = Math.hypot(edx, edz) || 1;
    const nx = edz / normLen;
    const nz = -edx / normLen;

    const baseIdx = sVerts.length / 3;
    sVerts.push(
      p1.x, y1, p1.z,
      p1.x, bottomY, p1.z,
      p2.x, y2, p2.z,
      p2.x, bottomY, p2.z
    );

    sNormals.push(
      nx, 0, nz,
      nx, 0, nz,
      nx, 0, nz,
      nx, 0, nz
    );

    sUvs.push(
      (i / pCount) * 40, (y1 - bottomY) * 0.1,
      (i / pCount) * 40, 0,
      ((i + 1) / pCount) * 40, (y2 - bottomY) * 0.1,
      ((i + 1) / pCount) * 40, 0
    );

    sIndices.push(
      baseIdx, baseIdx + 1, baseIdx + 2,
      baseIdx + 1, baseIdx + 3, baseIdx + 2
    );
  }

  const skirtGeo = new THREE.BufferGeometry();
  skirtGeo.setAttribute('position', new THREE.Float32BufferAttribute(sVerts, 3));
  skirtGeo.setAttribute('normal', new THREE.Float32BufferAttribute(sNormals, 3));
  skirtGeo.setAttribute('uv', new THREE.Float32BufferAttribute(sUvs, 2));
  skirtGeo.setIndex(sIndices);

  const skirtMat = new THREE.MeshStandardMaterial({
    color: 0x3d3329,
    map: rockTile,
    roughness: 0.94,
    metalness: 0.05
  });

  const skirtMesh = new THREE.Mesh(skirtGeo, skirtMat);
  skirtMesh.receiveShadow = true;
  scene.add(skirtMesh);

  // Bottom seal plate at y = bottomY to prevent looking into hollow underside
  const bottomPlate = new THREE.Mesh(
    new THREE.PlaneGeometry(width + 0.5, depth + 0.5),
    new THREE.MeshBasicMaterial({ color: 0x1a1612 })
  );
  bottomPlate.rotation.x = Math.PI / 2;
  bottomPlate.position.set(0, bottomY, 0);
  scene.add(bottomPlate);
}

// ── Rustic Trail Bridges & Lanterns ──────────────────────────────────────────
function createRusticTrailDetails() {
  const points = roadCurve.getSpacedPoints(500);

  // 1. Spawn Wooden Bridges over the river crossings
  function createBridge(x, z, angle, length = 16) {
    const bridgeGroup = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x5b3e2b, roughness: 0.9, metalness: 0.0 });
    const postMat = new THREE.MeshStandardMaterial({ color: 0x3d281a, roughness: 0.95, metalness: 0.0 });

    const plankCount = Math.floor(length / 0.45);
    for (let p = 0; p < plankCount; p++) {
      const pOffset = -length * 0.5 + p * 0.45;
      const plank = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.18, 0.40), woodMat);
      const arch = Math.sin((p / (plankCount - 1)) * Math.PI) * 0.55;
      plank.position.set(0, arch + 0.18, pOffset);
      plank.castShadow = true;
      plank.receiveShadow = true;
      bridgeGroup.add(plank);
    }

    for (const sideX of [-1.75, 1.75]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, length), woodMat);
      rail.position.set(sideX, 1.05, 0);
      bridgeGroup.add(rail);

      for (let p = -length * 0.5; p <= length * 0.5; p += 2.6) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.10, 1.25, 8), postMat);
        post.position.set(sideX, 0.52, p);
        post.castShadow = true;
        bridgeGroup.add(post);
      }
    }

    const y = getTerrainY(x, z);
    bridgeGroup.position.set(x, y + 0.02, z);
    bridgeGroup.rotation.y = angle;
    scene.add(bridgeGroup);
  }

  createBridge(-125, -20, 0.45, 18);
  createBridge(80, -20, -0.40, 18);

  // 2. Clear Landmark Entrance & Exit Threshold Gateposts for Every Station
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x422e1e, roughness: 0.88 });
  const stonePlinthMat = new THREE.MeshStandardMaterial({ color: 0x6e685f, roughness: 0.92 });
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xd49b29, emissiveIntensity: 2.5, roughness: 0.3 });

  function spawnThresholdGatepost(wx, wz, facingDir) {
    const postGroup = new THREE.Group();
    const wy = getTerrainY(wx, wz);

    // Carved rustic stone plinth
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.32, 7), stonePlinthMat);
    plinth.position.y = 0.16;
    postGroup.add(plinth);

    // Squared timber post
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.12, 2.3, 8), woodMat);
    post.position.y = 1.25;
    postGroup.add(post);

    // Lantern bracket
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.45), woodMat);
    arm.position.set(0, 2.2, 0.20);
    postGroup.add(arm);

    // Warm lantern
    const lantern = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), lampMat);
    lantern.position.set(0, 2.0, 0.38);
    postGroup.add(lantern);

    const warmLight = new THREE.PointLight(0xffb84d, 1.2, 7.5);
    warmLight.position.set(0, 2.0, 0.38);
    postGroup.add(warmLight);

    postGroup.position.set(wx, wy, wz);
    postGroup.rotation.y = Math.atan2(facingDir.x, facingDir.z);
    scene.add(postGroup);
  }

  // Frame the road entrance and exit at each station threshold
  missions.forEach(st => {
    let closestIdx = 0, minD = Infinity;
    for (let i = 0; i < points.length; i++) {
      const d = Math.hypot(points[i].x - st.x, points[i].z - st.z);
      if (d < minD) { minD = d; closestIdx = i; }
    }

    const courtyardRadius = (st.type === 'castle') ? 17.0 : 9.5;

    // Entrance gateposts (where road crosses into courtyard)
    let inIdx = -1;
    for (let i = closestIdx; i >= 0; i--) {
      if (Math.hypot(points[i].x - st.x, points[i].z - st.z) >= courtyardRadius) {
        inIdx = i;
        break;
      }
    }
    if (inIdx >= 0 && inIdx < points.length - 1) {
      const p = points[inIdx];
      const nextP = points[inIdx + 1];
      const dir = new THREE.Vector3().subVectors(nextP, p).normalize();
      const side = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
      spawnThresholdGatepost(p.x + side.x * 1.9, p.z + side.z * 1.9, dir);
      spawnThresholdGatepost(p.x - side.x * 1.9, p.z - side.z * 1.9, dir);
    }

    // Exit gateposts (where road crosses out of courtyard)
    let outIdx = -1;
    for (let i = closestIdx; i < points.length; i++) {
      if (Math.hypot(points[i].x - st.x, points[i].z - st.z) >= courtyardRadius) {
        outIdx = i;
        break;
      }
    }
    if (outIdx >= 0 && outIdx < points.length - 1) {
      const p = points[outIdx];
      const nextP = points[outIdx + 1];
      const dir = new THREE.Vector3().subVectors(nextP, p).normalize();
      const side = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
      spawnThresholdGatepost(p.x + side.x * 1.9, p.z + side.z * 1.9, dir);
      spawnThresholdGatepost(p.x - side.x * 1.9, p.z - side.z * 1.9, dir);
    }
  });

  // Bridge lanterns at crossing points
  [[-125, -20], [80, -20]].forEach(([bx, bz]) => {
    spawnThresholdGatepost(bx - 2.4, bz, new THREE.Vector3(1, 0, 0));
    spawnThresholdGatepost(bx + 2.4, bz, new THREE.Vector3(-1, 0, 0));
  });
}
createRusticTrailDetails();

// ── Water, Motes & Atmosphere ────────────────────────────────────────────────
const anim = { water: [], poi: [], players: [], clouds: [], motes: null, streamer: null };
{
  const wGeo = new THREE.PlaneGeometry(260, 200, 40, 30);
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
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.y+=sin(uTime*1.2+position.x*0.1+position.z*0.08)*0.16+cos(uTime*0.8+position.x*0.06-position.z*0.1)*0.10;');
    waterMat.userData.shader = shader;
  };
  const water = new THREE.Mesh(wGeo, waterMat);
  water.position.set(110, -2.5, -150);
  scene.add(water);
  anim.water.push(water);

  // Continuous River Ribbon following getRiverZ from x = -155 to x = 82
  {
    const rSteps = 100;
    const rHalfW = 7.5;
    const rVerts = [], rNormals = [], rUvs = [], rIndices = [];

    for (let i = 0; i <= rSteps; i++) {
      const rx = -155 + (i / rSteps) * (82 - (-155));
      const rz = getRiverZ(rx);

      const nextRx = Math.min(82, rx + 1.0);
      const prevRx = Math.max(-155, rx - 1.0);
      const ddx = nextRx - prevRx;
      const ddz = getRiverZ(nextRx) - getRiverZ(prevRx);
      const dLen = Math.hypot(ddx, ddz) || 1;
      const nx = -ddz / dLen;
      const nz = ddx / dLen;

      const p = i / rSteps;
      const waterY = THREE.MathUtils.lerp(-0.35, -0.05, Math.pow(p, 1.3));

      const lx = rx + nx * rHalfW;
      const lz = rz + nz * rHalfW;
      const rightX = rx - nx * rHalfW;
      const rightZ = rz - nz * rHalfW;

      rVerts.push(lx, waterY, lz, rightX, waterY, rightZ);
      rNormals.push(0, 1, 0, 0, 1, 0);
      rUvs.push(0, p * 20, 1, p * 20);

      if (i < rSteps) {
        const idx = i * 2;
        rIndices.push(idx, idx + 1, idx + 2);
        rIndices.push(idx + 1, idx + 3, idx + 2);
      }
    }

    const riverGeo = new THREE.BufferGeometry();
    riverGeo.setAttribute('position', new THREE.Float32BufferAttribute(rVerts, 3));
    riverGeo.setAttribute('normal', new THREE.Float32BufferAttribute(rNormals, 3));
    riverGeo.setAttribute('uv', new THREE.Float32BufferAttribute(rUvs, 2));
    riverGeo.setIndex(rIndices);

    const riverMesh = new THREE.Mesh(riverGeo, waterMat);
    scene.add(riverMesh);
    anim.water.push(riverMesh);
  }
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
  const g = new THREE.Group(), ma = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false });
  for (let i = 0; i < 6; i++) {
    const c = new THREE.Mesh(new THREE.SphereGeometry(rnd(4.0, 7.5), 8, 6), ma);
    c.position.set(rnd(-8, 8), rnd(-1, 1), rnd(-4, 4));
    c.scale.y = 0.40;
    g.add(c);
  }
  g.position.set(rnd(-320, 320), rnd(18, 32), rnd(-200, 200));
  g.userData.speed = rnd(0.35, 0.75);
  scene.add(g);
  anim.clouds.push(g);
}
for (let i = 0; i < 32; i++) cloud();

// ── Install World & Progressive Streamer ─────────────────────────────────────
const worldReady = installRealisticWorld({
  scene,
  missions,
  getTerrainY,
  trailPoints: trailPoints2D,
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
  renderer.compile(scene, camera);
  hideBoot();
  // Tranquil, peaceful start directly at Station 0 Lobby (No flight on boot!)
}).catch(error => {
  console.error('Error inicializando streaming:', error);
  hideBoot();
});

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
    const targetStationId = (p.missionId !== undefined && p.missionId !== null) ? p.missionId : current;
    const q = getMission(targetStationId);
    p.totalInStation = players.filter(o => ((o.missionId !== undefined && o.missionId !== null) ? o.missionId : current) === targetStationId).length;
    const char = createHumanoidCharacter(p, i, q, getTerrainY, targetMission, startMission);
    scene.add(char);
    anim.players.push(char);
  });
}

function updateNavButtons() {
  const isFirst = current <= 0;
  const isLast = current >= 9;

  const cardBack = document.getElementById('cardBackBtn');
  if (cardBack) {
    cardBack.disabled = isFirst;
    cardBack.style.opacity = isFirst ? '0.35' : '1.0';
    cardBack.style.cursor = isFirst ? 'not-allowed' : 'pointer';
    cardBack.title = isFirst ? 'Estás en el Campamento Base (Lobby)' : (current === 1 ? 'Volver al Campamento Base' : `Ir a Misión ${current - 1}`);
  }

  const cardNext = document.getElementById('cardNextBtn');
  if (cardNext) {
    cardNext.disabled = isLast;
    cardNext.style.opacity = isLast ? '0.35' : '1.0';
    cardNext.style.cursor = isLast ? 'not-allowed' : 'pointer';
    cardNext.title = isLast ? 'Último checkpoint alcanzado' : (current === 0 ? 'Iniciar Aventura (Partir a Misión 01)' : `Ir a Misión ${current + 1}`);
    cardNext.textContent = current === 0 ? 'Partir a Misión 01 ▶' : 'Avanzar Misión ▶';
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
  const q = getMission(current);
  const pct = Math.round((current / 9) * 100);

  // Update Mission Card in Sidebar
  const mEyebrow = document.getElementById('missionEyebrow');
  if (mEyebrow) {
    if (current === 0) {
      mEyebrow.textContent = 'BIENVENIDA · CAMPAMENTO BASE';
    } else {
      mEyebrow.textContent = `CHECKPOINT ${String(current).padStart(2, '0')}/09 · ${q.region.toUpperCase()}`;
    }
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
    const badgeContent = x.id === 0 ? '⛺' : (isDone ? '✓' : String(x.id));
    const statusText = x.id === 0 ? (isActive ? '📍 En curso' : '✓ Base') : (isDone ? '✓ Completada' : isActive ? '📍 En curso' : 'Explorar');
    return `
      <div class="mission-row ${stateClass}" data-id="${x.id}" role="button" tabindex="0" title="Haz clic para ${x.id === 0 ? 'ir al Campamento Base' : 'viajar a ' + x.name}">
        <span class="badge">${badgeContent}</span>
        <span class="mission-info"><b>${x.name}</b><small>${x.region}</small></span>
        <span class="status-pill">${statusText}</span>
      </div>`;
  }).join('');

  mList.querySelectorAll('.mission-row').forEach(row => {
    row.onclick = () => {
      const id = +row.getAttribute('data-id');
      if (!isNaN(id)) setMission(id, true);
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
  0: { o: [5.2, 6.8, 9.8], h: 1.5 }, // Lobby de Expedición
  1: { o: [4.2, 5.8, 8.5], h: 1.2 },
  2: { o: [4.8, 6.8, 9.2], h: 1.5 },
  3: { o: [4.5, 6.5, 9.0], h: 1.4 },
  4: { o: [5.8, 9.6, 14.5], h: 2.2 },
  5: { o: [4.8, 6.8, 9.5], h: 1.5 },
  6: { o: [4.8, 6.8, 10.2], h: 1.6 },
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
  if (Number(id) === 0) {
    // Station 0 Lobby: completely peaceful, zero camera flight!
    const destination = getMission(0);
    const targetPose = cameraPose(destination);
    camera.position.copy(targetPose.pos);
    lookTarget.copy(targetPose.look);
    camera.lookAt(lookTarget);
    orbit.target.copy(lookTarget);
    cinematicUI(false);
    travel = null;
    rebuildPlayers();
    return;
  }
  const destination = getMission(id);
  const targetPose = cameraPose(destination);

  const dist = camera.position.distanceTo(targetPose.pos);
  // Total duration ~8.5 seconds for slower, majestic travel with calm station showcase:
  // 1. ZOOM OUT (~1.7s)
  // 2. MOVER    (~2.1s)
  // 3. ZOOM IN  (~1.5s)
  // 4. MOSTRAR LA ESTACIÓN (~3.5s slow panoramic sweep)
  const duration = Math.min(9.8, Math.max(8.0, dist * 0.010 + 7.0));

  const finalR = Math.hypot(targetPose.pos.x - destination.x, targetPose.pos.z - destination.z);
  const finalAngle = Math.atan2(targetPose.pos.x - destination.x, targetPose.pos.z - destination.z);
  const sweepAngle = finalAngle - 1.35; // ~77 deg frontal sweep

  const entryX = destination.x + Math.sin(sweepAngle) * finalR;
  const entryZ = destination.z + Math.cos(sweepAngle) * finalR;
  const entryY = targetPose.pos.y;
  const cloudY = 155;

  travel = {
    startPos: camera.position.clone(),
    startLook: lookTarget.clone(),
    finalPos: targetPose.pos.clone(),
    finalLook: targetPose.look.clone(),
    destination,
    targetPose,
    finalR,
    finalAngle,
    sweepAngle,
    entryX,
    entryZ,
    entryY,
    cloudY,
    destinationName: destination.name,
    t: 0,
    duration
  };

  // Teleport characters to destination immediately as flight begins!
  rebuildPlayers();

  cinematicUI(true, `Rumbo a ${destination.name}...`);
}

function cinematicUI(active, phase = '') {
  const layer = document.getElementById('cinematicSequence'), stage = document.getElementById('stage');
  if (layer) layer.classList.toggle('active', active);
  if (stage) stage.classList.toggle('cinematic-running', active);
  const label = document.getElementById('cinematicPhase'), bar = document.getElementById('cinematicBar');
  if (label && phase) label.textContent = phase;
  if (bar && !active) bar.style.width = '0%';
}

const first = cameraPose(getMission(current));
camera.position.copy(first.pos);
let lookTarget = first.look.clone();
camera.lookAt(lookTarget);

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
orbit.minDistance = 3.0;
orbit.maxDistance = 600;
orbit.minPolarAngle = 0.04;
orbit.maxPolarAngle = Math.PI * 0.47;
orbit.target.copy(lookTarget);

orbit.addEventListener('change', () => {
  const groundY = getTerrainY(camera.position.x, camera.position.z);
  if (camera.position.y < groundY + 1.8) {
    camera.position.y = groundY + 1.8;
  }
});

// Keyboard WASD Flight & Walking Controls
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
  if (k === 'f') setFirstPerson(!firstPerson);
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

// ── Mission Sky Title Auto-Activation by Proximity ───────────────────────────
function updateSkyMissionTitle(camX, camZ) {
  let closestMission = null;
  let minDist = 99999;
  for (const m of missions) {
    const d = Math.hypot(camX - m.x, camZ - m.z);
    if (d < minDist) {
      minDist = d;
      closestMission = m;
    }
  }

  const skyTitleEl = document.getElementById('missionSkyTitle');
  if (!skyTitleEl) return;

  // Show if near any mission checkpoint (< 55m) OR during travel
  if (travel || minDist < 55.0) {
    const targetMission = travel
      ? (missions.find(m => m.name === travel.destinationName) || closestMission)
      : closestMission;

    if (targetMission) {
      const numEl = document.getElementById('skyMissionNum');
      const nameEl = document.getElementById('skyMissionName');
      const regEl = document.getElementById('skyMissionRegion');
      if (numEl) numEl.textContent = `MISIÓN ${String(targetMission.id).padStart(2, '0')}`;
      if (nameEl) nameEl.textContent = targetMission.name.toUpperCase();
      if (regEl) regEl.textContent = targetMission.region;
      skyTitleEl.classList.add('visible');
    }
  } else {
    skyTitleEl.classList.remove('visible');
  }
}

// ── First-Person Explorer Mode (Human Scale 1.75m Walking Ground View) ───────
let firstPerson = false;
let fpYaw = 0, fpPitch = 0;
let fpIsMouseDown = false, fpPrevX = 0, fpPrevY = 0;
const firstPersonBtn = document.getElementById('firstPersonBtn');

function setFirstPerson(enabled) {
  firstPerson = enabled;
  if (firstPersonBtn) {
    firstPersonBtn.classList.toggle('first-person-active', enabled);
    firstPersonBtn.title = enabled
      ? 'Modo Explorador: Activado (Camina a pie con W,A,S,D y mira con ratón)'
      : 'Modo Explorador: Desactivado (Clic para caminar a pie a escala humana)';
  }
  if (enabled) {
    if (freeCamera) setFreeCamera(false);
    travel = null;
    cinematicUI(false);
    orbit.enabled = false;

    // Ground camera to eye-level (1.75m above solid terrain)
    const groundY = getTerrainY(camera.position.x, camera.position.z);
    camera.position.y = groundY + 1.75;
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    fpYaw = Math.atan2(forward.x, forward.z);
    fpPitch = 0;
  } else {
    orbit.enabled = freeCamera;
  }
}
firstPersonBtn?.addEventListener('click', () => setFirstPerson(!firstPerson));

renderer.domElement.addEventListener('mousedown', e => {
  if (firstPerson) {
    fpIsMouseDown = true;
    fpPrevX = e.clientX;
    fpPrevY = e.clientY;
  }
});
window.addEventListener('mouseup', () => { fpIsMouseDown = false; });
window.addEventListener('mousemove', e => {
  if (firstPerson && fpIsMouseDown) {
    const dx = e.clientX - fpPrevX;
    const dy = e.clientY - fpPrevY;
    fpPrevX = e.clientX;
    fpPrevY = e.clientY;
    fpYaw -= dx * 0.0035;
    fpPitch = clamp(fpPitch - dy * 0.0035, -Math.PI * 0.42, Math.PI * 0.42);
  }
});

const freeCameraBtn = document.getElementById('freeCameraBtn');
function setFreeCamera(enabled) {
  freeCamera = enabled;
  if (firstPerson && enabled) setFirstPerson(false);
  orbit.enabled = enabled;
  if (freeCameraBtn) {
    freeCameraBtn.classList.toggle('active', enabled);
    freeCameraBtn.setAttribute('aria-pressed', String(enabled));
    freeCameraBtn.title = enabled
      ? 'Cámara libre aérea: Activada (Usa ratón o teclas W,A,S,D para volar libremente)'
      : 'Cámara libre aérea: Desactivada (Clic para explorar libremente)';
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
  if (current <= 0) return;
  setMission(current - 1, true);
}

function nextMission() {
  if (current >= 9) return;
  setMission(current + 1, true);
}

function setMission(id, move = true) {
  const targetId = clamp(Number(id) ?? 0, 0, 9);
  const startMission = getMission(current);
  current = targetId;
  const targetMission = getMission(current);

  // Direct DOM updates for instant responsiveness
  const mEyebrow = document.getElementById('missionEyebrow');
  if (mEyebrow) {
    if (current === 0) {
      mEyebrow.textContent = 'BIENVENIDA · CAMPAMENTO BASE';
    } else {
      mEyebrow.textContent = `CHECKPOINT ${String(current).padStart(2, '0')}/09 · ${targetMission.region.toUpperCase()}`;
    }
  }

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
  if (pPct) pPct.textContent = Math.round((current / 9) * 100) + '%';

  const mStatus = document.getElementById('missionStatus');
  if (mStatus) {
    mStatus.textContent = current === 0 ? 'Punto de Partida' : (current === 9 ? 'Último Checkpoint' : 'En curso');
  }

  // Lobby CTA button vs Standard Nav
  const lobbyCta = document.getElementById('lobbyCtaContainer');
  const stdNav = document.getElementById('standardMissionNav');
  if (lobbyCta) lobbyCta.style.display = current === 0 ? 'block' : 'none';
  if (stdNav) stdNav.style.display = current === 0 ? 'none' : 'grid';

  renderMissionsList();
  updateNavButtons();

  if (move) {
    players.forEach(p => p.missionId = current);
    rebuildPlayers(startMission, targetMission);
  }

  save();
  applyStates();
  if (current !== 0) {
    startTravel(current, true);
  } else {
    // Station 0 Lobby: completely peaceful, zero camera flight!
    const pose = cameraPose(getMission(0));
    camera.position.copy(pose.pos);
    lookTarget.copy(pose.look);
    camera.lookAt(lookTarget);
    orbit.target.copy(lookTarget);
    cinematicUI(false);
    travel = null;
  }
}

function loadEditor(id) {
  const q = getMission(id);
  if (!q) return;
  const editN = document.getElementById('missionEditName');
  if (editN) editN.value = q.name;
  const editD = document.getElementById('missionEditDesc');
  if (editD) editD.value = q.desc;
  const editR = document.getElementById('missionEditRegion');
  if (editR) editR.value = q.region;
}
window.setMission = setMission;
window.nextMission = nextMission;
window.prevMission = prevMission;

// Attach event listeners reliably using addEventListener
document.getElementById('advanceMissionBtn')?.addEventListener('click', nextMission);
document.getElementById('backMissionBtn')?.addEventListener('click', prevMission);
document.getElementById('cardNextBtn')?.addEventListener('click', nextMission);
document.getElementById('cardBackBtn')?.addEventListener('click', prevMission);
document.getElementById('hudNextBtn')?.addEventListener('click', nextMission);
document.getElementById('hudPrevBtn')?.addEventListener('click', prevMission);
document.getElementById('startJourneyBtn')?.addEventListener('click', () => setMission(1, true));

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
  setJourneyCopy('Todo el equipo ha sido reunido en: ' + getMission(current).name);
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
  const q = getMission(targetId);
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
  a.href = URL.createObjectURL(new Blob([JSON.stringify({ missions, current, players, gearChecklist, contractChecklist, humandChecklist, safetyChecklist }, null, 2)], { type: 'application/json' }));
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
      if (d.safetyChecklist) safetyChecklist = d.safetyChecklist;
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

const safetyDialog = document.getElementById('safetyDialog');
document.getElementById('closeSafetyDialog')?.addEventListener('click', () => safetyDialog?.close());
['Evac', 'Meeting', 'Vehicle', 'Rules'].forEach(k => {
  const key = k.toLowerCase();
  const el = document.getElementById(`check${k}`);
  if (el) {
    el.checked = !!safetyChecklist[key];
    document.getElementById(`card${k}`)?.classList.toggle('delivered', el.checked);
    el.onchange = () => {
      safetyChecklist[key] = el.checked;
      document.getElementById(`card${k}`)?.classList.toggle('delivered', el.checked);
      save();
    };
  }
});
document.getElementById('grantSafetyXpBtn')?.addEventListener('click', () => {
  players.forEach(p => { p.points = (p.points || 0) + 25; });
  save();
  renderUI();
  safetyDialog?.close();
});

const cosmosDialog = document.getElementById('cosmosDialog');
document.getElementById('closeCosmosDialog')?.addEventListener('click', () => cosmosDialog?.close());
['CosmosApp', 'CosmosPerks', 'CosmosHealth', 'CosmosRewards'].forEach(k => {
  const key = k.charAt(0).toLowerCase() + k.slice(1);
  const el = document.getElementById(`check${k}`);
  if (el) {
    el.checked = !!cosmosChecklist[key];
    document.getElementById(`card${k}`)?.classList.toggle('delivered', el.checked);
    el.onchange = () => {
      cosmosChecklist[key] = el.checked;
      document.getElementById(`card${k}`)?.classList.toggle('delivered', el.checked);
      save();
    };
  }
});
document.getElementById('grantCosmosXpBtn')?.addEventListener('click', () => {
  players.forEach(p => { p.points = (p.points || 0) + 25; });
  save();
  renderUI();
  cosmosDialog?.close();
});

const companyDialog = document.getElementById('companyDialog');
document.getElementById('closeCompanyDialog')?.addEventListener('click', () => companyDialog?.close());
['CompanyOrigins', 'CompanyMission', 'CompanyValues', 'CompanyFuture'].forEach(k => {
  const key = k.charAt(0).toLowerCase() + k.slice(1);
  const el = document.getElementById(`check${k}`);
  if (el) {
    el.checked = !!companyChecklist[key];
    document.getElementById(`card${k}`)?.classList.toggle('delivered', el.checked);
    el.onchange = () => {
      companyChecklist[key] = el.checked;
      document.getElementById(`card${k}`)?.classList.toggle('delivered', el.checked);
      save();
    };
  }
});
document.getElementById('grantCompanyXpBtn')?.addEventListener('click', () => {
  players.forEach(p => { p.points = (p.points || 0) + 25; });
  save();
  renderUI();
  companyDialog?.close();
});

const npsDialog = document.getElementById('npsDialog');
document.getElementById('closeNpsDialog')?.addEventListener('click', () => npsDialog?.close());
['NpsGoldenQuestion', 'NpsCustomerSegments', 'NpsFormulaScore', 'NpsClosedLoop'].forEach(k => {
  const key = k.charAt(0).toLowerCase() + k.slice(1);
  const el = document.getElementById(`check${k}`);
  if (el) {
    el.checked = !!npsChecklist[key];
    document.getElementById(`card${k}`)?.classList.toggle('delivered', el.checked);
    el.onchange = () => {
      npsChecklist[key] = el.checked;
      document.getElementById(`card${k}`)?.classList.toggle('delivered', el.checked);
      save();
    };
  }
});
document.getElementById('grantNpsXpBtn')?.addEventListener('click', () => {
  players.forEach(p => { p.points = (p.points || 0) + 25; });
  save();
  renderUI();
  npsDialog?.close();
});

function openCurrentMissionModal() {
  if (current === 1) gearDialog?.showModal();
  else if (current === 2) contractDialog?.showModal();
  else if (current === 3) humandDialog?.showModal();
  else if (current === 4) safetyDialog?.showModal();
  else if (current === 5) cosmosDialog?.showModal();
  else if (current === 6) companyDialog?.showModal();
  else if (current === 7) npsDialog?.showModal();
}

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

setTimeout(hideBoot, 300);
worldReady.then(hideBoot).catch(hideBoot);

// ── Render Loop ───────────────────────────────────────────────────────────────
const clock = new THREE.Clock();
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.035), t = clock.elapsedTime;

  if (anim.streamer) {
    anim.streamer.tickStream();
    anim.streamer.update(dt, t, camera.position);
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
      g.userData.fireLight.intensity = 1.6;
    }
    if (g.userData?.crystal) {
      g.userData.crystal.rotation.y += dt * 1.2;
    }
    if (g.userData?.covenantSeal) {
      g.userData.covenantSeal.rotation.y += dt * 0.9;
    }
    if (g.userData?.humandTerminal) {
      g.userData.humandTerminal.rotation.y += dt * 1.1;
    }
    if (g.userData?.cosmosCard) {
      g.userData.cosmosCard.rotation.y += dt * 0.85;
      const baseY = g.userData.cosmosCardBaseY || 1.85;
      g.userData.cosmosCard.position.y = baseY + Math.sin(t * 2.2) * 0.06;
    }
    if (g.userData?.armillaryRing1) {
      g.userData.armillaryRing1.rotation.y += dt * 0.6;
    }
    if (g.userData?.armillaryRing2) {
      g.userData.armillaryRing2.rotation.x += dt * 0.45;
    }
  });

  // Idle breathing, cape flutter, plume & rotating magic plinth ring
  anim.players.forEach(a => {
    const u = a.userData;
    if (!u) return;

    // Organic breathing bob
    if (u.bodyBob) {
      u.bodyBob.position.y = 0.88 + Math.sin(t * 2.8 + (u.phase || 0)) * 0.025;
    }
    // Cape gentle sway
    if (u.capeGroup) {
      u.capeGroup.rotation.x = -0.14 + Math.sin(t * 3.2 + (u.phase || 0)) * 0.06;
    }
    // Feather plume flutter
    if (u.plumeGroup) {
      u.plumeGroup.rotation.z = Math.sin(t * 4.0 + (u.phase || 0)) * 0.08;
    }
    // Rotating magic team rune ring on plinth
    if (u.runeRing) {
      u.runeRing.rotation.z += dt * 0.8;
    }
    // Floating team gem rotation & pulse
    if (u.gem) {
      u.gem.rotation.y += dt * 1.6;
      u.gem.position.y = 1.30 + Math.sin(t * 3.0 + (u.phase || 0)) * 0.03;
    }
  });

  anim.clouds.forEach(c => {
    c.position.x += c.userData.speed * dt;
    if (c.position.x > 340) c.position.x = -340;
  });

  // ── 4 CLEAR STEPS: ZOOM OUT -> MOVER -> ZOOM IN -> MOSTRAR LOCACION ─────────
  if (travel) {
    travel.t = Math.min(1, travel.t + dt / travel.duration);
    const curT = travel.t;
    const dest = travel.destination;

    let currX, currY, currZ;

    if (curT < 0.20) {
      // 1. ZOOM OUT (Sube verticalmente a las nubes, la cámara se aleja con calma)
      const s = cinematicEase(curT / 0.20);
      currX = travel.startPos.x;
      currZ = travel.startPos.z;
      currY = travel.startPos.y + (travel.cloudY - travel.startPos.y) * s;
      lookTarget.copy(travel.startLook);
    } else if (curT < 0.44) {
      // 2. MOVER (Se traslada en las nubes hacia la otra locación a velocidad tranquila)
      const s = cinematicEase((curT - 0.20) / 0.24);
      currX = travel.startPos.x + (travel.entryX - travel.startPos.x) * s;
      currZ = travel.startPos.z + (travel.entryZ - travel.startPos.z) * s;
      currY = travel.cloudY;
      lookTarget.lerpVectors(travel.startLook, travel.finalLook, s);
    } else if (curT < 0.60) {
      // 3. ZOOM IN (Baja verticalmente de las nubes al frente de la nueva locación con suavidad)
      const s = cinematicEase((curT - 0.44) / 0.16);
      currX = travel.entryX;
      currZ = travel.entryZ;
      currY = travel.cloudY + (travel.entryY - travel.cloudY) * s;
      lookTarget.copy(travel.finalLook);
    } else {
      // 4. AL LLEGAR: MOSTRAR LA ESTACIÓN (Paneo frontal en arco pausado, lento y majestuoso a nivel de suelo)
      const s = cinematicEase((curT - 0.60) / 0.40);
      const ang = travel.sweepAngle + (travel.finalAngle - travel.sweepAngle) * s;
      currX = dest.x + Math.sin(ang) * travel.finalR;
      currZ = dest.z + Math.cos(ang) * travel.finalR;
      currY = travel.entryY;
      lookTarget.copy(travel.finalLook);
    }

    camera.position.set(currX, currY, currZ);
    camera.lookAt(lookTarget);
    orbit.target.copy(lookTarget);
    updateSkyMissionTitle(currX, currZ);

    const bar = document.getElementById('cinematicBar');
    if (bar) bar.style.width = (curT * 100).toFixed(1) + '%';

    if (curT >= 1) {
      // Llegada completa: se posa suavemente en la posición final sin cortes
      camera.position.copy(travel.finalPos);
      lookTarget.copy(travel.finalLook);
      camera.lookAt(lookTarget);
      orbit.target.copy(lookTarget);

      travel = null;
      cinematicUI(false);
    }
  } else if (firstPerson) {
    // 2. First-Person Explorer Ground Walking Mode (1.75m Eye Level)
    const moveSpeed = (keys.shift ? 16 : 8.5) * dt;
    const forwardX = -Math.sin(fpYaw);
    const forwardZ = -Math.cos(fpYaw);
    const rightX = Math.cos(fpYaw);
    const rightZ = -Math.sin(fpYaw);

    const moveDeltaX = (keys.w ? forwardX : 0) + (keys.s ? -forwardX : 0) + (keys.d ? rightX : 0) + (keys.a ? -rightX : 0);
    const moveDeltaZ = (keys.w ? forwardZ : 0) + (keys.s ? -forwardZ : 0) + (keys.d ? rightZ : 0) + (keys.a ? -rightZ : 0);
    const moveLen = Math.hypot(moveDeltaX, moveDeltaZ);

    if (moveLen > 0.001) {
      camera.position.x += (moveDeltaX / moveLen) * moveSpeed;
      camera.position.z += (moveDeltaZ / moveLen) * moveSpeed;
    }

    // Keep camera within continental island bounds
    camera.position.x = clamp(camera.position.x, -325, 325);
    camera.position.z = clamp(camera.position.z, -205, 205);

    const groundY = getTerrainY(camera.position.x, camera.position.z);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, groundY + 1.75, 0.25);

    camera.rotation.set(fpPitch, fpYaw, 0, 'YXZ');
    lookTarget.set(
      camera.position.x + forwardX * 6,
      camera.position.y + Math.sin(fpPitch) * 6,
      camera.position.z + forwardZ * 6
    );

    updateSkyMissionTitle(camera.position.x, camera.position.z);
  } else if (freeCamera) {
    // 3. Free Aerial WASD Flight Mode with Ground Clearance Collision
    const moveSpeed = (keys.shift ? 80 : 38) * dt;
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

    // Enforce map boundaries and ground clearance
    camera.position.x = clamp(camera.position.x, -330, 330);
    camera.position.z = clamp(camera.position.z, -210, 210);
    const minCamY = getTerrainY(camera.position.x, camera.position.z) + 1.8;
    if (camera.position.y < minCamY) {
      camera.position.y = minCamY;
    }

    orbit.update();
    lookTarget.copy(orbit.target);
    updateSkyMissionTitle(camera.position.x, camera.position.z);
  } else {
    // 4. Station Focused Orbit Pose
    const pose = cameraPose(getMission(current));
    if (camera.position.distanceTo(pose.pos) > 0.005) {
      camera.position.lerp(pose.pos, 0.06);
      lookTarget.lerp(pose.look, 0.06);
      camera.lookAt(lookTarget);
      orbit.target.copy(lookTarget);
    }
    updateSkyMissionTitle(camera.position.x, camera.position.z);
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

  // Update directional sun shadow camera to follow active focus area with cinematic angle
  sun.target.position.set(lookTarget.x, getTerrainY(lookTarget.x, lookTarget.z), lookTarget.z);
  sun.position.set(lookTarget.x + 85, 125, lookTarget.z + 75);

  updateWeather(t, dt);
  renderer.render(scene, camera);
}
loop();
