'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { triviaQuestions, QUESTION_TIME_SECONDS } from '@/lib/questions'
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
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME_SECONDS)
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
      
      // Check if we already have a team in this game (from localStorage)
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
          
          // Reset answer state when question changes or game restarts
          if (newGame.status === 'playing') {
            setHasAnswered(false)
            setSelectedAnswer(null)
            setAnswerResult(null)
            setTimeLeft(QUESTION_TIME_SECONDS)
          }
        }
      )
      .subscribe()
    
    return () => {
      supabase.removeChannel(channel)
    }
  }, [gameId])

  // Timer for player view
  useEffect(() => {
    if (game?.status !== 'playing' || hasAnswered) return
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) return 0
        return prev - 1
      })
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
    
    // Calculate time taken
    const questionStartTime = game.question_start_time 
      ? new Date(game.question_start_time).getTime()
      : Date.now() - (QUESTION_TIME_SECONDS - timeLeft) * 1000
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
      
      // Update team's has_answered
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
      <div className="min-h-screen wood-background flex items-center justify-center p-4">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }

  // Join screen
  if (!team) {
    return (
      <div className="min-h-screen wood-background flex items-center justify-center p-4">
        <div className="question-banner p-6 rounded-2xl w-full max-w-md">
          <h1 
            className="text-3xl font-bold text-white text-center mb-6"
            style={{ fontFamily: 'Mountains of Christmas, cursive' }}
          >
            🎄 Join Game 🎄
          </h1>
          
          <div className="mb-4">
            <label className="text-yellow-300 text-sm mb-2 block">Game Code</label>
            <div 
              className="text-3xl font-bold text-white text-center tracking-widest"
              style={{ fontFamily: 'Cinzel Decorative, serif' }}
            >
              {game.code}
            </div>
          </div>
          
          <div className="mb-4">
            <label className="text-yellow-300 text-sm mb-2 block">Your Team Name</label>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Enter team name..."
              maxLength={20}
              className="w-full text-xl py-3 px-4 rounded-xl
                bg-gray-900 text-white border-4 border-yellow-400 
                placeholder-gray-500"
              autoFocus
            />
          </div>
          
          <div className="mb-6">
            <label className="text-yellow-300 text-sm mb-2 block">Pick Your Color</label>
            <div className="flex flex-wrap gap-2 justify-center">
              {TEAM_COLORS.map((color, index) => (
                <button
                  key={color.name}
                  onClick={() => setSelectedColor(index)}
                  className={`w-10 h-10 rounded-full bg-gradient-to-br ${color.bg} border-4 
                    transition-transform ${selectedColor === index ? 'scale-125 border-white' : 'border-transparent'}`}
                />
              ))}
            </div>
          </div>
          
          {error && (
            <div className="mb-4 text-red-400 text-center">{error}</div>
          )}
          
          <button
            onClick={joinGame}
            disabled={isJoining || !teamName.trim()}
            className="w-full bg-gradient-to-br from-green-600 to-green-700 text-white text-2xl font-bold 
              py-4 px-6 rounded-xl border-4 border-yellow-400 shadow-lg 
              hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
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

  // Waiting screen
  if (game.status === 'waiting') {
    return (
      <div className="min-h-screen wood-background flex items-center justify-center p-4">
        <div className="question-banner p-8 rounded-2xl text-center max-w-md">
          <div className="text-6xl mb-4">⏳</div>
          <h1 
            className="text-3xl font-bold text-white mb-4"
            style={{ fontFamily: 'Mountains of Christmas, cursive' }}
          >
            You&apos;re In!
          </h1>
          <div className={`bg-gradient-to-br ${teamColor.bg} border-4 ${teamColor.border} 
            rounded-xl p-4 mb-6`}>
            <p className="text-xl text-white font-bold">{team.name}</p>
          </div>
          <p className="text-yellow-300 text-lg animate-pulse">
            Waiting for host to start the game...
          </p>
          <div className="mt-6 text-4xl">
            <span className="animate-bounce inline-block">🎄</span>
            <span className="animate-bounce inline-block mx-2" style={{ animationDelay: '0.2s' }}>🎁</span>
            <span className="animate-bounce inline-block" style={{ animationDelay: '0.4s' }}>⭐</span>
          </div>
        </div>
      </div>
    )
  }

  // Game finished screen
  if (game.status === 'finished') {
    return (
      <div className="min-h-screen wood-background flex items-center justify-center p-4">
        <div className="question-banner p-8 rounded-2xl text-center max-w-md">
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
            <p className="text-3xl text-yellow-300 font-bold mt-2">{team.score} pts</p>
          </div>
          <p className="text-white text-lg mb-6">
            Thanks for playing! 🎅
          </p>
          <button
            onClick={() => router.push('/')}
            className="bg-gradient-to-br from-blue-600 to-blue-700 text-white text-xl font-bold 
              py-3 px-6 rounded-xl border-4 border-yellow-400 shadow-lg 
              hover:scale-105 transition-transform"
            style={{ fontFamily: 'Mountains of Christmas, cursive' }}
          >
            🏠 Home
          </button>
        </div>
      </div>
    )
  }

  // Playing/Revealing screen
  return (
    <div className="min-h-screen wood-background flex flex-col p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div className={`bg-gradient-to-br ${teamColor.bg} border-2 ${teamColor.border} 
          rounded-lg px-3 py-1`}>
          <span className="text-white font-bold text-sm">{team.name}</span>
          <span className="text-yellow-300 ml-2">{team.score}</span>
        </div>
        
        <div className={`text-2xl font-bold ${timeLeft <= 5 && !hasAnswered ? 'text-red-500 animate-pulse' : 'text-white'}`}>
          {game.status === 'playing' ? `${timeLeft}s` : '⏸️'}
        </div>
      </div>

      {/* Question */}
      <div className="question-banner p-4 rounded-xl mb-4">
        <p className="text-xs text-yellow-300 mb-1">
          Q{(game.current_question ?? 0) + 1} of {triviaQuestions.length}
        </p>
        <p 
          className="text-xl text-white text-center font-semibold"
          style={{ fontFamily: 'Mountains of Christmas, cursive' }}
        >
          {currentQ.question}
        </p>
      </div>

      {/* Answers */}
      {hasAnswered ? (
        /* Already Answered */
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className={`text-7xl mb-4 ${answerResult === 'correct' ? 'animate-bounce' : 'animate-pulse'}`}>
              {answerResult === 'correct' ? '🎉' : '😅'}
            </div>
            <p 
              className={`text-3xl font-bold ${answerResult === 'correct' ? 'text-green-400' : 'text-red-400'}`}
              style={{ fontFamily: 'Mountains of Christmas, cursive' }}
            >
              {answerResult === 'correct' ? 'Correct!' : 'Wrong!'}
            </p>
            <p className="text-white mt-2">Waiting for others...</p>
          </div>
        </div>
      ) : game.status === 'revealing' ? (
        /* Revealing but didn't answer in time */
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-7xl mb-4">⏰</div>
            <p 
              className="text-3xl font-bold text-yellow-400"
              style={{ fontFamily: 'Mountains of Christmas, cursive' }}
            >
              Time&apos;s Up!
            </p>
            <p className="text-white mt-4">
              The answer was: <span className="text-green-400 font-bold">{currentQ.answers[currentQ.correct]}</span>
            </p>
          </div>
        </div>
      ) : (
        /* Answer Buttons */
        <div className="flex-1 grid grid-cols-1 gap-3">
          {currentQ.answers.map((answer, index) => {
            const colors = [
              { bg: 'from-green-700 to-green-600', border: 'border-green-400' },
              { bg: 'from-blue-700 to-blue-600', border: 'border-blue-400' },
              { bg: 'from-red-700 to-red-600', border: 'border-red-400' },
              { bg: 'from-yellow-600 to-yellow-500', border: 'border-yellow-400' },
            ]
            
            return (
              <button
                key={index}
                onClick={() => submitAnswer(index)}
                disabled={hasAnswered || timeLeft === 0}
                className={`bg-gradient-to-br ${colors[index].bg} ${colors[index].border}
                  border-4 rounded-xl p-4 text-left
                  active:scale-95 transition-transform
                  disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <span 
                  className="text-xl font-bold text-white"
                  style={{ fontFamily: 'Mountains of Christmas, cursive' }}
                >
                  <span className="text-yellow-300 mr-2">{String.fromCharCode(65 + index)})</span>
                  {answer}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

