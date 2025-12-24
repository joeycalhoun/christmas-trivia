'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { triviaQuestions } from '@/lib/questions'
import { Game, Team, getTeamColor, TEAM_COLORS } from '@/lib/types'

export default function PlayPage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = use(params)
  const router = useRouter()
  const [game, setGame] = useState<Game | null>(null)
  const [team, setTeam] = useState<Team | null>(null)
  const [teamName, setTeamName] = useState('')
  const [selectedColor, setSelectedColor] = useState(0)
  const [isJoining, setIsJoining] = useState(false)
  const [hasAnswered, setHasAnswered] = useState(false)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [answerResult, setAnswerResult] = useState<'correct' | 'wrong' | null>(null)
  const [timeLeft, setTimeLeft] = useState(20)
  const [error, setError] = useState('')

  // Load game data
  useEffect(() => {
    const loadGame = async () => {
      const { data } = await supabase
        .from('games')
        .select()
        .eq('id', gameId)
        .single()
      
      if (!data) {
        router.push('/')
        return
      }
      
      setGame(data)
      setTimeLeft(data.question_time_seconds || 20)
      
      const savedTeamId = localStorage.getItem(`team-${gameId}`)
      if (savedTeamId) {
        const { data: teamData } = await supabase
          .from('teams')
          .select()
          .eq('id', savedTeamId)
          .single()
        
        if (teamData) {
          setTeam(teamData)
        }
      }
    }
    
    loadGame()
  }, [gameId, router])

  // Subscribe to game updates
  useEffect(() => {
    const channel = supabase
      .channel(`player-${gameId}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
        (payload) => {
          const newGame = payload.new as Game
          setGame(newGame)
          
          if (newGame.status === 'playing') {
            setHasAnswered(false)
            setSelectedAnswer(null)
            setAnswerResult(null)
            setTimeLeft(newGame.question_time_seconds || 20)
          }
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'teams', filter: `id=eq.${team?.id}` },
        (payload) => {
          if (payload.new) {
            setTeam(payload.new as Team)
          }
        }
      )
      .subscribe()
    
    return () => {
      supabase.removeChannel(channel)
    }
  }, [gameId, team?.id])

  // Timer
  useEffect(() => {
    if (game?.status !== 'playing' || hasAnswered) return
    
    const timer = setInterval(() => {
      setTimeLeft(prev => prev <= 1 ? 0 : prev - 1)
    }, 1000)
    
    return () => clearInterval(timer)
  }, [game?.status, hasAnswered])

  const joinGame = async () => {
    if (!teamName.trim()) {
      setError('Please enter a team name')
      return
    }
    
    setIsJoining(true)
    setError('')
    
    try {
      const { data, error: dbError } = await supabase
        .from('teams')
        .insert({
          game_id: gameId,
          name: teamName.trim(),
          color: TEAM_COLORS[selectedColor].name,
          score: 0
        })
        .select()
        .single()
      
      if (dbError) throw dbError
      
      localStorage.setItem(`team-${gameId}`, data.id)
      setTeam(data)
    } catch (err) {
      console.error('Error joining game:', err)
      setError('Failed to join. Try a different name.')
      setIsJoining(false)
    }
  }

  const submitAnswer = async (answerIndex: number) => {
    if (hasAnswered || !team || !game || game.status !== 'playing') return
    
    setSelectedAnswer(answerIndex)
    setHasAnswered(true)
    
    const currentQ = triviaQuestions[game.current_question]
    const isCorrect = answerIndex === currentQ.correct
    setAnswerResult(isCorrect ? 'correct' : 'wrong')
    
    const questionStartTime = game.question_start_time 
      ? new Date(game.question_start_time).getTime()
      : Date.now() - ((game.question_time_seconds || 20) - timeLeft) * 1000
    const timeTaken = Date.now() - questionStartTime
    
    try {
      await supabase
        .from('answers')
        .insert({
          game_id: gameId,
          team_id: team.id,
          question_index: game.current_question,
          answer_index: answerIndex,
          is_correct: isCorrect,
          time_taken_ms: timeTaken
        })
      
      await supabase
        .from('teams')
        .update({ has_answered: true })
        .eq('id', team.id)
    } catch (err) {
      console.error('Error submitting answer:', err)
    }
  }

  if (!game) {
    return (
      <div className="min-h-[100dvh] wood-background flex items-center justify-center p-4">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }

  // Join screen
  if (!team) {
    return (
      <div className="min-h-[100dvh] wood-background flex items-center justify-center p-4 safe-area-inset">
        <div className="question-banner p-6 rounded-2xl w-full max-w-sm">
          <h1 
            className="text-3xl font-bold text-white text-center mb-4"
            style={{ fontFamily: 'Mountains of Christmas, cursive' }}
          >
            🎄 Join Game 🎄
          </h1>
          
          <div className="mb-4 text-center">
            <span className="text-yellow-300 text-sm">Game Code</span>
            <p 
              className="text-3xl font-bold text-white tracking-widest"
              style={{ fontFamily: 'Cinzel Decorative, serif' }}
            >
              {game.code}
            </p>
          </div>
          
          <div className="mb-4">
            <label className="text-yellow-300 text-sm mb-1 block">Your Team Name</label>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Enter team name..."
              maxLength={20}
              className="w-full text-lg py-4 px-4 rounded-xl
                bg-gray-900 text-white border-4 border-yellow-400 
                placeholder-gray-500"
              autoFocus
              autoComplete="off"
              autoCapitalize="words"
            />
          </div>
          
          <div className="mb-5">
            <label className="text-yellow-300 text-sm mb-2 block">Pick Your Color</label>
            <div className="flex flex-wrap gap-3 justify-center">
              {TEAM_COLORS.map((color, index) => (
                <button
                  key={color.name}
                  onClick={() => setSelectedColor(index)}
                  className={`w-12 h-12 rounded-full bg-gradient-to-br ${color.bg} border-4 
                    transition-all active:scale-95 ${selectedColor === index ? 'scale-110 border-white ring-2 ring-white' : 'border-transparent'}`}
                />
              ))}
            </div>
          </div>
          
          {error && (
            <div className="mb-4 text-red-400 text-center text-sm">{error}</div>
          )}
          
          <button
            onClick={joinGame}
            disabled={isJoining || !teamName.trim()}
            className="w-full bg-gradient-to-br from-green-600 to-green-700 text-white text-2xl font-bold 
              py-5 px-6 rounded-xl border-4 border-yellow-400 shadow-lg 
              active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ fontFamily: 'Mountains of Christmas, cursive' }}
          >
            {isJoining ? '🎄 Joining...' : '🎮 Join Game!'}
          </button>
        </div>
      </div>
    )
  }

  const currentQ = triviaQuestions[game.current_question ?? 0]
  const teamColor = getTeamColor(TEAM_COLORS.findIndex(c => c.name === team.color) || 0)
  const totalQuestions = game.total_questions || 10

  // Waiting screen
  if (game.status === 'waiting') {
    return (
      <div className="min-h-[100dvh] wood-background flex items-center justify-center p-4 safe-area-inset">
        <div className="question-banner p-8 rounded-2xl text-center w-full max-w-sm">
          <div className="text-6xl mb-4">✓</div>
          <h1 
            className="text-3xl font-bold text-white mb-4"
            style={{ fontFamily: 'Mountains of Christmas, cursive' }}
          >
            You&apos;re In!
          </h1>
          <div className={`bg-gradient-to-br ${teamColor.bg} border-4 ${teamColor.border} 
            rounded-xl p-4 mb-6`}>
            <p className="text-2xl text-white font-bold">{team.name}</p>
          </div>
          <p className="text-yellow-300 text-lg animate-pulse">
            Waiting for host to start...
          </p>
          <div className="mt-6 text-4xl flex justify-center gap-3">
            <span className="animate-bounce" style={{ animationDelay: '0s' }}>🎄</span>
            <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>🎁</span>
            <span className="animate-bounce" style={{ animationDelay: '0.4s' }}>⭐</span>
          </div>
        </div>
      </div>
    )
  }

  // Game finished screen
  if (game.status === 'finished') {
    return (
      <div className="min-h-[100dvh] wood-background flex items-center justify-center p-4 safe-area-inset">
        <div className="question-banner p-8 rounded-2xl text-center w-full max-w-sm">
          <div className="text-6xl mb-4">🏆</div>
          <h1 
            className="text-3xl font-bold text-yellow-300 mb-4"
            style={{ fontFamily: 'Mountains of Christmas, cursive' }}
          >
            Game Over!
          </h1>
          <div className={`bg-gradient-to-br ${teamColor.bg} border-4 ${teamColor.border} 
            rounded-xl p-4 mb-4`}>
            <p className="text-xl text-white font-bold">{team.name}</p>
            <p className="text-4xl text-yellow-300 font-bold mt-2">{team.score} pts</p>
          </div>
          <p className="text-white text-lg mb-6">Thanks for playing! 🎅</p>
          <button
            onClick={() => router.push('/')}
            className="w-full bg-gradient-to-br from-blue-600 to-blue-700 text-white text-xl font-bold 
              py-4 px-6 rounded-xl border-4 border-yellow-400 shadow-lg 
              active:scale-95 transition-transform"
            style={{ fontFamily: 'Mountains of Christmas, cursive' }}
          >
            🏠 Home
          </button>
        </div>
      </div>
    )
  }

  // Paused screen
  if (game.status === 'paused') {
    return (
      <div className="min-h-[100dvh] wood-background flex items-center justify-center p-4 safe-area-inset">
        <div className="question-banner p-8 rounded-2xl text-center w-full max-w-sm">
          <div className="text-6xl mb-4">⏸️</div>
          <h1 
            className="text-3xl font-bold text-yellow-300 mb-4"
            style={{ fontFamily: 'Mountains of Christmas, cursive' }}
          >
            Game Paused
          </h1>
          <div className={`bg-gradient-to-br ${teamColor.bg} border-4 ${teamColor.border} 
            rounded-xl p-3 mb-4`}>
            <p className="text-white font-bold">{team.name}</p>
            <p className="text-yellow-300 font-bold">{team.score} pts</p>
          </div>
          <p className="text-white text-lg animate-pulse">
            Waiting for host to resume...
          </p>
        </div>
      </div>
    )
  }

  // Playing/Revealing screen - Mobile optimized
  return (
    <div className="min-h-[100dvh] wood-background flex flex-col safe-area-inset">
      {/* Compact Header */}
      <div className="flex justify-between items-center p-3 bg-black/30">
        <div className={`bg-gradient-to-br ${teamColor.bg} border-2 ${teamColor.border} 
          rounded-lg px-3 py-1.5 flex items-center gap-2`}>
          <span className="text-white font-bold text-sm truncate max-w-[80px]">{team.name}</span>
          <span className="text-yellow-300 font-bold">{team.score}</span>
        </div>
        
        <div className={`text-2xl font-bold px-3 py-1 rounded-lg
          ${timeLeft <= 5 && !hasAnswered && game.status === 'playing' 
            ? 'text-red-500 bg-red-900/50 animate-pulse' 
            : 'text-white bg-black/30'}`}
        >
          {game.status === 'playing' ? `${timeLeft}s` : '⏸️'}
        </div>
      </div>

      {/* Question */}
      <div className="p-3">
        <div className="question-banner p-4 rounded-xl">
          <p className="text-yellow-300 text-xs text-center mb-1">
            Q{(game.current_question ?? 0) + 1} / {Math.min(totalQuestions, triviaQuestions.length)}
          </p>
          <p 
            className="text-xl text-white text-center font-semibold leading-tight"
            style={{ fontFamily: 'Mountains of Christmas, cursive' }}
          >
            {currentQ.question}
          </p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col p-3 pt-0">
        {hasAnswered ? (
          /* Already Answered - Feedback */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className={`text-8xl mb-4 ${answerResult === 'correct' ? 'animate-bounce' : ''}`}>
                {answerResult === 'correct' ? '🎉' : '😅'}
              </div>
              <p 
                className={`text-4xl font-bold mb-2 ${answerResult === 'correct' ? 'text-green-400' : 'text-red-400'}`}
                style={{ fontFamily: 'Mountains of Christmas, cursive' }}
              >
                {answerResult === 'correct' ? 'Correct!' : 'Wrong!'}
              </p>
              <p className="text-white/70 text-lg">Waiting for others...</p>
            </div>
          </div>
        ) : game.status === 'revealing' ? (
          /* Revealing - Show correct answer */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-6xl mb-4">⏰</div>
              <p 
                className="text-3xl font-bold text-yellow-400 mb-4"
                style={{ fontFamily: 'Mountains of Christmas, cursive' }}
              >
                Time&apos;s Up!
              </p>
              <p className="text-white text-lg">
                Answer: <span className="text-green-400 font-bold text-xl">{currentQ.answers[currentQ.correct]}</span>
              </p>
            </div>
          </div>
        ) : (
          /* Answer Buttons - Touch optimized */
          <div className="flex-1 flex flex-col gap-3">
            {currentQ.answers.map((answer, index) => {
              const colors = [
                { bg: 'from-green-600 to-green-700', border: 'border-green-400', active: 'active:from-green-500 active:to-green-600' },
                { bg: 'from-blue-600 to-blue-700', border: 'border-blue-400', active: 'active:from-blue-500 active:to-blue-600' },
                { bg: 'from-red-600 to-red-700', border: 'border-red-400', active: 'active:from-red-500 active:to-red-600' },
                { bg: 'from-yellow-500 to-yellow-600', border: 'border-yellow-400', active: 'active:from-yellow-400 active:to-yellow-500' },
              ]
              
              return (
                <button
                  key={index}
                  onClick={() => submitAnswer(index)}
                  disabled={hasAnswered || timeLeft === 0}
                  className={`flex-1 min-h-[70px] bg-gradient-to-br ${colors[index].bg} ${colors[index].border} ${colors[index].active}
                    border-4 rounded-xl px-4 py-3 text-left
                    active:scale-[0.98] transition-transform touch-manipulation
                    disabled:opacity-50 disabled:cursor-not-allowed
                    flex items-center`}
                >
                  <span 
                    className="text-lg font-bold text-white leading-snug"
                    style={{ fontFamily: 'Mountains of Christmas, cursive' }}
                  >
                    <span className="text-yellow-300 mr-2 text-xl">{String.fromCharCode(65 + index)})</span>
                    {answer}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
