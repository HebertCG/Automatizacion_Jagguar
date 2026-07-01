// ============================================================
// Jaguar Carwash — Tiempo real.
// Demo: simulador que cada ~25s avanza una cita o crea una nueva.
// Real: canal Realtime de Supabase + polling de respaldo (20s).
// ============================================================

import {
  MODO_DEMO,
  DEMO_TICK_MS,
  POLLING_INTERVALO_MS,
  TABLA_CITAS,
  VISTA_CITAS,
  SIGUIENTE_ESTADO,
  SERVICIOS,
} from './config.js';
import { obtenerCliente } from './supabase.js';
import {
  obtenerEstado,
  aplicarCita,
  cargarCitas,
  primeraBahiaLibre,
  NOMBRES_DEMO,
} from './data.js';
import { toast } from './ui.js';

let temporizadorDemo = null;
let temporizadorPolling = null;
let canal = null;
let contadorDemo = 0;

// ------------------------------------------------------------
// Simulador (MODO_DEMO)
// ------------------------------------------------------------
const azar = (lista) => lista[Math.floor(Math.random() * lista.length)];

function crearCitaDemoNueva() {
  contadorDemo += 1;
  const tipos = ['auto', 'suv', 'camioneta', 'moto'];
  const servicios = ['basico', 'premium', 'detailing'];
  const tipo = azar(tipos);
  const servicio = azar(servicios);
  const letras = 'ABCDEFGHJKLMNPRSTUVWXYZ';
  const placa = `${azar(letras)}${Math.floor(Math.random() * 9) + 1}${azar(letras)}-${100 + Math.floor(Math.random() * 900)}`;

  // Cita para dentro de 1 a 3 horas, hoy.
  const fecha = new Date(Date.now() + (60 + Math.floor(Math.random() * 120)) * 60_000);

  return {
    id: `JC-N${String(contadorDemo).padStart(2, '0')}-${Date.now()}`,
    cliente: azar(NOMBRES_DEMO),
    telefono: `+51 9${String(10_000_000 + Math.floor(Math.random() * 89_999_999)).slice(0, 8)}`,
    placa,
    tipo_vehiculo: tipo,
    servicio,
    precio: SERVICIOS[servicio].precios[tipo],
    fecha_hora: fecha.toISOString(),
    bahia: null,
    estado: 'pendiente',
    notas: '',
    iniciado_en: null,
  };
}

function tickDemo() {
  const { citas } = obtenerEstado();
  const avanzables = citas.filter((c) => SIGUIENTE_ESTADO[c.estado]);

  // ~30% de las veces (o si no hay nada que avanzar) entra una cita nueva.
  if (avanzables.length === 0 || Math.random() < 0.3) {
    const nueva = crearCitaDemoNueva();
    aplicarCita(nueva, 'tiemporeal');
    toast(`📥 Nueva cita por WhatsApp: ${nueva.cliente} (${nueva.placa})`, 'info');
    return;
  }

  const cita = azar(avanzables);
  const destino = SIGUIENTE_ESTADO[cita.estado];
  const cambios = { ...cita, estado: destino };

  if (destino === 'en_proceso') {
    const bahia = primeraBahiaLibre();
    if (bahia === null) return; // sin bahías: el tick pasa sin cambios
    cambios.bahia = bahia;
    cambios.iniciado_en = new Date().toISOString();
  }
  aplicarCita(cambios, 'tiemporeal');
}

// ------------------------------------------------------------
// Supabase Realtime + polling de respaldo (modo real)
// ------------------------------------------------------------
async function traerCitaDeVista(id) {
  try {
    const supabase = await obtenerCliente();
    const { data, error } = await supabase
      .from(VISTA_CITAS)
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (data) aplicarCita(data, 'tiemporeal');
  } catch (err) {
    console.error('[realtime] No se pudo leer la cita cambiada:', err);
  }
}

async function iniciarRealtimeSupabase(alEstadoConexion) {
  const supabase = await obtenerCliente();

  canal = supabase
    .channel('citas-cambios')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLA_CITAS },
      (payload) => {
        const id = payload.new?.id ?? payload.old?.id;
        if (id) traerCitaDeVista(id);
      }
    )
    .subscribe((estadoCanal) => {
      alEstadoConexion?.(estadoCanal === 'SUBSCRIBED');
    });

  // Polling de respaldo: si Realtime se cae, la data igual se refresca.
  temporizadorPolling = setInterval(() => {
    cargarCitas({ silencioso: true });
  }, POLLING_INTERVALO_MS);
}

// ------------------------------------------------------------
// API pública
// ------------------------------------------------------------

/**
 * Inicia el flujo de tiempo real.
 * `alEstadoConexion(conectado)` permite actualizar el indicador "En vivo".
 */
export async function iniciarTiempoReal(alEstadoConexion) {
  detenerTiempoReal();

  if (MODO_DEMO) {
    temporizadorDemo = setInterval(tickDemo, DEMO_TICK_MS);
    alEstadoConexion?.(true);
    return;
  }

  try {
    await iniciarRealtimeSupabase(alEstadoConexion);
  } catch (err) {
    console.error('[realtime] Realtime no disponible, queda solo el polling:', err);
    alEstadoConexion?.(false);
    temporizadorPolling = setInterval(() => {
      cargarCitas({ silencioso: true });
    }, POLLING_INTERVALO_MS);
  }
}

export function detenerTiempoReal() {
  if (temporizadorDemo) clearInterval(temporizadorDemo);
  if (temporizadorPolling) clearInterval(temporizadorPolling);
  temporizadorDemo = null;
  temporizadorPolling = null;
  if (canal) {
    canal.unsubscribe();
    canal = null;
  }
}
