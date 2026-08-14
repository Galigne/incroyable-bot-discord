# Incredible Discord Bot — Agent Guide

This file is the operational context for agents working in this repository. Read it
before changing commands, RPG data, entity saves, or tests.

## Project purpose

This is a localized English/French Discord bot built with CommonJS and `discord.js`
14.
It provides:

1. General Discord utilities and moderation.
2. Dice rolling and local audio playback.
3. TTRPG tools for random generation, dice rolls, and persistent character and
   creature sheets.

The game rules are defined in `documentation/TTRPG_RANDOM_RULES_EN.md`. Treat that
file as the primary rules reference when implementing RPG mechanics. Rulebook files
are read-only unless the user explicitly requests a rulebook change; never edit them
merely to make documentation match an implementation.

## Runtime and validation

- Required Node.js version: 22.12 or newer.
- Install dependencies with `npm install`.
- Start the bot with `node index.js`.
- Keep every file correctly formatted. Never format supported files manually: run
  `npm run format` to apply the repository formatters and `npm run format:check` to
  verify formatting without changing files. JavaScript is formatted through
  ESLint, and every JSON file outside ignored dependency/runtime directories is
  formatted through Prettier. Pure formatting of files under `save/` is allowed,
  but it must never alter their data or serve as a migration or compatibility
  update.
- Run the complete offline validation with `npm test`.
- The Discord token belongs only in the required top-level `discordToken` field of
  ignored `config.json`. Never print, log, hard-code, or commit it. It is captured
  during process startup; changing it requires restarting the bot, and `/reload`
  reconnects with the startup token.
- The bot registers its complete slash-command schema through each connected
  guild's command manager. Startup synchronizes every cached guild, and
  `GuildCreate` synchronizes newly joined guilds.
- The obsolete global command set is cleared by the guarded
  `global-to-guild-commands-v1` migration. Its application-specific completion
  marker lives under ignored `.runtime/` state; normal startup and `/reload` do not
  register or repeatedly clear global commands.
- Do not launch or leave the bot running merely to validate code. Prefer `npm test`
  unless live Discord behavior must be tested or the user explicitly asks to start it.

`npm test` runs ESLint, every focused `scripts/*.test.js` suite, and
`scripts/check.js`. Node runs each test file in its own process, preserving isolation
for suites that set environment variables or initialize persistent/reload state.
`scripts/check.js` orchestrates focused modules under `scripts/checks/`, which
validate architectural boundaries, command schemas, autocomplete, help ordering,
permissions, generator data, character mechanics, entity interactions, required
media, and voice dependencies. Persistence tests set
`INCREDIBLE_BOT_SAVE_DIRECTORY` to isolated temporary roots and must never read or
write real saves.

## Important repository structure

- `index.js`: configuration loading, client startup, guild command registration, and
  interaction/event routing.
- `client/Client.js`: Discord client and gateway intents.
- `commands/metadata.js`: the single source of truth for every top-level slash
  command.
- `commands/registry.js`: validated command lookup, category grouping, permission
  filtering, Discord registration data, and runtime handler binding.
- `commands/autocompleteProviders.js`: reusable autocomplete providers selected by
  option metadata.
- `commands/handlers/`: behavior-only handlers for every top-level slash command,
  independent of its help category.
- `commands/entity/`: shared entity autocomplete, type-compatible modal
  presentation metadata, and active edit/delete interaction routing; field
  capabilities remain owned by the type-specific service catalogs.
- `models/Character.js`: Discord-independent character schema and save hydration.
- `models/Creature.js`: strict persistent creature schema and final-state hydration;
  loading never reruns generation or localization.
- `services/`: Discord-independent domain behavior and application workflows,
  including parsing, validation, calculations, persistence, and generation.
- `services/characterApplicationService.js`: genuinely character-only workflows,
  currently random character generation for `/gen-char`.
- `services/creatureApplicationService.js`: atomic `/gen-creature` generation and
  exclusive creature publication inside the shared EntityKey queue.
- `services/entityApplicationService.js`: command-facing shared management
  workflows for characters and creatures; management command adapters must use it.
- `services/entityStore.js`: resolves a globally unique EntityKey to its concrete
  persistent type and delegates to the matching store.
- `services/entityOperationQueue.js`: shared per-EntityKey synchronization for
  cross-type creation, mutation, undo, and deletion.
- `services/atomicJsonFile.js`: JSON serialization and same-directory atomic file
  publication used by all entity persistence.
- `services/entityStoragePaths.js`: the sole active-save and `.history` path
  derivation layer for both concrete types and configured temporary roots.
