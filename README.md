# 🐆 Automatización Jaguar Car Detailing

Sistema de atención y agendamiento por **WhatsApp** para un car detailing en Piura,
Perú. Un bot con IA (**n8n + OpenAI**) atiende, cotiza y agenda solo; el staff
supervisa todo desde un **panel web** que vive en este repositorio.

> **Este repo contiene el panel del staff.** Los 8 workflows de n8n y el esquema
> SQL corren fuera del navegador (instancia de n8n + proyecto Supabase); aquí se
> documentan y se versionan las migraciones que el panel necesita.

---

## 1. La problemática que se resolvió

El negocio operaba con **un solo número de WhatsApp atendido a mano**. De ahí
salían todos los problemas:

| # | Problema real del negocio | Consecuencia |
|---|---------------------------|--------------|
| 1 | Todo mensaje se respondía manualmente, uno por uno | Mensajes de noche/domingo sin responder; clientes que se iban a la competencia |
| 2 | Agendar era una conversación larga (servicio → vehículo → día → hora) | Cada cita costaba 10+ mensajes de ida y vuelta |
| 3 | La disponibilidad se llevaba "de memoria" o en cuaderno | **Doble reserva**: dos autos citados a la misma hora en la misma bahía |
| 4 | Nadie calculaba si el servicio *terminaba* antes del cierre | Autos aceptados a una hora imposible de cumplir |
| 5 | El cliente preguntaba "¿ya está listo?" varias veces | Interrupciones constantes al personal que está lavando |
| 6 | Citas que nadie confirmaba ni cerraba | Bahías bloqueadas por gente que nunca vino (*no-show*) |
| 7 | Reservas sin ningún compromiso económico | Plantones y huecos de agenda no recuperables |
| 8 | Comprobantes de pago enviados como foto | Reenvío del **mismo voucher** para "pagar" dos citas |
| 9 | El cliente escribía y el bot no sabía cuándo callarse | El bot pisaba al humano cuando el staff ya estaba respondiendo |
| 10 | Cero datos: nadie sabía cuántos escribieron ni cuántos agendaron | Imposible medir si la inversión en publicidad servía |

**Resultado:** la atención dependía de que una persona estuviera mirando el
celular, y la agenda dependía de que esa persona no se equivocara.

---

## 2. La solución, en un diagrama

```
                     ┌──────────────────────────────────────┐
  Cliente WhatsApp   │              n8n (VPS)               │
        │            │                                      │
        ▼            │  01 Bot de citas (webhook, 64 nodos) │
  Meta Cloud API ───►│  02..08 Workflows por cron           │
        ▲            └───────────────┬──────────────────────┘
        │                            │ RPC (service_role)
        │                            ▼
        │            ┌──────────────────────────────────────┐
        └────────────┤   Supabase — Postgres + RLS          │
       WhatsApp      │   citas · clientes · conversaciones  │
       de vuelta     │   vouchers · bahías · métricas       │
                     └───────────────┬──────────────────────┘
                                     │ Realtime + REST (anon key + RLS)
                                     ▼
                     ┌──────────────────────────────────────┐
                     │   PANEL DEL STAFF  (este repo)       │
                     │   Citas · Bandeja · Clientes ·       │
                     │   Métricas · Agenda                  │
                     └──────────────────────────────────────┘
```

La regla de oro del diseño: **la lógica de negocio vive en Postgres** (funciones
RPC), no en n8n ni en el navegador. Así el bot y el panel no pueden
contradecirse, porque los dos llaman exactamente a las mismas funciones.

---

## 3. Qué se hizo con n8n

n8n es el orquestador: recibe los mensajes de Meta, decide, llama a la base de
datos y responde. Son **8 workflows**, uno reactivo y siete por reloj.

### 3.1 Los 8 workflows

| # | Workflow | Disparador | Qué resuelve |
|---|----------|-----------|--------------|
| 01 | **Bot de citas** (principal, 64 nodos) | Webhook de WhatsApp | Atiende, cotiza, agenda, modifica y cancela. Entiende texto, **audios** e **imágenes** |
| 02 | Recordatorios de cita | Cron · cada hora | Avisa al cliente horas antes de su cita (ataca el problema 6) |
| 03 | Aviso al staff | Cron · cada minuto | Telegram al equipo cuando entra una cita nueva |
| 04 | Aviso al cliente | Cron · cada minuto | WhatsApp de "cita confirmada / cancelada" cuando el staff toca el panel |
| 05 | **Vehículo listo** | Cron · cada minuto | El staff aprieta *Listo* en el panel → el cliente recibe WhatsApp solo (problema 5) |
| 06 | Reactivar bot | Cron · cada 5 min | Si el staff no contesta en 60 min, el bot retoma la conversación (problema 9) |
| 07 | Aviso de atención humana | Cron · cada minuto | Telegram cuando el cliente pide hablar con una persona |
| 08 | Cerrar citas vencidas | Cron · cada hora | Pendiente vencida → `no_show`; confirmada vencida → `completada` (problema 6) |

