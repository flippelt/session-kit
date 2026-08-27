import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { openBrowser, startAuthorServer } from './author/server.js'
import { parseEmitList, writeCompile } from './compile.js'
import { dumpKit, kitFromDir, kitFromPath } from './dump.js'
import { KitError } from './errors.js'
import { loadKitFile } from './load.js'

export const HELP = `session-kit — um YAML de sessão para as ferramentas de RPG

Uso:
  session-kit validate <kit.yaml>
  session-kit compile <kit.yaml> --out <dir>
  session-kit compile <kit.yaml> --out <dir> --emit gmcr,codex,itr,briefing,lancer,press
  session-kit edit <kit.yaml> [--create] [--port N] [--no-open]
  session-kit new <dir> [--port N] [--no-open]

validate / compile leem o YAML. Sem --emit, todos os emissores rodam.
Chaves desconhecidas em --emit são erro.

edit abre um formulário no navegador e grava o YAML. Quem não quiser
mexer no arquivo à mão usa isso. --create cria o arquivo se não existir.
new cria <dir>/kit.yaml (a partir do nome das pastas) e abre o editor.

Emissores:
  gmcr       gmcr/<id>.json
  codex      campaign-codex (campanha + entradas)
  itr        Immersive Terminal (se houver terminal)
  briefing   guild-briefings (briefing.json)
  lancer     lancer-briefings (se houver lancer.mission)
  press      mesa-press (handouts)
`

export type CliRequest =
  | { cmd: 'help' }
  | { cmd: 'validate'; file: string }
  | { cmd: 'compile'; file: string; out: string; emit?: string }
  | { cmd: 'edit'; file: string; create: boolean; port?: number; open: boolean }
  | { cmd: 'new'; dir: string; port?: number; open: boolean }

export interface CliIo {
  stdout: (line: string) => void
  stderr: (line: string) => void
  cwd: string
}

const defaultIo: CliIo = {
  stdout: (line) => {
    process.stdout.write(line.endsWith('\n') ? line : `${line}\n`)
  },
  stderr: (line) => {
    process.stderr.write(line.endsWith('\n') ? line : `${line}\n`)
  },
  cwd: process.cwd(),
}

const COMMANDS = new Set(['validate', 'compile', 'edit', 'new', 'help'])

function parsePort(raw: string): number {
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 0 || n > 65535) {
    throw new KitError(`Porta inválida: ${raw}`)
  }
  return n
}

export function parseArgv(argv: string[]): CliRequest {
  if (argv.length === 0 || argv[0] === '-h' || argv[0] === '--help' || argv[0] === 'help') {
    return { cmd: 'help' }
  }

  const cmd = argv[0]
  if (!COMMANDS.has(cmd)) {
    throw new KitError(`Comando desconhecido: ${cmd}. Use validate, compile, edit ou new.`)
  }

  const rest = argv.slice(1)
  let positional: string | undefined
  let out: string | undefined
  let emit: string | undefined
  let port: number | undefined
  let create = false
  let open = true

  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i]!
    if (arg === '--help' || arg === '-h') return { cmd: 'help' }
    if (arg === '--out' || arg === '-o') {
      const value = rest[++i]
      if (!value) throw new KitError('Falta o valor de --out.')
      out = value
      continue
    }
    if (arg.startsWith('--out=')) {
      out = arg.slice('--out='.length)
      continue
    }
    if (arg === '--emit') {
      const value = rest[++i]
      if (!value) throw new KitError('Falta o valor de --emit.')
      emit = value
      continue
    }
    if (arg.startsWith('--emit=')) {
      emit = arg.slice('--emit='.length)
      continue
    }
    if (arg === '--port') {
      const value = rest[++i]
      if (!value) throw new KitError('Falta o valor de --port.')
      port = parsePort(value)
      continue
    }
    if (arg.startsWith('--port=')) {
      port = parsePort(arg.slice('--port='.length))
      continue
    }
    if (arg === '--create') {
      create = true
      continue
    }
    if (arg === '--no-open') {
      open = false
      continue
    }
    if (arg.startsWith('-')) {
      throw new KitError(`Opção desconhecida: ${arg}`)
    }
    if (positional) throw new KitError(`Argumento extra: ${arg}`)
    positional = arg
  }

  if (cmd === 'validate') {
    if (!positional) throw new KitError('Informe o caminho do kit YAML.')
    if (out !== undefined || emit !== undefined || port !== undefined || create || !open) {
      throw new KitError('validate não aceita --out, --emit, --port, --create nem --no-open.')
    }
    return { cmd: 'validate', file: positional }
  }

  if (cmd === 'compile') {
    if (!positional) throw new KitError('Informe o caminho do kit YAML.')
    if (!out) throw new KitError('compile exige --out <dir>.')
    if (port !== undefined || create || !open) {
      throw new KitError('compile não aceita --port, --create nem --no-open.')
    }
    return { cmd: 'compile', file: positional, out, emit }
  }

  if (cmd === 'edit') {
    if (!positional) throw new KitError('Informe o caminho do kit YAML.')
    if (out !== undefined || emit !== undefined) {
      throw new KitError('edit não aceita --out nem --emit.')
    }
    return { cmd: 'edit', file: positional, create, open, ...(port !== undefined ? { port } : {}) }
  }

  if (!positional) throw new KitError('Informe o diretório do novo kit.')
  if (out !== undefined || emit !== undefined || create) {
    throw new KitError('new não aceita --out, --emit nem --create.')
  }
  return { cmd: 'new', dir: positional, open, ...(port !== undefined ? { port } : {}) }
}

