# Ziru

Listas de deseos para compartir: inicio de sesión con Google o con email, listas y regalos editables, enlace público sin necesidad de cuenta y marcado de regalos como comprados (oculto para el dueño de la lista).

Se puede instalar como app (PWA) desde Safari en iPhone (Compartir → Añadir a pantalla de inicio) y desde Chrome en Android (Instalar app).

**Stack:** Vite + React + TypeScript · Tailwind v4 + shadcn/ui · Hono (API en `/api`) · Neon Postgres (`pg`) · Neon Auth (Managed Better Auth, `@neon/auth`) · Vercel.

## Puesta en marcha

```bash
npm install
neon env pull          # o `neon deploy`: escribe .env.local
npm run db:migrate     # aplica db/schema.sql (idempotente)
npm run dev            # http://localhost:5173 (frontend + API en el mismo servidor)
```

## Estructura

| Ruta | Qué hay |
| --- | --- |
| `src/pages` | Inicio, login/registro, mis listas, editor de lista, lista compartida (`/l/:slug`) y perfil |
| `src/components` | Diálogos de lista y regalo (autocompletar desde URL, subida de foto), tarjetas, tema claro/oscuro |
| `server/app.ts` | API Hono: listas, regalos, compras, seguir listas, metadatos de enlaces, imágenes |
| `server/auth.ts` | Verifica el JWT de Neon Auth (`Authorization: Bearer`) contra el JWKS |
| `server/metadata.ts` | Lee `og:*`, JSON-LD `Product` y `<title>` de la página (con protección SSRF) |
| `api/[...route].ts` | Entrada de Vercel Functions → app Hono |
| `db/schema.sql` | Tablas `lists`, `items`, `purchases`, `follows`, `images` |

## Reglas de negocio

- El dueño **nunca** recibe el estado de compra (ni en el editor ni en el enlace público).
- Cualquiera con el enlace puede marcar un regalo como comprado; se guarda un hash de un token aleatorio del navegador para poder **desmarcarlo** desde el mismo navegador (o desde cualquier dispositivo si se marcó con sesión iniciada).
- Los usuarios con sesión pueden **seguir** una lista compartida y la verán en su perfil.

## Despliegue en Vercel

1. Importa el repo en Vercel (framework: Vite). Añade `DATABASE_URL`, `NEON_AUTH_BASE_URL` y `NEON_AUTH_JWKS_URL` como variables de entorno.
2. Autoriza el dominio de producción en Neon Auth: `neon neon-auth domain add https://tu-dominio.vercel.app`
3. Para producción, configura tus propias credenciales OAuth de Google (`neon neon-auth oauth-provider ...`) y un SMTP propio; las compartidas de Neon son solo para desarrollo.
