# Generator and Creature Architecture — Implementation Record

> Implementation status: Parts 1 through 5 are complete. Part 5 is audited by
> `documentation/JDR_RANDOM_OLD_MIGRATION_MANIFEST.json`; the sections below remain
> the approval-gated implementation record.

# 1. Generator v2 and current-data cutover

```text
Read and follow AGENTS.md before making changes.

Implement Part 1 of the generator and creature roadmap. Treat this prompt as the authoritative replacement for the conflicting generator-v2, statistical-profile, and current-data-cutover sections of documentation/GENERATOR_ARCHITECTURE_SPECIFICATION_PHASED.md. Update that document and the generator-format documentation to match the completed design.

Inspect the current repository before editing, especially the current generator catalogs, `/gen`, `/gen-char`, character schema v2, character generation mechanics, autocomplete, localization, reload behavior, and generator validation.

Implement generator schema v2 and convert all current production generator data in the same part. Switch `/gen` and `/gen-char` to v2, then remove the previous generator format, parser, compatibility API, fixtures, and runtime format detection. There must be no production period in which both formats are supported.

Generator v2 must provide:

- stable English technical IDs for generators;
- stable English technical IDs for every entry, including text entries;
- positive finite entry weights, defaulting to `1`;
- text and structured entries;
- atomic selection of all fields belonging to one structured entry;
- `public` and `internal` visibility;
- strict English/French structural parity;
- localized generator names, descriptions, and entry content;
- technical field names, IDs, routing values, enum values, weights, and schemas that are identical across locales.

A representative generator should be equivalent to:

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
  "entries": [
    {
      "id": "human",
      "weight": 5,
      "fields": {
        "Name": "Human",
        "Description": "...",
        "Skill Bonus": "...",
        "Physical Ability": "..."
      }
    }
  ]
}

The exact physical file layout is not prescribed. The catalog must discover and validate the complete data set, pair English and French generators by stable technical identity, and reject a missing or structurally incompatible locale counterpart rather than silently treating an incomplete French catalog as valid.

Visibility behavior:

- public generators are available through `/gen`, autocomplete, and `/help command:gen`;
- internal generators are available to generation workflows and future references but are not directly exposed through `/gen`;
- preserve current public generator concepts;
- classify clearly routed implementation data, such as background-specific detail catalogs used only by `/gen-char`, as internal;
- do not hide a currently user-facing standalone category without a clear reason grounded in the current data and command behavior.

Add non-localized statistical profiles shared by character generation now and creature generation later. A profile has a stable ID and defines, for each of the seven base statistics, a minimum, maximum, and allocation weight. It contains no localized text, resource formulas, RULE assignment, traits, gear, entity type, executable expression, or encumbrance behavior.

Provide a default character profile equivalent to the current balanced character generation. Preserve the existing statistic mechanics:

- statistics are Constitution, Strength, Dexterity, Intelligence, Speed, Perception, and Charisma;
- normal bounds remain `4` through `20`;
- the level budget remains `67 + 2 × (level - 1)`, with one additional point at levels 2, 5, and 8;
- values through 14 cost 1 point, 15–16 cost 2, 17–18 cost 3, and 19–20 cost 4;
- allocation starts from profile minimums, respects maximums, and uses profile weights when selecting among legal increments;
- zero-weight statistics are not increased;
- minimums are never reduced to fit the nominal budget;
- an otherwise valid profile may leave an unusable remainder when no legal increment can consume it;
- random selection must remain injectable for deterministic validation.

Integrate `/gen-char` with the profile system and generator v2 while preserving its current generation behavior:

- random level from 1 to 10 when omitted;
- optional broad background selection, otherwise random background selection;
- generated first and last name;
- race name, physical description, racial skill bonus, and physical ability;
- background appearance, backstory, and goals;
- two unique personality traits;
- level-based statistics and derived initiative/reflexes;
- Intelligence-based character RULE points and current RULE-level allocation;
- the current level-based number of unique talents;
- a descriptive status effect with the current 25% chance;
- armor compatible with Constitution and AR derived through the existing armor/resource mechanics;
- one or two weapons;
- three inventory items and the current level-based gold roll;
- current HP, AP, MD, and other resource behavior;
- atomic character creation and the existing localized response.

Populate the current character-save schema v2. Keep its existing metadata and level, and use the current grouped properties:

- `name` with `firstName` and `lastName`;
- `race` with `name`, `physicalDescription`, `lore`, and `traits`;
- `background` with `appearance`, `backstory`, and `goals`;
- `personality` with `traits` and `description`;
- `statistics`;
- `status` with resources and `effects`;
- `rules`;
- `talents`;
- `gear` with `equipment`, `inventory`, and `encumbrance`.

Do not reintroduce the pre-v2 character property layout. Preserve the current character schema-version handling, migrations, save compatibility, history compatibility, command behavior, rendering, and authorization.

Remove every automatic encumbrance rule:

- generator entries do not require or acquire an `Encumbrance` field;
- generated armor, weapons, inventory, and gold do not contribute to encumbrance;
- `/gen-char` must not derive either encumbrance value from Constitution or generated gear;
- generation must leave `gear.encumbrance` untouched, which means a new character remains at its existing default of `0:0`;
- do not alter explicitly saved encumbrance values during hydration or unrelated operations.

Keep the curated player-facing `/get` and `/set` field orders independent from generator field order, generator discovery order, character save-property order, and object insertion order. Do not reorder their choices or grouped modals merely to mirror schema v2.

Update the relevant validation, localization, autocomplete, help, reload, and documentation behavior. Add focused coverage for the final v2 schema, stable IDs, weighted deterministic selection, visibility, English/French parity, statistical profiles, the complete production-data cutover, and unchanged character-v2 generation.

Do not implement references, templates, provenance, modifiers, creatures, `/gen-monster`, or historical `JDR_RANDOM_OLD.md` migration in this part.
```

