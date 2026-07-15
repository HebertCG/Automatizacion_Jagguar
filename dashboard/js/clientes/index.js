// ============================================================
// Jaguar Carwash — Clientes: controlador de la sección.
// Carga UNA vez (v_clientes agregada); filtros en memoria; ficha 1 llamada.
// ============================================================

import * as datos from './data.js';
import * as render from './render.js';
import { agregarNota, alternarTag } from './actions.js';
import { irA } from '../router.js';
import { toast, debounce } from '../ui.js';

const $ = (id) => document.getElementById(id);
let iniciado = false;
let eventosListos = false;
let desuscribir = null;

function pintarLista() {
  render.renderResumen(datos.resumenClientes());
  render.renderFiltros(datos.obtenerEstado().filtro);
  render.renderTabla(datos.clientesFiltrados());
}

function alCambiar(estado, meta) {
  if (meta.origen === 'error') {
    toast(meta.mensaje ?? 'Error en clientes.', 'error');
    return;
  }
  if (meta.origen === 'carga' || meta.origen === 'filtro' || meta.origen === 'tags') {
    pintarLista();
  }
  if (['ficha-abrir', 'ficha', 'ficha-actualiza', 'ficha-cerrar', 'tags'].includes(meta.origen)) {
    render.renderFicha(estado);
  }
}

function abrirChat(telefono) {
  irA('#/bandeja', { luego: (mod) => mod?.abrirChatPorTelefono?.(telefono) });
}

function conectarEventos() {
  if (eventosListos) return;
  eventosListos = true;

  $('clientes-buscador').addEventListener(
    'input',
    debounce((e) => datos.fijarBusqueda(e.target.value), 200)
  );

  $('clientes-filtros').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-filtro]');
    if (chip) datos.fijarFiltro(chip.dataset.filtro);
  });

  // Abrir ficha desde tabla o cards (delegación).
  const abrirDesde = (e) => {
    const fila = e.target.closest('[data-cliente]');
    if (fila) datos.abrirFicha(fila.dataset.cliente);
  };
  $('clientes-cuerpo').addEventListener('click', abrirDesde);
  $('clientes-cards').addEventListener('click', abrirDesde);
  // Accesible: Enter abre la ficha
  const abrirTeclado = (e) => {
    if (e.key !== 'Enter') return;
    const fila = e.target.closest('[data-cliente]');
    if (fila) datos.abrirFicha(fila.dataset.cliente);
  };
  $('clientes-cuerpo').addEventListener('keydown', abrirTeclado);
  $('clientes-cards').addEventListener('keydown', abrirTeclado);

  // Drawer: cerrar, chat, tags, nota (delegación en el cuerpo del drawer).
  $('cliente-drawer-fondo').addEventListener('click', datos.cerrarFicha);
  $('cliente-drawer-cerrar').addEventListener('click', datos.cerrarFicha);
  const cuerpo = $('cliente-drawer-cuerpo');
  cuerpo.addEventListener('click', (e) => {
    const chat = e.target.closest('[data-abrir-chat]');
    if (chat) { abrirChat(chat.dataset.abrirChat); return; }
    const tag = e.target.closest('[data-tag]');
    if (tag) alternarTag(tag.dataset.tag);
  });
  cuerpo.addEventListener('submit', (e) => {
    if (e.target.id !== 'ficha-nota-form') return;
    e.preventDefault();
    const ta = $('ficha-nota-input');
    const texto = ta.value;
    if (!texto.trim()) return;
    ta.value = '';
    agregarNota(texto);
  });

  // Escape cierra el drawer
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && datos.obtenerEstado().fichaId) datos.cerrarFicha();
  });
}

export function init() {
  conectarEventos();
  if (iniciado) return;
  iniciado = true;
  desuscribir = datos.suscribir(alCambiar);
  datos.cargarClientes();
}

export function onMostrar() {
  // Refresco liviano al volver (los datos pueden haber cambiado en otra sección).
  datos.cargarClientes({ silencioso: true });
}

export function detener() {
  if (desuscribir) desuscribir();
  desuscribir = null;
  iniciado = false;
}
