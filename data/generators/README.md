# Generator schema v4 authoring guide

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

Every file uses generator schema v4:

```json
{
  "schemaVersion": 4,
  "id": "race",
  "visibility": "public",
  "name": "Races",
  "description": "Ancestries and cultures",
  "entrySchema": {
    "required": ["description"]
  },
  "entries": [
    {
      "id": "human",
      "name": "Human",
      "fields": {
        "description": "Adaptable people from many cultures."
      }
    }
  ]
}
```

The required envelope properties are:

- `schemaVersion`: exactly `4`;
- `id`: a stable lowercase snake_case generator ID;
- `visibility`: `public` or `internal`;
- `name`: localized display text beginning with a capital letter;
- `description`: localized display text;
- `entrySchema`: the ordered additional-field contract shared by every entry;
- `entries`: a non-empty array of entries.

The optional `modifiers` object declares automatic modifier relationships. No
other envelope properties are accepted, and there is no generator-kind field.

Public generators are direct `/gen` roots and appear in `/gen` autocomplete and
help. Internal generators can still be resolved by application workflows, inline
references, and modifier relationships, but users cannot select them directly as
`/gen` categories.

## Entries

Every entry has a stable lowercase snake_case `id`, a mandatory localized `name`,
and may have a positive finite `weight`; omitted weights default to `1`. Entry
names must be concise, meaningful summaries of their concepts, suitable for
traversal and autocomplete; never derive them by blindly truncating descriptions at
punctuation. They must be unambiguous within their generator after ignoring case,
accents/diacritics, repeated whitespace, and separating punctuation. Public
generator names follow the same rule within each locale.

`/gen` derives the user-facing path alias for every generator and entry exclusively
from that localized `name`. It lowercases the name, replaces spaces and separating
punctuation with `_`, collapses repeated separators, and retains localized letters
and accents: `Épée longue` becomes `épée_longue`. There is no fallback to an entry
ID, old `value` content, a field, a description, or resolved text. Within the same
input scope, a localized alias must not collide with another candidate's stable ID
under the same case-, accent-, whitespace-, and punctuation-insensitive
normalization. Such a collision rejects the catalog.

Every generator declares `entrySchema.required` as an array of zero to 24
additional fields shared by all of its entries. Discord embeds support at most 25
displayed fields, and the mandatory top-level `name` always occupies one of them.
A name-only generator uses an empty array:

```json
"entrySchema": { "required": [] }
```

Its generated content lives directly in `name`, with no `fields` object:

```json
{
  "id": "short_hook",
  "name": "Investigate the abandoned shrine"
}
```

A generator with additional generated values declares them in order:

```json
"entrySchema": {
  "required": ["description", "rarity", "ar_percentage"]
}
```

Each entry then contains exactly those additional values in `fields`. `name` stays
top-level: it is never listed in `entrySchema.required` or duplicated inside
`fields`. Field names use lowercase snake_case. The name and every additional field
are ordinary generated data, are included in normal display, and can be selected
explicitly. String content is localized; additional fields may also be finite
numbers or booleans.

Entry properties are strict. A content entry has `id`, optional `weight`, exactly
one top-level localized `name`, and exactly one matching `fields` object when it
declares additional fields. Content entries never contain a structural `generator`
route. Routed background-archetype and creature-detail content entries may define
validated `generation` objects. These reserved properties are functional
metadata, are never displayed as generated fields, and arbitrary extra metadata is
rejected. The old
`entrySchema.type`, entry `value`, and `fields.name` forms are invalid.

English and French counterparts must preserve the same relative path, generator
ID, visibility, entry schema, modifier map, entry IDs, entry order, weights,
structural `generator` routes, functional `generation` property presence and
non-localized values, non-string field
values, and inline-reference structure. Top-level entry names and ordinary string
fields are localized.

## Inline references

References are embedded directly in localized names or string fields:

```text
{{ generator }}
{{ generator.field }}
{{ generator:entry }}
{{ generator:entry.field }}
```

