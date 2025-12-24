'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Game, Team, Answer, DynamicQuestion, getTeamColor, TEAM_COLORS } from '@/lib/types'

// Extended game type to include the question data
interface GameWithQuestion extends Game {
  current_question_data?: DynamicQuestion | null
}

export default function PlayPage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = use(params)
  const router = useRouter()
  const [game, setGame] = useState<GameWithQuestion | null>(null)
  const [team, setTeam] = useState<Team | null>(null)
  const [teamName, setTeamName] = useState('')
  const [selectedColor, setSelectedColor] = useState(0)
  const [isJoining, setIsJoining] = useState(false)
  const [hasAnswered, setHasAnswered] = useState(false)
  const [myAnswer, setMyAnswer] = useState<Answer | null>(null)
  const [timeLeft, setTimeLeft] = useState(20)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadGame = async () => {
      const { data } = await supabase.from('games').select().eq('id', gameId).single()
      if (!data) { router.push('/'); return }
      setGame(data as GameWithQuestion)
      setTimeLeft(data.question_time_seconds || 20)
      
      const savedTeamId = localStorage.getItem(`team-${gameId}`)
      if (savedTeamId) {
        const { data: teamData } = await supabase.from('teams').select().eq('id', savedTeamId).single()
        if (teamData) setTeam(teamData)
      }
    }
    loadGame()
  }, [gameId, router])

  useEffect(() => {
    const channel = supabase.channel(`player-${gameId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
        (payload) => {
          const newGame = payload.new as GameWithQuestion
          setGame(newGame)
          if (newGame.status === 'playing') {
            // New question started
            setHasAnswered(false)
            setMyAnswer(null)
            setTimeLeft(newGame.question_time_seconds || 20)
          }
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'teams', filter: `id=eq.${team?.id}` },
        (payload) => { if (payload.new) setTeam(payload.new as Team) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'answers', filter: `team_id=eq.${team?.id}` },
        (payload) => {
          // Update my answer when it gets points assigned
          if (payload.new && (payload.new as Answer).question_index === game?.current_question) {
            setMyAnswer(payload.new as Answer)
          }
        })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [gameId, team?.id, game?.current_question])

  // Main timer - only runs when answering is enabled and game is playing
  useEffect(() => {
    if (game?.status !== 'playing' || hasAnswered || !game.answering_enabled) return
    const timer = setInterval(() => setTimeLeft(prev => prev <= 1 ? 0 : prev - 1), 1000)
    return () => clearInterval(timer)
  }, [game?.status, hasAnswered, game?.answering_enabled])
  
  // Reset timer when answering becomes enabled
  useEffect(() => {
    if (game?.status === 'playing' && game.answering_enabled) {
      setTimeLeft(game.question_time_seconds || 20)
    }
  }, [game?.answering_enabled, game?.status, game?.question_time_seconds])

  const joinGame = async () => {
    if (!teamName.trim()) { setError('Please enter a team name'); return }
    setIsJoining(true)
    setError('')
    try {
      const { data, error: dbError } = await supabase.from('teams').insert({ game_id: gameId, name: teamName.trim(), color: TEAM_COLORS[selectedColor].name, score: 0 }).select().single()
      if (dbError) throw dbError
      localStorage.setItem(`team-${gameId}`, data.id)
      setTeam(data)
    } catch { setError('Failed to join. Try a different name.'); setIsJoining(false) }
  }

  const submitAnswer = async (answerIndex: number) => {
    if (hasAnswered || !team || !game || game.status !== 'playing' || !game.current_question_data || !game.answering_enabled) return
    setHasAnswered(true)
    
    const currentQ = game.current_question_data
    const isCorrect = answerIndex === currentQ.correct
    const questionStartTime = game.question_start_time ? new Date(game.question_start_time).getTime() : Date.now() - ((game.question_time_seconds || 20) - timeLeft) * 1000
    
    try {
      const { data } = await supabase.from('answers').insert({ 
        game_id: gameId, 
        team_id: team.id, 
        question_index: game.current_question, 
        answer_index: answerIndex, 
        is_correct: isCorrect, 
        time_taken_ms: Date.now() - questionStartTime 
      }).select().single()
      
      if (data) setMyAnswer(data)
      await supabase.from('teams').update({ has_answered: true }).eq('id', team.id)
    } catch (err) { console.error('Error submitting answer:', err) }
  }

  if (!game) return <LoadingScreen />
  if (!team) return <JoinScreen game={game} teamName={teamName} setTeamName={setTeamName} selectedColor={selectedColor} setSelectedColor={setSelectedColor} isJoining={isJoining} error={error} joinGame={joinGame} />

  const currentQ = game.current_question_data
  const teamColor = getTeamColor(TEAM_COLORS.findIndex(c => c.name === team.color) || 0)
  const totalQuestions = game.total_questions || 10

  // Waiting screen
  if (game.status === 'waiting') {
    return (
      <div className="h-[100dvh] wood-background relative overflow-hidden safe-area-inset">
        <SoftChristmasLights />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/25 to-black/40" />
        <div className="relative z-10 h-full flex flex-col items-center justify-center p-6 overflow-hidden">
          <div className="question-banner p-9 rounded-3xl text-center w-full max-w-sm shadow-2xl">
            <div className="text-7xl mb-4">✅</div>
            <h1 className="text-4xl font-bold text-white mb-4 festive-title">You&apos;re In!</h1>
            <div className={`bg-gradient-to-br ${teamColor.bg} border-4 ${teamColor.border} rounded-2xl p-5 mb-6 shadow-lg`}>
              <p className="text-2xl text-white font-bold">{team.name}</p>
            </div>
            <div className="flex items-center justify-center gap-2 text-yellow-300">
              <div className="w-2 h-2 bg-yellow-300 rounded-full animate-bounce" style={{animationDelay: '0s'}} />
              <div className="w-2 h-2 bg-yellow-300 rounded-full animate-bounce" style={{animationDelay: '0.2s'}} />
              <div className="w-2 h-2 bg-yellow-300 rounded-full animate-bounce" style={{animationDelay: '0.4s'}} />
              <span className="ml-2">Waiting for host</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Game finished screen
  if (game.status === 'finished') {
    return (
      <div className="h-[100dvh] wood-background relative overflow-hidden safe-area-inset">
        <SoftChristmasLights />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/25 to-black/40" />
        <div className="relative z-10 h-full flex flex-col items-center justify-center p-6 overflow-hidden">
          <div className="question-banner p-9 rounded-3xl text-center w-full max-w-sm shadow-2xl">
            <div className="text-7xl mb-4">🎉</div>
            <h1 className="text-4xl font-bold text-yellow-300 mb-4 festive-title">Game Over!</h1>
            <div className={`bg-gradient-to-br ${teamColor.bg} border-4 ${teamColor.border} rounded-2xl p-5 mb-6 shadow-lg`}>
              <p className="text-xl text-white font-bold">{team.name}</p>
              <p className="text-5xl text-yellow-300 font-bold mt-2">{team.score}</p>
              <p className="text-white/60 text-sm">points</p>
            </div>
            <button onClick={() => router.push('/')} className="btn-festive w-full bg-gradient-to-br from-blue-500 to-blue-600 text-white text-xl font-bold py-4 rounded-xl border-4 border-yellow-400 shadow-lg active:scale-95 transition-transform festive-title">🏠 Play Again</button>
          </div>
        </div>
      </div>
    )
  }

  // Paused screen
  if (game.status === 'paused') {
    return (
      <div className="h-[100dvh] wood-background relative overflow-hidden safe-area-inset">
        <SoftChristmasLights />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/25 to-black/40" />
        <div className="relative z-10 h-full flex flex-col items-center justify-center p-6 overflow-hidden">
          <div className="question-banner p-9 rounded-3xl text-center w-full max-w-sm shadow-2xl">
            <div className="text-7xl mb-4">⏸️</div>
            <h1 className="text-4xl font-bold text-yellow-300 mb-4 festive-title">Paused</h1>
            <div className={`bg-gradient-to-br ${teamColor.bg} border-4 ${teamColor.border} rounded-2xl p-4 mb-6`}>
              <div className="flex justify-between items-center">
                <span className="text-white font-bold">{team.name}</span>
                <span className="text-yellow-300 font-bold text-xl">{team.score} pts</span>
              </div>
            </div>
            <p className="text-white/70 text-lg animate-pulse">Waiting for host...</p>
          </div>
        </div>
      </div>
    )
  }

  // Revealing screen - Show results
  if (game.status === 'revealing') {
    const wasCorrect = myAnswer?.is_correct
    const pointsEarned = myAnswer?.points_earned || 0
    
    return (
      <div className="h-[100dvh] wood-background relative overflow-hidden safe-area-inset">
        <SoftChristmasLights />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/25 to-black/40" />
        <div className="relative z-10 h-full flex flex-col overflow-hidden">
          <header className="p-4">
            <div className="festive-surface rounded-2xl px-4 py-3 flex items-center justify-between">
              <div className={`bg-gradient-to-br ${teamColor.bg} border-2 ${teamColor.border} rounded-xl px-4 py-2 shadow-md`}>
                <div className="flex items-center gap-3">
                  <span className="text-white font-bold truncate max-w-[120px]">{team.name}</span>
                  <span className="text-yellow-300 font-bold text-lg">{team.score}</span>
                </div>
              </div>
              <div className="px-4 py-2 rounded-xl font-bold text-lg bg-yellow-500/20 text-yellow-300">
                ✨ Reveal
              </div>
            </div>
          </header>

          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center max-w-md w-full">
            {hasAnswered ? (
              <>
                <div className={`text-9xl mb-6 ${wasCorrect ? 'animate-bounce' : 'animate-pulse'}`}>
                  {wasCorrect ? '🎉' : '😅'}
                </div>
                <p className={`text-5xl font-bold mb-4 ${wasCorrect ? 'text-green-400' : 'text-red-400'}`} style={{ fontFamily: 'Mountains of Christmas, cursive' }}>
                  {wasCorrect ? 'Correct!' : 'Wrong!'}
                </p>
                {wasCorrect && pointsEarned > 0 && (
                  <p className="text-3xl text-green-300 font-bold animate-pulse">+{pointsEarned} points!</p>
                )}
                {currentQ && (
                  <p className="text-white/60 text-lg mt-4">The answer was: <span className="text-green-400 font-bold">{currentQ.answers[currentQ.correct]}</span></p>
                )}
              </>
            ) : (
              <>
                <div className="text-8xl mb-6">⏰</div>
                <p className="text-4xl font-bold text-yellow-400 mb-4" style={{ fontFamily: 'Mountains of Christmas, cursive' }}>Time&apos;s Up!</p>
                {currentQ && (
                  <p className="text-white text-xl">Answer: <span className="text-green-400 font-bold">{currentQ.answers[currentQ.correct]}</span></p>
                )}
              </>
            )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Playing screen - need a question to display
  if (!currentQ) {
    return (
      <div className="h-[100dvh] wood-background relative overflow-hidden safe-area-inset">
        <SoftChristmasLights />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/25 to-black/40" />
        <div className="relative z-10 h-full flex flex-col items-center justify-center p-6 overflow-hidden">
          <div className="text-center">
            <div className="text-6xl animate-bounce mb-4">🎄</div>
            <p className="text-white text-xl">Loading question...</p>
          </div>
        </div>
      </div>
    )
  }

  // Grace period - host is reading question aloud
  const isGracePeriod = game.status === 'playing' && game.answering_enabled === false

  // Playing screen
  return (
    <div className="h-[100dvh] wood-background relative overflow-hidden safe-area-inset">
      <SoftChristmasLights />
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/25 to-black/40" />
      <div className="relative z-10 h-full flex flex-col overflow-hidden">
        <header className="p-4">
          <div className="festive-surface rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
            <div className={`bg-gradient-to-br ${teamColor.bg} border-2 ${teamColor.border} rounded-xl px-4 py-2 shadow-md`}>
              <div className="flex items-center gap-3">
                <span className="text-white font-bold truncate max-w-[140px]">{team.name}</span>
                <span className="text-yellow-300 font-bold text-lg">{team.score}</span>
              </div>
            </div>
            <div className={`px-5 py-2 rounded-xl font-bold text-2xl ${isGracePeriod ? 'bg-yellow-500/30 text-yellow-300' : timeLeft <= 5 && !hasAnswered ? 'bg-red-600 text-white animate-pulse' : 'bg-black/50 text-white'}`}>
              {isGracePeriod ? '📖' : timeLeft}
            </div>
          </div>
        </header>

        <div className="px-4 pt-1 pb-3">
          <div className="w-full max-w-md mx-auto">
            <div className="question-banner p-4 rounded-2xl shadow-lg">
              <p className="text-yellow-300/80 text-sm text-center mb-2">
                Q{(game.current_question ?? 0) + 1} / {totalQuestions}
              </p>
              <p className="text-xl sm:text-2xl text-white text-center font-bold leading-snug festive-title">{currentQ.question}</p>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col px-4 pb-4 min-h-0 overflow-hidden">
          <div className="w-full max-w-md mx-auto flex-1 flex flex-col min-h-0 overflow-hidden">
            {isGracePeriod ? (
              /* Grace period - waiting for host to finish reading */
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-8xl mb-6 animate-pulse">📖</div>
                  <p className="text-3xl font-bold text-yellow-300 mb-2 festive-title">Get Ready!</p>
                  <p className="text-white/70 text-lg">Host is reading the question...</p>
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <div className="w-2 h-2 bg-yellow-300 rounded-full animate-bounce" style={{animationDelay: '0s'}} />
                    <div className="w-2 h-2 bg-yellow-300 rounded-full animate-bounce" style={{animationDelay: '0.2s'}} />
                    <div className="w-2 h-2 bg-yellow-300 rounded-full animate-bounce" style={{animationDelay: '0.4s'}} />
                  </div>
                </div>
              </div>
            ) : hasAnswered ? (
              /* Waiting for reveal - no feedback yet */
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-8xl mb-6 animate-pulse">🔒</div>
                  <p className="text-3xl font-bold text-yellow-300 mb-2 festive-title">Answer Locked!</p>
                  <p className="text-white/60 text-lg">Waiting for everyone...</p>
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <div className="w-2 h-2 bg-yellow-300 rounded-full animate-bounce" style={{animationDelay: '0s'}} />
                    <div className="w-2 h-2 bg-yellow-300 rounded-full animate-bounce" style={{animationDelay: '0.2s'}} />
                    <div className="w-2 h-2 bg-yellow-300 rounded-full animate-bounce" style={{animationDelay: '0.4s'}} />
                  </div>
                </div>
              </div>
            ) : (
              /* Answer Buttons */
              <div className="grid grid-rows-4 gap-3 flex-1 min-h-0 overflow-hidden">
                {currentQ.answers.map((answer, index) => {
                  const colors = [
                    { bg: 'from-green-500 to-green-600', border: 'border-green-400', active: 'active:from-green-400' },
                    { bg: 'from-blue-500 to-blue-600', border: 'border-blue-400', active: 'active:from-blue-400' },
                    { bg: 'from-red-500 to-red-600', border: 'border-red-400', active: 'active:from-red-400' },
                    { bg: 'from-yellow-500 to-orange-500', border: 'border-yellow-400', active: 'active:from-yellow-400' },
                  ]
                  return (
                    <button
                      key={index}
                      onClick={() => submitAnswer(index)}
                      disabled={hasAnswered || timeLeft === 0}
                      className={`btn-festive h-full min-h-0 bg-gradient-to-br ${colors[index].bg} ${colors[index].border} ${colors[index].active} border-4 rounded-2xl px-5 py-3 text-left active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center shadow-lg`}
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
      </div>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div className="min-h-[100dvh] wood-background flex items-center justify-center">
      <div className="text-center">
        <div className="text-6xl animate-bounce mb-4">🎄</div>
        <p className="text-white text-xl">Loading...</p>
      </div>
    </div>
  )
}

function JoinScreen({ game, teamName, setTeamName, selectedColor, setSelectedColor, isJoining, error, joinGame }: {
  game: GameWithQuestion
  teamName: string
  setTeamName: (v: string) => void
  selectedColor: number
  setSelectedColor: (v: number) => void
  isJoining: boolean
  error: string
  joinGame: () => void
}) {
  return (
    <div className="h-[100dvh] wood-background relative overflow-hidden safe-area-inset">
      <SoftChristmasLights />
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/25 to-black/40" />
      <div className="relative z-10 h-full flex flex-col overflow-hidden">
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="question-banner p-8 rounded-3xl w-full max-w-sm shadow-2xl">
            <div className="text-center mb-6">
              <span className="text-6xl">🎄</span>
              <h1 className="text-4xl font-bold text-white mt-2 festive-title">Join Game</h1>
            </div>
            
            <div className="text-center mb-6">
              <p className="text-yellow-300/80 text-xs uppercase tracking-wider mb-1">Game Code</p>
              <p className="text-2xl font-bold text-white tracking-[0.15em]" style={{ fontFamily: 'Cinzel Decorative, serif' }}>{game.code}</p>
            </div>
            
            <div className="mb-5">
              <label className="text-yellow-300 text-sm mb-2 block font-medium">Team Name</label>
              <input type="text" value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="Enter your team name" maxLength={20} className="w-full text-xl py-4 px-5 rounded-xl bg-black/40 text-white border-2 border-yellow-400/50 placeholder-white/40 focus:border-yellow-400 focus:outline-none transition-colors" autoFocus autoComplete="off" autoCapitalize="words" />
            </div>
            
            <div className="mb-6">
              <label className="text-yellow-300 text-sm mb-3 block font-medium">Team Color</label>
              <div className="flex flex-wrap gap-3 justify-center">
                {TEAM_COLORS.map((color, index) => (
                  <button 
                    key={color.name} 
                    onClick={() => setSelectedColor(index)} 
                    className={`btn-festive w-12 h-12 rounded-full border-4 transition-all active:scale-90 ${selectedColor === index ? 'scale-110 border-white shadow-lg shadow-white/30' : 'border-transparent'}`}
                    style={{ background: `linear-gradient(to bottom right, ${color.hex[0]}, ${color.hex[1]})` }}
                  />
                ))}
              </div>
            </div>
            
            {error && <div className="mb-4 text-red-400 text-center text-sm bg-red-900/30 py-2 px-4 rounded-lg">{error}</div>}
            
            <button onClick={joinGame} disabled={isJoining || !teamName.trim()} className="btn-festive w-full bg-gradient-to-br from-green-500 to-green-600 text-white text-2xl font-bold py-5 rounded-xl border-4 border-yellow-400 shadow-lg active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed festive-title">
              {isJoining ? '🎄 Joining...' : '🎮 Join Game!'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function SoftChristmasLights() {
  return (
    <>
      <div className="christmas-lights-soft">
        <div className="light-wire" />
        {Array.from({ length: 28 }).map((_, i) => (
          <div
            key={i}
            className={`light-bulb ${['light-red', 'light-green', 'light-gold', 'light-blue', 'light-purple'][i % 5]}`}
            style={{ left: `${2 + i * 3.4}%`, animationDelay: `${i * 0.12}s` }}
          />
        ))}
      </div>
      <div className="christmas-lights-soft-bottom">
        <div className="light-wire-bottom" />
        {Array.from({ length: 28 }).map((_, i) => (
          <div
            key={i}
            className={`light-bulb-bottom ${['light-purple', 'light-blue', 'light-gold', 'light-green', 'light-red'][i % 5]}`}
            style={{ left: `${2 + i * 3.4}%`, animationDelay: `${i * 0.12 + 0.5}s` }}
          />
        ))}
      </div>
    </>
  )
}
