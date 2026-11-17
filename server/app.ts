import { createHash } from 'node:crypto'
import { Hono, type Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { handleAuthProxyRequest } from '@neon/auth/server'
import { z } from 'zod'
import { getUser, type AuthUser } from './auth.js'
import { query } from './db.js'
import { BlockedError, fetchMetadata, nameFromUrl } from './metadata.js'

type Env = { Variables: { user: AuthUser | null } }

export const app = new Hono<Env>().basePath('/api')

// ---------- helpers ----------

const uuid = z.uuid()
const optText = (max: number) =>
  z.string().trim().max(max).nullish().transform((v) => (v ? v : null))
const optUrl = z
  .string()
  .trim()
  .max(2000)
  .nullish()
  .transform((v) => (v ? v : null))
  .refine((v) => v == null || /^https?:\/\//i.test(v) || v.startsWith('/api/images/'), 'URL no válida')

const segmenter = new Intl.Segmenter('es', { granularity: 'grapheme' })
/** Exactly one grapheme that is an emoji (covers ZWJ sequences, skin tones, flags, keycaps). */
function isSingleEmoji(v: string) {
  const graphemes = [...segmenter.segment(v)]
  return graphemes.length === 1 && /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20E3/u.test(v)
}

const listInput = z.object({
  title: z.string().trim().min(1, 'El título es obligatorio').max(120),
  description: optText(1000),
  emoji: z.string().trim().max(32).default('🎁').refine(isSingleEmoji, 'El icono debe ser un único emoji'),
  eventDate: z.iso.date().nullish().transform((v) => v ?? null),
})

const itemInput = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(200),
  description: optText(2000),
  url: optUrl,
  price: z.coerce.number().min(0).max(99_999_999).nullish().transform((v) => (v == null ? null : v)),
  imageUrl: optUrl,
  priority: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullish().transform((v) => v ?? null),
  size: optText(40),
  color: optText(40),
})

async function body<T extends z.ZodType>(c: Context, schema: T): Promise<z.infer<T>> {
  const raw = await c.req.json().catch(() => {
    throw new HTTPException(400, { message: 'JSON no válido' })
  })
  const r = schema.safeParse(raw)
  if (!r.success) throw new HTTPException(400, { message: r.error.issues[0]?.message ?? 'Datos no válidos' })
  return r.data
}

function requireUser(c: Context<Env>) {
  const user = c.get('user')
  if (!user) throw new HTTPException(401, { message: 'Inicia sesión para continuar' })
  return user
}

function param(c: Context, name: string) {
  const v = c.req.param(name)
  if (!uuid.safeParse(v).success) throw new HTTPException(404, { message: 'No encontrado' })
  return v as string
}

const hashToken = (t: string) => createHash('sha256').update(t).digest('hex')

function claimToken(c: Context) {
  const t = c.req.header('x-claim-token')
  return t && t.length >= 16 && t.length <= 128 ? t : null
}

const LIST_COLS = `l.id, l.title, l.description, l.emoji, l.event_date as "eventDate", l.share_slug as "shareSlug",
  l.created_at as "createdAt", l.updated_at as "updatedAt"`
const ITEM_COLS = `i.id, i.name, i.description, i.url, i.price::float8 as price, i.image_url as "imageUrl",
  i.priority, i.size, i.color, i.position, i.created_at as "createdAt"`

async function ownedList(listId: string, userId: string) {
  const [list] = await query(`select ${LIST_COLS} from lists l where l.id = $1 and l.owner_id = $2`, [listId, userId])
  if (!list) throw new HTTPException(404, { message: 'Lista no encontrada' })
  return list
}

async function ownedItem(itemId: string, userId: string) {
  const [row] = await query(
    `select i.id, i.list_id as "listId" from items i join lists l on l.id = i.list_id where i.id = $1 and l.owner_id = $2`,
    [itemId, userId],
  )
  if (!row) throw new HTTPException(404, { message: 'Regalo no encontrado' })
  return row as { id: string; listId: string }
}

async function sharedList(slug: string) {
  if (!/^[a-f0-9]{8,64}$/.test(slug)) throw new HTTPException(404, { message: 'Lista no encontrada' })
  const [list] = await query(
    `select ${LIST_COLS}, l.owner_id as "ownerId", coalesce(nullif(u.name, ''), split_part(u.email, '@', 1)) as "ownerName",
       u.image as "ownerImage"
     from lists l join neon_auth."user" u on u.id = l.owner_id where l.share_slug = $1`,
    [slug],
  )
  if (!list) throw new HTTPException(404, { message: 'Lista no encontrada' })
  return list
}

