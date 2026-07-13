// ============================================================
// Jaguar Carwash — Cliente Supabase (JS v2 por CDN, carga perezosa)
// En MODO_DEMO nunca se descarga el SDK: cero peso extra.
// ============================================================

import { MODO_DEMO, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';

// Versión PINEADA (no rango `@2`): evita que un release 2.x malicioso o un
// cambio en el CDN inyecte código con acceso al DOM y al JWT de sesión.
// Al actualizar, revisa el changelog y sube este número a conciencia.
const CDN_SUPABASE = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.2/+esm';

let cliente = null;
let cargando = null;

/** ¿La configuración real está completa? */
export function estaConfigurado() {
  return (
    !SUPABASE_URL.includes('TU-PROYECTO') &&
    !SUPABASE_PUBLISHABLE_KEY.includes('REEMPLAZAR')
  );
}

/**
 * Devuelve el cliente Supabase (singleton). Solo en modo real.
 * Lanza un error claro si falta configuración.
 */
export async function obtenerCliente() {
  if (MODO_DEMO) {
    throw new Error('obtenerCliente() no debe llamarse en MODO_DEMO.');
  }
  if (!estaConfigurado()) {
    throw new Error(
      'Configura SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY en js/config.js antes de usar el modo real.'
    );
  }
  if (cliente) return cliente;

  // Evita cargas dobles si dos módulos lo piden a la vez.
  if (!cargando) {
    cargando = import(CDN_SUPABASE).then((modulo) => {
      cliente = modulo.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      });
      return cliente;
    });
  }
  return cargando;
}
