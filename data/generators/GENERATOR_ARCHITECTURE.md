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
generator schema v4 and validate the complete locale pair, including stable IDs,
entry shapes, weights, structural routes, references, modifier relationships, and
creature metadata. During `/reload`, `reloadGenerationData()` prepares generator and
statistical-profile candidates together, validates creature/profile relationships,
and replaces both active caches only after validation succeeds. Normal process
startup instead initializes the generator catalog and statistical profiles through
their existing loading behavior; it does not run that joint reload workflow.

Visibility controls entry points, not resolvability:

- `public` generators are available as initial `/gen` roots and appear in command
  autocomplete and help;
- `internal` generators are hidden from those user-facing lists but remain
  available to application workflows, inline references, structural traversal,
  and modifier relationships.

Stable lowercase snake_case generator and entry IDs provide durable identity.
Localized generator names begin with a capital letter, while names and content
never determine routing or provenance. Generator
resolution returns data only; persistence belongs to the character and creature
application workflows.

Category roots use unprefixed filenames and IDs. Child files are prefixed for
organization, but child IDs remain concept-only: for example,
`background_criminal.json` has ID `criminal`, `creature_monster.json` has ID
`monster`, and `loot_weapons.json` has ID `weapons`. References always use IDs,
never filenames.

## Resolution and provenance

`services/generatorResolver.js` resolves a public traversal root for `/gen` or a
reference requested by application code. A reference can select a random weighted entry, a
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
entries do not consume entry-selection randomness. Every top-level name and
additional field is ordinary displayable generated data.

Every resolved selection adds provenance with the stable generator ID, entry ID,
selection mode (`random` or `fixed`), and resolution path. Weighted generator-source
selection adds its own source record. Nested inline references contribute their
records to the parent result, so callers can retain the complete stable path
without deriving identity from localized text. Completed results contain the
localized name-only value or resolved field group, provenance, and a separate array
of resolved modifier results.

## Structural routes and `/gen` traversal

An entry's optional top-level `generator` property is a direct stable generator ID.
It is reserved routing metadata, never part of `fields`, and never appears as raw
output. It is distinct from inline `{{ ... }}` references: structural routes move
the traversal to another generator, while inline references compose generated
content inside strings.

The `/gen category:` path grammar uses `:entry` to fix an entry and `.field` to
select one field. `.generator` follows the selected entry's structural route and
may be followed by another entry, route, or field. Missing entries use normal
weighted selection. Autocomplete derives roots, entries, fields, and routes from
the current path context, but manual valid paths remain accepted independently of
the 25-choice suggestion limit.

Traversal validity is resolved across all possible contexts before any random
selection. If `.generator` follows an unfixed entry and the path continues, the
next fixed entry, field, or route must be supported by every possible routed child;
the same rule applies after each repeated unresolved route. A path may end at an
unresolved `.generator` when every possible selected entry has a route, after which
normal weighted route and child generation proceed.

Only the initial generator must be public. Every child reached through the
`background`, `creature`, `loot`, `site`, `group`, or `modifier` routers is
internal, so a child such as `dungeon` is invalid as a direct root but reachable
through `site:dungeon.generator`. Bare router generation displays only the selected
router entry and does not follow its route.

When traversal ends on a generator, the resolver performs ordinary generation from
that final generator and applies its automatic modifier relationships. When it ends
on a field, the resolver returns only that field and suppresses the final
generator's automatic modifiers. Route and final selections share cycle, depth,
localization, weighting, and provenance behavior.

## Generator-level modifiers

A generator's optional `modifiers` map is an additive relationship between ordinary
v4 generators. Every configured source rolls independently. A successful roll
selects one weighted entry and resolves its inline references and own modifier
relationships through the same stack. The completed modifier result is appended to
the result's `modifiers` array; it never merges into the base payload.

This mechanism is descriptive only. It does not interpret mechanical-looking fields
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

Users access the same useful pools through the public `modifier` router and normal
`.generator` traversal. This produces a standalone modifier result; `/gen` has no
special option that applies or forces it on another result.

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
   main equipment, and carried loot as required by character mechanics.
