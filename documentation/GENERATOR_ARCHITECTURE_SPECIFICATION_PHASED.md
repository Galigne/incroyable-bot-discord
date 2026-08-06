# Generator and Creature Architecture Specification

## Status

This document defines the target architecture and ordered implementation sequence for:

- the version 2 random generator system;
- shared statistical generation profiles;
- complete character and creature models;
- creature persistence, history, undo, and management;
- complete creature generation through `/gen-monster`;
- descriptive generator modifiers;
- migration of reusable content from `documentation/JDR_RANDOM_OLD.md`.

It is a design and implementation specification. It does not itself modify the
bot.

`documentation/NEW_GENERATOR_ARCHITECTURE_SPECIFICATION_PARTS.md` consolidates
this roadmap into five approval-gated parts and is authoritative wherever the
documents conflict. Revised Parts 1 through 4 are complete: generator schema v2,
the current-data cutover, shared statistical profiles, structured resolution,
descriptive modifiers, persistent creatures, and shared entity management now ship
together with complete creature generation and `/gen-monster`.

---

# Implementation Protocol

This feature must be implemented **one part at a time**, in the order defined by
this document unless an implementation dependency requires an explicit
specification revision.

For every part:

1. implement only the scope of the current part;
2. add or update the tests required by that part;
3. run `npm run format`;
4. run `npm test`;
5. stop and obtain explicit approval before continuing to the next part.

Later-part functionality must not be implemented early unless it is strictly
required for correctness of the current part. Do not prepare broad unused
abstractions merely because they may be useful later.

Every completed part must leave the repository coherent, formatted, and
testable.

---

# Decision Precedence

This document replaces older generator and creature architecture assumptions.

The following decisions are authoritative:

1. generator schema v1 does not require backward compatibility;
2. existing character saves and history remain compatible;
3. complete humanoids are generated only through `/gen-char`;
4. there is no complete `npc` generator, `criminal` generator, or separate NPC
   model;
5. quest references to people resolve background categories, not complete
   characters;
6. modifiers are strictly descriptive;
7. modifiers never change generated statistics, resources, armor, traits,
   equipment, status effects, RULEs, or behavior;
8. RULE Bearer is descriptive and does not grant a RULE;
9. creature RULE assignment is explicit through the base creature archetype,
   never through Intelligence or modifiers;
10. generated status effects are descriptive and interpreted by the GM;
11. animals and companions use separate catalogs;
12. historical personality entries are preserved;
13. when current generator content conflicts with content from
    `JDR_RANDOM_OLD.md`, the historical content wins;
14. content unique to the current catalogs may remain when it does not conflict
    with historical content.

Any future mechanical modifier system is a separate feature requiring a new
specification and explicit approval. It must not be anticipated through unused
mechanical fields in the current modifier schema.

---

# Compatibility Policy

## Generator data

The old generator JSON format does **not** require backward compatibility.

The repository owns all generator files and all internal callers. The completed
version 2 system has:

- one generator file format;
- one validation path;
- one resolver API;
- no runtime format detection;
- no compatibility overload for the previous generator service API;
- no v1 generator parser after cutover.

The revised Part 1 converted all production data, switched all callers, and
removed the old implementation in one cutover. There was no production period
with both formats.

## Persistent character data

Preserve:

- existing character save files;
- existing character history;
- existing character keys;
- existing character mutation and undo behavior;
- existing authorization;
- existing `/gen-char` behavior except for explicitly approved generator changes.

Generator JSON is repository-owned implementation data. Character saves are
persistent user data and must not be treated the same way.

## Public generator behavior

Preserve existing public generator concepts and localized output unless a later
migration part explicitly merges, renames, internalizes, or removes them.

Stable technical IDs replace identifiers derived from display names.

---

# Global Architecture Requirements

The completed architecture must support:

- weighted random selection through `weight`;
- text entries and structured entries;
- stable generator and entry IDs;
- English and French content with strict structural parity;
- public categories and internal components;
- templates that reference other generators;
- references to a randomly selected entry;
- references to a fixed entry ID;
- weighted selection between several source generators;
- descriptive modifiers selected independently from a base result;
- atomic selection of all fields belonging to one entry;
- complete character generation through `/gen-char`;
- complete creature generation through `/gen-monster`;
- one statistical profile system shared by characters and creatures;
- one statistic-allocation algorithm;
- shared level, statistic, resource, and combat calculations;
- separate `Character` and `Creature` models based on shared combat state;
- complete creature save, history, undo, mutation, and deletion;
- deterministic tests through injected random functions;
- strict validation before generator data becomes active;
- eventual migration of all accepted historical list entries.

The completed architecture must not:

- derive technical IDs from localized display names;
- store executable formulas in JSON;
- maintain two generator formats;
- create a complete humanoid outside `/gen-char`;
- create an `npc` model or persistent `npc` entity type;
- create public `npc` or `criminal` generators for complete people;
- grant creature RULEs because of Intelligence;
- grant RULEs through modifiers;
- apply any mechanical modifier effect;
- automatically enforce status-effect mechanics;
- introduce encounter power or challenge rating;
- define fixed statistic blocks for individual creature entries;
- permit per-creature profile overrides;
- create separate statistic-allocation algorithms for characters and creatures;
- rerun generation when loading a saved creature.

---

# Target Directory Structure

```text
data/generators/
├── stat-profile.json
├── en/
│   └── *.json
└── fr/
    └── *.json
```

Roles:

- each localized generator declares its role through `kind` and `visibility`;
- the current flat locale layout is recursively discovered and may be grouped
  later without changing the catalog API;
- public categories are visible through `/gen`;
- internal components are available only to application workflows;
- `stat-profile.json`: non-localized statistical distributions.

---

# Implementation Overview

| Revised part | Legacy detail sections | Primary result |
| ---: | --- | --- |
| 1 | Legacy Parts 1–3 | Generator v2, production cutover, and shared statistical profiles |
| 2 | Legacy Parts 4–5 | Structured references, templates, provenance, and descriptive modifiers |
| 3 | Legacy Parts 6–9 | Creature persistence and shared entity management |
| 4 | Legacy Parts 10–12 | Creature generation and `/gen-monster` |
| 5 | Legacy Parts 13–20 | Historical migration and final verification |

The legacy detail headers below remain as historical design references until their
revised part is implemented. Revised Parts 1 through 4 are complete. Legacy Parts 6
through 9 are superseded by Revised Part 3, and Legacy Parts 10 through 12 are
superseded by Revised Part 4. Their proposed inheritance hierarchy, intermediate
states, and older creature metadata do not override the completed implementation.
The consolidated five-part specification controls scope and precedence. Every
revised part requires explicit approval before the next begins.

---

# Revised Part 1A — Shared Statistical Profiles (Complete)

## 1.1 Objective

Introduce one non-localized statistical profile system and make existing random
character generation use it before creatures are introduced.

## 1.2 Data File

Add:

```text
data/generators/stat-profile.json
```

Example:

```json
{
  "schemaVersion": 1,
  "profiles": [
    {
      "id": "character-balanced",
      "minimums": {
        "constitution": 4,
        "strength": 4,
        "dexterity": 4,
        "intelligence": 4,
        "speed": 4,
        "perception": 4,
        "charisma": 4
      },
      "maximums": {
        "constitution": 20,
        "strength": 20,
        "dexterity": 20,
        "intelligence": 20,
        "speed": 20,
        "perception": 20,
        "charisma": 20
      },
      "weights": {
        "constitution": 1,
        "strength": 1,
        "dexterity": 1,
        "intelligence": 1,
        "speed": 1,
        "perception": 1,
        "charisma": 1
      }
    }
  ]
}
```

`character-balanced` reproduces the previous balanced allocation exactly for
equivalent deterministic random input.

