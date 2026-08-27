import path from 'node:path'
import { stringify } from 'yaml'
import { KitError } from './errors.js'
import { parseKit } from './load.js'
import type { Kit } from './schema.js'
import { slugify } from './slugify.js'

const ROOT_KEYS = [
  'id',
  'title',
  'system',
  'genre',
  'era',
  'campaign',
  'date',
  'location',
  'scenes',
  'entries',
  'parties',
  'party',
  'quests',
  'briefing',
  'terminal',
  'handouts',
  'lancer',
] as const

export function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (value === '') return true
  if (Array.isArray(value) && value.length === 0) return true
  if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value as object).length === 0) {
    return true
  }
  return false
}

export function pruneEmpty(value: unknown, keepBlankStrings = false): unknown {
  if (Array.isArray(value)) {
    return value
      .map((item) => pruneEmpty(item, true))
      .filter((item) => {
        if (item === undefined || item === null) return false
        if (typeof item === 'object') return !isEmpty(item)
        return true
      })
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      const cleaned = pruneEmpty(nested)
      if (!isEmpty(cleaned)) out[key] = cleaned
    }
    return out
  }
  return value === '' && !keepBlankStrings ? undefined : value
}

export function orderKit(kit: Kit): Record<string, unknown> {
  const pruned = pruneEmpty(kit) as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const key of ROOT_KEYS) {
    if (key in pruned && !isEmpty(pruned[key])) out[key] = pruned[key]
  }
  for (const [key, nested] of Object.entries(pruned)) {
    if (!(key in out) && !isEmpty(nested)) out[key] = nested
  }
  return out
}

export function dumpKit(kit: Kit): string {
  const yaml = stringify(orderKit(kit), {
    indent: 2,
    lineWidth: 0,
    blockQuote: 'literal',
    collectionStyle: 'block',
  })
  return yaml.endsWith('\n') ? yaml : `${yaml}\n`
}

export function emptyKit(): Kit {
  return parseKit({
    id: 'nova-sessao',
    title: 'Nova sessão',
    campaign: { id: 'campanha', name: 'Nova campanha' },
  })
}

function unslug(input: string): string {
  const text = input.replace(/-/g, ' ').trim()
  if (!text) return ''
  return text.replace(/\S+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1))
}

/** `kits/mirrus/s03e01` → campanha mirrus, encontro s03e01. Um segmento só → campanha genérica. */
export function kitFromDir(dir: string): Kit {
  const segs = dir.split(/[\\/]/).filter((s) => s && s !== '.' && s !== '..')
  const encounter = segs[segs.length - 1] || 'nova-sessao'
  const campaign = segs.length >= 2 ? segs[segs.length - 2]! : 'campanha'
  const id = slugify(encounter) || 'nova-sessao'
  const campaignId = slugify(campaign) || 'campanha'
  return parseKit({
    id,
    title: unslug(encounter) || 'Nova sessão',
    campaign: {
      id: campaignId,
      name: unslug(campaign) || 'Nova campanha',
    },
  })
}

export function kitFromPath(file: string): Kit {
  return kitFromDir(path.dirname(path.resolve(file)))
}

export function kitFromUnknown(raw: unknown): Kit {
  if (raw === null || raw === undefined || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new KitError('O kit deve ser um objeto.')
  }
  return parseKit(pruneEmpty(raw))
}
