'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '@/lib/supabase'
import { triviaQuestions, QUESTION_TIME_SECONDS, REVEAL_TIME_SECONDS } from '@/lib/questions'
import { Game, Team, Answer, getTeamColor } from '@/lib/types'

export default function HostPage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = use(params)
  const router = useRouter()
  const [game, setGame] = useState<Game | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [answers, setAnswers] = useState<Answer[]>([])
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME_SECONDS)
  const [hostUrl, setHostUrl] = useState('')

  // Get current URL for QR code
  useEffect(() => {
    const url = window.location.origin
    setHostUrl(url)
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

  // Timer logic
  useEffect(() => {
    if (game?.status !== 'playing') return
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Time's up - move to revealing
          handleReveal()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    
    return () => clearInterval(timer)
  }, [game?.status])

  const startGame = async () => {
    if (teams.length < 1) return
    
    await supabase
      .from('games')
      .update({ 
        status: 'playing', 
        current_question: 0,
        question_start_time: new Date().toISOString()
      })
      .eq('id', gameId)
    
    // Reset all teams' has_answered
    await supabase
      .from('teams')
      .update({ has_answered: false })
      .eq('game_id', gameId)
    
    setGame(prev => prev ? { ...prev, status: 'playing', current_question: 0 } : null)
    setTimeLeft(QUESTION_TIME_SECONDS)
  }

  const handleReveal = useCallback(async () => {
    // Calculate scores for this question
    const currentQuestion = game?.current_question ?? 0
    const questionAnswers = answers.filter(a => a.question_index === currentQuestion)
    const correctAnswers = questionAnswers
      .filter(a => a.is_correct)
      .sort((a, b) => new Date(a.answered_at).getTime() - new Date(b.answered_at).getTime())
    
    // Award points based on order
    for (let i = 0; i < correctAnswers.length; i++) {
      const basePoints = 100
      const speedBonus = Math.max(0, (correctAnswers.length - i) * 25) // Earlier = more points
      const points = basePoints + speedBonus
      
      await supabase
        .from('answers')
        .update({ points_earned: points })
        .eq('id', correctAnswers[i].id)
      
      const team = teams.find(t => t.id === correctAnswers[i].team_id)
      if (team) {
        await supabase
          .from('teams')
          .update({ score: team.score + points })
          .eq('id', team.id)
        
        setTeams(prev => prev.map(t => 
          t.id === team.id ? { ...t, score: t.score + points } : t
        ))
      }
    }
    
    await supabase
      .from('games')
      .update({ status: 'revealing' })
      .eq('id', gameId)
    
    setGame(prev => prev ? { ...prev, status: 'revealing' } : null)
    
    // Auto-advance after reveal time
    setTimeout(() => {
      nextQuestion()
    }, REVEAL_TIME_SECONDS * 1000)
  }, [game?.current_question, answers, teams, gameId])

  const nextQuestion = async () => {
    const nextQ = (game?.current_question ?? 0) + 1
    
    if (nextQ >= triviaQuestions.length) {
      // Game over
      await supabase
        .from('games')
        .update({ status: 'finished' })
        .eq('id', gameId)
      
      setGame(prev => prev ? { ...prev, status: 'finished' } : null)
      return
    }
    
    // Reset teams' has_answered for next question
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
        question_start_time: new Date().toISOString()
      })
      .eq('id', gameId)
    
    setGame(prev => prev ? { ...prev, status: 'playing', current_question: nextQ } : null)
    setTimeLeft(QUESTION_TIME_SECONDS)
  }

  const currentQ = triviaQuestions[game?.current_question ?? 0]
  const currentAnswers = answers.filter(a => a.question_index === game?.current_question)
  const joinUrl = `${hostUrl}/play/${gameId}`

  // Sort teams by score for display
  const sortedTeams = [...teams].sort((a, b) => b.score - a.score)

  if (!game) {
    return (
      <div className="min-h-screen wood-background flex items-center justify-center">
        <div className="text-white text-2xl">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen wood-background relative overflow-hidden">
      {/* Christmas Lights */}
      <ChristmasLights />

      <div className="relative z-10 flex flex-col h-screen p-4">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          {/* Game Code */}
          <div className="question-banner px-6 py-3 rounded-xl">
            <p className="text-yellow-300 text-sm">Game Code</p>
            <p 
              className="text-4xl font-bold text-white tracking-widest"
              style={{ fontFamily: 'Cinzel Decorative, serif' }}
            >
              {game.code}
            </p>
          </div>

          {/* Title */}
          <div className="text-center">
            <h1 
              className="text-4xl font-bold text-white"
              style={{ fontFamily: 'Mountains of Christmas, cursive', textShadow: '3px 3px 6px rgba(0,0,0,0.5)' }}
            >
              🎄 Christmas Trivia 🎄
            </h1>
          </div>

          {/* Timer/Status */}
          <div className="candy-cane-border">
            <div className="bg-gray-900 px-6 py-3 rounded-xl">
              {game.status === 'playing' ? (
                <span 
                  className={`text-4xl font-bold ${timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-white'}`}
                  style={{ fontFamily: 'Cinzel Decorative, serif' }}
                >
                  {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}
                </span>
              ) : game.status === 'revealing' ? (
                <span className="text-2xl text-yellow-400">Revealing...</span>
              ) : game.status === 'finished' ? (
                <span className="text-2xl text-green-400">🏆 Finished!</span>
              ) : (
                <span className="text-2xl text-yellow-400">Waiting...</span>
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex gap-4">
          {/* Left Side - Teams */}
          <div className="w-64 flex flex-col gap-3">
            <h2 className="text-xl text-yellow-300 text-center mb-2" style={{ fontFamily: 'Mountains of Christmas, cursive' }}>
              Teams ({teams.length})
            </h2>
            {sortedTeams.map((team, index) => {
              const color = getTeamColor(teams.findIndex(t => t.id === team.id))
              const hasAnswered = currentAnswers.some(a => a.team_id === team.id)
              const teamAnswer = currentAnswers.find(a => a.team_id === team.id)
              
              return (
                <div
                  key={team.id}
                  className={`bg-gradient-to-br ${color.bg} border-4 ${color.border} rounded-xl p-3
                    transition-all duration-300 ${hasAnswered ? 'ring-4 ring-white scale-105' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {index === 0 && game.status !== 'waiting' && <span>👑</span>}
                      <span className="text-white font-bold truncate max-w-[120px]">{team.name}</span>
                    </div>
                    <span className="text-yellow-300 font-bold text-xl">{team.score}</span>
                  </div>
                  {game.status === 'revealing' && teamAnswer && (
                    <div className="mt-1 text-sm">
                      {teamAnswer.is_correct ? (
                        <span className="text-green-300">✓ +{teamAnswer.points_earned || '?'}</span>
                      ) : (
                        <span className="text-red-300">✗ Wrong</span>
                      )}
                    </div>
                  )}
                  {game.status === 'playing' && hasAnswered && (
                    <div className="mt-1 text-sm text-white/80">✓ Answered!</div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Center - Question/QR Code */}
          <div className="flex-1 flex flex-col">
            {game.status === 'waiting' ? (
              /* Waiting Screen */
              <div className="flex-1 flex flex-col items-center justify-center">
                <div className="question-banner p-8 rounded-2xl text-center mb-8">
                  <h2 
                    className="text-4xl font-bold text-white mb-4"
                    style={{ fontFamily: 'Mountains of Christmas, cursive' }}
                  >
                    Scan to Join! 📱
                  </h2>
                  <div className="bg-white p-4 rounded-xl inline-block mb-4">
                    {hostUrl && (
                      <QRCodeSVG 
                        value={joinUrl}
                        size={200}
                        level="M"
                      />
                    )}
                  </div>
                  <p className="text-yellow-300 text-xl mb-2">Or go to:</p>
                  <p className="text-white text-lg break-all">{joinUrl}</p>
                </div>
                
                {teams.length > 0 && (
                  <button
                    onClick={startGame}
                    className="bg-gradient-to-br from-green-600 to-green-700 text-white text-3xl font-bold 
                      py-5 px-12 rounded-xl border-4 border-yellow-400 shadow-lg 
                      hover:scale-105 transition-transform"
                    style={{ fontFamily: 'Mountains of Christmas, cursive' }}
                  >
                    🎮 Start Game! ({teams.length} teams)
                  </button>
                )}
                
                {teams.length === 0 && (
                  <p className="text-yellow-300 text-xl animate-pulse">
                    Waiting for players to join...
                  </p>
                )}
              </div>
            ) : game.status === 'finished' ? (
              /* Finished Screen */
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
                    🏠 Back to Home
                  </button>
                </div>
              </div>
            ) : (
              /* Playing/Revealing Screen */
              <>
                {/* Question Number */}
                <div className="text-center mb-4">
                  <span className="text-yellow-300 text-xl">
                    Question {(game.current_question ?? 0) + 1} of {triviaQuestions.length}
                  </span>
                </div>

                {/* Question */}
                <div className="question-banner p-8 rounded-2xl mb-6">
                  <p 
                    className="text-4xl text-white text-center font-semibold"
                    style={{ fontFamily: 'Mountains of Christmas, cursive' }}
                  >
                    {currentQ.question}
                  </p>
                </div>

                {/* Answers Grid */}
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
                          border-4 rounded-2xl p-6 flex items-center justify-center
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

          {/* Right Side - Answer Status */}
          {game.status !== 'waiting' && game.status !== 'finished' && (
            <div className="w-48">
              <h2 className="text-xl text-yellow-300 text-center mb-3" style={{ fontFamily: 'Mountains of Christmas, cursive' }}>
                Responses
              </h2>
              <div className="question-banner p-4 rounded-xl">
                <div className="text-center">
                  <p className="text-5xl font-bold text-white mb-2">
                    {currentAnswers.length}
                  </p>
                  <p className="text-yellow-300">of {teams.length}</p>
                </div>
                {currentAnswers.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {currentAnswers
                      .sort((a, b) => new Date(a.answered_at).getTime() - new Date(b.answered_at).getTime())
                      .map((ans, idx) => {
                        const team = teams.find(t => t.id === ans.team_id)
                        return (
                          <div key={ans.id} className="text-white text-sm flex items-center gap-2">
                            <span className="text-yellow-300">#{idx + 1}</span>
                            <span className="truncate">{team?.name}</span>
                          </div>
                        )
                      })}
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

// Christmas Lights component
function ChristmasLights() {
  return (
    <>
      <div className="christmas-lights">
        <div className="light-wire" />
        {Array.from({ length: 30 }).map((_, i) => (
          <div
            key={i}
            className={`light-bulb ${['light-red', 'light-green', 'light-gold', 'light-blue', 'light-purple'][i % 5]}`}
            style={{
              left: `${1 + i * 3.3}%`,
              animationDelay: `${i * 0.12}s`,
            }}
          />
        ))}
      </div>
    </>
  )
}

