// ============================================================
// Jaguar Carwash — Punto de entrada: orquesta login, store,
// render, acciones y tiempo real. No contiene lógica de negocio.
// ============================================================

import { MODO_DEMO, REFRESCO_BAHIAS_MS } from './config.js';
import * as auth from './auth.js';
import * as datos from './data.js';
import * as render from './render.js';
import { conectarAcciones } from './actions.js';
import { iniciarTiempoReal, detenerTiempoReal } from './realtime.js';
import { iniciarRouter, detenerSecciones, moduloActivo } from './router.js';
import {
  toast,
  debounce,
  contarHasta,
  resaltarFila,
  mostrarSkeleton,
  botonCargando,
} from './ui.js';

const $ = (id) => document.getElementById(id);

let appIniciada = false;
let temporizadorBahias = null;

// ------------------------------------------------------------
// Render coordinado
// ------------------------------------------------------------
function renderKpis() {
  const kpis = datos.calcularKpis();
  contarHasta($('kpi-listos'), kpis.listos);
  contarHasta($('kpi-citas'), kpis.citasHoy);
  contarHasta($('kpi-proceso'), kpis.enProceso);
  contarHasta($('kpi-completadas'), kpis.completadas);
  contarHasta($('kpi-ingresos'), kpis.ingresos, render.formatearSoles);
}

function renderTodo({ animarTabla = false } = {}) {
  const { filtro } = datos.obtenerEstado();
  renderKpis();
  render.renderChips(datos.conteosPorFiltro(), filtro);
  render.renderTabla(datos.citasFiltradas(), { animar: animarTabla });
  render.renderBahias(datos.estadoBahias());
  render.renderDona(datos.serieDona());
  render.renderBarras(datos.serieBarras());
}

/** Reacciona a cada cambio del store según su origen. */
function alCambiarDatos(estado, meta) {
  if (meta.origen === 'error') {
    mostrarSkeleton(false);
    toast(meta.mensaje ?? 'Ocurrió un error al cargar los datos.', 'error');
    return;
  }
  if (estado.cargando) return; // el skeleton ya está visible

  mostrarSkeleton(false);
  renderTodo({ animarTabla: meta.origen === 'filtro' || meta.origen === 'busqueda' });

  // Pulse/glow en la fila que cambió o entró por tiempo real.
  if ((meta.origen === 'tiemporeal' || meta.origen === 'accion') && meta.id) {
    requestAnimationFrame(() => resaltarFila(meta.id));
  }
}

// ------------------------------------------------------------
// Login
// ------------------------------------------------------------
function mostrarError(mensaje) {
  const el = $('login-error');
  el.textContent = mensaje;
  el.hidden = !mensaje;
}

function conectarLogin() {
  const formulario = $('form-login');
  const inputEmail = $('login-email');
  const inputPassword = $('login-password');
  const boton = $('btn-ingresar');

  if (MODO_DEMO) $('login-ayuda').hidden = false;

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    mostrarError('');

    const email = inputEmail.value;
    const password = inputPassword.value;

    const errores = auth.validarCredenciales(email, password);
    inputEmail.setAttribute('aria-invalid', String(errores.some((e) => e.includes('correo'))));
    inputPassword.setAttribute('aria-invalid', String(errores.some((e) => e.includes('contraseña'))));
    if (errores.length > 0) {
      mostrarError(errores[0]);
      return;
    }

    botonCargando(boton, true, 'Ingresar');
    const resultado = await auth.iniciarSesion(email, password);
    botonCargando(boton, false, 'Ingresar');

    if (!resultado.ok) {
      mostrarError(resultado.error);
      inputPassword.value = '';
      inputPassword.focus();
      return;
    }
    iniciarApp(resultado.email);
  });
}

// ------------------------------------------------------------
// App autenticada
// ------------------------------------------------------------
function actualizarIndicadorVivo(conectado) {
  const texto = $('indicador-texto');
  if (!texto) return;
  if (MODO_DEMO) {
    texto.textContent = 'En vivo · demo';
  } else {
    texto.textContent = conectado ? 'En vivo' : 'Reconectando…';
  }
}

async function iniciarApp(email) {
  $('pantalla-login').hidden = true;
  $('app').hidden = false;
  $('usuario-email').textContent = email;

  if (appIniciada) return; // re-login en la misma pestaña: no duplicar wiring
  appIniciada = true;

  mostrarSkeleton(true);
  datos.suscribir(alCambiarDatos);
  await datos.cargarCitas();

  iniciarTiempoReal(actualizarIndicadorVivo);

  // Las barras de progreso de las bahías avanzan aunque no haya eventos.
  temporizadorBahias = setInterval(() => {
    render.renderBahias(datos.estadoBahias());
  }, REFRESCO_BAHIAS_MS);

  // Navegación entre secciones. Citas ya quedó inicializada arriba (ruta por
  // defecto, sin `cargar`). Las demás se importan al abrirse por primera vez.
  iniciarRouter([
    { id: 'citas', hash: '#/citas' },
    { id: 'bandeja', hash: '#/bandeja', cargar: () => import('./bandeja/index.js') },
    { id: 'clientes', hash: '#/clientes' },
    { id: 'metricas', hash: '#/metricas' },
    { id: 'agenda', hash: '#/agenda' },
  ]);
}

function conectarFiltros() {
  $('chips-filtro').addEventListener('click', (evento) => {
    const chip = evento.target.closest('.chip[data-filtro]');
    if (!chip) return;
    datos.fijarFiltro(chip.dataset.filtro);
  });

  const buscador = $('buscador');
  buscador.addEventListener(
    'input',
    debounce(() => datos.fijarBusqueda(buscador.value), 220)
  );
}

function conectarSalir() {
  $('btn-salir').addEventListener('click', async () => {
    detenerTiempoReal();
    detenerSecciones(); // corta realtime/timers de Bandeja y demás secciones
    if (temporizadorBahias) clearInterval(temporizadorBahias);
    await auth.cerrarSesion();
    // Recarga limpia: garantiza que no quede estado en memoria.
    window.location.reload();
  });
}

function conectarResize() {
  // Los canvas dependen del ancho del contenedor: redibujar al girar
  // el teléfono o cambiar el tamaño de la ventana.
  window.addEventListener(
    'resize',
    debounce(() => {
      if (!appIniciada) return;
      render.renderDona(datos.serieDona());
      render.renderBarras(datos.serieBarras());
      // La sección visible (Bandeja/Métricas/Agenda) redibuja lo suyo.
      moduloActivo()?.onMostrar?.();
    }, 200)
  );
}

// ------------------------------------------------------------
// Arranque
// ------------------------------------------------------------
async function arrancar() {
  conectarLogin();
  conectarFiltros();
  conectarAcciones();
  conectarSalir();
  conectarResize();

  // En modo real, si la sesión muere (token revocado), volver al login.
  auth.alCambiarSesion((sesion) => {
    if (!sesion && appIniciada) window.location.reload();
  });

  const sesion = await auth.obtenerSesion();
  if (sesion) {
    iniciarApp(sesion.email);
  } else {
    $('pantalla-login').hidden = false;
  }
}

arrancar();