### 3.2 El bot principal por dentro

- **Webhook con firma HMAC-SHA256** contra el *App Secret* de Meta y *Raw Body*
  activado: si la firma no cuadra, el mensaje se rechaza. Nadie puede inyectar
  conversaciones falsas al bot.
- **Buffer de 15 segundos + anti-spam de 30 mensajes/minuto**
  (`registrar_mensaje` → espera → `consumir_buffer`). Cuando alguien escribe en
  ráfaga ("hola" / "quiero lavar" / "mi auto"), el bot **junta** los mensajes y
  responde una sola vez, en vez de disparar tres respuestas encimadas.
- **Agente OpenAI `gpt-4o-mini`** con **memoria en Postgres**
  (`chat_memory_jaguar`, ventana de 20 turnos, sesión por número de teléfono):
  el cliente no tiene que repetir su placa ni su vehículo.
- **Audios**: `Get media URL` → `Download audio` → transcripción (Whisper) → el
  texto entra al agente. El cliente puede mandar una nota de voz.
- **Imágenes con visión**: el cliente manda la foto del voucher → se lee con el
  modelo de visión → se sube a **Supabase Storage (bucket privado)** → se
  registra con `registrar_voucher` → Telegram al staff.
- **Respuesta de respaldo** (`onError: continueErrorOutput`): si el modelo o la
  API fallan, el bot contesta igual. **Nunca se queda mudo.**

### 3.3 Las 7 herramientas del agente

El modelo no "adivina" la disponibilidad: llama a funciones reales de la base.

| Herramienta | Qué hace |
|-------------|----------|
| `crear_cita` | Valida horario, que el servicio **termine** antes del cierre, bahía libre según la duración real, y bloquea duplicados por placa/día |
| `consultar_cita` | Busca si el cliente ya tiene una cita activa antes de crear otra |
| `modificar_cita` | Cambia fecha/hora/servicio **re-validando** disponibilidad |
| `cancelar_cita` | Cancela, pero solo tras confirmación explícita del cliente |
| `pedir_humano` | Activa el *handoff*: apaga el bot y avisa al staff |
| `enviar_promo` | Manda la imagen de la promoción por WhatsApp |
| `recordar_vehiculo` | Guarda el vehículo en la ficha del cliente para futuras citas |

### 3.4 Patrón de diseño: *cron + RPC*, no triggers HTTP

Los workflows 02 al 08 **no** esperan un webhook de la base de datos. Cada uno
llama por reloj a una función `procesar_*` que devuelve la lista de avisos
pendientes y **marca lo ya notificado** (`notified_status`) en la misma
transacción.

Ventaja concreta: el envío es **idempotente**. Si n8n se reinicia o un cron se
solapa, nadie recibe el mismo WhatsApp dos veces, y si n8n estuvo caído 20
minutos, al volver manda lo atrasado sin perder nada.

### 3.5 Gotchas de n8n ya resueltos (para no repetirlos)

- Webhook con **Raw Body** activado y HMAC leyendo `process.env` — con `$env` el
  *task runner* lo bloquea.
- Los JSON se exportan **sin campo `id` raíz**: al importarlos no se duplican.
- Después de un nodo HTTP `$json` se pierde → nodos `Set` reconstruyen los datos.
- Enlaces en **texto plano** en el prompt: WhatsApp no renderiza Markdown.
- La fecha/hora de Perú se inyecta **al inicio del mensaje del usuario**, no solo
  en el *system message*, o el modelo agenda para el año equivocado.

---

## 4. El panel del staff (este repositorio)

Cinco secciones, router por hash, carga perezosa por sección.

| Sección | Ruta | Para qué sirve |
|---------|------|----------------|
| **Citas** | `#/citas` | Tablero operativo del día: estado de cada cita, ocupación de las 4 bahías y el botón **Listo** que dispara el WhatsApp al cliente |
| **Bandeja** | `#/bandeja` | WhatsApp Web interno: lee la conversación completa (cliente / bot / staff), responde a mano y **apaga o enciende el bot** por cliente |
| **Clientes** | `#/clientes` | Directorio CRM con ficha, historial de gasto, notas y etiquetas (VIP, frecuente, moroso, dormido) |
| **Métricas** | `#/metricas` | Embudo (escribieron → conversaron → agendaron → confirmaron → completaron), serie diaria, ingresos por servicio y ranking |
| **Agenda** | `#/agenda` | Vista semanal tipo calendario. **Cero consultas extra**: reutiliza las citas ya cargadas |

