import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVerticalIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { ItemsLayout } from '@/components/view-toggle'
import type { Item } from '@/lib/api'
import { useCoarsePointer } from '@/lib/use-coarse-pointer'
import { cn } from '@/lib/utils'
import type { ViewMode } from '@/lib/view'

/**
 * Desktop: drag from the ⋮⋮ handle. Touch devices: no handle; press and hold the
 * whole row (~¼ s) to lift it, so normal scrolling and taps keep working.
 */
function SortableRow({ id, wholeRow, children }: { id: string; wholeRow: boolean; children: (handle?: ReactNode) => ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id })
  if (wholeRow)
    return (
      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        aria-label="Mantén pulsado para mover"
        style={{ transform: CSS.Translate.toString(transform), transition, WebkitTouchCallout: 'none' }}
        className={cn('relative h-full rounded-md select-none', isDragging && 'z-10 scale-[1.02] opacity-90 shadow-xl')}
      >
        {children()}
      </div>
    )
  const handle = (
    <button
      ref={setActivatorNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      aria-label="Arrastrar para reordenar"
      title="Arrastra para reordenar"
      className="grid h-8 w-6 shrink-0 cursor-grab touch-none place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:cursor-grabbing"
    >
      <GripVerticalIcon className="size-4" />
    </button>
  )
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn('relative h-full', isDragging && 'z-10 opacity-80 drop-shadow-xl')}
    >
      {children(handle)}
    </div>
  )
}

/** Drag-and-drop reordering for the owner's items (mouse, touch and keyboard). */
export function SortableItems<T extends Item>({
  items,
  mode,
  onReorder,
  renderItem,
}: {
  items: T[]
  mode: ViewMode
  onReorder: (items: T[]) => void
  renderItem: (item: T, handle: ReactNode) => ReactNode
}) {
  const coarse = useCoarsePointer()
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = items.findIndex((i) => i.id === active.id)
    const to = items.findIndex((i) => i.id === over.id)
    if (from >= 0 && to >= 0) onReorder(arrayMove(items, from, to))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={() => navigator.vibrate?.(12)}
      onDragEnd={onDragEnd}
      accessibility={{
        screenReaderInstructions: {
          draggable: 'Pulsa espacio para coger el regalo, usa las flechas para moverlo y espacio de nuevo para soltarlo. En pantallas táctiles, mantén pulsado el regalo y arrástralo.',
        },
      }}
    >
      <SortableContext items={items.map((i) => i.id)} strategy={mode === 'grid' ? rectSortingStrategy : verticalListSortingStrategy}>
        <ItemsLayout mode={mode}>
          {items.map((item) => (
            <SortableRow key={item.id} id={item.id} wholeRow={coarse}>
              {(handle) => renderItem(item, handle)}
            </SortableRow>
          ))}
        </ItemsLayout>
      </SortableContext>
    </DndContext>
  )
}
