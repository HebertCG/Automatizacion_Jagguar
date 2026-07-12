// ============================================================
// Jaguar Carwash — Router por hash (#/citas, #/bandeja, …)
//
// Se usa hash (no History API) porque nginx sirve estáticos con
// try_files … =404: un path router haría 404 al recargar. El hash
// nunca llega al servidor, es deep-linkable y no necesita reescritura.
//
// Init perezoso "medido tras mostrar": cada sección se importa al
// abrirse por primera vez y su init() corre en un requestAnimationFrame
// YA visible, para que los <canvas> midan clientWidth real. En reentradas
// se llama onMostrar() (redibujar al rotar/redimensionar).
// ============================================================

import { movimientoReducido } from './ui.js';

let rutas = [];
const inicializados = new Set();       // ids ya arrancados (init() corrido)
const modulos = new Map();             // id → namespace del módulo importado
let rutaActual = null;
let arrancado = false;                 // ¿ya resolvimos al menos una vez?
let pendiente = null;                  // { id, fn } a correr tras cargar la sección

const rutaPorHash = (hash) =>
  rutas.find((r) => r.hash === hash) ?? rutas[0];

/**
 * Arranca el router. `defs`: [{ id, hash, cargar? }].
 * Las secciones sin `cargar` (Citas) se asumen ya inicializadas por app.js.
 */
export function iniciarRouter(defs) {
  rutas = defs;
  window.addEventListener('hashchange', resolver);
  resolver();
}

/**
 * Navega a `hash`. `luego(modulo)` se ejecuta una vez la sección está
 * visible e inicializada (p. ej. Clientes → abrir un chat en Bandeja).
 */
export function irA(hash, { luego } = {}) {
  const ruta = rutas.find((r) => r.hash === hash);
  if (!ruta) return;
  if (luego) pendiente = { id: ruta.id, fn: luego };

  if (location.hash === hash || (!location.hash && ruta === rutas[0])) {
    resolver(); // mismo hash: no dispara hashchange, resolvemos a mano
  } else {
    location.hash = hash;
  }
}

/** Detiene (unsubscribe realtime, timers) todas las secciones cargadas. */
export function detenerSecciones() {
  modulos.forEach((mod) => {
    try {
      mod.detener?.();
    } catch (err) {
      console.error('[router] Error al detener sección:', err);
    }
  });
}

/** Módulo de la sección visible (para resize → onMostrar desde app.js). */
export const moduloActivo = () => modulos.get(rutaActual) ?? null;

// ------------------------------------------------------------
// Internos
// ------------------------------------------------------------
async function resolver() {
  const ruta = rutaPorHash(location.hash);
  mostrarSeccion(ruta.id, arrancado); // en el primer resolve no robamos foco
  actualizarNav(ruta.id);
  rutaActual = ruta.id;
  arrancado = true;
  await activar(ruta);
}

function mostrarSeccion(id, moverFoco) {
  document.querySelectorAll('.seccion').forEach((sec) => {
    sec.hidden = sec.id !== `seccion-${id}`;
  });

  if (!moverFoco) return;
  // Enfocar el contenedor de la sección (con aria-label) da contexto al
  // lector de pantalla sin depender de la estructura de encabezados.
  const activa = document.getElementById(`seccion-${id}`);
  if (activa) {
    activa.setAttribute('tabindex', '-1');
    activa.focus({ preventScroll: true });
  }
  window.scrollTo({ top: 0, behavior: movimientoReducido() ? 'auto' : 'smooth' });
}

function actualizarNav(id) {
  document.querySelectorAll('.nav-secciones a[data-seccion]').forEach((a) => {
    const activo = a.dataset.seccion === id;
    a.classList.toggle('activo', activo);
    if (activo) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

async function activar(ruta) {
  // Sección con carga perezosa aún no inicializada.
  if (ruta.cargar && !inicializados.has(ruta.id)) {
    inicializados.add(ruta.id); // marca antes del await: evita doble carga
    let mod;
    try {
      mod = await ruta.cargar();
    } catch (err) {
      console.error('[router] No se pudo cargar la sección', ruta.id, err);
      inicializados.delete(ruta.id);
      return;
    }
    modulos.set(ruta.id, mod);
    // init() ya visible → los canvas miden bien; luego corre lo pendiente.
    requestAnimationFrame(() => {
      try {
        mod.init?.();
      } catch (err) {
        console.error('[router] Error en init de', ruta.id, err);
      }
      ejecutarPendiente(ruta.id, mod);
    });
    return;
  }

  // Sección ya inicializada (o Citas, sin módulo): notificar y correr pendiente.
  const mod = modulos.get(ruta.id) ?? null;
  if (mod?.onMostrar) requestAnimationFrame(() => mod.onMostrar());
  ejecutarPendiente(ruta.id, mod);
}

function ejecutarPendiente(id, mod) {
  if (!pendiente || pendiente.id !== id) return;
  const { fn } = pendiente;
  pendiente = null;
  try {
    fn(mod);
  } catch (err) {
    console.error('[router] Error en acción pendiente de', id, err);
  }
}
