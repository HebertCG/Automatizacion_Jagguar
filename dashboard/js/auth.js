// ============================================================
// Jaguar Carwash — Autenticación
// Demo: sesión firmada en localStorage con expiración.
// Real: Supabase Auth (signInWithPassword + sesión persistente).
// ============================================================

import { MODO_DEMO, DEMO_CREDENCIALES } from './config.js';
import { obtenerCliente } from './supabase.js';

const CLAVE_SESION_DEMO = 'jaguar.sesion.demo';
const DURACION_SESION_DEMO_MS = 12 * 60 * 60 * 1000; // 12 horas

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Valida las entradas del formulario ANTES de tocar cualquier backend. */
export function validarCredenciales(email, password) {
  const errores = [];
  if (!email || !REGEX_EMAIL.test(email.trim())) {
    errores.push('Ingresa un correo válido (ej. staff@jaguar.pe).');
  }
  if (!password || password.length < 6) {
    errores.push('La contraseña debe tener al menos 6 caracteres.');
  }
  return errores;
}

/**
 * Inicia sesión. Devuelve { ok, error, email }.
 * Los mensajes de error son amables y no revelan detalles internos.
 */
export async function iniciarSesion(email, password) {
  const errores = validarCredenciales(email, password);
  if (errores.length > 0) {
    return { ok: false, error: errores[0] };
  }

  if (MODO_DEMO) {
    // Pequeña espera para que el estado "cargando" se sienta real.
    await new Promise((r) => setTimeout(r, 550));
    const coincide =
      email.trim().toLowerCase() === DEMO_CREDENCIALES.email &&
      password === DEMO_CREDENCIALES.password;

    if (!coincide) {
      return {
        ok: false,
        error: 'Correo o contraseña incorrectos. Revisa e inténtalo de nuevo 🙂',
      };
    }

    const sesion = {
      email: DEMO_CREDENCIALES.email,
      expira: Date.now() + DURACION_SESION_DEMO_MS,
    };
    try {
      localStorage.setItem(CLAVE_SESION_DEMO, JSON.stringify(sesion));
    } catch {
      // localStorage bloqueado (modo incógnito estricto): la sesión
      // vivirá solo en memoria durante esta pestaña. No es fatal.
    }
    return { ok: true, email: sesion.email };
  }

  // --- Modo real: Supabase Auth ---------------------------------
  try {
    const supabase = await obtenerCliente();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      return {
        ok: false,
        error: 'Correo o contraseña incorrectos. Revisa e inténtalo de nuevo 🙂',
      };
    }
    return { ok: true, email: data.user?.email ?? email.trim() };
  } catch (err) {
    console.error('[auth] Error al iniciar sesión:', err);
    return {
      ok: false,
      error: 'No pudimos conectar con el servidor. Revisa tu internet e inténtalo otra vez.',
    };
  }
}

/** Devuelve la sesión activa ({ email }) o null. */
export async function obtenerSesion() {
  if (MODO_DEMO) {
    try {
      const crudo = localStorage.getItem(CLAVE_SESION_DEMO);
      if (!crudo) return null;
      const sesion = JSON.parse(crudo);
      if (!sesion?.email || Date.now() > sesion.expira) {
        localStorage.removeItem(CLAVE_SESION_DEMO);
        return null;
      }
      return { email: sesion.email };
    } catch {
      return null;
    }
  }

  try {
    const supabase = await obtenerCliente();
    const { data } = await supabase.auth.getSession();
    const email = data?.session?.user?.email;
    return email ? { email } : null;
  } catch {
    return null;
  }
}

/** Cierra la sesión (demo o real). Nunca lanza. */
export async function cerrarSesion() {
  if (MODO_DEMO) {
    try {
      localStorage.removeItem(CLAVE_SESION_DEMO);
    } catch {
      /* sin acceso a storage: nada que limpiar */
    }
    return;
  }
  try {
    const supabase = await obtenerCliente();
    await supabase.auth.signOut();
  } catch (err) {
    console.error('[auth] Error al cerrar sesión:', err);
  }
}

/**
 * Suscribe un callback a cambios de sesión (solo modo real).
 * En demo no hay eventos externos de auth.
 */
export async function alCambiarSesion(callback) {
  if (MODO_DEMO) return () => {};
  try {
    const supabase = await obtenerCliente();
    const { data } = supabase.auth.onAuthStateChange((_evento, sesion) => {
      callback(sesion?.user?.email ? { email: sesion.user.email } : null);
    });
    return () => data.subscription.unsubscribe();
  } catch {
    return () => {};
  }
}
