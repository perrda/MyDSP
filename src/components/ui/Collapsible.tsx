import { type ReactNode, useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface CollapsibleProps {
  title: string
  children: ReactNode
  defaultOpen?: boolean
  icon?: ReactNode
  badge?: string | number
}

export function Collapsible({ title, children, defaultOpen = false, icon, badge }: CollapsibleProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="surface border border-border overflow-hidden rounded-lg md:rounded-none">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-surface-hover transition-colors"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3 min-w-0">
          {icon && <div className="text-accent flex-shrink-0">{icon}</div>}
          <span className="font-semibold truncate">{title}</span>
          {badge !== undefined && (
            <span className="px-2 py-0.5 text-xs font-bold bg-accent/10 text-accent rounded">
              {badge}
            </span>
          )}
        </div>
        <ChevronDown
          className={`w-5 h-5 text-text-subtle transition-transform duration-200 flex-shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="p-4 border-t border-border">{children}</div>
      </div>
    </div>
  )
}

interface AccordionProps {
  items: Array<{
    id: string
    title: string
    content: ReactNode
    icon?: ReactNode
    badge?: string | number
  }>
  allowMultiple?: boolean
  defaultOpen?: string[]
}

export function Accordion({ items, allowMultiple = false, defaultOpen = [] }: AccordionProps) {
  const [openItems, setOpenItems] = useState<Set<string>>(new Set(defaultOpen))

  const toggle = (id: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        if (!allowMultiple) {
          next.clear()
        }
        next.add(id)
      }
      return next
    })
  }

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const isOpen = openItems.has(item.id)
        return (
          <div
            key={item.id}
            className="surface border border-border overflow-hidden rounded-lg md:rounded-none"
          >
            <button
              type="button"
              onClick={() => toggle(item.id)}
              className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-surface-hover transition-colors"
              aria-expanded={isOpen}
            >
              <div className="flex items-center gap-3 min-w-0">
                {item.icon && <div className="text-accent flex-shrink-0">{item.icon}</div>}
                <span className="font-semibold truncate">{item.title}</span>
                {item.badge !== undefined && (
                  <span className="px-2 py-0.5 text-xs font-bold bg-accent/10 text-accent rounded">
                    {item.badge}
                  </span>
                )}
              </div>
              <ChevronDown
                className={`w-5 h-5 text-text-subtle transition-transform duration-200 flex-shrink-0 ${
                  isOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            <div
              className={`overflow-hidden transition-all duration-300 ease-in-out ${
                isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
              }`}
            >
              <div className="p-4 border-t border-border animate-fade-in">{item.content}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

interface ExpandableTextProps {
  text: string
  maxLength?: number
}

export function ExpandableText({ text, maxLength = 150 }: ExpandableTextProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (text.length <= maxLength) {
    return <p className="text-sm text-text-muted leading-relaxed">{text}</p>
  }

  return (
    <div>
      <p className="text-sm text-text-muted leading-relaxed">
        {isExpanded ? text : `${text.slice(0, maxLength)}...`}
      </p>
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="text-xs text-accent hover:text-accent-bright font-semibold mt-2 uppercase tracking-wide"
      >
        {isExpanded ? 'Show less' : 'Show more'}
      </button>
    </div>
  )
}
