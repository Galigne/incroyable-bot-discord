# A Random Adventure — matériau historique nettoyé

> Ce document conserve les idées réutilisables de l’ancien livre de règles. Il ne
> constitue pas encore un catalogue JSON prêt à importer. Les anciennes plages de
> jets ont été supprimées ; lorsqu’elles indiquaient une fréquence volontaire,
> celle-ci est exprimée directement par un `weight`. Les identifiants entre
> parenthèses correspondent aux catégories actuelles de `data/generators/`.

## Principe historique

**A Random Adventure** proposait un JDR d’improvisation dans lequel le MJ découvrait
le monde et les complications en même temps que les joueurs. Les tables servaient à
produire rapidement des lieux, personnages, créatures, objets, pouvoirs et
objectifs, dans un registre pouvant aller de l’aventure sérieuse à l’absurde.

L’idée centrale à conserver est la combinaison de résultats autonomes : un objectif
peut référencer un PNJ, un lieu ou un objet, tandis qu’un lieu ou un monstre peut
recevoir un modificateur indépendant.

## Anciennes statistiques

Cette section reste un repère historique et ne remplace pas les règles actuelles.

| Statistique | Rôle historique |
| --- | --- |
| Constitution | Détermine les PV, la résistance physique, la ténacité face au climat et la résistance aux effets de statut. |
| Force | Représente la puissance musculaire, le maniement des armes lourdes, le blocage et le transport de charges. |
| Dextérité | Représente la précision, la rapidité des mouvements, l’esquive et le maniement des armes légères ou à distance. |
| Intelligence | Représente les connaissances, la réflexion et la maîtrise des pouvoirs ; elle limitait également le nombre de LOIs. |
| Vitesse | Représente la course, l’endurance et la vivacité ; elle participait au calcul des PA, de l’initiative et des réflexes. |
| Perception | Représente les sens, l’instinct, la visée, l’empathie et la détection des mensonges ou dangers. |
| Charisme | Représente l’aisance sociale, le marchandage, le commandement, l’intimidation et le contrôle émotionnel. |

## Candidats pour les générateurs actuels

### Régions (`region`)

- **Forêt profonde** — Un massif ancien parcouru de sentiers effacés, de clairières
  isolées et de territoires revendiqués par la faune.
- **Jungle étouffante** — Une végétation dense, des pluies violentes et des ruines
  que les racines engloutissent peu à peu.
- **Désert aride** — Une étendue de dunes et de plateaux rocheux où les points d’eau
  dictent les routes et les conflits.
- **Prairie ouverte** — De vastes terres herbeuses exposées au vent, propices aux
  troupeaux, aux voyageurs et aux embuscades visibles de loin.
- **Région lacustre** — Un ensemble de lacs, d’îlots et de villages de pêche reliés
  par des barques et des chemins inondables.
- **Côte de falaises** — Un littoral escarpé creusé de criques, de grottes marines
  et de passages dangereux.
- **Vallée fluviale** — Une région fertile organisée autour d’un fleuve, de ponts
  fortifiés et de ports concurrents.
- **Chaîne montagneuse** — Des sommets difficiles d’accès abritant mines,
  monastères et cols stratégiques.
- **Banquise** — Une mer gelée instable où les pistes changent avec les fractures et
  les migrations animales.
- **Glacier monumental** — Une masse de glace parcourue de crevasses, de cavernes
  bleutées et de vestiges emprisonnés.
- **Archipel** — Des îles séparées par des récifs, des courants imprévisibles et des
  routes maritimes disputées.
- **Archipel flottant** — Des terres suspendues reliées par des ponts, des vaisseaux
  volants et des cascades tombant dans le vide.
- **Hautes terres volcaniques** — Des pentes de cendre, des sources brûlantes et des
  filons précieux dominés par un volcan actif.
- **Marais brumeux** — Des eaux peu profondes, des tourbières et des îlots dont les
  chemins changent avec les saisons.
- **Collines agricoles** — Des cultures en terrasses, des fermes dispersées et des
  routes de marché surveillées.
- **Champ de bataille abandonné** — Un territoire marqué par les tranchées, les
  épaves et les traces surnaturelles d’une ancienne guerre.
- **Région céleste** — Des courants aériens, des nuages solides et des phénomènes
  météorologiques formant un territoire praticable mais instable.

### Communautés (`settlement`)

- **Village agricole** — Une petite communauté centrée sur les granges, le moulin,
  le marché hebdomadaire et les terres communes.
- **Ville marchande** — Un centre régional animé par les guildes, les entrepôts, les
  taxes et les rivalités commerciales.
- **Port fortifié** — Des quais protégés par des tours, une capitainerie exigeante et
  des quartiers de marins venus de loin.
- **Campement nomade** — Des habitations mobiles organisées autour des troupeaux,
  des artisans et du conseil de clan.
- **Camp militaire** — Une implantation temporaire de soldats, d’ingénieurs, de
  soigneurs et de fournisseurs civils.
- **Capitale** — Une métropole où palais, administrations, casernes, marchés et
  quartiers populaires se disputent l’espace.
- **Ville souterraine** — Une communauté construite autour de puits, de cavernes et
  d’anciennes machines dans un réseau privé de lumière naturelle.
- **Ville flottante** — Des navires et plateformes reliés en permanence autour d’un
  mouillage, d’un récif ou d’une créature gigantesque.
- **Bidonville** — Un quartier dense bâti avec des matériaux récupérés, animé par
  des réseaux d’entraide et des autorités informelles.
- **Enclave tribale** — Une communauté resserrée autour d’une tradition, d’un
  territoire sacré et d’une autorité coutumière.

### Sites d’aventure (`dungeon`)

- **Ruines oubliées** — Les restes instables d’un domaine abandonné, encore protégés
  par des pièges, des gardiens ou des serments.
- **Mine condamnée** — Des galeries désertées après un accident dont les causes
  officielles ne correspondent pas aux traces laissées sous terre.
- **Grotte habitée** — Un réseau naturel occupé par une créature, une communauté ou
  des fugitifs ayant adapté les lieux.
- **Prison désaffectée** — Des cellules, archives et passages de service où demeure
  la preuve d’une détention effacée de l’histoire.
- **Égouts anciens** — Un réseau plus vaste que la ville actuelle, reliant citernes,
  cryptes et fondations interdites.
- **Cimetière profané** — Des tombes ouvertes et des monuments déplacés autour d’un
  caveau que quelqu’un cherche à atteindre.
- **Cratère anormal** — Une dépression récente où la pierre, la magie ou le temps se
  comportent différemment.
- **Sanctuaire en ruine** — Une chapelle ou un temple abandonné dont les rites
  continuent à produire des effets sans officiant.

### Bâtiments (`building`)

- **Musée municipal** — Une collection locale mal surveillée contient un objet dont
  l’origine officielle est mensongère.
