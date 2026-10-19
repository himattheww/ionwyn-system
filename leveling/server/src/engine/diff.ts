import type { Rules } from '../rules.ts'
import type { CharacterState } from '../types.ts'

export function changesBetween(previous: CharacterState, next: CharacterState, rules: Rules) {
  const lines: string[] = []
  if (next.level > previous.level) lines.push(`Level naik: ${previous.level} → ${next.level}`)
  if (next.tier !== previous.tier) lines.push(`Tingkatan baru: ${next.tier}`)
  for (const attribute of next.attributes) {
    const before = previous.attributes.find(a => a.key === attribute.key)
    if (before && attribute.level > before.level) lines.push(`${attribute.name} naik ke level ${attribute.level}`)
  }
  if (next.classKey !== previous.classKey) lines.push(`Kelas: ${previous.className} → ${next.className}`)
  if (next.subclassKey !== previous.subclassKey) lines.push(`Subkelas: ${previous.subclassName ?? 'tanpa subkelas'} → ${next.subclassName ?? 'tanpa subkelas'}`)
  for (const id of Object.keys(next.achievements)) {
    if (!previous.achievements[id]) lines.push(`Achievement: ${rules.achievements.find(a => a.id === id)?.name ?? id}`)
  }
  const doneBefore = new Set(previous.questsDone.map(q => q.id))
  for (const quest of next.questsDone) {
    if (!doneBefore.has(quest.id)) lines.push(`Quest selesai: ${quest.label}`)
  }
  return lines
}
