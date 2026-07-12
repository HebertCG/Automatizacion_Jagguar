// ============================================================
// Jaguar Carwash — Bandeja: datos de muestra (MODO_DEMO)
// Hilos de conversación realistas de un carwash en Piura.
// Formato compacto: [role, contenido, minAtras] → mensaje completo.
// ============================================================

// role: cliente | bot | staff · minAtras: minutos hacia atrás desde ahora.
const HILOS_DEMO = [
  {
    nombre: 'Milagros Chávez', tel: '987 111 222', handoff: false, noLeidos: 2,
    msgs: [
      ['cliente', 'Hola, buenas tardes 🙌', 14],
      ['bot', '¡Hola! 🐆 Bienvenida a Jaguar Car Detailing. ¿En qué te ayudo?', 13],
      ['cliente', 'Quiero saber si pueden hacer un detailing completo a mi camioneta', 12],
      ['cliente', 'Es una Hilux, está bien sucia por el viaje a la playa 😅', 3],
    ],
  },
  {
    nombre: 'María Fernández', tel: '912 345 678', handoff: true, noLeidos: 0,
    msgs: [
      ['cliente', 'Buenas, ¿el cerámico cuánto cuesta para un SUV?', 95],
      ['bot', '¡Hola María! El recubrimiento cerámico para SUV va desde S/350. ¿Deseas que un asesor te dé el detalle?', 94],
      ['cliente', 'Sí por favor, quiero saber cuánto dura', 92],
      ['staff', 'Hola María, te atiende Hebert 👋 El cerámico dura entre 1 y 2 años según el mantenimiento. Incluye lavado, descontaminado y 2 capas.', 40],
      ['staff', '¿Te gustaría que te agende una evaluación gratis esta semana?', 39],
    ],
  },
  {
    nombre: 'Jorge Villanueva', tel: '955 123 456', handoff: false, noLeidos: 0,
    msgs: [
      ['cliente', 'Buenas noches, ¿atienden mañana temprano?', 1580],
      ['bot', '¡Hola Jorge! Sí, abrimos de 8:00 am a 6:00 pm. ¿Qué servicio buscas?', 1578],
      ['cliente', 'Un lavado básico para mi auto', 1576],
      ['bot', 'Perfecto ✅ ¿A qué hora te viene bien?', 1575],
      ['cliente', 'A las 9', 1560],
      ['bot', 'Listo, te agendé el Lavado Básico mañana a las 9:00 am. ¡Te esperamos! 🚗', 1559],
      ['cliente', 'Ya estoy llegando 👍', 22],
      ['bot', '¡Genial! Tu bahía está lista. Acércate a recepción por favor.', 21],
    ],
  },
  {
    nombre: 'Rosa Cárdenas', tel: '998 765 432', handoff: true, noLeidos: 0,
    msgs: [
      ['cliente', 'Hola, dejé mi auto ayer para el detailing, ¿ya está listo?', 1490],
      ['staff', 'Hola Rosa, sí 🚗✨ quedó impecable. Puedes recogerlo cuando gustes.', 1450],
      ['staff', 'Recuerda que aplicamos la cera de alto brillo que pediste.', 1449],
    ],
  },
  {
    nombre: 'Carlos Quispe', tel: '987 654 321', handoff: false, noLeidos: 0,
    msgs: [
      ['cliente', '¿Tienen espacio hoy para un lavado?', 180],
      ['bot', '¡Hola Carlos! 🐆 Claro. ¿Para qué tipo de vehículo?', 179],
      ['cliente', 'Un auto sedán', 178],
      ['bot', 'Tenemos Básico (S/25), Premium (S/50) y Detailing. ¿Cuál prefieres?', 177],
      ['cliente', 'El premium', 176],
      ['bot', 'Listo ✅ Te agendé el Premium hoy a las 3:00 pm. ¡Te esperamos!', 175],
    ],
  },
  {
    nombre: 'Luis Mamani', tel: '944 555 111', handoff: false, noLeidos: 1,
    msgs: [
      ['cliente', '¿Lavan motos?', 60],
      ['bot', '¡Sí! 🏍️ El lavado de moto cuesta S/15 y demora unos 20 minutos.', 59],
      ['cliente', '¿Y encerado?', 8],
    ],
  },
  {
    nombre: 'Ana Lucía Torres', tel: '999 333 555', handoff: false, noLeidos: 0,
    msgs: [
      ['cliente', 'Gracias, quedó excelente el lavado ✨', 320],
      ['bot', '¡Nos alegra un montón, Ana! 🐆 Te esperamos en tu próxima visita.', 318],
    ],
  },
  {
    nombre: 'Pedro Salazar', tel: '963 222 444', handoff: false, noLeidos: 0,
    msgs: [
      ['cliente', '¿Puedo pagar con Yape?', 240],
      ['bot', '¡Claro que sí, Pedro! Aceptamos Yape, Plin y efectivo. 💳', 239],
      ['cliente', 'Perfecto, ahí voy', 238],
    ],
  },
];

