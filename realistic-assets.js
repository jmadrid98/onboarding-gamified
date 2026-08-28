import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';

const loader = new GLTFLoader();
const modelCache = new Map();

export function loadModel(path) {
  if (modelCache.has(path)) return modelCache.get(path);
  const p = new Promise(resolve => {
    loader.load(path, resolve, undefined, err => {
      console.warn('Error cargando modelo:', path, err);
      resolve(null);
    });
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
  const gltf = await loadModel(path);
  if (!gltf || !gltf.scene) return null;

  const wrapper = new THREE.Group();
  const clone = prepare(cloneSkeleton(gltf.scene), castShadow);
  wrapper.add(clone);

  clone.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(clone);
  const size = box.getSize(new THREE.Vector3());
  const scale = targetHeight / Math.max(0.001, size.y);
  clone.scale.setScalar(scale);

  clone.updateMatrixWorld(true);
  const boxScaled = new THREE.Box3().setFromObject(clone);
  clone.position.y = -boxScaled.min.y;
  clone.position.x = -((boxScaled.min.x + boxScaled.max.x) / 2);
  clone.position.z = -((boxScaled.min.z + boxScaled.max.z) / 2);

  wrapper.userData.animations = gltf.animations || [];
  return wrapper;
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
    wolf: './assets/stylized/animals/Wolf.gltf',
    stork: './assets/stylized/animals/Stork.glb',
    parrot: './assets/stylized/animals/Parrot.glb'
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
    stone.castShadow = true;
    g.add(stone);
  }

  // Cross logs
  for (let i = 0; i < 3; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.7, 6), woodMat);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = (i / 3) * Math.PI;
    log.position.y = 0.06;
    log.castShadow = true;
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
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x827e74, roughness: 0.92 });
  positions.forEach((p, idx) => {
    const stone = new THREE.Mesh(new THREE.CylinderGeometry(0.35 + (idx % 3) * 0.08, 0.42 + (idx % 3) * 0.08, 0.05, 7), stoneMat);
    stone.position.set(p[0], 0.02, p[1]);
    stone.rotation.y = idx * 1.3;
    stone.receiveShadow = true;
    g.add(stone);
  });
  return g;
}

// ── Checkpoint Builders (Richly Dressed Environmental Outposts) ───────────────

