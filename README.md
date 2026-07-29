# Incredible Discord Bot

A Discord bot with moderation, utility, local audio, and RPG character-management commands.

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
Character field identities, aliases, storage paths, and editing/viewing capabilities
are defined once in `services/characterFieldCatalog.js`. Localized labels and
resource abbreviations are resolved through `util/characterDisplay.js`. Resource
abbreviations are unique within each language:
HP/AR/AP/MD in English and PV/PR/PA/DD in French.

Generator catalogs follow the same server locale. English reference files live in
`data/generators/en/` and French display content in `data/generators/fr/`.
Autocomplete labels and generated text are localized, while generator IDs,
structured field keys, enum values, and routing values remain English. Content
already saved in a character sheet is never translated retroactively.

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

`locale`, `botUserId`, `roles.dm`, and `roles.moderator` are required. The only
supported locale values are `en` and `fr`; invalid or missing values stop startup
with a clear error. `channels.teamVoice` and the `channels` object are optional.
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
- `/gen category:<category>` — generate a random prompt (DM only)
- `/gen-char character-key:<new key> [level] [background]` — generate and save a complete character (DM only)
- `/roll expression:<dice expression>` — roll expressions such as `2d6+3`
- `/add character-key:<new key>` — create a blank character sheet with a stable key
- `/get character-key:<key> [field]` — display the summary or one complete field
- `/set character-key:<key> field:<field>` — set one field or grouped section in a prefilled form
- `/heal character-key:<key> resource:<hp|armor|both> percentage:<0-100>` — restore one or both resources
- `/damage character-key:<key> damage-amount:<number> [piercing]` — apply damage to AR, then HP
- `/end-turn character-key:<key>` — restore AP and MD to their maximum values
- `/delete character-key:<key>` — permanently delete a character and all backups after exact-key confirmation
- `/undo character-key:<key>` — consume and restore the newest retained pre-change state

Discord provides native validation and choices for constrained options.
Autocomplete suggests commands the current user may access, existing CharacterKeys,
settable fields, retrievable fields, generator categories, common dice expressions,
levels, and common purge amounts. `/undo` autocomplete includes authorized active
characters with usable history. The private form opens immediately after
`/set` is submitted. Its editable choices are `name`, `level`, `race`,
`background`, `personality`, `statistics`, `rules`, `talents`, `status-effects`,
`equipment`, `inventory`, `encumbrance`, `hp`, `ar`, `ap`, and `md`.

Race uses separate inputs for its name, physical description, lore, skill bonus,
and physical ability. Background uses separate appearance, backstory, and goals
inputs. Personality uses separate description and traits inputs. These groups are
validated and saved together.

Compact groups use one colon-separated input. Name uses
`firstName:lastName`; HP, AR, AP, MD, and encumbrance use `current:max`. Values
are prefilled in the same format, surrounding whitespace is trimmed, and the exact
number of values is required. Either name component may be empty to clear it.

Statistics use one prefilled `statName: statValue` line for each of
`constitution`, `strength`, `dexterity`, `intelligence`, `speed`, `perception`,
`charisma`, `initiative`, and `reflexes`. These English names may appear in any
order but must each appear exactly once; the complete group is validated before
any statistic changes.

Personality traits, status effects, equipment, and inventory use one entry per
line. Optional leading dashes are normalized away. RULEs use
`Name: Level: Description`, one per line; only the first two colons are separators,
so descriptions may contain additional colons.

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

Character creators can edit, delete, heal, damage, end turns, and undo retained
changes for their own sheets. Users with the configured DM role can perform those
actions on every
character and may use `/gen` and `/gen-char`. Users with the configured
moderator role may use `/say`, `/purge`, and `/reload`. The actual Discord server
owner, identified by Discord rather than configuration, may use every command and
manage every character.

`/reload` acknowledges privately before disconnecting, then reloads and validates
`config.json` and both localization catalogs, clears localized generator caches,
rebuilds and replaces the runtime command registry, refreshes slash commands in
every connected guild, cleans up active voice/audio resources, and reconnects the
same Discord client without terminating Node.js. Its final private response lists
every successful and failed stage. Invalid configuration or localization
replacements do not replace the previous valid state. Source-code changes—including startup,
event-routing, mechanics, model, metadata, and handler changes—still require
manually restarting `node index.js`.
The identifier supplied to `/add` remains the stable command/save key and cannot
be edited. The sheet stores `firstName` and `lastName` separately for display.
Keys may contain internal periods, hyphens, and underscores, such as `D.Robert`.

