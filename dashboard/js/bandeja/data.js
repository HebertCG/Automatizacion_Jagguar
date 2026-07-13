// ============================================================
// Jaguar Carwash — Bandeja: store inmutable (patrón observador).
// Mismo contrato que js/data.js: el estado se REEMPLAZA, nunca se muta;
// cada cambio se publica con meta.origen para que el controlador reaccione.
//
// SEGURIDAD: el contenido de los mensajes es el input MÁS hostil de la app
// (texto crudo de WhatsApp). Aquí solo se almacena; el escape ocurre en
// render.js con esc() antes de tocar el DOM.
// ============================================================

import {
  MODO_DEMO,
  VISTA_BANDEJA,
  TABLA_CONVERSACIONES,
  CHAT_LOTE_MENSAJES,
} from '../config.js';
import { obtenerCliente } from '../supabase.js';
import { generarBandejaDemo, loteDemo } from './demo.js';

// ------------------------------------------------------------
// Store
// ------------------------------------------------------------
let estado = Object.freeze({
  chats: [],          // [{id,nombre,telefono,ultimo_contenido,ultimo_at,no_leidos,handoff,ultimo_inbound_at}]
  activoId: null,     // customer_id del chat abierto
  mensajes: {},       // { [cid]: [ {id,customer_id,role,content,created_at,pendiente} ] }
  busqueda: '',
  cargandoLista: true,
  cargandoMsgs: false,
  cursor: {},         // { [cid]: created_at del más viejo cargado }
  sinMas: {},         // { [cid]: true si ya no hay más hacia atrás }
});

const suscriptores = new Set();

export function suscribir(fn) {
  suscriptores.add(fn);
  return () => suscriptores.delete(fn);
}

function publicar(nuevo, meta = {}) {
  estado = Object.freeze({ ...estado, ...nuevo });
  suscriptores.forEach((fn) => fn(estado, meta));
}

export const obtenerEstado = () => estado;
export const buscarChat = (id) => estado.chats.find((c) => c.id === id) ?? null;
export const mensajesDe = (id) => estado.mensajes[id] ?? [];
export const chatActivo = () => buscarChat(estado.activoId);

// En demo guardamos los hilos completos para paginar el scroll hacia atrás.
let demoTodos = {};

// ------------------------------------------------------------
// Normalizadores (fila de Supabase → forma del front)
// ------------------------------------------------------------
function normalizarChat(fila) {
  return Object.freeze({
    id: fila.id,
    nombre: fila.nombre || fila.telefono || 'Cliente',
    telefono: fila.telefono ?? '',
    ultimo_contenido: fila.ultimo_contenido ?? '',
    ultimo_at: fila.ultimo_at ?? null,
    no_leidos: Number(fila.no_leidos) || 0,
    handoff: !!fila.handoff,
    ultimo_inbound_at: fila.ultimo_inbound_at ?? null,
  });
}

function normalizarMensaje(fila) {
  return Object.freeze({
    id: fila.id,
    customer_id: fila.customer_id,
    role: fila.role,
    content: fila.content ?? '',
    created_at: fila.created_at,
    pendiente: false,
  });
}

const porFechaDesc = (a, b) => new Date(b.ultimo_at) - new Date(a.ultimo_at);

// ------------------------------------------------------------
// Carga de la lista de chats
// ------------------------------------------------------------
export async function cargarChats({ silencioso = false } = {}) {
  if (!silencioso) publicar({ cargandoLista: true }, { origen: 'carga' });

  if (MODO_DEMO) {
    if (!silencioso) await new Promise((r) => setTimeout(r, 500));
    const { chats, todos } = generarBandejaDemo();
    demoTodos = todos;
    publicar({ chats, cargandoLista: false }, { origen: 'carga' });
    return;
  }

  try {
    const supabase = await obtenerCliente();
    const { data, error } = await supabase
      .from(VISTA_BANDEJA)
      .select('*')
      .order('ultimo_at', { ascending: false });
    if (error) throw error;

    // v_bandeja calcula no_leidos = mensajes del cliente sin respuesta. El chat
    // que el staff tiene ABIERTO ya lo está viendo: no debe recuperar el badge
    // en cada polling.
    const chats = (data ?? []).map(normalizarChat);
    const conLeidos = estado.activoId
      ? chats.map((c) => (c.id === estado.activoId ? { ...c, no_leidos: 0 } : c))
      : chats;

    publicar({ chats: conLeidos, cargandoLista: false }, { origen: 'carga' });
  } catch (err) {
    console.error('[bandeja] Error al cargar chats:', err);
    publicar(
      { cargandoLista: false },
      { origen: 'error', mensaje: 'No pudimos cargar las conversaciones.' }
    );
  }
}

