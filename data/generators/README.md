# Generator schema v3 authoring guide

This is the authoritative reference for writing generator JSON. See
[`GENERATOR_ARCHITECTURE.md`](GENERATOR_ARCHITECTURE.md) for routing, resolution,
provenance, and character/creature generation. Contributor constraints live in the
root [`AGENTS.md`](../../AGENTS.md).

Production catalogs are discovered recursively beneath matching `en/` and `fr/`
directories. Both locale trees are validated as one candidate. A missing file,
duplicate ID, invalid relationship, or structural mismatch rejects the candidate;
there is no locale fallback.

## Content guidelines

Generators provide reusable inspiration rather than complete stories. Prefer
concise concepts, archetypes, and evocative details that leave motives,
relationships, consequences, and other meaningful choices to the GM. Keep
independent concepts separate when random combinations make them more reusable.

## Generator document

Every file uses generator schema v3:

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
  "entries": [
    {
      "id": "human",
      "fields": {
        "name": "Human",
        "description": "Adaptable people from many cultures."
      }
    }
  ]
}
```

The required envelope properties are:

- `schemaVersion`: exactly `3`;
- `id`: a stable lowercase snake_case generator ID;
- `visibility`: `public` or `internal`;
- `name` and `description`: localized display text;
- `entrySchema`: the single payload shape shared by every entry;
- `entries`: a non-empty array of entries.

The optional `modifiers` object declares automatic modifier relationships. No
other envelope properties are accepted, and there is no generator-kind field.

Public generators are direct `/gen` roots and appear in `/gen` autocomplete and
help. Internal generators can still be resolved by application workflows, inline
references, and modifier relationships, but users cannot select them directly as
`/gen` categories.

## Entries

Every entry has a stable lowercase snake_case `id` and may have a positive finite
`weight`; omitted weights default to `1`.

A text generator declares:

```json
"entrySchema": { "type": "text" }
```

Each entry then contains one localized `value`:

```json
{
  "id": "short_hook",
  "value": "Investigate {{ dungeon }} before {{ faction }} arrives."
}
```

A structured generator declares between one and 25 required fields:

```json
"entrySchema": {
  "type": "fields",
  "required": ["name", "description", "generator"],
  "technical": ["generator"]
}
```

Each entry must contain exactly those fields. Field names use lowercase
snake_case. Player-facing fields are localized strings. Technical fields may also
be numbers or booleans; they are omitted from implicit display but can be selected
explicitly by a reference.

English and French counterparts must preserve the same relative path, generator
ID, visibility, entry schema, modifier map, entry IDs, entry order, weights,
technical values, and inline-reference structure. Localize only display text and
other player-facing values.

## Inline references

References are embedded directly in text or string fields:

```text
{{ generator }}
{{ generator.field }}
{{ generator:entry }}
{{ generator:entry.field }}
```

Generator, entry, and field names are stable lowercase snake_case IDs. Omitting the
entry performs weighted random selection; naming an entry fixes the selection.
Omitting the field returns the selected entry's display value. For a structured
entry, that display value joins its non-technical fields in declared order. An
explicit field may select either a display or technical field.

References may be repeated and nested, and every occurrence resolves
independently. All referenced generators, entries, and fields must exist in both
locales with compatible structure. Active cycles and nesting beyond four
selections are rejected. There is no template entry type or named reference map.

## Automatic modifier relationships

A consuming generator may map ordinary generator IDs to independent application
percentages:

```json
"modifiers": {
  "site_modifier_all": 5,
  "site_modifier_building": 5
}
```

Each percentage is numeric and between `0` and `100`. When a relationship applies,
one weighted entry from that source is resolved normally. The modifier is returned
separately from the base result; fields that look technical or mechanical remain
descriptive data and never execute behavior.

Modifier sources use the same v3 document and entry formats as every other
generator. Relationships must name existing sources, match across locales, and be
free of recursive cycles. The character and creature workflows use separate
internal `{ name, description }` pools: `modifier_character` and
`modifier_creature`. Their independent 25% application policy belongs to
application code, not to a consuming generator's `modifiers` map. Temporary
conditions come from `status_effect` and are not modifiers.

## Application-owned routing catalogs

Some stable IDs and fields have application-level meaning and must stay aligned
with their consumers:

- Every public `background` entry has a technical `generator` field containing one
  wrapped reference to the corresponding internal `background_<category>` text
  generator. Character generation resolves that archetype and independently
  resolves the internal `physical_description` generator.
- The public `creature` router defines every supported `/gen-creature` type. Each
  entry's technical `generator` field contains one wrapped reference to an internal
  creature-detail generator. Adding or removing router entries changes the
  available types; they are not a hard-coded enum or additional persistence types.
- Creature-detail entries use localized `name` and `description` fields plus the
  validated `generation` metadata described by the schema checks. Statistical
  profile IDs come from the separate non-localized `stat-profile.json` schema and
  remain kebab-case.

Creature metadata relationships for profiles, traits, fixed RULEs, status effects,
modifiers, armor, equipment, and inventory are validated with the catalog. They do
not define alternate entity types, formulas, or automatic encumbrance.

Creature-detail `generation.traits` is an array of zero to 25 non-empty template
strings. Each item may be literal text, a complete inline reference, or ordinary
text containing one or more inline references. The same syntax and catalog
relationship validation described above applies; there is no trait-specific
reference format. For example:

```json
"traits": [
  "Huge — +1 to Strength actions involving pushing or lifting.",
  "{{ traits:keen_smell }}",
  "Inherited capability: {{ traits }}"
]
```

The public structured `traits` generator exposes reusable localized `{ name,
description }` entries. Omitting the field in `{{ traits }}` or
`{{ traits:keen_smell }}` produces the normal display string, with the name and
rules description joined by an em dash. Creature generation resolves every
configured template once and persists only the resulting strings. Trait rules text
is descriptive and never applies automatic statistics, resources, effects, armor,
or other mechanics. Trait templates and their selection metadata are not copied
into creature saves.
