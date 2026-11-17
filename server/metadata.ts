import { lookup } from 'node:dns/promises'
import net from 'node:net'

export type LinkMetadata = {
  title?: string
  description?: string
  image?: string
  price?: number
  siteName?: string
}

const MAX_BYTES = 1_500_000
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'

function isPrivateIp(ip: string) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number)
    return (
      a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) || a >= 224
    )
  }
  const v = ip.toLowerCase()
  if (v.startsWith('::ffff:')) return isPrivateIp(v.slice(7))
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80')
}

/** Rejects non-http(s) URLs and hosts that resolve to private/internal addresses (SSRF guard). */
async function assertPublicUrl(raw: string) {
  const url = new URL(raw)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('URL no válida')
  const host = url.hostname.replace(/^\[|\]$/g, '')
  const addrs = net.isIP(host) ? [{ address: host }] : await lookup(host, { all: true })
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new Error('URL no permitida')
  return url
}

/** The site answered with an anti-bot / captcha page instead of the product. */
export class BlockedError extends Error {
  constructor(host: string) {
    super(`${host.replace(/^www\./, '')} no permite leer sus páginas automáticamente`)
    this.name = 'BlockedError'
  }
}

const BLOCK_MARKERS = [
  /api-services-support@amazon\.com/i, // Amazon automated-access page
  /\/errors\/validateCaptcha/i, // Amazon captcha
  /<title>\s*(Just a moment\.\.\.|Attention Required!|Access Denied|Robot Check)\s*</i, // Cloudflare, Akamai, etc.
  /captcha-delivery\.com|geo\.captcha-delivery/i, // DataDome
  /_Incapsula_Resource/i, // Imperva
  /[?&]bm-verify=|\/interstitial\/ic\.html/i, // Akamai Bot Manager (Zara, Inditex…)
  /px-captcha|_pxCaptcha|captcha\.px-cdn\.net/i, // PerimeterX / HUMAN
  /<title>\s*(&nbsp;)?\s*<\/title>[\s\S]*http-equiv=["']?refresh/i, // empty title + auto-refresh challenge
]

function isBlockedPage(html: string) {
  // Real product pages are large; challenge pages are small and carry these markers.
  return html.length < 60_000 && BLOCK_MARKERS.some((re) => re.test(html))
}

async function fetchHtml(raw: string) {
  let url = await assertPublicUrl(raw)
  for (let hop = 0; hop < 4; hop++) {
    const res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(8000),
      headers: {
        'user-agent': UA,
        accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'accept-language': 'es-ES,es;q=0.9,en;q=0.8',
      },
    })
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      url = await assertPublicUrl(new URL(res.headers.get('location')!, url).toString())
      continue
    }
    if (!res.ok) throw new Error(`La página respondió ${res.status}`)
    if (!(res.headers.get('content-type') ?? '').includes('html')) throw new Error('No es una página HTML')
    // Read at most MAX_BYTES; metadata lives in <head>.
    const reader = res.body!.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    while (size < MAX_BYTES) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      size += value.length
    }
    reader.cancel().catch(() => {})
    const html = new TextDecoder().decode(Buffer.concat(chunks))
    if (isBlockedPage(html)) throw new BlockedError(url.hostname)
    return { html, finalUrl: url }
  }
  throw new Error('Demasiadas redirecciones')
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
function decode(s: string) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim()
}

function parsePrice(v: unknown): number | undefined {
  if (v == null) return undefined
  let s = String(v).replace(/[^\d.,]/g, '')
  if (!s) return undefined
  // "1.234,56" -> 1234.56 ; "1,234.56" -> 1234.56 ; "12,99" -> 12.99
  if (s.includes(',') && s.includes('.')) {
    s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  } else if (s.includes(',')) s = s.replace(',', '.')
  const n = Number(s)
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : undefined
}

function findProduct(node: any): any {
  if (!node || typeof node !== 'object') return undefined
  if (Array.isArray(node)) {
    for (const n of node) {
      const p = findProduct(n)
      if (p) return p
    }
    return undefined
  }
  const type = node['@type']
  if (type === 'Product' || (Array.isArray(type) && type.includes('Product'))) return node
  return findProduct(node['@graph'])
}

