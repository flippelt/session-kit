import { withFrontmatter } from '../frontmatter.js'
import type { Kit } from '../schema.js'
import type { EmittedFile } from '../types.js'

export function emitLancer(kit: Kit): EmittedFile[] {
  const mission = kit.lancer?.mission
  if (!mission) return []

  const files: EmittedFile[] = []
  const missionMeta: Record<string, unknown> = { slug: mission.slug, name: mission.name }
  if (mission.status !== undefined) missionMeta.status = mission.status
  files.push({
    path: `lancer/missions/${mission.slug}.md`,
    content: withFrontmatter(missionMeta, mission.body),
  })

  for (const event of kit.lancer?.events ?? []) {
    const meta: Record<string, unknown> = { slug: event.slug, name: event.name }
    if (event.status !== undefined) meta.status = event.status
    files.push({
      path: `lancer/events/${event.slug}.md`,
      content: withFrontmatter(meta, event.body),
    })
  }

  return files
}
