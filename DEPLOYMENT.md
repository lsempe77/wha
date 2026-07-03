# Guía de despliegue paso a paso

Esta guía te lleva desde cero hasta tener el WhatsApp Broadcaster en producción:
1. Meta Business (WhatsApp Cloud API)
2. Supabase (Postgres)
3. Upstash (Redis)
4. Render (backend + worker)
5. Conexión final + verificación

> Tiempo estimado: 60–90 min. Necesitas una cuenta en cada servicio (todos tienen free tier) y acceso a https://github.com/lsempe77/wha.git (tu repo ya pusheado).

---

## Paso 1 — Meta Business: WhatsApp Cloud API

Meta exige crear una "App de Business" y aprobar el número de teléfono. Sin esto no puedes enviar mensajes.

### 1.1 Crear la App de Meta

1. Ve a **https://developers.facebook.com/** e inicia sesión con tu cuenta de Facebook.
2. Haz clic en **My Apps** (arriba) → **Create App**.
3. Tipo: **Business** → dale un nombre (ej: `wa-broadcaster`) y selecciona tu Business Account (o crea una si no tienes).
4. En el dashboard de la app, en **Add a Product**, busca **WhatsApp** → **Set Up**.
5. Selecciona la **Meta Business Account** que usarás.

### 1.2 Obtener credenciales

En el menú izquierdo → **WhatsApp → API Setup**:

6. Copia estos valores y guárdalos en un bloc de notas temporal:
   - **Phone number ID** → será `WHATSAPP_PHONE_NUMBER_ID`
   - El número de teléfono que aparece (ej: +1 555...) → `WHATSAPP_BUSINESS_PHONE`

7. En **WhatsApp → Configuration** (o API Setup, sección "Access Token"):
   - Verás un **temporary access token**. NO uses ese para producción (expira en 24h).
   - Para uno permanente: ve a **System Users** (más abajo, paso 1.4).

### 1.3 Crear token de acceso permanente

8. En el menú izquierdo → **App settings → Business settings** (te lleva a business.facebook.com) O directamente ve a **https://business.facebook.com/settings/users**.
9. Selecciona tu Business → **Users → System Users** → **Add** → crea un usuario de sistema llamado `wa-broadcaster`, rol **Admin**.
10. Haz clic en **Add assets** → selecciona tu App y tu número de WhatsApp → asigna permisos **Manage phone number**.
11. Haz clic en **Generate new token** → selecciona la app → permisos: `whatsapp_business_messaging` y `whatsapp_business_management` → **Generate access token**.
12. **Copia el token AHORA** (solo se ve una vez). Este es tu `WHATSAPP_ACCESS_TOKEN`.

> ⚠️ Guárdalo en un gestor de contraseñas. No se puede volver a ver; si lo pierdes, generas otro.

### 1.4 Obtener el App Secret

13. Vuelve a **https://developers.facebook.com/** → tu app → **App settings → Basic**.
14. Copia el **App Secret** → será `WHATSAPP_APP_SECRET` (para verificar la firma del webhook).

### 1.5 Crear y aprobar plantillas de mensaje

WhatsApp solo permite enviar **plantillas aprobadas** (templates) para iniciar conversaciones. Sin plantilla aprobada, no envías nada.

15. En **https://business.facebook.com/settings/whatsapp-message-templates** (o WhatsApp Manager dentro de la app).
16. **Create template** → elige:
    - **Name**: en minúsculas, guiones bajos, ej: `promo_viernes` (sin espacios). Este es el `templateName` que pondrás en el dashboard.
    - **Language**: elige el/los idiomas (ej: `Spanish`). El código se refleja en el dashboard (`es`).
    - **Category**: **Marketing** (para promos) o **Utility** (para recordatorios/citas).
    - **Body**: escribe el texto. Usa variables `{{1}}`, `{{2}}` donde quieras personalizar.

    Ejemplo de body:
    ```
    Hola {{1}}, ¡tenemos una promo para ti! {{2}}% de descuento hasta el {{3}}.
    ```
