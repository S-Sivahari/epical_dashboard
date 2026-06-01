import { cn } from '@/utils/cn'

function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function Avatar({
  src,
  name,
  size = 'md',
  color,
  className,
}: {
  src?: string
  name: string
  size?: 'sm' | 'md' | 'lg'
  color?: string
  className?: string
}) {
  const sizes = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-12 w-12 text-base' }
  const bg = color ?? '#266b1c'
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center overflow-hidden rounded-full font-semibold text-white ring-2 ring-white',
        sizes[size],
        className,
      )}
      style={{ backgroundColor: bg }}
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        initials(name)
      )}
    </span>
  )
}
