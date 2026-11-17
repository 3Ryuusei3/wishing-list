import { EmojiPicker as Picker } from 'frimousse'
import { Loader2Icon, SmilePlusIcon } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

/** Full emoji picker (search in Spanish, categories, skin tones) inside a popover. */
export function EmojiPickerButton({ value, onChange, active }: { value: string; onChange: (emoji: string) => void; active?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn('h-10 gap-2 px-3', active && 'border-primary bg-primary/10 ring-2 ring-primary/30')}
          aria-label="Elegir cualquier emoji"
        >
          {active ? <span className="text-xl leading-none">{value}</span> : <SmilePlusIcon />}
          <span className="text-sm">Más emojis</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-fit p-0" align="start">
        <Picker.Root
          locale="es"
          columns={8}
          className="isolate flex h-[340px] w-fit flex-col bg-popover"
          onEmojiSelect={({ emoji }) => {
            onChange(emoji)
            setOpen(false)
          }}
        >
          <Picker.Search
            placeholder="Buscar emoji…"
            autoFocus
            className="z-10 mx-2 mt-2 h-8 appearance-none rounded-md border bg-transparent px-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
          />
          <Picker.Viewport className="relative flex-1 outline-hidden">
            <Picker.Loading className="absolute inset-0 flex items-center justify-center text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" />
            </Picker.Loading>
            <Picker.Empty className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              No hay ningún emoji con ese nombre
            </Picker.Empty>
            <Picker.List
              className="pb-1.5 select-none"
              components={{
                CategoryHeader: ({ category, ...props }) => (
                  <div className="bg-popover px-3 pt-3 pb-1.5 text-xs font-medium text-muted-foreground" {...props}>
                    {category.label}
                  </div>
                ),
                Row: ({ children, ...props }) => (
                  <div className="scroll-my-1.5 px-1.5" {...props}>
                    {children}
                  </div>
                ),
                Emoji: ({ emoji, ...props }) => (
                  <button
                    className="flex size-8 items-center justify-center rounded-md text-lg data-[active]:bg-accent"
                    aria-label={emoji.label}
                    {...props}
                  >
                    {emoji.emoji}
                  </button>
                ),
              }}
            />
          </Picker.Viewport>
          <div className="flex h-10 w-full max-w-(--frimousse-list-width) items-center justify-between gap-2 border-t px-2">
            <Picker.ActiveEmoji>
              {({ emoji }) =>
                emoji ? (
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="text-lg">{emoji.emoji}</span>
                    <span className="truncate text-xs text-muted-foreground">{emoji.label}</span>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">Elige un emoji…</span>
                )
              }
            </Picker.ActiveEmoji>
            <Picker.SkinToneSelector className="flex size-7 shrink-0 items-center justify-center rounded-md text-base hover:bg-accent" title="Tono de piel" />
          </div>
        </Picker.Root>
      </PopoverContent>
    </Popover>
  )
}
