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

function createCosmosGoldenTalisman() {
  const g = new THREE.Group();
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xffd700,
    emissive: 0xd4af37,
    emissiveIntensity: 0.5,
    metalness: 0.95,
    roughness: 0.18
  });
  const darkStoneMat = new THREE.MeshStandardMaterial({
    color: 0x616a6b,
    roughness: 0.85
  });

  // Pedestal escalonado de piedra labrada
  const baseStone = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 0.25, 8), darkStoneMat);
  baseStone.position.y = 0.125;
  baseStone.receiveShadow = true;
  g.add(baseStone);

  const midStone = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 0.35, 8), darkStoneMat);
  midStone.position.y = 0.425;
  midStone.receiveShadow = true;
  g.add(midStone);

  // Monedas de oro incrustadas / depositadas en el escalón del pedestal
  const cGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.015, 8);
  for (let i = 0; i < 14; i++) {
    const coin = new THREE.Mesh(cGeo, goldMat);
    const a = (i / 14) * Math.PI * 2;
    coin.position.set(Math.cos(a) * 0.72, 0.26, Math.sin(a) * 0.72);
    coin.rotation.y = a;
    g.add(coin);
  }

  // Talismán Dorado de la Tarjeta Cosmos (Flotante y majestuoso)
  const talisman = new THREE.Group();
  talisman.position.y = 1.75;

  // Placa de oro (1.4m x 0.88m)
  const plate = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.88, 0.06), goldMat);
  plate.castShadow = true;
  talisman.add(plate);

  // Esfera planetaria central 3D
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 16), goldMat);
  sphere.position.z = 0.04;
  talisman.add(sphere);

  // Anillo orbital inclinado 3D
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.028, 8, 32), goldMat);
  ring.rotation.x = Math.PI / 3;
  ring.rotation.y = Math.PI / 6;
  ring.position.z = 0.04;
  talisman.add(ring);

  // 4 Estrellas en los cuadrantes
  const starGeo = new THREE.OctahedronGeometry(0.055, 0);
  [[-0.5, 0.26], [0.5, 0.26], [-0.5, -0.26], [0.5, -0.26]].forEach(([sx, sy]) => {
    const st = new THREE.Mesh(starGeo, goldMat);
    st.position.set(sx, sy, 0.045);
    talisman.add(st);
  });

  // Luz dorada cálida
  const light = new THREE.PointLight(0xffb703, 2.0, 5.0);
  light.position.set(0, 0, 0.35);
  talisman.add(light);

  g.add(talisman);
  g.userData.cardMesh = talisman;

  return g;
}

function createContractDesk() {
  const g = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x4e342e, roughness: 0.8 });
  const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x37251f, roughness: 0.85 });
  const parchmentMat = new THREE.MeshStandardMaterial({ color: 0xf5eedb, roughness: 0.75 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.95, roughness: 0.15 });
  const redWaxMat = new THREE.MeshStandardMaterial({ color: 0xa93226, roughness: 0.4 });
  const runnerClothMat = new THREE.MeshStandardMaterial({ color: 0x78281f, roughness: 0.65 });

  // 1. Mesa de roble macizo estilizada de banquero / escribano
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.1, 0.9), woodMat);
  top.position.y = 0.82;
  top.castShadow = true;
  g.add(top);

  // Mantel / Tapete central burdeos
  const runner = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.015, 0.92), runnerClothMat);
  runner.position.set(0, 0.875, 0);
  g.add(runner);

  // 4 Patas torneadas
  [[-0.82, -0.34], [0.82, -0.34], [-0.82, 0.34], [0.82, 0.34]].forEach(([x, z]) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.82, 0.11), darkWoodMat);
    leg.position.set(x, 0.41, z);
    leg.castShadow = true;
    g.add(leg);
  });

  // 2. Gran Pergamino de Contrato extendido
  const doc = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.01, 0.48), parchmentMat);
  doc.position.set(-0.1, 0.89, 0.02);
  doc.rotation.y = 0.05;
  g.add(doc);

  // Sello de cera roja oficial
  const seal = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.018, 12), redWaxMat);
  seal.position.set(0.02, 0.9, 0.14);
  g.add(seal);

  // 3. Balanza de latón para monedas
  const scBase = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.03, 10), goldMat);
  scBase.position.set(0.55, 0.89, 0);
  g.add(scBase);

  const scPole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.42, 8), goldMat);
  scPole.position.set(0.55, 1.1, 0);
  g.add(scPole);

  const scBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.36, 8), goldMat);
  scBeam.rotation.z = Math.PI / 2;
  scBeam.position.set(0.55, 1.28, 0);
  g.add(scBeam);

  [-0.15, 0.15].forEach(bx => {
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.14, 4), goldMat);
    cord.position.set(0.55 + bx, 1.2, 0);
    g.add(cord);

    const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.045, 0.015, 8), goldMat);
    pan.position.set(0.55 + bx, 1.12, 0);
    g.add(pan);
  });

  // 4. Pilas de monedas de oro en el escritorio
  for (let c = 0; c < 3; c++) {
    for (let h = 0; h < 4 + c; h++) {
      const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.014, 8), goldMat);
      coin.position.set(0.35 + c * 0.08, 0.89 + h * 0.014, -0.15);
      g.add(coin);
    }
  }

  // 5. Tintero de cerámica y pluma blanca
  const ink = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.055, 8), darkWoodMat);
  ink.position.set(-0.55, 0.9, -0.18);
  g.add(ink);

  const quill = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.012, 0.22, 6), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }));
  quill.rotation.z = -0.38;
  quill.position.set(-0.52, 0.98, -0.18);
  g.add(quill);

  // 6. Rollos de pergaminos de convenios
  const rollGeo = new THREE.CylinderGeometry(0.032, 0.032, 0.3, 8);
  const roll1 = new THREE.Mesh(rollGeo, parchmentMat);
  roll1.rotation.z = Math.PI / 2;
  roll1.position.set(-0.65, 0.91, 0.15);
  g.add(roll1);

  const roll2 = new THREE.Mesh(rollGeo, parchmentMat);
  roll2.rotation.z = Math.PI / 2;
  roll2.position.set(-0.65, 0.95, 0.15);
  g.add(roll2);

  return g;
}

