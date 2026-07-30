# Generator Architecture Specification

## Status

This document defines the target architecture for the random generator system and
the generation, persistence, and management of complete character and creature
sheets.

It is a design specification. It does not by itself modify the current behavior
of the bot.

---

## 1. Objectives

The architecture must support:

- weighted random selection through `weight`;
- simple text entries and structured entries;
- stable technical identifiers independent from displayed names;
- fully separated English and French content;
- reusable internal components that are not exposed directly through `/gen`;
- templates that reference other generators;
- modifiers that can alter generated results;
- atomic selection of related fields;
- complete character generation through `/gen-char`;
- complete creature generation through `/gen-monster`;
- shared statistics, level, resource, and combat mechanics;
- one shared collection of statistical distribution profiles;
- separate `Character` and `Creature` models built on a common `Combatant` model;
- complete save, history, undo, and mutation support for creatures;
- deterministic testing through dependency-injected random functions;
- strict validation before generator data becomes available.

The architecture must not:

- derive technical identifiers from localized display names;
- store executable expressions in JSON;
- automatically grant RULEs to creatures because they have high Intelligence;
- introduce a separate encounter-power or challenge-rating value;
- require fixed statistics for individual creature entries;
- create separate statistical systems for characters and creatures.

---

## 2. Directory Structure

Localized generator data uses mirrored English and French trees. Statistical
profiles are technical data and exist only once.

```text
data/generators/
├── stat-profile.json
├── en/
│   ├── categories/
│   │   ├── background.json
│   │   ├── race.json
│   │   ├── region.json
│   │   └── ...
│   ├── components/
│   │   ├── animal.json
│   │   ├── monster.json
│   │   ├── companion.json
│   │   └── ...
│   ├── modifiers/
│   │   ├── creature.json
│   │   ├── site.json
│   │   └── ...
│   └── templates/
│       ├── quest.json
│       └── ...
└── fr/
    ├── categories/
    ├── components/
    ├── modifiers/
    └── templates/
```

### 2.1 Directory Roles

- `categories/` contains autonomous generators normally visible through `/gen`.
- `components/` contains internal generators used by references or specialized
  generation commands.
- `modifiers/` contains independent additions or transformations that may be
  selected for another result.
- `templates/` contains composed generators that resolve one or more references.
- `stat-profile.json` contains non-localized statistical distributions used by
  both character and creature generation.

The generator loader scans the four localized directories.

The statistical profile loader reads `stat-profile.json` separately. Statistical
profiles are not normal `/gen` categories and do not use the localized generator
envelope.

`listGenerators()` returns public categories and templates by default. Internal
components and modifiers are omitted unless explicitly requested by an internal
service.

---

## 3. Common Generator Envelope

Every localized generator file uses a versioned envelope.