## 1.3 Profile Semantics

A profile contains only:

- minimum value for each statistic;
- maximum value for each statistic;
- allocation weight for each statistic.

A profile does not contain:

- localized text;
- `appliesTo`;
- HP, AP, MD, or AR formulas;
- RULE assignment;
- traits;
- status effects;
- armor;
- entity type;
- executable expressions.

## 1.4 Required Statistics

Every profile defines exactly:

- `constitution`;
- `strength`;
- `dexterity`;
- `intelligence`;
- `speed`;
- `perception`;
- `charisma`.

For each statistic:

- minimum is an integer from `4` to `20`;
- maximum is an integer from `4` to `20`;
- minimum does not exceed maximum;
- allocation weight is finite and greater than or equal to `0`.

At least one allocation weight must be positive.

## 1.5 Shared Level Budget

```text
budget(level) =
  67
  + 2 × (level - 1)
  + 1 when level >= 2
  + 1 when level >= 5
  + 1 when level >= 8
```

Equivalent behavior:

```js
function calculateStatBudget(level) {
  return 67
    + 2 * (level - 1)
    + [2, 5, 8].filter(requiredLevel => level >= requiredLevel).length;
}
```

Statistic value cost remains:

- values `1` through `14`: `1` point;
- values `15` and `16`: `2` points;
- values `17` and `18`: `3` points;
- values `19` and `20`: `4` points.

## 1.6 Allocation API and Algorithm

```js
generateStats({ level, profile, random = Math.random })
```

Algorithm:

1. validate level and profile;
2. calculate the level budget;
3. initialize each statistic to its profile minimum;
4. calculate the cost of all minimums;
5. when minimum cost equals or exceeds the budget:
   - preserve every minimum;
   - do not lower a statistic;
   - accept a result above nominal budget;
   - stop allocation;
6. otherwise determine remaining budget;
7. build eligible statistics where:
   - current value is below maximum;
   - weight is positive;
   - next value cost fits remaining budget;
8. select an eligible statistic by weight;
9. increase it by `1`;
10. subtract the increase cost;
11. repeat until no statistic is eligible.

Unused budget is accepted when no legal increase can consume it.

## 1.7 Catalog

The Discord-independent technical catalog provides:

```js
getStatProfile(profileId)
listStatProfiles()
clearStatProfileCache()
reloadStatProfiles()
```

## 1.8 Character Integration

`/gen-char`:

1. loads `character-balanced`;
2. generates statistics through the shared allocator;
3. preserves character Intelligence-based RULE allocation;
4. preserves save shape and command behavior.

Profiles affect generation only. They do not restrict later `/set` operations.

## 1.9 Validation and Tests

Reject malformed schema versions, duplicate IDs, missing or unknown statistics,
invalid bounds, negative/non-finite weights, and profiles with no positive
weight.

Test:

- loading and caching;
- malformed profiles;
- budget values;
- minimum preservation;
- maximum enforcement;
- zero-weight behavior;
- weighted boundaries;
- nonlinear costs;
- unspendable remainder;
- injected deterministic randomness;
- unchanged character save shape;
- unchanged character RULE behavior.

## 1.10 Completed State

- `/gen-char` uses `character-balanced` through the shared weighted allocator;
- existing character saves, history, RULE behavior, and save schema v2 remain
  compatible;
- generator v2 and the production cutover were completed in the same revised
  part;
- creature, reference, template, modifier, and historical-migration work is not
  included.

---

# Revised Part 1B — Generator Schema Version 2 Core (Complete)

## 2.1 Objective

The strict v2 generator catalog is the only production catalog. It never parses
v1 data.

## 2.2 Common Envelope

```json
{
  "schemaVersion": 2,
  "id": "race",
  "kind": "category",
  "visibility": "public",
  "name": "Races",
  "description": "Ancestries with culture, appearance, and racial traits",
  "entrySchema": {
    "type": "fields",
    "required": [
      "Name",
      "Description",
      "Skill Bonus",
      "Physical Ability"
    ]
  },
  "entries": []
}
```

Technical properties:

- `schemaVersion`;
- stable English `id`;
- `kind`: `category`, `component`, `template`, or `modifier`;
- `visibility`: `public` or `internal`;
- `entrySchema`.

Localized properties:

- `name`;
- `description`;
- player-facing entry content.

## 2.3 Entry Shapes

Every entry has:

- stable `id`;
- optional positive `weight`, default `1`;
- exactly one primary payload:
  - `value`;
  - `fields`;
  - `template`.

Text:

```json
{
  "id": "forest-at-dusk",
  "weight": 3,
  "value": "A forest path disappears as night falls."
}
```

Structured:

```json
{
  "id": "human",
  "weight": 5,
  "fields": {
    "Name": "Human",
    "Description": "Adaptable communities connected by fast-changing traditions.",
    "Skill Bonus": "Choose one skill bonus during character creation.",
    "Physical Ability": "Adapt quickly to sudden changes."
  }
}
```

All fields in a structured entry are selected atomically.

## 2.4 Catalog API

```js
getGenerator(id, locale)

listGenerators(locale, {
  visibility = 'public',
} = {})

clearGeneratorCache()
reloadGeneratorCatalog()
```

Public result assembly belongs to the completed revised Part 2 resolver:

```js
generatorResolver.generate(id, locale, {
  random = Math.random,
  maxDepth = 8,
} = {})
```

Weighted selection belongs in a reusable helper:

```js
selectWeightedEntry(entries, random = Math.random)
```

## 2.5 Discovery

The v2 catalog:

- scans both locale roots recursively;
- uses English relative paths as structural references;
- requires matching French paths;
- identifies generators by stable ID;
- rejects duplicate IDs across kinds;
- exposes public generators by default;
- permits internal access explicitly through stable ID lookup;
- never exposes internal generators through `generate`.

## 2.6 Localization Parity

French must match English in:

- relative path;
- schema version;
- generator ID;
- kind;
- visibility;
- entry schema;
- entry IDs and order;
- weights;
- technical keys and values.

Only player-facing text is translated.

## 2.7 Validation and Tests

Reject invalid envelopes, kinds, visibility, IDs, payload counts, weights,
required fields, duplicate IDs, malformed values, and locale differences.

Test recursive discovery, visibility, all entry shapes, stable lookup, weighted
selection, parity, malformed fixtures, and deterministic selection.

## 2.8 Completed State

- the strict catalog validates the complete English/French production pair;
- production uses only v2;
- no v1 parsing, fallback, runtime detection, or API overload remains;
- reference, template, provenance, and modifier resolution was deferred from this
  part and is now complete in revised Part 2.

---

# Revised Part 1C — Generator Data Conversion and Cutover (Complete)

## 3.1 Objective

Every current production generator has been converted to v2 and the old format
and catalog have been removed.

This part converts current repository data only. Historical
`JDR_RANDOM_OLD.md` content is migrated in Parts 13–20.

## 3.2 Conversion

For every current English and French file:

- assign stable generator ID;
- assign stable entry IDs;
- assign kind and visibility;
- define entry schema;
- preserve current weights;
- preserve current localized content;
- preserve atomic field groups;
- align locales.

## 3.3 Classification

- every previously exposed standalone generator remains a public `category`;
- the 17 routed `background-*` detail catalogs are internal `component`
  generators;
- classification lives in the v2 envelope rather than directory placement;
- no future modifier, template, or creature-only data was added speculatively.

## 3.4 Runtime Cutover

Updated:

- `/gen`;
- autocomplete;
- `/gen-char`;
- required-file checks;
- localization checks;
- help and tests;
- direct imports;
- runtime reload behavior.

Removed:

- old catalog;
- v1 parser;
- old API overloads;
- old fixtures.

No runtime v1 support remains.

## 3.5 Compatibility