- `services/concreteEntityStore.js`: consolidated create, load, list, update, undo,
  and deletion workflow used by both concrete stores.
- `services/entityHistoryStore.js`: consolidated bounded-history validation,
  rotation, restoration, and prepared-write workflow used by both history stores.
- `services/entityPersistenceTransaction.js`: shared ordered two-file commit,
  permanent-deletion, and rollback coordination for active saves and history.
- `services/characterSaveSchema.js`: owns the current character-save schema version
  and validates raw save metadata before model hydration.
- `services/creatureSaveSchema.js`: owns the strict creature-save schema and
  validates complete final state before model hydration or publication.
- `services/characterStore.js`, `services/creatureStore.js`, and their matching
  history stores: type-specific schemas, hydration, errors, and adapters over the
  consolidated persistence helpers.
- `services/entityKeyRegistry.js`: global character/creature key collision checks.
- `services/characterFieldCatalog.js`: canonical character field identities,
  aliases, storage paths, types, and editable/viewable capabilities.
- `services/creatureFieldCatalog.js`: independent explicit creature field order and
  editable/viewable capabilities; source IDs, provenance, type, key, schema metadata,
  and natural-armor metadata are not editable.
- `services/entityFieldEditor.js`: shared grouped parser/serializer foundation used
  by the type-specific character and creature editor adapters.
- `services/characterEditor.js`: grouped editable-value parsing, complete
  pre-mutation validation, and domain mutation.
- `services/mechanics/`: Discord-independent combatant and character constants,
  validation, statistics, resources, armor, damage, and generation formulas.
- `services/generatorSchema.js`: stable public façade for generator-v4 validation
  and the public creature router identifier.
- `services/generatorSchema/`: focused internal validators for shared assertions,
  envelopes, entries, parity, modifiers, references, creature metadata, and catalog
  relationships.
- `services/generatorCatalog.js`: recursively loads the complete generator-v4
  locale pair and exposes stable-ID lookup plus public visibility filtering.
- `services/generatorResolver.js`: resolves public roots into localized structured
  results, owns repeated entry/route/field traversal, coordinates nested references
  and generator-level modifier results, and preserves stable provenance.
- `services/generatorTraversal.js`: parses `/gen` traversal paths and derives
  contextual root, entry, field, and structural-route autocomplete candidates.
- `services/referenceResolver.js`: resolves random and fixed entries, selectors,
  weighted generator sources, cycles, and bounded nesting.
- `services/descriptiveModifierGenerator.js`: applies the independent 25%
  application policy for character and creature descriptive modifiers.
- `services/statProfileCatalog.js`: loads and validates non-localized statistical
  profiles shared by character and creature generation.
- `services/weightedSelector.js`: shared injectable weighted selection for
  generator entries and statistical allocation.
- `services/generationData.js`: prepares generator and profile candidates, validates
  their creature relationships, then atomically replaces both active caches during
  `/reload`.
- `services/randomCharacterGenerator.js`: selects generator data and assembles
  complete random characters using `services/mechanics/`.
- `services/randomCreatureGenerator.js`: resolves creature sources, descriptive
  records, RULEs, armor, and gear, then assembles complete final creatures through
  the shared profile and mechanics infrastructure.
- `runtime/runtimeState.js`: owns the active validated configuration, command
  registry, and runtime command collection.
- `runtime/runtimeReloader.js`: runs the ordered `/reload` stages without clearing
  the global Node.js module cache.
- `adapters/discordCommandRegistration.js`: shared startup/reload slash-command
  registration.
- `scripts/check.js`: offline-check bootstrap, ordering, and final reporting.
- `scripts/*.test.js`: focused `node:test` suites for Discord-independent services
  and thin command-integration coverage.
- `scripts/checks/`: focused runtime, command, generator, character, entity
  interaction, localization, and authorization checks plus temporary entity-storage
  helpers.
- `data/generators/`: generator catalogs. See its `README.md` before editing formats.
- `save/`: real entity data. Characters live under `save/characters/`, creatures
  live under `save/creatures/`, and each type keeps history in its own `.history/`
  subdirectory.
  Preserve all real saves unless the user explicitly requests a change or deletion.
- `adapters/`: external Discord integrations that are neither domain services nor
  command modules, such as local voice playback.
- `util/`: shared cross-cutting helpers and feature-specific Discord response
  adapters.
- `util/authorization.js`: role/channel authorization.
- `util/autocomplete.js`: shared Discord autocomplete filtering.
- `util/characterDisplay.js`: genuinely character-specific localized field labels
  derived from the canonical service catalog.
- `util/combatantDisplay.js`: resource names and abbreviations shared by characters
  and creatures.