export async function buildCheckpointStructure(mission) {
  const g = new THREE.Group();
  g.name = `Checkpoint_${mission.id}_${mission.type}`;

  async function spawn(path, height, pos = [0, 0, 0], rotY = 0) {
    const inst = await instantiate(path, height, true);
    if (!inst) return null;
    inst.position.set(pos[0], pos[1], pos[2]);
    inst.rotation.y = rotY;
    g.add(inst);
    return inst;
  }

  switch (mission.type) {
    case 'camp': {
      // MISIÓN 1: Arsenal y Equipos (Rich adventure outpost with tents, fire, foliage & props)
      await spawn(ASSETS.buildings.tent, 3.2, [-2.8, 0, -1.8], 0.6);
      await spawn(ASSETS.buildings.tent, 3.2, [2.8, 0, -1.8], -0.6);
      await spawn(ASSETS.buildings.tent, 2.8, [0, 0, -3.4], Math.PI);
      
      // Core Mission Interactive Props
      await spawn(ASSETS.props.chest, 0.85, [0, 0, -0.1], 0);
      await spawn(ASSETS.props.stackedBoxes, 1.3, [1.8, 0, -0.3], -0.4);
      await spawn(ASSETS.props.barrel, 1.1, [-1.8, 0, -0.3], 0.4);
      await spawn(ASSETS.props.largeBox, 0.95, [3.2, 0, 0.5], 0.3);
      await spawn(ASSETS.props.barrel, 0.95, [-3.2, 0, 0.5], -0.3);

      // Campfire & Log Sitting Area
      const campfire = createCampfire();
      campfire.position.set(-0.2, 0, 1.6);
      g.add(campfire);

      // Environmental Foliage & Rock Dressing around perimeter
      await spawn(ASSETS.bushes[0], 1.4, [-4.8, 0, -2.2], 0.4);
      await spawn(ASSETS.bushes[1], 1.3, [4.8, 0, -2.2], -0.4);
      await spawn(ASSETS.bushes[2], 1.1, [-3.8, 0, 1.8], 1.2);
      await spawn(ASSETS.bushes[0], 1.2, [3.8, 0, 1.8], -1.2);
      await spawn(ASSETS.rocks[0], 1.2, [-5.2, 0, 0.2], 0.8);
      await spawn(ASSETS.rocks[1], 1.1, [5.2, 0, 0.2], -0.8);

      // Stepping stones path
      const pathStones = createSteppingStones([
        [0, 0.8], [0.4, 2.4], [-0.3, 3.8], [0.2, 5.2]
      ]);
      g.add(pathStones);

      const fireLight = new THREE.PointLight(0xff8a30, 3.8, 12);
      fireLight.position.set(-0.2, 1.2, 1.6);
      g.add(fireLight);
      g.userData.fireLight = fireLight;

      const crystal = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.28, 0),
        new THREE.MeshStandardMaterial({ color: 0x48e6d2, emissive: 0x16b0a2, emissiveIntensity: 2.0, roughness: 0.3 })
      );
      crystal.position.set(0, 1.6, -0.1);
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

      // Foliage & Rocks framing the monument
      await spawn(ASSETS.bushes[2], 1.3, [-3.8, 0, -2.5], 0.2);
      await spawn(ASSETS.bushes[3], 1.3, [3.8, 0, -2.5], -0.2);
      await spawn(ASSETS.rocks[2], 1.4, [-4.2, 0, 0], 0.5);
      await spawn(ASSETS.rocks[3], 1.4, [4.2, 0, 0], -0.5);

      const pathStones = createSteppingStones([
        [0, 1.0], [0, 2.2], [0.3, 3.4], [-0.2, 4.6]
      ]);
      g.add(pathStones);

      const covenantSeal = new THREE.Mesh(
        new THREE.TorusGeometry(0.35, 0.07, 12, 32),
        new THREE.MeshStandardMaterial({ color: 0xffd369, emissive: 0xd49b29, emissiveIntensity: 2.2, roughness: 0.3 })
      );
      covenantSeal.position.set(0, 1.8, 0);
      g.add(covenantSeal);
      g.userData.covenantSeal = covenantSeal;

      const shrineLight = new THREE.PointLight(0xffdf88, 3.8, 12);
      shrineLight.position.set(0, 2.0, 0);
      g.add(shrineLight);
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

      // Tavern Courtyard Bushes & Rocks
      await spawn(ASSETS.bushes[1], 1.4, [-5.8, 0, -1.0], 0.8);
      await spawn(ASSETS.bushes[0], 1.3, [5.5, 0, -1.0], -0.8);
      await spawn(ASSETS.rocks[1], 1.2, [-4.8, 0, 1.8], 0.3);
      await spawn(ASSETS.rocks[0], 1.2, [4.8, 0, 1.8], -0.3);

      const pathStones = createSteppingStones([
        [-0.5, 1.0], [0.2, 2.2], [-0.3, 3.4], [0.1, 4.6]
      ]);
      g.add(pathStones);

      const humandTerminal = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.6, 0.08),
        new THREE.MeshStandardMaterial({ color: 0x2ee59d, emissive: 0x17a06a, emissiveIntensity: 2.2, roughness: 0.3 })
      );
      humandTerminal.position.set(1.1, 1.7, -0.1);
      g.add(humandTerminal);
      g.userData.humandTerminal = humandTerminal;

      const humandLight = new THREE.PointLight(0x2ee59d, 3.5, 10);
      humandLight.position.set(1.1, 1.8, -0.1);
      g.add(humandLight);
      break;
    }

    case 'observatory': {
      await spawn(ASSETS.buildings.watchtower, 8.5, [0, 0, -2.5], 0);
      await spawn(ASSETS.buildings.home, 4.5, [-3.8, 0, -0.5], Math.PI / 4);
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
      break;
    }

    case 'harbor': {
      await spawn(ASSETS.buildings.docks, 3.5, [0, 0, -1.8], 0);
      await spawn(ASSETS.buildings.watermill, 6.5, [4.5, 0, 1.0], -Math.PI / 6);
      await spawn(ASSETS.buildings.shipyard, 6.0, [-4.5, 0, 1.0], Math.PI / 6);
      await spawn(ASSETS.props.stackedBoxes, 1.3, [-1.8, 0, 0.5], 0.4);
      await spawn(ASSETS.props.barrel, 1.1, [1.8, 0, 0.5], -0.4);
      const beacon = new THREE.PointLight(0xffeb75, 4.0, 14);
      beacon.position.set(0, 3.6, -5.5);
      g.add(beacon);
      break;
    }

    case 'archive': {
      await spawn(ASSETS.buildings.church, 9.0, [0, 0, -3.0], 0);
      await spawn(ASSETS.buildings.archery, 4.8, [4.0, 0, 0], -0.3);
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
      break;
    }

    case 'castle': {
      await spawn(ASSETS.buildings.castle, 12.0, [0, 0, -3.0], 0);
      await spawn(ASSETS.buildings.cannonTower, 8.0, [-6.5, 0, 3.0], 0.3);
      await spawn(ASSETS.buildings.cannonTower, 8.0, [6.5, 0, 3.0], -0.3);
      await spawn(ASSETS.buildings.tower, 7.0, [-6.5, 0, -7.5], 0);
      await spawn(ASSETS.buildings.tower, 7.0, [6.5, 0, -7.5], 0);
      break;
    }
  }

  return g;
}