# 2. Structured generators, references, templates, and modifiers

```text
Read and follow AGENTS.md before making changes.

Implement Part 2 of the generator and creature roadmap after Part 1 is complete. Treat this prompt as the authoritative replacement for the conflicting structured-resolver, template, reference, provenance, and modifier sections of documentation/GENERATOR_ARCHITECTURE_SPECIFICATION_PHASED.md. Keep the documentation synchronized with the completed behavior.

Finish the reusable generator system before introducing any creature model or creature command.

Extend generator v2 with structured generation results. A completed generation result must retain enough information to render the localized output and identify how it was produced, including:

- root generator ID and localized generator name;
- root entry ID;
- output type;
- resolved localized value, structured fields, or template output;
- provenance for every random or fixed entry selected while resolving the result;
- descriptive modifiers as separate records.

Do not persist this provenance into character schema v2 unless an existing character field already requires it.

Add random references, fixed references, nested templates, and weighted source selection.

A random reference should be expressible equivalently to:

{
  "generator": "background",
  "select": "fields.Name"
}

A fixed reference adds a stable entry ID:

{
  "generator": "background",
  "entry": "criminal",
  "select": "fields.Name"
}

A fixed reference must not consume randomness for entry selection. It must resolve localized content from the requested locale while recording the same technical generator and entry IDs in provenance.

Support selectors equivalent to:

- `value`;
- `fields`;
- `fields.<technical field name>`;
- `display`, meaning the canonical human-readable representation of the selected entry.

Add templates whose localized text contains named markers and whose references define how those markers are resolved. For example:

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
      "generator": "dungeon",
      "select": "fields.Name"
    },
    "rival": {
      "generator": "background",
      "entry": "criminal",
      "select": "fields.Name"
    }
  }
}

Reference names should describe their role in the sentence rather than merely repeat a generator ID. Templates may reference other templates. Resolution must detect cycles, enforce a reasonable bounded nesting depth, and report stable expected errors without exposing implementation details.

Support weighted selection between source generators, equivalent to:

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

A fixed entry is valid only when resolution identifies one concrete source generator. Do not invent a cross-generator fixed-entry convention.

Provenance must form a complete record of the resolved choices, including nested references and weighted source selections. It must use stable technical IDs, not localized names or rendered strings. Equivalent deterministic random input must select the same conceptual generator and entry IDs in English and French.

Integrate structured results with `/gen`:

- simple text and structured-field categories must preserve their current presentation;
- templates must render their fully resolved localized result;
- public/internal visibility from Part 1 still applies;
- references may access internal generators;
- generating a reference never automatically creates or saves a character or creature;
- autocomplete and help continue to expose only public root generators.

Add descriptive modifiers to the reusable generator system. Modifier generators may define localized names and descriptions, technical compatibility targets, weights, and selection configuration. A generator or template may request modifiers with behavior equivalent to:

{
  "modifiers": [
    {
      "generator": "modifier",
      "chance": 0.25,
      "count": {
        "min": 1,
        "max": 1
      }
    }
  ]
}

Modifier behavior:

- evaluate the configured chance once per request;
- select an inclusive random count within the configured bounds;
- select entries by weight without selecting the same modifier entry twice for one request;
- enforce technical compatibility;
- return each selected modifier as a separate structured record with generator ID, entry ID, localized name, localized description, and provenance;
- leave the base result unchanged except for attaching the modifier records.

Modifiers are strictly descriptive. They never change statistics, derived statistics, resources, armor, RULEs, traits, status effects, gear, entity type, saved behavior, or any other mechanic. Names such as `RULE Bearer`, `Equipped`, `Gigantic`, `Undead`, or `Enraged` remain narrative guidance only. The modifier schema must not contain a generic mechanical-effects payload or unused fields anticipating a future mechanical modifier system.

Keep English/French parity strict for:

- template and reference structures;
- marker names;
- generator and entry IDs;
- selectors;
- source weights;
- modifier compatibility;
- modifier chance and count;
- entry order and weights.

Only player-facing prose is localized. Rewrite template sentences naturally in each language rather than relying on word-for-word substitution.

Use the completed resolver where it removes duplicated generator-selection behavior, but do not change `/gen-char` output, character schema v2, character RULE allocation, gear generation, manual encumbrance, or save contents.

Add focused coverage for nested resolution, random and fixed references, selectors, weighted source selection, cycle/depth failures, provenance, locale-stable deterministic choices, modifier selection, and proof that descriptive modifiers do not mutate the base result.

Do not add the `Creature` model, creature persistence, creature management, creature archetypes, `/gen-monster`, or historical-content migration in this part.
```