// ---------- middleware ----------

app.use('*', async (c, next) => {
  c.set('user', await getUser(c))
  await next()
})

app.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status)
  console.error(err)
  return c.json({ error: 'Error interno del servidor' }, 500)
})

// ---------- auth proxy ----------
// The browser talks to Neon Auth through this same-origin proxy, so every auth
// cookie (OAuth state/challenge, session) is first-party on the app's domain.
// Without it, Safari/iOS blocks Neon Auth's cross-site cookies and Google sign-in
// fails with "State integrity check failed".
app.all('/auth/*', async (c) => {
  const baseUrl = process.env.NEON_AUTH_BASE_URL
  const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET
  if (!baseUrl || !cookieSecret || cookieSecret.length < 32) {
    console.error('Auth proxy misconfigured: NEON_AUTH_BASE_URL and NEON_AUTH_COOKIE_SECRET (32+ chars) are required')
    return c.json({ error: 'El inicio de sesión no está configurado en el servidor' }, 500)
  }
  return handleAuthProxyRequest({
    request: c.req.raw,
    path: c.req.path.replace(/^\/api\/auth\/?/, ''),
    baseUrl,
    cookieSecret,
  })
})

// ---------- health ----------

app.get('/health', async (c) => {
  const [r] = await query<{ now: string; lists: number }>(
    'select now()::text as now, (select count(*)::int from lists) as lists',
  )
  return c.json({ ok: true, db: r })
})

// ---------- my lists ----------

app.get('/me', (c) => c.json({ user: requireUser(c) }))

app.get('/me/lists', async (c) => {
  const user = requireUser(c)
  const lists = await query(
    `select ${LIST_COLS}, count(i.id)::int as "itemCount"
     from lists l left join items i on i.list_id = l.id
     where l.owner_id = $1 group by l.id order by l.created_at desc`,
    [user.id],
  )
  return c.json({ lists })
})

app.get('/me/following', async (c) => {
  const user = requireUser(c)
  const lists = await query(
    `select ${LIST_COLS}, coalesce(nullif(u.name, ''), split_part(u.email, '@', 1)) as "ownerName", u.image as "ownerImage",
       (select count(*)::int from items i where i.list_id = l.id) as "itemCount",
       (select count(*)::int from items i join purchases p on p.item_id = i.id where i.list_id = l.id) as "purchasedCount",
       f.created_at as "followedAt"
     from follows f join lists l on l.id = f.list_id join neon_auth."user" u on u.id = l.owner_id
     where f.user_id = $1 and l.owner_id <> $1 order by f.created_at desc`,
    [user.id],
  )
  return c.json({ lists })
})

app.post('/lists', async (c) => {
  const user = requireUser(c)
  const d = await body(c, listInput)
  const [list] = await query(
    `insert into lists as l (owner_id, title, description, emoji, event_date) values ($1, $2, $3, $4, $5)
     returning ${LIST_COLS}`,
    [user.id, d.title, d.description, d.emoji, d.eventDate],
  )
  return c.json({ list }, 201)
})

app.get('/lists/:id', async (c) => {
  const user = requireUser(c)
  const list = await ownedList(param(c, 'id'), user.id)
  // Purchase status is intentionally NOT returned to the owner (keeps the surprise).
  const items = await query(`select ${ITEM_COLS} from items i where i.list_id = $1 order by i.position, i.created_at`, [list.id])
  const [{ followers }] = await query<{ followers: number }>(
    'select count(*)::int as followers from follows where list_id = $1',
    [list.id],
  )
  return c.json({ list: { ...list, followers }, items })
})

app.patch('/lists/:id', async (c) => {
  const user = requireUser(c)
  const id = param(c, 'id')
  const d = await body(c, listInput)
  const [list] = await query(
    `update lists l set title = $3, description = $4, emoji = $5, event_date = $6, updated_at = now()
     where l.id = $1 and l.owner_id = $2 returning ${LIST_COLS}`,
    [id, user.id, d.title, d.description, d.emoji, d.eventDate],
  )
  if (!list) throw new HTTPException(404, { message: 'Lista no encontrada' })
  return c.json({ list })
})

