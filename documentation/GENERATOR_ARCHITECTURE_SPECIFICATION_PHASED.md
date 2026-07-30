# Generator and Creature Architecture Specification

## Status

This document defines the target architecture and implementation sequence for:

- the version 2 random generator system;
- shared statistical generation profiles;
- complete character and creature models;
- creature persistence, history, and management;
- complete creature generation through `/gen-monster`;
- later expansion using reusable material from `JDR_RANDOM_OLD.md`.

It is a design and implementation specification. It does not itself modify the bot.

---

# Implementation Protocol

This feature must be implemented **one part at a time**, in the exact order defined by this document unless a dependency discovered during implementation requires an explicit revision.

For every part:

1. implement only the scope of the current part;
2. add or update the tests required by that part;
3. run the complete project test suite;
4. report:
   - the files changed;
   - the behavior implemented;
   - the tests added or changed;
   - the test results;
   - any deviation from this specification;
   - any unresolved design question;
5. stop after completing the current part;
6. wait for explicit user review and confirmation before starting the next part.

Codex must not continue automatically into the next part, even when the next step appears straightforward.

Later-part functionality must not be implemented early unless it is strictly required to make the current part correct. Preparing broad unused abstractions for future parts is not required.

Each completed part should leave the repository in a coherent and testable state.

---

# Compatibility Policy

## Generator data

The old generator JSON format does **not** require backward compatibility.

The repository controls all generator files and all internal callers. The final version 2 system must therefore have:

- one generator file format;
- one validation path;
- one resolver API;
- no runtime format detection;
- no permanent compatibility overload for the old generator service API;
- no v1 generator parser after the version 2 cutover.

Part 2 introduces and tests the version 2 catalog independently without making it the production catalog. Part 3 converts all repository-owned generator data, switches all callers to version 2, and removes the old catalog implementation. This temporary development sequence is not a dual-format production system.

## Persistent and user-facing data

The following compatibility must be preserved unless a later explicit decision changes it:

- existing character save files;
- existing character history;
- existing character keys;
- existing character management behavior;
- existing `/gen-char` behavior where not intentionally changed;
- existing permissions;
- existing public generator concepts and localized output where not intentionally renamed.

Generator data is repository-owned implementation data. Character saves are persistent user data and must not be treated the same way.

---

# Global Architecture Requirements

The completed architecture must support:

- weighted random selection through `weight`;
- simple text entries and structured entries;
- stable technical generator and entry identifiers;
- English and French localized data with strict structural parity;
- internal components hidden from generic `/gen` autocomplete;
- templates referencing other generators;
- independent modifiers;
- atomic selection of fields belonging to one entry;
- complete character generation through `/gen-char`;
- complete creature generation through `/gen-monster`;
- one shared statistical profile system for characters and creatures;
- shared level, statistic, resource, and combat calculations;
- separate `Character` and `Creature` models based on common combat state;
- complete creature save, history, undo, and mutation support;
- deterministic testing through injected random functions;
- strict validation before data activation.

The completed architecture must not:

- derive technical IDs from localized display names;
- store executable formulas in JSON;
- maintain two generator formats;
- automatically grant creature RULEs because of high Intelligence;
- introduce an encounter-power or challenge-rating value;
- define fixed statistics for individual creature entries;
- permit per-creature overrides of profile minimums, maximums, or weights;
- create separate statistic-allocation algorithms for characters and creatures;
- rerun generation when loading a saved creature.

---

# Implementation Overview

| Part | Name | Primary result |
| ---: | --- | --- |
| 1 | Shared statistical profiles | `/gen-char` uses validated shared profile allocation |
| 2 | Generator schema v2 core | New v2 catalog is implemented and tested independently |
| 3 | Generator data conversion and cutover | All generators use v2; old catalog is removed |
| 4 | Structured resolver and templates | Recursive references and structured results work |
| 5 | Generic modifier selection | Descriptive modifiers can be selected generically |
| 6 | Shared `Combatant` model | `Character` inherits shared combat state without behavior changes |
| 7 | Generic entity persistence foundations | Character persistence works through entity-neutral foundations |
| 8 | `Creature` model and persistence | Creatures can be saved, loaded, mutated, and undone |
| 9 | Common entity commands | Existing management commands work for both entity types |
| 10 | Creature archetypes and fixed RULEs | Unsaved complete base creatures can be generated |
| 11 | Mechanical creature modifiers | Modifiers change stats, add traits, and explicitly add RULEs |
| 12 | `/gen-monster` integration | Complete generated creatures are atomically saved by command |
| 13 | Content expansion | Catalogs, profiles, modifiers, templates, and old reusable lists expand |

Parts must be completed and approved sequentially.

---

# Part 1 — Shared Statistical Profiles

## 1.1 Objective

Introduce one non-localized statistical profile system and make existing random character generation use it before creatures are introduced.

This part proves the allocation algorithm using the existing `/gen-char` pipeline.

## 1.2 Data Location

Add:

```text
data/generators/stat-profile.json
```

This file is technical and is not duplicated under `en/` and `fr/`.

It is not a normal generator category and is never exposed through `/gen`.

## 1.3 File Shape

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

The initial `character-balanced` profile must reproduce the current balanced random allocation as closely as possible.

## 1.4 Profile Semantics

A profile contains only:

- per-statistic minimums;
- per-statistic maximums;
- per-statistic allocation weights.

A profile does not contain:

- localized text;
- `appliesTo`;
- HP formulas;
- AP formulas;
- MD formulas;
- RULE assignment;
- traits;
- armor;
- executable expressions;
- entity-type restrictions.

The same profile format will later be used by characters and creatures.

## 1.5 Required Statistics

Every profile defines exactly the seven base statistics:

- `constitution`;
- `strength`;
- `dexterity`;
- `intelligence`;
- `speed`;
- `perception`;
- `charisma`.

For each statistic:

- the minimum is an integer from `4` to `20`;
- the maximum is an integer from `4` to `20`;
- the minimum does not exceed the maximum;
- the allocation weight is finite and greater than or equal to `0`.

At least one allocation weight must be positive.

Unknown or missing statistic keys are rejected.