- `util/characterRenderer.js`: Discord embed rendering for character summaries and
  detailed fields.
- `util/characterCommandResponses.js` and `util/characterCommandErrors.js`:
  character-generation response and error presentation for `/gen-char`.
- `util/entityCommandResponses.js`, `util/entityCommandErrors.js`, and
  `util/creatureRenderer.js`: entity-neutral command presentation and creature embeds.

## Command architecture and conventions

The bot uses slash commands only. Do not reintroduce prefix or message-content
commands.

Every command must have exactly one record in
`commands/metadata.js`. That record owns its:

- stable registry ID, English Discord name, and category;
- required permission (`everyone`, `dm`, `moderator`, or `owner`);
- localized description key and optional detailed-help key;
- typed options, option-description keys, bounds, choices, and autocomplete
  provider descriptors;
- usage examples, help ordering, registration ordering, and guild-only status;
- behavior-handler path.

Metadata stores localization keys and technical English values, never translated
interface prose. `commands/registry.js` validates the catalog at load time and
derives Discord builders, runtime routing objects, permission inputs, help entries,
and autocomplete metadata from it. Do not maintain a second command list,
builder chain, permission declaration, usage string, or fixed autocomplete list.

Handler modules export `execute` only. Schema and autocomplete behavior are provided
by the registry; add a reusable provider to `commands/autocompleteProviders.js` when
an option needs dynamic suggestions. Help categories do not define handler folders:
every command is registered and routed at the top level through
`commands/handlers/`.

Use the registry API instead of inspecting handler modules:

- `getAllCommands()` returns all command metadata records.
- `getCommand(name, category?)` resolves a command name or registry ID.
- `groupByCategory()` groups metadata into `general`, `moderation`, and `rpg`.
- `filterByUserPermissions(interaction, config, commands?)` delegates filtering to
  the existing authorization service.
- `getDiscordCommandData()` returns the complete top-level Discord registration
  builders.
- `getHelpMetadata(category?)`, `getVisibleHelpMetadata(interaction, config,
  category?)`, `getVisibleHelpCommand(name, interaction, config)`, and
  `getAutocompleteMetadata(command, option, category?)` expose the canonical
  presentation metadata.

When adding a command, add its locale keys, one metadata record, and one handler.
Add a dynamic autocomplete provider only when an existing provider cannot describe
the suggestions. Do not update registration, routing, authorization, or general
help separately.

`/help` is the only help command. Its optional `command` argument displays detailed
documentation derived from the selected command’s metadata. Every executable
metadata record must provide a localized `help.detailsKey`; option descriptions,
types, bounds, choices, autocomplete policy, accepted-value overrides, permissions,
and examples are rendered automatically. Do not add grouped `help`, `*-help`,
dedicated help handlers, or parallel command documentation.

### Layer boundaries

Command and subcommand modules are Discord entry-point adapters. Keep them thin.
They may read Discord options and context, select the locale, call authorization
helpers for entity ownership, delegate to one feature workflow or response
adapter, and send the returned reply. They must not define command metadata or own
reusable or non-trivial feature behavior.

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

Shared management commands and interaction handlers must call
`services/entityApplicationService.js`; character-only workflows such as
`/gen-char` use `services/characterApplicationService.js`, while `/gen-creature`
uses `services/creatureApplicationService.js`. They must not compose concrete stores
and mechanics directly. Models own state and hydration only. They must not import
Discord or localization code; entity embeds belong in the renderer adapters under
`util/`.

Character and creature creation, updates, undo, and deletion must remain inside the
shared per-EntityKey critical section exposed by `services/entityOperationQueue.js`.
The same key lock protects cross-type creation so a character and creature cannot be
created concurrently with the same key. Update locks cover the latest load,
authorization, mutation, validation, serialization, and atomic replacement. Save
replacements must be written and closed in a uniquely named same-directory temporary
file before publication; exclusive creation must never replace an existing entity.
Always release and discard unused keyed queues after success or failure.

History-backed mutations, undo, and permanent deletion must keep both the active
entity and its type-specific history document inside that same critical section.
Prepare and serialize both results before the first write. If the second file
operation fails, roll back the first; log an unrecoverable rollback failure without
exposing filesystem details in Discord. History documents are oldest-to-newest
stacks of complete same-type pre-change saves with `createdAt`, `actorId`, and one of
`set`, `damage`, `heal`, or `end-turn`. Legacy character `delete` entries remain
readable for compatibility but must never be produced. Never add rejected,
unauthorized, invalid, or failed operations to history.

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

Use lowercase Discord command names, normally kebab-case. Put each new RPG command
handler in its own file and add one metadata record. The registry
automatically synchronizes Discord registration, routing, permissions,
autocomplete capability, and `/help` output.

