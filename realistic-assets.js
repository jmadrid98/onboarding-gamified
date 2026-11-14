import * as THREE from './vendor/three/build/three.module.js';
import { GLTFLoader } from './vendor/three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from './vendor/three/examples/jsm/loaders/FBXLoader.js';
import { clone as cloneSkeleton } from './vendor/three/examples/jsm/utils/SkeletonUtils.js';

const loader = new GLTFLoader();
const fbxLoader = new FBXLoader();
const modelCache = new Map();

let cachedCharacterFBX = null;
const cachedCharacterAnims = { idle: null, run: null, jump: null };
const skinTextureMap = new Map();
let characterLoadPromise = null;

export const BRAND_PALETTE = {
  red: 0xcc092f,
  darkRed: 0x8a0620,
  silver: 0xe2e8f0,
  white: 0xffffff
};

const KENNEY_CHAR_BASE = './assets/library/kenney_animated_characters_protagonists';

const SKIN_FILES = {
  skaterMale: `${KENNEY_CHAR_BASE}/Skins/skaterMaleA.png`,
  skaterFemale: `${KENNEY_CHAR_BASE}/Skins/skaterFemaleA.png`,
  cyborgFemale: `${KENNEY_CHAR_BASE}/Skins/cyborgFemaleA.png`,
  criminalMale: `${KENNEY_CHAR_BASE}/Skins/criminalMaleA.png`
};

function loadFbxSafe(path) {
  return new Promise(resolve => {
    fbxLoader.load(path, resolve, undefined, err => {
      console.warn('Error cargando FBX:', path, err);
      resolve(null);
    });
  });
}

function loadTextureSafe(path) {
  return new Promise(resolve => {
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(
      path,
      tex => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.flipY = true;
        resolve(tex);
      },
      undefined,
      err => {
        console.warn('Error cargando textura de skin:', path, err);
        resolve(null);
      }
    );
  });
}

function pickMainAnimClip(fbx, preferredName) {
  const clips = fbx?.animations || [];
  if (!clips.length) return null;
  return (
    clips.find(c => c.name.toLowerCase().includes(preferredName) && c.duration > 0.1) ||
    clips.find(c => !c.name.toLowerCase().includes('targeting') && c.duration > 0.1) ||
    clips.reduce((best, c) => (c.duration > best.duration ? c : best), clips[0])
  );
}

export function loadCharacterModel() {
  if (characterLoadPromise) return characterLoadPromise;

  characterLoadPromise = (async () => {
    const [fbx, idleFbx, runFbx, jumpFbx, ...loadedSkins] = await Promise.all([
      loadFbxSafe(`${KENNEY_CHAR_BASE}/Model/characterMedium.fbx`),
      loadFbxSafe(`${KENNEY_CHAR_BASE}/Animations/idle.fbx`),
      loadFbxSafe(`${KENNEY_CHAR_BASE}/Animations/run.fbx`),
      loadFbxSafe(`${KENNEY_CHAR_BASE}/Animations/jump.fbx`),
      ...Object.entries(SKIN_FILES).map(async ([key, path]) => [key, await loadTextureSafe(path)])
    ]);

    if (fbx) cachedCharacterFBX = fbx;
    cachedCharacterAnims.idle = pickMainAnimClip(idleFbx, 'idle');
    cachedCharacterAnims.run = pickMainAnimClip(runFbx, 'run');
    cachedCharacterAnims.jump = pickMainAnimClip(jumpFbx, 'jump');

    loadedSkins.forEach(([key, tex]) => {
      if (tex) skinTextureMap.set(key, tex);
    });

    return { model: cachedCharacterFBX, anims: cachedCharacterAnims };
  })();

  return characterLoadPromise;
}

export function loadModel(path) {
  if (!path || typeof path !== 'string') return Promise.resolve(null);
  if (modelCache.has(path)) return modelCache.get(path);
  const p = new Promise(resolve => {
    let resolved = false;
    const safeResolve = val => {
      if (!resolved) {
        resolved = true;
        resolve(val);
      }
    };
    const timer = setTimeout(() => {
      console.warn('Timeout cargando modelo 3D:', path);
      safeResolve(null);
    }, 25000);

    try {
      loader.load(
        path,
        gltf => {
          clearTimeout(timer);
          safeResolve(gltf);
        },
        undefined,
        err => {
          clearTimeout(timer);
          console.warn('Error cargando modelo 3D:', path, err);
          safeResolve(null);
        }
      );
    } catch (e) {
      clearTimeout(timer);
      safeResolve(null);
    }
  });
  modelCache.set(path, p);
  return p;
}

function prepare(root, castShadow = true) {
  root.traverse(o => {
    if (o.isMesh) {
      o.castShadow = castShadow;
      o.receiveShadow = true;
      o.frustumCulled = true;
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(m => {
          m.roughness = 0.85;
          m.metalness = 0.0;
          m.envMapIntensity = 0.0;
          m.needsUpdate = true;
        });
      }
    }
  });
  return root;
}

// Rock-solid grounded wrapper: guarantees bottom touches y = 0 and is centered in X/Z
async function instantiate(path, targetHeight = 3.0, castShadow = true) {
  if (!path || typeof path !== 'string') return null;
  try {
    const gltf = await loadModel(path);
    if (!gltf || !gltf.scene) return null;

    const wrapper = new THREE.Group();
    let clonedScene = null;
    try {
      clonedScene = cloneSkeleton(gltf.scene);
    } catch {
      clonedScene = gltf.scene.clone(true);
    }
    const clone = prepare(clonedScene, castShadow);
    wrapper.add(clone);

    clone.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const scale = targetHeight / Math.max(0.001, size.y);
    clone.scale.setScalar(scale);

    clone.updateMatrixWorld(true);
    const boxScaled = new THREE.Box3().setFromObject(clone);
    const isTree = typeof path === 'string' && path.toLowerCase().includes('tree');
    // Sink trees 22cm deeper into the slope so the flat trunk cut never hovers in the air!
    const sinkOffset = isTree ? (targetHeight * 0.05 + 0.14) : 0.03;
    clone.position.y = -boxScaled.min.y - sinkOffset;
    clone.position.x = -((boxScaled.min.x + boxScaled.max.x) / 2);
    clone.position.z = -((boxScaled.min.z + boxScaled.max.z) / 2);

    // Natural Root Grounding: soft ambient contact shadow disk under the trunk
    if (isTree) {
      const shadowRadius = Math.max(0.7, targetHeight * 0.18);
      const shadowGeo = new THREE.CircleGeometry(shadowRadius, 14);
      shadowGeo.rotateX(-Math.PI / 2);
      const shadowMat = new THREE.MeshBasicMaterial({
        color: 0x142010,
        transparent: true,
        opacity: 0.40,
        depthWrite: false
      });
      const shadowDisk = new THREE.Mesh(shadowGeo, shadowMat);
      shadowDisk.position.y = 0.03;
      wrapper.add(shadowDisk);
    }

    wrapper.userData.animations = gltf.animations || [];
    return wrapper;
  } catch (e) {
    return null;
  }
}

function seeded(i) {
  const x = Math.sin(i * 999.91) * 43758.5453;
  return x - Math.floor(x);
}

// ── Model Paths Catalog ──────────────────────────────────────────────────────
const ASSETS = {
  trees: [
    './assets/stylized/nature/Tree_1_A_Color1.gltf',     // 0: Roble frondoso grande estilizado (copa redondeada verde vivo)
    './assets/stylized/nature/Tree_1_B_Color1.gltf',     // 1: Roble frondoso mediano estilizado
    './assets/stylized/nature/Tree_1_C_Color1.gltf',     // 2: Roble frondoso extendido estilizado
    './assets/stylized/nature/Tree_2_A_Color1.gltf',     // 3: Pino/conífera estilizada verde vivo A
    './assets/stylized/nature/Tree_2_B_Color1.gltf',     // 4: Pino/conífera estilizada verde vivo B
    './assets/stylized/nature/Tree_2_C_Color1.gltf',     // 5: Pino/conífera estilizada verde vivo C
    './assets/stylized/nature/Tree_3_A_Color1.gltf',     // 6: Árbol cónico alto estilizado verde A (ciprés/álamo)
    './assets/stylized/nature/Tree_3_B_Color1.gltf',     // 7: Árbol cónico estilizado verde B
    './assets/stylized/nature/Tree_3_C_Color1.gltf',     // 8: Árbol cónico estilizado verde C
    './assets/stylized/nature/Tree_4_A_Color1.gltf',     // 9: Árbol sabana/paraguas de copa ancha verde
    './assets/stylized/nature/Tree_5_A_Color1.gltf',     // 10: Árbol verde vivo frondoso estilizado
    './assets/stylized/nature/Tree_6_A_Color1.gltf',     // 11: Sauce llorón / árbol verde esbelto estilizado
    './assets/stylized/nature/Tree_7_A_Color1.gltf',     // 12: Árbol majestuoso colosal verde denso estilizado
    './assets/polyfork/birch-tree-181b33.glb',          // 13: Abedul con tronco blanco y hojas verdes vivas
    './assets/polyfork/tall-pine-tree-ab4108.glb',       // 14: Pino verde alto natural
    './assets/polyfork/broadleaf-oak-997c22.glb',        // 15: Roble natural de copa frondosa verde
    './assets/polyfork/maple-tree-65fa12.glb',           // 16: Arce verde frondoso
    './assets/polyfork/young-pine-0d7695.glb'            // 17: Pino silvestre joven verde
  ],
  bushes: [
    './assets/polyfork/round-bush-cd2ac0.glb',          // 0: Arbusto globular verde vivo frondoso natural
    './assets/polyfork/bush-8bb596.glb',                // 1: Arbusto silvestre verde denso con ramas
    './assets/polyfork/fern-plant-1559b8.glb',           // 2: Helecho silvestre verde vivo 3D
    './assets/polyfork/grass-tuft-a40a08.glb',          // 3: Mechón de hierba natural verde 3D
    './assets/polyfork/round-bush-cd2ac0.glb',          // 4: Arbusto globular verde vivo frondoso
    './assets/polyfork/bush-8bb596.glb',                // 5: Arbusto silvestre verde denso
    './assets/polyfork/fern-plant-1559b8.glb',           // 6: Helecho silvestre verde vivo 3D
    './assets/polyfork/grass-tuft-a40a08.glb'           // 7: Mechón de hierba natural verde 3D
  ],
  rocks: [
    './assets/stylized/nature/Rock_1_A_Color1.gltf',     // 0: Peñasco de roca estilizada A
    './assets/stylized/nature/Rock_1_E_Color1.gltf',     // 1: Roca redondeada estilizada
    './assets/stylized/nature/Rock_2_A_Color1.gltf',     // 2: Roca mediana estilizada
    './assets/stylized/nature/Rock_3_A_Color1.gltf',     // 3: Roca estilizada baja
    './assets/stylized/nature/Rock_5_A_Color1.gltf'      // 4: Piedra grande estilizada
  ],
  props: {
    chest: './assets/stylized/props/chest_gold.gltf',
    stackedBoxes: './assets/stylized/props/box_stacked.gltf',
    largeBox: './assets/stylized/props/box_large.gltf',
    barrel: './assets/stylized/props/barrel_large.gltf',
    signingTable: './assets/stylized/props/table_long_tablecloth_decorated_A.gltf',
    banner: './assets/stylized/props/banner_shield_blue.gltf'
  },
  polyfork: {
    // Estación 0: Campamento Base & Bienvenida
    villageTavern: './assets/polyfork/village-tavern-4e94e3.glb',
    villageWell: './assets/polyfork/village-well-f8e361.glb',
    timberTable: './assets/polyfork/heavy-timber-picnic-table-1ac060.glb',
    campNoticeBoard: './assets/polyfork/camp-notice-board-c0be42.glb',
    fourWheelWagon: './assets/polyfork/four-wheel-wagon-adb946.glb',
    woodenCrate: './assets/polyfork/wooden-crate-b9c96a.glb',
    woodenFence: './assets/polyfork/wooden-fence-3d8ee7.glb',
    lampPost: './assets/polyfork/lamp-post-c9e409.glb',
    grainSack: './assets/polyfork/grain-sack-401d96.glb',
    // Estación 1: Arsenal y Equipos
    canvasWallTent: './assets/polyfork/canvas-wall-tent-de8a04.glb',
    canvasRidgeTent: './assets/polyfork/canvas-ridge-tent-f0df0d.glb',
    watchtower: './assets/polyfork/watchtower-140f78.glb',
    blacksmithForge: './assets/polyfork/blacksmith-forge-09fa85.glb',
    anvil: './assets/polyfork/anvil-1286cb.glb',
    quenchBarrel: './assets/polyfork/quench-barrel-0c78fd.glb',
    weaponRack: './assets/polyfork/weapon-rack-082d7f.glb',
    armourStand: './assets/polyfork/armour-stand-3d77c4.glb',
    woodenCart: './assets/polyfork/wooden-cart-bf83d8.glb',
    campfireCookTripod: './assets/polyfork/campfire-cook-tripod-d95a1e.glb',
    stoneCampfire: './assets/polyfork/stone-ring-campfire-8a0c6f.glb',
    firewoodStack: './assets/polyfork/firewood-stack-8a2899.glb',
    // Estación 2: Santuario del Pacto (Firma de Contrato y Beneficios)
    stoneChapel: './assets/polyfork/stone-chapel-03e774.glb',
    stoneAltar: './assets/polyfork/stone-altar-8f3a0a.glb',
    lowStoneWall: './assets/polyfork/low-stone-wall-8a8ea3.glb',
    chainedBookLectern: './assets/polyfork/chained-book-lectern-381597.glb',
    scrollRack: './assets/polyfork/scroll-rack-f465dd.glb',
    standingKnightStatue: './assets/polyfork/standing-knight-statue-8bdcc9.glb',
    ironStrongbox: './assets/polyfork/iron-banded-strongbox-698383.glb',
    standingBrazier: './assets/polyfork/standing-brazier-c9e4ee.glb',
    candleSpikeCluster: './assets/polyfork/candle-spike-cluster-d7c566.glb',
    // Estación 3: Valle del Refectorio (Humand y Comedor)
    timberBarn: './assets/polyfork/timber-barn-90b3ce.glb',
    thatchedCottage: './assets/polyfork/thatched-cottage-0e63f5.glb',
    splitLogBench: './assets/polyfork/split-log-bench-289780.glb',
    clayBreadOven: './assets/polyfork/clay-bread-oven-860b06.glb',
    marketStall: './assets/polyfork/market-stall-94937d.glb',
    basketOfProduce: './assets/polyfork/basket-of-produce-7420cf.glb',
    polyforkBarrel: './assets/polyfork/barrel-aadc94.glb',
    flowerPlanter: './assets/polyfork/flower-planter-500ed2.glb',
    // Alimentos y vajilla para el comedor y taberna
    breadLoaf: './assets/polyfork/bread-loaf-0e0ab5.glb',
    rusticPie: './assets/polyfork/pie-c27178.glb',
    goblet: './assets/polyfork/goblet-87c3ba.glb',
    wineJug: './assets/polyfork/clay-wine-jug-b4ebd3.glb',
    roastMeat: './assets/polyfork/charred-meat-haunch-be1ea2.glb',
    cazuelaPot: './assets/polyfork/cazuela-pot-79f0ee.glb'
  },
  animals: {
    deer: './assets/stylized/animals/Deer.gltf',
    stag: './assets/stylized/animals/Stag.gltf',
    fox: './assets/stylized/animals/Fox.gltf',
    horse: './assets/stylized/animals/Horse.gltf',
    wolf: './assets/stylized/animals/Wolf.gltf',
    alpaca: './assets/stylized/animals/Alpaca.gltf',
    rabbit: './assets/polyfork/forest-rabbit-ea2da0.glb',
    chicken: './assets/polyfork/village-chicken-9ba715.glb',
    sheep: './assets/polyfork/sheep-base.glb',
    goat: './assets/polyfork/goat-base.glb',
    crow: './assets/polyfork/crow-base.glb',
    bear: './assets/polyfork/black-bear-adbdc7.glb'
  },
  buildings: {
    tent: './assets/stylized/medieval/building_tent_blue.gltf',
    shrine: './assets/stylized/medieval/building_shrine_blue.gltf',
    market: './assets/stylized/medieval/building_market_blue.gltf',
    tower: './assets/stylized/medieval/building_tower_A_blue.gltf',
    watchtower: './assets/stylized/medieval/building_watchtower_blue.gltf',
    townhall: './assets/stylized/medieval/building_townhall_blue.gltf',
    tavern: './assets/stylized/medieval/building_tavern_blue.gltf',
    home: './assets/stylized/medieval/building_home_A_blue.gltf',
    docks: './assets/stylized/medieval/building_docks_blue.gltf',
    watermill: './assets/stylized/medieval/building_watermill_blue.gltf',
    shipyard: './assets/stylized/medieval/building_shipyard_blue.gltf',
    church: './assets/stylized/medieval/building_church_blue.gltf',
    archery: './assets/stylized/medieval/building_archeryrange_blue.gltf',
    blacksmith: './assets/stylized/medieval/building_blacksmith_blue.gltf',
    workshop: './assets/stylized/medieval/building_workshop_blue.gltf',
    windmill: './assets/stylized/medieval/building_windmill_blue.gltf',
    castle: './assets/stylized/medieval/building_castle_blue.gltf',
    cannonTower: './assets/stylized/medieval/building_tower_cannon_blue.gltf'
  }
};

// ── Stylized Props Builders (Campfire, Stepping Stones, Wooden Logs) ──────────

function createCampfire() {
  const g = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x6e685f, roughness: 0.9 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x4e3520, roughness: 0.95 });
  const emberMat = new THREE.MeshStandardMaterial({ color: 0xff4500, emissive: 0xff2200, emissiveIntensity: 2.5, roughness: 0.3 });

  // Ring of 8 stones
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 0), stoneMat);
    stone.position.set(Math.cos(a) * 0.55, 0.08, Math.sin(a) * 0.55);
    stone.scale.set(1.1, 0.7, 0.9);
    stone.rotation.y = i;
    stone.receiveShadow = true;
    g.add(stone);
  }

  // Cross logs
  for (let i = 0; i < 3; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.7, 6), woodMat);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = (i / 3) * Math.PI;
    log.position.y = 0.06;
    log.receiveShadow = true;
    g.add(log);
  }

  // Glowing center ember
  const ember = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 0), emberMat);
  ember.position.y = 0.12;
  g.add(ember);

  // Sitting log bench
  const bench = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 1.6, 7), woodMat);
  bench.rotation.z = Math.PI / 2;
  bench.rotation.y = 0.4;
  bench.position.set(0.2, 0.14, 1.15);
  bench.castShadow = true;
  bench.receiveShadow = true;
  g.add(bench);

  return g;
}

// ── Procedural Safety, Firefighting & Parking Props ──────────────────────────

function createCarriage({ color = 0x2471a3, roofColor = 0x1b4f72, trimGold = true } = {}) {
  const g = new THREE.Group();

  const woodMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.8 });
  const darkWood = new THREE.MeshStandardMaterial({ color: 0x3d2314, roughness: 0.85 });
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x2c3e50, metalness: 0.7, roughness: 0.3 });
  const cabinMat = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
  const roofMat = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.4 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xf39c12, metalness: 0.8, roughness: 0.2 });
  const lanternGlow = new THREE.MeshStandardMaterial({ color: 0xfff3cd, emissive: 0xffd54f, emissiveIntensity: 1.8 });

  // 1. Chasis
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.08, 1.8), darkWood);
  chassis.position.y = 0.42;
  g.add(chassis);

  [-0.55, 0.55].forEach(z => {
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 1.32, 8), ironMat);
    axle.rotation.z = Math.PI / 2;
    axle.position.set(0, 0.38, z);
    g.add(axle);
  });

  // Lanza / tiro frontal inclinada hacia el suelo (posición aparcada / desenganchada)
  const drawbar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.5), woodMat);
  drawbar.rotation.x = 0.22;
  drawbar.position.set(0, 0.28, 1.12);
  g.add(drawbar);

  // 2. Ruedas en el plano YZ (orientadas para rodar a lo largo de Z)
  function createWheel(radius) {
    const wg = new THREE.Group();
    // Llanta exterior en el plano YZ
    const rim = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.026, 8, 20), ironMat);
    rim.rotation.y = Math.PI / 2;
    wg.add(rim);

    // Maza con eje transversal a lo largo de X
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.08, 10), woodMat);
    hub.rotation.z = Math.PI / 2;
    wg.add(hub);

    // 6 Radios dentro del plano YZ
    for (let r = 0; r < 3; r++) {
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, radius * 2, 6), woodMat);
      spoke.rotation.x = (r * Math.PI) / 3;
      wg.add(spoke);
    }
    return wg;
  }

  [-0.60, 0.60].forEach(x => {
    const wFront = createWheel(0.32);
    wFront.position.set(x, 0.35, 0.55);
    wFront.castShadow = true;
    g.add(wFront);

    const wRear = createWheel(0.38);
    wRear.position.set(x, 0.38, -0.55);
    wRear.castShadow = true;
    g.add(wRear);
  });

  // 3. Cabina de la Carroza
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.78, 1.2), cabinMat);
  cabin.position.set(0, 0.88, -0.05);
  cabin.castShadow = true;
  g.add(cabin);

  if (trimGold) {
    const trim = new THREE.Mesh(new THREE.BoxGeometry(0.97, 0.04, 1.22), goldMat);
    trim.position.set(0, 0.96, -0.05);
    g.add(trim);
  }

  // Techo abovedado
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.3, 14, 1, false, 0, Math.PI), roofMat);
  roof.rotation.z = Math.PI / 2;
  roof.position.set(0, 1.27, -0.05);
  roof.castShadow = true;
  g.add(roof);

  // Ventanillas laterales
  [-0.49, 0.49].forEach(x => {
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.28, 0.35), goldMat);
    win.position.set(x, 0.95, -0.05);
    g.add(win);
  });

  // Asiento del cochero frontal
  const bench = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.25, 0.35), darkWood);
  bench.position.set(0, 0.70, 0.68);
  bench.castShadow = true;
  g.add(bench);

  // Faroles frontales
  [-0.50, 0.50].forEach(x => {
    const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.09), goldMat);
    lantern.position.set(x, 1.0, 0.55);
    const lightCore = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), lanternGlow);
    lantern.add(lightCore);
    g.add(lantern);
  });

  // Baúl trasero de equipaje
  const trunk = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.28, 0.28), darkWood);
  trunk.position.set(0, 0.68, -0.76);
  trunk.castShadow = true;
  g.add(trunk);

  return g;
}

function createCarport(width = 5.6, depth = 3.4, height = 2.4) {
  const g = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a3319, roughness: 0.85 });
  const beamMat = new THREE.MeshStandardMaterial({ color: 0x3d2712, roughness: 0.9 });
  const roofTileMat = new THREE.MeshStandardMaterial({ color: 0x1f4e79, roughness: 0.5 }); // azul pizarra

  // Postes verticales
  const postX = [0.1, width / 2, width - 0.1];
  const postZ = [-depth / 2 + 0.1, depth / 2 - 0.1];

  postX.forEach(x => {
    postZ.forEach(z => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, height, 0.12), woodMat);
      post.position.set(x, height / 2, z);
      post.castShadow = true;
      g.add(post);
    });
  });

  // Vigas maestras longitudinales
  [-depth / 2 + 0.1, depth / 2 - 0.1].forEach(z => {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(width + 0.2, 0.12, 0.12), beamMat);
    beam.position.set(width / 2, height, z);
    beam.castShadow = true;
    g.add(beam);
  });

  // Vigas transversales
  postX.forEach(x => {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, depth + 0.2), beamMat);
    beam.position.set(x, height + 0.06, 0);
    beam.castShadow = true;
    g.add(beam);
  });

  // Tejado de tablones inclinados (pergola/carport)
  for (let s = -depth / 2; s <= depth / 2; s += 0.38) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(width + 0.3, 0.035, 0.22), roofTileMat);
    slat.position.set(width / 2, height + 0.14, s);
    slat.castShadow = true;
    g.add(slat);
  }

  return g;
}

