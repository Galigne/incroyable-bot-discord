# Generator schema v3 authoring guide

This is the authoritative reference for writing generator JSON. See
[`GENERATOR_ARCHITECTURE.md`](GENERATOR_ARCHITECTURE.md) for routing, resolution,
provenance, and character/creature generation. Contributor constraints live in the
root [`AGENTS.md`](../../AGENTS.md).

Production catalogs are discovered recursively beneath matching `en/` and `fr/`
directories. Both locale trees are validated as one candidate. A missing file,
duplicate ID, invalid relationship, or structural mismatch rejects the candidate;
there is no locale fallback.

Category roots keep their unprefixed filename and ID. Their child filenames use
`<category>_<concept>.json`, while each child generator ID is only `<concept>`.
For example, `loot_weapons.json` has ID `weapons`, and references use
`{{ weapons }}` rather than the filename. The current category families are
`background`, `creature`, `loot`, `site`, `group`, and `modifier`.

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
- `name`: localized display text beginning with a capital letter;
- `description`: localized display text;
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
  "required": ["name", "description", "rarity", "ar_percentage"]
}
```

Each entry must contain exactly those fields. Field names use lowercase
snake_case. Every field is ordinary generated data, is included in normal display,
and can be selected explicitly. String fields are localized; fields may also be
finite numbers or booleans.

Entry properties are strict. In addition to `id`, optional `weight`, and exactly
one payload (`value` or `fields`), an entry may define `generator` as a direct
stable child-generator ID. Creature-detail entries may define the separately
validated `generation` object. These reserved properties are functional metadata,
are never displayed as generated fields, and arbitrary extra metadata is rejected.

English and French counterparts must preserve the same relative path, generator
ID, visibility, entry schema, modifier map, entry IDs, entry order, weights,
structural `generator` routes, functional `generation` metadata, non-string field
values, and inline-reference structure. Localize string payload fields and other
player-facing text.

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
entry, that display value joins every field in declared order. An explicit field
selects that one public generated field.

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
separately from the base result; fields that look mechanical remain
descriptive data and never execute behavior.

`/gen` has no command-level modifier option. The public `modifier` router exposes
the useful internal character, creature, and site modifier pools through ordinary
`.generator` traversal. Generating a modifier this way does not apply it to another
result.

## Structural traversal

The top-level entry property `generator` is structural routing metadata and must be
a direct stable generator ID:

```json
{
  "id": "criminal",
  "fields": {
    "name": "Criminal",
    "description": "Outlaws, thieves, smugglers..."
  },
  "generator": "criminal"
}
```

Do not wrap structural routes in `{{ ... }}`. Inline references remain valid only
inside actual generated text and fields; they compose content, while `generator`
defines an explicit route.

`/gen category:` accepts a traversal path. `:entry` fixes the current generator's
entry, `.field` returns one field, and `.generator` follows the selected entry's
route. A missing entry is selected with normal weights, and routing may repeat:

```text
background:criminal.description
site:dungeon.generator
site:dungeon.generator:buried_temple.name
loot:shields.generator:wooden_shield.ar_percentage
```

The complete traversal is validated before random selection. When `.generator`
follows an unfixed entry, every later fixed entry, field, or repeated route must be
compatible with every possible routed child at that point. Ending at the unresolved
`.generator` remains valid when every possible selected entry has a structural
route; normal weighted route selection and child generation then continue.

Only the root is required to be public. The routed children in these families are
internal and cannot be submitted as direct roots. A bare router generates only its selected entry's visible fields;
it never follows the route automatically. A path ending on a generator performs
ordinary generation and applies that final generator's automatic modifiers. A path
ending on a field returns only that field and does not roll the final generator's
automatic modifiers. Autocomplete follows the current path context, while valid
manually submitted paths are not limited to its first 25 suggestions.

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

- Every public `background` entry has a top-level `generator` route containing the
  direct ID of the corresponding internal `<category>` text generator,
  stored in `background_<category>.json`. Character generation resolves that
  archetype and independently resolves the internal `physical_description`
  generator.
- The public `creature` router defines every supported `/gen-creature` type. Each
  entry's top-level `generator` property directly names an internal
  creature-detail generator whose concept ID matches the route and whose filename
  is `creature_<concept>.json`. Adding or removing router entries changes the
  available types; they are not a hard-coded enum or additional persistence types.
- Creature-detail entries use localized `name` and `description` fields plus the
  validated `generation` metadata described by the schema checks. Statistical
  profile IDs come from the separate non-localized `stat-profile.json` schema and
  remain kebab-case.
- The public `loot`, `site`, `group`, and `modifier` structured routers contain
  localized visible fields plus direct top-level routes to internal children. Bare
  router generation displays only the route entry; explicit `.generator` traversal
  resolves the child and retains both selections in provenance. Loot
  children may use different schemas: `material` is text, while equipment and the
  other item tables are structured.

`inventory` is an entity storage field, not a generator ID. Random carried items
come through the `loot` router. The internal `shields` table exposes ordinary
`rarity` and `ar_percentage` fields, and the public `affliction` table exposes an
ordinary localized `type` distinguishing persistent diseases from curses.

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
