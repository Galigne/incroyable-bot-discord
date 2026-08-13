# Generator architecture

This document is the authoritative description of current generator routing,
resolution, visibility, provenance, modifiers, and character/creature generation.
The JSON contract and catalog-editing rules are documented in
[`README.md`](README.md); command behavior is summarized in the root
[`README.md`](../../README.md); contributor constraints live in
[`AGENTS.md`](../../AGENTS.md).

## Catalog loading and visibility

`services/generatorCatalog.js` recursively loads the matching English and French
catalog trees. `services/generatorSchema.js` and its focused validators accept only
generator schema v3 and validate the complete locale pair, including stable IDs,
entry shapes, weights, technical fields, references, modifier relationships, and
creature metadata. Candidate generator and statistical-profile caches are prepared
together and replaced only after validation succeeds, including during `/reload`.

Visibility controls entry points, not resolvability:

- `public` generators are available as direct `/gen` roots and appear in command
  autocomplete and help;
- `internal` generators are hidden from those user-facing lists but remain
  available to application workflows, inline references, and modifier
  relationships.

Stable lowercase snake_case generator and entry IDs provide technical identity.
Localized names and content never determine routing or provenance. Generator
resolution returns data only; persistence belongs to the character and creature
application workflows.

## Resolution and provenance

`services/generatorResolver.js` resolves a public root for `/gen` or a reference
requested by application code. A reference can select a random weighted entry, a
fixed entry, an entry's display value, its complete fields object, or one explicit
field. Inline syntax is:

```text
{{ generator }}
{{ generator.field }}
{{ generator:entry }}
{{ generator:entry.field }}
```

`services/referenceResolver.js` performs source and entry selection. Each inline
occurrence is resolved independently, so repeated references can choose different
entries. Nested references share one active selection stack: repeated active
generator/entry pairs are rejected as cycles, and depth is capped at four. Fixed
entries do not consume entry-selection randomness. Structured display excludes
technical fields, while explicit field selection can read them.

Every resolved selection adds provenance with the stable generator ID, entry ID,
selection mode (`random` or `fixed`), and resolution path. Weighted generator-source
selection adds its own source record. Nested inline references contribute their
records to the parent result, so callers can retain the complete technical path
without deriving identity from localized text. Completed results contain the
localized value or structured fields, provenance, and a separate array of resolved
modifier results.

## Generator-level modifiers

A generator's optional `modifiers` map is an additive relationship between ordinary
v3 generators. Every configured source rolls independently. A successful roll
selects one weighted entry and resolves its inline references and own modifier
relationships through the same stack. The completed modifier result is appended to
the result's `modifiers` array; it never merges into the base payload.

This mechanism is descriptive only. It does not interpret technical-looking fields
or alter statistics, resources, armor, RULEs, traits, status, gear, entity type, or
persistence. Site generators use these relationships for their own configured
modifier sources.

Persistent entity generation uses separate internal pools:

- characters may receive one entry from `modifier_character`;
- creatures may receive one entry from `modifier_creature`.

`services/descriptiveModifierGenerator.js` applies an independent 25% policy to
each entity workflow and preserves the selected pool/entry IDs and reference
provenance with the localized name and description. Creature detail metadata may
also explicitly reference creature modifiers. Temporary conditions are resolved
from `status_effect` and stored separately from persistent modifiers.

## Shared statistical generation

`data/generators/stat-profile.json` is a separate, non-localized schema. Its
kebab-case profile IDs define minimums, maximums, and allocation weights for the
seven base statistics. Profiles do not contain localized prose, entity types,
resource formulas, RULE allocation, traits, gear, or encumbrance behavior.

Characters and creatures share the level 1-10 stat budget, nonlinear point costs,
derived-statistic calculations, and resource formulas. Their selected profiles
change only allocation constraints and weighting.

## Character generation

`services/randomCharacterGenerator.js` combines direct catalog selections with
reference resolution:

1. It selects localized name, race, personality, RULE, talent, status, armor,
   weapon, and inventory entries as required by character mechanics.
2. It selects a stable entry from the public `background` router, or uses the
   requested category.
3. That entry's technical `generator` field contains a wrapped inline reference to
   the matching internal `background_<category>` text generator. Resolving it
   supplies the reusable background archetype.
4. It independently resolves `{{ physical_description }}`. Physical description is
   not part of the selected archetype route, so the two rolls remain combinable.
5. It applies the character-only descriptive modifier policy through
   `modifier_character`, calculates statistics and resources, and assembles the
   complete character.

The saved background contains `archetype` and `physicalDescription`; editable
`backstory` and `goals` start empty. Generated equipment and inventory never alter
the manual encumbrance resource.

## Creature routing, generation, and persistence

The public `creature` generator is the creature-type router. Its entries are the
complete dynamic set accepted by `/gen-creature` and displayed by autocomplete.
When `type` is omitted, the workflow selects a weighted router entry; otherwise it
selects the requested stable entry. Each entry's technical `generator` field is one
wrapped reference to an internal creature-detail generator.

The current catalog routes `animal`, `companion`, and `monster` to their matching
`creature_*` generators, but application code does not treat that list as a closed
enum. Router entries are source classifications, not persistence types: every
generated result is saved as the concrete `creature` type.

`services/randomCreatureGenerator.js` resolves the route, then resolves one detail
entry and consumes its localized identity plus validated generation metadata. That
metadata chooses a statistical profile and may declare intrinsic traits, natural
armor or an armor reference, fixed RULE IDs and levels, status-effect references,
creature-modifier references, and equipment or inventory references. Gear
references can be fixed, random, nested, or drawn from a weighted source.

Creature Intelligence does not allocate RULEs; only explicit `fixedRules` metadata
does. Only natural-armor metadata or an explicit armor reference initializes AR.
Status effects and modifiers remain descriptive, and generation never derives
manual encumbrance.

The assembled creature stores its localized final state and stable source data:
the router entry, detail generator and entry, statistical profile, and accumulated
reference provenance. `services/creatureApplicationService.js` publishes that
complete save atomically inside the shared EntityKey queue. Loading or displaying a
saved creature never reruns localization, references, modifier selection, or
mechanical formulas.

## Other composed generators

Public text generators can compose ordinary concepts with inline references. For
example, `quest` entries may combine inventory and fixed or random background
selections. These resolutions keep nested provenance but do not create or persist
the referenced people, creatures, locations, or items.

## Validation coverage

Offline checks cover v3 envelopes, IDs, weights, strict locale parity, public and
internal visibility, inline and structured references, fixed and weighted
selection, nesting, cycles, depth bounds, provenance, modifiers, statistical
profiles, background routes, dynamic creature routes, character and creature
generation, persistence, and command integration.