app.delete('/lists/:id', async (c) => {
  const user = requireUser(c)
  const rows = await query('delete from lists where id = $1 and owner_id = $2 returning id', [param(c, 'id'), user.id])
  if (!rows.length) throw new HTTPException(404, { message: 'Lista no encontrada' })
  return c.json({ ok: true })
})

// ---------- items ----------

app.post('/lists/:id/items', async (c) => {
  const user = requireUser(c)
  const list = await ownedList(param(c, 'id'), user.id)
  const d = await body(c, itemInput)
  const [item] = await query(
    `insert into items as i (list_id, name, description, url, price, image_url, priority, size, color, position)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, coalesce((select max(position) + 1 from items where list_id = $1), 0))
     returning ${ITEM_COLS}`,
    [list.id, d.name, d.description, d.url, d.price, d.imageUrl, d.priority, d.size, d.color],
  )
  await query('update lists set updated_at = now() where id = $1', [list.id])
  return c.json({ item }, 201)
})

/** Reorder: body is the full list of item ids in the desired order. */
app.put('/lists/:id/order', async (c) => {
  const user = requireUser(c)
  const list = await ownedList(param(c, 'id'), user.id)
  const { itemIds } = await body(c, z.object({ itemIds: z.array(uuid).max(1000) }))
  if (new Set(itemIds).size !== itemIds.length) throw new HTTPException(400, { message: 'Hay regalos repetidos' })
  // Single statement: only succeeds when the ids are exactly this list's items.
  const rows = await query<{ updated: number; total: number }>(
    `with input as (
       select id, ord::int - 1 as pos from unnest($2::uuid[]) with ordinality as t(id, ord)
     ), valid as (
       select (select count(*) from items where list_id = $1) = cardinality($2::uuid[])
          and (select count(*) from input join items i on i.id = input.id and i.list_id = $1) = cardinality($2::uuid[]) as ok
     ), upd as (
       update items i set position = input.pos
       from input, valid where valid.ok and i.id = input.id and i.list_id = $1
       returning i.id
     )
     select (select count(*)::int from upd) as updated, cardinality($2::uuid[]) as total`,
    [list.id, itemIds],
  )
  if (rows[0].updated !== rows[0].total)
    throw new HTTPException(409, { message: 'La lista ha cambiado; recarga la página e inténtalo de nuevo' })
  await query('update lists set updated_at = now() where id = $1', [list.id])
  return c.json({ ok: true })
})

app.patch('/items/:id', async (c) => {
  const user = requireUser(c)
  const { id } = await ownedItem(param(c, 'id'), user.id)
  const d = await body(c, itemInput)
  const [item] = await query(
    `update items i set name = $2, description = $3, url = $4, price = $5, image_url = $6, priority = $7, size = $8,
       color = $9, updated_at = now()
     where i.id = $1 returning ${ITEM_COLS}`,
    [id, d.name, d.description, d.url, d.price, d.imageUrl, d.priority, d.size, d.color],
  )
  return c.json({ item })
})

app.delete('/items/:id', async (c) => {
  const user = requireUser(c)
  const { id } = await ownedItem(param(c, 'id'), user.id)
  await query('delete from items where id = $1', [id])
  return c.json({ ok: true })
})

// ---------- link metadata & images ----------

app.post('/metadata', async (c) => {
  requireUser(c)
  const { url } = await body(c, z.object({ url: z.url({ protocol: /^https?$/ }) }))
  try {
    return c.json({ metadata: await fetchMetadata(url) })
  } catch (e) {
    if (e instanceof BlockedError) return c.json({ error: e.message, code: 'blocked', suggestedName: nameFromUrl(url) ?? null }, 422)
    const message = e instanceof Error && e.name !== 'TimeoutError' ? e.message : 'La página tardó demasiado'
    return c.json({ error: `No se pudo leer la página: ${message}` }, 422)
  }
})

const MAX_IMAGE_BYTES = 1_500_000

app.post('/images', async (c) => {
  const user = requireUser(c)
  const { dataUrl } = await body(c, z.object({ dataUrl: z.string().max(2_100_000) }))
  const m = dataUrl.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/)
  if (!m) throw new HTTPException(400, { message: 'Formato de imagen no soportado' })
  const bytes = Buffer.from(m[2], 'base64')
  if (bytes.length > MAX_IMAGE_BYTES) throw new HTTPException(413, { message: 'La imagen es demasiado grande' })
  const [img] = await query<{ id: string }>(
    'insert into images (owner_id, mime, data) values ($1, $2, $3) returning id',
    [user.id, m[1], bytes],
  )
  return c.json({ url: `/api/images/${img.id}` }, 201)
})

