/** Orange square MyDSP mark — readable “y”, bold DSP. */

interface Props {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  /** Decorative only when paired with visible wordmark */
  decorative?: boolean
}

const SIZES = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
} as const

export function BrandMark({ size = 'md', className = '', decorative = true }: Props) {
  return (
    <div
      className={`brand-mark ${SIZES[size]} ${className}`}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : 'MyDSP'}
      role={decorative ? undefined : 'img'}
    >
      <span className="brand-mark-my">
        M<span className="brand-mark-y">y</span>
      </span>
      <span className="brand-mark-dsp">DSP</span>
    </div>
  )
}
