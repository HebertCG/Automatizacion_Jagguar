// ============================================================
// Jaguar Carwash — Métricas: controlador. Carga UNA vez; redibuja
// los canvas al mostrarse/redimensionar (miden 0 si están ocultos).
// ============================================================

import * as datos from './data.js';
import * as render from './render.js';
import { toast } from '../ui.js';

let iniciado = false;
let desuscribir = null;

function pintar(estado) {
  if (estado.cargando || !estado.embudo) return;
  render.renderKpis(datos.kpis());
  render.renderEmbudo(estado.embudo);
  render.renderSerie(estado.serie);
  render.renderServicios(estado.servicios);
  render.renderRanking(estado.ranking);
}

function alCambiar(estado, meta) {
  if (meta.origen === 'error') {
    toast(meta.mensaje ?? 'Error en métricas.', 'error');
    return;
  }
  pintar(estado);
}

export function init() {
  if (iniciado) return;
  iniciado = true;
  desuscribir = datos.suscribir(alCambiar);
  datos.cargarMetricas();
}

export function onMostrar() {
  const e = datos.obtenerEstado();
  if (!e.cargando) requestAnimationFrame(() => pintar(e));
}

export function detener() {
  if (desuscribir) desuscribir();
  desuscribir = null;
  iniciado = false;
}
