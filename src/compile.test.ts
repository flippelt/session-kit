import { access, mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'
import { afterEach, describe, expect, it } from 'vitest'
import { runCli } from './command.js'
import { compileKit, parseEmitList, writeCompile } from './compile.js'
import { KitError } from './errors.js'
import { loadKitFile, parseKit, parseKitYaml } from './load.js'
import type { Kit } from './schema.js'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))
const exampleKitPath = path.join(repoRoot, 'examples/valdoran-cerco/kit.yaml')

const tmpDirs: string[] = []

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'session-kit-'))
  tmpDirs.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(tmpDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

function frontmatter(text: string): unknown {
  const match = text.match(/^---\n([\s\S]*?)\n---/)
  expect(match).toBeTruthy()
  return parseYaml(match![1]!)
}

describe('validate', () => {
  it('aceita o kit de exemplo', () => {
    const kit = loadKitFile(exampleKitPath)
    expect(kit.id).toBe('valdoran-cerco')
    expect(kit.title).toBe('O Cerco de Pedravale')
    expect(kit.campaign.id).toBe('valdoran')
  })

  it('rejeita kit sem id, title ou campaign', () => {
    const missing = (raw: unknown) => {
      try {
        parseKit(raw)
        throw new Error('deveria ter falhado')
      } catch (e) {
        expect(e).toBeInstanceOf(KitError)
        return (e as KitError).message
      }
    }

    const noId = missing({ title: 'T', campaign: { id: 'c', name: 'C' } })
    expect(noId).toMatch(/id/)
    expect(noId).toMatch(/obrigatório/)

    const noTitle = missing({ id: 'x', campaign: { id: 'c', name: 'C' } })
    expect(noTitle).toMatch(/title/)

    const noCampaign = missing({ id: 'x', title: 'T' })
    expect(noCampaign).toMatch(/campaign/)
  })

  it('ignora chaves extra', () => {
    const kit = parseKit({
      id: 'x',
      title: 'T',
      campaign: { id: 'c', name: 'C' },
      extra: true,
      notaDoMestre: 'não vaza',
    })
    expect(kit.id).toBe('x')
    expect(kit).not.toHaveProperty('extra')
    expect(kit).not.toHaveProperty('notaDoMestre')
  })
})

describe('compile', () => {
  it('gera arquivos-chave e JSON/YAML parseáveis', async () => {
    const kit = loadKitFile(exampleKitPath)
    const out = await tempDir()
    const written = await writeCompile(kit, out)

    const expected = [
      'briefing/briefing.json',
      'codex/campaigns/valdoran.md',
      'codex/entries/valdoran/events/cerco-de-pedravale.md',
      'codex/entries/valdoran/npcs/mestre-corvo.md',
      'gmcr/valdoran-cerco.json',
      'itr/ibm/vigilia/files/orders.md',
      'itr/ibm/vigilia/files/sealed.dat',
      'itr/ibm/vigilia/scenario.json',
      'press/carta-mestre-corvo.md',
    ]
    for (const rel of expected) {
      expect(written).toContain(rel)
      await access(path.join(out, rel))
    }

    const gmcr = JSON.parse(await readFile(path.join(out, 'gmcr/valdoran-cerco.json'), 'utf8')) as {
      scenes: Array<{ treatment: { kind: string } }>
    }
    expect(gmcr.scenes.length).toBeGreaterThan(0)
    expect(gmcr.scenes.every((s) => typeof s.treatment.kind === 'string')).toBe(true)
    expect(gmcr.scenes[0]?.treatment.kind).toBe('text')

    const campaign = await readFile(path.join(out, 'codex/campaigns/valdoran.md'), 'utf8')
    const campaignFm = frontmatter(campaign) as { name: string; theme: string }
    expect(campaignFm.name).toBe('As Crônicas de Valdoran')
    expect(campaignFm.theme).toBe('fantasy')
    expect(campaign).not.toMatch(/^demo:/m)
    expect(campaign).not.toContain('demo: true')

    const scenario = JSON.parse(await readFile(path.join(out, 'itr/ibm/vigilia/scenario.json'), 'utf8')) as {
      id: string
      files?: unknown
    }
    expect(scenario.id).toBe('vigilia')
    expect(scenario).not.toHaveProperty('files')

    JSON.parse(await readFile(path.join(out, 'briefing/briefing.json'), 'utf8'))
  })

  it('arquivo ITR locked começa com --- e contém locked: true', async () => {
    const kit = loadKitFile(exampleKitPath)
    const out = await tempDir()
    await writeCompile(kit, out)
    const sealed = await readFile(path.join(out, 'itr/ibm/vigilia/files/sealed.dat'), 'utf8')
    expect(sealed.startsWith('---')).toBe(true)
    expect(sealed).toContain('locked: true')
    const meta = frontmatter(sealed) as { locked: boolean; password: string }
    expect(meta.locked).toBe(true)
    expect(meta.password).toBe('FENDA-12')
  })

  it('briefing.json tem guildName e quests', async () => {
    const kit = loadKitFile(exampleKitPath)
    const out = await tempDir()
    await writeCompile(kit, out)
    const briefing = JSON.parse(await readFile(path.join(out, 'briefing/briefing.json'), 'utf8')) as {
      version: number
      guildName: string
      quests: unknown[]
      party: Array<{ source: string; classes: unknown[]; level: number }>
    }
    expect(briefing.version).toBe(1)
    expect(briefing.guildName).toBe('Casa Pedravale')
    expect(briefing.quests.length).toBeGreaterThan(0)
    expect(briefing.party[0]?.source).toBe('manual')
    expect(Array.isArray(briefing.party[0]?.classes)).toBe(true)
    expect(briefing.party[0]?.level).toBe(5)
  })

  it('press letter markdown tem template: letter', async () => {
    const kit = loadKitFile(exampleKitPath)
    const out = await tempDir()
    await writeCompile(kit, out)
    const letter = await readFile(path.join(out, 'press/carta-mestre-corvo.md'), 'utf8')
    expect(letter).toContain('template: letter')
    const meta = frontmatter(letter) as { template: string; title: string }
    expect(meta.template).toBe('letter')
    expect(meta.title).toBe('Missiva do Conselheiro')
  })

  it('--emit gmcr não escreve codex', async () => {
    const kit = loadKitFile(exampleKitPath)
    const out = await tempDir()
    const written = await writeCompile(kit, out, ['gmcr'])
    expect(written).toEqual(['gmcr/valdoran-cerco.json'])
    await access(path.join(out, 'gmcr/valdoran-cerco.json'))
    await expect(access(path.join(out, 'codex/campaigns/valdoran.md'))).rejects.toThrow()
    await expect(access(path.join(out, 'briefing/briefing.json'))).rejects.toThrow()
  })

  it('rejeita path traversal em terminal.files.path', () => {
    expect(() =>
      parseKitYaml(`
id: x
title: T
campaign:
  id: c
  name: C
terminal:
  theme: ibm
  id: box
  name: Box
  files:
    - path: ../x
      content: nope
`),
    ).toThrow(/inseguro|path traversal/)

    const kit = loadKitFile(exampleKitPath)
    const hijacked = {
      ...kit,
      terminal: {
        ...kit.terminal!,
        files: [{ path: '../x', content: 'nope' }],
      },
    } as Kit
    expect(() => compileKit(hijacked)).toThrow(/inseguro/)
  })

  it('rejeita chaves --emit desconhecidas', () => {
    expect(() => parseEmitList('gmcr,foo')).toThrow(/desconhecido/)
  })
})

describe('cli', () => {
  it('validate aceita o exemplo', async () => {
    const lines: string[] = []
    const code = await runCli(['validate', exampleKitPath], {
      stdout: (l) => lines.push(l.trimEnd()),
      stderr: () => {},
      cwd: repoRoot,
    })
    expect(code).toBe(0)
    expect(lines.join('\n')).toMatch(/Kit válido: valdoran-cerco/)
  })

  it('compile --emit gmcr lista só o json do gmcr', async () => {
    const out = await tempDir()
    const lines: string[] = []
    const errs: string[] = []
    const code = await runCli(['compile', exampleKitPath, '--out', out, '--emit', 'gmcr'], {
      stdout: (l) => lines.push(l.trimEnd()),
      stderr: (l) => errs.push(l.trimEnd()),
      cwd: repoRoot,
    })
    expect(code).toBe(0)
    expect(errs).toEqual([])
    expect(lines).toEqual(['gmcr/valdoran-cerco.json'])
    await expect(access(path.join(out, 'codex'))).rejects.toThrow()
  })
})
