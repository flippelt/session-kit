import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  campaignDirOf,
  catalogFromKits,
  inheritFromSiblings,
  kitLabel,
} from './catalog.js'
import { dumpKit } from './dump.js'
import { parseKit } from './load.js'
import { KNOWN_SYSTEMS } from './systems.js'

const tmpDirs: string[] = []

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'session-kit-catalog-'))
  tmpDirs.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(tmpDirs.splice(0).map((d) => rm(d, { recursive: true, force: true })))
})

describe('campaignDirOf', () => {
  it('lê campanha/encontro/kit.yaml', () => {
    expect(campaignDirOf('mirrus/o-comeco-do-fim/kit.yaml')).toBe('mirrus')
    expect(campaignDirOf('chuva-de-solstício/a-descida/kit.yaml')).toBe('chuva-de-solstício')
  })

  it('ignora kit solto ou raso demais', () => {
    expect(campaignDirOf('kit.yaml')).toBeUndefined()
    expect(campaignDirOf('mirrus/kit.yaml')).toBeUndefined()
  })
})

describe('catalogFromKits', () => {
  it('agrupa campanhas pelo diretório e junta sistemas usados', () => {
    const { campaigns, systems } = catalogFromKits([
      {
        rel: 'mirrus/a/kit.yaml',
        kit: parseKit({
          id: 'a',
          title: 'Um',
          system: 'dnd5e-2024',
          campaign: { id: 'mirrus', name: 'Crônicas de Mirrus', emoji: '🌍' },
        }),
      },
      {
        rel: 'chuva/dois/kit.yaml',
        kit: parseKit({
          id: 'dois',
          title: 'Dois',
          system: 'lancer',
          genre: 'sci-fi',
          campaign: { id: 'chuva', name: 'Operação Chuva' },
        }),
      },
      {
        rel: 'mirrus/z/kit.yaml',
        kit: parseKit({
          id: 'z',
          title: 'Três',
          system: 'homebrew',
          campaign: { id: 'mirrus', name: 'Ignorado' },
        }),
      },
    ])
    expect(campaigns.map((c) => c.dir)).toEqual(['mirrus', 'chuva'])
    const mirrus = campaigns.find((c) => c.dir === 'mirrus')
    expect(mirrus).toMatchObject({
      id: 'mirrus',
      name: 'Crônicas de Mirrus',
      emoji: '🌍',
      system: 'dnd5e-2024',
    })
    expect(systems.find((s) => s.id === 'dnd5e-2024')?.label).toBe('D&D 5e (2024)')
    expect(systems.find((s) => s.id === 'lancer')?.label).toBe('Lancer')
    expect(systems.find((s) => s.id === 'homebrew')).toEqual({ id: 'homebrew', label: 'homebrew' })
    expect(systems.length).toBe(KNOWN_SYSTEMS.length + 1)
  })
})

describe('kitLabel', () => {
  it('junta campanha, título e sistema', () => {
    const kit = parseKit({
      id: 'um',
      title: 'O Começo do Fim',
      system: 'dnd5e-2024',
      campaign: { id: 'mirrus', name: 'Crônicas de Mirrus' },
    })
    expect(kitLabel(kit)).toBe('Crônicas de Mirrus — O Começo do Fim (dnd5e-2024)')
  })
})

describe('inheritFromSiblings', () => {
  it('copia campanha, sistema, gênero e era do irmão', async () => {
    const root = await tempDir()
    const sibling = path.join(root, 'mirrus', 'um', 'kit.yaml')
    const next = path.join(root, 'mirrus', 'dois', 'kit.yaml')
    await mkdir(path.dirname(sibling), { recursive: true })
    await mkdir(path.dirname(next), { recursive: true })
    const source = parseKit({
      id: 'um',
      title: 'Um',
      system: 'dnd5e-2024',
      genre: 'fantasy',
      era: { startYear: 3100, label: 'Era da Redenção' },
      campaign: { id: 'mirrus', name: 'Crônicas de Mirrus', emoji: '🌍' },
    })
    await writeFile(sibling, dumpKit(source))
    const inherited = inheritFromSiblings(
      parseKit({
        id: 'dois',
        title: 'Dois',
        campaign: { id: 'mirrus', name: 'Mirrus' },
      }),
      next,
    )
    expect(inherited.campaign).toEqual(source.campaign)
    expect(inherited.system).toBe('dnd5e-2024')
    expect(inherited.genre).toBe('fantasy')
    expect(inherited.era).toEqual({ startYear: 3100, label: 'Era da Redenção' })
    expect(inherited.id).toBe('dois')
    expect(inherited.title).toBe('Dois')
  })
})
