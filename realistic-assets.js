import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';

const loader = new GLTFLoader();
const fbxLoader = new FBXLoader();
const modelCache = new Map();

let cachedCharacterFBX = null;
let cachedIdleClip = null;
const skinTextures = [];

export async function loadCharacterModel() {
  if (cachedCharacterFBX && cachedIdleClip) return { model: cachedCharacterFBX, clip: cachedIdleClip };

  const [fbx, animFbx] = await Promise.all([
    new Promise(resolve => {
      fbxLoader.load('./assets/library/kenney_animated_characters_protagonists/Model/characterMedium.fbx', resolve, undefined, err => {
        console.warn('Error cargando characterMedium.fbx:', err);
        resolve(null);
      });
    }),
    new Promise(resolve => {
      fbxLoader.load('./assets/library/kenney_animated_characters_protagonists/Animations/idle.fbx', resolve, undefined, err => {
        console.warn('Error cargando idle.fbx:', err);
        resolve(null);
      });
    })
  ]);

  if (fbx) cachedCharacterFBX = fbx;
  if (animFbx && animFbx.animations && animFbx.animations.length > 0) {
    cachedIdleClip = animFbx.animations[0];
  }

  const textureLoader = new THREE.TextureLoader();
  const skinPaths = [
    './assets/library/kenney_animated_characters_protagonists/Skins/skaterMaleA.png',
    './assets/library/kenney_animated_characters_protagonists/Skins/skaterFemaleA.png',
    './assets/library/kenney_animated_characters_protagonists/Skins/cyborgFemaleA.png',
    './assets/library/kenney_animated_characters_protagonists/Skins/criminalMaleA.png'
  ];
  skinPaths.forEach(p => {
    try {
      const tex = textureLoader.load(p);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.flipY = false;
      skinTextures.push(tex);
    } catch {}
  });

  return { model: cachedCharacterFBX, clip: cachedIdleClip };
}

export function loadModel(path) {
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
        o.material.roughness = 0.85;
        o.material.metalness = 0.0;
        o.material.envMapIntensity = 0.0;
        o.material.needsUpdate = true;
      }
    }
  });
  return root;
}