# 3. Creature model and shared entity management

```text
Read and follow AGENTS.md before making changes.

Implement Part 3 of the generator and creature roadmap after Parts 1 and 2 are complete. Treat this prompt as the authoritative replacement for the conflicting shared-model, persistence-generalization, Creature, and common-command sections of documentation/GENERATOR_ARCHITECTURE_SPECIFICATION_PHASED.md.

Introduce a persistent `Creature` entity and generalize the existing entity-management behavior only where characters and creatures genuinely share it.

Do not force a particular inheritance hierarchy, base-class name, service API, module name, or directory structure. Reuse or extract common mechanics and persistence foundations when doing so removes real duplication without weakening the existing character boundaries. Character-only concepts must remain character-specific, and creature-only concepts must remain creature-specific.

Persistent concrete entity types are exactly:

- `character`;
- `creature`.

`animal`, `companion`, and `monster` are creature archetype/source categories, not persistent entity types.

Define and version a Creature save schema capable of storing the final state needed by later generation:

- immutable entity key and concrete entity type;
- creator ID;
- level;
- name and description;
- optional source generator, source entry, archetype, statistical-profile, and provenance identifiers;
- seven base statistics and applicable derived statistics;
- HP, AR, AP, MD, and descriptive status effects;
- intrinsic creature traits;
- explicit RULE records;
- descriptive modifier records;
- equipment;
- inventory;
- `gear.encumbrance` as `{ current, max }`;
- any explicit natural-armor data required to reproduce the saved AR without rerunning generation.

Loading a saved creature must hydrate the stored final state. It must never rerun generation, reselect localized content, recalculate random choices, or infer omitted generator data.

Preserve the existing Character implementation as the compatibility baseline:

- character schema v2 and its grouped properties remain unchanged;
- the existing schema-version migration remains supported exactly as it currently is;
- current CharacterKeys and save paths remain valid;
- existing character saves and history snapshots remain readable;
- character serialization must not acquire a required creature discriminator;
- existing character mutation, recalculation, history, undo, rendering, modal editing, and authorization behavior must remain unchanged;
- do not reorder character save properties or player-facing fields to make them resemble the Creature schema.

Share only genuinely common behavior, such as applicable statistic/resource validation, damage, healing, end-turn restoration, keyed operation serialization, atomic JSON publication, history transactions, rollback, deletion, and authorization workflows. Do not move character race, background, personality, talents, or other character-only behavior into a generic entity abstraction.

Creature persistence must provide:

- exclusive atomic creation;
- retrieval and listing;
- atomic updates;
- complete pre-change history snapshots;
- undo;
- permanent deletion of both active state and retained history;
- rollback when a multi-file operation partially fails;
- per-key concurrency safety;
- stable load and validation errors.

Character and creature keys must share one global uniqueness domain so an existing key resolves to at most one concrete entity. Concurrent cross-type creation attempts for the same key must not both succeed. Undo must never change an entity from one concrete type to the other.

Creature history should follow the existing character semantics where applicable:

- successful editable changes, damage, healing, and end-turn operations store complete pre-change snapshots;
- rejected, invalid, unauthorized, or failed operations do not create history;
- undo pops the newest valid snapshot without creating redo history;
- successful deletion permanently removes active state and retained history and cannot be undone;
- history limits continue to come from the current runtime configuration.

Generalize the existing management commands instead of creating parallel creature-only management commands. Use a neutral entity key for the shared commands:

- `/add entity-key:<new key> [type:<character|creature>]`, with `character` as the default;
- `/get entity-key:<key> [field]`;
- `/set entity-key:<key> field:<field>`;
- `/damage entity-key:<key> damage-amount:<number> [piercing]`;
- `/heal entity-key:<key> resource:<hp|armor|both> percentage:<0-100>`;
- `/end-turn entity-key:<key>`;
- `/delete entity-key:<key>`;
- `/undo entity-key:<key>`.

Keep `/gen-char character-key:<new key> ...` character-specific. `/gen-monster` is added only in Part 4.

Preserve current command semantics for characters, including public `/get`, the prefilled private `/set` modal, exact-key deletion confirmation, autocomplete authorization, resource behavior, and history behavior. Update command metadata, help, localization, autocomplete, confirmation sessions, and responses for neutral entity keys.

`/add type:creature` must create a valid blank creature owned by the caller. Concrete type and entity key are immutable after creation.

Extend retrieval and editing with deliberate type-compatible fields:

- existing character fields and their current grouping remain available only where currently valid;
- shared fields such as level, statistics, resources, RULEs, status effects, descriptive modifiers, equipment, inventory, and encumbrance work for both types where semantically applicable;
- creature identity, description, and intrinsic traits have appropriate creature-specific views and grouped editing;
- internal source IDs, schema metadata, provenance, concrete type, and key are not user-editable;
- autocomplete must not offer fields incompatible with the resolved entity.

Keep the current curated character `/get` and `/set` order. Define a separate deliberate creature-facing order. Neither order may be derived from generator order, save-property order, schema-property order, or object insertion order.

Apply the current ownership policy to creatures:

- anyone with normal bot access may view;
- the creator may edit and manage their own entity;
- the configured DM role and actual Discord server owner may manage every entity;
- existing moderator-only command permissions remain unrelated.

Creature gear includes manually editable encumbrance, defaulting to `0:0`. Never derive or update creature or character encumbrance from Constitution, Strength, statistics, equipment, inventory, natural armor, generation metadata, or any other property.

Add focused coverage for Character compatibility, Creature schema validation and hydration, global key collisions, atomic/concurrent operations, history and undo, deletion rollback, authorization, type-compatible fields, combined autocomplete, and independent character/creature presentation order.

Do not implement random creature archetypes, creature profiles beyond the shared profile infrastructure already present, creature generation, `/gen-monster`, or historical-content migration in this part.
```

