import { withFrontmatter } from '../frontmatter.js'
import { slugify } from '../slugify.js'
import type { Kit } from '../schema.js'
import type { EmittedFile } from '../types.js'

export function emitCodex(kit: Kit): EmittedFile[] {
  const files: EmittedFile[] = []
  const campaign = kit.campaign
  const campaignMeta: Record<string, unknown> = {
    name: campaign.name,
    theme: campaign.theme ?? 'fantasy',
  }
  if (campaign.emoji !== undefined) campaignMeta.emoji = campaign.emoji
  if (campaign.summary !== undefined) campaignMeta.summary = campaign.summary
  if (campaign.order !== undefined) campaignMeta.order = campaign.order

  files.push({
    path: `codex/campaigns/${campaign.id}.md`,
    content: withFrontmatter(campaignMeta, campaign.summary ?? ''),
  })

  for (const entry of kit.entries ?? []) {
    const slug = entry.slug ?? slugify(entry.title)
    const meta: Record<string, unknown> = { title: entry.title }
    if (entry.emoji !== undefined) meta.emoji = entry.emoji
    if (entry.summary !== undefined) meta.summary = entry.summary
    if (entry.tags !== undefined && entry.tags.length > 0) meta.tags = entry.tags
    if (entry.status !== undefined) meta.status = entry.status
    if (entry.faction !== undefined) meta.faction = entry.faction
    if (entry.role !== undefined) meta.role = entry.role
    if (entry.location !== undefined) meta.location = entry.location
    if (entry.date !== undefined) meta.date = entry.date
    if (entry.order !== undefined) meta.order = entry.order

    files.push({
      path: `codex/entries/${campaign.id}/${entry.type}/${slug}.md`,
      content: withFrontmatter(meta, entry.body ?? ''),
    })
  }

  return files
}
