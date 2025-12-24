import { notFound } from 'next/navigation'
import Link from 'next/link'
import { triviaQuestions } from '@/lib/questions'
import { getTeamColorByName } from '@/lib/types'
import {
  HostTestState,
  makeMockGame,
  makeMockHostAnswers,
  makeMockTeams,
  makeWinnersForHost,
} from '../../_data/mocks'

export default async function TestHostStatePage({ params }: { params: Promise<{ state: string }> }) {
  const { state: stateRaw } = await params
  const state = stateRaw as HostTestState
  const allowed: HostTestState[] = [
    'waiting',
    'playing',
    'revealing-answer',
    'revealing-winners',
    'paused',
    'settings',
    'finished',
  ]
  if (!allowed.includes(state)) return notFound()

  const teams = makeMockTeams()
  const game =
    state === 'waiting'
      ? makeMockGame({ status: 'waiting', current_question: 0 })
      : state === 'paused'
        ? makeMockGame({ status: 'paused' })
        : state === 'finished'
          ? makeMockGame({ status: 'finished' })
          : state.startsWith('revealing')
            ? makeMockGame({ status: 'revealing' })
            : makeMockGame({ status: 'playing' })

  const currentQ = triviaQuestions[game.current_question ?? 0] ?? triviaQuestions[0]
  const timeLeft = state === 'playing' ? 7 : state === 'paused' ? 12 : 20
  const answers = makeMockHostAnswers(game.current_question ?? 0, teams)
  const winners = makeWinnersForHost(teams, game.current_question ?? 0)

  const sortedTeams = [...teams].sort((a, b) => b.score - a.score)
  const currentAnswers = answers
  const sortedCurrentAnswers = [...currentAnswers].sort(
    (a, b) => new Date(a.answered_at).getTime() - new Date(b.answered_at).getTime(),
  )

  const revealPhase: 'none' | 'answer' | 'winners' =
    state === 'revealing-answer' ? 'answer' : state === 'revealing-winners' ? 'winners' : 'none'

  const WINNERS_REVEAL_STEP_MS = 500
  const WINNERS_TOP_BONUS_MS = 350

  return (
    <div className="h-[100dvh] wood-background relative overflow-hidden safe-area-inset">
      <div className="absolute top-16 left-8 text-6xl opacity-20 animate-pulse">🎄</div>
      <div className="absolute top-16 right-8 text-6xl opacity-20 animate-pulse" style={{ animationDelay: '1s' }}>
        🎄
      </div>
      <div className="absolute bottom-8 left-12 text-5xl opacity-15">🎁</div>
      <div className="absolute bottom-8 right-12 text-5xl opacity-15">🎁</div>
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/25 to-black/40" />

      <TestHostLights />

      {/* Overlays */}
      {state === 'paused' && <PausedOverlay />}
      {state === 'settings' && <SettingsOverlay />}

      <div className="relative z-10 flex flex-col h-full p-4 lg:p-6 xl:p-8 overflow-hidden">
        <div className="w-full max-w-[1680px] mx-auto flex flex-col h-full overflow-hidden">
          <header className="flex items-center justify-between gap-4 mb-4 lg:mb-6">
            {(game.status === 'waiting' || (game.current_question ?? 0) === 0) ? (
              <div className="question-banner px-5 py-3 rounded-xl shadow-lg">
                <p className="text-yellow-300/80 text-xs uppercase tracking-wider">Game Code</p>
                <p className="text-4xl font-bold text-white tracking-[0.3em]" style={{ fontFamily: 'Cinzel Decorative, serif' }}>
                  {game.code}
                </p>
              </div>
            ) : (
              <div className="hidden lg:block w-48" />
            )}

            <div className="flex flex-col items-center">
              <h1 className="text-center text-4xl lg:text-5xl xl:text-6xl font-bold text-white festive-title">
                🎄 Christmas Trivia 🎄
              </h1>
              <div className="mt-2 flex items-center gap-3 text-sm text-white/60">
                <span className="bg-black/30 px-3 py-1 rounded-full border border-white/10">/test/host/{state}</span>
                <Link href="/test/host" className="text-yellow-300 hover:text-yellow-200 transition-colors">
                  change state →
                </Link>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {(game.status === 'playing' || game.status === 'paused') && (
                <button className="btn-festive bg-gradient-to-br from-yellow-600 to-orange-600 text-white text-2xl font-bold py-3 px-6 rounded-xl border-2 border-yellow-400 shadow-lg">
                  ⏸️
                </button>
              )}
              <div className="candy-cane-border shadow-lg">
                <div className="bg-gray-900 px-8 py-4 rounded-xl min-w-[140px] text-center">
                  {game.status === 'playing' ? (
                    <span className={`text-6xl font-bold ${timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-white'}`} style={{ fontFamily: 'Cinzel Decorative, serif' }}>
                      {timeLeft}
                    </span>
                  ) : game.status === 'paused' ? (
                    <span className="text-2xl text-yellow-400 font-bold">PAUSED</span>
                  ) : game.status === 'revealing' ? (
                    <span className="text-2xl text-yellow-400">✨</span>
                  ) : game.status === 'finished' ? (
                    <span className="text-2xl text-green-400">🏆</span>
                  ) : (
                    <span className="text-2xl text-yellow-400">Ready</span>
                  )}
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 grid grid-cols-1 lg:grid-cols-[320px,1fr,320px] xl:grid-cols-[360px,1fr,360px] gap-4 lg:gap-6 min-h-0 overflow-hidden">
            {/* Leaderboard */}
            <aside className="hidden lg:flex flex-col min-h-0">
              <div className="festive-surface rounded-2xl p-4">
                <h2 className="text-3xl text-yellow-300 text-center font-bold festive-title">🏆 Leaderboard</h2>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 mt-3">
                {sortedTeams.map((team, index) => {
                  const color = getTeamColorByName(team.color)
                  const medal = index === 0 ? '👑' : index === 1 ? '🥈' : index === 2 ? '🥉' : null
                  return (
                    <div key={team.id} className={`bg-gradient-to-br ${color.bg} border-2 ${color.border} rounded-xl p-3 shadow-md`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {medal && game.status !== 'waiting' && <span className="text-xl">{medal}</span>}
                          <span className="text-white font-bold truncate max-w-[140px]">{team.name}</span>
                        </div>
                        <span className="text-yellow-300 font-bold text-2xl">{team.score}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </aside>

            {/* Center */}
            <section className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {state === 'waiting' ? (
                <div className="flex-1 flex flex-col items-center justify-center">
                  <div className="question-banner p-8 lg:p-10 rounded-3xl text-center shadow-2xl mb-8 w-full max-w-3xl">
                    <h2 className="text-5xl lg:text-6xl font-bold text-white mb-6 festive-title">📱 Scan to Join!</h2>
                    <div className="bg-white p-5 rounded-2xl inline-block mb-6 shadow-inner">
                      <div className="w-[200px] h-[200px] bg-gray-100 grid place-items-center text-gray-700 font-bold">
                        QR
                      </div>
                    </div>
                    <p className="text-yellow-300 text-xl mb-2">Or visit:</p>
                    <p className="text-white/90 text-lg break-all font-mono bg-black/30 px-4 py-2 rounded-lg">
                      https://example.com/play/{game.id}
                    </p>
                  </div>
                  <div className="flex gap-6">
                    <button className="btn-festive bg-gradient-to-br from-blue-600 to-blue-700 text-white text-2xl font-bold py-5 px-10 rounded-xl border-4 border-yellow-400 shadow-lg festive-title">
                      ⚙️ Settings
                    </button>
                    <button className="btn-festive bg-gradient-to-br from-green-600 to-green-700 text-white text-2xl font-bold py-5 px-10 rounded-xl border-4 border-yellow-400 shadow-lg festive-title animate-pulse">
                      🎮 Start! ({teams.length} teams)
                    </button>
                  </div>
                </div>
              ) : state === 'finished' ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="question-banner p-14 rounded-3xl text-center shadow-2xl">
                    <h2 className="text-6xl lg:text-7xl font-bold text-yellow-300 mb-10 festive-title">🎉 Game Over! 🎉</h2>
                    <p className="text-3xl text-white/80 mb-3">Winner</p>
                    <p className="text-5xl lg:text-6xl font-bold text-white mb-4 festive-title">👑 {sortedTeams[0]?.name}</p>
                    <p className="text-5xl text-yellow-300 font-bold mb-8">{sortedTeams[0]?.score} points</p>
                    <button className="btn-festive bg-gradient-to-br from-blue-600 to-blue-700 text-white text-2xl font-bold py-5 px-10 rounded-xl border-4 border-yellow-400 shadow-lg festive-title">
                      🏠 New Game
                    </button>
                  </div>
                </div>
              ) : revealPhase === 'winners' ? (
                <div className="flex-1 flex items-center justify-center animate-fadeIn">
                  <div className="text-center w-full max-w-2xl">
                    <h2 className="text-5xl font-bold text-yellow-300 mb-8 festive-title">🎉 Correct Answers! 🎉</h2>
                    <div className="space-y-4">
                      {[...winners]
                        .sort((a, b) => a.position - b.position)
                        .map((w, idx, arr) => {
                        const color = getTeamColorByName(w.team.color)
                        const isTop = w.position === 1
                        const delayMs =
                          (arr.length - 1 - idx) * WINNERS_REVEAL_STEP_MS + (isTop ? WINNERS_TOP_BONUS_MS : 0)
                        return (
                          <div
                            key={w.team.id}
                            className={`bg-gradient-to-br ${color.bg} border-4 ${color.border} rounded-2xl shadow-xl animate-slideUp transition-transform ${isTop ? 'p-7 ring-4 ring-yellow-300/80 scale-[1.06] shadow-2xl shadow-yellow-300/20' : 'p-5'}`}
                            style={{ animationDelay: `${delayMs}ms` }}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <span className={`${isTop ? 'text-5xl' : 'text-4xl'}`}>{w.position === 1 ? '🥇' : w.position === 2 ? '🥈' : '🥉'}</span>
                                <span className={`${isTop ? 'text-5xl' : 'text-3xl'} text-white font-bold festive-title`}>{w.team.name}</span>
                              </div>
                              <span className={`${isTop ? 'text-5xl' : 'text-3xl'} text-green-300 font-bold`}>+{w.points}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <p className="text-white/60 text-lg mt-8">Next question coming up...</p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="text-center mb-3">
                    <span className="inline-block bg-black/40 text-yellow-300 px-6 py-2 rounded-full text-lg">
                      Question {(game.current_question ?? 0) + 1} of {Math.min(game.total_questions, triviaQuestions.length)}
                    </span>
                  </div>

                  <div className="question-banner p-6 lg:p-8 rounded-2xl mb-5 shadow-xl">
                    <p className="text-4xl lg:text-5xl xl:text-6xl text-white text-center font-bold leading-tight festive-title">
                      {currentQ.question}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 grid-rows-4 sm:grid-rows-2 gap-4 lg:gap-5 flex-1 min-h-0 overflow-hidden">
                    {currentQ.answers.map((answer, index) => {
                      const colors = [
                        { bg: 'from-green-600 to-green-700', border: 'border-green-400' },
                        { bg: 'from-blue-600 to-blue-700', border: 'border-blue-400' },
                        { bg: 'from-red-600 to-red-700', border: 'border-red-400' },
                        { bg: 'from-yellow-500 to-orange-500', border: 'border-yellow-400' },
                      ]
                      const isCorrect = index === currentQ.correct
                      const showCorrect = revealPhase === 'answer'
                      return (
                        <div
                          key={index}
                          className={`bg-gradient-to-br ${colors[index].bg} ${colors[index].border} border-4 rounded-2xl p-4 lg:p-6 flex items-center justify-center shadow-lg transition-all duration-700 min-h-0 ${showCorrect && isCorrect ? 'ring-8 ring-green-400 scale-[1.02] lg:scale-105 shadow-2xl shadow-green-500/50' : ''} ${showCorrect && !isCorrect ? 'opacity-30 scale-[0.99] lg:scale-95' : ''}`}
                        >
                          <span className="text-2xl lg:text-3xl xl:text-4xl font-bold text-white text-center leading-snug festive-title">
                            <span className="text-yellow-200 mr-3 text-3xl lg:text-4xl xl:text-5xl">
                              {String.fromCharCode(65 + index)}
                            </span>
                            {answer}
                            {showCorrect && isCorrect && <span className="ml-4 text-4xl">✓</span>}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </section>

            {/* Answer Panel */}
            {game.status === 'playing' && revealPhase === 'none' ? (
              <aside className="hidden lg:flex flex-col min-h-0">
                <div className="festive-surface rounded-2xl p-4">
                  <h2 className="text-3xl text-yellow-300 text-center font-bold festive-title">
                    🔒 Locked In <span className="text-white/60 text-xl">({currentAnswers.length}/{teams.length})</span>
                  </h2>
                </div>
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 mt-3">
                  {sortedCurrentAnswers.map((ans, idx) => {
                    const team = teams.find((t) => t.id === ans.team_id)
                    if (!team) return null
                    const color = getTeamColorByName(team.color)
                    return (
                      <div key={ans.id} className={`bg-gradient-to-br ${color.bg} border-2 ${color.border} rounded-xl p-3 shadow-md`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="bg-black/30 text-yellow-300 font-bold px-2 py-0.5 rounded text-sm">#{idx + 1}</span>
                            <span className="text-white font-bold truncate max-w-[140px]">{team.name}</span>
                          </div>
                          <span className="text-white/50">🔒</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </aside>
            ) : (
              <aside className="hidden lg:block" />
            )}
          </main>
        </div>
      </div>
    </div>
  )
}

function TestHostLights() {
  return (
    <div className="christmas-lights">
      <div className="light-wire" />
      {Array.from({ length: 30 }).map((_, i) => (
        <div
          key={i}
          className={`light-bulb ${['light-red', 'light-green', 'light-gold', 'light-blue', 'light-purple'][i % 5]}`}
          style={{ left: `${1 + i * 3.3}%`, animationDelay: `${i * 0.12}s` }}
        />
      ))}
    </div>
  )
}

function PausedOverlay() {
  return (
    <div className="absolute inset-0 bg-black/85 z-50 flex items-center justify-center backdrop-blur-sm">
      <div className="question-banner p-10 rounded-3xl max-w-md w-full mx-4 shadow-2xl">
        <h2 className="text-5xl font-bold text-white text-center mb-8 festive-title">⏸️ Game Paused</h2>
        <div className="space-y-4">
          <button className="w-full bg-gradient-to-br from-green-600 to-green-700 text-white text-2xl font-bold py-5 px-6 rounded-xl border-4 border-yellow-400 shadow-lg festive-title">
            ▶️ Resume Game
          </button>
          <button className="w-full bg-gradient-to-br from-blue-600 to-blue-700 text-white text-2xl font-bold py-5 px-6 rounded-xl border-4 border-yellow-400 shadow-lg festive-title">
            ⚙️ Settings
          </button>
          <button className="w-full bg-gradient-to-br from-red-600 to-red-700 text-white text-2xl font-bold py-5 px-6 rounded-xl border-4 border-yellow-400 shadow-lg festive-title">
            🛑 End Game
          </button>
        </div>
      </div>
    </div>
  )
}

function SettingsOverlay() {
  return (
    <div className="absolute inset-0 bg-black/85 z-50 flex items-center justify-center backdrop-blur-sm">
      <div className="question-banner p-10 rounded-3xl max-w-md w-full mx-4 shadow-2xl">
        <h2 className="text-4xl font-bold text-white text-center mb-8 festive-title">⚙️ Settings</h2>
        <div className="space-y-8">
          <div>
            <label className="text-yellow-300 text-lg mb-3 block">
              Time per Question: <span className="text-white font-bold text-2xl">20s</span>
            </label>
            <div className="w-full h-3 bg-gray-700 rounded-lg relative overflow-hidden">
              <div className="absolute left-0 top-0 h-full bg-yellow-400 w-[50%]" />
            </div>
          </div>
          <div>
            <label className="text-yellow-300 text-lg mb-3 block">
              Questions: <span className="text-white font-bold text-2xl">10</span>
            </label>
            <div className="w-full h-3 bg-gray-700 rounded-lg relative overflow-hidden">
              <div className="absolute left-0 top-0 h-full bg-yellow-400 w-[40%]" />
            </div>
          </div>
          <div className="bg-black/40 p-4 rounded-xl border border-yellow-400/30">
            <p className="text-yellow-300 text-sm font-bold mb-2">🏆 Points: 1st: 300 • 2nd: 250 • 3rd: 200...</p>
          </div>
          <div className="flex gap-4">
            <button className="flex-1 bg-gradient-to-br from-gray-600 to-gray-700 text-white text-xl font-bold py-4 rounded-xl border-4 border-gray-500 festive-title">
              Cancel
            </button>
            <button className="flex-1 bg-gradient-to-br from-green-600 to-green-700 text-white text-xl font-bold py-4 rounded-xl border-4 border-yellow-400 festive-title">
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}


