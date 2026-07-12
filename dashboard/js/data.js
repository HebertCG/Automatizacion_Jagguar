// ============================================================
// Jaguar Carwash — Datos: store inmutable, datos de muestra,
// filtros en memoria, KPIs, bahías y series para gráficos.
// ============================================================

import {
  MODO_DEMO,
  VISTA_CITAS,
  SERVICIOS,
  ESTADOS_SIN_INGRESO,
  NUM_BAHIAS,
} from './config.js';
import { obtenerCliente } from './supabase.js';

// ------------------------------------------------------------
// Store (patrón observador; el estado NUNCA se muta, se reemplaza)
// ------------------------------------------------------------
let estado = Object.freeze({
  citas: [],
  filtro: 'hoy',
  busqueda: '',
  cargando: true,
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

// ------------------------------------------------------------
// Utilidades de fecha (comparaciones por día calendario)
// ------------------------------------------------------------
const inicioDia = (fecha) => {
  const d = new Date(fecha);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const HOY = () => inicioDia(new Date());
const DIA_MS = 24 * 60 * 60 * 1000;

export const esHoy = (iso) => inicioDia(new Date(iso)) === HOY();
export const esManana = (iso) => inicioDia(new Date(iso)) === HOY() + DIA_MS;
export const enSemana = (iso) => {
  const dia = inicioDia(new Date(iso));
  return dia >= HOY() && dia < HOY() + 7 * DIA_MS;
};

// ------------------------------------------------------------
// Datos de muestra (MODO_DEMO)
// ------------------------------------------------------------
export const NOMBRES_DEMO = [
  'Alejandra Ponce', 'Bruno Cáceres', 'Camila Ríos', 'Daniel Huapaya',
  'Estefanía Loayza', 'Franco Medina', 'Gabriela Soto', 'Hernán Zapata',
];

// dia: offset en días desde hoy · minAtras: para citas en proceso
const CITAS_BASE = [
  // ---- HOY: mañana ya trabajada -------------------------------
  { nombre: 'Carlos Quispe', tel: '987 654 321', placa: 'M2X-456', tipo: 'auto', servicio: 'basico', dia: 0, hora: 8, min: 0, estado: 'completada', bahia: 1 },
  { nombre: 'María Fernández', tel: '912 345 678', placa: 'A3B-789', tipo: 'suv', servicio: 'premium', dia: 0, hora: 8, min: 30, estado: 'completada', bahia: 2 },
  { nombre: 'Jorge Villanueva', tel: '955 123 456', placa: 'B7C-123', tipo: 'camioneta', servicio: 'basico', dia: 0, hora: 9, min: 30, estado: 'completada', bahia: 3 },
  { nombre: 'Rosa Cárdenas', tel: '998 765 432', placa: 'C1D-654', tipo: 'auto', servicio: 'detailing', dia: 0, hora: 10, min: 0, estado: 'listo', bahia: 4, notas: 'Pidió cera "extra brillo" y aspirado profundo' },
  { nombre: 'Luis Mamani', tel: '944 555 111', placa: 'T4F-908', tipo: 'moto', servicio: 'basico', dia: 0, hora: 10, min: 30, estado: 'listo', bahia: 1 },
  // ---- HOY: en las bahías ahora mismo -------------------------
  { nombre: 'Milagros Chávez', tel: '987 111 222', placa: 'F8J-265', tipo: 'camioneta', servicio: 'detailing', dia: 0, minAtras: 75, estado: 'en_proceso', bahia: 1 },
  { nombre: 'Carmen Rojas', tel: '921 888 777', placa: 'V2G-317', tipo: 'suv', servicio: 'premium', dia: 0, minAtras: 32, estado: 'en_proceso', bahia: 2 },
  { nombre: 'Pedro Salazar', tel: '963 222 444', placa: 'W5H-742', tipo: 'auto', servicio: 'basico', dia: 0, minAtras: 12, estado: 'en_proceso', bahia: 3 },
  // ---- HOY: por venir ------------------------------------------
  { nombre: 'Ana Lucía Torres', tel: '999 333 555', placa: 'D6K-431', tipo: 'auto', servicio: 'premium', dia: 0, hora: 15, min: 0, estado: 'confirmada' },
  { nombre: 'Ricardo Paredes', tel: '954 777 888', placa: 'H3L-590', tipo: 'suv', servicio: 'basico', dia: 0, hora: 16, min: 0, estado: 'confirmada' },
  { nombre: 'Fiorella Gutiérrez', tel: '913 444 666', placa: 'P7M-186', tipo: 'auto', servicio: 'basico', dia: 0, hora: 17, min: 0, estado: 'pendiente', notas: 'Avisó que llega 10 min tarde' },
  { nombre: 'Óscar Ramírez', tel: '976 555 000', placa: 'R9N-823', tipo: 'moto', servicio: 'premium', dia: 0, hora: 17, min: 30, estado: 'pendiente' },
  // ---- HOY: bajas ----------------------------------------------
  { nombre: 'Katherine Núñez', tel: '932 666 111', placa: 'S1P-467', tipo: 'auto', servicio: 'basico', dia: 0, hora: 11, min: 0, estado: 'cancelada' },
  { nombre: 'Miguel Ángel Castro', tel: '968 000 999', placa: 'U4Q-935', tipo: 'suv', servicio: 'basico', dia: 0, hora: 9, min: 0, estado: 'no_show' },
  // ---- MAÑANA --------------------------------------------------
  { nombre: 'Vanessa Aguilar', tel: '941 222 333', placa: 'X2R-678', tipo: 'auto', servicio: 'premium', dia: 1, hora: 9, min: 0, estado: 'confirmada' },
  { nombre: 'Renzo Delgado', tel: '957 888 444', placa: 'Y6S-249', tipo: 'camioneta', servicio: 'basico', dia: 1, hora: 11, min: 0, estado: 'pendiente' },
  { nombre: 'Claudia Espinoza', tel: '919 555 777', placa: 'Z8T-513', tipo: 'suv', servicio: 'detailing', dia: 1, hora: 15, min: 30, estado: 'pendiente' },
  // ---- RESTO DE LA SEMANA --------------------------------------
  { nombre: 'Hugo Ccahuana', tel: '925 111 888', placa: 'E5V-380', tipo: 'auto', servicio: 'basico', dia: 2, hora: 10, min: 0, estado: 'pendiente' },
  { nombre: 'Lucía Béjar', tel: '948 999 222', placa: 'G4W-712', tipo: 'moto', servicio: 'basico', dia: 3, hora: 12, min: 30, estado: 'confirmada' },
  { nombre: 'Diego Apaza', tel: '936 444 111', placa: 'K9Y-158', tipo: 'suv', servicio: 'premium', dia: 4, hora: 16, min: 0, estado: 'pendiente' },
];

/** Convierte una spec compacta en una cita completa con precio real. */
function construirCita(spec, indice) {
  const base = new Date();
  let fechaHora;
  if (typeof spec.minAtras === 'number') {
    fechaHora = new Date(Date.now() - spec.minAtras * 60_000);
  } else {
    fechaHora = new Date(base);
    fechaHora.setDate(base.getDate() + spec.dia);
    fechaHora.setHours(spec.hora, spec.min ?? 0, 0, 0);
  }
  return Object.freeze({
    id: `JC-${String(indice + 1).padStart(3, '0')}`,
    cliente: spec.nombre,
    telefono: `+51 ${spec.tel}`,
    placa: spec.placa,
    tipo_vehiculo: spec.tipo,
    servicio: spec.servicio,
    precio: SERVICIOS[spec.servicio].precios[spec.tipo],
    fecha_hora: fechaHora.toISOString(),
    bahia: spec.bahia ?? null,
    estado: spec.estado,
    notas: spec.notas ?? '',
    iniciado_en: spec.estado === 'en_proceso' ? fechaHora.toISOString() : null,
  });
}

export function generarCitasDemo() {
  return CITAS_BASE.map(construirCita);
}

// ------------------------------------------------------------
// Carga de datos (demo o Supabase)
// ------------------------------------------------------------

/**
 * Adapta una fila de v_citas al formato del front:
 * bahía 'B01' → 1, precio numérico, campos opcionales seguros.
 */
export function normalizarCitaReal(fila) {
  const numeroBahia = fila.bahia
    ? Number(String(fila.bahia).replace(/\D/g, '')) || null
    : null;
  return Object.freeze({
    ...fila,
    precio: Number(fila.precio) || 0,
    bahia: numeroBahia,
    notas: fila.notas ?? '',
    iniciado_en: fila.iniciado_en ?? null,
  });
}
export async function cargarCitas({ silencioso = false } = {}) {
  if (!silencioso) publicar({ cargando: true }, { origen: 'carga' });

  if (MODO_DEMO) {
    // Simula latencia de red para mostrar los skeleton loaders.
    if (!silencioso) await new Promise((r) => setTimeout(r, 700));
    publicar({ citas: generarCitasDemo(), cargando: false }, { origen: 'carga' });
    return;
  }

  try {
    const supabase = await obtenerCliente();
    const { data, error } = await supabase
      .from(VISTA_CITAS)
      .select('*')
      .order('fecha_hora', { ascending: true });
    if (error) throw error;
    publicar({ citas: (data ?? []).map(normalizarCitaReal), cargando: false }, { origen: 'carga' });
  } catch (err) {
    console.error('[data] Error al cargar citas:', err);
    publicar({ cargando: false }, { origen: 'error', mensaje: 'No pudimos cargar las citas.' });
  }
}

// ------------------------------------------------------------
// Mutaciones inmutables sobre la colección
// ------------------------------------------------------------

/** Inserta o reemplaza una cita. Devuelve si era nueva. */
export function aplicarCita(cita, origen = 'tiemporeal') {
  const existe = estado.citas.some((c) => c.id === cita.id);
  const citas = existe
    ? estado.citas.map((c) => (c.id === cita.id ? Object.freeze({ ...c, ...cita }) : c))
    : [...estado.citas, Object.freeze(cita)].sort(
        (a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora)
      );
  publicar({ citas }, { origen, tipo: existe ? 'cambio' : 'nueva', id: cita.id });
  return !existe;
}

/**
 * Cambia el estado de una cita (optimista). Devuelve la versión
 * anterior para poder revertir si el backend falla.
 */
export function actualizarEstadoCita(id, nuevoEstado, origen = 'accion') {
  const anterior = estado.citas.find((c) => c.id === id);
  if (!anterior) return null;

  const cambios = { estado: nuevoEstado };
  if (nuevoEstado === 'en_proceso') {
    cambios.bahia = anterior.bahia ?? primeraBahiaLibre();
    cambios.iniciado_en = new Date().toISOString();
  }
  aplicarCita({ ...anterior, ...cambios }, origen);
  return anterior;
}

/** Revierte una cita a una versión previa (rollback optimista). */
export function revertirCita(citaAnterior) {
  if (citaAnterior) aplicarCita(citaAnterior, 'rollback');
}

export function buscarCita(id) {
  return estado.citas.find((c) => c.id === id) ?? null;
}

// ------------------------------------------------------------
// Filtros y búsqueda (en memoria, instantáneos)
// ------------------------------------------------------------
export function fijarFiltro(filtro) {
  publicar({ filtro }, { origen: 'filtro' });
}

export function fijarBusqueda(texto) {
  publicar({ busqueda: texto }, { origen: 'busqueda' });
}

const normalizar = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const FILTROS_FECHA = {
  hoy: (c) => esHoy(c.fecha_hora),
  manana: (c) => esManana(c.fecha_hora),
  semana: (c) => enSemana(c.fecha_hora),
  todas: () => true,
};

function coincideBusqueda(cita, aguja) {
  if (!aguja) return true;
  return (
    normalizar(cita.cliente).includes(aguja) ||
    normalizar(cita.placa).includes(aguja) ||
    normalizar(cita.dni).includes(aguja)
  );
}

export function citasFiltradas() {
  const porFecha = FILTROS_FECHA[estado.filtro] ?? FILTROS_FECHA.todas;
  const aguja = normalizar(estado.busqueda.trim());
  return estado.citas.filter((c) => porFecha(c) && coincideBusqueda(c, aguja));
}

/** Conteo por chip (respeta la búsqueda activa → "conteo en vivo"). */
export function conteosPorFiltro() {
  const aguja = normalizar(estado.busqueda.trim());
  const visibles = estado.citas.filter((c) => coincideBusqueda(c, aguja));
  return {
    hoy: visibles.filter(FILTROS_FECHA.hoy).length,
    manana: visibles.filter(FILTROS_FECHA.manana).length,
    semana: visibles.filter(FILTROS_FECHA.semana).length,
    todas: visibles.length,
  };
}

// ------------------------------------------------------------
// KPIs del día
// ------------------------------------------------------------
export function calcularKpis() {
  const deHoy = estado.citas.filter((c) => esHoy(c.fecha_hora));
  return {
    citasHoy: deHoy.length,
    enProceso: deHoy.filter((c) => c.estado === 'en_proceso').length,
    listos: deHoy.filter((c) => c.estado === 'listo').length,
    completadas: deHoy.filter((c) => c.estado === 'completada').length,
    ingresos: deHoy
      .filter((c) => !ESTADOS_SIN_INGRESO.includes(c.estado))
      .reduce((suma, c) => suma + (Number(c.precio) || 0), 0),
  };
}

// ------------------------------------------------------------
// Bahías
// ------------------------------------------------------------
export function estadoBahias() {
  const enProceso = estado.citas.filter((c) => c.estado === 'en_proceso');
  return Array.from({ length: NUM_BAHIAS }, (_, i) => {
    const numero = i + 1;
    const cita = enProceso.find((c) => c.bahia === numero) ?? null;
    if (!cita) return { numero, cita: null, progreso: 0, restanteMin: 0 };

    const duracionMs =
      (Number(cita.duracion_min) || SERVICIOS[cita.servicio]?.duracionMin || 60) * 60_000;
    const inicio = new Date(cita.iniciado_en ?? cita.fecha_hora).getTime();
    const progreso = Math.min(Math.max((Date.now() - inicio) / duracionMs, 0.04), 0.97);
    const restanteMin = Math.max(Math.round((duracionMs * (1 - progreso)) / 60_000), 1);
    return { numero, cita, progreso, restanteMin };
  });
}

export function primeraBahiaLibre() {
  const ocupadas = new Set(
    estado.citas.filter((c) => c.estado === 'en_proceso').map((c) => c.bahia)
  );
  for (let n = 1; n <= NUM_BAHIAS; n += 1) {
    if (!ocupadas.has(n)) return n;
  }
  return null;
}

// ------------------------------------------------------------
// Series para los gráficos
// ------------------------------------------------------------

/** Conteo de citas por estado (toda la colección cargada). */
export function serieDona() {
  const conteo = {};
  estado.citas.forEach((c) => {
    conteo[c.estado] = (conteo[c.estado] ?? 0) + 1;
  });
  return conteo;
}

/** Citas por día de la semana actual (Lun → Dom). */
export function serieBarras() {
  const ahora = new Date();
  const diaSemana = (ahora.getDay() + 6) % 7; // 0 = lunes
  const lunes = HOY() - diaSemana * DIA_MS;

  const valores = new Array(7).fill(0);
  estado.citas.forEach((c) => {
    const dia = inicioDia(new Date(c.fecha_hora));
    const indice = Math.floor((dia - lunes) / DIA_MS);
    if (indice >= 0 && indice < 7) valores[indice] += 1;
  });
  return { valores, hoyIndice: diaSemana };
}
