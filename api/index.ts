// Vercel Function entry. vercel.json rewrites every /api/* request here; the
// original URL is preserved, so the Hono router (basePath '/api') sees the real path.
// (A `[...route]` catch-all file only matches multi-segment paths in Next.js projects.)
import { handle } from 'hono/vercel'
import { app } from '../server/app.js'

const handler = handle(app)

export const GET = handler
export const POST = handler
export const PUT = handler
export const PATCH = handler
export const DELETE = handler
