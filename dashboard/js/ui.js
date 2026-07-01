// ============================================================
// Jaguar Carwash — Utilidades de UI: toasts, modal de confirmación,
// count-up, resaltado de filas y helpers de movimiento.
// ============================================================

import { TOAST_DURACION_MS, COUNTUP_DURACION_MS } from './config.js';

/** ¿El usuario prefiere movimiento reducido? */
export function movimientoReducido() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Debounce clásico para inputs de búsqueda. */
export function debounce(fn, esperaMs) {
  let temporizador = null;
  return (...args) => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => fn(...args), esperaMs);
  };
}

// ------------------------------------------------------------
// Toasts
// ------------------------------------------------------------

/**
 * Muestra un toast. `tipo`: info | exito | listo | error.
 * Usa textContent → los datos del cliente jamás se interpretan como HTML.
 */
export function toast(mensaje, tipo = 'info') {
  const contenedor = document.getElementById('toasts');
  if (!contenedor) return;

  const el = document.createElement('div');
  el.className = `toast toast-${tipo}`;
  el.textContent = mensaje;
  contenedor.appendChild(el);

  requestAnimationFrame(() => el.classList.add('visible'));

  setTimeout(() => {
    el.classList.remove('visible');
    el.addEventListener('transitionend', () => el.remove(), { once: true });
    // Red de seguridad por si la transición no dispara (reduced motion).
    setTimeout(() => el.remove(), 700);
  }, TOAST_DURACION_MS);
}

// ------------------------------------------------------------
// Modal de confirmación (promesa que resuelve true/false)
// ------------------------------------------------------------
export function confirmar({ titulo, mensaje, textoOk = 'Sí, cancelar' }) {
  return new Promise((resolver) => {
    const modal = document.getElementById('modal');
    const elTitulo = document.getElementById('modal-titulo');
    const elMensaje = document.getElementById('modal-mensaje');
    const btnOk = document.getElementById('modal-ok');
    const btnVolver = document.getElementById('modal-volver');
    const fondo = modal.querySelector('[data-modal-cerrar]');

    elTitulo.textContent = titulo;
    elMensaje.textContent = mensaje; // textContent: anti-XSS
    btnOk.textContent = textoOk;

    const foco = document.activeElement;
    modal.hidden = false;
    btnVolver.focus();

    const cerrar = (valor) => {
      modal.hidden = true;
      btnOk.removeEventListener('click', alOk);
      btnVolver.removeEventListener('click', alVolver);
      fondo.removeEventListener('click', alVolver);
      document.removeEventListener('keydown', alTecla);
      if (foco && typeof foco.focus === 'function') foco.focus();
      resolver(valor);
    };

    const alOk = () => cerrar(true);
    const alVolver = () => cerrar(false);
    const alTecla = (e) => {
      if (e.key === 'Escape') cerrar(false);
    };

    btnOk.addEventListener('click', alOk);
    btnVolver.addEventListener('click', alVolver);
    fondo.addEventListener('click', alVolver);
    document.addEventListener('keydown', alTecla);
  });
}

// ------------------------------------------------------------
// Count-up animado para KPIs (transición numérica)
// ------------------------------------------------------------

/**
 * Anima el texto de `el` desde su valor previo (data-valor) hasta `hasta`.
 * `formatear` recibe el número redondeado y devuelve el texto final.
 */
export function contarHasta(el, hasta, formatear = String) {
  if (!el) return;
  const desde = Number(el.dataset.valor ?? 0);
  el.dataset.valor = String(hasta);

  if (movimientoReducido() || desde === hasta) {
    el.textContent = formatear(hasta);
    return;
  }

  const inicio = performance.now();
  const paso = (ahora) => {
    const progreso = Math.min((ahora - inicio) / COUNTUP_DURACION_MS, 1);
    const suavizado = 1 - Math.pow(1 - progreso, 3); // ease-out cúbico
    el.textContent = formatear(Math.round(desde + (hasta - desde) * suavizado));
    if (progreso < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

// ------------------------------------------------------------
// Resaltado de filas (pulse/glow al cambiar en tiempo real)
// ------------------------------------------------------------
export function resaltarFila(id) {
  if (movimientoReducido()) return;
  // La fila puede vivir en la tabla (escritorio) o en las cards (móvil).
  document.querySelectorAll(`[data-id="${CSS.escape(id)}"]`).forEach((el) => {
    el.classList.remove('flash');
    // Reinicia la animación si la fila ya estaba resaltada.
    void el.offsetWidth;
    el.classList.add('flash');
    el.addEventListener('animationend', () => el.classList.remove('flash'), { once: true });
  });
}

// ------------------------------------------------------------
// Skeleton / estados de carga
// ------------------------------------------------------------
export function mostrarSkeleton(visible) {
  const skeleton = document.getElementById('skeleton-citas');
  const tabla = document.getElementById('tabla-envoltura');
  const lista = document.getElementById('lista-citas');
  if (skeleton) skeleton.hidden = !visible;
  if (tabla) tabla.hidden = visible;
  if (lista) lista.hidden = visible;
}

/** Botón con estado de carga accesible. */
export function botonCargando(boton, cargando, textoNormal) {
  if (!boton) return;
  boton.disabled = cargando;
  boton.classList.toggle('cargando', cargando);
  boton.textContent = cargando ? 'Ingresando…' : textoNormal;
}
