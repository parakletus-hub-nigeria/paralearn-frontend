'use client'

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cn } from '@/lib/utils'

interface PopoverContextValue {
  open: boolean
  onOpenChange: (open: boolean) => void
  contentRef: React.RefObject<HTMLDivElement | null>
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
  const popoverRef = React.useRef<HTMLDivElement>(null)
  const contentRef = React.useRef<HTMLDivElement>(null)

  const handleOpenChange = React.useCallback(
    (newOpen: boolean) => {
      if (controlledOpen === undefined) {
        setInternalOpen(newOpen)
      }
      onOpenChange?.(newOpen)
    },
    [controlledOpen, onOpenChange]
  )

  React.useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node
      if (
        (popoverRef.current && popoverRef.current.contains(target)) ||
        (contentRef.current && contentRef.current.contains(target))
      ) {
        return
      }
      handleOpenChange(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleOpenChange(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, handleOpenChange])

  return (
    <PopoverContext.Provider value={{ open, onOpenChange: handleOpenChange, contentRef }}>
      <div ref={popoverRef} data-slot="popover">
        {children}
      </div>
    </PopoverContext.Provider>
  )
}

interface PopoverTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
}

const PopoverTrigger = React.forwardRef<HTMLButtonElement, PopoverTriggerProps>(
  ({ onClick, asChild = false, ...props }, ref) => {
    const context = React.useContext(PopoverContext)
    const Comp = asChild ? Slot : 'button'

    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : 'button'}
        data-slot="popover-trigger"
        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
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

    const handleRef = React.useCallback(
      (node: HTMLDivElement | null) => {
        if (context?.contentRef) {
          (context.contentRef as React.MutableRefObject<HTMLDivElement | null>).current = node
        }
        if (typeof ref === 'function') {
          ref(node)
        } else if (ref) {
          (ref as React.MutableRefObject<HTMLDivElement | null>).current = node
        }
      },
      [context, ref]
    )

    if (!context?.open) return null

    return (
      <div
        ref={handleRef}
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
