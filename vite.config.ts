import path from 'node:path'
import devServer from '@hono/vite-dev-server'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  // Make .env / .env.local (DATABASE_URL, NEON_AUTH_*) visible to the API in dev.
  const env = loadEnv(mode, process.cwd(), '')
  for (const [k, v] of Object.entries(env)) process.env[k] ??= v

  return {
    plugins: [
      react(),
      tailwindcss(),
      devServer({
        entry: 'server/app.ts',
        // Only /api/* goes to Hono; everything else is served by Vite.
        exclude: [/^(?!\/api(\/|$)).*/],
        injectClientScript: false,
      }),
    ],
    resolve: {
      alias: { '@': path.resolve(import.meta.dirname, './src') },
    },
    define: {
      // The public Auth URL is the branch's NEON_AUTH_BASE_URL unless overridden.
      'import.meta.env.VITE_NEON_AUTH_URL': JSON.stringify(
        env.VITE_NEON_AUTH_URL || env.NEON_AUTH_BASE_URL || '',
      ),
    },
  }
})
