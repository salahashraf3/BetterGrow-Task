import type { Theme } from '../state/useTheme'

type ThemeToggleProps = {
  readonly theme: Theme
  readonly onToggle: () => void
}

export default function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  const next = theme === 'dark' ? 'light' : 'dark'
  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={`Switch to ${next} theme`}
      aria-pressed={theme === 'dark'}
      onClick={onToggle}
    >
      {theme === 'dark' ? (
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <circle cx="12" cy="12" r="5" fill="currentColor" />
          <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="12" y1="1.5" x2="12" y2="4" />
            <line x1="12" y1="20" x2="12" y2="22.5" />
            <line x1="1.5" y1="12" x2="4" y2="12" />
            <line x1="20" y1="12" x2="22.5" y2="12" />
            <line x1="4.6" y1="4.6" x2="6.4" y2="6.4" />
            <line x1="17.6" y1="17.6" x2="19.4" y2="19.4" />
            <line x1="4.6" y1="19.4" x2="6.4" y2="17.6" />
            <line x1="17.6" y1="6.4" x2="19.4" y2="4.6" />
          </g>
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path
            d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"
            fill="currentColor"
          />
        </svg>
      )}
      <span aria-hidden="true">{next === 'dark' ? 'Dark' : 'Light'}</span>
    </button>
  )
}
