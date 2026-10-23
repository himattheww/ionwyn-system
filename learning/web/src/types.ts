export type Level = 'pemula' | 'menengah' | 'mahir'
export type TrackStatus = 'aktif' | 'selesai' | 'arsip'
export type TopicStatus = 'belum' | 'sedang' | 'selesai' | 'sudah_bisa'
export type Difficulty = 'mudah' | 'sedang' | 'sulit'
export type StudyCaseStatus = 'belum' | 'dikerjakan' | 'selesai'

export type Source = { title: string; url: string }

export type TrackSummary = {
  id: number
  goal: string
  currentLevel: Level
  hoursPerWeek: number
  status: TrackStatus
  topicCount: number
  topicsDone: number
  minutesThisWeek: number
}

export type PlannedTopic = {
  title: string
  objective: string
  estSessions: number
  prerequisites: string[]
  sources: Source[]
}

export type DraftTopic = PlannedTopic & { key: number; known: boolean }

export type TrackDetail = {
  id: number
  goal: string
  currentLevel: Level
  hoursPerWeek: number
  domainHint: string | null
  status: TrackStatus
  createdAt: string
  minutesThisWeek: number
  topics: {
    id: number
    order: number
    title: string
    objective: string
    status: TopicStatus
    estSessions: number
    prerequisites: string[]
    hasLesson: boolean
    studyCase: { status: StudyCaseStatus; difficulty: Difficulty } | null
  }[]
  sessions: {
    id: number
    topicId: number | null
    topicTitle: string | null
    occurredAt: string
    durationMin: number
    summary: string
  }[]
}

export type StudyCase = {
  id: number
  title: string
  scenario: string
  requirements: string[]
  acceptanceCriteria: string[]
  stretchGoals: string[]
  difficulty: Difficulty
  estSessions: number
  status: StudyCaseStatus
  resultLink: string | null
  createdAt: string
}

export type TopicDetail = {
  id: number
  order: number
  title: string
  objective: string
  status: TopicStatus
  estSessions: number
  prerequisites: string[]
  sources: Source[]
  track: { id: number; goal: string }
  studyCase: StudyCase | null
  lesson: Lesson | null
  lastAttempt: Attempt | null
}

export type ExerciseLanguage = 'javascript' | 'typescript' | 'python' | 'csharp' | 'sql' | 'lainnya'

export type ExerciseTest = { name: string; call: string; expected: string }

export type Lesson = {
  summary: string
  exercise: { language: ExerciseLanguage; title: string; prompt: string; starter: string; tests: ExerciseTest[]; rubric: string[] }
  createdAt: string
}

export type Attempt = {
  id: number
  score: number
  total: number
  passed: boolean
  code: string | null
  feedback: string | null
  createdAt: string
}

export type CodeResult = { passed: boolean; score: number; total: number; feedback?: string; lastAttempt: Attempt | null }

export type TestOutcome = { name: string; passed: boolean; actual: string; error: string | null }