# 4. Creature generation and `/gen-monster`

```text
Read and follow AGENTS.md before making changes.

Implement Part 4 of the generator and creature roadmap after Parts 1 through 3 are complete. Treat this prompt as the authoritative replacement for the conflicting creature-archetype, modifier-integration, and `/gen-monster` sections of documentation/GENERATOR_ARCHITECTURE_SPECIFICATION_PHASED.md.

Add complete animal, companion, and monster generation using generator v2, the completed reference/modifier system, shared statistical profiles, the persistent Creature model, and shared entity management.

The three generation categories are:

- `animal`;
- `companion`;
- `monster`.

They are archetype/source categories, not concrete entity types. Add one public `creature.json` routing catalog with stable `animal`, `companion`, and `monster` entries, following the same pattern as `background.json`. Route those entries respectively to separate internal `creature-animal.json`, `creature-companion.json`, and `creature-monster.json` detail catalogs. Do not automatically duplicate the same entry between animal and companion; a separately authored trained, bonded, or domesticated variant is valid when its identity or role is meaningfully different.

Each creature archetype must provide enough technical and localized information to generate a complete creature:

- stable entry ID and weight;
- localized name and description;
- statistical-profile ID;
- intrinsic traits;
- optional explicit natural armor;
- optional explicit fixed RULE references with levels;
- optional descriptive initial status-effect selection;
- optional descriptive modifier requests;
- default equipment and inventory, using stable generator references where appropriate.

A representative archetype may be equivalent to:

{
  "id": "fire-elemental",
  "weight": 1,
  "fields": {
    "Name": "Fire Elemental",
    "Description": "A living mass of flame held together by magical pressure."
  },
  "generation": {
    "statProfile": "elemental",
    "naturalArmorPercentage": 0,
    "traits": [
      {
        "id": "living-fire",
        "Name": "Living Fire",
        "Description": "The creature is made from flame rather than ordinary flesh."
      }
    ],
    "fixedRules": [
      {
        "entry": "fire",
        "level": 1
      }
    ]
  }
}

This example clarifies the required semantics; adapt it to the established generator-v2 schema rather than creating a parallel creature-only generator format.

Generate creatures at levels 1 through 10. Use the shared level budget, nonlinear statistic costs, weighted allocation behavior, derived-statistic logic, and resource calculations already used by the completed profile system. Profiles change statistical distribution through minimums, maximums, and weights; they do not add an alternative level budget, challenge rating, encounter rating, hidden boss budget, RULE, gear, or resource formula.

Creature entries must not contain fixed seven-stat blocks or per-entry profile overrides. Reusable profiles may represent distributions such as predator, brute, caster, elemental, or companion, but names alone have no mechanical effect beyond their configured distribution.

Creature generation must produce and persist:

- selected level;
- source category, source entry ID, profile ID, and useful generation provenance;
- localized name and description;
- final statistics and derived statistics;
- HP, AR, AP, and MD;
- intrinsic traits;
- explicit fixed RULEs;
- optional descriptive status effects;
- descriptive modifiers;
- default equipment and inventory;
- default manual encumbrance;
- creator ID and immutable creature key.

RULE behavior is explicit:

- creature Intelligence never grants RULE points or RULEs;
- a high-Intelligence creature receives no RULE unless its archetype explicitly references one;
- a low-Intelligence creature may receive a RULE when its archetype explicitly references one;
- each fixed RULE references a stable RULE entry ID and has an explicit level;
- modifiers never grant or modify RULEs.

Status effects generated at creation are localized descriptive records interpreted by the GM. Characters and creatures use the same structured `status-effect` catalog; do not create a creature-only duplicate. Status effects do not automatically apply penalties, bonuses, durations, triggers, resource changes, or other enforced mechanics.

Apply descriptive modifiers through the completed Part 2 system. Characters and creatures use the same internal `modifier` catalog. Generated characters and creatures store modifier stable IDs, localized names/descriptions, and provenance separately from intrinsic traits, RULEs, status effects, and gear; the compatible character field is appended without rewriting existing save files that omit it. Selecting a modifier must not change any base statistic, resource, armor value, trait, RULE, status effect, equipment entry, inventory entry, or other mechanical value.

Default gear may use fixed, random, nested, or weighted generator references. Do not infer mechanics from descriptive prose. Generator armor metadata or explicit natural armor may initialize AR only through defined technical data and the shared resource rules.

Remove every automatic encumbrance rule:

- creature archetypes, weapons, armor, and inventory do not require an `Encumbrance` field;
- generated gear does not increase current encumbrance;
- Constitution, Strength, statistics, natural armor, equipment, and inventory do not determine maximum encumbrance;
- creature generation leaves `gear.encumbrance` at the Creature model’s existing default, normally `0:0`;
- later manual `/set` edits remain authoritative.

Expose generation through:

`/gen-monster creature-key:<new key> type:<monster|animal|companion> [level]`

Command behavior:

- `creature-key` is required and must be globally unique across characters and creatures;
- `type` is required;
- level is optional from 1 to 10;
- omitted level is randomly selected from 1 to 10;
- the command name remains `/gen-monster` for all three archetype categories;
- permission follows the current DM-generation policy: configured DM role or actual server owner;
- help ordering places `/gen-monster` after `/gen` and `/gen-char`.

Generation and creation must be one atomic workflow. A failed generation, validation, collision, or save operation must leave no creature save, no history document, no partial key reservation, and no partially visible entity. Concurrent creation attempts for the same key must obey the global uniqueness guarantees from Part 3.

Render the completed saved creature using the established entity presentation. Clearly distinguish:

- identity and archetype;
- level;
- statistics and resources;
- intrinsic traits;
- fixed RULEs;
- status effects;
- descriptive modifiers;
- equipment, inventory, and manual encumbrance.

Loading or displaying the saved creature must never rerun generation.

Use the current animal, companion, and monster content as the initial source for the routed internal detail catalogs. Add the technical information needed for valid generation without performing the broad `JDR_RANDOM_OLD.md` migration reserved for Part 5. The new public `creature` root replaces the three former public detail roots; preserve their localized content unless an entry must be adjusted to become structurally valid.

Add focused coverage for all three archetype categories, levels and profiles, explicit RULE behavior at low and high Intelligence, derived resources, natural armor, default gear, descriptive status effects, modifier non-effects, manual encumbrance, command authorization, global collisions, deterministic generation, atomic save failure, and reload stability.
```

