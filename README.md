# Cochis IA — Listo para Vercel

Asistente conversacional con IA, representado por **Cochis** — un pastor alemán con birrete y lentes, el "perro graduado que sabe de todo". Frontend React + Vite, funciones serverless de Vercel para el backend, OpenAI para el chat y la generación de imágenes, autenticación con email + contraseña y persistencia en PostgreSQL (Neon recomendado).

## Lo que incluye

- Chat conversacional con streaming en tiempo real (SSE).
- **Generación de imágenes** con botón de varita mágica (no hace falta ningún comando).
- **Adjuntá fotos** para que la IA las analice (análisis de imagen con visión IA).
- **Cuentas con email + contraseña**: el usuario crea su cuenta una sola vez y vuelve a entrar desde cualquier dispositivo.
- Sesiones persistentes con cookie `HttpOnly` (60 días).
- Sidebar con historial, eliminar conversación, modo claro/oscuro.

## Despliegue rápido

### 1. Conseguí las credenciales

1. **API key de OpenAI** — creala en <https://platform.openai.com/api-keys>. Necesitás acceso a `gpt-image-1` para generar imágenes.
2. **Base de datos PostgreSQL serverless**. Recomendado: [Neon](https://neon.tech) (plan gratuito).
   - Creá un proyecto → copiá la **Pooled connection** string (termina en `-pooler...`).

### 2. Creá las tablas en la base

Desde tu computador, con esta carpeta abierta:

```bash
npm install
cp .env.example .env
# Editá .env con tus claves reales
npm run db:push
```

Esto crea las tablas `users`, `sessions`, `conversations` y `messages`.

### 3. Desplegalo en Vercel

**Opción A — Conectar GitHub (recomendado):**

1. Subí esta carpeta a un repo de GitHub.
2. En [vercel.com](https://vercel.com): **Add New → Project → importá el repo**.
3. Vercel detecta automáticamente que es Vite. Verifica:
   - Framework Preset: **Vite**
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. En **Settings → Environment Variables** agregá:
   - `OPENAI_API_KEY`
   - `DATABASE_URL`
   - (Opcional) `OPENAI_MODEL` — por defecto `gpt-4o-mini`
   - (Opcional) `OPENAI_IMAGE_MODEL` — por defecto `gpt-image-1`
5. **Deploy**.

**Opción B — Vercel CLI:**

```bash
npm install -g vercel
vercel login
vercel --prod
```

Cuando te pregunte por las configuraciones, aceptá los valores detectados (Vite, dist, etc.). Luego configurá las variables de entorno desde el dashboard de Vercel.

## Desarrollo local

```bash
npm install
npm install -g vercel
cp .env.example .env  # completá con tus claves
vercel dev
```

Abrí <http://localhost:3000>. El comando `vercel dev` emula tanto el frontend como las funciones serverless localmente.

Si preferís correr solo el frontend (sin funciones):

```bash
npm run build  # solo verificación de tipos + build
# o directamente:
npx vite       # pero las llamadas a /api/ fallarán sin el servidor
```

## Estructura

```
vercel-deploy/
├── vercel.json            # configuración de Vercel (rewrites + maxDuration)
├── api/
│   └── [...path].ts       # función serverless catch-all → maneja todas las rutas /api/*
├── drizzle/
│   └── schema.ts          # esquema DB (users, sessions, conversations, messages)
├── drizzle.config.ts
├── src/
│   ├── hooks/use-auth.tsx  # contexto de auth (login/registro/logout)
│   ├── pages/login.tsx
│   ├── pages/register.tsx
│   ├── pages/landing.tsx
│   ├── pages/chat.tsx      # chat + adjuntar imagen + generar imagen
│   ├── components/layout.tsx
│   └── lib/api.ts
└── public/cochis_logo.png
```

## Endpoints del API

Todos manejados por `api/[...path].ts`:

### Públicos

- `GET  /api/suggested-prompts`
- `POST /api/auth/register` — `{ email, password, displayName? }`
- `POST /api/auth/login` — `{ email, password }`
- `POST /api/auth/logout`
- `GET  /api/auth/me`

### Protegidos (requieren cookie `cochis_session`)

- `GET  /api/conversations`
- `POST /api/conversations` — `{ title }`
- `GET  /api/conversations/:id`
- `DELETE /api/conversations/:id`
- `POST /api/conversations/:id/messages` — SSE stream.
  - `{ content, generateImage?: boolean }` → si `generateImage: true`, genera imagen.
  - `{ content, imageData?: string }` → si `imageData` es una data URL, analiza la imagen con visión IA.

## Notas técnicas

- Las contraseñas se hashean con `scrypt` (nativo de Node.js, sin dependencias extra).
- Las sesiones se guardan en la tabla `sessions` con expiración de 60 días.
- Las imágenes generadas se devuelven como base64 inline en el mensaje (no requieren S3 ni almacenamiento externo).
- Límite de cuerpo de Vercel: 4.5 MB. Las imágenes adjuntadas muy grandes pueden fallar; recortá o comprimí antes de pegar.
- Si Neon muestra "endpoint disabled", refrescá: la base se duerme en el plan free y se despierta sola.
