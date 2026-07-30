# Proposition d’architecture des générateurs

## Objectifs

Cette proposition étend le catalogue actuel sans supprimer ses capacités :

- sélection pondérée avec `weight` ;
- valeurs textuelles et entrées structurées avec `fields` ;
- séparation complète des données anglaises et françaises ;
- modificateurs indépendants applicables à plusieurs catégories ;
- modèles capables de référencer d’autres générateurs ;
- conservation atomique des champs liés, notamment pour les races ;
- catégories techniques réutilisables sans les exposer dans `/gen`.

La proposition décrit une cible. Elle ne modifie pas encore le comportement du bot.

## Arborescence

Les deux langues conservent exactement la même arborescence :

```text
data/generators/
├── en/
│   ├── categories/
│   │   ├── race.json
│   │   ├── monster.json
│   │   └── ...
│   ├── components/
│   │   ├── npc-age.json
│   │   └── npc-occupation.json
│   ├── modifiers/
│   │   ├── monster.json
│   │   └── site.json
│   └── templates/
│       └── quest.json
└── fr/
    ├── categories/
    ├── components/
    ├── modifiers/
    └── templates/
```

Les rôles des dossiers sont les suivants :

- `categories/` contient les générateurs autonomes visibles dans `/gen` ;
- `components/` contient les générateurs auxiliaires uniquement appelés par une
  référence, par exemple un âge ou un métier de PNJ ;
- `modifiers/` contient les transformations indépendantes applicables à un résultat ;
- `templates/` contient les générateurs composés destinés à résoudre plusieurs
  références, comme les quêtes.

Le chargeur parcourt les quatre dossiers, mais `listGenerators()` ne retourne par
défaut que les catégories et modèles déclarés publics.

## Enveloppe commune d’un générateur

Chaque fichier utilise une enveloppe versionnée :

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

### Propriétés techniques

- `schemaVersion` sélectionne le validateur et permet une migration contrôlée.
- `id` est un identifiant anglais stable, identique dans toutes les langues.
- `kind` vaut `category`, `component`, `modifier` ou `template`.
- `visibility` vaut `public` ou `internal`.
- `entrySchema` décrit la forme attendue de toutes les entrées du fichier.

### Propriétés localisées

- `name` est le libellé affiché dans l’autocomplétion et les réponses.
- `description` est le résumé localisé de la catégorie.

L’identifiant ne doit plus être dérivé de `name`. Un libellé français peut ainsi
évoluer sans modifier les références techniques.

## Formes d’entrée

Chaque entrée possède un `id` stable et un `weight` positif. `weight` vaut `1` par
défaut lorsqu’il est omis. Une entrée définit exactement l’une des propriétés
`value`, `fields` ou `template`.

### Valeur textuelle

```json
{
  "id": "forest-at-dusk",
  "weight": 3,
  "value": "A forest path disappears as night falls."
}
```

Cette forme convient aux événements, personnalités et autres résultats constitués
d’un seul texte.

### Entrée structurée

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

Tous les champs appartiennent à la même entrée et sont sélectionnés ensemble. Une
race ne peut donc jamais recevoir le nom d’une entrée, la description d’une autre et
les dons raciaux d’une troisième.

Les clés de champ restent techniques et anglaises dans toutes les langues. Les
valeurs destinées au joueur sont localisées ; les nombres et valeurs techniques
restent identiques.

