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
