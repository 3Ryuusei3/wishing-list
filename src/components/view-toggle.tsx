import { LayoutGridIcon, ListIcon } from 'lucide-react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { ViewMode } from '@/lib/view'

export function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      value={value}
      onValueChange={(v) => v && onChange(v as ViewMode)}
      aria-label="Vista de los regalos"
    >
      <ToggleGroupItem value="grid" aria-label="Vista en cuadrícula" title="Cuadrícula">
        <LayoutGridIcon />
      </ToggleGroupItem>
      <ToggleGroupItem value="list" aria-label="Vista en lista" title="Lista">
        <ListIcon />
      </ToggleGroupItem>
    </ToggleGroup>
  )
}

/** Container that lays items out as a responsive grid or a single column. */
export function ItemsLayout({ mode, children }: { mode: ViewMode; children: React.ReactNode }) {
  return <div className={mode === 'grid' ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3' : 'flex flex-col gap-3'}>{children}</div>
}
