import Link from 'next/link'
import { FestiveTestShell, TestLinkGrid } from '../_components/FestiveTestShell'

export default function TestPlayerIndexPage() {
  return (
    <FestiveTestShell title="📱 Player Test Pages" subtitle="Pick a player state to preview (static mock data).">
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
          { href: '/test/player/join', label: 'join', description: 'Enter team name / select color' },
          { href: '/test/player/waiting', label: 'waiting', description: 'Joined, waiting for host' },
          { href: '/test/player/playing', label: 'playing', description: 'Question + answer buttons' },
          { href: '/test/player/locked', label: 'locked', description: 'Answer locked screen' },
          { href: '/test/player/revealing-correct', label: 'revealing-correct', description: 'Reveal screen (correct)' },
          { href: '/test/player/revealing-wrong', label: 'revealing-wrong', description: 'Reveal screen (wrong)' },
          { href: '/test/player/paused', label: 'paused', description: 'Paused screen' },
          { href: '/test/player/finished', label: 'finished', description: 'Game over screen' },
        ]}
      />
    </FestiveTestShell>
  )
}


