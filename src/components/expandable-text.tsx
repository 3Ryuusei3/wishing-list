import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

const CLAMP = { 1: 'line-clamp-1', 2: 'line-clamp-2' } as const

/** Text clamped to N lines with a "Leer más / Leer menos" toggle shown only when it actually overflows. */
export function ExpandableText({ text, lines, className }: { text: string; lines: 1 | 2; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [overflows, setOverflows] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // ResizeObserver fires once on observe and again whenever the width changes.
    const ro = new ResizeObserver(() => {
      if (!expanded) setOverflows(el.scrollHeight > el.clientHeight + 1)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [expanded, text])

  return (
    <div className={className}>
      <p ref={ref} className={cn('text-sm break-words whitespace-pre-line text-muted-foreground', !expanded && CLAMP[lines])}>
        {text}
      </p>
      {(overflows || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-0.5 text-xs text-wine underline-offset-4 hover:underline"
        >
          {expanded ? 'Leer menos' : 'Leer más'}
        </button>
      )}
    </div>
  )
}
