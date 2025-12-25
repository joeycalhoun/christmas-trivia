import { triviaQuestions } from '@/lib/questions'
import { Answer, Game, Team, getTeamColorByName } from '@/lib/types'

export type HostTestState =
  | 'waiting'
  | 'playing'
  | 'revealing-answer'
  | 'revealing-winners'
  | 'paused'
  | 'settings'
  | 'finished'

export type PlayerTestState =
  | 'join'
  | 'waiting'
  | 'playing'
  | 'locked'
  | 'revealing-correct'
  | 'revealing-wrong'
  | 'paused'
  | 'finished'

export const TEST_GAME_ID = 'test-game'

export function makeMockGame(overrides: Partial<Game> = {}): Game {
  const base: Game = {
    id: TEST_GAME_ID,
    code: 'XMAS24',
    status: 'playing',
    current_question: 1,
    question_start_time: new Date(Date.now() - 6_000).toISOString(),
    question_time_seconds: 20,
    total_questions: 10,
    read_aloud_enabled: false,
    read_aloud_seconds: 7,
    answering_enabled: true,
    difficulty_setting: 'medium',
    created_at: new Date().toISOString(),
  }
  return { ...base, ...overrides }
}

export function makeMockTeams(): Team[] {
  const now = new Date().toISOString()
  const mk = (i: number, name: string, color: string, score: number, has_answered: boolean): Team => ({
    id: `team-${i}`,
    game_id: TEST_GAME_ID,
    name,
    color,
    score,
    has_answered,
    created_at: now,
  })

  return [
    mk(1, 'Jingle Squad', 'green', 650, true),
    mk(2, 'Snowballers', 'blue', 500, true),
    mk(3, 'Rudolph Ringers', 'red', 425, false),
    mk(4, 'Mistletoe Mafia', 'purple', 350, true),
    mk(5, 'Candy Cane Crew', 'gold', 275, false),
  ]
}

export function makeMockHostAnswers(questionIndex: number, teams: Team[]): Answer[] {
  const now = Date.now()
  const mk = (i: number, team: Team, answer_index: number, is_correct: boolean, points_earned: number): Answer => ({
    id: `ans-${i}`,
    game_id: TEST_GAME_ID,
    team_id: team.id,
    question_index: questionIndex,
    answer_index,
    is_correct,
    time_taken_ms: 2_000 + i * 350,
    points_earned,
    answered_at: new Date(now + i * 350).toISOString(),
  })

  const q = triviaQuestions[questionIndex] ?? triviaQuestions[0]
  const correct = q.correct

  return [
    mk(1, teams[0], correct, true, 300),
    mk(2, teams[1], (correct + 1) % 4, false, 0),
    mk(3, teams[3], correct, true, 250),
  ]
}

export function makeWinnersForHost(teams: Team[], questionIndex: number) {
  const q = triviaQuestions[questionIndex] ?? triviaQuestions[0]
  const _correct = q.correct
  return [
    { team: { ...teams[0] }, points: 300, position: 1 },
    { team: { ...teams[3] }, points: 250, position: 2 },
  ]
}

export function getTeamGradient(team: Team) {
  return getTeamColorByName(team.color)
}


