import { FestiveTestShell, TestLinkGrid } from './_components/FestiveTestShell'

export default function TestIndexPage() {
  return (
    <FestiveTestShell
      title="🧪 Test Pages"
      subtitle="Static UI previews (no Supabase, no game required). Use these to review styling at different states."
    >
      <TestLinkGrid
        links={[
          {
            href: '/test/host',
            label: 'Host previews',
            description: 'Desktop-optimized host screens (waiting/playing/reveal/paused/finished).',
          },
          {
            href: '/test/player',
            label: 'Player previews',
            description: 'Mobile-optimized player screens (join/waiting/playing/reveal/paused/finished).',
          },
        ]}
      />
    </FestiveTestShell>
  )
}


