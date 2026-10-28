export type Level = 'pemula' | 'menengah' | 'mahir'
export type TrackKind = 'coding' | 'praktik'
export type TrackStatus = 'aktif' | 'selesai' | 'arsip'
export type TopicStatus = 'belum' | 'sedang' | 'selesai' | 'sudah_bisa'

export type Source = { title: string; url: string }

export type TrackSummary = {
  id: number
  goal: string
  kind: TrackKind
  currentLevel: Level
  hoursPerWeek: number
  status: TrackStatus
  topicCount: number
  topicsDone: number
  minutesThisWeek: number
}

export type TrackTopic = {
  id: number
  order: number
  title: string
  objective: string
  status: TopicStatus
  estSessions: number
  prerequisites: string[]
  hasContent: boolean
  exerciseType: 'code' | 'praktik' | null
  completedAt: string | null
}

export type TrackDetail = {
  id: number
  goal: string
  kind: TrackKind
  currentLevel: Level
  hoursPerWeek: number
  status: TrackStatus
  createdAt: string
  minutesThisWeek: number
  topics: TrackTopic[]
  sessions: {
    id: number
    topicId: number | null
    topicTitle: string | null
    occurredAt: string
    durationMin: number
    summary: string
  }[]
}

export type ExerciseTest = { name: string; call: string; expected: string }

export type Exercise =
  | { type: 'code'; title: string; prompt: string; language: string; starter: string; tests: ExerciseTest[]; checklist: string[] }
  | { type: 'praktik'; title: string; prompt: string; checklist: string[] }

export type TopicDetail = {
  id: number
  order: number
  title: string
  objective: string
  status: TopicStatus
  estSessions: number
  prerequisites: string[]
  sources: Source[]
  summary: string | null
  exercise: Exercise | null
  completedAt: string | null
  track: { id: number; goal: string; kind: TrackKind }
  lastAttempt: { score: number; total: number; passed: boolean; code: string | null; createdAt: string } | null
  nextTopic: { id: number; title: string } | null
}

export type CompleteResult = { trackDone: boolean; nextTopic: { id: number; title: string } | null }

export type TestOutcome = { name: string; passed: boolean; actual: string; error: string | null }
