// Úvodní články (CS/FR). Vloží se do prázdné databáze; dál se spravují v /admin.
// Formát těla: odstavce oddělené prázdným řádkem, "## Nadpis", **tučně**.

export const SEED_POSTS = [
  {
    slug: 'passages-couverts',
    published_at: '2026-09-20T10:00:00Z',
    cover_url: '/images/toits.jpg',
    title_fr: 'Les passages couverts : Paris à l’abri de la pluie',
    title_cs: 'Pařížské pasáže: Paříž, kde nikdy neprší',
    excerpt_fr: 'Au XIXe siècle, ces galeries vitrées ont inventé le shopping à l’abri. Il en reste une vingtaine à Paris, et elles valent le détour.',
    excerpt_cs: 'V 19. století tyto prosklené galerie vynalezly nakupování pod střechou. V Paříži jich zbývá asi dvacet a stojí za návštěvu.',
    body_fr: `Avant les grands magasins, il y avait les passages couverts. Au début du XIXe siècle, les rues de Paris sont boueuses et sans trottoirs : des galeries vitrées, éclairées au gaz puis à l’électricité, permettent enfin de flâner au sec.

## Trois passages à ne pas manquer

Le **passage des Panoramas** (1799) est l’un des plus anciens ; on y trouve encore des restaurants et un graveur d’autrefois. La **galerie Vivienne** séduit par son sol en mosaïque et sa verrière. Le **passage Jouffroy** abrite une librairie, un musée de cire et un salon de thé.

## Pourquoi y aller aujourd’hui ?

Parce que le temps y passe plus lentement. On y entre pour s’abriter de la pluie, on en ressort avec un livre ancien, un thé ou simplement l’impression d’avoir voyagé dans le temps.

**Petit conseil :** les passages ferment le soir et certains le dimanche. Venez plutôt en fin de matinée.`,
    body_cs: `Dávno před obchodními domy existovaly pasáže. Na začátku 19. století byly pařížské ulice blátivé a bez chodníků. Prosklené galerie, osvětlené nejprve plynem a pak elektřinou, konečně umožnily procházet se po suchu.

## Tři pasáže, které nesmíte minout

**Passage des Panoramas** (1799) patří k nejstarším. Najdete v něm restaurace i dílnu starého rytce. **Galerie Vivienne** okouzlí mozaikovou podlahou a skleněnou střechou. V **Passage Jouffroy** je knihkupectví, muzeum voskových figurín a čajovna.

## Proč tam zajít dnes?

Protože tam čas plyne pomaleji. Vejdete se schovat před deštěm a odejdete se starou knihou, čajem nebo pocitem, že jste se vrátili v čase.

**Malá rada:** pasáže se večer zavírají a některé i v neděli. Nejlepší je přijít koncem dopoledne.`,
  },
  {
    slug: 'weekend-comme-un-parisien',
    published_at: '2026-09-27T10:00:00Z',
    cover_url: '/images/montmartre.jpg',
    title_fr: 'Un week-end à Paris… comme un Parisien',
    title_cs: 'Víkend v Paříži jako skutečný Pařížan',
    excerpt_fr: 'Marché, baguette, café au comptoir et apéro au bord du canal : le programme d’un week-end loin des files d’attente.',
    excerpt_cs: 'Trh, bageta, káva u pultu a aperitiv u kanálu: program víkendu daleko od front na památky.',
    body_fr: `Vivre comme un Parisien, ce n’est pas cocher une liste de monuments. C’est avant tout adopter un rythme.

## Le samedi matin

On commence par le **marché** : celui d’Aligre, dans le 12e, est l’un des plus vivants. On achète des fruits, du fromage et une **baguette tradition** à la boulangerie du coin. Ensuite, un café **au comptoir** : c’est moins cher qu’en terrasse et c’est là que l’on entend vraiment parler français.

## L’après-midi

Direction les **Buttes-Chaumont** ou la **Coulée verte René-Dumont**, une ancienne voie ferrée transformée en promenade plantée. Les Parisiens y lisent, courent ou ne font rien du tout, et c’est parfaitement accepté.

## Le soir : l’apéro

Vers 19 h, on s’installe au bord du **canal Saint-Martin** avec un verre et quelque chose à grignoter. Pas besoin de réserver : on apporte son pique-nique, ou on s’assied à une terrasse.

**Pour les étudiants de français :** profitez-en pour pratiquer. Commandez en français, même si le serveur vous répond en anglais !`,
    body_cs: `Žít jako Pařížan neznamená odškrtávat seznam památek. Především to znamená přijmout jejich rytmus.

## Sobotní dopoledne

Začněte **trhem**. Ten na Place d’Aligre ve 12. obvodu patří k nejživějším. Koupíte tam ovoce, sýr a **baguette tradition** v nejbližší pekárně. Potom si dejte kávu **u pultu**: je levnější než na terase a právě tam se opravdu mluví francouzsky.

## Odpoledne

Zamiřte do parku **Buttes-Chaumont** nebo na **Coulée verte René-Dumont**, bývalou železniční trať proměněnou v zelenou promenádu. Pařížané tam čtou, běhají nebo nedělají vůbec nic, a je to naprosto v pořádku.

## Večer: aperitiv

Kolem 19. hodiny se usaďte u **kanálu Saint-Martin** se sklenkou a něčím k zakousnutí. Rezervace není potřeba: přineste si piknik, nebo si sedněte na terasu.

**Pro studenty francouzštiny:** využijte příležitost k praxi. Objednávejte francouzsky, i když vám číšník odpoví anglicky!`,
  },
  {
    slug: 'paris-a-velo',
    published_at: '2026-10-03T10:00:00Z',
    cover_url: '/images/eiffel.jpg',
    title_fr: 'Paris à vélo : itinéraires et conseils',
    title_cs: 'Paříž na kole: trasy a rady',
    excerpt_fr: 'Pistes cyclables, quais de Seine sans voitures et Vélib’ : explorer Paris sur deux roues est devenu un vrai plaisir.',
    excerpt_cs: 'Cyklostezky, nábřeží Seiny bez aut a Vélib’: objevovat Paříž na kole je dnes opravdové potěšení.',
    body_fr: `Paris a beaucoup investi dans les pistes cyclables ces dernières années, et la ville se découvre désormais très bien à vélo.

## Une boucle facile le long de la Seine

Partez de Notre-Dame et suivez les quais vers l’ouest : Louvre, jardin des Tuileries, puis la tour Eiffel. Une partie des quais de la rive gauche est piétonne et cyclable, ce qui permet de rouler au bord de l’eau sans circuler au milieu des voitures.

## Louer un vélo

Le système **Vélib’**, lancé en 2007, propose des vélos en libre-service dans toute la ville. Il existe aussi des loueurs pour la journée.

## Quelques conseils

Respectez les feux et les sens uniques, et attachez toujours votre vélo avec un bon antivol. Évitez les grands axes aux heures de pointe. Et surtout, prenez votre temps : à vélo, Paris se mérite… et se savoure.`,
    body_cs: `Paříž v posledních letech hodně investovala do cyklostezek a dnes se na kole dá výborně poznávat.

## Snadný okruh podél Seiny

Vyjeďte od Notre-Dame a sledujte nábřeží na západ: Louvre, Tuilerijské zahrady a pak Eiffelova věž. Část nábřeží na levém břehu je pro pěší a cyklisty, takže se dá jet při vodě a ne uprostřed aut.

## Kde půjčit kolo

Systém **Vélib’**, spuštěný v roce 2007, nabízí sdílená kola po celém městě. K dispozici jsou i půjčovny na celý den.

## Několik rad

Dodržujte semafory a jednosměrky a kolo vždy pořádně zamykejte. Vyhněte se hlavním tepnám ve špičce. A hlavně si dejte čas: Paříž na kole je třeba si zasloužit… a vychutnat.`,
  },
];