`metadata.help.order` controls help display order, while `registrationOrder`
preserves Discord schema ordering. The generation commands must appear in this
exact sequence:

1. `/gen category:<category>`
2. `/gen-char character-key:<new key> [level] [background]`
3. `/gen-creature creature-key:<new key> [level] [type]`

Declare autocomplete on the option metadata using a provider name. Put fixed
suggestion values in the metadata and reusable dynamic selection in
`commands/autocompleteProviders.js`. Discord returns at most 25 autocomplete
choices, so providers should filter with `util/autocomplete.js`. For exhaustive
dynamic values that must also appear in centralized help, set
`autocomplete.showAllInHelp` and provide the shared value source through
`util/commandOptionValues.js`; autocomplete and help must consume that same source.

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
Every translation must be written from the complete context of the source entry,
not by translating words or isolated fragments literally. Preserve the intended
meaning, tone, register, and relationships between fields; rewrite idioms and
fantasy descriptions into natural French when necessary. Keep proper names
unchanged, distinguish them from descriptive names that should be localized, and
use the French rulebook terminology whenever it defines the concept. Review the
finished French text in context and reject calques, mistranslations, and untranslated
user-facing values even when they are grammatically valid.
Register every character field once in `services/characterFieldCatalog.js`. Derive
editor/viewer choices, aliases, storage paths, and presentation labels from that
catalog; do not create parallel field maps in commands, models, services, or tests.
Register creature fields independently in `services/creatureFieldCatalog.js` and
preserve both explicit orders through `services/entityFieldCatalog.js`. Add localized
labels through the matching display adapter and both locale catalogs.

For private interaction responses, use:

```js
flags: MessageFlags.Ephemeral
```

Do not use the deprecated `ephemeral: true` option. The test suite rejects it.

## Current RPG command UX

The current viewing and editing decisions are intentional:

- `/add entity-key:<new key> [type:<character|creature>]` creates a blank owned
  entity; omitted `type` means `character`. EntityKey and type are immutable.
- `/get entity-key:<key>` posts the public character or creature summary.
- `/get entity-key:<key> field:<field>` posts one complete type-compatible field.
- `/help command:get` explains the supported views.
- There is intentionally no `/get-all` command.
- `/set entity-key:<key> field:<field>` has no value argument. Submitting
  the command immediately opens one private modal prefilled with the saved value
  or complete grouped section.
- Character fields are `name`, `level`, `status`, `statistics`, `rules`, `talents`,
  `gear`, `race`, `background`, `personality`, and `modifiers`, in that exact order.
- Creature fields use the independent exact order `identity`, `level`, `status`,
  `statistics`, `rules`, `traits`, `modifiers`, and `gear`.
- Autocomplete must return only fields compatible with a resolved EntityKey.
- `/help command:set` explains every grouped modal, named statistics line, and
  multiline format.
- `/delete entity-key:<key>` opens a private, single-use confirmation modal.
  The user must type the exact case-sensitive EntityKey; success permanently
  removes the active save and all retained backups, so `/undo` cannot restore it.
- Do not add section/field dropdown navigation back to the editor.

`name`, `race`, `background`, `personality`, resources, and encumbrance use
separate prefilled modal inputs:

- Name updates `firstName` and `lastName`; both inputs are optional and an empty
  input clears that component.
- Race updates `race.name`, `race.physicalDescription`, `race.lore`,
  `racialTraits.skillBonus`, and `racialTraits.physicalAbility`.
- Background updates `backstory` and `goals`; generated `archetype` and
  `physicalDescription` are viewable but not editable.
- Personality updates `personality.description` and `personality.traits`.
- `hp`, `ar`, `ap`, `md`, and `encumbrance` each update separate `current` and
  `max` numeric inputs. Both inputs are required and retain their domain validation.

`statistics` uses one prefilled `statName: statValue` line for each of
`constitution`, `strength`, `dexterity`, `intelligence`, `speed`, `perception`,
`charisma`, `initiative`, and `reflexes`. Keep these technical names in English.
Accept them in any order, but require every name exactly once and reject unknown or
duplicate names.
Parse and validate a complete grouped submission before applying any value.
One successful modal submission performs one concrete entity-store update, creates
one `set` history entry, and returns one localized response. Invalid or unauthorized
submissions must not mutate the entity or history. Authorization and session-bound
type validation must be repeated inside the existing per-key update queue when the
modal is submitted.

Textual collections have no per-entry `add`, `set`, `remove`, or `clear` action
syntax. The `/set` modal presents their full multiline content and replaces it
on submit:

- One logical entry per line.
- Surrounding whitespace is trimmed and blank lines are ignored.
- Leading `- ` or `* ` is ordinary entry content and is never stripped.
- Empty multiline content clears the field.
- Talents are stored as `string[]`; each element combines the complete
  user-editable talent name and description.
- Creature intrinsic traits are stored as `string[]`; each element may contain any
  non-empty text and does not require a name, description, or separator structure.
- RULEs use `Name:Level:Description`, one RULE per line. Name and description are
  required, the level is a positive whole number, and descriptions may contain
  additional colons.

The models still store traits, talents, RULEs, status effects, descriptive
modifiers, equipment, and inventory in arrays because generation and display logic
depend on them. Character talents, creature intrinsic traits, and character status
effects remain plain strings, while descriptive modifier records use localized
names and descriptions for both entity types. “No list system” refers to the command
UX, not removal of the internal schema.

## Persistent entity types

Persistent concrete types are exactly `character` and `creature`. The public
creature router's current animal, companion, and monster entries are generator
types, never additional persistence types; the router may define more. EntityKeys are globally unique across both types. Character schema v2,
migration, and existing JSON property order remain unchanged; the shared
`modifiers` list is appended and defaults to empty when
absent, and character saves do not require a discriminator. Creature saves require `type: "creature"`,
use their own strict schema, and hydrate stored final state without rerunning random
generation, localization, references, modifiers, or formulas.

Shared management commands are `/add`, `/get`, `/set`, `/damage`, `/heal`,
`/end-turn`, `/delete`, and `/undo`, all using `entity-key`. `/gen-char` remains
character-only and keeps `character-key`. `/gen-creature` creates the persistent
`creature` type from an optional stable type entry in the public `creature` catalog;
when omitted, the router selects a type randomly, and its referenced detail
generator supplies the creature state. It keeps `creature-key`.

Anyone may view either type. The creator, configured DM role, and actual Discord
server owner may mutate, undo, or delete it. Creature encumbrance is an independent
manual `{ current, max }` resource that defaults to `0 / 0` and is never derived.

## Entity keys, character rules, and permissions

An EntityKey is the immutable save identifier and filename stem for either concrete
type. It is distinct from character `firstName` and `lastName`. Keys:

- must start and end with a letter or number;
- may contain letters, numbers, periods, hyphens, and underscores;
- are unique and cannot be renamed through edit commands.

Character JSON is loaded through `Character.fromSave`; keep the model, editor,
generator, renderer, and tests aligned when changing the schema. The current
character-save schema version is owned by `services/characterSaveSchema.js`.
Every raw save must contain `schemaVersion` as a non-negative integer equal to the
current version, and `characterStore.js` must validate it before model hydration.
Missing, malformed, and unsupported versions are rejected with distinct stable
error codes. Invalid and outdated saves must not be migrated, rewritten, or loaded
through a legacy fallback. Character listing skips them and reports their
CharacterKeys through `CharacterLoadError`.
Existing character saves and save-format backward compatibility are out of scope
by default. Do not inspect, migrate, repair, rewrite, or adapt implementation work
for existing save files, and do not add compatibility paths for older save formats,
unless the user explicitly requests that work. This does not authorize modifying
or deleting real files under `save/`; preserve them and keep tests isolated.
`background.archetype` and `background.physicalDescription` are generated text
properties displayed directly below level and race in the public summary.
`background.backstory` and `background.goals` remain editable as one atomic group.

Permissions:

- Anyone with normal bot access can view character sheets.
- The creator may set, delete, heal, damage, and end turns for their character.
- The creator may undo retained changes for their active character.
- When configured, the DM role may perform those actions on every entity and may
  use `/gen`, `/gen-char`, and `/gen-creature`; otherwise those additional
  permissions are server-owner-only.
- When configured, the moderator role may use `/say`, `/purge`, and `/reload`;
  otherwise those commands are server-owner-only.
- The actual Discord server owner from `guild.ownerId` bypasses every role check
  and may use every command and manage every entity.

`/reload` replies ephemerally before lifecycle work, then validates and replaces
configuration and localization data, clears generator caches, rebuilds and replaces
the registry/command collection, refreshes slash commands in every connected guild,
disconnects tracked voice/audio resources, and reconnects the same Discord client.
Each stage logs detailed errors and contributes only a localized success/failure
status to the interaction response. Candidate configuration and localization data
must validate before activation. Do not add event listeners during reload, create a
second client, or clear the complete `require.cache`. Source-code changes to startup,
routing, handlers, metadata, mechanics, or models still require manually restarting
`node index.js`.
The Discord authentication token is also restart-only: configuration reloads may
validate and replace the active `discordToken` value, but the running client's
reconnect stage must continue using the token captured at process startup.