function writeNewKit(file: string, fromDir?: string): void {
  if (existsSync(file)) {
    throw new KitError(`Já existe: ${file}. Use session-kit edit.`)
  }
  mkdirSync(path.dirname(file), { recursive: true })
  const kit = fromDir ? kitFromDir(fromDir) : kitFromPath(file)
  writeFileSync(file, dumpKit(kit), 'utf8')
}

async function runAuthor(
  file: string,
  opts: { create?: boolean; port?: number; open: boolean },
  io: CliIo,
): Promise<number> {
  const kitPath = path.resolve(io.cwd, file)
  if (!existsSync(kitPath)) {
    if (!opts.create) {
      throw new KitError(`Arquivo não encontrado: ${kitPath}. Use --create ou session-kit new.`)
    }
    writeNewKit(kitPath)
  }

  const server = await startAuthorServer({ file: kitPath, cwd: io.cwd, port: opts.port })
  io.stdout(`Editor: ${server.url}`)
  io.stdout('Preencha o formulário no navegador. Ctrl+C ou Encerrar para sair.')
  if (opts.open) openBrowser(server.url)

  const stop = () => {
    void server.close()
  }
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
  try {
    await server.closed
  } finally {
    process.off('SIGINT', stop)
    process.off('SIGTERM', stop)
  }
  return 0
}

export async function runCli(argv: string[], io: CliIo = defaultIo): Promise<number> {
  try {
    const req = parseArgv(argv)
    if (req.cmd === 'help') {
      io.stdout(HELP.trimEnd())
      return 0
    }

    if (req.cmd === 'edit') {
      return await runAuthor(req.file, req, io)
    }
    if (req.cmd === 'new') {
      const kitPath = path.join(path.resolve(io.cwd, req.dir), 'kit.yaml')
      writeNewKit(kitPath, req.dir)
      io.stdout(`Criado ${kitPath}`)
      return await runAuthor(kitPath, { port: req.port, open: req.open, create: false }, io)
    }

    const kitPath = path.resolve(io.cwd, req.file)
    const kit = loadKitFile(kitPath)

    if (req.cmd === 'validate') {
      io.stdout(`Kit válido: ${kit.id} — ${kit.title}`)
      return 0
    }

    const emit = req.emit ? parseEmitList(req.emit) : undefined
    const outDir = path.resolve(io.cwd, req.out)
    const written = await writeCompile(kit, outDir, emit)
    for (const file of written) io.stdout(file)
    return 0
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    io.stderr(msg)
    return 1
  }
}
