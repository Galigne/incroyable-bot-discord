# Incredible Discord Bot

A Discord bot with moderation, utility, local audio, and RPG entity-management commands.

## Requirements

- Node.js 22.12 or newer
- The bot installed with the `bot` and `applications.commands` scopes

## Installation

1. Install dependencies with `npm install`.
2. Generate a bot token in the Discord Developer Portal.
3. Copy [`config.json.example`](config.json.example) to `config.json` and replace
   each explanation with the corresponding Discord value.
4. Set the required `discordToken` field to the generated bot token.
5. Start the bot with `node index.js`.

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

Generator schema v4 catalogs use matching English and French files. Public
generators appear in `/gen`, autocomplete, and help; internal generators support
structural traversal, application workflows, and composed results. Generated
display text follows the configured locale. `/gen` derives localized path aliases
from generator and entry names, while stable IDs, field keys, routing values, and
provenance remain stable English values. Content already saved in an entity is never translated
retroactively. See the [generator authoring guide](data/generators/README.md) and
[generator architecture](data/generators/GENERATOR_ARCHITECTURE.md) for the JSON
contract and runtime design.

The public `loot`, `site`, `group`, `background`, `creature`, and `modifier`
generators are structurally detected routers: every minimal entry has a localized
name and a direct route to an internal child. Bare router generation displays the
selected category only; fixing a category automatically generates from its child.
Loot includes weapons, shields, armor, supplies, consumables, food
and drink, valuables, materials, and curios. Afflictions, rumors, and secrets are
also available as direct public generators. The public name-only `ability`
generator supplies an open-ended vocabulary of RANDOM statistics, familiar skills,
and other areas of expertise; it supports reusable results such as ability potions
without defining a closed skill system. Item identity is independent from its rarity,
material, and special loot property. Direct `/gen` output displays applied modifiers
separately from the base item.

Set the required runtime language in `config.json`. The complete configuration is:

```json
{
  "discordToken": "YOUR_DISCORD_BOT_TOKEN",
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

`discordToken`, `locale`, and `botUserId` are required non-empty values. The only
supported locale values are `en` and `fr`; invalid or missing values stop startup
with a clear error. The `roles`
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

`config.json` is the bot's only local configuration source and remains ignored by
Git. `/reload` validates and applies its reloadable settings, but `discordToken` is
restart-only: changing it requires restarting the bot, and reconnects during
`/reload` continue using the token captured at process startup. Never commit
`config.json` or a Discord token. Reset any token that has previously been committed.

## Commands

- `/help` — list commands available to you, grouped by category
- `/help command:<command>` — show permissions, parameters, accepted values, examples, and behavior
- `/say message:<text>`
- `/purge amount:<2-100>`
- `/reload` — reload supported runtime state and reconnect the existing Discord client
- `/rules`
- `/gen category:<traversal-path> [count]` — generate from a public root, optionally selecting entries, routes, or fields (configured DM role or server owner)
- `/gen-char character-key:<new key> [level] [background]` — generate and save a complete character with no explicit user access (configured DM role or server owner)
- `/gen-creature creature-key:<new key> [level] [type]` — generate and atomically save a complete creature with no explicit user access; type is optional and comes from the public `creature` router (configured DM role or server owner)
- `/roll expression:<dice expression>` — roll expressions such as `2d6+3`
- `/add entity-key:<new key> [type:<character|creature>]` — create a blank entity and grant yourself explicit `owner` access; character is the default
- `/get entity-key:<key> [field]` — display the summary or one type-compatible field
- `/access entity-key:<key>` — display every explicit `owner` and `partial` user entry
- `/access entity-key:<key> user:<Discord user> level:<owner|partial|none>` — grant, change, or remove explicit access (full authority required)
- `/access entity-key:<key> user-id:<Discord user ID> level:<owner|partial|none>` — modify a stale entry that cannot be selected through Discord (full authority required)
- `/set entity-key:<key> field:<field>` — set one grouped field in a prefilled form
- `/heal entity-key:<key> resource:<hp|armor|both> percentage:<0-100>` — restore one or both resources
- `/damage entity-key:<key> damage-amount:<number> [piercing]` — apply damage to AR, then HP
- `/end-turn entity-key:<key>` — restore AP and MD to their maximum values
- `/delete entity-key:<key>` — permanently delete an entity and all backups after exact-key confirmation
- `/undo entity-key:<key>` — consume and restore the newest retained pre-change state

Discord provides native validation and choices for constrained options.
Autocomplete suggests commands the current user may access, existing EntityKeys,
controllable entities for management commands, type-compatible fields, contextual
generator traversal paths, localized creature types, common dice expressions,
levels, and common purge amounts. `/delete` suggestions require full authority,
while `/undo` autocomplete includes explicitly authorized active entities with usable
history. The private form opens immediately after `/set` is submitted; a
successful submission then posts the confirmation and the updated selected field
detail publicly. Invalid, expired, and unauthorized submissions remain private.
In `/gen` results, direct inline generator references are shown in inline code;
references resolved inside them use square brackets at every recursive level.
The traversal syntax uses localized generator and entry aliases. Aliases are
lowercase, replace spaces and separating punctuation with underscores, and retain
localized accents. A bare router selects and displays one category. `.generator`
selects a random category and follows its route, while `:category` fixes a router
category and follows that route automatically. Another `:entry` fixes an entry in
the routed child, and `.field` reads a field from the effective generated content.
`.generator`, `.name`, and all other field keys remain stable English syntax. For
example:

```text
/gen category:loot
/gen category:loot.generator
/gen category:loot:weapons
/gen category:loot:weapons:long_sword
/gen category:loot:weapons.description
/gen category:site:dungeon
/gen category:site:dungeon:buried_temple.name
```

With the French catalog, corresponding paths include
`butin`, `butin.generator`, `butin:armes`,
`butin:armes:épée_longue.description`, and
`lieu:donjons:temple_enseveli.name`. Stable generator and entry IDs remain
accepted for manual input and are resolved to the same internal identities.

`.generator` remains necessary for unresolved random routing and may repeat across
unresolved router boundaries. The redundant `.name` form for a bare name-only
router remains valid manual input but is not suggested.

Omitting an entry performs the normal weighted selection. Paths ending on a
generator apply that final generator's normal automatic modifiers; paths ending on
a field return only that field and do not apply the final generator's modifiers.
If an unfixed entry's `.generator` route is followed by another entry, route, or
field, that continuation must be valid for every possible routed child. Invalid
paths are rejected before weighted selection, while a path ending at the unresolved
`.generator` continues with normal weighted route and child generation.
Internal children such as `dungeon` are invalid as direct roots.
Character fields are `name`, `level`, `resources`, `status`, `statistics`, `rules`,
`talents`, `gear`, `race`, `background`, `personality`. Creature fields independently
use `identity`, `level`, `resources`, `status`, `statistics`, `rules`, `traits`, and
`gear`. The `resources` section contains HP, AR, AP, and MD. The `status` section
contains independent Status Effects and Modifiers lists.

Name uses separate optional first-name and last-name inputs; emptying either input
clears that component. Race uses separate inputs for its name, physical description,
lore, skill bonus, and physical ability. Background displays the generated
archetype and physical description, while its editable form contains separate
backstory and goals inputs. Personality uses separate description and traits
inputs.

The resources form uses one required `current:max` pair for each of HP, AR, AP,
and MD, such as `50:100`; encumbrance uses the same format. Every grouped form is
prefilled, validated completely, and saved as one atomic update. AP values are
whole numbers from 0 to 10, and current AP cannot exceed maximum AP. Creature
edits also require level 1–10, statistics 0–100, and current resources no greater
than their maximum. Encumbrance is a manually managed resource that defaults to
`0 / 0`; it is not derived from Constitution, equipment, inventory, or any other
character property.

Statistics use one prefilled `statName: statValue` line for each of
`constitution`, `strength`, `dexterity`, `intelligence`, `speed`, `perception`,
`charisma`, `initiative`, and `reflexes`. These English names may appear in any
order but must each appear exactly once; the complete group is validated before
any statistic changes.

Personality traits, talents, creature intrinsic traits, equipment, and inventory
use one entry per line. Surrounding whitespace is trimmed, empty lines are
ignored, and an empty submission clears the complete collection.
Character talent names and descriptions remain combined in each talent entry.
Creature intrinsic traits may contain any non-empty text and do not require a name,
description, or separator structure. RULEs use `Name:Level:Description`, one per
line. Each value is required, the level must be a positive whole number, and only
the first two colons are separators, so descriptions may contain additional colons.

Status Effects and Modifiers each use one `Name:Description` record per line and
can be cleared independently. Status Effects describe temporary conditions;
Modifiers describe persistent distinguishing alterations.

Discord displays at most 25 autocomplete suggestions at once, so type part of the
current segment to filter longer lists. `/gen category:` autocomplete searches all
valid candidates before applying that limit, matches without regard to case or
accents, and returns localized paths that can immediately be extended with `:` or
`.`. Exact matches rank before prefixes and other substring matches. Manually
entered valid localized aliases and stable-ID paths remain accepted even when they
are absent from the current suggestions. `/help command:gen` lists every localized public root, and
`/help command:set` lists every editable field grouped by
section. Both lists are generated from the same catalogs used by autocomplete.

Dice expressions use one `COUNTdSIDES` group with an optional `+MODIFIER` or
`-MODIFIER`, such as `1d20`, `2d6+3`, or `4d8-2`. A roll is limited to 100 dice,
1,000 sides per die, and an absolute modifier of 10,000. Advanced dice operators,
multiple groups, parentheses, and other arithmetic are not supported. Exact
`1d2` and `1d20` rolls return their corresponding GIF only; all other expressions
return the textual roll breakdown.

Each persisted character and creature contains an explicit user-access list. An
`owner` entry grants full authority; multiple owners are allowed, and the list may
also contain no owners. A `partial` entry grants normal `/set`, `/damage`, `/heal`,
`/end-turn`, and `/undo` control, but cannot delete the entity or change access.
`none` is never persisted: it removes the selected user's explicit entry. Anyone
may use `/get` or view `/access`, including entries for users who have left the
server. Each access-list row always includes the persisted Discord user ID and uses
cached display information when available without requiring a Discord fetch. A
full-authority user can copy a stale ID into `user-id`; access changes require
`level` and exactly one of `user` or `user-id`. Explicit owners may grant, change,
or remove any user's access, including their own, without transferring or removing
other owners.

When configured, the DM role has implicit full authority over every entity and may
use `/gen`, `/gen-char`, and `/gen-creature`; without that role, those additional DM
permissions are server-owner-only. DM and server-owner authority is not persisted in
entity access lists. When configured, the
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
The identifier supplied to `/add`, `/gen-char`, or `/gen-creature` remains the stable
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
same concrete entity type while preserving the active entity's current access list.
Repeated calls continue backward until the bounded stack is empty. Undo does not
push the displaced state, so it cannot toggle between two states, and redo is not
supported. Access changes are atomic but do not create gameplay-history entries.

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
/gen-creature creature-key:Ash.Wolf level:5 type:monster
/set entity-key:D.Robert field:statistics
/get entity-key:Ash.Wolf field:traits
/access entity-key:Ash.Wolf user:@Player level:partial
/access entity-key:Ash.Wolf user-id:123456789012345678 level:none
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
Each character receives one Constitution-compatible armor and one or two additional
main-equipment items. Every additional slot independently selects a weapon 80% of
the time or a shield 20% of the time, so two shields are possible. Armor type and
the stable generated rarity determine armor AR; shield AR depends on that same
stable rarity identity. Equipped shield AR stacks with armor before AR is calculated
from maximum HP.

Three carried inventory items resolve through the equal-weight `loot` router and
may come from any loot category. They remain carried only: a carried weapon, armor,
or shield is not equipped and cannot change generated AR. Exact duplicate loot is
avoided through bounded retries when the random source permits it; generated gold
is appended as before. Generated entity gear remains string-based: each line keeps
the base item followed by its resolved rarity, material, and special property in
that order.
Generated talents are stored as unique localized list entries: levels 1–2 receive
one talent, levels 3–5 receive two, levels 6–8 receive three, and levels 9–10
receive four.
If the optional level is omitted, a level from 1 to 10 is rolled. The optional
background selects one of the configured broad background categories and is also
chosen randomly when omitted. The selected category independently resolves one
reusable archetype from the matching concept-only generator stored in
`background_<category>.json`, while the separate `physical_description` generator
supplies the physical description. Each selected archetype chooses its own existing
character statistical profile, defaulting to the shared `default` profile when the
archetype does not specify one. Background archetypes and creature details share an
optional generation-override model for statistical profile, natural armor, fixed
RULEs, status effects, modifiers, armor, equipment, and inventory. Characters use
template-based `talents`, while creatures use template-based `traits`. Omitted
properties keep the entity type's normal generation behavior; explicitly present
properties replace it, including empty arrays.
Backstory and goals start empty and remain editable. Persistent character
modifiers come only from the internal `modifier_character` pool.

Random creatures select a stable type route from the public `creature` catalog
(randomly when `type` is omitted), then generate from that entry’s referenced
internal detail source. The current data provides `animal`, `companion`, and
`monster`; the internal generator uses the same concept ID and a prefixed
`creature_<type>.json` filename, while the router defines the available set. They
share the character level budget, nonlinear statistic allocation,
derived statistics, and resource formulas while using creature-specific profile
distributions. Only explicit source references grant creature RULEs; Intelligence
and descriptive modifiers never do. Natural armor, a separate generated armor, and
rarity-derived AR from equipped armor or shields stack before final AR is
calculated; inventory does not
contribute AR. Natural-armor percentages remain generation metadata and are not
persisted separately. Status effects and modifiers remain descriptive, and
generated gear does not alter manual encumbrance. Persistent creature modifiers come only from the
internal `modifier_creature` pool. Creature detail sources declare intrinsic traits
as string templates: literal text is preserved, while ordinary `{{ ... }}` generator
references resolve during generation. The public `traits` generator provides shared
talent-like capabilities for both direct `/gen` use and creature templates. Only the
localized final strings are saved; trait text never changes statistics or resources.
The complete localized result and stable
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
authorization, autocomplete, command-schema utilities, and `combatantDisplay.js` helpers
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

Generator JSON authoring is documented in
[`data/generators/README.md`](data/generators/README.md). Current routing,
resolution, visibility, inline-reference provenance, modifiers, and entity
generation are documented in
[`data/generators/GENERATOR_ARCHITECTURE.md`](data/generators/GENERATOR_ARCHITECTURE.md).