17. **Submit for review**. Meta revisa en **24–48h** (a veces minutos). Verás "Approved" cuando esté lista.

> Solo los templates con estado **Approved** se pueden enviar. Si envías uno pendiente o rechazado, la API da error.

### 1.6 Configurar el webhook (lo completamos en el Paso 6)

Esto se hace DESPUÉS de tener el host público en Render. Lo anotamos aquí para tenerlo presente:

18. Inventa un **verify token** (string aleatorio, ej: `mi_token_secreto_xyz`) → será `WHATSAPP_WEBHOOK_VERIFY_TOKEN`.
19. La callback URL será: `https://<tu-host-de-render>/api/webhook` (lo sabrás tras el Paso 4).

---

## Paso 2 — Supabase: base de datos Postgres

Supabase ofrece Postgres gratis (500MB, suficiente para empezar).

### 2.1 Crear proyecto

1. Ve a **https://supabase.com/** → **Start your project** → inicia sesión (GitHub o email).
2. **New project**:
   - Name: `wa-broadcaster`
   - Database password: genera una **fuerte** y guárdala (no la pierdas).
   - Region: la más cercana a tus usuarios (ej: `EU West` o `US East`).
3. Espera ~2 min a que se aprovisione.

### 2.2 Obtener la connection string

4. En el dashboard del proyecto → **Project Settings** (icono ⚙️ abajo izq) → **Database**.
5. En **Connection string**, elige **URI** → copia la URL. Se ve así:
   ```
   postgresql://postgres:[TU_PASSWORD]@db.xxxxxx.supabase.co:5432/postgres
   ```
   Sustituye `[TU_PASSWORD]` por la contraseña del paso 2.1.

6. (Opcional pero recomendado) En **Connection pooling**, usa la **connection pooler URL** (formato `:6543`) para mejor rendimiento con serverless/Render:
   ```
   postgresql://postgres.xxxxxx:[PASSWORD]@aws-0-region.pooler.supabase.com:6543/postgres
   ```
   Añade `?pgbouncer=true` al final si usas el pooler.

> Este valor será tu `DATABASE_URL` en Render.

### 2.3 Habilitar IPv4 / acceso

7. En **Database → Network restrictions** (o Configuration): asegúrate de que está abierto (Supabase permite conexiones por defecto desde cualquier IP en free tier). No necesitas añadir IPs.

---

## Paso 3 — Upstash: Redis serverless

Upstash ofrece Redis gratis (10k comandos/día) y es compatible con BullMQ. Es serverless, ideal para Render.

### 3.1 Crear base de datos Redis

1. Ve a **https://upstash.com/** → **Sign Up** (GitHub o Google).
2. **Console → Create Database**:
   - Name: `wa-broadcaster`
   - Region: la **misma** que Supabase/Render para minimizar latencia.
   - Type: **Regional Redis** (gratis).
3. Create.

### 3.2 Obtener la connection string

4. En el detalle de la base → copia el **REST URL** o mejor el **UPSTASH_REDIS_URL** (endpoint estándar). BullMQ necesita el formato `rediss://` (con doble s, TLS).

5. Deberías ver algo como:
   ```
   rediss://default:<TOKEN>@<region>-<id>.upstash.io:6379
   ```

> ⚠️ **Importante**: Upstash tiene un modo "Eviction" (expulsión de claves). BullMQ necesita persistencia. En la configuración de la DB en Upstash, desactiva **Eviction** (o configúralo en `noeviction`). Si no lo ves, Upstash free permite claves hasta ~100MB; BullMQ suele funcionar, pero para producción alta volumen considera Upstash Pay-as-you-go.

> Este valor será tu `REDIS_URL` en Render.

---

## Paso 4 — Render: desplegar backend + worker

Render despliega apps desde GitHub. Tu repo ya está en `lsempe77/wha`.

Render requiere **Docker** para nuestro caso (necesitamos build del frontend + Prisma). El free tier de Render incluye 1 web service gratis (con sleep tras inactividad) — suficiente para pruebas. Para producción real, el plan **Starter** ($7/mes) evita el sleep.

