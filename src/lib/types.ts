export type DifficultySetting = 'easy' | 'medium' | 'hard'

export interface Game {
  id: string
  code: string
  status: 'waiting' | 'playing' | 'paused' | 'revealing' | 'finished'
  current_question: number
  question_start_time: string | null
  question_time_seconds: number
  total_questions: number
  read_aloud_enabled: boolean
  read_aloud_seconds: number
  answering_enabled: boolean
  difficulty_setting: DifficultySetting
  created_at: string
}

export interface Team {
  id: string
  game_id: string
  name: string
  score: number
  color: string | null
  has_answered: boolean
  created_at: string
}

export interface Answer {
  id: string
  game_id: string
  team_id: string
  question_index: number
  answer_index: number
  is_correct: boolean
  time_taken_ms: number | null
  points_earned: number
  answered_at: string
}

export interface GameSettings {
  questionTime: number
  totalQuestions: number
  readAloudEnabled: boolean
  readAloudSeconds: number
  difficultySetting: DifficultySetting
}

export interface DynamicQuestion {
  question: string
  answers: string[]
  correct: number
  difficulty: 'easy' | 'medium' | 'hard' | 'very_hard'
}

export const DEFAULT_SETTINGS: GameSettings = {
  questionTime: 20,
  totalQuestions: 10,
  readAloudEnabled: false,
  readAloudSeconds: 7,
  difficultySetting: 'medium',
}

export const TEAM_COLORS = [
  { name: 'red', bg: 'from-red-700 to-red-600', border: 'border-red-400', text: 'text-red-400', hex: ['#b91c1c', '#dc2626'] },
  { name: 'green', bg: 'from-green-700 to-green-600', border: 'border-green-400', text: 'text-green-400', hex: ['#15803d', '#16a34a'] },
  { name: 'blue', bg: 'from-blue-700 to-blue-600', border: 'border-blue-400', text: 'text-blue-400', hex: ['#1d4ed8', '#2563eb'] },
  { name: 'gold', bg: 'from-yellow-600 to-yellow-500', border: 'border-yellow-400', text: 'text-yellow-400', hex: ['#ca8a04', '#eab308'] },
  { name: 'purple', bg: 'from-purple-700 to-purple-600', border: 'border-purple-400', text: 'text-purple-400', hex: ['#7e22ce', '#9333ea'] },
  { name: 'pink', bg: 'from-pink-600 to-pink-500', border: 'border-pink-400', text: 'text-pink-400', hex: ['#db2777', '#ec4899'] },
  { name: 'cyan', bg: 'from-cyan-600 to-cyan-500', border: 'border-cyan-400', text: 'text-cyan-400', hex: ['#0891b2', '#06b6d4'] },
  { name: 'orange', bg: 'from-orange-600 to-orange-500', border: 'border-orange-400', text: 'text-orange-400', hex: ['#ea580c', '#f97316'] },
]

export const getTeamColor = (index: number) => TEAM_COLORS[index % TEAM_COLORS.length]

export const getTeamColorByName = (colorName: string | null) => {
  const found = TEAM_COLORS.find(c => c.name === colorName)
  return found || TEAM_COLORS[0]
}

export const REVEAL_TIME_SECONDS = 5
