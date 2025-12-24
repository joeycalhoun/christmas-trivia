import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const DIFFICULTIES = ['easy', 'medium', 'hard', 'very_hard'] as const
type Difficulty = typeof DIFFICULTIES[number]

// Rotate through difficulties to ensure variety
function getDifficultyForQuestion(questionNumber: number): Difficulty {
  // Pattern: easy, medium, easy, hard, medium, easy, very_hard, medium, hard, easy...
  const pattern: Difficulty[] = [
    'easy', 'medium', 'easy', 'hard', 
    'medium', 'easy', 'very_hard', 'medium',
    'hard', 'easy'
  ]
  return pattern[questionNumber % pattern.length]
}

export async function POST(request: Request) {
  try {
    const { questionNumber = 0 } = await request.json()
    
    // Get the last 20 questions to avoid repetition
    const { data: recentQuestions } = await supabase
      .from('recent_questions')
      .select('question_text, difficulty')
      .order('asked_at', { ascending: false })
      .limit(20)
    
    const recentQuestionsList = recentQuestions?.map(q => `- ${q.question_text} (${q.difficulty})`) || []
    const avoidList = recentQuestionsList.length > 0 
      ? `\n\nDO NOT generate any of these recently asked questions:\n${recentQuestionsList.join('\n')}`
      : ''
    
    const difficulty = getDifficultyForQuestion(questionNumber)
    
    const difficultyDescriptions = {
      easy: 'Very easy - common knowledge that most people would know (e.g., "Which reindeer had a red shiny nose?" or "What color is Santa\'s suit?")',
      medium: 'Medium difficulty - requires some knowledge of Christmas traditions (e.g., "Where did the Christmas tree tradition originate?" or "What are the names of the three wise men?")',
      hard: 'Hard - obscure facts that only enthusiasts might know (e.g., "What Christmas song was originally written for Thanksgiving?" or "In what country did the tradition of hanging stockings originate?")',
      very_hard: 'Very hard - trivia that would stump most people (e.g., "What year did Christmas become a federal holiday in the United States?" or "What was the first company to use Santa Claus in an advertisement?")'
    }
    
    const prompt = `Generate a single Christmas trivia question with exactly 4 answer choices.

Difficulty level: ${difficulty.toUpperCase()}
${difficultyDescriptions[difficulty]}

Requirements:
- The question should be about Christmas (traditions, history, songs, movies, food, decorations, religious aspects, cultural celebrations, etc.)
- Provide exactly 4 answer options
- Only ONE answer should be correct
- Wrong answers should be plausible but clearly incorrect
- Make the question interesting and fun${avoidList}

Respond in this exact JSON format (no markdown, just raw JSON):
{
  "question": "Your question here?",
  "answers": ["Answer A", "Answer B", "Answer C", "Answer D"],
  "correct": 0,
  "difficulty": "${difficulty}"
}

Where "correct" is the index (0-3) of the correct answer.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a Christmas trivia expert who creates fun and educational trivia questions. Always respond with valid JSON only, no markdown formatting.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.9, // Higher temperature for more variety
      max_tokens: 500,
    })

    const responseText = completion.choices[0]?.message?.content?.trim() || ''
    
    // Parse the JSON response
    let questionData
    try {
      // Remove any markdown code blocks if present
      const cleanJson = responseText.replace(/```json\n?|\n?```/g, '').trim()
      questionData = JSON.parse(cleanJson)
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', responseText)
      throw new Error('Failed to parse question data')
    }
    
    // Validate the response
    if (!questionData.question || !Array.isArray(questionData.answers) || questionData.answers.length !== 4) {
      throw new Error('Invalid question format from OpenAI')
    }
    
    // Store the question in recent_questions
    await supabase.from('recent_questions').insert({
      question_text: questionData.question,
      difficulty: questionData.difficulty || difficulty,
      answers: questionData.answers,
      correct_index: questionData.correct,
    })
    
    // Clean up old questions (keep only last 50)
    const { data: oldQuestions } = await supabase
      .from('recent_questions')
      .select('id')
      .order('asked_at', { ascending: false })
      .range(50, 1000)
    
    if (oldQuestions && oldQuestions.length > 0) {
      const idsToDelete = oldQuestions.map(q => q.id)
      await supabase.from('recent_questions').delete().in('id', idsToDelete)
    }
    
    return NextResponse.json({
      question: questionData.question,
      answers: questionData.answers,
      correct: questionData.correct,
      difficulty: questionData.difficulty || difficulty,
    })
    
  } catch (error) {
    console.error('Error generating question:', error)
    
    // Fallback to a random static question if OpenAI fails
    const fallbackQuestions = [
      { question: "What is the name of the Grinch's dog?", answers: ["Max", "Buddy", "Rex", "Spot"], correct: 0, difficulty: 'easy' },
      { question: "In which country did the tradition of putting up a Christmas tree originate?", answers: ["England", "Germany", "France", "Sweden"], correct: 1, difficulty: 'medium' },
      { question: "What Christmas song was originally written for Thanksgiving?", answers: ["White Christmas", "Jingle Bells", "Winter Wonderland", "Silver Bells"], correct: 1, difficulty: 'hard' },
      { question: "What year did Coca-Cola start using Santa in advertisements?", answers: ["1915", "1931", "1942", "1950"], correct: 1, difficulty: 'very_hard' },
    ]
    
    const fallback = fallbackQuestions[Math.floor(Math.random() * fallbackQuestions.length)]
    return NextResponse.json(fallback)
  }
}

