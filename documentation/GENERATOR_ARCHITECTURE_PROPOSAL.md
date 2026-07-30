# Proposition d’architecture des générateurs

## Objectifs

Cette proposition étend le catalogue actuel sans supprimer ses capacités :

- sélection pondérée avec `weight` ;
- valeurs textuelles et entrées structurées avec `fields` ;
- séparation complète des données anglaises et françaises ;
- modificateurs indépendants applicables à plusieurs catégories ;
- modèles capables de référencer d’autres générateurs ;
- conservation atomique des champs liés, notamment pour les races ;
- génération de fiches complètes pour les personnages et les créatures ;
- partage des calculs de niveau, statistiques et ressources sans confondre leurs
  profils d’équilibrage ;
- catégories techniques réutilisables sans les exposer dans `/gen`.

La proposition décrit une cible. Elle ne modifie pas encore le comportement du bot.

## Arborescence

Les deux langues conservent exactement la même arborescence :

```text
data/generators/
├── en/
│   ├── categories/
│   │   ├── race.json
│   │   ├── region.json
│   │   └── ...
│   ├── components/
│   │   ├── animal.json
│   │   ├── monster.json
│   │   ├── companion.json
│   │   └── creature-stat-profile.json
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
  référence ou une commande spécialisée, notamment les archétypes de créature ;
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
      "generator": "faction",
      "select": "fields.Name"
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
      "generator": "faction",
      "select": "fields.Name"
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

## Génération de fiches complètes

`/gen` reste le générateur générique de contenu autonome ou composé. Les entités
destinées à agir avec les règles de jeu utilisent plutôt une chaîne de génération de
fiche :

- `/gen-char` crée et sauvegarde un personnage humanoïde complet ;
- `/gen-monster` crée et sauvegarde une créature complète ;
- les deux commandes partagent les calculs généraux de niveau, statistiques,
  initiative, réflexes, HP, AP et MD ;
- chacune utilise ensuite un profil propre pour les valeurs et capacités qui ne
  suivent pas les mêmes règles.

Le terme technique reste `md`, affiché `MD` en anglais et `DD` en français. Aucun
nouveau concept `DM` n’est introduit.

### Modèles et héritage

Les fiches reposent sur un modèle abstrait commun :

```text
Combatant
├── Character
└── Creature
```

`Combatant` porte uniquement l’état et le comportement partagés :

- identifiant immuable, créateur et niveau ;
- statistiques, initiative et réflexes ;
- ressources HP, AR, AP et MD ;
- personnalité éventuelle ;
- LOIs et effets de statut ;
- équipement, inventaire et encombrement.

`Character` étend `Combatant` avec :

- prénom et nom ;
- race, description raciale et dons raciaux ;
- apparence, histoire et objectifs ;
- talents.

`Creature` étend `Combatant` avec :

- nom et description ;
- la catégorie de génération source lorsqu’elle existe ;
- le profil statistique utilisé ;
- l’armure naturelle ;
- les modificateurs de créature.

`monster`, `animal` et `companion` ne sont pas des types de modèle. Ce sont seulement
des catégories de génération internes susceptibles de produire une instance de
`Creature`. Le discriminant persistant possède exactement deux valeurs :
`character` ou `creature`.

Une créature possède bien `equipment`, `inventory` et `encumbrance`. Lors d’une
génération aléatoire, `equipment` et `inventory` sont initialisés à des tableaux
vides et aucun objet n’est ajouté par défaut. Une règle ou opération ultérieure peut
les modifier normalement.

Les modèles concrets possèdent leur propre hydratation et leur propre validation.
Chacun fournit un accesseur `displayName` adapté à ses champs d’identité.
Le modèle abstrait ne doit ni connaître Discord, ni décider du format d’affichage,
ni effectuer directement une opération de persistance.

### Stockage et services communs

Les personnages existants conservent leur schéma et leur emplacement actuels. Les
créatures utilisent un schéma et un espace de stockage distincts :

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

Une façade commune, `entityApplicationService`, résout l’`EntityKey`, détermine le
modèle concret et délègue à `characterStore` ou `creatureStore`. Les opérations
communes de dégâts, soins, fin de tour, suppression et historique travaillent sur
l’interface de `Combatant`.

L’unicité d’une `EntityKey` est globale : une créature et un personnage ne peuvent
pas partager la même clé. La création et les mutations des deux modèles utilisent
la même file d’attente par clé afin de conserver les garanties de concurrence et de
publication atomique.

Les historiques restent validés par le schéma correspondant au modèle. Une
restauration ne peut jamais transformer un `Character` en `Creature` ou inversement.

### Commandes communes

La génération possède deux commandes spécialisées, mais les opérations de gestion
ne sont pas dupliquées :

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

Pour `/add`, `type` vaut `character` par défaut. Il s’agit du seul endroit où cette
option choisit un modèle concret. La valeur devient immuable dès la création.

L’option `type` de `/gen-monster` possède un autre rôle : elle choisit le catalogue
interne utilisé pour générer la créature. Elle ne crée jamais un troisième modèle.

Le catalogue canonique des champs ajoute une propriété `appliesTo` :

```js
{
  id: 'race',
  appliesTo: ['character']
}

