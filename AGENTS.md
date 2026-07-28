# Incredible Discord Bot — Agent Guide

This file is the operational context for agents working in this repository. Read it
before changing commands, RPG data, character saves, or tests.

## Project purpose

This is a localized English/French Discord bot built with CommonJS and `discord.js`
14.
It provides:

1. General Discord utilities and moderation.
2. Dice rolling and local audio playback.
3. TTRPG tools for random generation, dice rolls, and persistent character sheets.

The game rules are defined in `documentation/TTRPG_RANDOM_RULES_EN.md`. Treat that
file as the primary rules reference when implementing RPG mechanics. Rulebook files
are read-only unless the user explicitly requests a rulebook change; never edit them
merely to make documentation match an implementation.

## Runtime and validation

- Required Node.js version: 22.12 or newer.
- Install dependencies with `npm install`.
- Start the bot with `node index.js`.
- Run the complete offline validation with `npm test`.
- The Discord token belongs only in `.env` as `DISCORD_TOKEN`. Never print, move,
  hard-code, or commit it.
- The bot registers its global slash-command schema on startup. Discord may take a
  short time to refresh global commands after a schema change.
- Do not launch or leave the bot running merely to validate code. Prefer `npm test`
  unless live Discord behavior must be tested or the user explicitly asks to start it.

`npm test` runs ESLint, focused `node:test` suites, and `scripts/check.js`.
`scripts/check.js` orchestrates the focused modules under `scripts/checks/`, which
validate syntax, architectural boundaries, command schemas, autocomplete, help
ordering, permissions, generator data, character mechanics, modal editing, required
media, and voice dependencies. Character-store tests use an isolated temporary
directory through `INCREDIBLE_BOT_SAVE_DIRECTORY`; tests must never write to real
saves.

## Important repository structure

- `index.js`: environment loading, client startup, global command registration, and
  interaction/event routing.
- `client/Client.js`: Discord client and gateway intents.
- `commands/`: one module per top-level slash command.
- `commands/rpg/index.js`: `/rpg` command builder, subcommand routing, and RPG-level
  authorization.
- `commands/rpg/subcommands/`: one module per `/rpg` subcommand.
- `commands/rpg/editorFields.js`: modal presentation metadata derived from the
  canonical field catalog.
- `commands/rpg/interactions.js`: direct prefilled edit modal and modal submission.
- `models/Character.js`: Discord-independent character schema and save hydration.
- `services/`: Discord-independent domain behavior and application workflows,
  including parsing, validation, calculations, persistence, and generation.
- `services/characterApplicationService.js`: command-facing character workflows;
  command adapters must use it instead of composing persistence and mechanics.
- `services/characterFieldCatalog.js`: canonical character field identities,
  aliases, storage paths, types, and editable/viewable capabilities.
- `services/characterStore.js`: JSON character persistence.
- `services/characterEditor.js`: editable-value parsing and domain mutation.
- `services/mechanics/`: Discord-independent character constants, validation,
  statistics, resources, armor, damage, and generation formulas.
- `services/generatorCatalog.js`: loads and validates generator JSON and performs
  weighted selection.
- `services/randomCharacterGenerator.js`: selects generator data and assembles
  complete random characters using `services/mechanics/`.
- `scripts/check.js`: offline-check bootstrap, ordering, and final reporting.
- `scripts/*.test.js`: focused `node:test` suites for Discord-independent services
  and thin command-integration coverage.
- `scripts/checks/`: focused runtime, command, generator, character, interaction,
  and authorization integration checks plus temporary-save helpers.
- `data/generators/`: generator catalogs. See its `README.md` before editing formats.
- `save/`: real character data. Preserve these files unless the user explicitly
  requests a character change or deletion.
- `adapters/`: external Discord integrations that are neither domain services nor
  command modules, such as local voice playback.
- `util/`: shared cross-cutting helpers and feature-specific Discord response
  adapters.
- `util/authorization.js`: role/channel authorization.
- `util/autocomplete.js`: shared Discord autocomplete filtering.
- `util/characterDisplay.js`: localized character labels, resource full names, and
  abbreviations derived from the canonical service catalog.
- `util/characterRenderer.js`: Discord embed rendering for character summaries and
  detailed fields.
- `util/characterCommandResponses.js`: localized character reply payloads.
- `util/characterCommandErrors.js`: centralized mapping of expected character errors
  and structured service outcomes to localized replies.

