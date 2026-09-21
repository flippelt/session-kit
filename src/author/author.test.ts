import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { parseArgv, runCli } from '../command.js'
import { loadKitFile } from '../load.js'
import { KNOWN_SYSTEMS } from '../systems.js'
import { startAuthorServer } from './server.js'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))
const exampleKitPath = path.join(repoRoot, 'examples/valdoran-cerco/kit.yaml')

const tmpDirs: string[] = []

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'session-kit-author-'))
  tmpDirs.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(tmpDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('parseArgv edit/new', () => {
  it('edit --no-open e --create', () => {
    expect(parseArgv(['edit', 'kit.yaml', '--no-open', '--create'])).toEqual({
      cmd: 'edit',
      file: 'kit.yaml',
      create: true,
      open: false,
    })
  })

  it('new lê o diretório', () => {
    expect(parseArgv(['new', 'kits/mirrus/s03e02', '--port', '0', '--no-open'])).toEqual({
      cmd: 'new',
      dir: 'kits/mirrus/s03e02',
      port: 0,
      open: false,
    })
  })

  it('edit sem caminho abre o catálogo', () => {
    expect(parseArgv(['edit', '--no-open'])).toEqual({
      cmd: 'edit',
      create: false,
      open: false,
    })
  })

  it('list aceita pasta opcional', () => {
    expect(parseArgv(['list'])).toEqual({ cmd: 'list' })
    expect(parseArgv(['list', 'kits'])).toEqual({ cmd: 'list', dir: 'kits' })
  })
})

describe('author server', () => {
  it('serve o formulário, grava YAML e compila', async () => {
    const dir = await tempDir()
    const file = path.join(dir, 'kit.yaml')
    await writeFile(file, await readFile(exampleKitPath, 'utf8'))

    const server = await startAuthorServer({ file, cwd: dir, port: 0 })
    try {
      const page = await fetch(server.url)
      expect(page.status).toBe(200)
      expect(await page.text()).toMatch(/session-kit/)

      const loaded = await fetch(new URL('/api/kit', server.url))
      const body = (await loaded.json()) as { kit: { id: string; title: string } }
      expect(body.kit.id).toBe('valdoran-cerco')

      const saved = await fetch(new URL('/api/kit', server.url), {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kit: {
            ...body.kit,
            title: 'O Cerco (editado)',
          },
        }),
      })
      expect(saved.status).toBe(200)
      const onDisk = loadKitFile(file)
      expect(onDisk.title).toBe('O Cerco (editado)')

      const compiled = await fetch(new URL('/api/compile', server.url), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kit: { ...body.kit, title: 'O Cerco (editado)' } }),
      })
      expect(compiled.status).toBe(200)
      const result = (await compiled.json()) as { files: string[]; out: string }
      expect(result.files).toContain('gmcr/valdoran-cerco.json')
      await expect(readFile(path.join(result.out, 'gmcr/valdoran-cerco.json'), 'utf8')).resolves.toMatch(
        /valdoran-cerco/,
      )
    } finally {
      await server.close()
    }
  })

  it('catálogo lista sessões e cria uma nova', async () => {
    const dir = await tempDir()
    const a = path.join(dir, 'mirrus', 'um', 'kit.yaml')
    const b = path.join(dir, 'lancer', 'dois', 'kit.yaml')
    const { mkdir } = await import('node:fs/promises')
    await mkdir(path.dirname(a), { recursive: true })
    await mkdir(path.dirname(b), { recursive: true })
    await writeFile(
      a,
      'id: um\ntitle: Um\nsystem: dnd5e-2024\ncampaign:\n  id: mirrus\n  name: Crônicas de Mirrus\n',
    )
    await writeFile(
      b,
      'id: a-descida\ntitle: A Descida\nsystem: lancer\ncampaign:\n  id: lancer\n  name: Lancer\n',
    )

    const server = await startAuthorServer({ root: dir, cwd: dir, port: 0 })
    try {
      const page = await fetch(server.url)
      const html = await page.text()
      expect(html).toMatch(/Travada|etapas|Editar/)
      expect(html).toMatch(/id="new-camp"/)
      expect(html).toMatch(/Preencher de uma campanha existente/)

      const ws = await fetch(new URL('/api/workspace', server.url))
      const body = (await ws.json()) as {
        mode: string
        sessions: Array<{ rel: string; startUnlocked: boolean; kit: { id: string } }>
        campaigns: Array<{ dir: string; name: string; system?: string }>
        systems: Array<{ id: string; label: string }>
      }
      expect(body.mode).toBe('catalog')
      expect(body.sessions.map((s) => s.kit.id).sort()).toEqual(['a-descida', 'um'])
      expect(body.sessions.every((s) => s.startUnlocked === false)).toBe(true)
      expect(body.campaigns.map((c) => c.dir).sort()).toEqual(['lancer', 'mirrus'])
      expect(body.campaigns.find((c) => c.dir === 'mirrus')).toMatchObject({
        name: 'Crônicas de Mirrus',
        system: 'dnd5e-2024',
      })
      expect(body.systems.length).toBeGreaterThanOrEqual(KNOWN_SYSTEMS.length)
      expect(body.systems.some((s) => s.id === 'lancer')).toBe(true)

      const created = await fetch(new URL('/api/kits', server.url), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dir: 'mirrus/nova' }),
      })
      expect(created.status).toBe(200)
      const made = (await created.json()) as {
        session: { rel: string; startUnlocked: boolean; kit: { campaign: { name: string }; system?: string } }
      }
      expect(made.session.rel).toBe('mirrus/nova/kit.yaml')
      expect(made.session.startUnlocked).toBe(true)
      expect(made.session.kit.campaign.name).toBe('Crônicas de Mirrus')
      expect(made.session.kit.system).toBe('dnd5e-2024')
      const yaml = await readFile(path.join(dir, 'mirrus/nova/kit.yaml'), 'utf8')
      expect(yaml).toMatch(/id: nova/)
      expect(yaml).toMatch(/name: Crônicas de Mirrus/)
      expect(yaml).toMatch(/system: dnd5e-2024/)
    } finally {
      await server.close()
    }
  })

  it('nova campanha aceita nome e sistema no POST', async () => {
    const dir = await tempDir()
    const server = await startAuthorServer({ root: dir, cwd: dir, port: 0 })
    try {
      const created = await fetch(new URL('/api/kits', server.url), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          dir: 'operacao-x/missao-1',
          campaignName: 'Operação X',
          system: 'lancer',
        }),
      })
      expect(created.status).toBe(200)
      const kit = loadKitFile(path.join(dir, 'operacao-x', 'missao-1', 'kit.yaml'))
      expect(kit.campaign).toMatchObject({ id: 'operacao-x', name: 'Operação X' })
      expect(kit.system).toBe('lancer')
      expect(kit.id).toBe('missao-1')
    } finally {
      await server.close()
    }
  })

  it('list imprime campanha, título e sistema', async () => {
    const dir = await tempDir()
    const file = path.join(dir, 'mirrus', 'um', 'kit.yaml')
    const { mkdir } = await import('node:fs/promises')
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(
      file,
      'id: um\ntitle: O Começo\nsystem: dnd5e-2024\ncampaign:\n  id: mirrus\n  name: Crônicas de Mirrus\n',
    )
    const lines: string[] = []
    const errs: string[] = []
    const code = await runCli(['list', dir], {
      stdout: (line) => lines.push(line),
      stderr: (line) => errs.push(line),
      cwd: dir,
    })
    expect(code).toBe(0)
    expect(errs).toEqual([])
    expect(lines.some((l) => l.includes('Crônicas de Mirrus — O Começo (dnd5e-2024)'))).toBe(true)
    expect(lines.some((l) => l.includes('mirrus') && l.includes('kit.yaml'))).toBe(true)
  })
})

describe('author validation', () => {
  it('PUT inválido devolve 400', async () => {
    const dir = await tempDir()
    const file = path.join(dir, 'kit.yaml')
    await writeFile(
      file,
      'id: x\ntitle: T\ncampaign:\n  id: c\n  name: C\n',
    )
    const server = await startAuthorServer({ file, cwd: dir, port: 0 })
    try {
      const res = await fetch(new URL('/api/kit', server.url), {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kit: { title: 'sem id' } }),
      })
      expect(res.status).toBe(400)
      const body = (await res.json()) as { error: string }
      expect(body.error).toMatch(/id/)
    } finally {
      await server.close()
    }
  })
})
