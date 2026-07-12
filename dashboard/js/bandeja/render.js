// ============================================================
// Jaguar Carwash — Bandeja: render tipo WhatsApp Web.
//
// SEGURIDAD: TODO contenido de mensaje, nombre y teléfono viene del
// cliente (WhatsApp) → pasa SIEMPRE por esc() antes de innerHTML.
// Los colores de avatar salen de una paleta interna (no del usuario).
// ============================================================

import { esc } from '../render.js';
import { ROLES_CHAT, VENTANA_24H_MS } from '../config.js';

const fmtHora = new Intl.DateTimeFormat('es-PE', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});
const fmtDiaLargo = new Intl.DateTimeFormat('es-PE', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const fmtFechaCorta = new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: '2-digit' });

const DIA_MS = 86_400_000;
const inicioDia = (iso) => {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};
const hoy0 = () => inicioDia(new Date());

function etiquetaDia(iso) {
  const dia = inicioDia(iso);
  const hoy = hoy0();
  if (dia === hoy) return 'HOY';
  if (dia === hoy - DIA_MS) return 'AYER';
  return fmtDiaLargo.format(new Date(iso));
}

function horaLista(iso) {
  if (!iso) return '';
  const dia = inicioDia(iso);
  const hoy = hoy0();
  if (dia === hoy) return fmtHora.format(new Date(iso));
  if (dia === hoy - DIA_MS) return 'Ayer';
  return fmtFechaCorta.format(new Date(iso));
}

function iniciales(nombre) {
  const partes = String(nombre ?? '').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '·';
  const primera = partes[0][0] ?? '';
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] ?? '' : '';
  return (primera + ultima).toUpperCase();
}

