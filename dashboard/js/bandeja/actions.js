// ============================================================
// Jaguar Carwash — Bandeja: acciones del staff.
// Patrón: actualización optimista + rollback si el backend falla
// (idéntico a js/actions.js para las citas).
//
// El token de Meta NUNCA vive aquí: el envío pasa por la Edge Function
// `enviar-mensaje-staff`, que valida, aplica rate-limit y usa el secret.
// ============================================================

import { MODO_DEMO, FUNCION_ENVIAR_MENSAJE, MENSAJE_MAX_LARGO } from '../config.js';
import { obtenerCliente } from '../supabase.js';
import {
  fijarHandoff,
  agregarMensajeOptimista,
  confirmarMensaje,
  quitarMensaje,
} from './data.js';
import { toast } from '../ui.js';

// La BD guarda el teléfono como wa_id de WhatsApp, SIN '+' (ej. '51989453142').
// Por eso NUNCA lo reescribimos antes de mandarlo al backend: se pasa TAL CUAL
// para que el lookup de customers.phone haga match. El '+' es opcional al validar.
const REGEX_TEL = /^\+?[1-9]\d{7,14}$/;

/**
 * Quita caracteres de control C0 y DEL (conserva tab, salto de línea y
 * retorno) y recorta espacios. Se recorre por code point para no depender de
 * escapes unicode en el fuente.
 */
function limpiarTexto(s) {
  let out = '';
  for (const ch of String(s ?? '')) {
    const code = ch.codePointAt(0);
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) continue; // controles C0
    if (code === 127) continue; // DEL
    out += ch;
  }
  return out.trim();
}

/** Deja solo dígitos y un '+' inicial. SOLO para validar, no para enviar. */
const limpiarTel = (tel) => String(tel ?? '').replace(/[^\d+]/g, '');

function mensajeErrorEnvio(err) {
  const txt = String(err?.message ?? err ?? '');
  if (/24|plantilla|window|131047/i.test(txt))
    return 'No se entregó: pasaron +24 h. Meta exige una plantilla aprobada para reabrir el chat.';
  if (/429|l[ií]mite|rate/i.test(txt))
    return 'Vas muy rápido. Espera un momento antes de enviar más mensajes.';
  return 'No se pudo enviar el mensaje. Revisa tu conexión e inténtalo de nuevo.';
}

/**
 * Enciende/apaga el bot para un cliente (handoff).
 * `chat.handoff === true` ⇒ el humano atiende y el bot calla.
 * Se envía el ESTADO FINAL deseado (no un toggle sobre la BD) para no chocar
 * con el eco de Realtime.
 *
 * ⚠️ set_handoff(p_phone, p_activo): se asume p_activo = valor de `handoff`
 * (true ⇒ humano atiende). Verifica el cuerpo del RPC desplegado si el toggle
 * quedara invertido.
 *
 * SEGURIDAD: se llama a `staff_set_handoff` (wrapper con verificación es_staff,
 * migración 16), NO al `set_handoff` crudo — así el toggle no queda expuesto a
 * cualquier usuario autenticado.
 */
export async function alternarBot(chat) {
  if (!chat) return;
  const nuevoHandoff = !chat.handoff;

  fijarHandoff(chat.id, nuevoHandoff); // optimista

  try {
    if (!MODO_DEMO) {
      const supabase = await obtenerCliente();
      const { error } = await supabase.rpc('staff_set_handoff', {
        p_phone: chat.telefono, // TAL CUAL está en customers.phone (sin tocar)
        p_activo: nuevoHandoff,
      });
      if (error) throw error;
    }
    toast(
      nuevoHandoff ? '🔕 Bot apagado — ahora atiendes tú' : '🤖 Bot reactivado',
      nuevoHandoff ? 'info' : 'exito'
    );
  } catch (err) {
    console.error('[bandeja] No se pudo cambiar el handoff:', err);
    fijarHandoff(chat.id, chat.handoff); // rollback
    toast('No se pudo cambiar el estado del bot. Inténtalo de nuevo.', 'error');
  }
}

/**
 * Envía un mensaje del staff al cliente. Devuelve { ok }.
 * Valida en el cliente (defensa en profundidad), pinta una burbuja optimista
 * y confirma/revierte según la respuesta de la Edge Function.
 */
export async function enviarMensaje(chat, textoCrudo) {
  if (!chat) return { ok: false };

  const texto = limpiarTexto(textoCrudo);
  if (!texto) return { ok: false };
  if (texto.length > MENSAJE_MAX_LARGO) {
    toast(`El mensaje supera los ${MENSAJE_MAX_LARGO} caracteres.`, 'error');
    return { ok: false };
  }
  if (!REGEX_TEL.test(limpiarTel(chat.telefono))) {
    toast('El número del cliente no es válido para enviar por WhatsApp.', 'error');
    return { ok: false };
  }

  const optimista = agregarMensajeOptimista(chat.id, texto);

  try {
    if (MODO_DEMO) {
      await new Promise((r) => setTimeout(r, 450));
      confirmarMensaje(chat.id, optimista.id);
    } else {
      const supabase = await obtenerCliente();
      const { error } = await supabase.functions.invoke(FUNCION_ENVIAR_MENSAJE, {
        body: { phone: chat.telefono, text: texto }, // tal cual de la BD
      });
      if (error) throw error;
      // El eco de Realtime (mensaje_staff → conversations) reemplazará esta
      // burbuja optimista por la fila real (dedupe en data.js).
      confirmarMensaje(chat.id, optimista.id);
    }
    return { ok: true };
  } catch (err) {
    console.error('[bandeja] Envío falló, revirtiendo:', err);
    quitarMensaje(chat.id, optimista.id);
    toast(mensajeErrorEnvio(err), 'error');
    return { ok: false };
  }
}
