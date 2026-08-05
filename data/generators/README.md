# Generator schema v2

Production generator catalogs are stored by locale under `en/` and `fr/`.
English and French must contain the same relative `.json` paths. The catalog
loads and validates both locales as one data set; a missing or incompatible
counterpart rejects the catalog instead of falling back to English.

The current flat directory layout is intentional. Discovery is recursive, so
later architecture parts may group files without changing the catalog API.

## Generator envelope

Every generator uses schema version 2:

```json
{
  "schemaVersion": 2,
  "id": "race",
  "kind": "category",
  "visibility": "public",
  "name": "Races",
  "description": "Ancestries and cultures",
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

- `schemaVersion` is always `2`.
- `id` is a stable English kebab-case technical ID and is not derived at
  runtime from a filename or display name.
- `kind` is currently `category` or `component`.
- `visibility` is `public` or `internal`.
- `name`, `description`, and player-facing entry content are localized.
- `entrySchema` declares one uniform entry payload for the generator.

Public generators are exposed by `/gen`, its autocomplete, and its centralized
help. Internal components remain available to application workflows but cannot
be generated directly through `/gen`. The routed `background-*` detail
generators are internal; the broad `background` generator remains public.

## Entries

Every entry is an object with a stable technical `id` and an optional positive
finite `weight`. An omitted weight defaults to `1`.

Text entries use an entry schema of `{ "type": "text" }`:

```json
{
  "id": "forest-at-dusk",
  "weight": 3,
  "value": "A forest path disappears as night falls."
}
```

Structured entries declare all required technical field names. Their fields
are selected atomically:

```json
{
  "id": "human",
  "weight": 5,
  "fields": {
    "Name": "Human",
    "Description": "Adaptable communities with fast-changing traditions.",
    "Skill Bonus": "+1 to History",
    "Physical Ability": "Relentless Endurance"
  }
}
```

When a structured field stores a routing value or enum rather than localized
prose, list it in `entrySchema.technical`:

```json
{
  "type": "fields",
  "required": ["Name", "Description", "Generator"],
  "technical": ["Generator"]
}
```

Technical field values must be identical in English and French. All generator
and entry IDs, kinds, visibility values, schemas, entry order, payload shapes,
and weights must also match. Only localized display text may differ.

Generator equipment data never stores numeric encumbrance. Character
encumbrance is a manually managed saved resource and generation leaves it
unchanged.

## Statistical profiles

`stat-profile.json` contains non-localized statistical profiles. Each profile
defines a minimum, maximum, and allocation weight for all seven base
statistics. Profiles contain no localized text, formulas, RULE assignment,
traits, gear, entity type, or encumbrance behavior.

`character-balanced` preserves the existing character distribution with
minimum `4`, maximum `20`, and weight `1` for every base statistic.

## Runtime services

`services/generatorCatalog.js` provides:

- `getGenerator(id, locale)` for public or internal workflow access;
- `listGenerators(locale, { visibility })`, defaulting to public generators;
- `generate(id, locale, random)` for public `/gen` selection;
- `clearGeneratorCache()` and `reloadGeneratorCatalog()`.

`services/statProfileCatalog.js` provides profile lookup, listing, validation,
cache clearing, and reload. `/reload` validates and replaces both catalogs.
Weighted selection is shared through `services/weightedSelector.js` and accepts
an injected random function for deterministic tests.

The previous generator format, display-name-derived IDs, locale fallback, API
overloads, and runtime format detection are not supported.