```json
{
  "schemaVersion": 2,
  "id": "race",
  "kind": "category",
  "visibility": "public",
  "name": "Races",
  "description": "Ancestries with culture, appearance, and racial traits",
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

### 3.1 Technical Properties

- `schemaVersion` selects the validator and controls format evolution.
- `id` is a stable English technical identifier.
- `kind` is one of:
  - `category`;
  - `component`;
  - `modifier`;
  - `template`.
- `visibility` is either:
  - `public`;
  - `internal`.
- `entrySchema` describes the expected entry shape.

### 3.2 Localized Properties

- `name` is the displayed generator name.
- `description` is the displayed generator description.

A translated display name may change without changing the generator `id` or any
reference to it.

---

## 4. Entry Shapes

Every entry has:

- a stable `id`;
- an optional positive `weight`;
- exactly one primary payload:
  - `value`;
  - `fields`;
  - `template`.

When omitted, `weight` defaults to `1`.

An entry may additionally define technical properties such as `mechanics`,
`references`, or `modifiers` when permitted by its schema.

### 4.1 Text Entry

```json
{
  "id": "forest-at-dusk",
  "weight": 3,
  "value": "A forest path disappears as night falls."
}
```

This shape is appropriate for a result represented by one text value.

### 4.2 Structured Entry

```json
{
  "id": "human",
  "weight": 5,
  "fields": {
    "Name": "Human",
    "Description": "Adaptable communities connected by fast-changing traditions.",
    "Skill Bonus": "Choose one skill bonus during character creation.",
    "Physical Ability": "Adapt quickly to a sudden change of climate or pace."
  }
}
```

All fields belong to the same selected entry. They must never be selected
independently.

Field keys remain technical and English in every locale. Player-facing values
are translated.

### 4.3 Structured Entry with Mechanics

Narrative data and mechanical data must be separated.

```json
{
  "id": "grave-hound",
  "weight": 2,
  "fields": {
    "Name": "Grave Hound",
    "Description": "A corpse-fed pack hunter that follows the scent of fear.",
    "Traits": [
      {
        "id": "fear-scent",
        "Name": "Scent of Fear",
        "Description": "The creature can follow frightened prey by scent."
      }
    ]
  },
  "mechanics": {
    "statProfile": "predator",
    "naturalArmorPercentage": 0,
    "fixedRules": []
  }
}
```

`fields` contains localized information intended for display or persistence as
descriptive content.

`mechanics` contains technical values that must be identical in every locale.

---

## 5. Templates and References

A template may reference other generators.

```json
{
  "id": "recover-item-before-rivals",
  "weight": 2,
  "template": "Recover {{item}} from {{site}} before {{rival}} reaches it.",
  "references": {
    "item": {
      "generator": "inventory",
      "select": "fields.Name"
    },
    "site": {
      "generator": "dungeon",
      "select": "display"
    },
    "rival": {
      "generator": "faction",
      "select": "fields.Name"
    }
  }
}
```

Reference names such as `item`, `site`, and `rival` are stable technical
identifiers. Translated templates use the same markers.

### 5.1 Selectors

A reference selector may request:

- `value`: the text value of a text entry;
- `fields`: the complete structured field object;
- `fields.<FieldName>`: one structured field;
- `display`: the primary display representation selected by the resolver.

### 5.2 Weighted Source Selection

A reference may select one generator from several sources.

```json
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
```

Source weights select the generator. Entry weights then select an entry inside
that generator. These are separate weighted selections.

### 5.3 Recursive Resolution

The resolver must:

- track the current reference stack;
- reject cycles with a precise error;
- enforce a configurable maximum depth;
- retain the selected generator and entry identifiers in its structured result.

---

## 6. Independent Modifiers

Modifier files contain entries that may be applied to another generated result.

A modifier remains visible as a distinct selected result. Its descriptive
identity is not merged invisibly into the source entry.

```json
{
  "schemaVersion": 2,
  "id": "creature-modifier",
  "kind": "modifier",
  "visibility": "internal",
  "name": "Creature modifiers",
  "description": "Independent alterations applied to generated creatures",
  "appliesTo": [
    "animal",
    "monster",
    "companion"
  ],
  "entrySchema": {
    "type": "fields",
    "required": [
      "Name",
      "Description"
    ]
  },
  "entries": []
}
```

`appliesTo` remains useful for modifier compatibility. It is not used by
statistical profiles.

### 6.1 Modifier Request

A generator or entry may request modifiers.

```json
{
  "modifiers": [
    {
      "generator": "creature-modifier",
      "chance": 0.25,
      "count": {
        "min": 1,
        "max": 1
      }
    }
  ]
}
```

Rules:

- `chance` is evaluated once for the request;
- `count.min` and `count.max` are inclusive;
- the number of selected modifiers is randomly chosen inside the range;
- the same modifier entry cannot be selected twice during one resolution;
- the modifier generator must declare the source category in `appliesTo`;
- a selected modifier is retained in the structured result and in a generated
  creature save.

### 6.2 Modifier Narrative and Mechanical Effects

Modifier descriptions and added traits are localized. Mechanical changes are
technical.

```json
{
  "id": "gigantic",
  "weight": 1,
  "fields": {
    "Name": "Gigantic",
    "Description": "The creature is much larger and physically stronger.",
    "Traits": [
      {
        "id": "extended-reach",
        "Name": "Extended Reach",
        "Description": "The creature can threaten targets from farther away."
      },
      {
        "id": "large-body",
        "Name": "Large Body",
        "Description": "The creature has difficulty moving through confined spaces."
      }
    ]
  },
  "mechanics": {
    "statChanges": {
      "constitution": 2,
      "strength": 2,
      "dexterity": -1,
      "speed": -1
    }
  }
}
```

A modifier may:

- change one or more base statistics;
- add one or more traits;
- add one or more random RULEs when explicitly configured.

A modifier must not implicitly:

- change the entity level;
- replace its statistical profile;
- replace its identity;
- change its persistent entity type;
- grant RULEs based only on Intelligence.

### 6.3 RULE Bearer Modifier

The RULE Bearer modifier explicitly adds a random RULE.

```json
{
  "id": "rule-bearer",
  "weight": 1,
  "fields": {
    "Name": "RULE Bearer",
    "Description": "The creature manifests an additional random RULE.",
    "Traits": [
      {
        "id": "rule-bearer",
        "Name": "RULE Bearer",
        "Description": "The creature possesses a magical mastery not normally associated with its species."
      }
    ]
  },
  "mechanics": {
    "addRandomRules": {
      "generator": "rules",
      "count": 1,
      "level": 1
    }
  }
}
```

The random RULE:

- is selected from the configured generator;
- is added after fixed creature RULEs;
- cannot duplicate a RULE already owned by the creature;
- uses the configured level;
- is persisted as part of the creature sheet.

---

## 7. Shared Statistical Profiles

All generated characters and creatures use distributions from the same
non-localized file:

```text
data/generators/stat-profile.json
```

The file describes statistical distributions only. It does not contain:

- localized names or descriptions;
- `appliesTo`;
- HP formulas;
- AP formulas;
- MD formulas;
- RULE assignment rules;
- executable expressions.

### 7.1 File Shape

```json
{
  "schemaVersion": 1,
  "profiles": [
    {
      "id": "character-balanced",
      "minimums": {
        "constitution": 4,
        "strength": 4,
        "dexterity": 4,
        "intelligence": 4,
        "speed": 4,
        "perception": 4,
        "charisma": 4
      },
      "maximums": {
        "constitution": 20,
        "strength": 20,
        "dexterity": 20,
        "intelligence": 20,
        "speed": 20,
        "perception": 20,
        "charisma": 20
      },
      "weights": {
        "constitution": 1,
        "strength": 1,
        "dexterity": 1,
        "intelligence": 1,
        "speed": 1,
        "perception": 1,
        "charisma": 1
      }
    },
    {
      "id": "predator",
      "minimums": {
        "constitution": 6,
        "strength": 6,
        "dexterity": 6,
        "intelligence": 4,
        "speed": 7,
        "perception": 7,
        "charisma": 4
      },
      "maximums": {
        "constitution": 20,
        "strength": 20,
        "dexterity": 20,
        "intelligence": 10,
        "speed": 20,
        "perception": 20,
        "charisma": 10
      },
      "weights": {
        "constitution": 1.5,
        "strength": 2,
        "dexterity": 2,
        "intelligence": 0.25,
        "speed": 2,
        "perception": 2,
        "charisma": 0.25
      }
    }
  ]
}
```

The numbers above illustrate the schema. Final profile values are balancing data
and may be adjusted without changing the generation algorithm.

### 7.2 Profile Reuse

A profile has no entity-type restriction.

The same profile may be referenced by:

- the character generation service;
- a character-generation archetype;
- an animal entry;
- a monster entry;
- a companion entry;
- any later generated combatant type using the same seven statistics.

The current `/gen-char` behavior uses a configured character profile such as
`character-balanced`. No new command option is required.

Creature entries explicitly reference their profile through
`mechanics.statProfile`.

### 7.3 Required Statistics

Every profile defines all seven base statistics:

- `constitution`;
- `strength`;
- `dexterity`;
- `intelligence`;
- `speed`;
- `perception`;
- `charisma`.

For every statistic:

- `minimums` is an integer between `4` and `20`;
- `maximums` is an integer between `4` and `20`;
- the minimum cannot exceed the maximum;
- `weights` is a finite number greater than or equal to `0`.

At least one statistic must have a positive allocation weight.

### 7.4 Shared Level Budget

Characters and creatures use the same level-dependent statistical budget.

```text
base budget at level 1: 67

