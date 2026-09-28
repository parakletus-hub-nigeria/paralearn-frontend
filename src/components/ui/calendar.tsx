'use client'

import * as React from 'react'
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button, buttonVariants } from '@/components/ui/button'

interface CalendarProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange' | 'onSelect'> {
  mode?: 'single' | 'range'
  selected?: Date | Date[]
  onSelect?: (date: Date | Date[] | undefined) => void
  showOutsideDays?: boolean
  captionLayout?: 'label' | 'dropdown'
  buttonVariant?: React.ComponentProps<typeof Button>['variant']
  classNames?: Record<string, string>
  disabled?: (date: Date) => boolean
  minDate?: Date
  maxDate?: Date
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = 'label',
  buttonVariant = 'ghost',
  selected,
  onSelect,
  disabled,
  minDate,
  maxDate,
  ...props
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(new Date())

  const handleDateClick = (date: Date) => {
    if (disabled?.(date)) return
    if (minDate && date < minDate) return
    if (maxDate && date > maxDate) return

    onSelect?.(date)
  }

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
  }

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
  }

  const monthName = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })
  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate()
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay()
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div
      data-slot="calendar"
      className={cn(
        'bg-background group/calendar p-3 rounded-md border',
        className,
      )}
      {...props}
    >
      <div className="flex items-center justify-between mb-4">
        <Button
          variant={buttonVariant}
          size="icon"
          onClick={previousMonth}
          className="h-8 w-8"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </Button>
        
        <div className="font-medium">{monthName}</div>
        
        <Button
          variant={buttonVariant}
          size="icon"
          onClick={nextMonth}
          className="h-8 w-8"
        >
          <ChevronRightIcon className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {days.map((day) => (
          <div
            key={day}
            className={cn(
              'text-muted-foreground text-center text-xs font-normal p-2',
              classNames?.weekday,
            )}
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstDayOfMonth }).map((_, i) => (
          <div key={`empty-${i}`} className="p-2" />
        ))}
        
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i + 1)
          const isSelected = selected && (
            Array.isArray(selected)
              ? selected.some(d => d.toDateString() === date.toDateString())
              : selected.toDateString() === date.toDateString()
          )
          const isToday = date.toDateString() === new Date().toDateString()
          const isDisabled = disabled?.(date) || (minDate && date < minDate) || (maxDate && date > maxDate)

          return (
            <Button
              key={i}
              variant="ghost"
              size="icon"
              className={cn(
                'h-9 w-9 p-0 font-normal',
                isSelected && 'bg-primary text-primary-foreground',
                isToday && !isSelected && 'bg-accent text-accent-foreground',
                isDisabled && 'opacity-50 cursor-not-allowed',
                classNames?.day,
              )}
              onClick={() => handleDateClick(date)}
              disabled={isDisabled}
            >
              {i + 1}
            </Button>
          )
        })}
      </div>
    </div>
  )
}

function CalendarDayButton({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn('h-9 w-9 p-0 font-normal', className)}
      {...props}
    />
  )
}

export { Calendar, CalendarDayButton }