## Command architecture and conventions

The bot uses slash commands only. Do not reintroduce prefix or message-content
commands.

Every top-level command must export:

- `name`
- `description`
- `usage`
- numeric `helpOrder`
- slash-command `data`
- `execute`
- `autocomplete` when applicable

Every RPG subcommand follows the same metadata convention, but exposes `configure`
instead of a top-level `data` builder. Register it in all three places in
`commands/rpg/index.js`: import, `subcommands` map, and builder chain.

### Layer boundaries

Command and subcommand modules are Discord entry-point adapters. Keep them thin.
They may define slash-command metadata, read Discord options and context, select the
locale, call authorization helpers, delegate to one feature workflow or response
adapter, and send the returned reply. They must not own reusable or non-trivial
feature behavior.

In particular, do not put any of the following directly in `execute` or
`autocomplete`:

- regular expressions or domain input parsing;
- value-limit or game-rule validation;
- random-selection, calculation, transformation, or persistence algorithms;
- branching that decides a domain outcome or presentation mode, such as whether a
  result is rendered as text, an embed, or an attachment;
- media filename selection;
- construction of multi-line localized result or error messages.

Put domain and application behavior under `services/`. Service modules must not
import `discord.js` or translation catalogs, accept an interaction object, create
Discord builders, or return localized user-facing prose.
Prefer plain inputs and plain return values. Represent expected validation failures
with stable error codes or structured outcomes so the Discord layer can localize
them. When localized generator data is a domain input, a service may accept a stable
locale identifier or a caller-supplied formatter, but it must not perform interface
translation itself. Inject nondeterministic dependencies such as random-number
generators when practical so service tests remain deterministic.

Put feature-specific Discord presentation in a response adapter under `util/` or an
existing feature-specific interaction module. A response adapter may import Discord
builders, map service outcomes and expected errors to localized reply payloads,
select attachment paths from service-provided descriptors, and apply
`MessageFlags.Ephemeral`. It must not reimplement parsing, calculations, or game
rules.

Dependencies should flow toward the domain:

```text
command/subcommand -> application service -> domain helpers/persistence
command/subcommand -> response adapter (service outcome -> Discord payload)
```

For character persistence or mutations, commands and interaction handlers must call
`services/characterApplicationService.js`; they must not compose
`characterStore.js` and mechanics directly. Models own state and hydration only.
They must not import Discord or localization code; character embeds belong in
`util/characterRenderer.js`.

For every non-trivial command feature:

1. Define a plain service API for the feature behavior.
2. Have the service return plain data, a structured outcome, or a stable expected
   error code.
3. Convert that outcome into localized Discord payloads in a response adapter.
4. Keep the command limited to Discord input extraction, delegation, and sending the
   prepared response.
5. Test the service policy separately from Discord payload construction and command
   routing.

A truly trivial command may reply directly when it has no reusable validation,
branching, calculation, persistence, or specialized presentation. Extract a service
or response adapter as soon as any of those responsibilities appear; do not wait for
the command module to become large.

Use lowercase Discord command names, normally kebab-case. Put each new RPG
subcommand in its own file. Keep `description`, `usage`, `/help`, `/rpg help`, the
relevant dedicated help command, README, and tests synchronized.

`helpOrder` controls display order. The generation commands must appear in this
exact sequence:

1. `/rpg gen category:<category>`
2. `/rpg gen-char character-key:<new key> [level] [background]`
3. `/rpg gen-help`

Use autocomplete for all practical command arguments. Discord returns at most 25
autocomplete choices, so filter locally with `util/autocomplete.js`.

All bot-owned user-facing strings belong in `locales/en.json` and `locales/fr.json`
and are retrieved through `util/i18n.js`. Keep both catalogs at exact key parity.
Runtime language comes from the required `config.locale`, which must be `en` or
`fr`. Slash command and option names, internal values, enum
values, JSON properties, generator field identifiers, and saved data stay in
English. Use Discord description localizations for slash-command schema text, and
localize choice/autocomplete display labels without changing their English values.
Use `documentation/JDR_RANDOM_RULES_FR.md` as the canonical source for French game
terminology, including `PV`, `PR`, `PA`, `DD`, `LOI`, and `dons raciaux`. Treat that
French rulebook as read-only unless the user explicitly requests a rulebook change.
Register every character field once in `services/characterFieldCatalog.js`. Derive
editor/viewer choices, aliases, storage paths, and presentation labels from that
catalog; do not create parallel field maps in commands, models, services, or tests.
Add localized label keys in `util/characterDisplay.js` and both locale catalogs.