app.get('/images/:id', async (c) => {
  const [img] = await query<{ mime: string; data: Buffer }>('select mime, data from images where id = $1', [param(c, 'id')])
  if (!img) throw new HTTPException(404, { message: 'Imagen no encontrada' })
  return c.body(new Uint8Array(img.data), 200, {
    'content-type': img.mime,
    'cache-control': 'public, max-age=31536000, immutable',
  })
})

// ---------- shared (public) lists ----------

app.get('/shared/:slug', async (c) => {
  const user = c.get('user')
  const list = await sharedList(c.req.param('slug'))
  const isOwner = user?.id === list.ownerId
  const token = claimToken(c)
  const tokenHash = token ? hashToken(token) : null

  const rows = await query(
    `select ${ITEM_COLS}, p.item_id is not null as purchased, p.buyer_name as "buyerName",
       (p.claim_token_hash = $2 or (p.buyer_user_id is not null and p.buyer_user_id = $3)) as mine
     from items i left join purchases p on p.item_id = i.id
     where i.list_id = $1 order by i.position, i.created_at`,
    [list.id, tokenHash, user?.id ?? null],
  )
  // The owner never sees what has been bought.
  const items = rows.map((r) =>
    isOwner ? { ...r, purchased: false, buyerName: null, mine: false } : { ...r, mine: Boolean(r.mine) },
  )
  let isFollowing = false
  if (user && !isOwner) {
    const f = await query('select 1 from follows where user_id = $1 and list_id = $2', [user.id, list.id])
    isFollowing = f.length > 0
  }
  const { ownerId: _ownerId, ...publicList } = list
  return c.json({ list: publicList, items, isOwner, isFollowing, signedIn: Boolean(user) })
})

async function sharedItem(c: Context<Env>) {
  const list = await sharedList(c.req.param('slug')!)
  const itemId = param(c, 'itemId')
  const [item] = await query('select id from items where id = $1 and list_id = $2', [itemId, list.id])
  if (!item) throw new HTTPException(404, { message: 'Regalo no encontrado' })
  return { list, itemId }
}

app.post('/shared/:slug/items/:itemId/purchase', async (c) => {
  const user = c.get('user')
  const { list, itemId } = await sharedItem(c)
  if (user?.id === list.ownerId) throw new HTTPException(403, { message: 'No puedes marcar regalos de tu propia lista' })
  const token = claimToken(c)
  if (!token) throw new HTTPException(400, { message: 'Falta el identificador del navegador' })
  const { buyerName } = await body(c, z.object({ buyerName: optText(80) }))
  const rows = await query(
    `insert into purchases (item_id, buyer_name, buyer_user_id, claim_token_hash) values ($1, $2, $3, $4)
     on conflict (item_id) do nothing returning item_id`,
    [itemId, buyerName, user?.id ?? null, hashToken(token)],
  )
  if (!rows.length) throw new HTTPException(409, { message: 'Alguien ya ha marcado este regalo como comprado' })
  return c.json({ ok: true }, 201)
})

app.delete('/shared/:slug/items/:itemId/purchase', async (c) => {
  const user = c.get('user')
  const { itemId } = await sharedItem(c)
  const token = claimToken(c)
  const rows = await query(
    `delete from purchases where item_id = $1
       and (claim_token_hash = $2 or (buyer_user_id is not null and buyer_user_id = $3)) returning item_id`,
    [itemId, token ? hashToken(token) : null, user?.id ?? null],
  )
  if (!rows.length) throw new HTTPException(403, { message: 'Solo quien lo marcó puede desmarcarlo' })
  return c.json({ ok: true })
})

app.post('/shared/:slug/follow', async (c) => {
  const user = requireUser(c)
  const list = await sharedList(c.req.param('slug'))
  if (list.ownerId === user.id) throw new HTTPException(400, { message: 'Es tu propia lista' })
  await query('insert into follows (user_id, list_id) values ($1, $2) on conflict do nothing', [user.id, list.id])
  return c.json({ ok: true })
})

app.delete('/shared/:slug/follow', async (c) => {
  const user = requireUser(c)
  const list = await sharedList(c.req.param('slug'))
  await query('delete from follows where user_id = $1 and list_id = $2', [user.id, list.id])
  return c.json({ ok: true })
})

app.notFound((c) => c.json({ error: 'No encontrado' }, 404))

export default app