### 4.1 Crear el web service (API)

1. Ve a **https://render.com/** → **Sign Up** (GitHub).
2. **New +** → **Web Service** → conecta GitHub si no lo está → selecciona el repo `lsempe77/wha`.
3. Configura:
   - **Name**: `wa-broadcaster-api`
   - **Region**: la misma que Supabase/Upstash.
   - **Runtime**: **Docker** (Render detecta el Dockerfile).
   - **Instance Type**: **Free** (pruebas) o **Starter** ($7/mes, recomendado para que no duerma).
   - **Docker Command**: déjalo vacío (usa el CMD del Dockerfile: `node src/server.js`).

4. En **Environment Variables**, añade TODAS estas:

   | Key | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `DATABASE_PROVIDER` | `postgresql` |
   | `DATABASE_URL` | *(la URL de Supabase del Paso 2.2)* |
   | `REDIS_URL` | *(la URL de Upstash del Paso 3.2)* |
   | `WHATSAPP_PHONE_NUMBER_ID` | *(del Paso 1.2)* |
   | `WHATSAPP_ACCESS_TOKEN` | *(del Paso 1.3)* |
   | `WHATSAPP_BUSINESS_PHONE` | *(del Paso 1.2, opcional)* |
   | `WHATSAPP_API_VERSION` | `v21.0` |
   | `WHATSAPP_RATE_LIMIT_PER_MIN` | `250` |
   | `WHATSAPP_APP_SECRET` | *(del Paso 1.4)* |
   | `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | *(el token que inventaste en Paso 1.6)* |
   | `JWT_SECRET` | *(genera 32+ chars aleatorios: `openssl rand -hex 32`)* |
   | `JWT_EXPIRES_IN` | `7d` |
   | `ADMIN_EMAIL` | tu correo de admin, ej: `tu@correo.com` |
   | `ADMIN_PASSWORD` | *(clave fuerte; el primer login del dashboard)* |
   | `CORS_ORIGIN` | `*` (o tu dominio si usas uno custom) |
   | `API_KEY` | *(déjalo vacío para usar JWT; o pon un string para doble auth)* |

5. **Create Web Service**. Render empieza el build (5–8 min la primera vez: instala deps, construye frontend, genera Prisma).

6. Cuando termine, verás una URL pública tipo:
   ```
   https://wa-broadcaster-api.onrender.com
   ```
   Anótala — la necesitas para el webhook de Meta y para abrir el dashboard.

7. Verifica: abre `https://wa-broadcaster-api.onrender.com/api/status/health` en el navegador. Debes ver:
   ```json
   {"status":"healthy","checks":{"db":"ok","redis":"ok","whatsappConfigured":true}}
   ```
   Si `db` o `redis` dice `fail`, revisa que pegaste bien las URLs.

8. Las migraciones de Prisma corren automáticamente al arranque (`prisma migrate deploy --schema=prisma/schema.prod.prisma` está en el CMD del compose, pero el Dockerfile usa `node src/server.js`). Si la tabla `User` no existe, el seedAdmin fallará silenciosamente. Para forzar migración manual, ve a **Shell** en Render y ejecuta:
   ```bash
   npx prisma migrate deploy --schema=prisma/schema.prod.prisma
   ```
   (Alternativa: añade al Dockerfile CMD `sh -c "npx prisma migrate deploy --schema=prisma/schema.prod.prisma && node src/server.js"`. Ver sección "Ajuste opcional" al final.)

### 4.2 Crear el worker (procesa la cola)

El worker es un proceso separado que envía los mensajes. Render lo despliega como otro web service (o background worker).

9. **New +** → **Background Worker** (Render tiene esto; si free no lo soporta, usa Web Service con `start:worker`). Selecciona el mismo repo `lsempe77/wha`.
10. Configura igual que el API:
    - **Name**: `wa-broadcaster-worker`
    - **Runtime**: **Docker**
    - **Docker Command**: en **Docker Command** o **Start Command** pon:
      ```
      node src/worker.js
      ```
      (sobrescribe el CMD del Dockerfile)
