'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, generateGameCode } from '@/lib/supabase'

export default function Home() {
  const router = useRouter()
  const [joinCode, setJoinCode] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState('')
  const [snowflakes, setSnowflakes] = useState<Array<{id: number, left: number, delay: number, duration: number, size: number}>>([])

  useEffect(() => {
    const flakes = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 10,
      duration: 10 + Math.random() * 8,
      size: 0.8 + Math.random() * 0.8,
    }))
    setSnowflakes(flakes)
  }, [])

  const cleanupOldGames = async () => {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    try { await supabase.from('games').delete().lt('created_at', twentyFourHoursAgo) } catch {}
  }

  const createGame = async () => {
    setIsCreating(true)
    setError('')
    await cleanupOldGames()
    try {
      const code = generateGameCode()
      const { data, error: dbError } = await supabase.from('games').insert({ code, status: 'waiting' }).select().single()
      if (dbError) throw dbError
      router.push(`/host/${data.id}`)
    } catch {
      setError('Failed to create game. Please try again.')
      setIsCreating(false)
    }
  }

  const joinGame = async () => {
    if (!joinCode.trim()) { setError('Please enter a game code'); return }
    setError('')
    try {
      const { data, error: dbError } = await supabase.from('games').select().eq('code', joinCode.toUpperCase()).single()
      if (dbError || !data) { setError('Game not found. Check the code.'); return }
      if (data.status === 'finished') { setError('This game has ended.'); return }
      router.push(`/play/${data.id}`)
    } catch { setError('Failed to join game.') }
  }

  return (
    <div className="min-h-screen wood-background relative overflow-hidden">
      {/* Snow */}
      <div className="snowflake-container">
        {snowflakes.map((flake) => (
          <div key={flake.id} className="snowflake" style={{ left: `${flake.left}%`, animationDelay: `${flake.delay}s`, animationDuration: `${flake.duration}s`, fontSize: `${flake.size}rem` }}>❄</div>
        ))}
      </div>
      
      {/* Lights */}
      <div className="christmas-lights-top">
        <div className="light-wire-top" />
        {Array.from({ length: 25 }).map((_, i) => (
          <div key={i} className={`light-bulb-top ${['light-red', 'light-green', 'light-gold', 'light-blue', 'light-purple'][i % 5]}`} style={{ left: `${2 + i * 4}%`, animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
      <div className="christmas-lights-bottom">
        <div className="light-wire-bottom" />
        {Array.from({ length: 25 }).map((_, i) => (
          <div key={i} className={`light-bulb-bottom ${['light-purple', 'light-blue', 'light-gold', 'light-green', 'light-red'][i % 5]}`} style={{ left: `${2 + i * 4}%`, animationDelay: `${i * 0.15 + 0.5}s` }} />
        ))}
      </div>

      {/* Decorative trees */}
      <div className="absolute bottom-20 left-8 text-8xl opacity-30">🎄</div>
      <div className="absolute bottom-20 right-8 text-8xl opacity-30">🎄</div>

      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-4 mb-4">
            <span className="text-6xl animate-bounce" style={{animationDelay: '0s'}}>🎅</span>
            <h1 className="text-7xl md:text-8xl font-bold text-white" style={{ fontFamily: 'Mountains of Christmas, cursive', textShadow: '4px 4px 8px rgba(0,0,0,0.5), 0 0 60px rgba(255,215,0,0.3)' }}>
              Christmas Trivia
            </h1>
            <span className="text-6xl animate-bounce" style={{animationDelay: '0.3s'}}>🎄</span>
          </div>
          <p className="text-3xl text-yellow-300" style={{ fontFamily: 'Mountains of Christmas, cursive' }}>
            ✨ Multiplayer Holiday Fun! ✨
          </p>
        </div>

        {/* Cards */}
        <div className="flex flex-col md:flex-row gap-8 justify-center items-stretch max-w-4xl w-full">
          {/* Host Card */}
          <div className="question-banner p-10 rounded-3xl flex-1 shadow-2xl">
            <div className="text-center">
              <div className="text-7xl mb-4">📺</div>
              <h2 className="text-4xl font-bold text-white mb-3" style={{ fontFamily: 'Mountains of Christmas, cursive' }}>Host Game</h2>
              <p className="text-white/70 mb-8 text-lg">Display on the big screen for everyone to see</p>
              <button onClick={createGame} disabled={isCreating} className="w-full bg-gradient-to-br from-green-500 to-green-600 text-white text-2xl font-bold py-5 px-8 rounded-xl border-4 border-yellow-400 shadow-lg hover:scale-105 active:scale-95 transition-transform disabled:opacity-50" style={{ fontFamily: 'Mountains of Christmas, cursive' }}>
                {isCreating ? '🎄 Creating...' : '🎮 Create Game'}
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="hidden md:flex items-center">
            <div className="text-4xl text-yellow-300/50">or</div>
          </div>

          {/* Join Card */}
          <div className="question-banner p-10 rounded-3xl flex-1 shadow-2xl">
            <div className="text-center">
              <div className="text-7xl mb-4">📱</div>
              <h2 className="text-4xl font-bold text-white mb-3" style={{ fontFamily: 'Mountains of Christmas, cursive' }}>Join Game</h2>
              <p className="text-white/70 mb-6 text-lg">Play on your phone or tablet</p>
              <input type="text" value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="GAME CODE" maxLength={6} className="w-full text-center text-3xl font-bold py-4 px-6 rounded-xl mb-4 bg-black/40 text-white border-4 border-yellow-400/50 placeholder-white/30 tracking-[0.3em] focus:border-yellow-400 focus:outline-none transition-colors" style={{ fontFamily: 'Cinzel Decorative, serif' }} />
              <button onClick={joinGame} className="w-full bg-gradient-to-br from-blue-500 to-blue-600 text-white text-2xl font-bold py-5 px-8 rounded-xl border-4 border-yellow-400 shadow-lg hover:scale-105 active:scale-95 transition-transform" style={{ fontFamily: 'Mountains of Christmas, cursive' }}>
                🎯 Join Game
              </button>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-8 bg-red-900/80 border-2 border-red-500 text-white px-8 py-4 rounded-xl shadow-lg">
            {error}
          </div>
        )}

        {/* Footer decorations */}
        <div className="mt-12 flex gap-6 text-5xl">
          {['🎁', '⭐', '🦌', '🔔', '❄️', '🍪'].map((emoji, i) => (
            <span key={i} className="animate-bounce" style={{ animationDelay: `${i * 0.15}s` }}>{emoji}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
