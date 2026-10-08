import { Link } from 'react-router-dom'

type BrandLogoProps = {
  to?: string | null
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

/** Responsive wordmark sizes: scales down on narrow viewports */
const SIZE: Record<NonNullable<BrandLogoProps['size']>, string> = {
  sm: 'text-base sm:text-lg',
  md: 'text-lg sm:text-xl',
  lg: 'text-xl sm:text-2xl',
}

/** Wordmark СамоСтрой: «Само» — primary blue, «Строй» — accent amber. */
export function BrandLogo({ to = '/', className = '', size = 'md' }: BrandLogoProps) {
  const mark = (
    <span
      className={`font-bold tracking-tight leading-none ${SIZE[size]} ${className}`}
      aria-label="СамоСтрой"
    >
      <span className="text-primary-600">Само</span>
      <span className="text-accent-500">Строй</span>
    </span>
  )

  if (!to) return mark
  return (
    <Link to={to} className="inline-flex items-center shrink-0 hover:opacity-90 transition-opacity">
      {mark}
    </Link>
  )
}