- **Bibliothèque** — Les ouvrages les plus consultés ont tous perdu la même page,
  tandis qu’un rayon condamné semble encore fréquenté.
- **Magasin général** — Une échoppe encombrée où le propriétaire connaît les besoins
  des visiteurs avant qu’ils ne les expriment.
- **Caserne** — Une garnison sous tension tente de dissimuler la disparition
  répétée de ses sentinelles.
- **Armurerie** — Un atelier sécurisé vend et répare des armes, mais refuse
  d’expliquer la provenance d’une commande prestigieuse.
- **Mairie** — Les registres municipaux contredisent les souvenirs des habitants au
  sujet d’un quartier entier.
- **Taverne** — Un établissement bruyant où circulent rumeurs, contrats et messages
  destinés à des clients absents.
- **Restaurant** — Une cuisine réputée dépend d’un ingrédient rare dont
  l’approvisionnement vient de s’interrompre.
- **Auberge** — Des chambres simples entourent une salle commune où voyageurs et
  habitants échangent nouvelles et soupçons.
- **Maison de ville** — Une habitation mitoyenne cache des pièces dont les fenêtres
  ne correspondent pas à la façade.
- **Ferme isolée** — Les récoltes sont excellentes malgré un sol stérile et la
  famille refuse toute inspection.
- **Parc public** — Des statues, kiosques et allées composent à la nuit tombée un
  plan différent de celui visible le jour.
- **Jardin clos** — Des plantes rares prospèrent autour d’une serre dont personne
  ne possède officiellement la clé.
- **Banque** — Des coffres protégés par des gardes et des sceaux contiennent aussi
  des dépôts que leurs propriétaires souhaitent oublier.
- **Fontaine monumentale** — Les offrandes jetées dans l’eau réapparaissent dans les
  poches de personnes inconnues.
- **Place publique** — Marchés, proclamations et manifestations se disputent un
  espace dominé par un monument controversé.
- **Église** — Une communauté religieuse active entretient un lieu de culte dont la
  crypte est plus ancienne que la ville.
- **Cathédrale** — Un vaste édifice sert autant de centre spirituel que d’institution
  politique et conserve des reliques jalousement gardées.
- **Grande porte** — L’accès principal de la ville concentre gardes, taxes,
  voyageurs bloqués et marchandises suspectes.
- **Boulangerie-pâtisserie** — Le four communal fonctionne sans combustible depuis
  plusieurs nuits et attire des visiteurs après la fermeture.
- **Boucherie-charcuterie** — Le commerce reçoit une viande inhabituelle dont le
  fournisseur ne figure dans aucun registre.
- **Échoppe d’artisan** — Un atelier exigu fabrique un objet remarquable au prix
  d’un délai ou d’un matériau difficile à obtenir.
- **Écurie** — Montures, palefreniers et voyageurs de passage entourent un animal
  que personne ne parvient à approcher.
- **Manoir** — Une demeure prestigieuse réunit domestiques, invités et héritiers
  autour d’un secret familial.
- **Prison** — L’administration affirme qu’une cellule occupée depuis des années
  n’a jamais existé.
- **Brocante** — Des objets ordinaires côtoient des souvenirs volés et des reliques
  dont le vendeur ignore la véritable fonction.
- **Immeuble populaire** — De nombreux foyers partagent escaliers, cour intérieure
  et conflits de voisinage autour d’un appartement muré.
- **Décharge** — Des récupérateurs fouillent des montagnes de déchets autour d’un
  objet qui transforme lentement les matériaux voisins.
- **Casse mécanique** — Des carcasses de machines et de véhicules servent de
  réserve de pièces à un mécanicien très protecteur.

### Armes (`weapons`)

Ces candidats suivent les champs actuels `Name`, `Description` et `Encumbrance`.

| Name | Description | Encumbrance |
| --- | --- | ---: |
| Épée longue | Une lame polyvalente à une main, adaptée aux tailles comme aux attaques d’estoc. | 2 |
| Dague | Une lame courte, facile à dissimuler et utile au combat comme pour les travaux précis. | 1 |
| Lance | Une arme d’hast simple offrant allonge, contrôle de l’espace et efficacité contre une charge. | 2 |
| Harpon | Une lourde pointe barbelée reliée à une corde, conçue pour retenir une cible après l’impact. | 2 |
| Hallebarde | Une arme d’hast combinant pointe, lame de hache et crochet pour menacer plusieurs types de défense. | 3 |
| Morgenstern | Une masse hérissée concentrant son impact sur une petite surface. | 2 |
| Massue | Une arme contondante robuste, facile à fabriquer et efficace pour repousser un adversaire. | 2 |
| Katana | Une longue lame courbe privilégiant les coupes rapides et un maniement précis à deux mains. | 2 |
| Sabre | Une lame courbe à une main, légère et adaptée au combat mobile. | 1 |
| Fléau | Une masse articulée difficile à maîtriser, capable de contourner certaines gardes. | 2 |
| Lames jumelles | Deux armes courtes équilibrées pour un style rapide exigeant coordination et proximité. | 2 |
| Hache de bataille | Une arme de taille puissante, efficace contre les boucliers et les obstacles en bois. | 2 |
| Marteau de guerre | Une arme lourde concentrant sa force contre les armures rigides et les structures. | 2 |
| Grande hache | Une arme massive à deux mains produisant des frappes larges au prix d’une défense réduite. | 3 |
| Grand marteau | Un marteau à deux mains extrêmement lourd, conçu pour briser protections et fortifications. | 3 |
| Faux de guerre | Une longue lame recourbée transformée en arme d’hast pour accrocher et faucher. | 2 |
| Fouet | Une arme flexible utile pour maintenir la distance, désarmer ou entraver une cible. | 1 |
| Griffes de combat | Des lames fixées aux mains qui prolongent les attaques naturelles sans libérer la prise. | 1 |
| Arc long | Un arc puissant exigeant de l’espace et de la force, efficace à grande distance. | 2 |
| Arbalète | Une arme mécanique précise dont la puissance compense un rechargement plus lent. | 2 |
| Baguette de combat | Un focaliseur court et renforcé permettant de canaliser une LOI tout en parant des coups légers. | 1 |
| Sceptre de combat | Un focaliseur robuste pouvant servir de masse légère lorsque la magie devient impraticable. | 2 |
| Baliste portative | Une arbalète démesurée montée sur support, très puissante mais longue à déplacer et préparer. | 4 |

### Inventaire (`inventory`)

Ces candidats suivent les champs actuels `Name`, `Description` et `Encumbrance`.