function createWealthTreasureDisplay() {
  const g = new THREE.Group();
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xffd700,
    emissive: 0xd4af37,
    emissiveIntensity: 0.45,
    metalness: 0.96,
    roughness: 0.15
  });
  const burlapMat = new THREE.MeshStandardMaterial({ color: 0xa88962, roughness: 0.85 });
  const darkRopeMat = new THREE.MeshStandardMaterial({ color: 0x4a3420, roughness: 0.9 });
  const gemRubyMat = new THREE.MeshStandardMaterial({ color: 0xe74c3c, emissive: 0xc0392b, emissiveIntensity: 1.2, roughness: 0.1 });
  const gemEmeraldMat = new THREE.MeshStandardMaterial({ color: 0x2ecc71, emissive: 0x27ae60, emissiveIntensity: 1.2, roughness: 0.1 });
  const gemSapphireMat = new THREE.MeshStandardMaterial({ color: 0x3498db, emissive: 0x2980b9, emissiveIntensity: 1.2, roughness: 0.1 });
  const woodPlankMat = new THREE.MeshStandardMaterial({ color: 0x5a3d28, roughness: 0.8 });

  // 1. Pirámide de Lingotes de Oro Puro 24K sobre bandeja de madera
  const tray = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.04, 0.65), woodPlankMat);
  tray.position.set(-0.6, 0.02, 0);
  tray.receiveShadow = true;
  g.add(tray);

  const barGeo = new THREE.BoxGeometry(0.24, 0.055, 0.11);
  // Fila base de lingotes (3x2)
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) {
      const bar = new THREE.Mesh(barGeo, goldMat);
      bar.position.set(-0.84 + c * 0.24, 0.065, -0.07 + r * 0.14);
      bar.castShadow = true;
      g.add(bar);
    }
  }
  // Segunda fila de lingotes (2x2)
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 2; c++) {
      const bar = new THREE.Mesh(barGeo, goldMat);
      bar.position.set(-0.72 + c * 0.24, 0.12, -0.07 + r * 0.14);
      bar.castShadow = true;
      g.add(bar);
    }
  }
  // Cima de lingote (1)
  const topBar = new THREE.Mesh(barGeo, goldMat);
  topBar.position.set(-0.6, 0.175, 0);
  topBar.castShadow = true;
  g.add(topBar);

  // 2. Múltiples Sacos de Caudales Rebosantes
  // Saco parado grande
  const sack1 = new THREE.Group();
  sack1.position.set(0.1, 0, -0.2);
  const sBody1 = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), burlapMat);
  sBody1.scale.set(1.0, 1.25, 0.95);
  sBody1.position.y = 0.32;
  sBody1.castShadow = true;
  sack1.add(sBody1);
  const sRope1 = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.03, 8, 16), darkRopeMat);
  sRope1.rotation.x = Math.PI / 2;
  sRope1.position.y = 0.56;
  sack1.add(sRope1);
  const sTop1 = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.15, 8), burlapMat);
  sTop1.position.y = 0.65;
  sack1.add(sTop1);
  g.add(sack1);

  // Saco parado mediano inclinado
  const sack2 = new THREE.Group();
  sack2.position.set(0.58, 0, -0.1);
  sack2.rotation.z = -0.2;
  const sBody2 = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), burlapMat);
  sBody2.scale.set(1.0, 1.2, 0.9);
  sBody2.position.y = 0.26;
  sBody2.castShadow = true;
  sack2.add(sBody2);
  const sRope2 = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.025, 8, 16), darkRopeMat);
  sRope2.rotation.x = Math.PI / 2;
  sRope2.position.y = 0.46;
  sack2.add(sRope2);
  g.add(sack2);

  // Saco 3 volcado derramando monedas
  const sack3 = new THREE.Group();
  sack3.position.set(0.25, 0.12, 0.3);
  sack3.rotation.z = Math.PI / 2.4;
  sack3.rotation.y = 0.45;
  const sBody3 = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), burlapMat);
  sBody3.scale.set(0.9, 1.3, 0.9);
  sack3.add(sBody3);
  g.add(sack3);

  // 3. Alfombra abundante de Monedas de Oro Brillantes derramadas
  const coinGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.016, 8);
  for (let i = 0; i < 45; i++) {
    const coin = new THREE.Mesh(coinGeo, goldMat);
    const ang = Math.random() * Math.PI * 2;
    const r = 0.1 + Math.random() * 0.65;
    coin.position.set(0.2 + Math.cos(ang) * r, 0.012 + (i % 4) * 0.015, 0.2 + Math.sin(ang) * r);
    coin.rotation.set((Math.random() - 0.5) * 0.25, Math.random() * Math.PI, (Math.random() - 0.5) * 0.25);
    coin.castShadow = true;
    g.add(coin);
  }

  // Gemas preciosas cortadas mezcladas con las monedas
  const gemGeo = new THREE.OctahedronGeometry(0.045, 0);
  [
    [0.15, 0.04, 0.35, gemRubyMat],
    [0.35, 0.04, 0.15, gemEmeraldMat],
    [-0.05, 0.04, 0.45, gemSapphireMat],
    [0.45, 0.04, 0.4, gemRubyMat],
    [-0.45, 0.04, 0.18, gemEmeraldMat]
  ].forEach(([gx, gy, gz, gMat]) => {
    const gem = new THREE.Mesh(gemGeo, gMat);
    gem.position.set(gx, gy, gz);
    g.add(gem);
  });

  // Luz dorada cálida que hace resplandecer todo el tesoro
  const goldLight = new THREE.PointLight(0xffb703, 2.2, 5.0);
  goldLight.position.set(0, 0.8, 0.2);
  g.add(goldLight);

  return g;
}

// ── Paleta Oficial Bradesco & Heráldica ─────────────────────────────────────────
const BRAND_PALETTE = {
  red: 0xCC092F,         // Vermelho Bradesco (PMS 186)
  darkRed: 0x900F15,     // Vermelho Escuro Bradesco (PMS 7427)
  deepRed: 0xBA0A29,
  cream: 0xF8F6F0,       // Wealth / Atacado Marfil
  greige: 0xECE7DE,
  gray: 0x808285
};

function createBradescoBanner(height = 3.6) {
  const g = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x422c19, roughness: 0.85 });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37,
    emissive: 0x997518,
    emissiveIntensity: 0.35,
    metalness: 0.85,
    roughness: 0.25
  });
  const redBannerMat = new THREE.MeshStandardMaterial({ color: 0xCC092F, roughness: 0.65 });
  const darkRedMat = new THREE.MeshStandardMaterial({ color: 0x900F15, roughness: 0.65 });
  const goldTrimMat = new THREE.MeshStandardMaterial({ color: 0xf3cc78, metalness: 0.6, roughness: 0.3 });

  // Base de piedra labrada
  const stoneBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26, 0.32, 0.28, 8),
    new THREE.MeshStandardMaterial({ color: 0x6e685f, roughness: 0.9 })
  );
  stoneBase.position.y = 0.14;
  stoneBase.castShadow = true;
  g.add(stoneBase);

  // Mástil de madera noble
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, height, 10), poleMat);
  pole.position.y = height / 2 + 0.15;
  pole.castShadow = true;
  g.add(pole);

  // Remate de lanza dorada
  const spear = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.28, 6), brassMat);
  spear.position.y = height + 0.3;
  g.add(spear);

  // Travesaño superior
  const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 1.05, 8), poleMat);
  crossbar.rotation.z = Math.PI / 2;
  crossbar.position.set(0, height - 0.12, 0);
  g.add(crossbar);

  [-0.52, 0.52].forEach(x => {
    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), brassMat);
    finial.position.set(x, height - 0.12, 0);
    g.add(finial);
  });

  // Tela del estandarte en Vermelho Bradesco (#CC092F)
  const bannerCloth = new THREE.Mesh(new THREE.BoxGeometry(0.92, 1.6, 0.02), redBannerMat);
  bannerCloth.position.set(0, height - 0.95, 0.015);
  bannerCloth.castShadow = true;
  g.add(bannerCloth);

  // Cenefa inferior en Vermelho Escuro (#900F15)
  const bottomBorder = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.22, 0.025), darkRedMat);
  bottomBorder.position.set(0, height - 1.68, 0.018);
  g.add(bottomBorder);

  // Emblema heráldico central bordado en hilo de oro
  const crest = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.03), goldTrimMat);
  crest.rotation.z = Math.PI / 4;
  crest.position.set(0, height - 0.72, 0.02);
  g.add(crest);

  const innerCrest = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.035), darkRedMat);
  innerCrest.rotation.z = Math.PI / 4;
  innerCrest.position.set(0, height - 0.72, 0.022);
  g.add(innerCrest);

  return g;
}