budget(level) =
  67
  + 2 × (level - 1)
  + 1 at level 2
  + 1 at level 5
  + 1 at level 8
```

Equivalent behavior:

```js
calculateStatBudget(level) {
  return 67
    + 2 * (level - 1)
    + [2, 5, 8].filter(requiredLevel => level >= requiredLevel).length;
}
```

The statistical cost of a value remains:

- values `1` through `14`: `1` point per value;
- values `15` and `16`: `2` points per value;
- values `17` and `18`: `3` points per value;
- values `19` and `20`: `4` points per value.

### 7.5 Allocation Algorithm

The statistical generator receives:

```js
generateStats({
  level,
  profile,
  random = Math.random,
})
```

It performs the following steps:

1. Validate the level and profile.
2. Calculate the level budget.
3. Initialize every statistic to its profile minimum.
4. Calculate the total cost of those minimum values.
5. If the minimum values already equal or exceed the available budget:
   - keep every required minimum;
   - do not reduce any statistic;
   - accept that the generated distribution may exceed its nominal budget;
   - stop allocation.
6. Otherwise, calculate the remaining budget.
7. Build the list of eligible statistics:
   - the current value is below the profile maximum;
   - the allocation weight is greater than `0`;
   - the cost of the next value does not exceed the remaining budget.
8. Select one eligible statistic using its allocation weight.
9. Increase the selected statistic by `1`.
10. Subtract the cost of that increase from the remaining budget.
11. Repeat until no statistic is eligible.

If the remaining budget cannot be spent exactly because every possible next
increase costs too much, the unused remainder is accepted.

### 7.6 Statistical Profile Semantics

A profile controls only the distribution of a generated sheet.

It does not:

- grant traits;
- grant RULEs;
- grant armor;
- change HP, AP, or MD formulas;
- represent a class or persistent entity type;
- restrict later edits through `/set`.

A generated statistic may be changed later through the same mutation system used
for character statistics.

---

## 8. Shared Combatant Model

Complete sheets use a common abstract model.

```text
Combatant
├── Character
└── Creature
```

### 8.1 Combatant

`Combatant` contains only state and behavior shared by characters and creatures:

- immutable entity key;
- immutable concrete entity type;
- creator identifier;
- level;
- seven base statistics;
- initiative and reflexes;
- HP, AR, AP, and MD resources;
- personality when present;
- RULEs;
- status effects;
- equipment;
- inventory;
- encumbrance;
- shared combat and turn operations.

`Combatant` must not:

- depend on Discord;
- format command responses;
- choose generator entries;
- write files directly;
- contain fields specific to one concrete model.

### 8.2 Character

`Character` extends `Combatant` with:

- first name;
- last name;
- race;
- racial description;
- racial traits;
- appearance;
- backstory;
- goals;
- talents.

### 8.3 Creature

`Creature` extends `Combatant` with:

- name;
- description;
- source creature category when generated;
- source entry identifier when generated;
- statistical profile identifier;
- natural armor percentage;
- creature traits;
- applied modifiers.

`monster`, `animal`, and `companion` are generator categories. They are not
persistent model types.

The persistent discriminator has exactly two values:

```text
character
creature
```

### 8.4 Concrete Validation

`Character` and `Creature` each provide:

- their own hydration logic;
- their own save schema;
- their own model-specific validation;
- a model-appropriate `displayName`.

A save cannot be changed from one concrete type to the other.

---

## 9. Shared Mechanics

The following mechanics are shared by characters and creatures.

### 9.1 Derived Statistics

```text
initiative = speed
reflexes = speed
```

Derived statistics are recalculated after generation and after any mutation that
affects their source statistics.

### 9.2 Maximum HP

```text
maximum HP =
  constitution
  × 10
  × (1 + 0.2 × (level - 1))