## 1.6 Shared Level Budget

Characters and creatures use the same level-dependent statistic budget:

```text
base budget at level 1: 67

budget(level) =
  67
  + 2 × (level - 1)
  + 1 at level 2
  + 1 at level 5
  + 1 at level 8
```

Equivalent behavior:

```js
function calculateStatBudget(level) {
  return 67
    + 2 * (level - 1)
    + [2, 5, 8].filter(requiredLevel => level >= requiredLevel).length;
}
```

The existing nonlinear value cost remains:

- values `1` through `14`: `1` point per value;
- values `15` and `16`: `2` points per value;
- values `17` and `18`: `3` points per value;
- values `19` and `20`: `4` points per value.

## 1.7 Allocation Algorithm

Proposed API:

```js
generateStats({
  level,
  profile,
  random = Math.random,
})
```

Algorithm:

1. validate the level and profile;
2. calculate the level budget;
3. initialize every statistic at its profile minimum;
4. calculate the total cost of those minimum values;
5. when the minimum cost equals or exceeds the available budget:
   - preserve every configured minimum;
   - do not reduce any statistic;
   - accept that the result may exceed its nominal budget;
   - perform no additional allocation;
6. otherwise, calculate the remaining budget;
7. determine the eligible statistics:
   - current value is below the configured maximum;
   - allocation weight is greater than `0`;
   - the next increase can be purchased with the remaining budget;
8. select one eligible statistic using weighted selection;
9. increase it by `1`;
10. subtract the cost of that increase;
11. repeat until no statistic is eligible.

Unused budget is accepted when no legal increase can consume it.

## 1.8 Catalog Responsibility

Add a separate technical service such as `statProfileCatalog` with operations equivalent to:

```js
getStatProfile(profileId)
listStatProfiles()
validateStatProfiles()
clearStatProfileCache()
```

The service must not depend on Discord.

## 1.9 Character Integration

Update random character generation to:

1. load `character-balanced`;
2. pass it to the shared allocator;
3. preserve existing character RULE allocation based on Intelligence;
4. preserve existing character saves and command behavior.

Profiles affect random generation only. They do not restrict manual character creation or later `/set` operations beyond normal statistic validation.

## 1.10 Validation

Reject:

- unknown profile schema versions;
- duplicate profile IDs;
- missing or unknown statistics;
- invalid minimums or maximums;
- minimums greater than maximums;
- negative or non-finite weights;
- profiles with no positive weight.

A profile whose minimums exceed a level budget is valid by design.

## 1.11 Tests

Test:

- profile loading and caching;
- duplicate and malformed profiles;
- all statistics starting at minimum;
- maximums never being exceeded;
- zero-weight statistics never being selected;
- weighted allocation boundaries;
- nonlinear next-value costs;
- correct budget at every level;
- minimums exceeding budget;
- unspendable remaining budget;
- deterministic results from an injected random sequence;
- unchanged `/gen-char` save shape;
- unchanged character RULE behavior.

## 1.12 Completion Criteria

Part 1 is complete when:

- `/gen-char` uses `character-balanced`;
- existing character saves remain compatible;
- the complete test suite passes;
- no creature implementation exists yet;
- no generator v2 work has been included.

Stop and wait for confirmation.

---

# Part 2 — Generator Schema Version 2 Core

## 2.1 Objective

Implement the version 2 generator catalog and validation model independently from the current production generator catalog.

This part does not support or parse old-format files inside the v2 catalog.

The existing runtime may continue using its current catalog until Part 3, while the v2 implementation is tested with dedicated fixtures. This is temporary development isolation, not backward compatibility inside the new system.

## 2.2 Target Directory Structure

The final data layout is:

```text
data/generators/
├── stat-profile.json
├── en/
│   ├── categories/
│   ├── components/
│   ├── modifiers/
│   └── templates/
└── fr/
    ├── categories/
    ├── components/
    ├── modifiers/
    └── templates/
```

Directory roles:

- `categories/`: autonomous generators normally visible through `/gen`;
- `components/`: internal generators used through references or specialized commands;
- `modifiers/`: independent modifier generators;
- `templates/`: composed generators using references.

## 2.3 Common Generator Envelope

Every localized generator uses:

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

- `schemaVersion`: exactly the supported v2 value;
- `id`: stable English technical ID;
- `kind`: `category`, `component`, `modifier`, or `template`;
- `visibility`: `public` or `internal`;
- `entrySchema`: expected entry shape.

Localized properties:

- `name`;
- `description`;
- player-facing entry content.

Technical IDs must never be derived from localized names.

## 2.4 Entry Shapes

Every entry has:

- a stable `id`;
- an optional positive `weight`, defaulting to `1`;
- exactly one primary payload:
  - `value`;
  - `fields`;
  - `template`.

A text entry:

```json
{
  "id": "forest-at-dusk",
  "weight": 3,
  "value": "A forest path disappears as night falls."
}
```

A structured entry:

```json
{
  "id": "human",
  "weight": 5,
  "fields": {
    "Name": "Human",
    "Description": "Adaptable communities connected by fast-changing traditions.",
    "Skill Bonus": "Choose one skill bonus during character creation.",
    "Physical Ability": "Adapt quickly to a sudden change of climate or pace."
  }
}
```

All fields in one structured entry are selected atomically.

An entry may later contain `mechanics`, `references`, or `modifiers` when its kind and schema allow them. Part 2 needs to define extensible validation boundaries, but it does not implement reference or modifier behavior.

## 2.5 Catalog API

The v2 catalog should expose:

```js
getGenerator(id, locale)

listGenerators(locale, {
  visibility = 'public',
} = {})

clearGeneratorCache()
```

Selection may remain in a dedicated reusable helper:

```js
selectWeightedEntry(entries, random = Math.random)
```

Do not preserve the previous API overloads for long-term use.

## 2.6 Discovery

The catalog:

- scans all four directories;
- uses English paths as the structural reference;
- reads the corresponding localized file;
- identifies generators by stable `id`;
- prevents duplicate IDs across all generator kinds;
- exposes public generators by default;
- permits internal services to request internal data explicitly.