| Name | Description | Encumbrance |
| --- | --- | ---: |
| Bourse de pièces | Une somme de monnaie locale mêlant petites pièces courantes et devises plus difficiles à écouler. | 0 |
| Potion de soin | Une fiole stabilisée qui facilite la récupération d’une blessure lorsqu’elle est utilisée correctement. | 0 |
| Potion de vigueur | Un breuvage augmentant brièvement les capacités physiques avant de provoquer une forte fatigue. | 0 |
| Parchemin de LOI | Un support à usage unique permettant de déclencher une LOI précise sans l’avoir apprise. | 0 |
| Livre de LOI | Un traité rare expliquant une LOI, ses applications et les risques liés à une mauvaise interprétation. | 1 |
| Outils d’excavation | Un crochet, une petite pioche et une pelle repliable pour fouiller ou franchir un terrain difficile. | 2 |
| Clef inconnue | Une clef sans serrure identifiée, marquée d’un symbole correspondant à une organisation ou un bâtiment. | 0 |
| Notes chiffrées | Plusieurs pages de notes dont le sens dépend d’un code, d’un contexte ou d’une personne disparue. | 0 |
| Munitions spécialisées | Un petit lot de projectiles adaptés à une arme précise ou à une cible inhabituelle. | 1 |
| Bijou précieux | Une pièce de joaillerie identifiable, facile à transporter mais risquée à revendre. | 0 |
| Essence élémentaire | Une substance instable conservant les propriétés d’un élément naturel ou magique. | 0 |
| Carte au trésor | Un itinéraire incomplet accompagné de repères anciens, d’avertissements et d’une destination ambiguë. | 0 |
| Papier de qualité | Des feuilles et un parchemin vierges adaptés aux contrats, cartes, sorts ou faux documents. | 0 |
| Poupée cérémonielle | Une figurine de tissu portant le nom effacé d’une personne et les traces d’un ancien rituel. | 0 |
| Grimoire verrouillé | Un livre protégé par une serrure ou une énigme, dont le contenu ne peut être consulté directement. | 1 |
| Jouet ancien | Un jouet ou ours en peluche reconnaissable par une famille, un collectionneur ou un esprit. | 0 |
| Fragment de créature | Une écaille, peau, corne ou dent conservée comme trophée, preuve ou composant. | 1 |
| Médicament rare | Un traitement destiné à une maladie précise, fragile et difficile à remplacer. | 0 |
| Plante médicinale | Une plante fraîche dont l’efficacité dépend de sa préparation et de son état de conservation. | 0 |
| Ingrédient alchimique | Un composant organique inhabituel, comme un œil de crapaud ou une glande venimeuse. | 0 |
| Œuvre d’art | Un tableau, une sculpture ou une pièce décorative possédant une valeur culturelle identifiable. | 2 |
| Vêtement de cérémonie | Une robe, cape, paire de bottes ou paire de gants associée à un rang ou une institution. | 1 |
| Couronne inachevée | Un symbole d’autorité auquel manque une gemme, une inscription ou une partie essentielle. | 1 |
| Instrument de musique | Un luth, tambour, violon ou autre instrument transportable, usé mais fonctionnel. | 1 |
| Peigne ouvragé | Un objet personnel décoré d’un blason discret ou d’une inscription intime. | 0 |
| Manuscrit incomplet | Un texte historique ou scientifique dont plusieurs pages ont été retirées intentionnellement. | 0 |
| Vase scellé | Un récipient fragile dont le contenu produit un bruit ou une chaleur inhabituelle. | 1 |
| Fruit exotique | Un fruit rare dont la graine, la saveur ou les propriétés intéressent plusieurs acheteurs. | 0 |
| Figurine de collection | Une pièce d’une série recherchée, insignifiante seule mais précieuse pour la bonne personne. | 0 |
| Brosse à dents enchantée | Un objet absurdement spécifique qui nettoie parfaitement les dents et mord les autres saletés. | 0 |
| Œuf non identifié | Un œuf vivant dont l’espèce, les besoins et le danger restent inconnus. | 1 |
| Pierre accordée | Une pierre minérale ou magique réagissant à un lieu, une personne ou une LOI particulière. | 0 |
| Poulet de voyage | Un poulet étonnamment calme, dressé à suivre le porteur et à signaler certaines créatures. | 1 |

### Races (`race`)

Ces candidats conservent ensemble les champs obligatoires `Name`, `Description`,
`Skill Bonus` et `Physical Ability`.

| Name | Description | Skill Bonus | Physical Ability |
| --- | --- | --- | --- |
| Humain | Des communautés très diverses dont les traditions reposent sur l’adaptation, les alliances et la transmission rapide des savoirs. | Polyvalence : bonus dans une compétence choisie à la création. | Endurance adaptable : supporte mieux un changement brutal de climat ou de rythme. |
| Elfe | Un peuple longévif aux sens précis, attaché à la mémoire des lieux et aux conséquences lointaines de chaque décision. | Perception attentive des détails naturels et magiques. | Vision crépusculaire efficace sous une faible lumière. |
| Nain | Un peuple de bâtisseurs vivant dans des communautés où la maîtrise artisanale et la parole donnée définissent le statut. | Artisanat de la pierre, du métal ou des mécanismes. | Stabilité : résiste mieux aux chocs et aux déplacements forcés. |
| Orque | Un peuple robuste organisé autour de liens communautaires, de défis publics et d’une forte tradition orale. | Intimidation ou survie en territoire hostile. | Puissance physique lors d’un effort bref et intense. |
| Gobelin | Un peuple ingénieux qui transforme rapidement déchets, outils et occasions imprévues en solutions utiles. | Bricolage, pièges et récupération de matériaux. | Petite taille : se faufile dans les passages étroits et les couverts encombrés. |
| Halfelin | Un peuple de voyageurs et de communautés rurales valorisant hospitalité, discrétion et récits partagés. | Discrétion dans les foules ou les environnements domestiques. | Appuis rapides : conserve plus facilement son équilibre. |
| Reptilien | Un peuple écailleux adapté aux climats chauds, aux longues périodes d’immobilité et aux environnements humides. | Pistage par les traces, la chaleur et les odeurs. | Écailles naturelles offrant une protection légère. |
| Peuple-poisson | Un peuple amphibie vivant entre communautés côtières, récifs et cités partiellement immergées. | Navigation, pêche et connaissance des courants. | Respiration aquatique et déplacement naturel sous l’eau. |
| Avian | Un peuple à plumes vivant sur les hauteurs et accordant une grande importance aux courants, aux distances et aux messages. | Observation à longue distance et orientation aérienne. | Vol plané permettant de ralentir une chute et franchir de courtes distances. |
| Sylvestre | Un peuple végétal ou étroitement lié aux arbres, dont la mémoire se transmet par les saisons et les racines. | Connaissance des plantes et communication avec les écosystèmes. | Photosynthèse : peut se soutenir brièvement avec lumière et eau. |
| Homme-limace | Un peuple souple adapté aux milieux humides, aux surfaces verticales et aux espaces difficiles d’accès. | Détection des substances par le toucher et le goût. | Adhérence : se déplace lentement sur des surfaces très inclinées. |
| Homme-bête | Un ensemble de lignées humanoïdes partageant des traits animaux et des traditions fortement liées à leur environnement. | Instinct et interaction avec l’espèce apparentée. | Sens animal développé choisi selon la lignée. |
| Fée | Un petit peuple surnaturel lié aux promesses, aux émotions et aux lieux chargés de magie. | Lecture des intentions et connaissance des pactes. | Lévitation ou vol limité avec une charge légère. |
| Géant | Un peuple de très grande taille dont les habitats, outils et récits sont conçus à une échelle inhabituelle. | Travail de force et connaissance des terrains monumentaux. | Allonge et capacité de port nettement supérieures. |
| Centaure | Un peuple nomade au torse humanoïde et au corps de quadrupède, adapté aux grands espaces et aux déplacements prolongés. | Voyage terrestre, pistage et combat monté. | Course rapide sur terrain ouvert et grande capacité de transport. |

