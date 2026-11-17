import { useState } from 'react'
import type { Item } from './api'

export type SortMode = 'custom' | 'priority' | 'price-asc' | 'price-desc'
const KEY = 'wl-sort'
const MODES: SortMode[] = ['custom', 'priority', 'price-asc', 'price-desc']

export const SORT_LABEL: Record<SortMode, string> = {
  custom: 'Orden de la lista',
  priority: 'Prioridad',
  'price-asc': 'Precio: menor a mayor',
  'price-desc': 'Precio: mayor a menor',
}

/** Items without a value go last in every non-default sort. */
export function sortItems<T extends Item>(items: T[], mode: SortMode): T[] {
  if (mode === 'custom') return items
  const value = (i: T) => (mode === 'priority' ? i.priority : i.price)
  const dir = mode === 'price-desc' ? -1 : 1
  return [...items].sort((a, b) => {
    const va = value(a)
    const vb = value(b)
    if (va == null && vb == null) return a.position - b.position
    if (va == null) return 1
    if (vb == null) return -1
    return (va - vb) * dir || a.position - b.position
  })
}

/** 1-based number of each item in the owner's order (items arrive sorted by position). */
export function orderNumbers(items: Item[]) {
  return new Map(items.map((item, i) => [item.id, i + 1]))
}

export function useSortMode() {
  const [mode, setMode] = useState<SortMode>(() => {
    try {
      const v = localStorage.getItem(KEY) as SortMode
      return MODES.includes(v) ? v : 'custom'
    } catch {
      return 'custom'
    }
  })
  const set = (m: SortMode) => {
    setMode(m)
    try {
      localStorage.setItem(KEY, m)
    } catch {
      /* storage unavailable */
    }
  }
  return [mode, set] as const
}