# 5. Historical content migration and final verification

```text
Read and follow AGENTS.md before making changes.

Implement Part 5 of the generator and creature roadmap after Parts 1 through 4 are complete. Treat this prompt as the authoritative replacement for the conflicting historical-migration and final-verification sections of documentation/GENERATOR_ARCHITECTURE_SPECIFICATION_PHASED.md.

Review documentation/JDR_RANDOM_OLD.md against the completed generator-v2 architecture and the current English/French production data. First create a committed migration manifest that records the disposition of every reusable historical entry, then apply the manifest in this same part.

For each historical item, record enough information to audit the decision:

- source section and historical value or name;
- target generator and proposed stable entry ID;
- action: add, merge, replace, rewrite, split, or reject;
- current conflicting entry, when applicable;
- conflict rationale and winning content;
- preserved or adjusted weight;
- required English/French work;
- required references, creature classification, profile, or fixed RULE;
- any genuinely unresolved content decision.

Do not silently omit historical entries. Reject an entry only with a documented reason, such as being pure obsolete mechanics, duplicate content with no additional value, or content incompatible with the approved architecture.

Apply the established conflict policy:

- when current and historical content represent the same or conflicting concept, historical content wins;
- preserve the historical concept, deliberate limits, descriptive intent, and deliberate weight;
- retain an existing stable technical ID when it still accurately identifies the winning concept and avoids unnecessary reference churn;
- remove conceptual duplicates and update every reference;
- current content that is genuinely distinct and does not conflict may remain.

Migrate the approved historical content into the completed generator architecture, including the following areas.

Standalone generators:

- regions and other broad locations;
- settlements;
- adventure sites and dungeons;
- buildings and rooms where appropriate;
- weapons;
- inventory;
- races;
- personalities;
- status effects;
- events;
- materials, factions, governments, religions, and other reusable lists identified by the manifest.

Preserve atomic structured entries, stable IDs, historical weights, and localized meaning. Race entries must keep their complete related fields together. Status effects remain descriptive and GM-interpreted.

Do not migrate or introduce numeric `Encumbrance` fields for weapons, armor, inventory, or any other generator entry. Historical weight or carrying information must not drive `gear.encumbrance`. Character and creature encumbrance remains a manually edited saved value.

Humanoid and background content:

- complete humanoids continue to be created only through `/gen-char`;
- do not introduce an NPC model, NPC persistence, NPC generation command, or complete `npc` generator;
- do not keep or create a complete-person `criminal` generator;
- migrate criminal professions and concepts into the appropriate character background details, especially the criminal background;
- route professions, statuses, ages, occupations, and social roles into the most appropriate broad background components;
- decompose authored or named historical NPCs into reusable names, backgrounds, appearances, backstories, goals, personalities, or talents rather than importing them as complete generated people;
- all migrated humanoid components must be reachable through the normal `/gen-char` background pipeline.

Preserve historical personality entries and their weights unless the manifest documents a concrete incompatibility. Do not remove or neutralize an entry merely because its terminology is dated, clinical, provocative, or stylistically different. Translate and rewrite it accurately and naturally while preserving the intended concept.

RULE reconciliation:

- compare every historical RULE with the completed current RULE catalog;
- add new concepts, merge duplicates, and replace conflicting current content according to historical precedence;
- keep one canonical stable entry ID per concept;
- preserve historical limitations and deliberate weights;
- update every fixed creature RULE, template reference, and other dependent ID;
- RULE descriptions remain game concepts, not executable code;
- creature RULEs remain explicitly assigned by archetypes;
- Intelligence and descriptive modifiers never grant creature RULEs.

Animals, companions, and monsters:

- classify each historical creature as one primary source: animal, companion, or monster;
- use companion for entries specifically intended to assist, follow, bond with, or be trained by humanoids;
- use animal for ordinary or wild fauna;
- use monster for supernatural, transformed, hostile, or extraordinary threats;
- create a separate variant only when training, bonding, or another distinction produces meaningfully different content;
- assign a reusable statistical profile;
- add intrinsic traits, explicit natural armor, fixed RULEs, status-effect requests, modifier requests, and default gear only when supported by the historical concept;
- do not import historical fixed statistic blocks, per-creature statistic overrides, alternate budgets, challenge ratings, or automatic encumbrance calculations;
- review explicit fixed RULEs and natural armor rather than inferring them from a vague category name.

Historical statistic tables or formulas that conflict with the completed shared-profile system remain historical documentation and are not imported as executable generator data.

Descriptive modifiers:

- migrate historical site and creature modifiers using the completed modifier architecture;
- preserve stable compatibility targets, historical names, descriptions, and weights;
- modifiers such as Alpha, Hybrid, Undead, Reinforced, Gigantic, Enraged, Pack, Swarm, Ectoplasmic, Invisible, RULE Bearer, and Equipped remain descriptive only;
- `RULE Bearer` does not select or grant a RULE;
- `Equipped` does not select or add gear;
- no historical modifier may change statistics, resources, armor, traits, RULEs, status effects, gear, group size, or other mechanics.

Quest templates:

- migrate historical quests only after their referenced stable IDs have been finalized;
- replace placeholders with the completed random, fixed, nested, and weighted reference format;
- use role-oriented marker names;
- generic people references resolve to a broad `background` entry, not a complete generated character;
- specific roles such as criminal, merchant, noble, official, scholar, military, religious, or mage use fixed background entry IDs where required;
- location, item, material, faction, race, creature, and other references must point to existing stable IDs and appropriate selectors;
- rewrite each English and French template so the resolved sentence is grammatically natural;
- quest resolution records provenance but does not automatically create or save referenced characters or creatures.

Keep documentation/JDR_RANDOM_OLD.md as a historical source. Do not delete or rewrite its original content merely because migration is complete. Update the architecture specification and relevant generator documentation with the final decisions and remove remaining obsolete references to:

- the previous generator format;
- the former 20-part rollout;
- automatic encumbrance;
- mechanical modifiers;
- Intelligence-derived creature RULEs;
- complete NPC or criminal generation;
- fixed per-creature statistic blocks;
- old or removed generator and RULE IDs.

Finish with complete validation of:

- generator-v2 schemas and stable IDs;
- English/French structural parity and natural localized content;
- weights and deterministic cross-locale selection;
- random and fixed references;
- selectors, nested templates, weighted sources, cycles, and provenance;
- modifier compatibility and non-effects;
- statistical profiles;
- character schema v2 generation and existing migrations;
- creature saves, history, undo, deletion, authorization, and loading without regeneration;
- `/gen`, `/gen-char`, `/gen-monster`, and shared entity commands;
- every manifest decision and every migrated or rejected historical entry.

The migration is complete only when there are no dangling references, duplicate technical IDs, silent historical omissions, automatic encumbrance rules, mechanical modifier effects, Intelligence-derived creature RULEs, or incompatible character/creature command fields.
```