### PNJ (`npc`)

Les trois entrées suffisamment définies peuvent devenir des PNJ complets :

| Name | Description |
| --- | --- |
| Arth le Scribe | Un chroniqueur méticuleux qui consigne les contradictions de l’histoire officielle et conserve plusieurs versions de chaque événement. |
| Laria | Une chasseuse de démons trahie par son propre peuple après avoir aimé l’un de ses ennemis ; sa quête de vengeance masque encore des sentiments irrésolus. |
| Drowi | Un alchimiste lutin au service de la cour, capricieux et amusant, qui présente ses expériences dangereuses comme de simples plaisanteries. |

Les anciennes composantes suivantes sont plus utiles comme générateurs auxiliaires
référencés par un modèle de PNJ que comme entrées autonomes de `npc`.

#### Âges de PNJ

- Enfant curieux placé dans une situation d’adulte.
- Jeune adulte impatient de prouver sa valeur.
- Adulte expérimenté protégeant une position acquise.
- Personne âgée disposant d’une mémoire ou d’une réputation précieuse.

#### Métiers et statuts de PNJ

- **Pouvoir et administration :** souverain, prince, maire, noble, ministre,
  général, commandant, capitaine, geôlier.
- **Protection et violence :** garde, soldat, gardien, guerrier, chasseur,
  chasseur de primes, bourreau, assassin, protecteur.
- **Production et commerce :** paysan, bûcheron, mineur, berger, pêcheur, boucher,
  poissonnier, pâtissier, cuisinier, marchand, brocanteur.
- **Artisanat et technique :** artisan, forgeron, mécanicien, ingénieur, technicien,
  conducteur, pilote.
- **Savoir et soin :** scientifique, chercheur, scribe, médecin, sage, conteur.
- **Voyage et exploration :** explorateur, voyageur, nomade, pirate, capitaine
  pirate, éclaireur, traceur.
- **Religion :** prêtre, fanatique, prophète, moine, ermite, mage.
- **Spectacle et société :** tavernier, chanteur, troubadour, célébrité, citadin.
- **Marges et captivité :** voleur, révolutionnaire, prisonnier, fugitif sans-abri.

### Personnalités (`personality`)

Chaque entrée est une personnalité jouable plutôt qu’un adjectif isolé. Le `weight`
conserve seulement les fréquences clairement présentes dans l’ancienne table.