Generator, entry, and field names are stable lowercase snake_case IDs. Omitting the
entry performs weighted random selection; naming an entry fixes the selection.
Omitting the field returns the selected entry's display value. A name-only entry
displays its name. An entry with additional fields displays its name followed by
every field in declared order. `.name` always selects the top-level name; another
explicit field selects one field declared by `entrySchema.required`.

References may be repeated and nested, and every occurrence resolves
independently. All referenced generators, entries, and fields must exist in both
locales with compatible structure. Active cycles and nesting beyond four
selections are rejected. There is no template entry type or named reference map.

## Automatic modifier relationships

A consuming generator may map ordinary generator IDs to independent application
percentages:

```json
"modifiers": {
  "modifier_site_all": 5,
  "modifier_site_building": 5
}
```

Each percentage is numeric and between `0` and `100`. When a relationship applies,
one weighted entry from that source is resolved normally. The modifier is returned
separately from the base result; fields that look mechanical remain
descriptive data and never execute behavior.

`/gen` has no command-level modifier option. Fixed entries in the public `modifier`
router expose the useful internal character, creature, and site modifier pools.
Generating a modifier this way does not apply it to another result.

## Structural traversal

Routers are detected from their entries rather than a `type` or `kind` property. If
any entry contains the top-level structural `generator` property, every entry must
contain it and the generator is a router. A router has an empty
`entrySchema.required` array, and each entry contains only `id`, localized `name`,
optional `weight`, and a direct stable child-generator ID:

```json
{
  "id": "criminal",
  "name": "Criminal",
  "generator": "criminal"
}
```

Router entries never contain `fields`, and a content generator never contains a
structural route. Mixed generators in which only some entries route are invalid.
Do not wrap structural routes in `{{ ... }}`. Inline references remain valid only
inside actual generated text and fields; they compose content, while `generator`
defines routing.

`/gen category:` accepts a traversal path whose generator and entry segments use
localized name aliases. Stable IDs remain accepted as manual input and are resolved
to the same internal identities. A bare router selects and displays one category.
`.generator` selects an unresolved category with normal weights and follows its
route, while `:category` fixes a router category and follows that route
automatically. Consecutive `:entry` selections cross fixed router boundaries, and
`.field` selects a field from the effective generated content. The `.generator`
token and field keys such as `.name`, `.description`, and `.ar_percentage` remain
stable English syntax:

```text
loot
loot.generator
loot:weapons
loot:weapons:long_sword
loot:weapons.description
site:dungeon
site:dungeon:buried_temple.name
```

The French catalog expresses the same kind of path as
`butin:armes:épée_longue.description`. Autocomplete always
presents localized paths, filters against only the segment currently being entered,
and matches case- and accent-insensitively. It searches every valid contextual
candidate before returning Discord's best 25 exact, prefix, then substring matches.

`.generator` remains meaningful for unresolved random routing, including repeated
unresolved router boundaries. Bare router `.name` also remains valid manual syntax,
but autocomplete omits it when the bare name-only router already produces the same
category name.

The complete traversal is validated before random selection. When `.generator`
follows an unfixed entry, every later fixed entry, field, or repeated route must be
compatible with every possible routed child at that point. Ending at the unresolved
`.generator` remains valid when every possible selected entry has a structural
route; normal weighted route selection and child generation then continue.

Only the root is required to be public. The routed children in these families are
internal and cannot be submitted as direct roots. A bare router generates only its
selected category and does not follow its route. A fixed router entry follows its
route automatically. A path ending on a generator performs
ordinary generation and applies that final generator's automatic modifiers. A path
ending on a field returns only that field and does not roll the final generator's
automatic modifiers. Autocomplete follows the current path context, while valid
manually submitted paths are not limited to its first 25 suggestions.

Modifier sources use the same v4 document and entry formats as every other
generator. Relationships must name existing sources, match across locales, and be
free of recursive cycles. The character and creature workflows use separate
internal top-level-name plus `description` pools: `modifier_character` and
`modifier_creature`. Their independent 25% application policy belongs to
application code, not to a consuming generator's `modifiers` map. Temporary
conditions come from `status_effect` and are not modifiers.

## Application-owned routing catalogs

Some stable IDs and fields have application-level meaning and must stay aligned
with their consumers:

- Every public `background` entry is a minimal router entry whose top-level
  `generator` route contains the direct ID of the corresponding internal name-only `<category>` generator,
  stored in `background_<category>.json`. Character generation resolves that
  archetype and independently resolves the internal `physical_description`
  generator.
- The public `creature` router defines every supported `/gen-creature` type. Each
  entry's top-level `generator` property directly names an internal
  creature-detail generator whose concept ID matches the route and whose filename
  is `creature_<concept>.json`. Adding or removing router entries changes the
  available types; they are not a hard-coded enum or additional persistence types.
- Creature-detail entries use a localized top-level `name`, an additional
  `description` field, and may use the same optional `generation` override model as
  background archetypes. Statistical
  profile IDs come from the separate non-localized `stat-profile.json` schema and
  remain kebab-case.
- The public `loot`, `site`, `group`, and `modifier` name-only routers contain
  localized top-level names plus direct top-level routes to internal children. Bare
  router generation displays only the route entry; a fixed entry implicitly
  resolves the child and retains both selections in provenance. Loot
  children declare only the additional fields each concept needs: materials use a
  description, while equipment may also expose technical fields such as rarity or
  armor percentage.

`inventory` is an entity storage field, not a generator ID. Random carried items
come through the `loot` router. The internal `shields` table exposes ordinary
`rarity` and `ar_percentage` fields, and the public `affliction` table exposes an
ordinary localized `type` distinguishing persistent diseases from curses.

### Character and creature generation overrides

The complete `generation` object is optional for both background archetypes and
creature-detail entries. When it is present, every property inside it is optional.
Property presence is significant: omission keeps that entity type's normal
generation behavior, while an explicitly present value replaces the complete
normal category. An explicit empty array therefore suppresses normal generation for
that category. Do not keep empty arrays, zero `naturalArmorPercentage`, redundant
`statProfile: "default"`, or an empty `generation` object in production data.

Both entity types support these properties:

- `statProfile`: a kebab-case ID from `stat-profile.json`; omission selects
  `default`;
- `naturalArmorPercentage`: a finite percentage from `0` to `100`;
- `fixedRules`: up to 25 unique `{ "entry": "rule_id", "level": 1 }` records;
- `statusEffects` and `modifiers`: up to 25 references selecting complete `fields`;
- `armor`: one reference selecting complete `fields`, kept separate from
  `equipment`;
- `equipment` and `inventory`: up to 25 ordinary generator references each.

The only concept-specific property is the localized template-string collection:
background archetypes support `talents`, creature details support `traits`, and the
opposite property is invalid. Both collections contain up to 25 non-empty strings.
Each item may be literal text, a complete inline reference, or ordinary text
containing one or more inline references. The same syntax and catalog relationship
validation described above applies; there is no talent- or trait-specific reference
format. For example:

```json
"traits": [
  "Huge — +1 to Strength actions involving pushing or lifting.",
  "{{ traits:keen_smell }}",
  "Inherited capability: {{ traits }}"
]
```

The public `talents` and `traits` generators expose reusable localized entries with
a top-level name and additional description. Omitting the field in an inline
reference produces the normal display string, with the name and description joined
by an em dash. Generation resolves every configured template once into the entity's
talent or trait string collection. This descriptive text never applies automatic
statistics, resources, effects, armor, or other mechanics.

For characters, omitting `talents`, `fixedRules`, `statusEffects`, `modifiers`,
`armor`, `equipment`, or `inventory` preserves the existing random character
workflow for that category. Omitted natural armor contributes `0%`. For creatures,
omitted traits, RULEs, status effects, armor, equipment, and inventory keep their
normal empty behavior, omitted modifiers keep the independent creature-modifier
policy, and omitted natural armor contributes `0%`.

Natural armor, the separate armor reference, and every resolved equipped item with
a numeric `ar_percentage` all stack before AR is calculated from maximum HP.
Inventory references never contribute AR. `naturalArmorPercentage` is generation
metadata only: characters never persist it, and creature saves persist only the
resulting final AR. Generation metadata relationships and functional EN/FR parity
are validated for both concepts.
