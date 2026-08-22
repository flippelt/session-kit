export type EmittedFile = {
  path: string
  content: string
}

export const EMIT_KEYS = ['gmcr', 'codex', 'itr', 'briefing', 'lancer', 'press'] as const
export type EmitKey = (typeof EMIT_KEYS)[number]
