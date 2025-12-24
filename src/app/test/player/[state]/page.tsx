import { notFound } from 'next/navigation'
import Link from 'next/link'
import { triviaQuestions } from '@/lib/questions'
import { getTeamColor } from '@/lib/types'
import { PlayerTestState } from '../../_data/mocks'
import { SoftChristmasLights } from '../../_components/SoftChristmasLights'

export default async function TestPlayerStatePage({ params }: { params: Promise<{ state: string }> }) {
  const { state: stateRaw } = await params
  const state = stateRaw as PlayerTestState
  const allowed: PlayerTestState[] = [
    'join',
    'waiting',
    'playing',
    'locked',
    'revealing-correct',
    'revealing-wrong',
    'paused',
    'finished',
  ]
  if (!allowed.includes(state)) return notFound()

  const qIndex = 1
  const currentQ = triviaQuestions[qIndex] ?? triviaQuestions[0]
  const totalQuestions = 10

  const team = { name: 'Jingle Squad', score: 650 }
  const teamColor = getTeamColor(1)
  const timeLeft = state === 'playing' ? 6 : 20

  const hasAnswered = state === 'locked' || state.startsWith('revealing')
  const wasCorrect = state === 'revealing-correct'
  const pointsEarned = wasCorrect ? 250 : 0

  return (
    <div className="h-[100dvh] wood-background relative overflow-hidden safe-area-inset">
      <SoftChristmasLights />
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/25 to-black/40" />

      <div className="relative z-10 h-full flex flex-col overflow-hidden">
        <div className="px-4 pt-3">
          <div className="w-full max-w-md mx-auto flex items-center justify-between gap-3 text-sm text-white/70">
            <span className="bg-black/30 px-3 py-1 rounded-full border border-white/10">/test/player/{state}</span>
            <Link href="/test/player" className="text-yellow-300 hover:text-yellow-200 transition-colors">
              change state →
            </Link>
          </div>
        </div>

        {state === 'join' ? (
          <JoinPreview />
        ) : state === 'waiting' ? (
          <WaitingPreview teamName={team.name} teamColor={teamColor} />
        ) : state === 'paused' ? (
          <PausedPreview teamName={team.name} teamScore={team.score} teamColor={teamColor} />
        ) : state === 'finished' ? (
          <FinishedPreview teamName={team.name} teamScore={team.score} teamColor={teamColor} />
        ) : state.startsWith('revealing') ? (
          <RevealingPreview
            teamName={team.name}
            teamScore={team.score}
            teamColor={teamColor}
            hasAnswered={hasAnswered}
            wasCorrect={wasCorrect}
            pointsEarned={pointsEarned}
            correctAnswer={currentQ.answers[currentQ.correct]}
          />
        ) : (
          <PlayingOrLockedPreview
            teamName={team.name}
            teamScore={team.score}
            teamColor={teamColor}
            timeLeft={timeLeft}
            question={currentQ.question}
            answers={currentQ.answers}
            questionNumber={qIndex + 1}
            totalQuestions={totalQuestions}
            hasAnswered={hasAnswered}
          />
        )}
      </div>
    </div>
  )
}

function JoinPreview() {
  return (
    <div className="flex-1 flex items-center justify-center p-6 overflow-hidden">
      <div className="question-banner p-8 rounded-3xl w-full max-w-sm shadow-2xl">
        <div className="text-center mb-6">
          <span className="text-6xl">🎄</span>
          <h1 className="text-4xl font-bold text-white mt-2 festive-title">Join Game</h1>
        </div>

        <div className="text-center mb-6">
          <p className="text-yellow-300/80 text-xs uppercase tracking-wider mb-1">Game Code</p>
          <p className="text-2xl font-bold text-white tracking-[0.15em]" style={{ fontFamily: 'Cinzel Decorative, serif' }}>
            XMAS24
          </p>
        </div>

        <div className="mb-5">
          <label className="text-yellow-300 text-sm mb-2 block font-medium">Team Name</label>
          <input
            type="text"
            value="Jingle Squad"
            readOnly
            className="w-full text-xl py-4 px-5 rounded-xl bg-black/40 text-white border-2 border-yellow-400/50 placeholder-white/40 focus:border-yellow-400 focus:outline-none transition-colors"
          />
        </div>

        <div className="mb-6">
          <label className="text-yellow-300 text-sm mb-3 block font-medium">Team Color</label>
          <div className="flex flex-wrap gap-3 justify-center">
            {Array.from({ length: 6 }).map((_, index) => (
              <button
                key={index}
                className={`btn-festive w-12 h-12 rounded-full border-4 transition-all ${index === 1 ? 'scale-110 border-white shadow-lg shadow-white/30' : 'border-transparent'}`}
                style={{
                  background:
                    index === 0
                      ? 'linear-gradient(to bottom right, #b91c1c, #dc2626)'
                      : index === 1
                        ? 'linear-gradient(to bottom right, #15803d, #16a34a)'
                        : index === 2
                          ? 'linear-gradient(to bottom right, #1d4ed8, #2563eb)'
                          : index === 3
                            ? 'linear-gradient(to bottom right, #ca8a04, #eab308)'
                            : index === 4
                              ? 'linear-gradient(to bottom right, #7e22ce, #9333ea)'
                              : 'linear-gradient(to bottom right, #ea580c, #f97316)',
                }}
              />
            ))}
          </div>
        </div>

        <button className="btn-festive w-full bg-gradient-to-br from-green-500 to-green-600 text-white text-2xl font-bold py-5 rounded-xl border-4 border-yellow-400 shadow-lg active:scale-95 transition-transform festive-title">
          🎮 Join Game!
        </button>
      </div>
    </div>
  )
}

