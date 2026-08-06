# Generator and Creature Architecture

## Status and authority

This document describes the production generator and creature architecture. The
historical source remains unchanged in `documentation/JDR_RANDOM_OLD.md`; its
one-time migration audit is retained in Git history.

The English and French rulebooks remain the authority for game rules and
terminology. They are not implementation synchronization files.

## Final decisions

- Generator schema v2 is the only supported generator format.
- English and French catalogs have strict structural parity and no locale
  fallback.
- Stable IDs, not display text, own technical identity and provenance.
- Complete humanoids are created only by `/gen-char`.
- There is no NPC model, NPC persistence, NPC command, complete `npc` generator,
  or separate `criminal` generator.
- Humanoid roles and authored-person concepts are routed through character
  background components.
- The single saved entity type for animals, companions, and monsters is
  `creature`.
- Descriptive modifiers and status effects are shared by characters and
  creatures and never execute mechanics.
- Creature RULEs come only from explicit entry metadata. Intelligence and
  modifiers never grant them.
- Encumbrance is always a manually edited saved resource. Generation never
  derives it from statistics or gear.
- Historical content wins conceptual conflicts with newer catalog content.

## Generator schema v2

Production catalogs are discovered recursively under matching
`data/generators/en/` and `data/generators/fr/` paths. Every file declares:

- `schemaVersion: 2`;
- a stable generator `id`;
- `kind` as `category`, `component`, `template`, or `modifier`;
- `visibility` as `public` or `internal`;
- localized `name` and `description`;
- an `entrySchema`;
- stable entries with optional positive weights.

Text, structured-field, and template entries are distinct schema forms. Technical
fields, weights, entry order, references, selectors, modifier configuration, and
creature generation metadata are identical across locales. Player-facing values
are written naturally in each language.

Only public non-modifier roots appear in `/gen`, autocomplete, and help. Internal
components remain available to application workflows and references.

## Resolution and provenance

The resolver supports:

- weighted random entries;
- fixed stable entries that do not consume entry-selection randomness;
- `value`, `fields`, `fields.<declared name>`, and `display` selectors;
- nested templates;
- weighted `generator.oneOf` sources;
- cycle detection and bounded nesting;
- injected randomness for deterministic tests.

Resolved output includes localized content, stable root and entry IDs, base and
reference provenance, and separate modifier records. Provenance contains only
technical IDs and selection paths. Resolution alone never creates or saves an
entity.

## Descriptive modifiers and status effects

Modifier catalogs are internal, structured, and declare compatible generator IDs.
A modifier request contains only chance and an inclusive count. Weighted
selection is unique within one request.

Modifier records contain localized names, descriptions, and technical provenance.
They cannot define or change statistics, resources, armor, RULEs, traits, status
effects, equipment, inventory, entity types, persistence, group size, or behavior.
Names such as `Gigantic`, `RULE Bearer`, and `Equipped` remain narrative guidance
only.

The shared `modifier` catalog serves background-based character generation and the
three creature detail catalogs. Exact historical site compatibility is preserved
without conceptual duplication through:

- `site-modifier-all` for regions, settlements, dungeons, and buildings;
- `site-modifier-structures` for settlements, dungeons, and buildings;
- `site-modifier-interiors` for dungeons and buildings;
- `site-modifier-building` for buildings only.

The public `status-effect` catalog contains structured localized `Name` and
`Description` fields shared by both persistent entity types. Status effects are
GM-interpreted descriptions, not executable penalties, durations, or triggers.

## Shared statistical profiles

`data/generators/stat-profile.json` contains non-localized reusable statistical
profiles. A profile declares minimums, maximums, and allocation weights for the
seven base statistics. It contains no localized prose, resource formulas, entity
type, RULE allocation, traits, gear, or encumbrance behavior.

Character and creature generation use the same level 1–10 budget, nonlinear
statistic costs, derived statistics, and resource formulas. Profiles alter only
allocation constraints and weighting.

## Character generation

The public `background` catalog routes its 17 stable role entries to internal
`background-*` detail catalogs. Each detail atomically supplies `Appearance`,
`Backstory`, and `Goals`. Historical ages, professions, criminal concepts, and
decomposed authored people are reachable through this normal route.

