import path from 'node:path'
import { KitError } from './errors.js'

/** POSIX-ish relative path: strip leading slashes, reject `..` / empty segments. */
export function normalizeRelPath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\/+/, '')
}

export function isSafeRelPath(p: string): boolean {
  const n = normalizeRelPath(p)
  if (!n) return false
  if (n.startsWith('/')) return false
  if (/^[a-zA-Z]:/.test(n)) return false
  return n.split('/').every((seg) => seg !== '' && seg !== '.' && seg !== '..')
}

export function isSafeSegment(s: string): boolean {
  return s.length > 0 && !s.includes('/') && !s.includes('\\') && s !== '.' && s !== '..'
}

/** Resolve `rel` under `outDir`; throw if it would escape. */
export function resolveInside(outDir: string, rel: string): string {
  const absOut = path.resolve(outDir)
  const absFile = path.resolve(absOut, rel)
  const relCheck = path.relative(absOut, absFile)
  if (relCheck.startsWith('..') || path.isAbsolute(relCheck)) {
    throw new KitError(`Caminho inseguro: ${rel}`)
  }
  return absFile
}
