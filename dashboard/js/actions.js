// ============================================================
// Jaguar Carwash — Acciones del staff sobre las citas.
// Patrón: actualización optimista + rollback si el backend falla.
// ============================================================

import { MODO_DEMO, TABLA_CITAS, ACCIONES_POR_ESTADO } from './config.js';
import { obtenerCliente } from './supabase.js';
import {
  buscarCita,
  actualizarEstadoCita,
  revertirCita,
  primeraBahiaLibre,
} from './data.js';
import { toast, confirmar } from './ui.js';

/** Mensajes de éxito por acción (el nombre se interpola como texto plano). */
const MENSAJES = {
  confirmar: (c) => [`✅ Cita de ${c.cliente} confirmada`, 'exito'],
  iniciar: (c) => [`🧽 Servicio de ${c.placa || c.cliente} iniciado en la bahía ${c.bahia ?? '—'}`, 'info'],
  listo: (c) => [`🚗✨ ¡El vehículo de ${c.cliente} está listo! Se le avisará por WhatsApp`, 'listo'],
  completar: (c) => [`✔ Cita de ${c.cliente} completada. ¡Buen trabajo!`, 'exito'],
  cancelar: (c) => [`✖ Cita de ${c.cliente} cancelada`, 'error'],
};

/** Persiste el cambio en Supabase (solo modo real). Lanza si falla. */
async function persistirCambio(id, nuevoEstado) {
  if (MODO_DEMO) return; // en demo el store local es la única verdad

  const supabase = await obtenerCliente();
  // La RLS del panel solo permite al staff actualizar la columna `status`
  // (07-dashboard_security.sql) y en la BD la columna se llama status, no estado.
  const { error } = await supabase.from(TABLA_CITAS).update({ status: nuevoEstado }).eq('id', id);
  if (error) throw error;
}

/**
 * Ejecuta una acción del staff sobre una cita.
 * Valida que la acción sea legal para el estado actual (nunca se
 * confía en el DOM: el atributo data-accion podría estar manipulado).
 */
export async function ejecutarAccion(id, accion) {
  const cita = buscarCita(id);
  if (!cita) {
    toast('Esa cita ya no existe. Actualizando la lista…', 'error');
    return;
  }

  const definicion = (ACCIONES_POR_ESTADO[cita.estado] ?? []).find(
    (a) => a.accion === accion
  );
  if (!definicion) {
    toast('Esa acción ya no aplica para esta cita.', 'error');
    return;
  }

  // Confirmación explícita antes de cancelar (acción destructiva).
  if (accion === 'cancelar') {
    const seguro = await confirmar({
      titulo: '¿Cancelar esta cita?',
      mensaje: `Se cancelará la cita de ${cita.cliente} (${cita.placa || cita.tipo_vehiculo || 'vehículo'}). Esta acción no se puede deshacer.`,
      textoOk: 'Sí, cancelar cita',
    });
    if (!seguro) return;
  }

  // Si va a iniciar lavado y no hay bahía libre, avisar y no forzar.
  if (accion === 'iniciar' && !cita.bahia && primeraBahiaLibre() === null) {
    toast('Las 4 bahías están ocupadas. Libera una antes de iniciar otro lavado.', 'error');
    return;
  }

  // 1) Actualización optimista: la UI responde al instante.
  const version_anterior = actualizarEstadoCita(id, definicion.destino);

  // 2) Persistencia real (si aplica) con rollback ante error.
  try {
    await persistirCambio(id, definicion.destino);
    const citaActualizada = buscarCita(id) ?? cita;
    const [mensaje, tipo] = MENSAJES[accion](citaActualizada);
    toast(mensaje, tipo);
  } catch (err) {
    console.error('[actions] Falló la persistencia, revirtiendo:', err);
    revertirCita(version_anterior);
    toast('No se pudo guardar el cambio. Revisa tu conexión e inténtalo de nuevo.', 'error');
  }
}

/** Delegación de eventos: un solo listener para toda la tabla/cards. */
export function conectarAcciones() {
  document.addEventListener('click', (evento) => {
    const boton = evento.target.closest('[data-accion][data-id]');
    if (!boton) return;
    boton.disabled = true; // evita doble click
    ejecutarAccion(boton.dataset.id, boton.dataset.accion).finally(() => {
      boton.disabled = false;
    });
  });
}
