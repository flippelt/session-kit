import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { parseArgv } from '../command.js'
import { loadKitFile } from '../load.js'
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
    await writeFile(a, await readFile(exampleKitPath, 'utf8'))
    await writeFile(
      b,
      'id: a-descida\ntitle: A Descida\ncampaign:\n  id: lancer\n  name: Lancer\n',
    )

    const server = await startAuthorServer({ root: dir, cwd: dir, port: 0 })
    try {
      const page = await fetch(server.url)
      const html = await page.text()
      expect(html).toMatch(/Travada|etapas|Editar/)

      const ws = await fetch(new URL('/api/workspace', server.url))
      const body = (await ws.json()) as {
        mode: string
        sessions: Array<{ rel: string; startUnlocked: boolean; kit: { id: string } }>
      }
      expect(body.mode).toBe('catalog')
      expect(body.sessions.map((s) => s.kit.id).sort()).toEqual(['a-descida', 'valdoran-cerco'])
      expect(body.sessions.every((s) => s.startUnlocked === false)).toBe(true)

      const created = await fetch(new URL('/api/kits', server.url), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dir: 'mirrus/nova' }),
      })
      expect(created.status).toBe(200)
      const made = (await created.json()) as { session: { rel: string; startUnlocked: boolean } }
      expect(made.session.rel).toBe('mirrus/nova/kit.yaml')
      expect(made.session.startUnlocked).toBe(true)
      await expect(readFile(path.join(dir, 'mirrus/nova/kit.yaml'), 'utf8')).resolves.toMatch(/id: nova/)
    } finally {
      await server.close()
    }
  })

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