function createSafetyStationRack() {
  const g = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x3d2712, roughness: 0.9 });
  const redMat = new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.3 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xecf0f1, roughness: 0.4 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4ac0d, metalness: 0.8, roughness: 0.3 });

  // Panel de soporte de madera
  const panel = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.05, 0.08), woodMat);
  panel.position.y = 0.8;
  panel.castShadow = true;
  g.add(panel);

  // 2 Postes de fijación
  [-0.95, 0.95].forEach(x => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.35, 0.1), woodMat);
    post.position.set(x, 0.67, 0);
    g.add(post);
  });

  // 1. Carretel de manguera contra incendios (izquierda)
  const reelBox = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.16), redMat);
  reelBox.position.set(-0.68, 0.85, 0.08);
  g.add(reelBox);
  const reel = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.04, 8, 16), whiteMat);
  reel.position.set(-0.68, 0.85, 0.17);
  g.add(reel);
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.022, 0.2, 8), brassMat);
  nozzle.rotation.z = 0.5;
  nozzle.position.set(-0.6, 0.83, 0.19);
  g.add(nozzle);

  // 2. Gabinete de Primeros Auxilios con Cruz Roja (centro)
  const cabCanvas = document.createElement('canvas');
  cabCanvas.width = 128;
  cabCanvas.height = 128;
  const cctx = cabCanvas.getContext('2d');
  cctx.fillStyle = '#ffffff';
  cctx.fillRect(0, 0, 128, 128);
  cctx.fillStyle = '#d32f2f';
  cctx.fillRect(52, 20, 24, 88);
  cctx.fillRect(20, 52, 88, 24);
  const cabTex = new THREE.CanvasTexture(cabCanvas);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.5, 0.14), [whiteMat, whiteMat, whiteMat, whiteMat, new THREE.MeshBasicMaterial({ map: cabTex }), whiteMat]);
  cab.position.set(0, 0.85, 0.08);
  g.add(cab);

  // 3. Extintor montado a la derecha
  const ext = createFireExtinguisher();
  ext.scale.set(0.8, 0.8, 0.8);
  ext.position.set(0.68, 0.5, 0.1);
  g.add(ext);

  // 4. Camilla de rescate desplegada al frente del panel
  const stretcherMat = new THREE.MeshStandardMaterial({ color: 0xbdc3c7, metalness: 0.8, roughness: 0.3 });
  const orangeBed = new THREE.MeshStandardMaterial({ color: 0xe67e22, roughness: 0.7 });
  const stg = new THREE.Group();
  [-0.18, 0.18].forEach(z => {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.4, 8), stretcherMat);
    bar.rotation.z = Math.PI / 2;
    bar.position.z = z;
    stg.add(bar);
  });
  const bed = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.02, 0.34), orangeBed);
  stg.add(bed);
  [-0.42, 0.42].forEach(x => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.22, 8), stretcherMat);
    leg.position.set(x, -0.11, 0);
    stg.add(leg);
  });
  stg.position.set(0, 0.22, 0.5);
  g.add(stg);

  return g;
}


function createFireHydrant() {
  const g = new THREE.Group();
  const redMat = new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.3, metalness: 0.4 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4ac0d, metalness: 0.8, roughness: 0.3 });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.1, 12), redMat);
  base.position.y = 0.05;
  g.add(base);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.55, 12), redMat);
  barrel.position.y = 0.35;
  barrel.castShadow = true;
  g.add(barrel);

  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), redMat);
  dome.position.y = 0.625;
  g.add(dome);

  const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.06, 5), brassMat);
  nut.position.y = 0.74;
  g.add(nut);

  [-1, 1].forEach(dir => {
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.1, 8), brassMat);
    nozzle.rotation.z = Math.PI / 2;
    nozzle.position.set(dir * 0.14, 0.42, 0);
    g.add(nozzle);
  });

  return g;
}

function createFireHoseCabinet() {
  const g = new THREE.Group();
  const redMat = new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.3 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xecf0f1, roughness: 0.5 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4ac0d, metalness: 0.7, roughness: 0.3 });

  const box = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.85, 0.28), redMat);
  box.position.y = 0.85;
  box.castShadow = true;
  g.add(box);

  const windowFrame = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.02), new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.2 }));
  windowFrame.position.set(0, 0.85, 0.14);
  g.add(windowFrame);

  const reel = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.06, 8, 16), whiteMat);
  reel.position.set(0, 0.85, 0.13);
  g.add(reel);

  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.25, 8), brassMat);
  nozzle.rotation.z = 0.5;
  nozzle.position.set(0.12, 0.82, 0.15);
  g.add(nozzle);

  const signCanvas = document.createElement('canvas');
  signCanvas.width = 256;
  signCanvas.height = 48;
  const sctx = signCanvas.getContext('2d');
  sctx.fillStyle = '#ffffff';
  sctx.fillRect(0, 0, 256, 48);
  sctx.fillStyle = '#c0392b';
  sctx.font = 'bold 22px sans-serif';
  sctx.textAlign = 'center';
  sctx.fillText('INCENDIO / HOSE', 128, 32);
  const signTex = new THREE.CanvasTexture(signCanvas);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.65, 0.12), new THREE.MeshBasicMaterial({ map: signTex }));
  sign.position.set(0, 1.35, 0.15);
  g.add(sign);

  return g;
}

function createFireBucketStand() {
  const g = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a3525, roughness: 0.9 });
  const redMat = new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.4 });
  const sandMat = new THREE.MeshStandardMaterial({ color: 0xd4ac0d, roughness: 0.9 });

  [-0.45, 0.45].forEach(x => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.1, 0.08), woodMat);
    post.position.set(x, 0.55, 0);
    g.add(post);
  });
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.07, 0.07), woodMat);
  bar.position.set(0, 0.95, 0);
  g.add(bar);

  [-0.25, 0.25].forEach(x => {
    const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.08, 0.24, 12, 1, true), redMat);
    bucket.position.set(x, 0.72, 0);
    g.add(bucket);

    const sand = new THREE.Mesh(new THREE.CircleGeometry(0.11, 12), sandMat);
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(x, 0.81, 0);
    g.add(sand);
  });

  return g;
}

function createParkingSign() {
  const g = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x7f8c8d, metalness: 0.6, roughness: 0.4 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 12), poleMat);
  pole.position.y = 1.1;
  pole.castShadow = true;
  g.add(pole);

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1565c0';
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(10, 10, 236, 236, 32) : ctx.rect(10, 10, 236, 236);
  ctx.fill();
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 160px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('P', 128, 128);

  const tex = new THREE.CanvasTexture(canvas);
  const signMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4 });
  const signBackMat = new THREE.MeshStandardMaterial({ color: 0xbdc3c7, metalness: 0.5, roughness: 0.5 });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.03), [signBackMat, signBackMat, signBackMat, signBackMat, signMat, signBackMat]);
  sign.position.set(0, 1.95, 0.02);
  sign.castShadow = true;
  g.add(sign);

  return g;
}

function createSpeedLimitSign() {
  const g = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x7f8c8d, metalness: 0.6, roughness: 0.4 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.9, 12), poleMat);
  pole.position.y = 0.95;
  pole.castShadow = true;
  g.add(pole);

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(128, 128, 120, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 26;
  ctx.strokeStyle = '#c0392b';
  ctx.stroke();

  ctx.fillStyle = '#2c3e50';
  ctx.font = '900 90px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('10', 128, 130);
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText('km/h', 128, 175);

  const tex = new THREE.CanvasTexture(canvas);
  const signMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4 });
  const signBackMat = new THREE.MeshStandardMaterial({ color: 0xbdc3c7, metalness: 0.5, roughness: 0.5 });
  const sign = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 24), [signBackMat, signMat, signBackMat]);
  sign.rotation.x = Math.PI / 2;
  sign.position.set(0, 1.7, 0.02);
  sign.castShadow = true;
  g.add(sign);

  return g;
}

function createFireExtinguisher() {
  const g = new THREE.Group();
  const redMat = new THREE.MeshStandardMaterial({ color: 0xd32f2f, roughness: 0.3, metalness: 0.2 });
  const blackMat = new THREE.MeshStandardMaterial({ color: 0x212121, roughness: 0.6 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4ac0d, metalness: 0.8, roughness: 0.3 });

  // Placa de soporte roja
  const backPlate = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.9, 0.04), new THREE.MeshStandardMaterial({ color: 0xc0392b }));
  backPlate.position.set(0, 0.45, -0.08);
  g.add(backPlate);

  // Letrero EXTINTOR
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 128;
  signCanvas.height = 40;
  const sctx = signCanvas.getContext('2d');
  sctx.fillStyle = '#c0392b';
  sctx.fillRect(0, 0, 128, 40);
  sctx.fillStyle = '#ffffff';
  sctx.font = 'bold 18px sans-serif';
  sctx.textAlign = 'center';
  sctx.fillText('EXTINTOR', 64, 26);
  const signTex = new THREE.CanvasTexture(signCanvas);
  const extSign = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.08), new THREE.MeshBasicMaterial({ map: signTex }));
  extSign.position.set(0, 0.82, -0.05);
  g.add(extSign);

  // Cilindro rojo
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.45, 16), redMat);
  body.position.y = 0.35;
  body.castShadow = true;
  g.add(body);

  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), redMat);
  dome.position.y = 0.575;
  g.add(dome);

  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.082, 0.14, 16), new THREE.MeshStandardMaterial({ color: 0xf4d03f, roughness: 0.5 }));
  band.position.y = 0.35;
  g.add(band);

  const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.06, 8), brassMat);
  valve.position.y = 0.67;
  g.add(valve);

  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.02), blackMat);
  handle.position.set(0.03, 0.70, 0);
  g.add(handle);

  const hose = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 8), blackMat);
  hose.position.set(0.085, 0.42, 0);
  g.add(hose);

  return g;
}

function createParkingBarrier({ isOpen = true } = {}) {
  const g = new THREE.Group();
  const baseMat = new THREE.MeshStandardMaterial({ color: 0xf39c12, roughness: 0.4 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.5 });
  const pedestal = new THREE.Mesh(new THREE.BoxGeometry(0.32, 1.05, 0.32), baseMat);
  pedestal.position.y = 0.525;
  pedestal.castShadow = true;
  g.add(pedestal);

  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.08, 0.35), darkMat);
  cap.position.y = 1.08;
  g.add(cap);

  const led = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), new THREE.MeshStandardMaterial({ color: 0x2ecc71, emissive: 0x27ae60, emissiveIntensity: 1.5 }));
  led.position.set(0, 1.13, 0);
  g.add(led);

  // Brazo / Pluma levadiza con franjas diagonales rojas y blancas
  const barrierCanvas = document.createElement('canvas');
  barrierCanvas.width = 512;
  barrierCanvas.height = 64;
  const bctx = barrierCanvas.getContext('2d');
  bctx.fillStyle = '#ffffff';
  bctx.fillRect(0, 0, 512, 64);
  bctx.fillStyle = '#c0392b';
  for (let x = -64; x < 512; x += 64) {
    bctx.beginPath();
    bctx.moveTo(x, 0);
    bctx.lineTo(x + 32, 0);
    bctx.lineTo(x + 32 + 64, 64);
    bctx.lineTo(x + 64, 64);
    bctx.closePath();
    bctx.fill();
  }
  const barrierTex = new THREE.CanvasTexture(barrierCanvas);
  const armMat = new THREE.MeshStandardMaterial({ map: barrierTex, roughness: 0.4 });
  const arm = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 0.04), armMat);
  if (isOpen) {
    arm.rotation.z = Math.PI / 4; // Abierta en ángulo hacia arriba
    arm.position.set(-0.8, 1.7, 0);
  } else {
    arm.position.set(-1.2, 0.92, 0);
  }
  arm.castShadow = true;
  g.add(arm);

  return g;
}

function createTrafficCone() {
  const g = new THREE.Group();
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
  const orangeMat = new THREE.MeshStandardMaterial({ color: 0xe67e22, roughness: 0.5 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });

  const base = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.03, 0.32), baseMat);
  base.position.y = 0.015;
  g.add(base);

  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5, 16), orangeMat);
  cone.position.y = 0.25;
  cone.castShadow = true;
  g.add(cone);

  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.095, 0.12, 16), whiteMat);
  stripe.position.y = 0.26;
  g.add(stripe);

  return g;
}

function createFirstAidStation() {
  const g = new THREE.Group();

  // Gabinete de Emergencia de Pared (Blanco con Cruz Roja grande)
  const cabCanvas = document.createElement('canvas');
  cabCanvas.width = 256;
  cabCanvas.height = 256;
  const cctx = cabCanvas.getContext('2d');
  cctx.fillStyle = '#ffffff';
  cctx.fillRect(0, 0, 256, 256);
  cctx.lineWidth = 10;
  cctx.strokeStyle = '#d32f2f';
  cctx.strokeRect(8, 8, 240, 240);

  cctx.fillStyle = '#d32f2f';
  cctx.fillRect(104, 40, 48, 176);
  cctx.fillRect(40, 104, 176, 48);

  const cabTex = new THREE.CanvasTexture(cabCanvas);
  const cabMat = new THREE.MeshStandardMaterial({ map: cabTex, roughness: 0.3 });
  const whiteMetal = new THREE.MeshStandardMaterial({ color: 0xecf0f1, metalness: 0.3, roughness: 0.4 });
  const cabinet = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.75, 0.22), [whiteMetal, whiteMetal, whiteMetal, whiteMetal, cabMat, whiteMetal]);
  cabinet.position.set(0, 1.25, 0);
  cabinet.castShadow = true;
  g.add(cabinet);

  // Camilla de evacuación / emergencias (Stretcher)
  const metalFrame = new THREE.MeshStandardMaterial({ color: 0xbdc3c7, metalness: 0.8, roughness: 0.3 });
  const canvasBed = new THREE.MeshStandardMaterial({ color: 0xe67e22, roughness: 0.7 });

  const stretcher = new THREE.Group();
  const bar1 = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.8, 8), metalFrame);
  bar1.rotation.z = Math.PI / 2;
  bar1.position.z = 0.26;
  stretcher.add(bar1);

  const bar2 = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.8, 8), metalFrame);
  bar2.rotation.z = Math.PI / 2;
  bar2.position.z = -0.26;
  stretcher.add(bar2);

  const bed = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.03, 0.48), canvasBed);
  stretcher.add(bed);

  [-0.5, 0.5].forEach(x => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 8), metalFrame);
    leg.position.set(x, -0.2, 0);
    stretcher.add(leg);
  });

  stretcher.position.set(0.9, 0.42, 0.4);
  stretcher.rotation.y = 0.2;
  stretcher.castShadow = true;
  g.add(stretcher);

  return g;
}

function createParkingStalls() {
  const g = new THREE.Group();
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xf1c40f, roughness: 0.4 });
  const curbMat = new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.8 });
  const curbStripeMat = new THREE.MeshStandardMaterial({ color: 0xf1c40f, roughness: 0.4 });
  const stallWidth = 1.8;
  const depth = 3.4;

  // 4 líneas perpendiculares amarillas
  for (let i = 0; i <= 3; i++) {
    const x = i * stallWidth;
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.025, depth), lineMat);
    line.position.set(x, 0.015, 0);
    line.receiveShadow = true;
    g.add(line);
  }

  // Línea continua de fondo
  const backLine = new THREE.Mesh(new THREE.BoxGeometry(3 * stallWidth, 0.025, 0.08), lineMat);
  backLine.position.set((3 * stallWidth) / 2, 0.015, -depth / 2);
  backLine.receiveShadow = true;
  g.add(backLine);

  // Topes de llanta y números de cajón (1, 2, 3)
  for (let i = 0; i < 3; i++) {
    const cx = i * stallWidth + stallWidth / 2;
    const stopper = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.16), curbMat);
    stopper.position.set(cx, 0.04, -depth / 2 + 0.35);
    stopper.castShadow = true;
    g.add(stopper);

    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.02, 0.17), curbStripeMat);
    stripe.position.set(cx, 0.065, -depth / 2 + 0.35);
    g.add(stripe);

    // Número de cajón pintado en el pavimento
    const numCanvas = document.createElement('canvas');
    numCanvas.width = 128;
    numCanvas.height = 128;
    const nctx = numCanvas.getContext('2d');
    nctx.fillStyle = '#f1c40f';
    nctx.font = 'bold 90px sans-serif';
    nctx.textAlign = 'center';
    nctx.textBaseline = 'middle';
    nctx.fillText(String(i + 1), 64, 64);
    const numTex = new THREE.CanvasTexture(numCanvas);
    const numMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.45), new THREE.MeshBasicMaterial({ map: numTex, transparent: true }));
    numMesh.rotation.x = -Math.PI / 2;
    numMesh.position.set(cx, 0.02, 0.6);
    g.add(numMesh);
  }

  return g;
}

function createBikeRack() {
  const g = new THREE.Group();
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x34495e, metalness: 0.7, roughness: 0.3 });

  const rail = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.04, 0.15), metalMat);
  rail.position.y = 0.02;
  g.add(rail);

  for (let i = 0; i < 4; i++) {
    const arch = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.022, 8, 16, Math.PI), metalMat);
    arch.position.set(i * 0.5 - 0.75, 0.22, 0);
    arch.castShadow = true;
    g.add(arch);
  }

  return g;
}

function createEmergencySiren() {
  const g = new THREE.Group();
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.7, roughness: 0.3 });
  const redMat = new THREE.MeshStandardMaterial({ color: 0xe74c3c, emissive: 0xc0392b, emissiveIntensity: 2.2 });

  // Poste
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.5, 10), metalMat);
  pole.position.y = 1.25;
  g.add(pole);

  // Megáfonos de alarma
  [-1, 1].forEach(dir => {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.3, 12), metalMat);
    horn.rotation.z = dir * Math.PI / 2;
    horn.position.set(dir * 0.18, 2.1, 0);
    g.add(horn);
  });

  // Baliza luminosa roja en la punta
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.2, 12), redMat);
  beacon.position.y = 2.45;
  g.add(beacon);

  return g;
}

function createSteppingStones(positions) {
  const g = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0x827e74,
    roughness: 0.92,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2
  });
  positions.forEach((p, idx) => {
    const stone = new THREE.Mesh(new THREE.CylinderGeometry(0.35 + (idx % 3) * 0.08, 0.42 + (idx % 3) * 0.08, 0.14, 7), stoneMat);
    stone.position.set(p[0], 0.07, p[1]);
    stone.rotation.y = idx * 1.3;
    stone.receiveShadow = true;
    g.add(stone);
  });
  return g;
}

// ── ESTACIÓN 05: TARJETA COSMOS (PABELLÓN DE BENEFICIOS & CONVENIOS VIP) ─────

function createCosmosVIPPedestal() {
  const g = new THREE.Group();
  
  // Materiales elegantes: Mármol blanco, oro pulido, terciopelo azul noche y zafiro
  const marbleMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3, metalness: 0.05 });
  const darkMarbleMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.9, roughness: 0.18 });
  const cardBodyMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.7, roughness: 0.2 });
  const cardChipMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.95, roughness: 0.12 });
  const velvetNavyMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.65 });
  const velvetRedMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.65 });
  const cyanGlowMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 3.2, roughness: 0.1 });

  // 1. Base escalonada de mármol pulido con bisel dorado
  const basePlinth = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.40, 0.22, 24), darkMarbleMat);
  basePlinth.position.y = 0.11;
  basePlinth.receiveShadow = true;
  g.add(basePlinth);

  const goldPlinthRing = new THREE.Mesh(new THREE.TorusGeometry(1.26, 0.035, 8, 32), goldMat);
  goldPlinthRing.rotation.x = Math.PI / 2;
  goldPlinthRing.position.y = 0.22;
  g.add(goldPlinthRing);

  const topPlinth = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.05, 0.42, 24), marbleMat);
  topPlinth.position.y = 0.43;
  topPlinth.castShadow = true;
  topPlinth.receiveShadow = true;
  g.add(topPlinth);

  // Cojín circular de terciopelo azul marino sobre el pedestal
  const cushion = new THREE.Mesh(new THREE.CylinderGeometry(0.80, 0.84, 0.12, 24), velvetNavyMat);
  cushion.position.y = 0.70;
  g.add(cushion);

  const cushionGoldTrim = new THREE.Mesh(new THREE.TorusGeometry(0.82, 0.022, 6, 24), goldMat);
  cushionGoldTrim.rotation.x = Math.PI / 2;
  cushionGoldTrim.position.y = 0.76;
  g.add(cushionGoldTrim);

  // Postes de cordón VIP (Stanchions de latón pulido y cordón rojo)
  const stanchionAngles = [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75];
  const stanchionRadius = 1.25;
  const polePositions = [];

  stanchionAngles.forEach(ang => {
    const px = Math.cos(ang) * stanchionRadius;
    const pz = Math.sin(ang) * stanchionRadius;
    polePositions.push([px, pz]);

    const sBase = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.04, 12), goldMat);
    sBase.position.set(px, 0.02, pz);
    g.add(sBase);

    const sPole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.90, 8), goldMat);
    sPole.position.set(px, 0.47, pz);
    sPole.castShadow = true;
    g.add(sPole);

    const sCap = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 10), goldMat);
    sCap.position.set(px, 0.94, pz);
    g.add(sCap);
  });

  // Cordones de terciopelo rojo entre postes
  for (let i = 0; i < polePositions.length; i++) {
    // Solo cordones en laterales y fondo, dejando el frente despejado
    if (i === 0) continue; 
    const p1 = polePositions[i];
    const p2 = polePositions[(i + 1) % polePositions.length];
    const mx = (p1[0] + p2[0]) / 2;
    const mz = (p1[1] + p2[1]) / 2;
    const dist = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const ang = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);

    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, dist * 0.96, 8), velvetRedMat);
    rope.position.set(mx, 0.82, mz);
    rope.rotation.z = Math.PI / 2;
    rope.rotation.y = -ang;
    g.add(rope);
  }

  // 2. Tarjeta Cosmos VIP Flotante (Emblema de Beneficios Corporativos)
  const cardGroup = new THREE.Group();
  cardGroup.position.y = 1.70;

  // Tarjeta principal (proporción ID-1 85.6mm x 54mm -> 1.45 x 0.92)
  const cardMesh = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.92, 0.04), cardBodyMat);
  cardMesh.castShadow = true;
  cardGroup.add(cardMesh);

  // Borde perimetral en oro pulido
  const cardGoldFrame = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.95, 0.032), goldMat);
  cardGroup.add(cardGoldFrame);

  // Chip EMV inteligente con micro-relieve dorado
  const chip = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.22, 0.05), cardChipMat);
  chip.position.set(-0.44, 0.12, 0.005);
  cardGroup.add(chip);

  // Símbolo Cosmos: Estrella de 8 puntas dorada con núcleo de zafiro cian
  const starCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), cyanGlowMat);
  starCore.position.set(0.24, 0.14, 0.035);
  cardGroup.add(starCore);

  const starRing = new THREE.Mesh(new THREE.TorusGeometry(0.30, 0.02, 6, 20), goldMat);
  starRing.rotation.x = 0.75;
  starRing.position.set(0.24, 0.14, 0.035);
  cardGroup.add(starRing);

  // Banda de contactless / ondas Wi-Fi en oro
  for (let w = 1; w <= 3; w++) {
    const wave = new THREE.Mesh(new THREE.TorusGeometry(w * 0.06, 0.008, 4, 12, Math.PI * 0.6), goldMat);
    wave.rotation.z = -Math.PI * 0.3;
    wave.position.set(-0.16, 0.12, 0.025);
    cardGroup.add(wave);
  }

  // Franja de nombre del colaborador y código de barras / bloques de números en relieve
  for (let b = 0; b < 4; b++) {
    const num = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.05, 0.05), goldMat);
    num.position.set(-0.48 + b * 0.32, -0.22, 0.005);
    cardGroup.add(num);
  }

  // QR Code VIP badge en la esquina
  const qrBadge = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.05), goldMat);
  qrBadge.position.set(0.52, 0.30, 0.005);
  cardGroup.add(qrBadge);

  // Luz dorada cálida envolvente
  const light = new THREE.PointLight(0xf59e0b, 2.8, 5.5);
  light.position.set(0, 0.2, 0.45);
  cardGroup.add(light);

  g.add(cardGroup);
  g.userData.cardMesh = cardGroup;

  return g;
}

// Flanco Izquierdo: Mostrador Noble de Convenios Comerciales (Restaurantes, Alimentos, Moda & Tiendas)
function createCosmosMerchantsBooth() {
  const g = new THREE.Group();

  const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a2c17, roughness: 0.72 });
  const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x2b180d, roughness: 0.8 });
  const navyClothMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.68 });
  const goldClothMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.65 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xf3ba2f, metalness: 0.85, roughness: 0.25 });
  const parchmentMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.85 });
  const wickerMat = new THREE.MeshStandardMaterial({ color: 0xb4793f, roughness: 0.88 });
  const appleMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4 });
  const grapeMat = new THREE.MeshStandardMaterial({ color: 0x7c3aed, roughness: 0.4 });
  const breadMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.85 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.15, transparent: true, opacity: 0.85 });

  // 1. Mostrador noble de madera oscura (sin techos/toldos para evitar saturación visual)
  const table = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.09, 0.95), darkWoodMat);
  table.position.y = 0.78;
  table.castShadow = true;
  g.add(table);

  // Faldón de mesa con terciopelo azul marino
  const runner = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.015, 0.90), navyClothMat);
  runner.position.y = 0.83;
  g.add(runner);

  // 4 Patas robustas de madera torneada
  [[-0.95, -0.36], [0.95, -0.36], [-0.95, 0.36], [0.95, 0.36]].forEach(([px, pz]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.78, 8), woodMat);
    leg.position.set(px, 0.39, pz);
    leg.castShadow = true;
    g.add(leg);
  });

  // 2. Canasta de mimbre con alimentos gourmet (Restaurantes afiliados)
  const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.18, 0.15, 12), wickerMat);
  basket.position.set(-0.68, 0.91, 0.05);
  basket.castShadow = true;
  g.add(basket);

  // Pan baguette artesanal
  const bread = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.22, 4, 8), breadMat);
  bread.rotation.z = 0.6;
  bread.position.set(-0.70, 1.03, 0.05);
  g.add(bread);

  // Frutas en la canasta (manzanas rojas y uvas)
  [[-0.75, 1.00, -0.04], [-0.60, 1.00, 0.04], [-0.66, 1.02, 0.10]].forEach(([fx, fy, fz], idx) => {
    const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), idx === 1 ? grapeMat : appleMat);
    fruit.position.set(fx, fy, fz);
    g.add(fruit);
  });

  // Botella de vino / aceite gourmet
  const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.25, 8), glassMat);
  bottle.position.set(-0.38, 0.96, -0.15);
  bottle.castShadow = true;
  g.add(bottle);

  // 3. Paquetes de regalo de boutiques y tiendas departamentales afiliadas
  const giftBox1 = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.26, 0.26), navyClothMat);
  giftBox1.position.set(0.18, 0.96, 0.05);
  giftBox1.castShadow = true;
  g.add(giftBox1);

  const ribbon1 = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.27, 0.05), goldMat);
  ribbon1.position.set(0.18, 0.96, 0.05);
  g.add(ribbon1);

  const giftBox2 = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.22, 0.22), goldClothMat);
  giftBox2.position.set(0.55, 0.94, -0.08);
  giftBox2.rotation.y = 0.35;
  giftBox2.castShadow = true;
  g.add(giftBox2);

  // 4. Directorio / Catálogo de Convenios en atril
  const brochureStand = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.03, 0.25), darkWoodMat);
  brochureStand.rotation.x = -0.3;
  brochureStand.position.set(0.82, 0.90, 0.12);
  g.add(brochureStand);

  const brochure = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.02, 0.22), parchmentMat);
  brochure.rotation.x = -0.3;
  brochure.position.set(0.82, 0.92, 0.12);
  g.add(brochure);

  // Placa frontal grabada: "CONVENIOS COMERCIALES"
  const plaque = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.16, 0.04), goldMat);
  plaque.position.set(0, 0.70, 0.46);
  g.add(plaque);

  return g;
}

