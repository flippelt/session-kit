import { readdirSync } from 'node:fs'
import path from 'node:path'
import { kitFromDir, kitFromPath } from '../dump.js'
import { loadKitFile } from '../load.js'
import { isSafeRelPath, normalizeRelPath, resolveInside } from '../paths.js'
import type { Kit } from '../schema.js'
import { KitError } from '../errors.js'

const SKIP = new Set(['node_modules', 'dist', '.git', 'coverage'])

export type WorkspaceSession = {
  rel: string
  path: string
  kit: Kit
  warning?: string
  existed: boolean
  startUnlocked: boolean
}

export function toPosix(p: string): string {
  return p.split(path.sep).join('/')
}

export function findKitFiles(root: string): string[] {
  const out: string[] = []
  const walk = (dir: string): void => {
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const ent of entries) {
      if (SKIP.has(ent.name) || ent.name.startsWith('.')) continue
      const full = path.join(dir, ent.name)
      if (ent.isDirectory()) walk(full)
      else if (ent.isFile() && ent.name === 'kit.yaml') out.push(full)
    }
  }
  walk(root)
  return out.sort((a, b) => a.localeCompare(b))
}

export function relToRoot(root: string, abs: string): string {
  const rel = toPosix(path.relative(root, abs))
  return rel || path.basename(abs)
}

export function resolveKitRel(root: string, rel: string): string {
  const norm = normalizeRelPath(rel)
  if (!isSafeRelPath(norm) || path.basename(norm) !== 'kit.yaml') {
    throw new KitError(`Caminho de kit inválido: ${rel}`)
  }
  return resolveInside(root, norm)
}

export function loadSession(root: string, abs: string, startUnlocked = false): WorkspaceSession {
  const rel = relToRoot(root, abs)
  try {
    return { rel, path: abs, kit: loadKitFile(abs), existed: true, startUnlocked }
  } catch (e) {
    const warning = e instanceof Error ? e.message : String(e)
    return { rel, path: abs, kit: kitFromPath(abs), warning, existed: true, startUnlocked }
  }
}

export function loadWorkspace(root: string, singleFile?: string, unlocked = new Set<string>()): WorkspaceSession[] {
  const files = singleFile ? [singleFile] : findKitFiles(root)
  return files.map((abs) => {
    const rel = relToRoot(root, abs)
    return loadSession(root, abs, unlocked.has(rel))
  })
}

export function newKitRel(dir: string): string {
  const norm = normalizeRelPath(dir).replace(/\/+$/, '')
  if (!isSafeRelPath(norm)) throw new KitError(`Diretório inválido: ${dir}`)
  return `${norm}/kit.yaml`
}

export function kitForNewRel(rel: string): Kit {
  return kitFromDir(path.dirname(rel))
}