Flujo de estados: `pendiente → confirmada → en_proceso → listo → completada`,
con ramas terminales `cancelada` y `no_show`.

---

## 5. Problema → solución (resumen)

| Problema | Cómo se resolvió | Dónde vive |
|----------|------------------|------------|
| Mensajes sin responder | Bot 24/7 con IA y respuesta de respaldo | n8n `01` |
| Cita = 10 mensajes | Agente con memoria + 7 herramientas | n8n `01` |
| Doble reserva | `crear_cita` valida bahía libre **por duración del servicio** | Postgres RPC |
| Servicio que no cierra a tiempo | La validación exige que **termine** antes del cierre | Postgres RPC |
| "¿Ya está listo?" | Botón *Listo* → WhatsApp automático | Panel + n8n `05` |
| No-shows y bahías bloqueadas | Recordatorio + cierre automático de vencidas | n8n `02` y `08` |
| Reservas sin compromiso | **Anticipo del 20%** obligatorio para reservar | Migración `20` |
| Voucher reenviado | Número de operación **único**; el duplicado se detecta | Migración `20` |
| Bot pisando al humano | *Handoff* con reloj + reactivación a los 60 min | n8n `06` + `set_handoff` |
| Ráfagas de mensajes | Buffer de 15 s + anti-spam 30/min | n8n `01` |
| Sin datos del negocio | Vistas agregadas de embudo, serie e ingresos | Migración `19` |
| Cualquiera podía leer el PII | Tabla `staff` + `es_staff()` + RLS restrictiva | Migración `16` |

---

## 6. Ventajas obtenidas

- **Atención continua**: el negocio responde y agenda fuera del horario laboral.
- **Agenda sin choques**: la disponibilidad se calcula contra la duración real
  del servicio y las 4 bahías, no contra la memoria de alguien.
- **Una sola fuente de verdad**: bot y panel llaman a las mismas funciones de
  Postgres, así que no pueden mostrar realidades distintas.
- **El staff deja de ser operador de WhatsApp** y pasa a supervisar: solo entra
  cuando el cliente pide un humano o cuando hay que mover una cita.
- **Avisos idempotentes**: nadie recibe el mismo mensaje dos veces, aunque la
  infraestructura falle y se recupere.
- **Trazabilidad completa**: cada cambio de estado y cada encendido/apagado del
  bot queda auditado con el usuario que lo hizo.
- **Anticipo + voucher verificable**: reservar cuesta algo y el comprobante no se
  puede reciclar.
- **Panel sin build**: se despliega copiando archivos. No hay `node_modules`, ni
  bundler, ni pipeline que se rompa.

---

## 7. Tecnologías usadas

| Capa | Tecnología | Por qué esta |
|------|-----------|--------------|
| Mensajería | **WhatsApp Cloud API** (Meta Graph `v20.0`) | Canal oficial; el cliente ya lo tiene instalado |
| Orquestación | **n8n** (self-hosted en VPS con Docker) | Flujos visuales, crons, credenciales y reintentos sin escribir un backend |
| IA conversacional | **OpenAI `gpt-4o-mini`** + Whisper + visión | Costo bajo por conversación; entiende texto, audio e imagen |
| Memoria del chat | **Postgres Chat Memory** (`chat_memory_jaguar`) | La memoria vive en la BD, no en RAM: sobrevive reinicios de n8n |
| Base de datos | **Supabase** (Postgres + RLS + Realtime + Storage) | Auth, tiempo real, almacenamiento y reglas de acceso en un solo servicio |
| Lógica de negocio | **Funciones RPC en PL/pgSQL** | Validaciones atómicas: bot y panel no pueden divergir |
| Envío manual seguro | **Supabase Edge Function** (Deno) | El token de Meta nunca toca el navegador |
| Notificación interna | **Telegram Bot API** | Alertas al staff sin gastar cuota de WhatsApp |
| Panel | **HTML + CSS + JS vanilla** (módulos ES, sin build) | Sin dependencias que mantener; carga instantánea |
| Gráficos | **Canvas 2D** a mano | Cero librerías de charting en el bundle |
| Despliegue | **Vercel** (estático) y **Docker + nginx** (VPS) | Vercel para publicar rápido; nginx para el VPS con Coolify |

---

## 8. Estructura del repositorio