// Color de avatar determinístico (paleta interna → seguro para style).
const PALETA_AVATAR = ['#F5A300', '#D0480B', '#19A97B', '#0077B6', '#8E44AD', '#E8960C', '#B3273A'];
function colorAvatar(nombre) {
  let h = 0;
  for (const ch of String(nombre ?? '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETA_AVATAR[h % PALETA_AVATAR.length];
}

const necesitaPlantilla = (chat) =>
  !!chat.ultimo_inbound_at &&
  Date.now() - new Date(chat.ultimo_inbound_at).getTime() > VENTANA_24H_MS;

// ------------------------------------------------------------
// Lista de chats (panel izquierdo)
// ------------------------------------------------------------
export function renderListaChats(chats, activoId) {
  const cont = document.getElementById('bandeja-chats');
  if (!cont) return;
  cont.setAttribute('aria-busy', 'false');

  if (!chats.length) {
    cont.innerHTML = '<p class="bandeja-lista-vacia">No hay conversaciones todavía.</p>';
    return;
  }
  cont.innerHTML = chats.map((c) => filaChat(c, c.id === activoId)).join('');
}

function filaChat(chat, activo) {
  const badge =
    chat.no_leidos > 0
      ? `<span class="chat-badge" aria-label="${chat.no_leidos} sin leer">${chat.no_leidos > 99 ? '99+' : chat.no_leidos}</span>`
      : '';
  const bot = chat.handoff
    ? '<span class="chat-mini-off" title="Bot apagado — atiende el staff" aria-hidden="true">🔕 </span>'
    : '';
  const preview = chat.ultimo_contenido || 'Sin mensajes';
  const clases = ['chat-fila', activo ? 'activo' : '', chat.no_leidos ? 'no-leido' : '']
    .filter(Boolean)
    .join(' ');
  return `<button type="button" role="listitem" class="${clases}" data-chat="${esc(chat.id)}" aria-label="Conversación con ${esc(chat.nombre)}">
    <span class="chat-avatar" style="--avatar:${colorAvatar(chat.nombre)}" aria-hidden="true">${esc(iniciales(chat.nombre))}</span>
    <span class="chat-fila-cuerpo">
      <span class="chat-fila-top">
        <span class="chat-nombre">${esc(chat.nombre)}</span>
        <span class="chat-hora">${esc(horaLista(chat.ultimo_at))}</span>
      </span>
      <span class="chat-fila-bottom">
        <span class="chat-preview">${bot}${esc(preview)}</span>
        ${badge}
      </span>
    </span>
  </button>`;
}

// ------------------------------------------------------------
// Conversación (panel derecho)
// ------------------------------------------------------------
export function renderConversacion(mensajes) {
  const cont = document.getElementById('bandeja-conversacion');
  if (!cont) return;

  if (!mensajes.length) {
    cont.innerHTML = '<p class="conversacion-vacia">Aún no hay mensajes en esta conversación.</p>';
    return;
  }

  let html = '';
  let diaPrevio = null;
  mensajes.forEach((m) => {
    const dia = inicioDia(m.created_at);
    if (dia !== diaPrevio) {
      html += `<div class="dia-separador"><span>${esc(etiquetaDia(m.created_at))}</span></div>`;
      diaPrevio = dia;
    }
    html += burbuja(m);
  });
  cont.innerHTML = html;
}

function burbuja(m) {
  const rol = ROLES_CHAT[m.role] ?? ROLES_CHAT.cliente;
  const mini = rol.mini ? `<span class="burbuja-rol">${esc(rol.mini)}</span>` : '';
  let estado = '';
  if (rol.clase === 'saliente') {
    estado = m.pendiente
      ? '<span class="burbuja-check pendiente" aria-label="Enviando">🕓</span>'
      : '<span class="burbuja-check" aria-label="Enviado" aria-hidden="true">✓✓</span>';
  }
  return `<div class="burbuja ${rol.clase}">
    ${mini}
    <span class="burbuja-texto">${esc(m.content)}</span>
    <span class="burbuja-meta"><span class="burbuja-hora">${esc(fmtHora.format(new Date(m.created_at)))}</span>${estado}</span>
  </div>`;
}

// ------------------------------------------------------------
// Cabecera del chat (con toggle de bot y aviso de ventana 24 h)
// ------------------------------------------------------------
export function renderCabecera(chat) {
  const cont = document.getElementById('bandeja-cabecera');
  if (!cont || !chat) return;

  const botActivo = !chat.handoff; // handoff=false → el bot atiende
  const aviso = necesitaPlantilla(chat)
    ? '<div class="aviso-24h" role="note"><span aria-hidden="true">⏰</span> Pasaron más de 24 h desde el último mensaje del cliente. Un texto libre podría no entregarse (Meta exige plantilla).</div>'
    : '';

  cont.innerHTML = `
    <button type="button" class="bandeja-volver" data-volver aria-label="Volver a la lista de chats">‹</button>
    <span class="chat-avatar grande" style="--avatar:${colorAvatar(chat.nombre)}" aria-hidden="true">${esc(iniciales(chat.nombre))}</span>
    <div class="bandeja-cabecera-info">
      <strong class="chat-nombre">${esc(chat.nombre)}</strong>
      <span class="bandeja-cabecera-tel">${esc(chat.telefono)}</span>
    </div>
    <button type="button" class="bot-toggle ${botActivo ? 'on' : 'off'}" data-toggle-bot aria-pressed="${botActivo}" aria-label="${botActivo ? 'Bot activo. Actívalo/desactívalo para atender tú.' : 'Bot apagado, tú atiendes. Tócalo para reactivarlo.'}">
      <span class="bot-toggle-punto" aria-hidden="true"></span>
      <span class="bot-toggle-txt">${botActivo ? '🤖 Bot activo' : '🔕 Atiendes tú'}</span>
    </button>
    ${aviso}`;
}

// ------------------------------------------------------------
// Composer (solo activo cuando el bot está apagado)
// ------------------------------------------------------------
export function renderComposer(chat) {
  const cont = document.getElementById('bandeja-composer');
  if (!cont || !chat) return;

  if (!chat.handoff) {
    cont.innerHTML =
      '<p class="composer-bloqueado">🤖 El bot está atendiendo este chat. Apágalo arriba para escribirle tú.</p>';
    return;
  }
  cont.innerHTML = `
    <form class="composer-form" id="composer-form" autocomplete="off">
      <textarea id="composer-input" class="composer-input" rows="1" maxlength="4096" placeholder="Escribe un mensaje…" aria-label="Escribe un mensaje"></textarea>
      <button type="submit" class="composer-enviar" id="composer-enviar" aria-label="Enviar mensaje">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.4 20.4 21 12 3.4 3.6 3.39 10.2 15 12l-11.61 1.8z" fill="currentColor"/></svg>
      </button>
    </form>`;
}

// ------------------------------------------------------------
// Helpers de visibilidad y scroll (llamados por el controlador)
// ------------------------------------------------------------
export function mostrarPanelChat(hayChat) {
  const vacio = document.getElementById('bandeja-vacio');
  const chat = document.getElementById('bandeja-chat');
  const bandeja = document.getElementById('bandeja');
  if (vacio) vacio.hidden = hayChat;
  if (chat) chat.hidden = !hayChat;
  if (bandeja) bandeja.classList.toggle('mostrando-chat', hayChat);
}

export function scrollAlFondo(suave = false) {
  const cont = document.getElementById('bandeja-conversacion');
  if (!cont) return;
  cont.scrollTo({ top: cont.scrollHeight, behavior: suave ? 'smooth' : 'auto' });
}
