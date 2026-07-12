/** Privacy toggle — square icon control matching ThemeToggle. */

interface PrivacyToggleProps {
  privacy: boolean
  onToggle: () => void
  className?: string
}

export function PrivacyToggle({ privacy, onToggle, className = '' }: PrivacyToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={privacy ? 'Show values' : 'Hide values'}
      aria-pressed={privacy}
      title={privacy ? 'Show values (privacy on)' : 'Hide values'}
      className={`toolbar-icon ${className}`}
    >
      <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" aria-hidden="true" fill="none">
        {privacy ? (
          /* Eyes closed — privacy on */
          <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" strokeLinejoin="miter">
            <path d="M3 12c1.8-3.2 4.6-5 9-5s7.2 1.8 9 5" />
            <path d="M3 12c1.8 3.2 4.6 5 9 5s7.2-1.8 9-5" opacity="0.35" />
            <path d="M8 14.5c1.1.9 2.4 1.3 4 1.3s2.9-.4 4-1.3" />
          </g>
        ) : (
          /* Eyes open */
          <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" strokeLinejoin="miter">
            <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
            <circle cx="12" cy="12" r="2.75" />
            <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
          </g>
        )}
      </svg>
    </button>
  )
}