`/gen-char` creates a complete schema-v2 character, including name, race,
background, personality, statistics, derived resources, explicit character RULE
allocation, talents, descriptive statuses and modifiers, gear, and manual
encumbrance. Character Intelligence continues to use the character rules; this
does not apply to creatures.

Generated armor, weapons, inventory, and gold never alter encumbrance. A new
character retains the model default of `0 / 0`.

## Creature generation and persistence

The public `creature` catalog routes stable entries as follows:

- `animal` to internal `creature-animal`;
- `companion` to internal `creature-companion`;
- `monster` to internal `creature-monster`.

These are source classifications, not saved entity types. `/gen-monster` accepts a
creature type, level, and new CreatureKey, generates the complete entity, and saves
it atomically as type `creature`.

Every detail entry supplies localized identity and explicit generation metadata:

- one shared statistical profile;
- one or more intrinsic localized traits;
- optional explicit natural armor or armor reference;
- explicit fixed RULE IDs and levels when intrinsic;
- optional descriptive status references;
- optional default equipment and inventory references.

Entries cannot define fixed statistics, per-entry profile overrides, alternate
budgets, challenge ratings, resource formulas, or automatic encumbrance. Generic
category names do not imply RULEs. Loading and displaying a saved creature never
reruns generation.

Creature saves, history, undo, deletion, authorization, and atomic transactions
use the same shared entity workflow as characters while retaining type-specific
schemas and fields. Creature encumbrance defaults to `0 / 0` and changes only
through explicit editing.

## Humanoid and quest routing

Complete-person `npc` and `criminal` roots are retired. Current and historical
person concepts were decomposed into reusable background details, with reusable
name material retained where appropriate. Criminal occupations and groups are
individual-character concepts inside the most appropriate background detail
catalogs.

The public `quest` generator is a v2 template catalog. Generic people references
select a broad `background` entry. Specific roles select a fixed background ID,
including `criminal`, `merchant`, `noble`, `official`, `scholar`, `military`,
`religious`, or `mage`. Other markers reference stable item, material, faction,
race, location, or internal creature entries with appropriate selectors.

Quest resolution records provenance but never creates or saves referenced people
or creatures.

## Historical migration

The completed migration applied 453 historical dispositions and 54 dispositions
for the retired current complete-person catalogs. The one-time audit record is
retained in Git history.

The migration includes regions, settlements, adventure sites, buildings, weapons,
inventory, races, personalities, status effects, events, humanoid components,
animals, companions, monsters, RULEs, site and creature modifiers, and quest
templates. Seven historical statistic rows are explicitly rejected because the
shared-profile system owns executable statistical generation.

Historical race fields remain atomic. Historical personalities retain their
deliberate weights and concepts. Historical RULE limitations win conflicts while
accurate referenced stable IDs are retained. Creature classifications, profiles,
natural armor, and fixed RULEs are individually recorded. No historical numeric
encumbrance, fixed creature statistic block, mechanical modifier effect, or
Intelligence-derived creature RULE was imported.

## Reload and cache replacement

Startup and `/reload` validate complete English/French generator candidates and
the statistical-profile candidate before replacing active caches. A failure leaves
the previous validated caches active. Runtime reload does not introduce a second
client, duplicate listeners, or broad module-cache clearing.

## Validation contract

Offline validation covers:

- schema-v2 envelopes, IDs, weights, and strict locale parity;
- random, fixed, nested, and weighted references;
- selectors, cycles, depth bounds, provenance, and cross-locale determinism;
- modifier compatibility, unique selection, and proof of non-effects;
- profile validation and shared mechanics;
- character and creature generation, persistence, history, undo, deletion,
  authorization, and loading without regeneration;
- `/gen`, `/gen-char`, `/gen-monster`, autocomplete, help, and shared entity
  commands;
- exact historical-source-to-manifest coverage;
- every applied or rejected manifest disposition;
- absence of complete `npc` and `criminal` roots and references;
- absence of automatic encumbrance, mechanical modifiers, fixed per-creature
  statistics, and Intelligence-derived creature RULEs.

The repository is complete only while all of these checks pass with no dangling
references, duplicate IDs in their owning scope, unresolved manifest decisions,
or incompatible shared command fields.