{
  id: 'inventory',
  appliesTo: ['character', 'creature']
}
```

Après résolution de l’`entity-key`, `/get` et `/set` filtrent les champs selon le
modèle concret. Une créature ne propose donc ni race ni talents, mais peut afficher
et modifier ses statistiques, LOIs, effets de statut, équipement et inventaire.

Les autocomplétions des commandes communes fusionnent les clés accessibles des deux
stockages. Les permissions restent identiques : créateur de la fiche, rôle DM ou
propriétaire réel du serveur selon l’opération.

### Répartition des catégories

Les catégories sont réparties selon la fiche qu’elles alimentent :

| Catégorie | Pipeline | Rôle |
| --- | --- | --- |
| `name` | personnage | Source canonique des prénoms et noms de famille. |
| `background` et `background-*` | personnage | Apparence, histoire et objectifs, reliés à un type de background. |
| `race` | personnage | Nom, description et dons raciaux conservés dans la même entrée. |
| `animal` | créature interne | Animaux ordinaires ou fantastiques sélectionnés par `/gen-monster type:animal`. |
| `monster` | créature interne | Prédateurs et menaces surnaturelles sélectionnés par `/gen-monster type:monster`. |
| `companion` | créature interne | Familiers et animaux dressés sélectionnés par `/gen-monster type:companion`. |

`npc` et `criminal` ne font plus partie de l’architecture cible. Leur contenu est
absorbé par les sources déjà utilisées par `/gen-char`, puis leurs fichiers sont
supprimés.

`animal`, `monster` et `companion` restent des catalogues, mais deviennent
`visibility: "internal"`. Ils disparaissent de l’autocomplétion publique de `/gen`
et sont consommés par `/gen-monster` ou par les références d’un modèle.

### Absorption de `npc.json` et `criminal.json`

La migration est directe :

1. extraire les prénoms et noms exploitables de `npc.json` vers de nouvelles
   entrées de `name.json` ;
2. réécrire chaque description de `npc.json` comme un ensemble cohérent
   `Appearance`, `Backstory` et `Goals`, puis le classer dans le
   `background-*.json` correspondant ;
3. réécrire chaque concept de `criminal.json` comme une entrée complète
   `Appearance`, `Backstory` et `Goals` de `background-criminal.json`, sans lui
   créer de nom ;
4. attribuer `weight: 1` par défaut, sauf décision éditoriale explicite ;
5. vérifier l’absence de doublon dans les catalogues de destination ;
6. supprimer `npc.json` et `criminal.json` dans les deux langues ;
7. retirer ces deux catégories des catégories requises, de l’aide et de
   l’autocomplétion de `/gen`.

Exemple de nom migré :

```json
{
  "id": "mara-venn",
  "fields": {
    "FirstName": "Mara",
    "LastName": "Venn"
  }
}
```

Exemple de description migrée vers le background approprié :

```json
{
  "id": "rewritten-official-background",
  "fields": {
    "Appearance": "A precise official wearing a weather-stained red coat.",
    "Backstory": "They discovered that several royal records had been rewritten.",
    "Goals": "Recover the original records without exposing the colleague who warned them."
  }
}
```

Les noms et backgrounds deviennent volontairement indépendants après la migration.
Il n’existe donc aucun profil intermédiaire ni relation durable avec l’ancienne
entrée source.

`criminal.json` n’alimente jamais `name.json`. Ses concepts deviennent uniquement
des backgrounds criminels réutilisables avec n’importe quel nom sélectionné
indépendamment.

### `/gen-char`

Signature conservée :

```text
/gen-char character-key:<new key> [level] [background]
```

Comportement proposé :

1. valider l’unicité de la `CharacterKey` ;
2. choisir le niveau demandé ou tirer un niveau de 1 à 10 ;
3. choisir indépendamment un nom dans `name.json` ;
4. choisir le background demandé ou en tirer un dans `background.json` ;
5. sélectionner un ensemble `Appearance`, `Backstory` et `Goals` dans le
   `background-*` associé ;
6. sélectionner une race complète ;
7. générer statistiques, talents, LOIs, équipement, inventaire et ressources ;
8. sauvegarder la fiche par le service applicatif existant.

Le background `criminal` continue d’exister comme type de personnage et reçoit les
descriptions migrées depuis `criminal.json`. Seule l’ancienne catégorie autonome
`/gen criminal` disparaît.

### Structure d’un archétype de créature

Les entrées de `animal`, `monster` et `companion` deviennent structurées. Elles
conservent ensemble l’identité narrative et les paramètres qui pilotent la fiche :

```json
{
  "id": "grave-hound",
  "weight": 2,
  "fields": {
    "Name": "Grave Hound",
    "Description": "A corpse-fed pack hunter that follows the scent of fear.",
    "Stat Profile": "predator",
    "HP Multiplier": 1.2,
    "Natural AR": 0,
    "RULE Chance": 0.15,
    "Status Effect Chance": 0.1
  }
}
```

Champs obligatoires :

- `Name` ;
- `Description` ;
- `Stat Profile`.

Champs techniques optionnels :

- `HP Multiplier`, positif et égal à `1` par défaut ;
- `Natural AR`, pourcentage compris entre `0` et `100`, égal à `0` par défaut ;
- `RULE Chance`, comprise entre `0` et `1` ;
- `Status Effect Chance`, comprise entre `0` et `1` ;
- `RULE Generator`, égal à `rules` par défaut ;
- `Status Effect Generator`, égal à `status-effect` par défaut ;
- `Modifiers`, liste de générateurs de modificateurs compatibles.

Tous ces paramètres restent liés à l’archétype. Une créature ne peut pas recevoir le
profil statistique ou l’armure naturelle d’une entrée différente.

### Profils statistiques de créature

Les formules exactes des monstres ne sont pas encore définies dans le livre de
règles. Elles ne doivent donc pas être enfouies arbitrairement dans le code. Un
générateur interne `creature-stat-profile` décrit les contraintes de chaque famille :

```json
{
  "id": "predator",
  "fields": {
    "Minimum Stat": 4,
    "Maximum Stat": 20,
    "Budget Formula": "creature-standard",
    "Preferred Stats": "strength,dexterity,speed,perception",
    "AP Formula": "character-standard",
    "MD Formula": "character-standard"
  }
}
```

Les identifiants de formule sont techniques et résolus par
`creatureGenerationService`. Ils permettent de tester explicitement l’équilibrage
sans mettre des expressions exécutables dans les JSON.

Profils initiaux proposés :

- `animal` : profil physique dépendant de l’espèce, avec Intelligence et Charisme
  généralement plus faibles ;
- `companion` : profil moins offensif, privilégiant mobilité, perception ou
  capacités utilitaires ;
- `predator` : profil équilibré pour une menace physique ;
- `brute` : Constitution et Force prioritaires, vitesse et finesse réduites ;
- `caster` : Intelligence et Perception prioritaires, avec une probabilité de LOI
  plus élevée ;
- `boss` : budget renforcé et ressources supérieures, réservé à un modificateur ou
  un choix explicite.

Les nombres définitifs de ces profils constituent une décision d’équilibrage
distincte à valider avant l’implémentation.

### Calcul d’une fiche de créature

Une créature générée possède :

- un niveau compris entre 1 et 10 ;
- les sept statistiques de base ;
- initiative et réflexes dérivés de la vitesse ;
- HP, AP et MD complets ;
- AR uniquement si l’archétype, une armure ou un modificateur en accorde ;
- zéro ou plusieurs LOIs selon Intelligence, type et probabilité configurée ;
- zéro ou plusieurs effets de statut initiaux selon l’archétype ;
- les modificateurs indépendants sélectionnés ;
- une description et un type conservés depuis l’entrée source.

Les calculs généraux sont partagés avec la génération de personnage :

- HP dérivés de Constitution et du niveau, puis ajustés par `HP Multiplier` ;
- AP calculés avec la formule déclarée par le profil et toujours limités à 10 ;
- MD dérivés de la Vitesse ;
- initiative et réflexes recalculés depuis la Vitesse ;
- AR calculés comme un pourcentage des HP maximum.

Les LOIs utilisent les mêmes entrées `Name` et `Description` que les personnages,
mais leur nombre et leur niveau passent par une politique de créature. Un animal
ordinaire n’obtient pas de LOI par défaut ; un compagnon magique ou un monstre
`caster` peut en recevoir.

Les effets de statut générés représentent l’état initial de la rencontre. Ils ne
doivent pas être confondus avec les effets infligés en cours de combat.

### `/gen-monster`

Signature proposée :

```text
/gen-monster creature-key:<new key> type:<monster|animal|companion> [level]
```

- `creature-key` est obligatoire, stable et globalement unique parmi toutes les
  `EntityKey` ;
- `type` est obligatoire et utilise une autocomplétion issue des types de créature
  autorisés ;
- `level` est optionnel, compris entre 1 et 10 et tiré aléatoirement lorsqu’il est
  absent ;
- la commande reste réservée au rôle DM et au propriétaire réel du serveur ;
- l’ordre d’aide devient `/gen`, `/gen-char`, puis `/gen-monster`.

Le nom `/gen-monster` désigne ici le générateur de fiches de créature, même lorsque
`type` vaut `animal` ou `companion`.

Flux proposé :

```text
/gen-monster
  -> creatureApplicationService.generateCreature(...)
      -> creatureStore crée la sauvegarde de manière exclusive
      -> creatureGenerationService sélectionne l’archétype et le profil
      -> entityMechanics génère niveau, statistiques et ressources communes
      -> creatureGenerationService ajoute AR, LOIs, effets et modificateurs
  -> creatureCommandResponses produit la fiche localisée