For private interaction responses, use:

```js
flags: MessageFlags.Ephemeral
```

Do not use the deprecated `ephemeral: true` option. The test suite rejects it.

## Current RPG command UX

The current viewing and editing decisions are intentional:

- `/rpg get character-key:<key>` posts the public character summary.
- `/rpg get character-key:<key> field:<field>` posts one complete detailed field.
- `/rpg get-help` lists all supported fields.
- There is intentionally no `/rpg get-all` command.
- `/rpg set character-key:<key> field:<field>` has no value argument. Submitting
  the command immediately opens one private modal prefilled with the saved value.
- `/rpg set-help` lists settable paths and explains modal input.
- Do not add section/field dropdown navigation back to the editor.

Textual collections have no per-entry `add`, `set`, `remove`, or `clear` action
syntax. The `/rpg set` modal presents their full multiline content and replaces it
on submit:

- One logical entry per line.
- Leading `- ` or `* ` is optional and normalized away.
- Empty multiline content clears the field.
- RULEs use `Name: Level: Description`, one RULE per line. The level is a positive
  whole number; descriptions may contain additional colons.

The model still stores traits, RULEs, status effects, equipment, and inventory in
structured arrays because generation and display logic depend on them. “No list
system” refers to the command UX, not removal of the internal schema.

## Character rules and permissions

A CharacterKey is the immutable save identifier and filename stem. It is distinct
from `firstName` and `lastName`. Keys:

- must start and end with a letter or number;
- may contain letters, numbers, periods, hyphens, and underscores;
- are unique and cannot be renamed through edit commands.

Character JSON is loaded through `Character.fromSave`; keep the model, editor,
generator, renderer, and tests aligned when changing the schema.
`appearance` is a standalone editable text field displayed directly below level and
race in the public summary.

Permissions:

- Anyone with normal bot access can view character sheets.
- The creator may set, delete, heal, damage, and end turns for their character.
- The configured DM role may perform those actions on every character and may use
  `/rpg gen` and `/rpg gen-char`.
- The configured moderator role may use `/say`, `/purge`, and `/restart`.
- The actual Discord server owner from `guild.ownerId` bypasses every role check
  and may use every command and manage every character.

`config.json` requires `locale`, `botUserId`, `roles.dm`, and `roles.moderator`.
`channels.teamVoice` is optional. Never configure an owner ID or owner role.

Resources and display:

- AP satisfies `0 <= current <= max <= 10`.
- AP uses filled/spent star icons for the raw current/max values.
- HP, AR, and MD use ten-icon percentage bars. Preserve the current colors:
  HP uses red/black hearts, AR uses blue/black squares, and MD uses orange/black
  squares.
- `/rpg heal` supports HP, armor, or both and sets each selected current resource
  to the same percentage of its own maximum.
- `/rpg damage` applies positive whole-number damage to current AR first, then current
  HP. With `piercing:true`, it bypasses AR. Piercing defaults to false.
- `/rpg end-turn` restores current AP and MD to maximum.

## Random generators

Every `.json` file in `data/generators/en/` automatically becomes a category after
the bot restarts. `data/generators/fr/` mirrors the English reference catalog with
localized display content. Both locales keep identical filenames, structure,
ordering, weights, placeholders, and technical values. The catalog derives each
internal ID from the English file, caches locales independently, and falls back to
the English file when a localized counterpart is absent. `/rpg gen-help` reads the
guild-localized catalog, explains both generation commands, and lists every
category.

Each generator file requires:

```json
{
  "name": "categoryName",
  "description": "Human-readable description",
  "entries": []
}
```

Supported entry forms:

- plain string, default weight `1`;
- `{ "value": "...", "weight": 2 }`;
- `{ "fields": { "Name": "...", "Description": "..." }, "weight": 2 }`.

Weights are positive numbers and default to `1`. Structured entries may contain 1
to 25 Discord-safe fields. Preserve backward compatibility with all three formats.
The catalog is cached for the process lifetime, so data changes require a restart.