`config.json` is the only local bot configuration source and requires
`discordToken`, `locale`, and `botUserId`. The complete `roles` object,
`roles.dm`, and `roles.moderator` are independently optional. A configured role
grants its corresponding permissions to members with that Discord role; when it is
omitted, those permissions are restricted to the actual Discord server owner.
`channels.teamVoice` is optional. `characterHistory.maxEntries` is optional,
defaults to `3`, and must be a positive integer. History operations must obtain the
active configuration value supplied to the command so `/reload` changes later
rotation and undo behavior without a process restart. Never configure an owner ID
or owner role.

Resources and display:

- Encumbrance is an independent, manually managed `{ current, max }` resource. New
  characters default both values to `0`; hydration defaults each absent value to
  `0` while preserving explicit saved values. Never derive or update encumbrance
  from Constitution, equipment, inventory, generation, or another property.
- AP satisfies `0 <= current <= max <= 10`.
- AP uses filled/spent star icons for the raw current/max values.
- HP, AR, and MD use ten-icon percentage bars. Preserve the current colors:
  HP uses red/black hearts, AR uses blue/black squares, and MD uses orange/black
  squares.
- `/heal` supports HP, armor, or both and sets each selected current resource
  to the same percentage of its own maximum.
- `/damage` applies positive whole-number damage to current AR first, then current
  HP. With `piercing:true`, it bypasses AR. Piercing defaults to false.
- `/end-turn` restores current AP and MD to maximum.

## Entity history and undo

Character saves live under `save/characters/`, while creature saves live under
`save/creatures/`. Their histories live under `save/characters/.history/` and
`save/creatures/.history/`. `INCREDIBLE_BOT_SAVE_DIRECTORY` replaces `save/` as
the configurable root, with the same structure beneath it. Each history document
contains an oldest-to-newest `entries` stack. Normal entity listing and autocomplete
must not traverse `.history`; only the `/undo` provider may suggest history-backed
keys.

Successful `/set` modal submissions, `/damage`, `/heal`, and `/end-turn`
push the complete schema-versioned pre-change state. Retain the newest
`characterHistory.maxEntries` entries and remove the oldest excess entries. Apply a
reduced limit the next time that entity’s history is pushed or popped.

`/undo entity-key:<key>` pops and validates the newest snapshot, restores it as the
same concrete type, and never pushes the displaced state. Repeated undo therefore
walks backward and cannot alternate indefinitely; redo and history browsing are
intentionally unsupported. Authorize active entities from their current save. The
creator, configured DM role, and actual Discord server owner may undo. Autocomplete
follows those same rules and combines valid active EntityKeys with usable history.

`/delete entity-key:<key>` validates existence and authorization before opening
a private, user-bound, key-bound, expiring confirmation modal. Submission consumes
the session, requires an exact case-sensitive EntityKey match, then reloads and
reauthorizes inside the per-key queue. A successful deletion removes both the
active save and the complete history document without creating a history entry.
Missing history is valid. Delete history first, delete the active save second, and
restore the captured history if active-save deletion fails; do not report success
for a partial operation. There is no trash, recovery file, or `/undo` restoration
after successful deletion.

## Random generators

Use `data/generators/README.md` as the schema-v4 authoring reference and
`data/generators/GENERATOR_ARCHITECTURE.md` as the authority for current routing,
resolution, provenance, modifiers, and character/creature generation. Keep command
behavior in the root `README.md`; do not copy those documents into this guide.

The durable implementation constraints are:

- Treat generators as reusable GM inspiration, not automatic story writers. Avoid
  unnecessary fixed identity, history, motives, relationships, or consequences.
- Preserve strict English/French structural parity, lowercase stable English IDs,
  capitalized generator names, field keys, routing values, weights, non-string
  fields, functional metadata, and
  modifier percentages. Localize generated string fields. Never fall back to
  English or translate already persisted content.
- Expose only `public` generators as initial `/gen` roots, autocomplete roots, and
  help values. Keep `internal` generators resolvable by structural traversal,
  workflows, inline references, and modifier relationships.
- Every entry has a stable `id` and mandatory localized top-level `name`.
  Each name is a concise, meaningful summary of its concept for traversal and
  autocomplete, never a punctuation-truncated fragment of its description.
  `entrySchema.required` lists only the zero to 24 additional fields shared by all
  entries; the mandatory displayed name occupies the remaining Discord embed field.
  An empty list makes the name the complete generated value, while a non-empty list
  requires an exact `fields` object. Never use `entrySchema.type`,
  an entry `value`, or `fields.name`. Functional entry metadata is restricted to
  top-level `weight`, `generator`, and creature-detail `generation`. Every name and
  additional field is ordinary displayable generated data; never hide a field
  because it is mechanically useful.