// ── Progressive World Streamer ───────────────────────────────────────────────

export class ProgressiveWorldStreamer {
  constructor(scene, missions, getTerrainY) {
    this.scene = scene;
    this.missions = missions;
    this.getTerrainY = getTerrainY;
    this.pendingEntities = [];
    this.mixers = [];
    this.birds = [];
    this.prepareEntities();
  }

  prepareEntities() {
    const isStationClearing = (x, z) => {
      for (const m of this.missions) {
        const dist = Math.hypot(x - m.x, z - m.z);
        if (dist < 11.0) return true;

        const dx = x - m.x, dz = z - m.z;
        if (dz > 0 && dz < 16.0 && Math.abs(dx) < 8.0) return true;
      }
      return false;
    };

    let seedIdx = 1;
    // 1. Clustered Tree Forests across all biomes (Optimized for performance)
    for (let i = 0; i < 160; i++) {
      const clusterCenter = [
        -125 + seeded(seedIdx++) * 250,
        -65 + seeded(seedIdx++) * 130
      ];
      const angle = seeded(seedIdx++) * Math.PI * 2;
      const dist = seeded(seedIdx++) * 16.0;
      const x = clusterCenter[0] + Math.cos(angle) * dist;
      const z = clusterCenter[1] + Math.sin(angle) * dist;

      if (isStationClearing(x, z)) continue;
      const y = this.getTerrainY(x, z);
      if (y < 0.15 || y > 24.0) continue;

      const isAlpine = (y > 4.5 || z < -25 || x > 75);
      const treeList = isAlpine
        ? [ASSETS.trees[6], ASSETS.trees[7], ASSETS.trees[8]]
        : [ASSETS.trees[0], ASSETS.trees[1], ASSETS.trees[2], ASSETS.trees[3], ASSETS.trees[4], ASSETS.trees[5]];

      const treePath = treeList[Math.floor(seeded(seedIdx++) * treeList.length)] || ASSETS.trees[0];
      const height = THREE.MathUtils.lerp(2.5, 4.2, seeded(seedIdx++));

      this.pendingEntities.push({
        category: 'tree',
        path: treePath,
        height,
        pos: [x, y, z],
        rotY: seeded(seedIdx++) * Math.PI * 2
      });
    }

    // 2. Natural Rocks & Boulders
    for (let i = 0; i < 45; i++) {
      const x = -140 + seeded(seedIdx++) * 280;
      const z = -75 + seeded(seedIdx++) * 150;
      if (isStationClearing(x, z)) continue;
      const y = this.getTerrainY(x, z);
      if (y < 0.1 || y > 24) continue;

      const rockPath = ASSETS.rocks[Math.floor(seeded(seedIdx++) * ASSETS.rocks.length)] || ASSETS.rocks[0];
      const height = THREE.MathUtils.lerp(0.45, 1.15, seeded(seedIdx++));

      this.pendingEntities.push({
        category: 'rock',
        path: rockPath,
        height,
        pos: [x, y, z],
        rotY: seeded(seedIdx++) * Math.PI * 2
      });
    }

    // 3. Lush Bushes & Shrubbery
    for (let i = 0; i < 55; i++) {
      const x = -135 + seeded(seedIdx++) * 270;
      const z = -70 + seeded(seedIdx++) * 140;
      if (isStationClearing(x, z)) continue;
      const y = this.getTerrainY(x, z);
      if (y < 0.15 || y > 16) continue;

      const bushPath = ASSETS.bushes[Math.floor(seeded(seedIdx++) * ASSETS.bushes.length)] || ASSETS.bushes[0];
      const height = THREE.MathUtils.lerp(0.35, 0.70, seeded(seedIdx++));

      this.pendingEntities.push({
        category: 'bush',
        path: bushPath,
        height,
        pos: [x, y, z],
        rotY: seeded(seedIdx++) * Math.PI * 2
      });
    }

    // 4. Wildlife Herds across Biomes
    const animalSpawns = [
      { type: 'deer', pos: [-98, 18], height: 0.85 },
      { type: 'stag', pos: [-70, -18], height: 1.05 },
      { type: 'deer', pos: [-35, 12], height: 0.85 },
      { type: 'fox', pos: [-2, 36], height: 0.42 },
      { type: 'horse', pos: [12, 14], height: 1.25 },
      { type: 'horse', pos: [35, 18], height: 1.25 },
      { type: 'alpaca', pos: [68, -16], height: 0.9 },
      { type: 'deer', pos: [85, 5], height: 0.85 },
      { type: 'wolf', pos: [125, 32], height: 0.65 },
      { type: 'stag', pos: [-125, 20], height: 1.05 }
    ];

    animalSpawns.forEach(s => {
      const y = this.getTerrainY(s.pos[0], s.pos[1]);
      const path = ASSETS.animals[s.type] || ASSETS.animals.deer;
      this.pendingEntities.push({
        category: 'animal',
        path,
        height: s.height,
        pos: [s.pos[0], y, s.pos[1]],
        rotY: Math.random() * Math.PI * 2
      });
    });

    // 5. Sky Birds in Flight
    const birdSpawns = [
      { type: 'stork', height: 20, radius: 55, speed: 0.11, phase: 0 },
      { type: 'stork', height: 24, radius: 75, speed: 0.09, phase: 2.1 },
      { type: 'parrot', height: 16, radius: 45, speed: 0.15, phase: 4.2 },
      { type: 'stork', height: 28, radius: 68, speed: 0.10, phase: 1.2 }
    ];

    birdSpawns.forEach(b => {
      this.pendingEntities.push({
        category: 'bird',
        path: b.type === 'parrot' ? ASSETS.animals.parrot : ASSETS.animals.stork,
        height: b.type === 'parrot' ? 0.45 : 0.75,
        flight: b
      });
    });
  }

