import { toJson } from '../json.js'
import type { Kit } from '../schema.js'
import type { EmittedFile } from '../types.js'

export function emitGmcr(kit: Kit): EmittedFile[] {
  const campaign = {
    id: kit.id,
    title: kit.title,
    genre: kit.genre ?? 'generic',
    era: {
      startYear: kit.era?.startYear ?? 0,
      label: kit.era?.label ?? kit.date ?? '—',
    },
    ...(kit.system ? { system: kit.system } : {}),
    scenes: kit.scenes ?? [],
    audio: [] as const,
    shortcuts: [] as const,
  }
  return [{ path: `gmcr/${kit.id}.json`, content: toJson(campaign) }]
}
