// ============================================================
// Jaguar Carwash — Clientes: store inmutable (patrón observador).
//
// EFICIENCIA: cargarClientes() hace UNA consulta a v_clientes (todo agregado
// server-side). Los filtros/búsqueda son EN MEMORIA. La ficha es UNA llamada
// (ficha_cliente). Nada de una consulta por cliente ni polling.
// ============================================================

import {
  MODO_DEMO,
  VISTA_CLIENTES,
  FUNCION_FICHA,
  CLIENTE_DORMIDO_DIAS,
} from '../config.js';
import { obtenerCliente } from '../supabase.js';
import { generarClientesDemo, generarFichaDemo } from './demo.js';

let estado = Object.freeze({
  clientes: [],
  busqueda: '',
  filtro: 'todos', // todos | dormidos | <tag-slug>
  cargando: true,
  fichaId: null,
  ficha: null,
  cargandoFicha: false,
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
export const buscarCliente = (id) => estado.clientes.find((c) => c.id === id) ?? null;

function normalizar(fila) {
  return Object.freeze({
    id: fila.id,
    nombre: fila.nombre || fila.telefono || 'Cliente',
    telefono: fila.telefono ?? '',
    dni: fila.dni ?? '',
    handoff: !!fila.handoff,
    mensajes: Number(fila.mensajes) || 0,
    total_citas: Number(fila.total_citas) || 0,
    confirmadas: Number(fila.confirmadas) || 0,
    completadas: Number(fila.completadas) || 0,
    canceladas: Number(fila.canceladas) || 0,
    gasto: Number(fila.gasto) || 0,
    ultima_visita: fila.ultima_visita ?? null,
    tags: Array.isArray(fila.tags) ? fila.tags : [],
  });
}

// ------------------------------------------------------------
// Carga (1 consulta)
// ------------------------------------------------------------
export async function cargarClientes({ silencioso = false } = {}) {
  if (!silencioso) publicar({ cargando: true }, { origen: 'carga' });

  if (MODO_DEMO) {
    if (!silencioso) await new Promise((r) => setTimeout(r, 450));
    publicar({ clientes: generarClientesDemo(), cargando: false }, { origen: 'carga' });
    return;
  }
  try {
    const supabase = await obtenerCliente();
    const { data, error } = await supabase
      .from(VISTA_CLIENTES)
      .select('*')
      .order('gasto', { ascending: false });
    if (error) throw error;
    publicar(
      { clientes: (data ?? []).map(normalizar), cargando: false },
      { origen: 'carga' }
    );
  } catch (err) {
    console.error('[clientes] Error al cargar:', err);
    publicar({ cargando: false }, { origen: 'error', mensaje: 'No pudimos cargar los clientes.' });
  }
}

// ------------------------------------------------------------
// Ficha (1 llamada)
// ------------------------------------------------------------
export async function abrirFicha(id) {
  publicar({ fichaId: id, ficha: null, cargandoFicha: true }, { origen: 'ficha-abrir', id });

  if (MODO_DEMO) {
    await new Promise((r) => setTimeout(r, 300));
    const cliente = buscarCliente(id);
    publicar({ ficha: cliente ? generarFichaDemo(cliente) : null, cargandoFicha: false }, { origen: 'ficha', id });
    return;
  }
  try {
    const supabase = await obtenerCliente();
    const { data, error } = await supabase.rpc(FUNCION_FICHA, { p_id: id });
    if (error) throw error;
    publicar({ ficha: data ?? null, cargandoFicha: false }, { origen: 'ficha', id });
  } catch (err) {
    console.error('[clientes] Error al cargar ficha:', err);
    publicar({ cargandoFicha: false }, { origen: 'error', mensaje: 'No pudimos abrir la ficha.' });
  }
}

export function cerrarFicha() {
  publicar({ fichaId: null, ficha: null }, { origen: 'ficha-cerrar' });
}

// Actualiza la ficha en memoria (tras agregar nota / alternar tag).
export function fijarFicha(ficha) {
  publicar({ ficha }, { origen: 'ficha-actualiza', id: estado.fichaId });
}

// Mantén sincronizada la lista cuando cambian los tags de un cliente.
export function fijarTagsCliente(id, tags) {
  const clientes = estado.clientes.map((c) => (c.id === id ? { ...c, tags } : c));
  publicar({ clientes }, { origen: 'tags', id });
}

// ------------------------------------------------------------
// Filtros y búsqueda (en memoria)
// ------------------------------------------------------------
export function fijarBusqueda(texto) {
  publicar({ busqueda: texto }, { origen: 'filtro' });
}
export function fijarFiltro(filtro) {
  publicar({ filtro }, { origen: 'filtro' });
}

const sinAcentos = (s) => {
  let out = '';
  for (const ch of String(s ?? '').normalize('NFD')) {
    const code = ch.codePointAt(0);
    if (code >= 0x300 && code <= 0x36f) continue;
    out += ch;
  }
  return out.toLowerCase();
};

const DORMIDO_MS = CLIENTE_DORMIDO_DIAS * 86_400_000;
export const esDormido = (c) =>
  c.ultima_visita != null && Date.now() - new Date(c.ultima_visita).getTime() > DORMIDO_MS;

export function clientesFiltrados() {
  const aguja = sinAcentos(estado.busqueda.trim());
  const f = estado.filtro;
  return estado.clientes.filter((c) => {
    if (aguja) {
      const coincide =
        sinAcentos(c.nombre).includes(aguja) ||
        sinAcentos(c.telefono).includes(aguja) ||
        sinAcentos(c.dni).includes(aguja);
      if (!coincide) return false;
    }
    if (f === 'todos') return true;
    if (f === 'dormidos') return esDormido(c);
    return c.tags.includes(f); // filtro por etiqueta
  });
}

/** Totales del encabezado (derivados en memoria, sin consulta). */
export function resumenClientes() {
  const cs = estado.clientes;
  return {
    total: cs.length,
    conReserva: cs.filter((c) => c.total_citas > 0).length,
    dormidos: cs.filter(esDormido).length,
    gasto: cs.reduce((s, c) => s + c.gasto, 0),
  };
}
