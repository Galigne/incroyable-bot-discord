# Incredible Discord Bot

A Discord bot with moderation, utility, local audio, and RPG entity-management commands.

## Requirements

- Node.js 22.12 or newer
- The bot installed with the `bot` and `applications.commands` scopes

## Installation

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env`.
3. Generate a bot token in the Discord Developer Portal.
4. Set `DISCORD_TOKEN` in `.env`.
5. Copy [`config.json.example`](config.json.example) to `config.json` and replace
   each explanation with the corresponding Discord value.
6. Start the bot with `node index.js`.

The bot registers its complete slash-command set separately in every connected
guild and immediately synchronizes commands when it joins a new guild. The first
startup after migration removes obsolete global commands and records that one-time
cleanup under ignored `.runtime/` state; later startups do not touch global command
registration.

## Localization

All bot-owned user-facing text is centralized in `locales/en.json` and
`locales/fr.json`. Slash command and option names remain English, while Discord
receives localized French descriptions and choice labels.
French game terminology follows `documentation/JDR_RANDOM_RULES_FR.md`; for example,
the localized interface uses PV, PR, PA, DD, LOI, and dons raciaux.
Character and creature field identities, aliases, storage paths, and editing/viewing
capabilities are defined by their service catalogs and combined only for shared
entity commands. Localized labels and resource abbreviations are resolved through
the display adapters. Resource abbreviations are unique within each language:
HP/AR/AP/MD in English and PV/PR/PA/DD in French.

Generator schema v2 catalogs follow the same server locale. English reference
files live in `data/generators/en/` and matching French display content in
`data/generators/fr/`; the complete catalog is rejected when a locale counterpart
is missing or structurally incompatible. Public generators appear in `/gen`,
autocomplete, and help, while internal components remain workflow-only.
Autocomplete labels and generated text are localized, while stable generator and
entry IDs, structured field keys, enum values, and routing values remain English.
Public template generators can compose nested random or fixed references, including
weighted choices between internal sources. Completed results retain technical
provenance, and configured narrative modifiers are displayed separately without
changing base generated mechanics.
The public `creature` catalog routes `animal`, `companion`, and `monster` types to
their internal `creature-*` sources. Those sources use the same references and
profiles to persist a complete final creature, including provenance, without
rerunning generation on load or display. Status effects and descriptive modifiers
come from catalogs shared with character generation.
Content already saved in an entity is never translated retroactively.

Set the required runtime language in `config.json`. The complete configuration is:

```json
{
  "locale": "fr",
  "botUserId": "YOUR_BOT_USER_ID",
  "roles": {
    "dm": "YOUR_DM_ROLE_ID",
    "moderator": "YOUR_MODERATOR_ROLE_ID"
  },
  "characterHistory": {
    "maxEntries": 3
  },
  "channels": {
    "teamVoice": "OPTIONAL_TEAM_VOICE_CHANNEL_ID"
  }
}
```

`locale` and `botUserId` are required. The only supported locale values are `en`
and `fr`; invalid or missing values stop startup with a clear error. The `roles`
object, `roles.dm`, and `roles.moderator` are independently optional. A configured
role grants its corresponding permissions to members with that Discord role. If a
role is omitted, those actions are restricted to the actual server owner. Present
role values must be non-empty Discord role ID strings. `channels.teamVoice` and the
`channels` object are optional.
`characterHistory.maxEntries` is also optional, defaults to `3`, and must be a
positive whole number when present. Changing it and running `/reload` changes the
limit used by subsequent history operations without restarting the process.
The guide file explains what belongs in each field and is never loaded by the bot.
Do not configure an owner user or owner role: the bot reads the actual server owner
from Discord.

Never commit `.env` or a Discord token. Reset any token that has previously been committed.

## Commands

- `/help` — list commands available to you, grouped by category
- `/help command:<command>` — show permissions, parameters, accepted values, examples, and behavior
- `/say message:<text>`
- `/purge amount:<2-100>`
- `/reload` — reload supported runtime state and reconnect the existing Discord client
- `/rules`
- `/gen category:<category>` — generate a random prompt (configured DM role or server owner)
- `/gen-char character-key:<new key> [level] [background]` — generate and save a complete character (configured DM role or server owner)
- `/gen-monster creature-key:<new key> type:<monster|animal|companion> [level]` — generate and atomically save a complete creature (configured DM role or server owner)
- `/roll expression:<dice expression>` — roll expressions such as `2d6+3`
- `/add entity-key:<new key> [type:<character|creature>]` — create a blank owned entity; character is the default
- `/get entity-key:<key> [field]` — display the summary or one type-compatible field
- `/set entity-key:<key> field:<field>` — set one grouped field in a prefilled form
- `/heal entity-key:<key> resource:<hp|armor|both> percentage:<0-100>` — restore one or both resources
- `/damage entity-key:<key> damage-amount:<number> [piercing]` — apply damage to AR, then HP
- `/end-turn entity-key:<key>` — restore AP and MD to their maximum values
- `/delete entity-key:<key>` — permanently delete an entity and all backups after exact-key confirmation
- `/undo entity-key:<key>` — consume and restore the newest retained pre-change state

Discord provides native validation and choices for constrained options.
Autocomplete suggests commands the current user may access, existing EntityKeys,
type-compatible fields, generator categories, common dice expressions, levels, and
common purge amounts. `/undo` autocomplete includes authorized active entities with
usable history. The private form opens immediately after `/set` is submitted.
Character fields are `name`, `level`, `status`, `statistics`, `rules`, `talents`,
`gear`, `race`, `background`, `personality`, and `modifiers`. Creature fields independently use
`identity`, `level`, `status`, `statistics`, `rules`, `traits`, `modifiers`, and
`gear`.

Name uses separate optional first-name and last-name inputs; emptying either input
clears that component. Race uses separate inputs for its name, physical description,
lore, skill bonus, and physical ability. Background uses separate appearance,
backstory, and goals inputs. Personality uses separate description and traits
inputs.

HP, AR, AP, MD, and encumbrance each use separate required Current and Maximum
numeric inputs. Every grouped form is prefilled, validated completely, and saved
as one atomic update. Encumbrance is a manually managed resource that defaults to
`0 / 0`; it is not derived from Constitution, equipment, inventory, or any other
character property.

Statistics use one prefilled `statName: statValue` line for each of
`constitution`, `strength`, `dexterity`, `intelligence`, `speed`, `perception`,
`charisma`, `initiative`, and `reflexes`. These English names may appear in any
order but must each appear exactly once; the complete group is validated before
any statistic changes.

Personality traits, talents, status effects, equipment, and inventory use one
entry per line. Optional leading `- ` or `* ` markers are normalized away, empty
lines are ignored, and an empty submission clears the complete collection. Talent
names and descriptions remain combined in each list entry. RULEs use
`Name:Level:Description`, one per line. Each value is required, the level must be a
positive whole number, and only the first two colons are separators, so descriptions
may contain additional colons.

Descriptive modifiers are shared by characters and creatures and use one
`Name:Description` record per line. Existing character saves without a `modifiers`
property load it as an empty list; no save-file migration or rewrite is performed.

Discord displays at most 25 autocomplete suggestions at once, so type part of a
name or value to filter longer lists. `/help command:gen` lists every localized
generator category, and `/help command:set` lists every editable field grouped by
section. Both lists are generated from the same catalogs used by autocomplete.

Dice expressions use one `COUNTdSIDES` group with an optional `+MODIFIER` or
`-MODIFIER`, such as `1d20`, `2d6+3`, or `4d8-2`. A roll is limited to 100 dice,
1,000 sides per die, and an absolute modifier of 10,000. Advanced dice operators,
multiple groups, parentheses, and other arithmetic are not supported. Exact
`1d2` and `1d20` rolls return their corresponding GIF only; all other expressions
return the textual roll breakdown.

Entity creators can edit, delete, heal, damage, end turns, and undo retained changes
for their own characters or creatures. When configured, the DM role lets its
members perform those actions on every entity and use `/gen`, `/gen-char`, and
`/gen-monster`; without that role, those additional DM permissions are
server-owner-only. When configured, the
moderator role lets its members use `/say`, `/purge`, and `/reload`; without it,
those moderation commands are server-owner-only. The actual Discord server owner,
identified by Discord rather than configuration, may use every command and manage
every entity.

`/reload` acknowledges privately before disconnecting, then reloads and validates
`config.json` and both localization catalogs, clears localized generator caches,
rebuilds and replaces the runtime command registry, refreshes slash commands in
every connected guild, cleans up active voice/audio resources, and reconnects the
same Discord client without terminating Node.js. Its final private response lists
every successful and failed stage. Invalid configuration or localization
replacements do not replace the previous valid state. Source-code changes—including startup,
event-routing, mechanics, model, metadata, and handler changes—still require
manually restarting `node index.js`.
The identifier supplied to `/add`, `/gen-char`, or `/gen-monster` remains the stable
command/save key and cannot be edited. Character sheets store `firstName` and
`lastName` separately for display.
Keys may contain internal periods, hyphens, and underscores, such as `D.Robert`.

## Entity history and undo

Successful `/set`, `/damage`, `/heal`, and `/end-turn` operations push the entity's
complete pre-change save into its type-specific history. Character saves use
`save/characters/<EntityKey>.json`, with history under
`save/characters/.history/<EntityKey>.json`. Creature saves use
`save/creatures/<EntityKey>.json`, with history under
`save/creatures/.history/<EntityKey>.json`. When
`INCREDIBLE_BOT_SAVE_DIRECTORY` is set, that directory replaces `save/` as the
storage root and the same `characters/` and `creatures/` structure is created
beneath it. History documents contain an oldest-to-newest
`entries` stack; each entry records its ISO timestamp, actor Discord ID, action,
and complete schema-versioned entity snapshot. Because history is stored in
subdirectories, it never appears in normal entity listings or autocomplete.

Each push keeps the newest configured number of entries and discards older excess
entries. A lower limit is applied the next time that entity's history changes.
`/undo` validates and consumes the newest entry, then restores it atomically as the
same concrete entity type. Repeated calls continue backward until the bounded stack
is empty. Undo does not push the displaced state, so it cannot toggle between two
states, and redo is not supported.

Entity and history writes share the existing per-EntityKey queue. Both
resulting JSON states are serialized before the first file operation. If the second
file operation fails, the first is rolled back; an unrecoverable rollback failure
is logged server-side while Discord receives only a localized, filesystem-neutral
error. Rejected, unauthorized, invalid, and failed mutations do not intentionally
create backups.

`/delete` opens a private confirmation form and requires the exact, case-sensitive
EntityKey. A successful confirmation permanently removes both the active save
and the entire retained history document in the same per-key critical section.
Deletion creates no backup, cannot be reversed with `/undo`, and has no trash or
recovery location. If the two-file deletion cannot complete, the first file
operation is rolled back before an error is returned.

Example workflows:

```text
/gen-char character-key:D.Robert level:5 background:adventurer
/gen-monster creature-key:Ash.Wolf type:monster level:5
/set entity-key:D.Robert field:statistics
/get entity-key:Ash.Wolf field:traits
/damage entity-key:Ash.Wolf damage-amount:25 piercing:false
/heal entity-key:Ash.Wolf resource:both percentage:50
/end-turn entity-key:Ash.Wolf
/undo entity-key:Ash.Wolf
```

Random characters use the rulebook's stat budget and nonlinear stat costs. Their
RULE Points come from Intelligence thresholds and are spent on at most two RULEs,
prioritizing the first RULE's level; HP, AP, MD, armor eligibility, AR,
talent count, equipment, inventory, and gold are derived automatically. Encumbrance
remains manually managed, so generated characters keep the normal `0 / 0` default.
Generated talents are stored as unique localized list entries: levels 1–2 receive
one talent, levels 3–5 receive two, levels 6–8 receive three, and levels 9–10
receive four.
If the optional level is omitted, a level from 1 to 10 is rolled. The optional
background selects one of the configured background categories and is also chosen
randomly when omitted. It generates the character's appearance, backstory, and goals.

Random creatures select an `animal`, `companion`, or `monster` route from the
public `creature` catalog, then generate from its internal `creature-animal`,
`creature-companion`, or `creature-monster` source. They share the character level budget, nonlinear statistic allocation,
derived statistics, and resource formulas while using creature-specific profile
distributions. Only explicit source references grant creature RULEs; Intelligence
and descriptive modifiers never do. Natural armor or technical armor metadata may
initialize AR, status effects and modifiers remain descriptive, and generated gear
does not alter manual encumbrance. The complete localized result and stable
provenance are saved once and never regenerated during later loading or display.

AP follows `0 ≤ current ≤ max ≤ 10` and uses 🌟 for available points and ⭐ for
spent points. HP, AR, and MD use ten-icon percentage bars.

The full TTRPG rules are available in
[`documentation/TTRPG_RANDOM_RULES_EN.md`](documentation/TTRPG_RANDOM_RULES_EN.md).

## Project structure

- `commands/handlers/`: one thin Discord adapter per top-level slash command,
  independent of help category
- `commands/metadata.js`: centralized command schema, permissions,
  localization keys, options, accepted-value documentation, autocomplete
  descriptors, examples, and detailed behavior keys
- `commands/registry.js`: command lookup, category grouping, permission filtering,
  Discord registration data, and runtime routing
- `commands/autocompleteProviders.js`: shared metadata-selected autocomplete logic
- `commands/entity/`: shared entity autocomplete, modal presentation, and active
  edit/delete interaction routing
- `services/entityOperationQueue.js`: the shared per-EntityKey critical section for
  cross-type creation, mutation, undo, and permanent deletion
- `services/entityStoragePaths.js`: active-save and history paths for both concrete
  types beneath the configured storage root
- `services/concreteEntityStore.js` and `services/entityHistoryStore.js`:
  consolidated persistence and bounded-history workflows adapted by the character
  and creature stores
- `services/entityPersistenceTransaction.js`: rollback-safe coordination of active
  saves and history documents
- `services/atomicJsonFile.js`: shared JSON serialization and same-directory atomic
  publication used by entity saves and histories
- `services/`: remaining Discord-independent application workflows, parsing,
  validation, mechanics, and generation
- `models/`: Discord-independent domain models
- `util/`: Discord response/rendering adapters plus shared localization,
  authorization, autocomplete, command-loading helpers, and
  `combatantDisplay.js` resource formatting for both entity types
- `adapters/`: external Discord integrations such as local voice playback
- `runtime/`: active runtime state and explicit reload-stage orchestration
- `data/generators/en/` and `data/generators/fr/`: localized JSON prompt catalogs
- `locales/`: English and French user-interface catalogs
- `scripts/`: focused `node:test` suites and offline integration checks

Run `npm test` to run ESLint, every focused `node:test` suite in an isolated test
process, and offline integration checks covering services, mechanics, dice, help,
registry behavior, architectural boundaries, slash-command schemas, autocomplete,
permissions, localization, character and creature save/generation invariants,
required media, and voice dependencies.

Every generator v2 entry is an object with a stable technical ID, an optional
positive weight, and localized text, one atomic structured field group, or a
localized template with validated references. The resolver supports weighted
sources, deterministic provenance, and strictly descriptive modifiers. Shared
non-localized statistical profiles drive character and creature stat allocation. See
[`data/generators/README.md`](data/generators/README.md) for the complete format.