| value | weight |
| --- | ---: |
| Accueillant et attentionné, met spontanément les nouveaux venus à l’aise mais s’implique trop vite dans leurs problèmes. | 1 |
| Ambitieux, mesure chaque relation à l’aune de ce qu’elle peut lui permettre d’accomplir. | 1 |
| Amusant et joueur, détourne les situations tendues par l’humour même lorsque le moment s’y prête mal. | 2 |
| Arrogant, considère sa compétence comme une évidence et vit toute correction comme une attaque personnelle. | 2 |
| Artiste passionné, recherche la beauté jusque dans les lieux dangereux et néglige parfois les besoins pratiques. | 2 |
| Autoritaire, organise naturellement les autres mais supporte difficilement qu’une décision lui échappe. | 2 |
| Avare, conserve argent, informations et faveurs jusqu’à ce que leur dépense soit absolument nécessaire. | 2 |
| Bavard, partage volontiers anecdotes et rumeurs mais révèle parfois une information qu’il devait protéger. | 2 |
| Beau parleur, sait rendre une proposition séduisante sans mentir directement sur ses défauts. | 1 |
| Blasé, accueille merveilles et catastrophes avec la même lassitude tout en observant soigneusement les réactions des autres. | 2 |
| Bourru mais loyal, exprime son affection par des actes pratiques plutôt que par des paroles aimables. | 2 |
| Capricieux, change brusquement de priorité et attend de ses proches qu’ils suivent sans explication. | 1 |
| Charismatique, attire naturellement l’attention mais se sent responsable de ceux qui choisissent de le suivre. | 2 |
| Coléreux, réagit vivement à la provocation puis regrette les dégâts causés une fois le calme revenu. | 2 |
| Courageux, avance malgré la peur et minimise souvent le danger pour rassurer les autres. | 2 |
| Courtois, respecte les formes même face à un ennemi et remarque immédiatement les manquements à l’étiquette. | 2 |
| Créatif, improvise des solutions inattendues mais perd rapidement intérêt pour leur mise en œuvre. | 1 |
| Cultivé, relie chaque situation à une référence savante et oublie que ses interlocuteurs ne la partagent pas toujours. | 2 |
| Curieux, pose la question que tout le monde évite et touche volontiers ce qui devrait rester intact. | 1 |
| Cynique, suppose que toute institution protège d’abord ses intérêts mais aide discrètement les personnes sincères. | 1 |
| Désordonné, retrouve sans effort ses propres affaires dans un chaos incompréhensible pour les autres. | 1 |
| Dévoué, place une personne ou une cause avant son confort et peine à reconnaître quand cette loyauté est exploitée. | 1 |
| Discret, écoute davantage qu’il ne parle et devient mal à l’aise lorsqu’on lui attribue publiquement un mérite. | 2 |
| Distrait, remarque les détails inhabituels tout en oubliant les obligations les plus évidentes. | 2 |
| Égoïste, protège d’abord sa sécurité mais peut devenir étonnamment généreux envers les rares personnes qu’il considère comme siennes. | 2 |
| Émotif, exprime ouvertement joie, peur et colère, rendant ses intentions faciles à lire. | 1 |
| Énergique, transforme chaque attente en activité et épuise parfois ses compagnons par son enthousiasme. | 2 |
| Énigmatique, répond par images et demi-vérités parce qu’il craint davantage d’être compris que d’être mal jugé. | 1 |
| Fainéant ingénieux, dépense beaucoup d’efforts à inventer une méthode qui lui évitera un travail répétitif. | 2 |
| Fier, accepte volontiers un défi mais refuse une aide qui donnerait l’impression qu’il n’est pas à la hauteur. | 1 |
| Fêtard, crée rapidement une célébration et traite chaque lendemain difficile comme le prix normal d’une bonne histoire. | 1 |
| Fourbe, préfère détourner les règles plutôt que les enfreindre ouvertement et garde toujours une issue de secours. | 2 |
| Franc, dit ce qu’il pense sans détour et confond parfois honnêteté avec absence de tact. | 2 |
| Froid en apparence, maîtrise ses réactions pour protéger un attachement beaucoup plus profond qu’il ne l’admet. | 2 |
| Gaffeur, provoque régulièrement de petits accidents mais se montre étonnamment efficace lorsque la situation devient vraiment grave. | 2 |
| Hautain, juge les gens selon leur maintien et leur réputation avant d’être forcé de réviser son opinion. | 2 |
| Impatient et impulsif, préfère une mauvaise décision immédiate à une longue attente sans information. | 1 |
| Insolent, défie l’autorité par réflexe mais respecte les personnes capables de justifier clairement leurs décisions. | 2 |
| Ironique, utilise le sarcasme pour garder ses distances et devient très direct lorsque quelqu’un est réellement en danger. | 1 |
| Jaloux, compare constamment sa place à celle des autres tout en ayant honte de ce besoin de reconnaissance. | 2 |
| Nerveux, anticipe tous les échecs possibles et se prépare donc souvent mieux que les optimistes du groupe. | 2 |
| Juste, applique les mêmes principes à ses alliés et à ses ennemis même lorsque cela lui coûte personnellement. | 2 |
| Logique, cherche une cause vérifiable à chaque phénomène et traite la magie comme un problème encore mal documenté. | 1 |
| Maladroit, manque d’aisance physique mais reconnaît très vite les personnes gênées ou exclues. | 2 |
| Maniaque, entretient des rituels précis d’ordre et de contrôle qui deviennent fragiles sous la pression. | 1 |
| Mystérieux, protège son passé par des réponses vagues mais ne ment jamais au sujet du danger présent. | 1 |
| Modeste, minimise ses réussites et attribue facilement le mérite aux autres jusqu’à laisser quelqu’un usurper son travail. | 1 |
| Mythomane, embellit son histoire de façon compulsive et finit parfois prisonnier de ses propres inventions. | 2 |
| Naïf, accorde d’abord sa confiance mais se souvient longtemps de chaque trahison. | 2 |
| Optimiste, cherche une possibilité favorable dans chaque crise et refuse de laisser le fatalisme décider à sa place. | 2 |
| Pacifique, recherche toujours une solution sans violence mais se prépare soigneusement au cas où elle échouerait. | 2 |
| Passionné, s’investit entièrement dans un projet et oublie le reste du monde tant que son enthousiasme dure. | 2 |
| Patient, laisse les autres se dévoiler à leur rythme et agit seulement lorsqu’il estime le moment décisif. | 1 |
| Peureux mais prudent, évite les risques inutiles et remarque souvent le danger avant les héros plus téméraires. | 2 |
| Protecteur, prend spontanément la responsabilité des plus vulnérables et supporte mal de ne pas pouvoir tout contrôler. | 1 |
| Rancunier, conserve une mémoire exacte des offenses mais peut renoncer à sa vengeance face à des réparations sincères. | 2 |
| Rebelle, refuse les règles fondées uniquement sur la tradition et exige qu’une autorité démontre sa légitimité. | 2 |
| Rêveur, imagine constamment d’autres vies et d’autres mondes, parfois au détriment de ce qui se passe devant lui. | 2 |
| Sage, préfère poser la bonne question plutôt que donner immédiatement un conseil et accepte de reconnaître son ignorance. | 2 |
| Sensible, perçoit rapidement l’état émotionnel d’un groupe mais absorbe facilement les tensions ambiantes. | 2 |
| Sérieux, traite chaque engagement avec rigueur et ne comprend pas toujours pourquoi les autres ont besoin de légèreté. | 1 |
| Serviable, propose son aide avant qu’on la demande et dissimule souvent sa propre fatigue. | 1 |
| Solitaire, protège farouchement son indépendance tout en espérant secrètement être invité à rester. | 2 |
| Susceptible, interprète une critique banale comme un jugement global mais défend vivement les personnes critiquées injustement. | 1 |
| Têtu, reste fidèle à une décision au-delà du raisonnable mais devient un allié extrêmement constant. | 2 |
| Timide, évite d’attirer l’attention tout en préparant soigneusement ce qu’il dira si quelqu’un lui donne la parole. | 2 |
| Tricheur, considère les règles comme des obstacles négociables et respecte les adversaires capables de déjouer ses méthodes. | 2 |
| Vantard, raconte ses exploits avec démesure mais accepte presque toujours le défi nécessaire pour les prouver. | 2 |
| Violent, recourt trop vite à la force et cherche une justification morale après avoir agi. | 2 |
| Bon vivant, valorise nourriture, compagnie et confort sans pour autant abandonner un ami lorsque la fête se termine. | 1 |

### Effets de statut (`status-effect`)

- **Distrait** — Le personnage perd le fil de son environnement et subit un
  désavantage sur sa prochaine action demandant une attention soutenue.
- **Ivre** — La coordination et le jugement sont altérés jusqu’à ce que le
  personnage se repose ou reçoive un traitement adapté.
- **Intoxiqué** — Une substance inconnue modifie les perceptions ou réactions du
  personnage ; la nature exacte de l’effet dépend du produit.
- **Fiévreux** — La maladie épuise le personnage et rend les efforts prolongés plus
  difficiles.
- **Méditatif** — Le personnage est profondément concentré ; l’interrompre annule
  le bénéfice recherché et le laisse momentanément désorienté.

### Événements (`event`)

- **Secousse soudaine** — Le sol tremble assez fortement pour interrompre l’action
  et révéler une fissure, un passage ou une structure fragilisée.
- **Animaux affolés** — Des cris se rapprochent tandis que la faune fuit une menace
  encore invisible.
- **Appel de détresse** — Une voix demande de l’aide depuis un endroit où personne
  ne devrait pouvoir survivre.
- **Odeur nauséabonde** — Une puanteur inhabituelle envahit la zone et conduit vers
  sa source autant qu’elle avertit du danger.
- **Parfum envoûtant** — Une odeur agréable altère subtilement l’attention, les
  émotions ou le comportement des personnes exposées.
- **Douleur partagée** — Plusieurs personnages ressentent simultanément le même mal
  sans présenter de blessure visible.
- **Évanouissement** — Un PNJ perd connaissance au moment précis où il allait
  transmettre une information essentielle.
- **Tempête naissante** — Le temps change brutalement et rend la route, le combat ou
  la communication plus difficiles.
- **Arrivée inattendue** — Un nouveau PNJ se présente en affirmant connaître l’un
  des personnages depuis longtemps.
- **Migration hostile** — Plusieurs créatures surgissent dans la zone parce qu’une
  menace plus grande les a chassées de leur territoire.
