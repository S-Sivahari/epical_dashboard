import { cn } from '@/utils/cn'

interface NotificationBadgeProps {
  count: number
  className?: string
  size?: 'sm' | 'md'
}

export function NotificationBadge({ count, className, size = 'md' }: NotificationBadgeProps) {
  if (count === 0) return null

  const sizeClasses =
    size === 'sm' ? 'h-4 min-w-[16px] text-[9px] px-1' : 'h-5 min-w-[20px] text-[10px] px-1.5'

  return (
    <span
      className={cn(
        'absolute -right-1 -top-1 flex items-center justify-center rounded-full bg-red-500 font-bold text-white shadow-sm ring-2 ring-white animate-in fade-in zoom-in duration-200',
        sizeClasses,
        className,
      )}
      aria-label={`${count} unread notification${count !== 1 ? 's' : ''}`}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}