// ------------------------------------------------------------
// Selección + carga de mensajes (con paginación hacia atrás)
// ------------------------------------------------------------
export function seleccionarChat(id) {
  // Abrir el chat marca sus mensajes como leídos (no_leidos → 0).
  const chats = estado.chats.map((c) => (c.id === id ? { ...c, no_leidos: 0 } : c));
  publicar({ activoId: id, chats }, { origen: 'seleccion', id });
  if (!estado.mensajes[id]) cargarMensajes(id);
}

export function cerrarChat() {
  publicar({ activoId: null }, { origen: 'cierre' });
}

/**
 * Carga un lote de mensajes. Sin `antesDe` → los más recientes (scroll al
 * fondo). Con `antesDe` → el lote anterior (prepend, conservar posición).
 */
export async function cargarMensajes(id, { antesDe = null } = {}) {
  if (estado.cargandoMsgs) return;
  if (antesDe && estado.sinMas[id]) return;
  publicar({ cargandoMsgs: true }, { origen: 'msgs-inicio' });

  try {
    let batch = [];
    let sinMas = true;

    if (MODO_DEMO) {
      await new Promise((r) => setTimeout(r, antesDe ? 350 : 250));
      const r = loteDemo(demoTodos[id], antesDe, CHAT_LOTE_MENSAJES);
      batch = r.batch;
      sinMas = r.sinMas;
    } else {
      const supabase = await obtenerCliente();
      let q = supabase
        .from(TABLA_CONVERSACIONES)
        .select('*')
        .eq('customer_id', id)
        .order('created_at', { ascending: false })
        .limit(CHAT_LOTE_MENSAJES);
      if (antesDe) q = q.lt('created_at', antesDe);
      const { data, error } = await q;
      if (error) throw error;
      batch = (data ?? []).reverse().map(normalizarMensaje); // desc → asc
      sinMas = (data?.length ?? 0) < CHAT_LOTE_MENSAJES;
    }

    const prev = estado.mensajes[id] ?? [];
    let combinados;
    if (antesDe) {
      combinados = [...batch, ...prev]; // lote viejo al inicio
    } else {
      // Carga inicial: conserva burbujas optimistas (pendientes) que el staff
      // haya enviado mientras cargaba, para no perderlas al reemplazar.
      const pendientes = prev.filter(
        (m) => m.pendiente && !batch.some((b) => b.id === m.id)
      );
      combinados = [...batch, ...pendientes];
    }
    const nuevoCursor = batch.length ? batch[0].created_at : estado.cursor[id] ?? null;

    publicar(
      {
        mensajes: { ...estado.mensajes, [id]: combinados },
        cursor: { ...estado.cursor, [id]: nuevoCursor },
        sinMas: { ...estado.sinMas, [id]: sinMas },
        cargandoMsgs: false,
      },
      { origen: antesDe ? 'msgs-atras' : 'msgs-nuevos', id }
    );
  } catch (err) {
    console.error('[bandeja] Error al cargar mensajes:', err);
    publicar(
      { cargandoMsgs: false },
      { origen: 'error', mensaje: 'No pudimos cargar los mensajes.' }
    );
  }
}

// ------------------------------------------------------------
// Mensajes entrantes (tiempo real) y salientes (envío del staff)
// ------------------------------------------------------------

/** Aplica un mensaje que llega por Realtime (o simulado en demo). */
export function aplicarMensajeEntrante(fila) {
  const msg = normalizarMensaje(fila);
  const cid = msg.customer_id;
  const prev = estado.mensajes[cid] ?? null;

  // Si el chat no está en la lista (cliente nuevo): recargar la lista.
  if (!buscarChat(cid)) {
    cargarChats({ silencioso: true });
    return;
  }
  // Dedupe por id (el polling y el canal pueden traer lo mismo).
  if (prev && prev.some((m) => m.id === msg.id)) return;

  // Dedupe del eco de nuestro propio envío: reemplaza la burbuja optimista.
  if (msg.role === 'staff' && prev) {
    const idx = prev.findIndex((m) => m.pendiente && m.content === msg.content);
    if (idx >= 0) {
      const mensajes = prev.map((m, i) => (i === idx ? msg : m));
      publicar(
        { mensajes: { ...estado.mensajes, [cid]: mensajes } },
        { origen: 'saliente-ok', id: cid }
      );
      return;
    }
  }

  const esActivo = estado.activoId === cid;
  const cambios = {};
  if (prev) cambios.mensajes = { ...estado.mensajes, [cid]: [...prev, msg] };

  cambios.chats = estado.chats
    .map((c) => {
      if (c.id !== cid) return c;
      const sumaNoLeido = msg.role === 'cliente' && !esActivo;
      return {
        ...c,
        ultimo_contenido: msg.content,
        ultimo_at: msg.created_at,
        ultimo_inbound_at:
          msg.role === 'cliente' ? msg.created_at : c.ultimo_inbound_at,
        no_leidos: sumaNoLeido ? (c.no_leidos ?? 0) + 1 : c.no_leidos,
      };
    })
    .sort(porFechaDesc);

  publicar(cambios, { origen: 'entrante', id: cid, role: msg.role, activo: esActivo });
}

