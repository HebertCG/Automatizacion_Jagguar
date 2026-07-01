// ============================================================
// Jaguar Carwash — Render: tabla, cards móviles, KPIs, chips,
// bahías y gráficos en canvas puro (dona + barras).
//
// SEGURIDAD: todo dato dinámico pasa por esc() antes de tocar
// innerHTML. Nombre, notas, placa y teléfono vienen de clientes
// (bot de WhatsApp) y se tratan SIEMPRE como texto hostil.
// ============================================================

import {
  ESTADOS,
  ACCIONES_POR_ESTADO,
  SERVICIOS,
  TIPOS_VEHICULO,
  COLORES_ESTADO,
} from './config.js';
import { esHoy } from './data.js';

// ------------------------------------------------------------
// Escape anti-XSS y formateadores
// ------------------------------------------------------------
export function esc(valor) {
  return String(valor ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const fmtHora = new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true });
const fmtFecha = new Intl.DateTimeFormat('es-PE', { weekday: 'short', day: '2-digit', month: 'short' });
const fmtSoles = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
  maximumFractionDigits: 0,
});

export const formatearSoles = (n) => fmtSoles.format(n);

// ------------------------------------------------------------
// Fragmentos reutilizables
// ------------------------------------------------------------
function htmlBadge(estadoCita) {
  const info = ESTADOS[estadoCita] ?? { etiqueta: estadoCita, icono: '•' };
  return `<span class="badge estado-${esc(estadoCita)}"><span aria-hidden="true">${info.icono}</span>${esc(info.etiqueta)}</span>`;
}

function htmlAcciones(cita) {
  const acciones = ACCIONES_POR_ESTADO[cita.estado] ?? [];
  if (acciones.length === 0) return '<span class="acciones-fila"></span>';
  const botones = acciones
    .map(
      (a) =>
        `<button type="button" class="btn-accion ${a.clase}" data-accion="${a.accion}" data-id="${esc(cita.id)}" aria-label="${esc(a.etiqueta)} — ${esc(cita.cliente)}"><span aria-hidden="true">${a.icono}</span>${esc(a.etiqueta)}</button>`
    )
    .join('');
  return `<span class="acciones-fila">${botones}</span>`;
}

function htmlHora(cita) {
  const fecha = new Date(cita.fecha_hora);
  const hora = fmtHora.format(fecha);
  const sufijo = esHoy(cita.fecha_hora)
    ? ''
    : `<span class="celda-fecha">${esc(fmtFecha.format(fecha))}</span>`;
  return `${esc(hora)}${sufijo}`;
}

// ------------------------------------------------------------
// Tabla (escritorio) + cards (móvil)
// ------------------------------------------------------------
function filaTabla(cita) {
  const tipo = TIPOS_VEHICULO[cita.tipo_vehiculo] ?? { etiqueta: cita.tipo_vehiculo, icono: '🚗' };
  const servicio = SERVICIOS[cita.servicio]?.etiqueta ?? cita.servicio;
  const nota = cita.notas
    ? ` <span class="nota-indicador" title="${esc(cita.notas)}" aria-label="Nota: ${esc(cita.notas)}">📝</span>`
    : '';
  return `<tr data-id="${esc(cita.id)}">
    <td class="celda-hora">${htmlHora(cita)}</td>
    <td class="celda-cliente"><strong>${esc(cita.cliente)}${nota}</strong><span class="celda-telefono">${esc(cita.telefono)}</span></td>
    <td><span class="placa">${esc(cita.placa)}</span></td>
    <td>${tipo.icono} ${esc(tipo.etiqueta)}</td>
    <td>${esc(servicio)} · ${esc(formatearSoles(cita.precio))}</td>
    <td>${cita.bahia ? `B${esc(cita.bahia)}` : '—'}</td>
    <td>${htmlBadge(cita.estado)}</td>
    <td>${htmlAcciones(cita)}</td>
  </tr>`;
}

