// ============================================================
// Jaguar Carwash — Clientes: datos de muestra (MODO_DEMO)
// ============================================================

const DIA = 86_400_000;
const hace = (dias) => new Date(Date.now() - dias * DIA).toISOString();

// [nombre, tel, dni, mensajes, total, confirmadas, completadas, canceladas,
//  gasto, ultimaVisitaDias|null, tags, handoff]
const BASE = [
  ['Carlos Quispe', '51987654321', '71128890', 8, 4, 4, 3, 1, 165, 2, ['frecuente'], false],
  ['María Fernández', '51912345678', '43217654', 12, 3, 2, 2, 0, 410, 5, ['vip', 'ceramico'], true],
  ['Milagros Chávez', '51987111222', '70011234', 4, 1, 1, 0, 0, 0, null, [], false],
  ['Jorge Villanueva', '51955123456', '09887766', 53, 6, 5, 5, 1, 380, 1, ['frecuente', 'vip'], false],
  ['Rosa Cárdenas', '51998765432', '44556677', 6, 2, 2, 2, 0, 300, 45, ['ceramico'], true],
  ['Luis Mamani', '51944555111', '78901234', 3, 0, 0, 0, 0, 0, null, [], false],
  ['Ana Lucía Torres', '51999333555', '10293847', 5, 3, 3, 3, 0, 150, 38, [], false],
  ['Pedro Salazar', '51963222444', '56473829', 4, 2, 1, 1, 1, 50, 60, ['moroso'], false],
  ['Vanessa Aguilar', '51941222333', '11223344', 9, 5, 4, 4, 0, 260, 3, ['frecuente'], false],
  ['Renzo Delgado', '51957888444', '99887711', 2, 1, 0, 0, 1, 0, null, [], false],
  ['Claudia Espinoza', '51919555777', '33445566', 7, 2, 2, 1, 0, 180, 12, [], false],
  ['Hugo Ccahuana', '51925111888', '22110099', 1, 0, 0, 0, 0, 0, null, [], false],
];

export function generarClientesDemo() {
  return BASE.map((r, i) =>
    Object.freeze({
      id: `demo-cust-${i + 1}`,
      nombre: r[0],
      telefono: r[1],
      dni: r[2],
      mensajes: r[3],
      total_citas: r[4],
      confirmadas: r[5],
      completadas: r[6],
      canceladas: r[7],
      gasto: r[8],
      ultima_visita: r[9] == null ? null : hace(r[9]),
      tags: r[10],
      handoff: r[11],
    })
  );
}

// Ficha demo de un cliente (historial + notas + tags).
export function generarFichaDemo(cliente) {
  const n = cliente.completadas + cliente.confirmadas;
  const citas = Array.from({ length: Math.min(n, 6) }, (_, i) =>
    Object.freeze({
      id: `${cliente.id}-a${i + 1}`,
      estado: i < cliente.completadas ? 'completada' : 'confirmada',
      precio: [25, 50, 120, 150][i % 4],
      fecha: hace(7 * (i + 1)),
    })
  );
  const notas =
    cliente.tags.includes('vip')
      ? [
          Object.freeze({
            id: `${cliente.id}-n1`,
            autor: 'staff@jaguar.pe',
            contenido: 'Cliente frecuente, prefiere cera de alto brillo. Trato preferente.',
            creado: hace(10),
          }),
        ]
      : [];
  return Object.freeze({ cliente, citas, notas, tags: cliente.tags });
}
