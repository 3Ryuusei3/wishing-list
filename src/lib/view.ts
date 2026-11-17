import { useState } from 'react'

export type ViewMode = 'grid' | 'list'
const KEY = 'wl-view'

function read(): ViewMode {
  try {
    return localStorage.getItem(KEY) === 'list' ? 'list' : 'grid'
  } catch {
    return 'grid'
  }
}

/** Grid/list preference, remembered per browser. */
export function useViewMode() {
  const [mode, setMode] = useState<ViewMode>(read)
  const set = (m: ViewMode) => {
    setMode(m)
    try {
      localStorage.setItem(KEY, m)
    } catch {
      /* storage unavailable */
    }
  }
  return [mode, set] as const
}
