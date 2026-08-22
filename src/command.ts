import path from 'node:path'
import { parseEmitList, writeCompile } from './compile.js'
import { KitError } from './errors.js'
import { loadKitFile } from './load.js'

export const HELP = `session-kit — um YAML de sessão para as ferramentas de RPG

Uso:
  session-kit validate <kit.yaml>
  session-kit compile <kit.yaml> --out <dir>
  session-kit compile <kit.yaml> --out <dir> --emit gmcr,codex,itr,briefing,lancer,press

Sem --emit, todos os emissores rodam. Chaves desconhecidas são erro.

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

export function parseArgv(argv: string[]): CliRequest {
  if (argv.length === 0 || argv[0] === '-h' || argv[0] === '--help' || argv[0] === 'help') {
    return { cmd: 'help' }
  }

  const cmd = argv[0]
  if (cmd !== 'validate' && cmd !== 'compile') {
    throw new KitError(`Comando desconhecido: ${cmd}. Use validate ou compile.`)
  }

  const rest = argv.slice(1)
  let file: string | undefined
  let out: string | undefined
  let emit: string | undefined

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
    if (arg.startsWith('-')) {
      throw new KitError(`Opção desconhecida: ${arg}`)
    }
    if (file) throw new KitError(`Argumento extra: ${arg}`)
    file = arg
  }

  if (!file) throw new KitError('Informe o caminho do kit YAML.')
  if (cmd === 'validate') {
    if (out !== undefined || emit !== undefined) {
      throw new KitError('validate não aceita --out nem --emit.')
    }
    return { cmd: 'validate', file }
  }
  if (!out) throw new KitError('compile exige --out <dir>.')
  return { cmd: 'compile', file, out, emit }
}

export async function runCli(argv: string[], io: CliIo = defaultIo): Promise<number> {
  try {
    const req = parseArgv(argv)
    if (req.cmd === 'help') {
      io.stdout(HELP.trimEnd())
      return 0
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