// Flanco Derecho: Mostrador Noble de Salud, Deporte, Gimnasios y Puntos Cosmos
function createCosmosWellnessRewardsBooth() {
  const g = new THREE.Group();

  const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a2c17, roughness: 0.72 });
  const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x2b180d, roughness: 0.8 });
  const goldClothMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.65 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xf3ba2f, metalness: 0.88, roughness: 0.22 });
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x2b3038, metalness: 0.8, roughness: 0.3 });
  const towelMat = new THREE.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 0.95 });
  const towelStripeMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.9 });
  
  const potionEmerald = new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x059669, emissiveIntensity: 1.8, roughness: 0.2 });
  const potionRuby = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xb91c1c, emissiveIntensity: 1.8, roughness: 0.2 });
  const potionSapphire = new THREE.MeshStandardMaterial({ color: 0x3b82f6, emissive: 0x1d4ed8, emissiveIntensity: 1.8, roughness: 0.2 });

  // 1. Mostrador noble de madera oscura (sin techos/toldos)
  const table = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.09, 0.95), darkWoodMat);
  table.position.y = 0.78;
  table.castShadow = true;
  g.add(table);

  // Faldón de mesa con terciopelo dorado
  const runner = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.015, 0.90), goldClothMat);
  runner.position.y = 0.83;
  g.add(runner);

  // 4 Patas robustas
  [[-0.95, -0.36], [0.95, -0.36], [-0.95, 0.36], [0.95, 0.36]].forEach(([px, pz]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.78, 8), woodMat);
    leg.position.set(px, 0.39, pz);
    leg.castShadow = true;
    g.add(leg);
  });

  // 2. Frascos de salud, farmacia y botica preventiva (Membresías de Salud & Dental)
  const potionRack = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.05, 0.26), darkWoodMat);
  potionRack.position.set(-0.65, 0.87, -0.08);
  g.add(potionRack);

  [potionEmerald, potionRuby, potionSapphire].forEach((pMat, idx) => {
    const flask = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.17, 8), pMat);
    flask.position.set(-0.85 + idx * 0.20, 0.98, -0.08);
    flask.castShadow = true;
    g.add(flask);

    const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.045, 6), darkWoodMat);
    cork.position.set(-0.85 + idx * 0.20, 1.09, -0.08);
    g.add(cork);
  });

  // 3. Pesas de fitness y toalla deportiva enrollada
  const towel = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.32, 12), towelMat);
  towel.rotation.z = Math.PI / 2;
  towel.position.set(-0.62, 0.90, 0.22);
  towel.castShadow = true;
  g.add(towel);

  const tStripe = new THREE.Mesh(new THREE.TorusGeometry(0.081, 0.014, 6, 16), towelStripeMat);
  tStripe.rotation.y = Math.PI / 2;
  tStripe.position.set(-0.62, 0.90, 0.22);
  g.add(tStripe);

  // Mancuernas de fitness
  [[-0.10, 0.05], [0.12, -0.10]].forEach(([dx, dz]) => {
    const dGroup = new THREE.Group();
    dGroup.position.set(dx, 0.88, dz);
    dGroup.rotation.y = 0.4;

    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.24, 6), ironMat);
    bar.rotation.z = Math.PI / 2;
    dGroup.add(bar);

    [-0.10, 0.10].forEach(hx => {
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.045, 6), ironMat);
      head.rotation.z = Math.PI / 2;
      head.position.x = hx;
      dGroup.add(head);
    });
    g.add(dGroup);
  });

  // 4. Bandeja dorada con Monedas / Puntos Cosmos de Recompensas
  const tray = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.27, 0.03, 16), goldMat);
  tray.position.set(0.65, 0.87, 0.06);
  g.add(tray);

  for (let c = 0; c < 12; c++) {
    const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.012, 8), goldMat);
    const ang = (c / 12) * Math.PI * 2;
    const r = 0.08 + (c % 3) * 0.05;
    coin.position.set(0.65 + Math.cos(ang) * r, 0.89 + (c % 4) * 0.014, 0.06 + Math.sin(ang) * r);
    g.add(coin);
  }

  // Placa frontal grabada: "SALUD & BIENESTAR"
  const plaque = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.16, 0.04), goldMat);
  plaque.position.set(0, 0.70, 0.46);
  g.add(plaque);

  return g;
}

// ── ESTACIÓN 06: HISTORIA & MUSEO CONSISTORIAL ────────────────────────────────

function createFoundationalMonument() {
  const g = new THREE.Group();
  const graniteMat = new THREE.MeshStandardMaterial({ color: 0x544f48, roughness: 0.88 });
  const darkGraniteMat = new THREE.MeshStandardMaterial({ color: 0x3d3934, roughness: 0.9 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4ac0d, metalness: 0.85, roughness: 0.28 });
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x2b3038, metalness: 0.75, roughness: 0.35 });
  const coreMat = new THREE.MeshStandardMaterial({ color: 0x00d2ff, emissive: 0x0088cc, emissiveIntensity: 2.5, roughness: 0.15 });

  // 1. Pedestal octogonal de granito labrado
  const base1 = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 0.30, 8), darkGraniteMat);
  base1.position.y = 0.15;
  base1.receiveShadow = true;
  g.add(base1);

  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.90, 1.05, 0.80, 8), graniteMat);
  plinth.position.y = 0.70;
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  g.add(plinth);

  // Herrajes de bronce en el pedestal
  const ironRim = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.035, 6, 24), ironMat);
  ironRim.rotation.x = Math.PI / 2;
  ironRim.position.y = 1.10;
  g.add(ironRim);

  // 4 Placas de bronce grabadas con las 4 Eras
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2;
    const plaque = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.03), brassMat);
    plaque.position.set(Math.sin(ang) * 0.91, 0.72, Math.cos(ang) * 0.91);
    plaque.rotation.y = ang;
    g.add(plaque);
  }

  // 2. Gran Esfera Armilar y Astrolabio Solar de Bronce
  const armillary = new THREE.Group();
  armillary.position.y = 1.75;

  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.20, 0.35, 8), brassMat);
  stand.position.y = -0.18;
  armillary.add(stand);

  const meridian = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.04, 6, 32), brassMat);
  armillary.add(meridian);

  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.60, 0.032, 6, 32), brassMat);
  ring1.rotation.x = Math.PI / 3;
  armillary.add(ring1);

  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.028, 6, 32), brassMat);
  ring2.rotation.y = Math.PI / 4;
  armillary.add(ring2);

  const sunCore = new THREE.Mesh(new THREE.SphereGeometry(0.20, 16, 16), coreMat);
  armillary.add(sunCore);

  const axis = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.5, 6), brassMat);
  axis.rotation.z = Math.PI / 6;
  armillary.add(axis);

  const sunLight = new THREE.PointLight(0xffb703, 2.6, 6.5);
  sunLight.position.y = 0.1;
  armillary.add(sunLight);

  g.add(armillary);
  g.userData.armillary = armillary;
  g.userData.ring1 = ring1;
  g.userData.ring2 = ring2;

  return g;
}

function createHistoricalMilestonesGallery() {
  const g = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x5e584f, roughness: 0.88 });
  const darkOakMat = new THREE.MeshStandardMaterial({ color: 0x3a2414, roughness: 0.82 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4ac0d, metalness: 0.85, roughness: 0.28 });
  const velvetRedMat = new THREE.MeshStandardMaterial({ color: 0x900f15, roughness: 0.65 });
  const parchmentMat = new THREE.MeshStandardMaterial({ color: 0xf4ecd8, roughness: 0.85 });
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x2b3038, metalness: 0.75, roughness: 0.35 });

  const milestones = [
    { x: -1.75, z: 0.25, rotY: 0.28, type: 'origin' },
    { x: -0.60, z: -0.05, rotY: 0.10, type: 'expansion' },
    { x: 0.60, z: -0.05, rotY: -0.10, type: 'digital' },
    { x: 1.75, z: 0.25, rotY: -0.28, type: 'present' }
  ];

  milestones.forEach((m, idx) => {
    const col = new THREE.Group();
    col.position.set(m.x, 0, m.z);
    col.rotation.y = m.rotY;

    // Pedestal de piedra con capitel de roble oscuro
    const bBase = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.18, 0.58), stoneMat);
    bBase.position.y = 0.09;
    bBase.receiveShadow = true;
    col.add(bBase);

    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.48, 1.10, 0.40), stoneMat);
    shaft.position.y = 0.73;
    shaft.castShadow = true;
    col.add(shaft);

    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.08, 0.46), darkOakMat);
    cap.position.y = 1.32;
    col.add(cap);

    // Placa de bronce con el año grabado
    const plaque = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.16, 0.02), brassMat);
    plaque.position.set(0, 0.85, 0.21);
    col.add(plaque);

    if (m.type === 'origin') {
      // 1998: Pergamino de fundación con sello de lacre rojo y farol
      const scroll = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.26, 8), parchmentMat);
      scroll.rotation.z = Math.PI / 2;
      scroll.position.set(0, 1.40, 0.05);
      col.add(scroll);

      const seal = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.012, 6), velvetRedMat);
      seal.position.set(0, 1.44, 0.08);
      col.add(seal);

      const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.12), ironMat);
      lantern.position.set(0.16, 1.45, -0.10);
      col.add(lantern);
    } else if (m.type === 'expansion') {
      // 2008: Brújula náutica dorada y mapa enrollado
      const compass = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.11, 0.06, 12), brassMat);
      compass.position.set(-0.08, 1.39, 0);
      col.add(compass);

      const spyglass = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.035, 0.28, 8), brassMat);
      spyglass.rotation.z = 0.6;
      spyglass.position.set(0.10, 1.42, 0.02);
      col.add(spyglass);
    } else if (m.type === 'digital') {
      // 2018: Engranaje de relojería de bronce y gema
      const gear = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.05, 8), brassMat);
      gear.position.set(0, 1.39, 0);
      col.add(gear);

      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), new THREE.MeshStandardMaterial({ color: 0x00d2ff, emissive: 0x0088cc, emissiveIntensity: 2.2 }));
      gem.position.set(0, 1.48, 0);
      col.add(gem);
    } else {
      // Presente: Corona de laureles dorados sobre cojín carmesí
      const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 0.26), velvetRedMat);
      cushion.position.set(0, 1.40, 0);
      col.add(cushion);

      const wreath = new THREE.Mesh(new THREE.TorusGeometry(0.10, 0.022, 6, 16), brassMat);
      wreath.rotation.x = Math.PI / 2;
      wreath.position.set(0, 1.46, 0);
      col.add(wreath);
    }

    g.add(col);

    if (idx < milestones.length - 1) {
      const nextM = milestones[idx + 1];
      const midX = (m.x + nextM.x) / 2;
      const midZ = (m.z + nextM.z) / 2;
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 1.0, 6), velvetRedMat);
      rope.rotation.z = Math.PI / 2;
      rope.position.set(midX, 0.85, midZ + 0.10);
      g.add(rope);
    }
  });

  return g;
}

function createCorporateHeritageMemorial() {
  const g = new THREE.Group();
  const oakMat = new THREE.MeshStandardMaterial({ color: 0x462d18, roughness: 0.82 });
  const darkOakMat = new THREE.MeshStandardMaterial({ color: 0x301e10, roughness: 0.86 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4ac0d, metalness: 0.85, roughness: 0.28 });
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x2b3038, metalness: 0.75, roughness: 0.35 });
  const parchmentMat = new THREE.MeshStandardMaterial({ color: 0xf4ecd8, roughness: 0.85 });
  const redVelvetMat = new THREE.MeshStandardMaterial({ color: 0x900f15, roughness: 0.65 });

  // 1. Tríptico mural de madera de roble con molduras
  const wall = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.35, 0.20), oakMat);
  wall.position.set(0, 0.95, -0.4);
  wall.castShadow = true;
  g.add(wall);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.08, 0.30), darkOakMat);
  roof.position.set(0, 1.66, -0.4);
  g.add(roof);

  // 3 Placas de bronce para Misión, Visión y Valores
  [-0.80, 0, 0.80].forEach(x => {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.85, 0.03), darkOakMat);
    frame.position.set(x, 0.98, -0.28);
    g.add(frame);

    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.02), brassMat);
    plate.position.set(x, 0.98, -0.26);
    g.add(plate);
  });

  // 2. Gran Atril de Roble con el Libro de Crónicas
  const lectern = new THREE.Group();
  lectern.position.set(-0.55, 0, 0.55);

  const base = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 0.45), darkOakMat);
  base.position.y = 0.06;
  lectern.add(base);

  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.10, 0.78, 8), oakMat);
  pillar.position.y = 0.51;
  pillar.castShadow = true;
  lectern.add(pillar);

  const slant = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.05, 0.50), oakMat);
  slant.position.set(0, 0.96, 0);
  slant.rotation.x = -0.32;
  lectern.add(slant);

  const book = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.04, 0.38), parchmentMat);
  book.position.set(0, 0.99, 0);
  book.rotation.x = -0.32;
  lectern.add(book);

  const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.01, 0.44), redVelvetMat);
  ribbon.position.set(0, 1.02, 0);
  ribbon.rotation.x = -0.32;
  lectern.add(ribbon);

  g.add(lectern);

  // 3. Candelabro de hierro de 3 velas encendidas
  const candelabra = new THREE.Group();
  candelabra.position.set(0.75, 0, 0.50);

  const cBase = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.08, 8), ironMat);
  cBase.position.y = 0.04;
  candelabra.add(cBase);

  const cPole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 1.2, 8), ironMat);
  cPole.position.y = 0.64;
  candelabra.add(cPole);

  [-0.18, 0, 0.18].forEach((cx, idx) => {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.18, 6), ironMat);
    arm.position.set(cx, 1.24 + (idx === 1 ? 0.08 : 0), 0);
    candelabra.add(arm);

    const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.14, 6), parchmentMat);
    candle.position.set(cx, 1.38 + (idx === 1 ? 0.08 : 0), 0);
    candelabra.add(candle);

    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.06, 6), new THREE.MeshStandardMaterial({ color: 0xffa726, emissive: 0xff7700, emissiveIntensity: 3.0 }));
    flame.position.set(cx, 1.48 + (idx === 1 ? 0.08 : 0), 0);
    candelabra.add(flame);
  });

  const cLight = new THREE.PointLight(0xffa726, 2.0, 4.5);
  cLight.position.set(0, 1.55, 0);
  candelabra.add(cLight);

  g.add(candelabra);

  return g;
}

// ── ESTACIÓN 07: NPS (VOZ DEL CLIENTE & CALIDAD) ──────────────────────────────

function createNPSScaleMonument() {
  const g = new THREE.Group();
  const mahoganyMat = new THREE.MeshStandardMaterial({ color: 0x422614, roughness: 0.78 });
  const darkOakMat = new THREE.MeshStandardMaterial({ color: 0x2e190d, roughness: 0.85 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4ac0d, metalness: 0.85, roughness: 0.28 });
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x2b3038, metalness: 0.75, roughness: 0.35 });
  const copperMat = new THREE.MeshStandardMaterial({ color: 0xb86532, metalness: 0.78, roughness: 0.32 });

  const rubyMat = new THREE.MeshStandardMaterial({ color: 0xff1e4d, emissive: 0xcc092f, emissiveIntensity: 2.2, roughness: 0.15 });
  const amberMat = new THREE.MeshStandardMaterial({ color: 0xffa726, emissive: 0xd97706, emissiveIntensity: 2.2, roughness: 0.15 });
  const emeraldMat = new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x059669, emissiveIntensity: 2.5, roughness: 0.15 });

  // 1. Base semicircular de madera de caoba con herrajes de latón
  const base = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.5, 0.22, 24, 1, false, 0, Math.PI), mahoganyMat);
  base.rotation.y = Math.PI / 2;
  base.position.y = 0.11;
  base.receiveShadow = true;
  g.add(base);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.035, 6, 24, Math.PI), brassMat);
  rim.rotation.x = Math.PI / 2;
  rim.rotation.z = Math.PI;
  rim.position.y = 0.22;
  g.add(rim);

  // 2. Las 11 Columnas de madera torneada de la Escala NPS (0 al 10)
  const totalSteps = 11;
  const arcSpan = Math.PI * 0.90;
  const startAng = -arcSpan / 2;
  const radius = 1.75;

  for (let i = 0; i < totalSteps; i++) {
    const fraction = i / (totalSteps - 1);
    const ang = startAng + fraction * arcSpan;
    const px = Math.sin(ang) * radius;
    const pz = Math.cos(ang) * radius;

    const colGroup = new THREE.Group();
    colGroup.position.set(px, 0.22, pz);
    colGroup.rotation.y = ang + Math.PI;

    const colHeight = 0.45 + (i >= 9 ? 0.35 : (i >= 7 ? 0.20 : 0.08));
    const colMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, colHeight, 8), darkOakMat);
    colMesh.position.y = colHeight / 2;
    colMesh.castShadow = true;
    colGroup.add(colMesh);

    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 8), brassMat);
    cap.position.y = colHeight + 0.02;
    colGroup.add(cap);

    let cMat = rubyMat;
    if (i >= 9) cMat = emeraldMat;
    else if (i >= 7) cMat = amberMat;

    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), cMat);
    crystal.position.y = colHeight + 0.14;
    colGroup.add(crystal);

    // Chapa con el número (0-10)
    const plaque = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.11, 0.02), brassMat);
    plaque.position.set(0, colHeight * 0.55, 0.10);
    colGroup.add(plaque);

    g.add(colGroup);
  }

  // 3. Gran Barómetro / Dial de Madera y Latón Central
  const dialGroup = new THREE.Group();
  dialGroup.position.set(0, 0.22, 0.15);

  const dialPlinth = new THREE.Mesh(new THREE.CylinderGeometry(0.60, 0.70, 0.75, 12), mahoganyMat);
  dialPlinth.position.y = 0.375;
  dialPlinth.castShadow = true;
  dialGroup.add(dialPlinth);

  const dialBezel = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.04, 6, 24), brassMat);
  dialBezel.position.y = 0.78;
  dialBezel.rotation.x = Math.PI / 2;
  dialGroup.add(dialBezel);

  const dialPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.03, 16), darkOakMat);
  dialPlate.position.y = 0.76;
  dialGroup.add(dialPlate);

  // Arco coloreado de las 3 zonas (Detractor, Pasivo, Promotor)
  const arcDet = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.03, 4, 12, Math.PI * 0.45), rubyMat);
  arcDet.rotation.x = Math.PI / 2;
  arcDet.rotation.z = Math.PI * 0.85;
  arcDet.position.y = 0.785;
  dialGroup.add(arcDet);

  const arcPro = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.03, 4, 12, Math.PI * 0.35), emeraldMat);
  arcPro.rotation.x = Math.PI / 2;
  arcPro.rotation.z = -Math.PI * 0.20;
  arcPro.position.y = 0.785;
  dialGroup.add(arcPro);

  // Aguja de cobre apuntando con orgullo hacia la zona Promotor (10)
  const needle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.44), copperMat);
  needle.position.set(0.08, 0.81, -0.10);
  needle.rotation.y = -0.55;
  dialGroup.add(needle);

  const needleHub = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 10), brassMat);
  needleHub.position.y = 0.81;
  dialGroup.add(needleHub);

  g.add(dialGroup);

  return g;
}

function createNPSSurveyDesk() {
  const g = new THREE.Group();
  const oakMat = new THREE.MeshStandardMaterial({ color: 0x4a3018, roughness: 0.8 });
  const darkOakMat = new THREE.MeshStandardMaterial({ color: 0x331f0e, roughness: 0.85 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4ac0d, metalness: 0.85, roughness: 0.28 });
  const parchmentMat = new THREE.MeshStandardMaterial({ color: 0xf4ecd8, roughness: 0.85 });
  const rubyMat = new THREE.MeshStandardMaterial({ color: 0xff1e4d, roughness: 0.3 });
  const amberMat = new THREE.MeshStandardMaterial({ color: 0xffa726, roughness: 0.3 });
  const emeraldMat = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.3 });

  // 1. Pupitre de encuesta de madera
  const desk = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.85), oakMat);
  desk.position.y = 0.78;
  desk.castShadow = true;
  g.add(desk);

  [[-0.78, -0.32], [0.78, -0.32], [-0.78, 0.32], [0.78, 0.32]].forEach(([x, z]) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.78, 0.08), darkOakMat);
    leg.position.set(x, 0.39, z);
    g.add(leg);
  });

  // 2. Urna de votación de madera con ranura de bronce
  const ballotBox = new THREE.Group();
  ballotBox.position.set(0.55, 0.82, -0.05);

  const bBody = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.42, 0.32), darkOakMat);
  bBody.position.y = 0.21;
  bBody.castShadow = true;
  ballotBox.add(bBody);

  const bCap = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.04, 0.36), brassMat);
  bCap.position.y = 0.44;
  ballotBox.add(bCap);

  const bSlot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, 0.02), brassMat);
  bSlot.position.set(0, 0.46, 0);
  ballotBox.add(bSlot);

  g.add(ballotBox);

  // 3. Tres recipientes de madera con fichas de votación
  [-0.15, 0.02, 0.19].forEach((x, idx) => {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.08, 8), darkOakMat);
    cup.position.set(x, 0.86, 0.20);
    g.add(cup);

    const tokenMat = (idx === 0 ? rubyMat : idx === 1 ? amberMat : emeraldMat);
    const token = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 8), tokenMat);
    token.position.set(x, 0.91, 0.20);
    g.add(token);
  });

  // 4. Tablilla de encuesta con pergamino
  const clipboard = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.02, 0.40), darkOakMat);
  clipboard.position.set(-0.48, 0.83, 0.02);
  g.add(clipboard);

  const pSheet = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.01, 0.34), parchmentMat);
  pSheet.position.set(-0.48, 0.845, 0.02);
  g.add(pSheet);

  return g;
}

function createNPSProtocolBoard() {
  const g = new THREE.Group();
  const oakMat = new THREE.MeshStandardMaterial({ color: 0x462d18, roughness: 0.82 });
  const darkOakMat = new THREE.MeshStandardMaterial({ color: 0x301e10, roughness: 0.86 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4ac0d, metalness: 0.85, roughness: 0.28 });
  const parchmentMat = new THREE.MeshStandardMaterial({ color: 0xf4ecd8, roughness: 0.85 });
  const redMat = new THREE.MeshStandardMaterial({ color: 0x900f15, roughness: 0.65 });

  // 1. Tablón de madera con tejadillo rústico
  const frame = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.30, 0.14), oakMat);
  frame.position.set(0, 0.95, 0);
  frame.castShadow = true;
  g.add(frame);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.08, 0.26), darkOakMat);
  roof.position.set(0, 1.64, 0);
  g.add(roof);

  [-0.95, 0.95].forEach(x => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.10, 1.5, 0.10), darkOakMat);
    post.position.set(x, 0.75, 0);
    g.add(post);
  });

  // 3 Tablillas con los pasos del Closed Loop
  [-0.68, 0, 0.68].forEach((x, idx) => {
    const plaque = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.82, 0.03), darkOakMat);
    plaque.position.set(x, 0.95, 0.08);
    g.add(plaque);

    const sheet = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.70, 0.02), parchmentMat);
    sheet.position.set(x, 0.95, 0.10);
    g.add(sheet);

    const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.04, 0.025), redMat);
    ribbon.position.set(x, 1.25, 0.105);
    g.add(ribbon);

    const numBadge = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 8), brassMat);
    numBadge.rotation.x = Math.PI / 2;
    numBadge.position.set(x, 1.25, 0.12);
    g.add(numBadge);
  });

  return g;
}

