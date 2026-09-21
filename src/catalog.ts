import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { loadKitFile } from './load.js'
import type { Kit } from './schema.js'
import { mergeSystems, type KnownSystem } from './systems.js'

export type CatalogCampaign = {
  dir: string
  id: string
  name: string
  theme?: string
  emoji?: string
  summary?: string
  order?: number
  system?: string
  genre?: Kit['genre']
}

export type KitRef = {
  rel: string
  kit: Kit
}

/** `mirrus/o-comeco-do-fim/kit.yaml` → `mirrus`. */
export function campaignDirOf(rel: string): string | undefined {
  const parts = rel.split(/[\\/]/).filter(Boolean)
  if (parts.length >= 3 && parts[parts.length - 1] === 'kit.yaml') {
    return parts[parts.length - 3]
  }
  return undefined
}

export function kitLabel(kit: Kit): string {
  const title = kit.title || kit.id
  const camp = kit.campaign?.name || kit.campaign?.id || ''
  const sys = kit.system ? ` (${kit.system})` : ''
  const head = camp ? `${camp} — ${title}` : title
  return `${head}${sys}`.replace(/\t/g, ' ')
}

function applySibling(kit: Kit, sibling: Kit): Kit {
  const next: Kit = {
    ...kit,
    campaign: { ...sibling.campaign },
  }
  if (sibling.system) next.system = sibling.system
  if (sibling.genre) next.genre = sibling.genre
  if (sibling.era) next.era = { ...sibling.era }
  return next
}

export function siblingKitFiles(kitFile: string): string[] {
  const abs = path.resolve(kitFile)
  const campaignDir = path.dirname(path.dirname(abs))
  let entries
  try {
    entries = readdirSync(campaignDir, { withFileTypes: true })
  } catch {
    return []
  }
  const out: string[] = []
  for (const ent of entries) {
    if (!ent.isDirectory()) continue
    const yaml = path.join(campaignDir, ent.name, 'kit.yaml')
    if (existsSync(yaml) && path.resolve(yaml) !== abs) out.push(yaml)
  }
  return out.sort((a, b) => a.localeCompare(b))
}

export function inheritFromSiblings(kit: Kit, kitFile: string): Kit {
  for (const file of siblingKitFiles(kitFile)) {
    try {
      return applySibling(kit, loadKitFile(file))
    } catch {
      continue
    }
  }
  return kit
}

export function catalogFromKits(items: KitRef[]): {
  campaigns: CatalogCampaign[]
  systems: KnownSystem[]
} {
  const byDir = new Map<string, CatalogCampaign>()
  const used = new Set<string>()
  const sorted = [...items].sort((a, b) => a.rel.localeCompare(b.rel))
  for (const item of sorted) {
    if (item.kit.system) used.add(item.kit.system)
    const dir = campaignDirOf(item.rel)
    if (!dir || byDir.has(dir)) continue
    const campaign: CatalogCampaign = {
      dir,
      id: item.kit.campaign.id,
      name: item.kit.campaign.name,
    }
    if (item.kit.campaign.theme !== undefined) campaign.theme = item.kit.campaign.theme
    if (item.kit.campaign.emoji !== undefined) campaign.emoji = item.kit.campaign.emoji
    if (item.kit.campaign.summary !== undefined) campaign.summary = item.kit.campaign.summary
    if (item.kit.campaign.order !== undefined) campaign.order = item.kit.campaign.order
    if (item.kit.system) campaign.system = item.kit.system
    if (item.kit.genre) campaign.genre = item.kit.genre
    byDir.set(dir, campaign)
  }
  const campaigns = [...byDir.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt'))
  return { campaigns, systems: mergeSystems(used) }
}