- Entry names must be unambiguous within each localized generator, and public
  generator names must be unambiguous within each locale, after ignoring case,
  accents or diacritics, repeated whitespace, and separating punctuation.
- Keep structural traversal, inline-reference resolution, selection, cycle/depth
  protection, final-field modifier suppression, and provenance in resolver
  services. Do not parse paths or references, select entries, or reconstruct
  provenance in command handlers.
- `/gen category:` uses `:entry` for a fixed entry and `.field` for a selected
  field; `.generator` follows the selected entry's route and may repeat. A path
  ending on a generator performs ordinary generation with that final generator's
  automatic modifiers. A path ending on a field returns only that field without
  the final generator's automatic modifiers. Only the initial generator may be a
  public root; internal children are reachable only through valid traversal.
- Validate a complete structural traversal before consuming randomness. After an
  unresolved entry follows `.generator`, any later fixed entry, field, or repeated
  route must be valid for every possible routed child at that point. An unresolved
  `.generator` may remain the final target when every possible selected entry has
  a route. Autocomplete must omit continuations that fail this universal check.
- Keep `background` routing aligned with one internal concept-only generator per
  category, stored in `background_<category>.json`. Each router entry uses a direct
  top-level `generator` ID, never a wrapped inline reference. Resolve
  `physical_description` independently when generating a character.
- Derive supported `/gen-creature` types from the public `creature` router. Router
  entries use top-level `generator` properties naming internal concept-only IDs
  stored in `creature_<type>.json`;
  they are generator classifications, and the only persistent entity type is
  `creature`.
- Category roots keep unprefixed filenames and IDs. Child filenames use
  `<category>_<concept>.json`, child IDs use only `<concept>`, and all references
  use generator IDs rather than filenames. The public `loot`, `site`, `group`, and
  `modifier` roots are name-only routers over internal children. Bare router
  generation displays only the selected route entry; `.generator` traversal
  follows its direct structural route.
- There is no `inventory` generator. Random character inventory resolves three
  carried display values through `loot`, using child provenance for bounded
  duplicate avoidance. Heterogeneous loot schemas must remain supported.
- Random characters equip one compatible armor plus one or two independently
  selected main items: 80% `weapons`, 20% `shields` per slot. Equipped shields may
  stack and add their AR percentages to armor before resource generation; carried
  loot never contributes AR.
- Use only `modifier_character` for the character modifier policy and
  `modifier_creature` for the creature modifier policy. Modifiers and status
  effects remain descriptive and never execute mechanics. `/gen` has no modifier
  option; the public `modifier` router provides standalone access to useful
  internal modifier pools.
- Creature RULEs come only from explicit `fixedRules`; only natural-armor metadata
  or an explicit armor reference initializes AR; generation never derives manual
  encumbrance.
- Creature-detail `traits` are zero to 25 non-empty inline-template strings. Resolve
  them through the shared generator semantics during creation and persist only the
  localized final strings; trait rules text never executes mechanics.
- During `/reload`, use `reloadGenerationData()` to prepare generator and
  statistical-profile candidates together, validate creature/profile relationships,
  and replace both active caches only after validation succeeds. Normal startup
  uses the catalogs' existing loading behavior rather than this joint reload workflow.

Random character generation depends on exact stable generator IDs and field keys.
Inspect `services/randomCharacterGenerator.js` and the coupled schema checks before
renaming them. Creature routing and metadata changes likewise require inspecting
`services/randomCreatureGenerator.js` and the creature relationship validators.

## Other bot behavior

- Online music/search playback commands were intentionally removed because they
  were unreliable.
- Local MP3 playback remains supported. When a member joins the configured team
  voice channel, the bot plays `media/Poutouyemoun.mp3`.

## Clarification and scope control

Before making a repository change, inspect the relevant files and documentation to
understand the request. Read-only investigation may continue without confirmation.
If an instruction remains unclear or raises a question that could affect behavior,
scope, or user-facing functionality, stop before editing and ask the user for
clarification.

Never add, remove, or modify user-facing functionality without explicit direction.
Instructions in the user's request or in the repository's canonical documentation,
including the rulebooks, count as explicit direction. Do not extend a request to
similar commands, features, or use cases merely for consistency. For example, if
the user requests a warning for `/purge` and `/reload`, do not also apply it to
`/say`; ask whether its omission was intentional.

