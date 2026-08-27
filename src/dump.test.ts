import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { dumpKit, kitFromDir, pruneEmpty } from './dump.js'
import { loadKitFile, parseKit, parseKitYaml } from './load.js'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))
const exampleKitPath = path.join(repoRoot, 'examples/valdoran-cerco/kit.yaml')

describe('dumpKit', () => {
  it('round-trip do exemplo Valdoran', () => {
    const original = loadKitFile(exampleKitPath)
    const again = parseKitYaml(dumpKit(original))
    expect(again).toEqual(original)
  })

  it('cita :: para o YAML não virar mapping', () => {
    const kit = parseKit({
      id: 'x',
      title: 'T',
      campaign: { id: 'c', name: 'C' },
      terminal: {
        theme: 'ibm',
        id: 't',
        name: 'N',
        motd: ['UPLINK DO OMNICONECTOR :: NMU-PN Rio Grande'],
        files: [{ path: 'a.md', content: 'hi' }],
      },
    })
    const yaml = dumpKit(kit)
    const again = parseKitYaml(yaml)
    expect(again.terminal?.motd?.[0]).toBe('UPLINK DO OMNICONECTOR :: NMU-PN Rio Grande')
    expect(typeof again.terminal?.motd?.[0]).toBe('string')
  })

  it('omite arrays vazios', () => {
    const yaml = dumpKit(
      parseKit({
        id: 'x',
        title: 'T',
        campaign: { id: 'c', name: 'C' },
        scenes: [],
      }),
    )
    expect(yaml).not.toMatch(/^scenes:/m)
  })
})

describe('kitFromDir', () => {
  it('usa campanha/encontro quando há dois segmentos', () => {
    const kit = kitFromDir('kits/mirrus/o-comeco-do-fim')
    expect(kit.id).toBe('o-comeco-do-fim')
    expect(kit.title).toBe('O Comeco Do Fim')
    expect(kit.campaign.id).toBe('mirrus')
    expect(kit.campaign.name).toBe('Mirrus')
  })

  it('um segmento só não herda o cwd como campanha', () => {
    const kit = kitFromDir('encontro-01')
    expect(kit.id).toBe('encontro-01')
    expect(kit.campaign.id).toBe('campanha')
  })
})

describe('pruneEmpty', () => {
  it('não apaga zero nem false', () => {
    const cleaned = pruneEmpty({ hp: 0, locked: false, skip: '', nested: { a: '' } }) as Record<string, unknown>
    expect(cleaned.hp).toBe(0)
    expect(cleaned.locked).toBe(false)
    expect(cleaned).not.toHaveProperty('skip')
    expect(cleaned).not.toHaveProperty('nested')
  })
})