Preserve current behavior unless explicitly changed:

- public categories;
- weights;
- character source data;
- localized output;
- `/gen`;
- `/gen-char`.

## 3.6 Completed State

Focused validation covers all production generators, ID uniqueness, strict
locale parity, visibility, deterministic weighted behavior, autocomplete/help,
reload, the statistical profile, `/gen-char` dependencies, character schema v2,
and manual encumbrance. Only v2 data and APIs remain.

---

# Part 4 — Structured Resolver and Templates (Complete)

## 4.1 Objective

Return structured results and support recursive template references, including
both random and fixed entry selection.

## 4.2 Random Reference

```json
{
  "person": {
    "generator": "background",
    "select": "fields.Name"
  }
}
```

This chooses a random entry from `background`.

## 4.3 Fixed Entry Reference

```json
{
  "person": {
    "generator": "background",
    "entry": "criminal",
    "select": "fields.Name"
  }
}
```

This resolves the fixed stable entry `criminal`.

`entry` is optional. When present:

- no random entry selection occurs;
- the entry must exist;
- provenance still records generator and entry IDs;
- localized content is read from the active locale.

This capability is required for quest roles such as criminal, merchant, noble,
official, or scholar.

## 4.4 Template Example

```json
{
  "id": "recover-item-before-rival",
  "weight": 2,
  "template": "Recover {{item}} from {{site}} before {{rival}} takes it.",
  "references": {
    "item": {
      "generator": "inventory",
      "select": "fields.Name"
    },
    "site": {
      "generator": "dungeon",
      "select": "fields.Name"
    },
    "rival": {
      "generator": "background",
      "entry": "criminal",
      "select": "fields.Name"
    }
  }
}
```

Reference marker names describe their template role rather than merely repeating
the source generator ID.

## 4.5 Selectors

Support:

- `value`;
- `fields`;
- `fields.<FieldName>`;
- `display`.

## 4.6 Weighted Source Selection

```json
{
  "generator": {
    "oneOf": [
      { "id": "dungeon", "weight": 3 },
      { "id": "building", "weight": 2 },
      { "id": "settlement", "weight": 1 }
    ]
  },
  "select": "display"
}
```

A fixed `entry` may be used only when one concrete generator is identified,
unless a future explicit schema defines an entry for every `oneOf` source.

## 4.7 Resolver API

```js
generate(categoryId, locale, {
  random = Math.random,
  maxDepth = 8,
} = {})
```

The old API is not retained.

## 4.8 Structured Result

Completed results use:

```js
{
  generatorId,
  generatorName,
  entryId,
  outputType,
  value, // text only
  fields, // structured fields only
  templateOutput, // resolved templates only
  provenance,
  modifiers,
}
```

Base/reference provenance is an ordered list of technical selection events. Every
event records a type, random/fixed/weighted selection mode, generator ID, optional
entry ID, and resolution path. Modifier selection provenance lives on its separate
modifier record; the two sources together form the complete choice history.

## 4.9 Services

`generatorResolver` orchestrates resolution.

`weightedSelector` performs weighted selection.

`referenceResolver`:

- resolves random entries;
- resolves fixed entries;
- applies selectors;
- resolves weighted sources;
- detects cycles;
- enforces depth;
- preserves provenance.

`generatorResponses` renders Discord output.

## 4.10 Validation and Tests

Reject:

- missing generators;
- missing fixed entry IDs;
- invalid selectors;
- unused markers;
- missing references;
- cycles;
- excessive depth;
- locale differences in references, fixed entry IDs, and source weights.

Test nested templates, every selector, fixed references, random references,
`oneOf`, cycles, provenance, and deterministic cross-locale selection.

## 4.11 Completed State

Templates resolve into structured output and `/gen` renders them. Random and fixed
references, all selectors, nested templates, weighted sources, stable provenance,
cycle detection, and bounded depth are implemented. Descriptive modifiers were
completed in the same revised Part 2; creatures remain outside this part.

---

# Part 5 — Descriptive Modifier Selection (Complete)

## 5.1 Objective

Support independent descriptive modifiers.

Modifiers are narrative additions only.

## 5.2 Modifier Envelope

```json
{
  "schemaVersion": 2,
  "id": "modifier",
  "kind": "modifier",
  "visibility": "internal",
  "name": "Descriptive modifiers",
  "description": "Descriptive variations shared by generated characters and creatures",
  "appliesTo": [
    "background",
    "creature-animal",
    "creature-companion",
    "creature-monster"
  ],
  "entrySchema": {
    "type": "fields",
    "required": [
      "Name",
      "Description"
    ]
  },
  "entries": []
}
```

## 5.3 Modifier Entry

```json
{
  "id": "gigantic",
  "weight": 1,
  "fields": {
    "Name": "Gigantic",
    "Description": "The creature is much larger and physically stronger."
  }
}
```

Current modifier entries must not contain:

- `mechanics`;
- statistic changes;
- traits to merge into the base result;
- armor changes;
- resource changes;
- RULE assignment;
- status-effect assignment;
- equipment generation;
- executable behavior.

Additional display-only fields may exist only when declared by the entry schema
and never interpreted mechanically.

## 5.4 Modifier Request

```json
{
  "modifiers": [
    {
      "generator": "modifier",
      "chance": 0.25,
      "count": {
        "min": 1,
        "max": 1
      }
    }
  ]
}
```

Rules:

- evaluate `chance` once;
- `count.min` and `count.max` are inclusive;
- choose the count randomly;
- do not select the same entry twice;
- validate `appliesTo`;
- retain modifiers separately from the base result.

## 5.5 Structured Modifier Result

At minimum:

```js
{
  generatorId: 'modifier',
  entryId: 'gigantic',
  name: 'Gigantic',
  description: 'The creature is much larger and physically stronger.',
}
```

The description is guidance for the GM. It does not alter any generated field.

## 5.6 Explicit Non-Effects

Selecting a modifier never changes:

- level;
- statistics;
- derived values;
- HP, AR, AP, or MD;
- natural armor;
- base traits;
- RULEs;
- status effects;
- equipment;
- inventory;
- entity type.

`RULE Bearer` remains a descriptive result only.

## 5.7 Validation and Tests

Reject malformed compatibility, chance, count, duplicate selections, invalid
weights, and any modifier mechanical field.

Test chance boundaries, count boundaries, uniqueness, compatibility,
deterministic selection, structured records, and proof that base output is not
mutated.

## 5.8 Completed State

Generic structured results contain compatible descriptive modifier records when
requested by a generator or entry. Chance is evaluated once, inclusive counts are
selected, weighted entries are unique within a request, and each record retains
technical provenance. The current production `modifier` catalog is shared by
background-based character generation and internal creature-detail catalogs; no
mechanical modifier behavior is introduced.

---

# Revised Part 3 — Persistent Creatures and Shared Entity Management (Complete)

## 3.1 Persistent Models and Compatibility

Persistent concrete types are exactly `character` and `creature`. Animal,
companion, and monster remain creature source categories. The implementation
keeps independent `Character` and `Creature` models and shares only behavior that
has the same semantics; no common base class or inheritance hierarchy is required.

Character schema v2, its v1-to-v2 in-memory migration, existing serialized property
order, save paths, history paths, rendering, editing, and authorization remain
compatible. A shared descriptive `modifiers` list is appended to new saves and
defaults to empty when absent, without rewriting existing save files.
Character serialization has no required type discriminator. Creature schema v1
stores immutable `type: "creature"` and EntityKey, creator, level, localized final
identity and description, source/profile/provenance identifiers, final statistics,
resources, descriptive status effects, intrinsic traits, fixed RULEs, descriptive
modifiers, gear, manual encumbrance, and explicit natural-armor data. Creature
hydration validates and clones that final state without rerunning generation or
localization.