/** Añade una burbuja optimista del staff. Devuelve el mensaje temporal. */
export function agregarMensajeOptimista(cid, content) {
  const msg = Object.freeze({
    id: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    customer_id: cid,
    role: 'staff',
    content,
    created_at: new Date().toISOString(),
    pendiente: true,
  });
  const prev = estado.mensajes[cid] ?? [];
  const chats = estado.chats
    .map((c) =>
      c.id === cid ? { ...c, ultimo_contenido: content, ultimo_at: msg.created_at } : c
    )
    .sort(porFechaDesc);
  publicar(
    { mensajes: { ...estado.mensajes, [cid]: [...prev, msg] }, chats },
    { origen: 'saliente', id: cid }
  );
  return msg;
}

/** Marca un mensaje optimista como confirmado (envío OK). */
export function confirmarMensaje(cid, msgId) {
  const prev = estado.mensajes[cid] ?? [];
  const mensajes = prev.map((m) =>
    m.id === msgId ? Object.freeze({ ...m, pendiente: false }) : m
  );
  publicar(
    { mensajes: { ...estado.mensajes, [cid]: mensajes } },
    { origen: 'saliente-ok', id: cid }
  );
}

/** Quita un mensaje optimista (envío falló → rollback). */
export function quitarMensaje(cid, msgId) {
  const prev = estado.mensajes[cid] ?? [];
  publicar(
    { mensajes: { ...estado.mensajes, [cid]: prev.filter((m) => m.id !== msgId) } },
    { origen: 'saliente-quita', id: cid }
  );
}

/** Fija el estado del bot (handoff) de un cliente — optimista o por realtime. */
export function fijarHandoff(cid, handoff) {
  const chats = estado.chats.map((c) => (c.id === cid ? { ...c, handoff } : c));
  publicar({ chats }, { origen: 'handoff', id: cid });
}

/**
 * Respaldo del chat ABIERTO: trae los mensajes más nuevos que el último
 * cargado y los aplica (append + dedupe). Hace que la conversación abierta se
 * actualice aunque el Realtime no entregue el evento. Solo en modo real.
 */
export async function refrescarActivo() {
  if (MODO_DEMO) return;
  const cid = estado.activoId;
  if (!cid) return;
  const cargados = estado.mensajes[cid];
  if (!cargados || !cargados.length) return;

  // Tiempo del último mensaje REAL (ignora burbujas optimistas tmp-).
  const reales = cargados.filter((m) => !String(m.id).startsWith('tmp-'));
  if (!reales.length) return;
  const desde = reales[reales.length - 1].created_at;

  try {
    const supabase = await obtenerCliente();
    const { data, error } = await supabase
      .from(TABLA_CONVERSACIONES)
      .select('*')
      .eq('customer_id', cid)
      .gt('created_at', desde)
      .order('created_at', { ascending: true });
    if (error) throw error;
    (data ?? []).forEach((fila) => aplicarMensajeEntrante(fila));
  } catch (err) {
    console.error('[bandeja] No se pudo refrescar el chat abierto:', err);
  }
}

// ------------------------------------------------------------
// Búsqueda de chats (en memoria)
// ------------------------------------------------------------
// Quita acentos sin depender de escapes unicode: NFD separa la marca
// diacrítica combinante (rango U+0300–U+036F) y se descarta por code point.
function normalizar(s) {
  let out = '';
  for (const ch of String(s ?? '').normalize('NFD')) {
    const code = ch.codePointAt(0);
    if (code >= 0x300 && code <= 0x36f) continue;
    out += ch;
  }
  return out.toLowerCase();
}

export function fijarBusquedaChats(texto) {
  publicar({ busqueda: texto }, { origen: 'busqueda' });
}

export function chatsFiltrados() {
  const aguja = normalizar(estado.busqueda.trim());
  if (!aguja) return estado.chats;
  return estado.chats.filter(
    (c) =>
      normalizar(c.nombre).includes(aguja) ||
      normalizar(c.telefono).includes(aguja) ||
      normalizar(c.ultimo_contenido).includes(aguja)
  );
}