## Character history and undo

Successful `/set`, `/damage`, `/heal`, and `/end-turn` operations push
the character’s complete pre-change save into
`save/.history/<CharacterKey>.json`. When
`INCREDIBLE_BOT_SAVE_DIRECTORY` is set, the `.history` directory is created under
that test save directory instead. History documents contain an oldest-to-newest
`entries` stack; each entry records its ISO timestamp, actor Discord ID, action,
and complete schema-versioned character snapshot. Because history is stored in a
subdirectory, it never appears in normal character listings or autocomplete.

Each push keeps the newest configured number of entries and discards older excess
entries. A lower limit is applied the next time that character’s history changes.
`/undo` validates and consumes the newest entry, then restores it atomically as the
active character. Repeated calls continue backward until the bounded stack is
empty. Undo does not push the displaced state, so it cannot toggle between two
states, and redo is not supported.

Character and history writes share the existing per-CharacterKey queue. Both
resulting JSON states are serialized before the first file operation. If the second
file operation fails, the first is rolled back; an unrecoverable rollback failure
is logged server-side while Discord receives only a localized, filesystem-neutral
error. Rejected, unauthorized, invalid, and failed mutations do not intentionally
create backups.

`/delete` opens a private confirmation form and requires the exact, case-sensitive
CharacterKey. A successful confirmation permanently removes both the active save
and the entire retained history document in the same per-key critical section.
Deletion creates no backup, cannot be reversed with `/undo`, and has no trash or
recovery location. If the two-file deletion cannot complete, the first file
operation is rolled back before an error is returned.

Example workflows:

```text
/gen-char character-key:D.Robert level:5 background:adventurer
/set character-key:D.Robert field:statistics
/set character-key:D.Robert field:rules
/get character-key:D.Robert
/get character-key:D.Robert field:personality
/damage character-key:D.Robert damage-amount:25 piercing:false
/heal character-key:D.Robert resource:both percentage:50
/end-turn character-key:D.Robert
/undo character-key:D.Robert
```

Random characters use the rulebook's stat budget and nonlinear stat costs. Their
RULE Points come from Intelligence thresholds and are spent on at most two RULEs,
prioritizing the first RULE's level; HP, AP, MD, armor eligibility, AR,
talent count, equipment, inventory, gold, and encumbrance are derived automatically.
If the optional level is omitted, a level from 1 to 10 is rolled. The optional
background selects one of the configured NPC categories and is also chosen randomly
when omitted. It generates the character's appearance, backstory, and goals.

AP follows `0 ≤ current ≤ max ≤ 10` and uses 🌟 for available points and ⭐ for
spent points. HP, AR, and MD use ten-icon percentage bars.

The full TTRPG rules are available in
[`documentation/TTRPG_RANDOM_RULES_EN.md`](documentation/TTRPG_RANDOM_RULES_EN.md).

## Project structure

- `commands/`: thin Discord slash-command adapters
- `commands/metadata.js`: centralized command schema, permissions,
  localization keys, options, accepted-value documentation, autocomplete
  descriptors, examples, and detailed behavior keys
- `commands/registry.js`: command lookup, category grouping, permission filtering,
  Discord registration data, and runtime routing
- `commands/autocompleteProviders.js`: shared metadata-selected autocomplete logic
- `commands/rpg/subcommands/`: one behavior adapter per top-level RPG command
- `services/`: Discord-independent application workflows, persistence, parsing,
  validation, mechanics, generation, and bounded character-history transactions
- `models/`: Discord-independent domain models
- `util/`: Discord response/rendering adapters plus shared localization,
  authorization, autocomplete, and command-loading helpers
- `adapters/`: external Discord integrations such as local voice playback
- `runtime/`: active runtime state and explicit reload-stage orchestration
- `data/generators/en/` and `data/generators/fr/`: localized JSON prompt catalogs
- `locales/`: English and French user-interface catalogs
- `scripts/`: focused `node:test` suites and offline integration checks

Run `npm test` to run ESLint, focused service/mechanics/dice/help/registry tests,
architectural boundary checks, slash-command schema and autocomplete checks,
permissions, localization, the current character-save schema, required media, and
voice dependencies.

Generator entries may be plain strings, weighted strings, or objects with
multiple display fields. See
[`data/generators/README.md`](data/generators/README.md) for the complete format.