```

Normal project rounding rules apply.

### 9.3 Maximum AP

```text
level 1 to 3: 4 AP
level 4 to 6: 5 AP
level 7 to 9: 6 AP
level 10:     8 AP
```

AP remains limited by the domain maximum.

### 9.4 Maximum MD

```text
maximum MD = speed × 0.5
```

### 9.5 Armor

AR is calculated as a percentage of maximum HP.

A generated creature receives AR only from its configured natural armor or from
equipment added later.

Generated creatures do not receive random equipment by default.

### 9.6 Recalculation

After statistics are generated or changed:

1. clamp or validate the final base statistics;
2. recalculate initiative and reflexes;
3. recalculate maximum HP;
4. recalculate maximum AP from level;
5. recalculate maximum MD;
6. calculate maximum AR from the current armor percentage or equipment;
7. apply the same current-resource adjustment policy already used for characters.

Shared mechanics must be implemented in pure services and reused by both models.

---

## 10. Character Generation

### 10.1 Command

```text
/gen-char character-key:<new key> [level] [background]
```

### 10.2 Behavior

The character generation pipeline:

1. validates global entity-key uniqueness;
2. uses the requested level or selects a random level from `1` to `10`;
3. selects a name;
4. selects the requested or random background;
5. selects the background details;
6. selects a complete race entry;
7. selects the configured character statistical profile;
8. generates statistics through the shared profile allocator;
9. assigns character RULEs through the existing Intelligence-based character rules;
10. generates talents;
11. generates equipment and inventory;
12. derives resources through shared mechanics;
13. validates the completed `Character`;
14. creates the save atomically.

### 10.3 Character RULEs

Character RULE generation remains based on character Intelligence and the
existing RULE-point thresholds.

This behavior is specific to character generation.

It must not be reused automatically for creatures.

### 10.4 Character Profiles

Character statistical distributions are stored in `stat-profile.json`.

The currently configured default can reproduce the existing balanced random
allocation. Additional character-oriented distributions may be added later
without creating another profile file or another allocation algorithm.

Profiles affect random generation only. They do not restrict manual character
creation or later `/set` operations beyond normal domain validation.

---

## 11. Creature Archetype Entries

`animal`, `monster`, and `companion` are internal structured generators.

### 11.1 Example

```json
{
  "id": "fire-elemental",
  "weight": 1,
  "fields": {
    "Name": "Fire Elemental",
    "Description": "A living mass of flame held together by magical pressure.",
    "Traits": [
      {
        "id": "living-fire",
        "Name": "Living Fire",
        "Description": "The creature is made of flame rather than ordinary flesh."
      }
    ]
  },
  "mechanics": {
    "statProfile": "elemental",
    "naturalArmorPercentage": 0,
    "fixedRules": [
      {
        "ruleId": "fire",
        "level": 1
      }
    ],
    "initialStatusEffect": {
      "chance": 0,
      "generator": "status-effect"
    }
  },
  "modifiers": [
    {
      "generator": "creature-modifier",
      "chance": 0.25,
      "count": {
        "min": 1,
        "max": 1
      }
    }
  ]
}
```

### 11.2 Required Properties

A creature archetype requires:

- `id`;
- `fields.Name`;
- `fields.Description`;
- `mechanics.statProfile`.

### 11.3 Optional Properties

A creature archetype may define:

- `weight`;
- `fields.Traits`;
- `mechanics.naturalArmorPercentage`;
- `mechanics.fixedRules`;
- `mechanics.initialStatusEffect`;
- modifier requests.

Defaults:

- `weight`: `1`;
- `fields.Traits`: empty list;
- `naturalArmorPercentage`: `0`;
- `fixedRules`: empty list;
- initial status-effect chance: `0`;
- modifiers: none unless requested.

### 11.4 No Per-Creature Statistical Overrides

Creature entries do not define:

- fixed statistic blocks;
- per-statistic minimum overrides;
- per-statistic maximum overrides;
- per-statistic allocation-weight overrides;
- HP multipliers;
- separate budget formulas.

All base statistical generation comes from the referenced shared profile.

Any required later correction can be performed through `/set`.

---

## 12. Creature RULE Assignment

Creature RULE assignment is explicit and independent from Intelligence.

### 12.1 Intelligence Does Not Grant Creature RULEs

A creature with high Intelligence receives no RULE automatically.

The character RULE-point thresholds are not evaluated for creature generation.

This remains true for profiles such as `caster`. A caster-oriented statistical
profile only prioritizes relevant statistics. It does not itself grant magic.

### 12.2 Fixed Creature RULEs

A creature entry may always grant one or more specific RULEs.

```json
{
  "fixedRules": [
    {
      "ruleId": "fire",
      "level": 1
    }
  ]
}
```

A fixed RULE:

- references a stable entry ID from the `rules` generator;
- uses the localized name and description for the active locale;
- has an explicitly configured level;
- is always added to the generated creature;
- may exist even when the creature has low Intelligence;
- is persisted in the complete creature save.

### 12.3 Random RULEs from Modifiers

A random creature RULE is added only when a selected modifier explicitly requests
one, such as RULE Bearer.

Fixed RULEs are resolved first. Random RULE selection excludes already-owned
RULE IDs.

### 12.4 RULE Validation

Validation rejects:

- a missing RULE generator;
- an unknown fixed RULE ID;
- a non-integer or invalid RULE level;
- duplicate fixed RULE IDs in one creature entry;
- a modifier requesting an invalid RULE count;
- a modifier referencing an incompatible result shape.

---

## 13. Creature Modifier Application

Modifier selection and modifier mechanical application are separate steps.

### 13.1 Application Order

Creature generation applies data in this order:

```text
level
→ creature archetype
→ statistical profile
→ base statistic allocation
→ base creature identity and traits
→ fixed RULEs
→ modifier selection
→ modifier statistic changes
→ modifier traits
→ modifier random RULEs
→ derived statistics and resources
→ natural armor
→ initial status effects
→ final validation
→ atomic save
```

### 13.2 Statistic Changes

A modifier uses `mechanics.statChanges`.

```json
{
  "statChanges": {
    "constitution": 2,
    "strength": 2,
    "speed": -1
  }
}
```

Rules:

- each value is an integer delta;
- deltas are applied after profile allocation;
- multiple modifier deltas are cumulative;
- the final value is constrained to the normal domain range of `4` to `20`;
- modifier changes do not consume or refund statistical budget;
- derived values are calculated only after all modifier changes are complete.

### 13.3 Added Traits

Traits from the base creature entry are added first.

Traits from selected modifiers are appended afterward.

Traits are deduplicated by stable trait `id`.

A trait contains:

```json
{
  "id": "extended-reach",
  "Name": "Extended Reach",
  "Description": "The creature can threaten targets from farther away."
}
```

Trait names and descriptions are localized. Trait IDs are identical in both
languages.

### 13.4 Applied Modifier Records

The generated creature retains each selected modifier as a distinct record.

At minimum, a persisted modifier record contains:

- modifier generator ID;
- modifier entry ID;
- localized name;
- localized description.

This allows `/get`, save inspection, and Discord output to distinguish the base
creature from its modifiers.

---

## 14. Creature Generation

### 14.1 Command

```text
/gen-monster creature-key:<new key> type:<monster|animal|companion> [level]
```

### 14.2 Parameters

- `creature-key` is required.
- The key must be globally unique across characters and creatures.
- `type` is required.
- `type` selects the internal creature source generator.
- `level` is optional.
- A supplied level must be an integer from `1` to `10`.
- When absent, the level is randomly selected from `1` to `10`.
- The command remains restricted to the DM role and real server owner according
  to the existing permission rules.

The command name remains `/gen-monster` even when `type` is `animal` or
`companion`.

### 14.3 Generation Flow

```text
/gen-monster
  → creatureApplicationService.generateCreature(...)
      → validate global EntityKey availability
      → select the creature archetype
      → load its shared statistical profile
      → generate base statistics
      → resolve fixed traits and fixed RULEs
      → select and apply modifiers
      → recalculate shared derived mechanics
      → construct and validate Creature
      → creatureStore creates the save atomically
  → creatureCommandResponses renders the localized sheet
