# session-kit

[![CI](https://github.com/flippelt/session-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/flippelt/session-kit/actions/workflows/ci.yml)
[![license](https://img.shields.io/github/license/flippelt/session-kit)](./LICENSE)

Um YAML de **sessão** vira os formatos das ferramentas de RPG do Felipe.
Você descreve o encontro **uma vez**; o compilador emite os artefatos que cada
app já consome.

> **Repo privado.** Clone só com acesso à conta `flippelt`.
>
> ⚠️ **Status:** MVP (`v0.1.0`). A API do kit e dos emissores pode mudar.

## Por quê

Cada ferramenta fala um dialeto:

| Ferramenta | Formato nativo |
| ---------- | -------------- |
| [GM Control Room](https://github.com/flippelt/gm-control-room) | JSON de campanha (`scenes`, `genre`, `era`) |
| [campaign-codex](https://github.com/flippelt/campaign-codex) | Markdown + frontmatter em `campaigns/` e `entries/` |
| [Immersive Terminal](https://github.com/flippelt/Immersive-Terminal-for-RPGs) | `scenario.json` + arquivos no VFS (com frontmatter de lock/crack) |
| [guild-briefings](https://github.com/flippelt/guild-briefings) | `briefing.json` (party, quests, recaps) |
| [lancer-briefings](https://github.com/flippelt/lancer-briefings) | Markdown de missões e eventos |
| mesa-press | Markdown de handout (`letter` / `poster` / `dataslate` / `plate` / `telegram` / `dossier` / `edict` / `newspaper` / `ticket`) |

Manter tudo isso na mão diverge. O **session-kit** é o motor: um kit YAML na
entrada, uma pasta de artefatos na saída.

## Onde fica o conteúdo da mesa

Este repositório é **privado**: o compilador e, se quiser, os kits YAML da
mesa podem viver aqui. Os artefatos gerados ainda vão para os apps privados:

- `contracontrol` — GM Control Room da mesa
- `contracodex` — campaign-codex da mesa
- `rpgterm` — Immersive Terminal da mesa
- `guild-briefings-mesa` — briefings da mesa

`examples/valdoran-cerco` é só a demo do Cerco de Pedravale (já pública no
campaign-codex). Kits reais não precisam imitar essa pasta.

## Instalação

Node **≥ 22**.

```bash
git clone https://github.com/flippelt/session-kit.git
cd session-kit
npm ci
npm run build
```

O binário `session-kit` aponta para `dist/cli.js`.

## Uso

```bash
session-kit validate path/to/kit.yaml
session-kit compile path/to/kit.yaml --out dist/
session-kit compile path/to/kit.yaml --out dist/ --emit gmcr,codex,itr,briefing,lancer,press
```

Sem `--emit`, **todos** os emissores rodam. Chaves desconhecidas em `--emit`
são erro.

A compilação imprime a lista de arquivos gerados (caminhos relativos a `--out`).

Exemplo público:

```bash
session-kit validate examples/valdoran-cerco/kit.yaml
session-kit compile examples/valdoran-cerco/kit.yaml --out dist/
```

## Emissores

| Chave | Saída | Quando escreve |
| ----- | ----- | -------------- |
| `gmcr` | `gmcr/<kit.id>.json` | sempre |
| `codex` | `codex/campaigns/<campaign.id>.md` e `codex/entries/<campaign.id>/<tipo>/<slug>.md` | sempre (campanha; entradas se houver) |
| `itr` | `itr/<theme>/<id>/scenario.json` e `itr/<theme>/<id>/files/<path>` | se `terminal` estiver no kit |
| `briefing` | `briefing/briefing.json` | sempre |
| `lancer` | `lancer/missions/<slug>.md` e `lancer/events/<slug>.md` | se `lancer.mission` estiver no kit |
| `press` | `press/<slug>.md` | um arquivo por `handouts[]` |

`--emit gmcr` gera só o JSON do GMCR; não toca em `codex/` nem no resto.

## Kit YAML (visão geral)

Campos obrigatórios: `id`, `title`, `campaign` (`id` + `name`). O resto é
opcional. Chaves extra são **ignoradas** (não derrubam a validação).

Blocos úteis:

- `scenes[]` — tratamentos `text` / `color` / `image` / `crt` (iguais ao GMCR)
- `entries[]` — lore, npcs, characters, events, maps (codex)
- `quests[]`, `parties[]`, `party[]`, `briefing` — guild-briefings
- `terminal` — cenário ITR (arquivos com `locked` / `crackable` / `password`)
- `handouts[]` — mesa-press
- `lancer.mission` / `lancer.events[]` — lancer-briefings

Slugs omitidos viram `slugify(title)`: NFD, sem acentos, minúsculas, não
alfanuméricos viram `-`.

Caminhos de arquivo do terminal (`terminal.files[].path`) não podem sair do
diretório do cenário (`../x` é rejeitado).

## Desenvolvimento

```bash
npm test
npm run typecheck
npm run build
```

Testes: [vitest](https://vitest.dev/). CI em `.github/workflows/ci.yml`
(Node 22, `npm ci`, test, build).

## Licença

MIT © 2026 Felipe Lippelt
