import { readFileSync } from 'node:fs'
import { ZodError, type ZodIssue } from 'zod'
import { parse as parseYaml } from 'yaml'
import { KitError } from './errors.js'
import { KitSchema, type Kit } from './schema.js'

function translateIssue(issue: ZodIssue): string {
  if (issue.code === 'invalid_type' && 'received' in issue && issue.received === 'undefined') {
    return 'obrigatório'
  }
  if (issue.code === 'invalid_type' && 'expected' in issue) {
    return `esperado ${String(issue.expected)}, recebido ${String(issue.received)}`
  }
  return issue.message
}

export function formatKitIssues(err: ZodError): string {
  const lines = err.issues.map((issue) => {
    const where = issue.path.length > 0 ? issue.path.join('.') : '(raiz)'
    return `  - ${where}: ${translateIssue(issue)}`
  })
  return `Kit inválido:\n${lines.join('\n')}`
}

export function parseKit(raw: unknown): Kit {
  const result = KitSchema.safeParse(raw)
  if (!result.success) throw new KitError(formatKitIssues(result.error))
  return result.data
}

export function parseKitYaml(text: string): Kit {
  let raw: unknown
  try {
    raw = parseYaml(text)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new KitError(`YAML inválido: ${msg}`)
  }
  if (raw === null || raw === undefined || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new KitError('O kit deve ser um objeto YAML.')
  }
  return parseKit(raw)
}

export function loadKitFile(filePath: string): Kit {
  let text: string
  try {
    text = readFileSync(filePath, 'utf8')
  } catch (e) {
    const err = e as NodeJS.ErrnoException
    if (err.code === 'ENOENT') throw new KitError(`Arquivo não encontrado: ${filePath}`)
    const msg = err instanceof Error ? err.message : String(e)
    throw new KitError(`Não foi possível ler ${filePath}: ${msg}`)
  }
  return parseKitYaml(text)
}