```
Automatizacion_Jagguar/
├── dashboard/                    # La app que se despliega
│   ├── index.html                # Login in-page + panel
│   ├── css/                      # tokens → base → styles → components → responsive
│   ├── js/
│   │   ├── config.js             # ⚙️ ÚNICO archivo a editar (demo/real, llaves)
│   │   ├── supabase.js           # Cliente Supabase v2 (CDN, pineado, carga perezosa)
│   │   ├── auth.js               # Login demo/real, sesión persistente
│   │   ├── router.js             # Router por hash + init perezoso por sección
│   │   ├── data.js render.js     # Store inmutable · pintado anti-XSS
│   │   ├── actions.js realtime.js ui.js app.js
│   │   ├── bandeja/              # Sección Bandeja (chat WhatsApp)
│   │   ├── clientes/             # Sección Clientes (directorio + ficha)
│   │   ├── metricas/             # Sección Métricas (embudo + series)
│   │   └── agenda/               # Sección Agenda (semana)
│   ├── nginx.conf                # Cabeceras de seguridad para el VPS
│   └── Dockerfile                # nginx:alpine
├── supabase/
│   ├── migrations/13..20         # Bandeja, rate limit, auditoría, authz, CRM, pagos
│   └── functions/enviar-mensaje-staff/   # Edge Function (Deno)
├── vercel.json                   # Deploy estático + cabeceras de seguridad
├── package.json                  # Scripts de conveniencia (no hay build)
└── docker-compose.yml            # Despliegue en VPS
```

---

## 9. Correr en local

**Opción A — servidor estático (recomendada):**

```bash
npm run dev          # sirve dashboard/ en http://localhost:8080
# o sin Node:
cd dashboard && python -m http.server 8080
```

> Abrir `index.html` con doble clic **no funciona**: los módulos ES requieren
> `http://`.

**Opción B — Docker (idéntico a producción en VPS):**

```bash
docker compose up --build     # http://localhost:8080
```

**Credenciales demo:** `staff@jaguar.pe` / `demo123`

### Modo demo vs modo real

En [dashboard/js/config.js](dashboard/js/config.js):

| Flag | Comportamiento |
|------|----------------|
| `MODO_DEMO = true` | Citas de muestra + eventos simulados cada ~25 s. **No requiere backend.** |
| `MODO_DEMO = false` | Supabase real: login, vista `v_citas`, canal Realtime + polling de respaldo cada 20 s |

> ⚠️ En `config.js` va **solo la clave publicable (anon)**, protegida por RLS.
> **Nunca** una `service_role` key: este código corre en el navegador.

---

## 10. Despliegue

### 10.1 Vercel (sitio estático)

El repo ya trae [vercel.json](vercel.json) configurado: `outputDirectory` apunta
a `dashboard/`, **no hay build** y se replican las cabeceras de seguridad de
nginx (CSP, HSTS, `frame-ancestors 'none'`, `nosniff`, Permissions-Policy).

**Desde la web:** New Project → importar `HebertCG/Automatizacion_Jagguar` →
Deploy. No hay que tocar ningún ajuste: `vercel.json` los define.

**Desde la terminal:**

```bash
npx vercel            # preview
npm run deploy        # producción (vercel deploy --prod)
```

Detalles que ya están resueltos en la configuración:

- **Sin build ni dependencias**: `installCommand` y `buildCommand` son no-ops.
- **`index.html`, JS y CSS con `must-revalidate`**: al desplegar, nadie se queda
  con código viejo en caché. Imágenes y fuentes sí cachean 30 días.
- **Router por hash**: `#/citas` nunca llega al servidor, así que **no hace falta
  ninguna regla de rewrite tipo SPA** y recargar la página no da 404.
- **[.vercelignore](.vercelignore)** excluye `nginx.conf`, el `Dockerfile` y
  `supabase/`. Sin eso quedarían publicados como archivos estáticos legibles
  desde internet.

**Después del primer deploy**, apunta el CORS de la Edge Function al dominio
nuevo, o el envío manual de WhatsApp fallará desde ese origen:

```bash
supabase secrets set CORS_ORIGIN=https://<tu-dominio>.vercel.app
supabase functions deploy enviar-mensaje-staff
```

### 10.2 VPS con Docker + nginx

```bash
git clone https://github.com/HebertCG/Automatizacion_Jagguar.git /opt/jaguar
cd /opt/jaguar && docker compose up -d --build      # expone 8080 → 80
```

Ponlo detrás de un reverse proxy con HTTPS (Coolify/Traefik/Caddy). El
`nginx.conf` ya emite HSTS, CSP, rate limit de borde y `expires -1` para
HTML/JS/CSS.

