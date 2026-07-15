// ============================================================
// Jaguar Carwash — Agenda: controlador. Lee las citas del store COMPARTIDO
// (js/data.js) — cero consultas nuevas. Semana/día, navegación y popover.
// Las acciones de estado reusan ejecutarAccion (delegación global data-accion).
// ============================================================

import { obtenerEstado, suscribir, buscarCita } from '../data.js';
import * as render from './render.js';
import { lunesDe, sumarDias } from './data.js';

const $ = (id) => document.getElementById(id);
const fmtRango = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short' });
const fmtDia = new Intl.DateTimeFormat('es-PE', { weekday: 'short', day: 'numeric', month: 'short' });

let iniciado = false;
let eventosListos = false;
let desuscribir = null;

let vista = 'semana';
let semanaInicio = lunesDe(new Date());
let diaActivo = new Date();
diaActivo.setHours(0, 0, 0, 0);

const citas = () => obtenerEstado().citas ?? [];

function pintar() {
  const cont = $('agenda-vista');
  if (!cont) return;
  cont.innerHTML =
    vista === 'dia' ? render.renderDia(citas(), diaActivo) : render.renderSemana(citas(), semanaInicio);
  actualizarNav();
  render.cerrarPopover();
}

function actualizarNav() {
  const rango = $('agenda-rango');
  if (rango) {
    rango.textContent =
      vista === 'dia'
        ? fmtDia.format(diaActivo)
        : `${fmtRango.format(semanaInicio)} – ${fmtRango.format(sumarDias(semanaInicio, 5))}`;
  }
  document.querySelectorAll('#agenda-nav [data-vista]').forEach((b) => {
    b.classList.toggle('activo', b.dataset.vista === vista);
  });
}

function navegar(dir) {
  if (dir === 'hoy') {
    semanaInicio = lunesDe(new Date());
    diaActivo = new Date();
    diaActivo.setHours(0, 0, 0, 0);
  } else {
    const paso = dir === 'next' ? 1 : -1;
    if (vista === 'dia') diaActivo = sumarDias(diaActivo, paso);
    else semanaInicio = sumarDias(semanaInicio, paso * 7);
  }
  pintar();
}

function abrirPop(id, ev) {
  const cita = buscarCita(id);
  if (!cita) return;
  render.renderPopover(cita);
  const pop = $('agenda-pop');
  if (!pop) return;
  const x = Math.min(ev.clientX, window.innerWidth - pop.offsetWidth - 12);
  const y = Math.min(ev.clientY, window.innerHeight - pop.offsetHeight - 12);
  pop.style.left = `${Math.max(12, x)}px`;
  pop.style.top = `${Math.max(12, y)}px`;
}

function conectarEventos() {
  if (eventosListos) return;
  eventosListos = true;

  $('agenda-nav').addEventListener('click', (e) => {
    const nav = e.target.closest('[data-nav]');
    if (nav) { navegar(nav.dataset.nav); return; }
    const v = e.target.closest('[data-vista]');
    if (v) { vista = v.dataset.vista; pintar(); }
  });

  $('agenda-vista').addEventListener('click', (e) => {
    const bloque = e.target.closest('[data-cita]');
    if (bloque) abrirPop(bloque.dataset.cita, e);
  });

  // Popover: cerrar o (tras una acción) también cerrar. ejecutarAccion lo maneja
  // el listener global de actions.js (data-accion/data-id).
  $('agenda-pop').addEventListener('click', (e) => {
    if (e.target.closest('[data-pop-cerrar]') || e.target.closest('[data-accion]')) {
      render.cerrarPopover();
    }
  });

  // Cerrar el popover al hacer clic fuera / Escape.
  document.addEventListener('click', (e) => {
    const pop = $('agenda-pop');
    if (!pop || pop.hidden) return;
    if (!e.target.closest('#agenda-pop') && !e.target.closest('[data-cita]')) {
      render.cerrarPopover();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') render.cerrarPopover();
  });
}

export function init() {
  conectarEventos();
  if (iniciado) return;
  iniciado = true;
  // Móvil arranca en vista de día (la semana de 6 columnas no cabe cómoda).
  if (window.innerWidth < 768) vista = 'dia';
  desuscribir = suscribir(() => pintar()); // re-render al cambiar las citas
  pintar();
}

export function onMostrar() {
  pintar();
}

export function detener() {
  if (desuscribir) desuscribir();
  desuscribir = null;
  iniciado = false;
}