function createFoundationalMonument() {
  const g = new THREE.Group();
  // Paleta 100% coherente con la cantería y bronces de KayKit
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x756f65, roughness: 0.88 });
  const stoneTrimMat = new THREE.MeshStandardMaterial({ color: 0x5e584f, roughness: 0.85 });
  const bronzeGoldMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37,
    emissive: 0x997518,
    emissiveIntensity: 0.35,
    metalness: 0.88,
    roughness: 0.25
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xc59b27,
    metalness: 0.90,
    roughness: 0.24
  });
  const brandDarkRedMat = new THREE.MeshStandardMaterial({
    color: 0x900F15,
    roughness: 0.45
  });

  // 1. Base monumental circular escalonada de piedra medieval
  const base1 = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.6, 0.25, 16), stoneTrimMat);
  base1.position.y = 0.125;
  base1.receiveShadow = true;
  g.add(base1);

  const base2 = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.3, 0.25, 16), stoneMat);
  base2.position.y = 0.375;
  base2.receiveShadow = true;
  g.add(base2);

  // Pedestal octogonal moldurado de piedra labrada
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.88, 0.65, 8), stoneMat);
  plinth.position.y = 0.825;
  plinth.castShadow = true;
  g.add(plinth);

  // Moldura con ribete en Vermelho Escuro Bradesco y bronce
  const plinthRing = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.038, 8, 24), bronzeGoldMat);
  plinthRing.rotation.x = Math.PI / 2;
  plinthRing.position.y = 1.15;
  g.add(plinthRing);

  const brandAccentRing = new THREE.Mesh(new THREE.TorusGeometry(0.785, 0.02, 8, 24), brandDarkRedMat);
  brandAccentRing.rotation.x = Math.PI / 2;
  brandAccentRing.position.y = 1.12;
  g.add(brandAccentRing);

  // 4 Placas conmemorativas de bronce con la historia y el propósito
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2;
    const plaque = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.24, 0.025), bronzeGoldMat);
    plaque.position.set(Math.sin(ang) * 0.78, 0.82, Math.cos(ang) * 0.78);
    plaque.rotation.y = ang;
    g.add(plaque);
  }

  // 2. Esfera Armilar & Gran Astrolabio Solar de Bronce Dorado (Escala incrementada)
  const armillary = new THREE.Group();
  armillary.position.y = 1.72;

  // Base del astrolabio
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.2, 0.38, 12), brassMat);
  stand.position.y = -0.19;
  armillary.add(stand);

  // Anillo meridiano exterior fijo (radio 0.72)
  const meridian = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.042, 8, 32), bronzeGoldMat);
  armillary.add(meridian);

  // Anillo armilar 1 (rotación continua, radio 0.62)
  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.036, 8, 32), brassMat);
  ring1.rotation.x = Math.PI / 3;
  armillary.add(ring1);

  // Anillo armilar 2 (rotación continua, radio 0.52)
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.032, 8, 32), bronzeGoldMat);
  ring2.rotation.y = Math.PI / 4;
  armillary.add(ring2);

  // Núcleo: Sol Dorado del Propósito con corona de bronce
  const sun = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 16), bronzeGoldMat);
  armillary.add(sun);

  // Flecha solar del tiempo
  const arrow = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.55, 8), bronzeGoldMat);
  arrow.rotation.z = Math.PI / 6;
  armillary.add(arrow);

  // Luz ámbar dorada envolvente
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
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x756f65, roughness: 0.88 });
  const stoneTrimMat = new THREE.MeshStandardMaterial({ color: 0x5e584f, roughness: 0.85 });
  const bronzeGoldMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37,
    emissive: 0x997518,
    emissiveIntensity: 0.35,
    metalness: 0.88,
    roughness: 0.25
  });
  const velvetMat = new THREE.MeshStandardMaterial({ color: BRAND_PALETTE.red, roughness: 0.55 });
  const parchmentMat = new THREE.MeshStandardMaterial({ color: BRAND_PALETTE.cream, roughness: 0.75 });

  // 4 Columnas / Estelas Conmemorativas de las Eras en arco abierto
  const milestones = [
    { x: -1.65, z: 0.25, rotY: 0.28, era: '1998 · EL ORIGEN', icon: 'scroll' },
    { x: -0.55, z: -0.05, rotY: 0.12, era: '2008 · EXPANSIÓN', icon: 'compass' },
    { x: 0.55, z: -0.05, rotY: -0.12, era: '2018 · INNOVACIÓN', icon: 'gear' },
    { x: 1.65, z: 0.25, rotY: -0.28, era: 'PRESENTE · IMPACTO', icon: 'crown' }
  ];

  milestones.forEach((m, idx) => {
    const col = new THREE.Group();
    col.position.set(m.x, 0, m.z);
    col.rotation.y = m.rotY;

    // Base escalonada de piedra medieval
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.16, 0.62), stoneTrimMat);
    b1.position.y = 0.08;
    b1.receiveShadow = true;
    col.add(b1);

    const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.14, 0.48), stoneMat);
    b2.position.y = 0.23;
    col.add(b2);

    // Fuste de la estela clásica
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.48, 1.15, 0.38), stoneMat);
    shaft.position.y = 0.875;
    shaft.castShadow = true;
    col.add(shaft);

    // Cornisa superior
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.12, 0.46), stoneTrimMat);
    cap.position.y = 1.51;
    col.add(cap);

    // Placa de bronce grabada con el hito
    const tag = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.18, 0.02), bronzeGoldMat);
    tag.position.set(0, 0.92, 0.2);
    col.add(tag);

    // Reliquia dorada en la cima de cada pedestal:
    if (m.icon === 'scroll') {
      // 1. Códice / Pergamino Fundacional con lacre
      const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.07, 0.26), velvetMat);
      cushion.position.set(0, 1.61, 0);
      col.add(cushion);

      const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.26, 8), parchmentMat);
      roll.rotation.z = Math.PI / 2;
      roll.position.set(0, 1.69, 0);
      col.add(roll);

      const waxSeal = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.015, 8), velvetMat);
      waxSeal.position.set(0, 1.74, 0.03);
      col.add(waxSeal);
    } else if (m.icon === 'compass') {
      // 2. Brújula náutica de bronce de expedición
      const cmp = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.08, 16), bronzeGoldMat);
      cmp.position.set(0, 1.61, 0);
      col.add(cmp);

      const needle = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.24, 4), bronzeGoldMat);
      needle.rotation.x = Math.PI / 2;
      needle.position.set(0, 1.68, 0);
      col.add(needle);
    } else if (m.icon === 'gear') {
      // 3. Engranaje solar de bronce de innovación
      const gear = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.06, 8), bronzeGoldMat);
      gear.position.set(0, 1.62, 0);
      col.add(gear);

      const core = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 12), bronzeGoldMat);
      core.position.set(0, 1.72, 0);
      col.add(core);
    } else {
      // 4. Corona de laurel triunfal y antorcha de impacto
      const wreath = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 6, 16), bronzeGoldMat);
      wreath.rotation.x = Math.PI / 2;
      wreath.position.set(0, 1.62, 0);
      col.add(wreath);

      const torch = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.18, 6), bronzeGoldMat);
      torch.position.set(0, 1.74, 0);
      col.add(torch);
    }

    // Luz ámbar suave sobre cada hito
    const light = new THREE.PointLight(0xffd54f, 1.1, 2.2);
    light.position.set(0, 1.85, 0);
    col.add(light);

    g.add(col);

    // Cordón ceremonial de terciopelo carmesí entre pedestales
    if (idx < milestones.length - 1) {
      const nextM = milestones[idx + 1];
      const midX = (m.x + nextM.x) / 2;
      const midZ = (m.z + nextM.z) / 2;
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.95, 8), velvetMat);
      rope.rotation.z = Math.PI / 2;
      rope.position.set(midX, 0.85, midZ + 0.12);
      g.add(rope);
    }
  });

  return g;
}