function cardMovil(cita) {
  const tipo = TIPOS_VEHICULO[cita.tipo_vehiculo] ?? { etiqueta: cita.tipo_vehiculo, icono: '🚗' };
  const servicio = SERVICIOS[cita.servicio]?.etiqueta ?? cita.servicio;
  const notas = cita.notas ? `<span class="cita-card-notas">📝 ${esc(cita.notas)}</span>` : '';
  const bahia = cita.bahia ? ` · Bahía ${esc(cita.bahia)}` : '';
  return `<article class="cita-card" data-id="${esc(cita.id)}">
    <header class="cita-card-cabecera">
      <span class="celda-hora">${htmlHora(cita)}</span>
      ${htmlBadge(cita.estado)}
    </header>
    <div class="cita-card-cuerpo">
      <strong>${esc(cita.cliente)}</strong>
      <span class="cita-card-meta"><span class="placa">${esc(cita.placa)}</span> · ${tipo.icono} ${esc(tipo.etiqueta)}</span>
      <span class="cita-card-meta">${esc(servicio)} · ${esc(formatearSoles(cita.precio))}${bahia}</span>
      ${notas}
    </div>
    <footer class="cita-card-acciones">${htmlAcciones(cita)}</footer>
  </article>`;
}

/**
 * Pinta la tabla y las cards con la misma data.
 * `animar` aplica entrada escalonada (solo al cambiar filtro/búsqueda).
 */
export function renderTabla(citas, { animar = false } = {}) {
  const cuerpo = document.getElementById('cuerpo-citas');
  const lista = document.getElementById('lista-citas');
  const vacio = document.getElementById('estado-vacio');
  const envoltura = document.getElementById('tabla-envoltura');
  if (!cuerpo || !lista) return;

  const hayCitas = citas.length > 0;
  vacio.hidden = hayCitas;
  envoltura.hidden = !hayCitas;
  lista.hidden = !hayCitas;

  // HTML construido SOLO con valores escapados (ver esc()).
  cuerpo.innerHTML = citas.map(filaTabla).join('');
  lista.innerHTML = citas.map(cardMovil).join('');

  if (animar) {
    cuerpo.classList.remove('animar-filas');
    void cuerpo.offsetWidth;
    [...cuerpo.children].forEach((tr, i) => tr.style.setProperty('--orden', Math.min(i, 12)));
    cuerpo.classList.add('animar-filas');
  } else {
    cuerpo.classList.remove('animar-filas');
  }
}

// ------------------------------------------------------------
// Chips con conteo en vivo
// ------------------------------------------------------------
export function renderChips(conteos, filtroActivo) {
  document.querySelectorAll('#chips-filtro .chip').forEach((chip) => {
    const filtro = chip.dataset.filtro;
    chip.classList.toggle('activo', filtro === filtroActivo);
    chip.setAttribute('aria-pressed', String(filtro === filtroActivo));
    const conteo = chip.querySelector('.chip-conteo');
    if (conteo) conteo.textContent = String(conteos[filtro] ?? 0);
  });
}

// ------------------------------------------------------------
// Bahías
// ------------------------------------------------------------
export function renderBahias(bahias) {
  const grid = document.getElementById('grid-bahias');
  if (!grid) return;

  grid.innerHTML = bahias
    .map((b) => {
      if (!b.cita) {
        return `<article class="bahia" aria-label="Bahía ${b.numero} libre">
          <header class="bahia-cabecera"><span class="bahia-nombre">Bahía ${b.numero}</span><span class="bahia-etiqueta libre">Libre</span></header>
          <p class="bahia-detalle">Disponible para el siguiente lavado</p>
          <div class="progreso" aria-hidden="true"><div class="progreso-barra" style="--p:0"></div></div>
        </article>`;
      }
      const tipo = TIPOS_VEHICULO[b.cita.tipo_vehiculo] ?? { icono: '🚗' };
      const servicio = SERVICIOS[b.cita.servicio]?.etiqueta ?? b.cita.servicio;
      const pct = Math.round(b.progreso * 100);
      return `<article class="bahia ocupada" aria-label="Bahía ${b.numero} ocupada">
        <header class="bahia-cabecera"><span class="bahia-nombre">Bahía ${b.numero}</span><span class="bahia-etiqueta ocupada">Ocupada</span></header>
        <p class="bahia-vehiculo">${tipo.icono} ${esc(b.cita.placa)} · ${esc(b.cita.cliente)}</p>
        <p class="bahia-detalle">${esc(servicio)} · quedan ~${b.restanteMin} min</p>
        <div class="progreso" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Avance del servicio">
          <div class="progreso-barra" style="--p:${b.progreso.toFixed(3)}"></div>
        </div>
      </article>`;
    })
    .join('');
}

// ------------------------------------------------------------
// Gráficos en canvas puro
// ------------------------------------------------------------
function prepararCanvas(canvas, alto) {
  const dpr = window.devicePixelRatio || 1;
  const ancho = canvas.clientWidth || canvas.parentElement.clientWidth || 200;
  canvas.width = Math.round(ancho * dpr);
  canvas.height = Math.round(alto * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, ancho, alto);
  return { ctx, ancho, alto };
}