// ── ESTACIÓN 08: GESTOR DOCUMENTAL (SCRIPTORIUM & ARCHIVO) ────────────────────

function createDocManagerArchiveDisplay() {
  const g = new THREE.Group();
  const oakMat = new THREE.MeshStandardMaterial({ color: 0x462d18, roughness: 0.82 });
  const darkOakMat = new THREE.MeshStandardMaterial({ color: 0x2e190d, roughness: 0.86 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x5a544c, roughness: 0.88 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4ac0d, metalness: 0.85, roughness: 0.28 });
  const parchmentMat = new THREE.MeshStandardMaterial({ color: 0xf4ecd8, roughness: 0.85 });
  const cyanOrbMat = new THREE.MeshStandardMaterial({ color: 0x00d2ff, emissive: 0x0088cc, emissiveIntensity: 2.5, roughness: 0.15 });

  // 1. Pedestal de lectura de cantería y roble
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.1, 0.26, 8), stoneMat);
  base.position.y = 0.13;
  base.receiveShadow = true;
  g.add(base);

  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.75, 0.75, 8), stoneMat);
  col.position.y = 0.635;
  col.castShadow = true;
  g.add(col);

  const tableTop = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 1.1), oakMat);
  tableTop.position.set(0, 1.05, 0);
  tableTop.castShadow = true;
  g.add(tableTop);

  // 2. Gran Tomo Maestro de Archivo Digital abierto
  const book = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.05, 0.50), parchmentMat);
  book.position.set(0, 1.11, 0.05);
  g.add(book);

  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.51), darkOakMat);
  spine.position.set(0, 1.11, 0.05);
  g.add(spine);

  // 3. Orbe Crystalline de Búsqueda y Nube Digital flotando sobre el libro
  const orbGroup = new THREE.Group();
  orbGroup.position.set(0, 1.68, 0);

  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), cyanOrbMat);
  orbGroup.add(orb);

  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.016, 6, 24), brassMat);
  ring1.rotation.x = Math.PI / 3;
  orbGroup.add(ring1);

  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.014, 6, 24), brassMat);
  ring2.rotation.y = Math.PI / 4;
  orbGroup.add(ring2);

  const orbLight = new THREE.PointLight(0x00d2ff, 2.5, 5.0);
  orbGroup.add(orbLight);

  g.add(orbGroup);
  g.userData.orbGroup = orbGroup;

  return g;
}

function createArchiveBookshelfUnits() {
  const g = new THREE.Group();
  const darkOakMat = new THREE.MeshStandardMaterial({ color: 0x362111, roughness: 0.85 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4ac0d, metalness: 0.85, roughness: 0.28 });
  const parchmentMat = new THREE.MeshStandardMaterial({ color: 0xf4ecd8, roughness: 0.85 });
  const bookColors = [
    new THREE.MeshStandardMaterial({ color: 0x8a1c14, roughness: 0.7 }),
    new THREE.MeshStandardMaterial({ color: 0x1a4329, roughness: 0.7 }),
    new THREE.MeshStandardMaterial({ color: 0x163456, roughness: 0.7 }),
    new THREE.MeshStandardMaterial({ color: 0x6e471d, roughness: 0.75 })
  ];

  // 2 Estanterías altas de archivo
  [-1.4, 1.4].forEach(bx => {
    const shelf = new THREE.Group();
    shelf.position.set(bx, 0, -0.3);

    // Mueble de estantería
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.65, 1.70, 0.38), darkOakMat);
    body.position.y = 0.85;
    body.castShadow = true;
    shelf.add(body);

    // 3 Baldas con libros modelados y pergaminos
    for (let s = 0; s < 3; s++) {
      const sy = 0.35 + s * 0.48;
      for (let b = 0; b < 6; b++) {
        const bMat = bookColors[(s * 3 + b) % bookColors.length];
        const bookMesh = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.28 + (b % 3) * 0.04, 0.24), bMat);
        bookMesh.position.set(-0.20 + b * 0.08, sy, 0.05);
        shelf.add(bookMesh);
      }

      // Casillero con pergaminos enrollados
      const scroll = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.22, 6), parchmentMat);
      scroll.rotation.x = Math.PI / 2;
      scroll.position.set(0.24, sy, 0.05);
      shelf.add(scroll);
    }

    // Tirador de latón en la cornisa
    const tag = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.02), brassMat);
    tag.position.set(0, 1.62, 0.20);
    shelf.add(tag);

    g.add(shelf);
  });

  return g;
}

function createScriptoriumFilingDesk() {
  const g = new THREE.Group();
  const oakMat = new THREE.MeshStandardMaterial({ color: 0x4a3018, roughness: 0.8 });
  const darkOakMat = new THREE.MeshStandardMaterial({ color: 0x331f0e, roughness: 0.85 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4ac0d, metalness: 0.85, roughness: 0.28 });
  const parchmentMat = new THREE.MeshStandardMaterial({ color: 0xf4ecd8, roughness: 0.85 });
  const redMat = new THREE.MeshStandardMaterial({ color: 0x900f15, roughness: 0.65 });

  // Pupitre inclinado de escriba
  const table = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.08, 0.75), oakMat);
  table.position.y = 0.76;
  table.castShadow = true;
  g.add(table);

  [[-0.55, -0.28], [0.55, -0.28], [-0.55, 0.28], [0.55, 0.28]].forEach(([x, z]) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.76, 0.07), darkOakMat);
    leg.position.set(x, 0.38, z);
    g.add(leg);
  });

  // Bandejas de 3 niveles de documentos ("Entrada", "En Revisión", "Archivado")
  const trayGroup = new THREE.Group();
  trayGroup.position.set(0.38, 0.80, 0);
  for (let t = 0; t < 3; t++) {
    const tray = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.04, 0.26), darkOakMat);
    tray.position.y = t * 0.08;
    trayGroup.add(tray);

    const doc = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.02, 0.20), parchmentMat);
    doc.position.y = t * 0.08 + 0.025;
    trayGroup.add(doc);
  }
  g.add(trayGroup);

  // Lupa de lectura con mango de madera
  const magGlass = new THREE.Group();
  magGlass.position.set(-0.35, 0.82, -0.10);
  const mRing = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 16), brassMat);
  mRing.rotation.x = Math.PI / 2;
  magGlass.add(mRing);
  const mHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.12, 6), darkOakMat);
  mHandle.rotation.z = Math.PI / 3;
  mHandle.position.set(0.07, 0, 0.05);
  magGlass.add(mHandle);
  g.add(magGlass);

  // Sello oficial de aprobación con mango torneado
  const stamp = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.035, 0.10, 8), darkOakMat);
  stamp.position.set(-0.15, 0.85, 0.15);
  g.add(stamp);

  const stampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.02, 8), brassMat);
  stampBase.position.set(-0.15, 0.81, 0.15);
  g.add(stampBase);

  return g;
}

// ── ESTACIÓN 09: CÓDIGO DE ÉTICA (TRIBUNAL DE INTEGRIDAD) ─────────────────────

function createEthicsJusticeMonument() {
  const g = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x5e584f, roughness: 0.88 });
  const darkStoneMat = new THREE.MeshStandardMaterial({ color: 0x3d3934, roughness: 0.9 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4ac0d, metalness: 0.88, roughness: 0.25 });
  const emeraldMat = new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x059669, emissiveIntensity: 2.5, roughness: 0.15 });

  // 1. Pedestal de cantería de piedra labrada
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.24, 1.4), darkStoneMat);
  base.position.y = 0.12;
  base.receiveShadow = true;
  g.add(base);

  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.42, 1.30, 8), stoneMat);
  pillar.position.y = 0.89;
  pillar.castShadow = true;
  g.add(pillar);

  const pillarCap = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.08, 8), brassMat);
  pillarCap.position.y = 1.58;
  g.add(pillarCap);

  // 2. Gran Balanza Solar de la Justicia Ética en Latón Dorado
  const scaleBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.7, 8), brassMat);
  scaleBeam.rotation.z = Math.PI / 2;
  scaleBeam.position.set(0, 1.72, 0);
  g.add(scaleBeam);

  const scalePillar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.45, 8), brassMat);
  scalePillar.position.set(0, 1.80, 0);
  g.add(scalePillar);

  [-0.72, 0.72].forEach(x => {
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.38, 4), brassMat);
    chain.position.set(x, 1.52, 0);
    g.add(chain);

    const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.18, 0.04, 12), brassMat);
    pan.position.set(x, 1.32, 0);
    g.add(pan);

    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), emeraldMat);
    gem.position.set(x, 1.41, 0);
    g.add(gem);
  });

  const ethLight = new THREE.PointLight(0x10b981, 2.0, 4.5);
  ethLight.position.set(0, 1.85, 0.2);
  g.add(ethLight);

  return g;
}

function createOpenTomeOfEthics() {
  const g = new THREE.Group();
  const oakMat = new THREE.MeshStandardMaterial({ color: 0x462d18, roughness: 0.82 });
  const darkOakMat = new THREE.MeshStandardMaterial({ color: 0x301e10, roughness: 0.86 });
  const parchmentMat = new THREE.MeshStandardMaterial({ color: 0xf4ecd8, roughness: 0.85 });
  const redMat = new THREE.MeshStandardMaterial({ color: 0x900f15, roughness: 0.65 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4ac0d, metalness: 0.85, roughness: 0.28 });

  // Atril de madera tallada
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.42, 0.10, 8), darkOakMat);
  base.position.y = 0.05;
  g.add(base);

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.80, 8), oakMat);
  stem.position.y = 0.48;
  stem.castShadow = true;
  g.add(stem);

  const slant = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.05, 0.54), oakMat);
  slant.position.set(0, 0.94, 0);
  slant.rotation.x = -0.32;
  g.add(slant);

  // Gran Tomo del Código de Ética
  const book = new THREE.Mesh(new THREE.BoxGeometry(0.60, 0.04, 0.44), parchmentMat);
  book.position.set(0, 0.97, 0);
  book.rotation.x = -0.32;
  g.add(book);

  const bookmark = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.01, 0.48), redMat);
  bookmark.position.set(0, 1.00, 0);
  bookmark.rotation.x = -0.32;
  g.add(bookmark);

  // Vela encendida en candelero de latón
  const candleBase = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.03, 8), brassMat);
  candleBase.position.set(0.42, 0.90, -0.15);
  g.add(candleBase);

  const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.14, 6), parchmentMat);
  candle.position.set(0.42, 0.98, -0.15);
  g.add(candle);

  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.05, 6), new THREE.MeshStandardMaterial({ color: 0xffa726, emissive: 0xff7700, emissiveIntensity: 3.0 }));
  flame.position.set(0.42, 1.08, -0.15);
  g.add(flame);

  return g;
}

function createConfidentialWhistleblowerBox() {
  const g = new THREE.Group();
  const darkOakMat = new THREE.MeshStandardMaterial({ color: 0x2e190d, roughness: 0.85 });
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x242830, metalness: 0.8, roughness: 0.32 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4ac0d, metalness: 0.85, roughness: 0.28 });
  const redMat = new THREE.MeshStandardMaterial({ color: 0x900f15, roughness: 0.65 });

  // Arcón / buzón vertical reforzado de roble y bandas de hierro
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.70, 8), darkOakMat);
  post.position.y = 0.35;
  g.add(post);

  const box = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.58, 0.36), darkOakMat);
  box.position.y = 0.98;
  box.castShadow = true;
  g.add(box);

  // Bandas de hierro de refuerzo con remaches
  [-0.20, 0.20].forEach(yOff => {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.04, 0.37), ironMat);
    band.position.set(0, 0.98 + yOff, 0);
    g.add(band);
  });

  // Ranura superior para denuncias
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.025, 0.04), ironMat);
  slot.position.set(0, 1.28, 0);
  g.add(slot);

  // Candado macizo de latón
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.09, 0.04), brassMat);
  lock.position.set(0, 0.95, 0.20);
  g.add(lock);

  // Cartelito rojo "Canal Confidencial"
  const plaque = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.12, 0.02), redMat);
  plaque.position.set(0, 1.15, 0.19);
  g.add(plaque);

  return g;
}

// ── ESTACIÓN 10: CULTURA Y COMUNICACIÓN (ÁGORA & PREGONERO) ───────────────────

function createCultureCommunicationMonument() {
  const g = new THREE.Group();
  const oakMat = new THREE.MeshStandardMaterial({ color: 0x4a3018, roughness: 0.82 });
  const darkOakMat = new THREE.MeshStandardMaterial({ color: 0x301e10, roughness: 0.86 });
  const slateMat = new THREE.MeshStandardMaterial({ color: 0x2b3844, roughness: 0.55 });
  const parchmentMat = new THREE.MeshStandardMaterial({ color: 0xf4ecd8, roughness: 0.85 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4ac0d, metalness: 0.85, roughness: 0.28 });
  const redMat = new THREE.MeshStandardMaterial({ color: 0x900f15, roughness: 0.65 });
  const rubyMat = new THREE.MeshStandardMaterial({ color: 0xff1e4d, emissive: 0xcc092f, emissiveIntensity: 2.2, roughness: 0.15 });

  // 1. Mural / Tablón de la Gaceta Comunitaria con techumbre de pizarra
  const boardGroup = new THREE.Group();
  boardGroup.position.set(0, 0, -0.3);

  const panel = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.35, 0.12), oakMat);
  panel.position.y = 1.0;
  panel.castShadow = true;
  boardGroup.add(panel);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.08, 0.32), slateMat);
  roof.position.set(0, 1.71, 0);
  boardGroup.add(roof);

  [-1.0, 1.0].forEach(x => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.6, 0.12), darkOakMat);
    post.position.set(x, 0.80, 0);
    boardGroup.add(post);
  });

  // Carteles, gacetas y reconocimientos de empleados
  [-0.70, -0.22, 0.25, 0.70].forEach((x, idx) => {
    const poster = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.52 + (idx % 2) * 0.15, 0.02), parchmentMat);
    poster.position.set(x, 1.0 - (idx % 2) * 0.05, 0.07);
    boardGroup.add(poster);

    const pin = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 6), (idx === 1 ? rubyMat : brassMat));
    pin.position.set(x, 1.25, 0.09);
    boardGroup.add(pin);
  });

  g.add(boardGroup);

  // 2. Podio del Pregonero con Clarín / Trompeta de Heraldo
  const podium = new THREE.Group();
  podium.position.set(-0.75, 0, 0.65);

  const pBase = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.85, 0.55), oakMat);
  pBase.position.y = 0.425;
  pBase.castShadow = true;
  podium.add(pBase);

  const drapery = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.60, 0.03), redMat);
  drapery.position.set(0, 0.48, 0.285);
  podium.add(drapery);

  // Clarín de heraldo de latón
  const trumpet = new THREE.Group();
  trumpet.position.set(0, 0.92, 0.10);
  const tTube = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.025, 0.50, 8), brassMat);
  tTube.rotation.x = Math.PI / 2;
  trumpet.add(tTube);
  const tBell = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.14, 8), brassMat);
  tBell.rotation.x = -Math.PI / 2;
  tBell.position.set(0, 0, 0.28);
  trumpet.add(tBell);
  const tBanner = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.18, 0.22), redMat);
  tBanner.position.set(0, -0.12, 0.05);
  trumpet.add(tBanner);
  podium.add(trumpet);

  g.add(podium);

  // 3. Fogonata de Convivencia con bancos y laúd
  const bonfire = new THREE.Group();
  bonfire.position.set(0.75, 0, 0.65);

  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x6e685f, roughness: 0.9 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.10, 0), stoneMat);
    st.position.set(Math.cos(a) * 0.35, 0.06, Math.sin(a) * 0.35);
    bonfire.add(st);
  }
  const flameMesh = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35, 6), new THREE.MeshStandardMaterial({ color: 0xffa726, emissive: 0xff4400, emissiveIntensity: 2.8 }));
  flameMesh.position.y = 0.18;
  bonfire.add(flameMesh);

  // Banco de tronco
  const bench = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.85, 6), darkOakMat);
  bench.rotation.z = Math.PI / 2;
  bench.position.set(0, 0.12, 0.55);
  bonfire.add(bench);

  g.add(bonfire);

  return g;
}

// ── ESTACIÓN 11: RUTA 90 (EVALUACIONES 30 - 60 - 90 DÍAS) ─────────────────────

function createRoute90Monument() {
  const g = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x5e584f, roughness: 0.88 });
  const darkStoneMat = new THREE.MeshStandardMaterial({ color: 0x3d3934, roughness: 0.9 });
  const oakMat = new THREE.MeshStandardMaterial({ color: 0x4a3018, roughness: 0.82 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4ac0d, metalness: 0.85, roughness: 0.28 });
  const leatherMat = new THREE.MeshStandardMaterial({ color: 0x663616, roughness: 0.75 });
  const parchmentMat = new THREE.MeshStandardMaterial({ color: 0xf4ecd8, roughness: 0.85 });
  const redMat = new THREE.MeshStandardMaterial({ color: 0x900f15, roughness: 0.65 });

  const sapphireMat = new THREE.MeshStandardMaterial({ color: 0x00d2ff, emissive: 0x0088cc, emissiveIntensity: 2.2, roughness: 0.15 });
  const amberMat = new THREE.MeshStandardMaterial({ color: 0xffa726, emissive: 0xd97706, emissiveIntensity: 2.2, roughness: 0.15 });
  const emeraldMat = new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x059669, emissiveIntensity: 2.5, roughness: 0.15 });

  const milestones = [
    { day: 30, x: -1.35, z: 0.25, color: sapphireMat, h: 0.95, label: '30 DÍAS' },
    { day: 60, x: 0.0, z: -0.10, color: amberMat, h: 1.25, label: '60 DÍAS' },
    { day: 90, x: 1.35, z: 0.25, color: emeraldMat, h: 1.55, label: '90 DÍAS' }
  ];

  // 1. Tres Monolitos de Hito a lo largo del sendero
  milestones.forEach(m => {
    const col = new THREE.Group();
    col.position.set(m.x, 0, m.z);

    const base = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.48), darkStoneMat);
    base.position.y = 0.09;
    base.receiveShadow = true;
    col.add(base);

    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.42, m.h, 0.36), stoneMat);
    pillar.position.y = 0.18 + m.h / 2;
    pillar.castShadow = true;
    col.add(pillar);

    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.06, 0.42), darkStoneMat);
    cap.position.y = 0.18 + m.h + 0.03;
    col.add(cap);

    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), m.color);
    gem.position.set(0, 0.18 + m.h + 0.18, 0);
    col.add(gem);

    const plaque = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.15, 0.025), brassMat);
    plaque.position.set(0, 0.18 + m.h * 0.65, 0.19);
    col.add(plaque);

    if (m.day === 30) {
      // Mochila de explorador en el suelo
      const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.30, 0.18), leatherMat);
      backpack.position.set(0.32, 0.15, 0.18);
      col.add(backpack);
    } else if (m.day === 60) {
      // Escudo plateado apoyado
      const shield = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.42, 0.04), new THREE.MeshStandardMaterial({ color: 0x95a5a6, metalness: 0.8, roughness: 0.3 }));
      shield.rotation.y = 0.3;
      shield.position.set(0.30, 0.22, 0.15);
      col.add(shield);
    } else {
      // Corona de laureles dorados y diploma
      const crown = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.024, 6, 16), brassMat);
      crown.rotation.x = Math.PI / 2;
      crown.position.set(0.32, 0.28, 0.12);
      col.add(crown);

      const dip = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.22, 8), parchmentMat);
      dip.rotation.z = Math.PI / 2;
      dip.position.set(0.32, 0.10, 0.12);
      col.add(dip);
    }

    g.add(col);
  });

  // 2. Poste indicador de madera con flechas
  const signpost = new THREE.Group();
  signpost.position.set(-0.70, 0, 0.85);

  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.8, 8), oakMat);
  post.position.y = 0.9;
  signpost.add(post);

  ['30 DÍAS ➔', '60 DÍAS ➔', '90 DÍAS ★'].forEach((lbl, idx) => {
    const arrow = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.12, 0.03), oakMat);
    arrow.position.set(0.18, 1.1 + idx * 0.22, 0);
    arrow.rotation.y = 0.15 * idx;
    signpost.add(arrow);
  });
  g.add(signpost);

  return g;
}

// ── ESTACIÓN 12: SINDICATO (FORO DE LA ALIANZA & DIÁLOGO SOCIAL) ──────────────

function createUnionAllianceMonument() {
  const g = new THREE.Group();
  const oakMat = new THREE.MeshStandardMaterial({ color: 0x462d18, roughness: 0.82 });
  const darkOakMat = new THREE.MeshStandardMaterial({ color: 0x301e10, roughness: 0.86 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4ac0d, metalness: 0.85, roughness: 0.28 });
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x2b3038, metalness: 0.75, roughness: 0.35 });
  const parchmentMat = new THREE.MeshStandardMaterial({ color: 0xf4ecd8, roughness: 0.85 });
  const redMat = new THREE.MeshStandardMaterial({ color: 0x900f15, roughness: 0.65 });

  // 1. Gran Mesa Redonda de la Alianza
  const tableGroup = new THREE.Group();
  tableGroup.position.set(0, 0, 0.35);

  const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.09, 20), oakMat);
  tableTop.position.y = 0.76;
  tableTop.castShadow = true;
  tableGroup.add(tableTop);

  const tableBase = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.40, 0.72, 8), darkOakMat);
  tableBase.position.y = 0.36;
  tableGroup.add(tableBase);

  // Gran Pliego de Acuerdo Colectivo con 2 sellos de cera
  const treaty = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.015, 0.55), parchmentMat);
  treaty.position.set(0, 0.81, 0);
  tableGroup.add(treaty);

  const sealRed = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.02, 8), redMat);
  sealRed.position.set(-0.18, 0.825, 0.15);
  tableGroup.add(sealRed);

  const sealGold = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.02, 8), brassMat);
  sealGold.position.set(0.18, 0.825, 0.15);
  tableGroup.add(sealGold);

  // 2 Plumas enfrentadas (Firma bilateral)
  [-0.24, 0.24].forEach((qx, idx) => {
    const quill = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.012, 0.22, 6), parchmentMat);
    quill.rotation.z = (idx === 0 ? 0.4 : -0.4);
    quill.position.set(qx, 0.89, -0.10);
    tableGroup.add(quill);
  });

  // 4 Sillas de madera con respaldo alrededor de la mesa
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const chair = new THREE.Group();
    chair.position.set(Math.sin(ang) * 1.55, 0, Math.cos(ang) * 1.55);
    chair.rotation.y = ang + Math.PI;

    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.40), darkOakMat);
    seat.position.y = 0.44;
    chair.add(seat);

    const back = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.52, 0.05), darkOakMat);
    back.position.set(0, 0.72, -0.18);
    chair.add(back);

    [[-0.18, -0.16], [0.18, -0.16], [-0.18, 0.16], [0.18, 0.16]].forEach(([cx, cz]) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.44, 0.05), darkOakMat);
      leg.position.set(cx, 0.22, cz);
      chair.add(leg);
    });

    tableGroup.add(chair);
  }

  g.add(tableGroup);

  // 2. Pedestal con Escultura de Manos Unidas y Escudos Entrelazados
  const monument = new THREE.Group();
  monument.position.set(0, 0, -1.1);

  const mBase = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.78, 0.35, 8), new THREE.MeshStandardMaterial({ color: 0x5e584f, roughness: 0.88 }));
  mBase.position.y = 0.175;
  monument.add(mBase);

  // 2 Anillos entrelazados de latón (Pacto de Solidaridad)
  [-0.14, 0.14].forEach(rx => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.038, 6, 20), brassMat);
    ring.position.set(rx, 0.65, 0);
    monument.add(ring);
  });

  g.add(monument);

  return g;
}

// ── ESTACIÓN 13: BASTIÓN DE LA VICTORIA & GRADUACIÓN ──────────────────────────

