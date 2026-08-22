import { z } from 'zod'
import { isSafeRelPath, isSafeSegment } from './paths.js'

const idString = z
  .string()
  .min(1)
  .refine(isSafeSegment, { message: 'identificador inválido (não use / ou ..)' })

const optionalDate = z
  .union([z.string(), z.date()])
  .transform((v) => (typeof v === 'string' ? v : v.toISOString().slice(0, 10)))
  .optional()

const textTreatment = z.object({
  kind: z.literal('text'),
  text: z.string(),
  variant: z.enum(['typewriter', 'scroll', 'terminal', 'sacred', 'auto']).optional(),
})

const colorTreatment = z.object({
  kind: z.literal('color'),
  color: z.string().min(1),
  label: z.string().optional(),
})

const imageTreatment = z.object({
  kind: z.literal('image'),
  src: z.string().min(1),
  alt: z.string().optional(),
})

const crtTreatment = z.object({
  kind: z.literal('crt'),
  theme: z.enum(['phosphor', 'amber', 'ice']).optional(),
  lines: z.array(z.string()),
})

const sceneSchema = z.object({
  id: idString,
  name: z.string().min(1),
  treatment: z.discriminatedUnion('kind', [textTreatment, colorTreatment, imageTreatment, crtTreatment]),
})

const entrySchema = z.object({
  type: z.enum(['lore', 'npcs', 'characters', 'events', 'maps']),
  slug: idString.optional(),
  title: z.string().min(1),
  emoji: z.string().optional(),
  summary: z.string().optional(),
  tags: z.array(z.string()).optional(),
  status: z.string().optional(),
  faction: z.string().optional(),
  role: z.string().optional(),
  location: z.string().optional(),
  date: optionalDate,
  order: z.number().optional(),
  body: z.string().optional(),
})

const guildSchema = z.object({
  name: z.string().min(1),
  motto: z.string().optional(),
  signer: z.string().optional(),
  role: z.string().optional(),
  signFont: z.string().optional(),
  glyph: z.string().optional(),
  variant: z.number().optional(),
})

const questSchema = z.object({
  id: idString,
  title: z.string().min(1),
  objective: z.string().optional(),
  status: z.enum(['ativa', 'pausada', 'parcial', 'concluida', 'falhou']).optional(),
  reward: z.string().optional(),
  partyId: z.string().optional(),
  adventurerIds: z.array(z.string()).optional(),
  notes: z.string().optional(),
  guild: guildSchema.optional(),
})

const partyGroupSchema = z.object({
  id: idString,
  name: z.string().min(1),
})

const characterClassSchema = z.object({
  name: z.string().min(1),
  level: z.number(),
  subclass: z.string().optional(),
})

const characterSchema = z.object({
  id: idString,
  name: z.string().min(1),
  race: z.string().optional(),
  classes: z.array(characterClassSchema).optional(),
  level: z.number().optional(),
  abilities: z.record(z.string(), z.number()).optional(),
  hp: z.number().optional(),
  maxHp: z.number().optional(),
  ac: z.number().optional(),
  player: z.string().optional(),
  partyId: z.string().optional(),
  backstory: z.string().optional(),
  source: z.enum(['ddb', 'manual']).optional(),
})

const terminalFileSchema = z.object({
  path: z.string().min(1).refine(isSafeRelPath, {
    message: 'caminho inseguro (path traversal)',
  }),
  content: z.string(),
  locked: z.boolean().optional(),
  password: z.union([z.string(), z.number()]).transform((v) => String(v)).optional(),
  crackable: z.boolean().optional(),
  crackDC: z.number().optional(),
  decryptGame: z.boolean().optional(),
  tracer: z.boolean().optional(),
})

const lancerDocSchema = z.object({
  slug: idString,
  name: z.string().min(1),
  status: z.string().optional(),
  body: z.string(),
})

export const KitSchema = z.object({
  id: idString,
  title: z.string().min(1),
  system: z.string().optional(),
  genre: z
    .enum(['fantasy', 'cosmic-horror', 'sci-fi', 'modern', 'post-apocalyptic', 'generic'])
    .optional(),
  era: z
    .object({
      startYear: z.number(),
      label: z.string().optional(),
    })
    .optional(),
  campaign: z.object({
    id: idString,
    name: z.string().min(1),
    theme: z.string().optional(),
    emoji: z.string().optional(),
    summary: z.string().optional(),
    order: z.number().optional(),
  }),
  date: optionalDate,
  location: z.string().optional(),
  scenes: z.array(sceneSchema).optional(),
  entries: z.array(entrySchema).optional(),
  quests: z.array(questSchema).optional(),
  parties: z.array(partyGroupSchema).optional(),
  party: z.array(characterSchema).optional(),
  briefing: z
    .object({
      kind: z.enum(['guild', 'lancer']).optional(),
      guildName: z.string().optional(),
      bootTitle: z.string().optional(),
      crest: z.enum(['fleur', 'd20']).optional(),
    })
    .optional(),
  terminal: z
    .object({
      theme: idString,
      id: idString,
      name: z.string().min(1),
      motd: z.array(z.string()).optional(),
      header: z.string().optional(),
      commands: z.record(z.string(), z.array(z.string())).optional(),
      files: z.array(terminalFileSchema),
    })
    .optional(),
  handouts: z
    .array(
      z.object({
        template: z.enum(['letter', 'poster', 'dataslate', 'plate', 'telegram', 'dossier', 'edict', 'newspaper', 'ticket']),
        slug: idString,
        title: z.string().min(1),
        size: z.enum(['a5', 'a6']).optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        date: optionalDate,
        seal: z.string().optional(),
        qr: z.string().optional(),
        eyebrow: z.string().optional(),
        body: z.string(),
      }),
    )
    .optional(),
  lancer: z
    .object({
      mission: lancerDocSchema.optional(),
      events: z.array(lancerDocSchema).optional(),
    })
    .optional(),
})

export type Kit = z.infer<typeof KitSchema>
