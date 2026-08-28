# session-kit

[![CI](https://github.com/flippelt/session-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/flippelt/session-kit/actions/workflows/ci.yml)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

Compilador de sessão para RPG de mesa. Um YAML descreve o encontro; o CLI
emite os formatos nativos das ferramentas irmãs (painel do mestre, wiki da
campanha, briefing da party, terminal imersivo, missões Lancer, handouts
para impressão).

Você descreve a sessão **uma vez**. O compilador gera a árvore de arquivos
que cada app já consome. Copie o que quiser para o repositório da ferramenta
correspondente — o kit não publica nem faz deploy.

> ⚠️ **Status:** MVP (`v0.1.0`). A forma do kit e dos emissores pode mudar.

## Repos irmãos

| Repositório | Formato nativo |
| ----------- | -------------- |
| [GM Control Room](https://github.com/flippelt/gm-control-room) | JSON de campanha (`scenes`, `genre`, `era`) |
| [campaign-codex](https://github.com/flippelt/campaign-codex) | Markdown + frontmatter em `campaigns/` e `entries/` |
| [Immersive Terminal](https://github.com/flippelt/Immersive-Terminal-for-RPGs) | `scenario.json` + arquivos no VFS (com frontmatter de lock/crack) |
| [scenario-forge](https://flippelt.github.io/scenario-forge/) | editor web da pasta de cenário (o kit gera a pasta; o forge edita) |
| [guild-briefings](https://github.com/flippelt/guild-briefings) | `briefing.json` (party, quests, recaps) |
| [lancer-briefings](https://github.com/flippelt/lancer-briefings) | Markdown de missões e eventos |
| [mesa-press](https://github.com/flippelt/mesa-press) | Markdown de handout (`letter` / `poster` / `dataslate` / `plate` / `telegram` / `dossier` / `edict` / `newspaper` / `ticket`) |

Manter esses dialetos na mão diverge. O **session-kit** é a fonte única:
um kit YAML na entrada, uma pasta de artefatos na saída.

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
session-kit edit path/to/kit.yaml
session-kit new campanha/encontro-01
```

Sem `--emit`, **todos** os emissores rodam. Chaves desconhecidas em `--emit`
são erro.

A compilação imprime a lista de arquivos gerados (caminhos relativos a `--out`).

## Editor (sem YAML)

O schema do kit tem muitos blocos. Quem não quiser preenchê-lo à mão usa o
formulário local:

```bash
session-kit edit examples/valdoran-cerco/kit.yaml
session-kit new minha-campanha/encontro-01
```

`edit` abre o navegador em `127.0.0.1`. Se o caminho é uma **pasta** (ou
omitido, e existe `kits/`), o catálogo lista todas as sessões: as antigas
ficam **travadas** até o botão Editar; cada sessão e cada item é colapsável,
separado em etapas. `new` cria `<dir>/kit.yaml` e abre já destravado.
`--create` no `edit` cria o arquivo se ele ainda não existir; `--no-open` só
imprime a URL (útil em teste).

O YAML continua sendo a fonte que o compilador lê. O formulário só evita que
você precise conhecê-lo.

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

## Kit YAML

Campos obrigatórios: `id`, `title`, `campaign` (`id` + `name`). O resto é
opcional. Chaves extra são **ignoradas** (não derrubam a validação).

Kit mínimo:

```yaml
id: encontro-01
title: O encontro
campaign:
  id: campanha
  name: Nome da campanha
```

Campos de contexto (todos opcionais):

- `system` — identificador livre (`dnd5e-2014`, `lancer`, …)
- `genre` — `fantasy` · `cosmic-horror` · `sci-fi` · `modern` · `post-apocalyptic` · `generic`
- `era.startYear` / `era.label`
- `date`, `location`

Blocos de conteúdo:

- `scenes[]` — tratamentos `text` / `color` / `image` / `crt` (iguais ao GMCR)
- `entries[]` — `lore` · `npcs` · `characters` · `events` · `maps` (codex)
- `quests[]`, `parties[]`, `party[]`, `briefing` — guild-briefings
- `terminal` — cenário ITR (arquivos com `locked` / `crackable` / `password`)
- `handouts[]` — mesa-press
- `lancer.mission` / `lancer.events[]` — lancer-briefings

Slugs omitidos viram `slugify(title)`: NFD, sem acentos, minúsculas, não
alfanuméricos viram `-`.

Caminhos de arquivo do terminal (`terminal.files[].path`) não podem sair do
diretório do cenário (`../x` é rejeitado).

## Exemplo

`examples/valdoran-cerco` é um kit de demonstração completo (Cerco de
Pedravale). Qualquer campanha segue o mesmo schema — o exemplo não é um
template obrigatório.

```bash
session-kit validate examples/valdoran-cerco/kit.yaml
session-kit compile examples/valdoran-cerco/kit.yaml --out dist/
```

## Como biblioteca

```ts
import { compileKit, loadKitFile } from 'session-kit'

const kit = loadKitFile('kit.yaml')
const files = compileKit(kit) // todos os emissores
const soGmcr = compileKit(kit, ['gmcr'])
```

Cada item de `files` tem `path` (relativo) e `content` (UTF-8). Para gravar
no disco, use `writeCompile(kit, outDir, emit?)`.

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
