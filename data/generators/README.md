# Generator schema v3

See `GENERATOR_ARCHITECTURE.md` for the production design. This file is the
catalog-authoring reference.

Production catalogs live under matching `en/` and `fr/` paths. Discovery is
recursive. The loader validates both locale trees as one candidate and rejects a
missing file, duplicate ID, invalid relationship, or structural mismatch instead
of falling back to English.

## Content philosophy

Generators are tools for GM inspiration, not automatic story writers. Prefer
reusable concepts, archetypes, and evocative details that still allow a different
interpretation when the same entry is generated again. Leave meaningful creative
decisions to the GM and avoid unnecessary fixed history, motives, relationships,
or consequences.

## Common envelope

Every file uses schema version 3 and a lowercase snake_case technical ID:

```json
{
  "schemaVersion": 3,
  "id": "race",
  "visibility": "public",
  "name": "Races",
  "description": "Ancestries and cultures",
  "entrySchema": {
    "type": "fields",
    "required": ["name", "description"]
  },
  "entries": [],
  "modifiers": {
    "site_modifier_all": 25
  }
}
```

There is no generator kind. Visibility is `public` or `internal`; only public
generators appear as direct `/gen` roots, while internal generators remain
available to workflows, inline references, and modifier relationships.
Generator IDs, entry IDs, and field keys use lowercase snake_case. Names,
descriptions, values, and other player-facing text are localized.

Each entry has a stable ID, an optional positive finite `weight` (default `1`),
and exactly one payload declared by `entrySchema`. Text components use `value`:

```json
{
  "id": "short_hook",
  "value": "Investigate {{ dungeon }} before {{ faction }} arrives."
}
```

Field components declare one to 25 required snake_case fields and may mark
technical fields. Technical values are identical across locales and are hidden
from implicit display, but remain available through explicit field references.

```json
{
  "entrySchema": {
    "type": "fields",
    "required": ["name", "description", "generator"],
    "technical": ["generator"]
  }
}
```

Weights, entry order, technical values, generator IDs, entry IDs, field keys, and
relative paths must remain identical across English and French catalogs.

## Inline references

References are written directly in text or field values. The supported forms are:

```text
{{ generator }}
{{ generator.field }}
{{ generator:entry }}
{{ generator:entry.field }}
```

The source and optional entry are stable snake_case IDs. A missing entry selects a
weighted random entry; a fixed entry consumes no entry-selection randomness. A
missing field returns the canonical display value. For structured entries, that
display joins all non-technical fields in declared order. An explicit field can
read a technical value or any other declared field.

Every occurrence is resolved independently, including repeated, nested, fixed,
and weighted references. Resolved results retain stable source and entry
provenance. The resolver detects active selection cycles and caps active selection
depth at four.

Inline references must name an existing generator, entry, and field. The loader
validates their grammar and locale parity before activation. There is no template
entry type, named reference map, or compatibility parser.

## Automatic modifier relationships

Every generator uses the same schema. A generator that adds optional output to its
result declares the source IDs and independent percentages on its own envelope:

```json
{
  "schemaVersion": 3,
  "id": "modifier_creature",
  "visibility": "internal",
  "name": "Descriptive modifiers",
  "description": "Persistent descriptive variations for generated creatures",
  "entrySchema": {
    "type": "fields",
    "required": ["name", "description"]
  },
  "entries": [
    {
      "id": "gigantic",
      "fields": {
        "name": "Gigantic",
        "description": "The subject is extraordinarily large for their kind."
      }
    }
  ]
}
```

The consuming generator owns the relationship:

```json
{
  "id": "building",
  "visibility": "public",
  "name": "Buildings",
  "description": "Built locations",
  "entrySchema": { "type": "text" },
  "entries": [],
  "modifiers": {
    "site_modifier_all": 20,
    "site_modifier_building": 20
  }
}
```

The map values are numeric percentages from 0 through 100. Each source is rolled
independently; a successful source selects one weighted entry and resolves it
through the normal reference and modifier machinery. Modifier results remain in a
separate result array and never merge into or mutate the base result. Modifier
sources are ordinary generators: technical and mechanical-looking fields are only
output when displayed or explicitly selected, and never execute game behavior.
Modifier maps are validated for known IDs, valid percentages, locale parity, and
recursive relationships before startup or `/reload` replaces the catalog.

Character generation selects only from `modifier_character`, while creature
generation selects only from `modifier_creature`. Both pools use the same
localized `{name, description}` entry shape and the existing independent 25%
application policy. Temporary status conditions are separate: they come only
from `status_effect` and are stored independently from persistent modifiers.

## Creature and character routing

The public `background` and `creature` components route to internal components by
putting an inline reference in a technical `generator` field:

```json
"fields": {
  "name": "animal",
  "description": "Friendly wildlife",
  "generator": "{{ creature_animal }}"
}
```

The technical field is an ordinary field value, not a special raw generator ID.
Character and creature workflows explicitly resolve it, then consume the returned
fields and provenance. Background routes resolve to simple localized text
archetypes from the matching `background_<category>` generator; character
generation also independently resolves the internal `physical_description` text
generator. The persistent creature type remains `creature`; `animal`,
`companion`, and `monster` are generator archetypes only.

Creature detail entries use localized `name` and `description` fields plus
validated `generation` metadata. `statProfile` IDs belong to the separate,
non-localized statistical-profile schema and remain kebab-case. Creature traits
use `id`, `name`, and `description`; fixed RULEs, equipment, inventory, status
references, armor metadata, and profile relationships are validated separately.
Generation metadata never derives or changes manual encumbrance.

## Results and services

`services/generatorResolver.js` accepts public roots for `/gen` and can resolve
internal generators for application workflows or modifier relationships. Results
preserve localized values, structured fields when selected, stable provenance, and
separate complete modifier results. Resolution never creates or saves an entity.
Statistical profiles in
`stat-profile.json` remain non-localized and separate from generator IDs.

The previous category/template format, display-name-derived IDs, locale fallback,
API overloads, and runtime format detection are not supported.