2. It selects a stable entry from the public `background` router, or uses the
   requested category.
3. That entry's top-level `generator` property directly names the matching internal
   name-only `<category>` generator stored in
   `background_<category>.json`. Resolving it supplies the reusable background
   archetype.
4. It independently resolves `{{ physical_description.description }}`. Physical description is
   not part of the selected archetype route, so the two rolls remain combinable.
5. It applies the character-only descriptive modifier policy through
   `modifier_character`, calculates statistics and resources, and assembles the
   complete character.

The saved background contains `archetype` and `physicalDescription`; editable
`backstory` and `goals` start empty. A generated character receives one compatible
armor and one or two independent main-equipment slots. Each slot selects `weapons`
with an 80% chance or `shields` with a 20% chance; multiple equipped shields are
allowed, and their `ar_percentage` values add to the armor percentage before the
normal max-HP-based AR calculation.

Three carried items resolve independently through the public `loot` router's
structural routes. The workflow consumes the child display string so varying loot
field schemas are compatible, and it uses stable child provenance to avoid exact
duplicates with bounded retries. Carried armor, weapons, or shields are not
equipped and do not affect AR. Generated equipment and inventory never alter the
manual encumbrance resource.

## Creature routing, generation, and persistence

The public `creature` generator is the creature-type router. Its entries are the
complete dynamic set accepted by `/gen-creature` and displayed by autocomplete.
When `type` is omitted, the workflow selects a weighted router entry; otherwise it
selects the requested stable entry. Each entry's top-level `generator` property
directly names an internal creature-detail generator.

The current catalog routes `animal`, `companion`, and `monster` to internal
generators with those same concept IDs, stored in the corresponding `creature_*`
files. Application code does not treat that list as a closed enum. Router entries
are source classifications, not persistence types: every generated result is saved
as the concrete `creature` type.

`services/randomCreatureGenerator.js` resolves the route, then resolves one detail
entry and consumes its localized identity plus validated generation metadata. That
metadata chooses a statistical profile and may declare intrinsic traits, natural
armor or an armor reference, fixed RULE IDs and levels, status-effect references,
creature-modifier references, and equipment or inventory references. Gear
references can be fixed, random, nested, or drawn from a weighted source.

Intrinsic traits are zero or more ordinary inline-template strings. Literal text
passes through unchanged; fixed, random, nested, and surrounding-text references
use the same resolver and relationship rules as every other generator string. The
public `traits` generator supplies top-level names and additional localized
capability descriptions, but creature details may also define specific literal
traits. Generation resolves
each template and stores only its localized final string, so persisted traits match
the character-talent representation and never retain template expressions or
embedded generator records. Trait selections do not add trait-specific records to
the saved source provenance.

Creature Intelligence does not allocate RULEs; only explicit `fixedRules` metadata
does. Only natural-armor metadata or an explicit armor reference initializes AR.
Status effects and modifiers remain descriptive, and generation never derives
manual encumbrance. Trait rules text is likewise non-executable and never alters
statistics, resources, armor, status, RULEs, or gear.

The assembled creature stores its localized final state and stable source data:
the router entry, detail generator and entry, statistical profile, and accumulated
reference provenance. `services/creatureApplicationService.js` publishes that
complete save atomically inside the shared EntityKey queue. Loading or displaying a
saved creature never reruns localization, references, modifier selection, or
mechanical formulas.

## Other composed generators

Public generators can compose ordinary concepts with inline references. The
`loot`, `site`, and `group` roots are name-only routers over internal children;
application workflows or explicit `.generator` paths follow those routes.
`quest`, `rumor`, and `secret` entries combine these and other fixed or random
concepts. These resolutions keep nested provenance but do not create or
persist the referenced people, creatures, locations, or items.

## Validation coverage

Offline checks cover v4 envelopes, mandatory entry names, normalized name
uniqueness, IDs, weights, strict locale parity, public and
internal visibility, inline and structural routes, traversal autocomplete, fixed
and weighted selection, field targeting, nesting, cycles, depth bounds,
provenance, modifiers, statistical profiles, background routes, dynamic creature routes, character and creature
generation, persistence, and command integration.