```

### 14.4 Generated Creature Contents

A generated creature has:

- a level from `1` to `10`;
- all seven base statistics;
- initiative and reflexes derived from Speed;
- complete HP, AP, and MD resources;
- AR derived from configured natural armor;
- zero or more fixed RULEs;
- zero or more modifier-added RULEs;
- zero or more base traits;
- zero or more modifier-added traits;
- zero or more selected modifiers;
- an optional initial status effect;
- its source type and entry;
- its statistical profile ID;
- empty equipment and inventory by default.

No creature receives a RULE merely because of Intelligence.

No separate encounter-power value is generated or stored.

---

## 15. Persistence and History

Creatures use a complete save system equivalent in behavior to character saves.

### 15.1 Storage Layout

```text
save/
├── <CharacterKey>.json
├── creatures/
│   └── <EntityKey>.json
└── .history/
    ├── <CharacterKey>.json
    └── creatures/
        └── <EntityKey>.json
```

Characters retain their current storage location.

Creatures use a dedicated save directory and dedicated history directory.

### 15.2 Complete Creature Save

A creature save contains its final current state, not instructions that must be
rerun when loading.

A generated creature save includes at least:

- entity type;
- entity key;
- creator;
- level;
- name;
- description;
- source category;
- source entry ID;
- statistical profile ID;
- final statistics;
- derived statistics;
- current and maximum resources;
- natural armor percentage;
- traits;
- RULEs;
- status effects;
- applied modifiers;
- equipment;
- inventory;
- encumbrance.

The saved final values remain stable if generator data or profile data changes
later.

No random seed or regeneration mechanism is required for loading a save.

### 15.3 Global Entity-Key Uniqueness

An `EntityKey` is globally unique.

A character and a creature cannot use the same key.

Creation checks both stores before publishing either type of entity.

### 15.4 Atomicity and Concurrency

Character and creature mutations use the same per-key operation queue.

Creation and mutation must preserve the existing guarantees for:

- exclusive creation;
- atomic file publication;
- atomic history publication;
- serialized concurrent mutations;
- rollback on failed validation or write;
- no partial save visibility.

### 15.5 History and Undo

Creature operations create validated history snapshots using the creature
schema.

`/undo` restores the previous creature snapshot through the same application
facade used for characters.

An undo operation cannot transform a character into a creature or a creature
into a character.

---

## 16. Common Entity Services and Commands

Generation commands are specialized. Entity management commands are shared.

```text
/gen-char character-key:<new key> [level] [background]
/gen-monster creature-key:<new key> type:<monster|animal|companion> [level]