  async tickStream() {
    if (!this.pendingEntities.length) return;

    const batchSize = 2;
    for (let i = 0; i < batchSize && this.pendingEntities.length > 0; i++) {
      const item = this.pendingEntities.shift();

      if (item.category === 'bird') {
        const inst = await instantiate(item.path, item.height, true);
        if (!inst) continue;

        if (inst.userData.animations?.length) {
          const mixer = new THREE.AnimationMixer(inst);
          const clip = inst.userData.animations[0];
          if (clip) {
            mixer.clipAction(clip).play();
            this.mixers.push(mixer);
          }
        }

        const birdHolder = new THREE.Group();
        birdHolder.add(inst);
        birdHolder.userData = { ...item.flight };
        this.scene.add(birdHolder);
        this.birds.push(birdHolder);
        continue;
      }

      const inst = await instantiate(item.path, item.height, true);
      if (!inst) continue;

      inst.position.set(item.pos[0], item.pos[1], item.pos[2]);
      inst.rotation.y = item.rotY;

      if (item.category === 'animal' && inst.userData.animations?.length) {
        const mixer = new THREE.AnimationMixer(inst);
        const safeClip = inst.userData.animations.find(a => {
          const name = a.name.toLowerCase();
          return (name.includes('idle') || name.includes('eating') || name.includes('walk')) && !name.includes('death') && !name.includes('attack');
        }) || inst.userData.animations[0];

        if (safeClip && !safeClip.name.toLowerCase().includes('death')) {
          mixer.clipAction(safeClip).play();
          this.mixers.push(mixer);
        }
      }

      const targetScale = inst.scale.clone();
      inst.scale.set(0.01, 0.01, 0.01);
      this.scene.add(inst);

      let t = 0;
      const animateScale = () => {
        t += 0.15;
        if (t < 1) {
          inst.scale.lerp(targetScale, t);
          requestAnimationFrame(animateScale);
        } else {
          inst.scale.copy(targetScale);
        }
      };
      requestAnimationFrame(animateScale);
    }
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
    }
  }
}