## 3.2 Persistence and Global Keys

Character paths remain unchanged. Creature active saves live below
`save/creatures/`, with history below `save/.history/creatures/`. Both concrete
stores use the same per-EntityKey operation queue and atomic JSON publication.
Creation checks active saves and retained history across both types while holding
that queue, so concurrent cross-type creation cannot publish the same key.

Creature updates, history snapshots, undo, and permanent deletion follow the
existing character transaction semantics: complete pre-change snapshots, current
runtime retention limits, no history for failed or unauthorized work, history-first
mutation commits with rollback, mutation-first undo commits with rollback, and
history-first permanent deletion with restoration if active deletion fails. Undo
validates the concrete snapshot type and never creates redo history.

## 3.3 Shared Commands and Presentation

The common command surface is:

```text
/add entity-key:<new key> [type:<character|creature>]
/get entity-key:<key> [field]
/set entity-key:<key> field:<field>
/damage entity-key:<key> damage-amount:<number> [piercing]
/heal entity-key:<key> resource:<hp|armor|both> percentage:<0-100>
/end-turn entity-key:<key>
/delete entity-key:<key>
/undo entity-key:<key>
```

`/add` defaults to `character`. `/gen-char` remains character-specific. Revised
Part 3 intentionally left `/gen-monster` to Revised Part 4, which now provides it.
Management handlers delegate to the entity application service, while the concrete
editors and field catalogs preserve type-specific behavior. Character presentation
retains its established order. Creature presentation independently uses `identity`,
`level`, `status`, `statistics`, `rules`, `traits`, `modifiers`, and `gear`.
Resolved autocomplete offers only compatible fields.

Anyone with normal bot access may view either type. The creator, configured DM, and
actual server owner may mutate, undo, and delete it. Creature encumbrance defaults
to `{ current: 0, max: 0 }` and remains manually edited; no character or creature
encumbrance is derived from statistics, gear, armor, or generation metadata.

## 3.4 Verification

Focused tests cover Character compatibility, strict Creature validation and
hydration, global active/history key collisions, cross-type creation races,
serialized operations, history and undo, both rollback directions, deletion,
authorization, type-compatible editing and autocomplete, independent presentation
order, and registered management handlers.

The following Legacy Parts 6 through 9 are superseded historical design notes. They
do not override the completed state above.

---

# Revised Part 4 — Creature Generation and `/gen-monster` (Complete)

## 4.1 Sources and Generation Metadata

The public generator-v2 `creature` catalog routes the stable `animal`, `companion`,
and `monster` type entries to the internal `creature-animal`,
`creature-companion`, and `creature-monster` detail catalogs, matching the existing
background router architecture. Detail entries retain the current localized
identities and descriptions and add strict `generation` metadata: a statistical
profile, localized intrinsic traits with stable IDs, optional explicit natural
armor or armor reference, explicit fixed RULE entry IDs and levels, optional
descriptive status references, and arrays of ordinary equipment and inventory
references. Entries have explicit stable IDs and weights and cannot contain fixed
statistics, per-entry profile overrides, alternate budgets, challenge ratings, or
resource formulas.

Five reusable creature distributions ship alongside `character-balanced`:
`creature-predator`, `creature-brute`, `creature-caster`,
`creature-elemental`, and `creature-companion`. They contain only minimums,
maximums, and allocation weights. Creature levels range from 1 through 10 and use
the existing shared budget, nonlinear costs, weighted allocation, derived
statistics, and HP/AR/AP/MD calculations.

## 4.2 Explicit Rules, Descriptive Records, Armor, and Gear

Creature Intelligence never grants RULE points or RULEs. Only an entry's
`fixedRules` references create persisted RULE records, so a low-Intelligence
creature may have an explicit RULE and a high-Intelligence creature has none unless
one was authored. Generated status effects are localized descriptive records with
stable selection provenance and enforce no bonuses, penalties, durations, or
resource changes.

The internal `modifier` generator applies through the completed generic modifier
resolver to both background-based characters and creature detail generators. Its
localized records and provenance are stored separately on either entity; selecting
one cannot alter any mechanical or base field. The public structured
`status-effect` catalog likewise supplies descriptive states to both character and
creature generation, replacing the former creature-only duplicate.

Explicit natural-armor percentages and armor references are mutually exclusive.
Only natural armor or the referenced armor generator's technical `AR percentage`
initializes AR through the shared resource formulas. Equipment and inventory use
the existing fixed, random, nested, and weighted reference machinery. Descriptive
prose never supplies mechanics. Generated gear never changes the Creature model's
manual `{ current: 0, max: 0 }` encumbrance default.

## 4.3 Atomic Generation and Command

The public command is:

```text
/gen-monster creature-key:<new key> type:<monster|animal|companion> [level]
```

The type is required, level is optional from 1 through 10 and random when omitted,
and permission follows the configured-DM-or-actual-server-owner generation policy.
Its centralized help order follows `/gen` and `/gen-char`.

The thin command adapter delegates to `creatureApplicationService`, which runs
generation inside `creatureStore.createCreature` and the shared per-EntityKey
critical section. Global character/creature collision checks, final schema
validation, and exclusive atomic publication complete before the entity becomes
visible. A generation, validation, collision, or save failure leaves no creature,
history, key reservation, or temporary file.

The persisted Creature contains its selected level, localized identity, source and
profile IDs, complete technical provenance, final statistics and resources,
intrinsic traits, explicit RULEs, descriptive status and modifier records, armor
state, equipment, inventory, creator, and immutable key. Loading and rendering use
only that final save and never rerun generation or localization.

## 4.4 Verification

Focused tests cover all three categories and five profiles, level selection,
nonlinear budgets, deterministic English/French IDs, high- and low-Intelligence
RULE policy, derived resources, natural and generated armor, fixed and weighted
gear, descriptive status, modifier non-effects, manual encumbrance, command
authorization and rendering, global collision behavior, atomic publication
failure, queue cleanup, persisted provenance, and stability across reload/load.

Legacy Parts 10 through 12 later in this document are superseded historical design
notes. They do not override the completed state above.

---

# Part 6 — Shared `Combatant` Model (Superseded)

## 6.1 Objective

Extract shared combat state from `Character` without adding `Creature`.

## 6.2 Hierarchy

```text
Combatant
├── Character
└── Creature
```

Only `Combatant` and the refactored `Character` are implemented here.

## 6.3 Shared State

`Combatant` contains:

- immutable entity key;
- immutable concrete entity type;
- creator ID;
- level;
- seven base statistics;
- initiative;
- reflexes;
- HP, AR, AP, and MD;
- personality when present;
- RULEs;
- status effects;
- equipment;
- inventory;
- manually managed encumbrance;
- shared combat and turn behavior.

It does not depend on Discord, generation, rendering, or persistence.

## 6.4 Character State

`Character` adds:

- first name;
- last name;
- race;
- racial description and lore;
- racial traits;
- appearance;
- backstory;
- goals;
- talents.

Existing hydration, display name, and serialization remain compatible.

## 6.5 Shared Mechanics

Extract or consolidate:

- statistic creation and validation;
- initiative and reflexes;
- HP, AP, and MD maxima;
- resource creation and recalculation;
- validation of manually edited encumbrance without deriving either value;
- common damage, healing, armor restoration, and turn behavior.

```text
initiative = speed
reflexes = speed

maximum HP =
  constitution × 10 × (1 + 0.2 × (level - 1))

maximum AP:
  level 1–3 = 4
  level 4–6 = 5
  level 7–9 = 6
  level 10  = 8

maximum MD = speed × 0.5
```

Existing rounding and current-resource adjustment policies remain authoritative.

## 6.6 Save Compatibility

