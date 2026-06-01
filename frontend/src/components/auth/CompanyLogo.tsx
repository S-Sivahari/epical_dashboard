import { cn } from '@/utils/cn'

type CompanyLogoProps = {
  className?: string
  alt?: string
}

const CHIP_LOGO_SRC = '/pic/epical-chip-logo.png?v=3'

export function CompanyLogo({ className, alt = 'Epical Layouts' }: CompanyLogoProps) {
  return (
    <img
      src={CHIP_LOGO_SRC}
      alt={alt}
      width={56}
      height={56}
      className={cn('object-contain select-none', className)}
      draggable={false}
      decoding="async"
    />
  )
}