// ── Install World & Checkpoints ──────────────────────────────────────────────

export async function installRealisticWorld({ scene, missions, getTerrainY, onProgress = () => {} }) {
  onProgress(0.50, 'Construyendo el reino...');

  // Build all 9 checkpoint structures in parallel for maximum speed
  const structurePromises = missions.map(async (q, i) => {
    try {
      const struct = await buildCheckpointStructure(q);
      const wy = getTerrainY(q.x, q.z);
      struct.position.set(q.x, wy, q.z);
      struct.userData = { ...struct.userData, mission: q, phase: Math.random() * 6 };
      scene.add(struct);
      q.structGroup = struct;
      onProgress(0.50 + ((i + 1) / missions.length) * 0.45, `Cargando estación: ${q.name}`);
      return struct;
    } catch (e) {
      console.warn('Error cargando estructura para estación:', q.name, e);
      return null;
    }
  });

  await Promise.allSettled(structurePromises);
  const streamer = new ProgressiveWorldStreamer(scene, missions, getTerrainY);
  onProgress(1.0, '¡Reino sólido y tierra firme preparados!');
  return streamer;
}

// ── Humanoid Adventurer Character with Realistic Proportions (1.85m height) ───

export function createHumanoidCharacter(player, index, mission, getTerrainY, targetMission = null, startMission = null) {
  const root = new THREE.Group();
  root.name = `Player_${player.name}`;

  const bodyGroup = new THREE.Group();
  bodyGroup.scale.set(0.56, 0.56, 0.56);
  root.add(bodyGroup);

  const clothMat = new THREE.MeshStandardMaterial({ color: player.color, roughness: 0.85, metalness: 0.0, envMapIntensity: 0.0 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xdfa57e, roughness: 0.9, metalness: 0.0, envMapIntensity: 0.0 });
  const leatherMat = new THREE.MeshStandardMaterial({ color: 0x583923, roughness: 0.95, metalness: 0.0, envMapIntensity: 0.0 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.5, roughness: 0.4 });

  // Torso & Tunic
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.75, 14), clothMat);
  torso.position.y = 1.15;
  torso.castShadow = true;
  bodyGroup.add(torso);

  // Belt & Buckle
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.10, 14), leatherMat);
  belt.position.y = 0.85;
  bodyGroup.add(belt);

  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.06), metalMat);
  buckle.position.set(0, 0.85, 0.26);
  bodyGroup.add(buckle);

  // Head & Hood
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.20, 16, 12), skinMat);
  head.position.y = 1.70;
  bodyGroup.add(head);

  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.23, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.7), clothMat);
  hood.position.y = 1.76;
  bodyGroup.add(hood);

  // Articulated Legs
  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-0.13, 0.80, 0);
  const leftLegMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.55, 8), leatherMat);
  leftLegMesh.position.y = -0.27;
  leftLegMesh.castShadow = true;
  leftLegPivot.add(leftLegMesh);
  const leftBoot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.15, 0.26), leatherMat);
  leftBoot.position.set(0, -0.55, 0.06);
  leftBoot.castShadow = true;
  leftLegPivot.add(leftBoot);
  bodyGroup.add(leftLegPivot);

  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(0.13, 0.80, 0);
  const rightLegMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.55, 8), leatherMat);
  rightLegMesh.position.y = -0.27;
  rightLegMesh.castShadow = true;
  rightLegPivot.add(rightLegMesh);
  const rightBoot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.15, 0.26), leatherMat);
  rightBoot.position.set(0, -0.55, 0.06);
  rightBoot.castShadow = true;
  rightLegPivot.add(rightBoot);
  bodyGroup.add(rightLegPivot);

  // Articulated Arms
  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.34, 1.35, 0);
  const leftArmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.55, 8), clothMat);
  leftArmMesh.position.y = -0.27;
  leftArmMesh.rotation.z = 0.15;
  leftArmMesh.castShadow = true;
  leftArmPivot.add(leftArmMesh);
  bodyGroup.add(leftArmPivot);

  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.34, 1.35, 0);
  const rightArmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.55, 8), clothMat);
  rightArmMesh.position.y = -0.27;
  rightArmMesh.rotation.z = -0.15;
  rightArmMesh.castShadow = true;
  rightArmPivot.add(rightArmMesh);

  // Magic Staff
  const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.035, 1.55, 8), leatherMat);
  staff.position.set(0.12, -0.15, 0.12);
  staff.rotation.x = -0.12;
  staff.castShadow = true;
  rightArmPivot.add(staff);

  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 1), new THREE.MeshStandardMaterial({
    color: 0x58ded4,
    emissive: 0x16b0a2,
    emissiveIntensity: 2.0,
    roughness: 0.3
  }));
  crystal.position.set(0.12, 0.65, 0.12);
  rightArmPivot.add(crystal);
  bodyGroup.add(rightArmPivot);

  // Courtyard Placement
  function calcStationSlot(m, idx) {
    const totalInGroup = Math.max(1, (player.totalInStation || 4));
    const spreadAngle = 0.85;
    const startAngle = Math.PI / 2 - spreadAngle / 2;
    const step = spreadAngle / Math.max(1, totalInGroup - 1);
    const angle = startAngle + (idx % 6) * step;
    const radius = 1.7 + (idx % 2) * 0.45;
    const posX = m.x + Math.cos(angle) * radius;
    const posZ = m.z + Math.sin(angle) * radius;
    const posY = getTerrainY(posX, posZ);
    return {
      pos: new THREE.Vector3(posX, posY, posZ),
      rotY: -angle + Math.PI
    };
  }

  const endSlot = calcStationSlot(targetMission || mission, index);
  const startSlot = startMission ? calcStationSlot(startMission, index) : endSlot;

  root.position.copy(startSlot.pos);
  root.rotation.y = startSlot.rotY;

  root.userData = {
    player,
    phase: Math.random() * 6,
    bodyGroup,
    leftLegPivot,
    rightLegPivot,
    leftArmPivot,
    rightArmPivot,
    startPos: startSlot.pos.clone(),
    endPos: endSlot.pos.clone(),
    startRot: startSlot.rotY,
    endRot: endSlot.rotY,
    walkProgress: startMission ? 0 : 1,
    walkSpeed: 0.55 + Math.random() * 0.1
  };

  return root;
}
