import { cn } from '@pages/employee/lib/utils'

export function LeaveSectionHeader({
  icon: Icon,
  title,
  description,
  children,
  className,
  noBorder = false,
  compact = false,
  centered = false,
}) {
  return (
    <div
      className={cn(
        centered
          ? 'flex flex-wrap items-center justify-center gap-2 text-center'
          : 'flex flex-wrap items-center justify-between gap-3',
        noBorder ? 'mb-3 border-b-0 pb-0' : 'mb-4 border-b border-border/60 pb-3',
        className,
      )}
    >
      <div className={cn('flex min-w-0 items-center', compact ? 'gap-2' : 'gap-2.5')}>
        {Icon ? (
          <div
            className={cn(
              'flex shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary',
              compact ? 'h-8 w-8' : 'h-9 w-9',
            )}
            aria-hidden
          >
            <Icon className={compact ? 'h-4 w-4' : 'h-[1.125rem] w-[1.125rem]'} />
          </div>
        ) : null}
        <div className="min-w-0">
          <h3
            className={cn(
              'font-heading font-semibold tracking-tight text-foreground',
              compact ? 'text-base' : 'text-lg',
            )}
          >
            {title}
          </h3>
          {description ? (
            <p className="mt-0.5 text-xs leading-relaxed text-muted">{description}</p>
          ) : null}
        </div>
      </div>
      {children ? (
        <div className={cn('flex flex-wrap items-center gap-2', centered ? 'justify-center' : 'w-full sm:w-auto')}>
          {children}
        </div>
      ) : null}
    </div>
  )
}
