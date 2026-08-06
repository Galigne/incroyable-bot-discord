# Generator schema v2

Production catalogs live under matching `en/` and `fr/` paths. Discovery is
recursive. The catalog loads both locale trees as one candidate and rejects a
missing file, duplicate ID, invalid relationship, or structural mismatch instead
of falling back to English.

## Common envelope and visibility

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
    "required": ["Name", "Description"]
  },
  "entries": []
}
```

- IDs are stable English kebab-case technical values.
- `kind` is `category`, `component`, `template`, or `modifier`.
- `visibility` is `public` or `internal`. Only public non-modifier roots appear in
  `/gen`, autocomplete, and centralized help. References may use internal data.
- `name`, `description`, templates, text values, and player-facing fields are
  localized.
- Entries have a stable `id`, an optional positive finite `weight` (default `1`),
  and exactly one payload declared by `entrySchema`.

Text entries use `{ "type": "text" }` and a `value`. Field entries declare 1 to
25 required fields and store them atomically:

```json
{
  "type": "fields",
  "required": ["Name", "Description", "Generator"],
  "technical": ["Generator"]
}
```

Technical fields hold routing, enum, numeric, or boolean values and must be
identical across locales. Equipment generator data never stores encumbrance;
character encumbrance remains manually managed.

## Templates and references

A template generator uses `kind: "template"` and
`entrySchema: { "type": "template" }`. Every named marker must have exactly one
reference definition, and every reference must be used by the localized template.
Marker names describe their sentence role and remain identical across locales.

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
      "generator": {
        "oneOf": [
          { "id": "dungeon", "weight": 3 },
          { "id": "building", "weight": 2 },
          { "id": "settlement", "weight": 1 }
        ]
      },
      "select": "display"
    },
    "rival": {
      "generator": "background",
      "entry": "criminal",
      "select": "fields.Name"
    }
  }
}
```

Omitting `entry` selects a weighted random entry. A fixed `entry` consumes no
entry-selection randomness and is allowed only with one concrete generator.
Supported selectors are:

- `value` for text entries;
- `fields` for a copy of the complete structured group;
- `fields.<technical field name>` for one structured value;
- `display` for the canonical human-readable form.

`display` returns a text value or resolved nested template directly. For field
entries it uses `Name`, then the first declared non-technical field, then the first
declared field. When a complete `fields` object is inserted into template prose,
its localized values are joined in declared order with an em dash.

Templates may reference templates. The runtime detects repeated active
generator/entry pairs as cycles and defaults to at most eight active selections
(callers may choose a validated bound up to 32). Failures use stable service error
codes.

## Descriptive modifiers

Modifier generators are always internal and declare compatible generator IDs:

```json
{
  "schemaVersion": 2,
  "id": "modifier",
  "kind": "modifier",
  "visibility": "internal",
  "name": "Descriptive modifiers",
  "description": "Descriptive variations shared by characters and creatures",
  "appliesTo": [
    "background",
    "creature-animal",
    "creature-companion",
    "creature-monster"
  ],
  "entrySchema": {
    "type": "fields",
    "required": ["Name", "Description"]
  },
  "entries": [
    {
      "id": "gigantic",
      "weight": 1,
      "fields": {
        "Name": "Gigantic",
        "Description": "The subject is extraordinarily large for their kind."
      }
    }
  ]
}
```

A non-modifier generator or entry may request them:

```json
{
  "modifiers": [
    {
      "generator": "modifier",
      "chance": 0.25,
      "count": { "min": 1, "max": 1 }
    }
  ]
}
```

Chance is evaluated once per request. The inclusive count is selected next, then
compatible entries are selected by weight without replacement. Each result is a
separate record containing stable generator/entry IDs, localized name and
description, and technical provenance. Modifier fields are display-only. The
schema rejects generic mechanics/effects payloads and fields for statistics,
resources, armor, RULEs, traits, status effects, gear, entity type, persistence,
or executable behavior.

## Creature archetype generation