function createCastleVictoryMonument() {
  const g = new THREE.Group();
  const oakMat = new THREE.MeshStandardMaterial({ color: 0x462d18, roughness: 0.82 });
  const darkOakMat = new THREE.MeshStandardMaterial({ color: 0x301e10, roughness: 0.86 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4ac0d, metalness: 0.88, roughness: 0.24 });
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x2b3038, metalness: 0.75, roughness: 0.35 });
  const redCarpetMat = new THREE.MeshStandardMaterial({ color: 0xcc092f, roughness: 0.6 });
  const parchmentMat = new THREE.MeshStandardMaterial({ color: 0xf4ecd8, roughness: 0.85 });

  // 1. Alfombra Ceremonial Roja que conduce al Castillo
  const carpet = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.02, 4.5), redCarpetMat);
  carpet.position.set(0, 0.01, 1.2);
  carpet.receiveShadow = true;
  g.add(carpet);

  // Ribetes dorados de la alfombra
  [-0.80, 0.80].forEach(x => {
    const goldTrim = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.025, 4.5), brassMat);
    goldTrim.position.set(x, 0.012, 1.2);
    g.add(goldTrim);
  });

  // 2. Podio del Gran Orador con el Diploma de Graduación
  const podium = new THREE.Group();
  podium.position.set(0, 0, -0.6);

  const pBase = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.95, 0.65), oakMat);
  pBase.position.y = 0.475;
  pBase.castShadow = true;
  podium.add(pBase);

  const pCloth = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.70, 0.03), redCarpetMat);
  pCloth.position.set(0, 0.55, 0.335);
  podium.add(pCloth);

  // Gran Diploma de Graduación con lazo escarlata
  const diploma = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.03, 0.46), parchmentMat);
  diploma.position.set(0, 0.98, 0.05);
  podium.add(diploma);

  const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.01, 0.08), redCarpetMat);
  ribbon.position.set(0, 1.00, 0.05);
  podium.add(ribbon);

  // Gran Llave Dorada del Reino
  const keyStem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.32, 8), brassMat);
  keyStem.rotation.z = Math.PI / 2;
  keyStem.position.set(0, 1.05, 0.05);
  podium.add(keyStem);

  const keyRing = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 16), brassMat);
  keyRing.position.set(-0.16, 1.05, 0.05);
  podium.add(keyRing);

  g.add(podium);

  // 3. Mesa de Banquete de Victoria con Gran Trofeo Dorado
  const banquet = new THREE.Group();
  banquet.position.set(1.85, 0, 0.5);

  const bTable = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.08, 1.8), oakMat);
  bTable.position.y = 0.72;
  bTable.castShadow = true;
  banquet.add(bTable);

  [[-0.36, -0.80], [0.36, -0.80], [-0.36, 0.80], [0.36, 0.80]].forEach(([x, z]) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.72, 0.08), darkOakMat);
    leg.position.set(x, 0.36, z);
    banquet.add(leg);
  });

  // Gran Trofeo Dorado de la Victoria
  const trophy = new THREE.Group();
  trophy.position.set(0, 0.76, 0);
  const trBase = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.14, 0.06, 12), brassMat);
  trophy.add(trBase);
  const trStem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.16, 8), brassMat);
  trStem.position.y = 0.11;
  trophy.add(trStem);
  const trCup = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.08, 0.22, 12), brassMat);
  trCup.position.y = 0.28;
  trophy.add(trCup);
  banquet.add(trophy);

  g.add(banquet);

  // 4. Braseros de Victoria con grandes llamas
  [-1.6, 1.6].forEach(bx => {
    const brazier = new THREE.Group();
    brazier.position.set(bx, 0, -1.2);

    const bStand = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.85, 8), ironMat);
    bStand.position.y = 0.425;
    brazier.add(bStand);

    const bBowl = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.16, 0.20, 8), ironMat);
    bBowl.position.y = 0.95;
    brazier.add(bBowl);

    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.60, 6), new THREE.MeshStandardMaterial({ color: 0xffa726, emissive: 0xff4400, emissiveIntensity: 3.2 }));
    flame.position.y = 1.30;
    brazier.add(flame);

    const bLight = new THREE.PointLight(0xff7700, 2.8, 6.0);
    bLight.position.set(0, 1.4, 0);
    brazier.add(bLight);

    g.add(brazier);
  });

  return g;
}

function createCobblestoneTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#7a7263';
  ctx.fillRect(0, 0, 512, 512);

  ctx.strokeStyle = '#4e473b';
  ctx.lineWidth = 3;
  for (let y = 0; y < 512; y += 32) {
    const shift = (y % 64 === 0) ? 0 : 16;
    for (let x = -16; x < 528; x += 32) {
      ctx.fillStyle = ((x + y) % 64 === 0) ? '#b5a995' : ((x + y) % 96 === 0) ? '#a09481' : '#8e8371';
      ctx.beginPath();
      ctx.roundRect(x + shift + 2, y + 2, 28, 28, 6);
      ctx.fill();
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ── Checkpoint Builders (Richly Dressed Environmental Outposts) ───────────────

export async function buildCheckpointStructure(mission, getTerrainY) {
  const g = new THREE.Group();
  g.name = `Checkpoint_${mission.id}_${mission.type}`;

  const stationMixers = [];

  // Each spawn places its object at the EXACT terrain height for its world position
  async function spawn(path, targetHeight = 3.0, pos = [0, 0, 0], rotY = 0) {
    const inst = await instantiate(path, targetHeight, true);
    if (!inst) return null;
    const worldX = mission.x + pos[0];
    const worldZ = mission.z + pos[2];
    const gy = getTerrainY(worldX, worldZ);
    inst.position.set(pos[0], gy + (pos[1] || 0), pos[2]);
    inst.rotation.y = rotY;
    g.add(inst);

    if (inst.userData.animations?.length) {
      const animTarget = inst.children[0] || inst;
      const mixer = new THREE.AnimationMixer(animTarget);
      const safeClip = inst.userData.animations.find(a => {
        const name = a.name.toLowerCase();
        return (name.includes('idle') || name.includes('eating') || name.includes('walk')) && !name.includes('death') && !name.includes('attack');
      }) || inst.userData.animations[0];

      if (safeClip && !safeClip.name.toLowerCase().includes('death')) {
        const action = mixer.clipAction(safeClip);
        action.play();
        stationMixers.push(mixer);
      }
    }
    return inst;
  }

  switch (mission.type) {
    case 'lobby': {
      // ═════════════════════════════════════════════════════════════════════════
      // ESTACIÓN 00: CAMPAMENTO BASE & BIENVENIDA (Lobby de Expedición)
      // Escalas recalibradas a proporción humana real + Intención espacial
      // ═════════════════════════════════════════════════════════════════════════

      // 1. Cuartel General de la Expedición al fondo (Acceso frontal despejado)
      await spawn(ASSETS.polyfork.villageTavern, 5.8, [0, 0, -5.2], 0);

      // 2. Círculo Central de Bienvenida: Hoguera con bancos de tronco a escala real (0.45m asiento)
      const campWelcomeFire = createCampfire();
      campWelcomeFire.position.set(0, getTerrainY(mission.x, mission.z + 0.4), 0.4);
      g.add(campWelcomeFire);
      await spawn(ASSETS.polyfork.splitLogBench, 0.45, [-1.8, 0, 0.4], Math.PI / 2);
      await spawn(ASSETS.polyfork.splitLogBench, 0.45, [1.8, 0, 0.4], -Math.PI / 2);

      // 3. Lateral Izquierdo: Muelle de descarga de carretas (Escala proporcionada)
      await spawn(ASSETS.polyfork.fourWheelWagon, 1.45, [-6.0, 0, -2.2], -0.25);
      await spawn(ASSETS.polyfork.woodenCrate, 0.50, [-4.6, 0, -2.8], 0.3);
      await spawn(ASSETS.polyfork.grainSack, 0.48, [-5.2, 0, -1.0], -0.4);

      // 4. Rincón de Manantial: Pozo de piedra rústica a escala 1.55m
      await spawn(ASSETS.polyfork.villageWell, 1.55, [-4.2, 0, 1.8], 0.2);

      // 5. Lateral Derecho: Mesa de planeación (0.76m altura real de mesa)
      await spawn(ASSETS.polyfork.timberTable, 0.76, [4.8, 0, -1.8], 0);
      // Provisiones de viaje sobre la mesa
      await spawn(ASSETS.polyfork.wineJug, 0.22, [4.8, 0.76, -1.8], 0);
      await spawn(ASSETS.polyfork.breadLoaf, 0.12, [5.1, 0.76, -1.8], 0.4);
      await spawn(ASSETS.polyfork.goblet, 0.16, [4.5, 0.76, -1.8], 0);

      // 6. Frente Derecho: Tablón de bienvenida con el mapa de la expedición
      await spawn(ASSETS.polyfork.campNoticeBoard, 1.55, [4.2, 0, 2.5], -0.6);

      // 7. Portal de faroles medievales recibiendo a los exploradores
      await spawn(ASSETS.polyfork.lampPost, 2.3, [-5.2, 0, 3.0], 0.3);
      await spawn(ASSETS.polyfork.lampPost, 2.3, [5.2, 0, 3.0], -0.3);

      // 8. Vallas de madera perimetrales (0.95m altura de valla)
      await spawn(ASSETS.polyfork.woodenFence, 0.95, [-7.0, 0, 0.5], 0.8);
      await spawn(ASSETS.polyfork.woodenFence, 0.95, [7.0, 0, 0.5], -0.8);

      // 9. Arboleda de fondo y flancos (Enmarcan la taberna a distancia segura, CERO colisión)
      await spawn(ASSETS.trees[13], 8.2, [-8.2, 0, -4.5], 0.3); // Abedul blanco en el flanco izquierdo
      await spawn(ASSETS.trees[14], 8.5, [8.2, 0, -4.5], -0.3); // Pino verde alto en el flanco derecho
      await spawn(ASSETS.trees[15], 8.0, [-5.2, 0, -12.5], 0.2); // Roble frondoso tras el alero izquierdo
      await spawn(ASSETS.trees[13], 8.2, [5.2, 0, -12.5], -0.2); // Abedul blanco tras el alero derecho
      await spawn(ASSETS.trees[0], 9.0, [0.0, 0, -14.0], 0.1);   // Roble majestuoso elevándose tras la cumbrera

      // Guía rúnica flotante de bienvenida Vermelho Bradesco
      const guideGem = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.32, 0),
        new THREE.MeshStandardMaterial({ color: BRAND_PALETTE.red, emissive: BRAND_PALETTE.darkRed, emissiveIntensity: 2.5, roughness: 0.22 })
      );
      const gemY = getTerrainY(mission.x, mission.z);
      guideGem.position.set(0, gemY + 2.2, 0.4);
      g.add(guideGem);
      g.userData.crystal = guideGem;
      break;
    }

    case 'camp': {
      // ═════════════════════════════════════════════════════════════════════════
      // ESTACIÓN 01: ARSENAL Y EQUIPOS (Puesto de Inicio / Armería)
      // Escalas humanas reales + Plaza limpia y sin colisiones:
      // - Torre de vigía al fondo centro custodiando el horizonte (6.5m)
      // - Ala Izquierda: Cuartel de lona, carreta, baúl y víveres
      // - Ala Derecha: Herrería funcional, yunque y barril de temple
      // - Centro: Armero, maniquí de armadura y fogata de guardia con trípode
      // ═════════════════════════════════════════════════════════════════════════

      // 1. Torre de Vigía del Arsenal al fondo centro
      await spawn(ASSETS.polyfork.watchtower, 6.5, [0, 0, -5.5], 0);

      // 2. Ala Izquierda: Tienda de campaña cuartel y carreta de pertrechos
      await spawn(ASSETS.polyfork.canvasWallTent, 2.7, [-5.2, 0, -2.5], 0.35);
      await spawn(ASSETS.polyfork.woodenCart, 1.35, [-6.2, 0, 0.4], 0.3);
      await spawn(ASSETS.polyfork.woodenCrate, 0.50, [-4.4, 0, 0.8], 0.2);
      await spawn(ASSETS.polyfork.grainSack, 0.48, [-5.0, 0, 1.4], -0.4);

      // 3. Ala Derecha: Herrería de Campaña despejada (SIN carpa que colisione)
      await spawn(ASSETS.polyfork.blacksmithForge, 2.4, [5.2, 0, -1.0], -1.2);
      await spawn(ASSETS.polyfork.anvil, 0.82, [3.8, 0, 0.6], 0.3);
      await spawn(ASSETS.polyfork.quenchBarrel, 0.70, [5.2, 0, 1.2], 0);

      // 4. Mostrador Central de Armería: Armero y soporte de armadura
      await spawn(ASSETS.polyfork.weaponRack, 1.50, [-1.8, 0, -1.0], 0.3);
      await spawn(ASSETS.polyfork.armourStand, 1.85, [1.8, 0, -1.0], -0.3);

      // 5. Vivac de Guardia al frente: Fogata con trípode y leña ordenada al lateral
      const campfire = createCampfire();
      campfire.position.set(-0.5, getTerrainY(mission.x - 0.5, mission.z + 1.8), 1.8);
      g.add(campfire);
      await spawn(ASSETS.polyfork.campfireCookTripod, 1.30, [-0.5, 0, 1.8], 0);
      await spawn(ASSETS.polyfork.firewoodStack, 0.55, [-2.2, 0, 1.8], 0.1);

      // 6. Arboleda de fondo y flancos enmarcando el puesto militar (CERO colisión con tiendas o atalaya)
      await spawn(ASSETS.trees[13], 8.5, [0.0, 0, -12.5], 0.2);  // Abedul blanco majestuoso en el fondo central
      await spawn(ASSETS.trees[14], 8.5, [-8.5, 0, -6.5], 0.1);  // Pino alto tras la atalaya
      await spawn(ASSETS.trees[5], 8.8, [8.5, 0, -6.5], -0.3);   // Conífera alta tras la forja
      await spawn(ASSETS.trees[6], 7.5, [-8.2, 0, 1.5], 0.3);   // Ciprés cónico en el flanco izquierdo
      await spawn(ASSETS.trees[15], 7.8, [8.2, 0, 1.5], -0.3);  // Roble frondoso en el flanco derecho

      const crystal = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.28, 0),
        new THREE.MeshStandardMaterial({ color: BRAND_PALETTE.red, emissive: BRAND_PALETTE.darkRed, emissiveIntensity: 2.2, roughness: 0.3 })
      );
      const crystalY = getTerrainY(mission.x, mission.z);
      crystal.position.set(0, crystalY + 1.6, 0);
      g.add(crystal);
      g.userData.crystal = crystal;
      break;
    }

    case 'sanctuary':
    case 'monument': {
      // ═════════════════════════════════════════════════════════════════════════
      // ESTACIÓN 02: FIRMA DE CONTRATO Y BENEFICIOS (Santuario del Pacto)
      // Escalas sagradas recalibradas a proporción humana:
      // - Capilla de piedra al fondo (6.2m)
      // - Altar central de piedra a altura de mesa sagrada (0.95m)
      // - Atril con el gran libro de juramento (1.25m)
      // - Caballeros guardianes de honor a estatura heroica (2.1m)
      // - Braseros ceremoniales a cintura (1.0m) flanqueando el paso abierto
      // - Cofre de beneficios con herrajes de hierro a tamaño de arcón real (0.52m)
      // - Estantería de pergaminos a escala de archivo (1.45m)
      // ═════════════════════════════════════════════════════════════════════════

      // 1. Templo/Capilla de Piedra Sagrada retirada al fondo
      await spawn(ASSETS.polyfork.stoneChapel, 6.2, [0, 0, -6.8], 0);

      // 2. Muretes bajos de piedra perimetrales que enmarcan el recinto sagrado
      await spawn(ASSETS.polyfork.lowStoneWall, 0.80, [-4.2, 0, -4.5], 0.3);
      await spawn(ASSETS.polyfork.lowStoneWall, 0.80, [4.2, 0, -4.5], -0.3);

      // 3. Altar Sagrado de Piedra en el corazón ceremonial (0.95m altura de altar)
      await spawn(ASSETS.polyfork.stoneAltar, 0.95, [0, 0, -2.4], 0);

      // 4. Atril con el Gran Libro del Pacto
      await spawn(ASSETS.polyfork.chainedBookLectern, 1.25, [0, 0, -2.1], 0);

      // 5. Guardia de Honor: Estatuas de Caballeros flanqueando el altar (2.1m estatura noble)
      await spawn(ASSETS.polyfork.standingKnightStatue, 2.1, [-2.8, 0, -2.4], 0.15);
      await spawn(ASSETS.polyfork.standingKnightStatue, 2.1, [2.8, 0, -2.4], -0.15);

      // 6. Candelabros ceremoniales de velas junto a los escalones
      await spawn(ASSETS.polyfork.candleSpikeCluster, 0.65, [-1.8, 0, -4.8], 0);
      await spawn(ASSETS.polyfork.candleSpikeCluster, 0.65, [1.8, 0, -4.8], 0);

      // 7. Avenida de Acceso Solemne: Braseros a escala humana (1.0m) delimitando pasillo
      await spawn(ASSETS.polyfork.standingBrazier, 1.0, [-2.4, 0, 1.0], 0);
      await spawn(ASSETS.polyfork.standingBrazier, 1.0, [2.4, 0, 1.0], 0);

      // 8. Lateral Izquierdo: Estantería con los pergaminos oficiales del contrato (1.45m)
      await spawn(ASSETS.polyfork.scrollRack, 1.45, [-3.8, 0, -0.4], 0.5);

      // 9. Lateral Derecho: Arcón acorazado con los beneficios (0.52m altura de cofre real)
      await spawn(ASSETS.polyfork.ironStrongbox, 0.52, [3.8, 0, -0.4], -0.5);

      // 10. Faroles solemnes en el acceso frontal
      await spawn(ASSETS.polyfork.lampPost, 2.4, [-4.8, 0, 2.4], 0.3);
      await spawn(ASSETS.polyfork.lampPost, 2.4, [4.8, 0, 2.4], -0.3);

      // Arboleda solemne enmarcando la capilla (CERO colisión)
      await spawn(ASSETS.trees[6], 8.5, [-8.0, 0, -4.5], 0.3);  // Ciprés alto en el flanco izquierdo
      await spawn(ASSETS.trees[6], 8.5, [8.0, 0, -4.5], -0.3);  // Ciprés alto en el flanco derecho
      await spawn(ASSETS.trees[13], 8.2, [-5.2, 0, -12.5], 0.2); // Abedul tras el alero
      await spawn(ASSETS.trees[14], 9.0, [5.2, 0, -12.5], -0.2); // Pino alto tras el alero
      await spawn(ASSETS.trees[0], 9.2, [0.0, 0, -13.8], 0);    // Roble majestuoso tras el ábside

      // Sello flotante místico del Pacto elevado sobre el altar
      const covenantSeal = new THREE.Mesh(
        new THREE.TorusGeometry(0.35, 0.07, 12, 32),
        new THREE.MeshStandardMaterial({ color: 0xffd369, emissive: 0xd49b29, emissiveIntensity: 2.5, roughness: 0.3 })
      );
      const sealY = getTerrainY(mission.x, mission.z);
      covenantSeal.position.set(0, sealY + 2.5, -2.4);
      g.add(covenantSeal);

      // Núcleo rúnico carmesí Bradesco en el centro del sello
      const sealCore = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.18, 0),
        new THREE.MeshStandardMaterial({ color: BRAND_PALETTE.red, emissive: BRAND_PALETTE.darkRed, emissiveIntensity: 2.2, roughness: 0.25 })
      );
      sealCore.position.set(0, sealY + 2.5, -2.4);
      g.add(sealCore);
      g.userData.covenantSeal = covenantSeal;
      break;
    }

    case 'garden': {
      // ═════════════════════════════════════════════════════════════════════════
      // ESTACIÓN 03: HUMAND Y COMEDOR (Valle del Refectorio)
      // Plaza gastronómica comunitaria a escala humana real con comida servida:
      // - Gran Salón Comedor al fondo (6.0m) con puertas 100% despejadas
      // - Dos mesas rústicas comunales a escala humana (0.76m de altura)
      // - COMIDA SERVIDA EN LAS MESAS: Cazuela humeante, lechón/carne asada,
      //   tartas rústicas, hogazas de pan recién horneado, jarras de vino y copas
      // - Panadería artesanal con horno de barro (1.6m), cesta de vegetales y barril
      // - Buffet / Puesto con toldo rústico (2.15m)
      // - Jardineras florales compactas (0.35m) enmarcando el paseo
      // ═════════════════════════════════════════════════════════════════════════

      // 1. El Gran Salón Refectorio al fondo centro (Puertas totalmente libres de paso)
      await spawn(ASSETS.polyfork.timberBarn, 6.0, [0, 0, -5.5], 0);

      // 2. Sector Panadería y Cocina (Lateral Derecho): Horno de barro, cesta de pan y bebidas
      await spawn(ASSETS.polyfork.clayBreadOven, 1.60, [5.0, 0, -2.0], -0.8);
      await spawn(ASSETS.polyfork.basketOfProduce, 0.48, [3.8, 0, -1.8], 0.1);
      await spawn(ASSETS.polyfork.polyforkBarrel, 0.85, [5.2, 0, -0.6], 0.2);

      // 3. Sector de Autoservicio / Buffet (Lateral Izquierdo): Puesto con toldo rústico
      await spawn(ASSETS.polyfork.marketStall, 2.15, [-5.2, 0, -2.0], 0.8);

      // 4. MESA COMUNAL IZQUIERDA (0.76m altura humana real de mesa)
      await spawn(ASSETS.polyfork.timberTable, 0.76, [-3.4, 0, 0.8], 0.10);
      // Banquete servido sobre la mesa izquierda:
      await spawn(ASSETS.polyfork.roastMeat, 0.20, [-3.4, 0.76, 0.8], 0.2);
      await spawn(ASSETS.polyfork.breadLoaf, 0.12, [-3.9, 0.76, 0.8], 0.4);
      await spawn(ASSETS.polyfork.wineJug, 0.22, [-2.9, 0.76, 0.75], -0.3);
      await spawn(ASSETS.polyfork.goblet, 0.16, [-3.15, 0.76, 0.62], 0);
      await spawn(ASSETS.polyfork.goblet, 0.16, [-3.65, 0.76, 0.62], 0);
      await spawn(ASSETS.polyfork.breadLoaf, 0.10, [-3.2, 0.76, 0.96], -0.5);

      // 5. MESA COMUNAL DERECHA (0.76m altura humana real de mesa)
      await spawn(ASSETS.polyfork.timberTable, 0.76, [3.4, 0, 0.8], -0.10);
      // Banquete servido sobre la mesa derecha:
      await spawn(ASSETS.polyfork.cazuelaPot, 0.18, [3.4, 0.76, 0.8], 0.1);
      await spawn(ASSETS.polyfork.rusticPie, 0.09, [3.9, 0.76, 0.8], 0.3);
      await spawn(ASSETS.polyfork.breadLoaf, 0.12, [2.9, 0.76, 0.75], -0.4);
      await spawn(ASSETS.polyfork.wineJug, 0.22, [3.65, 0.76, 0.96], 0.5);
      await spawn(ASSETS.polyfork.goblet, 0.16, [3.15, 0.76, 0.62], 0);
      await spawn(ASSETS.polyfork.goblet, 0.16, [3.65, 0.76, 0.62], 0);

      await spawn(ASSETS.polyfork.lampPost, 2.4, [-5.0, 0, 2.8], 0.3);

      // 7. Entrada: Tablón de Avisos de Humand (Turnos, menú diario y reglas del comedor)
      await spawn(ASSETS.polyfork.campNoticeBoard, 1.55, [2.0, 0, 2.6], -0.2);

      // Arboleda frondosa del valle enmarcando el granero comedor (CERO colisión con techos o mesas)
      await spawn(ASSETS.trees[11], 8.2, [-8.2, 0, -4.5], 0.4); // Sauce llorón en el flanco izquierdo
      await spawn(ASSETS.trees[16], 8.0, [8.2, 0, -4.5], -0.4); // Arce frondoso en el flanco derecho
      await spawn(ASSETS.trees[13], 8.5, [-5.5, 0, -12.8], 0.2); // Abedul ribereño tras el alero izquierdo
      await spawn(ASSETS.trees[7], 8.5, [5.5, 0, -12.8], -0.2);  // Álamo cónico tras el alero derecho
      await spawn(ASSETS.trees[0], 9.5, [0.0, 0, -14.0], 0.1);   // Roble colosal elevándose tras la cumbrera

      // Kiosco digital de la App Humand interactivo con halo verde
      const humandTerminal = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.6, 0.08),
        new THREE.MeshStandardMaterial({ color: 0x2ee59d, emissive: 0x17a06a, emissiveIntensity: 2.5, roughness: 0.3 })
      );
      const termY = getTerrainY(mission.x + 2.0, mission.z + 2.6);
      humandTerminal.position.set(2.0, termY + 1.8, 2.6);
      g.add(humandTerminal);
      g.userData.humandTerminal = humandTerminal;
      break;
    }

    case 'safety':
    case 'observatory': {
      // ═════════════════════════════════════════════════════════════════════════
      // MISIÓN 04: PROTECCIÓN CIVIL Y ESTACIONAMIENTO (Altos de la Vigilancia)
      // Escala humana con modelos 3D reales de la librería Polyfork:
      // - Gran Atalaya de vigilancia de piedra y madera (7.2m)
      // - Área de carruajes y transporte: Carromato de 4 ruedas y carreta de madera
      // - Puesto de Primeros Auxilios y Evacuación: Arcón de emergencias, barril, cajas
      // - Tablón de Avisos con Protocolos de Protección Civil
      // - Vallas de madera delimitando el área de acceso vehicular y peatonal
      // ═════════════════════════════════════════════════════════════════════════

      // 1. Gran Atalaya de Vigilancia al fondo
      await spawn(ASSETS.polyfork.watchtower, 7.2, [-4.2, 0, -3.2], 0.2);

      // 2. Área de Transporte y Estacionamiento: Carromatos reales 3D
      await spawn(ASSETS.polyfork.fourWheelWagon, 1.85, [3.8, 0, -1.2], -0.2); // Carromato de 4 ruedas cubierto
      await spawn(ASSETS.polyfork.woodenCart, 1.35, [1.0, 0, -1.5], 0.35);     // Carreta de dos ruedas
      await spawn(ASSETS.polyfork.woodenFence, 0.95, [5.8, 0, -0.2], 0.4);     // Valla delimitadora derecha
      await spawn(ASSETS.polyfork.woodenFence, 0.95, [5.8, 0, -2.4], 0.4);

      // 3. Módulo de Protocolos de Protección Civil & Evacuación
      await spawn(ASSETS.polyfork.campNoticeBoard, 1.55, [-1.5, 0, 1.6], -0.25);

      // 4. Depósito de Emergencias y Primeros Auxilios
      await spawn(ASSETS.polyfork.ironStrongbox, 0.55, [-3.8, 0, 0.8], 0.2);   // Arcón acorazado de botiquín
      await spawn(ASSETS.polyfork.woodenCrate, 0.50, [-4.5, 0, 0.2], 0.1);     // Cajas de suministros
      await spawn(ASSETS.polyfork.polyforkBarrel, 0.75, [-4.8, 0, 1.4], 0);     // Barril de reserva
      await spawn(ASSETS.polyfork.splitLogBench, 0.65, [1.8, 0, 1.8], -0.2);    // Banco de descanso de brigadistas

      // 5. Faroles de acceso a la estación
      await spawn(ASSETS.polyfork.lampPost, 2.4, [-5.0, 0, 2.6], 0.3);
      await spawn(ASSETS.polyfork.lampPost, 2.4, [5.0, 0, 2.6], -0.3);

      // Arboleda de taiga enmarcando la atalaya y cochera (CERO colisión)
      await spawn(ASSETS.trees[14], 9.0, [-8.5, 0, -5.5], 0.3); // Pino alto natural
      await spawn(ASSETS.trees[5], 9.2, [8.5, 0, -5.5], -0.3);  // Pino estilizado alto
      await spawn(ASSETS.trees[4], 8.2, [0.0, 0, -13.5], 0.1);  // Conífera tras el edificio

      // Baliza de emergencia luminosa sobre la torre de vigilancia
      const beaconGem = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.35, 0),
        new THREE.MeshStandardMaterial({ color: 0x2ecc71, emissive: 0x27ae60, emissiveIntensity: 2.8, roughness: 0.2 })
      );
      const beaconY = getTerrainY(mission.x - 4.2, mission.z - 3.2);
      beaconGem.position.set(-4.2, beaconY + 7.8, -3.2);
      g.add(beaconGem);
      g.userData.crystal = beaconGem;
      break;
    }

    case 'vault':
    case 'plaza': {
      // ═════════════════════════════════════════════════════════════════════════
      // MISIÓN 05: TARJETA COSMOS (Pabellón de Beneficios & Convenios VIP)
      // Escala humana con modelos 3D reales de la librería Polyfork:
      // - Mercado/Pabellón al fondo
      // - Centro: Altar de piedra con la Tarjeta Cosmos VIP giratoria flotante
      // - Ala Izquierda: Puesto de mercado con toldo y cestas de convenios retail
      // - Ala Derecha: Puesto de salud, bienestar y puntos de recompensa
      // - Arcón de tesoros y recompensas Cosmos
      // ═════════════════════════════════════════════════════════════════════════
      await spawn(ASSETS.buildings.market, 6.5, [0, 0, -5.6], 0);

      // 1. Centro: Altar sagrado de piedra con la Tarjeta Cosmos flotante
      await spawn(ASSETS.polyfork.stoneAltar, 0.95, [0, 0, -0.6], 0);
      await spawn(ASSETS.polyfork.ironStrongbox, 0.55, [0, 0, 0.7], 0); // Arcón de tesoros y beneficios

      // Tarjeta Cosmos VIP Flotante sobre el altar
      const cardGroup = new THREE.Group();
      const cardBodyMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.7, roughness: 0.2 });
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.9, roughness: 0.18 });
      const cardMesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.76, 0.035), cardBodyMat);
      const cardGoldFrame = new THREE.Mesh(new THREE.BoxGeometry(1.23, 0.79, 0.028), goldMat);
      cardGroup.add(cardMesh);
      cardGroup.add(cardGoldFrame);
      const cardChip = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.045), goldMat);
      cardChip.position.set(-0.35, 0.10, 0.005);
      cardGroup.add(cardChip);
      const starCore = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.15, 0),
        new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 3.2, roughness: 0.1 })
      );
      starCore.position.set(0.28, 0, 0.025);
      cardGroup.add(starCore);

      const cardY = getTerrainY(mission.x, mission.z - 0.6);
      cardGroup.position.set(0, cardY + 1.85, -0.6);
      g.add(cardGroup);
      g.userData.cosmosCard = cardGroup;
      g.userData.cosmosCardBaseY = cardY + 1.85;

      // 2. Ala Izquierda: Puesto de Mercado Real 3D (Convenios Gastronomía, Tiendas y Viajes)
      await spawn(ASSETS.polyfork.marketStall, 2.25, [-4.0, 0, 0.2], 0.35);
      await spawn(ASSETS.polyfork.basketOfProduce, 0.45, [-3.4, 0, 1.4], 0.2);
      await spawn(ASSETS.polyfork.grainSack, 0.48, [-4.8, 0, 1.5], -0.3);

      // 3. Ala Derecha: Puesto de Mercado Real 3D (Salud, Fitness y Puntos Cosmos)
      await spawn(ASSETS.polyfork.marketStall, 2.25, [4.0, 0, 0.2], -0.35);
      await spawn(ASSETS.polyfork.woodenCrate, 0.50, [3.4, 0, 1.4], 0.3);
      await spawn(ASSETS.polyfork.flowerPlanter, 0.85, [4.8, 0, 1.5], 0);

      // 4. Faroles de bienvenida
      await spawn(ASSETS.polyfork.lampPost, 2.4, [-5.0, 0, 2.6], 0.3);
      await spawn(ASSETS.polyfork.lampPost, 2.4, [5.0, 0, 2.6], -0.3);

      // Arboleda enmarcando el pabellón comercial (CERO colisión)
      await spawn(ASSETS.trees[16], 8.0, [-8.5, 0, -4.5], 0.3); // Arce frondoso
      await spawn(ASSETS.trees[11], 8.0, [8.5, 0, -4.5], -0.3); // Sauce llorón
      await spawn(ASSETS.trees[0], 9.0, [0.0, 0, -13.5], 0.2);  // Roble de fondo
      break;
    }

    case 'history':
    case 'harbor': {
      // ═════════════════════════════════════════════════════════════════════════
      // MISIÓN 06: INTRODUCCIÓN A LA COMPAÑÍA (Gran Salón Consistorial & Museo)
      // Escala humana con modelos 3D reales de la librería Polyfork:
      // - Ayuntamiento / Salón Consistorial al fondo (7.0m)
      // - Centro: Altar de piedra con emblema místico y Atril con el Gran Tomo de Crónicas
      // - Guardia de Honor: Estatuas de Caballeros Fundadores flanqueando el acceso
      // - Tablón de la Historia y las 4 Eras corporativas
      // - Braseros ceremoniales con el fuego de la tradición
      // ═════════════════════════════════════════════════════════════════════════
      await spawn(ASSETS.buildings.townhall, 7.0, [0, 0, -4.8], 0);

      // 1. Centro: Altar de Piedra de la Fundación
      await spawn(ASSETS.polyfork.stoneAltar, 0.95, [0, 0, -1.4], 0);
      await spawn(ASSETS.polyfork.chainedBookLectern, 1.30, [0, 0, 0.3], 0); // Gran Libro de Crónicas

      // Emblema místico giratorio de Bradesco sobre el altar
      const chronicleEmblem = new THREE.Mesh(
        new THREE.TorusGeometry(0.38, 0.06, 12, 32),
        new THREE.MeshStandardMaterial({ color: BRAND_PALETTE.red, emissive: BRAND_PALETTE.darkRed, emissiveIntensity: 2.4, roughness: 0.25 })
      );
      const embY = getTerrainY(mission.x, mission.z - 1.4);
      chronicleEmblem.position.set(0, embY + 1.85, -1.4);
      g.add(chronicleEmblem);
      g.userData.armillaryRing1 = chronicleEmblem;

      // 2. Guardia de Honor: Estatuas de Caballeros de la Fundación
      await spawn(ASSETS.polyfork.standingKnightStatue, 2.2, [-3.2, 0, -1.4], 0.2);
      await spawn(ASSETS.polyfork.standingKnightStatue, 2.2, [3.2, 0, -1.4], -0.2);

      // 3. Tablón de Avisos Históricos (Las 4 Eras, Misión, Visión y Valores)
      await spawn(ASSETS.polyfork.campNoticeBoard, 1.55, [-3.8, 0, 1.2], 0.35);

      // 4. Flancos: Braseros ceremoniales y arcón de reliquias históricas
      await spawn(ASSETS.polyfork.standingBrazier, 1.05, [-2.2, 0, 1.5], 0);
      await spawn(ASSETS.polyfork.standingBrazier, 1.05, [2.2, 0, 1.5], 0);
      await spawn(ASSETS.polyfork.ironStrongbox, 0.52, [3.8, 0, 1.2], -0.35);

      // 5. Faroles de acceso frontal
      await spawn(ASSETS.polyfork.lampPost, 2.4, [-4.8, 0, 2.6], 0.3);
      await spawn(ASSETS.polyfork.lampPost, 2.4, [4.8, 0, 2.6], -0.3);

      // Arboleda enmarcando el salón consistorial (CERO colisión)
      await spawn(ASSETS.trees[6], 8.5, [-8.5, 0, -4.5], 0.3);
      await spawn(ASSETS.trees[13], 8.5, [8.5, 0, -4.5], -0.3);
      await spawn(ASSETS.trees[16], 9.0, [0.0, 0, -13.0], 0.1);
      break;
    }

    case 'nps':
    case 'archive': {
      // ═════════════════════════════════════════════════════════════════════════
      // MISIÓN 07: NPS (Satisfacción al Cliente & Semáforo de Calidad)
      // Escala humana con modelos 3D reales de la librería Polyfork:
      // - Cabaña rústica de Atención al Cliente (5.5m)
      // - Centro: Tablón oficial con la Escala NPS e indicador semáforo
      // - Ala Izquierda: Mesa de escucha y entrevistas con bancos de descanso
      // - Ala Derecha: Estantería de pergaminos con el protocolo Closed Loop
      // - Jardinera de flores y faroles de cordialidad
      // ═════════════════════════════════════════════════════════════════════════
      await spawn(ASSETS.polyfork.thatchedCottage, 5.5, [0, 0, -4.8], 0);

      // 1. Centro: Tablón con la Escala NPS (Promotores, Pasivos, Detractores)
      await spawn(ASSETS.polyfork.campNoticeBoard, 1.60, [0, 0, -0.6], 0);

      // Gema semáforo tricolor de calidad NPS flotando sobre el tablón
      const npsGem = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.32, 0),
        new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x059669, emissiveIntensity: 2.6, roughness: 0.2 })
      );
      const npsY = getTerrainY(mission.x, mission.z - 0.6);
      npsGem.position.set(0, npsY + 2.15, -0.6);
      g.add(npsGem);
      g.userData.crystal = npsGem;

      // 2. Ala Izquierda: Mesa de encuestas y diálogo de satisfacción
      await spawn(ASSETS.polyfork.timberTable, 0.76, [-3.4, 0, 0.6], 0.15);
      await spawn(ASSETS.polyfork.breadLoaf, 0.12, [-3.4, 0.76, 0.6], 0.2);
      await spawn(ASSETS.polyfork.wineJug, 0.22, [-3.0, 0.76, 0.6], 0);
      await spawn(ASSETS.polyfork.splitLogBench, 0.65, [-3.4, 0, 1.6], 0.15); // Banco de clientes

      // 3. Ala Derecha: Estantería de pergaminos (Protocolo Closed Loop & Seguimiento)
      await spawn(ASSETS.polyfork.scrollRack, 1.45, [3.4, 0, 0.6], -0.25);
      await spawn(ASSETS.polyfork.ironStrongbox, 0.52, [2.8, 0, 1.6], 0.2); // Urna de opiniones
      await spawn(ASSETS.polyfork.flowerPlanter, 0.85, [4.5, 0, 1.4], -0.3); // Jardinera floral

      // 4. Faroles de acceso frontal
      await spawn(ASSETS.polyfork.lampPost, 2.4, [-4.8, 0, 2.6], 0.3);
      await spawn(ASSETS.polyfork.lampPost, 2.4, [4.8, 0, 2.6], -0.3);

      // Arboleda enmarcando el pabellón NPS (CERO colisión)
      await spawn(ASSETS.trees[13], 8.2, [-8.5, 0, -4.5], 0.3);
      await spawn(ASSETS.trees[7], 8.2, [8.5, 0, -4.5], -0.3);
      await spawn(ASSETS.trees[0], 9.0, [0.0, 0, -13.0], 0.2);
      break;
    }

    case 'docmanager': {
      // ═════════════════════════════════════════════════════════════════════════
      // MISIÓN 08: GESTOR DOCUMENTAL (Archivo Central & Scriptorium Digital)
      // Escala humana con modelos 3D reales de la librería Polyfork:
      // - Taller / Scriptorium de cantería al fondo (6.5m)
      // - Centro: Atril de lectura con el Gran Índice de Archivos y orbe cian
      // - Ala Izquierda: Batería de estanterías de pergaminos y documentos
      // - Ala Derecha: Mesa de escriba con velas, tintero, baúl acorazado y cajas
      // ═════════════════════════════════════════════════════════════════════════
      await spawn(ASSETS.buildings.workshop, 6.5, [0, 0, -4.8], 0);

      // 1. Centro: Atril con el Registro Maestro de Documentos
      await spawn(ASSETS.polyfork.chainedBookLectern, 1.30, [0, 0, -0.6], 0);

      // Orbe de indexación digital cian flotando sobre el atril
      const docOrb = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.28, 0),
        new THREE.MeshStandardMaterial({ color: 0x00d2ff, emissive: 0x0099cc, emissiveIntensity: 2.8, roughness: 0.15 })
      );
      const orbY = getTerrainY(mission.x, mission.z - 0.6);
      docOrb.position.set(0, orbY + 1.85, -0.6);
      g.add(docOrb);
      g.userData.crystal = docOrb;

      // 2. Ala Izquierda: Estanterías de pergaminos y expedientes clasificados
      await spawn(ASSETS.polyfork.scrollRack, 1.48, [-3.2, 0, -0.4], 0.25);
      await spawn(ASSETS.polyfork.scrollRack, 1.48, [-4.2, 0, 1.0], 0.45);

      // 3. Ala Derecha: Mesa de catalogación, velas y caja fuerte
      await spawn(ASSETS.polyfork.timberTable, 0.76, [3.4, 0, 0.4], -0.2);
      await spawn(ASSETS.polyfork.candleSpikeCluster, 0.60, [3.4, 0.76, 0.4], 0);
      await spawn(ASSETS.polyfork.wineJug, 0.22, [3.8, 0.76, 0.4], 0.3); // Tintero
      await spawn(ASSETS.polyfork.woodenCrate, 0.50, [4.2, 0, 1.4], 0.2);
      await spawn(ASSETS.polyfork.ironStrongbox, 0.55, [2.6, 0, 1.4], -0.3); // Archivo confidencial

      // 4. Faroles de acceso frontal
      await spawn(ASSETS.polyfork.lampPost, 2.4, [-4.8, 0, 2.6], 0.3);
      await spawn(ASSETS.polyfork.lampPost, 2.4, [4.8, 0, 2.6], -0.3);

      // Arboleda de coníferas enmarcando el scriptorium (CERO colisión)
      await spawn(ASSETS.trees[14], 8.8, [-8.5, 0, -4.5], 0.3);
      await spawn(ASSETS.trees[5], 8.8, [8.5, 0, -4.5], -0.3);
      await spawn(ASSETS.trees[4], 8.5, [0.0, 0, -13.0], 0.1);
      break;
    }

    case 'ethics': {
      // ═════════════════════════════════════════════════════════════════════════
      // MISIÓN 09: CÓDIGO DE ÉTICA (Tribunal de Integridad & Principios)
      // Escala humana con modelos 3D reales de la librería Polyfork:
      // - Capilla / Tribunal solemne al fondo (6.8m)
      // - Muretes de piedra delimitando el atrio de justicia
      // - Centro: Altar de la verdad y Atril con el Gran Tomo de Ética
      // - Guardianes de honor: Estatua de caballero de la rectitud
      // - Canal confidencial: Arcón con cerradura blindada y tablón de directrices
      // - Braseros con la llama de la transparencia
      // ═════════════════════════════════════════════════════════════════════════
      await spawn(ASSETS.buildings.church, 6.8, [0, 0, -4.8], 0);

      // 1. Muretes de piedra enmarcando el recinto sagrado
      await spawn(ASSETS.polyfork.lowStoneWall, 0.80, [-4.2, 0, -2.5], 0.3);
      await spawn(ASSETS.polyfork.lowStoneWall, 0.80, [4.2, 0, -2.5], -0.3);

      // 2. Centro: Altar Solemne de la Verdad y Atril del Código
      await spawn(ASSETS.polyfork.stoneAltar, 0.95, [0, 0, -1.6], 0);
      await spawn(ASSETS.polyfork.chainedBookLectern, 1.25, [0, 0, 0.2], 0); // Tomo del Código de Ética

      // Gema esmeralda de la rectitud flotando sobre el altar
      const ethicsGem = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.32, 0),
        new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x059669, emissiveIntensity: 2.8, roughness: 0.18 })
      );
      const ethY = getTerrainY(mission.x, mission.z - 1.6);
      ethicsGem.position.set(0, ethY + 2.05, -1.6);
      g.add(ethicsGem);
      g.userData.crystal = ethicsGem;

      // 3. Guardia de Honor: Caballero de la Justicia
      await spawn(ASSETS.polyfork.standingKnightStatue, 2.2, [-2.8, 0, -0.6], 0.2);

      // 4. Canal Confidencial: Arcón blindado de denuncias y Tablón de Principios
      await spawn(ASSETS.polyfork.ironStrongbox, 0.55, [-3.8, 0, 1.2], 0.3); // Buzón blindado
      await spawn(ASSETS.polyfork.campNoticeBoard, 1.55, [3.6, 0, 1.2], -0.3); // Tablón de normas éticas

      // 5. Braseros ceremoniales con la llama de la integridad
      await spawn(ASSETS.polyfork.standingBrazier, 1.05, [-2.0, 0, 1.6], 0);
      await spawn(ASSETS.polyfork.standingBrazier, 1.05, [2.0, 0, 1.6], 0);

      // 6. Faroles de acceso frontal
      await spawn(ASSETS.polyfork.lampPost, 2.4, [-4.8, 0, 2.8], 0.3);
      await spawn(ASSETS.polyfork.lampPost, 2.4, [4.8, 0, 2.8], -0.3);

      // Arboleda enmarcando el tribunal de ética (CERO colisión)
      await spawn(ASSETS.trees[14], 8.8, [-8.5, 0, -4.5], 0.3);
      await spawn(ASSETS.trees[3], 8.5, [8.5, 0, -4.5], -0.3);
      await spawn(ASSETS.trees[5], 9.0, [0.0, 0, -13.0], 0.1);
      break;
    }

    case 'culture': {
      // ═════════════════════════════════════════════════════════════════════════
      // MISIÓN 10: CULTURA Y COMUNICACIÓN (Ágora de la Comunidad & Convivencia)
      // Escala humana con modelos 3D reales de la librería Polyfork:
      // - Gran Taberna / Salón de Convivencia al fondo (6.4m)
      // - Centro: Pozo del Pueblo en la plaza comunitaria (2.2m)
      // - Ala Izquierda: Tablón de la Gaceta y Comunicación Interna con jardinera
      // - Ala Derecha: Fogata comunitaria de piedra con trípode y bancos de troncos
      // ═════════════════════════════════════════════════════════════════════════
      await spawn(ASSETS.polyfork.villageTavern, 6.4, [0, 0, -4.8], 0);

      // 1. Centro: Pozo del Pueblo en el corazón de la plaza comunal
      await spawn(ASSETS.polyfork.villageWell, 2.20, [0, 0, -0.6], 0);

      // 2. Ala Izquierda: Gaceta de Comunicación Interna y jardinera
      await spawn(ASSETS.polyfork.campNoticeBoard, 1.60, [-3.8, 0, 0.8], 0.35);
      await spawn(ASSETS.polyfork.flowerPlanter, 0.85, [-4.6, 0, 1.8], 0.1);

      // 3. Ala Derecha: Fogonata de convivencia con bancos de troncos y asador
      await spawn(ASSETS.polyfork.stoneCampfire, 1.00, [3.4, 0, 0.6], 0);
      await spawn(ASSETS.polyfork.campfireCookTripod, 1.25, [3.4, 0, 0.6], 0);
      await spawn(ASSETS.polyfork.splitLogBench, 0.65, [3.4, 0, -0.5], 0);     // Banco norte
      await spawn(ASSETS.polyfork.splitLogBench, 0.65, [2.2, 0, 1.2], 0.8);     // Banco oeste
      await spawn(ASSETS.polyfork.splitLogBench, 0.65, [4.6, 0, 1.2], -0.8);    // Banco este

      // 4. Faroles de acceso frontal
      await spawn(ASSETS.polyfork.lampPost, 2.4, [-5.0, 0, 2.8], 0.3);
      await spawn(ASSETS.polyfork.lampPost, 2.4, [5.0, 0, 2.8], -0.3);

      // Arboleda enmarcando la taberna comunitaria (CERO colisión)
      await spawn(ASSETS.trees[14], 8.5, [-8.5, 0, -4.5], 0.3);
      await spawn(ASSETS.trees[0], 8.5, [8.5, 0, -4.5], -0.3);
      await spawn(ASSETS.trees[10], 9.0, [0.0, 0, -13.0], 0.2);
      break;
    }

    case 'route90': {
      // ═════════════════════════════════════════════════════════════════════════
      // MISIÓN 11: RUTA 90 (Sendero de las 3 Postas: 30 - 60 - 90 Días)
      // Tiendas separadas a los extremos para dejar un camino central amplio
      // ═════════════════════════════════════════════════════════════════════════
      await spawn(ASSETS.buildings.tent, 3.6, [-4.5, 0, -2.8], 0.4);
      await spawn(ASSETS.buildings.tent, 3.6, [4.5, 0, -2.8], -0.4);

      // 1. Centro: Las 3 Postas de Hito escalonadas a lo largo del sendero
      const routeMonument = createRoute90Monument();
      const rtY = getTerrainY(mission.x, mission.z + 0.1);
      routeMonument.position.set(0, rtY, 0.1);
      g.add(routeMonument);

      // 2. Mesa de campamento de integración en el lateral izquierdo
      await spawn(ASSETS.props.signingTable, 1.05, [-2.8, 0, 1.2], 0.3);

      // Arboleda de montaña enmarcando la Ruta 90 (CERO colisión)
      await spawn(ASSETS.trees[14], 8.8, [-8.5, 0, -4.5], 0.3);
      await spawn(ASSETS.trees[5], 8.8, [8.5, 0, -4.5], -0.3);
      await spawn(ASSETS.trees[10], 9.0, [0.0, 0, -13.0], 0.1);
      break;
    }

    case 'union': {
      // ═════════════════════════════════════════════════════════════════════════
      // MISIÓN 12: SINDICATO (Foro de la Alianza Laboral & Mesa de Acuerdos)
      // Escala humana con modelos 3D reales de la librería Polyfork:
      // - Ayuntamiento / Sala de Plenos al fondo (6.8m)
      // - Centro: Gran Mesa de Negociación Bilateral con bancos a ambos lados
      // - Ala Izquierda: Atril del Contrato Colectivo y estantería de estatutos laborales
      // - Ala Derecha: Caballero guardián de los derechos y tablón de asamblea
      // ═════════════════════════════════════════════════════════════════════════
      await spawn(ASSETS.buildings.townhall, 6.8, [0, 0, -4.8], 0);

      // 1. Centro: Mesa de Acuerdos Bilaterales y Pacto Colectivo
      await spawn(ASSETS.polyfork.timberTable, 0.78, [0, 0, -0.6], 0);
      await spawn(ASSETS.polyfork.breadLoaf, 0.12, [0, 0.78, -0.6], 0);
      await spawn(ASSETS.polyfork.wineJug, 0.22, [-0.4, 0.78, -0.6], 0);
      await spawn(ASSETS.polyfork.goblet, 0.16, [0.4, 0.78, -0.6], 0);
      // Asientos bilaterales (Representación Sindical y Liderazgo Empresarial)
      await spawn(ASSETS.polyfork.splitLogBench, 0.65, [-1.3, 0, -0.6], Math.PI / 2);
      await spawn(ASSETS.polyfork.splitLogBench, 0.65, [1.3, 0, -0.6], Math.PI / 2);

      // 2. Ala Izquierda: Registro del Contrato Colectivo y Estatutos
      await spawn(ASSETS.polyfork.chainedBookLectern, 1.25, [-3.2, 0, 0.6], 0.3);
      await spawn(ASSETS.polyfork.scrollRack, 1.45, [-4.2, 0, -0.4], 0.4);

      // 3. Ala Derecha: Representante / Guardián de los Derechos y Tablón
      await spawn(ASSETS.polyfork.standingKnightStatue, 2.1, [3.6, 0, -0.4], -0.3);
      await spawn(ASSETS.polyfork.campNoticeBoard, 1.55, [3.6, 0, 1.2], -0.35);

      // 4. Vallas perimetrales y faroles
      await spawn(ASSETS.polyfork.woodenFence, 0.95, [-6.5, 0, 0.2], 0.8);
      await spawn(ASSETS.polyfork.woodenFence, 0.95, [6.5, 0, 0.2], -0.8);
      await spawn(ASSETS.polyfork.lampPost, 2.4, [-4.8, 0, 2.6], 0.3);
      await spawn(ASSETS.polyfork.lampPost, 2.4, [4.8, 0, 2.6], -0.3);

      // Arboleda de cumbres enmarcando el salón del sindicato (CERO colisión)
      await spawn(ASSETS.trees[12], 9.0, [-8.5, 0, -4.5], 0.3);
      await spawn(ASSETS.trees[14], 9.0, [8.5, 0, -4.5], -0.3);
      await spawn(ASSETS.trees[10], 9.2, [0.0, 0, -13.0], 0.1);
      break;
    }

    case 'castle': {
      // ═════════════════════════════════════════════════════════════════════════
      // MISIÓN 13: CIERRE (Gran Castillo & Bastión de Graduación)
      // Escala heroica con modelos 3D reales de la librería Polyfork:
      // - Gran Castillo Real al fondo (12.0m) y 4 torres defensivas
      // - Calzada de Honor: Guardia de estatuas de caballeros y braseros triunfales
      // - Centro: Gran Altar de Graduación con el Arcón Dorado de Logros y Corona
      // - Ala de Celebración: Mesa de banquete con lechón, tarta rústica y jarras
      // - Cuervos en las almenas altas
      // ═════════════════════════════════════════════════════════════════════════
      await spawn(ASSETS.buildings.castle, 12.0, [0, 0, -4.0], 0);
      await spawn(ASSETS.buildings.cannonTower, 8.0, [-7.5, 0, 2.5], 0.3);
      await spawn(ASSETS.buildings.cannonTower, 8.0, [7.5, 0, 2.5], -0.3);
      await spawn(ASSETS.buildings.tower, 7.0, [-7.5, 0, -8.0], 0);
      await spawn(ASSETS.buildings.tower, 7.0, [7.5, 0, -8.0], 0);

      // 1. Calzada de Honor: Caballeros de Guardia y Braseros de la Victoria
      await spawn(ASSETS.polyfork.standingKnightStatue, 2.4, [-3.2, 0, -0.8], 0.2);
      await spawn(ASSETS.polyfork.standingKnightStatue, 2.4, [3.2, 0, -0.8], -0.2);
      await spawn(ASSETS.polyfork.standingBrazier, 1.20, [-2.2, 0, 1.4], 0);
      await spawn(ASSETS.polyfork.standingBrazier, 1.20, [2.2, 0, 1.4], 0);

      // 2. Centro: Gran Altar Sagrado de Graduación y Arcón Real de Recompensas
      await spawn(ASSETS.polyfork.stoneAltar, 1.05, [0, 0, -1.2], 0);
      await spawn(ASSETS.polyfork.ironStrongbox, 0.65, [0, 0, 0.4], 0);

      // Emblema triunfal dorado flotando sobre el altar de graduación
      const victoryCrown = new THREE.Mesh(
        new THREE.TorusGeometry(0.42, 0.08, 12, 32),
        new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xffa500, emissiveIntensity: 2.8, metalness: 0.9, roughness: 0.15 })
      );
      const vicY = getTerrainY(mission.x, mission.z - 1.2);
      victoryCrown.position.set(0, vicY + 2.2, -1.2);
      g.add(victoryCrown);
      g.userData.crystal = victoryCrown;

      // 3. Ala de Celebración: Mesa de Banquete de Victoria
      await spawn(ASSETS.polyfork.timberTable, 0.76, [-5.2, 0, 0.8], 0.25);
      await spawn(ASSETS.polyfork.roastMeat, 0.22, [-5.2, 0.76, 0.8], 0.1);
      await spawn(ASSETS.polyfork.rusticPie, 0.10, [-5.6, 0.76, 0.8], 0.3);
      await spawn(ASSETS.polyfork.breadLoaf, 0.12, [-4.8, 0.76, 0.8], -0.2);
      await spawn(ASSETS.polyfork.wineJug, 0.22, [-5.0, 0.76, 0.6], 0);
      await spawn(ASSETS.polyfork.goblet, 0.16, [-5.4, 0.76, 0.6], 0);

      // 4. Aves vigilantes en las almenas altas
      await spawn(ASSETS.animals.crow, 0.42, [-7.5, 8.0, 2.5], 0.2);
      await spawn(ASSETS.animals.crow, 0.42, [7.5, 8.0, 2.5], -0.2);

      // Arboleda regia enmarcando el Castillo (CERO colisión con murallas ni torres)
      await spawn(ASSETS.trees[12], 10.5, [-13.5, 0, -5.0], 0.2);
      await spawn(ASSETS.trees[14], 10.5, [13.5, 0, -5.0], -0.2);
      await spawn(ASSETS.trees[10], 11.0, [-8.0, 0, -16.5], 0.3);
      await spawn(ASSETS.trees[5], 11.0, [8.0, 0, -16.5], -0.3);
      await spawn(ASSETS.trees[0], 12.0, [0.0, 0, -18.0], 0);
      break;
    }
  }

  g.userData.mixers = stationMixers;
  return g;
}


