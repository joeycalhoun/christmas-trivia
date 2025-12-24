export interface TriviaQuestion {
  question: string
  answers: string[]
  correct: number
}

export const triviaQuestions: TriviaQuestion[] = [
  {
    question: "What is the name of the Grinch's dog?",
    answers: ["Max", "Spot", "Rover", "Buddy"],
    correct: 0
  },
  {
    question: "In which country did the tradition of Christmas trees originate?",
    answers: ["England", "Germany", "France", "Norway"],
    correct: 1
  },
  {
    question: "What plant is traditionally hung for people to kiss under?",
    answers: ["Holly", "Ivy", "Mistletoe", "Poinsettia"],
    correct: 2
  },
  {
    question: "How many reindeer pull Santa's sleigh (including Rudolph)?",
    answers: ["6", "7", "8", "9"],
    correct: 3
  },
  {
    question: "What is the best-selling Christmas song of all time?",
    answers: ["Jingle Bells", "White Christmas", "Silent Night", "Last Christmas"],
    correct: 1
  },
  {
    question: "In 'Home Alone', where is Kevin's family flying to for Christmas?",
    answers: ["London", "Rome", "Paris", "Madrid"],
    correct: 2
  },
  {
    question: "What color is the Grinch?",
    answers: ["Blue", "Purple", "Green", "Red"],
    correct: 2
  },
  {
    question: "What is Frosty the Snowman's nose made of?",
    answers: ["Carrot", "Coal", "Button", "Corn Cob"],
    correct: 2
  },
  {
    question: "Which reindeer has a red nose?",
    answers: ["Dasher", "Dancer", "Rudolph", "Prancer"],
    correct: 2
  },
  {
    question: "What do children traditionally leave out for Santa?",
    answers: ["Cake & Tea", "Cookies & Milk", "Pie & Coffee", "Candy & Juice"],
    correct: 1
  },
  {
    question: "What Christmas movie features 'You'll shoot your eye out!'?",
    answers: ["Elf", "A Christmas Story", "Home Alone", "The Polar Express"],
    correct: 1
  },
  {
    question: "What is Scrooge's dead business partner's name in A Christmas Carol?",
    answers: ["Bob Cratchit", "Jacob Marley", "Fred", "Tiny Tim"],
    correct: 1
  },
  {
    question: "What gift did the Little Drummer Boy give to baby Jesus?",
    answers: ["Gold", "A Song", "Myrrh", "Frankincense"],
    correct: 1
  },
  {
    question: "In the movie 'Elf', what food group do elves try to stick to?",
    answers: ["Vegetables", "Candy", "Meat", "Dairy"],
    correct: 1
  },
  {
    question: "What's the name of the main villain in 'The Nightmare Before Christmas'?",
    answers: ["Oogie Boogie", "Jack Skellington", "Dr. Finkelstein", "The Mayor"],
    correct: 0
  }
]

export const QUESTION_TIME_SECONDS = 20
export const REVEAL_TIME_SECONDS = 5

