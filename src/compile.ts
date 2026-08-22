import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { emitBriefing } from './emitters/briefing.js'
import { emitCodex } from './emitters/codex.js'
import { emitGmcr } from './emitters/gmcr.js'
import { emitItr } from './emitters/itr.js'
import { emitLancer } from './emitters/lancer.js'
import { emitPress } from './emitters/press.js'
import { KitError } from './errors.js'
import { resolveInside } from './paths.js'
import type { Kit } from './schema.js'
import { EMIT_KEYS, type EmitKey, type EmittedFile } from './types.js'

export { EMIT_KEYS, type EmitKey, type EmittedFile }

export function parseEmitList(raw: string): EmitKey[] {
  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  if (parts.length === 0) {
    throw new KitError('Lista --emit vazia.')
  }
  const unknown = parts.filter((p) => !EMIT_KEYS.includes(p as EmitKey))
  if (unknown.length > 0) {
    throw new KitError(
      `Emissor desconhecido: ${unknown.join(', ')}. Válidos: ${EMIT_KEYS.join(', ')}`,
    )
  }
  return [...new Set(parts)] as EmitKey[]
}

export function compileKit(kit: Kit, emit: readonly EmitKey[] = EMIT_KEYS): EmittedFile[] {
  const wanted = new Set(emit)
  const files: EmittedFile[] = []
  if (wanted.has('gmcr')) files.push(...emitGmcr(kit))
  if (wanted.has('codex')) files.push(...emitCodex(kit))
  if (wanted.has('itr')) files.push(...emitItr(kit))
  if (wanted.has('briefing')) files.push(...emitBriefing(kit))
  if (wanted.has('lancer')) files.push(...emitLancer(kit))
  if (wanted.has('press')) files.push(...emitPress(kit))
  return files.sort((a, b) => a.path.localeCompare(b.path))
}

export async function writeCompile(
  kit: Kit,
  outDir: string,
  emit: readonly EmitKey[] = EMIT_KEYS,
): Promise<string[]> {
  const files = compileKit(kit, emit)
  for (const file of files) {
    const abs = resolveInside(outDir, file.path)
    await mkdir(path.dirname(abs), { recursive: true })
    await writeFile(abs, file.content, 'utf8')
  }
  return files.map((f) => f.path)
}
