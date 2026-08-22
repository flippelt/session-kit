import { withFrontmatter } from '../frontmatter.js'
import type { Kit } from '../schema.js'
import type { EmittedFile } from '../types.js'

export function emitPress(kit: Kit): EmittedFile[] {
  return (kit.handouts ?? []).map((handout) => {
    const meta: Record<string, unknown> = { template: handout.template }
    if (handout.size !== undefined) meta.size = handout.size
    meta.title = handout.title
    if (handout.from !== undefined) meta.from = handout.from
    if (handout.to !== undefined) meta.to = handout.to
    if (handout.date !== undefined) meta.date = handout.date
    if (handout.seal !== undefined) meta.seal = handout.seal
    if (handout.qr !== undefined) meta.qr = handout.qr
    if (handout.eyebrow !== undefined) meta.eyebrow = handout.eyebrow
    return {
      path: `press/${handout.slug}.md`,
      content: withFrontmatter(meta, handout.body),
    }
  })
}
