import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { z } from 'zod'

const count = z.number().nonnegative()
const range = z.object({ min: count, max: count })
const attributeRule = z.object({ dailyCap: count.nullable(), target30d: z.number().positive() })

export const rulesSchema = z.object({
  attributes: z.object({
    stamina: attributeRule,
    intelek: attributeRule,
    kebijaksanaan: attributeRule,
    disiplin: attributeRule,
    kekayaan: attributeRule
  }),
  stamina: z.object({
    activityTypes: z.object({
      run: z.array(z.string()),
      strength: z.array(z.string()),
      swim: z.array(z.string()),
      ignore: z.array(z.string())
    }),
    run: z.object({ base: count, perKm: count, dailyCap: count, scheduledBonus: count, weeklyLongestBonus: count }),
    strength: z.object({ perSession: count, maxPerDay: count }),
    otherSport: z.object({ perSession: count, maxPerDay: count }),
    sleep: z.object({ minHours: count, exp: count }),
    protein: z.object({ exp: count })
  }),
  intelek: z.object({
    minuteExp: count,
    minuteDailyCap: count,
    studyCaseDone: count,
    topicDone: count,
    trackCategories: z.record(z.string(), z.enum(['pemrograman', 'bahasa', 'lainnya'])),
    doneStatuses: z.object({ topic: z.array(z.string()), studyCase: z.array(z.string()) })
  }),
  kebijaksanaan: z.object({
    entry: count,
    backfilledEntry: count,
    streakBonus: count,
    streakEvery: z.number().int().positive(),
    streakWindowDays: z.number().int().positive(),
    streakMaxMissing: z.number().int().nonnegative()
  }),
  disiplin: z.object({ scheduleItem: count, scheduleDailyCap: count, workday: count, linkedActivityTypes: z.array(z.string()).default([]) }),
  kekayaan: z.object({ financeDay: count, budgetKept: count, stockDay: count }),
  level: z.object({
    overallBase: z.number().positive(),
    overallStep: count,
    attributeBase: z.number().positive(),
    attributeStep: count,
    tiers: z.array(z.object({ name: z.string(), from: z.number().int().positive() })).min(1)
  }),
  class: z.object({
    windowDays: z.number().int().positive(),
    secondRatio: count,
    balancedMinScore: count,
    balancedMaxRatio: z.number().min(1),
    subclassMinShare: count
  }),
  quest: z.object({
    lookbackWeeks: z.number().int().positive(),
    multiplier: count,
    exp: count,
    runs: range,
    minutes: range,
    nights: range
  }),
  achievements: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      kind: z.enum([
        'run_distance',
        'run_long_target',
        'strength_sessions',
        'diary_streak',
        'case_done',
        'topic_done',
        'learn_hours',
        'schedule_items',
        'finance_streak',
        'level'
      ]),
      value: z.number().positive().optional()
    })
  )
})

export type Rules = z.infer<typeof rulesSchema>

export function parseRules(text: string) {
  return {
    rules: rulesSchema.parse(JSON.parse(text)),
    hash: createHash('sha256').update(text).digest('hex')
  }
}

export function loadRules(path: string) {
  const text = readFileSync(path, 'utf8')
  return { text, ...parseRules(text) }
}
