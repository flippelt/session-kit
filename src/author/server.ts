import { execFile } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { writeCompile } from '../compile.js'
import { dumpKit, kitFromPath, kitFromUnknown } from '../dump.js'
import { KitError } from '../errors.js'
import { loadKitFile } from '../load.js'
import type { Kit } from '../schema.js'

const PAGE = readFileSync(new URL('./page.html', import.meta.url), 'utf8')
const MAX_BODY = 2_000_000

export interface AuthorServer {
  url: string
  port: number
  closed: Promise<void>
  close: () => Promise<void>
}

export interface AuthorOptions {
  file: string
  cwd: string
  port?: number
  host?: string
}

function loadCurrent(file: string): { kit: Kit; warning?: string } {
  if (!existsSync(file)) return { kit: kitFromPath(file) }
  try {
    return { kit: loadKitFile(file) }
  } catch (e) {
    const warning = e instanceof Error ? e.message : String(e)
    return { kit: kitFromPath(file), warning }
  }
}

function send(res: http.ServerResponse, status: number, body: unknown, type = 'application/json; charset=utf-8'): void {
  const payload = typeof body === 'string' ? body : JSON.stringify(body)
  res.writeHead(status, {
    'content-type': type,
    'cache-control': 'no-store',
  })
  res.end(payload)
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY) {
        reject(new KitError('Corpo demais (limite 2 MB).'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function saveKit(file: string, raw: unknown): Kit {
  const kit = kitFromUnknown(raw)
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, dumpKit(kit), 'utf8')
  return kit
}

export function openBrowser(url: string): void {
  const ignore = () => {}
  if (process.platform === 'darwin') execFile('open', [url], ignore)
  else if (process.platform === 'win32') execFile('cmd', ['/c', 'start', '', url], { windowsHide: true }, ignore)
  else execFile('xdg-open', [url], ignore)
}

export async function startAuthorServer(opts: AuthorOptions): Promise<AuthorServer> {
  const file = path.resolve(opts.cwd, opts.file)
  const host = opts.host ?? '127.0.0.1'
  const requestedPort = opts.port ?? 0

  let settleClosed: () => void
  const closed = new Promise<void>((resolve) => {
    settleClosed = resolve
  })

  const server = http.createServer((req, res) => {
    void handle(req, res)
  })

  async function handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', `http://${host}`)
    const method = req.method ?? 'GET'

    try {
      if (method === 'GET' && url.pathname === '/') {
        send(res, 200, PAGE, 'text/html; charset=utf-8')
        return
      }
      if (method === 'GET' && url.pathname === '/api/kit') {
        const current = loadCurrent(file)
        send(res, 200, {
          path: file,
          kit: current.kit,
          warning: current.warning,
        })
        return
      }
      if (method === 'PUT' && url.pathname === '/api/kit') {
        const body = JSON.parse(await readBody(req)) as { kit?: unknown }
        const kit = saveKit(file, body.kit)
        send(res, 200, { ok: true, kit, path: file })
        return
      }
      if (method === 'POST' && url.pathname === '/api/compile') {
        const bodyRaw = await readBody(req)
        const body = bodyRaw ? (JSON.parse(bodyRaw) as { kit?: unknown; out?: string }) : {}
        const kit = body.kit !== undefined ? saveKit(file, body.kit) : loadKitFile(file)
        const outDir = path.resolve(opts.cwd, body.out?.trim() || path.join('dist', kit.id))
        const files = await writeCompile(kit, outDir)
        send(res, 200, { ok: true, files, out: outDir, kit })
        return
      }
      if (method === 'POST' && url.pathname === '/api/shutdown') {
        send(res, 200, { ok: true })
        void close()
        return
      }
      send(res, 404, { error: 'Não encontrado.' })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      const status = e instanceof SyntaxError ? 400 : e instanceof KitError ? 400 : 500
      send(res, status, { error: msg })
    }
  }

  async function close(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()))
    }).catch(() => {})
    settleClosed()
  }

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(requestedPort, host, () => resolve())
  })

  const address = server.address()
  if (!address || typeof address === 'string') {
    await close()
    throw new KitError('Não foi possível abrir o editor local.')
  }

  const url = `http://${host}:${address.port}/`
  return { url, port: address.port, closed, close }
}
