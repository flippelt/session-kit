export type KnownSystem = {
  id: string
  label: string
}

/** Identificadores dos SRDs do GM Control Room, na ordem do dropdown. */
export const KNOWN_SYSTEMS: readonly KnownSystem[] = [
  { id: 'dnd5e-2024', label: 'D&D 5e (2024)' },
  { id: 'dnd5e-2014', label: 'D&D 5e (2014)' },
  { id: 'dnd-3.5', label: 'D&D 3.5' },
  { id: 'pathfinder-1e', label: 'Pathfinder 1e' },
  { id: 'pathfinder-2e', label: 'Pathfinder 2e' },
  { id: 'starfinder-1e', label: 'Starfinder 1e' },
  { id: 'starfinder-2e', label: 'Starfinder 2e' },
  { id: 'lancer', label: 'Lancer' },
  { id: 'gumshoe', label: 'GUMSHOE' },
  { id: 'daggerheart', label: 'Daggerheart' },
  { id: 'candela-obscura', label: 'Candela Obscura' },
  { id: 'blade-runner', label: 'Blade Runner' },
  { id: 'cyberpunk-red', label: 'Cyberpunk Red' },
  { id: 'fallout-2d20', label: 'Fallout 2d20' },
  { id: 'imperium-maledictum', label: 'Imperium Maledictum' },
  { id: 'vampire-v5', label: 'Vampire: The Masquerade V5' },
  { id: 'wng', label: 'Wrath & Glory' },
]

export function systemLabel(id: string): string {
  return KNOWN_SYSTEMS.find((s) => s.id === id)?.label ?? id
}

export function mergeSystems(used: Iterable<string>): KnownSystem[] {
  const map = new Map<string, KnownSystem>(KNOWN_SYSTEMS.map((s) => [s.id, s]))
  const extra: KnownSystem[] = []
  for (const id of used) {
    const trimmed = id.trim()
    if (!trimmed || map.has(trimmed)) continue
    const entry = { id: trimmed, label: trimmed }
    map.set(trimmed, entry)
    extra.push(entry)
  }
  extra.sort((a, b) => a.id.localeCompare(b.id, 'pt'))
  return [...KNOWN_SYSTEMS, ...extra]
}
