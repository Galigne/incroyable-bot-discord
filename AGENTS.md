# Incredible Discord Bot — Agent Guide

This file is the operational context for agents working in this repository. Read it
before changing commands, RPG data, character saves, or tests.

## Project purpose

This is an English-language Discord bot built with CommonJS and `discord.js` 14.
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

`scripts/check.js` validates syntax, command schemas, autocomplete, help ordering,
permissions, generator data, character mechanics, modal editing, required media,
and voice dependencies. Character-store tests use an isolated temporary directory
through `INCREDIBLE_BOT_SAVE_DIRECTORY`; tests must never write to real saves.

## Important repository structure

- `index.js`: environment loading, client startup, global command registration, and
  interaction/event routing.
- `client/Client.js`: Discord client and gateway intents.
- `commands/`: one module per top-level slash command.
- `commands/rpg/index.js`: `/rpg` command builder, subcommand routing, and RPG-level
  authorization.
- `commands/rpg/subcommands/`: one module per `/rpg` subcommand.
- `commands/rpg/editorFields.js`: canonical editable fields and modal presentation.
- `commands/rpg/interactions.js`: direct prefilled edit modal and modal submission.
- `models/Character.js`: character schema and Discord embed rendering.
- `services/characterStore.js`: JSON character persistence.
- `services/characterEditor.js`: field parsing, validation, damage, resource
  restoration, and end-turn behavior.
- `services/generatorCatalog.js`: loads and validates generator JSON and performs
  weighted selection.
- `services/randomCharacterGenerator.js`: builds complete random characters.
- `data/generators/`: generator catalogs. See its `README.md` before editing formats.
- `save/`: real character data. Preserve these files unless the user explicitly
  requests a character change or deletion.
- `util/authorization.js`: role/channel authorization.
- `util/autocomplete.js`: shared Discord autocomplete filtering.

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
- Only the character creator, a DM, or an owner can edit a character.
- Character deletion is restricted to the creator by the current store API.
- `/rpg gen`, `/rpg gen-char`, and `/rpg gen-help` are DM/owner
  commands.
- `/restart` is moderator/owner only.
- `/say` is moderator/owner only.
- `/purge` is owner only.

Role IDs and the team voice channel ID live in `config.json`. The DM role is already
configured there. Do not hard-code those IDs elsewhere.

Resources and display:

- AP satisfies `0 <= current <= max <= 10`.
- AP uses filled/spent star icons for the raw current/max values.
- HP, AR, and MD use ten-icon percentage bars. Preserve the current colors:
  HP uses red/black hearts, AR uses blue/black squares, and MD uses orange/black
  squares.
- `/rpg heal` supports only HP or AR and sets current to a percentage of maximum.
- `/rpg damage` applies positive whole-number damage to current AR first, then current
  HP. With `piercing:true`, it bypasses AR. Piercing defaults to false.
- `/rpg end-turn` restores current AP and MD to maximum.

## Random generators

Every `.json` file in `data/generators/` automatically becomes a category after the
bot restarts. `/rpg gen-help` reads the live catalog, explains both generation
commands, and lists every category.

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

- `/rpg roll sides:2` sends `HEADS.gif` or `TAILS.gif`.
- `/rpg roll sides:20` sends the matching `D20-<result>.gif`.
- Other dice sizes return a text result.
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
   persistence, editing, rendering, generator data, and error handling.
3. Add or update focused regression coverage whenever behavior changes and testing
   is practical. New commands should have schema, routing, autocomplete, permission,
   and behavior checks as applicable. Character or generator changes should test
   their invariants and persistence. Data-driven tests should derive expectations
   from the canonical data when exact values are intentionally configurable. Never
   weaken or remove a valid test merely to make a change pass.
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
6. Run `npm test`.
7. Run `git diff --check`.
8. Confirm tests did not add, modify, or remove real character saves.
