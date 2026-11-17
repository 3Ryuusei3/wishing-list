import type { ComponentProps } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/** Icon-only button with an accessible name and a tooltip showing the same label. */
export function IconButton({
  label,
  side = 'bottom',
  variant = 'outline',
  ...props
}: ComponentProps<typeof Button> & { label: string; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" size="icon" variant={variant} aria-label={label} {...props} />
      </TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  )
}