## 2.7 Localization Parity

For every French file, validate against the corresponding English file:

- identical relative path;
- identical `schemaVersion`;
- identical `id`;
- identical `kind`;
- identical `visibility`;
- identical `entrySchema`;
- identical entry IDs;
- identical entry order;
- identical weights;
- identical technical keys and values;
- localized player-facing text may differ.

Later parts extend parity validation to references, mechanics, traits, fixed RULEs, modifier requests, and statistic changes.

## 2.8 Core Validation

Reject:

- unknown schema versions;
- unknown kinds;
- invalid visibility;
- duplicate generator IDs;
- duplicate entry IDs;
- missing names or descriptions;
- invalid `entrySchema`;
- entries without exactly one primary payload;
- non-positive or non-finite weights;
- missing required fields;
- malformed value or field payloads;
- structural differences between locales.

## 2.9 Tests

Use dedicated v2 fixtures to test:

- recursive directory discovery;
- all kinds and visibility values;
- stable ID lookup;
- public versus internal listing;
- text and structured entries;
- atomic field selection;
- duplicate IDs;
- malformed envelopes;
- localization parity;
- weighted boundaries;
- deterministic selection.

## 2.10 Completion Criteria

Part 2 is complete when:

- the v2 catalog and validator are fully tested;
- production commands still use the old catalog temporarily;
- the v2 catalog does not parse v1 files;
- no repository generator data has yet been converted;
- no templates, references, or modifiers are resolved yet.

Stop and wait for confirmation.

---

# Part 3 — Generator Data Conversion and Cutover

## 3.1 Objective

Convert all existing repository generator files to schema v2 and switch the bot completely to the v2 catalog.

At the end of this part, the old generator format and old catalog implementation are removed.

## 3.2 Conversion Scope

Convert every existing English and French generator file into the target directory tree.

For every generator:

- assign a stable generator `id`;
- assign a stable entry `id` to every entry;
- assign `kind`;
- assign `visibility`;
- define `entrySchema`;
- preserve existing weights;
- preserve existing localized output;
- preserve related fields within one entry;
- keep English and French entries aligned.

## 3.3 Category Placement

Initially classify existing generators conservatively:

- autonomous `/gen` choices belong in `categories/`;
- current creature lists intended for later `/gen-monster` belong in `components/` and use `visibility: "internal"` when they are ready to stop being public;
- no generator should be converted into a modifier or template merely because it may eventually be used that way;
- placement must reflect current intended behavior at cutover.

Any intentional change in public `/gen` categories must be reported for review.

## 3.4 Runtime Cutover

In the same approved part:

- update `/gen` to use the v2 catalog;
- update autocomplete to use stable IDs and localized names correctly;
- update `/gen-char` generator lookups;
- update required-file checks;
- update localization checks;
- update help and tests;
- update any direct generator imports;
- remove the old catalog;
- remove old API overloads;
- remove old-format fixture support.

No runtime code may continue accepting v1 generator files.

## 3.5 Behavioral Compatibility

Preserve, unless explicitly reviewed:

- existing public generator concepts;
- existing weights;
- existing character-generation source data;
- existing English and French display text;
- existing `/gen` command behavior;
- existing `/gen-char` behavior.

Stable IDs replace name-derived identifiers internally.

## 3.6 Tests

Test:

- every production generator loads;
- no v1 generator file remains;
- every English file has a valid French counterpart;
- all IDs are unique;
- all entry IDs align across locales;
- `/gen` autocomplete lists only intended public generators;
- weighted outputs remain correct;
- `/gen-char` still resolves all required sources;
- all required-file and architecture checks use the new layout.

## 3.7 Completion Criteria

Part 3 is complete when:

- all repository generator data is v2;
- every internal caller uses the v2 API;
- the old catalog and old format support are removed;
- `/gen` and `/gen-char` work;
- the complete test suite passes.

Stop and wait for confirmation.

---

# Part 4 — Structured Resolver and Templates

## 4.1 Objective

Add structured generator resolution and recursive templates without adding modifiers or creature persistence.

## 4.2 Template Entries

Example:

```json
{
  "id": "recover-item-before-rivals",
  "weight": 2,
  "template": "Recover {{item}} from {{site}} before {{rival}} reaches it.",
  "references": {
    "item": {
      "generator": "inventory",
      "select": "fields.Name"
    },
    "site": {
      "generator": "dungeon",
      "select": "display"
    },
    "rival": {
      "generator": "faction",
      "select": "fields.Name"
    }
  }
}
```

Reference marker names are technical and identical across locales.

## 4.3 Selectors

Support:

- `value`;
- `fields`;
- `fields.<FieldName>`;
- `display`.

`display` requests the primary representation appropriate to the selected entry shape.

## 4.4 Weighted Source Selection

A reference may choose between generators:

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

Source selection weight and entry selection weight are independent.

## 4.5 Resolver API

Replace direct generation with:

```js
generate(categoryId, locale, {
  random = Math.random,
  maxDepth = 8,
} = {})
```

The old `generate(id, locale, random)` form is not retained.

## 4.6 Structured Result

The resolver returns structured provenance:

```js
{
  category: {
    id: 'quest',
    name: 'Quests',
    locale: 'en',
  },
  entryId: 'recover-item-before-rivals',
  output: {
    type: 'template',
    text: 'Recover the sealed grimoire from the abandoned prison...',
    references: {
      item: {
        generatorId: 'inventory',
        entryId: 'sealed-grimoire',
      },
      site: {
        generatorId: 'dungeon',
        entryId: 'abandoned-prison',
      },
      rival: {
        generatorId: 'faction',
        entryId: 'black-banner-company',
      },
    },
    modifiers: [],
  },
}
```

Text and structured entries must also produce structured output instead of only returning a raw string.

## 4.7 Services

Introduce clear responsibility boundaries:

`generatorResolver`:

- orchestrates resolution;
- returns structured results.

`weightedSelector`:

- performs weighted selection;
- accepts injected randomness;
- knows nothing about Discord or persistence.

`referenceResolver`:

- resolves template references;
- selects weighted sources;
- applies selectors;
- tracks the reference stack;
- enforces maximum depth;
- retains source IDs.

`generatorResponses`:

- converts structured output into Discord responses.

## 4.8 Cycle Protection

The resolver must:

- track visited generator IDs in the current resolution chain;
- reject recursive cycles with a precise error;
- enforce `maxDepth`;
- not silently truncate invalid templates.

## 4.9 Localization Validation

Extend parity checks to require identical:

- template markers;
- reference names;
- generator IDs;
- selectors;
- weighted source definitions.

Only template text is translated.

## 4.10 Tests

Test:

- each selector;
- nested templates;
- `oneOf` selection;
- independent source and entry weights;
- cycle detection;
- maximum depth;
- missing references;
- unused references;
- invalid selectors;
- structured provenance;
- deterministic cross-locale conceptual results;
- Discord rendering separated from resolution.

## 4.11 Completion Criteria

Part 4 is complete when:

- templates resolve recursively;
- `/gen` can display resolved templates;
- structured output retains all selected IDs;
- no modifier selection exists yet;
- no creature model or save work has been included.

Stop and wait for confirmation.

---

# Part 5 — Generic Modifier Selection

## 5.1 Objective

Add generic modifier declaration and selection to the resolver.

This part selects and returns modifiers but does not interpret creature-specific mechanical effects.

## 5.2 Modifier Generator

Example:

```json
{
  "schemaVersion": 2,
  "id": "creature-modifier",
  "kind": "modifier",
  "visibility": "internal",
  "name": "Creature modifiers",
  "description": "Independent alterations applied to generated creatures",
  "appliesTo": [
    "animal",
    "monster",
    "companion"
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

`appliesTo` controls modifier compatibility.

It is not used by statistical profiles.

## 5.3 Modifier Request

```json
{
  "modifiers": [
    {
      "generator": "creature-modifier",
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

- `chance` is evaluated once for each request;
- `count.min` and `count.max` are inclusive;
- the selected count is random inside the range;
- the same modifier entry cannot be selected twice in one resolution;
- the modifier generator must include the source generator in `appliesTo`;
- selected modifiers remain distinct from the base result;
- selected modifiers are included in structured output.

## 5.4 Descriptive Output

At this stage a modifier may contain localized fields such as:

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

Mechanical properties may already be accepted and preserved as technical data for future use, but they are not applied to entities in Part 5.

The generic resolver must not know about `Creature`, statistics, RULEs, or save files.

## 5.5 Validation

Reject:

- invalid `appliesTo`;
- references to missing modifier generators;
- modifier generators targeting absent categories;
- invalid chances;
- invalid count ranges;
- counts greater than available unique entries;
- localized incompatibility;
- duplicate selections.

## 5.6 Tests

Test:

- chance boundaries;
- count boundaries;
- unique selection;
- weighted modifier selection;
- target compatibility;
- no selected modifiers when chance fails;
- selected modifiers retained separately;
- deterministic results;
- localization parity.

## 5.7 Completion Criteria

Part 5 is complete when:

- generic resolver results can contain selected modifiers;
- modifiers remain descriptive and structured;
- no statistic changes, traits, or RULEs are applied yet;
- no creature code depends on the resolver yet.

Stop and wait for confirmation.

---

# Part 6 — Shared `Combatant` Model

## 6.1 Objective

Extract common combat state and behavior from `Character` without introducing `Creature` yet.

Existing character save structure and behavior must remain compatible.

## 6.2 Model Hierarchy

Target hierarchy:

```text
Combatant
├── Character
└── Creature
```

Only `Combatant` and the refactored `Character` are implemented in this part.

## 6.3 `Combatant` Responsibilities

`Combatant` contains common state:

- immutable entity key;
- immutable concrete entity type;
- creator ID;
- level;
- seven base statistics;
- initiative;
- reflexes;
- resources:
  - HP;
  - AR;
  - AP;
  - MD;
- personality when present;
- RULEs;
- status effects;
- equipment;
- inventory;
- encumbrance.

It may provide common model-level behavior required by existing character operations.

It must not:

- depend on Discord;
- choose generator entries;
- render responses;
- write files;
- contain character-specific fields;
- contain creature-specific fields.

## 6.4 `Character` Responsibilities

`Character` extends `Combatant` with:

- first name;
- last name;
- race;
- racial description and lore;
- racial traits;
- appearance;
- backstory;
- goals;
- talents.

`Character.fromSave()` remains capable of hydrating existing character saves.

`displayName` remains appropriate to characters.

## 6.5 Shared Mechanics Extraction

Move or consolidate pure shared mechanics so they are not character-specific:

- statistic creation and validation;
- initiative and reflexes from Speed;
- maximum HP;
- maximum AP;
- maximum MD;
- resource creation;
- resource recalculation;
- encumbrance base maximum;
- common damage, healing, and turn behavior where already applicable.

## 6.6 Derived Mechanics

```text
initiative = speed
reflexes = speed
```

Maximum HP:

```text
constitution × 10 × (1 + 0.2 × (level - 1))
```

Maximum AP:

```text
level 1–3: 4
level 4–6: 5
level 7–9: 6
level 10: 8
```

Maximum MD:

```text
speed × 0.5
```

Existing project rounding and resource-adjustment policies remain authoritative.

## 6.7 Save Compatibility

Do not require existing character saves to contain a new discriminator merely to load successfully unless a controlled character save migration is explicitly approved.

The runtime model may expose `entityType: "character"` while serialization continues to preserve the established save schema.

No creature save schema is introduced in this part.

## 6.8 Tests

Test:

- existing character save hydration;
- unchanged character serialization;
- unchanged defaults;
- unchanged display names;
- shared mechanics;
- existing damage, healing, and turn behavior;
- character validation;
- all existing character commands.

## 6.9 Completion Criteria

Part 6 is complete when:

- `Character` inherits shared combat state;
- existing character behavior and saves remain compatible;
- no `Creature` model exists yet;
- no command or persistence generalization has been included.

Stop and wait for confirmation.

---

# Part 7 — Generic Entity Persistence Foundations

## 7.1 Objective

Generalize persistence foundations and introduce an entity application facade while supporting characters only.

This proves the abstraction before a second persistent model is added.

## 7.2 Persistence Foundations

Generalize character-specific infrastructure where appropriate:

- per-key operation queue;
- atomic JSON publication;
- history transactions;
- rollback behavior;
- permanent deletion transactions;
- common load-error reporting patterns.

Do not rewrite working atomic mechanisms without a concrete need. Extract or parameterize reusable behavior while preserving character behavior.

## 7.3 Application Facade

Add `entityApplicationService`.

Initially it resolves characters only, but its interface must support later delegation by concrete model.

Responsibilities:

1. resolve an entity key;
2. identify the concrete model;
3. delegate to the correct store;
4. invoke shared mechanics;
5. invoke concrete validation;
6. centralize common application operations.

Possible target:

```text
entityApplicationService
└── characterStore
```

Part 8 later adds `creatureStore`.

## 7.4 Key Semantics

Prepare for one global `EntityKey` domain.

In Part 7 only character keys exist, so behavior remains unchanged.

The queue must be entity-key based rather than permanently character-specific.

## 7.5 Operations

Route or expose entity-neutral service operations for:

- retrieval;
- creation;
- update;
- deletion;
- damage;
- healing;
- end turn;
- history;
- undo.

Commands are not switched in this part.

## 7.6 Tests

Test:

- existing character create/update/delete;
- atomic writes;
- history publication;
- rollback;
- undo;
- concurrent operations on one key;
- independent operations on different keys;
- facade delegation;
- unchanged character errors and permissions where service-owned.

## 7.7 Completion Criteria

Part 7 is complete when:

- character persistence works through reusable entity foundations;
- current commands still behave normally;
- no creature store exists;
- no command schema is changed.

Stop and wait for confirmation.

---

# Part 8 — `Creature` Model and Persistence

## 8.1 Objective

Add a complete persistent `Creature` model and store without random creature generation or `/gen-monster`.

A creature must be manageable through services and tests before generation is introduced.

## 8.2 `Creature` Model

`Creature` extends `Combatant` with:

- name;
- description;
- source creature category when generated;
- source entry ID when generated;
- statistical profile ID;
- natural armor percentage;
- creature traits;
- applied modifiers.

Persistent model types are exactly:

```text
character
creature
```

`animal`, `monster`, and `companion` are generator source categories, not model types.

`Creature` provides:

- hydration;
- validation;
- `displayName`;
- serialization through its save schema.

## 8.3 Creature Save Layout

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

Existing character paths do not change.

## 8.4 Complete Creature Save

A creature save stores final state rather than generation instructions.

It contains at least:

- schema version;
- entity type;
- entity key;
- creator ID;
- level;
- name;
- description;
- optional source category;
- optional source entry ID;
- optional statistical profile ID;
- final statistics;
- derived statistics or resources according to the established save model;
- current and maximum resources;
- natural armor percentage;
- traits;
- RULEs;
- status effects;
- applied modifiers;
- equipment;
- inventory;
- encumbrance.

Loading never reruns random generation.

Future changes to profiles or generator data do not alter an existing creature save.

## 8.5 Creature Store

Add:

- exclusive creature creation;
- creature retrieval;
- creature listing;
- creature update;
- creature deletion;
- creature history;
- creature undo;
- creature load-error handling.

Use the shared atomic and transaction foundations from Part 7.

## 8.6 Global Key Uniqueness

An `EntityKey` must be globally unique.

A character and creature cannot share the same key.

Creation must check both stores as one operation protected by the common key queue.

## 8.7 Atomicity and Concurrency

Preserve:

- exclusive creation;
- atomic save publication;
- atomic history publication;
- serialized mutations per key;
- rollback after failed writes;
- no partial visible state;
- correct concrete schema for history.

Undo must never change an entity from one concrete model to the other.

## 8.8 Blank Creature Creation

Provide a service-level way to create a valid blank creature for tests and later command use.

Do not add `/gen-monster`.

`/add type:creature` may remain deferred to Part 9 so command generalization is performed together.

## 8.9 Tests

Test:

- creature hydration and validation;
- creature defaults;
- save and reload;
- global key collision with a character;
- exclusive creation;
- update and history;
- rollback;
- undo;
- deletion;
- invalid concrete discriminator;
- wrong-schema history;
- loading without regeneration;
- profile changes not affecting saved creatures.

## 8.10 Completion Criteria

Part 8 is complete when:

- a complete creature can be managed through services;
- all persistence guarantees work;
- no random creature archetype is required;
- no existing command has yet been generalized.

Stop and wait for confirmation.

---

# Part 9 — Common Entity Commands

## 9.1 Objective

Generalize existing character management commands to operate on both `Character` and `Creature`.

Generation commands remain specialized.

## 9.2 Target Commands

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

`/gen-monster` remains unimplemented until Part 12.

## 9.3 `/add`

`type` defaults to `character`.

This option chooses the concrete persistent model only at creation.

The type is immutable afterward.

A blank creature created by `/add` must satisfy the creature schema and remain editable through common commands.

## 9.4 Field Catalog

The canonical editable/readable field catalog declares compatibility:

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

This command-field `appliesTo` is unrelated to statistical profiles.

After resolving the entity:

- autocomplete exposes compatible fields only;
- `/get` rejects incompatible fields;
- `/set` rejects incompatible fields.

## 9.5 Statistic Overrides

Creature statistics may be changed through `/set`.

A statistic update:

- validates the new value;
- recalculates dependent values;
- follows the existing current-resource adjustment policy;
- creates history;
- commits atomically.

The generation profile does not restrict later edits.

## 9.6 Shared Operations

The following operate through `Combatant` and the entity facade:

- damage;
- healing;
- armor restoration;
- end-turn reset;
- deletion;
- history;
- undo;
- common field reads and writes.

Avoid duplicate character and creature implementations inside every command.

## 9.7 Autocomplete

Autocomplete merges accessible keys from both stores.

Display names may differ, but the stable entity key remains the command value.

Load failures from one save must be reported without preventing valid entities from appearing where existing behavior supports graceful recovery.

## 9.8 Permissions

Preserve existing policy based on:

- entity creator;
- DM role;
- real server owner;
- any existing moderator-specific operation.

Changing `character` terminology to `entity` must not weaken authorization.

## 9.9 Tests

Test every common command with:

- a character;
- a creature;
- incompatible fields;
- key autocomplete;
- field autocomplete;
- creator authorization;
- DM authorization;
- server-owner authorization;
- unauthorized users;
- history and undo;
- statistic recalculation;
- immutable entity type.

## 9.10 Completion Criteria

Part 9 is complete when:

- common commands manage both entity types;
- command implementations delegate through the entity facade;
- `/gen-char` still works;
- `/gen-monster` is still absent.

Stop and wait for confirmation.

---

# Part 10 — Creature Archetypes and Fixed RULEs

## 10.1 Objective

Add structured creature source catalogs and generate complete unsaved base creatures without mechanical modifiers.

This part introduces creature-specific generation policy while reusing the shared profile allocator and shared mechanics.

## 10.2 Internal Creature Categories

Use internal structured generators:

- `animal`;
- `monster`;
- `companion`.

They are source categories for `/gen-monster`, not persistent model types.

Their final visibility is `internal`.

## 10.3 Narrative and Mechanical Separation

Example:

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
  }
}
```

`fields` contains localized narrative content.

`mechanics` contains technical data identical across locales.

## 10.4 Required Properties

A creature archetype requires:

- stable entry `id`;
- `fields.Name`;
- `fields.Description`;
- `mechanics.statProfile`.

## 10.5 Optional Properties

A creature archetype may define:

- `weight`, default `1`;
- `fields.Traits`, default empty;
- `mechanics.naturalArmorPercentage`, default `0`;
- `mechanics.fixedRules`, default empty;
- `mechanics.initialStatusEffect`, default chance `0`;
- modifier requests, selected generically but applied mechanically only in Part 11.

## 10.6 No Per-Creature Statistic Overrides

Creature entries do not define:

- fixed statistic blocks;
- minimum overrides;
- maximum overrides;
- allocation-weight overrides;
- HP multipliers;
- alternative budget formulas.

All base statistics come from the referenced shared profile.

Later manual correction uses `/set`.

## 10.7 Initial Profiles

Add and tune the minimum profiles needed by the initial archetypes, such as:

- `animal`;
- `companion`;
- `predator`;
- `brute`;
- `caster`;
- `boss`;
- `elemental`.

These names describe statistical distribution only.

A `caster` profile does not grant magic.

A `boss` profile does not grant extra budget and does not create an encounter rating.

All profiles use the normal level budget.

## 10.8 Creature Level

A generated creature has a level from `1` to `10`.

The generation service accepts an explicitly chosen level or a randomly chosen level. Command integration is deferred to Part 12.

## 10.9 Creature RULE Policy

Creature RULE assignment is explicit and independent from Intelligence.

A high-Intelligence creature receives no RULE automatically.

Character Intelligence thresholds are never evaluated during creature generation.

### Fixed RULEs

An archetype may always grant a specific RULE:

```json
{
  "fixedRules": [
    {
      "ruleId": "fire",
      "level": 1
    }
  ]
}
```

A fixed RULE:

- references a stable entry ID from the `rules` generator;
- uses localized name and description;
- has an explicit level;
- is always added;
- may exist with low Intelligence;
- is included in the final creature object and later save.

## 10.10 Base Generation Flow

```text
level
→ creature source category
→ creature archetype
→ statistical profile
→ weighted statistic allocation
→ base identity
→ base traits
→ fixed RULEs
→ shared derived statistics and resources
→ natural armor
→ optional initial status effect
→ final Creature validation
```

Modifier mechanical application is excluded until Part 11.

## 10.11 Shared Resources

Generate:

- initiative from Speed;
- reflexes from Speed;
- HP from Constitution and level;
- AP from level;
- MD from Speed;
- AR from natural armor percentage and maximum HP.

Generated creatures have empty equipment and inventory by default.

## 10.12 Creature Generation Service

Add a pure or mostly pure `creatureGenerationService` responsible for:

- selecting the source archetype;
- loading the statistical profile;
- generating base statistics;
- resolving base traits;
- resolving fixed RULEs;
- resolving optional initial status effects;
- calculating common resources;
- constructing and validating an unsaved `Creature`.

It does not write files and does not depend on Discord.

## 10.13 Validation

Reject:

- unsupported source categories;
- missing names or descriptions;
- missing profiles;
- invalid natural armor percentages;
- duplicate trait IDs;
- malformed fixed RULEs;
- duplicate fixed RULE IDs;
- unknown RULE IDs;
- invalid RULE levels;
- malformed initial status-effect configuration;
- localized mechanical differences.

## 10.14 Tests

Test:

- each source category;
- explicit and random levels;
- profile resolution;
- missing profiles;
- base traits;
- low-Intelligence creature with a fixed RULE;
- high-Intelligence creature with no fixed RULE;
- resource calculations;
- natural armor;
- initial status-effect chance;
- empty equipment and inventory;
- complete unsaved creature validation;
- deterministic generation.

## 10.15 Completion Criteria

Part 10 is complete when:

- a complete base creature can be generated in memory;
- fixed RULEs work independently from Intelligence;
- no mechanical modifier effect is applied yet;
- no creature is created through a Discord generation command.

Stop and wait for confirmation.

---

# Part 11 — Mechanical Creature Modifiers

## 11.1 Objective

Interpret the modifier data selected by the generic resolver and apply explicit mechanical effects to generated creatures.

Modifiers may:

- change statistics;
- add traits;
- explicitly add random RULEs.

## 11.2 Narrative and Mechanical Modifier Shape

Example:

```json
{
  "id": "gigantic",
  "weight": 1,
  "fields": {
    "Name": "Gigantic",
    "Description": "The creature is much larger and physically stronger.",
    "Traits": [
      {
        "id": "extended-reach",
        "Name": "Extended Reach",
        "Description": "The creature can threaten targets from farther away."
      },
      {
        "id": "large-body",
        "Name": "Large Body",
        "Description": "The creature has difficulty moving through confined spaces."
      }
    ]
  },
  "mechanics": {
    "statChanges": {
      "constitution": 2,
      "strength": 2,
      "dexterity": -1,
      "speed": -1
    }
  }
}
```

Narrative fields are localized.

Mechanical fields are identical across locales.

## 11.3 Statistic Changes

`mechanics.statChanges` contains integer deltas.

Rules:

- apply deltas after profile allocation;
- apply selected modifiers cumulatively;
- do not consume or refund profile budget;
- constrain final statistics to the normal domain `4` through `20`;
- calculate derived resources only after all statistic changes;
- preserve modifier records separately from final statistics.

## 11.4 Added Traits

Base archetype traits are added first.

Modifier traits are appended afterward.

Traits use:

```json
{
  "id": "extended-reach",
  "Name": "Extended Reach",
  "Description": "The creature can threaten targets from farther away."
}
```

Trait IDs are technical and identical across locales.

Names and descriptions are localized.

Traits are deduplicated by stable ID.

Validation should reject duplicate IDs inside one source definition. Runtime combination should avoid adding the same trait twice when separate valid sources produce it.

## 11.5 RULE Bearer

The RULE Bearer modifier explicitly adds a random RULE:

```json
{
  "id": "rule-bearer",
  "weight": 1,
  "fields": {
    "Name": "RULE Bearer",
    "Description": "The creature manifests an additional random RULE.",
    "Traits": [
      {
        "id": "rule-bearer",
        "Name": "RULE Bearer",
        "Description": "The creature possesses a magical mastery not normally associated with its species."
      }
    ]
  },
  "mechanics": {
    "addRandomRules": {
      "generator": "rules",
      "count": 1,
      "level": 1
    }
  }
}
```

The added RULE:

- is selected from the configured generator;
- is added after fixed RULEs;
- cannot duplicate an existing RULE;
- uses the configured level;
- is independent from Intelligence;
- is persisted later as part of the creature sheet.

No other modifier grants a RULE unless it explicitly declares `addRandomRules`.

## 11.6 Application Order

Final creature generation order:

```text
level
→ creature archetype
→ statistical profile
→ base statistic allocation
→ base identity and traits
→ fixed RULEs
→ generic modifier selection
→ modifier statistic changes
→ modifier traits
→ modifier random RULEs
→ derived statistics and resources
→ natural armor
→ initial status effects
→ final validation
```

## 11.7 Applied Modifier Records

A creature retains every selected modifier as a distinct record containing at least:

- modifier generator ID;
- modifier entry ID;
- localized name;
- localized description.

This allows saved data and Discord output to distinguish the base creature from its modifiers.

The final save may also store resolved added traits and RULEs as normal creature state.

## 11.8 Validation

Reject:

- unknown statistics in `statChanges`;
- non-integer deltas;
- duplicate modifier trait IDs;
- malformed random RULE configuration;
- invalid count;
- invalid RULE level;
- missing RULE generator;
- impossible unique RULE selection;
- localized mechanical differences.

## 11.9 Tests

Test:

- stat changes after base allocation;
- cumulative modifier deltas;
- legal final statistic bounds;
- post-modifier derived resources;
- base and modifier trait combination;
- trait deduplication;
- fixed RULE plus RULE Bearer;
- random RULE excluding fixed RULEs;
- random RULE level;
- high Intelligence still granting nothing automatically;
- applied modifier records;
- deterministic modifier effects.

## 11.10 Completion Criteria

Part 11 is complete when:

- generated in-memory creatures include mechanical modifier effects;
- RULE Bearer works;
- final resource values use modified statistics;
- creature generation still has no Discord command integration.

Stop and wait for confirmation.

---

# Part 12 — `/gen-monster` Integration

## 12.1 Objective

Expose the completed creature-generation pipeline through Discord and create the generated creature atomically.

## 12.2 Command

```text
/gen-monster creature-key:<new key> type:<monster|animal|companion> [level]
```

Parameters:

- `creature-key` is required;
- it must be globally unique;
- `type` is required;
- `type` selects an allowed internal source category;
- `level` is optional;
- supplied levels are integers from `1` to `10`;
- omitted levels are randomly selected from `1` to `10`.

The command name remains `/gen-monster` for animals and companions.

## 12.3 Authorization

Preserve the intended restriction to:

- DM role;
- real server owner;

according to existing project authorization conventions.

Generation authorization does not replace later creator/DM permissions on the saved entity.

## 12.4 Command Flow

```text
/gen-monster
  → creatureApplicationService.generateCreature(...)
      → reserve and validate global EntityKey
      → creatureGenerationService builds the complete Creature
      → validate final Creature
      → creatureStore publishes the save atomically
  → creatureCommandResponses renders the localized sheet
```

The command must remain thin.

It parses options, checks command-level permission, invokes the application service, and renders the response.

It must not directly:

- select generator entries;
- calculate statistics;
- apply modifiers;
- resolve RULEs;
- write files.

## 12.5 Atomic Generation

The key availability check and save publication must be protected by the shared per-key queue.

Failure during generation, validation, or publication must leave:

- no creature save;
- no partial history;
- no reserved key state;
- no collision with a concurrent character creation.

## 12.6 Generated Creature Contents

A successfully generated and saved creature contains:

- level;
- seven final statistics;
- initiative and reflexes;
- complete HP, AR, AP, and MD;
- source type;
- source entry ID;
- statistical profile ID;
- name and description;
- base traits;
- modifier traits;
- fixed RULEs;
- modifier-added RULEs;
- optional initial status effects;
- selected modifier records;
- empty equipment and inventory by default;
- creator and entity key.

It does not contain an encounter-power value.

## 12.7 Response Rendering

The localized response should clearly distinguish:

- creature identity;
- level;
- statistics;
- resources;
- traits;
- RULEs;
- modifiers;
- initial status effects when present.

Rendering must respect Discord limits and use response-layer formatting rather than model formatting.

## 12.8 Help and Autocomplete

Add:

- command registration;
- localized command name/description where project conventions require it;
- `type` autocomplete;
- optional level constraints;
- help text;
- expected help order:
  - `/gen`;
  - `/gen-char`;
  - `/gen-monster`.

## 12.9 Tests

Test:

- command registration;
- supported and unsupported types;
- explicit and omitted level;
- invalid levels;
- authorization;
- global key collision;
- concurrent generation attempts;
- atomic failure behavior;
- successful save;
- localized output;
- output limits;
- generated entity availability through common commands;
- complete undo after later mutation.

## 12.10 Completion Criteria

Part 12 is complete when:

- `/gen-monster` creates and saves complete creatures;
- common commands immediately manage generated creatures;
- all generation and persistence tests pass;
- the architecture is functionally complete.

Stop and wait for confirmation before content expansion.

---

# Part 13 — Content Expansion

## 13.1 Objective

Expand and balance content only after the architecture is stable.

This part should preferably be divided into multiple small data-focused tasks, each reviewed separately.

## 13.2 Statistical Profiles

Refine and balance profiles such as:

- `character-balanced`;
- `animal`;
- `companion`;
- `predator`;
- `brute`;
- `caster`;
- `boss`;
- `elemental`;
- any additional distribution justified by several archetypes.

Profiles remain reusable distributions, not entity classes.

Avoid creating one profile for every individual creature unless its statistical distribution is genuinely reusable or structurally distinct.

## 13.3 Creature Archetypes

Expand:

- animals;
- monsters;
- companions.

For each entry define only what the architecture supports:

- localized identity;
- localized traits;
- shared statistical profile;
- natural armor;
- fixed RULEs when intrinsic;
- initial status-effect configuration when justified;
- modifier requests.

Do not add per-entry fixed statistics or profile overrides.

## 13.4 Modifier Catalog

Expand descriptive and mechanical modifiers such as:

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
- Equipped, when equipment behavior is explicitly designed.

Each modifier must define concrete behavior rather than relying only on vague descriptive text.

## 13.5 Templates and References

Expand reusable composed generators such as:

- quests;
- locations;
- factions;
- encounters;
- other combinations that benefit from references.

Avoid creating templates that merely concatenate unrelated random values without producing a coherent result.

## 13.6 `JDR_RANDOM_OLD.md`

Reusable content from `documentation/JDR_RANDOM_OLD.md` is imported only after the architecture is complete.

This document does not define a detailed migration procedure.

Content import should be handled as later editorial/data tasks:

- select useful lists;
- adapt them to the v2 schema;
- assign stable IDs;
- preserve meaningful historical weights;
- rewrite entries when necessary for current rules and quality;
- provide English and French versions with structural parity;
- assign broad reusable profiles to creature entries;
- add fixed RULEs only when intrinsic;
- add modifier requests only when appropriate;
- validate and review each content group independently.

Do not mix a large old-content import with engine implementation.

## 13.7 Balancing

Balancing remains data work.

Review:

- profile minimums;
- profile maximums;
- profile weights;
- creature natural armor;
- fixed RULE levels;
- modifier statistic changes;
- modifier frequency;
- initial status-effect frequency.

Level remains the only general power indicator.

Do not add challenge rating, encounter power, hidden budget multipliers, or boss budgets without a new explicit design decision.

## 13.8 Completion Criteria

Part 13 has no single all-or-nothing completion point.

Each content batch must:

- pass all schema and localization validation;
- include deterministic data checks where relevant;
- be reviewed for rules consistency;
- be reviewed for English and French quality;
- avoid changing engine architecture unless separately approved.

---

# Final Responsibility Boundaries

## `generatorCatalog`

- discovers v2 localized generators;
- validates envelopes and entry schemas;
- resolves stable IDs;
- enforces English/French parity;
- exposes public and internal generators.

## `statProfileCatalog`

- loads one non-localized profile file;
- validates statistical distributions;
- resolves profile IDs.

## `weightedSelector`

- performs weighted selection;
- accepts injected randomness;
- knows nothing about Discord or persistence.

## `generatorResolver`

- resolves entries into structured output;
- coordinates references and modifiers;
- preserves provenance.

## `referenceResolver`

- resolves template references;
- supports selectors and weighted source choice;
- detects cycles;
- enforces depth.

## `modifierResolver`

- validates target compatibility;
- evaluates chance and count;
- selects unique modifier entries;
- returns structured modifier data;
- does not apply creature mechanics.

## `entityMechanics`

- calculates level statistic budgets;
- allocates profile statistics;
- derives initiative and reflexes;
- derives HP, AP, and MD;
- recalculates dependent values after mutations.

## `creatureGenerationService`

- selects creature archetypes;
- resolves statistical profiles;
- generates base statistics;
- assigns fixed creature RULEs;
- applies selected modifier mechanics;
- creates a complete unsaved `Creature`.

## `entityApplicationService`

- resolves global entity keys;
- delegates to concrete stores;
- coordinates common mutations;
- coordinates atomic creature generation and creation;
- invokes concrete validation.

## Concrete stores

`characterStore` and `creatureStore`:

- persist concrete models;
- validate concrete schemas;
- manage concrete history;
- reuse shared atomic and transaction foundations.

## Discord commands

Commands only:

- parse options;
- check command-level permissions;
- invoke application services;
- render localized responses.

---

# Final Data and Generation Flow

```text
Localized v2 generator entry
        ↓
Structured narrative fields + technical mechanics
        ↓
Shared non-localized statistical profile
        ↓
Shared level budget and weighted allocation
        ↓
Character-specific or creature-specific generation policy
        ↓
Explicit fixed creature RULEs
        ↓
Generic modifier selection
        ↓
Creature statistic changes, traits, and explicit random RULEs
        ↓
Shared derived statistics and resources
        ↓
Concrete Character or Creature validation
        ↓
Atomic complete save with history and undo
```

The final design has:

- one generator format;
- one statistical profile catalog;
- one statistic-allocation algorithm;
- explicit creature magic independent from Intelligence;
- mechanical creature modifiers;
- separate character and creature save schemas;
- shared combat and persistence foundations;
- no generator-format backward compatibility;
- no encounter-power system;
- incremental implementation with mandatory review between every part.