/add entity-key:<new key> [type:<character|creature>]
/get entity-key:<key> [field]
/set entity-key:<key> field:<field>
/damage entity-key:<key> damage-amount:<number> [piercing]
/heal entity-key:<key> resource:<hp|armor|both> percentage:<0-100>
/end-turn entity-key:<key>
/delete entity-key:<key>
/undo entity-key:<key>
```

### 16.1 Application Facade

`entityApplicationService`:

1. resolves the global entity key;
2. identifies the concrete model;
3. delegates persistence to `characterStore` or `creatureStore`;
4. invokes shared mechanics through the `Combatant` interface;
5. invokes model-specific validation where required.

### 16.2 `/add`

For `/add`, `type` defaults to `character`.

This is the only common command option that chooses the concrete persistent
model during creation.

The concrete type becomes immutable after creation.

### 16.3 `/get` and `/set`

The canonical field catalog declares which concrete models support each field.

```js
{
  id: 'race',
  appliesTo: ['character'],
}

{
  id: 'strength',
  appliesTo: ['character', 'creature'],
}

{
  id: 'traits',
  appliesTo: ['creature'],
}
```

This command-field `appliesTo` mechanism is unrelated to statistical profiles.

After resolving the entity, autocomplete and validation expose only compatible
fields.

### 16.4 Statistic Overrides

Generated creature statistics may be changed later through `/set`.

A statistic mutation:

- validates the final value;
- changes the persisted statistic;
- recalculates dependent values using shared mechanics;
- creates a history snapshot;
- publishes the updated save atomically.

The statistical profile is a generation input. It does not prevent later
overrides.

### 16.5 Shared Operations

The following operations work through `Combatant` and must not be duplicated:

- damage;
- healing;
- armor restoration;
- end-of-turn resource reset;
- deletion;
- history publication;
- undo;
- common field reads and writes.

Permissions remain based on the entity creator, DM role, and real server owner
according to the existing command policy.

---

## 17. Structured Resolution Result

The generator resolver returns structured data rather than only a final string.

```js
{
  category: {
    id: 'quest',
    name: 'Quests',
    locale: 'en',
  },
  entryId: 'recover-item-before-rivals',
  output: {
    type: 'template',
    text: 'Recover the sealed grimoire from the abandoned prison...',
    references: {
      item: {
        generatorId: 'inventory',
        entryId: 'sealed-grimoire',
      },
      site: {
        generatorId: 'dungeon',
        entryId: 'abandoned-prison',
      },
      rival: {
        generatorId: 'faction',
        entryId: 'black-banner-company',
      },
    },
    modifiers: [],
  },
}
```

For structured creature entries, the result retains:

- source generator ID;
- source entry ID;
- localized fields;
- technical mechanics;
- selected modifier entries.

This structure allows:

- deterministic tests;
- precise data errors;
- Discord-specific presentation;
- complete creature construction;
- inspection of which component produced each value.

---

## 18. Resolver Services

Generator logic belongs in services rather than Discord commands.

```text
/gen
  → generatorResolver.generate(categoryId, locale, options)
      → generatorCatalog loads and validates localized files
      → weightedSelector selects entries
      → referenceResolver resolves nested templates
      → modifierResolver selects compatible modifiers
  → generatorResponses renders the result
