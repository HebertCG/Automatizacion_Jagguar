// ============================================================
// Jaguar Carwash — Configuración global
// Este es el ÚNICO archivo que se edita al pasar de demo a producción.
// ============================================================

/**
 * MODO DEMO:
 *  true  → todo funciona con datos de muestra locales y el
 *          "tiempo real" se simula (no necesita backend).
 *  false → Supabase real: Auth + vista v_citas + Realtime + polling.
 *
 * Se decide POR DOMINIO para que un solo repo sirva a dos destinos:
 *   · *.vercel.app          → DEMO. Vitrina pública: cualquiera entra con
 *                             DEMO_CREDENCIALES y recorre el panel completo
 *                             sin tocar ni un dato real (todas las acciones
 *                             de escritura se quedan en el store local).
 *   · VPS de producción y localhost → REAL.
 *
 * Failsafe deliberado: si el dominio NO se reconoce, cae a REAL, que exige
 * login contra Supabase con RLS. El fallo nunca abre datos de clientes.
 *
 * Para probar la vitrina en local, pon MODO_FORZADO = 'demo'.
 */
const MODO_FORZADO = null; // null → decidir por dominio | 'demo' | 'real'

const esDominioVitrina = () =>
  typeof location !== 'undefined' &&
  location.hostname.endsWith('.vercel.app');

export const MODO_DEMO =
  MODO_FORZADO === null ? esDominioVitrina() : MODO_FORZADO === 'demo';

// --- Supabase (solo aplica con MODO_DEMO = false) -------------
// Usa SIEMPRE la clave publicable (anon/publishable).
// ⚠️ NUNCA coloques aquí una service_role key: este código corre
// en el navegador del staff y esa clave daría acceso total a la BD.
export const SUPABASE_URL = 'https://rnmqbxynfbalefrhocdq.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJubXFieHluZmJhbGVmcmhvY2RxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2Mjk4NTcsImV4cCI6MjA5OTIwNTg1N30.fTxl-JWLYY1WRVh2PJg0hiFGXa-Agra8NGriqEcxo4M';

export const VISTA_CITAS = 'v_citas';   // vista de solo lectura
export const TABLA_CITAS = 'appointments'; // tabla real (updates + realtime)

// --- Fuentes de datos del CRM (solo aplican con MODO_DEMO = false) ---
export const VISTA_BANDEJA = 'v_bandeja';          // 1 fila por cliente (último msg)
export const TABLA_CONVERSACIONES = 'conversations'; // mensajes (realtime)
export const TABLA_CLIENTES = 'customers';          // clientes (handoff)
export const FUNCION_ENVIAR_MENSAJE = 'enviar-mensaje-staff'; // Edge Function
// Clientes / Métricas / Agenda: TODO agregado en vistas → 1 consulta por sección.
export const VISTA_CLIENTES = 'v_clientes';
export const TABLA_NOTAS = 'customer_notes';
export const TABLA_TAGS = 'customer_tags';
export const FUNCION_FICHA = 'ficha_cliente';
export const VISTA_EMBUDO = 'v_embudo';
export const VISTA_METRICAS_DIARIAS = 'v_metricas_diarias';
export const VISTA_INGRESOS_SERVICIO = 'v_ingresos_por_servicio';
export const VISTA_RANKING_CLIENTES = 'v_ranking_clientes';

// --- Credenciales aceptadas en modo demo ----------------------
export const DEMO_CREDENCIALES = Object.freeze({
  email: 'staff@jaguar.pe',
  password: 'demo123',
});

// --- Tiempos (ms) ----------------------------------------------
export const POLLING_INTERVALO_MS = 20_000;  // respaldo si Realtime se cae
export const DEMO_TICK_MS = 25_000;          // eventos simulados en demo
export const TOAST_DURACION_MS = 4_200;
export const COUNTUP_DURACION_MS = 900;
export const REFRESCO_BAHIAS_MS = 30_000;    // avance de barras de progreso

export const NUM_BAHIAS = 4;

// --- Catálogo de estados ---------------------------------------
// Flujo: pendiente → confirmada → en_proceso → listo → completada
// Ramas terminales: cancelada, no_show.
export const ESTADOS = Object.freeze({
  pendiente:  { etiqueta: 'Pendiente',  icono: '⏳' },
  confirmada: { etiqueta: 'Confirmada', icono: '📋' },
  en_proceso: { etiqueta: 'En proceso', icono: '🧽' },
  listo:      { etiqueta: 'Listo',      icono: '🚗✨' },
  completada: { etiqueta: 'Completada', icono: '✅' },
  cancelada:  { etiqueta: 'Cancelada',  icono: '✖️' },
  no_show:    { etiqueta: 'No vino',    icono: '👻' },
});

export const SIGUIENTE_ESTADO = Object.freeze({
  pendiente: 'confirmada',
  confirmada: 'en_proceso',
  en_proceso: 'listo',
  listo: 'completada',
});

export const ESTADOS_SIN_INGRESO = Object.freeze(['cancelada', 'no_show']);
export const ESTADOS_FINALES = Object.freeze(['completada', 'cancelada', 'no_show']);

