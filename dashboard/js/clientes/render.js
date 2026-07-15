// ============================================================
// Jaguar Carwash — Clientes: render (directorio + drawer de ficha).
// SEGURIDAD: todo dato de cliente pasa por esc() antes de innerHTML.
// ============================================================

import { esc, formatearSoles } from '../render.js';
import { TAGS_CATALOGO } from '../config.js';
import { esDormido } from './data.js';

const fmtFecha = new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
const fmtFechaCorta = new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short' });

const fechaRel = (iso) => {
  if (!iso) return 'Nunca';
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (dias <= 0) return 'Hoy';
  if (dias === 1) return 'Ayer';
  if (dias < 30) return `hace ${dias} d`;
  return fmtFechaCorta.format(new Date(iso));
};

const iniciales = (nombre) => {
  const p = String(nombre ?? '').trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase() || '·';
};
const PALETA = ['#F5A300', '#D0480B', '#19A97B', '#0077B6', '#8E44AD', '#E8960C', '#B3273A'];
const colorAvatar = (nombre) => {
  let h = 0;
  for (const ch of String(nombre ?? '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETA[h % PALETA.length];
};

function pills(tags) {
  return (tags ?? [])
    .map((t) => {
      const info = TAGS_CATALOGO[t] ?? { label: t, color: '#8A99AB' };
      return `<span class="tag-pill" style="--tag:${info.color}">${esc(info.label)}</span>`;
    })
    .join('');
}

// ------------------------------------------------------------
// Resumen + filtros
// ------------------------------------------------------------
export function renderResumen(r) {
  const cont = document.getElementById('clientes-resumen');
  if (!cont) return;
  const kpi = (icono, valor, etiqueta) =>
    `<div class="cli-kpi"><span class="cli-kpi-icono" aria-hidden="true">${icono}</span><div><strong>${esc(valor)}</strong><span>${esc(etiqueta)}</span></div></div>`;
  cont.innerHTML =
    kpi('👥', r.total, 'clientes') +
    kpi('📅', r.conReserva, 'con reserva') +
    kpi('😴', r.dormidos, 'dormidos (+30d)') +
    kpi('💵', formatearSoles(r.gasto), 'gasto histórico');
}

export function renderFiltros(filtroActivo) {
  const cont = document.getElementById('clientes-filtros');
  if (!cont) return;
  const chip = (f, txt) =>
    `<button type="button" class="chip${f === filtroActivo ? ' activo' : ''}" data-filtro="${esc(f)}" aria-pressed="${f === filtroActivo}">${esc(txt)}</button>`;
  const tags = Object.entries(TAGS_CATALOGO)
    .map(([slug, info]) => chip(slug, info.label))
    .join('');
  cont.innerHTML = chip('todos', 'Todos') + chip('dormidos', '😴 Dormidos') + tags;
}

// ------------------------------------------------------------
// Tabla (escritorio) + cards (móvil)
// ------------------------------------------------------------
export function renderTabla(clientes) {
  const cuerpo = document.getElementById('clientes-cuerpo');
  const lista = document.getElementById('clientes-cards');
  const vacio = document.getElementById('clientes-vacio');
  if (!cuerpo || !lista) return;

  const hay = clientes.length > 0;
  vacio.hidden = hay;
  cuerpo.innerHTML = clientes.map(fila).join('');
  lista.innerHTML = clientes.map(card).join('');
}

function fila(c) {
  return `<tr data-cliente="${esc(c.id)}" tabindex="0">
    <td class="cli-celda-nombre">
      <span class="chat-avatar chico" style="--avatar:${colorAvatar(c.nombre)}" aria-hidden="true">${esc(iniciales(c.nombre))}</span>
      <span><strong>${esc(c.nombre)}</strong><span class="cli-tel">${esc(c.telefono)}</span></span>
    </td>
    <td>${esc(c.dni || '—')}</td>
    <td class="num">${c.mensajes}</td>
    <td class="num">${c.total_citas}</td>
    <td class="num">${c.confirmadas}</td>
    <td class="num">${c.completadas}</td>
    <td class="num">${esc(formatearSoles(c.gasto))}</td>
    <td>${esc(fechaRel(c.ultima_visita))}${esDormido(c) ? ' 😴' : ''}</td>
    <td><span class="tag-pills">${pills(c.tags)}</span></td>
  </tr>`;
}

function card(c) {
  return `<article class="cli-card" data-cliente="${esc(c.id)}" tabindex="0">
    <header>
      <span class="chat-avatar chico" style="--avatar:${colorAvatar(c.nombre)}" aria-hidden="true">${esc(iniciales(c.nombre))}</span>
      <span class="cli-card-id"><strong>${esc(c.nombre)}</strong><span class="cli-tel">${esc(c.telefono)}</span></span>
      <span class="cli-card-gasto">${esc(formatearSoles(c.gasto))}</span>
    </header>
    <div class="cli-card-stats">
      <span>💬 ${c.mensajes}</span><span>📅 ${c.total_citas} citas</span>
      <span>✅ ${c.completadas}</span><span>🕓 ${esc(fechaRel(c.ultima_visita))}</span>
    </div>
    ${c.tags.length ? `<div class="tag-pills">${pills(c.tags)}</div>` : ''}
  </article>`;
}

// ------------------------------------------------------------
// Drawer de ficha
// ------------------------------------------------------------
export function renderFicha(estado) {
  const drawer = document.getElementById('cliente-drawer');
  const fondo = document.getElementById('cliente-drawer-fondo');
  const cuerpo = document.getElementById('cliente-drawer-cuerpo');
  if (!drawer || !cuerpo) return;

  const abierto = !!estado.fichaId;
  drawer.classList.toggle('abierto', abierto);
  if (fondo) fondo.hidden = !abierto;
  drawer.setAttribute('aria-hidden', String(!abierto));
  if (!abierto) return;

  if (estado.cargandoFicha || !estado.ficha) {
    cuerpo.innerHTML = '<div class="skeleton-grupo"><div class="skeleton-fila"></div><div class="skeleton-fila"></div><div class="skeleton-fila"></div></div>';
    return;
  }

  const f = estado.ficha;
  const c = f.cliente ?? {};
  const tags = f.tags ?? [];
  cuerpo.innerHTML = `
    <header class="ficha-cabecera">
      <span class="chat-avatar grande" style="--avatar:${colorAvatar(c.nombre)}" aria-hidden="true">${esc(iniciales(c.nombre))}</span>
      <div>
        <h3>${esc(c.nombre ?? 'Cliente')}</h3>
        <p class="cli-tel">${esc(c.telefono ?? '')}${c.dni ? ' · DNI ' + esc(c.dni) : ''}</p>
      </div>
      <button type="button" class="btn-fantasma" data-abrir-chat="${esc(c.telefono ?? '')}">💬 Chat</button>
    </header>

    <div class="ficha-kpis">
      ${fichaKpi(c.mensajes ?? 0, 'Mensajes')}
      ${fichaKpi(c.total_citas ?? 0, 'Reservas')}
      ${fichaKpi(c.confirmadas ?? 0, 'Confirmadas')}
      ${fichaKpi(c.completadas ?? 0, 'Completadas')}
      ${fichaKpi(formatearSoles(c.gasto ?? 0), 'Gasto')}
    </div>

    <section class="ficha-bloque">
      <h4>Etiquetas</h4>
      <div class="tag-toggles">
        ${Object.entries(TAGS_CATALOGO).map(([slug, info]) => {
          const on = tags.includes(slug);
          return `<button type="button" class="tag-toggle${on ? ' on' : ''}" style="--tag:${info.color}" data-tag="${esc(slug)}" aria-pressed="${on}">${on ? '✓ ' : ''}${esc(info.label)}</button>`;
        }).join('')}
      </div>
    </section>

    <section class="ficha-bloque">
      <h4>Historial de citas</h4>
      ${(f.citas ?? []).length
        ? `<ul class="ficha-citas">${f.citas.map((ci) =>
            `<li><span class="badge estado-${esc(ci.estado)}">${esc(ci.estado)}</span><span>${esc(fmtFecha.format(new Date(ci.fecha)))}</span><span class="num">${esc(formatearSoles(ci.precio || 0))}</span></li>`).join('')}</ul>`
        : '<p class="ficha-vacio">Sin citas todavía.</p>'}
    </section>

    <section class="ficha-bloque">
      <h4>Notas internas</h4>
      <form class="ficha-nota-form" id="ficha-nota-form">
        <textarea id="ficha-nota-input" rows="2" maxlength="4000" placeholder="Agregar nota interna…" aria-label="Nueva nota"></textarea>
        <button type="submit" class="btn-primario btn-nota">Guardar nota</button>
      </form>
      ${(f.notas ?? []).length
        ? `<ul class="ficha-notas">${f.notas.map((n) =>
            `<li><p>${esc(n.contenido)}</p><span class="ficha-nota-meta">${esc(n.autor ?? '')} · ${esc(fmtFecha.format(new Date(n.creado)))}</span></li>`).join('')}</ul>`
        : '<p class="ficha-vacio">Aún no hay notas.</p>'}
    </section>`;
}

const fichaKpi = (valor, etiqueta) =>
  `<div class="ficha-kpi"><strong>${esc(valor)}</strong><span>${esc(etiqueta)}</span></div>`;
