// ============================================================
// Jaguar Carwash — Bandeja: tiempo real.
// Demo: simulador que cada ~22 s inyecta un mensaje entrante.
// Real: canal Realtime de Supabase (INSERT en conversations +
// UPDATE en customers para el handoff) + polling de respaldo.
// ============================================================

import {
  MODO_DEMO,
  BANDEJA_TICK_DEMO_MS,
  BANDEJA_POLLING_MS,
  BANDEJA_REFRESCO_ACTIVO_MS,
  TABLA_CONVERSACIONES,
  TABLA_CLIENTES,
} from '../config.js';
import { obtenerCliente } from '../supabase.js';
import {
  obtenerEstado,
  aplicarMensajeEntrante,
  fijarHandoff,
  cargarChats,
  refrescarActivo,
} from './data.js';
import { mensajeDemoNuevo } from './demo.js';

let temporizadorDemo = null;
let temporizadorPolling = null;
let temporizadorActivo = null;
let canal = null;

// ------------------------------------------------------------
// Simulador (MODO_DEMO)
// ------------------------------------------------------------
function tickDemo() {
  const msg = mensajeDemoNuevo(obtenerEstado().chats);
  if (msg) aplicarMensajeEntrante(msg);
}

// ------------------------------------------------------------
// Supabase Realtime + polling (modo real)
// ------------------------------------------------------------
async function iniciarRealtimeSupabase(alEstadoConexion) {
  const supabase = await obtenerCliente();

  canal = supabase
    .channel('bandeja-conversaciones')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: TABLA_CONVERSACIONES },
      (payload) => {
        // La fila de conversations ya trae la forma que usa el front.
        if (payload.new) aplicarMensajeEntrante(payload.new);
      }
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: TABLA_CLIENTES },
      (payload) => {
        const cli = payload.new;
        if (cli?.id) fijarHandoff(cli.id, !!cli.handoff);
      }
    )
    .subscribe((estadoCanal) => alEstadoConexion?.(estadoCanal === 'SUBSCRIBED'));

  // Respaldo: si Realtime se cae, la lista igual se refresca.
  temporizadorPolling = setInterval(
    () => cargarChats({ silencioso: true }),
    BANDEJA_POLLING_MS
  );
}

// ------------------------------------------------------------
// API pública
// ------------------------------------------------------------
export async function iniciarTiempoRealBandeja(alEstadoConexion) {
  detenerTiempoRealBandeja();

  if (MODO_DEMO) {
    temporizadorDemo = setInterval(tickDemo, BANDEJA_TICK_DEMO_MS);
    alEstadoConexion?.(true);
    return;
  }

  // Respaldo del chat abierto: refresca cada pocos segundos aunque el Realtime
  // entregue tarde o falle. El dedupe por id evita duplicar mensajes.
  temporizadorActivo = setInterval(refrescarActivo, BANDEJA_REFRESCO_ACTIVO_MS);

  try {
    await iniciarRealtimeSupabase(alEstadoConexion);
  } catch (err) {
    console.error('[bandeja] Realtime no disponible, solo polling:', err);
    alEstadoConexion?.(false);
    temporizadorPolling = setInterval(
      () => cargarChats({ silencioso: true }),
      BANDEJA_POLLING_MS
    );
  }
}

export function detenerTiempoRealBandeja() {
  if (temporizadorDemo) clearInterval(temporizadorDemo);
  if (temporizadorPolling) clearInterval(temporizadorPolling);
  if (temporizadorActivo) clearInterval(temporizadorActivo);
  temporizadorDemo = null;
  temporizadorPolling = null;
  temporizadorActivo = null;
  if (canal) {
    canal.unsubscribe();
    canal = null;
  }
}
