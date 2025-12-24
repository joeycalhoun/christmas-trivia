import Link from 'next/link'
import { SoftChristmasLights } from './SoftChristmasLights'

export function FestiveTestShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-[100dvh] wood-background relative overflow-hidden safe-area-inset">
      <SoftChristmasLights />
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/25 to-black/40" />
      <div className="relative z-10 min-h-[100dvh] px-4 py-6">
        <div className="w-full max-w-4xl mx-auto">
          <div className="festive-surface rounded-2xl px-5 py-4 mb-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white festive-title">{title}</h1>
              {subtitle && <p className="text-white/70 mt-1">{subtitle}</p>}
            </div>
            <Link
              href="/"
              className="btn-festive inline-flex items-center justify-center bg-gradient-to-br from-blue-600 to-blue-700 text-white font-bold px-4 py-2 rounded-xl border-2 border-yellow-400 shadow-lg active:scale-95 transition-transform festive-title"
            >
              Home
            </Link>
          </div>

          {children}
        </div>
      </div>
    </div>
  )
}

export function TestLinkGrid({
  links,
}: {
  links: Array<{ href: string; label: string; description?: string }>
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className="question-banner rounded-2xl p-6 shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-transform"
        >
          <div className="text-2xl font-bold text-white festive-title">{l.label}</div>
          {l.description && <div className="text-white/70 mt-2">{l.description}</div>}
          <div className="text-yellow-300/90 mt-4 text-sm">Open →</div>
        </Link>
      ))}
    </div>
  )
}