Existing character saves must load without a newly required discriminator.
Runtime may expose `entityType: "character"` while serialization preserves the
current schema.

## 6.7 Tests and Completion

Test current saves, defaults, serialization, display, shared mechanics, and all
existing character operations.

No creature, persistence generalization, or command changes are included.

Stop and wait for confirmation.

---

# Part 7 — Generic Entity Persistence Foundations (Superseded)

## 7.1 Objective

Generalize working persistence infrastructure while supporting characters only.

## 7.2 Reusable Foundations

Extract or parameterize where appropriate:

- per-key operation queues;
- atomic JSON publication;
- history transactions;
- rollback;
- permanent deletion;
- load-error reporting.

Do not rewrite proven atomic behavior without need.

## 7.3 `entityApplicationService`

Initially resolves characters only.

Responsibilities:

1. resolve an entity key;
2. identify concrete model;
3. delegate to concrete store;
4. invoke shared mechanics;
5. invoke concrete validation;
6. coordinate common operations.

## 7.4 Operations

Prepare entity-neutral retrieval, creation, update, deletion, damage, healing,
end turn, history, and undo.

Commands are not switched yet.

## 7.5 Tests and Completion

Test unchanged character behavior, atomicity, history, rollback, concurrency,
facade delegation, and errors.

No creature store or command schema change is included.

Stop and wait for confirmation.

---

# Part 8 — `Creature` Model and Persistence (Superseded)

## 8.1 Objective

Add complete creature persistence without random creature generation.

## 8.2 Creature Model

`Creature` extends `Combatant` with:

- name;
- description;
- optional source category;
- optional source entry ID;
- optional statistical profile ID;
- natural armor percentage;
- intrinsic creature traits;
- descriptive applied modifiers.

Persistent model types are exactly:

```text
character
creature
```

`animal`, `monster`, and `companion` are source categories, not entity types.

## 8.3 Storage

```text
save/
├── <CharacterKey>.json
├── creatures/
│   └── <EntityKey>.json
└── .history/
    ├── <CharacterKey>.json
    └── creatures/
        └── <EntityKey>.json
```

Character paths remain unchanged.

## 8.4 Complete Creature Save

Store final state:

- schema version;
- entity type and key;
- creator ID;
- level;
- name and description;
- optional source category, entry ID, and profile ID;
- final statistics;
- derived resources;
- natural armor;
- intrinsic traits;
- fixed RULEs;
- descriptive status effects;
- descriptive modifier records;
- equipment;
- inventory;
- manually managed `gear.encumbrance` with independent `current` and `max`
  values.

Loading never regenerates data.

## 8.5 Store and Key Uniqueness

Add creature create, retrieve, list, update, delete, history, undo, and
load-error handling.

Character and creature keys share one uniqueness domain.

All creation and mutation guarantees use the common per-key queue:

- exclusive creation;
- atomic save publication;
- atomic history publication;
- serialized mutations;
- rollback;
- no partial visibility.

Undo cannot change concrete type.

## 8.6 Blank Creature

Provide service-level creation of a valid blank creature. Command support waits
until Part 9.

## 8.7 Tests and Completion

Test model validation, save/reload, global collisions, concurrency, history,
rollback, undo, deletion, wrong schemas, and loading without regeneration.

Stop and wait for confirmation.

---

# Part 9 — Common Entity Commands (Superseded)

## 9.1 Objective

Generalize management commands for characters and creatures.

## 9.2 Commands

```text
/gen-char character-key:<new key> [level] [background]
/gen-monster creature-key:<new key> type:<monster|animal|companion> [level]

/add entity-key:<new key> [type:<character|creature>]
/get entity-key:<key> [field]
/set entity-key:<key> field:<field>
/damage entity-key:<key> damage-amount:<number> [piercing]
/heal entity-key:<key> resource:<hp|armor|both> percentage:<0-100>
/end-turn entity-key:<key>
/delete entity-key:<key>
/undo entity-key:<key>
```

`/gen-monster` remains absent until Part 12.

## 9.3 `/add`

`type` defaults to `character`.

Concrete type is immutable.

## 9.4 Field Catalog

```js
{
  id: 'race',
  appliesTo: ['character'],
}

{
  id: 'strength',
  appliesTo: ['character', 'creature'],
}

{
  id: 'traits',
  appliesTo: ['creature'],
}
```

Field compatibility is unrelated to statistical profiles or modifier
`appliesTo`.

## 9.5 Shared Operations

Route damage, healing, armor restoration, end turn, deletion, history, undo,
and common reads/writes through shared services.

Statistic updates recalculate dependencies and publish history atomically.

## 9.6 Autocomplete and Permissions

Merge character and creature keys.

Expose only fields compatible with the resolved entity.

Preserve creator, DM, moderator where applicable, and real server-owner
authorization.

## 9.7 Tests and Completion

Test each command with both types, incompatible fields, autocomplete,
authorization, history, undo, recalculation, and immutable type.

Stop and wait for confirmation.

---

# Part 10 — Creature Archetypes and Fixed RULEs (Superseded)

## 10.1 Objective

Generate complete unsaved base creatures using internal source catalogs,
profiles, intrinsic traits, fixed RULEs, and descriptive status effects.

## 10.2 Source Categories

- `animal`;
- `monster`;
- `companion`.

They are internal component generators and distinct catalogs.

A historical animal is assigned to `animal` or `companion` according to its
intended role. Do not automatically duplicate the same entry in both.

A separately authored trained or bonded variant may exist when meaningfully
different from the wild animal.

## 10.3 Entry Shape

```json
{
  "id": "fire-elemental",
  "weight": 1,
  "fields": {
    "Name": "Fire Elemental",
    "Description": "A living mass of flame held together by magical pressure.",
    "Traits": [
      {
        "id": "living-fire",
        "Name": "Living Fire",
        "Description": "The creature is made of flame rather than ordinary flesh."
      }
    ]
  },
  "mechanics": {
    "statProfile": "elemental",
    "naturalArmorPercentage": 0,
    "fixedRules": [
      {
        "ruleId": "fire",
        "level": 1
      }
    ],
    "initialStatusEffect": {
      "chance": 0,
      "generator": "status-effect"
    }
  },
  "modifiers": [
    {
      "generator": "modifier",
      "chance": 0.25,
      "count": {
        "min": 1,
        "max": 1
      }
    }
  ]
}
```

Modifier requests are selected and attached only in Part 11. They never have
mechanical effects.

## 10.4 Requirements

Required:

- ID;
- `fields.Name`;
- `fields.Description`;
- `mechanics.statProfile`.

Optional:

- weight;
- intrinsic traits;
- natural armor;
- fixed RULEs;
- initial status effect;
- descriptive modifier requests.

## 10.5 No Per-Creature Statistic Overrides

Entries do not define:

- fixed statistics;
- per-stat minimums;
- per-stat maximums;
- per-stat weights;
- HP multipliers;
- alternative budgets.

## 10.6 Profiles

Initial reusable profiles may include:

- `animal`;
- `companion`;
- `predator`;
- `brute`;
- `caster`;
- `boss`;
- `elemental`.

A profile changes distribution only.

`caster` does not grant a RULE.

`boss` does not grant extra budget or create challenge rating.

## 10.7 RULE Policy

Creature RULE assignment is explicit and independent from Intelligence.

Only `mechanics.fixedRules` grants a RULE during creature generation.

A fixed RULE:

- references a stable `rules` entry ID;
- has explicit level;
- is always added;
- may be assigned to low-Intelligence creatures;
- is persisted.

Modifiers never grant RULEs.

## 10.8 Status Effects

An initial status effect:

- is selected only when its configured chance succeeds;
- is persisted as localized descriptive data;
- is interpreted by the GM;
- does not automatically alter statistics, actions, resources, or duration.