Random character generation depends on exact category names and structured field
labels. Before renaming generator fields, inspect `services/randomCharacterGenerator.js`.
Generator IDs, `Generator` routing values, `Type`/`Rarity` enum values, JSON keys,
and structured field labels stay English in every locale. Autocomplete display
labels may be localized but must submit the aligned English value. Newly generated
content uses the guild locale and is then stored verbatim; never translate existing
save content retroactively.
Race entries must expose `Name`, `Description`, `Skill Bonus`, and
`Physical Ability`; generated characters copy the latter two into their racial
traits. The expanded world-generation set includes `monster`, `animal`, `criminal`,
`region`, `building`, `settlement`, `dungeon`, `room`, `companion`, `material`,
`faction`, `government`, and `religion`. The older `enemy` and `location`
categories are intentionally removed.
At present it:

- rolls level 1–10 when omitted;
- accepts an optional background category and otherwise rolls one from
  `background.json`; the routed background generator supplies `Appearance`,
  `Backstory`, and `Goals`;
- spends the entire level-based stat budget using nonlinear point costs;
- derives initiative and reflexes from speed;
- awards RULE points at Intelligence 10, 12, 14, 16, 18, and 20, then spends them
  on at most two RULEs by maximizing the first RULE before adding the second;
- derives HP, AP, and MD;
- chooses armor that meets Constitution requirements and derives AR from it;
- equips one armor and one or two weapons;
- adds three inventory items plus `level * 1D20 + 5` gold;
- gives a generated status effect with a 25% chance.

## Other bot behavior

- Online music/search playback commands were intentionally removed because they
  were unreliable.
- Local MP3 playback remains supported. When a member joins the configured team
  voice channel, the bot plays `media/Poutouyemoun.mp3`.

## Change methodology

Use this workflow for every feature, behavior change, bug fix, or data update:

1. Inspect the current implementation and `git status` before editing. Read the
   relevant command, service, model, tests, and data files; consult the rulebook or
   `data/generators/README.md` when the change touches those areas. Existing dirty
   changes and real character saves belong to the user unless explicitly stated
   otherwise.
2. Identify all coupled surfaces before implementing. Depending on the change, this
   can include slash-command schema and routing, autocomplete, authorization,
   persistence, editing, rendering, generator data, and error handling. Decide which
   layer owns each behavior before editing: commands adapt Discord interactions,
   services own feature rules, and response adapters own Discord presentation.
3. Add or update focused regression coverage whenever behavior changes and testing
   is practical. New commands should have schema, routing, autocomplete, permission,
   and behavior checks as applicable. Character or generator changes should test
   their invariants and persistence. Data-driven tests should derive expectations
   from the canonical data when exact values are intentionally configurable. Never
   weaken or remove a valid test merely to make a change pass. Test parsers,
   calculations, branching policies, and error codes directly at the service layer;
   test localization and Discord payload construction at the response-adapter layer;
   keep command tests focused on schema, delegation, and interaction integration.
4. Keep user-facing and agent-facing guidance synchronized when the affected
   behavior is documented:
   - update command metadata and `/help`, `/rpg help`, or dedicated help commands
     when command names, arguments, permissions, ordering, or UX change;
   - update `README.md` when setup, commands, examples, or user-visible behavior
     changes;
   - update `AGENTS.md` when architecture, durable conventions, invariants, or the
     expected agent workflow changes;
   - never edit `documentation/TTRPG_RANDOM_RULES_EN.md` or any other rulebook
     unless the user explicitly requests that specific kind of change. Treat
     rulebooks as read-only sources of truth by default.
5. Run targeted checks while iterating, then run the complete `npm test` suite and
   `git diff --check`. Confirm that no real file under `save/` was added, changed,
   or removed by validation.
6. Hand off with a concise summary of behavior, important assumptions, validation
   performed, and any remaining limitation. Do not claim live Discord behavior was
   tested unless the bot was actually run for that purpose.

## Safe change checklist

Before handing off a code change:

1. Preserve unrelated dirty work and every real file under `save/`.
2. Update command metadata, registration, autocomplete, help, and README together.
3. Keep generated data and `Character` schema consumers synchronized.
4. Never edit a rulebook unless the user explicitly requested it.
5. Use `MessageFlags.Ephemeral`, never `ephemeral: true`.
6. Keep command modules thin; move feature rules to services and specialized Discord
   rendering to response adapters.
7. Ensure domain models and services do not import Discord or translation catalogs,
   accept interaction objects, or render user-facing payloads. Extend the
   architecture check when introducing a new durable boundary.
8. Run `npm test`.
9. Run `git diff --check`.
10. Confirm tests did not add, modify, or remove real character saves.