- **Cycle bouleversé** — La nuit tombe ou le jour se lève plusieurs heures trop tôt,
  sans que les horloges et souvenirs concordent.
- **Message impossible** — Un appel au secours provient d’une personne absente,
  morte ou située beaucoup trop loin.
- **Retour du passé** — Un événement lié à l’histoire d’un personnage réapparaît
  sous la forme d’un témoin, d’une dette ou d’une accusation.
- **Épidémie soudaine** — Un membre du groupe montre les premiers signes d’une
  maladie que les habitants reconnaissent avec terreur.
- **Ravitaillement épuisé** — La nourriture disparaît, se gâte ou devient impropre à
  la consommation au pire moment.
- **Température extrême** — Une chaleur ou un froid anormal force chacun à chercher
  rapidement un abri ou une explication.

### Animaux (`animal`)

- **Lézard solaire** — Un reptile placide qui stocke la chaleur dans ses écailles et
  recherche les surfaces exposées au soleil.
- **Serpent des roseaux** — Un serpent aquatique discret dont la morsure est
  douloureuse mais rarement mortelle.
- **Rat récupérateur** — Un rongeur curieux qui emporte petits outils, boutons et
  objets brillants vers un nid étonnamment organisé.
- **Araignée tisseuse** — Une grosse araignée non agressive dont la toile solide est
  recherchée par les artisans.
- **Loup des collines** — Un prédateur social prudent qui observe longtemps un
  groupe avant de décider de l’éviter ou de l’approcher.
- **Rapace messager** — Un oiseau territorial pouvant être dressé à reconnaître des
  personnes, des emblèmes et des itinéraires.
- **Crabe cuirassé** — Un crustacé de grande taille utilisant débris et coquillages
  pour renforcer sa carapace.
- **Tatou fouisseur** — Un animal robuste capable de localiser eau, racines et
  cavités sous un terrain sec.
- **Singe chapardeur** — Un animal intelligent qui échange volontiers les objets
  volés contre nourriture ou curiosités nouvelles.
- **Chauve-souris cavernicole** — Un petit animal nocturne dont les mouvements
  révèlent courants d’air et passages invisibles.

### Criminels (`criminal`)

- **Bande de brigands** — Des voleurs de route bien renseignés choisissent leurs
  cibles grâce à un complice installé dans la communauté voisine.
- **Patrouille corrompue** — Des soldats ou gardes utilisent leur autorité pour
  rançonner les voyageurs et confisquer les preuves.
- **Chasseurs clandestins** — Des pisteurs armés capturent une créature protégée
  pour le compte d’un commanditaire anonyme.
- **Éclaireurs ennemis** — Une petite unité observe les défenses locales et cherche
  à repartir sans engager de combat ouvert.

### Monstres (`monster`)

- **Phénix de cendre** — Un grand oiseau incandescent renaît d’un foyer voisin en
  emportant les souvenirs de ceux qui ont alimenté le feu.
- **Ogre juvénile** — Un jeune géant affamé imite le comportement d’adultes absents
  et transforme chaque jeu en danger réel.
- **Changelin affamé** — Une créature copie l’apparence d’une personne mais comprend
  mal ses habitudes et ses liens affectifs.
- **Diablotin** — Un petit démon propose des marchés insignifiants dont les
  formulations cachent des conséquences disproportionnées.
- **Limon dissolvant** — Une masse lente digère matière organique et métal tendre,
  laissant derrière elle les objets qu’elle ne comprend pas.
- **Tréant déraciné** — Un gardien végétal marche loin de sa forêt parce que les
  racines de son territoire ont été empoisonnées.
- **Mort-vivant obstiné** — Un cadavre animé poursuit une tâche quotidienne sans
  réaliser que le monde autour de lui a changé.
- **Squelette de patrouille** — Des ossements armés répètent encore un itinéraire
  militaire et traitent tout écart au règlement comme une intrusion.
- **Animal mutant** — Une bête ordinaire porte une adaptation impossible provoquée
  par une pollution magique ou alchimique.
- **Golem abandonné** — Un serviteur artificiel continue d’appliquer un ordre devenu
  dangereux faute de maître capable de le modifier.
- **Poulet diablotin** — Une volaille possédée manifeste une agressivité absurde,
  des bonds surnaturels et une résistance très supérieure à sa taille.
- **Insecte géant** — Un arthropode colossal défend un nid construit autour d’une
  source de chaleur ou de magie.
- **Statue animée** — Une sculpture quitte son socle pour corriger toute personne
  qui contredit la version officielle de l’événement qu’elle représente.
- **Limace vorace** — Une créature lente sécrète une substance capable de dissoudre
  murs, armures ou souvenirs selon ce qu’elle a consommé.
- **Salamandre ardente** — Un reptile surnaturel vit dans les flammes et propage
  involontairement les incendies lorsqu’il prend peur.
- **Harpie des falaises** — Une prédatrice ailée imite les appels familiers pour
  attirer les voyageurs vers un terrain dangereux.
- **Sirène des eaux troubles** — Une créature aquatique utilise chants et reflets
  pour isoler une cible du reste de son groupe.
- **Cyclope veilleur** — Un géant solitaire garde un passage dont il a oublié la
  destination mais pas l’interdiction.
- **Vampire affamé** — Un prédateur immortel tente de préserver une façade civile
  tandis qu’une pénurie rend son contrôle de plus en plus fragile.
- **Parasite mémoriel** — Une petite créature se nourrit de souvenirs récents et
  laisse ses victimes incapables d’expliquer leur présence.
- **Fantôme répétitif** — Un esprit rejoue une scène incomplète et devient violent
  lorsque des témoins modifient son déroulement.
- **Chimère instable** — Plusieurs anatomies incompatibles luttent pour contrôler
  un même corps créé artificiellement.
- **Élémentaire déchaîné** — Une force naturelle animée cherche à rétablir un
  équilibre sans comprendre les vies placées sur son chemin.
- **Gargouille territoriale** — Une sentinelle de pierre change de bâtiment chaque
  nuit et considère sa nouvelle position comme sacrée.
- **Griffon des hauteurs** — Un prédateur majestueux protège son aire et les objets
  brillants qu’il confond avec ses œufs.
- **Gorgone recluse** — Une créature maudite pétrifie par peur davantage que par
  cruauté et collectionne les statues de ses visiteurs.
- **Loup-garou traqué** — Une personne transformée tente de guider les chasseurs loin
  de ses proches avant de perdre le contrôle.
- **Momie gardienne** — Un ancien dignitaire préserve un lieu, un serment ou une
  erreur que ses descendants préféreraient oublier.
- **Minotaure architecte** — Une créature modifie continuellement son labyrinthe et
  considère toute personne perdue comme un intrus volontaire.
- **Ver fouisseur géant** — Un prédateur souterrain suit vibrations et chaleur,
  provoquant effondrements et déplacements de terrain.