```

### 18.1 Proposed API

```js
generate(categoryId, locale, {
  random = Math.random,
  maxDepth = 8,
} = {})

listGenerators(locale, {
  visibility = 'public',
} = {})

getGenerator(categoryId, locale)
```

Statistical profiles use a separate technical catalog.

```js
getStatProfile(profileId)

listStatProfiles()

validateStatProfiles()
```

### 18.2 Responsibility Boundaries

`generatorCatalog`:

- discovers localized generator files;
- validates the common envelope;
- resolves stable generator IDs;
- verifies English/French parity.

`statProfileCatalog`:

- loads the single non-localized profile file;
- validates every distribution;
- resolves profile IDs.

`weightedSelector`:

- performs weighted entry selection;
- accepts an injected random function;
- does not know Discord or persistence.

`referenceResolver`:

- resolves template references;
- detects cycles;
- enforces maximum depth;
- retains resolution provenance.

`modifierResolver`:

- validates target compatibility;
- evaluates chance and count;
- selects unique modifier entries;
- returns structured modifier results.

`entityMechanics`:

- calculates statistical budgets;
- allocates statistics from profiles;
- derives initiative, reflexes, HP, AP, and MD;
- recalculates resources after changes.

`creatureGenerationService`:

- selects creature archetypes;
- assigns fixed creature RULEs;
- applies creature modifier mechanics;
- constructs complete creatures.

Discord commands only:

- parse options;
- check command-level permissions;
- call application services;
- render localized responses.

---

## 19. Localization Rules

English localized files are the structural reference.

For every French localized file:

1. the relative path is identical;
2. `schemaVersion`, `id`, `kind`, and `visibility` are identical;
3. generator-level `appliesTo` values are identical;
4. entry IDs are identical;
5. entry order is identical;
6. weights are identical;
7. references and selectors are identical;
8. modifier chances and counts are identical;
9. `mechanics` objects are identical;
10. trait IDs are identical;
11. fixed RULE IDs and levels are identical;
12. only player-facing names, descriptions, text values, and templates are
    translated.

The `stat-profile.json` file is not localized and has no mirrored copy.

Technical values such as the following remain unchanged across locales:

- generator IDs;
- entry IDs;
- profile IDs;
- RULE IDs;
- trait IDs;
- type values;
- rarity values;
- encumbrance values;
- percentages;
- statistic changes;
- reference markers.

Entries are aligned by stable ID, not only by array position. Matching order is
still required so deterministic random tests select the same conceptual result
in each locale.

---

## 20. Validation

All data must be validated before it is activated.

### 20.1 Generator Validation

Reject:

- unknown schema versions;
- unknown generator kinds;
- invalid visibility values;
- duplicate generator IDs;
- duplicate entry IDs;
- entries without exactly one primary payload;
- non-positive or non-finite weights;
- missing required fields;
- invalid reference markers;
- references to missing generators;
- selectors targeting unavailable fields;
- unused references;
- reference cycles;
- invalid modifier chances or counts;
- incompatible modifier targets;
- invalid localized structure;
- Discord output that cannot be rendered safely.

### 20.2 Statistical Profile Validation

Reject:

- an unknown profile schema version;
- duplicate profile IDs;
- a profile missing one of the seven statistics;
- an unknown statistic key;
- a minimum outside `4` to `20`;
- a maximum outside `4` to `20`;
- a minimum greater than its maximum;
- a negative or non-finite weight;
- a profile with no positive allocation weight;
- a creature entry referencing a missing profile.

A profile whose minimum values cost more than a level's budget is valid. The
allocation algorithm intentionally preserves those minimums.

### 20.3 Creature Archetype Validation

Reject:

- a missing name;
- a missing description;
- a missing statistical profile;
- invalid natural armor percentage;
- duplicate trait IDs;
- invalid fixed RULE structures;
- duplicate fixed RULE IDs;
- an unknown fixed RULE ID;
- invalid initial status-effect configuration;
- an incompatible modifier request.

### 20.4 Modifier Mechanical Validation

Reject:

- unknown statistic names in `statChanges`;
- non-integer statistic deltas;
- duplicate added trait IDs inside one modifier;
- malformed random RULE configuration;
- invalid RULE count;
- invalid RULE level;
- a missing RULE generator;
- localized mechanical differences.

### 20.5 Sheet Validation

Reject:

- an entity type other than `character` or `creature`;
- a level outside `1` to `10`;
- an invalid final statistic;
- invalid derived statistics;
- invalid resource maxima or current values;
- AP above the domain cap;
- a creature save containing character-only fields;
- a character save containing creature-only fields;
- a missing required concrete-model field;
- an attempt to change the concrete entity type;
- a globally duplicated entity key;
- a history snapshot using the wrong schema;
- a command field incompatible with the resolved model.

---

## 21. Determinism and Testing

All random services accept an injected random function.

Tests must cover:

### 21.1 Weighted Selection

- default weight behavior;
- weighted entry boundaries;
- unique multi-selection;
- modifier chance behavior;
- modifier count behavior;
- deterministic cross-locale conceptual selection.

### 21.2 Statistical Profiles

- every statistic starts at its configured minimum;
- maximums are never exceeded during allocation;
- zero-weight statistics are not selected;
- weighted statistics are favored over lower-weight statistics;
- nonlinear next-value costs are respected;
- the level budget is calculated correctly;
- minimum values are preserved when they exceed the budget;
- unused budget is accepted when no legal increase can consume it;
- the same random sequence produces the same distribution.

### 21.3 Creature RULEs

- high Intelligence alone grants no creature RULE;
- fixed RULEs are always present;
- fixed RULEs work with low Intelligence;
- RULE Bearer adds exactly the configured random count;
- random RULEs do not duplicate fixed RULEs;
- random RULE levels use modifier configuration;
- RULEs are saved and restored unchanged.

### 21.4 Modifier Effects

- statistic changes apply after base allocation;
- cumulative changes are handled in selection order;
- final statistics remain in the legal domain;
- added traits are appended;
- duplicate trait IDs are removed or rejected according to validation context;
- derived resources use post-modifier statistics;
- selected modifier records remain visible in the final creature.

### 21.5 Persistence

- character and creature keys share one uniqueness domain;
- creature creation is exclusive;
- concurrent mutations are serialized per key;
- failed validation publishes no partial save;
- creature history snapshots use the creature schema;
- creature undo restores the complete previous state;
- loading a creature does not rerun random generation;
- profile changes do not alter existing saves.

### 21.6 Commands

- `/gen-monster` accepts only supported source types;
- omitted level selects a value from `1` to `10`;
- supplied invalid levels are rejected;
- common commands resolve both concrete models;
- autocompletion exposes only compatible fields;
- `/set` statistic changes recalculate dependencies;
- permissions remain consistent across entity types.

---

## 22. Recommended Initial Statistical Profiles

The profile file may initially contain distributions such as:

- `character-balanced`;
- `animal`;
- `companion`;
- `predator`;
- `brute`;
- `caster`;
- `boss`;
- `elemental`.

These names describe statistical tendencies only.

Examples:

- `predator` favors Strength, Dexterity, Speed, and Perception;
- `brute` favors Constitution and Strength;
- `caster` favors Intelligence and Perception;
- `companion` favors utility, mobility, or perception;
- `boss` may use a more focused distribution but still receives the normal
  level budget;
- `elemental` may prioritize statistics appropriate to magical non-humanoid
  creatures.

A `caster` profile does not grant a RULE.

A `boss` profile does not create a separate power rating or additional budget.

Specific profile numbers remain balancing data and can be refined independently
from the architecture.

---

## 23. Final Architecture Summary

```text
Localized generator entry
        ↓
Structured narrative fields + technical mechanics
        ↓
Shared non-localized statistical profile
        ↓
Shared level budget and weighted stat allocation
        ↓
Character-specific or creature-specific generation policy
        ↓
Explicit fixed RULEs
        ↓
Selected modifiers
        ↓
Statistic changes, added traits, and explicit random RULEs
        ↓
Shared derived statistics and resources
        ↓
Concrete Character or Creature validation
        ↓
Atomic complete save with history and undo
```

The resulting design has one statistical system, one profile catalog, explicit
creature magic, mechanical modifiers, and two concrete persistent entity models
sharing the same combat foundations.
