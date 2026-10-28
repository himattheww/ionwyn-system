export const attributeKeys = ['stamina', 'intelek', 'kebijaksanaan', 'disiplin', 'kekayaan'] as const

export type Attribute = (typeof attributeKeys)[number]

export const attributeNames: Record<Attribute, string> = {
  stamina: 'Stamina',
  intelek: 'Intelek',
  kebijaksanaan: 'Kebijaksanaan',
  disiplin: 'Disiplin',
  kekayaan: 'Kekayaan'
}

export interface SourceEvent {
  id: string
  source: string
  type: string
  date: string
  value: number
  meta: Record<string, unknown>
}

export interface ExpEntry {
  date: string
  attribute: Attribute
  source: string
  rule: string
  group: string
  eventId: string | null
  note: string
  raw: number
  awarded: number
  capped: number
}

export interface Quest {
  id: string
  week: string
  kind: 'runs' | 'minutes' | 'nights'
  attribute: Attribute
  label: string
  target: number
  progress: number
  doneDate: string | null
}

export interface HistoryItem {
  date: string
  kind: 'level' | 'tier' | 'attribute' | 'class' | 'subclass' | 'achievement' | 'quest'
  text: string
}

export interface AttributeState {
  key: Attribute
  name: string
  exp: number
  level: number
  levelExp: number
  levelNeed: number
  exp30: number
  score: number
}

export interface CharacterState {
  today: string
  totalExp: number
  level: number
  levelExp: number
  levelNeed: number
  tier: string
  attributes: AttributeState[]
  classKey: string
  className: string
  subclassKey: string | null
  subclassName: string | null
  specialization: string | null
  title: string
  streak: { current: number; best: number }
  achievements: Record<string, string>
  quests: Quest[]
  questsDone: { id: string; label: string }[]
}

export interface Adapter {
  name: string
  label: string
  enabled: boolean
  read: () => Promise<SourceEvent[]>
}
