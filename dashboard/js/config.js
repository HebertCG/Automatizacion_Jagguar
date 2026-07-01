// ============================================================
// Jaguar Carwash — Configuración global
// Este es el ÚNICO archivo que se edita al pasar de demo a producción.
// ============================================================

/**
 * MODO DEMO:
 *  true  → todo funciona con datos de muestra locales y el
 *          "tiempo real" se simula (no necesita backend).
 *  false → Supabase real: Auth + vista v_citas + Realtime + polling.
 */
export const MODO_DEMO = true;

// --- Supabase (solo aplica con MODO_DEMO = false) -------------
// Usa SIEMPRE la clave publicable (anon/publishable).
// ⚠️ NUNCA coloques aquí una service_role key: este código corre
// en el navegador del staff y esa clave daría acceso total a la BD.
export const SUPABASE_URL = 'https://TU-PROYECTO.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_REEMPLAZAR';

export const VISTA_CITAS = 'v_citas';   // vista de solo lectura
export const TABLA_CITAS = 'citas';     // tabla real (updates + realtime)

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
  camioneta: { etiqueta: 'Camioneta', icono: '🛻' },
  moto: { etiqueta: 'Moto', icono: '🏍️' },
});

// Colores para los gráficos canvas (coinciden con tokens.css).
export const COLORES_ESTADO = Object.freeze({
  pendiente: '#E8960C',
  confirmada: '#00B4D8',
  en_proceso: '#0077B6',
  listo: '#8FC10D',
  completada: '#19A97B',
  cancelada: '#F45B69',
  no_show: '#8A99AB',
});