```

`Creature` hérite des champs communs de `Combatant` au lieu de remplir
artificiellement les champs `race`, `background` ou `talents` d’un `Character`.
`creatureStore` conserve un schéma et un validateur dédiés, tandis que les services
de mécanique pure et les opérations communes sont partagés.

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
      rival: { generatorId: 'faction', entryId: 'black-banner-company' }
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

Les validateurs du catalogue et des fiches doivent rejeter avant activation :

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
- une catégorie source absente ou non autorisée par `/gen-monster` ;
- un profil statistique de créature absent ;
- une probabilité, un multiplicateur de HP ou un pourcentage d’AR hors limites ;
- une fiche générée dont le niveau, les statistiques, les ressources ou les AP
  violent les règles du domaine ;
- un discriminant de modèle différent de `character` ou `creature` ;
- une tentative de modifier le type concret d’une fiche existante ;
- une `EntityKey` déjà utilisée dans l’un ou l’autre stockage ;
- un champ demandé par `/get` ou `/set` dont `appliesTo` exclut le modèle concret ;
- une sauvegarde de créature contenant des champs réservés à `Character` ;
- un historique dont les instantanés ne correspondent pas tous au modèle actif ;
- une différence de structure ou de valeur technique entre les langues ;
- un résultat final dépassant les limites Discord.

Les validations spécifiques actuellement codées pour `race`, `armors`, `religion`,
`faction` et `government` peuvent progressivement être décrites par `entrySchema`.
Les règles véritablement métier, comme les quinze combinaisons type/rareté des
armures, restent des validations dédiées.

## Compatibilité et migration

Une migration sûre peut être effectuée par étapes :

1. terminer la correction éditoriale française en cours ;
2. migrer uniquement les noms de `npc.json` vers `name.json` dans les deux langues ;
3. réécrire et répartir les descriptions de `npc.json` dans les
   `background-*.json` correspondants, puis migrer tous les concepts de
   `criminal.json` dans `background-criminal.json` sans créer de noms ;
4. supprimer `npc.json` et `criminal.json`, puis mettre à jour les catégories
   requises, l’aide, l’autocomplétion et leurs tests ;
5. ajouter le schéma v2 et ses tests sans déplacer les autres données existantes ;
6. faire accepter au catalogue les formats v1 et v2 ;
7. ajouter les `id` stables et déplacer les fichiers dans l’arborescence miroir ;
8. conserver les trois anciennes formes d’entrée comme compatibilité v1 ;
9. migrer une catégorie autonome vers v2 et vérifier `/gen`, l’aide et
   l’autocomplétion ;
10. ajouter un premier modificateur interne, par exemple `monster-modifier` ;
11. ajouter un premier modèle référencé, par exemple `quest` ;
12. convertir `animal`, `monster` et `companion` en archétypes structurés internes
    et les retirer des choix publics de `/gen` ;
13. extraire `Combatant` de `Character` sans modifier le format des sauvegardes de
    personnages existantes ;
14. ajouter `Creature`, son schéma, son stockage et son historique dédiés ;
15. introduire la file d’attente et la façade applicative communes par `EntityKey` ;
16. généraliser `/get`, `/set`, `/damage`, `/heal`, `/end-turn`, `/delete` et
    `/undo` aux deux modèles ;
17. faire évoluer `/add` vers
    `entity-key:<new key> [type:<character|creature>]`, avec `character` par défaut ;
18. implémenter et tester les profils statistiques de créature ;
19. ajouter `/gen-monster` après validation des formules d’équilibrage ;
20. migrer ensuite les autres catégories sans modifier simultanément leur contenu.

L’absorption de `npc` et `criminal` est un nettoyage de contenu préalable. Elle ne
nécessite ni profil intermédiaire, ni nouveau mécanisme de référence, et simplifie
le refactor v2 en réduisant le nombre de catégories à migrer.