function createCorporateHeritageMemorial() {
  const g = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x756f65, roughness: 0.88 });
  const stoneTrimMat = new THREE.MeshStandardMaterial({ color: 0x5e584f, roughness: 0.85 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x5a3d28, roughness: 0.80 });
  const bronzeGoldMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37,
    emissive: 0x997518,
    emissiveIntensity: 0.35,
    metalness: 0.88,
    roughness: 0.25
  });
  const parchmentMat = new THREE.MeshStandardMaterial({ color: BRAND_PALETTE.cream, roughness: 0.75 });
  const velvetMat = new THREE.MeshStandardMaterial({ color: BRAND_PALETTE.red, roughness: 0.55 });
  const brandDarkRedMat = new THREE.MeshStandardMaterial({ color: BRAND_PALETTE.darkRed, roughness: 0.55 });

  // 1. Muro Conmemorativo de los Tres Pilares (Misión, Visión, Valores)
  const wallBase = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.25, 0.5), stoneTrimMat);
  wallBase.position.set(0, 0.125, -0.4);
  wallBase.receiveShadow = true;
  g.add(wallBase);

  const mainWall = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.4, 0.3), stoneMat);
  mainWall.position.set(0, 0.95, -0.4);
  mainWall.castShadow = true;
  g.add(mainWall);

  const wallCap = new THREE.Mesh(new THREE.BoxGeometry(2.85, 0.18, 0.42), stoneTrimMat);
  wallCap.position.set(0, 1.74, -0.4);
  g.add(wallCap);

  // 3 Placas de Bronce Grabadas con los Pilares Institucionales y marco esmaltado Vermelho Escuro Bradesco
  const pillars = [
    { x: -0.85, title: 'MISIÓN' },
    { x: 0, title: 'VISIÓN' },
    { x: 0.85, title: 'VALORES' }
  ];

  pillars.forEach(p => {
    // Marco esmaltado en Vermelho Escuro Bradesco (#900F15)
    const plaqueBack = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.83, 0.02), brandDarkRedMat);
    plaqueBack.position.set(p.x, 1.0, -0.245);
    g.add(plaqueBack);

    // Placa conmemorativa de bronce
    const plaque = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.79, 0.03), bronzeGoldMat);
    plaque.position.set(p.x, 1.0, -0.24);
    g.add(plaque);

    // Medallón en relieve
    const emblem = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 16), bronzeGoldMat);
    emblem.rotation.x = Math.PI / 2;
    emblem.position.set(p.x, 1.18, -0.22);
    g.add(emblem);
  });

  // 2. Gran Atril de Piedra con el Libro Abierto de las Crónicas de la Empresa
  const lecternBase = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.4, 0.2, 8), stoneTrimMat);
  lecternBase.position.set(-0.6, 0.1, 0.6);
  g.add(lecternBase);

  const lecternPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.8, 8), stoneMat);
  lecternPillar.position.set(-0.6, 0.6, 0.6);
  lecternPillar.castShadow = true;
  g.add(lecternPillar);

  const lecternTop = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.06, 0.55), woodMat);
  lecternTop.position.set(-0.6, 1.05, 0.6);
  lecternTop.rotation.x = -0.32;
  g.add(lecternTop);

  // Libro de las Crónicas Abierto
  const bookCover = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.03, 0.44), woodMat);
  bookCover.position.set(-0.6, 1.08, 0.6);
  bookCover.rotation.x = -0.32;
  g.add(bookCover);

  const bookPages = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.05, 0.4), parchmentMat);
  bookPages.position.set(-0.6, 1.11, 0.6);
  bookPages.rotation.x = -0.32;
  g.add(bookPages);

  // Cinta marcapáginas carmesí
  const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.015, 0.45), velvetMat);
  ribbon.position.set(-0.6, 1.14, 0.6);
  ribbon.rotation.x = -0.32;
  g.add(ribbon);

  // Pluma de ave de bronce y tintero
  const inkwell = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.07, 8), bronzeGoldMat);
  inkwell.position.set(-0.25, 1.09, 0.48);
  g.add(inkwell);

  const quill = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.015, 0.28, 6), bronzeGoldMat);
  quill.rotation.z = Math.PI / 4;
  quill.rotation.x = 0.2;
  quill.position.set(-0.22, 1.2, 0.48);
  g.add(quill);

  // 3. Farol Conmemorativo de Forja
  const lampPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 1.6, 8), stoneTrimMat);
  lampPillar.position.set(1.1, 0.8, 0.5);
  lampPillar.castShadow = true;
  g.add(lampPillar);

  const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.35, 0.24), bronzeGoldMat);
  lantern.position.set(1.1, 1.75, 0.5);
  g.add(lantern);

  const lampLight = new THREE.PointLight(0xffa726, 2.0, 4.5);
  lampLight.position.set(1.1, 1.75, 0.5);
  g.add(lampLight);

  // 4. Banco de piedra labrada para contemplación histórica
  const benchSeat = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 0.4), stoneMat);
  benchSeat.position.set(0.45, 0.45, 0.65);
  benchSeat.castShadow = true;
  g.add(benchSeat);

  [-0.05, 0.95].forEach(bx => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.4, 0.35), stoneTrimMat);
    leg.position.set(bx, 0.2, 0.65);
    g.add(leg);
  });

  return g;
}

