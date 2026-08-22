import { toJson } from '../json.js'
import type { Kit } from '../schema.js'
import type { EmittedFile } from '../types.js'

export function emitBriefing(kit: Kit): EmittedFile[] {
  const briefing = kit.briefing
  const party = (kit.party ?? []).map((character) => ({
    id: character.id,
    name: character.name,
    ...(character.race !== undefined ? { race: character.race } : {}),
    classes: character.classes ?? [],
    level: character.level ?? 1,
    ...(character.abilities !== undefined ? { abilities: character.abilities } : {}),
    ...(character.hp !== undefined ? { hp: character.hp } : {}),
    ...(character.maxHp !== undefined ? { maxHp: character.maxHp } : {}),
    ...(character.ac !== undefined ? { ac: character.ac } : {}),
    ...(character.player !== undefined ? { player: character.player } : {}),
    ...(character.partyId !== undefined ? { partyId: character.partyId } : {}),
    ...(character.backstory !== undefined ? { backstory: character.backstory } : {}),
    source: character.source ?? 'manual',
  }))

  const quests = (kit.quests ?? []).map((quest) => ({
    id: quest.id,
    title: quest.title,
    ...(quest.objective !== undefined ? { objective: quest.objective } : {}),
    status: quest.status ?? 'ativa',
    ...(quest.reward !== undefined ? { reward: quest.reward } : {}),
    ...(quest.partyId !== undefined ? { partyId: quest.partyId } : {}),
    ...(quest.adventurerIds !== undefined ? { adventurerIds: quest.adventurerIds } : {}),
    ...(quest.notes !== undefined ? { notes: quest.notes } : {}),
    ...(quest.guild !== undefined ? { guild: quest.guild } : {}),
  }))

  const out = {
    version: 1,
    ...(briefing?.guildName !== undefined ? { guildName: briefing.guildName } : {}),
    ...(briefing?.crest !== undefined ? { crest: briefing.crest } : {}),
    ...(briefing?.bootTitle !== undefined ? { bootTitle: briefing.bootTitle } : {}),
    parties: kit.parties ?? [],
    party,
    quests,
    recaps: [] as const,
  }

  return [{ path: 'briefing/briefing.json', content: toJson(out) }]
}
