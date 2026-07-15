// ============================================================
// Jaguar Carwash — Agenda: render (semana tipo Google Calendar + día).
// SEGURIDAD: todo dato de cliente pasa por esc().
// Reutiliza COLORES_ESTADO / ACCIONES_POR_ESTADO / ejecutarAccion (data-accion).
// ============================================================

import { esc, formatearSoles } from '../render.js';
import {
  SERVICIOS,
  TIPOS_VEHICULO,
  COLORES_ESTADO,
  ESTADOS,
  ACCIONES_POR_ESTADO,
} from '../config.js';
import {
  HORA_INICIO,
  HORA_FIN,
  ALTO_HORA,
  DIAS,
  citasDelDia,
  posicion,
  esLargo,
  ocupacionDia,
  sumarDias,
  inicioDia,
} from './data.js';

const fmtHora = new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false });
const fmtDiaMes = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short' });
const fmtDiaLargo = new Intl.DateTimeFormat('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });

const esHoy = (fecha) => inicioDia(fecha) === inicioDia(new Date());

function bloqueCita(c) {
  const { top, alto } = posicion(c);
  const color = COLORES_ESTADO[c.estado] ?? '#8A99AB';
  const serv = SERVICIOS[c.servicio]?.etiqueta ?? c.servicio;
  const compacto = alto < 44 ? ' compacto' : '';
  return `<button type="button" class="ag-bloque${compacto}" data-cita="${esc(c.id)}" style="top:${top}px;height:${alto}px;--c:${color}">
    <span class="ag-bloque-hora">${esc(fmtHora.format(new Date(c.fecha_hora)))}</span>
    <span class="ag-bloque-cli">${esc(c.cliente)}</span>
    <span class="ag-bloque-serv">${esc(serv)}</span>
  </button>`;
}

function colAllDay(citas, dia) {
  const largas = citasDelDia(citas, dia).filter(esLargo);
  return largas
    .map((c) => {
      const color = COLORES_ESTADO[c.estado] ?? '#8A99AB';
      const serv = SERVICIOS[c.servicio]?.etiqueta ?? c.servicio;
      return `<button type="button" class="ag-allday-bloque" data-cita="${esc(c.id)}" style="--c:${color}">${esc(c.cliente)} · ${esc(serv)}</button>`;
    })
    .join('');
}

function gutterHoras() {
  let h = '';
  for (let hora = HORA_INICIO; hora <= HORA_FIN; hora += 1) {
    h += `<span class="ag-hora-label" style="top:${(hora - HORA_INICIO) * ALTO_HORA}px">${hora}:00</span>`;
  }
  return h;
}

function columnaDia(citas, dia) {
  const timed = citasDelDia(citas, dia).filter((c) => !esLargo(c));
  const oc = ocupacionDia(citas, dia);
  const lineas = Array.from(
    { length: HORA_FIN - HORA_INICIO },
    (_, i) => `<div class="ag-linea" style="top:${(i + 1) * ALTO_HORA}px"></div>`
  ).join('');
  return `<div class="ag-col" data-ocupacion="${oc.pct}">${lineas}${timed.map(bloqueCita).join('')}</div>`;
}

// ------------------------------------------------------------
// Vista SEMANA
// ------------------------------------------------------------
export function renderSemana(citas, semanaInicio) {
  const dias = Array.from({ length: 6 }, (_, i) => sumarDias(semanaInicio, i));
  const altoBody = (HORA_FIN - HORA_INICIO) * ALTO_HORA;

  const cabecera = dias
    .map((d, i) => {
      const oc = ocupacionDia(citas, d);
      return `<div class="ag-dia-cabecera${esHoy(d) ? ' hoy' : ''}">
        <span class="ag-dia-nombre">${DIAS[i]}</span>
        <span class="ag-dia-fecha">${esc(fmtDiaMes.format(d))}</span>
        <span class="ag-ocupacion" title="Ocupación: ${oc.horas.toFixed(1)}h de ${oc.capacidad}h">
          <span class="ag-ocupacion-barra" style="width:${oc.pct}%"></span>
        </span>
        <span class="ag-ocupacion-txt">${oc.pct}%</span>
      </div>`;
    })
    .join('');

  const allday = dias.map((d) => `<div class="ag-allday-col">${colAllDay(citas, d)}</div>`).join('');
  const hayAllday = dias.some((d) => citasDelDia(citas, d).some(esLargo));
  const cols = dias.map((d) => columnaDia(citas, d)).join('');

  return `
    <div class="ag-grid">
      <div class="ag-esquina"></div>
      ${cabecera}
    </div>
    ${hayAllday ? `<div class="ag-grid ag-allday"><div class="ag-allday-lbl">Todo el día</div>${allday}</div>` : ''}
    <div class="ag-grid ag-cuerpo">
      <div class="ag-gutter" style="height:${altoBody}px">${gutterHoras()}</div>
      ${cols}
    </div>`;
}

// ------------------------------------------------------------
// Vista DÍA (móvil)
// ------------------------------------------------------------
export function renderDia(citas, dia) {
  const altoBody = (HORA_FIN - HORA_INICIO) * ALTO_HORA;
  const largas = citasDelDia(citas, dia).filter(esLargo);
  const oc = ocupacionDia(citas, dia);
  return `
    <div class="ag-dia-solo">
      <div class="ag-dia-cabecera grande${esHoy(dia) ? ' hoy' : ''}">
        <span class="ag-dia-nombre">${esc(fmtDiaLargo.format(dia))}</span>
        <span class="ag-ocupacion-txt">Ocupación ${oc.pct}% · ${oc.horas.toFixed(1)}/${oc.capacidad}h</span>
      </div>
      ${largas.length ? `<div class="ag-allday-dia">${colAllDay(citas, dia)}</div>` : ''}
      <div class="ag-grid ag-cuerpo dia">
        <div class="ag-gutter" style="height:${altoBody}px">${gutterHoras()}</div>
        ${columnaDia(citas, dia)}
      </div>
    </div>`;
}

// ------------------------------------------------------------
// Popover de detalle (con acciones que reusan data-accion)
// ------------------------------------------------------------
export function renderPopover(cita) {
  const pop = document.getElementById('agenda-pop');
  if (!pop || !cita) return;
  const tipo = TIPOS_VEHICULO[cita.tipo_vehiculo] ?? { etiqueta: cita.tipo_vehiculo, icono: '🚗' };
  const serv = SERVICIOS[cita.servicio]?.etiqueta ?? cita.servicio;
  const est = ESTADOS[cita.estado] ?? { etiqueta: cita.estado, icono: '•' };
  const acciones = (ACCIONES_POR_ESTADO[cita.estado] ?? [])
    .map(
      (a) =>
        `<button type="button" class="btn-accion ${a.clase}" data-accion="${a.accion}" data-id="${esc(cita.id)}"><span aria-hidden="true">${a.icono}</span>${esc(a.etiqueta)}</button>`
    )
    .join('');
  pop.innerHTML = `
    <button type="button" class="ag-pop-cerrar" data-pop-cerrar aria-label="Cerrar">✕</button>
    <p class="ag-pop-hora">${esc(fmtHora.format(new Date(cita.fecha_hora)))} · <span class="badge estado-${esc(cita.estado)}">${est.icono} ${esc(est.etiqueta)}</span></p>
    <p class="ag-pop-cli"><strong>${esc(cita.cliente)}</strong></p>
    <p class="ag-pop-meta">${tipo.icono} ${esc(cita.placa || tipo.etiqueta)} · ${esc(serv)} · ${esc(formatearSoles(cita.precio))}</p>
    ${cita.notas ? `<p class="ag-pop-notas">📝 ${esc(cita.notas)}</p>` : ''}
    ${acciones ? `<div class="ag-pop-acciones">${acciones}</div>` : ''}`;
  pop.hidden = false;
}

export function cerrarPopover() {
  const pop = document.getElementById('agenda-pop');
  if (pop) pop.hidden = true;
}