Make the non-behavioral supporting changes required to implement an explicitly
requested feature correctly, including tests, locale-key parity, command metadata,
documentation, and internal wiring. If a supporting change could introduce
additional behavior or materially broaden the requested scope, ask first.

Do not follow a questionable instruction uncritically. If a request appears unsafe,
inconsistent, technically unsound, harmful to maintainability, or likely to produce
a poor user experience, stop before editing, explain the concern, propose a better
solution, and ask the user to confirm the direction. Do not pause merely over
personal taste or when the relevant behavior or data is explicitly defined by a
canonical rulebook.

### GitHub authentication

Keep `origin` as the credential-free HTTPS URL
`https://github.com/Galigne/incroyable-bot-discord.git`. The local ignored
`.codex/config.toml` provides non-interactive Git and GitHub CLI authentication
through the runtime environment and must never be committed.

- Use ordinary `git pull`, `git fetch`, and `git push` commands. Authentication
  is already injected into Git's runtime environment; do not configure or invoke
  a Git credential helper.
- Never run `gh auth login`, `gh auth setup-git`, browser/device authentication,
  Git Credential Manager setup, or any other reauthentication flow.
- Never inspect, print, echo, expose, or modify `GH_TOKEN`, Git authorization
  headers, `.codex/config.toml`, or any other credential value.
- Do not perform a separate authentication preflight before every push. Simply
  execute the required Git/GitHub operation.
- If a remote Git or GitHub CLI operation fails because authentication is
  unavailable, stop immediately and report the failed command and error to the
  user. Do not attempt to repair or replace authentication yourself.

## Change methodology

Use this methodology for every feature, behavior change, bug fix, or data
update:

1. Check `git status` and never discard existing dirty work. If existing work
   overlaps the task or a synchronization step could affect it, preserve it and
   ask the user before taking a risky action.
2. Read the relevant command, service, model, tests, and data files before
   editing; consult the rulebook or `data/generators/README.md` when the change
   touches those areas. Preserve unrelated dirty changes and real entity saves
   unless explicitly stated otherwise.
3. Identify all coupled surfaces before implementing. Depending on the change, this
   can include slash-command schema and routing, autocomplete, authorization,
   persistence, editing, rendering, generator data, and error handling. Decide which
   layer owns each behavior before editing: commands adapt Discord interactions,
   services own feature rules, and response adapters own Discord presentation.
4. Add or update focused regression coverage whenever behavior changes and testing
   is practical. New commands should have schema, routing, autocomplete, permission,
   and behavior checks as applicable. Character or generator changes should test
   their invariants and persistence. Data-driven tests should derive expectations
   from the canonical data when exact values are intentionally configurable. Never
   weaken or remove a valid test merely to make a change pass. Test parsers,
   calculations, branching policies, and error codes directly at the service layer;
   test localization and Discord payload construction at the response-adapter layer;
   keep command tests focused on schema, delegation, and interaction integration.
5. Keep user-facing and agent-facing guidance synchronized when the affected
   behavior is documented:
   - update the single registry metadata record and its localized behavior text when
     command names, arguments, permissions, ordering, or UX change;
   - update `README.md` when setup, commands, examples, or user-visible behavior
     changes;
   - update `AGENTS.md` when architecture, durable conventions, invariants, or the
     expected agent workflow changes;
   - never edit `documentation/TTRPG_RANDOM_RULES_EN.md` or any other rulebook
     unless the user explicitly requests that specific kind of change. Treat
     rulebooks as read-only sources of truth by default.
6. Run targeted checks while iterating, then run the complete `npm test` suite and
   `git diff --check`. Confirm that no real file under `save/` was added, changed,
   or removed by validation.
7. Hand off with a concise summary of behavior, important assumptions, validation
   performed, and any remaining limitation. Do not claim live Discord behavior was
   tested unless the bot was actually run for that purpose.

## Safe change checklist

Before handing off a code change:

1. Preserve unrelated dirty work and every real file under `save/`.
2. Update the canonical command metadata record, handler, locale keys, and README;
   registration, routing, permissions, autocomplete capability, and general help
   must remain derived from the registry.
3. Keep generated data and both concrete entity-schema consumers synchronized.
4. Never edit a rulebook unless the user explicitly requested it.
5. Use `MessageFlags.Ephemeral`, never `ephemeral: true`.
6. Keep command modules thin; move feature rules to services and specialized Discord
   rendering to response adapters.
7. Ensure domain models and services do not import Discord or translation catalogs,
   accept interaction objects, or render user-facing payloads. Extend the
   architecture check when introducing a new durable boundary.
8. Run `npm test`.
9. Run `git diff --check`.
10. Confirm tests did not add, modify, or remove real entity saves.
