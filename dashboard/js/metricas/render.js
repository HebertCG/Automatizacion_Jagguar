// ============================================================
// Jaguar Carwash — Métricas: render (canvas puro + HTML).
// Mismo enfoque que los gráficos de Citas. Sin dependencias.
// ============================================================

import { esc, formatearSoles } from '../render.js';
import { COLORES_METRICA } from '../config.js';

function prepararCanvas(canvas, alto) {
  const dpr = window.devicePixelRatio || 1;
  const ancho = canvas.clientWidth || canvas.parentElement.clientWidth || 300;
  canvas.width = Math.round(ancho * dpr);
  canvas.height = Math.round(alto * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, ancho, alto);
  return { ctx, ancho, alto };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ------------------------------------------------------------
// KPIs
// ------------------------------------------------------------
export function renderKpis(k) {
  const cont = document.getElementById('metrica-kpis');
  if (!cont) return;
  const card = (icono, valor, etiqueta, nota) =>
    `<article class="kpi vidrio borde-degradado"><span class="kpi-icono" aria-hidden="true">${icono}</span><h3 class="kpi-titulo">${esc(etiqueta)}</h3><p class="kpi-valor">${esc(valor)}</p>${nota ? `<p class="kpi-nota">${esc(nota)}</p>` : ''}</article>`;
  cont.innerHTML =
    card('✍️', k.escribieron, 'Escribieron', 'personas que contactaron') +
    card('🎯', `${k.tasaConversion}%`, 'Conversión', 'escribieron → completaron') +
    card('✅', k.completaron, 'Completaron', 'servicios terminados') +
    card('💵', formatearSoles(k.ingresos30), 'Ingresos 30d', `ticket prom. ${formatearSoles(k.ticket)}`);
}

// ------------------------------------------------------------
// Embudo (barras horizontales + % de conversión entre etapas)
// ------------------------------------------------------------
export function renderEmbudo(embudo) {
  const canvas = document.getElementById('metrica-embudo');
  if (!canvas || !embudo) return;

  const etapas = [
    ['escribieron', 'Escribieron'],
    ['conversaron', 'Conversaron (≥3 msjs)'],
    ['agendaron', 'Agendaron'],
    ['confirmaron', 'Confirmaron'],
    ['completaron', 'Completaron'],
  ].map(([k, label]) => ({ k, label, valor: Number(embudo[k] || 0) }));

  const max = Math.max(etapas[0].valor, 1);
  const filaAlto = 50;
  const gap = 8;
  const alto = etapas.length * (filaAlto + gap);
  const { ctx, ancho } = prepararCanvas(canvas, alto);
  const anchoMax = ancho - 6;

  etapas.forEach((e, i) => {
    const y = i * (filaAlto + gap);
    const w = Math.max((e.valor / max) * anchoMax, 46);
    const color = COLORES_METRICA[e.k] ?? '#8A99AB';

    ctx.fillStyle = color;
    roundRect(ctx, 2, y + 16, w, filaAlto - 16, 8);
    ctx.fill();

    ctx.fillStyle = '#46586E';
    ctx.font = "600 11px Inter, sans-serif";
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(e.label.toUpperCase(), 4, y + 11);

    ctx.fillStyle = '#fff';
    ctx.font = "700 16px 'Space Grotesk', sans-serif";
    ctx.textBaseline = 'middle';
    ctx.fillText(String(e.valor), 12, y + 16 + (filaAlto - 16) / 2);
    ctx.textBaseline = 'alphabetic';

    if (i > 0) {
      const prev = etapas[i - 1].valor;
      const pct = prev > 0 ? Math.round((e.valor / prev) * 100) : 0;
      ctx.fillStyle = '#7C8DA1';
      ctx.font = "600 11px Inter, sans-serif";
      ctx.textAlign = 'right';
      ctx.fillText(`${pct}%`, ancho - 2, y + 11);
    }
  });
}

// ------------------------------------------------------------
// Serie temporal (líneas: conversaciones vs citas · 30 días)
// ------------------------------------------------------------
export function renderSerie(serie) {
  const canvas = document.getElementById('metrica-serie');
  if (!canvas || !serie.length) return;

  const alto = 210;
  const { ctx, ancho } = prepararCanvas(canvas, alto);
  const padL = 30;
  const padR = 10;
  const padT = 12;
  const padB = 26;
  const w = ancho - padL - padR;
  const h = alto - padT - padB;
  const maxY = Math.max(...serie.flatMap((d) => [Number(d.conversaciones), Number(d.citas)]), 1);
  const n = serie.length;
  const x = (i) => padL + (w * i) / (n - 1);
  const y = (v) => padT + h - (h * Number(v)) / maxY;

  ctx.strokeStyle = 'rgba(14,27,44,0.06)';
  ctx.lineWidth = 1;
  ctx.textBaseline = 'alphabetic';
  for (let g = 0; g <= 4; g += 1) {
    const gy = padT + (h * g) / 4;
    ctx.beginPath();
    ctx.moveTo(padL, gy);
    ctx.lineTo(padL + w, gy);
    ctx.stroke();
    ctx.fillStyle = '#7C8DA1';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(String(Math.round((maxY * (4 - g)) / 4)), padL - 4, gy + 3);
  }

  const linea = (key, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    serie.forEach((d, i) => {
      const px = x(i);
      const py = y(d[key]);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
  };
  linea('citas', COLORES_METRICA.citas);
  linea('conversaciones', COLORES_METRICA.conversaciones);

  ctx.fillStyle = '#7C8DA1';
  ctx.font = '9px Inter, sans-serif';
  ctx.textAlign = 'center';
  [0, Math.floor(n / 2), n - 1].forEach((i) => {
    ctx.fillText(String(serie[i].dia).slice(5), x(i), alto - 8);
  });
}

// ------------------------------------------------------------
// Ingresos por servicio (barras HTML)
// ------------------------------------------------------------
export function renderServicios(servicios) {
  const cont = document.getElementById('metrica-servicios');
  if (!cont) return;
  if (!servicios.length) {
    cont.innerHTML = '<li class="srv-vacio">Sin datos de servicios todavía.</li>';
    return;
  }
  const max = Math.max(...servicios.map((s) => Number(s.ingresos || 0)), 1);
  cont.innerHTML = servicios
    .map((s) => {
      const pct = Math.round((Number(s.ingresos || 0) / max) * 100);
      return `<li>
        <div class="srv-top"><span>${esc(s.servicio)}</span><strong>${esc(formatearSoles(s.ingresos))}</strong></div>
        <div class="srv-barra"><span style="width:${pct}%"></span></div>
        <div class="srv-meta">${s.completadas}/${s.citas} citas · ticket ${esc(formatearSoles(s.ticket_promedio))}</div>
      </li>`;
    })
    .join('');
}

// ------------------------------------------------------------
// Ranking de clientes (HTML)
// ------------------------------------------------------------
export function renderRanking(ranking) {
  const cont = document.getElementById('metrica-ranking');
  if (!cont) return;
  if (!ranking.length) {
    cont.innerHTML = '<li class="srv-vacio">Sin clientes con gasto todavía.</li>';
    return;
  }
  cont.innerHTML = ranking
    .map(
      (r, i) =>
        `<li><span class="rk-pos">${i + 1}</span><span class="rk-nombre">${esc(r.nombre)}</span><span class="rk-gasto">${esc(formatearSoles(r.gasto))}</span></li>`
    )
    .join('');
}