## 10.9 Base Generation Flow

```text
level
→ source category
→ creature archetype
→ statistical profile
→ statistic allocation
→ identity and intrinsic traits
→ fixed RULEs
→ derived statistics and resources
→ natural armor
→ optional descriptive status effect
→ final Creature validation
```

## 10.10 Generation Service

`creatureGenerationService`:

- selects archetype;
- loads profile;
- generates statistics;
- resolves intrinsic traits;
- resolves fixed RULEs;
- resolves optional descriptive status effects;
- calculates resources;
- constructs an unsaved creature.

It does not write files or depend on Discord.

## 10.11 Validation and Tests

Validate categories, profiles, names, descriptions, armor, trait IDs, fixed
RULE structures, RULE IDs and levels, status-effect configuration, and locale
mechanical parity.

Test each category, levels, profile selection, traits, fixed RULEs with low
Intelligence, no RULE from high Intelligence, resources, armor, status effects,
empty equipment/inventory, and deterministic generation.

## 10.12 Completion Criteria

A complete base creature can be generated in memory. No modifier is attached
yet and no Discord generation command exists.

Stop and wait for confirmation.

---

# Part 11 — Descriptive Creature Modifier Integration (Superseded)

## 11.1 Objective

Attach selected descriptive modifiers to generated creatures without changing
any other generated value.

## 11.2 Integration Flow

```text
base Creature generation
→ evaluate modifier requests
→ select compatible descriptive modifiers
→ attach modifier records
→ final validation
```

Modifier selection may occur before final validation because modifier records
are part of the final save, but no derived values are recalculated as a result.

## 11.3 Persisted Record

At minimum:

- modifier generator ID;
- modifier entry ID;
- localized name;
- localized description.

The record remains separate from:

- intrinsic creature traits;
- fixed RULEs;
- status effects;
- equipment;
- statistics.

## 11.4 Non-Effects

A selected modifier must leave all base creature fields unchanged except
`appliedModifiers`.

This includes modifiers named:

- Alpha;
- Hybrid;
- Undead;
- Reinforced;
- Gigantic;
- Enraged;
- Pack;
- Swarm;
- Ectoplasmic;
- Invisible;
- RULE Bearer;
- Equipped.

Their descriptions guide the GM only.

## 11.5 Tests

Given identical base-generation randomness, selecting a modifier must not alter:

- statistics;
- resources;
- natural armor;
- traits;
- RULEs;
- status effects;
- equipment;
- inventory.

Test record persistence, localization, unique selection, compatibility, and
reload stability.

## 11.6 Completion Criteria

Generated in-memory creatures retain descriptive modifier records. No modifier
mechanics exist anywhere in the implementation.

Stop and wait for confirmation.

---

# Part 12 — `/gen-monster` Integration (Superseded)

## 12.1 Objective

Expose complete creature generation through Discord and atomically create the
save.

## 12.2 Command

```text
/gen-monster creature-key:<new key> type:<monster|animal|companion> [level]
```

- key is required and globally unique;
- type is required;
- level is optional from `1` to `10`;
- omitted level is random from `1` to `10`;
- command name remains `/gen-monster` for all three source categories.

## 12.3 Authorization

Restrict generation to DM role and real server owner according to project
policy.

## 12.4 Flow

```text
/gen-monster
  → creatureApplicationService.generateCreature(...)
      → reserve and validate EntityKey
      → creatureGenerationService builds the base Creature
      → descriptive modifiers are selected and attached
      → validate final Creature
      → creatureStore publishes atomically
  → creatureCommandResponses renders the localized sheet
```

The command only parses options, checks permission, calls the service, and
renders the outcome.

## 12.5 Atomicity

Generation failure leaves:

- no creature save;
- no partial history;
- no reserved key;
- no cross-type collision.

## 12.6 Saved Contents

- level;
- seven statistics;
- initiative and reflexes;
- HP, AR, AP, and MD;
- source category and entry ID;
- profile ID;
- name and description;
- intrinsic traits;
- fixed RULEs;
- optional descriptive status effects;
- descriptive modifier records;
- empty equipment and inventory by default;
- creator and entity key.

No modifier-derived trait, RULE, armor, equipment, statistic, or resource is
stored.

## 12.7 Rendering

Clearly display identity, level, statistics, resources, intrinsic traits, fixed
RULEs, status effects, and modifiers.

Modifier descriptions must be visibly separate from base creature properties.

## 12.8 Help, Autocomplete, and Tests

Add command metadata, localized help, type autocomplete, level bounds, response
tests, authorization tests, collision and concurrency tests, output-limit tests,
and common-command integration.

Expected help order:

1. `/gen`;
2. `/gen-char`;
3. `/gen-monster`.

## 12.9 Completion Criteria

`/gen-monster` atomically saves complete creatures and all common commands manage
them.

Stop and wait for confirmation before historical migration.

---

# Part 13 — Historical Migration Inventory

## 13.1 Objective

Create a complete migration manifest for every reusable entry in
`documentation/JDR_RANDOM_OLD.md`.

No production data changes occur in this part.

## 13.2 Covered Historical Sections

Inventory:

- regions;
- settlements;
- adventure sites;
- buildings;
- weapons;
- inventory;
- races;
- named NPC material;
- NPC ages;
- NPC professions and statuses;
- personalities;
- status effects;
- events;
- animals;
- criminals;
- monsters;
- RULEs;
- quests;
- site modifiers;
- monster modifiers.

The historical statistics section remains documentation only and is not
imported as generation data.

## 13.3 Manifest Fields

For every historical entry record:

- historical section;
- historical French name or value;
- target generator;
- proposed stable ID;
- proposed kind and visibility;
- add, merge, replace, rewrite, split, or reject;
- conflicting current entry when any;
- winning historical content;
- preserved historical weight;
- required English translation;
- required references;
- required profile for creatures;
- required fixed RULEs for creatures;
- animal versus companion classification;
- notes requiring user review.

## 13.4 Conflict Policy

When a current entry and historical entry represent the same or conflicting
concept:

- keep one canonical entry;
- historical name, description, limits, fields, and deliberate weight win;
- retain an existing stable technical ID when that avoids unnecessary reference
  churn and does not misrepresent the concept;
- update localized content to the historical version;
- remove the duplicate;
- update all references.

Current entries that are genuinely distinct remain.

## 13.5 Completion Criteria

Every historical entry is accounted for and no migration begins until the
manifest is reviewed.

Stop and wait for confirmation.

---

# Part 14 — Direct Standalone-List Migration

## 14.1 Objective

Migrate historical lists that map directly to normal v2 generators.

## 14.2 Lists

Migrate:

- `region`;
- `settlement`;
- `dungeon`;
- `building`;
- `weapons`;
- `inventory`;
- `race`;
- `personality`;
- `status-effect`;
- `event`.

Any additional directly compatible list found by the approved manifest may be
included only when explicitly listed before implementation.

## 14.3 Structured Locations

Regions, settlements, dungeons, buildings, and events use stable IDs with
`Name` and `Description`.

## 14.4 Weapons and Inventory

Preserve:

- `Name`;
- `Description`.

Do not migrate or add numeric `Encumbrance` fields. Generated weapons,
equipment, inventory, and gold never alter the manually managed saved
encumbrance resource.

## 14.5 Races

Preserve atomic fields:

- `Name`;
- `Description`;
- `Skill Bonus`;
- `Physical Ability`.

Do not independently select racial fields.

## 14.6 Personalities

Preserve every historical personality entry and historical weight, including
sensitive, clinical, dated, or provocative labels.

Do not remove or neutralize entries during migration.

Translate faithfully into English while preserving meaning and weight.

## 14.7 Status Effects

Migrate as descriptive `Name` and `Description` entries.

