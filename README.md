# 🐆 Jaguar Carwash — Dashboard del staff

Panel de control donde el staff gestiona las citas de lavado que crea el bot de
WhatsApp (n8n + Supabase). **HTML + CSS + JS vanilla**, sin build, sin frameworks.
Se sirve como estáticos con nginx dentro de Docker.

## Estructura

```
CardwashJaguar/
├── dashboard/               # La app (esto es lo que se despliega)
│   ├── index.html           # Login in-page + panel
│   ├── css/                 # tokens → base → styles → components → responsive
│   ├── js/
│   │   ├── config.js        # ⚙️ ÚNICO archivo a editar (demo/real, llaves)
│   │   ├── supabase.js      # Cliente Supabase v2 (CDN, carga perezosa)
│   │   ├── auth.js          # Login demo/real, sesión persistente
│   │   ├── data.js          # Store inmutable, datos demo, filtros, KPIs
│   │   ├── render.js        # Tabla, cards, bahías, gráficos canvas (anti-XSS)
│   │   ├── actions.js       # Acciones del staff (optimista + rollback)
│   │   ├── realtime.js      # Realtime Supabase / simulador demo + polling
│   │   ├── ui.js            # Toasts, modal, count-up, resaltado
│   │   └── app.js           # Orquestador
│   ├── nginx.conf           # Cabeceras de seguridad (CSP, nosniff, etc.)
│   └── Dockerfile           # nginx:alpine, expone puerto 80
├── docker-compose.yml       # Para el VPS (puerto 8080 → 80)
└── .github/workflows/deploy.yml  # Push a main → deploy automático al VPS
```

## Probar en local

**Opción A — servidor estático (recomendada para desarrollo):**

```bash
cd dashboard
python -m http.server 8080
# abre http://localhost:8080
```

> Nota: abrir `index.html` con doble click NO funciona (los módulos ES
> requieren `http://`). Usa cualquier servidor estático.

**Opción B — Docker (idéntico a producción):**

```bash
docker compose up --build
# abre http://localhost:8080
```

**Credenciales demo:** `staff@jaguar.pe` / `demo123`

## Modo demo vs modo real

En [dashboard/js/config.js](dashboard/js/config.js):

| Flag | Comportamiento |
|------|----------------|
| `MODO_DEMO = true` | 20 citas de muestra + eventos simulados cada ~25 s. No requiere backend. |
| `MODO_DEMO = false` | Supabase real: login con `signInWithPassword`, lectura de la vista `v_citas`, canal Realtime + polling de respaldo cada 20 s. |

Para el modo real, completa `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY`.

> ⚠️ **NUNCA** pongas una `service_role` key en `config.js`. Este código corre
> en el navegador: solo la clave **publicable** (anon), protegida por RLS.

### SQL sugerido en Supabase

```sql
-- Tabla que alimenta el bot de n8n
create table public.citas (
  id uuid primary key default gen_random_uuid(),
  cliente text not null,
  telefono text not null,
  placa text not null,
  tipo_vehiculo text not null check (tipo_vehiculo in ('auto','suv','camioneta','moto')),
  servicio text not null check (servicio in ('basico','premium','detailing')),
  precio numeric not null check (precio >= 0),
  fecha_hora timestamptz not null,
  bahia int check (bahia between 1 and 4),
  estado text not null default 'pendiente'
    check (estado in ('pendiente','confirmada','en_proceso','listo','completada','cancelada','no_show')),
  notas text default '',
  iniciado_en timestamptz,
  creado_en timestamptz default now()
);

-- Vista de lectura para el dashboard
create view public.v_citas as
  select id, cliente, telefono, placa, tipo_vehiculo, servicio,
         precio, fecha_hora, bahia, estado, notas, iniciado_en
  from public.citas;

-- RLS: solo staff autenticado puede leer/actualizar
alter table public.citas enable row level security;
create policy "staff lee citas" on public.citas
  for select to authenticated using (true);
create policy "staff actualiza estado" on public.citas
  for update to authenticated using (true) with check (true);

-- Realtime sobre la tabla
alter publication supabase_realtime add table public.citas;
```

El aviso de WhatsApp al pasar a **listo** lo dispara n8n escuchando el cambio
de estado en la tabla (webhook/trigger de Supabase) — el dashboard solo cambia
el estado.

## Despliegue automático al VPS (GitHub → push → producción)

1. **Crea el repo y súbelo** (desde esta carpeta):

   ```bash
   git remote add origin git@github.com:TU-USUARIO/cardwash-jaguar.git
   git push -u origin main
   ```

2. **Prepara el VPS** (una sola vez; requiere Docker + git):

   ```bash
   sudo mkdir -p /opt/cardwash-jaguar && sudo chown $USER /opt/cardwash-jaguar
   git clone git@github.com:TU-USUARIO/cardwash-jaguar.git /opt/cardwash-jaguar
   cd /opt/cardwash-jaguar && docker compose up -d --build
   ```

3. **Crea una clave SSH solo para deploy** (en tu máquina):

   ```bash
   ssh-keygen -t ed25519 -f deploy_jaguar -N "" -C "deploy-jaguar"
   # copia deploy_jaguar.pub a ~/.ssh/authorized_keys del usuario del VPS
   ```

4. **Configura los secretos** en GitHub → repo → *Settings → Secrets and
   variables → Actions*:

   | Secreto | Valor |
   |---------|-------|
   | `VPS_HOST` | IP o dominio del VPS |
   | `VPS_USER` | usuario SSH |
   | `VPS_SSH_KEY` | contenido de `deploy_jaguar` (la clave privada) |
   | `VPS_PORT` | opcional, por defecto 22 |

5. Listo: **cada `git push` a `main` despliega solo** (ver
   [.github/workflows/deploy.yml](.github/workflows/deploy.yml)).

> Recomendado en producción: pon el contenedor detrás de un reverse proxy con
> HTTPS (Caddy lo hace en 3 líneas) y agrega `Strict-Transport-Security` ahí.

## Seguridad incluida

- **Anti-XSS**: todo dato del cliente (nombre, notas, placa, teléfono) pasa por
  `esc()` antes de tocar el DOM; toasts y modal usan `textContent`.
- **CSP estricta** en nginx: solo `self`, jsdelivr (SDK Supabase) y Google Fonts.
- `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`,
  `Permissions-Policy`, `server_tokens off`.
- Solo clave **publicable** en el cliente + RLS en Supabase.
- Validación de inputs en el login y de acciones en `actions.js` (no se confía
  en atributos del DOM).
- Contenedor con `no-new-privileges`, healthcheck y logs rotados.

## Accesibilidad y rendimiento

- Respeta `prefers-reduced-motion` (se apagan escaneos, pulsos y count-ups).
- Animaciones solo con `transform`/`opacity` (compositor-friendly).
- 2 familias tipográficas con `font-display: swap`; SDK de Supabase solo se
  descarga en modo real (import dinámico).
- Responsive 320 / 768 / 1024 / 1440: KPIs en carrusel con scroll-snap y tabla
  → tarjetas apiladas en móvil.
