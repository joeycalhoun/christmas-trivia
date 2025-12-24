'use client'

import { useState, useEffect, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '@/lib/supabase'
import { triviaQuestions } from '@/lib/questions'
import { Game, Team, Answer, getTeamColor, DEFAULT_SETTINGS, REVEAL_TIME_SECONDS } from '@/lib/types'

const POINTS_BY_ORDER = [300, 250, 200, 175, 150, 125, 100, 100, 100, 100]

export default function HostPage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = use(params)
  const router = useRouter()
  const [game, setGame] = useState<Game | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [answers, setAnswers] = useState<Answer[]>([])
  const [timeLeft, setTimeLeft] = useState(DEFAULT_SETTINGS.questionTime)
  const [hostUrl, setHostUrl] = useState('')
  const [showMenu, setShowMenu] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [revealedPoints, setRevealedPoints] = useState<Record<string, number>>({})
  
  const gameRef = useRef<Game | null>(null)
  const teamsRef = useRef<Team[]>([])
  const answersRef = useRef<Answer[]>([])
  const settingsRef = useRef(DEFAULT_SETTINGS)
  const pausedTimeRef = useRef<number | null>(null)
  const hasRevealedRef = useRef(false)

  useEffect(() => { gameRef.current = game }, [game])
  useEffect(() => { teamsRef.current = teams }, [teams])
  useEffect(() => { answersRef.current = answers }, [answers])
  useEffect(() => { settingsRef.current = settings }, [settings])
  useEffect(() => { setHostUrl(window.location.origin) }, [])

  useEffect(() => {
    const loadGame = async () => {
      const { data: gameData } = await supabase.from('games').select().eq('id', gameId).single()
      if (!gameData) { router.push('/'); return }
      
      setGame(gameData)
      const loadedSettings = {
        questionTime: gameData.question_time_seconds || DEFAULT_SETTINGS.questionTime,
        totalQuestions: gameData.total_questions || DEFAULT_SETTINGS.totalQuestions,
      }
      setSettings(loadedSettings)
      setTimeLeft(loadedSettings.questionTime)
      
      const { data: teamsData } = await supabase.from('teams').select().eq('game_id', gameId).order('created_at')
      setTeams(teamsData || [])
      
      const { data: answersData } = await supabase.from('answers').select().eq('game_id', gameId)
      setAnswers(answersData || [])
    }
    loadGame()
  }, [gameId, router])

  useEffect(() => {
    const channel = supabase.channel(`game-${gameId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams', filter: `game_id=eq.${gameId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') setTeams(prev => [...prev, payload.new as Team])
          else if (payload.eventType === 'UPDATE') setTeams(prev => prev.map(t => t.id === payload.new.id ? payload.new as Team : t))
        })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'answers', filter: `game_id=eq.${gameId}` },
        (payload) => setAnswers(prev => [...prev, payload.new as Answer]))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [gameId])

  useEffect(() => {
    if (game?.status !== 'playing' || hasRevealedRef.current) return
    const currentAnswers = answers.filter(a => a.question_index === game.current_question)
    if (teams.length > 0 && currentAnswers.length >= teams.length) {
      hasRevealedRef.current = true
      handleReveal()
    }
  }, [answers, teams, game?.status, game?.current_question])

  const handleReveal = async () => {
    const currentGame = gameRef.current
    if (!currentGame) return
    
    const { data: freshAnswers } = await supabase.from('answers').select()
      .eq('game_id', gameId).eq('question_index', currentGame.current_question ?? 0)
      .order('answered_at', { ascending: true })
    const { data: freshTeams } = await supabase.from('teams').select().eq('game_id', gameId)
    if (!freshAnswers || !freshTeams) return
    
    let correctOrderIndex = 0
    const pointsMap: Record<string, number> = {}
    
    for (const answer of freshAnswers) {
      if (answer.is_correct) {
        const points = POINTS_BY_ORDER[correctOrderIndex] || 100
        pointsMap[answer.team_id] = points
        await supabase.from('answers').update({ points_earned: points }).eq('id', answer.id)
        const team = freshTeams.find(t => t.id === answer.team_id)
        if (team) {
          await supabase.from('teams').update({ score: team.score + points }).eq('id', team.id)
          setTeams(prev => prev.map(t => t.id === team.id ? { ...t, score: team.score + points } : t))
        }
        correctOrderIndex++
      }
    }
    
    setRevealedPoints(pointsMap)
    await supabase.from('games').update({ status: 'revealing' }).eq('id', gameId)
    setGame(prev => prev ? { ...prev, status: 'revealing' } : null)
    setTimeout(() => nextQuestion(), REVEAL_TIME_SECONDS * 1000)
  }

  useEffect(() => {
    if (game?.status !== 'playing') return
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          if (!hasRevealedRef.current) { hasRevealedRef.current = true; handleReveal() }
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [game?.status, gameId])

  const saveSettings = async () => {
    await supabase.from('games').update({ question_time_seconds: settings.questionTime, total_questions: settings.totalQuestions }).eq('id', gameId)
    setGame(prev => prev ? { ...prev, question_time_seconds: settings.questionTime, total_questions: settings.totalQuestions } : null)
    if (pausedTimeRef.current !== null && pausedTimeRef.current > settings.questionTime) pausedTimeRef.current = settings.questionTime
    setShowSettings(false)
    if (game?.status === 'paused') setShowMenu(true)
  }

  const startGame = async () => {
    if (teams.length < 1) return
    hasRevealedRef.current = false
    await supabase.from('games').update({ status: 'playing', current_question: 0, question_start_time: new Date().toISOString(), question_time_seconds: settings.questionTime, total_questions: settings.totalQuestions }).eq('id', gameId)
    await supabase.from('teams').update({ has_answered: false }).eq('game_id', gameId)
    setGame(prev => prev ? { ...prev, status: 'playing', current_question: 0, question_time_seconds: settings.questionTime, total_questions: settings.totalQuestions } : null)
    setTimeLeft(settings.questionTime)
    setRevealedPoints({})
  }

  const pauseGame = async () => {
    pausedTimeRef.current = timeLeft
    await supabase.from('games').update({ status: 'paused' }).eq('id', gameId)
    setGame(prev => prev ? { ...prev, status: 'paused' } : null)
    setShowMenu(true)
  }

  const resumeGame = async () => {
    const resumeTime = Math.min(pausedTimeRef.current ?? settings.questionTime, settings.questionTime)
    await supabase.from('games').update({ status: 'playing', question_start_time: new Date().toISOString(), question_time_seconds: settings.questionTime }).eq('id', gameId)
    setGame(prev => prev ? { ...prev, status: 'playing', question_time_seconds: settings.questionTime } : null)
    setTimeLeft(resumeTime)
    pausedTimeRef.current = null
    setShowMenu(false)
  }

  const endGame = async () => {
    await supabase.from('games').update({ status: 'finished' }).eq('id', gameId)
    setGame(prev => prev ? { ...prev, status: 'finished' } : null)
    setShowMenu(false)
  }

  const nextQuestion = async () => {
    const currentSettings = settingsRef.current
    const currentGame = gameRef.current
    hasRevealedRef.current = false
    setRevealedPoints({})
    
    const nextQ = (currentGame?.current_question ?? 0) + 1
    if (nextQ >= Math.min(currentSettings.totalQuestions, triviaQuestions.length)) {
      await supabase.from('games').update({ status: 'finished' }).eq('id', gameId)
      setGame(prev => prev ? { ...prev, status: 'finished' } : null)
      return
    }
    
    await supabase.from('teams').update({ has_answered: false }).eq('game_id', gameId)
    setTeams(prev => prev.map(t => ({ ...t, has_answered: false })))
    await supabase.from('games').update({ status: 'playing', current_question: nextQ, question_start_time: new Date().toISOString(), question_time_seconds: currentSettings.questionTime }).eq('id', gameId)
    setGame(prev => prev ? { ...prev, status: 'playing', current_question: nextQ, question_time_seconds: currentSettings.questionTime } : null)
    setTimeLeft(currentSettings.questionTime)
  }

  const currentQ = triviaQuestions[game?.current_question ?? 0]
  const currentAnswers = answers.filter(a => a.question_index === game?.current_question)
  const joinUrl = `${hostUrl}/play/${gameId}`
  const sortedTeams = [...teams].sort((a, b) => b.score - a.score)
  const sortedCurrentAnswers = [...currentAnswers].sort((a, b) => new Date(a.answered_at).getTime() - new Date(b.answered_at).getTime())

  if (!game) return <div className="min-h-screen wood-background flex items-center justify-center"><div className="text-white text-2xl">Loading...</div></div>

  return (
    <div className="min-h-screen wood-background relative overflow-hidden">
      {/* Decorative Elements */}
      <div className="absolute top-16 left-8 text-6xl opacity-20 animate-pulse">🎄</div>
      <div className="absolute top-16 right-8 text-6xl opacity-20 animate-pulse" style={{animationDelay: '1s'}}>🎄</div>
      <div className="absolute bottom-8 left-12 text-5xl opacity-15">🎁</div>
      <div className="absolute bottom-8 right-12 text-5xl opacity-15">🎁</div>
      
      <ChristmasLights />

      {/* Overlays */}
      {showMenu && (
        <div className="absolute inset-0 bg-black/85 z-50 flex items-center justify-center backdrop-blur-sm">
          <div className="question-banner p-10 rounded-3xl max-w-md w-full mx-4 shadow-2xl">
            <h2 className="text-5xl font-bold text-white text-center mb-8" style={{ fontFamily: 'Mountains of Christmas, cursive' }}>⏸️ Game Paused</h2>
            <div className="space-y-4">
              <button onClick={resumeGame} className="w-full bg-gradient-to-br from-green-600 to-green-700 text-white text-2xl font-bold py-5 px-6 rounded-xl border-4 border-yellow-400 shadow-lg hover:scale-105 transition-transform" style={{ fontFamily: 'Mountains of Christmas, cursive' }}>▶️ Resume Game</button>
              <button onClick={() => { setShowSettings(true); setShowMenu(false); }} className="w-full bg-gradient-to-br from-blue-600 to-blue-700 text-white text-2xl font-bold py-5 px-6 rounded-xl border-4 border-yellow-400 shadow-lg hover:scale-105 transition-transform" style={{ fontFamily: 'Mountains of Christmas, cursive' }}>⚙️ Settings</button>
              <button onClick={endGame} className="w-full bg-gradient-to-br from-red-600 to-red-700 text-white text-2xl font-bold py-5 px-6 rounded-xl border-4 border-yellow-400 shadow-lg hover:scale-105 transition-transform" style={{ fontFamily: 'Mountains of Christmas, cursive' }}>🛑 End Game</button>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="absolute inset-0 bg-black/85 z-50 flex items-center justify-center backdrop-blur-sm">
          <div className="question-banner p-10 rounded-3xl max-w-md w-full mx-4 shadow-2xl">
            <h2 className="text-4xl font-bold text-white text-center mb-8" style={{ fontFamily: 'Mountains of Christmas, cursive' }}>⚙️ Settings</h2>
            <div className="space-y-8">
              <div>
                <label className="text-yellow-300 text-lg mb-3 block">Time per Question: <span className="text-white font-bold text-2xl">{settings.questionTime}s</span></label>
                <input type="range" min="10" max="60" step="5" value={settings.questionTime} onChange={(e) => setSettings(s => ({ ...s, questionTime: parseInt(e.target.value) }))} className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-400" />
                <div className="flex justify-between text-gray-400 text-sm mt-2"><span>10s</span><span>60s</span></div>
              </div>
              <div>
                <label className="text-yellow-300 text-lg mb-3 block">Questions: <span className="text-white font-bold text-2xl">{settings.totalQuestions}</span></label>
                <input type="range" min="5" max={triviaQuestions.length} step="1" value={settings.totalQuestions} onChange={(e) => setSettings(s => ({ ...s, totalQuestions: parseInt(e.target.value) }))} className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-400" />
                <div className="flex justify-between text-gray-400 text-sm mt-2"><span>5</span><span>{triviaQuestions.length}</span></div>
              </div>
              <div className="bg-black/40 p-4 rounded-xl border border-yellow-400/30">
                <p className="text-yellow-300 text-sm font-bold mb-2">🏆 Points System</p>
                <p className="text-gray-300 text-sm">1st: 300 • 2nd: 250 • 3rd: 200 • 4th: 175 • 5th+: 150-100</p>
              </div>
              <div className="flex gap-4 pt-2">
                <button onClick={() => { setShowSettings(false); if (game?.status === 'paused') setShowMenu(true) }} className="flex-1 bg-gradient-to-br from-gray-600 to-gray-700 text-white text-xl font-bold py-4 px-4 rounded-xl border-4 border-gray-500 shadow-lg hover:scale-105 transition-transform" style={{ fontFamily: 'Mountains of Christmas, cursive' }}>Cancel</button>
                <button onClick={saveSettings} className="flex-1 bg-gradient-to-br from-green-600 to-green-700 text-white text-xl font-bold py-4 px-4 rounded-xl border-4 border-yellow-400 shadow-lg hover:scale-105 transition-transform" style={{ fontFamily: 'Mountains of Christmas, cursive' }}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="relative z-10 flex flex-col h-screen p-6">
        {/* Header */}
        <header className="flex justify-between items-center mb-4">
          <div className="question-banner px-6 py-3 rounded-xl shadow-lg">
            <p className="text-yellow-300/80 text-xs uppercase tracking-wider">Game Code</p>
            <p className="text-4xl font-bold text-white tracking-[0.3em]" style={{ fontFamily: 'Cinzel Decorative, serif' }}>{game.code}</p>
          </div>

          <div className="text-center">
            <h1 className="text-5xl font-bold text-white" style={{ fontFamily: 'Mountains of Christmas, cursive', textShadow: '3px 3px 6px rgba(0,0,0,0.6), 0 0 30px rgba(255,215,0,0.2)' }}>
              🎄 Christmas Trivia 🎄
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {(game.status === 'playing' || game.status === 'paused') && (
              <button onClick={pauseGame} className="bg-gradient-to-br from-yellow-600 to-orange-600 text-white text-2xl font-bold py-3 px-6 rounded-xl border-2 border-yellow-400 shadow-lg hover:scale-105 transition-transform">⏸️</button>
            )}
            <div className="candy-cane-border shadow-lg">
              <div className="bg-gray-900 px-8 py-4 rounded-xl min-w-[160px] text-center">
                {game.status === 'playing' ? (
                  <span className={`text-6xl font-bold ${timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-white'}`} style={{ fontFamily: 'Cinzel Decorative, serif' }}>
                    {timeLeft}
                  </span>
                ) : game.status === 'paused' ? (
                  <span className="text-3xl text-yellow-400 font-bold">PAUSED</span>
                ) : game.status === 'revealing' ? (
                  <span className="text-2xl text-yellow-400">✨ Reveal</span>
                ) : game.status === 'finished' ? (
                  <span className="text-2xl text-green-400">🏆 Done!</span>
                ) : (
                  <span className="text-2xl text-yellow-400">Ready</span>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex gap-6 min-h-0">
          {/* Leaderboard */}
          <aside className="w-64 flex flex-col">
            <h2 className="text-2xl text-yellow-300 text-center font-bold mb-3 flex items-center justify-center gap-2" style={{ fontFamily: 'Mountains of Christmas, cursive' }}>
              <span>🏆</span> Leaderboard
            </h2>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {sortedTeams.map((team, index) => {
                const color = getTeamColor(teams.findIndex(t => t.id === team.id))
                const medal = index === 0 ? '👑' : index === 1 ? '🥈' : index === 2 ? '🥉' : null
                return (
                  <div key={team.id} className={`bg-gradient-to-br ${color.bg} border-2 ${color.border} rounded-xl p-3 shadow-md`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {medal && game.status !== 'waiting' && <span className="text-xl">{medal}</span>}
                        <span className="text-white font-bold truncate max-w-[110px]">{team.name}</span>
                      </div>
                      <span className="text-yellow-300 font-bold text-2xl">{team.score}</span>
                    </div>
                  </div>
                )
              })}
              {teams.length === 0 && <p className="text-gray-400 text-center py-4">No teams yet</p>}
            </div>
          </aside>

          {/* Center Content */}
          <section className="flex-1 flex flex-col min-h-0">
            {game.status === 'waiting' ? (
              <div className="flex-1 flex flex-col items-center justify-center">
                <div className="question-banner p-10 rounded-3xl text-center shadow-2xl mb-8">
                  <h2 className="text-5xl font-bold text-white mb-6" style={{ fontFamily: 'Mountains of Christmas, cursive' }}>📱 Scan to Join!</h2>
                  <div className="bg-white p-5 rounded-2xl inline-block mb-6 shadow-inner">
                    {hostUrl && <QRCodeSVG value={joinUrl} size={200} level="M" />}
                  </div>
                  <p className="text-yellow-300 text-xl mb-2">Or visit:</p>
                  <p className="text-white/90 text-lg break-all font-mono bg-black/30 px-4 py-2 rounded-lg">{joinUrl}</p>
                </div>
                <div className="flex gap-6">
                  <button onClick={() => setShowSettings(true)} className="bg-gradient-to-br from-blue-600 to-blue-700 text-white text-2xl font-bold py-5 px-10 rounded-xl border-4 border-yellow-400 shadow-lg hover:scale-105 transition-transform" style={{ fontFamily: 'Mountains of Christmas, cursive' }}>⚙️ Settings</button>
                  {teams.length > 0 && (
                    <button onClick={startGame} className="bg-gradient-to-br from-green-600 to-green-700 text-white text-2xl font-bold py-5 px-10 rounded-xl border-4 border-yellow-400 shadow-lg hover:scale-105 transition-transform animate-pulse" style={{ fontFamily: 'Mountains of Christmas, cursive' }}>🎮 Start! ({teams.length} teams)</button>
                  )}
                </div>
                {teams.length === 0 && <p className="text-yellow-300 text-xl animate-pulse mt-6">Waiting for players to join...</p>}
              </div>
            ) : game.status === 'finished' ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="question-banner p-14 rounded-3xl text-center shadow-2xl">
                  <h2 className="text-7xl font-bold text-yellow-300 mb-10" style={{ fontFamily: 'Mountains of Christmas, cursive' }}>🎉 Game Over! 🎉</h2>
                  {sortedTeams.length > 0 && (
                    <>
                      <p className="text-3xl text-white/80 mb-3">Winner</p>
                      <p className="text-6xl font-bold text-white mb-4" style={{ fontFamily: 'Mountains of Christmas, cursive' }}>👑 {sortedTeams[0].name}</p>
                      <p className="text-5xl text-yellow-300 font-bold mb-8">{sortedTeams[0].score} points</p>
                    </>
                  )}
                  <button onClick={() => router.push('/')} className="bg-gradient-to-br from-blue-600 to-blue-700 text-white text-2xl font-bold py-5 px-10 rounded-xl border-4 border-yellow-400 shadow-lg hover:scale-105 transition-transform" style={{ fontFamily: 'Mountains of Christmas, cursive' }}>🏠 New Game</button>
                </div>
              </div>
            ) : (
              <>
                <div className="text-center mb-3">
                  <span className="inline-block bg-black/40 text-yellow-300 px-6 py-2 rounded-full text-lg">
                    Question {(game.current_question ?? 0) + 1} of {Math.min(settings.totalQuestions, triviaQuestions.length)}
                  </span>
                </div>

                <div className="question-banner p-8 rounded-2xl mb-5 shadow-xl">
                  <p className="text-5xl text-white text-center font-bold leading-tight" style={{ fontFamily: 'Mountains of Christmas, cursive' }}>{currentQ.question}</p>
                </div>

                <div className="grid grid-cols-2 gap-5 flex-1">
                  {currentQ.answers.map((answer, index) => {
                    const colors = [
                      { bg: 'from-green-600 to-green-700', border: 'border-green-400', icon: '🎄' },
                      { bg: 'from-blue-600 to-blue-700', border: 'border-blue-400', icon: '❄️' },
                      { bg: 'from-red-600 to-red-700', border: 'border-red-400', icon: '🎅' },
                      { bg: 'from-yellow-500 to-orange-500', border: 'border-yellow-400', icon: '⭐' },
                    ]
                    const isCorrect = index === currentQ.correct
                    const showCorrect = game.status === 'revealing'
                    return (
                      <div key={index} className={`bg-gradient-to-br ${colors[index].bg} ${colors[index].border} border-4 rounded-2xl p-6 flex items-center justify-center shadow-lg transition-all duration-500 ${showCorrect && isCorrect ? 'ring-4 ring-white scale-105 shadow-2xl' : ''} ${showCorrect && !isCorrect ? 'opacity-40 scale-95' : ''}`}>
                        <span className="text-3xl font-bold text-white text-center leading-snug" style={{ fontFamily: 'Mountains of Christmas, cursive' }}>
                          <span className="text-yellow-200 mr-3 text-4xl">{String.fromCharCode(65 + index)}</span>
                          {answer}
                          {showCorrect && isCorrect && <span className="ml-4 text-4xl">✓</span>}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </section>

          {/* Answer Panel */}
          {game.status !== 'waiting' && game.status !== 'finished' && (
            <aside className="w-64 flex flex-col">
              <h2 className="text-2xl text-yellow-300 text-center font-bold mb-3 flex items-center justify-center gap-2" style={{ fontFamily: 'Mountains of Christmas, cursive' }}>
                <span>🔒</span> Locked In
                <span className="text-white/60 text-lg">({currentAnswers.length}/{teams.length})</span>
              </h2>
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {sortedCurrentAnswers.map((ans, idx) => {
                  const team = teams.find(t => t.id === ans.team_id)
                  if (!team) return null
                  const color = getTeamColor(teams.findIndex(t => t.id === team.id))
                  const points = revealedPoints[team.id]
                  return (
                    <div key={ans.id} className={`bg-gradient-to-br ${color.bg} border-2 ${color.border} rounded-xl p-3 shadow-md transition-all`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="bg-black/30 text-yellow-300 font-bold px-2 py-0.5 rounded text-sm">#{idx + 1}</span>
                          <span className="text-white font-bold truncate max-w-[100px]">{team.name}</span>
                        </div>
                        {game.status === 'revealing' ? (
                          <span className={`font-bold text-lg ${ans.is_correct ? 'text-green-300' : 'text-red-300'}`}>
                            {ans.is_correct ? `+${points}` : '✗'}
                          </span>
                        ) : (
                          <span className="text-white/50">🔒</span>
                        )}
                      </div>
                    </div>
                  )
                })}
                {currentAnswers.length === 0 && (
                  <div className="text-center text-gray-400 py-8">
                    <p className="text-4xl mb-2">🤔</p>
                    <p>Waiting for answers...</p>
                  </div>
                )}
                {currentAnswers.length > 0 && currentAnswers.length < teams.length && (
                  <div className="text-center text-gray-400 py-3 text-sm border-t border-white/10 mt-2">
                    ⏳ {teams.length - currentAnswers.length} still thinking...
                  </div>
                )}
              </div>
            </aside>
          )}
        </main>
      </div>
    </div>
  )
}

function ChristmasLights() {
  return (
    <div className="christmas-lights">
      <div className="light-wire" />
      {Array.from({ length: 30 }).map((_, i) => (
        <div key={i} className={`light-bulb ${['light-red', 'light-green', 'light-gold', 'light-blue', 'light-purple'][i % 5]}`} style={{ left: `${1 + i * 3.3}%`, animationDelay: `${i * 0.12}s` }} />
      ))}
    </div>
  )
}