// Mensajes entrantes aleatorios para el simulador de tiempo real (demo).
const ENTRANTES_DEMO = [
  '¿Siguen abiertos?',
  '¿Cuánto demora el lavado premium?',
  'Ya voy en camino 🚗',
  '¿Puedo pagar con Yape?',
  '¿Tienen servicio de cerámico?',
  '¿Me pueden atender sin cita hoy?',
  'Gracias, quedó impecable ✨',
];

const isoDesde = (minAtras) =>
  new Date(Date.now() - minAtras * 60_000).toISOString();

function construirHilo(spec, indice) {
  const id = `demo-cust-${indice + 1}`;
  const mensajes = spec.msgs.map(([role, content, minAtras], i) =>
    Object.freeze({
      id: `${id}-m${i + 1}`,
      customer_id: id,
      role,
      content,
      created_at: isoDesde(minAtras),
      pendiente: false,
    })
  );
  const ultimo = mensajes[mensajes.length - 1];
  const ultimoInbound = [...mensajes].reverse().find((m) => m.role === 'cliente');
  const chat = Object.freeze({
    id,
    nombre: spec.nombre,
    telefono: `+51 ${spec.tel}`,
    ultimo_contenido: ultimo?.content ?? '',
    ultimo_at: ultimo?.created_at ?? null,
    no_leidos: spec.noLeidos ?? 0,
    handoff: !!spec.handoff,
    ultimo_inbound_at: ultimoInbound?.created_at ?? null,
  });
  return { chat, mensajes };
}

// Historial largo para UN chat, así el scroll infinito hacia atrás se puede
// verificar en demo (>30 mensajes ⇒ el primer lote no trae todo).
const FRASES_HISTORIAL = [
  '¿Y el precio del encerado?',
  '¿Tienen delivery del auto?',
  'Lo dejo a las 10 entonces',
  '¿Aceptan tarjeta?',
  'Ya estoy afuera',
  '¿Cuánto demora el detailing?',
  'Ok, ahí estaré 👍',
  '¿Lavan tapiz también?',
];
function historiaLarga(cid, desdeMin, hastaMin, cantidad) {
  const paso = (desdeMin - hastaMin) / cantidad;
  const msgs = [];
  for (let i = 0; i < cantidad; i += 1) {
    const role = i % 2 === 0 ? 'cliente' : 'bot';
    msgs.push(
      Object.freeze({
        id: `${cid}-h${i + 1}`,
        customer_id: cid,
        role,
        content:
          role === 'cliente'
            ? FRASES_HISTORIAL[i % FRASES_HISTORIAL.length]
            : '¡Claro! Con gusto te ayudo 🐆',
        created_at: isoDesde(Math.round(desdeMin - paso * i)),
        pendiente: false,
      })
    );
  }
  return msgs;
}

/** Devuelve { chats, todos } — todos = mapa cid → array completo (asc). */
export function generarBandejaDemo() {
  const chats = [];
  const todos = {};
  HILOS_DEMO.forEach((spec, i) => {
    const { chat, mensajes } = construirHilo(spec, i);
    chats.push(chat);
    todos[chat.id] = mensajes;
  });
  // Jorge (demo-cust-3): anteponer ~45 mensajes viejos para paginar el scroll.
  if (todos['demo-cust-3']) {
    todos['demo-cust-3'] = [
      ...historiaLarga('demo-cust-3', 3000, 1600, 45),
      ...todos['demo-cust-3'],
    ];
  }
  chats.sort((a, b) => new Date(b.ultimo_at) - new Date(a.ultimo_at));
  return { chats, todos };
}

/**
 * Lote de mensajes para el scroll infinito (demo). Devuelve los `n` mensajes
 * inmediatamente anteriores a `antesDe` (o los `n` más recientes si no se pasa).
 */
export function loteDemo(todosDelChat, antesDe, n) {
  const todos = todosDelChat ?? [];
  const previos = antesDe ? todos.filter((m) => m.created_at < antesDe) : todos;
  const batch = previos.slice(-n);
  const sinMas = previos.length <= n;
  return { batch, sinMas };
}

/** Genera un mensaje entrante de un chat al azar (simulador de tiempo real). */
export function mensajeDemoNuevo(chats) {
  if (!chats.length) return null;
  const chat = chats[Math.floor(Math.random() * chats.length)];
  const content = ENTRANTES_DEMO[Math.floor(Math.random() * ENTRANTES_DEMO.length)];
  return Object.freeze({
    id: `demo-in-${Date.now()}`,
    customer_id: chat.id,
    role: 'cliente',
    content,
    created_at: new Date().toISOString(),
    pendiente: false,
  });
}
