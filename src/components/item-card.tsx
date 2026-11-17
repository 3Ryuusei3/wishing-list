import { CheckIcon, ExternalLinkIcon, GiftIcon } from 'lucide-react'
import { useState, type CSSProperties, type ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { formatPrice, PRIORITY_LABEL, type Item } from '@/lib/api'
import { cn } from '@/lib/utils'
import { ExpandableText } from './expandable-text'
import type { ViewMode } from '@/lib/view'

const PRIORITY_STYLE = {
  1: 'border-wine/40 text-wine',
  2: 'border-gold/60 text-foreground',
  3: 'border-border text-muted-foreground',
} as const

function ItemImage({ src, small }: { src: string | null; small?: boolean }) {
  const [broken, setBroken] = useState(false)
  if (!src || broken)
    return (
      <div className="grid size-full place-items-center bg-secondary text-muted-foreground/50">
        <GiftIcon className={small ? 'size-5' : 'size-8'} strokeWidth={1.25} />
      </div>
    )
  return (
    <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} className="size-full bg-white object-contain" />
  )
}

function PriorityBadge({ item, className }: { item: Item; className?: string }) {
  if (!item.priority) return null
  return (
    <Badge variant="outline" className={cn('h-6 rounded-sm px-2 text-[0.68rem] font-medium tracking-wider uppercase', PRIORITY_STYLE[item.priority], className)}>
      {PRIORITY_LABEL[item.priority]}
    </Badge>
  )
}

function StatusChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-sm border bg-card px-2 text-xs font-medium text-foreground">
      <CheckIcon className="size-3.5 text-wine" />
      {children}
    </span>
  )
}

function OrderNumber({ n, className, style }: { n: number; className?: string; style?: CSSProperties }) {
  return (
    <span aria-label={`Número ${n}`} style={style} className={cn('shrink-0 font-heading text-wine italic tabular-nums', className)}>
      {n}
    </span>
  )
}

const TAG = 'h-6 rounded-sm px-2 text-xs font-medium tabular-nums'

/** Price, size and colour as tags; any may be missing. */
function DetailTags({ item }: { item: Item }) {
  const price = formatPrice(item.price)
  return (
    <>
      {price && (
        <Badge variant="outline" className={cn(TAG, 'text-foreground')} title="Precio aproximado">
          {price}
        </Badge>
      )}
      {item.size && (
        <Badge variant="outline" className={cn(TAG, 'text-foreground')} title="Talla">
          <span className="sr-only">Talla </span>
          {item.size}
        </Badge>
      )}
      {item.color && (
        <Badge variant="outline" className={cn(TAG, 'text-foreground')} title="Color">
          <span className="sr-only">Color </span>
          {item.color}
        </Badge>
      )}
    </>
  )
}

/**
 * Order number as a small circle sitting on the card's top-left corner.
 * Used by grid cards (all sizes) and list rows (phones), so both look identical.
 * Upright digits (not italic serif) so they are optically centred in the circle.
 * The parent card must be `relative` and not clip overflow.
 */
function CornerNumber({ n, className }: { n: number; className?: string }) {
  return (
    <span
      aria-label={`Número ${n}`}
      className={cn(
        'absolute -top-2.5 -left-2.5 z-10 inline-flex h-6 min-w-6 items-center justify-center rounded-full border bg-card px-1.5 text-[0.7rem] leading-none font-semibold text-wine tabular-nums shadow-sm',
        className,
      )}
    >
      {n}
    </span>
  )
}

function StoreLink({ url }: { url: string | null }) {
  if (!url) return null
  let host: string
  try {
    host = new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex min-w-0 items-center gap-1 text-sm text-wine underline-offset-4 hover:underline">
      <ExternalLinkIcon className="size-3.5 shrink-0" />
      <span className="truncate">{host}</span>
    </a>
  )
}

