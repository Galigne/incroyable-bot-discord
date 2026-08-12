# Generator and Creature Architecture

## Status and authority

This document describes the production generator and creature architecture. The
historical source remains unchanged in `documentation/JDR_RANDOM_OLD.md`; its
one-time migration audit is retained in Git history.

The English and French rulebooks remain the authority for game rules and
terminology. They are not implementation synchronization files.

## Final decisions

- Generator schema v3 is the only supported generator format.
- Every generator uses one unified schema; generator kind is not a field.
- English and French catalogs have strict structural parity and no locale fallback.
- Stable lowercase snake_case IDs, not display text, own technical identity and provenance.
- Component values use inline references; there are no template entries or named reference maps.
- Complete humanoids are created only by `/gen-char`.
- The saved entity type for animals, companions, and monsters is `creature`.
- Descriptive modifiers and status effects never execute mechanics.
- Creature RULEs come only from explicit entry metadata.
- Encumbrance is always a manually edited saved resource.

## Catalogs and resolution

Production catalogs are discovered recursively under matching
`data/generators/en/` and `data/generators/fr/` paths. Every file declares
`schemaVersion: 3`, a stable generator ID, visibility,
localized `name` and `description`, an entry schema, and stable weighted entries.

Text and structured-field entries are the only generator payloads. Field keys are
lowercase snake_case. Technical fields are identical across locales and omitted
from implicit display, while explicit field references can access them.

Inline references use these forms:

```text
{{ generator }}
{{ generator.field }}
{{ generator:entry }}
{{ generator:entry.field }}
```

References may be nested, repeated, fixed, or weighted. Each occurrence selects
independently. Fixed entries do not consume entry-selection randomness. The
resolver validates source, entry, field, and locale parity, records stable
provenance, detects active cycles, and caps active selection depth at four.
Public generators appear in `/gen`, autocomplete, and help. Internal generators
remain available to application workflows, inline references, and modifier maps.

Resolved output preserves localized values, structured fields when selected,
reference provenance, and separate complete modifier results. Resolution never
creates or saves an entity. The resolver accepts injected randomness for
deterministic tests.

## Descriptive modifiers and status effects

Modifier sources are ordinary generators. A consuming generator may declare a
`modifiers` object mapping source IDs to independent percentages from 0 through
100. A successful source selects one weighted entry, resolves it normally,
including inline references and its own modifier map, and attaches the complete
result in a separate modifier array. Modifier output never merges into the base
result or changes game mechanics. Technical-looking fields remain inert output.

The shared `modifier` generator remains available to background-based character
generation and all three creature detail components. Application code applies the
descriptive modifier policy independently at 25%; it is not declared in those
generator maps. Site modifier generators remain ordinary internal catalogs, and
site consumers retain their former independent 20% probabilities in their maps.
The public `status_effect` component contains structured localized `name` and
`description` fields shared by both persistent entity types.

## Shared statistical profiles

`data/generators/stat-profile.json` contains non-localized reusable statistical
profiles. Profile IDs and their schema are independent of generator schema v3 and
remain kebab-case. Profiles contain only minimums, maximums, and allocation weights
for the seven base statistics. They contain no localized prose, resource formulas,
entity type, RULE allocation, traits, gear, or encumbrance behavior.

Character and creature generation use the same level 1-10 budget, nonlinear
statistic costs, derived statistics, and resource formulas. Profiles alter only
allocation constraints and weighting.

## Character generation

The public `background` component remains the broad category selector. Each stable
category entry routes through its ordinary technical `generator` field to an
internal text generator with the same broad ID, such as `{{ artisan }}`. These
internal generators contain only reusable occupation, role, or social-archetype
text entries. Character generation independently resolves one entry from the
internal `physical_description` text generator. The saved background contains
`archetype` and `physicalDescription`; `backstory` and `goals` start empty and
remain editable character fields.

`/gen-char` creates a complete character, including name, race, background,
personality, statistics, derived resources, explicit character RULE allocation,
talents, descriptive statuses and modifiers, gear, and manual encumbrance.
Generated armor, weapons, inventory, and gold never alter encumbrance.

## Creature generation and persistence

The public `creature` component routes stable entries as follows:

- `animal` to `creature_animal`;
- `companion` to `creature_companion`;
- `monster` to `creature_monster`.

These are source classifications, not saved entity types. `/gen-monster` accepts a
creature type, level, and new CreatureKey, generates the complete entity, and saves
it atomically as type `creature`.

Every detail entry supplies localized identity and explicit generation metadata:
one shared statistical profile, intrinsic localized traits, optional natural armor
or armor reference, explicit fixed RULE IDs and levels, optional descriptive status
references, and optional equipment or inventory references. Entries cannot define
fixed statistics, alternate budgets, challenge ratings, resource formulas, or
automatic encumbrance. Loading and displaying a saved creature never reruns
generation.

## Humanoid and quest routing

The former complete-person `npc` root and the former structured `criminal` root
are retired; `criminal` is now reused as a simple internal archetype generator.
Person concepts are routed through reusable broad-background archetype components.
The public `quest` component is a
normal text component whose values contain inline references, for example:

```text
Recover {{ inventory }} before someone with the {{ background:criminal }} background arrives.
```

Generic roles select a random `background` entry; specific roles use a fixed entry.
Quest resolution records provenance but never creates or saves referenced people or
creatures.

## Reload and validation

Startup and `/reload` validate complete English/French schema v3 candidates and the
statistical-profile candidate before replacing active caches. A failure leaves the
previous validated caches active. Offline validation covers envelopes, IDs, weights,
strict locale parity, inline references, fixed and weighted resolution, nested
selection, cycles, depth bounds, provenance, modifiers, profiles, character and
creature generation, persistence, and command workflows.

The previous category/template format, display-name-derived IDs, locale fallback,
API overloads, and runtime format detection are not supported.