---

## 11. Supabase

### Migraciones (SQL Editor, **en orden**)

| Migración | Qué aporta |
|-----------|-----------|
| `13_conversations_realtime_rls.sql` | RLS de `conversations`, Realtime y vista `v_bandeja` |
| `14_rate_limit.sql` | Ventana por minuto para la Edge Function |
| `15_audit_staff_actions.sql` | Triggers de auditoría: cambio de estado y on/off del bot |
| `16_authz_staff.sql` | 🔴 **Crítica**: tabla `staff`, `es_staff()`, RLS restrictiva, `staff_set_handoff` |
| `17_lockdown_rpcs.sql` | Revoca los RPC del bot a los clientes del navegador |
| `18_clientes.sql` | `v_clientes`, notas y etiquetas |
| `19_metricas.sql` | Vistas de embudo, serie diaria, ingresos y ranking |
| `20_pagos_vouchers.sql` | Anticipo del 20% + `payment_vouchers` con operación única |

> **`16` antes o junto con el deploy del front**: el panel ya llama a
> `staff_set_handoff` y sin la migración el toggle del bot da error.
>
> Ajusta los emails sembrados en `16` a los reales del equipo, o habrá lockout.
> `17` solo aplica **si el bot de n8n usa la `service_role` key** (el setup
> estándar); con anon key, migra el bot primero.

**Eficiencia de las vistas**: cada una agrega con CTEs (un escaneo por tabla, sin
producto cartesiano) y el front hace **una consulta por sección**, sin polling.

### Edge Function `enviar-mensaje-staff`

Único camino para que el staff mande un WhatsApp manual:

1. `verify_jwt` valida el token y se comprueba `es_staff()`.
2. Validación estricta de entrada (E.164 + texto de 1 a 4096, sin caracteres de control).
3. Rate limit de 30/min por usuario.
4. Envío por Graph API con el token guardado como **secret** (jamás en el navegador).
5. Registro en `conversations` + auditoría.

```bash
supabase secrets set META_WA_TOKEN=... WA_PHONE_ID=... CORS_ORIGIN=https://...
supabase functions deploy enviar-mensaje-staff
```

> **Gotcha del teléfono**: `customers.phone` guarda el `wa_id` **sin `+`**
> (ej. `51989453142`). No reescribas el número al pasarlo a los RPC o el lookup
> falla; a Meta se le mandan solo dígitos.

---

## 12. Seguridad

- **Autorización real de staff**: RLS restrictiva por `es_staff()`. Antes,
  *estar autenticado* equivalía a *ser staff*, y con el signup público de
  Supabase cualquiera podía leer conversaciones, DNIs y teléfonos. Cerrado en la
  migración `16`.
- **Anti-XSS**: todo dato del cliente (nombre, notas, placa, teléfono, contenido
  de WhatsApp) pasa por `esc()` antes de tocar el DOM; toasts y modal usan
  `textContent`.
- **CSP estricta** en nginx y en Vercel: `self` + jsdelivr (SDK) + Google Fonts;
  `frame-ancestors 'none'`, HSTS, COOP, `nosniff`, `X-Frame-Options: DENY`.
- **SDK pineado** a `@supabase/supabase-js@2.110.2` (versión exacta, no rango).
- **Secretos fuera del cliente**: el token de Meta y el App Secret viven en la
  Edge Function y en las variables de n8n.
- **Sesión**: cierre automático a los **30 minutos** de inactividad (el panel
  muestra PII).
- **Auditoría** de cambios de estado, handoff y envíos manuales.

**Pasos que corres tú** (no están en el código):

1. Auth → Providers → Email: desactivar *Allow new users to sign up*.
2. Activar **CAPTCHA** (Turnstile/hCaptcha) contra fuerza bruta.
3. `CORS_ORIGIN` de la Edge Function apuntando al dominio real.
4. Confirmar HTTPS/HSTS en el proxy.

---

## 13. Accesibilidad y rendimiento

- Respeta `prefers-reduced-motion` (se apagan escaneos, pulsos y count-ups).
- Animaciones solo con `transform`/`opacity` (compositor-friendly).
- Dos familias tipográficas con `font-display: swap`; el SDK de Supabase se
  descarga **solo en modo real** (import dinámico).
- Carga perezosa por sección: abrir *Citas* no descarga *Métricas*.
- Responsive 320 / 768 / 1024 / 1440: KPIs en carrusel con scroll-snap; la tabla
  se convierte en tarjetas apiladas en móvil.
- Navegación por teclado: al cambiar de sección se mueve el foco al contenedor
  con `aria-label` y se marca `aria-current="page"`.