The public `creature` generator is a routing catalog like `background`. Its stable
entries are `animal`, `companion`, and `monster`; each exposes localized `Name` and
`Description` fields plus a technical `Generator` value pointing respectively to
the internal `creature-animal`, `creature-companion`, or `creature-monster`
catalog. Those internal catalogs remain separately authored source collections for
one persistent `creature` type. Each detail entry has an explicit stable ID and
weight, localized `Name` and `Description` fields, and a `generation` object:

```json
{
  "id": "cinder-drake",
  "weight": 3,
  "fields": {
    "Name": "Cinder Drake",
    "Description": "A wingless dragon that spits burning resin."
  },
  "generation": {
    "statProfile": "creature-elemental",
    "naturalArmorPercentage": 15,
    "traits": [
      {
        "id": "cinder-drake-nature",
        "Name": "Predatory Nature",
        "Description": "It nests in chimneys and hunts around open flame."
      }
    ],
    "fixedRules": [{ "entry": "candle-rule", "level": 1 }],
    "statusEffects": [
      {
        "generator": "status-effect",
        "entry": "smoldering",
        "select": "fields"
      }
    ],
    "equipment": [],
    "inventory": []
  }
}
```

`statProfile` selects one non-localized distribution from `stat-profile.json`.
Profiles contain only minimums, maximums, and allocation weights; all creatures use
the shared level 1–10 budget, nonlinear statistic costs, derived statistics, and
resource formulas. Entries cannot define fixed statistics, per-entry profile
overrides, alternate budgets, challenge ratings, or resource formulas.

`traits` contains localized intrinsic records with stable IDs. `fixedRules`
contains explicit stable entries from `rules` plus their levels. Intelligence never
assigns a creature RULE. `statusEffects` selects complete localized `Name` and
`Description` fields from the shared public `status-effect` catalog and remains
descriptive. The internal `modifier` catalog is shared by background-based
character generation and creature detail generators. Generated characters and
creatures retain its records separately; modifier selection cannot change generated
mechanics.

`naturalArmorPercentage` and `armor` are mutually exclusive. `armor` is a normal
generator reference selecting complete fields from a source that declares `Name`,
`Description`, and the technical `AR percentage`; only that metadata or explicit
natural armor initializes AR. `equipment` and `inventory` are arrays of ordinary
fixed, random, nested, or weighted references. They never infer mechanics from
prose and never change manual encumbrance, which stays at the Creature model's
`0 / 0` default during generation.

English and French creature entries keep generation metadata, references, profile
IDs, trait IDs, RULE levels, weights, and ordering identical. Names, descriptions,
traits, resolved status records, and resolved gear display text are localized. The
generation workflow stores the complete final creature and technical provenance;
loading or displaying that save never resolves the source data again.

## Results, parity, and services

`services/generatorResolver.generate(id, locale, { random, maxDepth })` accepts
only public roots. It returns root generator ID/name, root entry ID, output type,
localized `value`, `fields`, or `templateOutput`, base/reference provenance, and
separate modifier records. Base provenance plus each modifier record's provenance
is the complete record of entry choices. Provenance contains technical IDs and
paths, never localized strings. Resolution never creates or saves an entity.

English and French must match in relative paths, schemas, generator and entry IDs,
kinds, visibility, entry order, weights, technical field values, markers,
references, selectors, weighted source order/weights, modifier compatibility,
requests, chances, and counts. Equivalent injected randomness therefore selects
the same conceptual IDs in both locales. Only player-facing prose changes, and
templates should be rewritten naturally for each language.

`services/generatorCatalog.js` owns discovery, validation, stable lookup, public
listing, cache replacement, and reload. `generatorResolver`, `referenceResolver`,
`modifierResolver`, and `weightedSelector` own resolution. Statistical profiles in
`stat-profile.json` remain non-localized and separate from modifier compatibility.

The previous generator format, display-name-derived IDs, locale fallback, API
overloads, and runtime format detection are not supported.