// Rock-solid grounded wrapper: guarantees bottom touches y = 0 and is centered in X/Z
async function instantiate(path, targetHeight = 3.0, castShadow = true) {
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
    './assets/stylized/nature/Tree_1_A_Color1.gltf',
    './assets/stylized/nature/Tree_1_B_Color1.gltf',
    './assets/stylized/nature/Tree_1_C_Color1.gltf',
    './assets/stylized/nature/Tree_2_A_Color1.gltf',
    './assets/stylized/nature/Tree_2_B_Color1.gltf',
    './assets/stylized/nature/Tree_2_C_Color1.gltf',
    './assets/stylized/nature/Tree_3_A_Color1.gltf',
    './assets/stylized/nature/Tree_3_B_Color1.gltf',
    './assets/stylized/nature/Tree_3_C_Color1.gltf',
    './assets/stylized/nature/Tree_4_A_Color1.gltf',
    './assets/stylized/nature/Tree_5_A_Color1.gltf',
    './assets/stylized/nature/Tree_6_A_Color1.gltf',
    './assets/stylized/nature/Tree_7_A_Color1.gltf'
  ],
  bushes: [
    './assets/stylized/nature/Bush_1_A_Color1.gltf',
    './assets/stylized/nature/Bush_1_E_Color1.gltf',
    './assets/stylized/nature/Bush_2_A_Color1.gltf',
    './assets/stylized/nature/Bush_3_A_Color1.gltf'
  ],
  rocks: [
    './assets/stylized/nature/Rock_1_A_Color1.gltf',
    './assets/stylized/nature/Rock_1_E_Color1.gltf',
    './assets/stylized/nature/Rock_2_A_Color1.gltf',
    './assets/stylized/nature/Rock_3_A_Color1.gltf',
    './assets/stylized/nature/Rock_5_A_Color1.gltf'
  ],
  props: {
    chest: './assets/stylized/props/chest_gold.gltf',
    stackedBoxes: './assets/stylized/props/box_stacked.gltf',
    largeBox: './assets/stylized/props/box_large.gltf',
    barrel: './assets/stylized/props/barrel_large.gltf',
    signingTable: './assets/stylized/props/table_long_tablecloth_decorated_A.gltf',
    banner: './assets/stylized/props/banner_shield_blue.gltf'
  },
  animals: {
    deer: './assets/stylized/animals/Deer.gltf',
    stag: './assets/stylized/animals/Stag.gltf',
    fox: './assets/stylized/animals/Fox.gltf',
    horse: './assets/stylized/animals/Horse.gltf',
    alpaca: './assets/stylized/animals/Alpaca.gltf',
    wolf: './assets/stylized/animals/Wolf.gltf'
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
    inst.position.set(pos[0], gy, pos[2]);
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
      // ESTACIÓN 0: Campamento Base & Bienvenida (Gran Casa de la Expedición / Guildhall)
      // Edificio cívico noble y majestuoso (Townhall) en lugar de carpas
      await spawn(ASSETS.buildings.townhall, 5.2, [0, 0, -3.8], 0);

      // Portal de entrada con estandartes heráldicos dobles
      await spawn(ASSETS.props.banner, 3.2, [-3.2, 0, 0.2], 0.2);
      await spawn(ASSETS.props.banner, 3.2, [3.2, 0, 0.2], -0.2);

      // Terraza adoquinada de bienvenida: Mesa de cartografía y mapa del reino
      await spawn(ASSETS.props.signingTable, 1.05, [0, 0, -0.6], 0);

      // Pertrechos y suministros de expedición
      await spawn(ASSETS.props.chest, 0.85, [2.0, 0, -0.8], 0.3);
      await spawn(ASSETS.props.stackedBoxes, 1.2, [-2.0, 0, -0.8], -0.3);
      await spawn(ASSETS.props.barrel, 1.0, [3.4, 0, -1.8], -0.4);
      await spawn(ASSETS.props.barrel, 1.0, [-3.4, 0, -1.8], 0.4);

      // Caballos de viaje para los exploradores
      await spawn(ASSETS.animals.horse, 1.35, [-6.2, 0, -1.2], 0.7);
      await spawn(ASSETS.animals.stag, 1.30, [6.2, 0, -1.2], -0.7);

      // Entorno arbolado noble del cuartel general
      await spawn(ASSETS.trees[0], 6.8, [-8.0, 0, -4.5], 0.3);
      await spawn(ASSETS.trees[1], 6.5, [8.0, 0, -4.5], -0.3);
      await spawn(ASSETS.trees[2], 5.8, [-8.8, 0, 2.5], 0.8);
      await spawn(ASSETS.trees[3], 5.8, [8.8, 0, 2.5], -0.8);
      await spawn(ASSETS.bushes[0], 1.4, [-5.5, 0, 1.0], 0.4);
      await spawn(ASSETS.bushes[1], 1.4, [5.5, 0, 1.0], -0.4);

      // Guía rúnica flotante de bienvenida azul zafiro
      const guideGem = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.32, 0),
        new THREE.MeshStandardMaterial({ color: 0x3498db, emissive: 0x2980b9, emissiveIntensity: 2.5, roughness: 0.22 })
      );
      const gemY = getTerrainY(mission.x, mission.z);
      guideGem.position.set(0, gemY + 2.2, -0.6);
      g.add(guideGem);
      g.userData.crystal = guideGem;
      break;
    }

    case 'camp': {
      // MISIÓN 1: Arsenal y Equipos
      await spawn(ASSETS.buildings.tent, 3.2, [-2.8, 0, -1.8], 0.6);
      await spawn(ASSETS.buildings.tent, 3.2, [2.8, 0, -1.8], -0.6);
      await spawn(ASSETS.buildings.tent, 2.8, [0, 0, -3.4], Math.PI);
      await spawn(ASSETS.props.chest, 0.85, [0, 0, -0.1], 0);
      await spawn(ASSETS.props.stackedBoxes, 1.3, [1.8, 0, -0.3], -0.4);
      await spawn(ASSETS.props.barrel, 1.1, [-1.8, 0, -0.3], 0.4);
      await spawn(ASSETS.props.largeBox, 0.95, [3.2, 0, 0.5], 0.3);
      await spawn(ASSETS.props.barrel, 0.95, [-3.2, 0, 0.5], -0.3);

      const campfire = createCampfire();
      campfire.position.set(-0.2, getTerrainY(mission.x - 0.2, mission.z + 1.6), 1.6);
      g.add(campfire);

      await spawn(ASSETS.trees[0], 6.5, [-7.2, 0, -4.5], 0.4);
      await spawn(ASSETS.trees[1], 5.8, [7.2, 0, -4.5], -0.4);
      await spawn(ASSETS.trees[2], 7.0, [0, 0, -6.8], Math.PI);
      await spawn(ASSETS.trees[3], 5.2, [-8.5, 0, 1.8], 1.2);
      await spawn(ASSETS.trees[4], 5.2, [8.5, 0, 1.8], -1.2);
      await spawn(ASSETS.bushes[0], 1.4, [-5.8, 0, -2.8], 0.4);
      await spawn(ASSETS.bushes[1], 1.4, [5.8, 0, -2.8], -0.4);
      await spawn(ASSETS.bushes[2], 1.2, [-4.5, 0, 3.5], 1.1);
      await spawn(ASSETS.bushes[3], 1.2, [4.5, 0, 3.5], -1.1);
      await spawn(ASSETS.rocks[0], 1.3, [-6.8, 0, 3.2], 0.5);
      await spawn(ASSETS.rocks[1], 1.3, [6.8, 0, 3.2], -0.5);
      await spawn(ASSETS.animals.deer, 0.95, [-9.2, 0, -1.2], 0.8);
      await spawn(ASSETS.animals.horse, 1.25, [8.8, 0, -0.6], -0.8);

      const crystal = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.28, 0),
        new THREE.MeshStandardMaterial({ color: 0x48e6d2, emissive: 0x16b0a2, emissiveIntensity: 2.2, roughness: 0.3 })
      );
      const crystalY = getTerrainY(mission.x, mission.z);
      crystal.position.set(0, crystalY + 1.6, -0.1);
      g.add(crystal);
      g.userData.crystal = crystal;
      break;
    }

    case 'sanctuary':
    case 'monument': {
      // MISIÓN 2: Firma de Contrato y Beneficios
      await spawn(ASSETS.buildings.shrine, 5.8, [0, 0, -2.8], 0);
      await spawn(ASSETS.props.signingTable, 1.05, [0, 0, 0], 0);
      await spawn(ASSETS.props.banner, 2.8, [-2.2, 0, 0], 0.2);
      await spawn(ASSETS.props.banner, 2.8, [2.2, 0, 0], -0.2);
      await spawn(ASSETS.props.chest, 0.8, [-1.8, 0, 1.2], 0.4);
      await spawn(ASSETS.props.barrel, 1.0, [1.8, 0, 1.2], -0.4);
      await spawn(ASSETS.trees[2], 7.2, [-7.5, 0, -4.0], 0.3);
      await spawn(ASSETS.trees[5], 6.8, [7.5, 0, -4.0], -0.3);
      await spawn(ASSETS.trees[0], 6.5, [0, 0, -6.5], 0);
      await spawn(ASSETS.animals.stag, 1.1, [-8.5, 0, 0], 0.6);
      await spawn(ASSETS.bushes[2], 1.3, [-4.8, 0, -2.5], 0.2);
      await spawn(ASSETS.bushes[3], 1.3, [4.8, 0, -2.5], -0.2);
      await spawn(ASSETS.rocks[2], 1.4, [-5.5, 0, 1.5], 0.5);
      await spawn(ASSETS.rocks[3], 1.4, [5.5, 0, 1.5], -0.5);

      const covenantSeal = new THREE.Mesh(
        new THREE.TorusGeometry(0.35, 0.07, 12, 32),
        new THREE.MeshStandardMaterial({ color: 0xffd369, emissive: 0xd49b29, emissiveIntensity: 2.5, roughness: 0.3 })
      );
      const sealY = getTerrainY(mission.x, mission.z);
      covenantSeal.position.set(0, sealY + 1.8, 0);
      g.add(covenantSeal);
      g.userData.covenantSeal = covenantSeal;
      break;
    }

    case 'garden': {
      // MISIÓN 3: Humand y Comedor
      await spawn(ASSETS.buildings.tavern, 6.2, [-3.8, 0, -2.8], 0.3);
      await spawn(ASSETS.buildings.market, 3.8, [3.6, 0, -2.2], -0.3);
      await spawn(ASSETS.props.signingTable, 1.05, [-1.0, 0, 0], 0);
      await spawn(ASSETS.props.stackedBoxes, 1.3, [2.2, 0, 0.2], 0.4);
      await spawn(ASSETS.props.barrel, 1.1, [1.3, 0, 0.4], -0.2);
      await spawn(ASSETS.props.barrel, 0.95, [-2.5, 0, 1.2], 0.6);
      await spawn(ASSETS.trees[3], 6.2, [-8.0, 0, -4.5], 0.5);
      await spawn(ASSETS.trees[4], 5.8, [8.0, 0, -4.5], -0.5);
      await spawn(ASSETS.animals.horse, 1.3, [8.5, 0, 1.0], -0.7);
      await spawn(ASSETS.bushes[1], 1.4, [-5.8, 0, -1.0], 0.8);
      await spawn(ASSETS.bushes[0], 1.3, [5.5, 0, -1.0], -0.8);
      await spawn(ASSETS.rocks[1], 1.2, [-4.8, 0, 1.8], 0.3);
      await spawn(ASSETS.rocks[0], 1.2, [4.8, 0, 1.8], -0.3);

      const humandTerminal = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.6, 0.08),
        new THREE.MeshStandardMaterial({ color: 0x2ee59d, emissive: 0x17a06a, emissiveIntensity: 2.5, roughness: 0.3 })
      );
      const termY = getTerrainY(mission.x + 1.1, mission.z - 0.1);
      humandTerminal.position.set(1.1, termY + 1.7, -0.1);
      g.add(humandTerminal);
      g.userData.humandTerminal = humandTerminal;
      break;
    }

    case 'observatory': {
      await spawn(ASSETS.buildings.watchtower, 8.5, [0, 0, -2.5], 0);
      await spawn(ASSETS.buildings.home, 4.5, [-3.8, 0, -0.5], Math.PI / 4);
      await spawn(ASSETS.trees[6], 7.5, [-7.2, 0, -4.0], 0.3);
      await spawn(ASSETS.trees[7], 7.0, [7.2, 0, -4.0], -0.3);
      await spawn(ASSETS.animals.fox, 0.45, [-7.5, 0, 1.5], 0.8);
      await spawn(ASSETS.bushes[0], 1.3, [3.8, 0, -1.0], 0.4);
      await spawn(ASSETS.rocks[0], 1.3, [-4.5, 0, 1.5], 0.2);
      break;
    }

    case 'plaza': {
      await spawn(ASSETS.buildings.townhall, 8.0, [0, 0, -3.8], 0);
      await spawn(ASSETS.buildings.tavern, 5.8, [-4.5, 0, 0], Math.PI / 3);
      await spawn(ASSETS.buildings.home, 4.8, [4.5, 0, 0], -Math.PI / 3);
      await spawn(ASSETS.props.banner, 2.8, [-2.5, 0, 2.0], 0.4);
      await spawn(ASSETS.props.banner, 2.8, [2.5, 0, 2.0], -0.4);
      await spawn(ASSETS.trees[1], 6.5, [-8.5, 0, -4.5], 0.2);
      await spawn(ASSETS.trees[2], 6.5, [8.5, 0, -4.5], -0.2);
      break;
    }

    case 'harbor': {
      await spawn(ASSETS.buildings.docks, 3.5, [0, 0, -1.8], 0);
      await spawn(ASSETS.buildings.watermill, 6.5, [4.5, 0, 1.0], -Math.PI / 6);
      await spawn(ASSETS.buildings.shipyard, 6.0, [-4.5, 0, 1.0], Math.PI / 6);
      await spawn(ASSETS.props.stackedBoxes, 1.3, [-1.8, 0, 0.5], 0.4);
      await spawn(ASSETS.props.barrel, 1.1, [1.8, 0, 0.5], -0.4);
      await spawn(ASSETS.trees[5], 6.8, [-8.0, 0, -3.5], 0.3);
      await spawn(ASSETS.trees[0], 6.8, [8.0, 0, -3.5], -0.3);
      break;
    }

    case 'archive': {
      await spawn(ASSETS.buildings.church, 9.0, [0, 0, -3.0], 0);
      await spawn(ASSETS.buildings.archery, 4.8, [4.0, 0, 0], -0.3);
      await spawn(ASSETS.trees[8], 7.5, [-7.5, 0, -4.5], 0.3);
      await spawn(ASSETS.trees[11], 7.5, [7.5, 0, -4.5], -0.3);
      await spawn(ASSETS.bushes[2], 1.4, [-4.5, 0, -1.0], 0.3);
      await spawn(ASSETS.rocks[3], 1.4, [4.5, 0, 1.5], -0.3);
      break;
    }

    case 'forge': {
      await spawn(ASSETS.buildings.blacksmith, 5.5, [-4.0, 0, -2.0], 0.2);
      await spawn(ASSETS.buildings.workshop, 5.5, [4.0, 0, -2.0], -0.2);
      await spawn(ASSETS.buildings.windmill, 8.5, [0, 0, 4.0], Math.PI);
      await spawn(ASSETS.props.barrel, 1.1, [-2.0, 0, 1.0], 0.3);
      await spawn(ASSETS.props.stackedBoxes, 1.3, [2.0, 0, 1.0], -0.3);
      await spawn(ASSETS.trees[12], 8.0, [-8.5, 0, -3.0], 0.2);
      await spawn(ASSETS.trees[6], 8.0, [8.5, 0, -3.0], -0.2);
      await spawn(ASSETS.animals.wolf, 0.75, [-8.0, 0, 2.0], 0.6);
      break;
    }

    case 'castle': {
      await spawn(ASSETS.buildings.castle, 12.0, [0, 0, -3.0], 0);
      await spawn(ASSETS.buildings.cannonTower, 8.0, [-6.5, 0, 3.0], 0.3);
      await spawn(ASSETS.buildings.cannonTower, 8.0, [6.5, 0, 3.0], -0.3);
      await spawn(ASSETS.buildings.tower, 7.0, [-6.5, 0, -7.5], 0);
      await spawn(ASSETS.buildings.tower, 7.0, [6.5, 0, -7.5], 0);
      await spawn(ASSETS.trees[7], 8.5, [-11.0, 0, -5.0], 0.2);
      await spawn(ASSETS.trees[8], 8.5, [11.0, 0, -5.0], -0.2);
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

    // 24 Spatial Chunks (6 columns x 4 rows across 680x440 continent)
    this.chunkCols = 6;
    this.chunkRows = 4;
    this.minX = -340;
    this.maxX = 340;
    this.minZ = -220;
    this.maxZ = 220;
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
    const isStationClearing = (x, z) => {
      for (const m of this.missions) {
        if (Math.hypot(x - m.x, z - m.z) < 14.0) return true;
      }
      if (this.trailPoints && this.trailPoints.length) {
        for (let i = 0; i < this.trailPoints.length; i++) {
          const pt = this.trailPoints[i];
          if (Math.hypot(x - pt.x, z - pt.y) < 4.8) return true;
        }
      }
      return false;
    };

    const addInstance = (path, height, pos, rotY, scaleX = 1, scaleZ = 1, tiltX = 0, tiltZ = 0) => {
      const chunk = this.getChunk(pos[0], pos[2]);
      if (!chunk.buckets.has(path)) {
        chunk.buckets.set(path, []);
      }
      chunk.buckets.get(path).push({ height, pos, rotY, scaleX, scaleZ, tiltX, tiltZ });
    };

    let seedIdx = 1;

    // ── 1. Organic Multi-Species Oak & Broadleaf Groves (Central & Southern Valleys) ──
    const oakModels = [
      ASSETS.trees[0], ASSETS.trees[1], ASSETS.trees[2],
      ASSETS.trees[3], ASSETS.trees[4], ASSETS.trees[5],
      ASSETS.trees[9], ASSETS.trees[10]
    ];
    const bushModels = ASSETS.bushes;
    const rockModels = ASSETS.rocks;

    // 85 Organic Grove Centers
    for (let g = 0; g < 85; g++) {
      const gx = -280 + seeded(seedIdx++) * 560;
      const gz = -150 + seeded(seedIdx++) * 300;
      if (isStationClearing(gx, gz)) continue;
      const gy = this.getTerrainY(gx, gz);
      if (gy < -0.3 || gy > 28.0) continue;

      // Mother Ancient Tree in center
      const motherModel = oakModels[Math.floor(seeded(seedIdx++) * oakModels.length)];
      const motherHeight = THREE.MathUtils.lerp(5.2, 7.5, seeded(seedIdx++));
      const motherScaleXZ = THREE.MathUtils.lerp(0.9, 1.25, seeded(seedIdx++));
      addInstance(motherModel, motherHeight, [gx, gy, gz], seeded(seedIdx++) * Math.PI * 2, motherScaleXZ, motherScaleXZ);

      // 4 to 7 Young trees & saplings orbiting the mother tree
      const childCount = 4 + Math.floor(seeded(seedIdx++) * 4);
      for (let c = 0; c < childCount; c++) {
        const angle = seeded(seedIdx++) * Math.PI * 2;
        const rad = 2.8 + seeded(seedIdx++) * 9.5;
        const tx = gx + Math.cos(angle) * rad;
        const tz = gz + Math.sin(angle) * rad;
        if (isStationClearing(tx, tz)) continue;
        const ty = this.getTerrainY(tx, tz);
        if (ty < -0.3 || ty > 28.0) continue;

        const childModel = oakModels[Math.floor(seeded(seedIdx++) * oakModels.length)];
        const childHeight = THREE.MathUtils.lerp(2.4, 4.8, seeded(seedIdx++));
        const childScaleXZ = THREE.MathUtils.lerp(0.85, 1.2, seeded(seedIdx++));
        const tiltX = (seeded(seedIdx++) - 0.5) * 0.08;
        const tiltZ = (seeded(seedIdx++) - 0.5) * 0.08;
        addInstance(childModel, childHeight, [tx, ty, tz], seeded(seedIdx++) * Math.PI * 2, childScaleXZ, childScaleXZ, tiltX, tiltZ);
      }

      // Understory berry shrubs & mossy rocks at the base of the grove
      for (let b = 0; b < 4; b++) {
        const bAngle = seeded(seedIdx++) * Math.PI * 2;
        const bRad = 1.5 + seeded(seedIdx++) * 7.5;
        const bx = gx + Math.cos(bAngle) * bRad;
        const bz = gz + Math.sin(bAngle) * bRad;
        if (isStationClearing(bx, bz)) continue;
        const by = this.getTerrainY(bx, bz);
        if (by > -0.3) {
          const bushModel = bushModels[Math.floor(seeded(seedIdx++) * bushModels.length)];
          const bHeight = THREE.MathUtils.lerp(0.4, 0.9, seeded(seedIdx++));
          addInstance(bushModel, bHeight, [bx, by, bz], seeded(seedIdx++) * Math.PI * 2);
        }
      }

      if (seeded(seedIdx++) > 0.3) {
        const rx = gx + (seeded(seedIdx++) - 0.5) * 6.5;
        const rz = gz + (seeded(seedIdx++) - 0.5) * 6.5;
        const ry = this.getTerrainY(rx, rz);
        if (ry > -0.3) {
          const rockModel = rockModels[Math.floor(seeded(seedIdx++) * rockModels.length)];
          const rHeight = THREE.MathUtils.lerp(0.6, 1.4, seeded(seedIdx++));
          addInstance(rockModel, rHeight, [rx, ry, rz], seeded(seedIdx++) * Math.PI * 2);
        }
      }
    }

    // ── 2. Alpine Pines & Conifer Forests (Highlands, Northern Ridge & Mountain Slopes) ──
    const pineModels = [
      ASSETS.trees[6], ASSETS.trees[7], ASSETS.trees[8],
      ASSETS.trees[11], ASSETS.trees[12]
    ];

    // 85 Alpine Pine Clusters
    for (let p = 0; p < 85; p++) {
      const px = -290 + seeded(seedIdx++) * 580;
      const pz = -180 + seeded(seedIdx++) * 360;
      if (isStationClearing(px, pz)) continue;
      const py = this.getTerrainY(px, pz);
      if (py < -0.3 || py > 42.0) continue;

      // Group of 4 to 9 pines
      const count = 4 + Math.floor(seeded(seedIdx++) * 6);
      for (let i = 0; i < count; i++) {
        const pAngle = seeded(seedIdx++) * Math.PI * 2;
        const pDist = seeded(seedIdx++) * 14.0;
        const x = px + Math.cos(pAngle) * pDist;
        const z = pz + Math.sin(pAngle) * pDist;
        if (isStationClearing(x, z)) continue;
        const y = this.getTerrainY(x, z);
        if (y < -0.3 || y > 42.0) continue;

        const model = pineModels[Math.floor(seeded(seedIdx++) * pineModels.length)];
        const height = THREE.MathUtils.lerp(3.5, 8.0, seeded(seedIdx++));
        const scaleXZ = THREE.MathUtils.lerp(0.85, 1.25, seeded(seedIdx++));
        const tiltX = (seeded(seedIdx++) - 0.5) * 0.10;
        const tiltZ = (seeded(seedIdx++) - 0.5) * 0.10;
        addInstance(model, height, [x, y, z], seeded(seedIdx++) * Math.PI * 2, scaleXZ, scaleXZ, tiltX, tiltZ);
      }
    }

    // ── 3. Scattered Nature: Boulders & Wildflower Glades ────────────────────
    for (let i = 0; i < 140; i++) {
      const x = -280 + seeded(seedIdx++) * 560;
      const z = -160 + seeded(seedIdx++) * 320;
      if (isStationClearing(x, z)) continue;
      const y = this.getTerrainY(x, z);
      if (y < -0.3 || y > 38.0) continue;

      const rockModel = rockModels[Math.floor(seeded(seedIdx++) * rockModels.length)];
      const height = THREE.MathUtils.lerp(0.6, 1.8, seeded(seedIdx++));
      addInstance(rockModel, height, [x, y, z], seeded(seedIdx++) * Math.PI * 2);
    }

    for (let i = 0; i < 180; i++) {
      const x = -270 + seeded(seedIdx++) * 540;
      const z = -150 + seeded(seedIdx++) * 300;
      if (isStationClearing(x, z)) continue;
      const y = this.getTerrainY(x, z);
      if (y < -0.3 || y > 30.0) continue;

      const bushModel = bushModels[Math.floor(seeded(seedIdx++) * bushModels.length)];
      const height = THREE.MathUtils.lerp(0.45, 1.1, seeded(seedIdx++));
      addInstance(bushModel, height, [x, y, z], seeded(seedIdx++) * Math.PI * 2);
    }

    // ── 4. Animated Wildlife Herds ───────────────────────────────────────────
    this.animalSpawns = [
      { type: 'deer', pos: [-195, 45], height: 0.85 },
      { type: 'stag', pos: [-140, -50], height: 1.05 },
      { type: 'deer', pos: [-60, 40], height: 0.85 },
      { type: 'deer', pos: [-75, 75], height: 0.85 },
      { type: 'fox', pos: [-10, 85], height: 0.42 },
      { type: 'horse', pos: [25, 35], height: 1.25 },
      { type: 'horse', pos: [38, 48], height: 1.25 },
      { type: 'horse', pos: [65, 40], height: 1.25 },
      { type: 'alpaca', pos: [135, -60], height: 0.9 },
      { type: 'alpaca', pos: [150, -75], height: 0.9 },
      { type: 'deer', pos: [160, -45], height: 0.85 },
      { type: 'wolf', pos: [245, 75], height: 0.65 },
      { type: 'wolf', pos: [260, 60], height: 0.65 },
      { type: 'stag', pos: [-240, 60], height: 1.05 },
      { type: 'fox', pos: [205, 10], height: 0.42 }
    ];

    // ── 5. Sky Birds in Panoramic Flight ─────────────────────────────────────
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
      this.scene.add(inst);

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

// ── Fully-Animated 3D Humanoid Character (Kenney Protagonists Medium with Idle Skeletal Animation) ──

export function createHumanoidCharacter(player, index, mission, getTerrainY, targetMission = null, startMission = null) {
  const root = new THREE.Group();
  root.name = `Player_${player.name}`;

  const teamColor = new THREE.Color(player.color);

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

  // 2. Stylized Organic Hero Character (Scale 55% for harmonious human proportions)
  const heroGroup = new THREE.Group();
  heroGroup.position.y = 0.05;
  heroGroup.scale.set(0.55, 0.55, 0.55);
  root.add(heroGroup);

  const clothMat = new THREE.MeshStandardMaterial({ color: teamColor, roughness: 0.72, metalness: 0.06 });
  const darkClothMat = new THREE.MeshStandardMaterial({ color: 0x242832, roughness: 0.82 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xf5c6a5, roughness: 0.85 });
  const leatherMat = new THREE.MeshStandardMaterial({ color: 0x4e321e, roughness: 0.90 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xf1c40f, roughness: 0.32, metalness: 0.80 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x181c24 });
  const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

  // Body Group (Bobbing / Breathing)
  const bodyBob = new THREE.Group();
  bodyBob.position.y = 0.88;
  heroGroup.add(bodyBob);

  // Smooth Organic Capsule Torso
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.44, 8, 16), clothMat);
  torso.castShadow = true;
  bodyBob.add(torso);

  // Leather Belt with Gold Buckle
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.038, 8, 24), leatherMat);
  belt.rotation.x = Math.PI / 2;
  belt.position.y = -0.06;
  bodyBob.add(belt);

  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.05), goldMat);
  buckle.position.set(0, -0.06, 0.26);
  bodyBob.add(buckle);

  // Flowing Curved Cape Behind
  const capeGroup = new THREE.Group();
  capeGroup.position.set(0, 0.22, -0.16);
  const cape = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.40, 0.82, 10, 1, true, -Math.PI * 0.45, Math.PI * 0.90), clothMat);
  cape.position.set(0, -0.38, 0.02);
  cape.rotation.x = -0.14;
  capeGroup.add(cape);
  bodyBob.add(capeGroup);

  // Head & Adventurer Cowl
  const headGroup = new THREE.Group();
  headGroup.position.y = 0.52;
  bodyBob.add(headGroup);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 18, 16), skinMat);
  head.castShadow = true;
  headGroup.add(head);

  // Stylized Expressive Eyes
  [-0.072, 0.072].forEach(eyeX => {
    const eye = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.015, 8), eyeMat);
    eye.rotation.x = Math.PI / 2;
    eye.position.set(eyeX, 0.02, 0.21);
    headGroup.add(eye);

    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.010, 6, 6), eyeWhiteMat);
    glint.position.set(eyeX + 0.009, 0.030, 0.22);
    headGroup.add(glint);
  });

  // Cowl Hood & Feather Plume
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.65), darkClothMat);
  hood.position.y = 0.04;
  headGroup.add(hood);

  const circlet = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.018, 8, 20), goldMat);
  circlet.rotation.x = Math.PI / 2;
  circlet.position.y = 0.08;
  headGroup.add(circlet);

  const plumeGroup = new THREE.Group();
  plumeGroup.position.set(0, 0.24, -0.04);
  const plume = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.34, 7), clothMat);
  plume.position.set(0, 0.14, -0.07);
  plume.rotation.x = -0.42;
  plumeGroup.add(plume);
  headGroup.add(plumeGroup);

  // Smooth Rounded Capsule Arms
  const leftArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.30, 6, 12), clothMat);
  leftArm.position.set(-0.33, 0.02, 0.04);
  leftArm.rotation.z = 0.22;
  leftArm.rotation.x = -0.15;
  bodyBob.add(leftArm);

  const rightArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.30, 6, 12), clothMat);
  rightArm.position.set(0.33, 0.02, 0.04);
  rightArm.rotation.z = -0.22;
  rightArm.rotation.x = -0.15;
  bodyBob.add(rightArm);

  // Smooth Rounded Capsule Legs & Traveler Boots
  [-0.13, 0.13].forEach(sideX => {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.28, 6, 12), darkClothMat);
    leg.position.set(sideX, 0.36, 0);
    heroGroup.add(leg);

    const boot = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.16, 6, 12), leatherMat);
    boot.rotation.x = Math.PI / 2;
    boot.position.set(sideX, 0.12, 0.06);
    heroGroup.add(boot);
  });

  // 3. Overhead Floating Team Crystal / Badge in Team Color
  const gemMat = new THREE.MeshStandardMaterial({
    color: teamColor,
    emissive: teamColor,
    emissiveIntensity: 2.2,
    roughness: 0.2
  });
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), gemMat);
  gem.position.y = 1.30;
  root.add(gem);

  // 4. Station Courtyard Slot Placement (Proportional & 100% Collision-Free Matrix)
  function calcStationSlot(m, idx) {
    const totalInGroup = Math.max(1, (player.totalInStation || 4));
    // Courtyard patio layout: up to 5 characters per row in the clear open courtyard
    const isCastle = m.type === 'castle';
    const maxPerRow = 5;
    const row = Math.floor(idx / maxPerRow);
    const col = idx % maxPerRow;
    const inThisRow = row === 0 ? Math.min(totalInGroup, maxPerRow) : Math.max(1, totalInGroup - maxPerRow);
    const spacingX = isCastle ? 1.35 : 0.95; // 0.95m spacing for human-scale avatars
    const offsetX = (col - (inThisRow - 1) / 2) * spacingX;
    const baseZ = isCastle ? 4.0 : 2.5;
    const offsetZ = baseZ + row * (isCastle ? 1.3 : 1.05);

    const posX = m.x + offsetX;
    const posZ = m.z + offsetZ;
    const posY = getTerrainY(posX, posZ);

    // Turn characters inward towards the station center / terrace
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
    bodyBob,
    capeGroup,
    plumeGroup,
    runeRing,
    gem,
    endPos: slot.pos.clone(),
    endRot: slot.rotY,
    walkProgress: 1
  };

  return root;
}
