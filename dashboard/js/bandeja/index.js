// ============================================================
// Jaguar Carwash — Bandeja: controlador de la sección.
// El router lo importa perezosamente y llama init() ya visible.
// Orquesta store + render + acciones + tiempo real (no lógica de negocio).
// ============================================================

import * as datos from './data.js';
import * as render from './render.js';
import { alternarBot, enviarMensaje } from './actions.js';
import { iniciarTiempoRealBandeja, detenerTiempoRealBandeja } from './realtime.js';
import { toast, debounce } from '../ui.js';

const $ = (id) => document.getElementById(id);
const CERCA_DEL_FONDO_PX = 140;
const UMBRAL_SCROLL_ATRAS_PX = 80;
const ALTO_MAX_COMPOSER_PX = 120;

let iniciado = false;
let eventosListos = false;
let desuscribir = null;
let alturaAntesDeCargar = 0; // para conservar la posición al paginar hacia atrás

// ------------------------------------------------------------
// Reacción a los cambios del store
// ------------------------------------------------------------
const RENDER_LISTA = new Set([
  'carga', 'busqueda', 'seleccion', 'cierre', 'entrante',
  'saliente', 'saliente-ok', 'saliente-quita', 'handoff',
]);

function alCambiar(estado, meta) {
  if (meta.origen === 'error') {
    toast(meta.mensaje ?? 'Ocurrió un error en la bandeja.', 'error');
    return;
  }

  if (RENDER_LISTA.has(meta.origen)) {
    render.renderListaChats(datos.chatsFiltrados(), estado.activoId);
  }

  if (meta.origen === 'cierre') {
    render.mostrarPanelChat(false);
    return;
  }

  const activo = datos.chatActivo();

  if (meta.origen === 'seleccion') {
    render.renderCabecera(activo);
    render.renderComposer(activo);
    render.mostrarPanelChat(!!activo);
    if (activo && estado.mensajes[activo.id]) {
      render.renderConversacion(datos.mensajesDe(activo.id));
      render.scrollAlFondo(); // síncrono: evita el flash arriba
    }
    return;
  }

  if (!activo) return;
  // Cambios de un chat que no es el visible: la lista ya se actualizó, nada más.
  if (meta.id && meta.id !== activo.id) return;

  const cont = $('bandeja-conversacion');

  switch (meta.origen) {
    case 'msgs-nuevos':
      render.renderConversacion(datos.mensajesDe(activo.id));
      render.scrollAlFondo();
      break;

    case 'msgs-atras': {
      const antes = alturaAntesDeCargar;
      render.renderConversacion(datos.mensajesDe(activo.id));
      if (cont) cont.scrollTop += cont.scrollHeight - antes; // conservar vista
      break;
    }

    case 'entrante': {
      const cerca = cont
        ? cont.scrollHeight - cont.scrollTop - cont.clientHeight < CERCA_DEL_FONDO_PX
        : true;
      render.renderConversacion(datos.mensajesDe(activo.id));
      render.renderCabecera(activo); // refrescar aviso de ventana 24 h
      if (cerca) render.scrollAlFondo(true);
      break;
    }

    case 'saliente':
      render.renderConversacion(datos.mensajesDe(activo.id));
      render.scrollAlFondo(true);
      break;

    case 'saliente-ok':
    case 'saliente-quita':
      render.renderConversacion(datos.mensajesDe(activo.id));
      break;

    case 'handoff':
      render.renderCabecera(activo);
      render.renderComposer(activo);
      break;

    default:
      break;
  }
}

// ------------------------------------------------------------
// Wiring de eventos (delegado: los nodos internos se re-renderizan)
// ------------------------------------------------------------
function conectarEventos() {
  if (eventosListos) return;
  eventosListos = true;

  $('bandeja-chats').addEventListener('click', (e) => {
    const fila = e.target.closest('[data-chat]');
    if (fila) datos.seleccionarChat(fila.dataset.chat);
  });

  $('bandeja-buscador').addEventListener(
    'input',
    debounce((e) => datos.fijarBusquedaChats(e.target.value), 200)
  );

  $('bandeja-cabecera').addEventListener('click', (e) => {
    if (e.target.closest('[data-volver]')) {
      datos.cerrarChat();
      return;
    }
    if (e.target.closest('[data-toggle-bot]')) alternarBot(datos.chatActivo());
  });

  const composer = $('bandeja-composer');
  composer.addEventListener('submit', (e) => {
    e.preventDefault();
    enviarDesdeComposer();
  });
  composer.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && e.target.id === 'composer-input') {
      e.preventDefault();
      enviarDesdeComposer();
    }
  });
  composer.addEventListener('input', (e) => {
    const ta = e.target;
    if (ta.id !== 'composer-input') return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, ALTO_MAX_COMPOSER_PX)}px`;
  });

  // Scroll infinito hacia atrás (cargar el lote anterior).
  $('bandeja-conversacion').addEventListener('scroll', (e) => {
    const cont = e.target;
    const estado = datos.obtenerEstado();
    const activo = estado.activoId;
    if (!activo || estado.cargandoMsgs || estado.sinMas[activo]) return;
    if (cont.scrollTop < UMBRAL_SCROLL_ATRAS_PX) {
      alturaAntesDeCargar = cont.scrollHeight;
      datos.cargarMensajes(activo, { antesDe: estado.cursor[activo] });
    }
  });
}

async function enviarDesdeComposer() {
  const ta = $('composer-input');
  const chat = datos.chatActivo();
  if (!ta || !chat) return;
  const texto = ta.value;
  if (!texto.trim()) return;

  ta.value = '';
  ta.style.height = 'auto';
  const { ok } = await enviarMensaje(chat, texto);
  if (!ok) ta.value = texto; // el envío falló: devolver el texto para reintentar
  ta.focus();
}

// ------------------------------------------------------------
// API pública (la usa el router)
// ------------------------------------------------------------
export function init() {
  conectarEventos(); // el DOM de la sección ya existe en index.html
  if (iniciado) return;
  iniciado = true;
  desuscribir = datos.suscribir(alCambiar);
  datos.cargarChats();
  iniciarTiempoRealBandeja(() => {});
}

export function onMostrar() {
  const activo = datos.chatActivo();
  if (activo) render.scrollAlFondo();
}

export function detener() {
  detenerTiempoRealBandeja();
  if (desuscribir) desuscribir();
  desuscribir = null;
  iniciado = false;
}

/** Abre el chat de un teléfono (salto desde Clientes → Bandeja). */
export function abrirChatPorTelefono(telefono) {
  const objetivo = String(telefono ?? '').replace(/[^\d]/g, '');
  const chat = datos
    .obtenerEstado()
    .chats.find((c) => String(c.telefono).replace(/[^\d]/g, '') === objetivo);
  if (chat) datos.seleccionarChat(chat.id);
  else toast('Ese cliente aún no tiene conversación en la bandeja.', 'info');
}