// ── Ultra-Performance GPU Instanced Mesh Generator ───────────────────────────

async function createInstancedGroup(path, transforms) {
  if (!transforms || !transforms.length) return null;
  const gltf = await loadModel(path);
  if (!gltf || !gltf.scene) return null;

  let sourceMesh = null;
  gltf.scene.traverse(child => {
    if (child.isMesh && !sourceMesh) {
      sourceMesh = child;
    }
  });
  if (!sourceMesh) return null;

  sourceMesh.geometry.computeBoundingBox();
  const bb = sourceMesh.geometry.boundingBox;
  const sizeY = Math.max(0.001, bb.max.y - bb.min.y);
  const centerX = (bb.max.x + bb.min.x) * 0.5;
  const centerZ = (bb.max.z + bb.min.z) * 0.5;
  const offsetY = -bb.min.y;

  const mat = sourceMesh.material.clone();
  mat.roughness = 0.85;
  mat.metalness = 0.0;
  mat.envMapIntensity = 0.0;

  const instancedMesh = new THREE.InstancedMesh(sourceMesh.geometry, mat, transforms.length);
  instancedMesh.castShadow = true;
  instancedMesh.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const subDummy = new THREE.Object3D();
  dummy.add(subDummy);

  for (let i = 0; i < transforms.length; i++) {
    const t = transforms[i];
    const scale = t.height / sizeY;
    const sx = scale * (t.scaleX || 1);
    const sz = scale * (t.scaleZ || 1);

    subDummy.position.set(-centerX * sx, (offsetY - 0.03) * scale, -centerZ * sz);
    subDummy.scale.set(sx, scale, sz);

    dummy.position.set(t.pos[0], t.pos[1], t.pos[2]);
    dummy.rotation.y = t.rotY || 0;
    if (t.tiltX) dummy.rotation.x = t.tiltX;
    if (t.tiltZ) dummy.rotation.z = t.tiltZ;
    dummy.updateMatrixWorld(true);

    subDummy.updateMatrixWorld(true);
    instancedMesh.setMatrixAt(i, subDummy.matrixWorld);
  }

  instancedMesh.instanceMatrix.needsUpdate = true;
  instancedMesh.computeBoundingBox();
  instancedMesh.computeBoundingSphere();
  return instancedMesh;
}

// ── Minecraft-Style Spatial Chunk World Streamer with Frustum Culling ────────

export class ProgressiveWorldStreamer {
  constructor(scene, missions, getTerrainY, trailPoints = []) {
    this.scene = scene;
    this.missions = missions;
    this.getTerrainY = getTerrainY;
    this.trailPoints = trailPoints;
    this.mixers = [];
    this.birds = [];

    // 32 Spatial Chunks (8 columns x 4 rows across 920x480 continent)
    this.chunkCols = 8;
    this.chunkRows = 4;
    this.minX = -380;
    this.maxX = 540;
    this.minZ = -240;
    this.maxZ = 240;
    this.chunkW = (this.maxX - this.minX) / this.chunkCols;
    this.chunkD = (this.maxZ - this.minZ) / this.chunkRows;

    this.chunks = [];
    for (let c = 0; c < this.chunkCols; c++) {
      this.chunks[c] = [];
      for (let r = 0; r < this.chunkRows; r++) {
        const cx = this.minX + (c + 0.5) * this.chunkW;
        const cz = this.minZ + (r + 0.5) * this.chunkD;
        const cy = this.getTerrainY(cx, cz);
        const group = new THREE.Group();
        group.name = `Chunk_${c}_${r}`;
        this.chunks[c][r] = {
          col: c,
          row: r,
          cx,
          cz,
          cy,
          group,
          buckets: new Map()
        };
      }
    }

    this.prepareEntities();
  }

  getChunk(x, z) {
    const col = THREE.MathUtils.clamp(Math.floor((x - this.minX) / this.chunkW), 0, this.chunkCols - 1);
    const row = THREE.MathUtils.clamp(Math.floor((z - this.minZ) / this.chunkD), 0, this.chunkRows - 1);
    return this.chunks[col][row];
  }

  prepareEntities() {
    // ── Collision Guard & Safe Zone Validator ───────────────────────────────
    const placedColliders = [];

    const isStationClearing = (x, z) => {
      for (const m of this.missions) {
        const rad = (m.id === 13) ? 18.0 : 11.5;
        if (Math.hypot(x - m.x, z - m.z) < rad) return true;
      }
      return false;
    };

    const canSpawnAt = (x, z, radius = 2.0) => {
      // 1. Never spawn inside or near stations (11.5m clear perimeter, 18m en Bastión)
      if (isStationClearing(x, z)) return false;

      // 2. Keep clear of the walking trail path
      if (this.trailPoints && this.trailPoints.length) {
        for (let i = 0; i < this.trailPoints.length; i++) {
          const pt = this.trailPoints[i];
          if (Math.hypot(x - pt.x, z - pt.y) < (radius + 5.5)) return false;
        }
      }

      // 3. Collision Guard: Ensure no overlap with any other placed entity
      for (let i = 0; i < placedColliders.length; i++) {
        const c = placedColliders[i];
        if (Math.hypot(x - c.x, z - c.z) < (radius + c.r)) {
          return false; // Collision detected!
        }
      }

      // Register collision footprint
      placedColliders.push({ x, z, r: radius });
      return true;
    };

    const addInstance = (path, height, pos, rotY, scaleX = 1, scaleZ = 1, tiltX = 0, tiltZ = 0) => {
      const chunk = this.getChunk(pos[0], pos[2]);
      if (!chunk.buckets.has(path)) {
        chunk.buckets.set(path, []);
      }
      chunk.buckets.get(path).push({ height, pos, rotY, scaleX, scaleZ, tiltX, tiltZ });
    };

    let seedIdx = 1;

    // Helper: Cauce del río continuo para delimitar la zona de ribera
    const getRiverZCoord = (rx) => {
      const RIVER_PTS = [
        [-155, -15],
        [-125, -20],
        [-70, -26],
        [-20, -32],
        [35, -28],
        [80, -20],
        [82, -45]
      ];
      if (rx <= RIVER_PTS[0][0]) return RIVER_PTS[0][1];
      if (rx >= RIVER_PTS[RIVER_PTS.length - 1][0]) return RIVER_PTS[RIVER_PTS.length - 1][1];
      for (let i = 0; i < RIVER_PTS.length - 1; i++) {
        if (rx >= RIVER_PTS[i][0] && rx <= RIVER_PTS[i + 1][0]) {
          const t = (rx - RIVER_PTS[i][0]) / (RIVER_PTS[i + 1][0] - RIVER_PTS[i][0]);
          const s = t * t * (3 - 2 * t);
          return RIVER_PTS[i][1] + (RIVER_PTS[i + 1][1] - RIVER_PTS[i][1]) * s;
        }
      }
      return -20;
    };

    // ── Clasificador de Sectores del Mapa tipo Minecraft ────────────────────
    const getSectorAt = (x, z, y) => {
      // 1. Ribera Fluvial y Humedales (Cerca del río o lago)
      const nearRiver = (x >= -165 && x <= 95 && Math.abs(z - getRiverZCoord(x)) < 24.0);
      const nearLake = (Math.hypot((x - 110) * 0.7, z + 150) < 55.0);
      if (nearRiver || nearLake) return 'river_wetland';

      // 2. Sector Oeste: Robledal Frondoso y Praderas (Oak Forest & Plains)
      if (x < -120) return 'oak_forest';

      // 3. Sector Central: Gran Taiga de Pinos y Abetos (Pine & Spruce Taiga)
      if (x >= -120 && x < 285) return 'pine_taiga';

      // 4. Sector Este: Bosque de Altura y Cumbres (Highland Mountain Woods)
      return 'highland_woods';
    };

    // Paletas temáticas equilibradas por Biomas estilo Minecraft (100% Árboles vivos, sotobosque 3D real y rocas)
    const SECTOR_PALETTES = {
      // Sector 1: Praderas, Abedulares y Robles (Sector Oeste - Stn 00, 01, 02)
      // Mezcla armoniosa de Abedules blancos, Pinos verdes altos, Robles y Cipreses
      oak_forest: {
        mothers: [
          ASSETS.trees[13], // birch-tree-181b33.glb (Abedul tronco blanco y hojas verdes vivas)
          ASSETS.trees[15], // broadleaf-oak-997c22.glb (Roble natural de copa frondosa verde)
          ASSETS.trees[14], // tall-pine-tree-ab4108.glb (Pino verde alto natural)
          ASSETS.trees[6],  // Tree_3_A_Color1.gltf (Ciprés/álamo cónico estilizado)
          ASSETS.trees[0],  // Tree_1_A_Color1.gltf (Roble estilizado verde vivo)
          ASSETS.trees[5]   // Tree_2_C_Color1.gltf (Conífera verde alta estilizada)
        ],
        children: [
          ASSETS.trees[13], // Abedul
          ASSETS.trees[1],  // Roble mediano Tree_1_B
          ASSETS.trees[6],  // Ciprés cónico Tree_3_A
          ASSETS.trees[3],  // Pino estilizado Tree_2_A
          ASSETS.trees[15], // Roble natural
          ASSETS.trees[17]  // Pino joven young-pine
        ],
        saplings: [
          ASSETS.trees[13], // Abedul retoño
          ASSETS.trees[17], // Pino joven
          ASSETS.trees[1]   // Roble joven
        ],
        understory: [
          ASSETS.bushes[0], // round-bush-cd2ac0.glb (Arbusto globular frondoso verde)
          ASSETS.bushes[1], // bush-8bb596.glb (Arbusto silvestre verde denso)
          ASSETS.bushes[2], // fern-plant-1559b8.glb (Helecho silvestre verde)
          ASSETS.bushes[3]  // grass-tuft-a40a08.glb (Mechón de hierba)
        ],
        rocks: [ASSETS.rocks[0], ASSETS.rocks[1]] // Rock_1_A, Rock_1_E
      },

      // Sector 2: Bosque Templado, Ribera Fluvial y Sauces Llorones (Stn 03, 05, 06, 07)
      river_wetland: {
        mothers: [
          ASSETS.trees[11], // Tree_6_A_Color1.gltf (Sauce llorón verde estilizado)
          ASSETS.trees[16], // maple-tree-65fa12.glb (Arce frondoso verde)
          ASSETS.trees[6],  // Tree_3_A_Color1.gltf (Árbol cónico alto de ribera)
          ASSETS.trees[7],  // Tree_3_B_Color1.gltf (Árbol cónico de ribera B)
          ASSETS.trees[13]  // Abedul ribereño
        ],
        children: [
          ASSETS.trees[11], // Sauce
          ASSETS.trees[8],  // Tree_3_C
          ASSETS.trees[16], // Arce
          ASSETS.trees[13], // Abedul
          ASSETS.trees[1]   // Roble
        ],
        saplings: [
          ASSETS.trees[11],
          ASSETS.trees[13],
          ASSETS.trees[8]
        ],
        understory: [
          ASSETS.bushes[2], // fern-plant-1559b8.glb (Helecho silvestre verde vivo)
          ASSETS.bushes[0], // round-bush-cd2ac0.glb (Arbusto globular)
          ASSETS.bushes[1], // bush-8bb596.glb (Arbusto silvestre)
          ASSETS.bushes[3]  // grass-tuft-a40a08.glb (Mechón de hierba)
        ],
        rocks: [ASSETS.rocks[1], ASSETS.rocks[3]] // Rock_1_E, Rock_3_A
      },

      // Sector 3: Gran Taiga de Pinos y Coníferas Verdes (Stn 04, 08, 09, 10)
      pine_taiga: {
        mothers: [
          ASSETS.trees[14], // tall-pine-tree-ab4108.glb (Pino verde natural imponente)
          ASSETS.trees[5],  // Tree_2_C_Color1.gltf (Pino estilizado C)
          ASSETS.trees[4],  // Tree_2_B_Color1.gltf (Pino estilizado B)
          ASSETS.trees[3]   // Tree_2_A_Color1.gltf (Pino estilizado A)
        ],
        children: [
          ASSETS.trees[14], // Pino natural
          ASSETS.trees[17], // young-pine-0d7695.glb (Pino joven)
          ASSETS.trees[3],  // Pino A
          ASSETS.trees[4],  // Pino B
          ASSETS.trees[5]   // Pino C
        ],
        saplings: [
          ASSETS.trees[17],
          ASSETS.trees[3]
        ],
        understory: [
          ASSETS.bushes[0], // round-bush-cd2ac0.glb
          ASSETS.bushes[1], // bush-8bb596.glb
          ASSETS.bushes[3]  // grass-tuft-a40a08.glb
        ],
        rocks: [ASSETS.rocks[2], ASSETS.rocks[0]] // Rock_2_A, Rock_1_A
      },

      // Sector 4: Bosque de Altura y Cumbres (Highland Mountain Woods - Stn 11, 12, 13)
      highland_woods: {
        mothers: [
          ASSETS.trees[12], // Tree_7_A_Color1.gltf (Árbol colosal denso)
          ASSETS.trees[10], // Tree_5_A_Color1.gltf (Árbol verde vivo estilizado)
          ASSETS.trees[14], // tall-pine-tree
          ASSETS.trees[5]   // Tree_2_C
        ],
        children: [
          ASSETS.trees[10],
          ASSETS.trees[12],
          ASSETS.trees[3],
          ASSETS.trees[17],
          ASSETS.trees[14]
        ],
        saplings: [
          ASSETS.trees[10],
          ASSETS.trees[17],
          ASSETS.trees[3]
        ],
        understory: [
          ASSETS.bushes[0], // round-bush-cd2ac0.glb
          ASSETS.bushes[1], // bush-8bb596.glb
          ASSETS.bushes[3]  // grass-tuft-a40a08.glb
        ],
        rocks: [ASSETS.rocks[4], ASSETS.rocks[2]] // Rock_5_A, Rock_2_A
      }
    };

    // ── 1. Arboledas Orgánicas Zonificadas por Sector (Sin colisiones, 3 estratos) ──
    for (let g = 0; g < 320; g++) {
      const gx = -350 + seeded(seedIdx++) * 840;
      const gz = -190 + seeded(seedIdx++) * 380;
      const gy = this.getTerrainY(gx, gz);
      if (gy < -0.3 || gy > 36.0) continue;

      // Validación estricta anticolisión para el árbol patriarca
      if (!canSpawnAt(gx, gz, 3.0)) continue;

      const sectorKey = getSectorAt(gx, gz, gy);
      const palette = SECTOR_PALETTES[sectorKey];

      // Estrato 1: Árbol Patriarca / Madre Central (8.5m a 11.2m, porte majestuoso y verde)
      const motherModel = palette.mothers[Math.floor(seeded(seedIdx++) * palette.mothers.length)];
      const motherHeight = THREE.MathUtils.lerp(8.5, 11.2, seeded(seedIdx++));
      const motherScaleXZ = THREE.MathUtils.lerp(0.95, 1.30, seeded(seedIdx++));
      addInstance(motherModel, motherHeight, [gx, gy, gz], seeded(seedIdx++) * Math.PI * 2, motherScaleXZ, motherScaleXZ);

      // Estrato 2: 3 a 5 Árboles Jóvenes orbitando (4.5m a 6.8m)
      const childCount = 3 + Math.floor(seeded(seedIdx++) * 3);
      for (let c = 0; c < childCount; c++) {
        const angle = seeded(seedIdx++) * Math.PI * 2;
        const rad = 3.8 + seeded(seedIdx++) * 8.0;
        const tx = gx + Math.cos(angle) * rad;
        const tz = gz + Math.sin(angle) * rad;
        const ty = this.getTerrainY(tx, tz);
        if (ty < -0.3 || ty > 38.0) continue;

        if (!canSpawnAt(tx, tz, 2.2)) continue; // Evita superposición entre árboles

        const childModel = palette.children[Math.floor(seeded(seedIdx++) * palette.children.length)];
        const childHeight = THREE.MathUtils.lerp(4.5, 6.8, seeded(seedIdx++));
        const childScaleXZ = THREE.MathUtils.lerp(0.85, 1.18, seeded(seedIdx++));
        const tiltX = (seeded(seedIdx++) - 0.5) * 0.08;
        const tiltZ = (seeded(seedIdx++) - 0.5) * 0.08;
        addInstance(childModel, childHeight, [tx, ty, tz], seeded(seedIdx++) * Math.PI * 2, childScaleXZ, childScaleXZ, tiltX, tiltZ);
      }

      // Estrato 3: 1 a 2 Arbolitos Retoños / Árboles pequeños (2.4m a 3.6m) en el linde
      const saplingCount = 1 + Math.floor(seeded(seedIdx++) * 2);
      for (let s = 0; s < saplingCount; s++) {
        const sAngle = seeded(seedIdx++) * Math.PI * 2;
        const sRad = 5.5 + seeded(seedIdx++) * 5.0;
        const sx = gx + Math.cos(sAngle) * sRad;
        const sz = gz + Math.sin(sAngle) * sRad;
        const sy = this.getTerrainY(sx, sz);
        if (sy < -0.3 || sy > 38.0) continue;

        if (!canSpawnAt(sx, sz, 1.6)) continue;

        const saplingModel = palette.saplings[Math.floor(seeded(seedIdx++) * palette.saplings.length)];
        const saplingHeight = THREE.MathUtils.lerp(2.4, 3.6, seeded(seedIdx++));
        const saplingScaleXZ = THREE.MathUtils.lerp(0.80, 1.10, seeded(seedIdx++));
        addInstance(saplingModel, saplingHeight, [sx, sy, sz], seeded(seedIdx++) * Math.PI * 2, saplingScaleXZ, saplingScaleXZ);
      }

      // Sotobosque natural al pie del grupo (Arbustos esféricos verdes de 0.8m a 1.4m)
      const bushCount = 4 + Math.floor(seeded(seedIdx++) * 3);
      for (let b = 0; b < bushCount; b++) {
        const bAngle = seeded(seedIdx++) * Math.PI * 2;
        const bRad = 1.6 + seeded(seedIdx++) * 6.5;
        const bx = gx + Math.cos(bAngle) * bRad;
        const bz = gz + Math.sin(bAngle) * bRad;
        const by = this.getTerrainY(bx, bz);
        if (by > -0.3 && canSpawnAt(bx, bz, 0.9)) {
          const bushModel = palette.understory[Math.floor(seeded(seedIdx++) * palette.understory.length)];
          const bHeight = THREE.MathUtils.lerp(0.80, 1.45, seeded(seedIdx++));
          addInstance(bushModel, bHeight, [bx, by, bz], seeded(seedIdx++) * Math.PI * 2);
        }
      }

      // Rocas estilizadas del bioma (50% probabilidad)
      if (seeded(seedIdx++) > 0.50) {
        const rx = gx + (seeded(seedIdx++) - 0.5) * 7.0;
        const rz = gz + (seeded(seedIdx++) - 0.5) * 7.0;
        const ry = this.getTerrainY(rx, rz);
        if (ry > -0.3 && canSpawnAt(rx, rz, 1.4)) {
          const rockModel = palette.rocks[Math.floor(seeded(seedIdx++) * palette.rocks.length)];
          const rHeight = THREE.MathUtils.lerp(0.7, 1.6, seeded(seedIdx++));
          addInstance(rockModel, rHeight, [rx, ry, rz], seeded(seedIdx++) * Math.PI * 2);
        }
      }
    }

    // ── 2. El Gran Cinturón Perimetral (Mountain Rim Forest Wall) ────────────
    // Muralla densa de coníferas colosales, abedules y robles majestuosos (8.5m a 12.0m)
    const rimTrees = [
      ASSETS.trees[14], // tall-pine-tree-ab4108.glb (Pino verde natural imponente)
      ASSETS.trees[5],  // Tree_2_C_Color1.gltf (Pino estilizado alto)
      ASSETS.trees[13], // birch-tree-181b33.glb (Abedul tronco blanco y verde)
      ASSETS.trees[12], // Tree_7_A_Color1.gltf (Árbol majestuoso colosal)
      ASSETS.trees[0],  // Tree_1_A_Color1.gltf (Roble estilizado verde vivo)
      ASSETS.trees[15]  // broadleaf-oak-997c22.glb (Roble frondoso)
    ];

    const perimeterPoints = [];
    // Borde Norte
    for (let x = -370; x <= 530; x += 15) {
      perimeterPoints.push([x + (seeded(seedIdx++) - 0.5) * 5, -205 + (seeded(seedIdx++) - 0.5) * 18]);
    }
    // Borde Sur
    for (let x = -370; x <= 530; x += 15) {
      perimeterPoints.push([x + (seeded(seedIdx++) - 0.5) * 5, 205 + (seeded(seedIdx++) - 0.5) * 18]);
    }
    // Borde Oeste
    for (let z = -190; z <= 190; z += 15) {
      perimeterPoints.push([-345 + (seeded(seedIdx++) - 0.5) * 18, z + (seeded(seedIdx++) - 0.5) * 5]);
    }
    // Borde Este
    for (let z = -190; z <= 190; z += 15) {
      perimeterPoints.push([505 + (seeded(seedIdx++) - 0.5) * 18, z + (seeded(seedIdx++) - 0.5) * 5]);
    }

    for (const [px, pz] of perimeterPoints) {
      const py = this.getTerrainY(px, pz);
      if (py < -0.3 || !canSpawnAt(px, pz, 2.6)) continue;

      const model = rimTrees[Math.floor(seeded(seedIdx++) * rimTrees.length)];
      const height = THREE.MathUtils.lerp(8.5, 12.0, seeded(seedIdx++));
      const scaleXZ = THREE.MathUtils.lerp(0.95, 1.35, seeded(seedIdx++));
      addInstance(model, height, [px, py, pz], seeded(seedIdx++) * Math.PI * 2, scaleXZ, scaleXZ);
    }

    // ── 3. Dispersión Orgánica de Rocas y Elementos Naturales ────────────────
    for (let i = 0; i < 280; i++) {
      const x = -350 + seeded(seedIdx++) * 840;
      const z = -190 + seeded(seedIdx++) * 380;
      const y = this.getTerrainY(x, z);
      if (y < -0.3 || y > 38.0 || !canSpawnAt(x, z, 1.4)) continue;

      const sectorKey = getSectorAt(x, z, y);
      const palette = SECTOR_PALETTES[sectorKey];
      const rockModel = palette.rocks[Math.floor(seeded(seedIdx++) * palette.rocks.length)];
      const height = THREE.MathUtils.lerp(0.55, 1.65, seeded(seedIdx++));
      addInstance(rockModel, height, [x, y, z], seeded(seedIdx++) * Math.PI * 2);
    }

    // ── 4. Macizos Naturales y Bosquecillos de Arbustos 3D (Cero ramas aisladas) ──
    // Se generan 220 macizos orgánicos densos (3 a 5 arbustos contiguos por grupo)
    const SHRUB_CLUSTERS = 220;
    for (let sc = 0; sc < SHRUB_CLUSTERS; sc++) {
      const cx = -340 + seeded(seedIdx++) * 820;
      const cz = -180 + seeded(seedIdx++) * 360;
      const cy = this.getTerrainY(cx, cz);
      if (cy < -0.3 || cy > 35.0 || !canSpawnAt(cx, cz, 1.8)) continue;

      const sectorKey = getSectorAt(cx, cz, cy);
      const palette = SECTOR_PALETTES[sectorKey];
      const count = 3 + Math.floor(seeded(seedIdx++) * 3); // 3 a 5 arbustos por macizo

      for (let k = 0; k < count; k++) {
        const offAngle = seeded(seedIdx++) * Math.PI * 2;
        const offDist = 0.4 + seeded(seedIdx++) * 1.6;
        const bx = cx + Math.cos(offAngle) * offDist;
        const bz = cz + Math.sin(offAngle) * offDist;
        const by = this.getTerrainY(bx, bz);
        if (by < -0.3 || !canSpawnAt(bx, bz, 0.6)) continue;

        const floraModel = palette.understory[Math.floor(seeded(seedIdx++) * palette.understory.length)];
        const height = THREE.MathUtils.lerp(0.70, 1.35, seeded(seedIdx++));
        const rotY = seeded(seedIdx++) * Math.PI * 2;
        addInstance(floraModel, height, [bx, by, bz], rotY);
      }
    }

    // ── 5. Fauna Silvestre Itinerante en el Entorno Circundante ──────────────
    // Ubicados en claros naturales y praderas abiertas (CERO colisiones con escenarios ni caminos)
    this.animalSpawns = [
      // ════ Sector 1: Praderas y Valle de Robles (Oeste) ════
      { type: 'deer', pos: [-315, 85], height: 1.25 },     // Ciervo pastando en la pradera oeste
      { type: 'deer', pos: [-290, 105], height: 1.15 },    // Segundo ciervo
      { type: 'horse', pos: [-260, 20], height: 1.45 },    // Caballo salvaje en el prado
      { type: 'horse', pos: [-240, 15], height: 1.35 },    // Segundo caballo
      { type: 'fox', pos: [-210, 105], height: 0.60 },     // Zorro en el linde
      { type: 'deer', pos: [-175, 65], height: 1.20 },     // Ciervo en el claro
      { type: 'fox', pos: [-145, -75], height: 0.55 },     // Zorro explorador

      // ════ Sector 2: Ribera Fluvial y Cuenca del Lago (Centro-Norte) ════
      { type: 'alpaca', pos: [-115, -45], height: 1.10 },  // Alpaca en la ribera
      { type: 'alpaca', pos: [-95, -55], height: 1.05 },   // Segunda alpaca
      { type: 'deer', pos: [-40, -45], height: 1.20 },     // Ciervo bebiendo
      { type: 'deer', pos: [15, -40], height: 1.15 },      // Ciervo en la vega
      { type: 'horse', pos: [65, -35], height: 1.40 },     // Caballo en el pastizal fluvial
      { type: 'horse', pos: [90, -45], height: 1.35 },     // Segundo caballo
      { type: 'crow', pos: [120, -145], height: 0.38 },    // Cuervo sobre rocas del lago
      { type: 'crow', pos: [140, -125], height: 0.38 },    // Segundo cuervo

      // ════ Sector 3: Gran Taiga de Coníferas (Centro-Sur) ════
      { type: 'wolf', pos: [25, 95], height: 1.05 },       // Lobo en claro de pinos
      { type: 'wolf', pos: [60, 115], height: 0.95 },      // Segundo lobo
      { type: 'stag', pos: [100, 50], height: 1.35 },      // Ciervo solemne en la taiga
      { type: 'fox', pos: [150, -75], height: 0.60 },      // Zorro en las colinas
      { type: 'deer', pos: [210, -90], height: 1.20 },     // Ciervo en el bosque
      { type: 'wolf', pos: [180, 85], height: 1.00 },      // Lobo vigía
      { type: 'fox', pos: [250, -50], height: 0.55 },      // Zorro en pradera de pinos
      { type: 'stag', pos: [280, 20], height: 1.30 },      // Ciervo en claro este

      // ════ Sector 4: Tierras Altas de Montaña (Este) ════
      { type: 'stag', pos: [340, 30], height: 1.40 },      // Gran íbice de montaña
      { type: 'stag', pos: [380, -35], height: 1.35 },     // Íbice en cornisa rocosa
      { type: 'wolf', pos: [410, -25], height: 1.05 },     // Lobo de cumbre
      { type: 'alpaca', pos: [440, 25], height: 1.10 },    // Alpaca de altura
      { type: 'wolf', pos: [465, -60], height: 1.00 },     // Lobo en risco
      { type: 'crow', pos: [505, 80], height: 0.38 },      // Cuervo sobre risco del bastión
      { type: 'crow', pos: [525, -30], height: 0.38 }      // Cuervo en cumbre este
    ];

    // ── 6. Bandadas de Aves en Vuelo Panorámico ─────────────────────────────
    this.birdSpawns = [
      { type: 'stork', height: 36, radius: 110, speed: 0.08, phase: 0 },
      { type: 'stork', height: 44, radius: 150, speed: 0.06, phase: 2.1 },
      { type: 'parrot', height: 28, radius: 85, speed: 0.12, phase: 4.2 },
      { type: 'stork', height: 50, radius: 135, speed: 0.07, phase: 1.2 },
      { type: 'parrot', height: 32, radius: 100, speed: 0.11, phase: 3.5 },
      { type: 'stork', height: 40, radius: 120, speed: 0.09, phase: 5.0 }
    ];
  }