- **Plante carnivore** — Une colonie végétale imite odeurs, voix et silhouettes afin
  d’attirer ses proies.
- **Dragon ancien** — Une créature immensément puissante protège moins un trésor
  matériel qu’un secret capable de bouleverser la région.
- **Kraken des hauts-fonds** — Un monstre marin bloque une route commerciale en
  utilisant les épaves pour construire un nid.
- **Béhémoth migrateur** — Une créature gigantesque traverse périodiquement les
  communautés bâties sur son ancien chemin.
- **Esprit vengeur** — Une entité liée à une injustice précise frappe les symboles
  du responsable plutôt que ses véritables héritiers.
- **Reine insecte** — Une créature intelligente coordonne une colonie et négocie
  comme si chaque individu n’était qu’un membre de son propre corps.

### LOIs (`rules`)

Les anciens pouvoirs proches ont été regroupés en concepts distincts. Chaque entrée
conserve les champs actuels `Name` et `Description`.

| Name | Description |
| --- | --- |
| LOI de l’Impact | Amplifie brièvement une charge, un coup ou un projectile ; l’effet ne change pas la trajectoire et transmet aussi une partie du recul à l’utilisateur. |
| LOI du Ricochet | Dévie un projectile vers une seconde surface visible ; chaque rebond réduit fortement sa puissance et exige un angle plausible. |
| LOI de la Célérité | Accélère un mouvement simple pendant quelques secondes ; les décisions et perceptions de l’utilisateur ne deviennent pas plus rapides. |
| LOI de l’Invisibilité | Dissimule visuellement une cible immobile ; le son, les traces et les objets déplacés restent perceptibles. |
| LOI de la Flamme | Crée ou dirige un feu proche ; sa taille dépend du combustible disponible et il reste dangereux pour les alliés. |
| LOI du Givre | Retire rapidement la chaleur d’une petite surface ; elle peut créer de la glace mais pas geler instantanément une créature entière. |
| LOI de la Pluie | Condense l’humidité pour provoquer une pluie locale ; l’effet est faible dans un environnement très sec. |
| LOI du Soin | Accélère la fermeture d’une blessure récente ; elle ne remplace ni le sang perdu ni un membre détruit. |
| LOI de la Téléportation | Déplace l’utilisateur vers un point visible et dégagé ; elle échoue si le trajet traverse une protection consacrée. |
| LOI de l’Électricité | Produit ou guide une décharge entre deux conducteurs ; l’utilisateur doit maîtriser le chemin suivi par le courant. |
| LOI de l’Orage | Renforce un phénomène météorologique déjà présent ; elle ne peut créer une tempête complète dans un ciel parfaitement calme. |
| LOI de la Bénédiction | Accorde un avantage limité à une action conforme à un vœu annoncé ; rompre ce vœu met immédiatement fin à l’effet. |
| LOI de l’Invocation | Appelle une entité mineure correspondant à un symbole préparé ; elle conserve sa volonté et exige une contrepartie raisonnable. |
| LOI de la Résurrection | Rappelle brièvement l’esprit d’un mort récent dans son corps ; chaque usage exige un prix durable et l’esprit peut refuser. |
| LOI de la Malédiction | Lie une pénalité précise à une condition clairement formulée ; la cible doit pouvoir comprendre comment rompre l’effet. |
| LOI du Vampirisme | Transfère une petite quantité de vitalité par contact ; elle ne peut dépasser les blessures réellement infligées. |
| LOI de la Télékinésie | Déplace à distance un objet visible ; la masse et la précision ne peuvent être maximales en même temps. |
| LOI de l’Influence | Renforce une émotion ou suggestion déjà plausible ; elle ne crée ni loyauté durable ni action contraire aux valeurs centrales. |
| LOI des Morts | Permet de donner un ordre simple à un cadavre animé ; celui-ci ne retrouve ni souvenirs complets ni intelligence perdue. |
| LOI de l’Illusion | Produit une image ou un son crédible dans une zone limitée ; l’effet ne possède ni masse ni chaleur propre. |
| LOI du Sommeil | Renforce la fatigue d’une cible calme ; la douleur ou un danger immédiat peut la réveiller. |
| LOI du Lien d’âme | Permet à deux volontaires de partager une sensation ou une émotion ; une trop grande distance brouille le lien. |
| LOI du Fantôme | Rend brièvement une partie du corps intangible ; l’utilisateur ne peut pas maintenir l’effet en portant une charge importante. |
| LOI des Esprits | Manifeste un esprit protecteur ou vengeur lié à un souvenir ; son comportement suit ce souvenir plutôt que les ordres exacts. |
| LOI du Familier | Crée un lien sensoriel avec un petit animal consentant ; la confusion ou la douleur traverse le lien dans les deux sens. |
| LOI des Plantes | Accélère ou oriente la croissance végétale ; elle exige eau, nutriments et une plante encore vivante. |
| LOI des Bêtes | Transmet une intention simple à un animal ; elle ne supprime ni sa peur ni ses instincts. |
| LOI des Spores | Produit des spores toxiques, apaisantes ou curatives ; un seul effet peut être préparé et le vent reste incontrôlable. |
| LOI de la Pierre | Déplace ou façonne une quantité limitée de roche ; les structures complexes exigent du temps et une connaissance de leur charge. |
| LOI de la Pétrification | Transforme progressivement une petite partie exposée en pierre ; l’effet complet exige plusieurs applications et reste réversible au début. |
| LOI de la Décomposition | Accélère la détérioration d’une matière morte ; elle agit lentement sur les matériaux traités ou protégés. |
| LOI de la Gravité | Augmente ou réduit le poids apparent dans une petite zone ; l’inertie et la solidité des objets ne changent pas. |
| LOI du Magnétisme | Attire ou repousse des métaux proches ; les objets non métalliques et les alliages rares réagissent peu. |
| LOI du Double | Produit une copie temporaire et imparfaite de l’utilisateur ; elle partage ses intentions mais pas ses souvenirs récents. |
| LOI du Temps | Accélère ou ralentit légèrement un processus local ; elle ne permet ni de réécrire le passé ni d’annuler une décision. |
| LOI de l’Espace | Ouvre un passage bref entre deux surfaces préparées ; les deux points doivent avoir été marqués par le même utilisateur. |
| LOI de la Vision | Montre une conséquence future possible d’une décision immédiate ; la vision devient fausse si les circonstances changent. |
| LOI de la Taille | Agrandit ou réduit temporairement un objet ou une créature ; la masse devient instable et limite fortement la durée. |
| LOI du Vent | Oriente un courant d’air ou crée une rafale ; l’effet perd rapidement sa force dans un espace trop vaste. |
| LOI du Sang | Permet de suivre ou d’identifier une personne à partir de son sang ; l’échantillon est consommé et peut être contaminé. |
| LOI de l’Ombre | Épaissit ou déplace une ombre existante ; une lumière intense réduit sa portée et sa solidité. |
| LOI du Sable | Déplace et compacte du sable ou de la poussière ; elle ne crée pas de matière et devient imprécise sous la pluie. |
| LOI du Métal | Plie ou assemble une petite quantité de métal chauffé ; les alliages enchantés résistent à l’effet. |
| LOI du Miroir | Reproduit l’apparence visible d’une LOI observée sans copier sa pleine puissance ; une seule imitation peut être conservée. |
| LOI de la Mémoire | Rend un souvenir plus clair ou plus flou ; elle ne peut inventer une information absente et laisse des traces perceptibles. |

