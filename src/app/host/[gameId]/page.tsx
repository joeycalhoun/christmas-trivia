'use client'

import { useState, useEffect, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '@/lib/supabase'
import { Game, Team, Answer, DynamicQuestion, getTeamColorByName, DEFAULT_SETTINGS } from '@/lib/types'

const POINTS_BY_ORDER = [300, 250, 200, 175, 150, 125, 100, 100, 100, 100]
const REVEAL_ANSWER_TIME = 2000 // Show correct answer for 2 seconds
const REVEAL_WINNERS_TIME = 4000 // Show winners for 4 seconds

// Winners reveal pacing (UI only)
const WINNERS_REVEAL_STEP_MS = 500
const WINNERS_TOP_BONUS_MS = 350
const WINNERS_POST_REVEAL_BUFFER_MS = 1200
const WINNERS_REVEAL_MAX_MS = 10000

type RevealPhase = 'none' | 'answer' | 'winners'

const DIFFICULTY_BADGES: Record<string, { label: string; color: string }> = {
  easy: { label: '🟢 Easy', color: 'bg-green-600' },
  medium: { label: '🟡 Medium', color: 'bg-yellow-600' },
  hard: { label: '🟠 Hard', color: 'bg-orange-600' },
  very_hard: { label: '🔴 Expert', color: 'bg-red-600' },
}

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
  const [revealPhase, setRevealPhase] = useState<RevealPhase>('none')
  const [winners, setWinners] = useState<Array<{team: Team, points: number, position: number}>>([])
  const [currentQuestion, setCurrentQuestion] = useState<DynamicQuestion | null>(null)
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false)
  const [graceTimeLeft, setGraceTimeLeft] = useState<number | null>(null)
  const [isGracePeriod, setIsGracePeriod] = useState(false)
  
  const gameRef = useRef<Game | null>(null)
  const settingsRef = useRef(DEFAULT_SETTINGS)
  const pausedTimeRef = useRef<number | null>(null)
  const hasRevealedRef = useRef(false)
  const nextQuestionRef = useRef<DynamicQuestion | null>(null)
  const isFetchingNextRef = useRef(false)

  useEffect(() => { gameRef.current = game }, [game])
  useEffect(() => { settingsRef.current = settings }, [settings])
  useEffect(() => { setHostUrl(window.location.origin) }, [])

  // Fetch a question from the API (doesn't set loading state for background fetches)
  const fetchQuestionSilent = async (questionNumber: number): Promise<DynamicQuestion | null> => {
    try {
      const response = await fetch('/api/generate-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionNumber }),
      })
      if (!response.ok) throw new Error('Failed to fetch question')
      return await response.json()
    } catch (error) {
      console.error('Error fetching question:', error)
      return null
    }
  }

  // Fetch with loading state (for initial question)
  const fetchQuestion = async (questionNumber: number): Promise<DynamicQuestion | null> => {
    setIsLoadingQuestion(true)
    const question = await fetchQuestionSilent(questionNumber)
    setIsLoadingQuestion(false)
    return question
  }

  // Pre-fetch the next question in the background
  const prefetchNextQuestion = async (currentQuestionNumber: number) => {
    const nextNum = currentQuestionNumber + 1
    if (nextNum >= settingsRef.current.totalQuestions || isFetchingNextRef.current) return
    
    isFetchingNextRef.current = true
    const question = await fetchQuestionSilent(nextNum)
    nextQuestionRef.current = question
    isFetchingNextRef.current = false
  }

  useEffect(() => {
    const loadGame = async () => {
      const { data: gameData } = await supabase.from('games').select().eq('id', gameId).single()
      if (!gameData) { router.push('/'); return }
      
      setGame(gameData)
      const loadedSettings = {
        questionTime: gameData.question_time_seconds || DEFAULT_SETTINGS.questionTime,
        totalQuestions: gameData.total_questions || DEFAULT_SETTINGS.totalQuestions,
        readAloudEnabled: gameData.read_aloud_enabled ?? DEFAULT_SETTINGS.readAloudEnabled,
        readAloudSeconds: gameData.read_aloud_seconds || DEFAULT_SETTINGS.readAloudSeconds,
      }
      setSettings(loadedSettings)
      setTimeLeft(loadedSettings.questionTime)
      
      // Load current question if game is in progress
      if (gameData.current_question_data) {
        setCurrentQuestion(gameData.current_question_data as DynamicQuestion)
        // Pre-fetch next question if game is already playing
        if (gameData.status === 'playing') {
          prefetchNextQuestion(gameData.current_question)
        }
      }
      
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

  // Auto-reveal when all teams answer
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
    
    // Phase 1: Show correct answer
    setRevealPhase('answer')
    await supabase.from('games').update({ status: 'revealing' }).eq('id', gameId)
    setGame(prev => prev ? { ...prev, status: 'revealing' } : null)
    
    // Fetch fresh data and calculate scores
    const { data: freshAnswers } = await supabase.from('answers').select()
      .eq('game_id', gameId).eq('question_index', currentGame.current_question ?? 0)
      .order('answered_at', { ascending: true })
    const { data: freshTeams } = await supabase.from('teams').select().eq('game_id', gameId)
    
    if (!freshAnswers || !freshTeams) return
    
    let correctOrderIndex = 0
    const winnersData: Array<{team: Team, points: number, position: number}> = []
    
    for (const answer of freshAnswers) {
      if (answer.is_correct) {
        const points = POINTS_BY_ORDER[correctOrderIndex] || 100
        await supabase.from('answers').update({ points_earned: points }).eq('id', answer.id)
        
        const team = freshTeams.find(t => t.id === answer.team_id)
        if (team) {
          const newScore = team.score + points
          await supabase.from('teams').update({ score: newScore }).eq('id', team.id)
          setTeams(prev => prev.map(t => t.id === team.id ? { ...t, score: newScore } : t))
          winnersData.push({ team: { ...team, score: newScore }, points, position: correctOrderIndex + 1 })
        }
        correctOrderIndex++
      }
    }
    
    // Phase 2: Show winners after delay
    setTimeout(() => {
      setWinners(winnersData)
      setRevealPhase('winners')
      
      // Phase 3: Move to next question after showing winners
      setTimeout(() => {
        nextQuestion()
      }, Math.min(
        WINNERS_REVEAL_MAX_MS,
        Math.max(
          REVEAL_WINNERS_TIME,
          Math.max(0, winnersData.length - 1) * WINNERS_REVEAL_STEP_MS +
            (winnersData.length > 0 ? WINNERS_TOP_BONUS_MS : 0) +
            WINNERS_POST_REVEAL_BUFFER_MS,
        ),
      ))
    }, REVEAL_ANSWER_TIME)
  }

  // Main answer timer - only runs when not in grace period
  useEffect(() => {
    if (game?.status !== 'playing' || isGracePeriod) return
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
  }, [game?.status, gameId, isGracePeriod])

  // When grace period ends, start the main timer
  useEffect(() => {
    if (!isGracePeriod && graceTimeLeft === null && game?.status === 'playing') {
      setTimeLeft(settingsRef.current.questionTime)
    }
  }, [isGracePeriod, graceTimeLeft, game?.status])

  const saveSettings = async () => {
    await supabase.from('games').update({ 
      question_time_seconds: settings.questionTime, 
      total_questions: settings.totalQuestions,
      read_aloud_enabled: settings.readAloudEnabled,
      read_aloud_seconds: settings.readAloudSeconds,
    }).eq('id', gameId)
    setGame(prev => prev ? { 
      ...prev, 
      question_time_seconds: settings.questionTime, 
      total_questions: settings.totalQuestions,
      read_aloud_enabled: settings.readAloudEnabled,
      read_aloud_seconds: settings.readAloudSeconds,
    } : null)
    if (pausedTimeRef.current !== null && pausedTimeRef.current > settings.questionTime) pausedTimeRef.current = settings.questionTime
    setShowSettings(false)
    if (game?.status === 'paused') setShowMenu(true)
  }

  // Grace period timer effect
  useEffect(() => {
    if (!isGracePeriod || graceTimeLeft === null || graceTimeLeft <= 0) return
    
    const timer = setInterval(() => {
      setGraceTimeLeft(prev => {
        if (prev === null || prev <= 1) {
          // Grace period ended - enable answering
          setIsGracePeriod(false)
          supabase.from('games').update({ 
            answering_enabled: true,
            question_start_time: new Date().toISOString() 
          }).eq('id', gameId)
          return null
        }
        return prev - 1
      })
    }, 1000)
    
    return () => clearInterval(timer)
  }, [isGracePeriod, graceTimeLeft, gameId])

  const startGame = async () => {
    if (teams.length < 1) return
    
    // Fetch the first question
    const question = await fetchQuestion(0)
    if (!question) {
      alert('Failed to generate question. Please try again.')
      return
    }
    
    setCurrentQuestion(question)
    hasRevealedRef.current = false
    setRevealPhase('none')
    setWinners([])
    nextQuestionRef.current = null
    
    const useGracePeriod = settings.readAloudEnabled
    
    await supabase.from('games').update({ 
      status: 'playing', 
      current_question: 0, 
      current_question_data: question,
      question_start_time: useGracePeriod ? null : new Date().toISOString(), 
      question_time_seconds: settings.questionTime, 
      total_questions: settings.totalQuestions,
      read_aloud_enabled: settings.readAloudEnabled,
      read_aloud_seconds: settings.readAloudSeconds,
      answering_enabled: !useGracePeriod,
    }).eq('id', gameId)
    
    await supabase.from('teams').update({ has_answered: false }).eq('game_id', gameId)
    setGame(prev => prev ? { ...prev, status: 'playing', current_question: 0, question_time_seconds: settings.questionTime, total_questions: settings.totalQuestions, read_aloud_enabled: settings.readAloudEnabled, read_aloud_seconds: settings.readAloudSeconds, answering_enabled: !useGracePeriod } : null)
    
    if (useGracePeriod) {
      setIsGracePeriod(true)
      setGraceTimeLeft(settings.readAloudSeconds)
    } else {
      setTimeLeft(settings.questionTime)
    }
    
    // Pre-fetch the next question in background
    prefetchNextQuestion(0)
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
    setRevealPhase('none')
    setWinners([])
    setIsGracePeriod(false)
    setGraceTimeLeft(null)
    
    const nextQ = (currentGame?.current_question ?? 0) + 1
    if (nextQ >= currentSettings.totalQuestions) {
      await supabase.from('games').update({ status: 'finished' }).eq('id', gameId)
      setGame(prev => prev ? { ...prev, status: 'finished' } : null)
      return
    }
    
    // Use pre-fetched question if available, otherwise fetch now
    let question = nextQuestionRef.current
    if (!question) {
      setIsLoadingQuestion(true)
      question = await fetchQuestionSilent(nextQ)
      setIsLoadingQuestion(false)
    }
    
    if (!question) {
      console.error('Failed to fetch next question')
      await supabase.from('games').update({ status: 'finished' }).eq('id', gameId)
      setGame(prev => prev ? { ...prev, status: 'finished' } : null)
      return
    }
    
    // Clear the pre-fetched question
    nextQuestionRef.current = null
    setCurrentQuestion(question)
    
    const useGracePeriod = currentSettings.readAloudEnabled
    
    await supabase.from('teams').update({ has_answered: false }).eq('game_id', gameId)
    setTeams(prev => prev.map(t => ({ ...t, has_answered: false })))
    await supabase.from('games').update({ 
      status: 'playing', 
      current_question: nextQ, 
      current_question_data: question,
      question_start_time: useGracePeriod ? null : new Date().toISOString(), 
      question_time_seconds: currentSettings.questionTime,
      answering_enabled: !useGracePeriod,
    }).eq('id', gameId)
    setGame(prev => prev ? { ...prev, status: 'playing', current_question: nextQ, question_time_seconds: currentSettings.questionTime, answering_enabled: !useGracePeriod } : null)
    
    if (useGracePeriod) {
      setIsGracePeriod(true)
      setGraceTimeLeft(currentSettings.readAloudSeconds)
    } else {
      setTimeLeft(currentSettings.questionTime)
    }
    
    // Pre-fetch the next question in background
    prefetchNextQuestion(nextQ)
  }

  const currentAnswers = answers.filter(a => a.question_index === game?.current_question)
  const joinUrl = `${hostUrl}/play/${gameId}`
  const sortedTeams = [...teams].sort((a, b) => b.score - a.score)
  const sortedCurrentAnswers = [...currentAnswers].sort((a, b) => new Date(a.answered_at).getTime() - new Date(b.answered_at).getTime())
  const difficultyBadge = currentQuestion?.difficulty ? DIFFICULTY_BADGES[currentQuestion.difficulty] : null

  if (!game) {
    return (
      <div className="min-h-[100dvh] wood-background flex items-center justify-center">
        <div className="festive-surface rounded-2xl px-8 py-6">
          <div className="text-white text-2xl festive-title">Loading…</div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[100dvh] wood-background relative overflow-hidden">
      <div className="absolute top-16 left-8 text-6xl opacity-20 animate-pulse">🎄</div>
      <div className="absolute top-16 right-8 text-6xl opacity-20 animate-pulse" style={{animationDelay: '1s'}}>🎄</div>
      <div className="absolute bottom-8 left-12 text-5xl opacity-15">🎁</div>
      <div className="absolute bottom-8 right-12 text-5xl opacity-15">🎁</div>
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/25 to-black/40" />
      
      <ChristmasLights />

      {/* Loading Question Overlay */}
      {isLoadingQuestion && (
        <div className="absolute inset-0 bg-black/70 z-50 flex items-center justify-center backdrop-blur-sm">
          <div className="question-banner p-10 rounded-3xl text-center shadow-2xl">
            <div className="text-6xl mb-4 animate-bounce">🎄</div>
            <h2 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'Mountains of Christmas, cursive' }}>
              Loading Next Question...
            </h2>
            <p className="text-yellow-300">Get ready!</p>
          </div>
        </div>
      )}

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
            <div className="space-y-6">
              <div>
                <label className="text-yellow-300 text-lg mb-3 block">Time per Question: <span className="text-white font-bold text-2xl">{settings.questionTime}s</span></label>
                <input type="range" min="10" max="60" step="5" value={settings.questionTime} onChange={(e) => setSettings(s => ({ ...s, questionTime: parseInt(e.target.value) }))} className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-400" />
              </div>
              <div>
                <label className="text-yellow-300 text-lg mb-3 block">Questions: <span className="text-white font-bold text-2xl">{settings.totalQuestions}</span></label>
                <input type="range" min="5" max="50" step="1" value={settings.totalQuestions} onChange={(e) => setSettings(s => ({ ...s, totalQuestions: parseInt(e.target.value) }))} className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-400" />
              </div>
              <div className="border-t border-yellow-400/30 pt-6">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-yellow-300 text-lg">📖 Read Aloud Mode</label>
                  <button 
                    onClick={() => setSettings(s => ({ ...s, readAloudEnabled: !s.readAloudEnabled }))}
                    className={`w-14 h-8 rounded-full transition-colors ${settings.readAloudEnabled ? 'bg-green-500' : 'bg-gray-600'} relative`}
                  >
                    <span className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-transform ${settings.readAloudEnabled ? 'translate-x-7' : 'translate-x-1'}`} />
                  </button>
                </div>
                {settings.readAloudEnabled && (
                  <div className="mt-4">
                    <label className="text-yellow-300/80 text-sm mb-2 block">Grace Period: <span className="text-white font-bold">{settings.readAloudSeconds}s</span></label>
                    <input type="range" min="3" max="15" step="1" value={settings.readAloudSeconds} onChange={(e) => setSettings(s => ({ ...s, readAloudSeconds: parseInt(e.target.value) }))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-400" />
                  </div>
                )}
                <p className="text-gray-400 text-xs mt-2">Adds time before answers are accepted so you can read the question aloud.</p>
              </div>
              <div className="bg-black/40 p-4 rounded-xl border border-yellow-400/30">
                <p className="text-yellow-300 text-sm font-bold">🏆 Points: 1st: 300 • 2nd: 250 • 3rd: 200...</p>
              </div>
              <div className="flex gap-4">
                <button onClick={() => { setShowSettings(false); if (game?.status === 'paused') setShowMenu(true) }} className="flex-1 bg-gradient-to-br from-gray-600 to-gray-700 text-white text-xl font-bold py-4 rounded-xl border-4 border-gray-500 hover:scale-105 transition-transform" style={{ fontFamily: 'Mountains of Christmas, cursive' }}>Cancel</button>
                <button onClick={saveSettings} className="flex-1 bg-gradient-to-br from-green-600 to-green-700 text-white text-xl font-bold py-4 rounded-xl border-4 border-yellow-400 hover:scale-105 transition-transform" style={{ fontFamily: 'Mountains of Christmas, cursive' }}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="relative z-10 flex flex-col h-full p-4 lg:p-6 xl:p-8 safe-area-inset overflow-hidden">
        <div className="w-full max-w-[1680px] mx-auto flex flex-col h-full overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between gap-4 mb-4 lg:mb-6">
          {/* Only show game code on waiting screen or first question */}
          {(game.status === 'waiting' || (game.current_question ?? 0) === 0) ? (
            <div className="question-banner px-5 py-3 rounded-xl shadow-lg">
              <p className="text-yellow-300/80 text-xs uppercase tracking-wider">Game Code</p>
              <p className="text-4xl font-bold text-white tracking-[0.3em]" style={{ fontFamily: 'Cinzel Decorative, serif' }}>{game.code}</p>
            </div>
          ) : (
            <div className="hidden lg:block w-48" /> /* Spacer to maintain layout */
          )}
          <h1 className="text-center text-4xl lg:text-5xl xl:text-6xl font-bold text-white festive-title">
            🎄 Christmas Trivia 🎄
          </h1>
          <div className="flex items-center gap-4">
            {(game.status === 'playing' || game.status === 'paused') && (
              <button
                onClick={pauseGame}
                className="btn-festive bg-gradient-to-br from-yellow-600 to-orange-600 text-white text-2xl font-bold py-3 px-6 rounded-xl border-2 border-yellow-400 shadow-lg hover:scale-105 transition-transform"
              >
                ⏸️
              </button>
            )}
            <div className="candy-cane-border shadow-lg">
              <div className="bg-gray-900 px-8 py-4 rounded-xl min-w-[140px] text-center">
                {game.status === 'playing' && isGracePeriod && graceTimeLeft !== null ? (
                  <div className="flex flex-col items-center">
                    <span className="text-lg text-yellow-300 font-bold">📖 READ</span>
                    <span className="text-5xl font-bold text-yellow-400" style={{ fontFamily: 'Cinzel Decorative, serif' }}>{graceTimeLeft}</span>
                  </div>
                ) : game.status === 'playing' ? (
                  <span className={`text-6xl font-bold ${timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-white'}`} style={{ fontFamily: 'Cinzel Decorative, serif' }}>{timeLeft}</span>
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

        {/* Main Content */}
        <main className="flex-1 grid grid-cols-1 lg:grid-cols-[320px,1fr,320px] xl:grid-cols-[360px,1fr,360px] gap-4 lg:gap-6 min-h-0 overflow-visible">
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
                <div className="question-banner p-8 lg:p-10 rounded-3xl text-center shadow-2xl mb-8 w-full max-w-3xl">
                  <h2 className="text-5xl lg:text-6xl font-bold text-white mb-6 festive-title">📱 Scan to Join!</h2>
                  <div className="bg-white p-5 rounded-2xl inline-block mb-6 shadow-inner">
                    {hostUrl && <QRCodeSVG value={joinUrl} size={200} level="M" />}
                  </div>
                  <p className="text-yellow-300 text-xl mb-2">Or visit:</p>
                  <p className="text-white/90 text-lg break-all font-mono bg-black/30 px-4 py-2 rounded-lg">{joinUrl}</p>
                </div>
                <div className="flex gap-6">
                  <button
                    onClick={() => setShowSettings(true)}
                    className="btn-festive bg-gradient-to-br from-blue-600 to-blue-700 text-white text-2xl font-bold py-5 px-10 rounded-xl border-4 border-yellow-400 shadow-lg hover:scale-105 transition-transform festive-title"
                  >
                    ⚙️ Settings
                  </button>
                  {teams.length > 0 && (
                    <button
                      onClick={startGame}
                      disabled={isLoadingQuestion}
                      className="btn-festive bg-gradient-to-br from-green-600 to-green-700 text-white text-2xl font-bold py-5 px-10 rounded-xl border-4 border-yellow-400 shadow-lg hover:scale-105 transition-transform animate-pulse festive-title disabled:opacity-50"
                    >
                      🎮 Start! ({teams.length} teams)
                    </button>
                  )}
                </div>
                {teams.length === 0 && <p className="text-yellow-300 text-xl animate-pulse mt-6">Waiting for players...</p>}
              </div>
            ) : game.status === 'finished' ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="question-banner p-14 rounded-3xl text-center shadow-2xl">
                  <h2 className="text-6xl lg:text-7xl font-bold text-yellow-300 mb-10 festive-title">🎉 Game Over! 🎉</h2>
                  {sortedTeams.length > 0 && (
                    <>
                      <p className="text-3xl text-white/80 mb-3">Winner</p>
                      <p className="text-5xl lg:text-6xl font-bold text-white mb-4 festive-title">👑 {sortedTeams[0].name}</p>
                      <p className="text-5xl text-yellow-300 font-bold mb-8">{sortedTeams[0].score} points</p>
                    </>
                  )}
                  <button onClick={() => router.push('/')} className="bg-gradient-to-br from-blue-600 to-blue-700 text-white text-2xl font-bold py-5 px-10 rounded-xl border-4 border-yellow-400 shadow-lg hover:scale-105 transition-transform" style={{ fontFamily: 'Mountains of Christmas, cursive' }}>🏠 New Game</button>
                </div>
              </div>
            ) : revealPhase === 'winners' ? (
              /* Winners Reveal Screen */
              <div className="flex-1 flex items-center justify-center animate-fadeIn">
                <div className="text-center w-full max-w-2xl">
                  <h2 className="text-5xl font-bold text-yellow-300 mb-8" style={{ fontFamily: 'Mountains of Christmas, cursive' }}>
                    {winners.length > 0 ? '🎉 Correct Answers! 🎉' : '😅 No Correct Answers'}
                  </h2>
                  {winners.length > 0 ? (
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
                            className={`bg-gradient-to-br ${color.bg} ${isTop ? 'border-4' : 'border-4'} ${color.border} rounded-2xl shadow-xl animate-slideUp transition-transform ${isTop ? 'p-7 ring-4 ring-yellow-300/80 scale-[1.06] shadow-2xl shadow-yellow-300/20' : 'p-5'}`}
                            style={{ animationDelay: `${delayMs}ms` }}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <span className={`${isTop ? 'text-5xl' : 'text-4xl'}`}>
                                  {w.position === 1 ? '🥇' : w.position === 2 ? '🥈' : w.position === 3 ? '🥉' : `#${w.position}`}
                                </span>
                                <span className={`${isTop ? 'text-5xl' : 'text-3xl'} text-white font-bold`} style={{ fontFamily: 'Mountains of Christmas, cursive' }}>
                                  {w.team.name}
                                </span>
                              </div>
                              <span className={`${isTop ? 'text-5xl' : 'text-3xl'} text-green-300 font-bold`}>+{w.points}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-6xl mb-4">🤷</div>
                  )}
                  <p className="text-white/60 text-lg mt-8">Next question coming up...</p>
                </div>
              </div>
            ) : currentQuestion ? (
              /* Question/Answer Phase */
              <div className={`flex-1 flex flex-col min-h-0 transition-opacity duration-500 ${revealPhase === 'answer' ? '' : ''}`}>
                <div className="text-center mb-3 flex items-center justify-center gap-4">
                  <span className="inline-block bg-black/40 text-yellow-300 px-6 py-2 rounded-full text-lg">
                    Question {(game.current_question ?? 0) + 1} of {settings.totalQuestions}
                  </span>
                  {difficultyBadge && (
                    <span className={`inline-block ${difficultyBadge.color} text-white px-4 py-2 rounded-full text-sm font-bold`}>
                      {difficultyBadge.label}
                    </span>
                  )}
                </div>

                <div className="question-banner p-6 lg:p-8 rounded-2xl mb-5 shadow-xl">
                  <p className="text-4xl lg:text-5xl xl:text-6xl text-white text-center font-bold leading-tight festive-title">
                    {currentQuestion.question}
                  </p>
                </div>

                {/* Answer grid with padding to allow for scale effect */}
                <div className="flex-1 min-h-0 p-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 grid-rows-4 sm:grid-rows-2 gap-4 lg:gap-5 h-full">
                    {currentQuestion.answers.map((answer, index) => {
                      const colors = [
                        { bg: 'from-green-600 to-green-700', border: 'border-green-400' },
                        { bg: 'from-blue-600 to-blue-700', border: 'border-blue-400' },
                        { bg: 'from-red-600 to-red-700', border: 'border-red-400' },
                        { bg: 'from-yellow-500 to-orange-500', border: 'border-yellow-400' },
                      ]
                      const isCorrect = index === currentQuestion.correct
                      const showCorrect = revealPhase === 'answer'
                      return (
                        <div
                          key={index}
                          className={`bg-gradient-to-br ${colors[index].bg} ${colors[index].border} border-4 rounded-2xl p-4 lg:p-6 flex items-center justify-center shadow-lg transition-all duration-700 ${showCorrect && isCorrect ? 'ring-8 ring-green-400 scale-105 shadow-2xl shadow-green-500/50 z-10' : ''} ${showCorrect && !isCorrect ? 'opacity-30 scale-95' : ''}`}
                        >
                          <span className="text-2xl lg:text-3xl xl:text-4xl font-bold text-white text-center leading-snug festive-title">
                            <span className="text-yellow-200 mr-3 text-3xl lg:text-4xl xl:text-5xl">{String.fromCharCode(65 + index)}</span>
                            {answer}
                            {showCorrect && isCorrect && <span className="ml-4 text-4xl">✓</span>}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            ) : null}
          </section>

          {/* Answer Panel - Only show during playing, not during reveal */}
          {game.status === 'playing' && revealPhase === 'none' && (
            <aside className="hidden lg:flex flex-col min-h-0">
              <div className="festive-surface rounded-2xl p-4">
                <h2 className="text-3xl text-yellow-300 text-center font-bold festive-title">
                  🔒 Locked In <span className="text-white/60 text-xl">({currentAnswers.length}/{teams.length})</span>
                </h2>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 mt-3">
                {sortedCurrentAnswers.map((ans, idx) => {
                  const team = teams.find(t => t.id === ans.team_id)
                  if (!team) return null
                  const color = getTeamColorByName(team.color)
                  return (
                    <div key={ans.id} className={`bg-gradient-to-br ${color.bg} border-2 ${color.border} rounded-xl p-3 shadow-md`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="bg-black/30 text-yellow-300 font-bold px-2 py-0.5 rounded text-sm">#{idx + 1}</span>
                          <span className="text-white font-bold truncate max-w-[100px]">{team.name}</span>
                        </div>
                        <span className="text-white/50">🔒</span>
                      </div>
                    </div>
                  )
                })}
                {currentAnswers.length === 0 && (
                  <div className="text-center text-gray-400 py-8">
                    <p className="text-4xl mb-2">🤔</p>
                    <p>Waiting...</p>
                  </div>
                )}
                {currentAnswers.length > 0 && currentAnswers.length < teams.length && (
                  <div className="text-center text-gray-400 py-3 text-sm border-t border-white/10 mt-2">
                    ⏳ {teams.length - currentAnswers.length} thinking...
                  </div>
                )}
              </div>
            </aside>
          )}
          
          {/* Placeholder for reveal phases to maintain layout */}
          {(game.status === 'revealing' || revealPhase !== 'none') && game.status !== 'waiting' && game.status !== 'finished' && (
            <aside className="hidden lg:block" />
          )}
        </main>
        </div>
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
