import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import {
  Children,
  cloneElement,
  forwardRef,
  isValidElement,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react'
import { cn } from '@/utils/cn'
import { Spinner } from '@components/ui/Spinner'

const variants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-ui shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:pointer-events-none disabled:opacity-50 cursor-pointer active:translate-y-[1px] active:shadow-none',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-white hover:bg-[#1f5516] active:bg-[#1a4814]',
        secondary:
          'border border-[rgba(38,107,28,0.24)] bg-white text-[#266b1c] hover:bg-[#e8f2e6] active:bg-[#cfe5cb]',
        danger: 'bg-danger text-white hover:bg-red-600 active:bg-red-700',
        warning: 'bg-amber-500 text-white hover:bg-amber-600 active:bg-amber-700',
        info: 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800',
        ghost: 'text-ink shadow-none hover:bg-surface active:bg-slate-100',
      },
      size: {
        sm: 'h-7 px-2.5 text-xs',
        md: 'h-9 px-3.5 text-sm',
        lg: 'h-10 px-4 text-sm',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof variants> {
  loading?: boolean
  icon?: ReactNode
  asChild?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, icon, children, disabled, asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    if (asChild) {
      const child = Children.only(children)
      if (isValidElement(child)) {
        return (
          <Comp
            ref={ref as never}
            className={cn(variants({ variant, size }), className)}
            aria-disabled={disabled || loading}
            {...props}
          >
            {cloneElement(child as any, {
              children: (
                <>
                  {icon}
                  {child.props.children}
                </>
              ),
            })}
          </Comp>
        )
      }
    }
    return (
      <Comp
        ref={ref as never}
        className={cn(variants({ variant, size }), className)}
        disabled={asChild ? undefined : disabled || loading}
        aria-disabled={asChild ? disabled || loading : undefined}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading ? <Spinner size="sm" /> : icon}
            {children}
          </>
        )}
      </Comp>
    )
  },
)
Button.displayName = 'Button'
