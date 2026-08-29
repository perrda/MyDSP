import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { newsUnreadFromCache } from '../storage/newsStore'
import { youtubeUnreadFromCache } from '../storage/youtubeStore'

/** Header chips for News / YouTube. Unread lives here only — not on nav or the bell. */
export function MediaChromeChips() {
  const [newsUnread, setNewsUnread] = useState(() => newsUnreadFromCache())
  const [youtubeUnread, setYoutubeUnread] = useState(() => youtubeUnreadFromCache())

  useEffect(() => {
    const refresh = () => {
      setNewsUnread(newsUnreadFromCache())
      setYoutubeUnread(youtubeUnreadFromCache())
    }
    window.addEventListener('mydsp-news-articles', refresh)
    window.addEventListener('mydsp-news-changed', refresh)
    window.addEventListener('mydsp-youtube-videos', refresh)
    window.addEventListener('mydsp-youtube-changed', refresh)
    refresh()
    return () => {
      window.removeEventListener('mydsp-news-articles', refresh)
      window.removeEventListener('mydsp-news-changed', refresh)
      window.removeEventListener('mydsp-youtube-videos', refresh)
      window.removeEventListener('mydsp-youtube-changed', refresh)
    }
  }, [])

  return (
    <nav className="media-chrome-chips" aria-label="News and YouTube">
      <NavLink
        to="/news"
        className={({ isActive }) =>
          `media-chrome-chip${isActive ? ' is-active' : ''}`
        }
        data-testid="chrome-news-chip"
      >
        News
        {newsUnread > 0 ? (
          <span className="media-chrome-unread" aria-label={`${newsUnread} unread`}>
            {newsUnread > 9 ? '9+' : newsUnread}
          </span>
        ) : null}
      </NavLink>
      <NavLink
        to="/youtube"
        className={({ isActive }) =>
          `media-chrome-chip${isActive ? ' is-active' : ''}`
        }
        data-testid="chrome-youtube-chip"
      >
        YouTube
        {youtubeUnread > 0 ? (
          <span className="media-chrome-unread" aria-label={`${youtubeUnread} unread`}>
            {youtubeUnread > 9 ? '9+' : youtubeUnread}
          </span>
        ) : null}
      </NavLink>
    </nav>
  )
}
