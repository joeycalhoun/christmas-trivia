'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, generateGameCode } from '@/lib/supabase'

export default function Home() {
  const router = useRouter()
  const [joinCode, setJoinCode] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState('')

  const createGame = async () => {
    setIsCreating(true)
    setError('')
    
    try {
      const code = generateGameCode()
      const { data, error: dbError } = await supabase
        .from('games')
        .insert({ code, status: 'waiting' })
        .select()
        .single()
      
      if (dbError) throw dbError
      
      router.push(`/host/${data.id}`)
    } catch (err) {
      console.error('Error creating game:', err)
      setError('Failed to create game. Please try again.')
      setIsCreating(false)
    }
  }

  const joinGame = async () => {
    if (!joinCode.trim()) {
      setError('Please enter a game code')
      return
    }
    
    setError('')
    
    try {
      const { data, error: dbError } = await supabase
        .from('games')
        .select()
        .eq('code', joinCode.toUpperCase())
        .single()
      
      if (dbError || !data) {
        setError('Game not found. Check the code and try again.')
        return
      }
      
      if (data.status === 'finished') {
        setError('This game has already ended.')
        return
      }
      
      router.push(`/play/${data.id}`)
    } catch (err) {
      console.error('Error joining game:', err)
      setError('Failed to join game. Please try again.')
    }
  }

  return (
    <div className="min-h-screen wood-background relative overflow-hidden flex items-center justify-center">
      {/* Snow Effect */}
      <Snowflakes />
      
      {/* Christmas Lights */}
      <ChristmasLights />

      <div className="relative z-10 text-center px-4">
        {/* Title */}
        <div className="mb-12">
          <h1 
            className="text-6xl md:text-8xl font-bold text-white mb-4"
            style={{ 
              fontFamily: 'Mountains of Christmas, cursive', 
              textShadow: '4px 4px 8px rgba(0,0,0,0.5), 0 0 40px rgba(255,215,0,0.3)' 
            }}
          >
            🎄 Christmas Trivia 🎄
          </h1>
          <p className="text-2xl text-yellow-300" style={{ fontFamily: 'Mountains of Christmas, cursive' }}>
            Multiplayer Holiday Fun!
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col md:flex-row gap-8 justify-center items-center">
          {/* Host Game Card */}
          <div className="question-banner p-8 rounded-2xl w-80">
            <div className="text-5xl mb-4">🎅</div>
            <h2 
              className="text-3xl font-bold text-white mb-4"
              style={{ fontFamily: 'Mountains of Christmas, cursive' }}
            >
              Host a Game
            </h2>
            <p className="text-gray-200 mb-6">
              Create a new game and display it on the big screen
            </p>
            <button
              onClick={createGame}
              disabled={isCreating}
              className="w-full bg-gradient-to-br from-green-600 to-green-700 text-white text-xl font-bold 
                py-4 px-6 rounded-xl border-4 border-yellow-400 shadow-lg 
                hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ fontFamily: 'Mountains of Christmas, cursive' }}
            >
              {isCreating ? '🎄 Creating...' : '🎮 Create Game'}
            </button>
          </div>

          {/* Join Game Card */}
          <div className="question-banner p-8 rounded-2xl w-80">
            <div className="text-5xl mb-4">📱</div>
            <h2 
              className="text-3xl font-bold text-white mb-4"
              style={{ fontFamily: 'Mountains of Christmas, cursive' }}
            >
              Join a Game
            </h2>
            <p className="text-gray-200 mb-4">
              Enter the game code to play on your device
            </p>
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="GAME CODE"
              maxLength={6}
              className="w-full text-center text-2xl font-bold py-3 px-4 rounded-xl mb-4
                bg-gray-900 text-white border-4 border-yellow-400 
                placeholder-gray-500 tracking-widest"
              style={{ fontFamily: 'Cinzel Decorative, serif' }}
            />
            <button
              onClick={joinGame}
              className="w-full bg-gradient-to-br from-blue-600 to-blue-700 text-white text-xl font-bold 
                py-4 px-6 rounded-xl border-4 border-yellow-400 shadow-lg 
                hover:scale-105 transition-transform"
              style={{ fontFamily: 'Mountains of Christmas, cursive' }}
            >
              🎯 Join Game
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-6 bg-red-900/80 border-2 border-red-500 text-white px-6 py-3 rounded-xl">
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 text-4xl">
          <span className="animate-bounce inline-block" style={{ animationDelay: '0s' }}>🎁</span>
          <span className="animate-bounce inline-block mx-4" style={{ animationDelay: '0.2s' }}>⭐</span>
          <span className="animate-bounce inline-block" style={{ animationDelay: '0.4s' }}>🦌</span>
          <span className="animate-bounce inline-block mx-4" style={{ animationDelay: '0.6s' }}>🔔</span>
          <span className="animate-bounce inline-block" style={{ animationDelay: '0.8s' }}>❄️</span>
        </div>
      </div>
    </div>
  )
}

// Snowflakes component
function Snowflakes() {
  return (
    <>
      {Array.from({ length: 30 }).map((_, i) => (
        <div
          key={i}
          className="snowflake"
          style={{
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 10}s`,
            animationDuration: `${8 + Math.random() * 6}s`,
          }}
        >
          ❄
        </div>
      ))}
    </>
  )
}

// Christmas Lights component
function ChristmasLights() {
  return (
    <>
      <div className="christmas-lights">
        <div className="light-wire" />
        {Array.from({ length: 25 }).map((_, i) => (
          <div
            key={i}
            className={`light-bulb ${['light-red', 'light-green', 'light-gold', 'light-blue', 'light-purple'][i % 5]}`}
            style={{
              left: `${2 + i * 4}%`,
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </div>
      <div className="christmas-lights" style={{ top: 'auto', bottom: 0 }}>
        <div className="light-wire" style={{ top: 'auto', bottom: 20 }} />
        {Array.from({ length: 25 }).map((_, i) => (
          <div
            key={i}
            className={`light-bulb ${['light-purple', 'light-blue', 'light-gold', 'light-green', 'light-red'][i % 5]}`}
            style={{
              left: `${2 + i * 4}%`,
              top: 'auto',
              bottom: 25,
              animationDelay: `${i * 0.15 + 0.5}s`,
            }}
          />
        ))}
      </div>
    </>
  )
}