  async initInstancedWorld(onProgress = () => {}) {
    // Pre-load all unique models in parallel for ultra-fast startup
    const allPaths = new Set();
    for (let c = 0; c < this.chunkCols; c++) {
      for (let r = 0; r < this.chunkRows; r++) {
        for (const path of this.chunks[c][r].buckets.keys()) {
          allPaths.add(path);
        }
      }
    }
    this.animalSpawns.forEach(s => allPaths.add(ASSETS.animals[s.type] || ASSETS.animals.deer));

    await Promise.allSettled(Array.from(allPaths).map(p => loadModel(p)));

    let totalBuckets = 0, loaded = 0;
    for (let c = 0; c < this.chunkCols; c++) {
      for (let r = 0; r < this.chunkRows; r++) {
        totalBuckets += this.chunks[c][r].buckets.size;
      }
    }

    for (let c = 0; c < this.chunkCols; c++) {
      for (let r = 0; r < this.chunkRows; r++) {
        const chunk = this.chunks[c][r];
        for (const [path, list] of chunk.buckets.entries()) {
          const instMesh = await createInstancedGroup(path, list);
          if (instMesh) {
            chunk.group.add(instMesh);
          }
          loaded++;
          if (totalBuckets > 0) {
            onProgress(0.85 + (loaded / totalBuckets) * 0.12, `Generando chunks de terreno (${loaded}/${totalBuckets})...`);
          }
        }
        this.scene.add(chunk.group);
      }
    }

    // Spawn Wildlife
    for (const s of this.animalSpawns) {
      const y = this.getTerrainY(s.pos[0], s.pos[1]);
      const path = ASSETS.animals[s.type] || ASSETS.animals.deer;
      const inst = await instantiate(path, s.height, true);
      if (!inst) continue;

      inst.position.set(s.pos[0], y, s.pos[1]);
      inst.rotation.y = Math.random() * Math.PI * 2;
      inst.userData.baseY = y;
      inst.userData.baseRotY = inst.rotation.y;
      inst.userData.animPhase = Math.random() * 10;
      this.scene.add(inst);
      this.roamingAnimals = this.roamingAnimals || [];
      this.roamingAnimals.push(inst);

      if (inst.userData.animations?.length) {
        const animTarget = inst.children[0] || inst;
        const mixer = new THREE.AnimationMixer(animTarget);
        const safeClip = inst.userData.animations.find(a => {
          const name = a.name.toLowerCase();
          return (name.includes('idle') || name.includes('eating') || name.includes('walk')) && !name.includes('death') && !name.includes('attack');
        }) || inst.userData.animations[0];

        if (safeClip && !safeClip.name.toLowerCase().includes('death')) {
          mixer.clipAction(safeClip).play();
          this.mixers.push(mixer);
        }
      }
    }

    // Spawn Sky Birds
    const birdMat = new THREE.MeshStandardMaterial({ color: 0xf0f6fa, roughness: 0.7, metalness: 0.0 });
    for (const b of this.birdSpawns) {
      const birdHolder = new THREE.Group();
      
      const body = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.75, 4), birdMat);
      body.rotation.x = Math.PI / 2;
      birdHolder.add(body);

      const wingL = new THREE.Group();
      const wingMeshL = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.03, 0.26), birdMat);
      wingMeshL.position.x = -0.28;
      wingL.add(wingMeshL);
      birdHolder.add(wingL);

      const wingR = new THREE.Group();
      const wingMeshR = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.03, 0.26), birdMat);
      wingMeshR.position.x = 0.28;
      wingR.add(wingMeshR);
      birdHolder.add(wingR);

      birdHolder.userData = { ...b, wingL, wingR };
      this.scene.add(birdHolder);
      this.birds.push(birdHolder);
    }
  }

  tickStream() {
    // Zero CPU streaming runtime cost: All 24 Chunks are pre-instanced on GPU!
  }

  update(dt, elapsed, cameraPos = null) {
    for (const mixer of this.mixers) {
      mixer.update(dt);
    }

    for (const a of (this.roamingAnimals || [])) {
      const ph = a.userData.animPhase;
      // Gentle natural breathing / subtle idle sway in open meadow
      a.position.y = a.userData.baseY + Math.sin(elapsed * 1.8 + ph) * 0.022;
      a.rotation.y = a.userData.baseRotY + Math.sin(elapsed * 0.5 + ph) * 0.08;
    }

    for (const b of this.birds) {
      const u = b.userData;
      const angle = elapsed * u.speed + u.phase;
      b.position.set(Math.cos(angle) * u.radius, u.height + Math.sin(elapsed * 0.8 + u.phase) * 1.5, Math.sin(angle) * u.radius);
      b.rotation.y = -angle - Math.PI / 2;
      b.rotation.z = -0.15;
      if (u.wingL && u.wingR) {
        const flap = Math.sin(elapsed * 9.0 + u.phase) * 0.45;
        u.wingL.rotation.z = flap;
        u.wingR.rotation.z = -flap;
      }
    }

    // Minecraft-Style Distance Culling (Adaptive to camera altitude to prevent pop-in)
    this.cullFrame = (this.cullFrame || 0) + 1;
    if (cameraPos && this.cullFrame % 8 === 0) {
      const maxDist = cameraPos.y > 35 ? 560.0 : 420.0;
      for (let c = 0; c < this.chunkCols; c++) {
        for (let r = 0; r < this.chunkRows; r++) {
          const chunk = this.chunks[c][r];
          const dist = Math.hypot(cameraPos.x - chunk.cx, cameraPos.z - chunk.cz);
          chunk.group.visible = (dist < maxDist);
        }
      }
    }
  }
}

// ── Install World & Checkpoints ──────────────────────────────────────────────

export async function installRealisticWorld({ scene, missions, getTerrainY, trailPoints = [], onProgress = () => {} }) {
  onProgress(0.50, 'Construyendo el reino...');

  // Build all 9 checkpoint structures in parallel for maximum speed
  const structurePromises = missions.map(async (q, i) => {
    try {
      const struct = await buildCheckpointStructure(q, getTerrainY);
      // Group at y=0 — every child already has its own correct world Y from getTerrainY
      struct.position.set(q.x, 0, q.z);
      struct.userData = { ...struct.userData, mission: q, phase: Math.random() * 6 };
      scene.add(struct);
      q.structGroup = struct;
      onProgress(0.50 + ((i + 1) / missions.length) * 0.35, `Cargando estación: ${q.name}`);
      return struct;
    } catch (e) {
      console.warn('Error cargando estructura para estación:', q.name, e);
      return null;
    }
  });

  const structures = await Promise.allSettled(structurePromises);
  const streamer = new ProgressiveWorldStreamer(scene, missions, getTerrainY, trailPoints);
  structures.forEach(res => {
    if (res.status === 'fulfilled' && res.value?.userData?.mixers) {
      streamer.mixers.push(...res.value.userData.mixers);
    }
  });
  await Promise.all([
    streamer.initInstancedWorld(onProgress),
    loadCharacterModel()
  ]);

  onProgress(1.0, '¡Megamundo 3D colosal y naturaleza exuberante listos!');
  return streamer;
}

// ── Humanoid Adventurer Character with Realistic Proportions (1.85m height) ───

// ── 8 Distinct Adventure Character Archetypes & Presets (Kenney Protagonists) ─
export const AVATAR_PRESETS = [
  {
    id: 'ranger',
    name: 'Explorador Ágil',
    skinKey: 'skaterMale',
    tintHex: 0xffffff,
    iconSvg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>`,
    role: 'Agilidad & Campo',
    desc: 'Dinámico, veloz y siempre listo para recorrer nuevas rutas.',
    primaryColor: '#e67e22'
  },
  {
    id: 'valkyrie',
    name: 'Vanguardia Urbana',
    skinKey: 'skaterFemale',
    tintHex: 0xffffff,
    iconSvg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
    role: 'Energía & Impulso',
    desc: 'Determinada y creativa, lidera la iniciativa en cada estación.',
    primaryColor: '#cc092f'
  },
  {
    id: 'tinkerer',
    name: 'Cyborg Táctico',
    skinKey: 'cyborgFemale',
    tintHex: 0xffffff,
    iconSvg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3m-3.2-6.8-2.1 2.1M7.3 16.7l-2.1 2.1m0-13.6 2.1 2.1m9.4 9.4 2.1 2.1"/></svg>`,
    role: 'Tecnología & Precisión',
    desc: 'Equipada con visión analítica para dominar sistemas y procesos.',
    primaryColor: '#00b4d8'
  },
  {
    id: 'herald',
    name: 'Estratega Ejecutivo',
    skinKey: 'criminalMale',
    tintHex: 0xffffff,
    iconSvg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/></svg>`,
    role: 'Liderazgo & Visión',
    desc: 'Elegante y resolutivo, enfocado en metas y acuerdos clave.',
    primaryColor: '#10b981'
  },
  {
    id: 'paladin',
    name: 'Centinela Bradesco',
    skinKey: 'criminalMale',
    tintHex: 0xffd6dc,
    iconSvg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    role: 'Ética & Protección',
    desc: 'Defensor de los valores institucionales y la seguridad integral.',
    primaryColor: '#e11d48'
  },
  {
    id: 'mage',
    name: 'Tecno-Analista Arcana',
    skinKey: 'cyborgFemale',
    tintHex: 0xe9d5ff,
    iconSvg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72Z"/></svg>`,
    role: 'Innovación & Datos',
    desc: 'Transforma información compleja en decisiones claras.',
    primaryColor: '#8b5cf6'
  },
  {
    id: 'alchemist',
    name: 'Mentora de Cultura',
    skinKey: 'skaterFemale',
    tintHex: 0xd1fae5,
    iconSvg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2v7.31a2 2 0 0 1-.37 1.17l-4.26 6.39A2 2 0 0 0 7 20h10a2 2 0 0 0 1.63-3.13l-4.26-6.39A2 2 0 0 1 14 9.31V2"/><path d="M8.5 2h7"/></svg>`,
    role: 'Cultura & Servicio',
    desc: 'Conecta equipos y eleva la experiencia de cada cliente.',
    primaryColor: '#14b8a6'
  },
  {
    id: 'rogue',
    name: 'Mensajero Estelar',
    skinKey: 'skaterMale',
    tintHex: 0xdbeafe,
    iconSvg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13"/><path d="m22 2-7 20-4-9-9-4 20-7z"/></svg>`,
    role: 'Comunicación & Ritmo',
    desc: 'Ágil para colaborar y llevar mensajes a todo el ecosistema.',
    primaryColor: '#3b82f6'
  }
];

// ── Animated 3D Character Builder (Kenney Protagonists FBX Library) ──────────

export function createHeroModel(avatarId = 'ranger', playerColorHex = '#cc092f', options = {}) {
  const normId = (avatarId === 'warrior' ? 'valkyrie' : avatarId) || 'ranger';
  const preset = AVATAR_PRESETS.find(p => p.id === normId) || AVATAR_PRESETS[0];
  const targetHeight = options.targetHeight || 1.12;
  const initialAnim = options.initialAnim || 'idle';

  const group = new THREE.Group();
  group.name = `HeroModel_${normId}`;

  group.userData = {
    avatarId: normId,
    preset,
    mixer: null,
    actions: {},
    currentAnim: initialAnim,
    playAnimation(animName = 'idle') {
      const targetKey = this.actions[animName] ? animName : 'idle';
      if (this.currentAnim === targetKey && this.actions[targetKey]?.isRunning()) return;
      const prev = this.actions[this.currentAnim];
      const next = this.actions[targetKey];
      if (!next) return;
      next.reset();
      next.setEffectiveTimeScale(1);
      next.setEffectiveWeight(1);
      next.play();
      if (prev && prev !== next) {
        prev.crossFadeTo(next, 0.22, true);
      }
      this.currentAnim = targetKey;
    },
    update(dt = 0.016) {
      if (this.mixer) {
        const safeDt = Math.min(Math.max(dt, 0), 0.08);
        this.mixer.update(safeDt);
      }
    }
  };

  function attachCharacterRig() {
    if (!cachedCharacterFBX) return;

    const rig = cloneSkeleton(cachedCharacterFBX);
    const tex = skinTextureMap.get(preset.skinKey) || skinTextureMap.values().next().value || null;
    const tint = new THREE.Color(preset.tintHex !== undefined ? preset.tintHex : 0xffffff);

    rig.traverse(child => {
      if (child.isMesh || child.isSkinnedMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.frustumCulled = false;
        child.material = new THREE.MeshStandardMaterial({
          map: tex || null,
          color: tint,
          roughness: 0.68,
          metalness: 0.06
        });
      }
    });

    // Normalize scale & align feet cleanly to y = 0
    rig.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(rig);
    const rawH = Math.max(0.01, box.max.y - box.min.y);
    const scale = targetHeight / rawH;
    rig.scale.setScalar(scale);
    rig.updateMatrixWorld(true);
    const scaledBox = new THREE.Box3().setFromObject(rig);
    rig.position.y -= scaledBox.min.y;

    group.add(rig);

    const mixer = new THREE.AnimationMixer(rig);
    const actions = {};
    ['idle', 'run', 'jump'].forEach(key => {
      const clip = cachedCharacterAnims[key];
      if (clip) {
        actions[key] = mixer.clipAction(clip);
      }
    });

    group.userData.mixer = mixer;
    group.userData.actions = actions;
    group.userData.rig = rig;

    const startKey = actions[group.userData.currentAnim] ? group.userData.currentAnim : 'idle';
    if (actions[startKey]) {
      actions[startKey].reset().play();
      group.userData.currentAnim = startKey;
    }
  }

  if (cachedCharacterFBX) {
    attachCharacterRig();
  } else {
    loadCharacterModel().then(() => attachCharacterRig());
  }

  return group;
}

// ── In-Map Humanoid Character with Collision-Free Courtyard Arc Placement ─────

export function createHumanoidCharacter(player, index, mission, getTerrainY, targetMission = null, startMission = null) {
  const root = new THREE.Group();
  root.name = `Player_${player.name}`;

  const teamColor = new THREE.Color(player.color || '#cc092f');

  // 1. Ornate Stone Plinth Base with Glowing Team Rune Ring
  const plinthMat = new THREE.MeshStandardMaterial({ color: 0x7a7469, roughness: 0.90 });
  const ringMat = new THREE.MeshStandardMaterial({ color: teamColor, emissive: teamColor, emissiveIntensity: 2.8, roughness: 0.25 });

  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.05, 16), plinthMat);
  plinth.position.y = 0.025;
  plinth.receiveShadow = true;
  root.add(plinth);

  const runeRing = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.014, 8, 20), ringMat);
  runeRing.rotation.x = Math.PI / 2;
  runeRing.position.y = 0.052;
  root.add(runeRing);

  // 2. Animated 3D Character from Kenney Protagonists Library
  const heroModel = createHeroModel(player.avatarId || 'ranger', player.color || '#cc092f', {
    targetHeight: 1.04,
    initialAnim: 'idle'
  });
  heroModel.position.y = 0.05;
  root.add(heroModel);

  // 3. Overhead Floating Team Crystal / Badge in Team Color
  const gemMat = new THREE.MeshStandardMaterial({
    color: teamColor,
    emissive: teamColor,
    emissiveIntensity: 2.2,
    roughness: 0.2
  });
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.075, 0), gemMat);
  gem.position.y = 1.28;
  root.add(gem);

  // 4. Station Courtyard Slot Placement (Proportional & 100% Collision-Free Matrix)
  function calcStationSlot(m, idx) {
    const totalInGroup = Math.max(1, (player.totalInStation || 4));
    const isCastle = m.type === 'castle';
    const isCamp = m.type === 'camp';
    const maxPerRow = 5;
    const row = Math.floor(idx / maxPerRow);
    const col = idx % maxPerRow;
    const inThisRow = row === 0 ? Math.min(totalInGroup, maxPerRow) : Math.max(1, totalInGroup - maxPerRow);
    const spacingX = isCastle ? 1.35 : 0.95;
    const offsetX = (col - (inThisRow - 1) / 2) * spacingX;
    const baseZ = isCastle ? 4.0 : (isCamp ? 3.4 : 2.5);
    const offsetZ = baseZ + row * (isCastle ? 1.3 : 1.05);

    const posX = m.x + offsetX;
    const posZ = m.z + offsetZ;
    const posY = getTerrainY(posX, posZ);

    const rotY = Math.atan2(-offsetX, -offsetZ);

    return {
      pos: new THREE.Vector3(posX, posY, posZ),
      rotY
    };
  }

  const target = targetMission || mission;
  const slot = calcStationSlot(target, index);

  root.position.copy(slot.pos);
  root.rotation.y = slot.rotY;

  root.userData = {
    player,
    phase: Math.random() * 6,
    heroModel,
    runeRing,
    gem,
    endPos: slot.pos.clone(),
    endRot: slot.rotY,
    walkProgress: 1
  };

  return root;
}
