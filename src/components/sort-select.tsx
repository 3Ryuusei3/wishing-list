import { ArrowUpDownIcon } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SORT_LABEL, type SortMode } from '@/lib/sort'
import { cn } from '@/lib/utils'

export function SortSelect({
  value,
  onChange,
  className,
  customLabel = SORT_LABEL.custom,
}: {
  value: SortMode
  onChange: (v: SortMode) => void
  className?: string
  /** Label for the default (owner-defined) order, e.g. "Orden del creador" for guests. */
  customLabel?: string
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as SortMode)}>
      <SelectTrigger size="sm" className={cn('w-auto gap-1.5 [&_.default-hint]:hidden', className)} aria-label="Ordenar regalos">
        <ArrowUpDownIcon className="size-3.5 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {(Object.keys(SORT_LABEL) as SortMode[]).map((m) => (
          <SelectItem key={m} value={m}>
            {m === 'custom' ? customLabel : SORT_LABEL[m]}
            {m === 'custom' && <span className="default-hint text-xs text-muted-foreground"> (por defecto)</span>}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
