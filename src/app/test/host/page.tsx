import Link from 'next/link'
import { FestiveTestShell, TestLinkGrid } from '../_components/FestiveTestShell'

export default function TestHostIndexPage() {
  return (
    <FestiveTestShell title="🖥️ Host Test Pages" subtitle="Pick a host state to preview (static mock data).">
      <div className="flex items-center justify-between gap-4 mb-6">
        <Link
          href="/test"
          className="btn-festive inline-flex items-center justify-center bg-black/40 text-white font-bold px-4 py-2 rounded-xl border border-yellow-400/40 hover:border-yellow-400 transition-colors"
        >
          ← Back to /test
        </Link>
      </div>

      <TestLinkGrid
        links={[
          { href: '/test/host/waiting', label: 'waiting', description: 'Join QR / start game screen' },
          { href: '/test/host/playing', label: 'playing', description: 'Question + answers + side panels' },
          { href: '/test/host/revealing-answer', label: 'revealing-answer', description: 'Correct answer highlight phase' },
          { href: '/test/host/revealing-winners', label: 'revealing-winners', description: 'Winners list phase' },
          { href: '/test/host/paused', label: 'paused', description: 'Paused menu overlay' },
          { href: '/test/host/settings', label: 'settings', description: 'Settings overlay' },
          { href: '/test/host/finished', label: 'finished', description: 'Game over screen' },
        ]}
      />
    </FestiveTestShell>
  )
}