export function extractMetadata(html: string, baseUrl: URL): LinkMetadata {
  const head = html.slice(0, 600_000)
  const meta = new Map<string, string>()
  for (const tag of head.match(/<meta\b[^>]*>/gi) ?? []) {
    const attrs: Record<string, string> = {}
    for (const m of tag.matchAll(/([a-z:_-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
      attrs[m[1].toLowerCase()] = m[3] ?? m[4] ?? m[5] ?? ''
    }
    const key = (attrs.property || attrs.name || attrs.itemprop || '').toLowerCase()
    if (key && attrs.content && !meta.has(key)) meta.set(key, decode(attrs.content))
  }

  let product: any
  for (const m of head.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      product = findProduct(JSON.parse(m[1]))
      if (product) break
    } catch {
      /* ignore malformed JSON-LD */
    }
  }

  const titleTag = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
  const ldImage = product?.image
  const ldImageUrl =
    typeof ldImage === 'string' ? ldImage : Array.isArray(ldImage) ? (typeof ldImage[0] === 'string' ? ldImage[0] : ldImage[0]?.url) : ldImage?.url
  const offers = Array.isArray(product?.offers) ? product.offers[0] : product?.offers

  const title = meta.get('og:title') || meta.get('twitter:title') || (product?.name && decode(String(product.name))) || (titleTag && decode(titleTag))
  const description =
    meta.get('og:description') || meta.get('twitter:description') || meta.get('description') ||
    (product?.description && decode(String(product.description)))
  const imageRaw = meta.get('og:image') || meta.get('og:image:url') || meta.get('twitter:image') || meta.get('twitter:image:src') || ldImageUrl
  let image: string | undefined
  if (imageRaw) {
    try {
      const u = new URL(imageRaw, baseUrl)
      if (u.protocol === 'https:' || u.protocol === 'http:') image = u.toString()
    } catch {
      /* ignore */
    }
  }
  const price = parsePrice(
    meta.get('product:price:amount') || meta.get('og:price:amount') || offers?.price || offers?.lowPrice || meta.get('price'),
  )

  return {
    title: title?.slice(0, 200),
    description: description?.slice(0, 2000),
    image,
    price,
    siteName: meta.get('og:site_name'),
  }
}

const NOISE_SEGMENTS = new Set(['dp', 'gp', 'product', 'products', 'p', 'item', 'items', 'producto', 'productos', 'articulo', 'es', 'en', 'shop', 'tienda'])

/**
 * Best-effort product name from the URL slug, e.g.
 * /es/es/polo-punto-regular-fit-mezcla-lana-p02893371.html -> "Polo punto regular fit mezcla lana".
 */
export function nameFromUrl(raw: string): string | undefined {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return undefined
  }
  const candidates = url.pathname
    .split('/')
    .map((seg) => {
      try {
        return decodeURIComponent(seg)
      } catch {
        return seg
      }
    })
    .map((seg) => seg.replace(/\.(html?|php|aspx?)$/i, ''))
    .filter((seg) => !NOISE_SEGMENTS.has(seg.toLowerCase()) && /[-_+]/.test(seg))
    .map((seg) =>
      seg
        .split(/[-_+]+/)
        // drop product codes / ids ("p02893371", "A12345678", "00263850", ASIN "B0FQFJRZNZ"); keep "17", "256", "3s"
        .filter((w) => w && !/^[a-z]{0,2}\d{5,}$/i.test(w) && !(/^[A-Z0-9]{10}$/.test(w) && /\d/.test(w) && /[A-Z]/.test(w)))
        .join(' '),
    )
    .filter((name) => name.split(' ').length >= 2 && /[a-záéíóúñü]/i.test(name))
  const best = candidates.sort((a, b) => b.length - a.length)[0]
  if (!best) return undefined
  // Keep the shop's casing ("Apple iPhone 17"); sentence-case all-lowercase slugs.
  const name = best === best.toLowerCase() ? best.charAt(0).toUpperCase() + best.slice(1) : best
  return name.slice(0, 200)
}

export async function fetchMetadata(url: string): Promise<LinkMetadata> {
  const { html, finalUrl } = await fetchHtml(url)
  const meta = extractMetadata(html, finalUrl)
  if (!meta.title?.trim()) meta.title = nameFromUrl(finalUrl.toString())
  return meta
}
