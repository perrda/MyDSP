import { useState } from 'react'
import { Share2, Copy, Link as LinkIcon, Mail, MessageCircle, Check } from 'lucide-react'
import { useToasts } from '../components/ToastProvider'

interface ShareData {
  title: string
  text: string
  url?: string
}

export function useWebShare() {
  const { success, error } = useToasts()
  const [isSharing, setIsSharing] = useState(false)

  const canShare = typeof navigator !== 'undefined' && 'share' in navigator

  const share = async (data: ShareData) => {
    setIsSharing(true)
    try {
      if (canShare) {
        await navigator.share({
          title: data.title,
          text: data.text,
          url: data.url,
        })
        success('Shared successfully')
        return true
      } else {
        // Fallback to clipboard
        const shareText = `${data.title}\n\n${data.text}${data.url ? `\n\n${data.url}` : ''}`
        await navigator.clipboard.writeText(shareText)
        success('Copied to clipboard', 'Share via your preferred method')
        return true
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        error('Share failed', err.message)
      }
      return false
    } finally {
      setIsSharing(false)
    }
  }

  return { share, canShare, isSharing }
}

interface ShareMenuProps {
  title: string
  text: string
  url?: string
  onClose: () => void
}

export function ShareMenu({ title, text, url, onClose }: ShareMenuProps) {
  const { share } = useWebShare()
  const { success } = useToasts()
  const [copied, setCopied] = useState(false)

  const fullUrl = url || window.location.href

  const handleNativeShare = () => {
    share({ title, text, url: fullUrl })
    onClose()
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${title}\n\n${text}\n\n${fullUrl}`)
      setCopied(true)
      success('Copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Copy failed:', err)
    }
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl)
      success('Link copied')
      onClose()
    } catch (err) {
      console.error('Copy link failed:', err)
    }
  }

  const handleEmail = () => {
    const subject = encodeURIComponent(title)
    const body = encodeURIComponent(`${text}\n\n${fullUrl}`)
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank')
    onClose()
  }

  const handleWhatsApp = () => {
    const textToShare = encodeURIComponent(`${title}\n\n${text}\n\n${fullUrl}`)
    window.open(`https://wa.me/?text=${textToShare}`, '_blank')
    onClose()
  }

  const handleTwitter = () => {
    const textToShare = encodeURIComponent(`${title}\n\n${text}`)
    window.open(`https://twitter.com/intent/tweet?text=${textToShare}&url=${encodeURIComponent(fullUrl)}`, '_blank')
    onClose()
  }

  const handleLinkedIn = () => {
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(fullUrl)}`, '_blank')
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="surface rounded-t-2xl sm:rounded-2xl max-w-md w-full p-6 animate-slide-in-right">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">Share</h3>
          <button type="button" onClick={onClose} className="btn-ghost btn-sm">
            ✕
          </button>
        </div>

        <div className="space-y-2">
          {/* Native Share */}
          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <button
              type="button"
              onClick={handleNativeShare}
              className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-surface-hover transition-colors"
            >
              <Share2 size={20} className="text-accent" />
              <span className="text-sm font-medium">Share via...</span>
            </button>
          )}

          {/* Copy to Clipboard */}
          <button
            type="button"
            onClick={handleCopy}
            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-surface-hover transition-colors"
          >
            {copied ? (
              <Check size={20} className="text-green-500" />
            ) : (
              <Copy size={20} className="text-accent" />
            )}
            <span className="text-sm font-medium">{copied ? 'Copied!' : 'Copy to Clipboard'}</span>
          </button>

          {/* Copy Link */}
          <button
            type="button"
            onClick={handleCopyLink}
            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-surface-hover transition-colors"
          >
            <LinkIcon size={20} className="text-accent" />
            <span className="text-sm font-medium">Copy Link</span>
          </button>

          <div className="border-t border-border my-2" />

          {/* Email */}
          <button
            type="button"
            onClick={handleEmail}
            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-surface-hover transition-colors"
          >
            <Mail size={20} className="text-accent" />
            <span className="text-sm font-medium">Email</span>
          </button>

          {/* WhatsApp */}
          <button
            type="button"
            onClick={handleWhatsApp}
            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-surface-hover transition-colors"
          >
            <MessageCircle size={20} className="text-green-500" />
            <span className="text-sm font-medium">WhatsApp</span>
          </button>

          {/* Twitter */}
          <button
            type="button"
            onClick={handleTwitter}
            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-surface-hover transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            <span className="text-sm font-medium">X (Twitter)</span>
          </button>

          {/* LinkedIn */}
          <button
            type="button"
            onClick={handleLinkedIn}
            className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-surface-hover transition-colors"
          >
            <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
            <span className="text-sm font-medium">LinkedIn</span>
          </button>
        </div>
      </div>
    </div>
  )
}

interface ShareButtonProps {
  title: string
  text: string
  url?: string
  className?: string
}

export function ShareButton({ title, text, url, className }: ShareButtonProps) {
  const [showMenu, setShowMenu] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setShowMenu(true)}
        className={className || 'btn-ghost btn-sm'}
      >
        <Share2 size={14} /> Share
      </button>
      {showMenu && (
        <ShareMenu
          title={title}
          text={text}
          url={url}
          onClose={() => setShowMenu(false)}
        />
      )}
    </>
  )
}

// Export Portfolio Share
interface ExportShareProps {
  data: {
    netWorth: number
    monthlyGrowth: number
    portfolioSize: number
  }
}

export function PortfolioShareCard({ data }: ExportShareProps) {
  return (
    <div className="surface p-6 rounded-xl">
      <h3 className="font-bold mb-4">Share Your Progress</h3>
      <p className="text-sm text-text-muted mb-4">
        Share your financial journey with friends, family, or on social media (privacy-friendly, no sensitive data)
      </p>
      
      <div className="bg-gradient-to-br from-accent/10 to-accent/5 p-6 rounded-lg mb-4 border border-accent/20">
        <div className="text-center">
          <p className="text-sm text-text-muted mb-2">My Financial Journey</p>
          <p className="text-3xl font-bold mb-1">📈 Growing Strong</p>
          <p className="text-sm text-text-muted">
            Tracking {data.portfolioSize} assets with {data.monthlyGrowth > 0 ? '📊 positive' : '📉 tracking'} momentum
          </p>
        </div>
      </div>

      <ShareButton
        title="My Financial Journey with MyDSP"
        text={`I'm managing my finances with MyDSP - tracking ${data.portfolioSize} assets and staying on top of my financial goals! 🎯`}
        className="btn-primary w-full"
      />
    </div>
  )
}