function WaitingPreview({
  teamName,
  teamColor,
}: {
  teamName: string
  teamColor: { bg: string; border: string }
}) {
  return (
    <div className="flex-1 flex items-center justify-center p-6 overflow-hidden">
      <div className="question-banner p-9 rounded-3xl text-center w-full max-w-sm shadow-2xl">
        <div className="text-7xl mb-4">✅</div>
        <h1 className="text-4xl font-bold text-white mb-4 festive-title">You&apos;re In!</h1>
        <div className={`bg-gradient-to-br ${teamColor.bg} border-4 ${teamColor.border} rounded-2xl p-5 mb-6 shadow-lg`}>
          <p className="text-2xl text-white font-bold">{teamName}</p>
        </div>
        <div className="flex items-center justify-center gap-2 text-yellow-300">
          <div className="w-2 h-2 bg-yellow-300 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
          <div className="w-2 h-2 bg-yellow-300 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
          <div className="w-2 h-2 bg-yellow-300 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
          <span className="ml-2">Waiting for host</span>
        </div>
      </div>
    </div>
  )
}

function PausedPreview({
  teamName,
  teamScore,
  teamColor,
}: {
  teamName: string
  teamScore: number
  teamColor: { bg: string; border: string }
}) {
  return (
    <div className="flex-1 flex items-center justify-center p-6 overflow-hidden">
      <div className="question-banner p-9 rounded-3xl text-center w-full max-w-sm shadow-2xl">
        <div className="text-7xl mb-4">⏸️</div>
        <h1 className="text-4xl font-bold text-yellow-300 mb-4 festive-title">Paused</h1>
        <div className={`bg-gradient-to-br ${teamColor.bg} border-4 ${teamColor.border} rounded-2xl p-4 mb-6`}>
          <div className="flex justify-between items-center">
            <span className="text-white font-bold">{teamName}</span>
            <span className="text-yellow-300 font-bold text-xl">{teamScore} pts</span>
          </div>
        </div>
        <p className="text-white/70 text-lg animate-pulse">Waiting for host...</p>
      </div>
    </div>
  )
}

function FinishedPreview({
  teamName,
  teamScore,
  teamColor,
}: {
  teamName: string
  teamScore: number
  teamColor: { bg: string; border: string }
}) {
  return (
    <div className="flex-1 flex items-center justify-center p-6 overflow-hidden">
      <div className="question-banner p-9 rounded-3xl text-center w-full max-w-sm shadow-2xl">
        <div className="text-7xl mb-4">🎉</div>
        <h1 className="text-4xl font-bold text-yellow-300 mb-4 festive-title">Game Over!</h1>
        <div className={`bg-gradient-to-br ${teamColor.bg} border-4 ${teamColor.border} rounded-2xl p-5 mb-6 shadow-lg`}>
          <p className="text-xl text-white font-bold">{teamName}</p>
          <p className="text-5xl text-yellow-300 font-bold mt-2">{teamScore}</p>
          <p className="text-white/60 text-sm">points</p>
        </div>
        <button className="btn-festive w-full bg-gradient-to-br from-blue-500 to-blue-600 text-white text-xl font-bold py-4 rounded-xl border-4 border-yellow-400 shadow-lg active:scale-95 transition-transform festive-title">
          🏠 Play Again
        </button>
      </div>
    </div>
  )
}