Descriptions may suggest likely consequences, but no technical penalty,
duration, trigger, or removal mechanic is added or enforced.

## 14.8 Conflict Handling

Apply historical precedence against current data for every migrated list.

## 14.9 Tests and Completion

Validate IDs, parity, weights, field schemas, output rendering, and complete
manifest coverage for these sections.

Stop and wait for confirmation.

---

# Part 15 — Humanoid and Background Migration

## 15.1 Objective

Migrate all historical humanoid material into character-generation components.

## 15.2 Complete Humanoid Rule

Only `/gen-char` creates complete humanoids.

Do not create:

- `npc.json` as a complete-person generator;
- `criminal.json` as a complete-person generator;
- an NPC model;
- an NPC persistence store;
- an NPC generation command;
- a separate criminal entity type.

## 15.3 Named Historical NPCs

Historical named characters such as authored NPC examples are decomposed.

Reusable personal names may be added to `name`.

Useful concepts from their descriptions may be added to appropriate existing
character components such as:

- background detail;
- personality;
- goal;
- backstory;
- talent.

Do not import a complete authored NPC as one generator entry unless the user
later approves a separate authored-character feature.

## 15.4 NPC Ages

Merge reusable age concepts into the character-generation component that owns
age or life-stage description, if such a component exists after v2 cutover.

Do not create an NPC-only age generator.

## 15.5 Professions and Statuses

Map every historical profession or status to its appropriate broad background
detail generator.

Target background-detail IDs should follow the stable v2 naming convention,
such as:

- `background-criminal`;
- `background-adventurer`;
- `background-noble`;
- `background-peasant`;
- `background-artisan`;
- `background-merchant`;
- `background-scholar`;
- `background-religious`;
- `background-military`;
- `background-outlander`;
- `background-sailor`;
- `background-performer`;
- `background-servant`;
- `background-official`;
- `background-mage`;
- `background-exile`;
- `background-urchin`.

A profession may appear in more than one background only when the resulting
background meaning is genuinely different.

## 15.6 Historical Criminal Entries

The old criminal group descriptions must not remain a separate `criminal`
generator.

Rewrite them into individual-character concepts inside
`background-criminal`, for example:

- road brigand;
- corrupt guard;
- poacher;
- enemy scout or infiltrator.

Where a concept belongs more naturally to another background, place it there or
create separate appropriate variants.

## 15.7 `/gen-char` Integration

All imported humanoid material must be reachable through the existing
`background` option and normal `/gen-char` generation pipeline.

The broad `background` entry continues to reference its detailed background
component.

## 15.8 Tests and Completion

Test every broad background reference, imported detail reachability, absence of
`npc` and `criminal` complete-person generators, and unchanged complete
humanoid creation through `/gen-char`.

Stop and wait for confirmation.

---

# Part 16 — RULE Reconciliation

## 16.1 Objective

Merge the historical RULE list into the v2 `rules` generator.

## 16.2 Comparison

Compare each historical RULE against all current RULE entries.

Classify:

- new;
- exact duplicate;
- conceptual duplicate;
- overlapping but distinct;
- historical replacement;
- current unique entry.

## 16.3 Precedence

When content conflicts, historical RULE content wins:

- historical concept;
- historical name;
- historical description;
- historical limitations;
- historical deliberate weight.

Use one canonical stable ID.

An existing ID may remain when it accurately identifies the historical winning
concept and reduces reference churn.

## 16.4 References

After reconciliation:

- update creature fixed RULE references;
- update templates and other references;
- remove duplicate IDs;
- verify locale parity;
- verify no reference points to a removed entry.

## 16.5 RULE Semantics

RULEs remain descriptive rule concepts used by the game.

This migration does not create executable RULE mechanics.

Creature assignment remains explicit through base-archetype `fixedRules`.

Modifiers never grant RULEs.

## 16.6 Tests and Completion

Test ID uniqueness, historical precedence, weights, fixed references,
localization, and manifest coverage.

Stop and wait for confirmation.

---

# Part 17 — Creature-List Migration

## 17.1 Objective

Migrate historical animals and monsters into complete structured source
catalogs and create the companion catalog where appropriate.

## 17.2 Classification

Each historical creature is assigned to exactly one primary source:

- `animal`;
- `companion`;
- `monster`.

Use `companion` when the entry is specifically intended to accompany, assist,
follow, or be trained by humanoids.

Use `animal` for wild or ordinary fauna.

Use `monster` for supernatural, hostile, transformed, or extraordinary threats.

A separate companion variant may be authored when its training or bond changes
the description enough to constitute a distinct entry.

## 17.3 Required Conversion

For every creature:

- stable ID;
- localized `Name`;
- localized `Description`;
- reusable `statProfile`;
- intrinsic traits where appropriate;
- natural armor where appropriate;
- fixed RULEs only when intrinsic;
- optional descriptive initial status effect;
- optional descriptive modifier request.

Do not define fixed statistics or profile overrides.

## 17.4 Intrinsic RULE Examples

Possible intrinsic fixed RULEs include a fire RULE for a fire creature or a
petrification RULE for a gorgon-like creature, but every assignment requires
content review.

Generic descriptions such as “elemental” must not receive an arbitrary fixed
RULE without a specific element.

## 17.5 Balance

Review every profile and natural-armor choice across levels `1` through `10`.

Level remains the only general power indicator.

No challenge rating, hidden budget, boss budget, or encounter power is added.

## 17.6 Tests and Completion

Test source classification, profile existence, traits, armor, fixed RULEs,
status effects, descriptive modifier requests, and full migration coverage.

Stop and wait for confirmation.

---

# Part 18 — Modifier-List Migration

## 18.1 Objective

Migrate historical site and monster modifiers as descriptive modifier data.

## 18.2 Site Modifiers

Migrate historical compatibility targets such as:

- region;
- settlement;
- dungeon;
- building.

Preserve historical names, descriptions, and applicability.

## 18.3 Creature Modifiers

Migrate all historical creature modifier concepts, including:

- Alpha;
- Hybrid;
- Undead;
- Reinforced;
- Gigantic;
- Enraged;
- Pack;
- Swarm;
- Ectoplasmic;
- Invisible;
- RULE Bearer;
- Equipped.

Every entry contains descriptive data only.

For example, `RULE Bearer` may describe that the creature appears to wield a
RULE, but the generator does not select, grant, or persist an added RULE.

`Equipped` may describe suitable equipment, but no item is selected or added.

## 18.4 No Mechanics

Reject all attempts to migrate or infer:

- statistic deltas;
- armor deltas;
- resource effects;
- extra traits;
- equipment entries;
- RULE entries;
- status effects;
- conditional behavior;
- group-count mechanics.

## 18.5 Tests and Completion

Test compatibility, weights, localization, selection, persistence, and proof
that all generated base fields remain unchanged.

Stop and wait for confirmation.

---

# Part 19 — Quest-Template Migration

## 19.1 Objective

Convert historical quests into v2 templates after all referenced IDs are stable.

## 19.2 Generic Humanoid References

Historical `{{npc}}` references become random references to `background`.

Example:

```json
{
  "traveler": {
    "generator": "background",
    "select": "fields.Name"
  }
}
```

Example output:

```text
Escort a noble through the region.
```

The result is a role category only.

It does not generate a name, race, personality, sheet, or save.

The DM may then manually run `/gen-char` with that background.

## 19.3 Specific Humanoid References

When a quest requires a specific role, use a fixed background entry.

Criminal:

```json
{
  "suspect": {
    "generator": "background",
    "entry": "criminal",
    "select": "fields.Name"
  }
}
```

Merchant:

```json
{
  "recipient": {
    "generator": "background",
    "entry": "merchant",
    "select": "fields.Name"
  }
}
```

The localized role name is resolved from `background`; do not duplicate literal
English role names in every template.