function createNPSScaleMonument() {
  const g = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x756f65, roughness: 0.88 });
  const stoneTrimMat = new THREE.MeshStandardMaterial({ color: 0x5e584f, roughness: 0.85 });
  const bronzeGoldMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37,
    emissive: 0x997518,
    emissiveIntensity: 0.35,
    metalness: 0.88,
    roughness: 0.25
  });
  const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x442c1b, roughness: 0.85 });

  // Materiales de cristales luminosos para cada grupo de la escala NPS
  const detractorCrystalMat = new THREE.MeshStandardMaterial({
    color: 0xc0392b,
    emissive: 0x962d22,
    emissiveIntensity: 0.75,
    roughness: 0.18,
    metalness: 0.2
  });
  const passiveCrystalMat = new THREE.MeshStandardMaterial({
    color: 0xf39c12,
    emissive: 0xd68910,
    emissiveIntensity: 0.75,
    roughness: 0.18,
    metalness: 0.2
  });
  const promoterCrystalMat = new THREE.MeshStandardMaterial({
    color: 0x27ae60,
    emissive: 0x1e8449,
    emissiveIntensity: 0.85,
    roughness: 0.18,
    metalness: 0.2
  });

  // 1. Base monumental circular escalonada de cantería medieval
  const base1 = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.5, 0.22, 24), stoneTrimMat);
  base1.position.y = 0.11;
  base1.receiveShadow = true;
  g.add(base1);

  const base2 = new THREE.Mesh(new THREE.CylinderGeometry(1.95, 2.15, 0.2, 24), stoneMat);
  base2.position.y = 0.32;
  base2.receiveShadow = true;
  g.add(base2);

  // 2. Las 11 Columnas de la Escala NPS (0 al 10) distribuidas en semicírculo
  const totalSteps = 11;
  const arcSpan = Math.PI * 0.95; // Semicírculo amplio
  const startAng = -arcSpan / 2;
  const radius = 1.65;

  for (let i = 0; i < totalSteps; i++) {
    const fraction = i / (totalSteps - 1);
    const ang = startAng + fraction * arcSpan;
    const px = Math.sin(ang) * radius;
    const pz = Math.cos(ang) * radius;

    const colGroup = new THREE.Group();
    colGroup.position.set(px, 0.42, pz);
    colGroup.rotation.y = ang + Math.PI;

    // Altura progresiva que simboliza superación y excelencia
    const colHeight = 0.45 + (i >= 9 ? 0.35 : (i >= 7 ? 0.2 : 0.05));
    const colMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, colHeight, 0.24), stoneMat);
    colMesh.position.y = colHeight / 2;
    colMesh.castShadow = true;
    colGroup.add(colMesh);

    // Cornisa de la columna
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.06, 0.28), stoneTrimMat);
    cap.position.y = colHeight + 0.03;
    colGroup.add(cap);

    // Cristal luminoso de calificación (0-6 Rubí, 7-8 Ámbar, 9-10 Esmeralda)
    let cMat = detractorCrystalMat;
    if (i >= 9) cMat = promoterCrystalMat;
    else if (i >= 7) cMat = passiveCrystalMat;

    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), cMat);
    crystal.position.y = colHeight + 0.18;
    colGroup.add(crystal);

    // Placa numerada de bronce (0 a 10)
    const numPlaque = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.02), bronzeGoldMat);
    numPlaque.position.set(0, colHeight * 0.55, 0.125);
    colGroup.add(numPlaque);

    g.add(colGroup);
  }

  // 3. Rótulos de Bronce de los 3 Grupos de Clientes en el friso
  // Detractores (Izquierda)
  const detPlaque = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.15, 0.025), bronzeGoldMat);
  detPlaque.position.set(-1.15, 0.26, 0.95);
  detPlaque.rotation.y = 0.65;
  g.add(detPlaque);

  // Pasivos / Neutros (Centro)
  const pasPlaque = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.15, 0.025), bronzeGoldMat);
  pasPlaque.position.set(0.45, 0.26, 1.35);
  pasPlaque.rotation.y = -0.15;
  g.add(pasPlaque);

  // Promotores (Derecha)
  const proPlaque = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.15, 0.025), bronzeGoldMat);
  proPlaque.position.set(1.25, 0.26, 0.85);
  proPlaque.rotation.y = -0.7;
  g.add(proPlaque);

  // 4. Centro: Pedestal con el Gran Dial del NPS y Fórmula de Cálculo
  const centerPlinth = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.75, 0.75, 16), stoneMat);
  centerPlinth.position.y = 0.795;
  centerPlinth.castShadow = true;
  g.add(centerPlinth);

  const dialRing = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.04, 8, 32), bronzeGoldMat);
  dialRing.position.y = 1.18;
  dialRing.rotation.x = Math.PI / 2;
  g.add(dialRing);

  // Esfera / Reloj de Aguja que apunta a la excelencia
  const dialFace = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.54, 0.04, 24), stoneTrimMat);
  dialFace.position.y = 1.17;
  g.add(dialFace);

  const needle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.46), bronzeGoldMat);
  needle.position.set(0.08, 1.20, -0.12);
  needle.rotation.y = -0.45;
  g.add(needle);

  const needleHub = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), bronzeGoldMat);
  needleHub.position.y = 1.21;
  g.add(needleHub);

  // Luces sutiles que bañan el monumento con los tres tonos canónicos
  const detLight = new THREE.PointLight(0xe74c3c, 1.2, 3.2);
  detLight.position.set(-1.1, 1.1, 0.8);
  g.add(detLight);

  const proLight = new THREE.PointLight(0x2ecc71, 1.5, 3.8);
  proLight.position.set(1.1, 1.3, 0.8);
  g.add(proLight);

  return g;
}

function createNPSSurveyDesk() {
  const g = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x756f65, roughness: 0.88 });
  const stoneTrimMat = new THREE.MeshStandardMaterial({ color: 0x5e584f, roughness: 0.85 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x5a3d28, roughness: 0.80 });
  const bronzeGoldMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37,
    emissive: 0x997518,
    emissiveIntensity: 0.35,
    metalness: 0.88,
    roughness: 0.25
  });
  const parchmentMat = new THREE.MeshStandardMaterial({ color: BRAND_PALETTE.cream, roughness: 0.75 });
  const velvetMat = new THREE.MeshStandardMaterial({ color: BRAND_PALETTE.red, roughness: 0.55 });

  // 1. Mostrador de Piedra y Roble para la Consulta y Atención
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.85, 0.85), stoneMat);
  base.position.y = 0.425;
  base.castShadow = true;
  g.add(base);

  const tableTop = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.08, 0.95), woodMat);
  tableTop.position.y = 0.89;
  tableTop.castShadow = true;
  g.add(tableTop);

  // 2. Gran Pergamino Desplegado con la Pregunta de Oro del NPS
  const parchment = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.015, 0.65), parchmentMat);
  parchment.position.set(-0.25, 0.94, 0.05);
  g.add(parchment);

  // Sello oficial de lacre en Vermelho Bradesco (#CC092F)
  const waxSeal = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.02, 8), velvetMat);
  waxSeal.position.set(-0.25, 0.955, 0.28);
  g.add(waxSeal);

  // 11 Fichas / Runas Doradas de Calificación (0 al 10) sobre el mostrador
  for (let i = 0; i <= 10; i++) {
    const rx = -0.75 + (i * 0.1);
    const token = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 12), bronzeGoldMat);
    token.position.set(rx, 0.96, 0.26);
    g.add(token);
  }

  // 3. Urna de la Voz del Cliente (Voice of Customer) con ranura de sugerencias
  const ballotBox = new THREE.Group();
  ballotBox.position.set(0.68, 0.93, -0.05);

  const boxBody = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.45, 0.35), woodMat);
  boxBody.position.y = 0.225;
  boxBody.castShadow = true;
  ballotBox.add(boxBody);

  // Cinta decorativa de la urna en Vermelho Bradesco
  const boxRibbon = new THREE.Mesh(new THREE.BoxGeometry(0.43, 0.06, 0.36), velvetMat);
  boxRibbon.position.y = 0.25;
  ballotBox.add(boxRibbon);

  const boxCap = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.05, 0.38), bronzeGoldMat);
  boxCap.position.y = 0.475;
  ballotBox.add(boxCap);

  // Ranura dorada
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.015, 0.03), stoneTrimMat);
  slot.position.set(0, 0.505, 0);
  ballotBox.add(slot);

  // Placa de la urna
  const bPlaque = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.1, 0.015), bronzeGoldMat);
  bPlaque.position.set(0, 0.25, 0.18);
  ballotBox.add(bPlaque);

  g.add(ballotBox);

  // Pluma de ave de bronce y tintero
  const ink = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.08, 8), bronzeGoldMat);
  ink.position.set(0.45, 0.97, 0.28);
  g.add(ink);

  const quill = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.015, 0.26, 6), bronzeGoldMat);
  quill.rotation.z = Math.PI / 4;
  quill.position.set(0.48, 1.07, 0.28);
  g.add(quill);

  // 4. Farol de Forja con Iluminación Ámbar Cálida
  const lampPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 1.5, 8), stoneTrimMat);
  lampPillar.position.set(-1.1, 0.75, -0.4);
  lampPillar.castShadow = true;
  g.add(lampPillar);

  const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.32, 0.22), bronzeGoldMat);
  lantern.position.set(-1.1, 1.62, -0.4);
  g.add(lantern);

  const warmLight = new THREE.PointLight(0xffa726, 1.8, 4.0);
  warmLight.position.set(-1.1, 1.62, -0.4);
  g.add(warmLight);

  return g;
}