// Acciones disponibles para el staff según el estado actual.
export const ACCIONES_POR_ESTADO = Object.freeze({
  pendiente: [
    { accion: 'confirmar', etiqueta: 'Confirmar', icono: '✅', clase: 'btn-confirmar', destino: 'confirmada' },
    { accion: 'cancelar', etiqueta: 'Cancelar', icono: '✖', clase: 'btn-cancelar', destino: 'cancelada' },
  ],
  confirmada: [
    { accion: 'iniciar', etiqueta: 'Iniciar lavado', icono: '🧽', clase: 'btn-iniciar', destino: 'en_proceso' },
    { accion: 'cancelar', etiqueta: 'Cancelar', icono: '✖', clase: 'btn-cancelar', destino: 'cancelada' },
  ],
  en_proceso: [
    // El botón MÁS importante: dispara el aviso de WhatsApp al cliente.
    { accion: 'listo', etiqueta: 'Listo', icono: '🚗✨', clase: 'btn-listo', destino: 'listo' },
  ],
  listo: [
    { accion: 'completar', etiqueta: 'Completar', icono: '✔', clase: 'btn-completar', destino: 'completada' },
  ],
  completada: [],
  cancelada: [],
  no_show: [],
});

// --- Catálogo de servicios (precio por tipo de vehículo, S/) ---
export const SERVICIOS = Object.freeze({
  basico: {
    etiqueta: 'Básico',
    duracionMin: 35,
    precios: { auto: 25, suv: 30, camioneta: 35, moto: 15 },
  },
  premium: {
    etiqueta: 'Premium',
    duracionMin: 70,
    precios: { auto: 50, suv: 60, camioneta: 70, moto: 35 },
  },
  detailing: {
    etiqueta: 'Detailing',
    duracionMin: 140,
    precios: { auto: 120, suv: 150, camioneta: 180, moto: 80 },
  },
});

export const TIPOS_VEHICULO = Object.freeze({
  auto: { etiqueta: 'Auto', icono: '🚗' },
  suv: { etiqueta: 'SUV', icono: '🚙' },
  camioneta: { etiqueta: 'Camioneta', icono: '🚘' },
  pickup: { etiqueta: 'Pick Up', icono: '🛻' },
  moto: { etiqueta: 'Moto', icono: '🏍️' },
});

// Colores para los gráficos canvas (coinciden con tokens.css).
export const COLORES_ESTADO = Object.freeze({
  pendiente: '#E8960C',
  confirmada: '#F5A300',
  en_proceso: '#D0480B',
  listo: '#8FC10D',
  completada: '#19A97B',
  cancelada: '#F45B69',
  no_show: '#8A99AB',
});

// ============================================================
// Bandeja (WhatsApp Web) — conversaciones
// ============================================================

export const CHAT_LOTE_MENSAJES = 30;                 // mensajes por lote (scroll atrás)
export const VENTANA_24H_MS = 24 * 60 * 60 * 1000;    // ventana de texto libre de Meta
export const BANDEJA_POLLING_MS = 20_000;             // respaldo de la LISTA si Realtime se cae
export const BANDEJA_REFRESCO_ACTIVO_MS = 5_000;      // respaldo del CHAT ABIERTO (near-live)
export const BANDEJA_TICK_DEMO_MS = 22_000;           // mensajes simulados en demo
export const MENSAJE_MAX_LARGO = 4096;                // límite de Meta para texto

// Roles de una conversación: quién habla y de qué lado/color va la burbuja.
// cliente → burbuja blanca a la izquierda; bot y staff → burbuja verde a la
// derecha, diferenciados solo por la etiqueta (mismo lado, como WhatsApp Web).
export const ROLES_CHAT = Object.freeze({
  cliente: { etiqueta: 'Cliente', lado: 'izquierda', clase: 'entrante', mini: '' },
  bot: { etiqueta: 'Bot', lado: 'derecha', clase: 'saliente', mini: '🤖 Bot' },
  staff: { etiqueta: 'Tú', lado: 'derecha', clase: 'saliente', mini: '👤 Tú' },
});

// ============================================================
// Clientes — catálogo de etiquetas (espeja el seed de la migración 18;
// se guarda en el front para colorear sin una consulta extra).
// ============================================================
export const TAGS_CATALOGO = Object.freeze({
  vip: { label: 'VIP', color: '#F5A300' },
  frecuente: { label: 'Frecuente', color: '#19A97B' },
  ceramico: { label: 'Cerámico', color: '#0077B6' },
  moroso: { label: 'Moroso', color: '#F45B69' },
  dormido: { label: 'Dormido', color: '#8A99AB' },
});
export const CLIENTE_DORMIDO_DIAS = 30; // sin visita hace +30 días

// ============================================================
// Métricas — colores de los gráficos canvas (no leen tokens CSS).
// ============================================================
export const COLORES_METRICA = Object.freeze({
  escribieron: '#8A99AB',
  conversaron: '#F5A300',
  agendaron: '#0077B6',
  confirmaron: '#E8960C',
  completaron: '#19A97B',
  conversaciones: '#0077B6',
  citas: '#F5A300',
  ingresos: '#19A97B',
});
