'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface PopoverContextValue {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const PopoverContext = React.createContext<PopoverContextValue | null>(null)

interface PopoverProps {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}

function Popover({ open: controlledOpen, defaultOpen, onOpenChange, children }: PopoverProps) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen ?? false)
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen

  const handleOpenChange = React.useCallback((newOpen: boolean) => {
    if (controlledOpen === undefined) {
      setInternalOpen(newOpen)
    }
    onOpenChange?.(newOpen)
  }, [controlledOpen, onOpenChange])

  return (
    <PopoverContext.Provider value={{ open, onOpenChange: handleOpenChange }}>
      <div data-slot="popover">{children}</div>
    </PopoverContext.Provider>
  )
}

interface PopoverTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

const PopoverTrigger = React.forwardRef<HTMLButtonElement, PopoverTriggerProps>(
  ({ onClick, ...props }, ref) => {
    const context = React.useContext(PopoverContext)

    return (
      <button
        ref={ref}
        type="button"
        data-slot="popover-trigger"
        onClick={(e) => {
          context?.onOpenChange(!context.open)
          onClick?.(e)
        }}
        {...props}
      />
    )
  }
)
PopoverTrigger.displayName = 'PopoverTrigger'

interface PopoverContentProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
}

const PopoverContent = React.forwardRef<HTMLDivElement, PopoverContentProps>(
  ({ className, align = 'center', sideOffset = 4, children, ...props }, ref) => {
    const context = React.useContext(PopoverContext)

    if (!context?.open) return null

    return (
      <div
        ref={ref}
        data-slot="popover-content"
        className={cn(
          'bg-popover text-popover-foreground z-[99999] w-72 rounded-md border p-4 shadow-md outline-hidden fixed',
          className,
        )}
        style={{ marginTop: `${sideOffset}px` }}
        {...props}
      >
        {children}
      </div>
    )
  }
)
PopoverContent.displayName = 'PopoverContent'

const PopoverAnchor = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ ...props }, ref) => {
    return <div ref={ref} data-slot="popover-anchor" {...props} />
  }
)
PopoverAnchor.displayName = 'PopoverAnchor'

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor }
