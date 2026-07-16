/** In-app What’s new archive — last N versions from RELEASE_NOTES. */

import { Link } from 'react-router-dom'
import {
  releaseBulletHref,
  releaseBulletText,
  releaseNotesArchive,
  type ReleaseNotesEntry,
} from '../domain/releaseNotes'

type Props = {
  /** How many versions to list (default 5). */
  limit?: number
  className?: string
}

function VersionBlock({ entry }: { entry: ReleaseNotesEntry }) {
  return (
    <article className="whats-new-version border border-border p-4 space-y-2">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-bold tracking-tight text-text">v{entry.version}</h3>
        <time className="text-xs text-text-subtle tabular-nums" dateTime={entry.date}>
          {entry.date}
        </time>
      </header>
      <ul className="text-sm text-text-muted font-light list-disc pl-4 space-y-1">
        {entry.bullets.map((line) => {
          const text = releaseBulletText(line)
          const href = releaseBulletHref(line)
          return (
            <li key={text}>
              {href ? (
                <Link to={href} className="text-accent font-medium hover:underline">
                  {text}
                </Link>
              ) : (
                text
              )}
            </li>
          )
        })}
      </ul>
    </article>
  )
}

export function WhatsNewArchive({ limit = 5, className = '' }: Props) {
  const entries = releaseNotesArchive(limit)

  return (
    <div
      id="whats-new"
      className={`whats-new-archive space-y-3 ${className}`.trim()}
      aria-label="What’s new archive"
    >
      {entries.length === 0 ? (
        <p className="text-sm text-text-muted font-light">No release notes yet.</p>
      ) : (
        entries.map((entry) => <VersionBlock key={entry.version} entry={entry} />)
      )}
    </div>
  )
}