### Quêtes (`quest`)

Les références sont exprimées avec les identifiants des catégories actuelles. Leur
syntaxe définitive dépendra de l’architecture retenue.

- Retrouver `{{inventory}}` perdu dans `{{dungeon}}` avant que
  `{{criminal}}` ne s’en empare.
- Chasser `{{monster}}` après qu’un modificateur d’élite a rendu ses attaques
  impossibles à contenir.
- Défendre `{{settlement}}` contre une menace liée à `{{faction}}`.
- Escorter `{{npc}}` à travers `{{region}}` sans révéler la véritable raison du
  voyage.
- Voler `{{inventory}}` dans `{{building}}` pour le rendre à son propriétaire
  légitime.
- Trouver `{{npc}}` disparu après sa dernière visite dans `{{dungeon}}`.
- Identifier puis arrêter `{{criminal}}` avant sa prochaine opération.
- Empêcher deux `{{faction}}` de déclencher une guerre autour de
  `{{settlement}}`.
- Négocier une paix entre `{{race}}` et les habitants de `{{settlement}}`.
- Offrir `{{inventory}}` à `{{npc}}` sans révéler l’identité du commanditaire.
- Établir un premier contact durable avec une communauté de `{{race}}`.
- Explorer `{{region}}` et rapporter la cause d’un phénomène absent des cartes.
- Étudier `{{monster}}` sans le tuer afin de comprendre son lien avec
  `{{region}}`.
- Résoudre le meurtre d’un `{{npc}}` malgré l’intervention d’une
  `{{faction}}`.
- Espionner `{{npc}}` pendant une rencontre secrète dans `{{building}}`.
- Empêcher l’assassinat de `{{npc}}` sans révéler que le danger vient de sa propre
  `{{faction}}`.
- Réunir plusieurs exemplaires de `{{material}}` nécessaires à la fabrication
  d’un remède.
- Évacuer `{{settlement}}` avant l’arrivée d’un groupe de `{{monster}}`.
- S’échapper de `{{dungeon}}` avec un `{{npc}}` qui refuse d’expliquer son
  emprisonnement.
- Sauver `{{npc}}` retenu par `{{criminal}}` dans `{{building}}`.
- Cacher `{{inventory}}` à une `{{faction}}` capable de suivre toute personne
  l’ayant touché.
- Empêcher `{{npc}}` de découvrir l’emplacement de `{{dungeon}}`.
- Prendre `{{npc}}` en filature à travers `{{settlement}}` sans attirer
  l’attention de ses alliés.
- Collecter `{{material}}` dans `{{region}}` avant qu’un changement saisonnier ne
  le rende inaccessible.
- Livrer une marchandise issue de `{{inventory}}` à `{{npc}}`, alors que plusieurs
  `{{criminal}}` possèdent la même description du colis.

## Modificateurs indépendants

Ces listes ne correspondent pas encore à des catégories publiques. Elles sont
destinées à être appliquées à une entrée produite par un autre générateur.

### Modificateurs de site

| Name | Description | Applicable à |
| --- | --- | --- |
| Abandonné | Le lieu fonctionne encore partiellement, mais ses occupants sont partis sans emporter leurs affaires essentielles. | `region`, `settlement`, `dungeon`, `building` |
| En ruine | La structure est instable, certains accès sont condamnés et chaque déplacement peut révéler ou détruire un passage. | `settlement`, `dungeon`, `building` |
| Caché | L’accès est dissimulé par le terrain, une construction plus récente ou une illusion entretenue. | `dungeon`, `building` |
| Immense | Les distances intérieures dépassent les attentes et imposent ravitaillement, navigation ou plusieurs étapes d’exploration. | `region`, `settlement`, `dungeon`, `building` |
| Exigu | Les passages et espaces utilisables limitent les mouvements, la visibilité et l’emploi d’équipements encombrants. | `dungeon`, `building` |
| Récemment détruit | Des traces fraîches permettent encore de reconstituer l’événement et de poursuivre ses responsables ou survivants. | `settlement`, `dungeon`, `building` |
| Centre local | Le lieu est le plus important de la communauté et concentre ressources, réputation et conflits de proximité. | `building` |
| Institution nationale | Le lieu exerce une influence sur tout le pays et bénéficie de protections politiques exceptionnelles. | `building` |
| Site continental | Le lieu est unique à l’échelle du continent et attire experts, pèlerins, espions et puissances étrangères. | `building` |
| Fermé après un incident | L’accès officiel est interdit pendant une enquête, une contamination ou une crise que les responsables minimisent. | `building` |
| En rénovation | Une partie du lieu est inaccessible tandis qu’ouvriers, échafaudages et plans anciens offrent de nouveaux passages. | `building` |

### Modificateurs de monstre

| Name | Description |
| --- | --- |
| Alpha | Un chef ou dominant coordonne les autres créatures et protège en priorité la cohésion du groupe. |
| Hybride | La créature possède des traits empruntés à une seconde espèce, avec une capacité utile et une faiblesse contradictoire. |
| Mort-vivant | Le monstre ignore plusieurs besoins biologiques mais reste lié à la cause ou au rituel de sa réanimation. |
| Renforcé | Une armure, une mutation ou une protection magique réduit l’efficacité des attaques ordinaires. |
| Gigantesque | Sa taille augmente allonge, force et résistance, mais l’empêche de se déplacer facilement dans les espaces étroits. |
| Enragé | La créature attaque sans prudence après avoir été blessée et devient plus dangereuse mais plus prévisible. |
| Meute | Le résultat représente trois individus coordonnés plutôt qu’une créature solitaire. |
| Nuée | Une multitude de petites créatures agit comme une seule menace et résiste aux attaques visant un individu. |
| Ectoplasmique | La créature traverse partiellement la matière mais doit se matérialiser pour affecter le monde physique. |
| Invisible | La créature reste difficile à voir, mais son odeur, ses sons et son interaction avec le décor peuvent la trahir. |
| Porteur de LOI | Le monstre manifeste une LOI issue de `rules`, soumise à la même limitation qu’un utilisateur ordinaire. |
| Équipé | La créature utilise une arme ou un objet issu de `weapons` ou `inventory`, adapté à son anatomie et à son comportement. |