11. **Environment Variables**: copia EXACTAMENTE las mismas del API (mismas claves y valores). Puedes usar la función "Duplicate from" de Render para clonarlas.
12. **Create Background Worker**.

> El worker NO expone un puerto; es solo consumidor de colas. Si Render exige un puerto/healthcheck, el Dockerfile ya tiene un HEALTHCHECK que Render puede usar.

### 4.3 Ajuste opcional: forzar migraciones al arranque

Si las migraciones no corren solas en Render (porque el Dockerfile CMD es solo `node src/server.js`), edita el `Dockerfile`:

```dockerfile
CMD ["sh", "-c", "npx prisma migrate deploy --schema=prisma/schema.prod.prisma && node src/server.js"]
```

Haz commit + push y Render redeployará automáticamente.

---

## Paso 5 — Verificar el dashboard

1. Abre `https://wa-broadcaster-api.onrender.com/` en el navegador.
2. Debes ver la pantalla de **login**.
3. Entra con `ADMIN_EMAIL` / `ADMIN_PASSWORD` que configuraste en Render.
4. Si entra, el auth funciona. Si da "Invalid credentials", el admin no se creó → revisa migraciones (Paso 4.1 punto 8) y logs de Render.

---

## Paso 6 — Configurar el webhook en Meta (¡importante!)

Sin webhook, los estados (delivered/read/failed) no se actualizan en el dashboard.

1. Ve a **https://developers.facebook.com/** → tu app → **WhatsApp → Configuration**.
2. En **Webhook**:
   - **Callback URL**: `https://wa-broadcaster-api.onrender.com/api/webhook` (tu URL de Render + `/api/webhook`).
   - **Verify Token**: el `WHATSAPP_WEBHOOK_VERIFY_TOKEN` que pusiste en Render.
   - Haz clic en **Verify and Save**. Si Meta responde "verified", la firma HMAC y el token funcionan. Si da error, revisa que `WHATSAPP_APP_SECRET` y `WHATSAPP_WEBHOOK_VERIFY_TOKEN` coincidan en Render y Meta.
3. En **Webhook fields**, suscríbete a: **`messages`** (marca el checkbox). Esto activa los callbacks de estado.

> El webhook es verificado por firma (`x-hub-signature-256`) usando `WHATSAPP_APP_SECRET`. Si ese env var está vacío, la verificación se omite (inseguro). En producción SIEMPRE ponlo.

---

## Paso 7 — Prueba end-to-end

### 7.1 Añade tu propio teléfono como contacto

WhatsApp permite enviar a números que NO están verificados solo en modo test. Para producción, necesitas añadir "test recipients" o completar la verificación del negocio.

1. En Meta → **WhatsApp → API Setup**, abajo hay **"To"** con un campo para añadir números de prueba. Añade tu teléfono (con código de país, ej: `34600000000`).
2. En el dashboard → **Contactos → Subir CSV**: sube un CSV con tu teléfono:
   ```
   phone,name
   34600000000,Mi prueba
   ```
3. En Meta usa la plantilla `hello_world` que viene pre-aprobada de ejemplo, o una tuya ya aprobada.

### 7.2 Crea y envía una campaña

4. Dashboard → **Nueva campaña**:
   - Nombre: `Prueba 1`
   - Template: `hello_world` (pre-aprobada de Meta, language `en_US`) o la tuya aprobada.
   - Parámetros: si `hello_world` usa `{{1}}`, pon tu nombre: `Lucas`
   - Destinatarios: selecciona tu contacto.
   - Programación: pon una fecha en el pasado (ej: ahora menos 1h) para que se envíe de inmediato.
5. **Crear campaña**. Verás el detalle.
6. En 30–60s deberías ver el estado pasar de `QUEUED` → `SENT` → `DELIVERED` (y `READ` si lo abres en tu WhatsApp).
7. Revisa tu WhatsApp: debe llegar el mensaje.

