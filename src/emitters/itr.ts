import { KitError } from '../errors.js'
import { ensureTrailingNewline, withFrontmatter } from '../frontmatter.js'
import { toJson } from '../json.js'
import { isSafeRelPath, normalizeRelPath } from '../paths.js'
import type { Kit } from '../schema.js'
import type { EmittedFile } from '../types.js'

export function emitItr(kit: Kit): EmittedFile[] {
  const terminal = kit.terminal
  if (!terminal) return []

  const base = `itr/${terminal.theme}/${terminal.id}`
  const scenario = {
    id: terminal.id,
    name: terminal.name,
    motd: terminal.motd ?? [],
    commands: terminal.commands ?? {},
  }
  const files: EmittedFile[] = [{ path: `${base}/scenario.json`, content: toJson(scenario) }]

  for (const file of terminal.files) {
    if (!isSafeRelPath(file.path)) {
      throw new KitError(`Caminho de arquivo inseguro no terminal: ${file.path}`)
    }
    const rel = normalizeRelPath(file.path)
    const meta: Record<string, unknown> = {}
    if (file.locked !== undefined) meta.locked = file.locked
    if (file.password !== undefined) meta.password = file.password
    if (file.crackable !== undefined) meta.crackable = file.crackable
    if (file.crackDC !== undefined) meta.crackDC = file.crackDC
    if (file.decryptGame !== undefined) meta.decryptGame = file.decryptGame
    if (file.tracer !== undefined) meta.tracer = file.tracer

    const content =
      Object.keys(meta).length > 0 ? withFrontmatter(meta, file.content) : ensureTrailingNewline(file.content)
    files.push({ path: `${base}/files/${rel}`, content })
  }

  return files
}
