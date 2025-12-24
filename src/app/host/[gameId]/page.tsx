'use client'

import { useState, useEffect, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '@/lib/supabase'
import { triviaQuestions } from '@/lib/questions'
import { Game, Team, Answer, getTeamColor, DEFAULT_SETTINGS, REVEAL_TIME_SECONDS } from '@/lib/types'

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
  
  // Use refs to avoid stale closures in callbacks
  const gameRef = useRef<Game | null>(null)
  const teamsRef = useRef<Team[]>([])
  const answersRef = useRef<Answer[]>([])
  const settingsRef = useRef(DEFAULT_SETTINGS)
  const pausedTimeRef = useRef<number | null>(null)

  // Keep refs in sync
  useEffect(() => { gameRef.current = game }, [game])
  useEffect(() => { teamsRef.current = teams }, [teams])
  useEffect(() => { answersRef.current = answers }, [answers])
  useEffect(() => { settingsRef.current = settings }, [settings])

  useEffect(() => {
    setHostUrl(window.location.origin)
  }, [])

  // Load initial game data
  useEffect(() => {
    const loadGame = async () => {
      const { data: gameData } = await supabase
        .from('games')
        .select()
        .eq('id', gameId)
        .single()
      
      if (!gameData) {
        router.push('/')
        return
      }
      
      setGame(gameData)
      const loadedSettings = {
        questionTime: gameData.question_time_seconds || DEFAULT_SETTINGS.questionTime,
        totalQuestions: gameData.total_questions || DEFAULT_SETTINGS.totalQuestions,
      }
      setSettings(loadedSettings)
      setTimeLeft(loadedSettings.questionTime)
      
      const { data: teamsData } = await supabase
        .from('teams')
        .select()
        .eq('game_id', gameId)
        .order('created_at')
      
      setTeams(teamsData || [])
      
      const { data: answersData } = await supabase
        .from('answers')
        .select()
        .eq('game_id', gameId)
      
      setAnswers(answersData || [])
    }
    
    loadGame()
  }, [gameId, router])

  // Subscribe to real-time updates
  useEffect(() => {
    const channel = supabase
      .channel(`game-${gameId}`)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'teams', filter: `game_id=eq.${gameId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setTeams(prev => [...prev, payload.new as Team])
          } else if (payload.eventType === 'UPDATE') {
            setTeams(prev => prev.map(t => t.id === payload.new.id ? payload.new as Team : t))
          }
        }
      )
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'answers', filter: `game_id=eq.${gameId}` },
        (payload) => {
          setAnswers(prev => [...prev, payload.new as Answer])
        }
      )
      .subscribe()
    
    return () => {
      supabase.removeChannel(channel)
    }
  }, [gameId])

  // Handle revealing answers and scoring - fetches fresh data to avoid stale closures
  const handleReveal = async () => {
    const currentGame = gameRef.current
    if (!currentGame) return
    
    const currentQuestion = currentGame.current_question ?? 0
    
    // Fetch fresh answers from database to ensure we have all of them
    const { data: freshAnswers } = await supabase
      .from('answers')
      .select()
      .eq('game_id', gameId)
      .eq('question_index', currentQuestion)
      .order('answered_at', { ascending: true })
    
    if (!freshAnswers) return
    
    // Fetch fresh teams
    const { data: freshTeams } = await supabase
      .from('teams')
      .select()
      .eq('game_id', gameId)
    
    if (!freshTeams) return
    
    const correctAnswers = freshAnswers.filter(a => a.is_correct)
    
    console.log(`Revealing Q${currentQuestion}: ${freshAnswers.length} answers, ${correctAnswers.length} correct`)
    
    // Award points based on order of correct answers
    for (let i = 0; i < correctAnswers.length; i++) {
      const basePoints = 100
      const speedBonus = Math.max(0, (correctAnswers.length - i) * 25)
      const points = basePoints + speedBonus
      
      // Update answer with points
      await supabase
        .from('answers')
        .update({ points_earned: points })
        .eq('id', correctAnswers[i].id)
      
      // Find team and update score
      const team = freshTeams.find(t => t.id === correctAnswers[i].team_id)
      if (team) {
        const newScore = team.score + points
        console.log(`Awarding ${points} points to ${team.name}, new score: ${newScore}`)
        
        await supabase
          .from('teams')
          .update({ score: newScore })
          .eq('id', team.id)
        
        // Update local state
        setTeams(prev => prev.map(t => 
          t.id === team.id ? { ...t, score: newScore } : t
        ))
      }
    }
    
    // Update local answers state
    setAnswers(prev => prev.map(a => {
      const updated = freshAnswers.find(fa => fa.id === a.id)
      return updated ? { ...a, points_earned: updated.points_earned } : a
    }))
    
    // Update game status to revealing
    await supabase
      .from('games')
      .update({ status: 'revealing' })
      .eq('id', gameId)
    
    setGame(prev => prev ? { ...prev, status: 'revealing' } : null)
    
    // Auto-advance after reveal time
    setTimeout(() => {
      nextQuestion()
    }, REVEAL_TIME_SECONDS * 1000)
  }

  // Timer logic - uses ref for settings to get current value
  useEffect(() => {
    if (game?.status !== 'playing') return
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleReveal()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    
    return () => clearInterval(timer)
  }, [game?.status, gameId])

  const saveSettings = async () => {
    // Save to database
    await supabase
      .from('games')
      .update({
        question_time_seconds: settings.questionTime,
        total_questions: settings.totalQuestions,
      })
      .eq('id', gameId)
    
    // Update local game state
    setGame(prev => prev ? {
      ...prev,
      question_time_seconds: settings.questionTime,
      total_questions: settings.totalQuestions,
    } : null)
    
    // If paused and we have remaining time greater than new setting, cap it
    if (pausedTimeRef.current !== null && pausedTimeRef.current > settings.questionTime) {
      pausedTimeRef.current = settings.questionTime
    }
    
    setShowSettings(false)
    if (game?.status === 'paused') {
      setShowMenu(true)
    }
  }

  const startGame = async () => {
    if (teams.length < 1) return
    
    await supabase
      .from('games')
      .update({ 
        status: 'playing', 
        current_question: 0,
        question_start_time: new Date().toISOString(),
        question_time_seconds: settings.questionTime,
        total_questions: settings.totalQuestions,
      })
      .eq('id', gameId)
    
    await supabase
      .from('teams')
      .update({ has_answered: false })
      .eq('game_id', gameId)
    
    setGame(prev => prev ? { 
      ...prev, 
      status: 'playing', 
      current_question: 0,
      question_time_seconds: settings.questionTime,
      total_questions: settings.totalQuestions,
    } : null)
    setTimeLeft(settings.questionTime)
  }

  const pauseGame = async () => {
    pausedTimeRef.current = timeLeft
    
    await supabase
      .from('games')
      .update({ status: 'paused' })
      .eq('id', gameId)
    
    setGame(prev => prev ? { ...prev, status: 'paused' } : null)
    setShowMenu(true)
  }

  const resumeGame = async () => {
    // Use paused time, but cap at current settings
    const resumeTime = Math.min(
      pausedTimeRef.current ?? settings.questionTime, 
      settings.questionTime
    )
    
    await supabase
      .from('games')
      .update({ 
        status: 'playing',
        question_start_time: new Date().toISOString(),
        question_time_seconds: settings.questionTime,
      })
      .eq('id', gameId)
    
    setGame(prev => prev ? { 
      ...prev, 
      status: 'playing',
      question_time_seconds: settings.questionTime,
    } : null)
    
    setTimeLeft(resumeTime)
    pausedTimeRef.current = null
    setShowMenu(false)
  }

  const endGame = async () => {
    await supabase
      .from('games')
      .update({ status: 'finished' })
      .eq('id', gameId)
    
    setGame(prev => prev ? { ...prev, status: 'finished' } : null)
    setShowMenu(false)
  }

  const nextQuestion = async () => {
    const currentSettings = settingsRef.current
    const currentGame = gameRef.current
    const totalQ = currentSettings.totalQuestions
    const nextQ = (currentGame?.current_question ?? 0) + 1
    
    if (nextQ >= Math.min(totalQ, triviaQuestions.length)) {
      await supabase
        .from('games')
        .update({ status: 'finished' })
        .eq('id', gameId)
      
      setGame(prev => prev ? { ...prev, status: 'finished' } : null)
      return
    }
    
    await supabase
      .from('teams')
      .update({ has_answered: false })
      .eq('game_id', gameId)
    
    setTeams(prev => prev.map(t => ({ ...t, has_answered: false })))
    
    await supabase
      .from('games')
      .update({ 
        status: 'playing', 
        current_question: nextQ,
        question_start_time: new Date().toISOString(),
        question_time_seconds: currentSettings.questionTime,
      })
      .eq('id', gameId)
    
    setGame(prev => prev ? { 
      ...prev, 
      status: 'playing', 
      current_question: nextQ,
      question_time_seconds: currentSettings.questionTime,
    } : null)
    
    // Use current settings for new question timer
    setTimeLeft(currentSettings.questionTime)
  }

  const currentQ = triviaQuestions[game?.current_question ?? 0]
  const currentAnswers = answers.filter(a => a.question_index === game?.current_question)
  const joinUrl = `${hostUrl}/play/${gameId}`
  const sortedTeams = [...teams].sort((a, b) => b.score - a.score)
  const totalQuestions = settings.totalQuestions

  if (!game) {
    return (
      <div className="min-h-screen wood-background flex items-center justify-center">
        <div className="text-white text-2xl">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen wood-background relative overflow-hidden">
      <ChristmasLights />

      {/* Pause/Menu Overlay */}
      {showMenu && (
        <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center">
          <div className="question-banner p-8 rounded-2xl max-w-md w-full mx-4">
            <h2 
              className="text-4xl font-bold text-white text-center mb-6"
              style={{ fontFamily: 'Mountains of Christmas, cursive' }}
            >
              ⏸️ Game Paused
            </h2>
            
            <div className="space-y-4">
              <button
                onClick={resumeGame}
                className="w-full bg-gradient-to-br from-green-600 to-green-700 text-white text-2xl font-bold 
                  py-4 px-6 rounded-xl border-4 border-yellow-400 shadow-lg 
                  hover:scale-105 transition-transform"
                style={{ fontFamily: 'Mountains of Christmas, cursive' }}
              >
                ▶️ Resume Game
              </button>
              
              <button
                onClick={() => { setShowSettings(true); setShowMenu(false); }}
                className="w-full bg-gradient-to-br from-blue-600 to-blue-700 text-white text-2xl font-bold 
                  py-4 px-6 rounded-xl border-4 border-yellow-400 shadow-lg 
                  hover:scale-105 transition-transform"
                style={{ fontFamily: 'Mountains of Christmas, cursive' }}
              >
                ⚙️ Settings
              </button>
              
              <button
                onClick={endGame}
                className="w-full bg-gradient-to-br from-red-600 to-red-700 text-white text-2xl font-bold 
                  py-4 px-6 rounded-xl border-4 border-yellow-400 shadow-lg 
                  hover:scale-105 transition-transform"
                style={{ fontFamily: 'Mountains of Christmas, cursive' }}
              >
                🛑 End Game
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Overlay */}
      {showSettings && (
        <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center">
          <div className="question-banner p-8 rounded-2xl max-w-md w-full mx-4">
            <h2 
              className="text-4xl font-bold text-white text-center mb-6"
              style={{ fontFamily: 'Mountains of Christmas, cursive' }}
            >
              ⚙️ Game Settings
            </h2>
            
            <div className="space-y-6">
              <div>
                <label className="text-yellow-300 text-lg mb-2 block">
                  Time per Question: <span className="text-white font-bold">{settings.questionTime}s</span>
                </label>
                <input
                  type="range"
                  min="10"
                  max="60"
                  step="5"
                  value={settings.questionTime}
                  onChange={(e) => setSettings(s => ({ ...s, questionTime: parseInt(e.target.value) }))}
                  className="w-full h-4 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-400"
                />
                <div className="flex justify-between text-gray-400 text-sm mt-1">
                  <span>10s</span>
                  <span>60s</span>
                </div>
              </div>
              
              <div>
                <label className="text-yellow-300 text-lg mb-2 block">
                  Number of Questions: <span className="text-white font-bold">{settings.totalQuestions}</span>
                </label>
                <input
                  type="range"
                  min="5"
                  max={triviaQuestions.length}
                  step="1"
                  value={settings.totalQuestions}
                  onChange={(e) => setSettings(s => ({ ...s, totalQuestions: parseInt(e.target.value) }))}
                  className="w-full h-4 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-400"
                />
                <div className="flex justify-between text-gray-400 text-sm mt-1">
                  <span>5</span>
                  <span>{triviaQuestions.length}</span>
                </div>
              </div>
              
              <p className="text-gray-300 text-sm text-center">
                ⚠️ New time will apply to the next question
              </p>
              
              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => {
                    setShowSettings(false)
                    if (game?.status === 'paused') setShowMenu(true)
                  }}
                  className="flex-1 bg-gradient-to-br from-gray-600 to-gray-700 text-white text-xl font-bold 
                    py-3 px-4 rounded-xl border-4 border-gray-400 shadow-lg 
                    hover:scale-105 transition-transform"
                  style={{ fontFamily: 'Mountains of Christmas, cursive' }}
                >
                  Cancel
                </button>
                <button
                  onClick={saveSettings}
                  className="flex-1 bg-gradient-to-br from-green-600 to-green-700 text-white text-xl font-bold 
                    py-3 px-4 rounded-xl border-4 border-yellow-400 shadow-lg 
                    hover:scale-105 transition-transform"
                  style={{ fontFamily: 'Mountains of Christmas, cursive' }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="relative z-10 flex flex-col h-screen p-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-2">
          {/* Game Code */}
          <div className="question-banner px-5 py-2 rounded-xl">
            <p className="text-yellow-300 text-xs">Game Code</p>
            <p 
              className="text-3xl font-bold text-white tracking-widest"
              style={{ fontFamily: 'Cinzel Decorative, serif' }}
            >
              {game.code}
            </p>
          </div>

          {/* Title */}
          <h1 
            className="text-4xl font-bold text-white"
            style={{ fontFamily: 'Mountains of Christmas, cursive', textShadow: '3px 3px 6px rgba(0,0,0,0.5)' }}
          >
            🎄 Christmas Trivia 🎄
          </h1>

          {/* Timer + Pause Button */}
          <div className="flex items-center gap-3">
            {(game.status === 'playing' || game.status === 'paused') && (
              <button
                onClick={pauseGame}
                className="bg-gradient-to-br from-yellow-600 to-yellow-700 text-white text-2xl font-bold 
                  py-2 px-5 rounded-xl border-2 border-yellow-400 shadow-lg 
                  hover:scale-105 transition-transform"
              >
                ⏸️
              </button>
            )}
            <div className="candy-cane-border">
              <div className="bg-gray-900 px-6 py-3 rounded-xl">
                {game.status === 'playing' ? (
                  <span 
                    className={`text-5xl font-bold ${timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-white'}`}
                    style={{ fontFamily: 'Cinzel Decorative, serif' }}
                  >
                    {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}
                  </span>
                ) : game.status === 'paused' ? (
                  <span className="text-3xl text-yellow-400">⏸️ PAUSED</span>
                ) : game.status === 'revealing' ? (
                  <span className="text-2xl text-yellow-400">Revealing...</span>
                ) : game.status === 'finished' ? (
                  <span className="text-2xl text-green-400">🏆 Finished!</span>
                ) : (
                  <span className="text-2xl text-yellow-400">Ready</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex gap-4 min-h-0">
          {/* Left Side - Teams */}
          <div className="w-56 flex flex-col gap-2 overflow-y-auto">
            <h2 className="text-xl text-yellow-300 text-center font-bold" style={{ fontFamily: 'Mountains of Christmas, cursive' }}>
              Teams ({teams.length})
            </h2>
            {sortedTeams.map((team, index) => {
              const color = getTeamColor(teams.findIndex(t => t.id === team.id))
              const hasAnswered = currentAnswers.some(a => a.team_id === team.id)
              const teamAnswer = currentAnswers.find(a => a.team_id === team.id)
              
              return (
                <div
                  key={team.id}
                  className={`bg-gradient-to-br ${color.bg} border-3 ${color.border} rounded-xl p-3
                    transition-all duration-300 ${hasAnswered ? 'ring-2 ring-white scale-102' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {index === 0 && game.status !== 'waiting' && <span className="text-lg">👑</span>}
                      <span className="text-white font-bold truncate max-w-[100px]">{team.name}</span>
                    </div>
                    <span className="text-yellow-300 font-bold text-xl">{team.score}</span>
                  </div>
                  {game.status === 'revealing' && teamAnswer && (
                    <div className="text-sm mt-1">
                      {teamAnswer.is_correct ? (
                        <span className="text-green-300">✓ +{teamAnswer.points_earned || '?'}</span>
                      ) : (
                        <span className="text-red-300">✗</span>
                      )}
                    </div>
                  )}
                  {game.status === 'playing' && hasAnswered && (
                    <div className="text-sm text-white/80 mt-1">✓ Answered</div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Center - Question/QR Code */}
          <div className="flex-1 flex flex-col min-h-0">
            {game.status === 'waiting' ? (
              <div className="flex-1 flex flex-col items-center justify-center">
                <div className="question-banner p-8 rounded-2xl text-center mb-6">
                  <h2 
                    className="text-4xl font-bold text-white mb-4"
                    style={{ fontFamily: 'Mountains of Christmas, cursive' }}
                  >
                    Scan to Join! 📱
                  </h2>
                  <div className="bg-white p-4 rounded-xl inline-block mb-4">
                    {hostUrl && <QRCodeSVG value={joinUrl} size={180} level="M" />}
                  </div>
                  <p className="text-yellow-300 text-xl mb-1">Or go to:</p>
                  <p className="text-white break-all">{joinUrl}</p>
                </div>
                
                <div className="flex gap-4">
                  <button
                    onClick={() => setShowSettings(true)}
                    className="bg-gradient-to-br from-blue-600 to-blue-700 text-white text-2xl font-bold 
                      py-4 px-8 rounded-xl border-4 border-yellow-400 shadow-lg 
                      hover:scale-105 transition-transform"
                    style={{ fontFamily: 'Mountains of Christmas, cursive' }}
                  >
                    ⚙️ Settings
                  </button>
                  
                  {teams.length > 0 && (
                    <button
                      onClick={startGame}
                      className="bg-gradient-to-br from-green-600 to-green-700 text-white text-2xl font-bold 
                        py-4 px-8 rounded-xl border-4 border-yellow-400 shadow-lg 
                        hover:scale-105 transition-transform"
                      style={{ fontFamily: 'Mountains of Christmas, cursive' }}
                    >
                      🎮 Start Game! ({teams.length} teams)
                    </button>
                  )}
                </div>
                
                {teams.length === 0 && (
                  <p className="text-yellow-300 text-xl animate-pulse mt-4">
                    Waiting for players to join...
                  </p>
                )}
              </div>
            ) : game.status === 'finished' ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="question-banner p-12 rounded-3xl text-center">
                  <h2 
                    className="text-6xl font-bold text-yellow-300 mb-8"
                    style={{ fontFamily: 'Mountains of Christmas, cursive' }}
                  >
                    🏆 Game Over! 🏆
                  </h2>
                  {sortedTeams.length > 0 && (
                    <>
                      <p className="text-3xl text-white mb-2">Winner:</p>
                      <p 
                        className="text-5xl font-bold text-yellow-300 mb-4"
                        style={{ fontFamily: 'Mountains of Christmas, cursive' }}
                      >
                        {sortedTeams[0].name}
                      </p>
                      <p className="text-4xl text-white">{sortedTeams[0].score} points!</p>
                    </>
                  )}
                  <button
                    onClick={() => router.push('/')}
                    className="mt-8 bg-gradient-to-br from-blue-600 to-blue-700 text-white text-2xl font-bold 
                      py-4 px-8 rounded-xl border-4 border-yellow-400 shadow-lg 
                      hover:scale-105 transition-transform"
                    style={{ fontFamily: 'Mountains of Christmas, cursive' }}
                  >
                    🏠 New Game
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Question Number */}
                <div className="text-center mb-2">
                  <span className="text-yellow-300 text-lg">
                    Question {(game.current_question ?? 0) + 1} of {Math.min(totalQuestions, triviaQuestions.length)}
                  </span>
                </div>

                {/* Question - LARGER */}
                <div className="question-banner p-6 rounded-xl mb-4">
                  <p 
                    className="text-4xl text-white text-center font-semibold leading-tight"
                    style={{ fontFamily: 'Mountains of Christmas, cursive' }}
                  >
                    {currentQ.question}
                  </p>
                </div>

                {/* Answers Grid - BIGGER */}
                <div className="grid grid-cols-2 gap-4 flex-1">
                  {currentQ.answers.map((answer, index) => {
                    const colors = [
                      { bg: 'from-green-700 to-green-600', border: 'border-green-400' },
                      { bg: 'from-blue-700 to-blue-600', border: 'border-blue-400' },
                      { bg: 'from-red-700 to-red-600', border: 'border-red-400' },
                      { bg: 'from-yellow-600 to-yellow-500', border: 'border-yellow-400' },
                    ]
                    const isCorrect = index === currentQ.correct
                    const showCorrect = game.status === 'revealing'
                    
                    return (
                      <div
                        key={index}
                        className={`bg-gradient-to-br ${colors[index].bg} ${colors[index].border}
                          border-4 rounded-2xl p-5 flex items-center justify-center
                          transition-all duration-500
                          ${showCorrect && isCorrect ? 'ring-4 ring-green-400 scale-105' : ''}
                          ${showCorrect && !isCorrect ? 'opacity-50' : ''}`}
                      >
                        <span 
                          className="text-3xl font-bold text-white text-center"
                          style={{ fontFamily: 'Mountains of Christmas, cursive' }}
                        >
                          <span className="text-yellow-300 mr-3">{String.fromCharCode(65 + index)})</span>
                          {answer}
                          {showCorrect && isCorrect && <span className="ml-3">✓</span>}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>

          {/* Right Side - Response Status */}
          {game.status !== 'waiting' && game.status !== 'finished' && (
            <div className="w-48">
              <h2 className="text-xl text-yellow-300 text-center mb-2 font-bold" style={{ fontFamily: 'Mountains of Christmas, cursive' }}>
                Responses
              </h2>
              <div className="question-banner p-4 rounded-xl">
                <div className="text-center">
                  <p className="text-6xl font-bold text-white">{currentAnswers.length}</p>
                  <p className="text-yellow-300 text-lg">of {teams.length}</p>
                </div>
                {currentAnswers.length > 0 && (
                  <div className="mt-4 space-y-1">
                    {currentAnswers
                      .sort((a, b) => new Date(a.answered_at).getTime() - new Date(b.answered_at).getTime())
                      .slice(0, 8)
                      .map((ans, idx) => {
                        const team = teams.find(t => t.id === ans.team_id)
                        return (
                          <div key={ans.id} className="text-white text-sm flex items-center gap-2">
                            <span className="text-yellow-300 font-bold">#{idx + 1}</span>
                            <span className="truncate">{team?.name}</span>
                          </div>
                        )
                      })}
                    {currentAnswers.length > 8 && (
                      <p className="text-gray-400 text-xs">+{currentAnswers.length - 8} more</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
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
        <div
          key={i}
          className={`light-bulb ${['light-red', 'light-green', 'light-gold', 'light-blue', 'light-purple'][i % 5]}`}
          style={{ left: `${1 + i * 3.3}%`, animationDelay: `${i * 0.12}s` }}
        />
      ))}
    </div>
  )
}
