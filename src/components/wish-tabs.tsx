import { CheckIcon, GiftIcon } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

export type WishTab = 'wanted' | 'bought'

/** "Deseados (n) / Comprados (m)" switch shared by the owner and guest views. */
export function WishTabs({
  value,
  onChange,
  wanted,
  bought,
}: {
  value: WishTab
  onChange: (t: WishTab) => void
  wanted: number
  bought: number
}) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as WishTab)} className="w-full sm:w-fit">
      <TabsList className="w-full sm:w-auto">
        <TabsTrigger value="wanted" className="flex-1 gap-1.5 sm:flex-none">
          <GiftIcon /> Deseados <span className="text-muted-foreground tabular-nums">{wanted}</span>
        </TabsTrigger>
        <TabsTrigger value="bought" className="flex-1 gap-1.5 sm:flex-none">
          <CheckIcon /> Comprados <span className="text-muted-foreground tabular-nums">{bought}</span>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
