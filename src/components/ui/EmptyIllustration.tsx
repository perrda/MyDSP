/** Small geometric empty-state mark using the brand accent. */

interface EmptyIllustrationProps {
  className?: string
  /** Accessible label when the illustration is meaningful alone. Default: decorative. */
  title?: string
}

export function EmptyIllustration({ className = '', title }: EmptyIllustrationProps) {
  return (
    <svg
      className={`empty-illustration ${className}`.trim()}
      width="72"
      height="72"
      viewBox="0 0 72 72"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <rect
        x="10"
        y="10"
        width="52"
        height="52"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeOpacity="0.35"
      />
      <path
        d="M22 48 L36 24 L50 48 Z"
        stroke="var(--accent)"
        strokeWidth="2.5"
        strokeLinejoin="round"
        fill="color-mix(in srgb, var(--accent) 18%, transparent)"
      />
      <circle cx="36" cy="40" r="3.5" fill="var(--accent)" />
      <line
        x1="18"
        y1="54"
        x2="54"
        y2="54"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeOpacity="0.55"
        strokeLinecap="square"
      />
    </svg>
  )
}
