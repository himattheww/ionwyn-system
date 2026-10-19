import { z } from 'zod'

export const levels = ['pemula', 'menengah', 'mahir'] as const
export const difficulties = ['mudah', 'sedang', 'sulit'] as const
export const trackStatuses = ['aktif', 'selesai', 'arsip'] as const

export const idParam = z.object({ id: z.coerce.number().int().positive() })

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null)

const httpUrl = z.url({ protocol: /^https?$/ })

export const planRequest = z.object({
  goal: z.string().trim().min(2).max(200),
  currentLevel: z.enum(levels),
  hoursPerWeek: z.number().int().min(1).max(80),
  knownTopics: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
  domainHint: optionalText(200),
})

export const saveTrackRequest = z.object({
  goal: z.string().trim().min(2).max(200),
  currentLevel: z.enum(levels),
  hoursPerWeek: z.number().int().min(1).max(80),
  domainHint: optionalText(200),
  topics: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(200),
        objective: z.string().trim().min(1).max(500),
        estSessions: z.number().int().min(1).max(50),
        prerequisites: z.array(z.string().max(200)).max(12),
        sources: z.array(z.object({ title: z.string().trim().min(1).max(200), url: httpUrl })).max(3),
        known: z.boolean(),
      }),
    )
    .min(1)
    .max(12),
})

export const trackStatusRequest = z.object({ status: z.enum(trackStatuses) })

export const studyCaseRequest = z.object({ difficulty: z.enum(difficulties) })

export const completeRequest = z.object({
  resultLink: z.union([httpUrl, z.literal('')]).optional().transform((v) => v || null),
})

export const sessionRequest = z.object({
  trackId: z.number().int().positive(),
  topicId: z.number().int().positive().nullable().optional(),
  occurredAt: z.iso.date(),
  durationMin: z.number().int().min(1).max(1440),
  summary: z.string().trim().min(1).max(200),
})
