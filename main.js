import * as THREE from './vendor/three/build/three.module.js';
window.THREE = THREE;
import { OrbitControls } from './vendor/three/examples/jsm/controls/OrbitControls.js';
import { Sky } from './vendor/three/examples/jsm/objects/Sky.js';
import { installRealisticWorld, createHumanoidCharacter, createHeroModel, AVATAR_PRESETS } from './realistic-assets.js?v=299.0.0';

const $ = id => document.getElementById(id);
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = THREE.MathUtils.clamp;

function updateBootProgress(value, label) {
  const statusEl = document.getElementById('bootStatusText');
  const barEl = document.getElementById('bootProgressBar');
  const pctEl = document.getElementById('bootPct');
  const pct = Math.round(clamp(value, 0, 1) * 100);
  if (statusEl && label) statusEl.textContent = label;
  if (barEl) barEl.style.width = pct + '%';
  if (pctEl) pctEl.textContent = pct + '%';
}

updateBootProgress(0.15, 'Iniciando motor 3D...');

let bootReadyCalled = false;
function showBootReady() {
  if (bootReadyCalled) return;
  bootReadyCalled = true;
  updateBootProgress(1, 'Carga completada');
  const loaderBox = document.getElementById('bootLoaderBox');
  const actions = document.getElementById('bootActions');
  const startBtn = document.getElementById('bootStartBtn');
  if (loaderBox) {
    loaderBox.style.display = 'none';
  }
  if (actions) {
    actions.style.display = 'block';
  }
  if (startBtn) {
    startBtn.onclick = () => dismissBoot();
    startBtn.focus();
  }
  try {
    if (typeof setOverview3DMode === 'function') {
      setOverview3DMode(true, true);
    }
  } catch {}
}

// Global safety timeout so the boot screen can never hang
setTimeout(() => {
  if (!bootReadyCalled) {
    showBootReady();
  }
}, 5000);

function dismissBoot() {
  const b = document.getElementById('boot');
  if (b && !b.classList.contains('hidden')) {
    b.classList.add('hidden');
    setTimeout(() => {
      try { b.remove(); } catch {}
    }, 750);
  }
  try {
    if (typeof setOverview3DMode === 'function') {
      setOverview3DMode(true, true);
    }
  } catch {}
}
window.dismissBoot = dismissBoot;

// ── Mission Checkpoints Catalog (17 Official Onboarding Stations - Expanded Map) ──
const SEED = [
  { id: 0, name: 'Recepción & Kit de Expedición', desc: 'Recepción inicial, entrega de equipamiento de trabajo (laptop, credencial) y orientación de bienvenida.', region: 'Portal de Bienvenida', x: -360, z: 60, baseY: 1.0, type: 'welcome', hidden: true },
  { id: 1, name: 'Recepción & Kit de Expedición', desc: 'Recepción inicial, entrega de equipamiento de trabajo (laptop, credencial) y orientación de bienvenida.', region: 'Portal de Bienvenida', x: -360, z: 60, baseY: 1.0, type: 'welcome' },
  { id: 2, name: 'Pacto & Beneficios', desc: 'Firma formal del contrato individual de trabajo, alta de expediente laboral y catálogo de prestaciones y beneficios.', region: 'Portal de Bienvenida', x: -290, z: -40, baseY: 2.5, type: 'sanctuary' },
  { id: 3, name: 'Hoy Comienza tu Historia', desc: 'Bienvenida al grupo en sala, presentaciones breves, expectativas compartidas y explicación de la agenda del día.', region: 'Plaza de Integración', x: -225, z: -115, baseY: 4.5, type: 'integration' },
  { id: 4, name: 'Conoce de qué Formas Parte', desc: 'Historia breve, relación Bradesco–Bradescard, modelo de negocio, clientes, productos, cultura y estructura general.', region: 'Plaza de Integración', x: -150, z: -15, baseY: 1.5, type: 'history' },
  { id: 5, name: 'Nos Cuidamos, Cuidamos la Confianza', desc: 'Protección Civil, protocolos de emergencia y cuidados esenciales de accesos e información corporativa.', region: 'Plaza de Integración', x: -90, z: 65, baseY: 3.5, type: 'safety' },
  { id: 6, name: 'Pausa de Recarga', desc: 'Espacio de descanso, recarga de energía y café previo al bloque operativo.', region: 'Oasis de Descanso', x: -25, z: 125, baseY: 5.0, type: 'garden' },
  // Bloque Temático: Muévete con Confianza (Estaciones 7 a 10)
  { id: 7, name: 'Humand & Comedor', desc: 'Uso de la App Humand para registro de entradas/salidas, incidencias y lineamientos del comedor corporativo.', region: 'Muévete con Confianza', x: 50, z: 75, baseY: 2.0, type: 'camp' },
  { id: 8, name: 'Tarjeta Cosmos', desc: 'Paseo de la Ribera: Beneficios, convenios comerciales, descuentos y privilegios exclusivos de la Tarjeta Cosmos.', region: 'Muévete con Confianza', x: 95, z: -55, baseY: 2.0, type: 'vault' },
  { id: 9, name: 'Cultura & Comunicación Interna', desc: 'Canales oficiales de comunicación, valores compartidos y cómo nos mantenemos conectados.', region: 'Muévete con Confianza', x: 165, z: -115, baseY: 3.5, type: 'culture' },
  { id: 10, name: 'E-Learning & Academia', desc: 'Plataforma digital de aprendizaje continuo, capacitaciones de inicio y ruta de formación profesional.', region: 'Muévete con Confianza', x: 235, z: -125, baseY: 5.0, type: 'archive' },
  // Bloque: Tu Equipo y Procesos (Estaciones 11 a 13)
  { id: 11, name: 'Tu Inicio en Orden: Gestor Documental', desc: 'Gestor documental corporativo, resguardo de archivos y procesos esenciales del área.', region: 'Gestión & Procesos', x: 300, z: -40, baseY: 8.5, type: 'docmanager' },
  { id: 12, name: 'Tu Equipo te Estaba Esperando', desc: 'Recepción por tu líder y compañeros en el área: propósito, actividades, logros, retos y sentido de tu incorporación.', region: 'Comunidad Bradesco', x: 365, z: 50, baseY: 12.5, type: 'plaza' },
  { id: 13, name: 'Tu Historia Continúa: Almuerzo en Equipo', desc: 'Cierre del bloque compartido, resolución de dudas y almuerzo de integración con tu equipo.', region: 'Comunidad Bradesco', x: 425, z: 85, baseY: 17.0, type: 'garden' },
  // Bloque: Normativa, Calidad y Cierre (Estaciones 14 a 17)
  { id: 14, name: 'Voz del Cliente: NPS', desc: 'Metodología, escala y aplicación de la encuesta NPS para medir lealtad y calidad de servicio.', region: 'Excelencia en Servicio', x: 485, z: 10, baseY: 22.0, type: 'nps' },
  { id: 15, name: 'Pilares Normativos & Código de Ética', desc: 'Santuario de Alta Montaña: Código de ética y conducta, directrices de vestimenta, PLD y gestión de riesgos.', region: 'Integridad & Cumplimiento', x: 535, z: -65, baseY: 27.5, type: 'ethics' },
  { id: 16, name: 'Representación & Sindicato', desc: 'Información institucional sobre representación sindical, derechos y acompañamiento laboral.', region: 'Integridad & Cumplimiento', x: 580, z: 25, baseY: 33.0, type: 'union' },
  { id: 17, name: 'Cuéntanos tu Historia: Tu Huella', desc: 'Gran Bastión de la Cumbre: Sesión de cierre, fotografía, ficha de ingreso, constancias de inducción y graduación.', region: 'Bastión de Cierre', x: 625, z: 115, baseY: 39.0, type: 'castle' }
];

const MAX_MISSION = SEED.length - 1;

// ── State Management ─────────────────────────────────────────────────────────
const KEY = 'nextGenOnboardingDay.v277_expanded';
let saved = {};
try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch {}
let missions = structuredClone(SEED);
if (Array.isArray(saved.missions) && saved.missions.length === SEED.length) {
  saved.missions.forEach((m, idx) => {
    if (m && m.id === SEED[idx].id) {
      // Preserve user progression state, keep official SEED station catalog authoritative
      missions[idx] = {
        ...SEED[idx],
        name: m.name || SEED[idx].name,
        desc: m.desc || SEED[idx].desc,
        region: m.region || SEED[idx].region,
        hidden: SEED[idx].hidden,
        completed: !!m.completed,
        unlocked: m.unlocked !== undefined ? m.unlocked : (idx <= 1)
      };
    }
  });
}
function getMission(id) {
  const num = Number(id);
  return missions.find(m => m.id === num) || missions[0];
}
let current = (saved.current !== undefined && !isNaN(saved.current)) ? clamp(Number(saved.current), 1, MAX_MISSION) : 1;
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
      avatarId: p.avatarId || (AVATAR_PRESETS[idx % AVATAR_PRESETS.length]?.id || 'ranger'),
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
    avatarId: p.avatarId || 'ranger',
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

const DEFAULT_EVALUATIONS = {
  1: {
    mid: {
      id: "s1_mid",
      title: "Evaluación Intermedia: Kit Tecnológico y Laptop",
      question: "¿Cuál es la primera recomendación al recibir tu laptop y kit corporativo de bienvenida?",
      options: [
        { id: "A", text: "Verificar el encendido, reportar la recepción al área de TI y cambiar la contraseña temporal." },
        { id: "B", text: "Descargar videojuegos y aplicaciones personales no autorizadas." },
        { id: "C", text: "Compartir la contraseña inicial con personas externas a la empresa." },
        { id: "D", text: "No encender el equipo hasta el mes siguiente." }
      ],
      correctOption: "A",
      explanation: "La validación inicial del equipo y el cambio inmediato de contraseña garantizan la seguridad de la información corporativa y el correcto funcionamiento de tus herramientas de trabajo.",
      xp: 50
    },
    final: {
      id: "s1_final",
      title: "Reto de Cierre: Tarjeta de Acceso y Periféricos",
      question: "¿Qué procedimiento debes seguir con tu tarjeta de acceso y credencial corporativa?",
      options: [
        { id: "A", text: "Prestar la tarjeta de acceso a cualquier visitante que lo solicite." },
        { id: "B", text: "Portarla visiblemente en las instalaciones y reportar de inmediato en caso de extravío." },
        { id: "C", text: "Dejar la tarjeta en el escritorio al salir del edificio." },
        { id: "D", text: "Duplicar la tarjeta en un cerrajero externo." }
      ],
      correctOption: "B",
      explanation: "La tarjeta de acceso es personal e intransferible; portarla visible asegura el control de seguridad física dentro de todos los edificios corporativos.",
      xp: 75
    }
  },
  2: {
    mid: {
      id: "s2_mid",
      title: "Evaluación Intermedia: Formalización Contractual",
      question: "¿Por qué es fundamental revisar y formalizar tu contrato laboral durante la primera semana?",
      options: [
        { id: "A", text: "Para asegurar la afiliación a la seguridad social, definir funciones claras y gozar de todas las prestaciones de ley." },
        { id: "B", text: "Solo para tener un documento archivado sin valor legal." },
        { id: "C", text: "Para renunciar a los días de descanso obligatorio." },
        { id: "D", text: "No es necesario revisar el contrato antes de firmar." }
      ],
      correctOption: "A",
      explanation: "El contrato formaliza los acuerdos laborales, garantizando tus derechos, prestaciones, esquema de compensación y respaldo institucional.",
      xp: 50
    },
    final: {
      id: "s2_final",
      title: "Reto de Cierre: Catálogo de Beneficios y Salud",
      question: "¿Qué beneficios adicionales complementan la propuesta de valor para colaboradores de Bradesco México?",
      options: [
        { id: "A", text: "Únicamente el salario base sin ningún tipo de apoyo adicional." },
        { id: "B", text: "Pólizas de seguro médico, vales de despensa, días de descanso adicionales y convenios institucionales." },
        { id: "C", text: "Descuentos en multas de tránsito de la ciudad." },
        { id: "D", text: "Cursos obligatorios en días festivos." }
      ],
      correctOption: "B",
      explanation: "El paquete integral de beneficios está diseñado para impulsar el bienestar integral, salud y balance de vida de cada colaborador.",
      xp: 75
    }
  },
  3: {
    mid: {
      id: "s3_mid",
      title: "Evaluación Intermedia: Plataforma Humand",
      question: "¿Para qué sirve principalmente la plataforma y app Humand en tu día a día?",
      options: [
        { id: "A", text: "Para consultar comunicaciones oficiales, registrar incidencias, consultar recibos y estar conectado con la comunidad." },
        { id: "B", text: "Para pedir comida a domicilio particular." },
        { id: "C", text: "Para ver series de televisión durante el horario laboral." },
        { id: "D", text: "Para jugar partidas multijugador externas." }
      ],
      correctOption: "A",
      explanation: "Humand es nuestro canal digital centralizado de comunicación interna, gestión de recursos humanos y conexión con la cultura corporativa.",
      xp: 50
    },
    final: {
      id: "s3_final",
      title: "Reto de Cierre: Normas de Convivencia en el Comedor",
      question: "¿Cuál es la regla de oro para el uso de las áreas comunes y comedor corporativo?",
      options: [
        { id: "A", text: "Dejar los platos y residuos sobre las mesas para que alguien más los limpie." },
        { id: "B", text: "Mantener limpios los espacios, separar residuos en sus contenedores y respetar los turnos asignados." },
        { id: "C", text: "Apartar mesas vacías durante varias horas con objetos personales." },
        { id: "D", text: "Usar aparatos de audio a máximo volumen sin audífonos." }
      ],
      correctOption: "B",
      explanation: "El respeto y cuidado de las áreas comunes fomenta un entorno armonioso, limpio y agradable para todos los compañeros de trabajo.",
      xp: 75
    }
  },
  4: {
    mid: {
      id: "s4_mid",
      title: "Evaluación Intermedia: Rutas de Evacuación y Brigadas",
      question: "Ante una alerta sísmica o de emergencia en el edificio, ¿cuál es la conducta correcta?",
      options: [
        { id: "A", text: "Correr apresuradamente, gritar y empujar a los demás en las escaleras." },
        { id: "B", text: "Evacuar con calma por las rutas señalizadas, no usar elevadores y seguir las instrucciones de los brigadistas." },
        { id: "C", text: "Regresar por objetos personales al puesto de trabajo." },
        { id: "D", text: "Ignorar la alarma y continuar trabajando." }
      ],
      correctOption: "B",
      explanation: "Seguir los protocolos de protección civil, mantener la calma y atender a los brigadistas salva vidas en cualquier eventualidad.",
      xp: 50
    },
    final: {
      id: "s4_final",
      title: "Reto de Cierre: Uso del Estacionamiento Corporativo",
      question: "¿Cuál es el requisito indispensable para utilizar el estacionamiento de la empresa?",
      options: [
        { id: "A", text: "Registrar previamente el vehículo, respetar los límites de velocidad y estacionar en cajones autorizados." },
        { id: "B", text: "Bloquear rampas de emergencia si se tiene prisa." },
        { id: "C", text: "Estacionarse en lugares para personas con movilidad reducida sin contar con el gafete correspondiente." },
        { id: "D", text: "Prestar el pase de estacionamiento a personas externas sin registro." }
      ],
      correctOption: "A",
      explanation: "El registro vehicular y el respeto a la señalización garantizan el orden, la fluidez y la seguridad en los estacionamientos corporativos.",
      xp: 75
    }
  },
  5: {
    mid: {
      id: "s5_mid",
      title: "Evaluación Intermedia: Propósito de la Tarjeta Cosmos",
      question: "¿Qué representa la Tarjeta Cosmos para los integrantes del equipo?",
      options: [
        { id: "A", text: "Una tarjeta de identificación de beneficios exclusivos, descuentos en comercios afiliados y promociones institucionales." },
        { id: "B", text: "Un pase para salir antes de tiempo todos los días." },
        { id: "C", text: "Un boleto para rifas gubernamentales." },
        { id: "D", text: "Una tarjeta de crédito con cobro de comisión obligatorio." }
      ],
      correctOption: "A",
      explanation: "La Tarjeta Cosmos brinda acceso a convenios comerciales, descuentos y promociones preferenciales para el colaborador y su familia.",
      xp: 50
    },
    final: {
      id: "s5_final",
      title: "Reto de Cierre: Alianzas y Descuentos Cosmos",
      question: "¿Dónde puedes consultar el catálogo actualizado de convenios y comercios afiliados a Tarjeta Cosmos?",
      options: [
        { id: "A", text: "En el portal interno de beneficios y canales de comunicación oficial de Bradesco." },
        { id: "B", text: "En anuncios publicitarios en la calle." },
        { id: "C", text: "En periódicos locales no relacionados." },
        { id: "D", text: "No se puede consultar en ningún lugar." }
      ],
      correctOption: "A",
      explanation: "Los canales oficiales internos mantienen el directorio actualizado de beneficios y promociones activas de Tarjeta Cosmos.",
      xp: 75
    }
  },
  6: {
    mid: {
      id: "s6_mid",
      title: "Evaluación Intermedia: Origen y Evolución",
      question: "¿Cuál es el pilar fundamental que guía el propósito histórico de Bradesco?",
      options: [
        { id: "A", text: "Estar presente al lado de las personas y empresas, impulsando su desarrollo financiero y cumplimiento de metas." },
        { id: "B", text: "Operar únicamente como entidad teórica sin relación con los clientes." },
        { id: "C", text: "Enfocarse solo en trámites burocráticos." },
        { id: "D", text: "Limitar la inclusión financiera." }
      ],
      correctOption: "A",
      explanation: "El propósito de Bradesco se fundamenta en la cercanía con las personas, la inclusión financiera y el impulso al progreso económico sostenible.",
      xp: 50
    },
    final: {
      id: "s6_final",
      title: "Reto de Cierre: Valores y Cultura Institucional",
      question: "¿Qué valores definen el comportamiento y la ética de trabajo en nuestro equipo?",
      options: [
        { id: "A", text: "Transparencia, ética, innovación, compromiso con el cliente y trabajo colaborativo." },
        { id: "B", text: "Individualismo y falta de comunicación." },
        { id: "C", text: "Resistencia al cambio y procesos obsoletos." },
        { id: "D", text: "Improvisación en las metas operativas." }
      ],
      correctOption: "A",
      explanation: "La cultura Bradesco promueve la ética intachable, el trabajo en equipo, la constante innovación y la satisfacción de nuestros clientes.",
      xp: 75
    }
  },
  7: {
    mid: {
      id: "s7_mid",
      title: "Evaluación Intermedia: La Pregunta de Oro NPS",
      question: "¿En qué escala se mide la recomendación del cliente según la metodología Net Promoter Score (NPS)?",
      options: [
        { id: "A", text: "Escala de 0 a 10, donde 9-10 son Promotores, 7-8 Pasivos y 0-6 Detractores." },
        { id: "B", text: "Escala de 1 a 3 (Malo, Regular, Bueno)." },
        { id: "C", text: "Porcentaje al azar sin clasificación." },
        { id: "D", text: "Escala de letras de la A a la Z." }
      ],
      correctOption: "A",
      explanation: "El NPS divide a los clientes en Promotores (9-10), Pasivos (7-8) y Detractores (0-6) para calcular el índice neto: % Promotores - % Detractores.",
      xp: 50
    },
    final: {
      id: "s7_final",
      title: "Reto de Cierre: Cierre de Ciclo (Closed Loop)",
      question: "¿Qué significa aplicar un proceso de 'Closed Loop' (Cierre de Ciclo) en la retroalimentación de NPS?",
      options: [
        { id: "A", text: "Contactar oportunamente al cliente insatisfecho, entender su causa raíz y tomar acciones de mejora concretas." },
        { id: "B", text: "Eliminar las encuestas negativas para que no afecten el promedio." },
        { id: "C", text: "Discutir con el cliente por haber calificado con baja puntuación." },
        { id: "D", text: "Ignorar las sugerencias recibidas." }
      ],
      correctOption: "A",
      explanation: "El Closed Loop transforma las críticas de los clientes en oportunidades reales de aprendizaje, fidelización y optimización de nuestros servicios.",
      xp: 75
    }
  },
  8: {
    mid: {
      id: "s8_mid",
      title: "Evaluación Intermedia: Gestión y Organización Documental",
      question: "¿Cuál es el propósito primordial del Gestor Documental corporativo en tus actividades diarias?",
      options: [
        { id: "A", text: "Garantizar la trazabilidad, control de versiones, confidencialidad y rápido acceso a expedientes oficiales." },
        { id: "B", text: "Guardar copias personales no autorizadas en carpetas sin clasificar." },
        { id: "C", text: "Eliminar registros históricos sin autorización previa." },
        { id: "D", text: "Reemplazar los sistemas operativos de la empresa." }
      ],
      correctOption: "A",
      explanation: "El Gestor Documental centraliza la información institucional, manteniendo altos estándares de seguridad, orden, auditoría y control de versiones.",
      xp: 50
    },
    final: {
      id: "s8_final",
      title: "Reto de Cierre: Políticas de Retención y Resguardo",
      question: "¿Qué lineamiento es indispensable aplicar al subir o consultar expedientes en el Gestor Documental?",
      options: [
        { id: "A", text: "Asignar los permisos de acceso correctos según la clasificación de seguridad y respetar los periodos de retención." },
        { id: "B", text: "Compartir enlaces públicos sin restricción a usuarios externos." },
        { id: "C", text: "Modificar la fecha original de los contratos sin registro de auditoría." },
        { id: "D", text: "Descargar información sensible a memorias USB no cifradas." }
      ],
      correctOption: "A",
      explanation: "El correcto etiquetado de confidencialidad y apego a las políticas de retención protegen los activos de información y el cumplimiento legal.",
      xp: 75
    }
  },
  9: {
    mid: {
      id: "s9_mid",
      title: "Evaluación Intermedia: Código de Ética y Conducta",
      question: "¿Qué conducta establece nuestro Código de Ética ante un posible conflicto de interés o dilema ético?",
      options: [
        { id: "A", text: "Declararlo con transparencia a tu líder y al área de Cumplimiento para asegurar decisiones imparciales." },
        { id: "B", text: "Ocultarlo mientras no genere sospechas inmediatas." },
        { id: "C", text: "Aceptar beneficios personales a cambio de favores comerciales." },
        { id: "D", text: "Tomar decisiones basándose únicamente en el beneficio propio." }
      ],
      correctOption: "A",
      explanation: "La transparencia y la pronta declaración de conflictos de interés resguardan la integridad personal y el prestigio de nuestra organización.",
      xp: 50
    },
    final: {
      id: "s9_final",
      title: "Reto de Cierre: Canal Confidencial de Integridad",
      question: "¿Cuál es la garantía principal al realizar un reporte a través del Canal Confidencial de Integridad?",
      options: [
        { id: "A", text: "Confidencialidad absoluta, posibilidad de anonimato e investigación rigurosa con cero tolerancia a represalias." },
        { id: "B", text: "Divulgación pública de los datos del reportante." },
        { id: "C", text: "Sanción automática para quien realiza la consulta ética." },
        { id: "D", text: "No se realiza ningún tipo de seguimiento." }
      ],
      correctOption: "A",
      explanation: "El Canal de Integridad asegura un espacio seguro, protegido y ético para expresar inquietudes y denunciar cualquier falta a nuestros valores.",
      xp: 75
    }
  },
  10: {
    mid: {
      id: "s10_mid",
      title: "Evaluación Intermedia: Canales de Comunicación Interna",
      question: "¿Cuáles son los canales oficiales para mantenerte informado sobre metas, eventos y anuncios corporativos?",
      options: [
        { id: "A", text: "La plataforma Humand, correos oficiales, reuniones de equipo (Town Halls) y comunicados institucionales." },
        { id: "B", text: "Rumores informales en pasillos sin confirmación." },
        { id: "C", text: "Cuentas personales de redes sociales externas." },
        { id: "D", text: "Blogs anónimos de internet." }
      ],
      correctOption: "A",
      explanation: "Los canales oficiales garantizan información verificada, oportuna y alineada con la estrategia de la organización.",
      xp: 50
    },
    final: {
      id: "s10_final",
      title: "Reto de Cierre: Vivencia de la Cultura y Pertenencia",
      question: "¿De qué manera contribuyes activamente a fortalecer la cultura y el clima organizacional?",
      options: [
        { id: "A", text: "Fomentando el respeto, colaborando con entusiasmo, reconociendo el logro de los demás y viviendo nuestros valores." },
        { id: "B", text: "Aislándote de las actividades de integración del equipo." },
        { id: "C", text: "Generando desinformación entre compañeros." },
        { id: "D", text: "Ignorando las iniciativas de bienestar y cultura." }
      ],
      correctOption: "A",
      explanation: "La cultura la construimos todos los días a través del trato respetuoso, la colaboración activa y el sentido de pertenencia.",
      xp: 75
    }
  },
  11: {
    mid: {
      id: "s11_mid",
      title: "Evaluación Intermedia: Objetivos de la Ruta 30-60-90",
      question: "¿Cuál es el objetivo principal del programa de acompañamiento y evaluaciones 30-60-90 días?",
      options: [
        { id: "A", text: "Acompañar tu integración, alinear objetivos de desempeño y brindar retroalimentación constructiva continua." },
        { id: "B", text: "Asignar penalizaciones sin oportunidad de mejora." },
        { id: "C", text: "Postergar tu plan de inducción hasta el final del año." },
        { id: "D", text: "Revisar únicamente asistencia sin evaluar metas." }
      ],
      correctOption: "A",
      explanation: "La Ruta 30-60-90 permite calibrar el avance, resolver obstáculos a tiempo y asegurar una curva de aprendizaje óptima y motivadora.",
      xp: 50
    },
    final: {
      id: "s11_final",
      title: "Reto de Cierre: Consolidación y Plan de Desarrollo",
      question: "¿Qué hito clave se logra al completar satisfactoriamente los primeros 90 días en el equipo?",
      options: [
        { id: "A", text: "Consolidación en el puesto, definición de metas anuales y trazado del plan de crecimiento profesional." },
        { id: "B", text: "Conclusión de toda meta laboral futura." },
        { id: "C", text: "Dejar de recibir retroalimentación del líder." },
        { id: "D", text: "Reiniciar el proceso de contratación desde cero." }
      ],
      correctOption: "A",
      explanation: "Completar la Ruta 90 consolida tu autonomía, autonomía funcional y abre la puerta al desarrollo continuo dentro de la organización.",
      xp: 75
    }
  },
  12: {
    mid: {
      id: "s12_mid",
      title: "Evaluación Intermedia: Diálogo Colectivo y Representación",
      question: "¿Cuál es el rol fundamental de la representación sindical en el entorno laboral?",
      options: [
        { id: "A", text: "Representar los intereses colectivos de los trabajadores y fomentar un diálogo constructivo con la empresa." },
        { id: "B", text: "Generar barreras en los procesos de comunicación." },
        { id: "C", text: "Reemplazar los contratos individuales por acuerdos verbales." },
        { id: "D", text: "Impedir las mejoras en las condiciones de trabajo." }
      ],
      correctOption: "A",
      explanation: "La colaboración sindical impulsa acuerdos justos, clima de respeto mutuo y resguardo de los derechos colectivos.",
      xp: 50
    },
    final: {
      id: "s12_final",
      title: "Reto de Cierre: Contrato Colectivo y Beneficios",
      question: "¿Dónde y cómo puedes informarte acerca del pacto y los beneficios derivados del Contrato Colectivo?",
      options: [
        { id: "A", text: "Con el área de Relaciones Laborales y tus delegados sindicales autorizados." },
        { id: "B", text: "Buscando en páginas web no oficiales." },
        { id: "C", text: "A través de rumores sin sustento documental." },
        { id: "D", text: "No está permitida su consulta." }
      ],
      correctOption: "A",
      explanation: "El área de Relaciones Laborales y los representantes autorizados brindan orientación clara sobre las cláusulas y beneficios colectivos.",
      xp: 75
    }
  },
  13: {
    mid: {
      id: "s13_mid",
      title: "Evaluación Intermedia: Recorrido Integral de Expedición",
      question: "¿Qué pilares componen la formación integral recibida durante toda esta expedición de Onboarding?",
      options: [
        { id: "A", text: "Equipamiento, marco laboral, cultura, herramientas digitales, ética, normatividad y trabajo en equipo." },
        { id: "B", text: "Únicamente instalación de programas básicos." },
        { id: "C", text: "Solo memorización de nombres de directivos." },
        { id: "D", text: "Ningún aprendizaje aplicable a la operación diaria." }
      ],
      correctOption: "A",
      explanation: "El programa integral de Onboarding te dota de las competencias, valores y herramientas necesarias para triunfar en tu trayectoria corporativa.",
      xp: 50
    },
    final: {
      id: "s13_final",
      title: "Reto Final Épico: Compromiso y Graduación Onboarding",
      question: "¿Qué representa concluir victoriosamente la Expedición de Onboarding de Bradesco México?",
      options: [
        { id: "A", text: "Estar plenamente preparado, equipado y alineado con los valores y metas para triunfar en tu nueva aventura profesional." },
        { id: "B", text: "Solo un trámite sin aplicación en tu vida laboral." },
        { id: "C", text: "El final de todo aprendizaje dentro de la empresa." },
        { id: "D", text: "Una certificación decorativa." }
      ],
      correctOption: "A",
      explanation: "¡Felicidades! La graduación de Onboarding marca el inicio de una trayectoria llena de retos, crecimiento, liderazgo y éxitos compartidos.",
      xp: 100
    }
  }
};