function RevealingPreview({
  teamName,
  teamScore,
  teamColor,
  hasAnswered,
  wasCorrect,
  pointsEarned,
  correctAnswer,
}: {
  teamName: string
  teamScore: number
  teamColor: { bg: string; border: string }
  hasAnswered: boolean
  wasCorrect: boolean
  pointsEarned: number
  correctAnswer: string
}) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="p-4">
        <div className="festive-surface rounded-2xl px-4 py-3 flex items-center justify-between">
          <div className={`bg-gradient-to-br ${teamColor.bg} border-2 ${teamColor.border} rounded-xl px-4 py-2 shadow-md`}>
            <div className="flex items-center gap-3">
              <span className="text-white font-bold truncate max-w-[140px]">{teamName}</span>
              <span className="text-yellow-300 font-bold text-lg">{teamScore}</span>
            </div>
          </div>
          <div className="px-4 py-2 rounded-xl font-bold text-lg bg-yellow-500/20 text-yellow-300">✨ Reveal</div>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center max-w-md w-full">
          {hasAnswered ? (
            <>
              <div className={`text-9xl mb-6 ${wasCorrect ? 'animate-bounce' : 'animate-pulse'}`}>{wasCorrect ? '🎉' : '😅'}</div>
              <p className={`text-5xl font-bold mb-4 ${wasCorrect ? 'text-green-400' : 'text-red-400'} festive-title`}>
                {wasCorrect ? 'Correct!' : 'Wrong!'}
              </p>
              {wasCorrect && pointsEarned > 0 && <p className="text-3xl text-green-300 font-bold animate-pulse">+{pointsEarned} points!</p>}
              <p className="text-white/60 text-lg mt-4">
                The answer was: <span className="text-green-400 font-bold">{correctAnswer}</span>
              </p>
            </>
          ) : (
            <>
              <div className="text-8xl mb-6">⏰</div>
              <p className="text-4xl font-bold text-yellow-400 mb-4 festive-title">Time&apos;s Up!</p>
              <p className="text-white text-xl">
                Answer: <span className="text-green-400 font-bold">{correctAnswer}</span>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function PlayingOrLockedPreview({
  teamName,
  teamScore,
  teamColor,
  timeLeft,
  question,
  answers,
  questionNumber,
  totalQuestions,
  hasAnswered,
}: {
  teamName: string
  teamScore: number
  teamColor: { bg: string; border: string }
  timeLeft: number
  question: string
  answers: string[]
  questionNumber: number
  totalQuestions: number
  hasAnswered: boolean
}) {
  return (
    <>
      <header className="p-4">
        <div className="festive-surface rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
          <div className={`bg-gradient-to-br ${teamColor.bg} border-2 ${teamColor.border} rounded-xl px-4 py-2 shadow-md`}>
            <div className="flex items-center gap-3">
              <span className="text-white font-bold truncate max-w-[140px]">{teamName}</span>
              <span className="text-yellow-300 font-bold text-lg">{teamScore}</span>
            </div>
          </div>
          <div className={`px-5 py-2 rounded-xl font-bold text-2xl ${timeLeft <= 5 && !hasAnswered ? 'bg-red-600 text-white animate-pulse' : 'bg-black/50 text-white'}`}>
            {timeLeft}
          </div>
        </div>
      </header>

      <div className="px-4 pt-1 pb-3">
        <div className="w-full max-w-md mx-auto">
          <div className="question-banner p-4 rounded-2xl shadow-lg">
            <p className="text-yellow-300/80 text-sm text-center mb-2">
              Q{questionNumber} / {totalQuestions}
            </p>
            <p className="text-xl sm:text-2xl text-white text-center font-bold leading-snug festive-title">{question}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col px-4 pb-4 min-h-0 overflow-hidden">
        <div className="w-full max-w-md mx-auto flex-1 flex flex-col min-h-0 overflow-hidden">
          {hasAnswered ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="text-8xl mb-6 animate-pulse">🔒</div>
                <p className="text-3xl font-bold text-yellow-300 mb-2 festive-title">Answer Locked!</p>
                <p className="text-white/60 text-lg">Waiting for everyone...</p>
                <div className="flex items-center justify-center gap-2 mt-4">
                  <div className="w-2 h-2 bg-yellow-300 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                  <div className="w-2 h-2 bg-yellow-300 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  <div className="w-2 h-2 bg-yellow-300 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-rows-4 gap-3 flex-1 min-h-0 overflow-hidden">
              {answers.map((answer, index) => {
                const colors = [
                  { bg: 'from-green-500 to-green-600', border: 'border-green-400', active: 'active:from-green-400' },
                  { bg: 'from-blue-500 to-blue-600', border: 'border-blue-400', active: 'active:from-blue-400' },
                  { bg: 'from-red-500 to-red-600', border: 'border-red-400', active: 'active:from-red-400' },
                  { bg: 'from-yellow-500 to-orange-500', border: 'border-yellow-400', active: 'active:from-yellow-400' },
                ]
                return (
                  <button
                    key={index}
                    className={`btn-festive h-full min-h-0 bg-gradient-to-br ${colors[index].bg} ${colors[index].border} ${colors[index].active} border-4 rounded-2xl px-5 py-3 text-left active:scale-[0.98] transition-transform flex items-center shadow-lg`}
                  >
                    <span className="text-yellow-200 font-bold text-2xl mr-4">{String.fromCharCode(65 + index)}</span>
                    <span className="text-white font-bold text-lg sm:text-xl leading-snug festive-title">{answer}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}