This rule also applies to noble, official, scholar, military, religious, mage,
and other stable broad background entries.

## 19.4 Other References

For every quest:

- replace old placeholders with role-oriented marker names;
- select exact generators;
- choose exact selectors;
- use fixed entry references where required;
- validate required `material`, `faction`, location, item, race, creature, and
  other generator IDs;
- rewrite sentences for grammatical English and French;
- keep combinations coherent;
- preserve historical intent and weight.

## 19.5 Modifier Mentions

A quest may refer to a selected descriptive modifier.

It must not assume the modifier mechanically changed the creature.

Rewrite text such as “made its attacks impossible to contain” when that implies
an enforced mechanical effect unless the statement is simply narrative quest
prose.

## 19.6 Provenance and DM Workflow

Structured output records selected background, creature, location, and item IDs.

The output may help the DM choose later commands, but it does not automatically
create referenced characters or creatures unless the command explicitly does
so.

## 19.7 Tests and Completion

Test:

- generic background references;
- fixed criminal and merchant references;
- no `npc` generator references;
- no complete `criminal` generator references;
- every selector;
- every referenced generator and entry;
- English/French grammar;
- cycles and depth;
- deterministic resolution;
- historical quest coverage.

Stop and wait for confirmation.

---

# Part 20 — Final Migration Verification and Content Expansion

## 20.1 Historical Coverage

Confirm every manifest entry is:

- migrated;
- merged;
- replaced;
- split;
- explicitly rejected with reason.

No historical entry is silently omitted.

## 20.2 Obsolete References

Verify:

- no `npc` generator exists;
- no complete `criminal` generator exists;
- no template references either;
- all humanoid quest references use `background`;
- all fixed role references use stable background entry IDs;
- all removed RULE IDs have updated references;
- no modifier mechanics remain in JSON or code.

## 20.3 Historical Document

Keep `JDR_RANDOM_OLD.md` as historical source or annotate migration status
without deleting its content unless separately approved.

## 20.4 Balance and Expansion

After migration, further content batches may refine:

- statistical profiles;
- natural armor;
- fixed RULE levels;
- initial status-effect frequency;
- modifier frequency;
- additional creatures;
- additional templates;
- additional public generators.

Balancing remains data work and requires review.

## 20.5 Validation

Run complete:

- generator schema validation;
- English/French parity validation;
- reference validation;
- fixed-entry validation;
- profile validation;
- creature validation;
- save/history validation;
- command checks;
- deterministic tests;
- formatting;
- full `npm test`.

## 20.6 Completion Criteria

The architecture and historical migration are complete when:

- every approved list is migrated;
- historical conflict precedence was applied;
- all complete humanoids use `/gen-char`;
- creatures use the shared profile system;
- modifiers are descriptive only;
- status effects are GM-interpreted;
- `/gen-monster` saves complete creatures;
- all references and locales validate;
- all tests pass.

Stop and wait for final user approval.

---

# Cross-Cutting Localization Rules

English is the structural reference.

French must preserve:

- relative path;
- schema version;
- generator ID;
- kind;
- visibility;
- `appliesTo`;
- entry IDs and order;
- weights;
- reference marker names;
- source generator IDs;
- fixed entry IDs;
- selectors;
- source weights;
- modifier chance and count;
- technical creature mechanics;
- trait IDs;
- fixed RULE IDs and levels;
- profile IDs;
- percentages.

Translate only player-facing text.

Deterministic random sequences must select the same conceptual entries across
locales.

---

# Cross-Cutting Validation Rules

Reject:

- unknown schema versions;
- invalid kinds or visibility;
- duplicate generator or entry IDs;
- invalid weights;
- malformed primary payloads;
- missing required fields;
- locale structural differences;
- missing generators;
- missing fixed entry IDs;
- invalid selectors;
- unused reference markers;
- cycles;
- excessive depth;
- malformed modifier chance/count;
- incompatible modifiers;
- modifier mechanical fields;
- invalid profiles;
- missing statistics;
- invalid statistic bounds;
- missing creature profiles;
- invalid natural armor;
- duplicate trait IDs;
- invalid fixed RULE references;
- creature RULEs derived from Intelligence;
- RULEs derived from modifiers;
- mechanical status-effect configuration;
- invalid entity types;
- cross-type save fields;
- global key collisions;
- wrong history schemas;
- incompatible command fields;
- `npc` or complete `criminal` generators after historical migration.

---

# Cross-Cutting Determinism Requirements

All random services accept an injected random function.

Test:

- entry weight boundaries;
- weighted source boundaries;
- fixed references without randomness;
- unique modifier selection;
- modifier chance and count;
- profile allocation;
- random levels;
- initial status-effect chance;
- cross-locale conceptual selection;
- base creature equality with and without descriptive modifier selection except
  for modifier records.

---

# Final Responsibility Boundaries

## `generatorCatalog`

- discovers v2 files;
- validates envelopes;
- resolves IDs;
- enforces locale parity;
- exposes public/internal data.

## `statProfileCatalog`

- loads non-localized profiles;
- validates distributions;
- resolves profile IDs.

## `weightedSelector`

- performs weighted selection;
- accepts injected randomness;
- knows nothing about Discord or persistence.

## `generatorResolver`

- resolves entries into structured output;
- coordinates references and descriptive modifiers;
- preserves provenance.

## `referenceResolver`

- resolves random and fixed entries;
- applies selectors;
- supports weighted source choice;
- detects cycles;
- enforces depth.

## `modifierResolver`

- validates compatibility;
- evaluates chance and count;
- selects unique descriptive entries;
- returns descriptive records;
- never mutates a base result.

## `entityMechanics`

- calculates budgets;
- allocates statistics;
- derives initiative, reflexes, HP, AP, and MD;
- recalculates dependencies after manual mutations.

## `creatureGenerationService`

- selects archetypes;
- resolves profiles;
- generates base statistics;
- assigns intrinsic traits;
- assigns fixed RULEs;
- resolves descriptive status effects;
- attaches descriptive modifier records;
- constructs unsaved creatures.

## `entityApplicationService`

- resolves global entity keys;
- delegates to stores;
- coordinates common mutations;
- coordinates atomic creature generation;
- invokes concrete validation.

## Concrete Stores

`characterStore` and `creatureStore`:

- persist concrete models;
- validate concrete schemas;
- manage concrete history;
- reuse atomic and transaction foundations.

## Discord Commands

Commands:

- parse options;
- check command-level permission;
- invoke application services;
- render localized responses.

Commands do not own domain algorithms.

---

# Final Character and Humanoid Policy

```text
background category
        ↓
background-specific detail generator
        ↓
other character components
        ↓
/gen-char
        ↓
complete Character save
```

Quest templates may generate only a background role label.

They do not create a humanoid.

There is no parallel NPC-generation path.

---

# Final Creature Generation Flow

```text
localized creature archetype
        ↓
shared non-localized statistical profile
        ↓
shared level budget and weighted allocation
        ↓
intrinsic identity and traits
        ↓
explicit fixed RULEs
        ↓
shared derived statistics and resources
        ↓
natural armor
        ↓
optional descriptive status effect
        ↓
descriptive modifier selection
        ↓
descriptive modifier records only
        ↓
Creature validation
        ↓
atomic complete save with history and undo
```

The final design has:

- one generator format;
- one profile catalog;
- one statistic-allocation algorithm;
- `/gen-char` as the only complete humanoid generator;
- explicit creature RULEs independent from Intelligence;
- no modifier mechanics;
- GM-interpreted status effects;
- separate animal, companion, and monster catalogs;
- separate character and creature save schemas;
- shared combat and persistence foundations;
- historical-content precedence during migration;
- no encounter-power system;
- mandatory review between every implementation part.