let evaluations = structuredClone(DEFAULT_EVALUATIONS);
if (saved.evaluations && typeof saved.evaluations === 'object') {
  for (const st in saved.evaluations) {
    if (evaluations[st]) {
      evaluations[st] = { ...evaluations[st], ...saved.evaluations[st] };
    } else {
      evaluations[st] = saved.evaluations[st];
    }
  }
}
let evaluationsStatus = (saved.evaluationsStatus && typeof saved.evaluationsStatus === 'object') ? saved.evaluationsStatus : {};
let completedCapsules = (saved.completedCapsules && typeof saved.completedCapsules === 'object') ? saved.completedCapsules : {};

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
      npsChecklist,
      evaluations,
      evaluationsStatus,
      completedCapsules
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

  // Gentle rolling meadows across the vast continent (No sharp mountain walls or grey borders)
  if (wz < -750) { const t = clamp((-750 - wz) / 120, 0, 1); h += t * t * (fbm(wx * s * 1.6 + 1.3, wz * s * 1.6 + 5.2) * 14 + 6); }
  if (wz > 750) { const t = clamp((wz - 750) / 120, 0, 1); h += t * t * (fbm(wx * s * 2.1 + 4.5, wz * s * 2.1 + 0.8) * 14 + 6); }
  if (wx < -1100) { const t = clamp((-1100 - wx) / 120, 0, 1); h += t * t * (fbm(wx * s * 1.7 + 2.1, wz * s * 1.7 + 6.3) * 14 + 6); }
  if (wx > 1300) { const t = clamp((wx - 1300) / 120, 0, 1); h += t * t * (fbm(wx * s * 1.7 + 8.5, wz * s * 1.7 + 3.1) * 14 + 6); }

  // Progressive Alpine Mountain Pass in the East (wx > 240): continuous climbing highway (8.7% grade)
  if (wx > 240) {
    const t = clamp((wx - 240) / 390, 0, 1);
    // Smooth, progressive, monotonic ascent: absolutely ZERO dips or roller-coaster pits between stations!
    const mountainPassAscent = t * 34.0;
    const mountainRelief = fbm(wx * 0.007 + 1.5, wz * 0.007 + 3.2) * 4.0 * t;
    h += mountainPassAscent + mountainRelief;
  }

  // Scenic Lake Cosmos Basin (North of Station 08, centered at x: 95, z: -105)
  // Station 08 sits on the southern shoreline at z: -55. The natural lake stretches to the north!
  const lakeDist = Math.hypot((wx - 95) * 0.75, wz - (-105));
  if (lakeDist < 58) {
    const lf = clamp(1 - lakeDist / 58, 0, 1);
    h -= lf * lf * 5.2;
  }

  // River Channel - smoothly passing under Bridge 1 (-125, -20), Bridge 2 (80, -20)
  if (wx > -155 && wx < 85) {
    const rz = getRiverZ(wx);
    const rDist = Math.abs(wz - rz);
    if (rDist < 12.0) {
      const rf = clamp(1.0 - (rDist / 12.0), 0, 1);
      h -= rf * rf * 3.2;
    }
  }

  // Smooth Organic Station Foundation Leveling
  const activeMissions = (typeof missions !== 'undefined' && missions && missions.length) ? missions : SEED;
  for (const q of activeMissions) {
    const d = Math.hypot(wx - q.x, wz - q.z);
    const rFlat = 16.0;
    const rBlend = q.type === 'castle' ? 44.0 : 30.0;
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
renderer.toneMappingExposure = 1.02;

// ── Sky & Atmosphere ─────────────────────────────────────────────────────────
const sky = new Sky();
sky.scale.setScalar(2500);
scene.add(sky);
const skyU = sky.material.uniforms;
skyU['turbidity'].value = 4.2;
skyU['rayleigh'].value = 1.4;
skyU['mieCoefficient'].value = 0.003;
skyU['mieDirectionalG'].value = 0.85;

// ── Clean Stylized Daylight with Rich Vibrant Contrast ───────────────────────
const hemisphere = new THREE.HemisphereLight(0xfff6e6, 0x2d441c, 0.68);
scene.add(hemisphere);

const sun = new THREE.DirectionalLight(0xfff5e4, 2.4);
sun.castShadow = true;
sun.shadow.mapSize.width = 2048;
sun.shadow.mapSize.height = 2048;
sun.shadow.camera.near = 10;
sun.shadow.camera.far = 700;
const dShadow = 95;
sun.shadow.camera.left = -dShadow;
sun.shadow.camera.right = dShadow;
sun.shadow.camera.top = dShadow;
sun.shadow.camera.bottom = -dShadow;
sun.shadow.bias = -0.0003;
sun.shadow.normalBias = 0.020;
sun.position.set(85, 160, 75);
scene.add(sun);
scene.add(sun.target);

let lastShadowTargetX = null;
let lastShadowTargetZ = null;
let lastShadowMode = null;

function updateSunShadow(force = false) {
  const isOverview = typeof overview3DMode !== 'undefined' ? overview3DMode : true;
  let targetX = 0;
  let targetZ = 0;

  if (isOverview) {
    targetX = 118;
    targetZ = 10;
  } else {
    const actM = (typeof getMission === 'function' && typeof current !== 'undefined') ? getMission(current) : null;
    if (actM) {
      targetX = actM.x;
      targetZ = actM.z;
    } else if (typeof camera !== 'undefined' && camera) {
      targetX = camera.position.x;
      targetZ = camera.position.z;
    }
  }

  const distSq = (lastShadowTargetX === null) ? 999999 : 
    Math.hypot(targetX - lastShadowTargetX, targetZ - lastShadowTargetZ);

  if (!force && lastShadowMode === isOverview && distSq < 15.0) return;

  lastShadowTargetX = targetX;
  lastShadowTargetZ = targetZ;
  lastShadowMode = isOverview;

  const dSpan = isOverview ? 340 : 85;
  sun.target.position.set(targetX, 0, targetZ);
  sun.position.set(targetX + 85, 160, targetZ + 75);
  sun.shadow.camera.left = -dSpan;
  sun.shadow.camera.right = dSpan;
  sun.shadow.camera.top = dSpan;
  sun.shadow.camera.bottom = -dSpan;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 700;
  sun.shadow.bias = isOverview ? -0.0008 : -0.0003;
  sun.shadow.normalBias = isOverview ? 0.04 : 0.02;
  sun.shadow.camera.updateProjectionMatrix();
  sun.target.updateMatrixWorld();
}

const fill = new THREE.DirectionalLight(0xdcf2fc, 0.35);
fill.position.set(-80, 140, -80);
scene.add(fill);

scene.environment = null;

function updateSky(elevation = 38, azimuth = -152) {
  const phi = THREE.MathUtils.degToRad(90 - elevation), theta = THREE.MathUtils.degToRad(azimuth);
  const sv = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
  skyU['sunPosition'].value.copy(sv);
}
updateSky();

// ── Rustic Organic Trail Waypoints (Continuous Smooth Expanded Expedition Road) ───────────
const roadWaypoints = [
  new THREE.Vector3(-360, 0, 60),   // St 1: Recepción & Kit (Elev 1.0)
  new THREE.Vector3(-325, 0, 10),
  new THREE.Vector3(-290, 0, -40),  // St 2: Pacto & Beneficios (Elev 2.5)
  new THREE.Vector3(-255, 0, -85),
  new THREE.Vector3(-225, 0, -115), // St 3: Hoy Comienza tu Historia (Elev 4.5)
  new THREE.Vector3(-185, 0, -65),
  new THREE.Vector3(-155, 0, -35),  // Bridge 1 crossing
  new THREE.Vector3(-150, 0, -15),  // St 4: Conoce de qué Formas Parte (Elev 1.5)
  new THREE.Vector3(-120, 0, 25),
  new THREE.Vector3(-90, 0, 65),    // St 5: Nos Cuidamos, Cuidamos la Confianza (Elev 3.5)
  new THREE.Vector3(-55, 0, 100),
  new THREE.Vector3(-25, 0, 125),   // St 6: Pausa de Recarga (Oasis, Elev 5.0)
  new THREE.Vector3(15, 0, 105),
  new THREE.Vector3(50, 0, 75),     // St 7: Humand & Comedor (Elev 2.0)
  new THREE.Vector3(75, 0, 5),      // Bridge 2 crossing
  new THREE.Vector3(88, 0, -25),    // Promenade approach
  new THREE.Vector3(95, 0, -55),    // St 8: Tarjeta Cosmos (Waterfront Market Promenade, Elev 2.0)
  new THREE.Vector3(130, 0, -85),   // Scenic lakeside road
  new THREE.Vector3(165, 0, -115),  // St 9: Cultura & Comunicación (Elev 3.5)
  new THREE.Vector3(200, 0, -125),
  new THREE.Vector3(235, 0, -125),  // St 10: E-Learning & Academia (Elev 5.0)
  new THREE.Vector3(270, 0, -85),
  new THREE.Vector3(300, 0, -40),   // St 11: Gestor Documental (Elev 8.5)
  new THREE.Vector3(335, 0, 10),
  new THREE.Vector3(365, 0, 50),    // St 12: Tu Equipo te Estaba Esperando (Elev 12.5)
  new THREE.Vector3(395, 0, 75),
  new THREE.Vector3(425, 0, 85),    // St 13: Tu Historia Continúa: Almuerzo (Elev 17.0)
  new THREE.Vector3(455, 0, 50),
  new THREE.Vector3(485, 0, 10),    // St 14: Voz del Cliente: NPS (Elev 22.0)
  new THREE.Vector3(510, 0, -30),
  new THREE.Vector3(535, 0, -65),   // St 15: Pilares Normativos (Elev 27.5)
  new THREE.Vector3(560, 0, -20),
  new THREE.Vector3(580, 0, 25),    // St 16: Representación & Sindicato (Elev 33.0)
  new THREE.Vector3(605, 0, 75),
  new THREE.Vector3(625, 0, 115)    // St 17: Cuéntanos tu Historia: Tu Huella (Bastion Summit, Elev 39.0)
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

// 1. Lush Painterly Meadow Grass (Smooth, Organic, Cel-Shaded)
const grassTile = createProceduralTile((ctx, size) => {
  // Rich, velvety emerald foundation
  ctx.fillStyle = '#56a634';
  ctx.fillRect(0, 0, size, size);

  // Soft, smooth painterly watercolor / foliage blooms (zero repeating dots or harsh dashes)
  for (let i = 0; i < 48; i++) {
    const rx = Math.random() * size;
    const ry = Math.random() * size;
    const rad = 45 + Math.random() * 65;
    const grad = ctx.createRadialGradient(rx, ry, 0, rx, ry, rad);
    const isLighter = Math.random() > 0.45;
    grad.addColorStop(0, isLighter ? 'rgba(114, 202, 64, 0.22)' : 'rgba(60, 128, 32, 0.20)');
    grad.addColorStop(0.65, isLighter ? 'rgba(96, 180, 52, 0.08)' : 'rgba(52, 114, 28, 0.07)');
    grad.addColorStop(1, 'rgba(86, 166, 52, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(rx, ry, rad, 0, Math.PI * 2);
    ctx.fill();
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
    ((wx + 450) / 1150) * 2048,
    ((wz + 240) / 480) * 2048
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
    uniform vec2 uStations[18];
    uniform float uStationRadii[18];`
  ).replace(
    '#include <map_fragment>',
    `
    // 1. Dual-Frequency Painterly Grass Sampling (Soft, organic, zero tiling artifacts)
    vec2 uvG1 = vWorldPos.xz * 0.040;
    vec2 uvG2 = vec2(vWorldPos.z * 0.707 - vWorldPos.x * 0.707, vWorldPos.x * 0.707 + vWorldPos.z * 0.707) * 0.015;
    vec4 grassSample1 = texture2D(uGrass, uvG1);
    vec4 grassSample2 = texture2D(uGrass, uvG2);
    vec4 baseGrass = mix(grassSample1, grassSample2, 0.50);

    // 4 Distinct Continental Biome Tints
    // Sector 1: Emerald Plains (West, Stations 00-06) - Radiant lively emerald meadow
    vec3 colPlains = vec3(0.32, 0.76, 0.20);
    // Sector 2: Riverbank & Wetland - Deep fertile river moss green
    vec3 colWetland = vec3(0.18, 0.46, 0.20);
    // Sector 3: Pine Taiga - Cool deep conifer slate green
    vec3 colTaiga = vec3(0.22, 0.48, 0.28);
    // Sector 4: Alpine Highlands, Dry Crags & Tundra (East, Stations 14-17) - Cold dry grey-brown slate steppe
    vec3 colAlpineTundra = vec3(0.48, 0.46, 0.40);
    vec3 colSnowFrost = vec3(0.92, 0.95, 0.98);

    // River and Lake proximity for wetland biome
    float distToRiver = abs(vWorldPos.z - (-22.0 + sin(vWorldPos.x * 0.02) * 12.0));
    float isWetland = smoothstep(32.0, 10.0, distToRiver) * smoothstep(-170.0, -135.0, vWorldPos.x) * smoothstep(115.0, 80.0, vWorldPos.x);
    float distToLake = length(vec2((vWorldPos.x - 95.0) * 0.75, vWorldPos.z + 105.0));
    float isLakeWetland = smoothstep(65.0, 30.0, distToLake);
    float wetlandWeight = clamp(isWetland + isLakeWetland, 0.0, 1.0);

    // Continental transition along X axis and Altitude
    float wPlains = smoothstep(-60.0, -160.0, vWorldPos.x);
    float alpineFactor = smoothstep(260.0, 480.0, vWorldPos.x);
    float heightFactor = smoothstep(12.0, 32.0, vWorldPos.y);
    float alpineWeight = max(alpineFactor, heightFactor);

    vec3 groundBiomeCol = mix(colTaiga, colPlains, wPlains);
    groundBiomeCol = mix(groundBiomeCol, colWetland, wetlandWeight * 0.80);
    groundBiomeCol = mix(groundBiomeCol, colAlpineTundra, alpineWeight);

    // Gentle terrain micro-variation that breathes painterly life into the meadow
    float microNoise = (texture2D(uGrass, vWorldPos.xz * 0.035).g - 0.5) * 0.08;
    vec4 colG = vec4(baseGrass.rgb * ((groundBiomeCol + microNoise) * 2.0), baseGrass.a);

    vec2 uvR = vWorldPos.xz * 0.055;
    vec2 uvS = vWorldPos.xz * 0.075;
    vec2 uvD = vWorldPos.xz * 0.280; // Fine-grained sunny country earth
    vec2 warp = vec2(sin(vWorldPos.z * 0.18), cos(vWorldPos.x * 0.18)) * 0.008;
    vec2 uvC = (vWorldPos.xz + warp) * 0.350; // Human-scale (~28cm) crisp medieval cobblestone pavers!

    vec4 colR = texture2D(uRock, uvR);
    vec4 colS = texture2D(uSand, uvS);
    vec4 colD = texture2D(uDirt, uvD);
    vec4 colC = texture2D(uCobble, uvC);

    // 1. Mountain Rock & Alpine Summits
    float slope = 1.0 - clamp(vWorldNorm.y, 0.0, 1.0);
    float steepRock = smoothstep(0.38, 0.75, slope);
    float alpineRock = smoothstep(0.24, 0.52, slope) * alpineWeight;
    float highRock = smoothstep(30.0, 38.0, vWorldPos.y) * smoothstep(540.0, 620.0, vWorldPos.x);
    float rockWeight = clamp(steepRock + alpineRock + highRock * 0.7, 0.0, 1.0);

    // Frost & Snow dusting ONLY on top horizontal surfaces of highest peaks (St 16 and 17, Y > 29m)
    float frostWeight = smoothstep(29.0, 37.0, vWorldPos.y) * smoothstep(540.0, 620.0, vWorldPos.x) * clamp(vWorldNorm.y, 0.0, 1.0);

    // 2. Shoreline Sand along River and Lake edge (strictly at waterline, ZERO circular halo!)
    float lakeWaterEdge = (vWorldPos.x > 35.0 && vWorldPos.x < 155.0 && vWorldPos.z < -65.0 && vWorldPos.z > -145.0) ? 
      smoothstep(0.8, 0.2, vWorldPos.y) * smoothstep(-0.2, 0.4, vWorldPos.y) : 0.0;
    float riverSand = (vWorldPos.x > -155.0 && vWorldPos.x < 85.0 && vWorldPos.y < 0.2) ? smoothstep(0.2, -1.2, vWorldPos.y) : 0.0;
    float sandWeight = clamp((lakeWaterEdge * 0.75 + riverSand) * (1.0 - rockWeight * 0.8), 0.0, 1.0);

    // 3. Station Courtyard Plazas: Clean, elegant, noble medieval cobblestone foundation (18 Stations)
    float stationBlend = 0.0;
    for (int i = 0; i < 18; i++) {
      float dSt = length(vWorldPos.xz - uStations[i]);
      float r = uStationRadii[i];
      float w = smoothstep(r, r - 2.0, dSt);
      stationBlend = max(stationBlend, w);
    }

    // 4. Natural Organic Trail (Solid, connected thoroughfare across the continent)
    vec2 splatUV = vec2((vWorldPos.x + 450.0) / 1150.0, (vWorldPos.z + 240.0) / 480.0);
    vec4 splat = (splatUV.x >= 0.0 && splatUV.x <= 1.0 && splatUV.y >= 0.0 && splatUV.y <= 1.0) ? texture2D(uTrailSplat, splatUV) : vec4(0.0);
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

    // Blend frost/snow on high alpine peaks
    mixedColor = mix(mixedColor, vec4(colSnowFrost, 1.0), frostWeight * 0.92);

    // Blend organic continuous road (paved near stations, trodden earth in open wild!)
    mixedColor = mix(mixedColor, roadSurface, roadAlpha * (1.0 - rockWeight * 0.5));

    // Blend Station Courtyards: Elegant, subdued, noble stone pavers that let buildings shine!
    mixedColor = mix(mixedColor, colC, stationBlend);

    diffuseColor *= mixedColor;
    `
  );
  terrainMat.userData.shader = shader;
};

// ── 100% Solid Continuous Vast 3D Terrain Plane (Zero Edges, 2600m x 1800m) ──
const tWidth = 2600, tDepth = 1800;
const terrainGeo = new THREE.PlaneGeometry(tWidth, tDepth, 240, 160);
const posAttr = terrainGeo.attributes.position;
const centerX = 118, centerZ = 10;
for (let i = 0; i < posAttr.count; i++) {
  const lx = posAttr.getX(i), ly = posAttr.getY(i);
  const wx = lx + centerX, wz = -ly + centerZ;
  posAttr.setZ(i, getTerrainY(wx, wz));
}
terrainGeo.computeVertexNormals();

const ground = new THREE.Mesh(terrainGeo, terrainMat);
ground.rotation.x = -Math.PI / 2;
ground.position.set(centerX, 0, centerZ);
ground.receiveShadow = true;
scene.add(ground);

// ── Airtight Continuous Cliff Skirt (Extruded around vast perimeter down to y = -45m) ──
{
  const width = tWidth, depth = tDepth, segX = 240, segZ = 160, bottomY = -45.0;
  const perimeter = [];

  // 1. North edge: z = centerZ - depth / 2
  for (let ix = 0; ix <= segX; ix++) {
    const x = centerX - width / 2 + (ix / segX) * width;
    perimeter.push({ x, z: centerZ - depth / 2 });
  }
  // 2. East edge: x = centerX + width / 2
  for (let iz = 1; iz <= segZ; iz++) {
    const z = centerZ - depth / 2 + (iz / segZ) * depth;
    perimeter.push({ x: centerX + width / 2, z });
  }
  // 3. South edge: z = centerZ + depth / 2
  for (let ix = segX - 1; ix >= 0; ix--) {
    const x = centerX - width / 2 + (ix / segX) * width;
    perimeter.push({ x, z: centerZ + depth / 2 });
  }
  // 4. West edge: x = centerX - width / 2
  for (let iz = segZ - 1; iz >= 1; iz--) {
    const z = centerZ - depth / 2 + (iz / segZ) * depth;
    perimeter.push({ x: centerX - width / 2, z });
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
  bottomPlate.position.set(centerX, bottomY, centerZ);
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

  // 3. Directional Wooden Signposts Between Checkpoints
  function spawnDirectionalSignpost(targetMission, p, dir) {
    const sg = new THREE.Group();
    const wy = getTerrainY(p.x, p.z);

    // Stone base plinth
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.30, 7), stonePlinthMat);
    base.position.y = 0.15;
    sg.add(base);

    // Main timber post
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 2.1, 8), woodMat);
    post.position.y = 1.20;
    sg.add(post);

    // Carved Arrow Signboard
    const signCanvas = document.createElement('canvas');
    signCanvas.width = 512;
    signCanvas.height = 128;
    const sCtx = signCanvas.getContext('2d');
    sCtx.fillStyle = '#422817';
    sCtx.fillRect(0, 0, 512, 128);
    sCtx.strokeStyle = '#27170c';
    sCtx.lineWidth = 6;
    sCtx.strokeRect(3, 3, 506, 122);
    // Gold lettering
    sCtx.fillStyle = '#ffd166';
    sCtx.font = 'bold 42px sans-serif';
    sCtx.textAlign = 'center';
    sCtx.textBaseline = 'middle';
    const shortTitle = targetMission.name.split(' ')[0];
    const label = `M${String(targetMission.id).padStart(2, '0')}: ${shortTitle} ➔`;
    sCtx.fillText(label, 256, 64);

    const signTex = new THREE.CanvasTexture(signCanvas);
    signTex.colorSpace = THREE.SRGBColorSpace;
    const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.8 });

    const board = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.32, 0.08), signMat);
    board.position.set(0.42, 1.82, 0);
    sg.add(board);

    // Small hanging lantern
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.06, 0.06), woodMat);
    arm.position.set(-0.20, 2.05, 0);
    sg.add(arm);

    const lantern = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), lampMat);
    lantern.position.set(-0.35, 1.90, 0);
    sg.add(lantern);

    const signLight = new THREE.PointLight(0xffb84d, 0.9, 6.0);
    signLight.position.set(-0.35, 1.90, 0);
    sg.add(signLight);

    sg.position.set(p.x, wy, p.z);
    sg.rotation.y = Math.atan2(dir.x, dir.z);
    scene.add(sg);
  }

  for (let m = 0; m < missions.length - 1; m++) {
    const cur = missions[m];
    const nxt = missions[m + 1];

    let curIdx = 0, nxtIdx = 0, minD1 = Infinity, minD2 = Infinity;
    for (let k = 0; k < points.length; k++) {
      const d1 = Math.hypot(points[k].x - cur.x, points[k].z - cur.z);
      if (d1 < minD1) { minD1 = d1; curIdx = k; }
      const d2 = Math.hypot(points[k].x - nxt.x, points[k].z - nxt.z);
      if (d2 < minD2) { minD2 = d2; nxtIdx = k; }
    }

    if (nxtIdx > curIdx) {
      const midIdx = Math.floor((curIdx + nxtIdx) * 0.5);
      const p = points[midIdx];
      const nextP = points[Math.min(points.length - 1, midIdx + 2)];
      const dir = new THREE.Vector3().subVectors(nextP, p).normalize();
      const side = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
      const signPos = new THREE.Vector3(p.x + side.x * 2.3, 0, p.z + side.z * 2.3);
      spawnDirectionalSignpost(nxt, signPos, dir);
    }
  }

  // 4. Organic Trail Curbing Stones & Boundary Bollards
  const pebbleGeo1 = new THREE.DodecahedronGeometry(0.24, 1);
  const pebbleGeo2 = new THREE.DodecahedronGeometry(0.18, 1);
  const curbMat1 = new THREE.MeshStandardMaterial({ color: 0x7a7469, roughness: 0.9 });
  const curbMat2 = new THREE.MeshStandardMaterial({ color: 0x635e54, roughness: 0.95 });
  const bollardGeo = new THREE.CylinderGeometry(0.08, 0.10, 0.65, 7);

  for (let i = 8; i < points.length - 8; i += 7) {
    const p = points[i];
    let insideStation = false;
    for (const m of missions) {
      if (Math.hypot(p.x - m.x, p.z - m.z) < 18.0) { insideStation = true; break; }
    }
    if (insideStation) continue;
    if (Math.hypot(p.x - (-125), p.z - (-20)) < 16 || Math.hypot(p.x - 80, p.z - (-20)) < 16) continue;

    const nextP = points[i + 1];
    const dir = new THREE.Vector3().subVectors(nextP, p).normalize();
    const side = new THREE.Vector3(-dir.z, 0, dir.x).normalize();

    const sideSign = (i % 2 === 0) ? 1 : -1;
    const curbDist = 1.85 + (Math.sin(i * 3.7) * 0.5 + 0.5) * 0.40;
    const cx = p.x + side.x * (curbDist * sideSign);
    const cz = p.z + side.z * (curbDist * sideSign);
    const cy = getTerrainY(cx, cz);
    if (cy < -0.2) continue;

    const pick = (i * 17) % 10;
    if (pick < 6) {
      const stoneGroup = new THREE.Group();
      const s1 = new THREE.Mesh(pebbleGeo1, curbMat1);
      s1.scale.set(1.1, 0.65, 0.95);
      s1.position.y = 0.08;
      stoneGroup.add(s1);

      const s2 = new THREE.Mesh(pebbleGeo2, curbMat2);
      s2.scale.set(0.9, 0.6, 1.2);
      s2.position.set(0.22, 0.06, 0.18);
      stoneGroup.add(s2);

      stoneGroup.position.set(cx, cy, cz);
      stoneGroup.rotation.y = (i * 1.3);
      scene.add(stoneGroup);
    } else {
      const bollard = new THREE.Mesh(bollardGeo, woodMat);
      bollard.position.set(cx, cy + 0.32, cz);
      bollard.rotation.y = i * 0.7;
      scene.add(bollard);
    }
  }

  // 5. Wayfarer Rest Nooks along Long Wilderness Corridors
  function spawnRestVignette(wx, wz, facingDir) {
    const vg = new THREE.Group();
    const wy = getTerrainY(wx, wz);

    // Split-log rustic bench
    const benchSeat = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.22, 1.8, 8, 1, false, 0, Math.PI), woodMat);
    benchSeat.rotation.z = Math.PI / 2;
    benchSeat.position.set(0, 0.38, 0);
    vg.add(benchSeat);

    [-0.65, 0.65].forEach(bx => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.38, 7), woodMat);
      leg.position.set(bx, 0.19, 0);
      vg.add(leg);
    });

    // Wooden supply crate
    const crateMat = new THREE.MeshStandardMaterial({ color: 0x6e4a2a, roughness: 0.85 });
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.65, 0.65), crateMat);
    crate.position.set(1.2, 0.32, -0.2);
    crate.rotation.y = 0.25;
    vg.add(crate);

    // Small water cask on crate
    const caskMat = new THREE.MeshStandardMaterial({ color: 0x4a321d, roughness: 0.8 });
    const cask = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 0.55, 9), caskMat);
    cask.position.set(1.2, 0.92, -0.2);
    vg.add(cask);

    // Flat resting stone with travel lantern
    const stoneTable = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.40, 7), stonePlinthMat);
    stoneTable.position.set(-1.15, 0.20, -0.15);
    vg.add(stoneTable);

    const waysideLantern = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), lampMat);
    waysideLantern.position.set(-1.15, 0.52, -0.15);
    vg.add(waysideLantern);

    const softGlow = new THREE.PointLight(0xffb040, 0.9, 6.0);
    softGlow.position.set(-1.15, 0.52, -0.15);
    vg.add(softGlow);

    vg.position.set(wx, wy, wz);
    vg.rotation.y = Math.atan2(facingDir.x, facingDir.z);
    scene.add(vg);
  }

  spawnRestVignette(-135, 32, new THREE.Vector3(1, 0, 0.4));
  spawnRestVignette(28, 108, new THREE.Vector3(0.3, 0, -1));
  spawnRestVignette(238, -78, new THREE.Vector3(-0.8, 0, -0.6));
}
createRusticTrailDetails();

// ── Water, Motes & Atmosphere ────────────────────────────────────────────────
const anim = { water: [], poi: [], players: [], clouds: [], motes: null, streamer: null };
{
  const wGeo = new THREE.PlaneGeometry(130, 85, 40, 30);
  wGeo.rotateX(-Math.PI / 2);
  const waterMat = new THREE.MeshPhysicalMaterial({
    color: 0x16708a,
    roughness: 0.06,
    metalness: 0.04,
    clearcoat: 0.85,
    clearcoatRoughness: 0.06,
    transparent: true,
    opacity: 0.90,
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
  water.position.set(95, 0.45, -105);
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
  const moteCount = 420;
  const moteOffsets = new Float32Array(moteCount * 3);
  const moteColors = new Float32Array(moteCount * 3);
  const motePhases = new Float32Array(moteCount);
  const moteSpeeds = new Float32Array(moteCount);

  const colGold = new THREE.Color(0xffe28a);
  const colLeaf = new THREE.Color(0x7ec842);
  const colAmber = new THREE.Color(0xdf983a);

  for (let i = 0; i < moteCount; i++) {
    moteOffsets[i * 3] = (Math.random() - 0.5) * 160;
    moteOffsets[i * 3 + 1] = 1.0 + Math.random() * 24;
    moteOffsets[i * 3 + 2] = (Math.random() - 0.5) * 160;
    motePhases[i] = Math.random() * Math.PI * 2;
    moteSpeeds[i] = 0.6 + Math.random() * 1.2;

    const c = (i % 3 === 0) ? colGold : ((i % 3 === 1) ? colLeaf : colAmber);
    moteColors[i * 3] = c.r;
    moteColors[i * 3 + 1] = c.g;
    moteColors[i * 3 + 2] = c.b;
  }

  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(moteOffsets, 3));
  moteGeo.setAttribute('color', new THREE.BufferAttribute(moteColors, 3));
  moteGeo.setAttribute('aPhase', new THREE.BufferAttribute(motePhases, 1));
  moteGeo.setAttribute('aSpeed', new THREE.BufferAttribute(moteSpeeds, 1));

  const moteMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uCameraPos: { value: new THREE.Vector3() },
      uRange: { value: 80.0 }
    },
    vertexShader: `
      uniform float uTime;
      uniform vec3 uCameraPos;
      uniform float uRange;

      attribute float aPhase;
      attribute float aSpeed;
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vColor = color;
        float span = uRange * 2.0;

        // GPU drift along wind vector
        float x = position.x + aSpeed * uTime * 2.6 + sin(uTime * 1.3 + aPhase) * 1.4;
        float y = position.y - uTime * 0.35 + sin(uTime * 1.7 + aPhase) * 0.9;
        float z = position.z + cos(uTime * 0.9 + aPhase) * 1.3;

        // Wrap around camera
        float wx = mod(x - (uCameraPos.x - uRange), span) + (uCameraPos.x - uRange);
        float wy = mod(y - 0.6, 25.4) + 0.6;
        float wz = mod(z - (uCameraPos.z - uRange), span) + (uCameraPos.z - uRange);

        vec4 mvPos = modelViewMatrix * vec4(wx, wy, wz, 1.0);
        gl_PointSize = clamp((16.0 / -mvPos.z) * 18.0, 3.0, 22.0);
        gl_Position = projectionMatrix * mvPos;

        // Distance fade
        float distCam = length(vec3(wx, wy, wz) - uCameraPos);
        vAlpha = smoothstep(uRange, uRange - 16.0, distCam) * smoothstep(1.5, 5.0, distCam);
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vec2 coord = gl_PointCoord - vec2(0.5);
        float d = length(coord);
        if (d > 0.5) discard;
        float soft = smoothstep(0.5, 0.08, d) * vAlpha * 0.85;
        gl_FragColor = vec4(vColor, soft);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const moteSystem = new THREE.Points(moteGeo, moteMat);
  scene.add(moteSystem);
  anim.motesMat = moteMat;
}

function cloud() {
  const g = new THREE.Group(), ma = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.34, depthWrite: false });
  for (let i = 0; i < 7; i++) {
    const c = new THREE.Mesh(new THREE.SphereGeometry(rnd(6.5, 11.0), 10, 7), ma);
    c.position.set(rnd(-14, 14), rnd(-1, 1), rnd(-7, 7));
    c.scale.y = 0.40;
    g.add(c);
  }
  const posX = rnd(-320, 320);
  const posZ = rnd(-200, 200);
  g.position.set(posX, rnd(18, 32), posZ);
  g.userData.speed = rnd(0.35, 0.75);

  scene.add(g);
  anim.clouds.push(g);
}
for (let i = 0; i < 12; i++) cloud();

// ── Install World & Progressive Streamer ─────────────────────────────────────
const worldReady = installRealisticWorld({
  scene,
  missions,
  getTerrainY,
  trailPoints: trailPoints2D,
  onProgress: (value, label) => {
    updateBootProgress(value, label);
  }
}).then(streamer => {
  anim.streamer = streamer;
  missions.forEach(q => {
    if (q.structGroup) anim.poi.push(q.structGroup);
  });
  renderer.compile(scene, camera);
  rebuildPlayers();
  setOverview3DMode(true, true);
  showBootReady();
}).catch(error => {
  console.error('Error inicializando streaming:', error);
  rebuildPlayers();
  setOverview3DMode(true, true);
  showBootReady();
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
  const isLast = current >= MAX_MISSION;

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

const DEFAULT_STATION_MEDIA = {
  1: [
    { order: 1, type: 'video', title: 'Orientación del Onboarding', file: 'assets/media/station_01/01_Introduccion.mp4', desc: 'Cápsula de Video', badge: 'Video', xp: 40 },
    { order: 2, type: 'video', title: 'Ruta y Metas de la Expedición', file: 'assets/media/station_01/02_Detalles.mp4', desc: 'Cápsula de Video', badge: 'Video', xp: 40 }
  ],
  2: [
    {
      order: 1,
      type: 'ensala',
      title: 'Entrega de Equipos en Sala',
      desc: 'Entrega presencial del kit tecnológico corporativo y credencial',
      badge: 'En Sala',
      protocol: 'El facilitador y el equipo de IT harán entrega formal de tus herramientas de trabajo en la sala. Por favor verifica que tu laptop encienda correctamente, que tu credencial física funcione en los accesos y que recibas tu cargador y kit de bienvenida.',
      keypoints: [
        'Laptop corporativa configurada con antivirus y perfil de seguridad',
        'Credencial física de acceso al edificio y oficinas corporativas',
        'Periféricos tech (cargador de corriente, mouse y adaptadores)',
        'Kit de bienvenida institucional Bradesco'
      ],
      xp: 50
    }
  ],
  3: [
    {
      order: 1,
      type: 'ensala',
      title: 'Firma de Contrato y Beneficios',
      desc: 'Formalización legal del pacto laboral y alta de expediente en sala',
      badge: 'En Sala',
      protocol: 'Revisión y firma física autógrafa de los documentos contractuales con el equipo de Recursos Humanos. Se entregará copia de tu contrato individual de trabajo y se detallará la póliza de seguro de gastos médicos mayores, vales de despensa y prestaciones superiores a la ley.',
      keypoints: [
        'Firma física autógrafa del contrato individual de trabajo por tiempo indeterminado',
        'Alta formal ante el IMSS y conformación de expediente laboral corporativo',
        'Explicación a detalle del paquete de beneficios y prestaciones superiores',
        'Póliza de seguro de gastos médicos mayores, seguro de vida y vales de despensa'
      ],
      xp: 60
    },
    { order: 2, type: 'image', title: 'Catálogo de Beneficios y Prestaciones', file: 'assets/media/station_01/03_Descrubre los beneficios.png', desc: 'Infografía Visual', badge: 'Infografía', xp: 40 }
  ],
  4: [
    {
      order: 1,
      type: 'ensala',
      title: 'Círculo de Bienvenida & Integración',
      desc: 'Dinámica grupal de presentación e integración en sala',
      badge: 'En Sala',
      protocol: 'Dinámica presencial en sala con todo el grupo: ronda de bienvenida, presentación de cada nuevo aventurero compartiendo su rol y lo que más le entusiasma de integrarse a Bradesco, seguido de la explicación detallada de la agenda del día.',
      keypoints: [
        'Bienvenida formal al grupo y rompehielos de integración',
        'Presentaciones breves: nombre, área, rol y aficiones personales',
        'Conversación guiada: ¿Qué es lo que más te entusiasma de tu nueva etapa?',
        'Explicación de la agenda del día y resolución de dudas iniciales'
      ],
      xp: 50
    }
  ],
  5: [
    { order: 1, type: 'video', title: 'Historia y Propósito de Bradesco', file: 'assets/media/station_01/01_Introduccion.mp4', desc: 'Cápsula de Video', badge: 'Video', xp: 45 },
    {
      order: 2,
      type: 'ensala',
      title: 'Cultura, Valores y Diálogo en Sala',
      desc: 'Sesión presencial de profundización cultural con el facilitador',
      badge: 'En Sala',
      protocol: 'Espacio presencial conducido por el facilitador en sala para profundizar en la cultura corporativa, los pilares estratégicos de la compañía y responder preguntas sobre nuestra visión compartida.',
      keypoints: [
        'Pilares estratégicos y valores que orientan nuestro trabajo diario',
        'Trayectoria y liderazgo de Bradesco en el sector financiero',
        'Compromiso con la experiencia de nuestros clientes y el talento interno',
        'Sesión de diálogo abierto y preguntas con el facilitador en sala'
      ],
      xp: 45
    }
  ],
  6: [
    { order: 1, type: 'video', title: 'Introducción a la Misión', file: 'assets/media/station_02/01_Introduccion.mp4', desc: 'Cápsula de Video', badge: 'Video' },
    { order: 2, type: 'image', title: 'Guía de Estrategia y Objetivos', file: 'assets/media/station_02/03_Descrubre los beneficios.png', desc: 'Infografía Visual', badge: 'Infografía' },
    { order: 3, type: 'image', title: 'Diagrama de Procesos', file: 'assets/media/station_02/05_Analiza el flujo.png', desc: 'Infografía Visual', badge: 'Infografía' }
  ],
  7: [
    { order: 1, type: 'video', title: 'Introducción a la Misión', file: 'assets/media/station_01/01_Introduccion.mp4', desc: 'Cápsula de Video', badge: 'Video' },
    { order: 2, type: 'image', title: 'Guía de Estrategia y Objetivos', file: 'assets/media/station_01/03_Descrubre los beneficios.png', desc: 'Infografía Visual', badge: 'Infografía' },
    { order: 3, type: 'image', title: 'Diagrama de Procesos', file: 'assets/media/station_01/05_Analiza el flujo.png', desc: 'Infografía Visual', badge: 'Infografía' }
  ],
  8: [
    { order: 1, type: 'video', title: 'Introducción al Gestor Documental', file: 'assets/media/station_02/01_Introduccion.mp4', desc: 'Cápsula de Video', badge: 'Video' },
    { order: 2, type: 'image', title: 'Manual de Archivo y Clasificación', file: 'assets/media/station_02/03_Descrubre los beneficios.png', desc: 'Infografía Visual', badge: 'Infografía' },
    { order: 3, type: 'image', title: 'Flujo de Trazabilidad y Firmas', file: 'assets/media/station_02/05_Analiza el flujo.png', desc: 'Infografía Visual', badge: 'Infografía' }
  ],
  9: [
    { order: 1, type: 'video', title: 'Introducción al Código de Ética', file: 'assets/media/station_01/01_Introduccion.mp4', desc: 'Cápsula de Video', badge: 'Video' },
    { order: 2, type: 'image', title: 'Principios de Conducta e Integridad', file: 'assets/media/station_01/03_Descrubre los beneficios.png', desc: 'Infografía Visual', badge: 'Infografía' },
    { order: 3, type: 'image', title: 'Canal Confidencial de Reportes', file: 'assets/media/station_01/05_Analiza el flujo.png', desc: 'Infografía Visual', badge: 'Infografía' }
  ],
  10: [
    { order: 1, type: 'video', title: 'Cultura y Conexión Institucional', file: 'assets/media/station_02/01_Introduccion.mp4', desc: 'Cápsula de Video', badge: 'Video' },
    { order: 2, type: 'image', title: 'Canales de Comunicación Interna', file: 'assets/media/station_02/03_Descrubre los beneficios.png', desc: 'Infografía Visual', badge: 'Infografía' },
    { order: 3, type: 'image', title: 'Comunidad y Eventos Corporativos', file: 'assets/media/station_02/05_Analiza el flujo.png', desc: 'Infografía Visual', badge: 'Infografía' }
  ],
  11: [
    { order: 1, type: 'video', title: 'Ruta 90 y Desarrollo Continuo', file: 'assets/media/station_01/01_Introduccion.mp4', desc: 'Cápsula de Video', badge: 'Video' },
    { order: 2, type: 'image', title: 'Hitos de Desempeño 30-60-90', file: 'assets/media/station_01/03_Descrubre los beneficios.png', desc: 'Infografía Visual', badge: 'Infografía' },
    { order: 3, type: 'image', title: 'Matriz de Evaluación de Logros', file: 'assets/media/station_01/05_Analiza el flujo.png', desc: 'Infografía Visual', badge: 'Infografía' }
  ],
  12: [
    { order: 1, type: 'video', title: 'Información Sindical y Diálogo', file: 'assets/media/station_02/01_Introduccion.mp4', desc: 'Cápsula de Video', badge: 'Video' },
    { order: 2, type: 'image', title: 'Derechos y Contrato Colectivo', file: 'assets/media/station_02/03_Descrubre los beneficios.png', desc: 'Infografía Visual', badge: 'Infografía' },
    { order: 3, type: 'image', title: 'Representación y Alianza Laboral', file: 'assets/media/station_02/05_Analiza el flujo.png', desc: 'Infografía Visual', badge: 'Infografía' }
  ],
  13: [
    { order: 1, type: 'video', title: 'Cierre de Expedición y Victoria', file: 'assets/media/station_01/01_Introduccion.mp4', desc: 'Cápsula de Video', badge: 'Video' },
    { order: 2, type: 'image', title: 'Compromiso con la Excelencia', file: 'assets/media/station_01/03_Descrubre los beneficios.png', desc: 'Infografía Visual', badge: 'Infografía' },
    { order: 3, type: 'image', title: 'Coronación y Graduación Oficial', file: 'assets/media/station_01/05_Analiza el flujo.png', desc: 'Infografía Visual', badge: 'Infografía' }
  ]
};

let STATION_MEDIA = Object.assign({}, DEFAULT_STATION_MEDIA);

async function syncStationMediaFromAPI() {
  try {
    const res = await fetch('./assets/media/media-manifest.json', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      STATION_MEDIA = Object.assign({}, DEFAULT_STATION_MEDIA, data);
      updateStationMediaTrigger();
      return;
    }
  } catch (err) {}

  try {
    const res = await fetch('/api/media', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      STATION_MEDIA = Object.assign({}, DEFAULT_STATION_MEDIA, data);
      updateStationMediaTrigger();
    }
  } catch (err) {}
}

// Initial sync
syncStationMediaFromAPI();

function updateStationMediaTrigger() {
  const mapMediaTrigger = document.getElementById('mapStationMediaTrigger');
  if (!mapMediaTrigger) return;
  // If camera is currently in flight / travel or in base camp or in overview 3D map, keep hidden
  if (travel || current === 0 || overview3DMode) {
    mapMediaTrigger.style.display = 'none';
    return;
  }
  const stationMediaItems = (STATION_MEDIA && STATION_MEDIA[current]) ? STATION_MEDIA[current] : (DEFAULT_STATION_MEDIA[current] || []);
  const totalCapsules = stationMediaItems.length + 2; // Media items + 2 integrated evaluations
  mapMediaTrigger.style.display = 'block';
  const badge = document.getElementById('mapMediaCountBadge');
  if (badge) badge.textContent = totalCapsules;
  const tag = document.getElementById('mapMediaStationTag');
  if (tag) tag.textContent = `MISIÓN ${String(current).padStart(2, '0')} · CÁPSULAS`;
}

function updateStationEvaluationsUI() {
  const mapEvalTrigger = document.getElementById('mapStationEvalTrigger');
  if (!mapEvalTrigger) return;
  if (travel || current === 0 || overview3DMode) {
    mapEvalTrigger.style.display = 'none';
  }
}

function applyStates() {
  renderUI();
}

function renderUI() {
  const q = getMission(current);
  const pct = Math.round((current / MAX_MISSION) * 100);

  // Update Mission Card in Sidebar
  const mEyebrow = document.getElementById('missionEyebrow');
  if (mEyebrow) {
    if (current === 0) {
      mEyebrow.textContent = 'BIENVENIDA · CAMPAMENTO BASE';
    } else {
      mEyebrow.textContent = `CHECKPOINT ${String(current).padStart(2, '0')}/${String(MAX_MISSION).padStart(2, '0')} · ${q.region.toUpperCase()}`;
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

  const hudExpeditionProgressText = document.getElementById('hudExpeditionProgressText');
  if (hudExpeditionProgressText) {
    hudExpeditionProgressText.textContent = `${pct}% completado`;
  }

  const mStatus = document.getElementById('missionStatus');
  if (mStatus) mStatus.textContent = current === MAX_MISSION ? 'Último Checkpoint' : 'En curso';

  const numEl = document.getElementById('skyMissionNum');
  if (numEl) numEl.textContent = `MISIÓN ${String(current).padStart(2, '0')}`;

  const nameEl = document.getElementById('skyMissionName');
  if (nameEl) nameEl.textContent = q.name.toUpperCase();

  const regEl = document.getElementById('skyMissionRegion');
  if (regEl) regEl.textContent = q.region;

  // Update In-Map Media Hub Trigger visibility
  updateStationMediaTrigger();

  // Navigation button states
  updateNavButtons();

  // Render clickable missions list
  renderMissionsList();

  // Render avatar picker grid for registration
  renderAvatarPickerGrid();

  // Render Clean Scoreboard / Ranking Leaderboard
  const rankList = document.getElementById('rankingList');
  if (rankList) {
    rankList.innerHTML = players.length
      ? [...players].sort((a, b) => b.points - a.points).map((p, i) => {
        const preset = AVATAR_PRESETS.find(a => a.id === p.avatarId) || AVATAR_PRESETS[0];
        return `
        <div class="rank">
          <b style="font-size:0.85rem">${i + 1}</b>
          <span class="avatar-dot" style="background:${p.color};display:flex;align-items:center;justify-content:center" title="${preset.name}">${preset.iconSvg || ''}</span>
          <div class="rank-info">
            <b>${p.name} <span class="rank-role-tag">${preset.name}</span></b>
            <small>${i === 0 ? 'Líder de la expedición' : preset.role}</small>
          </div>
          <span class="xp-pill">${p.points} XP</span>
        </div>`;
      }).join('')
      : '<p style="color:var(--muted);font-size:.78rem;padding:8px;text-align:center">No hay aventureros aún. Regístralos en el Panel de Control.</p>';
  }

  // Render Admin Interactive Players List (Direct buttons)
  const adminPList = document.getElementById('adminPlayersList');
  if (adminPList) {
    adminPList.innerHTML = players.length
      ? players.map(p => {
        const preset = AVATAR_PRESETS.find(a => a.id === p.avatarId) || AVATAR_PRESETS[0];
        const avatarOptions = AVATAR_PRESETS.map(av => `<option value="${av.id}" ${av.id === p.avatarId ? 'selected' : ''}>${av.name}</option>`).join('');
        return `
        <div class="admin-player-row">
          <div class="admin-player-info" style="align-items:center">
            <span class="avatar-dot" style="background:${p.color};width:28px;height:28px;display:flex;align-items:center;justify-content:center">${preset.iconSvg || ''}</span>
            <div style="display:flex;flex-direction:column;gap:1px;min-width:0">
              <b style="font-size:0.8rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.name}</b>
              <select class="admin-player-avatar-sel" onchange="window.setPlayerAvatar(${p.id}, this.value)" title="Cambiar avatar 3D">
                ${avatarOptions}
              </select>
            </div>
            <span class="xp-pill" style="font-size:0.72rem;padding:2px 7px;margin-left:auto">${p.points} XP</span>
          </div>
          <div class="admin-player-actions">
            <button class="quick-xp-btn" onclick="window.modifyXp(${p.id}, 5)" type="button" title="Sumar 5 XP a ${p.name}">+5 XP</button>
            <button class="quick-xp-btn" onclick="window.modifyXp(${p.id}, 10)" type="button" title="Sumar 10 XP a ${p.name}">+10 XP</button>
            <button class="quick-xp-btn" onclick="window.modifyXp(${p.id}, -5)" type="button" title="Restar 5 XP a ${p.name}">-5 XP</button>
            <button class="quick-xp-btn del" onclick="window.deletePlayer(${p.id})" type="button" title="Eliminar a ${p.name}"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
          </div>
        </div>`;
      }).join('')
      : '<p style="color:var(--muted);font-size:.78rem;padding:8px;text-align:center">No hay aventureros registrados aún. Usa el campo de arriba para añadir.</p>';
  }

  // Render Full Modal Players List
  renderModalFullPlayersList();

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
  pSel.innerHTML = players.map(p => `<option value="${p.id}">${p.name} · ${p.points} XP</option>`).join('');

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
  mList.innerHTML = missions.filter(x => !x.hidden).map(x => {
    const isDone = x.id < current;
    const isActive = x.id === current;
    const stateClass = isDone ? 'done' : isActive ? 'active' : 'available';
    const badgeContent = x.id === 0 ? '00' : (isDone ? '✓' : String(x.id));
    const statusText = x.id === 0 ? (isActive ? 'En curso' : '✓ Base') : (isDone ? '✓ Completada' : isActive ? 'En curso' : 'Explorar');
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
  0: { o: [3.8, 4.2, 11.8], h: 2.2, lz: -2.0 },   // Lobby de Expedición
  1: { o: [3.8, 4.2, 11.8], h: 2.2, lz: -2.0 },   // Arsenal y Equipos
  2: { o: [4.0, 4.4, 12.0], h: 2.4, lz: -2.2 },   // Firma de Contrato
  3: { o: [3.6, 4.2, 12.4], h: 2.5, lz: -2.2 },   // Hoy Comienza tu Historia
  4: { o: [4.0, 4.5, 12.5], h: 2.5, lz: -2.2 },   // Conoce de qué Formas Parte
  5: { o: [4.2, 5.0, 13.5], h: 2.8, lz: -1.5 },   // Nos Cuidamos, Cuidamos la Confianza
  6: { o: [3.8, 4.4, 12.2], h: 2.4, lz: -2.0 },   // Pausa de Recarga
  7: { o: [4.0, 4.5, 12.4], h: 2.4, lz: -2.0 },   // Humand y Comedor
  8: { o: [-4.2, 4.4, 12.5], h: 2.4, lz: -1.8, lx: 0.5 }, // Tarjeta Cosmos: Vista abierta al mercado y lago
  9: { o: [4.0, 4.4, 12.2], h: 2.4, lz: -2.0 },   // Cultura y Comunicación
  10: { o: [3.8, 4.2, 12.0], h: 2.3, lz: -2.0 },  // E-Learning & Academia
  11: { o: [4.0, 4.5, 12.2], h: 2.4, lz: -2.0 },  // Gestor Documental
  12: { o: [4.0, 4.5, 12.4], h: 2.4, lz: -2.0 },  // Tu Equipo te Estaba Esperando
  13: { o: [3.8, 4.4, 12.2], h: 2.4, lz: -2.0 },  // Tu Historia Continúa: Almuerzo
  14: { o: [4.0, 4.4, 12.2], h: 2.4, lz: -2.0 },  // Voz del Cliente: NPS
  15: { o: [4.2, 4.8, 12.8], h: 2.6, lz: -2.0 },  // Pilares Normativos
  16: { o: [4.0, 4.6, 12.5], h: 2.5, lz: -2.0 },  // Representación & Sindicato
  17: { o: [5.5, 7.5, 16.5], h: 4.2, lz: -1.0 }  // Bastión Real: Cierre & Graduación
};

function cameraPose(q) {
  const s = SHOTS[q.id] || SHOTS[1];
  const wy = getTerrainY(q.x, q.z);
  const lookX = q.x + (s.lx || 0);
  const lookY = wy + (s.h || 2.4);
  const lookZ = q.z + (s.lz !== undefined ? s.lz : -2.0);
  return {
    pos: new THREE.Vector3(q.x + s.o[0], wy + s.o[1], q.z + s.o[2]),
    look: new THREE.Vector3(lookX, lookY, lookZ)
  };
}

function cinematicEase(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

function startTravel(id, show = true) {
  overview3DMode = false;
  if (checkpointLabelsLayer) {
    checkpointLabelsLayer.classList.remove('visible');
    checkpointLabelsLayer.style.display = 'none';
  }
  if (overview3dBtn) {
    overview3dBtn.classList.remove('active');
    overview3dBtn.setAttribute('aria-pressed', 'false');
    overview3dBtn.title = 'Ver Mapa General de la Ruta';
  }
  const mapHeader = document.getElementById('hudMapExpeditionHeader');
  if (mapHeader) mapHeader.classList.remove('visible');
  routeOverviewGroup.visible = false;

  if (freeCamera) setFreeCamera(false);
  if (firstPerson) setFirstPerson(false);
  const mapMediaTrigger = document.getElementById('mapStationMediaTrigger');
  if (mapMediaTrigger) mapMediaTrigger.style.display = 'none';
  const mapEvalTrigger = document.getElementById('mapStationEvalTrigger');
  if (mapEvalTrigger) mapEvalTrigger.style.display = 'none';

  if (Number(id) === 0) {
    const destination = getMission(0);
    const targetPose = cameraPose(destination);
    camera.position.copy(targetPose.pos);
    lookTarget.copy(targetPose.look);
    camera.lookAt(lookTarget);
    orbit.target.copy(lookTarget);
    cinematicUI(false);
    travel = null;
    rebuildPlayers();
    updateStationMediaTrigger();
    updateStationEvaluationsUI();
    return;
  }
  const destination = getMission(id);
  const targetPose = cameraPose(destination);
  const dist = camera.position.distanceTo(targetPose.pos);

  if (!show || dist < 4.0) {
    camera.position.copy(targetPose.pos);
    lookTarget.copy(targetPose.look);
    camera.lookAt(lookTarget);
    orbit.target.copy(lookTarget);
    cinematicUI(false);
    travel = null;
    rebuildPlayers();
    updateStationMediaTrigger();
    updateStationEvaluationsUI();
    return;
  }

  // Vuelo parabólico continuo, ligero y fluido (~1.8s a 2.5s) a baja altitud siguiendo el terreno
  const duration = clamp(dist * 0.0042 + 1.50, 1.75, 2.55);

  const midX = (camera.position.x + targetPose.pos.x) * 0.5;
  const midZ = (camera.position.z + targetPose.pos.z) * 0.5;
  const dx = targetPose.pos.x - camera.position.x;
  const dz = targetPose.pos.z - camera.position.z;
  const sideOffset = clamp(dist * 0.08, 3.5, 14.0);
  const lenXZ = Math.hypot(dx, dz) || 1;
  const ctrlX = midX - (dz / lenXZ) * sideOffset * 0.45;
  const ctrlZ = midZ + (dx / lenXZ) * sideOffset * 0.45;
  const midGroundY = getTerrainY(ctrlX, ctrlZ);
  const arcLift = clamp(dist * 0.11, 10.0, 24.0);
  const ctrlY = Math.max(camera.position.y, targetPose.pos.y, midGroundY + 8.0) + arcLift;

  travel = {
    startPos: camera.position.clone(),
    startLook: lookTarget.clone(),
    midPos: new THREE.Vector3(ctrlX, ctrlY, ctrlZ),
    finalPos: targetPose.pos.clone(),
    finalLook: targetPose.look.clone(),
    destination,
    targetPose,
    destinationName: destination.name,
    t: 0,
    duration
  };

  rebuildPlayers();
  cinematicUI(true, `Rumbo a ${destination.name}`);
}

function cinematicUI(active, phase = '') {
  const layer = document.getElementById('cinematicSequence'), stage = document.getElementById('stage');
  if (layer) layer.classList.toggle('active', false);
  if (stage) stage.classList.toggle('cinematic-running', active);
  document.body.classList.toggle('cinematic-active', active);
  const screen = document.querySelector('.screen');
  if (screen) screen.classList.toggle('cinematic-active', active);
  const label = document.getElementById('cinematicPhase'), bar = document.getElementById('cinematicBar');
  if (label && phase) label.textContent = phase;
  if (bar && !active) bar.style.width = '0%';
}

// Posición inicial del motor 3D: Mapa General Cenital desde Arriba (Centrado)
camera.position.set(118, 760, 45);
let lookTarget = new THREE.Vector3(118, 0, 10);
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
orbit.maxDistance = 950;
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

// ── Vista General Cenital del Mapa de la Expedición (Top-Down Overview 3D Map) ─
let overview3DMode = true;
let overviewZoomLevel = 1.0;
let overviewTargetZoom = 1.0;
let overviewPanX = 0;
let overviewPanZ = 0;
let overviewTargetPanX = 0;
let overviewTargetPanZ = 0;
let isPanningOverview = false;
let panStartX = 0;
let panStartY = 0;
let overviewPointerMoved = false;
const overview3dBtn = document.getElementById('overview3dBtn');
const _focusTargetPos = new THREE.Vector3(118, 760, 45);
const _focusTargetLook = new THREE.Vector3(118, 0, 10);
const _projVec = new THREE.Vector3();
const routeOverviewGroup = new THREE.Group();
routeOverviewGroup.visible = false;
scene.add(routeOverviewGroup);

let lastOverviewRibbonMission = -1;

function ensureOverviewRouteRibbon() {
  if (lastOverviewRibbonMission === current && routeOverviewGroup.children.length > 0) {
    routeOverviewGroup.visible = true;
    return;
  }
  lastOverviewRibbonMission = current;
  rebuildOverviewRouteRibbon();
}

// Iluminación sutil y plana del camino ya recorrido (precargado en memoria)
function rebuildOverviewRouteRibbon() {
  while (routeOverviewGroup.children.length > 0) {
    const child = routeOverviewGroup.children[0];
    routeOverviewGroup.remove(child);
    if (child.geometry) child.geometry.dispose();
  }

  const total = 320;
  const pts = roadCurve.getSpacedPoints(total);
  const curMission = getMission(current);

  let splitIdx = 0;
  if (current <= 0) {
    splitIdx = 0;
  } else if (current >= MAX_MISSION) {
    splitIdx = pts.length - 1;
  } else {
    let minD = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const d = Math.hypot(pts[i].x - curMission.x, pts[i].z - curMission.z);
      if (d < minD) { minD = d; splitIdx = i; }
    }
  }

  // 1. Iluminación sutil dorada de empedrado recorrido (resplandor cálido noble, cero rayas rojas agresivas)
  const ribbonLayers = [
    { halfW: 2.8, yOff: 0.14, color: 0xffd166, opacity: 0.35 },
    { halfW: 0.9, yOff: 0.18, color: 0xffffff, opacity: 0.65 }
  ];
  if (splitIdx >= 2) ribbonLayers.forEach(layer => {
    const vertices = [];
    const uvs = [];
    const indices = [];
    const halfW = layer.halfW;

    for (let i = 0; i <= splitIdx; i++) {
      const p = pts[i];
      let tx = 0, tz = 0;
      if (i === 0) {
        tx = pts[1].x - p.x; tz = pts[1].z - p.z;
      } else if (i === splitIdx) {
        tx = p.x - pts[i - 1].x; tz = p.z - pts[i - 1].z;
      } else {
        tx = pts[i + 1].x - pts[i - 1].x; tz = pts[i + 1].z - pts[i - 1].z;
      }
      const len = Math.hypot(tx, tz) || 1;
      const nx = -tz / len;
      const nz = tx / len;

      const yLeft = getTerrainY(p.x - nx * halfW, p.z - nz * halfW) + layer.yOff;
      const yRight = getTerrainY(p.x + nx * halfW, p.z + nz * halfW) + layer.yOff;

      vertices.push(p.x - nx * halfW, yLeft, p.z - nz * halfW);
      vertices.push(p.x + nx * halfW, yRight, p.z + nz * halfW);

      const u = i / splitIdx;
      uvs.push(u, 0, u, 1);

      if (i < splitIdx) {
        const b = i * 2;
        indices.push(b, b + 1, b + 2, b + 2, b + 1, b + 3);
      }
    }

    const ribbonGeo = new THREE.BufferGeometry();
    ribbonGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    ribbonGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    ribbonGeo.setIndex(indices);
    ribbonGeo.computeVertexNormals();

    const ribbonMat = new THREE.MeshBasicMaterial({
      color: layer.color,
      transparent: true,
      opacity: layer.opacity,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    routeOverviewGroup.add(new THREE.Mesh(ribbonGeo, ribbonMat));
  });

  // 2. Halos planos en estaciones completadas
  const ringGeo = new THREE.RingGeometry(3.6, 5.0, 24);
  ringGeo.rotateX(-Math.PI / 2);
  missions.forEach(m => {
    if (m.hidden) return;
    if (m.id <= Math.max(current, 1)) {
      const isCurr = m.id === Math.max(current, 1);
      const ringMat = new THREE.MeshBasicMaterial({
        color: isCurr ? 0xffd166 : 0xcc092f,
        transparent: true,
        opacity: isCurr ? 0.85 : 0.45,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.set(m.x, getTerrainY(m.x, m.z) + 0.12, m.z);
      routeOverviewGroup.add(ring);
    }
  });

  routeOverviewGroup.visible = overview3DMode;
}

function getOverview3DHomePose() {
  const stage = document.getElementById('stage');
  const w = (stage && stage.clientWidth) ? stage.clientWidth : window.innerWidth;
  const h = (stage && stage.clientHeight) ? stage.clientHeight : window.innerHeight;
  const aspect = Math.max(0.75, w / (h || 1));
  const tanHalfFov = Math.tan(THREE.MathUtils.degToRad((camera ? camera.fov : 38) * 0.5));
  // Route extends x: -360 to +625 (985m), z: -125 to +125 (250m)
  const reqWidth = 1420; // 985m route + 435m wide margin framing Stations 16 & 17
  const reqHeight = 650; // 250m route + top title and HUD breathing space
  const distW = reqWidth / (2 * tanHalfFov * aspect);
  const distH = reqHeight / (2 * tanHalfFov);
  const baseDist = Math.max(distW, distH, 920);
  const targetDist = baseDist * overviewZoomLevel;

  // Vista cenital directamente desde arriba (pitch 87.5°, centrada en la ruta y con paneo/zoom dinámico)
  const centerX = 150 + overviewPanX;
  const centerZ = -5 + overviewPanZ; // centrado perfecto liberando espacio para el HUD
  const look = new THREE.Vector3(centerX, 0, centerZ);
  const pos = new THREE.Vector3(centerX, targetDist, centerZ + targetDist * 0.042);
  return { pos, look };
}

function startTravelToOverview() {
  if (firstPerson) setFirstPerson(false);
  if (freeCamera) setFreeCamera(false);
  const mapMediaTrigger = document.getElementById('mapStationMediaTrigger');
  if (mapMediaTrigger) mapMediaTrigger.style.display = 'none';
  const mapEvalTrigger = document.getElementById('mapStationEvalTrigger');
  if (mapEvalTrigger) mapEvalTrigger.style.display = 'none';
  const skyTitleEl = document.getElementById('missionSkyTitle');
  if (skyTitleEl) skyTitleEl.classList.remove('visible');

  overview3DMode = true;
  ensureOverviewRouteRibbon();
  if (checkpointLabelsLayer) checkpointLabelsLayer.style.display = 'block';

  const home = getOverview3DHomePose();
  _focusTargetPos.copy(home.pos);
  _focusTargetLook.copy(home.look);
  const dist = camera.position.distanceTo(home.pos);

  if (dist < 4.0) {
    camera.position.copy(home.pos);
    lookTarget.copy(home.look);
    camera.lookAt(lookTarget);
    orbit.target.copy(lookTarget);
    travel = null;
    cinematicUI(false);
    return;
  }

  const arcLift = Math.min(30.0, Math.max(10.0, dist * 0.08));
  const ctrlX = (camera.position.x + home.pos.x) * 0.5;
  const ctrlZ = (camera.position.z + home.pos.z) * 0.5;
  const ctrlY = Math.max(camera.position.y, home.pos.y) + arcLift;

  travel = {
    startPos: camera.position.clone(),
    startLook: lookTarget.clone(),
    midPos: new THREE.Vector3(ctrlX, ctrlY, ctrlZ),
    finalPos: home.pos.clone(),
    finalLook: home.look.clone(),
    t: 0,
    duration: 0.55, // Retorno al mapa ágil y suave (sin esperas de carga)
    onComplete: () => {
      camera.position.copy(home.pos);
      lookTarget.copy(home.look);
      camera.lookAt(lookTarget);
      orbit.target.copy(lookTarget);
      travel = null;
      cinematicUI(false);
    }
  };
  cinematicUI(false); // Cero barra roja de carga, cero letterboxing
}

function setOverview3DMode(enabled, skipCameraReturn = false) {
  overview3DMode = Boolean(enabled);
  updateSunShadow(true);
  const mapHeader = document.getElementById('hudMapExpeditionHeader');
  if (mapHeader) {
    mapHeader.classList.toggle('visible', overview3DMode);
  }
  if (overview3DMode) {
    if (firstPerson) setFirstPerson(false);
    if (freeCamera) setFreeCamera(false);
    ensureOverviewRouteRibbon();
    const mapMediaTrigger = document.getElementById('mapStationMediaTrigger');
    if (mapMediaTrigger) mapMediaTrigger.style.display = 'none';
    const skyTitleEl = document.getElementById('missionSkyTitle');
    if (skyTitleEl) skyTitleEl.classList.remove('visible');
    if (checkpointLabelsLayer) {
      checkpointLabelsLayer.classList.add('visible');
      checkpointLabelsLayer.style.display = 'block';
    }

    const home = getOverview3DHomePose();
    _focusTargetPos.copy(home.pos);
    _focusTargetLook.copy(home.look);

    if (!skipCameraReturn) {
      startTravelToOverview();
    } else {
      camera.position.copy(home.pos);
      lookTarget.copy(home.look);
      camera.lookAt(lookTarget);
      orbit.target.copy(lookTarget);
      travel = null;
      cinematicUI(false);
    }
  } else {
    overviewTargetZoom = 1.0;
    overviewZoomLevel = 1.0;
    overviewTargetPanX = 0;
    overviewPanX = 0;
    overviewTargetPanZ = 0;
    overviewPanZ = 0;
    routeOverviewGroup.visible = false;
    if (checkpointLabelsLayer) {
      checkpointLabelsLayer.classList.remove('visible');
      checkpointLabelsLayer.style.display = 'none';
    }
    if (!skipCameraReturn) {
      startTravel(current, true);
    }
  }

  if (overview3dBtn) {
    overview3dBtn.classList.toggle('active', overview3DMode);
    overview3dBtn.setAttribute('aria-pressed', String(overview3DMode));
    overview3dBtn.title = overview3DMode ? 'Enfocar Estación Actual' : 'Ver Mapa General de la Ruta';
  }
}

overview3dBtn?.addEventListener('click', () => setOverview3DMode(!overview3DMode));

window.jumpFromMapToMission = function(missionId) {
  setOverview3DMode(false, true);
  setMission(Number(missionId), true);
};


// ── Weather & Atmospheric Presets ───────────────────────────────────────────
const weatherNames = ['Día claro', 'Nublado', 'Lluvia', 'Atardecer'];
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

// ── Control de Barra Lateral (Mostrar / Ocultar) ─────────────────────────
const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
const sidebarCloseBtn = document.getElementById('sidebarCloseBtn');

function toggleSidebar(forceState) {
  const isCollapsed = forceState !== undefined
    ? screenEl?.classList.toggle('sidebar-collapsed', forceState)
    : screenEl?.classList.toggle('sidebar-collapsed');
  if (sidebarToggleBtn) {
    sidebarToggleBtn.setAttribute('aria-pressed', String(!isCollapsed));
    sidebarToggleBtn.title = isCollapsed ? 'Mostrar Panel Lateral' : 'Ocultar Panel Lateral';
  }
  setTimeout(resize, 40);
}

sidebarToggleBtn?.addEventListener('click', () => toggleSidebar());
sidebarCloseBtn?.addEventListener('click', () => toggleSidebar(true));




function updateWeather(t, dt) {
  weatherBlend += (weatherTarget - weatherBlend) * Math.min(1, dt * 1.2);
  const lo = Math.floor(weatherBlend), hi = Math.min(3, Math.ceil(weatherBlend)), f = weatherBlend - lo;
  scene.fog.color.lerpColors(new THREE.Color(FOG_COLORS[lo]), new THREE.Color(FOG_COLORS[hi]), f);
  const baseFog = THREE.MathUtils.lerp(SKY_PRESETS[lo].fogExp, SKY_PRESETS[hi].fogExp, f);
  scene.fog.density = overview3DMode ? 0.00006 : baseFog;
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
  if (current >= MAX_MISSION) return;
  setMission(current + 1, true);
}

function setMission(id, move = true) {
  const targetId = clamp(Number(id) ?? 0, 0, MAX_MISSION);
  if (move && overview3DMode) {
    setOverview3DMode(false, true);
  }
  const startMission = getMission(current);
  current = targetId;
  const targetMission = getMission(current);

  // Direct DOM updates for instant responsiveness
  const mEyebrow = document.getElementById('missionEyebrow');
  if (mEyebrow) {
    if (current === 0) {
      mEyebrow.textContent = 'BIENVENIDA · CAMPAMENTO BASE';
    } else {
      mEyebrow.textContent = `CHECKPOINT ${String(current).padStart(2, '0')}/${String(MAX_MISSION).padStart(2, '0')} · ${targetMission.region.toUpperCase()}`;
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
  if (pPct) pPct.textContent = Math.round((current / MAX_MISSION) * 100) + '%';

  const mStatus = document.getElementById('missionStatus');
  if (mStatus) {
    mStatus.textContent = current === 0 ? 'Punto de Partida' : (current === MAX_MISSION ? 'Último Checkpoint' : 'En curso');
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
  updateSunShadow(true);
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

// Zoom suave con rueda del ratón y paneo arrastrando en vista de mapa (Opción 6)
renderer.domElement.addEventListener('wheel', e => {
  if (overview3DMode && !travel) {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 1.08 : 0.92;
    overviewTargetZoom = clamp(overviewTargetZoom * zoomFactor, 0.55, 1.15);
  }
}, { passive: false });

renderer.domElement.addEventListener('dblclick', () => {
  if (overview3DMode && !travel) {
    overviewTargetZoom = 1.0;
    overviewTargetPanX = 0;
    overviewTargetPanZ = 0;
  }
});

renderer.domElement.addEventListener('pointerdown', e => {
  pointerDownPos = { x: e.clientX, y: e.clientY };
  if (overview3DMode && !travel && e.button === 0) {
    isPanningOverview = true;
    overviewPointerMoved = false;
    panStartX = e.clientX;
    panStartY = e.clientY;
  }
});

window.addEventListener('pointermove', e => {
  if (overview3DMode && isPanningOverview && !travel) {
    const dx = e.clientX - panStartX;
    const dy = e.clientY - panStartY;
    if (Math.hypot(dx, dy) > 4) overviewPointerMoved = true;
    panStartX = e.clientX;
    panStartY = e.clientY;

    const stage = document.getElementById('stage');
    const h = (stage && stage.clientHeight) ? stage.clientHeight : window.innerHeight;
    const worldUnitsPerPixel = (680 * overviewZoomLevel) / (h * 1.15);

    overviewTargetPanX -= dx * worldUnitsPerPixel;
    overviewTargetPanZ -= dy * worldUnitsPerPixel;

    overviewTargetPanX = clamp(overviewTargetPanX, -380, 380);
    overviewTargetPanZ = clamp(overviewTargetPanZ, -220, 220);
  }
});

window.addEventListener('pointerup', () => {
  isPanningOverview = false;
});

renderer.domElement.addEventListener('pointerup', e => {
  const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
  if (dist > 8 || overviewPointerMoved) return;

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

let selectedRegisterAvatar = 'ranger';
let selectedRegisterColor = '#cc092f';
let modalPreviewAnimName = 'idle';

function renderAvatarPickerGrid() {
  const container = document.getElementById('avatarPickerGrid');
  if (!container) return;
  container.innerHTML = AVATAR_PRESETS.map(preset => {
    const isSelected = preset.id === selectedRegisterAvatar;
    return `
      <div class="avatar-card ${isSelected ? 'selected' : ''}" onclick="window.selectRegisterAvatar('${preset.id}')" title="${preset.name}">
        <span class="avatar-card-icon">${preset.iconSvg || ''}</span>
        <div class="avatar-card-details">
          <span class="avatar-card-name">${preset.name}</span>
          <span class="avatar-card-role">${preset.role}</span>
        </div>
      </div>
    `;
  }).join('');
}

window.selectRegisterAvatar = function(avatarId) {
  selectedRegisterAvatar = avatarId;
  renderAvatarPickerGrid();
};

let modalPreviewRenderer = null;
let modalPreviewScene = null;
let modalPreviewCamera = null;
let modalPreviewHero = null;
let modalPreviewPlinth = null;
let modalPreviewAnimId = null;
let modalPreviewLastTime = 0;
let modalUserDragging = false;
let modalDragStartX = 0;
let modalManualAngle = 0;

function initModalHeroPreview3D() {
  const canvas = document.getElementById('heroPreviewCanvas');
  if (!canvas) return;

  const width = canvas.parentElement?.clientWidth || 360;
  const height = canvas.parentElement?.clientHeight || 268;

  if (!modalPreviewRenderer) {
    modalPreviewRenderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    modalPreviewRenderer.setSize(width, height, false);
    modalPreviewRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    modalPreviewRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    modalPreviewRenderer.toneMappingExposure = 1.25;

    modalPreviewScene = new THREE.Scene();

    modalPreviewCamera = new THREE.PerspectiveCamera(28, width / height, 0.1, 20);
    modalPreviewCamera.position.set(0, 0.78, 2.75);
    modalPreviewCamera.lookAt(0, 0.60, 0);

    // Studio Quality Multi-Point Lighting
    const amb = new THREE.AmbientLight(0xffffff, 1.85);
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(2.2, 4, 3);
    const fillFront = new THREE.DirectionalLight(0xfff5ea, 1.5);
    fillFront.position.set(0, 2, 4);
    const rim = new THREE.DirectionalLight(0x38bdf8, 1.8);
    rim.position.set(-3, 3, -2);
    const warmBounce = new THREE.PointLight(0xff8844, 1.0, 6);
    warmBounce.position.set(0, 0.2, 1.8);

    modalPreviewScene.add(amb, key, fillFront, rim, warmBounce);

    // Ornate Pedestal
    const plinthMat = new THREE.MeshStandardMaterial({ color: 0x242b35, roughness: 0.82, metalness: 0.15 });
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.54, 0.08, 32), plinthMat);
    plinth.position.y = 0.04;
    modalPreviewScene.add(plinth);

    const runeRingMat = new THREE.MeshStandardMaterial({ color: 0xcc092f, emissive: 0xcc092f, emissiveIntensity: 2.6 });
    modalPreviewPlinth = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.018, 10, 40), runeRingMat);
    modalPreviewPlinth.rotation.x = Math.PI / 2;
    modalPreviewPlinth.position.y = 0.082;
    modalPreviewScene.add(modalPreviewPlinth);

    // Mouse & Touch Interactive 360° Drag Turntable
    const wrap = document.getElementById('heroCanvasWrap') || canvas;
    wrap.style.cursor = 'grab';

    wrap.addEventListener('pointerdown', e => {
      modalUserDragging = true;
      modalDragStartX = e.clientX;
      wrap.style.cursor = 'grabbing';
      wrap.setPointerCapture?.(e.pointerId);
    });

    window.addEventListener('pointermove', e => {
      if (!modalUserDragging || !modalPreviewHero) return;
      const deltaX = e.clientX - modalDragStartX;
      modalDragStartX = e.clientX;
      modalManualAngle += deltaX * 0.015;
    });

    const stopDrag = () => {
      if (modalUserDragging) {
        modalUserDragging = false;
        if (wrap) wrap.style.cursor = 'grab';
      }
    };
    window.addEventListener('pointerup', stopDrag);
    window.addEventListener('pointercancel', stopDrag);
  } else {
    modalPreviewRenderer.setSize(width, height, false);
    if (modalPreviewCamera) {
      modalPreviewCamera.aspect = width / height;
      modalPreviewCamera.updateProjectionMatrix();
    }
  }
}

function updateModalPreviewInfo(preset) {
  const nameEl = document.getElementById('heroPreviewName');
  const roleEl = document.getElementById('heroPreviewRole');
  const descEl = document.getElementById('heroPreviewDesc');
  if (nameEl) nameEl.textContent = preset.name;
  if (roleEl) roleEl.textContent = preset.role;
  if (descEl) descEl.textContent = preset.desc || '';
}

function updateModalHeroPreview3D(avatarId) {
  initModalHeroPreview3D();
  if (!modalPreviewScene) return;

  const preset = AVATAR_PRESETS.find(a => a.id === avatarId) || AVATAR_PRESETS[0];
  updateModalPreviewInfo(preset);

  // Swap 3D Model
  if (modalPreviewHero) {
    modalPreviewScene.remove(modalPreviewHero);
    modalPreviewHero = null;
  }

  modalManualAngle = 0;

  modalPreviewHero = createHeroModel(preset.id, selectedRegisterColor || preset.primaryColor || '#cc092f', {
    targetHeight: 1.15,
    initialAnim: modalPreviewAnimName
  });
  modalPreviewHero.position.set(0, 0.08, 0);
  modalPreviewHero.rotation.y = 0;
  modalPreviewScene.add(modalPreviewHero);

  if (modalPreviewPlinth && modalPreviewPlinth.material) {
    const col = new THREE.Color(selectedRegisterColor || preset.primaryColor || '#cc092f');
    modalPreviewPlinth.material.color.copy(col);
    modalPreviewPlinth.material.emissive.copy(col);
  }

  // Animation Loop with real FBX AnimationMixer + Interactive Drag
  if (!modalPreviewAnimId) {
    modalPreviewLastTime = performance.now();
    function animatePreview(time) {
      const dt = Math.min(0.05, Math.max(0.001, (time - modalPreviewLastTime) * 0.001));
      modalPreviewLastTime = time;
      const sec = time * 0.001;

      if (modalPreviewHero) {
        if (modalUserDragging) {
          modalPreviewHero.rotation.y = modalManualAngle;
        } else {
          modalPreviewHero.rotation.y = modalManualAngle + Math.sin(sec * 0.85) * 0.28;
        }
        if (modalPreviewHero.userData && typeof modalPreviewHero.userData.update === 'function') {
          modalPreviewHero.userData.update(dt);
        }
      }
      if (modalPreviewPlinth) {
        modalPreviewPlinth.rotation.z = -sec * 0.45;
      }
      if (modalPreviewRenderer && modalPreviewScene && modalPreviewCamera) {
        modalPreviewRenderer.render(modalPreviewScene, modalPreviewCamera);
      }
      const modal = document.getElementById('heroSelectionModal');
      if (modal && (modal.open || modal.hasAttribute('open'))) {
        modalPreviewAnimId = requestAnimationFrame(animatePreview);
      } else {
        modalPreviewAnimId = null;
      }
    }
    modalPreviewAnimId = requestAnimationFrame(animatePreview);
  }
}

window.setPreviewAnim = function(animName) {
  modalPreviewAnimName = animName || 'idle';
  document.querySelectorAll('#heroAnimControls .hero-anim-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.anim === modalPreviewAnimName);
  });
  if (modalPreviewHero?.userData?.playAnimation) {
    modalPreviewHero.userData.playAnimation(modalPreviewAnimName);
  }
};

function renderModalHeroRoster() {
  const container = document.getElementById('modalHeroRosterGrid');
  if (!container) return;
  container.innerHTML = AVATAR_PRESETS.map(preset => {
    const isSelected = preset.id === selectedRegisterAvatar;
    return `
      <div class="hero-roster-card ${isSelected ? 'active' : ''}" onclick="window.selectModalHero('${preset.id}')" title="${preset.name}">
        <span class="hero-roster-avatar" style="border-color:${preset.primaryColor}66;background:${preset.primaryColor}22;color:${preset.primaryColor}">${preset.iconSvg || ''}</span>
        <div class="hero-roster-info">
          <span class="hero-roster-name">${preset.name}</span>
          <span class="hero-roster-role">${preset.role}</span>
        </div>
      </div>
    `;
  }).join('');
}

function renderModalHeroColorPicker() {
  const container = document.getElementById('modalHeroColorGrid');
  if (!container) return;
  const palette = ['#cc092f', ...colors];
  container.innerHTML = palette.map(hex => {
    const isSelected = hex.toLowerCase() === (selectedRegisterColor || '').toLowerCase();
    return `<button type="button" class="hero-color-swatch ${isSelected ? 'active' : ''}" style="background:${hex}" onclick="window.selectModalHeroColor('${hex}')" title="Color ${hex}"></button>`;
  }).join('');
}

window.selectModalHeroColor = function(colorHex) {
  selectedRegisterColor = colorHex;
  renderModalHeroColorPicker();
  if (modalPreviewPlinth && modalPreviewPlinth.material) {
    const col = new THREE.Color(colorHex);
    modalPreviewPlinth.material.color.copy(col);
    modalPreviewPlinth.material.emissive.copy(col);
  }
};

window.switchHeroTab = function(tabName) {
  const isCreate = tabName === 'create';
  const vRoster = document.getElementById('heroViewRoster');
  const vCreate = document.getElementById('heroViewCreate');
  const btnRoster = document.getElementById('heroTabRosterBtn');
  const btnCreate = document.getElementById('heroTabCreateBtn');

  if (vRoster) vRoster.style.display = isCreate ? 'none' : 'flex';
  if (vCreate) vCreate.style.display = isCreate ? 'block' : 'none';
  if (btnRoster) btnRoster.classList.toggle('active', !isCreate);
  if (btnCreate) btnCreate.classList.toggle('active', isCreate);

  if (isCreate) {
    setTimeout(() => {
      updateModalHeroPreview3D(selectedRegisterAvatar);
      const inp = document.getElementById('modalHeroNameInput');
      inp?.focus();
    }, 50);
  } else {
    renderModalFullPlayersList();
  }
};

function renderModalFullPlayersList() {
  const listEl = document.getElementById('modalFullPlayersList');
  const countEl = document.getElementById('modalPlayersCount');
  if (countEl) countEl.textContent = players.length;
  if (!listEl) return;

  if (players.length === 0) {
    listEl.innerHTML = `
      <div style="text-align:center;padding:45px 20px;color:#94a3b8;">
        <p style="font-size:0.95rem;margin-bottom:14px;">No hay aventureros registrados aún en la expedición.</p>
        <button type="button" class="admin-action-btn primary" onclick="window.switchHeroTab('create')">
          <span>＋ Crear Primer Aventurero</span>
        </button>
      </div>
    `;
    return;
  }

  const sortedPlayers = [...players].sort((a, b) => b.points - a.points);

  listEl.innerHTML = sortedPlayers.map((p, idx) => {
    const rankNum = idx + 1;
    const rankClass = rankNum === 1 ? 'rank-1' : rankNum === 2 ? 'rank-2' : rankNum === 3 ? 'rank-3' : '';
    const preset = AVATAR_PRESETS.find(a => a.id === p.avatarId) || AVATAR_PRESETS[0];
    const avatarOptions = AVATAR_PRESETS.map(av => `<option value="${av.id}" ${av.id === p.avatarId ? 'selected' : ''}>${av.name}</option>`).join('');

    return `
      <div class="hero-player-row">
        <div class="hero-player-info">
          <span class="hero-player-rank ${rankClass}">${rankNum}</span>
          <span class="hero-player-avatar-box" style="background:${p.color}22;border:1px solid ${p.color}55;color:${p.color};">${preset.iconSvg || ''}</span>
          <div class="hero-player-name-col">
            <strong>${p.name}</strong>
            <select class="hero-player-avatar-sel" onchange="window.setPlayerAvatar(${p.id}, this.value)" title="Cambiar avatar 3D">
              ${avatarOptions}
            </select>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <span class="hero-player-xp-pill">${p.points} XP</span>
          <div class="hero-player-actions">
            <button class="quick-xp-btn" onclick="window.modifyXp(${p.id}, 5)" type="button" title="Sumar 5 XP a ${p.name}">+5 XP</button>
            <button class="quick-xp-btn" onclick="window.modifyXp(${p.id}, 10)" type="button" title="Sumar 10 XP a ${p.name}">+10 XP</button>
            <button class="quick-xp-btn" onclick="window.modifyXp(${p.id}, -5)" type="button" title="Restar 5 XP a ${p.name}">-5 XP</button>
            <button class="quick-xp-btn del" onclick="window.deletePlayer(${p.id})" type="button" title="Eliminar a ${p.name}"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

window.openHeroSelectionModal = function(initialTab = 'roster') {
  const modal = document.getElementById('heroSelectionModal');
  if (!modal) return;
  const preset = AVATAR_PRESETS.find(a => a.id === selectedRegisterAvatar) || AVATAR_PRESETS[0];
  if (!selectedRegisterColor) selectedRegisterColor = preset.primaryColor || '#cc092f';
  modalPreviewAnimName = 'idle';
  renderModalHeroRoster();
  renderModalHeroColorPicker();
  renderModalFullPlayersList();
  window.switchHeroTab(initialTab);
  if (typeof modal.showModal === 'function') {
    modal.showModal();
  } else {
    modal.setAttribute('open', '');
  }
};

window.closeHeroSelectionModal = function() {
  const modal = document.getElementById('heroSelectionModal');
  if (modal) {
    if (typeof modal.close === 'function') {
      modal.close();
    } else {
      modal.removeAttribute('open');
    }
  }
  if (modalPreviewAnimId) {
    cancelAnimationFrame(modalPreviewAnimId);
    modalPreviewAnimId = null;
  }
};

window.selectModalHero = function(avatarId) {
  selectedRegisterAvatar = avatarId;
  const preset = AVATAR_PRESETS.find(a => a.id === avatarId);
  if (preset?.primaryColor) {
    selectedRegisterColor = preset.primaryColor;
  }
  renderModalHeroRoster();
  renderModalHeroColorPicker();
  updateModalHeroPreview3D(avatarId);
  renderAvatarPickerGrid();
};

window.confirmHeroCreation = function() {
  const inp = document.getElementById('modalHeroNameInput');
  const val = (inp?.value || '').trim();
  if (!val) {
    alert('Por favor escribe el nombre de tu aventurero.');
    inp?.focus();
    return;
  }
  inp.value = '';
  addParticipant(val, selectedRegisterAvatar, selectedRegisterColor);
  renderModalFullPlayersList();
  window.switchHeroTab('roster');
};

function addParticipant(name, avatarId = null, customColor = null) {
  const n = String(name || '').trim();
  if (!n) {
    alert('Por favor escribe el nombre de un participante.');
    return;
  }
  const maxId = players.reduce((max, p) => Math.max(max, Number(p.id) || 0), 0);
  const id = maxId + 1;
  const chosenAvatar = avatarId || selectedRegisterAvatar || (AVATAR_PRESETS[(id - 1) % AVATAR_PRESETS.length]?.id || 'ranger');
  const newP = {
    id,
    name: n,
    initials: initials(n),
    color: customColor || colors[(id - 1) % colors.length],
    avatarId: chosenAvatar,
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

window.setPlayerAvatar = function(id, avatarId) {
  const p = players.find(x => x.id === Number(id));
  if (p && avatarId) {
    p.avatarId = avatarId;
    rebuildPlayers();
    save();
    renderUI();
  }
};

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

const mDetailsEl = document.getElementById('missionsDetails');
const mChipEl = document.getElementById('missionsToggleChip');
if (mDetailsEl && mChipEl) {
  mDetailsEl.addEventListener('toggle', () => {
    mChipEl.textContent = mDetailsEl.open ? 'Ocultar' : 'Desplegar';
  });
}

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

const STATION_CHECKLISTS_CONFIG = {
  1: {
    title: 'Checklist de Arsenal y Equipos',
    subtitle: 'Verificación de Entrega',
    desc: 'Valida que cada aventurero haya recibido y verificado su kit inicial de trabajo:',
    xp: 20,
    items: [
      { key: 'laptop', num: '01', title: 'Laptop de Trabajo', desc: 'Equipo principal configurado con accesos, software y herramientas.', checkText: 'Entregado y Verificado' },
      { key: 'access', num: '02', title: 'Tarjeta & Credenciales', desc: 'Pase de acceso a edificios, torniquetes y doble factor (MFA).', checkText: 'Entregado y Activado' },
      { key: 'tech', num: '03', title: 'Periféricos Tech', desc: 'Headset para reuniones, mouse ergonómico y cargador/adaptador.', checkText: 'Entregado y Probado' },
      { key: 'swag', num: '04', title: 'Kit de Bienvenida (Swag)', desc: 'Mochila, libreta corporativa, termo y distintivos de la tribu.', checkText: 'Entregado al Aventurero' }
    ]
  },
  2: {
    title: 'Checklist de Contrato y Beneficios',
    subtitle: 'Formalización y Coberturas',
    desc: 'Sellado del pacto laboral y activación del catálogo de beneficios y coberturas:',
    xp: 25,
    items: [
      { key: 'contract', num: '01', title: 'Contrato Laboral', desc: 'Firma formal del contrato, confidencialidad y registro en el gremio.', checkText: 'Contrato Firmado' },
      { key: 'health', num: '02', title: 'Póliza de Salud & Vida', desc: 'Seguro de gastos médicos mayores, dental y seguro de vida integral.', checkText: 'Póliza Activa' },
      { key: 'perks', num: '03', title: 'Vales & Compensación', desc: 'Vales de despensa/gasolina, fondo de ahorro y calendario de pagos.', checkText: 'Asignado' },
      { key: 'vacation', num: '04', title: 'Vacaciones & Balance', desc: 'Días de descanso superiores a la ley, días flotantes y horario flexible.', checkText: 'Explicado' }
    ]
  },
  3: {
    title: 'Checklist de Humand y Comedor',
    subtitle: 'Asistencia y Espacios Comunes',
    desc: 'Guía de uso para registro de asistencia, checado, comedor corporativo e incidencias:',
    xp: 30,
    items: [
      { key: 'appHumand', num: '01', title: 'App Humand (Checado)', desc: 'Registro diario de entradas y salidas, geolocalización o reloj biométrico.', checkText: 'App Instalada & Probada' },
      { key: 'incidents', num: '02', title: 'Reporte de Incidencias', desc: 'Solicitud de permisos, faltas justificadas, home office y horas extra.', checkText: 'Flujo Comprendido' },
      { key: 'dining', num: '03', title: 'Acceso al Comedor', desc: 'Horarios de comida, turnos asignados, menú diario y reserva de platillos.', checkText: 'Horario Asignado' },
      { key: 'hygiene', num: '04', title: 'Reglas del Comedor', desc: 'Uso de áreas comunes, estación de café/agua, limpieza y reciclaje.', checkText: 'Normas Explicadas' }
    ]
  },
  4: {
    title: 'Checklist de Protección Civil',
    subtitle: 'Seguridad y Vialidad',
    desc: 'Protocolos de seguridad, brigadas de primeros auxilios y control de acceso vehicular:',
    xp: 25,
    items: [
      { key: 'evac', num: '01', title: 'Rutas de Evacuación', desc: 'Ubicación de escaleras de emergencia, salidas de escape y puertas cortafuegos.', checkText: 'Ruta Identificada' },
      { key: 'meeting', num: '02', title: 'Punto de Encuentro & Brigada', desc: 'Zona segura exterior en conatos o sismos y contacto con los brigadistas de piso.', checkText: 'Zona y Brigadista Ubicados' },
      { key: 'vehicle', num: '03', title: 'Registro Vehicular & Tag', desc: 'Registro de placas y modelo de auto, moto o bici para apertura de la pluma.', checkText: 'Vehículo Registrado' },
      { key: 'rules', num: '04', title: 'Reglamento del Estacionamiento', desc: 'Estacionarse siempre en reversa, respetar cajones preferenciales y 10 km/h.', checkText: 'Normas Aceptadas' }
    ]
  },
  5: {
    title: 'Checklist de Tarjeta Cosmos',
    subtitle: 'Privilegios y Convenios',
    desc: 'Conoce los beneficios exclusivos, convenios comerciales y privilegios para colaboradores:',
    xp: 25,
    items: [
      { key: 'cosmosApp', num: '01', title: 'Activación Digital', desc: 'Descarga y activación de tu credencial digital con código QR para identificación inmediata.', checkText: 'Tarjeta Activada' },
      { key: 'cosmosPerks', num: '02', title: 'Red de Convenios y Descuentos', desc: 'Descuentos directos en restaurantes, farmacias, ópticas, tiendas departamentales y entretenimiento.', checkText: 'Catálogo Consultado' },
      { key: 'cosmosHealth', num: '03', title: 'Salud, Fitness y Bienestar', desc: 'Membresías con tarifas preferenciales en gimnasios, chequeos médicos y servicios dentales.', checkText: 'Beneficios Explorados' },
      { key: 'cosmosRewards', num: '04', title: 'Puntos y Recompensas Cosmos', desc: 'Acumulación de puntos por antigüedad, metas cumplidas y canje de bonos especiales.', checkText: 'Programa Entendido' }
    ]
  },
  6: {
    title: 'Checklist de Cultura e Historia',
    subtitle: 'Identidad Corporativa',
    desc: 'Descubre los orígenes, hitos históricos, propósito y cultura que definen a nuestra empresa:',
    xp: 25,
    items: [
      { key: 'companyOrigins', num: '01', title: 'Historia y Orígenes', desc: 'Cómo nació la organización, los primeros desafíos superados y el camino que nos trajo hasta hoy.', checkText: 'Historia Conocida' },
      { key: 'companyMission', num: '02', title: 'Misión, Visión y Propósito', desc: 'Nuestra razón de ser, a dónde queremos llegar y el impacto positivo que generamos cada día.', checkText: 'Propósito Interiorizado' },
      { key: 'companyValues', num: '03', title: 'Valores y ADN Cultural', desc: 'Los pilares éticos, el trabajo colaborativo, la innovación constante y el respeto mutuo.', checkText: 'Valores Asimilados' },
      { key: 'companyFuture', num: '04', title: 'Evolución y Futuro', desc: 'Hitos estratégicos actuales, proyectos de expansión y tu rol clave como nuevo protagonista.', checkText: 'Visión Alineada' }
    ]
  },
  7: {
    title: 'Checklist de Metodología NPS',
    subtitle: 'Lealtad del Cliente',
    desc: 'Domina los 4 pilares para medir la lealtad y satisfacción del cliente a través de NPS:',
    xp: 25,
    items: [
      { key: 'npsGoldenQuestion', num: '01', title: '1. La Pregunta de Oro', desc: '"En escala de 0 a 10, ¿con qué probabilidad recomendarías nuestro servicio a un colega?".', checkText: 'Pregunta Dominada' },
      { key: 'npsCustomerSegments', num: '02', title: '2. Los 3 Grupos de Clientes', desc: '0-6 Detractores (riesgo de fuga). 7-8 Neutros (satisfechos). 9-10 Promotores (embajadores).', checkText: 'Segmentos Claros' },
      { key: 'npsFormulaScore', num: '03', title: '3. Fórmula y Medición', desc: '% Promotores - % Detractores = NPS. Rango de -100 a +100. Superar +50 es excelente.', checkText: 'Cálculo Entendido' },
      { key: 'npsClosedLoop', num: '04', title: '4. Cierre de Ciclo (Closed Loop)', desc: 'Contactar a detractores en menos de 24h para resolver y transformar su experiencia.', checkText: 'Protocolo Asimilado' }
    ]
  }
};

// ── Learning Center & Harmonious Media Hub (2-Panel Interactive Codex) ───────
const mediaHubDialog = document.getElementById('mediaHubDialog');
const closeMediaHubBtn = document.getElementById('closeMediaHubBtn');
const mapOpenMediaBtn = document.getElementById('mapOpenMediaBtn');
const mediaStageScreen = document.getElementById('mediaStageScreen');
const mediaHubItemsList = document.getElementById('mediaHubItemsList');

let activeStationMediaItem = null;
let mediaHubCameraActive = false;

function isCapsuleCompleted(stationId, itemIndex, item) {
  if (!item) return false;
  const sId = Number(stationId) || current || 1;
  if (item.isEval) {
    return !!evaluationsStatus[`${sId}_${item.evalType}`] || !!completedCapsules[`${sId}_${itemIndex}`];
  }
  return !!completedCapsules[`${sId}_${itemIndex}`];
}

function isCapsuleUnlocked(stationId, itemIndex, playlist) {
  if (itemIndex === 0) return true;
  const sId = Number(stationId) || current || 1;
  if (!playlist || !playlist[itemIndex]) return true;
  if (isCapsuleCompleted(sId, itemIndex, playlist[itemIndex])) return true;
  const prevItem = playlist[itemIndex - 1];
  return isCapsuleCompleted(sId, itemIndex - 1, prevItem);
}

function markCapsuleCompleted(stationId, itemIndex, playlist) {
  const sId = Number(stationId) || current || 1;
  const key = `${sId}_${itemIndex}`;
  completedCapsules[key] = true;

  const item = playlist && playlist[itemIndex];
  if (item && item.isEval) {
    evaluationsStatus[`${sId}_${item.evalType}`] = true;
  }

  save();
  updatePlaylistDOM(sId, playlist);
}

window.toggleManualCapsuleViewed = function(stationId, itemIndex) {
  const sId = Number(stationId) || current || 1;
  const currentPlaylist = activeEvalContext.playlist || [];
  const key = `${sId}_${itemIndex}`;
  if (completedCapsules[key]) {
    // If already done, let it stay done or toggle
    completedCapsules[key] = true;
  } else {
    completedCapsules[key] = true;
  }
  markCapsuleCompleted(sId, itemIndex, currentPlaylist);
};

function updatePlaylistDOM(stationId, playlist) {
  if (!mediaHubItemsList || !playlist) return;
  const cards = mediaHubItemsList.querySelectorAll('.media-playlist-item');
  cards.forEach((card, idx) => {
    const item = playlist[idx];
    if (!item) return;

    const unlocked = isCapsuleUnlocked(stationId, idx, playlist);
    const completed = isCapsuleCompleted(stationId, idx, item);

    card.classList.toggle('locked', !unlocked);
    card.classList.toggle('completed', completed);

    // Update check circle
    const checkBtn = card.querySelector('.capsule-check-btn');
    const checkCircle = card.querySelector('.capsule-check-circle');
    if (checkBtn && checkCircle) {
      checkBtn.className = `capsule-check-btn ${completed ? 'done' : ''}`;
      checkBtn.title = completed ? 'Completado' : 'Marcar como visto';
      checkCircle.className = `capsule-check-circle ${completed ? 'done' : ''}`;
      checkCircle.innerHTML = completed ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3.5"><polyline points="20 6 9 17 4 12"></polyline></svg>` : '';
    }

    // Update evaluation badge
    const badgeEl = card.querySelector('.eval-playlist-badge');
    if (badgeEl && item.isEval) {
      if (completed) {
        badgeEl.className = 'eval-playlist-badge done';
        badgeEl.textContent = '✓ Completada';
      } else if (!unlocked) {
        badgeEl.className = 'eval-playlist-badge locked';
        badgeEl.textContent = 'Bloqueada';
      } else {
        badgeEl.className = `eval-playlist-badge ${item.evalType === 'mid' ? '' : 'final'}`;
        badgeEl.textContent = `+${item.xp} XP`;
      }
    }
  });
}


function renderStageEnSala(item, stationId, itemIndex, playlist) {
  const sId = Number(stationId) || current || 1;
  const isClaimed = !!completedCapsules[`ensala_${sId}_${itemIndex}`] || !!completedCapsules[`${sId}_${itemIndex}`];
  const xp = item.xp || 50;
  const protocol = item.protocol || item.desc || 'Actividad y pautas presenciales a desarrollar en la sala de inducción con el apoyo del facilitador.';
  const keypoints = Array.isArray(item.keypoints) && item.keypoints.length > 0 ? item.keypoints : [
    'Dinámica presencial conducida por el facilitador en sala',
    'Participación activa de los integrantes en la sesión',
    'Resolución de dudas y validación de puntos clave'
  ];

  mediaStageScreen.innerHTML = `
    <div class="stage-ensala-wrapper" style="display:flex;flex-direction:column;gap:18px;height:100%;overflow-y:auto;padding:24px 28px;background:linear-gradient(180deg, rgba(20,25,38,0.92) 0%, rgba(13,17,25,0.98) 100%);border-radius:10px;border:1px solid rgba(255,255,255,0.08);">
      <div class="stage-ensala-header" style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:16px;">
        <div>
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
            <span class="badge-ensala-pill" style="display:inline-flex;align-items:center;gap:6px;background:rgba(56,189,248,0.14);color:#38bdf8;border:1px solid rgba(56,189,248,0.35);font-size:0.75rem;font-weight:700;padding:4px 10px;border-radius:999px;letter-spacing:0.04em;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              EN SALA
            </span>
            <span style="font-size:0.75rem;color:rgba(255,255,255,0.5);font-weight:600;letter-spacing:0.03em;">ACTIVIDAD PRESENCIAL</span>
          </div>
          <h2 style="margin:0;font-size:1.35rem;font-weight:800;color:#ffffff;line-height:1.25;">${item.title}</h2>
          <p style="margin:6px 0 0;font-size:0.86rem;color:rgba(255,255,255,0.72);line-height:1.45;">${item.desc || 'Actividad en sala de Onboarding'}</p>
        </div>
        <div style="text-align:right;flex-shrink:0;">
          <span class="stage-eval-xp-chip" style="background:rgba(204,9,47,0.16);border:1px solid rgba(204,9,47,0.45);color:#ff8a9f;font-weight:800;font-size:0.88rem;padding:6px 14px;border-radius:999px;display:inline-block;">+${xp} XP</span>
        </div>
      </div>

      <div class="ensala-protocol-card" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:8px;padding:16px 20px;">
        <h4 style="margin:0 0 8px;font-size:0.82rem;font-weight:700;color:rgba(255,255,255,0.55);text-transform:uppercase;letter-spacing:0.05em;">PAUTAS Y PROTOCOLO EN SALA</h4>
        <p style="margin:0;font-size:0.92rem;color:#f1f5f9;line-height:1.55;">${protocol}</p>
      </div>

      <div class="ensala-keypoints-box" style="flex:1;">
        <h4 style="margin:0 0 10px;font-size:0.82rem;font-weight:700;color:rgba(255,255,255,0.55);text-transform:uppercase;letter-spacing:0.05em;">PUNTOS CLAVE DE LA SESIÓN</h4>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${keypoints.map((pt, idx) => `
            <div style="display:flex;align-items:flex-start;gap:12px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);padding:10px 14px;border-radius:6px;">
              <span style="display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:22px;border-radius:50%;background:rgba(204,9,47,0.18);color:#ff8a9f;font-size:0.75rem;font-weight:700;">${idx + 1}</span>
              <span style="font-size:0.88rem;color:#e2e8f0;line-height:1.45;">${pt}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="ensala-footer-actions" style="margin-top:auto;padding-top:14px;border-top:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;gap:12px;">
        <button type="button" class="primary wide" style="flex:1;padding:13px 20px;font-size:0.92rem;font-weight:700;border-radius:6px;cursor:pointer;background:${isClaimed ? '#059669' : '#CC092F'};border:none;color:#ffffff;transition:background 0.2s;" onclick="window.markEnSalaCompleted(${sId}, ${itemIndex})">
          ${isClaimed ? 'Actividad en Sala Completada · Siguiente Cápsula ▶' : `Confirmar Actividad Realizada en Sala (+${xp} XP) ▶`}
        </button>
      </div>
    </div>
  `;
}

window.markEnSalaCompleted = function(stationId, itemIndex) {
  const sId = Number(stationId) || current || 1;
  const list = activeEvalContext.playlist || (STATION_MEDIA && STATION_MEDIA[sId]) || [];
  markCapsuleCompleted(sId, itemIndex, list);
  
  const nextIdx = itemIndex + 1;
  if (nextIdx < list.length) {
    renderMediaStageItem(list[nextIdx], sId, nextIdx, list);
    updatePlaylistDOM(sId, list);
  } else {
    updatePlaylistDOM(sId, list);
  }
};

function renderMediaStageItem(item, stationId, itemIndex, playlist) {
  if (!mediaStageScreen || !item) return;
  activeStationMediaItem = item;

  // Clear previous player/content cleanly and release video resources
  const prevVid = mediaStageScreen.querySelector('video');
  if (prevVid) {
    prevVid.pause();
    prevVid.removeAttribute('src');
    prevVid.load();
  }
  mediaStageScreen.innerHTML = '';

  const sId = Number(stationId) || current || 1;
  const currentIdx = typeof itemIndex === 'number' ? itemIndex : 0;
  const currentList = playlist || activeEvalContext.playlist || [];

  activeEvalContext.stationId = sId;
  activeEvalContext.itemIndex = currentIdx;
  activeEvalContext.playlist = currentList;

  if (item.isEval) {
    renderStageEvaluation(item, sId, currentIdx, currentList);
    return;
  }
  if (item.isChecklist || item.type === 'checklist') {
    renderStageChecklist(item, sId, currentIdx, currentList);
    return;
  }
  if (item.type === 'ensala' || item.type === 'insitu') {
    renderStageEnSala(item, sId, currentIdx, currentList);
    return;
  }

  const encodedUrl = encodeURI(item.file);

  const mediaContentWrap = document.createElement('div');
  mediaContentWrap.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;';

  if (item.type === 'video') {
    const vid = document.createElement('video');
    vid.className = 'media-video-element';
    vid.src = encodedUrl;
    vid.controls = true;
    vid.autoplay = true;
    vid.playsInline = true;
    vid.preload = 'auto';
    vid.setAttribute('controlsList', 'nodownload');

    // Auto-complete triggers
    vid.addEventListener('ended', () => {
      markCapsuleCompleted(sId, currentIdx, currentList);
    });
    vid.addEventListener('timeupdate', () => {
      if (vid.duration > 0 && (vid.currentTime / vid.duration) >= 0.88) {
        markCapsuleCompleted(sId, currentIdx, currentList);
      }
    });

    mediaContentWrap.appendChild(vid);
    vid.load();
    const p = vid.play();
    if (p !== undefined) {
      p.catch(() => {});
    }
  } else if (item.type === 'image') {
    const img = document.createElement('img');
    img.className = 'media-img-element';
    img.src = encodedUrl;
    img.alt = item.title;
    mediaContentWrap.appendChild(img);
  } else if (item.type === 'pdf') {
    const iframe = document.createElement('iframe');
    iframe.className = 'media-pdf-element';
    iframe.src = `${encodedUrl}#toolbar=0&navpanes=0`;
    iframe.title = item.title;
    mediaContentWrap.appendChild(iframe);
  } else {
    // Document or downloadable file (e.g. .pptx, .docx, .zip)
    const fileCard = document.createElement('div');
    fileCard.className = 'media-doc-preview-card';
    fileCard.innerHTML = `
      <div class="media-doc-icon-box">
        <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#CC092F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
        </svg>
      </div>
      <div class="media-doc-details">
        <h3 class="media-doc-title">${item.title}</h3>
        <p class="media-doc-desc">${item.desc || 'Material complementario de apoyo para esta misión'}</p>
        <a href="${encodedUrl}" download target="_blank" rel="noopener noreferrer" class="media-doc-download-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          Descargar Presentación / Archivo
        </a>
      </div>
    `;
    mediaContentWrap.appendChild(fileCard);
  }

  mediaStageScreen.appendChild(mediaContentWrap);
}

async function openStationMediaHub(stationId) {
  const sId = Number(stationId) || current || 1;
  const stationEvals = evaluations[sId] || DEFAULT_EVALUATIONS[sId] || DEFAULT_EVALUATIONS[1] || {};
  const q = getMission(sId);

  const eyebrowEl = document.getElementById('mediaHubStationEyebrow');
  const titleEl = document.getElementById('mediaHubStationTitle');

  if (eyebrowEl) eyebrowEl.textContent = `MISIÓN ${String(sId).padStart(2, '0')} · ${q ? q.region.toUpperCase() : ''}`;
  if (titleEl) titleEl.textContent = q ? `Cápsulas: ${q.name}` : 'Centro de Aprendizaje';

  let playlist = [];

  // Check if custom content exists for this station in STATION_CONTENT
  if (STATION_CONTENT && STATION_CONTENT[sId] && Array.isArray(STATION_CONTENT[sId].items) && STATION_CONTENT[sId].items.length > 0) {
    playlist = STATION_CONTENT[sId].items.map(it => {
      if (it.type === 'eval' || it.isEval) {
        return {
          ...it,
          isEval: true,
          evalType: it.evalType || 'mid',
          evalData: it.evalData || {
            title: it.title,
            question: it.question,
            options: it.options || [],
            correct: it.correct,
            xp: it.xp || 50,
            explanation: it.explanation || ''
          }
        };
      }
      if (it.type === 'checklist' || it.isChecklist) {
        return {
          ...it,
          isChecklist: true,
          checklistConfig: it.checklistConfig || {
            title: it.title,
            subtitle: it.subtitle,
            xp: it.xp || 60,
            items: it.items || []
          }
        };
      }
      return { ...it };
    });
  } else {
    // Default fallback playlist assembly
    const rawItems = (STATION_MEDIA && STATION_MEDIA[sId]) ? STATION_MEDIA[sId] : (DEFAULT_STATION_MEDIA[sId] || DEFAULT_STATION_MEDIA[1] || []);
    const sortedRaw = [...rawItems].sort((a, b) => (a.order || 0) - (b.order || 0));
    const evalMid = stationEvals.mid || DEFAULT_EVALUATIONS[sId]?.mid || { title: 'Evaluación Intermedia', xp: 50 };
    const evalFinal = stationEvals.final || DEFAULT_EVALUATIONS[sId]?.final || { title: 'Reto Final de Cierre', xp: 75 };
    const checklistCfg = STATION_CHECKLISTS_CONFIG[sId] || null;

    if (sortedRaw.length >= 2) {
      playlist.push(sortedRaw[0], sortedRaw[1]);
      playlist.push({
        isEval: true,
        evalType: 'mid',
        evalData: evalMid,
        title: evalMid.title,
        xp: evalMid.xp || 50
      });
      for (let i = 2; i < sortedRaw.length; i++) {
        playlist.push(sortedRaw[i]);
      }
      if (checklistCfg) {
        playlist.push({
          isChecklist: true,
          checklistConfig: checklistCfg,
          title: checklistCfg.title,
          subtitle: checklistCfg.subtitle,
          xp: checklistCfg.xp
        });
      }
      playlist.push({
        isEval: true,
        evalType: 'final',
        evalData: evalFinal,
        title: evalFinal.title,
        xp: evalFinal.xp || 75
      });
    } else if (sortedRaw.length === 1) {
      playlist.push(sortedRaw[0]);
      if (checklistCfg) {
        playlist.push({
          isChecklist: true,
          checklistConfig: checklistCfg,
          title: checklistCfg.title,
          subtitle: checklistCfg.subtitle,
          xp: checklistCfg.xp
        });
      }
      playlist.push({
        isEval: true,
        evalType: 'mid',
        evalData: evalMid,
        title: evalMid.title,
        xp: evalMid.xp || 50
      });
      playlist.push({
        isEval: true,
        evalType: 'final',
        evalData: evalFinal,
        title: evalFinal.title,
        xp: evalFinal.xp || 75
      });
    } else {
      if (checklistCfg) {
        playlist.push({
          isChecklist: true,
          checklistConfig: checklistCfg,
          title: checklistCfg.title,
          subtitle: checklistCfg.subtitle,
          xp: checklistCfg.xp
        });
      }
      playlist.push({
        isEval: true,
        evalType: 'mid',
        evalData: evalMid,
        title: evalMid.title,
        xp: evalMid.xp || 50
      });
      playlist.push({
        isEval: true,
        evalType: 'final',
        evalData: evalFinal,
        title: evalFinal.title,
        xp: evalFinal.xp || 75
      });
    }
  }

  activeEvalContext.stationId = sId;
  activeEvalContext.playlist = playlist;

  if (mediaHubItemsList) {
    mediaHubItemsList.innerHTML = '';
    playlist.forEach((item, idx) => {
      const orderNum = idx + 1;
      const numStr = String(orderNum).padStart(2, '0');
      const card = document.createElement('div');
      const unlocked = isCapsuleUnlocked(sId, idx, playlist);
      const completed = isCapsuleCompleted(sId, idx, item);

      if (item.isEval) {
        const isMid = item.evalType === 'mid';
        card.className = `media-playlist-item eval-item ${isMid ? 'mid' : 'final'} ${idx === 0 ? 'active' : ''} ${unlocked ? '' : 'locked'} ${completed ? 'completed' : ''}`;

        const evalSvg = isMid
          ? `<svg class="media-type-icon-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="m9 15 2 2 4-4"></path></svg>`
          : `<svg class="media-type-icon-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline></svg>`;

        const typeLabel = isMid ? 'Evaluación Intermedia' : 'Reto Final de Cierre';
        const cleanTitle = (item.title || '').replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();

        let badgeText = `+${item.xp || 50} XP`;
        let badgeClass = `eval-playlist-badge ${isMid ? '' : 'final'}`;
        if (completed) {
          badgeText = '✓ Completada';
          badgeClass = 'eval-playlist-badge done';
        } else if (!unlocked) {
          badgeText = 'Bloqueada';
          badgeClass = 'eval-playlist-badge locked';
        }

        card.innerHTML = `
          <div class="media-item-icon-wrapper" title="${typeLabel}">
            ${evalSvg}
            <span class="media-item-order-badge">${numStr}</span>
          </div>
          <div class="media-playlist-info">
            <span class="media-playlist-title">${cleanTitle}</span>
            <span class="media-playlist-subtitle">${typeLabel}</span>
          </div>
          <span class="${badgeClass}">
            ${badgeText}
          </span>
          <button type="button" class="capsule-check-btn ${completed ? 'done' : ''}" title="${completed ? 'Completado' : 'Marcar visto'}" onclick="event.stopPropagation(); window.toggleManualCapsuleViewed(${sId}, ${idx});">
            <span class="capsule-check-circle ${completed ? 'done' : ''}">
              ${completed ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3.5"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
            </span>
          </button>
        `;
      } else if (item.isChecklist) {
        card.className = `media-playlist-item checklist-item ${idx === 0 ? 'active' : ''} ${unlocked ? '' : 'locked'} ${completed ? 'completed' : ''}`;
        const checkSvg = `<svg class="media-type-icon-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>`;
        const typeLabel = 'Lista de Verificación';
        const cleanTitle = (item.title || 'Checklist de Validación').replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();

        let badgeText = `+${item.xp || 60} XP`;
        let badgeClass = 'eval-playlist-badge';
        if (completed) {
          badgeText = '✓ Completada';
          badgeClass = 'eval-playlist-badge done';
        } else if (!unlocked) {
          badgeText = 'Bloqueada';
          badgeClass = 'eval-playlist-badge locked';
        }

        card.innerHTML = `
          <div class="media-item-icon-wrapper" title="${typeLabel}">
            ${checkSvg}
            <span class="media-item-order-badge">${numStr}</span>
          </div>
          <div class="media-playlist-info">
            <span class="media-playlist-title">${cleanTitle}</span>
            <span class="media-playlist-subtitle">${item.subtitle || typeLabel}</span>
          </div>
          <span class="${badgeClass}">
            ${badgeText}
          </span>
          <button type="button" class="capsule-check-btn ${completed ? 'done' : ''}" title="${completed ? 'Completado' : 'Marcar visto'}" onclick="event.stopPropagation(); window.toggleManualCapsuleViewed(${sId}, ${idx});">
            <span class="capsule-check-circle ${completed ? 'done' : ''}">
              ${completed ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3.5"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
            </span>
          </button>
        `;
      } else {
        card.className = `media-playlist-item ${idx === 0 ? 'active' : ''} ${unlocked ? '' : 'locked'} ${completed ? 'completed' : ''}`;
        let iconSvg = '';
        let typeLabel = 'Cápsula de Video';

        if (item.type === 'ensala' || item.type === 'insitu') {
          iconSvg = `<svg class="media-type-icon-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`;
          typeLabel = 'Actividad en Sala';
        } else if (item.type === 'video') {
          iconSvg = `<svg class="media-type-icon-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="14" height="16" rx="3"></rect><path d="m16 9 6-4v14l-6-4"></path></svg>`;
          typeLabel = 'Cápsula de Video';
        } else if (item.type === 'image') {
          iconSvg = `<svg class="media-type-icon-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="3"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`;
          typeLabel = 'Infografía';
        } else if (item.type === 'pdf') {
          iconSvg = `<svg class="media-type-icon-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>`;
          typeLabel = 'Documento PDF';
        } else {
          iconSvg = `<svg class="media-type-icon-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path></svg>`;
          typeLabel = 'Material de Apoyo';
        }

        const cleanTitle = (item.title || '').replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();

        card.innerHTML = `
          <div class="media-item-icon-wrapper" title="${typeLabel}">
            ${iconSvg}
            <span class="media-item-order-badge">${numStr}</span>
          </div>
          <div class="media-playlist-info">
            <span class="media-playlist-title">${cleanTitle}</span>
            <span class="media-playlist-subtitle">${typeLabel}</span>
          </div>
          <button type="button" class="capsule-check-btn ${completed ? 'done' : ''}" title="${completed ? 'Completado' : 'Marcar visto'}" onclick="event.stopPropagation(); window.toggleManualCapsuleViewed(${sId}, ${idx});">
            <span class="capsule-check-circle ${completed ? 'done' : ''}">
              ${completed ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3.5"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
            </span>
          </button>
        `;
      }

      card.onclick = () => {
        if (!isCapsuleUnlocked(sId, idx, playlist)) {
          card.classList.add('shake-lock');
          setTimeout(() => card.classList.remove('shake-lock'), 400);
          return;
        }
        mediaHubItemsList.querySelectorAll('.media-playlist-item').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        renderMediaStageItem(item, sId, idx, playlist);
      };

      mediaHubItemsList.appendChild(card);
    });

    // Auto-select first unlocked non-completed item or 0
    let targetIdx = 0;
    for (let i = 0; i < playlist.length; i++) {
      if (isCapsuleUnlocked(sId, i, playlist) && !isCapsuleCompleted(sId, i, playlist[i])) {
        targetIdx = i;
        break;
      }
    }
    const cards = mediaHubItemsList.querySelectorAll('.media-playlist-item');
    if (cards[targetIdx]) {
      cards.forEach(c => c.classList.remove('active'));
      cards[targetIdx].classList.add('active');
    }
    renderMediaStageItem(playlist[targetIdx], sId, targetIdx, playlist);
  }

  mediaHubCameraActive = true;
  mediaHubDialog?.showModal();
}
window.openStationMediaHub = openStationMediaHub;
function closeStationMediaHub() {
  if (mediaStageScreen) {
    const vid = mediaStageScreen.querySelector('video');
    if (vid) {
      vid.pause();
      vid.removeAttribute('src');
      vid.load();
    }
    mediaStageScreen.innerHTML = '';
  }
  mediaHubDialog?.close();
}

mapOpenMediaBtn?.addEventListener('click', () => openStationMediaHub(current));
closeMediaHubBtn?.addEventListener('click', closeStationMediaHub);

mediaHubDialog?.addEventListener('close', () => {
  if (mediaStageScreen) {
    const vid = mediaStageScreen.querySelector('video');
    if (vid) {
      vid.pause();
      vid.removeAttribute('src');
      vid.load();
    }
    mediaStageScreen.innerHTML = '';
  }
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && mediaHubDialog?.open) {
    closeStationMediaHub();
  }
});

// ── Sistema de Evaluaciones Integradas en Cápsulas (Gamificación Facilitada) ──
let activeEvalContext = {
  stationId: 1,
  type: 'mid', // 'mid' or 'final'
  evalData: null,
  selectedOption: null,
  selectedPlayers: new Set(),
  itemIndex: 0,
  playlist: []
};

function renderStageEvaluationQuestionUI(evalData) {
  if (!mediaStageScreen || !evalData) return;
  mediaStageScreen.innerHTML = `
    <div class="stage-eval-wrapper">
      <!-- Step 1: Question -->
      <div id="stageEvalQuestionStep" style="display:flex;flex-direction:column;gap:16px;height:100%">
        <div class="stage-eval-header" style="justify-content:flex-end;">
          <span class="stage-eval-xp-chip">+${evalData.xp || 50} XP</span>
        </div>

        <div class="stage-eval-question-box">
          <h3 class="stage-eval-question-title">${evalData.question}</h3>
        </div>

        <div class="stage-eval-options-grid">
          ${(evalData.options || []).map(opt => `
            <button type="button" class="stage-eval-opt-card" onclick="window.handleStageEvalOptionSelect('${opt.id}')">
              <span class="stage-eval-opt-letter">${opt.id}</span>
              <span class="stage-eval-opt-text">${opt.text}</span>
            </button>
          `).join('')}
        </div>

        <div class="stage-eval-facilitator-bar" style="justify-content:flex-end">
          <button type="button" class="stage-eval-nobody-btn" onclick="window.handleStageEvalOptionSelect('NONE')">Ningún participante acertó</button>
        </div>
      </div>

      <!-- Step 2: Feedback & Reveal -->
      <div id="stageEvalFeedbackStep" style="display:none;flex-direction:column;gap:16px;height:100%">
        <div class="stage-eval-header" style="justify-content:flex-end;">
          <span class="stage-eval-xp-chip">+${evalData.xp || 50} XP</span>
        </div>

        <div id="stageEvalResultBanner" class="stage-eval-banner correct">
          <div id="stageEvalResultIcon" class="stage-eval-banner-icon">✓</div>
          <div class="stage-eval-banner-text">
            <h4 id="stageEvalResultHeadline">¡Respuesta Correcta!</h4>
            <p id="stageEvalResultSubline">Excelente participación de la sala. ¡Muy bien razonado!</p>
          </div>
        </div>

        <div class="stage-eval-answer-box">
          <span class="eyebrow" style="color:#5eead4">RESPUESTA OFICIAL</span>
          <div id="stageEvalCorrectDisplay" class="stage-eval-answer-text"></div>
        </div>

        <div class="stage-eval-explanation-box">
          <span class="eyebrow" style="color:#ffd780">EXPLICACIÓN & CONTEXTO</span>
          <p id="stageEvalExplanationDisplay" class="stage-eval-explanation-text"></p>
        </div>

        <div id="stageEvalFeedbackActionWrap" style="margin-top:auto">
          <!-- Button rendered dynamically based on correctness -->
        </div>
      </div>

      <!-- Step 3: XP Award to Players -->
      <div id="stageEvalAwardStep" style="display:none;flex-direction:column;gap:16px;height:100%">
        <div class="stage-eval-header" style="justify-content:flex-end;">
          <span class="stage-eval-xp-chip">+${evalData.xp || 50} XP</span>
        </div>

        <div class="stage-eval-award-header">
          <div>
            <h4 style="margin:0;font-size:1.05rem;font-weight:700">Aventureros en Sala</h4>
            <p style="margin:2px 0 0;font-size:0.78rem;color:rgba(255,255,255,0.65)">Selecciona quiénes recibirán los puntos por esta evaluación:</p>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <label style="font-size:0.80rem;color:#ffd780;font-weight:700">XP:</label>
            <input type="number" id="stageEvalAwardXpInput" value="${evalData.xp || 50}" min="0" max="500" style="width:75px;padding:6px 10px;background:rgba(0,0,0,0.5);border:1px solid rgba(255,215,0,0.4);border-radius:8px;color:#ffffff;font-weight:800;text-align:center">
          </div>
        </div>

        <div class="stage-eval-quick-actions">
          <button type="button" class="eval-quick-btn" onclick="window.toggleAllStageEvalPlayers(true)">Seleccionar Todos</button>
          <button type="button" class="eval-quick-btn" onclick="window.toggleAllStageEvalPlayers(false)">Deseleccionar Todos</button>
          <span style="margin-left:auto;font-size:0.78rem;color:rgba(255,255,255,0.7);font-weight:600" id="stageEvalSelectedCountText">0 seleccionados</span>
        </div>

        <div class="stage-eval-players-grid" id="stageEvalAwardPlayersGrid">
          <!-- Dynamic Player cards -->
        </div>

        <button type="button" class="primary wide" style="margin-top:auto;padding:14px;font-size:0.95rem;font-weight:800;border-radius:12px;background:linear-gradient(135deg,#10b981,#059669);border-color:#34d399;cursor:pointer" onclick="window.confirmStageAwardXp()">
          Otorgar XP a Seleccionados
        </button>
      </div>

      <!-- Step 4: Complete & Next (Celebration if Final Station Reto) -->
      <div id="stageEvalCompleteStep" style="display:none;flex-direction:column;align-items:center;justify-content:center;gap:18px;height:100%;text-align:center;padding:24px">
      </div>
    </div>
  `;
}

function renderStageEvaluation(item, stationId, itemIndex, playlist) {
  if (!mediaStageScreen || !item) return;

  const sId = Number(stationId) || current || 1;
  const evalData = item.evalData || (evaluations[sId] ? evaluations[sId][item.evalType] : null) || (DEFAULT_EVALUATIONS[sId] ? DEFAULT_EVALUATIONS[sId][item.evalType] : null);
  if (!evalData) return;

  const currentIdx = typeof itemIndex === 'number' ? itemIndex : 0;
  const currentList = playlist || activeEvalContext.playlist || [];

  activeEvalContext = {
    stationId: sId,
    type: item.evalType,
    evalData,
    selectedOption: null,
    selectedPlayers: new Set(),
    itemIndex: currentIdx,
    playlist: currentList
  };

  const isAlreadyDone = isCapsuleCompleted(sId, currentIdx, item);

  if (isAlreadyDone) {
    mediaStageScreen.innerHTML = `
      <div class="stage-eval-wrapper" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;padding:32px;gap:20px;">
        <div style="width:72px;height:72px;border-radius:50%;background:rgba(16,185,129,0.18);border:2px solid #10b981;display:grid;place-items:center;color:#10b981;font-size:2rem;font-weight:800;box-shadow:0 0 25px rgba(16,185,129,0.3)">
          ✓
        </div>

        <div style="max-width:540px;">
          <span class="eyebrow" style="color:#10b981;margin-bottom:6px;display:inline-block">EVALUACIÓN YA REGISTRADA</span>
          <h3 style="margin:0;font-size:1.45rem;font-weight:800;color:#ffffff">${evalData.title || (item.evalType === 'mid' ? 'Evaluación Intermedia' : 'Reto Final')}</h3>
          <p style="margin:10px 0 0;font-size:0.92rem;color:rgba(255,255,255,0.85);line-height:1.5">
            Esta evaluación ya ha sido aplicada a la sala y sus resultados están guardados en la expedición.
          </p>
        </div>

        <div style="background:rgba(204,9,47,0.15);border:1px solid rgba(204,9,47,0.4);border-radius:12px;padding:14px 18px;max-width:520px;text-align:left;display:flex;gap:12px;align-items:center;">
          <span style="font-size:1rem;color:#f59e0b;font-weight:700;">[ALERTA]</span>
          <p style="margin:0;font-size:0.83rem;color:rgba(255,255,255,0.92);line-height:1.45">
            <strong>Advertencia Facilitador:</strong> Si decides volver a realizarla, se iniciará una nueva ronda para los participantes y <em>se reescribirán los datos y la asignación de XP</em> para esta pregunta.
          </p>
        </div>

        <div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center;margin-top:12px;">
          <button type="button" class="primary" style="padding:14px 24px;font-size:0.95rem;font-weight:800;border-radius:12px;cursor:pointer" onclick="window.advanceToNextPlaylistStageItem()">
            Continuar con la siguiente cápsula ▶
          </button>
          <button type="button" style="padding:14px 20px;font-size:0.88rem;font-weight:700;border-radius:12px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.25);color:#ffccd3;cursor:pointer" onclick="window.confirmRedoStageEvaluation()">
            Volver a realizar (Reescribir datos)
          </button>
        </div>
      </div>
    `;
    return;
  }

  renderStageEvaluationQuestionUI(evalData);
}

window.confirmRedoStageEvaluation = function() {
  const proceed = confirm("¿Estás seguro de volver a aplicar esta evaluación?\n\nAdvertencia: Se reiniciará la pregunta para la sala y se reescribirán los resultados y la asignación de XP previamente guardados.");
  if (proceed) {
    const evalData = activeEvalContext.evalData;
    if (evalData) {
      renderStageEvaluationQuestionUI(evalData);
    }
  }
};

window.handleStageEvalOptionSelect = function(selectedOptionId) {
  const evalData = activeEvalContext.evalData;
  if (!evalData) return;

  activeEvalContext.selectedOption = selectedOptionId;
  const isCorrect = (selectedOptionId === evalData.correctOption);

  const banner = document.getElementById('stageEvalResultBanner');
  const icon = document.getElementById('stageEvalResultIcon');
  const headline = document.getElementById('stageEvalResultHeadline');
  const subline = document.getElementById('stageEvalResultSubline');

  if (banner && icon && headline && subline) {
    if (isCorrect) {
      banner.className = 'stage-eval-banner correct';
      icon.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
      headline.textContent = '¡Respuesta Correcta!';
      subline.textContent = 'Excelente participación de la sala. ¡Muy bien razonado!';
    } else {
      banner.className = 'stage-eval-banner miss';
      icon.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
      headline.textContent = selectedOptionId === 'NONE' ? 'Ningún participante acertó la respuesta' : 'Opción seleccionada no acertada';
      subline.textContent = 'Veamos la respuesta oficial y la explicación correspondiente:';
    }
  }

  const correctOptObj = (evalData.options || []).find(o => o.id === evalData.correctOption);
  const correctDisplay = document.getElementById('stageEvalCorrectDisplay');
  if (correctDisplay) {
    correctDisplay.textContent = correctOptObj ? `Opción ${correctOptObj.id}: ${correctOptObj.text}` : 'Respuesta oficial';
  }

  const expDisplay = document.getElementById('stageEvalExplanationDisplay');
  if (expDisplay) {
    expDisplay.textContent = evalData.explanation || 'El entendimiento de este concepto es fundamental para la excelencia operativa.';
  }

  const xpInput = document.getElementById('stageEvalAwardXpInput');
  if (xpInput) xpInput.value = evalData.xp || 50;

  // Render appropriate action button on feedback step
  const actionWrap = document.getElementById('stageEvalFeedbackActionWrap');
  if (actionWrap) {
    if (isCorrect) {
      actionWrap.innerHTML = `
        <button type="button" class="primary wide" style="width:100%;padding:14px;font-size:0.95rem;font-weight:800;border-radius:12px;cursor:pointer" onclick="window.proceedToStageEvalAwardStep()">
          Asignar XP a los participantes ▶
        </button>
      `;
    } else {
      actionWrap.innerHTML = `
        <button type="button" class="primary wide" style="width:100%;padding:14px;font-size:0.95rem;font-weight:800;border-radius:12px;background:linear-gradient(135deg,#374151,#1f2937);border-color:#4b5563;cursor:pointer" onclick="window.skipStageEvalWithoutXp()">
          Continuar sin asignar XP ▶
        </button>
      `;
    }
  }

  const qStep = document.getElementById('stageEvalQuestionStep');
  const fStep = document.getElementById('stageEvalFeedbackStep');
  const aStep = document.getElementById('stageEvalAwardStep');
  if (qStep) qStep.style.display = 'none';
  if (fStep) fStep.style.display = 'flex';
  if (aStep) aStep.style.display = 'none';
};

window.proceedToStageEvalAwardStep = function() {
  const qStep = document.getElementById('stageEvalQuestionStep');
  const fStep = document.getElementById('stageEvalFeedbackStep');
  const aStep = document.getElementById('stageEvalAwardStep');
  if (qStep) qStep.style.display = 'none';
  if (fStep) fStep.style.display = 'none';
  if (aStep) aStep.style.display = 'flex';

  renderStageEvalPlayersRoster();
};

window.skipStageEvalWithoutXp = function() {
  const sId = activeEvalContext.stationId;
  // Mark evaluation & capsule as completed so navigation is unlocked, with 0 XP awarded
  markCapsuleCompleted(sId, activeEvalContext.itemIndex, activeEvalContext.playlist);
  renderUI();
  rebuildPlayers();

  const qStep = document.getElementById('stageEvalQuestionStep');
  const fStep = document.getElementById('stageEvalFeedbackStep');
  const aStep = document.getElementById('stageEvalAwardStep');
  const cStep = document.getElementById('stageEvalCompleteStep');

  if (qStep) qStep.style.display = 'none';
  if (fStep) fStep.style.display = 'none';
  if (aStep) aStep.style.display = 'none';
  if (!cStep) return;
  cStep.style.display = 'flex';

  const isFinalStationEval = (activeEvalContext.type === 'final' || activeEvalContext.itemIndex === (activeEvalContext.playlist.length - 1));

  if (isFinalStationEval) {
    if (sId < 9) {
      const nextM = getMission(sId + 1);
      cStep.innerHTML = `
        <div class="stage-celebration-wrapper">
          <div class="stage-celebration-trophy">[NIVEL COMPLETADO]</div>
          <h3 class="stage-celebration-title">¡Misión ${String(sId).padStart(2, '0')} Finalizada!</h3>
          <p class="stage-celebration-desc">
            Han concluido todos los contenidos de esta estación. ¡A seguir aprendiendo en la próxima misión!
          </p>

          <div class="stage-celebration-next-card">
            <span class="stage-celebration-next-tag">Siguiente Estación:</span>
            <span class="stage-celebration-next-name">Misión ${String(sId + 1).padStart(2, '0')}: ${nextM.name}</span>
            <span class="stage-celebration-next-region">${nextM.region}</span>
          </div>

          <button type="button" class="stage-celebration-travel-btn" onclick="window.finishStationAndTravelNext(${sId + 1})">
            Partir hacia la Misión ${String(sId + 1).padStart(2, '0')} ➔
          </button>
        </div>
      `;
    } else {
      cStep.innerHTML = `
        <div class="stage-celebration-wrapper">
          <div class="stage-celebration-trophy">[MISIÓN FINALIZADA]</div>
          <h3 class="stage-celebration-title">¡Expedición de Onboarding Culminada!</h3>
          <p class="stage-celebration-desc">
            ¡Felicidades por completar el recorrido de las 9 misiones de Bradesco México!
          </p>
          <button type="button" class="stage-celebration-travel-btn" onclick="window.closeStationMediaHub()">
            Finalizar y Regresar al Mapa ➔
          </button>
        </div>
      `;
    }
  } else {
    cStep.innerHTML = `
      <div style="width:64px;height:64px;border-radius:50%;background:#4b5563;display:grid;place-items:center;color:#ffffff;font-size:2rem;font-weight:800;box-shadow:0 0 20px rgba(75,85,99,0.5)">
        ✓
      </div>
      <div>
        <h3 style="margin:0;font-size:1.3rem;font-weight:800;color:#ffffff">Evaluación Concluida</h3>
        <p style="margin:8px 0 0;font-size:0.90rem;color:rgba(255,255,255,0.75);max-width:460px">
          No se asignaron puntos en esta ronda. El concepto ha quedado explicado para el equipo.
        </p>
      </div>
      <button type="button" class="primary wide" style="max-width:320px;padding:14px;font-size:0.95rem;font-weight:800;border-radius:12px;cursor:pointer" onclick="window.advanceToNextPlaylistStageItem()">
        Continuar con la siguiente cápsula ▶
      </button>
    `;
  }
};

function renderStageEvalPlayersRoster() {
  const grid = document.getElementById('stageEvalAwardPlayersGrid');
  if (!grid) return;

  grid.innerHTML = '';
  if (players.length === 0) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:24px;color:rgba(255,255,255,0.6);font-style:italic">
        No hay aventureros registrados en la sesión todavía. Añade participantes en el Panel de Ajustes.
      </div>
    `;
    updateStageEvalSelectedCount();
    return;
  }

  players.forEach(p => {
    const isSelected = activeEvalContext.selectedPlayers.has(p.id);
    const preset = AVATAR_PRESETS.find(a => a.id === p.avatarId) || AVATAR_PRESETS[0];

    const card = document.createElement('div');
    card.className = `stage-eval-player-card ${isSelected ? 'selected' : ''}`;
    card.innerHTML = `
      <div class="stage-eval-player-avatar" style="background:${p.color}">
        ${preset.iconSvg || initials(p.name)}
      </div>
      <div class="stage-eval-player-info">
        <span class="stage-eval-player-name">${p.name}</span>
        <span class="stage-eval-player-xp">${p.points} XP · ${preset.name}</span>
      </div>
      <div class="stage-eval-player-check">✓</div>
    `;

    card.onclick = () => window.toggleStageEvalPlayer(p.id);
    grid.appendChild(card);
  });

  updateStageEvalSelectedCount();
}

window.toggleStageEvalPlayer = function(playerId) {
  if (activeEvalContext.selectedPlayers.has(playerId)) {
    activeEvalContext.selectedPlayers.delete(playerId);
  } else {
    activeEvalContext.selectedPlayers.add(playerId);
  }
  renderStageEvalPlayersRoster();
};

window.toggleAllStageEvalPlayers = function(selectAll) {
  if (selectAll) {
    players.forEach(p => activeEvalContext.selectedPlayers.add(p.id));
  } else {
    activeEvalContext.selectedPlayers.clear();
  }
  renderStageEvalPlayersRoster();
};

function updateStageEvalSelectedCount() {
  const countText = document.getElementById('stageEvalSelectedCountText');
  const count = activeEvalContext.selectedPlayers.size;
  if (countText) {
    countText.textContent = `${count} ${count === 1 ? 'participante seleccionado' : 'participantes seleccionados'}`;
  }
}

window.confirmStageAwardXp = function() {
  const sId = activeEvalContext.stationId;
  const xpInput = document.getElementById('stageEvalAwardXpInput');
  const pts = Math.max(0, parseInt(xpInput?.value, 10) || activeEvalContext.evalData?.xp || 50);
  const awardCount = activeEvalContext.selectedPlayers.size;

  if (awardCount > 0 && pts > 0) {
    players.forEach(p => {
      if (activeEvalContext.selectedPlayers.has(p.id)) {
        p.points = (p.points || 0) + pts;
      }
    });
  }

  // Mark this evaluation & capsule as completed
  markCapsuleCompleted(sId, activeEvalContext.itemIndex, activeEvalContext.playlist);

  renderUI();
  rebuildPlayers();

  // Transition to Complete / Celebration Screen
  const aStep = document.getElementById('stageEvalAwardStep');
  const cStep = document.getElementById('stageEvalCompleteStep');
  if (aStep) aStep.style.display = 'none';
  if (!cStep) return;
  cStep.style.display = 'flex';

  const isFinalStationEval = (activeEvalContext.type === 'final' || activeEvalContext.itemIndex === (activeEvalContext.playlist.length - 1));

  if (isFinalStationEval) {
    if (sId < 9) {
      const nextM = getMission(sId + 1);
      cStep.innerHTML = `
        <div class="stage-celebration-wrapper">
          <div class="stage-celebration-trophy">[NIVEL COMPLETADO]</div>
          <h3 class="stage-celebration-title">¡Misión ${String(sId).padStart(2, '0')} Completada!</h3>
          <p class="stage-celebration-desc">
            ¡Excelente trabajo de todo el equipo! Han finalizado todos los contenidos y evaluaciones de esta estación con ${awardCount > 0 ? `+${pts} XP acreditados` : 'éxito'}.
          </p>

          <div class="stage-celebration-next-card">
            <span class="stage-celebration-next-tag">Prepárense para la Siguiente Estación:</span>
            <span class="stage-celebration-next-name">Misión ${String(sId + 1).padStart(2, '0')}: ${nextM.name}</span>
            <span class="stage-celebration-next-region">${nextM.region}</span>
          </div>

          <button type="button" class="stage-celebration-travel-btn" onclick="window.finishStationAndTravelNext(${sId + 1})">
            Partir hacia la Misión ${String(sId + 1).padStart(2, '0')} ➔
          </button>
        </div>
      `;
    } else {
      cStep.innerHTML = `
        <div class="stage-celebration-wrapper">
          <div class="stage-celebration-trophy">[MISIÓN FINALIZADA]</div>
          <h3 class="stage-celebration-title">¡Expedición de Onboarding Culminada!</h3>
          <p class="stage-celebration-desc">
            ¡Felicidades a todos los aventureros por completar las 9 misiones del reino de Bradesco México!
          </p>
          <button type="button" class="stage-celebration-travel-btn" onclick="window.closeStationMediaHub()">
            Finalizar y Regresar al Mapa ➔
          </button>
        </div>
      `;
    }
  } else {
    cStep.innerHTML = `
      <div style="width:64px;height:64px;border-radius:50%;background:#10b981;display:grid;place-items:center;color:#ffffff;font-size:2rem;font-weight:800;box-shadow:0 0 30px rgba(16,185,129,0.5)">
        ✓
      </div>
      <div>
        <h3 style="margin:0;font-size:1.4rem;font-weight:800;color:#ffffff">¡Evaluación Registrada con Éxito!</h3>
        <p style="margin:8px 0 0;font-size:0.92rem;color:rgba(255,255,255,0.8);max-width:480px">
          ${awardCount > 0 ? `Se acreditaron +${pts} XP a ${awardCount} ${awardCount === 1 ? 'aventurero' : 'aventureros'}. Tabla de posiciones actualizada.` : 'Evaluación concluida correctamente.'}
        </p>
      </div>
      <button type="button" class="primary wide" style="max-width:320px;padding:14px;font-size:0.95rem;font-weight:800;border-radius:12px;cursor:pointer" onclick="window.advanceToNextPlaylistStageItem()">
        Continuar con la siguiente cápsula ▶
      </button>
    `;
  }
};

window.finishStationAndTravelNext = function(nextStationId) {
  closeStationMediaHub();
  setTimeout(() => {
    if (typeof window.selectMission === 'function') {
      window.selectMission(nextStationId);
    }
  }, 140);
};

window.advanceToNextPlaylistStageItem = function() {
  if (!activeEvalContext.playlist || typeof activeEvalContext.itemIndex !== 'number') return;
  const nextIdx = activeEvalContext.itemIndex + 1;
  const playlistItems = mediaHubItemsList?.querySelectorAll('.media-playlist-item');
  if (playlistItems && playlistItems[nextIdx]) {
    playlistItems[nextIdx].click();
  } else if (playlistItems && playlistItems[0]) {
    playlistItems[0].click();
  }
};

// ── Admin Evaluation Question Editor ─────────────────────────────────────────
function initAdminEvalEditor() {
  const stationSelect = document.getElementById('evalAdminStationSelect');
  const typeSelect = document.getElementById('evalAdminTypeSelect');
  if (!stationSelect || !typeSelect) return;

  stationSelect.innerHTML = '';
  for (let i = 1; i <= MAX_MISSION; i++) {
    const m = getMission(i);
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `Misión ${String(i).padStart(2, '0')}: ${m.name}`;
    stationSelect.appendChild(opt);
  }

  const loadCurrentToEditor = () => {
    const sId = parseInt(stationSelect.value, 10) || 1;
    const type = typeSelect.value || 'mid';
    const stationEvals = evaluations[sId] || DEFAULT_EVALUATIONS[sId] || DEFAULT_EVALUATIONS[1];
    const data = (type === 'final') ? stationEvals.final : stationEvals.mid;
    if (!data) return;

    const titleInput = document.getElementById('evalAdminTitle');
    const qInput = document.getElementById('evalAdminQuestion');
    const optA = document.getElementById('evalAdminOptA');
    const optB = document.getElementById('evalAdminOptB');
    const optC = document.getElementById('evalAdminOptC');
    const optD = document.getElementById('evalAdminOptD');
    const correctSelect = document.getElementById('evalAdminCorrectOpt');
    const xpInput = document.getElementById('evalAdminXp');
    const expInput = document.getElementById('evalAdminExplanation');

    if (titleInput) titleInput.value = data.title || '';
    if (qInput) qInput.value = data.question || '';
    if (optA) optA.value = data.options?.[0]?.text || '';
    if (optB) optB.value = data.options?.[1]?.text || '';
    if (optC) optC.value = data.options?.[2]?.text || '';
    if (optD) optD.value = data.options?.[3]?.text || '';
    if (correctSelect) correctSelect.value = data.correctOption || 'A';
    if (xpInput) xpInput.value = data.xp || 50;
    if (expInput) expInput.value = data.explanation || '';
  };

  stationSelect.onchange = loadCurrentToEditor;
  typeSelect.onchange = loadCurrentToEditor;
  loadCurrentToEditor();
}

window.saveEvaluationFromAdmin = function() {
  const stationSelect = document.getElementById('evalAdminStationSelect');
  const typeSelect = document.getElementById('evalAdminTypeSelect');
  const sId = parseInt(stationSelect?.value, 10) || 1;
  const type = typeSelect?.value || 'mid';

  const title = document.getElementById('evalAdminTitle')?.value?.trim();
  const question = document.getElementById('evalAdminQuestion')?.value?.trim();
  const optA = document.getElementById('evalAdminOptA')?.value?.trim();
  const optB = document.getElementById('evalAdminOptB')?.value?.trim();
  const optC = document.getElementById('evalAdminOptC')?.value?.trim();
  const optD = document.getElementById('evalAdminOptD')?.value?.trim();
  const correctOption = document.getElementById('evalAdminCorrectOpt')?.value || 'A';
  const xp = parseInt(document.getElementById('evalAdminXp')?.value, 10) || 50;
  const explanation = document.getElementById('evalAdminExplanation')?.value?.trim();

  if (!evaluations[sId]) {
    evaluations[sId] = structuredClone(DEFAULT_EVALUATIONS[sId] || DEFAULT_EVALUATIONS[1]);
  }

  evaluations[sId][type] = {
    id: `s${sId}_${type}`,
    title: title || (type === 'mid' ? 'Evaluación Intermedia' : 'Reto Final'),
    question: question || 'Pregunta de la misión',
    options: [
      { id: 'A', text: optA || 'Opción A' },
      { id: 'B', text: optB || 'Opción B' },
      { id: 'C', text: optC || 'Opción C' },
      { id: 'D', text: optD || 'Opción D' }
    ],
    correctOption,
    explanation: explanation || 'Retroalimentación oficial de la misión.',
    xp
  };

  save();

  const fb = document.getElementById('evalSaveFeedback');
  if (fb) {
    fb.style.display = 'inline-block';
    setTimeout(() => { fb.style.display = 'none'; }, 2200);
  }
};

function resize() {
  const s = document.getElementById('stage');
  if (!s) return;
  camera.aspect = s.clientWidth / s.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(s.clientWidth, s.clientHeight, false);
  if (overview3DMode && !travel) {
    const home = getOverview3DHomePose();
    _focusTargetPos.copy(home.pos);
    _focusTargetLook.copy(home.look);
  }
}
new ResizeObserver(resize).observe(document.getElementById('stage'));
resize();
rebuildPlayers();
applyStates();
initAdminEvalEditor();



// ── Render Loop ───────────────────────────────────────────────────────────────
const clock = new THREE.Clock();
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.035), t = clock.elapsedTime;

  if (anim.streamer) {
    anim.streamer.tickStream();
    anim.streamer.update(dt, t, camera.position, overview3DMode);
  }

  anim.water.forEach(w => {
    const s = w.material.userData.shader;
    if (s) s.uniforms.uTime.value = t;
  });

  if (anim.motesMat && camera) {
    anim.motesMat.uniforms.uTime.value = t;
    anim.motesMat.uniforms.uCameraPos.value.copy(camera.position);
  }

  updateSunShadow(false);

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

  // Animated Kenney FBX characters, rotating plinth ring & team crystals
  anim.players.forEach(a => {
    const u = a.userData;
    if (!u) return;

    if (u.heroModel?.userData?.update) {
      u.heroModel.userData.update(dt);
    }
    // Rotating magic team rune ring on plinth
    if (u.runeRing) {
      u.runeRing.rotation.z += dt * 0.8;
    }
    // Floating team gem rotation & pulse
    if (u.gem) {
      u.gem.rotation.y += dt * 1.6;
      u.gem.position.y = 1.28 + Math.sin(t * 3.0 + (u.phase || 0)) * 0.03;
    }
  });

  anim.clouds.forEach(c => {
    c.position.x += c.userData.speed * dt;
    if (c.position.x > 340) c.position.x = -340;
  });

  // ── VUELO PARABÓLICO CONTINUO Y FLUIDO (1.8s–2.5s) ──────────────────────────
  if (travel) {
    travel.t = Math.min(1, travel.t + dt / travel.duration);
    const curT = travel.t;
    const s = cinematicEase(curT);
    const invS = 1 - s;

    // Interpolación cuadrática de Bézier continua sin frenadas intermedias
    const currX = invS * invS * travel.startPos.x + 2 * invS * s * travel.midPos.x + s * s * travel.finalPos.x;
    const currY = invS * invS * travel.startPos.y + 2 * invS * s * travel.midPos.y + s * s * travel.finalPos.y;
    const currZ = invS * invS * travel.startPos.z + 2 * invS * s * travel.midPos.z + s * s * travel.finalPos.z;

    lookTarget.lerpVectors(travel.startLook, travel.finalLook, s);

    camera.position.set(currX, currY, currZ);
    camera.lookAt(lookTarget);
    orbit.target.copy(lookTarget);
    if (!overview3DMode) {
      updateSkyMissionTitle(currX, currZ);
    }

    const bar = document.getElementById('cinematicBar');
    if (bar) bar.style.width = (curT * 100).toFixed(1) + '%';

    if (curT >= 1) {
      camera.position.copy(travel.finalPos);
      lookTarget.copy(travel.finalLook);
      camera.lookAt(lookTarget);
      orbit.target.copy(lookTarget);

      const onDone = travel.onComplete;
      travel = null;
      cinematicUI(false);
      updateStationMediaTrigger();
      updateStationEvaluationsUI();
      rebuildPlayers();
      if (typeof onDone === 'function') onDone();
    }
  
  } else if (overview3DMode) {
    // Vista General Cenital desde Arriba (Centrada en toda la ruta, con zoom y paneo suaves)
    overviewZoomLevel = THREE.MathUtils.lerp(overviewZoomLevel, overviewTargetZoom, 0.12);
    overviewPanX = THREE.MathUtils.lerp(overviewPanX, overviewTargetPanX, 0.12);
    overviewPanZ = THREE.MathUtils.lerp(overviewPanZ, overviewTargetPanZ, 0.12);

    const home = getOverview3DHomePose();
    _focusTargetPos.copy(home.pos);
    _focusTargetLook.copy(home.look);
    if (camera.position.distanceTo(_focusTargetPos) > 0.05 || lookTarget.distanceTo(_focusTargetLook) > 0.05) {
      camera.position.lerp(_focusTargetPos, 0.12);
      lookTarget.lerp(_focusTargetLook, 0.12);
      camera.lookAt(lookTarget);
      orbit.target.copy(lookTarget);
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
    camera.position.x = clamp(camera.position.x, -480, 760);
    camera.position.z = clamp(camera.position.z, -300, 300);

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
    camera.position.x = clamp(camera.position.x, -480, 760);
    camera.position.z = clamp(camera.position.z, -300, 300);
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

      // Project interactive 3D Station Pins ONLY when in 3D Overworld Map and NOT traveling
  if (checkpointLabelsLayer) {
    if (overview3DMode && !travel) {
      checkpointLabelsLayer.classList.add('visible');
      if (checkpointLabelsLayer.style.display !== 'block') checkpointLabelsLayer.style.display = 'block';
      const pinSig = `ov3d:${current}:${players.map(p => `${p.id}-${(p.missionId !== undefined && p.missionId !== null) ? p.missionId : current}`).join('|')}`;
      if (checkpointLabelsLayer.dataset.sig !== pinSig) {
        checkpointLabelsLayer.dataset.sig = pinSig;
        checkpointLabelsLayer.innerHTML = missions.map(m => {
          const curShown = Math.max(current, 1);
          const isDone = m.id < curShown;
          const isCurr = m.id === curShown;
          const stateCls = isCurr ? 'is-current' : (isDone ? 'is-done' : 'is-upcoming');
          const lockSvg = (!isDone && !isCurr) ? '<svg class="pin-lock" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>' : '';
          const numStr = String(m.id).padStart(2, '0');
          const stationPlayers = players.filter(p => ((p.missionId !== undefined && p.missionId !== null) ? Number(p.missionId) : current) === m.id);
          let advHtml = '';
          if (stationPlayers.length > 0) {
            const shown = stationPlayers.slice(0, 3);
            const extra = stationPlayers.length - shown.length;
            advHtml = `<div class="pin-adventurers-group">${shown.map(p => `<span class="pin-adv-chip" style="background:${p.color || '#cc092f'};" title="${String(p.name || 'Aventurero').replace(/"/g, '&quot;')}">${String(p.initials || (p.name ? p.name.charAt(0) : 'A')).replace(/"/g, '&quot;')}</span>`).join('')}${extra > 0 ? `<span class="pin-adv-chip more">+${extra}</span>` : ''}</div>`;
          }
          // Formato inteligente en dos líneas equilibradas para máxima legibilidad compacta
          const twoLineName = String(m.name || '')
            .replace(': ', ':<br>')
            .replace(' & ', ' &<br>')
            .replace(' Cuidamos la ', '<br>Cuidamos la ')
            .replace(' te Estaba ', ' te<br>Estaba ');
          return `
            <button type="button" class="overview-station-pin ${stateCls}" onclick="window.jumpFromMapToMission(${m.id})" style="left:0;top:0;will-change:transform;" title="Viajar a Misión ${numStr}: ${String(m.name || '').replace(/"/g, '&quot;')}">
              <div class="pin-card">
                <span class="pin-num">${numStr}</span>
                <span class="pin-name">${twoLineName}</span>${lockSvg}
              </div>
              ${advHtml}
              <div class="pin-stem"></div>
              <div class="pin-dot"></div>
            </button>`;
        }).join('');
      }
      const cw = renderer.domElement.clientWidth;
      const ch = renderer.domElement.clientHeight;
      for (let i = 0; i < missions.length; i++) {
        const m = missions[i];
        const pinEl = checkpointLabelsLayer.children[i];
        if (!pinEl) continue;
        if (m.hidden) { if (pinEl.style.display !== 'none') pinEl.style.display = 'none'; continue; }
        _projVec.set(m.x, getTerrainY(m.x, m.z) + 6.5, m.z);
        _projVec.project(camera);
        const vis = _projVec.z < 1 && Math.abs(_projVec.x) < 1.05 && Math.abs(_projVec.y) < 1.05;
        const nextDisp = vis ? 'inline-flex' : 'none';
        if (pinEl.style.display !== nextDisp) pinEl.style.display = nextDisp;
        if (vis) {
          const px = Math.round(((_projVec.x * 0.5 + 0.5) * cw) * 2) * 0.5;
          const py = Math.round(((-_projVec.y * 0.5 + 0.5) * ch) * 2) * 0.5;
          if (pinEl._lastX !== px || pinEl._lastY !== py) {
            pinEl._lastX = px;
            pinEl._lastY = py;
            pinEl.style.transform = `translate(-50%, -100%) translate3d(${px}px, ${py}px, 0)`;
          }
        }
      }
    } else {
      checkpointLabelsLayer.classList.remove('visible');
      if (checkpointLabelsLayer.style.display !== 'none') checkpointLabelsLayer.style.display = 'none';
    }
  }

  // Projected 3D Character Nameplates
  if (labelLayer) {
    if (travel || overview3DMode) {
      labelLayer.style.display = 'none';
    } else {
      labelLayer.style.display = 'block';
      const labelSig = players.map(p => p.id + ':' + p.name + ':' + p.points).join('|');
      if (labelLayer.dataset.sig !== labelSig) {
        labelLayer.dataset.sig = labelSig;
        labelLayer.innerHTML = players.map(p => `<div class="character-tag">${p.name}<small>${p.points} XP</small></div>`).join('');
      }
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
  }

  // Rotación interactiva de la brújula de expedición (Opción 5)
  const compassNeedle = document.querySelector('.compass-needle');
  if (compassNeedle) {
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    const angle = Math.atan2(camDir.x, camDir.z) * (180 / Math.PI);
    compassNeedle.style.transform = `rotate(${-angle}deg)`;
  }

  // Update directional sun shadow camera to follow active focus area with cinematic angle
  sun.target.position.set(lookTarget.x, getTerrainY(lookTarget.x, lookTarget.z), lookTarget.z);
  sun.position.set(lookTarget.x + 85, 125, lookTarget.z + 75);

  updateWeather(t, dt);
  renderer.render(scene, camera);
}
loop();


// ── Sistema de Administración Local de Contenidos & Cápsulas ──
let STATION_CONTENT = {};
let MEDIA_CATALOG = [];
let contentAdminActiveStation = 1;
let contentAdminActiveItemIdx = -1;

async function loadStationContentConfig() {
  try {
    const res = await fetch('/api/content');
    if (res.ok) {
      const data = await res.json();
      if (data && data.stations) {
        STATION_CONTENT = data.stations;
      }
    }
  } catch (err) {
    console.warn('loadStationContentConfig error:', err);
  }

  await refreshMediaCatalog();
}

async function refreshMediaCatalog() {
  try {
    const resCatalog = await fetch('/api/media/catalog');
    if (resCatalog.ok) {
      MEDIA_CATALOG = await resCatalog.json();
      populateCatalogDropdown();
    }
  } catch (err) {
    console.warn('loadMediaCatalog error:', err);
  }
}

function populateCatalogDropdown() {
  const catSel = document.getElementById('adminMediaCatalogSelect');
  if (!catSel) return;
  const items = ensureStationContent(contentAdminActiveStation);
  const it = items[contentAdminActiveItemIdx];
  const curFile = it ? it.file : '';

  catSel.innerHTML = '<option value="">-- Seleccionar de archivos locales detectados en assets/media --</option>';
  MEDIA_CATALOG.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f.relativePath;
    opt.textContent = `[${f.folder}] ${f.name} (${f.type.toUpperCase()})`;
    if (f.relativePath === curFile) opt.selected = true;
    catSel.appendChild(opt);
  });
}

function getDefaultStationItems(sId) {
  const stationEvals = evaluations[sId] || DEFAULT_EVALUATIONS[sId] || DEFAULT_EVALUATIONS[1] || {};
  const rawItems = (STATION_MEDIA && STATION_MEDIA[sId]) ? STATION_MEDIA[sId] : (DEFAULT_STATION_MEDIA[sId] || DEFAULT_STATION_MEDIA[1] || []);
  const sortedRaw = [...rawItems].sort((a, b) => (a.order || 0) - (b.order || 0));
  const evalMid = stationEvals.mid || DEFAULT_EVALUATIONS[sId]?.mid || { title: 'Evaluación Intermedia', xp: 50 };
  const evalFinal = stationEvals.final || DEFAULT_EVALUATIONS[sId]?.final || { title: 'Reto Final de Cierre', xp: 75 };
  const checklistCfg = STATION_CHECKLISTS_CONFIG[sId] || null;

  const items = [];
  if (sortedRaw.length >= 2) {
    items.push({ id: `cap_${sId}_1`, ...sortedRaw[0], xp: 40 });
    items.push({ id: `cap_${sId}_2`, ...sortedRaw[1], xp: 40 });
    items.push({
      id: `eval_${sId}_mid`,
      type: 'eval',
      isEval: true,
      evalType: 'mid',
      title: evalMid.title || 'Evaluación Intermedia',
      question: evalMid.question || '',
      options: evalMid.options || [
        { id: 'A', text: 'Opción A' },
        { id: 'B', text: 'Opción B' },
        { id: 'C', text: 'Opción C' },
        { id: 'D', text: 'Opción D' }
      ],
      correct: evalMid.correct || 'A',
      explanation: evalMid.explanation || '',
      xp: evalMid.xp || 50
    });
    for (let i = 2; i < sortedRaw.length; i++) {
      items.push({ id: `cap_${sId}_${i+1}`, ...sortedRaw[i], xp: 40 });
    }
    if (checklistCfg) {
      items.push({
        id: `chk_${sId}`,
        type: 'checklist',
        isChecklist: true,
        title: checklistCfg.title || 'Checklist de Validación',
        subtitle: checklistCfg.subtitle || 'Verificación de competencias',
        xp: checklistCfg.xp || 60,
        items: checklistCfg.items ? checklistCfg.items.map(it => ({ ...it })) : []
      });
    }
    items.push({
      id: `eval_${sId}_final`,
      type: 'eval',
      isEval: true,
      evalType: 'final',
      title: evalFinal.title || 'Reto Final de Cierre',
      question: evalFinal.question || '',
      options: evalFinal.options || [
        { id: 'A', text: 'Opción A' },
        { id: 'B', text: 'Opción B' },
        { id: 'C', text: 'Opción C' },
        { id: 'D', text: 'Opción D' }
      ],
      correct: evalFinal.correct || 'A',
      explanation: evalFinal.explanation || '',
      xp: evalFinal.xp || 75
    });
  } else if (sortedRaw.length === 1) {
    items.push({ id: `cap_${sId}_1`, ...sortedRaw[0], xp: 40 });
    if (checklistCfg) {
      items.push({
        id: `chk_${sId}`,
        type: 'checklist',
        isChecklist: true,
        title: checklistCfg.title || 'Checklist de Validación',
        subtitle: checklistCfg.subtitle || 'Verificación de competencias',
        xp: checklistCfg.xp || 60,
        items: checklistCfg.items ? checklistCfg.items.map(it => ({ ...it })) : []
      });
    }
    items.push({
      id: `eval_${sId}_mid`,
      type: 'eval',
      isEval: true,
      evalType: 'mid',
      title: evalMid.title || 'Evaluación Intermedia',
      question: evalMid.question || '',
      options: evalMid.options || [
        { id: 'A', text: 'Opción A' },
        { id: 'B', text: 'Opción B' },
        { id: 'C', text: 'Opción C' },
        { id: 'D', text: 'Opción D' }
      ],
      correct: evalMid.correct || 'A',
      explanation: evalMid.explanation || '',
      xp: evalMid.xp || 50
    });
    items.push({
      id: `eval_${sId}_final`,
      type: 'eval',
      isEval: true,
      evalType: 'final',
      title: evalFinal.title || 'Reto Final de Cierre',
      question: evalFinal.question || '',
      options: evalFinal.options || [
        { id: 'A', text: 'Opción A' },
        { id: 'B', text: 'Opción B' },
        { id: 'C', text: 'Opción C' },
        { id: 'D', text: 'Opción D' }
      ],
      correct: evalFinal.correct || 'A',
      explanation: evalFinal.explanation || '',
      xp: evalFinal.xp || 75
    });
  } else {
    items.push({
      id: `eval_${sId}_mid`,
      type: 'eval',
      isEval: true,
      evalType: 'mid',
      title: evalMid.title || 'Evaluación Intermedia',
      question: evalMid.question || '',
      options: evalMid.options || [
        { id: 'A', text: 'Opción A' },
        { id: 'B', text: 'Opción B' },
        { id: 'C', text: 'Opción C' },
        { id: 'D', text: 'Opción D' }
      ],
      correct: evalMid.correct || 'A',
      explanation: evalMid.explanation || '',
      xp: evalMid.xp || 50
    });
    items.push({
      id: `eval_${sId}_final`,
      type: 'eval',
      isEval: true,
      evalType: 'final',
      title: evalFinal.title || 'Reto Final de Cierre',
      question: evalFinal.question || '',
      options: evalFinal.options || [
        { id: 'A', text: 'Opción A' },
        { id: 'B', text: 'Opción B' },
        { id: 'C', text: 'Opción C' },
        { id: 'D', text: 'Opción D' }
      ],
      correct: evalFinal.correct || 'A',
      explanation: evalFinal.explanation || '',
      xp: evalFinal.xp || 75
    });
  }
  return items;
}

function ensureStationContent(sId) {
  if (!STATION_CONTENT[sId] || !Array.isArray(STATION_CONTENT[sId].items)) {
    STATION_CONTENT[sId] = {
      items: getDefaultStationItems(sId)
    };
  }
  return STATION_CONTENT[sId].items;
}

window.openContentAdminModal = function(stationId) {
  contentAdminActiveStation = Number(stationId) || current || 1;
  populateContentAdminStationSelect();
  renderContentAdminSequence();
  refreshMediaCatalog();
  const dlg = document.getElementById('contentAdminModal');
  if (dlg) dlg.showModal();
};

window.closeContentAdminModal = function() {
  const dlg = document.getElementById('contentAdminModal');
  if (dlg) dlg.close();
  // Pause any video playing in preview
  const vPrev = document.getElementById('adminMediaVideoPreview');
  if (vPrev) { vPrev.pause(); vPrev.removeAttribute('src'); }
  updateStationMediaTrigger();
};

function populateContentAdminStationSelect() {
  const sel = document.getElementById('contentAdminStationSelect');
  if (!sel) return;
  sel.innerHTML = '';
  for (let i = 1; i <= MAX_MISSION; i++) {
    const q = getMission(i);
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `Estación ${String(i).padStart(2, '0')} · ${q ? q.name : 'Misión ' + i}`;
    if (i === contentAdminActiveStation) opt.selected = true;
    sel.appendChild(opt);
  }
}

window.contentAdminOnStationChange = function(newStationId) {
  contentAdminActiveStation = Number(newStationId) || 1;
  contentAdminActiveItemIdx = -1;
  renderContentAdminSequence();
};

function renderContentAdminSequence() {
  const items = ensureStationContent(contentAdminActiveStation);
  const listEl = document.getElementById('contentAdminItemsList');
  const countEl = document.getElementById('contentAdminItemCount');
  if (countEl) countEl.textContent = `${items.length} elemento${items.length === 1 ? '' : 's'}`;

  if (!listEl) return;
  listEl.innerHTML = '';

  items.forEach((it, idx) => {
    const card = document.createElement('div');
    card.className = `content-admin-item-card ${idx === contentAdminActiveItemIdx ? 'active' : ''}`;

    let badgeClass = 'badge-video';
    let typeName = 'Video';
    if (it.type === 'eval' || it.isEval) {
      badgeClass = it.evalType === 'final' ? 'badge-final' : 'badge-mid';
      typeName = it.evalType === 'final' ? 'Reto Final' : 'Evaluación';
    } else if (it.type === 'checklist' || it.isChecklist) {
      badgeClass = 'badge-chk';
      typeName = 'Checklist';
    } else if (it.type === 'pdf') {
      badgeClass = 'badge-doc';
      typeName = 'PDF';
    } else if (it.type === 'image') {
      badgeClass = 'badge-img';
      typeName = 'Infografía';
    } else if (it.type === 'ensala' || it.type === 'insitu') {
      badgeClass = 'badge-ensala';
      typeName = 'En Sala';
    }

    card.innerHTML = `
      <div class="card-reorder-btns">
        <button type="button" class="order-btn" title="Subir orden" onclick="event.stopPropagation(); window.contentAdminMoveItem(${idx}, -1)" ${idx === 0 ? 'disabled' : ''}>▲</button>
        <button type="button" class="order-btn" title="Bajar orden" onclick="event.stopPropagation(); window.contentAdminMoveItem(${idx}, 1)" ${idx === items.length - 1 ? 'disabled' : ''}>▼</button>
      </div>
      <div class="card-info" onclick="window.contentAdminSelectDetail(${idx})">
        <div class="card-header-line">
          <span class="card-order-num">${String(idx + 1).padStart(2, '0')}</span>
          <span class="card-type-chip ${badgeClass}">${typeName}</span>
          <span class="card-xp-badge">+${it.xp || 40} XP</span>
        </div>
        <span class="card-title-text">${it.title || 'Sin título'}</span>
      </div>
      <button type="button" class="card-delete-btn" title="Eliminar elemento" onclick="event.stopPropagation(); window.contentAdminDeleteItem(${idx})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
    `;
    listEl.appendChild(card);
  });

  if (contentAdminActiveItemIdx >= 0 && contentAdminActiveItemIdx < items.length) {
    renderContentAdminDetail(contentAdminActiveItemIdx);
  } else if (items.length > 0) {
    window.contentAdminSelectDetail(0);
  } else {
    renderContentAdminDetail(-1);
  }
}

window.contentAdminSelectDetail = function(idx) {
  contentAdminActiveItemIdx = idx;
  const items = ensureStationContent(contentAdminActiveStation);
  const listEl = document.getElementById('contentAdminItemsList');
  if (listEl) {
    listEl.querySelectorAll('.content-admin-item-card').forEach((c, i) => {
      c.classList.toggle('active', i === idx);
    });
  }
  renderContentAdminDetail(idx);
};

function renderContentAdminDetail(idx) {
  const items = ensureStationContent(contentAdminActiveStation);
  const emptyState = document.getElementById('contentAdminEmptyState');
  const mediaFields = document.getElementById('contentAdminMediaFields');
  const evalFields = document.getElementById('contentAdminEvalFields');
  const chkFields = document.getElementById('contentAdminChecklistFields');
  const ensalaFields = document.getElementById('contentAdminEnSalaFields');
  const headingEl = document.getElementById('contentAdminDetailHeading');
  const badgeEl = document.getElementById('contentAdminDetailBadge');

  if (idx < 0 || idx >= items.length) {
    if (emptyState) emptyState.style.display = 'flex';
    if (mediaFields) mediaFields.style.display = 'none';
    if (evalFields) evalFields.style.display = 'none';
    if (chkFields) chkFields.style.display = 'none';
    if (ensalaFields) ensalaFields.style.display = 'none';
    if (headingEl) headingEl.textContent = 'Editor de Elemento';
    if (badgeEl) badgeEl.textContent = 'Ninguno seleccionado';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';
  const it = items[idx];

  populateCatalogDropdown();

  if (it.type === 'eval' || it.isEval) {
    if (mediaFields) mediaFields.style.display = 'none';
    if (evalFields) evalFields.style.display = 'flex';
    if (chkFields) chkFields.style.display = 'none';

    if (headingEl) headingEl.textContent = `Desafío / Evaluación #${idx + 1}`;
    if (badgeEl) badgeEl.textContent = it.evalType === 'final' ? 'Reto Final de Cierre' : 'Evaluación Intermedia';

    const tInput = document.getElementById('adminEvalTitle');
    if (tInput) tInput.value = it.title || '';
    const mSelect = document.getElementById('adminEvalMomentSelect');
    if (mSelect) mSelect.value = it.evalType || 'mid';
    const qText = document.getElementById('adminEvalQuestion');
    if (qText) qText.value = it.question || '';
    const xpInput = document.getElementById('adminEvalXp');
    if (xpInput) xpInput.value = it.xp || 50;
    const expText = document.getElementById('adminEvalExplanation');
    if (expText) expText.value = it.explanation || '';

    // Options A, B, C, D
    const options = it.options || [];
    ['A', 'B', 'C', 'D'].forEach(letter => {
      const optObj = options.find(o => o.id === letter) || { text: '' };
      const inEl = document.getElementById(`adminEvalOpt${letter}`);
      if (inEl) inEl.value = optObj.text || '';
    });

    const radios = document.getElementsByName('adminEvalCorrectRadio');
    radios.forEach(r => {
      r.checked = (r.value === (it.correct || 'A'));
    });

  } else if (it.type === 'checklist' || it.isChecklist) {
    if (mediaFields) mediaFields.style.display = 'none';
    if (evalFields) evalFields.style.display = 'none';
    if (chkFields) chkFields.style.display = 'flex';
    if (ensalaFields) ensalaFields.style.display = 'none';

    if (headingEl) headingEl.textContent = `Checklist Interactiva #${idx + 1}`;
    if (badgeEl) badgeEl.textContent = 'Lista de Verificación';

    const tInput = document.getElementById('adminChecklistTitle');
    if (tInput) tInput.value = it.title || '';
    const subInput = document.getElementById('adminChecklistSubtitle');
    if (subInput) subInput.value = it.subtitle || '';
    const xpInput = document.getElementById('adminChecklistXp');
    if (xpInput) xpInput.value = it.xp || 60;

    renderAdminChecklistItems(it.items || []);

  } else if (it.type === 'ensala' || it.type === 'insitu') {
    if (mediaFields) mediaFields.style.display = 'none';
    if (evalFields) evalFields.style.display = 'none';
    if (chkFields) chkFields.style.display = 'none';
    if (ensalaFields) ensalaFields.style.display = 'flex';

    if (headingEl) headingEl.textContent = `Actividad en Sala #${idx + 1}`;
    if (badgeEl) badgeEl.textContent = 'Modalidad En Sala';

    const tInput = document.getElementById('adminEnSalaTitle');
    if (tInput) tInput.value = it.title || '';
    const dInput = document.getElementById('adminEnSalaDesc');
    if (dInput) dInput.value = it.desc || '';
    const xpInput = document.getElementById('adminEnSalaXp');
    if (xpInput) xpInput.value = it.xp || 50;
    const pInput = document.getElementById('adminEnSalaProtocol');
    if (pInput) pInput.value = it.protocol || '';

    renderAdminEnSalaKeypoints(it.keypoints || []);

  } else {
    // Video, PDF, Image, Document
    if (mediaFields) mediaFields.style.display = 'flex';
    if (evalFields) evalFields.style.display = 'none';
    if (chkFields) chkFields.style.display = 'none';

    if (headingEl) headingEl.textContent = `Cápsula Multimedia #${idx + 1}`;
    if (badgeEl) badgeEl.textContent = it.type ? it.type.toUpperCase() : 'VIDEO';

    const tInput = document.getElementById('adminMediaTitle');
    if (tInput) tInput.value = it.title || '';
    const fInput = document.getElementById('adminMediaFilePath');
    if (fInput) fInput.value = it.file || '';
    const typeSelect = document.getElementById('adminMediaTypeSelect');
    if (typeSelect) typeSelect.value = it.type || 'video';
    const xpInput = document.getElementById('adminMediaXp');
    if (xpInput) xpInput.value = it.xp || 40;
    const descInput = document.getElementById('adminMediaDesc');
    if (descInput) descInput.value = it.desc || '';

    window.contentAdminUpdatePreview();
  }
}

window.contentAdminUpdatePreview = function() {
  const items = ensureStationContent(contentAdminActiveStation);
  const it = items[contentAdminActiveItemIdx];
  const previewBox = document.getElementById('adminMediaPreviewWrapper');
  const vidEl = document.getElementById('adminMediaVideoPreview');
  const imgEl = document.getElementById('adminMediaImgPreview');
  const pdfEl = document.getElementById('adminMediaPdfPreview');

  if (!previewBox || !vidEl || !imgEl || !pdfEl) return;

  if (!it || !it.file) {
    previewBox.style.display = 'none';
    vidEl.pause();
    vidEl.removeAttribute('src');
    return;
  }

  const encodedUrl = encodeURI(it.file);
  const type = it.type || 'video';

  previewBox.style.display = 'block';

  if (type === 'video') {
    imgEl.style.display = 'none';
    pdfEl.style.display = 'none';
    vidEl.style.display = 'block';
    if (vidEl.src !== window.location.origin + '/' + encodedUrl && vidEl.src !== encodedUrl) {
      vidEl.src = encodedUrl;
      vidEl.load();
    }
  } else if (type === 'image') {
    vidEl.pause();
    vidEl.style.display = 'none';
    pdfEl.style.display = 'none';
    imgEl.style.display = 'block';
    imgEl.src = encodedUrl;
  } else if (type === 'pdf') {
    vidEl.pause();
    vidEl.style.display = 'none';
    imgEl.style.display = 'none';
    pdfEl.style.display = 'block';
    pdfEl.src = `${encodedUrl}#toolbar=0&navpanes=0`;
  } else {
    vidEl.pause();
    vidEl.style.display = 'none';
    imgEl.style.display = 'none';
    pdfEl.style.display = 'none';
    previewBox.style.display = 'none';
  }
};

window.contentAdminHandleFileDrop = function(e) {
  if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
    window.contentAdminHandleFileUpload(e.dataTransfer.files[0]);
  }
};

window.contentAdminHandleFileUpload = async function(file) {
  if (!file) return;

  const progressWrap = document.getElementById('adminUploadProgress');
  const progressText = document.getElementById('adminUploadProgressText');
  const progressPct = document.getElementById('adminUploadProgressPct');
  const progressBar = document.getElementById('adminUploadProgressBar');

  if (progressWrap) progressWrap.style.display = 'flex';
  if (progressText) progressText.textContent = `Subiendo "${file.name}" (${Math.round(file.size / (1024*1024) * 10) / 10} MB)...`;
  if (progressPct) progressPct.textContent = '0%';
  if (progressBar) progressBar.style.width = '10%';

  try {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/media/upload', true);
    xhr.setRequestHeader('x-filename', encodeURIComponent(file.name));
    xhr.setRequestHeader('x-station-id', String(contentAdminActiveStation));
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');

    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable) {
        const pct = Math.round((evt.loaded / evt.total) * 100);
        if (progressPct) progressPct.textContent = `${pct}%`;
        if (progressBar) progressBar.style.width = `${pct}%`;
      }
    };

    xhr.onload = async () => {
      if (xhr.status === 200) {
        const res = JSON.parse(xhr.responseText);
        if (res.success) {
          if (progressText) progressText.textContent = '✓ Archivo guardado correctamente en disco';
          if (progressPct) progressPct.textContent = '100%';
          if (progressBar) progressBar.style.width = '100%';

          setTimeout(() => {
            if (progressWrap) progressWrap.style.display = 'none';
          }, 2000);

          const items = ensureStationContent(contentAdminActiveStation);
          let it = items[contentAdminActiveItemIdx];
          if (!it) {
            window.contentAdminAddItem('video');
            it = items[contentAdminActiveItemIdx];
          }

          it.file = res.relativePath;
          const fInput = document.getElementById('adminMediaFilePath');
          if (fInput) fInput.value = res.relativePath;

          // Determine type automatically
          const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
          if (['.mp4', '.webm', '.mov', '.m4v'].includes(ext)) {
            it.type = 'video';
          } else if (ext === '.pdf') {
            it.type = 'pdf';
          } else if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
            it.type = 'image';
          }
          const tSel = document.getElementById('adminMediaTypeSelect');
          if (tSel) tSel.value = it.type;

          // Auto-name title if empty or generic
          if (!it.title || it.title.startsWith('Nueva Cápsula')) {
            let cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/^[0-9]+[_\-\s]+/, '').replace(/[_\-]+/g, ' ').trim();
            cleanName = cleanName.replace(/\b\w/g, l => l.toUpperCase());
            it.title = cleanName;
            const tInput = document.getElementById('adminMediaTitle');
            if (tInput) tInput.value = cleanName;
          }

          await refreshMediaCatalog();
          renderContentAdminSequence();
          window.contentAdminUpdatePreview();
        } else {
          alert('Error en servidor: ' + (res.error || 'No se pudo guardar el archivo'));
          if (progressWrap) progressWrap.style.display = 'none';
        }
      } else {
        alert('Error al subir archivo: código ' + xhr.status);
        if (progressWrap) progressWrap.style.display = 'none';
      }
    };

    xhr.onerror = () => {
      alert('Error de conexión al subir archivo');
      if (progressWrap) progressWrap.style.display = 'none';
    };

    xhr.send(file);
  } catch (err) {
    alert('Error al iniciar carga: ' + err.message);
    if (progressWrap) progressWrap.style.display = 'none';
  }
};


window.contentAdminAddEnSalaKeypoint = function() {
  const items = ensureStationContent(contentAdminActiveStation);
  const it = items[contentAdminActiveItemIdx];
  if (!it) return;
  if (!Array.isArray(it.keypoints)) it.keypoints = [];
  it.keypoints.push('Nuevo punto clave de la sesión');
  renderAdminEnSalaKeypoints(it.keypoints);
};

window.contentAdminSyncEnSalaKeypoint = function(kpIdx, val) {
  const items = ensureStationContent(contentAdminActiveStation);
  const it = items[contentAdminActiveItemIdx];
  if (!it || !it.keypoints || it.keypoints[kpIdx] === undefined) return;
  it.keypoints[kpIdx] = val;
};

window.contentAdminDeleteEnSalaKeypoint = function(kpIdx) {
  const items = ensureStationContent(contentAdminActiveStation);
  const it = items[contentAdminActiveItemIdx];
  if (!it || !it.keypoints) return;
  it.keypoints.splice(kpIdx, 1);
  renderAdminEnSalaKeypoints(it.keypoints);
};

function renderAdminEnSalaKeypoints(keypoints) {
  const listEl = document.getElementById('adminEnSalaKeypointsList');
  if (!listEl) return;
  listEl.innerHTML = '';
  (keypoints || []).forEach((kp, idx) => {
    const row = document.createElement('div');
    row.className = 'admin-checklist-row';
    row.innerHTML = `
      <span class="chk-num">${idx + 1}</span>
      <input type="text" class="admin-input" value="${(kp || '').replace(/"/g, '&quot;')}" placeholder="Punto clave..." oninput="window.contentAdminSyncEnSalaKeypoint(${idx}, this.value)">
      <button type="button" class="admin-del-row-btn" title="Eliminar punto" onclick="window.contentAdminDeleteEnSalaKeypoint(${idx})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
    `;
    listEl.appendChild(row);
  });
}

function renderAdminChecklistItems(checklistItems) {
  const container = document.getElementById('adminChecklistItemsList');
  if (!container) return;
  container.innerHTML = '';
  checklistItems.forEach((chk, chkIdx) => {
    const row = document.createElement('div');
    row.className = 'admin-checklist-row';
    row.innerHTML = `
      <span class="chk-num">${chkIdx + 1}</span>
      <input type="text" class="admin-input" value="${chk.label || ''}" placeholder="Texto del punto a verificar..." oninput="window.contentAdminSyncChecklistItem(${chkIdx}, this.value)">
      <button type="button" class="card-delete-btn" title="Eliminar punto" onclick="window.contentAdminDeleteChecklistItem(${chkIdx})"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
    `;
    container.appendChild(row);
  });
}

window.contentAdminMoveItem = function(idx, dir) {
  const items = ensureStationContent(contentAdminActiveStation);
  const targetIdx = idx + dir;
  if (targetIdx < 0 || targetIdx >= items.length) return;
  const temp = items[idx];
  items[idx] = items[targetIdx];
  items[targetIdx] = temp;
  contentAdminActiveItemIdx = targetIdx;
  renderContentAdminSequence();
};

window.contentAdminDeleteItem = function(idx) {
  const items = ensureStationContent(contentAdminActiveStation);
  if (idx < 0 || idx >= items.length) return;
  items.splice(idx, 1);
  if (contentAdminActiveItemIdx >= items.length) {
    contentAdminActiveItemIdx = items.length - 1;
  }
  renderContentAdminSequence();
};

window.contentAdminAddItem = function(type) {
  const items = ensureStationContent(contentAdminActiveStation);
  const ts = Date.now();
  let newItem = null;

  if (type === 'video') {
    const firstVid = MEDIA_CATALOG.find(m => m.type === 'video');
    newItem = {
      id: `cap_${ts}`,
      type: 'video',
      title: 'Nueva Cápsula de Video',
      file: firstVid ? firstVid.relativePath : '',
      desc: 'Cápsula de Video',
      xp: 40
    };
  } else if (type === 'eval') {
    newItem = {
      id: `eval_${ts}`,
      type: 'eval',
      isEval: true,
      evalType: 'mid',
      title: 'Nueva Evaluación Intermedia',
      question: '¿Escribe la pregunta de la evaluación aquí?',
      options: [
        { id: 'A', text: 'Opción 1' },
        { id: 'B', text: 'Opción 2' },
        { id: 'C', text: 'Opción 3' },
        { id: 'D', text: 'Opción 4' }
      ],
      correct: 'A',
      explanation: 'Justificación didáctica de la respuesta correcta...',
      xp: 50
    };
  } else if (type === 'checklist') {
    newItem = {
      id: `chk_${ts}`,
      type: 'checklist',
      isChecklist: true,
      title: 'Checklist de Validación',
      subtitle: 'Comprobación de estándares',
      xp: 60,
      items: [
        { key: `chk_${ts}_1`, label: 'Paso 1: Verificación inicial completada' },
        { key: `chk_${ts}_2`, label: 'Paso 2: Procedimiento ejecutado con éxito' }
      ]
    };
  } else if (type === 'ensala') {
    newItem = {
      id: `ensala_${ts}`,
      type: 'ensala',
      title: 'Nueva Actividad en Sala',
      desc: 'Pautas y dinámica presencial con facilitador',
      protocol: 'Instrucciones paso a paso de lo que sucederá en sala con el facilitador y el equipo.',
      keypoints: [
        'Paso 1: Explicación del facilitador en sala',
        'Paso 2: Participación activa y dinámica de los asistentes',
        'Paso 3: Validación y resolución de dudas'
      ],
      xp: 50,
      badge: 'En Sala'
    };
  } else if (type === 'pdf') {
    const firstPdf = MEDIA_CATALOG.find(m => m.type === 'pdf');
    newItem = {
      id: `doc_${ts}`,
      type: 'pdf',
      title: 'Nuevo Documento PDF',
      file: firstPdf ? firstPdf.relativePath : '',
      desc: 'Documento Guía',
      xp: 30
    };
  }

  if (newItem) {
    items.push(newItem);
    contentAdminActiveItemIdx = items.length - 1;
    renderContentAdminSequence();
  }
};

window.contentAdminSelectFromCatalog = function(relPath) {
  if (!relPath) return;
  const items = ensureStationContent(contentAdminActiveStation);
  const it = items[contentAdminActiveItemIdx];
  if (!it) return;

  it.file = relPath;
  const fInput = document.getElementById('adminMediaFilePath');
  if (fInput) fInput.value = relPath;

  const found = MEDIA_CATALOG.find(m => m.relativePath === relPath);
  if (found && (!it.title || it.title.startsWith('Nueva Cápsula'))) {
    let cleanName = found.name.replace(/\.[^/.]+$/, '').replace(/^[0-9]+[_\-\s]+/, '').replace(/[_\-]+/g, ' ').trim();
    cleanName = cleanName.replace(/\b\w/g, l => l.toUpperCase());
    it.title = cleanName;
    const tInput = document.getElementById('adminMediaTitle');
    if (tInput) tInput.value = cleanName;
  }
  renderContentAdminSequence();
  window.contentAdminUpdatePreview();
};

window.contentAdminSyncField = function(field, val) {
  const items = ensureStationContent(contentAdminActiveStation);
  const it = items[contentAdminActiveItemIdx];
  if (!it) return;

  it[field] = val;
  if (field === 'title' || field === 'type' || field === 'evalType' || field === 'xp') {
    const listEl = document.getElementById('contentAdminItemsList');
    if (listEl) {
      const cards = listEl.querySelectorAll('.content-admin-item-card');
      const curCard = cards[contentAdminActiveItemIdx];
      if (curCard) {
        const titleEl = curCard.querySelector('.card-title-text');
        if (titleEl) titleEl.textContent = it.title || 'Sin título';
        const xpEl = curCard.querySelector('.card-xp-badge');
        if (xpEl) xpEl.textContent = `+${it.xp || 40} XP`;
      }
    }
  }
};

window.contentAdminSyncOption = function(letter, text) {
  const items = ensureStationContent(contentAdminActiveStation);
  const it = items[contentAdminActiveItemIdx];
  if (!it) return;
  if (!it.options) it.options = [];
  let optObj = it.options.find(o => o.id === letter);
  if (!optObj) {
    optObj = { id: letter, text: '' };
    it.options.push(optObj);
  }
  optObj.text = text;
};

window.contentAdminAddChecklistItem = function() {
  const items = ensureStationContent(contentAdminActiveStation);
  const it = items[contentAdminActiveItemIdx];
  if (!it) return;
  if (!it.items) it.items = [];
  it.items.push({ key: `chk_${Date.now()}`, label: 'Nuevo punto de validación' });
  renderAdminChecklistItems(it.items);
};

window.contentAdminSyncChecklistItem = function(chkIdx, val) {
  const items = ensureStationContent(contentAdminActiveStation);
  const it = items[contentAdminActiveItemIdx];
  if (!it || !it.items || !it.items[chkIdx]) return;
  it.items[chkIdx].label = val;
};

window.contentAdminDeleteChecklistItem = function(chkIdx) {
  const items = ensureStationContent(contentAdminActiveStation);
  const it = items[contentAdminActiveItemIdx];
  if (!it || !it.items) return;
  it.items.splice(chkIdx, 1);
  renderAdminChecklistItems(it.items);
};

window.contentAdminResetStation = function() {
  if (!confirm(`¿Restablecer la Estación ${contentAdminActiveStation} a los contenidos por defecto?`)) return;
  STATION_CONTENT[contentAdminActiveStation] = {
    items: getDefaultStationItems(contentAdminActiveStation)
  };
  contentAdminActiveItemIdx = 0;
  renderContentAdminSequence();
};

window.contentAdminSaveToDisk = async function() {
  const pill = document.getElementById('contentAdminSavePill');
  try {
    const res = await fetch('/api/content/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ stations: STATION_CONTENT })
    });
    const result = await res.json();
    if (result.success) {
      if (pill) {
        pill.style.display = 'inline-block';
        pill.textContent = '✓ Guardado en disco';
        setTimeout(() => { pill.style.display = 'none'; }, 3000);
      }
      updateStationMediaTrigger();
    } else {
      alert('Error al guardar: ' + (result.error || 'Error desconocido'));
    }
  } catch (err) {
    alert('Error de conexión al guardar: ' + err.message);
  }
};

window.contentAdminTestMission = async function() {
  await window.contentAdminSaveToDisk();
  window.closeContentAdminModal();
  openStationMediaHub(contentAdminActiveStation);
};

// ══════════════════════════════════════════════════════════════════════════
// ADMINISTRADOR DE ESTACIONES DE LA EXPEDICIÓN
// ══════════════════════════════════════════════════════════════════════════
let stationAdminActiveStation = 1;

window.openStationAdminModal = function(stationId) {
  stationAdminActiveStation = Number(stationId) || current || 1;
  renderStationAdminList();
  loadStationAdminDetail(stationAdminActiveStation);
  const dlg = document.getElementById('stationAdminModal');
  if (dlg) dlg.showModal();
};

window.closeStationAdminModal = function() {
  const dlg = document.getElementById('stationAdminModal');
  if (dlg) dlg.close();
};

function renderStationAdminList() {
  const listEl = document.getElementById('stationAdminItemsList');
  if (!listEl) return;
  listEl.innerHTML = '';
  
  missions.filter(m => !m.hidden).forEach(m => {
    const card = document.createElement('div');
    card.className = `station-admin-item-card ${m.id === stationAdminActiveStation ? 'active' : ''}`;
    card.setAttribute('data-id', m.id);
    card.onclick = () => window.stationAdminSelect(m.id);
    card.innerHTML = `
      <span class="station-admin-item-num">${String(m.id).padStart(2, '0')}</span>
      <div class="station-admin-item-info">
        <strong class="station-admin-item-name">${m.name}</strong>
        <span class="station-admin-item-region">${m.region}</span>
      </div>
    `;
    listEl.appendChild(card);
  });
}

window.stationAdminSelect = function(stationId) {
  stationAdminActiveStation = Number(stationId);
  const listEl = document.getElementById('stationAdminItemsList');
  if (listEl) {
    listEl.querySelectorAll('.station-admin-item-card').forEach(c => {
      c.classList.toggle('active', Number(c.getAttribute('data-id')) === stationAdminActiveStation);
    });
  }
  loadStationAdminDetail(stationAdminActiveStation);
};

function loadStationAdminDetail(stationId) {
  const q = getMission(stationId);
  if (!q) return;

  const numInput = document.getElementById('stationAdminNumInput');
  const regInput = document.getElementById('stationAdminRegionInput');
  const nameInput = document.getElementById('stationAdminNameInput');
  const descInput = document.getElementById('stationAdminDescInput');
  const titleEl = document.getElementById('stationAdminDetailTitle');
  const badgeEl = document.getElementById('stationAdminDetailBadge');

  if (numInput) numInput.value = `Estación ${String(stationId).padStart(2, '0')}`;
  if (regInput) regInput.value = q.region || '';
  if (nameInput) nameInput.value = q.name || '';
  if (descInput) descInput.value = q.desc || '';
  if (titleEl) titleEl.textContent = `Editor de Estación ${String(stationId).padStart(2, '0')}`;
  if (badgeEl) badgeEl.textContent = q.region || `Misión ${stationId}`;
}

window.stationAdminSaveCurrent = function() {
  const q = getMission(stationAdminActiveStation);
  if (!q) return;

  const n = document.getElementById('stationAdminNameInput')?.value.trim();
  const r = document.getElementById('stationAdminRegionInput')?.value.trim();
  const d = document.getElementById('stationAdminDescInput')?.value.trim();

  if (n) q.name = n;
  if (r) q.region = r;
  if (d) q.desc = d;

  save();
  renderUI();

  // Reset signature of 3D pin layer to immediately re-render map labels
  const pinLayer = document.getElementById('checkpointLabelsLayer');
  if (pinLayer) pinLayer.dataset.sig = '';

  renderStationAdminList();

  const pill = document.getElementById('stationAdminSavePill');
  if (pill) {
    pill.style.display = 'inline-block';
    setTimeout(() => { pill.style.display = 'none'; }, 2500);
  }
};

window.stationAdminFlyToCurrent = function() {
  window.closeStationAdminModal();
  setMission(stationAdminActiveStation, true);
};

window.stationAdminOpenContent = function() {
  window.closeStationAdminModal();
  window.openContentAdminModal(stationAdminActiveStation);
};

// Asegurar que los modales de administración permanezcan cerrados al cargar la página
try {
  const adminDlg = document.getElementById('contentAdminModal');
  if (adminDlg && typeof adminDlg.close === 'function') adminDlg.close();
  const stDlg = document.getElementById('stationAdminModal');
  if (stDlg && typeof stDlg.close === 'function') stDlg.close();
  const heroDlg = document.getElementById('heroSelectionModal');
  if (heroDlg && typeof heroDlg.close === 'function') heroDlg.close();
} catch (_) {}
