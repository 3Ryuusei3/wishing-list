import { getToken } from './auth'

export type List = {
  id: string
  title: string
  description: string | null
  emoji: string
  eventDate: string | null
  shareSlug: string
  createdAt: string
  updatedAt: string
  itemCount?: number
  purchasedCount?: number
  followers?: number
  ownerName?: string
  ownerImage?: string | null
}

export type Priority = 1 | 2 | 3

export type Item = {
  id: string
  name: string
  description: string | null
  url: string | null
  price: number | null
  imageUrl: string | null
  priority: Priority | null
  size: string | null
  color: string | null
  position: number
  createdAt: string
  /** The owner marked it as already bought/received. */
  ownerPurchased: boolean
}

export type SharedItem = Item & { purchased: boolean; buyerName: string | null; mine: boolean }

export type ItemInput = Pick<Item, 'name' | 'description' | 'url' | 'price' | 'imageUrl' | 'priority' | 'size' | 'color'>
export type ListInput = Pick<List, 'title' | 'description' | 'emoji' | 'eventDate'>

export type LinkMetadata = { title?: string; description?: string; image?: string; price?: number; siteName?: string }

export class ApiError extends Error {
  status: number
  code?: string
  data: Record<string, unknown>
  constructor(status: number, message: string, data: Record<string, unknown> = {}) {
    super(message)
    this.status = status
    this.code = typeof data.code === 'string' ? data.code : undefined
    this.data = data
  }
}

const CLAIM_KEY = 'wl-claim-token'

/** Per-browser random token so anonymous visitors can undo their own "comprado". */
export function claimToken() {
  try {
    let t = localStorage.getItem(CLAIM_KEY)
    if (!t) {
      t = crypto.randomUUID() + crypto.randomUUID()
      localStorage.setItem(CLAIM_KEY, t)
    }
    return t
  } catch {
    return (window as any).__wlClaim ??= crypto.randomUUID() + crypto.randomUUID()
  }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { 'x-claim-token': claimToken() }
  const token = await getToken()
  if (token) headers.authorization = `Bearer ${token}`
  if (init.body !== undefined) headers['content-type'] = 'application/json'
  const res = await fetch(`/api${path}`, {
    method: init.method ?? 'GET',
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, data.error ?? `Error ${res.status}`, data)
  return data as T
}

export const shareUrl = (slug: string) => `${window.location.origin}/l/${slug}`

export const PRIORITY_LABEL: Record<Priority, string> = { 1: 'Alta', 2: 'Media', 3: 'Baja' }

export function formatPrice(p: number | null) {
  return p == null ? null : new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(p)
}

export function formatDate(d: string | null) {
  if (!d) return null
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(`${d}T00:00:00`),
  )
}

/** Resize an image file in the browser to a JPEG data URL (max 1000px). */
export async function resizeImage(file: File, max = 1000): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.82)
}
