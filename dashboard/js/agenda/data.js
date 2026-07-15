// ============================================================
// Jaguar Carwash — Agenda: helpers puros (sin estado global propio).
//
// EFICIENCIA: la Agenda NO consulta la BD. Reutiliza las citas que el store de
// Citas (js/data.js) ya cargó al arrancar. Aquí solo hay cálculo de posiciones
// y ocupación. El controlador lee obtenerEstado().citas del store compartido.
// ============================================================

import { SERVICIOS, NUM_BAHIAS } from '../config.js';

export const HORA_INICIO = 8;
export const HORA_FIN = 18;
export const ALTO_HORA = 48; // px por hora → grid de 480px (8:00–18:00)
export const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const DIA_MS = 86_400_000;
const OCULTAS = ['cancelada', 'no_show'];

export function inicioDia(fecha) {
  const d = new Date(fecha);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Lunes (00:00) de la semana que contiene `fecha`. */
export function lunesDe(fecha) {
  const d = new Date(fecha);
  d.setHours(0, 0, 0, 0);
  const dow = (d.getDay() + 6) % 7; // 0 = lunes
  d.setDate(d.getDate() - dow);
  return d;
}

export const sumarDias = (fecha, n) => new Date(inicioDia(fecha) + n * DIA_MS);

export const duracion = (c) =>
  Number(c.duracion_min) || SERVICIOS[c.servicio]?.duracionMin || 60;

// Servicio largo (cerámico/salón, ≥4 h) → va en la franja "Todo el día".
export const esLargo = (c) => duracion(c) >= 240;

const visibles = (citas) => citas.filter((c) => !OCULTAS.includes(c.estado));

export function citasDelDia(citas, fecha) {
  const d0 = inicioDia(fecha);
  return visibles(citas).filter((c) => inicioDia(c.fecha_hora) === d0);
}

/** top/alto (px) de un bloque según su hora de inicio y duración. */
export function posicion(cita) {
  const ini = new Date(cita.fecha_hora);
  const minDesde = (ini.getHours() - HORA_INICIO) * 60 + ini.getMinutes();
  const top = (Math.max(0, minDesde) / 60) * ALTO_HORA;
  const alto = Math.max(22, (duracion(cita) / 60) * ALTO_HORA);
  return { top, alto };
}

/** Ocupación del día: bahía-horas usadas / (bahías × horas de jornada). */
export function ocupacionDia(citas, fecha) {
  const timed = citasDelDia(citas, fecha).filter((c) => !esLargo(c));
  const horas = timed.reduce((s, c) => s + duracion(c), 0) / 60;
  const capacidad = NUM_BAHIAS * (HORA_FIN - HORA_INICIO); // 4 × 10 = 40
  return { horas, capacidad, pct: Math.min(100, Math.round((horas / capacidad) * 100)) };
}