function createNPSProtocolBoard() {
  const g = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x756f65, roughness: 0.88 });
  const stoneTrimMat = new THREE.MeshStandardMaterial({ color: 0x5e584f, roughness: 0.85 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x5a3d28, roughness: 0.80 });
  const bronzeGoldMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37,
    emissive: 0x997518,
    emissiveIntensity: 0.35,
    metalness: 0.88,
    roughness: 0.25
  });
  const parchmentMat = new THREE.MeshStandardMaterial({ color: BRAND_PALETTE.cream, roughness: 0.75 });
  const brandRedMat = new THREE.MeshStandardMaterial({ color: BRAND_PALETTE.red, roughness: 0.55 });

  // 1. Muro Arquitectónico del Protocolo de Cierre de Ciclo ("Closed Loop")
  const wallBase = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.22, 0.45), stoneTrimMat);
  wallBase.position.set(0, 0.11, 0);
  wallBase.receiveShadow = true;
  g.add(wallBase);

  const wall = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.35, 0.28), stoneMat);
  wall.position.set(0, 0.88, 0);
  wall.castShadow = true;
  g.add(wall);

  const wallCap = new THREE.Mesh(new THREE.BoxGeometry(2.65, 0.16, 0.38), stoneTrimMat);
  wallCap.position.set(0, 1.63, 0);
  g.add(wallCap);

  // 3 Paneles de Pergamino con los 3 Pasos del Cierre de Ciclo
  const steps = [
    { x: -0.75, title: '1. MOMENTO' },
    { x: 0, title: '2. PROFUNDIZAR' },
    { x: 0.75, title: '3. ACTUAR' }
  ];

  steps.forEach(s => {
    // Marco de madera noble
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.85, 0.04), woodMat);
    frame.position.set(s.x, 0.95, 0.15);
    g.add(frame);

    // Pergamino interior en tono Wealth marfil
    const pSheet = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.72, 0.02), parchmentMat);
    pSheet.position.set(s.x, 0.95, 0.18);
    g.add(pSheet);

    // Franja superior de acento en Vermelho Bradesco (#CC092F)
    const stepRibbon = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.05, 0.025), brandRedMat);
    stepRibbon.position.set(s.x, 1.28, 0.19);
    g.add(stepRibbon);

    // Placa de bronce del paso
    const tag = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.12, 0.025), bronzeGoldMat);
    tag.position.set(s.x, 1.22, 0.2);
    g.add(tag);
  });

  // 2. Banco de Piedra Labrada Medieval para lectura del protocolo
  const bench = new THREE.Group();
  bench.position.set(0, 0, 0.95);

  const bSeat = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.42), stoneMat);
  bSeat.position.y = 0.44;
  bSeat.castShadow = true;
  bench.add(bSeat);

  [-0.55, 0.55].forEach(bx => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.4, 0.36), stoneTrimMat);
    leg.position.set(bx, 0.2, 0);
    bench.add(leg);
  });

  g.add(bench);

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
      await spawn(ASSETS.buildings.townhall, 5.2, [0, 0, -3.8], 0);

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

      // Guía rúnica flotante de bienvenida Vermelho Bradesco
      const guideGem = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.32, 0),
        new THREE.MeshStandardMaterial({ color: BRAND_PALETTE.red, emissive: BRAND_PALETTE.darkRed, emissiveIntensity: 2.5, roughness: 0.22 })
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
        new THREE.MeshStandardMaterial({ color: BRAND_PALETTE.red, emissive: BRAND_PALETTE.darkRed, emissiveIntensity: 2.2, roughness: 0.3 })
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

      // Núcleo rúnico carmesí Bradesco en el sello
      const sealCore = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.18, 0),
        new THREE.MeshStandardMaterial({ color: BRAND_PALETTE.red, emissive: BRAND_PALETTE.darkRed, emissiveIntensity: 1.8, roughness: 0.25 })
      );
      sealCore.position.set(0, sealY + 1.8, 0);
      g.add(sealCore);
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

    case 'safety':
    case 'observatory': {
      // ═════════════════════════════════════════════════════════════════════════
      // MISIÓN 04: PROTECCIÓN CIVIL Y ESTACIONAMIENTO (Altos de la Vigilancia)
      // Versión limpia y medieval: Atalaya, módulo de protección civil (rack),
      // cobertizo techado con 3 carrozas temáticas y pluma de acceso con señal "P".
      // Cero árboles en entradas ni salidas.
      // ═════════════════════════════════════════════════════════════════════════

      // 1. TORRE DE VIGILANCIA (Atalaya de piedra con cono azul)
      await spawn(ASSETS.buildings.tower, 9.2, [-4.5, 0, -1.8], 0);

      // Torreta con sirena de emergencia
      const siren = createEmergencySiren();
      const sirenY = getTerrainY(mission.x - 6.5, mission.z - 1.8);
      siren.position.set(-6.5, sirenY, -1.8);
      g.add(siren);

      // 2. MÓDULO DE PROTECCIÓN CIVIL (Rack de madera rústica sin texto moderno)
      const safetyRack = createSafetyStationRack();
      const rackY = getTerrainY(mission.x - 1.8, mission.z - 0.2);
      safetyRack.position.set(-1.8, rackY, -0.2);
      g.add(safetyRack);

      // Hidrante clásico rojo y latón en la acera
      const hydrant = createFireHydrant();
      const hydY = getTerrainY(mission.x - 0.3, mission.z + 1.2);
      hydrant.position.set(-0.3, hydY, 1.2);
      g.add(hydrant);

      // 3. ESTACIONAMIENTO TECHADO CON 3 CARROZAS
      const parkX = 0.5;
      const parkZ = -0.3;
      const parkY = getTerrainY(mission.x + parkX + 2.7, mission.z + parkZ);

      // Cobertizo de madera con tejado azul pizarra
      const carport = createCarport(5.4, 3.4, 2.3);
      carport.position.set(parkX, parkY, parkZ);
      g.add(carport);

      // 3 Cajones delimitados con líneas amarillas y números
      const stalls = createParkingStalls();
      stalls.position.set(parkX, parkY + 0.01, parkZ);
      g.add(stalls);

      // CARROZA #1: Azul Real en Cajón 1
      const carriage1 = createCarriage({ color: 0x1f618d, roofColor: 0x154360, trimGold: true });
      const c1Y = getTerrainY(mission.x + parkX + 0.9, mission.z + parkZ);
      carriage1.position.set(parkX + 0.9, c1Y, parkZ);
      carriage1.rotation.y = 0;
      g.add(carriage1);

      // CARROZA #2: Borgoña Noble en Cajón 2
      const carriage2 = createCarriage({ color: 0x78281f, roofColor: 0x512e2b, trimGold: true });
      const c2Y = getTerrainY(mission.x + parkX + 2.7, mission.z + parkZ);
      carriage2.position.set(parkX + 2.7, c2Y, parkZ);
      carriage2.rotation.y = 0;
      g.add(carriage2);

      // CARROZA #3: Verde Esmeralda en Cajón 3
      const carriage3 = createCarriage({ color: 0x1e8449, roofColor: 0x145a32, trimGold: true });
      const c3Y = getTerrainY(mission.x + parkX + 4.5, mission.z + parkZ);
      carriage3.position.set(parkX + 4.5, c3Y, parkZ);
      carriage3.rotation.y = 0;
      g.add(carriage3);

      // 4. CONTROL DE ACCESO VEHICULAR
      // Pluma de acceso vehicular alzada a 45°
      const barrier = createParkingBarrier({ isOpen: true });
      const barrierY = getTerrainY(mission.x + 0.3, mission.z + 1.8);
      barrier.position.set(0.3, barrierY, 1.8);
      g.add(barrier);

      // Señal oficial azul "P" de Estacionamiento
      const pSign = createParkingSign();
      const pSignY = getTerrainY(mission.x + 0.1, mission.z + 2.0);
      pSign.position.set(0.1, pSignY, 2.0);
      g.add(pSign);

      // Cajas de suministros y herramientas en el lateral exterior
      await spawn(ASSETS.props.stackedBoxes, 1.1, [6.8, 0, -0.6], 0.3);

      // 5. VEGETACIÓN PERIMETRAL BAJA (Sin árboles en accesos)
      await spawn(ASSETS.bushes[0], 1.3, [-6.4, 0, 1.2], 0.4);
      await spawn(ASSETS.bushes[1], 1.3, [7.8, 0, 1.6], -0.4);

      // Baliza de emergencia luminosa sobre la torre de vigilancia
      const beaconGem = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.35, 0),
        new THREE.MeshStandardMaterial({ color: 0x2ecc71, emissive: 0x27ae60, emissiveIntensity: 2.8, roughness: 0.2 })
      );
      const beaconY = getTerrainY(mission.x - 4.5, mission.z - 1.8);
      beaconGem.position.set(-4.5, beaconY + 9.6, -1.8);
      g.add(beaconGem);
      g.userData.crystal = beaconGem;
      break;
    }

    case 'vault':
    case 'plaza': {
      // ═════════════════════════════════════════════════════════════════════════
      // MISIÓN 05: TARJETA COSMOS (Bóveda Cosmos)
      // Diseño 100% coherente con la arquitectura del juego y rico en riqueza:
      // - Edificio KayKit Workshop (sin árboles colisionando en su chimenea)
      // - Mesa de banquero limpia sin comida ni vajilla, fuera del porche de bolas de cañón
      // - Talismán Dorado Cosmos flotante de mayor tamaño con monedas en la base
      // - Gran despliegue de dinero: lingotes de oro de 24K en pirámide, sacos de monedas abiertos,
      //   cofre de oro del gremio y alfombra de monedas derramadas
      // - Pertrechos comerciales ordenados en el lateral derecho
      // - Entorno natural espacioso sin colisiones
      // ═════════════════════════════════════════════════════════════════════════

      // 1. EDIFICIO PRINCIPAL (Gremio / Bóveda Comercial KayKit)
      await spawn(ASSETS.buildings.workshop, 6.2, [0, 0, -3.4], 0);

      // 2. CENTRO: TALISMÁN DORADO DE LA TARJETA COSMOS
      const talismanAltar = createCosmosGoldenTalisman();
      const altY = getTerrainY(mission.x, mission.z + 0.2);
      talismanAltar.position.set(0, altY, 0.2);
      g.add(talismanAltar);
      g.userData.cosmosCard = talismanAltar.userData.cardMesh;
      g.userData.cosmosCardBaseY = 1.75;

      // 3. MESA DE FIRMA DE CONTRATOS, CONVENIOS Y BALANZA (Despejada del porche de bolas)
      const desk = createContractDesk();
      const dtY = getTerrainY(mission.x - 3.4, mission.z + 0.8);
      desk.position.set(-3.4, dtY, 0.8);
      desk.rotation.y = 0.28;
      g.add(desk);



      // 4. GRAN DESPLIEGUE DE RIQUEZA Y DINERO: COFRE, LINGOTES Y SACOS DE MONEDAS
      await spawn(ASSETS.props.chest, 0.95, [1.8, 0, 0.5], -0.25);
      const treasure = createWealthTreasureDisplay();
      const trY = getTerrainY(mission.x + 1.8, mission.z + 0.8);
      treasure.position.set(1.8, trY, 0.8);
      g.add(treasure);

      // 5. PERTRECHOS COMERCIALES Y CARGAS (Separados hacia el lateral)
      await spawn(ASSETS.props.stackedBoxes, 1.25, [3.8, 0, -0.4], -0.3);
      await spawn(ASSETS.props.barrel, 1.05, [4.0, 0, 0.8], 0.3);
      await spawn(ASSETS.props.largeBox, 0.95, [3.2, 0, -1.6], 0.2);

      // 6. ENTORNO NATURAL LIMPIO Y SIN COLISIONES (Cero árboles en la chimenea)
      await spawn(ASSETS.trees[1], 6.8, [-8.2, 0, -4.5], 0.4);
      await spawn(ASSETS.trees[3], 6.5, [8.2, 0, -4.5], -0.4);
      await spawn(ASSETS.trees[0], 6.5, [-5.8, 0, -7.5], 0.2);
      await spawn(ASSETS.bushes[0], 1.3, [-5.5, 0, 1.6], 0.3);
      await spawn(ASSETS.bushes[1], 1.3, [5.5, 0, 1.6], -0.3);
      await spawn(ASSETS.rocks[1], 1.2, [-6.2, 0, -1.2], 0.5);
      await spawn(ASSETS.rocks[2], 1.2, [6.2, 0, -1.2], -0.5);
      await spawn(ASSETS.animals.deer, 1.0, [-7.5, 0, 1.0], 0.8);
      break;
    }

    case 'history':
    case 'harbor': {
      // ═════════════════════════════════════════════════════════════════════════
      // MISIÓN 06: INTRODUCCIÓN A LA COMPAÑÍA (Gran Salón Consistorial & Museo Histórico)
      // Paleta 100% coherente con las estaciones previas: cantería medieval, roble y bronce dorado.
      // Entorno exuberante y vivo (cero seco): árboles nobles, jardineras de arbustos y fauna.
      // Elementos que denotan la historia de la empresa:
      // 1. Gran Ayuntamiento Cívico de la Organización (ASSETS.buildings.townhall).
      // 2. Mesa ceremonial de cancillería oficial de KayKit (ASSETS.props.signingTable).
      // 3. Arcas y cofres de oro fundacionales con documentos históricos (ASSETS.props.chest).
      // 4. Gran Astrolabio Solar del Tiempo y Obelisco de la Fundación en el centro.
      // 5. Galería Abierta de las 4 Eras Históricas (1998, 2008, 2018, Presente).
      // 6. Carta Magna / Gran Mapa de Expansión, Libros de Actas, Candelabro y Globo Náutico.
      // 7. Jardines y arboleda noble perimetral que otorgan frescura y vida natural.
      // ═════════════════════════════════════════════════════════════════════════

      // 1. GRAN AYUNTAMIENTO CÍVICO & CASA CONSISTORIAL DE LA COMPAÑÍA
      await spawn(ASSETS.buildings.townhall, 7.0, [0, 0, -3.6], 0);

      // 2. CENTRO: GRAN ASTROLABIO & OBELISCO SOLAR DE LA FUNDACIÓN
      const monument = createFoundationalMonument();
      const monY = getTerrainY(mission.x, mission.z + 0.3);
      monument.position.set(0, monY, 0.3);
      g.add(monument);
      if (monument.userData?.ring1 && monument.userData?.ring2) {
        g.userData.armillaryRing1 = monument.userData.ring1;
        g.userData.armillaryRing2 = monument.userData.ring2;
      }



      // 3. FLANCO IZQUIERDO: GALERÍA DE LAS ERAS HISTÓRICAS (1998, 2008, 2018, HOY)
      // Disposición semicircular envolvente
      const milestones = createHistoricalMilestonesGallery();
      const msY = getTerrainY(mission.x - 3.5, mission.z + 0.85);
      milestones.position.set(-3.5, msY, 0.85);
      milestones.rotation.y = 0.36;
      g.add(milestones);

      // 4. FLANCO DERECHO: MEMORIAL DE MISIÓN, VISIÓN, VALORES & GRAN LIBRO DE CRÓNICAS
      const heritageMemorial = createCorporateHeritageMemorial();
      const hmY = getTerrainY(mission.x + 3.5, mission.z + 0.85);
      heritageMemorial.position.set(3.5, hmY, 0.85);
      heritageMemorial.rotation.y = -0.36;
      g.add(heritageMemorial);

      // 5. ENTORNO ARBOLADO PERIMETRAL EN EL CÉSPED (Cero arbustos en el pavimento, robles majestuosos y ciervo noble)
      await spawn(ASSETS.trees[0], 7.2, [-8.5, 0, -4.5], 0.3);
      await spawn(ASSETS.trees[1], 7.0, [8.5, 0, -4.5], -0.3);
      await spawn(ASSETS.trees[2], 6.6, [0, 0, -7.5], 0);
      await spawn(ASSETS.trees[5], 6.2, [-8.8, 0, 1.8], 0.6);
      await spawn(ASSETS.rocks[1], 1.3, [-6.8, 0, -0.6], 0.5);
      await spawn(ASSETS.rocks[2], 1.3, [6.8, 0, -0.6], -0.5);
      await spawn(ASSETS.animals.stag, 1.25, [-7.4, 0, 0.8], 0.7);
      break;
    }

    case 'nps':
    case 'archive': {
      // ═════════════════════════════════════════════════════════════════════════
      // MISIÓN 07: NPS (Net Promoter Score & Satisfacción al Cliente)
      // Paleta 100% armonizada: Cantería medieval, roble noble, bronce histórico y detalles Bradesco.
      // Cero comida, cero cofres piratas, cero barriles, cero bolas verdes en el piso.
      // 1. Casa Consistorial / Gremio de Atención al Cliente (ASSETS.buildings.home).
      // 2. Centro: Gran Monumento de la Escala NPS 0-10 con cristales rubí Bradesco, ámbar y esmeralda.
      // 3. Flanco Izquierdo: Módulo de Aplicación de la Encuesta con la Pregunta de Oro, fichas y Urna.
      // 4. Flanco Derecho: Muro del Protocolo de Cierre de Ciclo ("Closed Loop") y banco de lectura.
      // 5. Estandartes Oficiales de Marca Bradesco en los flancos de la plaza.
      // 6. Arboleda perimetral en el pasto y fauna sin invadir la plaza.
      // ═════════════════════════════════════════════════════════════════════════

      // 1. EDIFICIO CIVIL CONSISTORIAL DE ATENCIÓN AL CLIENTE (KayKit)
      await spawn(ASSETS.buildings.home, 6.4, [0, 0, -3.6], 0);

      // 2. CENTRO: GRAN MONUMENTO Y TERMÓMETRO DE LA ESCALA NPS 0-10
      const npsScale = createNPSScaleMonument();
      const npsY = getTerrainY(mission.x, mission.z + 0.2);
      npsScale.position.set(0, npsY, 0.2);
      g.add(npsScale);



      // 3. FLANCO IZQUIERDO: MÓDULO DE LA ENCUESTA A CLIENTES (Pregunta de Oro, Fichas y Urna)
      // Disposición semicircular envolvente
      const surveyDesk = createNPSSurveyDesk();
      const sdY = getTerrainY(mission.x - 3.5, mission.z + 0.85);
      surveyDesk.position.set(-3.5, sdY, 0.85);
      surveyDesk.rotation.y = 0.38;
      g.add(surveyDesk);

      // 4. FLANCO DERECHO: PROTOCOLO DE CIERRE DE CICLO ("CLOSED LOOP")
      const protocolBoard = createNPSProtocolBoard();
      const pbY = getTerrainY(mission.x + 3.5, mission.z + 0.85);
      protocolBoard.position.set(3.5, pbY, 0.85);
      protocolBoard.rotation.y = -0.38;
      g.add(protocolBoard);

      // 5. ENTORNO ARBOLADO PERIMETRAL EN EL CÉSPED (Cero arbustos en el pavimento)
      await spawn(ASSETS.trees[2], 7.2, [-8.5, 0, -4.5], 0.3);
      await spawn(ASSETS.trees[4], 7.0, [8.5, 0, -4.5], -0.3);
      await spawn(ASSETS.trees[1], 6.6, [0, 0, -7.8], 0);
      await spawn(ASSETS.trees[5], 6.2, [-8.8, 0, 1.8], 0.5);
      await spawn(ASSETS.rocks[1], 1.3, [-6.8, 0, -0.6], 0.4);
      await spawn(ASSETS.rocks[2], 1.3, [6.8, 0, -0.6], -0.4);
      await spawn(ASSETS.animals.fox, 1.1, [-7.6, 0, 1.2], 0.8);
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
        const rad = (m.id === 4 || m.id === 5) ? 30.0 : 22.0;
        if (Math.hypot(x - m.x, z - m.z) < rad) return true;
      }
      if (this.trailPoints && this.trailPoints.length) {
        for (let i = 0; i < this.trailPoints.length; i++) {
          const pt = this.trailPoints[i];
          if (Math.hypot(x - pt.x, z - pt.y) < 9.5) return true;
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
