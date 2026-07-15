// ============================================================
// Jaguar Carwash — Clientes: acciones (notas y etiquetas).
// Optimista + rollback, igual que el resto de la app.
// ============================================================

import { MODO_DEMO, TABLA_NOTAS, TABLA_TAGS } from '../config.js';
import { obtenerCliente } from '../supabase.js';
import * as datos from './data.js';
import { toast } from '../ui.js';

export async function agregarNota(texto) {
  const st = datos.obtenerEstado();
  const id = st.fichaId;
  const contenido = String(texto ?? '').trim();
  if (!id || !contenido || !st.ficha) return;

  const nota = {
    id: `tmp-${Date.now()}`,
    autor: 'tú',
    contenido,
    creado: new Date().toISOString(),
  };
  datos.fijarFicha({ ...st.ficha, notas: [nota, ...(st.ficha.notas ?? [])] });

  if (MODO_DEMO) {
    toast('Nota guardada', 'exito');
    return;
  }
  try {
    const supabase = await obtenerCliente();
    // author_email lo pone la BD por defecto (auth.jwt email).
    const { error } = await supabase.from(TABLA_NOTAS).insert({ customer_id: id, content: contenido });
    if (error) throw error;
    toast('Nota guardada', 'exito');
  } catch (err) {
    console.error('[clientes] No se pudo guardar la nota:', err);
    const f = datos.obtenerEstado().ficha;
    if (f) datos.fijarFicha({ ...f, notas: (f.notas ?? []).filter((n) => n.id !== nota.id) });
    toast('No se pudo guardar la nota.', 'error');
  }
}

export async function alternarTag(slug) {
  const st = datos.obtenerEstado();
  const id = st.fichaId;
  if (!id || !st.ficha) return;

  const previos = st.ficha.tags ?? [];
  const tiene = previos.includes(slug);
  const nuevos = tiene ? previos.filter((t) => t !== slug) : [...previos, slug];

  datos.fijarFicha({ ...st.ficha, tags: nuevos });
  datos.fijarTagsCliente(id, nuevos);

  if (MODO_DEMO) return;
  try {
    const supabase = await obtenerCliente();
    const { error } = tiene
      ? await supabase.from(TABLA_TAGS).delete().eq('customer_id', id).eq('tag_slug', slug)
      : await supabase.from(TABLA_TAGS).insert({ customer_id: id, tag_slug: slug });
    if (error) throw error;
  } catch (err) {
    console.error('[clientes] No se pudo cambiar la etiqueta:', err);
    const f = datos.obtenerEstado().ficha;
    if (f) datos.fijarFicha({ ...f, tags: previos });
    datos.fijarTagsCliente(id, previos);
    toast('No se pudo cambiar la etiqueta.', 'error');
  }
}
