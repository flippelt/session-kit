function needsQuotes(s: string): boolean {
  if (s === '' || s !== s.trim()) return true
  if (/^(true|false|null|yes|no|on|off)$/i.test(s)) return true
  if (/^-?\d+(\.\d+)?$/.test(s)) return true
  if (/[:#{}[\],&*?|<>=!%@`]/.test(s)) return true
  if (/^['"]/.test(s) || /[\n\r]/.test(s)) return true
  return false
}

function yamlScalar(value: unknown): string {
  if (typeof value === 'boolean' || typeof value === 'number') return String(value)
  if (typeof value !== 'string') return JSON.stringify(value)
  return needsQuotes(value) ? JSON.stringify(value) : value
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((v) => yamlScalar(v)).join(', ')}]`
  }
  return yamlScalar(value)
}

export function stringifyFrontmatter(data: Record<string, unknown>): string {
  const lines = ['---']
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue
    lines.push(`${key}: ${formatValue(value)}`)
  }
  lines.push('---')
  return lines.join('\n')
}

export function withFrontmatter(data: Record<string, unknown>, body: string): string {
  const header = stringifyFrontmatter(data)
  const trimmed = body.replace(/^\n+/, '').replace(/\n+$/, '')
  if (trimmed.length === 0) return `${header}\n`
  return `${header}\n${trimmed}\n`
}

export function ensureTrailingNewline(text: string): string {
  return text.endsWith('\n') ? text : `${text}\n`
}