/** Dona de citas por estado + leyenda HTML. */
export function renderDona(conteoPorEstado) {
  const canvas = document.getElementById('grafico-dona');
  const leyenda = document.getElementById('leyenda-dona');
  if (!canvas || !leyenda) return;

  const series = Object.entries(conteoPorEstado)
    .filter(([, v]) => v > 0)
    .map(([estadoCita, valor]) => ({
      estado: estadoCita,
      valor,
      color: COLORES_ESTADO[estadoCita] ?? '#8A99AB',
    }));
  const total = series.reduce((s, x) => s + x.valor, 0);

  const lado = canvas.clientWidth || 150;
  const { ctx } = prepararCanvas(canvas, lado);
  const centro = lado / 2;
  const radio = centro - 12;
  const grosor = Math.max(radio * 0.24, 12);
  const separacion = series.length > 1 ? 0.05 : 0;

  ctx.lineWidth = grosor;
  ctx.lineCap = 'butt';

  if (total === 0) {
    ctx.strokeStyle = 'rgba(14,27,44,0.08)';
    ctx.beginPath();
    ctx.arc(centro, centro, radio - grosor / 2, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    let angulo = -Math.PI / 2;
    series.forEach((s) => {
      const barrido = (s.valor / total) * Math.PI * 2;
      ctx.strokeStyle = s.color;
      ctx.beginPath();
      ctx.arc(centro, centro, radio - grosor / 2, angulo + separacion / 2, angulo + barrido - separacion / 2);
      ctx.stroke();
      angulo += barrido;
    });
  }

  // Centro: total de citas
  ctx.fillStyle = '#0E1B2C';
  ctx.font = `700 ${Math.round(lado * 0.2)}px 'Space Grotesk', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(total), centro, centro - 6);
  ctx.fillStyle = '#7C8DA1';
  ctx.font = `500 ${Math.round(lado * 0.08)}px Inter, sans-serif`;
  ctx.fillText('citas', centro, centro + Math.round(lado * 0.13));

  // Leyenda (HTML seguro: etiquetas provienen del catálogo interno)
  leyenda.innerHTML = series
    .map(
      (s) =>
        `<li><span class="leyenda-punto" style="background:${s.color}"></span>${esc(ESTADOS[s.estado]?.etiqueta ?? s.estado)}<span class="leyenda-valor">${s.valor}</span></li>`
    )
    .join('');
}

/** Barras: citas por día de la semana (Lun → Dom). */
export function renderBarras({ valores, hoyIndice }) {
  const canvas = document.getElementById('grafico-barras');
  if (!canvas) return;

  const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const alto = 130;
  const { ctx, ancho } = prepararCanvas(canvas, alto);
  const margenInferior = 22;
  const margenSuperior = 16;
  const zonaBarras = alto - margenInferior - margenSuperior;
  const maximo = Math.max(...valores, 1);
  const paso = ancho / 7;
  const anchoBarra = Math.min(paso * 0.5, 34);

  valores.forEach((valor, i) => {
    const x = paso * i + (paso - anchoBarra) / 2;
    const altura = Math.max((valor / maximo) * zonaBarras, valor > 0 ? 6 : 2);
    const y = alto - margenInferior - altura;
    const esHoyBarra = i === hoyIndice;

    if (esHoyBarra) {
      const grad = ctx.createLinearGradient(0, y, 0, y + altura);
      grad.addColorStop(0, '#00B4D8');
      grad.addColorStop(1, '#0077B6');
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = 'rgba(0, 119, 182, 0.18)';
    }

    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, anchoBarra, altura, [5, 5, 0, 0]);
    } else {
      ctx.rect(x, y, anchoBarra, altura);
    }
    ctx.fill();

    // Valor encima de la barra
    if (valor > 0) {
      ctx.fillStyle = esHoyBarra ? '#0077B6' : '#7C8DA1';
      ctx.font = "600 11px 'Space Grotesk', sans-serif";
      ctx.textAlign = 'center';
      ctx.fillText(String(valor), x + anchoBarra / 2, y - 5);
    }

    // Etiqueta del día
    ctx.fillStyle = esHoyBarra ? '#0E1B2C' : '#7C8DA1';
    ctx.font = `${esHoyBarra ? 700 : 400} 10px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(DIAS[i], x + anchoBarra / 2, alto - 7);
  });
}