### Modèle avec références

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
      "generator": "criminal",
      "select": "display"
    }
  }
}
```

Les noms `item`, `site` et `rival` sont des identifiants techniques stables. Le
texte français conserve exactement les mêmes marqueurs :

```json
{
  "id": "recover-item-before-rivals",
  "weight": 2,
  "template": "Retrouver {{item}} dans {{site}} avant que {{rival}} ne s’en empare.",
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
      "generator": "criminal",
      "select": "display"
    }
  }
}
```

`select` détermine ce qui est injecté :

- `value` sélectionne la valeur textuelle ;
- `fields.Name` sélectionne un champ précis ;
- `fields` conserve l’objet structuré complet ;
- `display` demande au service de produire la représentation principale adaptée au
  type de l’entrée.

Une référence peut également sélectionner une catégorie parmi plusieurs :

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

Le poids d’une source choisit le générateur ; le poids des entrées choisit ensuite
le résultat à l’intérieur de ce générateur. Ces deux niveaux restent indépendants.

## Modificateurs indépendants

Un fichier de modificateurs déclare explicitement ses cibles :

```json
{
  "schemaVersion": 2,
  "id": "monster-modifier",
  "kind": "modifier",
  "visibility": "internal",
  "name": "Monster modifiers",
  "description": "Independent alterations applied to generated monsters",
  "appliesTo": ["monster"],
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
        "Description": "The creature gains reach and strength but struggles in confined spaces."
      }
    }
  ]
}
```

Une catégorie ou une entrée peut demander des modificateurs :

```json
{
  "modifiers": [
    {
      "generator": "monster-modifier",
      "chance": 0.25,
      "count": {
        "min": 1,
        "max": 1
      }
    }
  ]
}
```

- `chance` est évalué une fois avant tout tirage de modificateur.
- `count` limite le nombre de résultats.
- Un même modificateur n’est pas choisi deux fois lors d’une résolution.
- Le validateur refuse un modificateur dont `appliesTo` ne contient pas la
  catégorie cible.
- Un modificateur reste un résultat distinct ; il ne réécrit pas silencieusement
  les champs de l’entrée de base.

Cette séparation permet à la réponse Discord d’afficher clairement :

```text
Monster: Grave Hound
Modifier: Gigantic
Modifier effect: The creature gains reach and strength...
```

## Composition d’un PNJ

Les anciennes listes d’âge et de métier deviennent des composants internes :

```json
{
  "schemaVersion": 2,
  "id": "npc-profile",
  "kind": "template",
  "visibility": "public",
  "name": "Generated NPC",
  "description": "A non-player character assembled from reusable components",
  "entrySchema": {
    "type": "template"
  },
  "entries": [
    {
      "id": "standard-npc",
      "template": "{{name}} is {{age}}, works as {{occupation}}, and is {{personality}}.",
      "references": {
        "name": {
          "generator": "name",
          "select": "display"
        },
        "age": {
          "generator": "npc-age",
          "select": "value"
        },
        "occupation": {
          "generator": "npc-occupation",
          "select": "value"
        },
        "personality": {
          "generator": "personality",
          "select": "value"
        }
      }
    }
  ]
}
```

Les catégories auxiliaires restent absentes de l’autocomplétion, mais peuvent aussi
être réutilisées par un modèle de criminel, de compagnon ou de faction.

## Résultat de résolution

Le service ne doit pas seulement retourner une chaîne finale. Il conserve une
structure permettant à la présentation Discord de choisir un texte, des champs ou
plusieurs sections :

```js
{
  category: {
    id: 'quest',
    name: 'Quests',
    locale: 'en'
  },
  entryId: 'recover-item-before-rivals',
  output: {
    type: 'template',
    text: 'Recover the sealed grimoire from the abandoned prison...',
    references: {
      item: { generatorId: 'inventory', entryId: 'sealed-grimoire' },
      site: { generatorId: 'dungeon', entryId: 'abandoned-prison' },
      rival: { generatorId: 'criminal', entryId: 'corrupt-patrol' }
    },
    modifiers: []
  }
}
```

Les identifiants et la trace de résolution facilitent les tests déterministes, le
diagnostic des données et une future option permettant de régénérer seulement une
composante.

## Service de résolution

La logique doit rester dans les services et non dans la commande `/gen`.

```text
/gen
  -> generatorResolver.generate(categoryId, locale, random)
      -> generatorCatalog charge et valide les fichiers
      -> weightedSelector choisit les entrées
      -> referenceResolver résout les modèles récursivement
      -> modifierResolver applique les modificateurs compatibles
  -> generatorResponses transforme le résultat en réponse Discord
```

API proposée :

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

La profondeur maximale empêche les cycles infinis. La pile des identifiants visités
permet de produire une erreur précise lorsqu’un cycle est détecté.

## Règles de localisation

La structure anglaise est la référence. Pour chaque fichier français :

1. le chemin relatif est identique ;
2. `schemaVersion`, `id`, `kind`, `visibility`, `entrySchema` et `appliesTo` sont
   identiques ;
3. les entrées possèdent les mêmes `id`, dans le même ordre ;
4. les `weight`, références, sélecteurs, chances et comptes sont identiques ;
5. les clés de `fields` restent anglaises ;
6. les valeurs techniques comme `Type`, `Rarity`, `Encumbrance`, identifiants de
   générateur et marqueurs de modèle restent identiques ;
7. seuls les libellés et textes destinés au joueur sont rédigés dans la langue
   cible ;
8. chaque traduction est relue dans le contexte de l’entrée complète.

Les entrées sont alignées par `id`, et non uniquement par leur position. L’ordre
reste néanmoins identique afin qu’un générateur déterministe produise la même entrée
conceptuelle dans les deux langues.

## Validation

Le chargeur doit rejeter avant activation :

- un fichier dont la version ou le rôle est inconnu ;
- un `id` de générateur ou d’entrée dupliqué ;
- une entrée ne définissant pas exactement l’un de `value`, `fields` ou `template` ;
- un poids, une chance ou un compte invalide ;
- un champ obligatoire manquant ;
- une référence vers un générateur absent ou non compatible ;
- un marqueur de modèle sans référence, ou une référence inutilisée ;
- un sélecteur visant un champ absent du schéma de la source ;
- un modificateur appliqué à une catégorie non déclarée dans `appliesTo` ;
- un cycle de références ;
- une différence de structure ou de valeur technique entre les langues ;
- un résultat final dépassant les limites Discord.

Les validations spécifiques actuellement codées pour `race`, `armors`, `religion`,
`faction` et `government` peuvent progressivement être décrites par `entrySchema`.
Les règles véritablement métier, comme les quinze combinaisons type/rareté des
armures, restent des validations dédiées.

## Compatibilité et migration

Une migration sûre peut être effectuée par étapes :

1. ajouter le schéma v2 et ses tests sans déplacer les données existantes ;
2. faire accepter au catalogue les formats v1 et v2 ;
3. ajouter les `id` stables et déplacer les fichiers dans l’arborescence miroir ;
4. conserver les trois anciennes formes d’entrée comme compatibilité v1 ;
5. migrer une catégorie autonome vers v2 et vérifier `/gen`, l’aide et
   l’autocomplétion ;
6. ajouter un premier modificateur interne, par exemple `monster-modifier` ;
7. ajouter un premier modèle référencé, par exemple `quest` ;
8. migrer ensuite les autres catégories sans modifier simultanément leur contenu.

Les fichiers français actuellement en correction ne devraient être déplacés qu’une
fois leur révision terminée, afin de séparer clairement correction éditoriale et
migration structurelle.