> Si el estado se queda en `QUEUED`: el worker no está corriendo. Revisa logs del worker en Render.
> Si pasa a `FAILED` con error de "template not approved": el template no está aprobado o el nombre/idioma no coinciden exactamente.

### 7.3 Subir volumen

8. Una vez confirmado, sube tu CSV completo (hasta 50k contactos vía `/contacts/bulk`).
9. Crea campañas con programación futura para escalar.

---

## Paso 8 — Sobre los límites de Meta y el free tier

### Límites de WhatsApp Cloud API

- **Tier inicial**: 1000 conversaciones business-initiated / 24h. Sube automáticamente a medida que envías volumen con buena calidad.
- **Rate limit por número**: `WHATSAPP_RATE_LIMIT_PER_MIN` controla cuántos mensajes/min envías. Ajústalo a tu tier (Meta lo muestra en Business Manager). Si envías más rápido, BullMQ encola y reintenta con backoff.
- **Ventana de 24h**: fuera de ella, solo templates aprobados. Dentro (si el usuario te responde), puedes enviar mensajes libres.
- **Quality rating**: si muchos usuarios marcan como spam, Meta baja tu tier o bloquea. Usa opt-in y mensajes relevantes.

### Límites del free tier

| Servicio | Free | Cuándo upgrade |
|---|---|---|
| **Supabase** | 500MB DB, pausa tras inactividad | >500MB o queries lentas |
| **Upstash** | 10k cmds/día, max 100MB | >10k cmds/día (cola grande) |
| **Render** | 1 web service, **duerme tras 15 min sin tráfico** | worker no soporta free en BG; usa Starter $7/mes |

> **El sleep de Render free es un problema**: si el web service duerme, el webhook de Meta no se recibe y los estados no actualizan. Para producción real, usa **Render Starter ($7/mes)** que no duerme. El worker en Background Worker free sí debería mantenerse, pero Render puede pausarlo; Starter es más seguro.

> Alternativa 100% gratis sin sleep: **Fly.io** (3 VMs small free, 256MB RAM suficiente). Misma config con Dockerfile. Deploy: `fly deploy`.

---

## Resumen de URLs y credenciales a tener a mano

Antes de empezar, prepara un archivo seguro con:

- [ ] `WHATSAPP_PHONE_NUMBER_ID` (Meta)
- [ ] `WHATSAPP_ACCESS_TOKEN` (Meta System User, permanente)
- [ ] `WHATSAPP_APP_SECRET` (Meta App Settings)
- [ ] `WHATSAPP_WEBHOOK_VERIFY_TOKEN` (lo inventas tú)
- [ ] `DATABASE_URL` (Supabase)
- [ ] `REDIS_URL` (Upstash)
- [ ] `JWT_SECRET` (lo generas: `openssl rand -hex 32`)
- [ ] `ADMIN_EMAIL` y `ADMIN_PASSWORD` (tu elección)
- [ ] URL pública de Render: `https://wa-broadcaster-api.onrender.com` (la sabes tras Paso 4)
- [ ] Plantilla aprobada en Meta (nombre + idioma exactos)

## Orden recomendado de ejecución

1. **Meta** (Paso 1): credenciales + plantilla (envía a aprobación y espera).
2. **Supabase** (Paso 2): mientras la plantilla se aprueba, crea la DB.
3. **Upstash** (Paso 3): crea Redis.
4. **Render API** (Paso 4.1): despliega con todas las env vars. Verifica `/health`.
5. **Render Worker** (Paso 4.2): despliega con las mismas env vars.
6. **Meta webhook** (Paso 6): cuando tengas la URL de Render, configura y verifica.
7. **Prueba end-to-end** (Paso 7): con tu teléfono de test y `hello_world`.

Si en algún paso te atascas, abre los **logs de Render** (tab Logs en cada service) — muestran errores de conexión a DB/Redis y de la API de WhatsApp con detalle.