export function ItemCard({
  item,
  number,
  numberDigits = 1,
  handle,
  layout = 'grid',
  dimmed,
  status,
  actions,
}: {
  item: Item
  /** Position in the owner's order (1-based). */
  number?: number
  /** Digits of the largest number in the list, so every row reserves the same width (9 and 10 line up). */
  numberDigits?: number
  /** Drag handle when the list can be reordered. */
  handle?: ReactNode
  layout?: ViewMode
  dimmed?: boolean
  /** e.g. "Ya comprado": shown over the photo (grid) or next to the name (list). */
  status?: ReactNode
  actions?: ReactNode
}) {
  if (layout === 'list') {
    const hasTags = item.price != null || !!item.size || !!item.color || !!item.priority || !!status
    const hasFooter = !!item.url || !!actions
    /*
     * Always: [photo] [title + tags]  then the description below that block.
     * Phone:  order number = small circle on the photo corner; description full width;
     *         last row = store link ........ actions (hairline above).
     * sm+:    [handle][number][photo] [title / tags / description / link] [actions]
     */
    return (
      <Card
        className={cn(
          'relative grid h-full grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-2 overflow-visible rounded-md p-3 shadow-none transition hover:border-foreground/25',
          'sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-y-1.5',
          dimmed && 'opacity-60',
        )}
      >
        {/* Phones: corner circle; sm+ shows the number in the left column instead. */}
        {number != null && <CornerNumber n={number} className="sm:hidden" />}
        <div className="col-start-1 row-start-1 flex items-start gap-2 sm:row-span-3 sm:gap-3">
          {(handle || number != null) && (
            <div className={cn('h-8 items-center', handle ? 'flex' : 'hidden sm:flex')}>
              {handle}
              {number != null && (
                <OrderNumber
                  n={number}
                  className="hidden pr-0.5 text-right text-xl sm:block"
                  style={{ width: `${Math.max(numberDigits, 1) + 0.4}ch` }}
                />
              )}
            </div>
          )}
          <div className="size-16 shrink-0 overflow-hidden rounded-sm border sm:size-20">
            <ItemImage src={item.imageUrl} small />
          </div>
        </div>
        <div className="col-start-2 row-start-1 min-w-0 space-y-1.5">
          <h3 className="line-clamp-2 font-heading text-lg leading-snug break-words">{item.name}</h3>
          {hasTags && (
            <div className="flex flex-wrap items-center gap-1.5">
              <DetailTags item={item} />
              <PriorityBadge item={item} />
              {status && <StatusChip>{status}</StatusChip>}
            </div>
          )}
        </div>
        {item.description && (
          <div className="col-span-2 col-start-1 row-start-2 min-w-0 sm:col-span-1 sm:col-start-2">
            <ExpandableText text={item.description} lines={1} />
          </div>
        )}
        {hasFooter && (
          <div className="col-span-2 col-start-1 row-start-3 flex min-w-0 items-center justify-between gap-3 border-t pt-2 sm:contents">
            <div className="flex min-w-0 sm:col-start-2 sm:row-start-3 sm:pt-0.5">
              <StoreLink url={item.url} />
            </div>
            {actions && (
              <div className="flex shrink-0 items-center gap-1 sm:col-start-3 sm:row-span-3 sm:row-start-1 sm:items-start">{actions}</div>
            )}
          </div>
        )}
      </Card>
    )
  }

  return (
    <Card className={cn('group relative h-full gap-0 overflow-visible rounded-md p-0 shadow-none transition hover:border-foreground/25', dimmed && 'opacity-60')}>
      {number != null && <CornerNumber n={number} />}
      <div className="relative aspect-[4/3] overflow-hidden rounded-t-md border-b">
        <ItemImage src={item.imageUrl} />
        <PriorityBadge item={item} className="absolute top-2 right-2 bg-background/90 backdrop-blur" />
        {status && (
          <div className="absolute inset-0 grid place-items-center bg-background/60">
            <StatusChip>{status}</StatusChip>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 font-heading text-lg leading-snug">{item.name}</h3>
        {(item.price != null || item.size || item.color) && (
          <div className="flex flex-wrap gap-1.5">
            <DetailTags item={item} />
          </div>
        )}
        {item.description && <ExpandableText text={item.description} lines={2} />}
        <div className="mt-auto flex items-center gap-2 pt-1">
          {handle && <div className="-ml-1">{handle}</div>}
          <StoreLink url={item.url} />
          <div className="ml-auto flex shrink-0 items-center gap-1">{actions}</div>
        </div>
      </div>
    </Card>
  )
}
