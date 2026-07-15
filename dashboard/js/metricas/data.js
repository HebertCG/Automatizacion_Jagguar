// ============================================================
// Jaguar Carwash — Métricas: store (carga UNA vez, sin polling).
// 4 consultas a vistas ya agregadas al abrir la sección. Nada más.
// ============================================================

import {
  MODO_DEMO,
  VISTA_EMBUDO,
  VISTA_METRICAS_DIARIAS,
  VISTA_INGRESOS_SERVICIO,
  VISTA_RANKING_CLIENTES,
} from '../config.js';
import { obtenerCliente } from '../supabase.js';
import { generarMetricasDemo } from './demo.js';

let estado = Object.freeze({
  embudo: null,
  serie: [],
  servicios: [],
  ranking: [],
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

export async function cargarMetricas({ silencioso = false } = {}) {
  if (!silencioso) publicar({ cargando: true }, { origen: 'carga' });

  if (MODO_DEMO) {
    if (!silencioso) await new Promise((r) => setTimeout(r, 500));
    const { embudo, serie, servicios, ranking } = generarMetricasDemo();
    publicar({ embudo, serie, servicios, ranking, cargando: false }, { origen: 'carga' });
    return;
  }
  try {
    const supabase = await obtenerCliente();
    // 4 consultas en paralelo a vistas agregadas (no hay N+1).
    const [emb, ser, srv, rnk] = await Promise.all([
      supabase.from(VISTA_EMBUDO).select('*').maybeSingle(),
      supabase.from(VISTA_METRICAS_DIARIAS).select('*'),
      supabase.from(VISTA_INGRESOS_SERVICIO).select('*'),
      supabase.from(VISTA_RANKING_CLIENTES).select('*'),
    ]);
    if (emb.error) throw emb.error;
    if (ser.error) throw ser.error;
    if (srv.error) throw srv.error;
    if (rnk.error) throw rnk.error;
    publicar(
      {
        embudo: emb.data ?? null,
        serie: ser.data ?? [],
        servicios: srv.data ?? [],
        ranking: rnk.data ?? [],
        cargando: false,
      },
      { origen: 'carga' }
    );
  } catch (err) {
    console.error('[metricas] Error al cargar:', err);
    publicar({ cargando: false }, { origen: 'error', mensaje: 'No pudimos cargar las métricas.' });
  }
}

/** KPIs derivados (en memoria, sin consulta). */
export function kpis() {
  const e = estado.embudo;
  const ingresos30 = estado.serie.reduce((s, d) => s + Number(d.ingresos || 0), 0);
  const completadas30 = estado.serie.reduce((s, d) => s + Number(d.completadas || 0), 0);
  const tasa =
    e && e.escribieron > 0 ? Math.round((e.completaron / e.escribieron) * 100) : 0;
  const ticket = completadas30 > 0 ? Math.round(ingresos30 / completadas30) : 0;
  return {
    escribieron: e?.escribieron ?? 0,
    completaron: e?.completaron ?? 0,
    tasaConversion: tasa,
    ingresos30,
    ticket,
  };
}
