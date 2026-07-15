// ============================================================
// Jaguar Carwash — Métricas: datos de muestra (MODO_DEMO)
// ============================================================

const DIA = 86_400_000;

export function generarMetricasDemo() {
  const embudo = {
    escribieron: 124,
    conversaron: 81,
    agendaron: 47,
    confirmaron: 39,
    completaron: 31,
  };

  // Serie de 30 días con variación realista (fines de semana más altos).
  const serie = Array.from({ length: 30 }, (_, i) => {
    const fecha = new Date(Date.now() - (29 - i) * DIA);
    const finde = [0, 6].includes(fecha.getDay());
    const base = finde ? 9 : 5;
    const conversaciones = base + Math.floor(Math.random() * 6);
    const citas = Math.max(1, Math.round(conversaciones * (0.45 + Math.random() * 0.2)));
    const completadas = Math.max(0, Math.round(citas * (0.6 + Math.random() * 0.2)));
    return {
      dia: fecha.toISOString().slice(0, 10),
      conversaciones,
      citas,
      completadas,
      ingresos: completadas * (40 + Math.floor(Math.random() * 90)),
    };
  });

  const servicios = [
    { servicio: 'Cerámico 1 año', citas: 22, completadas: 18, ingresos: 9000, ticket_promedio: 500 },
    { servicio: 'Detailing', citas: 34, completadas: 29, ingresos: 4350, ticket_promedio: 150 },
    { servicio: 'Premium', citas: 51, completadas: 44, ingresos: 2420, ticket_promedio: 55 },
    { servicio: 'Básico', citas: 68, completadas: 60, ingresos: 1650, ticket_promedio: 27 },
    { servicio: 'Cerámico 6 meses', citas: 12, completadas: 9, ingresos: 3150, ticket_promedio: 350 },
  ];

  const ranking = [
    { nombre: 'Jorge Villanueva', telefono: '51955123456', gasto: 1850, completadas: 5, total_citas: 6 },
    { nombre: 'María Fernández', telefono: '51912345678', gasto: 950, completadas: 2, total_citas: 3 },
    { nombre: 'Rosa Cárdenas', telefono: '51998765432', gasto: 700, completadas: 2, total_citas: 2 },
    { nombre: 'Vanessa Aguilar', telefono: '51941222333', gasto: 520, completadas: 4, total_citas: 5 },
    { nombre: 'Carlos Quispe', telefono: '51987654321', gasto: 330, completadas: 3, total_citas: 4 },
  ];

  return { embudo, serie, servicios, ranking };
}
