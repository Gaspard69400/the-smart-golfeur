/* ════════════════════════════════════════════
 * THE SMART GOLFER — articles-data.js
 * Contenu de la BIBLIOTHÈQUE (chargé à la demande par articles.js).
 *
 * Reprise des 36 articles d'origine, relus et corrigés :
 *  - tutoiement (comme toute l'app) ;
 *  - chiffres inventés retirés (« analyse de 10 000 parties », « −23 % de
 *    cortisol »…) ; repères de niveau alignés sur les barèmes de l'app
 *    (SG_BENCHMARKS) ; règles de golf remises à jour (appareils de mesure
 *    autorisés, balle provisoire / deuxième balle, index = 8 meilleurs sur 20).
 * + 2 articles pour les débutants (première partie, compter ses coups).
 *
 * Champs : id, cat, niveau, format, title, subtitle, excerpt, body (HTML),
 * start (ordre du parcours « Par où commencer »), app ({go, label}).
 * Blocs HTML dispo dans body : .art-kpis/.art-kpi, .art-quote, .art-check.
 * ════════════════════════════════════════════ */

var ARTICLES = [];

/* ═══════════ ANALYSE ═══════════ */
ARTICLES.push(
{id:1, cat:"analyse", niveau:"Débutant", format:"fiche", start:4,
 title:"Les 4 chiffres qui résument ton jeu",
 subtitle:"Fairways, greens, putts et différentiel : ce qu'ils mesurent et ce qu'ils te disent.",
 excerpt:"Avant d'analyser quoi que ce soit, il faut connaître les quatre indicateurs de base que tout golfeur devrait suivre.",
 app:{go:"analyse", label:"Voir mes chiffres"},
 body:`<h3>Pourquoi mesurer</h3>
<p>La plupart des golfeurs jouent toute leur vie sans suivre la moindre statistique. Ils savent qu'ils « ont mal joué », sans savoir où sont partis les coups. <strong>On ne progresse vraiment que sur ce qu'on mesure.</strong></p>
<div class="art-kpis">
  <div class="art-kpi"><b>Fairways</b><span>Départs dans l'allée</span></div>
  <div class="art-kpi"><b>Greens</b><span>Atteints « en régulation »</span></div>
  <div class="art-kpi"><b>Putts</b><span>Sur le tour complet</span></div>
</div>
<h4>Fairways touchés (FIR)</h4>
<p>Le pourcentage de départs qui finissent sur le fairway, compté sur les par 4 et les par 5 (sur un par 3, on vise directement le green). Repère de l'app : un joueur d'index 15 touche environ <strong>47 % des fairways</strong>.</p>
<h4>Greens en régulation (GIR)</h4>
<p>Tu es « en régulation » quand ta balle est sur le green avec au moins deux coups d'avance sur le par : en 1 coup sur un par 3, en 2 sur un par 4, en 3 sur un par 5. C'est l'une des statistiques les plus liées au score. Un index 15 en touche environ <strong>5 par tour</strong>.</p>
<h4>Putts par tour</h4>
<p>Le total des coups joués sur le green. Repère : environ <strong>32 putts</strong> pour un index 15, 35 pour un index 36. Le chiffre seul est trompeur : si tu touches peu de greens, tu arrives souvent près du trou après un chip, donc tu puttes moins. C'est pour ça que l'app regarde aussi les 3-putts et les putts par green touché.</p>
<h4>Le différentiel</h4>
<p>Ton score ramené à la difficulté du parcours : <strong>(score ajusté − SSS) × 113 ÷ slope</strong>. C'est ce qui permet de comparer un 95 sur un parcours facile et un 95 sur un parcours difficile, et c'est la base de ton index.</p>
<div class="art-quote">Ce que tu ne mesures pas, tu ne peux pas l'améliorer. Commence par ces quatre chiffres.</div>
<ul class="art-check">
  <li><strong>Cette semaine :</strong> note fairways, greens et putts sur tes 3 prochaines parties.</li>
  <li><strong>Ensuite :</strong> repère le chiffre le plus éloigné des repères de ton niveau.</li>
  <li><strong>Astuce :</strong> dans la saisie express, les putts se notent en un tap. Le reste est facultatif.</li>
</ul>`},

{id:2, cat:"analyse", niveau:"Intermédiaire", format:"longform",
 title:"Pourquoi les greens touchés comptent autant",
 subtitle:"Le nombre de greens en régulation suit ton score de très près. Voici pourquoi, et comment en toucher plus.",
 excerpt:"Si tu ne devais améliorer qu'une seule statistique cette saison, ce serait probablement celle-là.",
 app:{go:"analyse", label:"Mes greens touchés"},
 body:`<h3>La statistique qui suit le score</h3>
<p>Quand on compare des joueurs de niveaux différents, les greens touchés en régulation (GIR) sont l'un des chiffres qui bougent le plus avec le score. Les travaux de Mark Broadie sur les Strokes Gained vont dans le même sens : ce sont surtout <strong>les coups longs</strong> (départ et approches) qui séparent un bon joueur d'un joueur moyen.</p>
<div class="art-quote">Dans les calculs de l'app, un green touché en plus vaut en moyenne un demi-coup.</div>
<h3>Ce qui se passe quand tu rates un green</h3>
<p>Rater un green, c'est presque toujours ajouter un coup : un chip ou une sortie de bunker, souvent depuis une position inconfortable (rough, pente), puis un putt dont la longueur est moins maîtrisée. Sur un trou en régulation, tu as deux putts pour faire le par. Hors régulation, il faut réussir un bon petit jeu <em>et</em> rentrer un putt.</p>
<h3>Les repères selon ton index</h3>
<ul class="art-check">
  <li>Index 36 : environ <strong>1 green</strong> par tour</li>
  <li>Index 30 : environ <strong>2 greens</strong></li>
  <li>Index 20 : environ <strong>4 greens</strong></li>
  <li>Index 15 : environ <strong>5 greens</strong></li>
  <li>Index 10 : environ <strong>7 greens</strong></li>
  <li>Index 0 : environ <strong>11 greens</strong></li>
</ul>
<p>Ce sont les barèmes amateurs utilisés par l'app pour tes Strokes Gained. Au-dessus de ton repère, tes approches sont un point fort.</p>
<h3>Les deux causes les plus fréquentes</h3>
<p><strong>1. Trop court.</strong> La plupart des amateurs choisissent leur club d'après leur meilleur coup, pas leur coup moyen. Résultat : la majorité des greens ratés le sont court. Prends le club qui amène ton coup <em>moyen</em> au milieu du green.</p>
<p><strong>2. Trop de dispersion.</strong> Plus tes balles s'écartent de la ligne, plus il faut un grand green pour les recevoir. Avant de chercher de la distance, cherche un contact régulier.</p>
<h3>Plan d'action</h3>
<ul class="art-check">
  <li>Note tes greens touchés sur 5 parties d'affilée.</li>
  <li>Observe si tu rates plutôt court, long, à gauche ou à droite.</li>
  <li>Pendant 4 semaines, vise le centre du green avec le club de ton coup moyen.</li>
  <li>À l'entraînement, travaille la régularité du contact avant la distance.</li>
</ul>`},

{id:3, cat:"analyse", niveau:"Avancé", format:"longform",
 title:"Lire ses statistiques sur 20 parties",
 subtitle:"Passer des chiffres bruts à ce qui fait vraiment tes bonnes et tes mauvaises parties.",
 excerpt:"Tu as des chiffres. Maintenant quoi ? La donnée sans interprétation, c'est du bruit.",
 app:{go:"analyse", label:"Ouvrir l'Analyse"},
 body:`<h3>De la donnée brute à la tendance</h3>
<p>Beaucoup de golfeurs s'arrêtent au constat : « j'ai 30 % de greens ». Et ils continuent à jouer comme avant. Une statistique n'est utile que si elle te dit <strong>quoi changer</strong>.</p>
<h3>Pourquoi 20 parties</h3>
<p>Sur 3 ou 4 parties, une journée exceptionnelle ou catastrophique déforme tout. À partir d'une vingtaine de cartes, ton profil se stabilise. Ce n'est pas un hasard si l'index officiel se calcule, lui aussi, sur tes 20 dernières cartes.</p>
<div class="art-quote">20 parties, c'est environ 360 trous : assez pour qu'une tendance soit réelle.</div>
<h3>Les indicateurs à suivre</h3>
<ul class="art-check">
  <li><strong>La tendance du score</strong> sur tes 20 dernières parties, pas le dernier résultat.</li>
  <li><strong>Fairways et greens</strong> comparés aux repères de ton niveau.</li>
  <li><strong>Putts par green touché</strong> et 3-putts : la vraie mesure du putting.</li>
  <li><strong>Sauvetages</strong> : green raté puis par ou mieux.</li>
  <li><strong>Score par trou</strong> sur ton parcours habituel : tes trous noirs.</li>
  <li><strong>Les conditions</strong> : vent, pluie, froid. L'app enregistre la météo de chaque partie.</li>
</ul>
<h3>Comparer tes meilleures et tes pires parties</h3>
<p>Classe tes 20 parties du meilleur au pire score. Compare les statistiques des 5 meilleures avec celles des 5 pires. L'écart te montre ce qui produit tes bonnes journées. Souvent, ce n'est pas le putting seul mais le jeu long : moins de balles perdues, plus de greens.</p>
<h3>Trouver ton levier</h3>
<p>Chaque joueur a un chiffre qui, quand il s'améliore, entraîne le reste. Pour l'un, c'est éviter les pénalités au départ. Pour un autre, supprimer les 3-putts. Le niveau par secteur du Dashboard (« ton putting joue comme un index… ») est fait pour t'aider à le trouver.</p>`},

{id:4, cat:"analyse", niveau:"Expert", format:"longform",
 title:"Strokes Gained : l'analyse venue du circuit pro",
 subtitle:"Mesurer chaque partie du jeu en coups gagnés ou perdus par rapport à un joueur de référence.",
 excerpt:"Ce n'est plus « ai-je touché le fairway ? » mais « combien de coups ce secteur m'a-t-il fait gagner ou perdre ? ».",
 app:{go:"dashboard", label:"Mes Strokes Gained"},
 body:`<h3>L'idée</h3>
<p>Le Strokes Gained a été popularisé par Mark Broadie, professeur à Columbia, puis adopté par le PGA Tour. Le principe : depuis chaque position, on connaît le nombre moyen de coups qu'il faut à un joueur de référence pour finir le trou. Un coup qui te fait gagner plus que la moyenne est un coup « gagné ».</p>
<h3>Les 4 secteurs</h3>
<ul class="art-check">
  <li><strong>Départ</strong> : les coups de départ sur par 4 et par 5.</li>
  <li><strong>Approche</strong> : les coups vers le green depuis le fairway, le rough ou un bunker de fairway.</li>
  <li><strong>Petit jeu</strong> : chips, pitchs et bunkers autour du green.</li>
  <li><strong>Putting</strong> : tous les coups joués sur le green.</li>
</ul>
<p>Exemple : +0,5 en approche signifie que tes approches t'ont fait gagner un demi-coup sur le tour par rapport à la référence.</p>
<h3>Ce que Broadie a montré</h3>
<p>En comparant des milliers de coups, il a observé que <strong>le jeu long explique la plus grande part de l'écart</strong> entre un bon joueur et un joueur moyen, et le putting une part plus petite qu'on ne le croit. Ça ne veut pas dire que le putting ne compte pas, mais qu'on surestime souvent son poids.</p>
<div class="art-quote">Le bon secteur à travailler est celui qui te coûte le plus de coups, pas celui qui t'énerve le plus.</div>
<h3>La version de l'app</h3>
<p>Le vrai Strokes Gained demande de noter chaque coup avec sa position. L'app en calcule une version simplifiée à partir de ce que tu saisis déjà : ton score, tes fairways, tes greens et tes putts, comparés à des barèmes amateurs de ton index et ajustés au parcours joué. Le putting est exact (un putt = un coup) ; le petit jeu est déduit par différence.</p>
<h3>Bien l'utiliser</h3>
<ul class="art-check">
  <li>Attends au moins 5 à 10 parties avant de tirer des conclusions.</li>
  <li>Regarde le secteur le plus négatif, pas une partie isolée.</li>
  <li>Choisis un programme d'entraînement sur ce secteur, puis vérifie la tendance dans 6 semaines.</li>
</ul>`},

{id:35, cat:"analyse", niveau:"Intermédiaire", format:"guide",
 title:"Débriefer sa partie en 15 minutes",
 subtitle:"La méthode simple pour apprendre de chaque tour, tant que tes souvenirs sont frais.",
 excerpt:"Dans l'heure qui suit la partie, tu te souviens de tes décisions. Le lendemain, il ne reste que le score.",
 app:{go:"courses", label:"Mon carnet de parcours"},
 body:`<h3>Pourquoi débriefer tout de suite</h3>
<p>Juste après ta partie, tu te souviens encore du club joué au 7, de la décision au 12, du putt manqué au 16. Le lendemain, il ne reste qu'une impression générale. Le débrief se fait <strong>dans l'heure</strong>.</p>
<h3>15 minutes, 4 étapes</h3>
<ul class="art-check">
  <li><strong>0-3 min, les chiffres :</strong> score, fairways, greens, putts. Si tu as saisi ta carte dans l'app, c'est déjà fait.</li>
  <li><strong>3-8 min, les 3 décisions :</strong> trois moments où un autre choix aurait changé ton score. Pas les mauvais coups, les mauvaises décisions.</li>
  <li><strong>8-12 min, les répétitions :</strong> même erreur, même trou, même club ? Une erreur qui revient est ta prochaine priorité d'entraînement.</li>
  <li><strong>12-15 min, les 3 réussites :</strong> trois choses qui ont bien marché. Termine toujours par là : il faut savoir ce qui fonctionne pour le refaire.</li>
</ul>
<div class="art-quote">Celui qui analyse apprend deux fois : en jouant, puis en y repensant.</div>
<h3>Garder une trace</h3>
<p>Le carnet de parcours de l'app sert exactement à ça : une note et un club par trou, qui réapparaissent pendant ta prochaine saisie sur ce parcours. En quelques mois, tu as une mémoire du terrain qu'aucun conseil général ne remplace.</p>`}
);

/* ═══════════ STRATÉGIE ═══════════ */
ARTICLES.push(
{id:5, cat:"strategie", niveau:"Débutant", format:"guide", start:2,
 title:"Les 5 règles de base pour mieux gérer le parcours",
 subtitle:"Gagner des coups sans toucher à ton swing, simplement en évitant les catastrophes.",
 excerpt:"Avant d'optimiser ton jeu, élimine les erreurs de stratégie de base. Elles coûtent souvent plus que ton swing.",
 app:{go:"courses", label:"Mon plan de jeu"},
 body:`<h3>Éviter les gros scores avant tout</h3>
<p>Quand on débute, ce ne sont pas les bogeys qui font exploser la carte, ce sont les 8 et les 9. Ces cinq règles servent à les éviter. Elles ne demandent aucun progrès technique.</p>
<p><strong>Règle 1 — Choisis le club que tu maîtrises.</strong> Si le driver part une fois sur deux dans les arbres, prends un bois 5, un hybride ou un fer que tu tapes droit. Une balle en jeu à 150 m vaut mieux qu'une balle perdue à 200 m.</p>
<p><strong>Règle 2 — Joue loin de l'eau et du hors-limites.</strong> Une balle dans l'eau coûte un coup de pénalité ; une balle hors limites ou perdue en coûte un et t'oblige à rejouer du même endroit. Dans le doute, vise le côté opposé au danger.</p>
<p><strong>Règle 3 — Vise le centre du green, pas le drapeau.</strong> Les drapeaux sont souvent placés près des bords et des bunkers. Le centre du green laisse toujours un putt jouable.</p>
<p><strong>Règle 4 — Découpe les longs trous.</strong> Sur un par 5, trois coups tranquilles valent mieux que deux coups forcés. Le but est d'arriver près du green avec un coup facile.</p>
<p><strong>Règle 5 — En bunker ou dans les arbres, sors d'abord.</strong> Remettre la balle en jeu, même en arrière, coûte un coup. Tenter le coup miracle en coûte souvent trois.</p>
<div class="art-quote">La première stratégie du golf : éviter les catastrophes. Tout le reste vient après.</div>
<h3>Exercice</h3>
<p>Pendant ta prochaine partie, note chaque risque pris qui a mal tourné. À la fin, compte les coups perdus sur ces décisions : c'est ton « coût de l'imprudence ». Tu verras vite qu'il pèse lourd.</p>`},

{id:6, cat:"strategie", niveau:"Intermédiaire", format:"longform",
 title:"Bien jouer les par 5",
 subtitle:"Les trous où l'on peut gagner des coups, et où l'ego en fait souvent perdre.",
 excerpt:"Les par 5 offrent de vraies occasions de score. À condition de les jouer avec la tête plutôt qu'avec l'envie.",
 app:{go:"courses", label:"Mon plan de jeu"},
 body:`<h3>Le piège des par 5</h3>
<p>Sur un par 5, la tentation est de sortir le bois 3 pour « s'approcher le plus possible ». Mais un coup long et risqué qui finit dans l'eau transforme une occasion de par en double bogey. Les amateurs laissent souvent sur ces trous des coups qu'ils n'avaient pas besoin de perdre.</p>
<div class="art-quote">Sur un par 5, la bonne question n'est pas « jusqu'où puis-je aller ? » mais « d'où ai-je envie de jouer mon troisième coup ? ».</div>
<h3>Décider en 3 questions</h3>
<p><strong>1. Qu'est-ce que je risque ?</strong> Si le coup long te fait flirter avec l'eau, le hors-limites ou un bunker profond, joue en trois.</p>
<p><strong>2. Quelle distance préférée pour mon troisième coup ?</strong> Beaucoup de joueurs sont plus à l'aise à 80-100 m qu'à 30 m. Pars de là et remonte le trou à l'envers.</p>
<p><strong>3. Combien coûte l'erreur ?</strong> Si rater, c'est un double bogey probable, joue la sécurité.</p>
<h3>Préparer ses zones de lay-up</h3>
<p>Sur les par 5 de ton parcours habituel, choisis à l'avance l'endroit où tu veux poser ton deuxième coup : une distance confortable pour ton wedge, un terrain plat, loin des obstacles. Note-le dans ton carnet de parcours : l'app te le rappellera pendant la saisie.</p>
<h3>Exemple : par 5 de 480 m</h3>
<p>Ton départ fait 190 m. Il reste 290 m. Un bois 3 à 170 m te laisserait 120 m, mais le long d'un étang. Un fer 7 à 130 m te laisse 160 m, en sécurité. Encore un fer 7 et tu es à 30 m pour un chip. Trois coups simples, zéro pénalité : c'est souvent la façon la plus sûre de faire bogey ou mieux.</p>
<h3>L'erreur classique</h3>
<p>Prendre un gros club « pour avoir un coup plus court ensuite » quand la zone d'arrivée est défendue. Le résultat le plus probable n'est pas le coup court, c'est la pénalité.</p>`},

{id:7, cat:"strategie", niveau:"Avancé", format:"longform",
 title:"Préparer sa stratégie trou par trou",
 subtitle:"Prendre ses décisions à froid, avant la partie, plutôt que sous pression sur le départ.",
 excerpt:"Une décision prise sous pression est presque toujours moins bonne qu'une décision prise à tête reposée.",
 app:{go:"courses", label:"Mon plan de jeu"},
 body:`<h3>Jouer le parcours avant de le jouer</h3>
<p>Beaucoup de joueurs de haut niveau disent jouer chaque trou dans leur tête avant la partie. L'intérêt est simple : sur le départ, avec le partenaire qui attend et le cœur qui bat, on décide mal. La veille, au calme, on décide bien.</p>
<h3>La préparation en 48 h</h3>
<ul class="art-check">
  <li><strong>J-2 :</strong> regarde le plan du parcours. Repère les 3 trous les plus dangereux et les 3 trous où tu peux marquer.</li>
  <li><strong>J-1 :</strong> choisis ton club de départ sur chaque trou.</li>
  <li><strong>J-1 :</strong> repère les zones interdites (eau, hors-limites, rough profond) et les zones de sécurité.</li>
  <li><strong>Jour J :</strong> applique le plan. Ajuste au vent ou au terrain mouillé, mais dans le cadre prévu.</li>
</ul>
<h3>Classer les trous</h3>
<p>Mets chaque trou dans une catégorie : <strong>Attaque</strong> (tu vises mieux que ton score habituel), <strong>Neutre</strong> (tu joues ton score habituel), <strong>Survie</strong> (l'objectif est d'éviter le double bogey). Le plan de jeu de l'app te montre déjà tes trous forts et tes trous noirs, calculés sur tes parties.</p>
<div class="art-quote">Un plan imparfait appliqué avec constance bat une improvisation brillante mais irrégulière.</div>
<h3>Tenir compte du vent</h3>
<p>Face au vent, un trou joue nettement plus long ; vent dans le dos, plus court. Avant chaque coup, demande-toi quelle distance le trou « joue » vraiment aujourd'hui, et choisis ton club en fonction. La météo affichée pendant la saisie est là pour ça.</p>`},

{id:8, cat:"strategie", niveau:"Expert", format:"longform",
 title:"En compétition : la stratégie du plancher",
 subtitle:"Fixer le score maximum acceptable sur chaque trou et jouer pour ne jamais le dépasser.",
 excerpt:"En compétition, un double bogey pèse plus lourd qu'en partie amicale. Ta stratégie doit en tenir compte.",
 app:{go:"courses", label:"Mes trous noirs"},
 body:`<h3>Le risque n'est pas symétrique</h3>
<p>En partie amicale, un double bogey est une déception. En compétition en stroke play, il peut ruiner la carte. Pourtant, la plupart des joueurs jouent exactement de la même façon dans les deux cas.</p>
<h3>Le principe</h3>
<p>Sur chaque trou, fixe ton <strong>plancher</strong> : le score maximum acceptable. Bogey sur un par 4 ordinaire, double bogey sur un par 5 très difficile, bogey sur un par 3 entouré d'eau. Une fois le plancher fixé, tu ne joues plus pour briller : tu joues pour ne pas le dépasser.</p>
<h3>Faire le calcul</h3>
<p>Prends deux cartes : l'une avec 6 bogeys et 12 pars, l'autre avec 2 birdies, 10 pars, 3 bogeys et 3 doubles bogeys. La première fait +6, la seconde +7. Les trous spectaculaires ne compensent pas les accidents. Pour la plupart des joueurs de club, <strong>supprimer les doubles bogeys</strong> rapporte plus qu'ajouter des birdies.</p>
<div class="art-quote">On gagne rarement une compétition sur un coup de génie. On la perd souvent sur un coup de trop.</div>
<h3>Tes trous « survie »</h3>
<p>Sur ton parcours, repère les 3 ou 4 trous où tu fais le plus souvent double bogey ou pire (le plan de jeu de l'app les classe pour toi). En compétition, joue-les avec un club plus sûr au départ, vise le centre du green même si le drapeau est accessible, et considère le bogey comme un bon score.</p>
<h3>La pression du dernier trou</h3>
<p>Quand tu arrives au 18 avec un bon score, la réponse n'est pas de « rester concentré », c'est d'avoir une procédure : la même routine sur chaque coup, une stratégie décidée à l'avance sur ce trou, et l'exécution. La routine remplace la décision par l'habitude.</p>`},

{id:33, cat:"strategie", niveau:"Intermédiaire", format:"fiche",
 title:"Les 7 questions à te poser sur chaque départ",
 subtitle:"30 secondes de réflexion avant de poser le tee.",
 excerpt:"Un petit rituel sur le départ évite beaucoup de frustration autour du green.",
 body:`<h3>La check-list du départ</h3>
<p>Avant de poser le tee, sept questions. Avec l'habitude, elles prennent moins de 30 secondes.</p>
<ul class="art-check">
  <li><strong>1. Quelle longueur ?</strong> La vraie longueur du trou depuis ton départ, vent compris.</li>
  <li><strong>2. Où est le danger ?</strong> Eau, hors-limites, bunkers : de quel côté, à quelle distance ?</li>
  <li><strong>3. Où dois-je absolument être ?</strong> Pas « où j'aimerais aller » mais « quelle zone m'évite les ennuis ».</li>
  <li><strong>4. Quel club m'y amène régulièrement ?</strong> Pense à ton coup moyen, pas à ton meilleur.</li>
  <li><strong>5. Où est le drapeau ?</strong> Devant, derrière, à gauche, à droite : ça décide de quel côté du fairway il vaut mieux être.</li>
  <li><strong>6. Quel est mon plan B ?</strong> Si je rate, de quel côté vaut-il mieux rater ?</li>
  <li><strong>7. Quel score est acceptable ?</strong> Fixe ton plancher avant de jouer.</li>
</ul>
<div class="art-quote">30 secondes de réflexion sur le départ valent mieux que 5 minutes de frustration autour du green.</div>`}
);

/* ═══════════ TECHNIQUE ═══════════ */
ARTICLES.push(
{id:9, cat:"technique", niveau:"Débutant", format:"fiche", start:1,
 title:"Les 3 bases à maîtriser avant tout",
 subtitle:"Prise en main, posture, alignement : ce qui se règle avant même de bouger le club.",
 excerpt:"Avant de travailler ton swing, vérifie ta prise, ta posture et ton alignement. C'est là que tout commence.",
 app:{go:"training", label:"Exercices pour débuter"},
 body:`<h3>Ce qui se passe avant le swing</h3>
<p>Beaucoup d'erreurs de trajectoire viennent d'un réglage de départ, pas du mouvement lui-même. Si tu n'es pas sûr de ta prise, de ta posture ou de ton alignement, commence par là. Et si tu peux, fais-les vérifier une fois par un enseignant : c'est le cours le plus rentable qui soit.</p>
<h4>La prise (le grip)</h4>
<p>Le club repose dans les <strong>doigts</strong>, pas au creux de la paume. Serre sans crisper : sur une échelle de 1 à 10, vise 4. L'image classique : tenir un oiseau sans l'écraser ni le laisser s'envoler. Pour un droitier, les « V » formés par le pouce et l'index de chaque main pointent à peu près vers l'épaule droite.</p>
<h4>La posture</h4>
<p>Pieds à peu près de la largeur des épaules avec un fer moyen, un peu plus écartés avec le driver. Genoux légèrement fléchis, buste penché vers l'avant à partir des hanches, bras relâchés. Le poids est réparti entre les deux pieds. Balle au centre du stance pour les wedges, et de plus en plus vers le pied avant à mesure que le club s'allonge.</p>
<h4>L'alignement</h4>
<p>La base la plus négligée. Beaucoup de joueurs s'alignent sans le savoir à côté de leur cible (souvent à droite pour un droitier), puis compensent avec le swing. À l'entraînement, pose un club au sol le long de tes pieds, pointé parallèlement à la ligne de la cible.</p>
<div class="art-quote">Des bases propres font souvent gagner plus de coups qu'un changement de swing.</div>
<ul class="art-check">
  <li>Vérifie ta prise devant un miroir.</li>
  <li>Entraîne-toi avec un club (ou un bâton) d'alignement au sol, à chaque séance.</li>
  <li>Filme-toi de face et de profil pour voir ta vraie posture.</li>
</ul>`},

{id:10, cat:"technique", niveau:"Intermédiaire", format:"guide",
 title:"Une routine de putting en 5 étapes",
 subtitle:"Automatiser la préparation du putt pour ne plus douter au moment de frapper.",
 excerpt:"Le putting est la partie du jeu la plus sensible à la pression. La solution : une routine, toujours la même.",
 app:{go:"training", label:"Exercices de putting"},
 body:`<h3>Pourquoi une routine</h3>
<p>Sur le green, le doute coûte cher. La solution n'est pas de « se concentrer plus » mais de suivre toujours les mêmes étapes, pour que la décision soit prise avant de se mettre à la balle.</p>
<h3>La routine</h3>
<p><strong>1. Lire le green (20 à 30 secondes).</strong> Regarde la pente depuis derrière la balle, puis de côté, surtout la zone près du trou où la balle ralentit. Décide de ta ligne et de ta vitesse. Une fois décidé, tu ne changes plus.</p>
<p><strong>2. Choisir un repère.</strong> Trouve un point sur ta ligne, 30 à 50 cm devant la balle (une tache, un brin d'herbe). Il est plus facile de s'aligner sur un point proche que sur un trou à 6 m.</p>
<p><strong>3. Se mettre en place.</strong> Toujours dans le même ordre : putter derrière la balle aligné sur le repère, puis les pieds, puis la prise. Yeux au-dessus de la balle ou juste à l'intérieur.</p>
<p><strong>4. Un ou deux essais.</strong> Des mouvements d'essai en regardant le trou, pour sentir l'amplitude qui correspond à la distance.</p>
<p><strong>5. Frapper.</strong> Un dernier regard vers le trou, puis les yeux sur la balle. Accompagne le putter après l'impact et garde la tête immobile un instant.</p>
<div class="art-quote">La routine chasse l'hésitation. Et l'hésitation est la première ennemie du putt.</div>
<h3>Les 3 erreurs les plus courantes</h3>
<ul class="art-check">
  <li><strong>Lever la tête trop tôt</strong> pour voir la balle partir : les épaules bougent et la face tourne.</li>
  <li><strong>Changer d'avis au dernier moment :</strong> le putter ralentit et le putt reste court.</li>
  <li><strong>Raccourcir la routine sous pression :</strong> c'est justement là qu'il faut la respecter.</li>
</ul>`},

{id:11, cat:"technique", niveau:"Avancé", format:"longform",
 title:"Maîtriser ses wedges : distance, trajectoire, effet",
 subtitle:"La zone des 50-100 m, là où beaucoup de coups se gagnent.",
 excerpt:"Entre 50 et 100 m, connaître précisément ses distances fait une vraie différence sur le score.",
 app:{go:"training", label:"Exercices d'approche"},
 body:`<h3>La zone 50-100 m</h3>
<p>C'est la distance des troisièmes coups sur par 5, des sorties de trouble et des approches après un départ raté. Pour beaucoup de joueurs entre 8 et 20 d'index, c'est la zone la plus rentable à travailler, parce qu'on y joue souvent et qu'on y est rarement précis.</p>
<h3>Les 3 amplitudes</h3>
<p><strong>Pleine amplitude</strong> : ta distance maximale « propre » avec chaque wedge. Elle doit être mesurée, pas estimée.</p>
<p><strong>Trois quarts</strong> : backswing réduit, trajectoire plus basse, plus facile à contrôler, idéale par vent.</p>
<p><strong>Demi-swing</strong> : les mains montent à hauteur de hanche. Pour les distances intermédiaires.</p>
<p>Trois amplitudes × trois wedges = neuf distances connues. C'est ce qu'on appelle un système de distances.</p>
<h3>Mesurer ses distances</h3>
<p>Frappe 10 balles avec la même amplitude et note où elles s'arrêtent (télémètre, practice balisé ou simulateur). Garde la <strong>médiane</strong> plutôt que la moyenne : elle ignore les deux ou trois coups ratés qui faussent tout.</p>
<div class="art-quote">Une distance que tu connais vraiment vaut mieux qu'un beau geste approximatif.</div>
<h3>L'effet (le spin)</h3>
<p>L'effet vient d'un contact propre : la balle d'abord, le sol ensuite. Ce n'est pas une question de force. Attention au « flyer » : quand de l'herbe se coince entre la face et la balle (rough, herbe mouillée), la balle tourne moins, vole souvent plus loin et roule davantage. Depuis le rough, prévois qu'elle aille plus loin et qu'elle s'arrête moins vite.</p>`},

{id:12, cat:"technique", niveau:"Expert", format:"longform",
 title:"Travailler ses trajectoires : fade, draw et balle basse",
 subtitle:"Avoir plusieurs trajectoires fiables pour s'adapter à chaque situation.",
 excerpt:"Un joueur avec une seule trajectoire dépend des conditions. Un joueur qui en a trois s'y adapte.",
 app:{go:"training", label:"Exercices de précision"},
 body:`<h3>Pourquoi plusieurs trajectoires</h3>
<p>Un arbre à contourner, un drapeau à droite du green, un fort vent de face : chaque situation appelle une trajectoire différente. À haut niveau, savoir courber la balle sur commande n'est pas un luxe, c'est un outil de stratégie.</p>
<h3>Le principe</h3>
<p>La direction de départ de la balle dépend surtout de <strong>l'orientation de la face</strong> à l'impact ; la courbe dépend de l'écart entre la face et la <strong>trajectoire du club</strong>. Face ouverte par rapport à la trajectoire : la balle tourne vers la droite (pour un droitier). Face fermée : vers la gauche.</p>
<h4>Le fade (gauche → droite pour un droitier)</h4>
<p>Aligne tes pieds et tes épaules légèrement à gauche de la cible, garde la face orientée vers la cible, et swingue le long de la ligne de tes pieds. La face est alors ouverte par rapport à la trajectoire : la balle part à gauche et revient doucement.</p>
<h4>Le draw (droite → gauche)</h4>
<p>L'inverse : pieds et épaules légèrement à droite, face vers la cible, swing le long des pieds. Certains joueurs renforcent un peu leur prise pour aider la face à se refermer.</p>
<h4>La balle basse</h4>
<p>Indispensable face au vent. Balle un peu plus en arrière dans le stance, mains en avance, finish plus court et plus bas. Prends un ou deux clubs de plus et swingue plus doucement : moins de vitesse, moins d'effet, donc moins de hauteur.</p>
<div class="art-quote">Maîtriser trois trajectoires, c'est ne plus subir les conditions.</div>
<ul class="art-check">
  <li>Travaille chaque trajectoire séparément, en blocs de 20 à 30 balles.</li>
  <li>Commence avec un fer 7, plus facile à sentir, puis passe aux autres clubs.</li>
  <li>Valide-les en partie amicale avant de t'en servir en compétition.</li>
</ul>`}
);

/* ═══════════ MENTAL ═══════════ */
ARTICLES.push(
{id:13, cat:"mental", niveau:"Débutant", format:"fiche", start:5,
 title:"Oublier un mauvais trou avant le suivant",
 subtitle:"Un double bogey coûte deux coups. Mal digéré, il en coûte beaucoup plus.",
 excerpt:"Le vrai danger d'un mauvais trou, c'est la contagion : la frustration qui gâche les trois suivants.",
 body:`<h3>La contagion</h3>
<p>Un double bogey coûte deux coups. Mais si la colère te suit sur le départ suivant, tu tapes plus fort, tu prends plus de risques, et la série continue. C'est souvent là que les cartes explosent, bien plus que sur le mauvais trou lui-même.</p>
<h3>La règle des 10 pas</h3>
<p>Autorise-toi à être frustré pendant les 10 pas qui suivent la sortie du green. Après 10 pas, c'est fini : le trou appartient au passé. Ce qui existe, c'est le prochain départ. Simple à dire, difficile à faire, mais très efficace avec l'habitude.</p>
<h3>La boîte fermée</h3>
<p>Imagine que chaque trou est une boîte. Quand tu sors du green, la boîte se ferme et ne se rouvre plus, qu'il y ait un birdie ou un triple bogey dedans. La seule boîte sur laquelle tu as du pouvoir, c'est la suivante.</p>
<div class="art-quote">Le trou que tu viens de jouer n'existe plus. Seul compte celui que tu joues maintenant.</div>
<ul class="art-check">
  <li>Choisis ton propre « bouton reset » : un geste, un mot, une grande respiration.</li>
  <li>Utilise-le après chaque bogey ou pire, pas seulement après les catastrophes.</li>
  <li>Après la partie, note ta gestion des mauvais moments, indépendamment du score.</li>
</ul>`},

{id:14, cat:"mental", niveau:"Intermédiaire", format:"longform",
 title:"La routine avant le coup, ton armure mentale",
 subtitle:"Occuper ton esprit avec des étapes précises pour ne pas laisser de place au doute.",
 excerpt:"« Surtout pas dans l'eau… » La routine avant le coup est ta meilleure protection contre ces pensées.",
 body:`<h3>À quoi sert la routine</h3>
<p>Sous pression, les pensées parasites arrivent : « ne rate pas », « si tu la mets à droite… », « tout le monde regarde ». Une routine occupe ton esprit avec des actions précises, toujours dans le même ordre. Il ne reste plus de place pour le reste.</p>
<h3>Construire ta routine en 4 phases</h3>
<p><strong>1. Analyser (derrière la balle).</strong> Distance, vent, obstacles, lie de la balle. Choix du club et du coup. Cette phase se termine par une décision claire.</p>
<p><strong>2. Visualiser.</strong> Imagine le vol de la balle et l'endroit où elle atterrit. Quelques secondes suffisent.</p>
<p><strong>3. Se mettre en place.</strong> Club derrière la balle, puis les pieds, puis la prise. Toujours dans le même ordre.</p>
<p><strong>4. Déclencher.</strong> Un élément fixe qui lance le swing : un dernier regard vers la cible, un petit mouvement du club, un mot. Il signale que la réflexion est terminée.</p>
<div class="art-quote">Ta routine doit être la même sur le 1 d'une partie amicale et sur le 18 d'une compétition.</div>
<h3>Combien de temps ?</h3>
<p>Il n'y a pas de durée magique. Trop longue, elle laisse le doute s'installer ; trop courte, elle ne prépare rien. L'important est qu'elle soit <strong>toujours à peu près la même</strong> : c'est la régularité qui la rend rassurante. Chronomètre-toi à l'entraînement pour connaître la tienne.</p>`},

{id:15, cat:"mental", niveau:"Avancé", format:"longform",
 title:"Le « flow » : jouer dans ta meilleure zone",
 subtitle:"Cet état où tout paraît simple. On ne peut pas le forcer, mais on peut lui préparer le terrain.",
 excerpt:"Le swing semble automatique, les décisions sont évidentes. Voici les conditions qui favorisent cet état.",
 body:`<h3>Qu'est-ce que le flow ?</h3>
<p>Le psychologue Mihaly Csikszentmihalyi a décrit le flow comme un état d'absorption totale dans une activité, qui apparaît quand la difficulté de la tâche correspond à peu près à nos capacités. Au golf, c'est cette partie où le swing semble couler tout seul et où l'on ne pense plus au score.</p>
<h3>Les conditions qui le favorisent</h3>
<ul class="art-check">
  <li><strong>Un objectif clair</strong> sur chaque coup.</li>
  <li><strong>Un retour immédiat</strong> : tu sens la qualité du coup à l'impact.</li>
  <li><strong>Un bon équilibre</strong> : le parcours te stimule sans t'écraser.</li>
  <li><strong>Le présent</strong> : ton attention est sur le coup, pas sur la carte.</li>
</ul>
<h3>Préparer le terrain</h3>
<p><strong>Avant la partie :</strong> arrive en avance. Un échauffement bâclé crée de la tension. Une demi-heure bien organisée vaut mieux qu'une heure de balles tapées au hasard.</p>
<p><strong>Pendant la partie :</strong> concentre-toi sur le processus. « Quel est mon objectif sur ce coup ? » plutôt que « combien je fais sur ce trou ? ». Le score est une conséquence ; le processus est ce que tu contrôles.</p>
<div class="art-quote">Le flow ne se cherche pas. Il arrive quand tu es entièrement dans ce que tu fais.</div>
<h3>Après l'avoir perdu</h3>
<p>Un mauvais trou casse souvent la dynamique. Entre deux trous : trois respirations lentes, puis ramène ton attention sur tes sens (ce que tu entends, ce que tu vois, le sol sous tes pieds), puis reprends ta routine. N'essaie pas de retrouver la sensation à tout prix : recrée les conditions.</p>`},

{id:16, cat:"mental", niveau:"Expert", format:"longform",
 title:"Bien jouer quand l'enjeu monte",
 subtitle:"Pourquoi on joue moins bien en compétition, et comment réduire l'écart.",
 excerpt:"Beaucoup d'amateurs scorent plus haut en compétition qu'en partie amicale. Le swing n'a pas changé ; les décisions, si.",
 body:`<h3>Le paradoxe de la compétition</h3>
<p>La plupart des amateurs connaissent ça : un score « détendu » en partie amicale, et un score plus élevé dès qu'il y a un classement. Le swing n'a pas disparu entre les deux. Ce qui change, c'est la façon de penser et de décider.</p>
<h3>3 mécanismes sous pression</h3>
<ul class="art-check">
  <li><strong>Trop de pensées techniques :</strong> on se met à contrôler un mouvement qui était automatique, et il se dérègle.</li>
  <li><strong>Des choix incohérents :</strong> trop prudent sur des coups faciles, trop agressif pour « se refaire » après une erreur.</li>
  <li><strong>L'obsession du résultat :</strong> on joue la carte au lieu de jouer le coup.</li>
</ul>
<h3>Se préparer à la pression</h3>
<p><strong>Les jours précédents :</strong> mets de l'enjeu à l'entraînement. Un petit défi avec un partenaire, un nombre de putts à rentrer d'affilée sinon tu recommences. Le but est de t'habituer à jouer avec le cœur qui bat.</p>
<p><strong>La veille :</strong> 10 minutes de visualisation. Parcours les trous dans ta tête, imagine les situations difficiles et toi qui y réponds avec ta routine habituelle. Ce n'est pas de la pensée positive, c'est une répétition.</p>
<div class="art-quote">Joue le coup, pas le classement.</div>
<h3>Une seule pensée par coup</h3>
<p>Garde une seule intention simple pour chaque coup, par exemple « finir équilibré » ou « tempo lent ». Elle occupe ton attention et empêche les pensées parasites de s'installer, sans te noyer dans la technique.</p>`},

{id:34, cat:"mental", niveau:"Intermédiaire", format:"fiche",
 title:"Respirer pour retrouver son calme",
 subtitle:"Le moyen le plus simple d'agir sur le stress entre deux coups.",
 excerpt:"Quand la pression monte, la respiration est le seul levier que tu contrôles directement.",
 body:`<h3>Pourquoi ça marche</h3>
<p>Sous stress, le cœur accélère, les muscles se crispent et les gestes fins deviennent moins précis. Respirer lentement, avec une <strong>expiration plus longue que l'inspiration</strong>, aide le corps à ralentir. C'est l'un des rares réglages du stress sur lesquels tu as un contrôle direct.</p>
<h3>Deux techniques simples</h3>
<ul class="art-check">
  <li><strong>4-6 :</strong> inspire par le nez en 4 secondes, expire lentement par la bouche en 6 secondes. Trois ou quatre fois.</li>
  <li><strong>4-7-8 :</strong> inspire en 4 secondes, retiens 7 secondes, expire en 8 secondes. Deux ou trois cycles, pas plus. Si retenir ta respiration te gêne, reste sur le 4-6.</li>
</ul>
<h3>Quand t'en servir</h3>
<ul class="art-check">
  <li>En marchant vers un départ qui te stresse d'habitude.</li>
  <li>Juste après un mauvais trou.</li>
  <li>Avant un putt important, avant de commencer ta routine (pas pendant).</li>
  <li>Dès que tu sens la tension monter dans la poitrine ou les épaules.</li>
</ul>
<div class="art-quote">Un coup de golf dure deux secondes. Trente secondes pour s'y préparer, c'est bien investi.</div>`}
);

/* ═══════════ PRÉPARATION ═══════════ */
ARTICLES.push(
{id:17, cat:"preparation", niveau:"Débutant", format:"guide", start:6,
 title:"S'entraîner quand on a peu de temps",
 subtitle:"Organiser 1 à 2 heures par semaine pour qu'elles servent vraiment.",
 excerpt:"La plupart des golfeurs ont peu de temps pour s'entraîner. Bien réparti, il suffit pour progresser.",
 app:{go:"training", label:"Créer mon programme"},
 body:`<h3>La réalité de l'amateur</h3>
<p>Entre le travail, les études et la famille, on a souvent 1 à 3 heures par semaine pour s'entraîner. Passées à taper des drivers au practice, ces heures changent peu de choses. Bien réparties, elles font vraiment baisser le score.</p>
<h3>Une répartition simple</h3>
<p><strong>Environ 40 % pour le putting.</strong> Plus d'un coup sur trois se joue sur le green. Travaille les putts de 1 à 2 m (ceux qu'on doit rentrer) et les longs putts (pour ne plus faire 3 putts).</p>
<p><strong>Environ 30 % pour le petit jeu.</strong> Chips, pitchs, bunkers. C'est souvent là que les progrès sont les plus rapides quand on débute.</p>
<p><strong>Environ 30 % pour les coups longs.</strong> Fers et bois, en cherchant un contact régulier plutôt que la distance.</p>
<div class="art-quote">Beaucoup d'amateurs passent 10 minutes au putting et une heure au driver. C'est l'inverse qui fait baisser le score.</div>
<h3>Une séance type d'une heure</h3>
<ul class="art-check">
  <li><strong>0-15 min :</strong> putting, courtes distances (1 à 3 m), une vingtaine de putts.</li>
  <li><strong>15-30 min :</strong> chips et pitchs autour du green d'entraînement.</li>
  <li><strong>30-50 min :</strong> fers, avec un fer 7 comme club principal.</li>
  <li><strong>50-60 min :</strong> 10 à 15 drivers, en soignant l'alignement.</li>
</ul>
<p>L'onglet Entraînement peut te construire un programme de 4 semaines centré sur ton secteur le plus faible.</p>`},

{id:18, cat:"preparation", niveau:"Intermédiaire", format:"longform",
 title:"Préparer un tournoi en 7 jours",
 subtitle:"Une semaine organisée plutôt qu'une matinée improvisée.",
 excerpt:"Un tournoi se prépare sur une semaine, pas le matin même.",
 app:{go:"courses", label:"Mon plan de jeu"},
 body:`<h3>Pourquoi une semaine</h3>
<p>La plupart des amateurs se préparent le matin du tournoi. Une semaine organisée n'a rien d'excessif : elle permet d'arriver avec un plan, des repères et de la confiance.</p>
<h4>J-7 : faire le point</h4>
<p>Si tu connais le parcours, repère tes trous forts et faibles (le plan de jeu de l'app les calcule depuis tes parties). Fixe un objectif de score réaliste et ta stratégie générale.</p>
<h4>J-6 à J-3 : entraînement ciblé</h4>
<ul class="art-check">
  <li>Travaille les coups que ce parcours va te demander.</li>
  <li>Reproduis les situations attendues : bunkers, approches de distances précises.</li>
  <li>N'essaie pas de nouvelle technique : consolide ce qui marche.</li>
</ul>
<h4>J-2 : reconnaissance</h4>
<p>Si possible, joue le parcours en partie d'entraînement. Sinon, étudie le plan trou par trou et visualise ta stratégie.</p>
<h4>J-1 : léger</h4>
<p>Une séance courte, 30 à 40 minutes, putting et quelques fers. Le but est de garder les sensations, pas de progresser. Couche-toi à ton heure habituelle.</p>
<h4>Le jour J</h4>
<ul class="art-check">
  <li>Arrive environ une heure avant ton départ.</li>
  <li>Échauffement : quelques putts, des chips, puis des fers courts vers les longs, et quelques drivers.</li>
  <li>Termine par quelques putts courts rentrés, pour partir sur une bonne sensation.</li>
  <li>Les 5 dernières minutes : respire, bois, visualise ton premier coup.</li>
</ul>
<div class="art-quote">L'échauffement ne sert pas à progresser. Il sert à réveiller ce qui marche déjà.</div>`},

{id:19, cat:"preparation", niveau:"Avancé", format:"longform",
 title:"Organiser son entraînement sur une saison",
 subtitle:"Découper l'année en phases pour progresser et être en forme au bon moment.",
 excerpt:"Travailler la technique en plein mois de compétitions est rarement une bonne idée. La périodisation évite ce piège.",
 body:`<h3>Le principe</h3>
<p>La périodisation vient des sports d'endurance : on découpe l'année en phases, chacune avec son objectif. Au golf, elle évite de stagner et d'arriver en forme… au mauvais moment.</p>
<h3>Les 4 phases (calendrier européen)</h3>
<p><strong>Hiver (décembre-février) — les fondations.</strong> C'est le moment des vrais changements techniques, quand un swing en chantier ne coûte rien. Priorité : les bases, le putting, le petit jeu.</p>
<p><strong>Pré-saison (mars-avril) — la mise en jeu.</strong> Transposer les changements en situation réelle. Des parties d'entraînement où l'on juge l'exécution plutôt que le score.</p>
<p><strong>Saison (mai-septembre) — la compétition.</strong> Moins de technique, plus de stratégie, de mental et d'entretien des sensations.</p>
<p><strong>Fin de saison (octobre-novembre) — le bilan.</strong> Analyser la saison, choisir les chantiers de l'hiver, récupérer physiquement et mentalement.</p>
<div class="art-quote">Juste avant une compétition importante, ne change rien : consolide et joue.</div>
<h3>Choisir ses pics</h3>
<p>Choisis 2 ou 3 rendez-vous majeurs dans la saison et organise le reste autour. Tout le reste est préparation ou récupération. L'écran « toi il y a 6 mois » de l'app te permet de vérifier, phase après phase, que le travail paie.</p>`},

{id:20, cat:"preparation", niveau:"Expert", format:"guide",
 title:"Analyser son swing en vidéo, sans s'y perdre",
 subtitle:"Une méthode pour que la vidéo t'aide au lieu de te paralyser.",
 excerpt:"La vidéo sert à trouver les causes, pas à penser à dix choses pendant le swing.",
 body:`<h3>Outil ou obsession ?</h3>
<p>Filmer son swing n'a jamais été aussi facile. Le risque : analyser chaque détail et arriver sur le parcours avec dix pensées techniques. La vidéo sert à identifier une cause, pas à te juger en permanence.</p>
<h3>La méthode en 4 étapes</h3>
<p><strong>1. Pas trop souvent.</strong> Une séance vidéo par semaine suffit. Tous les jours, tu perds le recul.</p>
<p><strong>2. Un seul point à la fois.</strong> Avant de filmer, décide de ce que tu vas regarder : la prise, la position en haut du backswing, le transfert du poids. Pas tout à la fois.</p>
<p><strong>3. Comparer dans le temps.</strong> Filme le même coup, sous le même angle, trois semaines de suite. Le progrès se voit dans la série, pas sur une image isolée.</p>
<p><strong>4. Séparer entraînement et partie.</strong> La vidéo, c'est pour le practice. Sur le parcours, tu joues.</p>
<h3>Les 2 angles de base</h3>
<ul class="art-check">
  <li><strong>De face</strong> (caméra face à toi, à hauteur de hanches) : posture, position de la balle, mouvement de la tête, transfert du poids.</li>
  <li><strong>Dans l'axe</strong> (caméra derrière toi, alignée sur la cible) : alignement, plan du swing, trajectoire du club.</li>
</ul>
<p>Pour la position de la face à l'impact, le ralenti du téléphone aide, mais un enseignant ou un simulateur donnent une information bien plus fiable.</p>
<div class="art-quote">La vidéo montre ce qui se passe. C'est à toi (ou à ton pro) de décider ce qui compte.</div>`},

{id:36, cat:"preparation", niveau:"Avancé", format:"longform",
 title:"S'échauffer et prévenir les blessures",
 subtitle:"Les douleurs les plus fréquentes chez le golfeur, et 10 minutes pour les éviter.",
 excerpt:"Le golf paraît doux, mais un tour, c'est plusieurs kilomètres de marche et beaucoup de rotations rapides du tronc.",
 body:`<h3>Les zones les plus exposées</h3>
<p><strong>Le bas du dos.</strong> C'est la plainte la plus fréquente chez les golfeurs. La rotation répétée sollicite beaucoup la colonne ; renforcer les muscles profonds du tronc et garder des hanches mobiles aide à la protéger.</p>
<p><strong>Le coude.</strong> Le « coude du golfeur » (épicondylite médiale) est une inflammation des tendons à l'intérieur du coude, souvent liée à une prise trop serrée, à des chocs répétés contre le sol ou à une reprise trop brutale.</p>
<p><strong>L'épaule.</strong> Le swing sollicite les muscles qui stabilisent l'épaule. C'est la zone qu'on oublie le plus à l'échauffement.</p>
<p><strong>Le genou avant.</strong> La rotation sur la jambe avant contraint le genou (le gauche pour un droitier), surtout avec l'âge.</p>
<h3>L'échauffement en 10 minutes</h3>
<ul class="art-check">
  <li><strong>2 min :</strong> cercles d'épaules et de hanches.</li>
  <li><strong>2 min :</strong> inclinaisons latérales du buste, debout.</li>
  <li><strong>2 min :</strong> rotations du tronc, un club tenu derrière les épaules.</li>
  <li><strong>2 min :</strong> squats légers et fentes pour réveiller les jambes.</li>
  <li><strong>2 min :</strong> swings progressifs, wedge d'abord, amplitude croissante.</li>
</ul>
<h3>Après la partie</h3>
<p>Quelques minutes de marche tranquille et d'étirements doux aident à récupérer. Et si une douleur persiste plus de quelques jours ou revient à chaque partie, parles-en à un médecin ou à un kiné plutôt que de jouer avec.</p>
<div class="art-quote">La meilleure technique du monde ne sert à rien si tu joues blessé.</div>`}
);

/* ═══════════ COMPÉTITION ═══════════ */
ARTICLES.push(
{id:21, cat:"competition", niveau:"Débutant", format:"guide", start:8,
 title:"Ta première compétition : ce qu'il faut savoir",
 subtitle:"Inscription, carte de score, règles essentielles : pour arriver serein.",
 excerpt:"Une première compétition impressionne. Avec ces quelques repères, tu sauras exactement comment ça se passe.",
 app:{go:"gloss", label:"Les mots du golf"},
 body:`<h3>Avant de t'inscrire</h3>
<ul class="art-check">
  <li><strong>Licence et index :</strong> en France, il faut une licence FFGolf à jour (avec le certificat médical ou le questionnaire de santé demandé par la fédération) et un index. Beaucoup de clubs organisent des compétitions ouvertes aux débutants.</li>
  <li><strong>Le format :</strong> stroke play (on compte tous les coups), stableford (des points par trou, le plus courant en club) ou match play. Renseigne-toi avant.</li>
  <li><strong>Ton sac :</strong> 14 clubs maximum. Les appareils qui mesurent la distance (télémètre, montre ou application GPS) sont autorisés, sauf si une règle locale les interdit.</li>
</ul>
<h3>La carte de score</h3>
<p>En stroke play et en stableford, <strong>ce n'est pas toi qui notes ton score</strong> : un partenaire est ton « marqueur » et tu es le sien. À la fin, vous vérifiez la carte ensemble, trou par trou, puis chacun signe. Attention : si tu rends une carte avec un score <em>inférieur</em> à la réalité sur un trou, tu es disqualifié. Un score supérieur est conservé tel quel. Vérifie donc bien avant de signer.</p>
<h3>L'étiquette</h3>
<ul class="art-check">
  <li>Arrive au moins 45 minutes avant ton heure de départ.</li>
  <li>Silence et immobilité pendant le coup de tes partenaires.</li>
  <li>Joue la balle comme elle repose, sans l'améliorer.</li>
  <li>Ratisse le bunker, relève tes pitchs sur le green, replace tes divots.</li>
  <li>Garde le rythme : sois prêt à jouer quand vient ton tour.</li>
</ul>
<h3>Les 4 règles qui reviennent tout le temps</h3>
<p><strong>Balle perdue ou hors limites :</strong> un coup de pénalité et tu rejoues de l'endroit du coup précédent. Si tu as un doute en frappant, annonce et joue une <strong>balle provisoire</strong> : ça évite de revenir en arrière. (Certaines compétitions de club appliquent une règle locale qui permet de dropper plus loin avec deux coups de pénalité : renseigne-toi.)</p>
<p><strong>Zone de pénalité (eau) :</strong> un coup de pénalité, avec plusieurs options pour dropper.</p>
<p><strong>Balle injouable :</strong> tu peux la déclarer injouable n'importe où sauf en zone de pénalité. Un coup de pénalité, trois options.</p>
<p><strong>En cas de doute sur une règle</strong> en stroke play : annonce que tu joues une deuxième balle, termine le trou avec les deux, et signale-le au comité <em>avant de rendre ta carte</em>.</p>
<div class="art-quote">Personne ne t'en voudra de ne pas tout connaître. On t'en voudra de ne pas demander.</div>`},

{id:22, cat:"competition", niveau:"Intermédiaire", format:"longform",
 title:"Adapter sa stratégie au format et au classement",
 subtitle:"Stroke play, stableford, match play : on ne joue pas les trous de la même façon.",
 excerpt:"La bonne stratégie n'est pas fixe : elle dépend du format et de ta situation dans la partie.",
 app:{go:"gloss", label:"Stableford et match play"},
 body:`<h3>En stroke play : selon ta position</h3>
<p>Chaque coup compte, donc chaque accident se paie. Si tu connais ta situation à mi-parcours, ajuste ton niveau de risque :</p>
<ul class="art-check">
  <li><strong>Bien placé :</strong> joue prudemment et protège ton score. Un double bogey en fin de partie peut coûter la place.</li>
  <li><strong>Au milieu :</strong> joue ton jeu normal, ni frileux ni agressif.</li>
  <li><strong>Loin derrière :</strong> prends des risques calculés. Attaquer un drapeau exposé coûte peu quand il n'y a plus rien à perdre.</li>
</ul>
<h3>En stableford : un trou raté ne ruine rien</h3>
<p>Au stableford, un trou raté vaut 0 point, que tu fasses 8 ou 12. Dès que tu ne peux plus marquer de point, <strong>relève ta balle</strong> : tu gagnes du temps et tu repars l'esprit clair. Cela permet aussi d'attaquer un peu plus sur les trous où tu reçois des coups.</p>
<h3>En match play : un trou à la fois</h3>
<p>Chaque trou est un mini-match. Perdre un trou en faisant 9 ou en faisant 5 revient au même : un trou perdu. À l'inverse, un 9 ne se « rattrape » pas au trou suivant, il est oublié. Si tu mènes de 3 trous, joue simple. Si tu es mené de 3, il faut provoquer.</p>
<div class="art-quote">En match play, ton adversaire compte plus que le par : s'il est dans l'eau, joue simplement le green.</div>
<p>L'app gère le stableford et le match play dans la carte partagée, avec les coups reçus calculés trou par trou.</p>`},

{id:23, cat:"competition", niveau:"Avancé", format:"longform",
 title:"Construire une saison de compétitions",
 subtitle:"Choisir ses rendez-vous et se fixer des objectifs précis.",
 excerpt:"Jouer toutes les compétitions possibles n'est pas une stratégie. Choisir ses priorités, si.",
 app:{go:"dashboard", label:"Mes objectifs de saison"},
 body:`<h3>Choisir plutôt qu'accumuler</h3>
<p>S'inscrire à tout ce qui passe, c'est se disperser. Identifie quelques rendez-vous qui comptent vraiment pour toi et organise le reste autour.</p>
<h3>La pyramide</h3>
<p><strong>Compétitions A (2 ou 3 par saison)</strong> : tes objectifs principaux. Préparation complète, pic de forme.</p>
<p><strong>Compétitions B (6 à 8)</strong> : pour prendre le rythme et préparer les A. Sérieuses, mais sans pression maximale.</p>
<p><strong>Compétitions C</strong> : les parties de club, pour garder le rythme et tester des stratégies.</p>
<h3>Des objectifs précis</h3>
<p><strong>Vague :</strong> « je veux progresser cette saison ».<br><strong>Précis :</strong> « je veux passer de 18 à 15 d'index d'ici fin septembre, en touchant un green de plus par tour et en passant de 3 à 2 doubles bogeys par partie ».</p>
<p>Un bon objectif est mesurable, réaliste, et daté. Les objectifs de saison du Dashboard sont suivis automatiquement avec tes vraies cartes, et l'app te prévient le jour où tu les atteins.</p>
<div class="art-quote">Un objectif sans plan est un souhait. Un plan sans objectif, une marche sans direction.</div>`},

{id:24, cat:"competition", niveau:"Expert", format:"longform",
 title:"Viser une qualification : la stratégie du très bon joueur",
 subtitle:"Quand la technique ne fait plus la différence, ce sont la régularité et la gestion qui comptent.",
 excerpt:"Entre deux très bons joueurs, l'écart technique est minime. Ce qui les sépare se joue ailleurs.",
 body:`<h3>Ce qui fait la différence à haut niveau</h3>
<p>Entre un joueur scratch et un joueur à +2, la différence technique est faible. Ce qui les sépare : la régularité sous forte pression, la capacité à limiter les dégâts après une erreur, et la qualité des décisions coup après coup.</p>
<h3>La lecture des greens</h3>
<p>À ce niveau, les greens décident souvent du classement. Au-delà de la pente générale, les meilleurs tiennent compte de la vitesse différente selon les zones, du grain de l'herbe et de l'humidité qui ralentit la balle en fin de journée ou tôt le matin.</p>
<h3>La stratégie de qualification</h3>
<ul class="art-check">
  <li>Renseigne-toi sur le score qui qualifie habituellement pour l'épreuve.</li>
  <li>Compare-le à ton niveau réel : ton index est la moyenne de tes <strong>8 meilleurs différentiels sur tes 20 dernières cartes</strong>. Ton score moyen est donc plus élevé que ton index : vise un objectif basé sur ta moyenne, pas sur tes meilleurs jours.</li>
  <li>Repère les 3 ou 4 trous du parcours où tu peux marquer.</li>
  <li>Fixe tes trous « survie » et accepte le bogey sans regret.</li>
</ul>
<div class="art-quote">Une qualification se gagne rarement sur les trous difficiles. Elle se perd sur les trous faciles.</div>`}
);

/* ═══════════ ÉQUIPEMENT ═══════════ */
ARTICLES.push(
{id:25, cat:"equipement", niveau:"Débutant", format:"fiche", start:7,
 title:"Choisir ses premiers clubs",
 subtitle:"Ce qui compte vraiment quand on débute, et ce qui peut attendre.",
 excerpt:"Les meilleurs clubs pour débuter ne sont pas les plus chers, ce sont ceux qui pardonnent le plus.",
 body:`<h3>Ce qui compte au départ</h3>
<p>Quand on débute, le bon matériel est celui qui <strong>pardonne</strong> les coups mal centrés et qui correspond à ta vitesse de swing. Du matériel de très bon joueur amplifie les erreurs au lieu de les corriger.</p>
<h3>Pas besoin d'une série complète</h3>
<p>Une <strong>demi-série</strong> suffit largement pour commencer : un bois ou un hybride, un fer 7, un fer 9, un pitching wedge (ou sand wedge) et un putter. Le marché de l'occasion est très bien fourni, et beaucoup de clubs prêtent du matériel pour les premières séances.</p>
<h3>Le manche (shaft)</h3>
<p>Sa rigidité doit correspondre à ta vitesse de swing. La grande majorité des débutants jouent un manche <strong>Regular</strong>, ou plus souple (Senior, Lady) si leur swing est lent. Les manches Stiff et X-Stiff sont faits pour les swings rapides : trop rigides, ils font perdre de la distance et envoient souvent la balle à droite (pour un droitier). En cas de doute, un magasin de golf peut mesurer ta vitesse gratuitement.</p>
<h3>Les priorités</h3>
<ul class="art-check">
  <li><strong>Des fers « game improvement »</strong> : tête large, beaucoup de tolérance.</li>
  <li><strong>Un hybride</strong> plutôt que des fers 3 ou 4, bien plus faciles à lever.</li>
  <li><strong>Un driver avec du loft</strong> (10,5° à 12°) si tu en veux un. Beaucoup de débutants jouent mieux avec un bois 3 ou 5 au départ.</li>
  <li><strong>Un putter</strong> dans lequel tu as confiance.</li>
</ul>
<h3>Ce qui peut attendre</h3>
<p>Les fers longs, plusieurs wedges spécialisés et les balles haut de gamme. Tu vas perdre des balles en débutant : des balles bon marché font parfaitement l'affaire.</p>`},

{id:26, cat:"equipement", niveau:"Intermédiaire", format:"guide",
 title:"Choisir sa balle selon son jeu",
 subtitle:"Distance, toucher, prix : comprendre les grandes familles de balles.",
 excerpt:"La balle est le seul équipement que tu utilises sur chaque coup. Encore faut-il choisir la bonne famille.",
 body:`<h3>L'effet réel de la balle</h3>
<p>La balle est le seul élément de ton équipement utilisé sur tous les coups. Son influence est réelle, mais souvent mal comprise : la meilleure balle pour un joueur scratch n'est pas forcément la meilleure pour toi.</p>
<h3>Les 3 grandes familles</h3>
<p><strong>Balles « distance » (2 pièces, enveloppe dure en Surlyn)</strong> : peu d'effet, trajectoire droite, très résistantes et bon marché. Idéales quand on débute ou qu'on perd encore beaucoup de balles.</p>
<p><strong>Balles intermédiaires (souvent 3 pièces)</strong> : un compromis entre distance et toucher autour du green, à prix moyen. Un bon choix pour beaucoup de joueurs de club.</p>
<p><strong>Balles « tour » (enveloppe en uréthane, 3 à 5 pièces)</strong> : beaucoup d'effet et de toucher sur les approches. Chères, et leur avantage ne se voit que si ton contact de balle est déjà régulier.</p>
<h3>Comment choisir</h3>
<ul class="art-check">
  <li>Tu perds plusieurs balles par partie : famille « distance ».</li>
  <li>Tu cherches à mieux arrêter la balle sur le green et tu la perds rarement : teste une intermédiaire, puis une « tour ».</li>
  <li>Fais le test autour du green : c'est là que les différences se sentent le plus, bien plus qu'au driver.</li>
</ul>
<div class="art-quote">Jouer toujours le même modèle de balle compte plus que jouer « la meilleure ». La régularité te permet de la connaître.</div>`},

{id:27, cat:"equipement", niveau:"Avancé", format:"longform",
 title:"Le fitting : adapter ses clubs à son swing",
 subtitle:"Pourquoi des clubs réglés pour toi peuvent rendre ton jeu plus régulier.",
 excerpt:"Les clubs du commerce sont réglés pour un joueur « moyen » qui n'existe pas.",
 body:`<h3>Pourquoi faire un fitting</h3>
<p>Les clubs vendus en magasin sont montés pour un joueur standard. Or ta taille, ta vitesse de swing, ton angle d'attaque et ta position à l'impact te sont propres. Un club inadapté te pousse à compenser ; un club ajusté te laisse jouer ton swing.</p>
<h3>Les réglages principaux</h3>
<p><strong>La longueur</strong> : dépend de ta taille et de la distance entre tes poignets et le sol. Trop long, le contact devient irrégulier ; trop court, tu te voûtes.</p>
<p><strong>L'angle de lie</strong> : l'angle entre le manche et le sol à l'impact. Pour un droitier, un lie trop droit (upright) envoie plutôt la balle à gauche, trop à plat plutôt à droite. Ça se vérifie avec un ruban adhésif sous la semelle.</p>
<p><strong>Le loft</strong> : un ou deux degrés de plus ou de moins changent la hauteur de la balle et la distance, surtout au driver.</p>
<p><strong>Le manche</strong> : rigidité, poids et point de flexion. Souvent le réglage qui influence le plus la trajectoire et la régularité.</p>
<h3>Réussir sa séance</h3>
<ul class="art-check">
  <li>Viens avec tes clubs actuels : le fitter a besoin de ton point de départ.</li>
  <li>Apporte tes statistiques (l'export de l'app suffit) : il saura où tu perds des coups.</li>
  <li>Frappe normalement, ne cherche pas le coup parfait. Le fitting doit refléter ton vrai jeu.</li>
</ul>
<div class="art-quote">Un bon fitting prend du temps : il faut assez de coups pour voir ta dispersion, pas seulement ton meilleur coup.</div>`},

{id:28, cat:"equipement", niveau:"Expert", format:"fiche",
 title:"Composer son sac de 14 clubs",
 subtitle:"Adapter la sélection au parcours et aux conditions.",
 excerpt:"Garder exactement les mêmes 14 clubs quel que soit le parcours n'est pas toujours le meilleur choix.",
 body:`<h3>Un sac qui s'adapte</h3>
<p>Le règlement autorise 14 clubs au maximum. Un parcours court et étroit demande plus de précision que de distance ; un parcours venté demande des clubs pour jouer bas. Adapter ton sac au terrain est une vraie décision de stratégie.</p>
<h3>Une base à ajuster</h3>
<ul class="art-check">
  <li><strong>Driver</strong></li>
  <li><strong>Bois de parcours :</strong> bois 3, éventuellement bois 5</li>
  <li><strong>Hybrides :</strong> 1 ou 2 pour remplacer les fers longs</li>
  <li><strong>Fers :</strong> du 5 ou 6 jusqu'au pitching wedge</li>
  <li><strong>Wedges :</strong> 2 à 4, avec des écarts de loft réguliers (par exemple 50°, 54°, 58°)</li>
  <li><strong>Putter</strong></li>
</ul>
<h3>Les ajustements</h3>
<ul class="art-check">
  <li><strong>Parcours court :</strong> le driver sert peu. Remplace-le par un wedge ou un bois 5 de plus.</li>
  <li><strong>Beaucoup de vent :</strong> un fer long ou un hybride pour les coups bas remplace utilement le lob wedge.</li>
  <li><strong>Greens fermes et rapides :</strong> un club pour les approches roulées (fer 7-8, ou un chipper) peut rendre service.</li>
</ul>
<div class="art-quote">14 clubs est un maximum, pas un objectif. Moins de choix, c'est parfois plus de clarté.</div>`}
);

/* ═══════════ PARCOURS ═══════════ */
ARTICLES.push(
{id:29, cat:"parcours", niveau:"Débutant", format:"fiche", start:3,
 title:"Par, SSS et slope : lire sa carte de score",
 subtitle:"Les chiffres imprimés sur la carte, et comment ils font ton index.",
 excerpt:"Par, SSS, slope, index du trou : ces chiffres ont tous un rôle. Voici lequel.",
 app:{go:"whs", label:"Voir le calcul de mon index"},
 body:`<h3>Les chiffres de la carte</h3>
<p>Chaque carte de score contient des chiffres qui servent à calculer tes coups reçus et ton index. Les comprendre, c'est comprendre ce que dit l'app de ta partie.</p>
<h4>Le par</h4>
<p>Le nombre de coups « prévus » sur un trou, fixé surtout d'après sa longueur : 3, 4 ou 5. Le par du parcours est la somme des trous, souvent 72 sur un 18 trous. C'est une référence, pas un objectif quand on débute.</p>
<h4>Le SSS (ou Course Rating)</h4>
<p>Le score qu'un très bon joueur (index 0) devrait réaliser depuis ce départ, dans des conditions normales. Il s'exprime avec une décimale, par exemple 71,8. Plus il est élevé, plus le parcours est difficile pour un bon joueur.</p>
<h4>Le slope</h4>
<p>La difficulté du parcours pour un joueur moyen (un « bogey golfer », autour de 20 d'index) comparée à celle du très bon joueur. Il va de 55 à 155, avec 113 comme valeur de référence. Plus il est élevé, plus le parcours punit les erreurs, et plus tu reçois de coups.</p>
<h4>L'index du trou (ou « handicap » du trou)</h4>
<p>Le classement des trous du plus difficile (1) au plus facile (18). Il indique sur quels trous tu reçois tes coups : si tu reçois 20 coups, tu en as un sur chaque trou et un deuxième sur les trous d'index 1 et 2.</p>
<h3>Le différentiel</h3>
<p><strong>Différentiel = (score brut ajusté − SSS) × 113 ÷ slope.</strong> Le score est « ajusté » : chaque trou est plafonné au double bogey net pour qu'un trou catastrophe ne fausse pas tout. Ton index est ensuite la moyenne de tes <strong>8 meilleurs différentiels sur tes 20 dernières cartes</strong>.</p>
<div class="art-quote">À SSS égal, un 90 sur un slope de 135 vaut mieux qu'un 90 sur un slope de 115.</div>`},

{id:30, cat:"parcours", niveau:"Intermédiaire", format:"longform",
 title:"Jouer un parcours que tu ne connais pas",
 subtitle:"Réduire le handicap de la première fois avec quelques règles simples.",
 excerpt:"On joue presque toujours mieux un parcours la deuxième fois. Voici comment limiter l'écart dès la première.",
 app:{go:"courses", label:"Ajouter un parcours"},
 body:`<h3>L'avantage de connaître le terrain</h3>
<p>La plupart des golfeurs le constatent : on score mieux sur un parcours qu'on connaît. On sait où rater, quel club prendre au départ, comment roulent les greens. Sur un parcours inconnu, quelques règles réduisent ce désavantage.</p>
<h3>Avant de jouer</h3>
<ul class="art-check">
  <li>Regarde le plan du parcours (site du golf, application, carte de score).</li>
  <li>Repère les trous avec de l'eau et du hors-limites : ce sont tes zones de prudence.</li>
  <li>Cherche le parcours dans l'app : il a peut-être déjà été ajouté par un autre joueur.</li>
</ul>
<h3>Pendant la partie : 3 règles</h3>
<p><strong>1. Tu ne vois pas où tombe la balle ? Joue court.</strong> Sur un départ aveugle, prends le club qui te garantit de rester en jeu.</p>
<p><strong>2. Vise le centre des greens.</strong> Tu ne connais ni les pentes ni les zones qui renvoient la balle. Le centre est toujours le choix le plus sûr.</p>
<p><strong>3. Sur les longs putts, cherche la distance.</strong> Tu ne connais pas la vitesse des greens : essaie de laisser la balle près du trou plutôt que de la rentrer à tout prix.</p>
<div class="art-quote">Sur un parcours inconnu, la prudence paie. L'audace attendra la deuxième visite.</div>
<h3>Après la partie</h3>
<p>Note tes observations sur les trous les plus difficiles et les plus faciles dans le carnet de parcours. Elles réapparaîtront pendant la saisie à ta prochaine visite.</p>`},

{id:31, cat:"parcours", niveau:"Avancé", format:"longform",
 title:"Jouer un links, le golf de bord de mer",
 subtitle:"Sol dur, vent permanent, bunkers profonds : un autre golf.",
 excerpt:"Un links n'est pas un parcours de parc avec plus de vent. C'est un autre jeu, avec ses propres règles non écrites.",
 body:`<h3>Un autre golf</h3>
<p>Les links, parcours de bord de mer typiques de l'Écosse et de l'Irlande, ont leurs propres lois : un sol dur qui fait rebondir et rouler la balle, des fairways ondulés, des bunkers profonds et un vent presque permanent.</p>
<h3>Les 4 adaptations</h3>
<p><strong>Jouer au sol.</strong> Les balles roulées sont plus prévisibles que les balles hautes emportées par le vent. Apprends le « bump and run » : une approche basse qui roule jusqu'au green.</p>
<p><strong>Jouer bas face au vent.</strong> Une balle haute face au vent perd beaucoup de distance et dérive. Prends plus de club et swingue plus doucement pour garder la balle basse.</p>
<p><strong>Éviter les bunkers à tout prix.</strong> Les « pot bunkers » sont petits, profonds et à bords verticaux. Il faut parfois sortir en arrière ou sur le côté.</p>
<p><strong>Utiliser les pentes.</strong> Les greens sont souvent grands et ondulés. Viser une pente pour que la balle revienne vers le drapeau est une stratégie à part entière.</p>
<h3>Lire le vent</h3>
<p>Regarde l'herbe, les drapeaux, la mer, les nuages. Le vent n'a pas toujours la même direction au sol et en hauteur. Joue avec lui : laisse un vent de côté ramener la balle plutôt que de lutter contre.</p>
<div class="art-quote">Le links récompense l'intelligence et punit l'ego.</div>`},

{id:32, cat:"parcours", niveau:"Expert", format:"longform",
 title:"Greens rapides et drapeaux piégeux",
 subtitle:"Adapter son putting et ses approches quand les greens deviennent très rapides.",
 excerpt:"Sur des greens très rapides, tes repères de dosage ne valent plus rien. Voici comment t'adapter.",
 body:`<h3>Mesurer la vitesse</h3>
<p>La vitesse d'un green se mesure au stimpmètre : une petite rampe qui lance la balle toujours de la même façon, et on mesure la distance parcourue en pieds. Un green à 12 est environ <strong>un tiers plus rapide</strong> qu'un green à 9. La même frappe envoie la balle nettement plus loin.</p>
<h3>3 adaptations au putting</h3>
<p><strong>Réduire l'amplitude, pas la fluidité.</strong> Garde le même rythme mais raccourcis le mouvement. Recalibre-toi sur le green d'entraînement avant de partir, avec des putts de 5, 10 et 15 m.</p>
<p><strong>Lire la pente de plus loin.</strong> Sur un green rapide, une pente qui paraît faible fait beaucoup tourner la balle. Regarde depuis plusieurs mètres derrière la balle et accorde plus d'importance à la zone proche du trou.</p>
<p><strong>Doser pour mourir au trou.</strong> Le conseil « toujours dépasser le trou » devient dangereux en descente : un putt trop appuyé laisse un retour plus long que l'aller. Vise une balle qui s'arrête juste au trou.</p>
<h3>Les approches</h3>
<p>Sur des greens rapides et pentus, la position de la balle compte énormément. Un putt en descente est bien plus difficile qu'un putt en montée : <strong>vise le côté du green qui te laisse monter</strong>, même si c'est plus loin du drapeau.</p>
<h3>Les drapeaux piégeux</h3>
<p>Repère les positions dangereuses : drapeau derrière une bosse, en haut d'un plateau, sur une zone étroite. Sur ces trous, vise la partie large du green, accepte un long putt et passe au trou suivant.</p>
<div class="art-quote">Sur un green rapide, la meilleure approche n'est pas la plus proche, c'est celle qui laisse le putt le plus simple.</div>`}
);

/* ═══════════ POUR DÉBUTER (nouveaux) ═══════════ */
ARTICLES.push(
{id:37, cat:"parcours", niveau:"Débutant", format:"guide", start:0, isNew:true,
 title:"Ta première partie sur un vrai parcours",
 subtitle:"Comment ça se passe, du départ au dernier green, pour ne pas être perdu.",
 excerpt:"Tu passes du practice au parcours ? Voici tout ce qu'il faut savoir pour que ta première partie soit un plaisir.",
 app:{go:"scorecard", label:"Préparer ma carte"},
 body:`<h3>Commence petit</h3>
<p>Pas besoin de viser 18 trous tout de suite. Un <strong>9 trous</strong> ou un <strong>parcours compact</strong> (des par 3 courts) est idéal pour débuter : moins long, moins intimidant, et tu joues plus de coups près du green. L'app sait gérer ces parcours.</p>
<h3>Avant de partir</h3>
<ul class="art-check">
  <li><strong>Réserve ton départ</strong> et arrive 30 minutes avant pour taper quelques balles et quelques putts.</li>
  <li><strong>Emporte :</strong> plusieurs balles (tu vas en perdre, c'est normal), des tees, un relève-pitch, de l'eau.</li>
  <li><strong>Choisis ton départ :</strong> les repères les plus avancés (souvent rouges ou jaunes) rendent le parcours plus court et plus agréable.</li>
</ul>
<h3>Sur le parcours : l'ordre de jeu</h3>
<p>Sur le départ, on joue dans l'ordre convenu au premier trou, puis c'est souvent le meilleur score du trou précédent qui commence. Ensuite, c'est le joueur <strong>le plus loin du trou</strong> qui joue. En partie amicale, on pratique souvent le « prêt, jouez » : celui qui est prêt joue, en sécurité.</p>
<h3>La sécurité avant tout</h3>
<ul class="art-check">
  <li>Ne joue jamais tant que le groupe devant est à portée de ton coup.</li>
  <li>Si ta balle part vers quelqu'un, crie <strong>« Fore ! »</strong> tout de suite et fort.</li>
  <li>Ne te place jamais devant quelqu'un qui s'apprête à jouer.</li>
</ul>
<h3>Garder le rythme</h3>
<p>Le rythme est la règle d'or entre golfeurs. Quelques astuces : prépare ton coup pendant que les autres jouent, pose ton sac du côté du trou suivant, et ne cherche pas une balle plus de 3 minutes. Si tu dépasses le double du par sur un trou (par exemple 8 sur un par 4), <strong>relève ta balle</strong> et note le score : personne ne t'en voudra, bien au contraire. Si ton groupe est plus lent que celui de derrière, laisse-le passer.</p>
<h3>Respecter le terrain</h3>
<ul class="art-check">
  <li>Replace tes divots (les mottes d'herbe arrachées) sur le fairway.</li>
  <li>Ratisse le bunker en sortant.</li>
  <li>Répare l'impact de ta balle sur le green avec le relève-pitch.</li>
  <li>Ne marche pas sur la ligne de putt des autres.</li>
</ul>
<div class="art-quote">Personne ne te juge sur ton score. On te juge sur ton rythme et ton respect du terrain.</div>
<h3>Dans l'app</h3>
<p>Lance une <strong>carte partagée</strong> avec tes amis : une seule personne note les scores de tout le monde et chacun suit la partie en direct sur son téléphone. À la fin, chacun récupère sa carte dans son historique.</p>`},

{id:38, cat:"analyse", niveau:"Débutant", format:"fiche", start:0.5, isNew:true,
 title:"Compter ses coups sans se tromper",
 subtitle:"Pénalités, balle provisoire, putts : noter un score juste, trou par trou.",
 excerpt:"« J'ai fait 6… ou 7 ? » Voici comment compter juste, et pourquoi c'est la base de tout le reste.",
 app:{go:"scorecard", label:"Noter une partie"},
 body:`<h3>La règle de base</h3>
<p>Ton score sur un trou, c'est <strong>chaque fois que tu frappes pour faire avancer la balle, plus les coups de pénalité</strong>. Un coup manqué (le club passe au-dessus de la balle alors que tu voulais la frapper) compte aussi. Les swings d'essai ne comptent pas.</p>
<h3>Les pénalités les plus courantes</h3>
<ul class="art-check">
  <li><strong>Balle dans l'eau</strong> (zone de pénalité, piquets rouges ou jaunes) : +1 coup, puis tu droppes une balle selon les options.</li>
  <li><strong>Balle hors limites</strong> (piquets blancs) <strong>ou perdue</strong> : +1 coup et tu rejoues de l'endroit précédent. Ton coup suivant compte donc comme le 3e si c'était ton départ.</li>
  <li><strong>Balle injouable</strong> (dans un buisson, contre un arbre) : +1 coup et tu la déplaces selon les options.</li>
</ul>
<h3>L'exemple qui piège tout le monde</h3>
<p>Ton départ part hors limites. Tu rejoues du départ : c'est ton <strong>3e coup</strong> (1 coup joué + 1 de pénalité). Puis 2 coups pour atteindre le green et 2 putts : tu fais <strong>7</strong>, pas 5.</p>
<h3>La balle provisoire</h3>
<p>Si tu penses que ta balle est peut-être perdue ou hors limites, annonce « <em>je joue une provisoire</em> » et joue une deuxième balle tout de suite. Si la première est retrouvée en jeu, tu continues avec elle et la provisoire ne compte pas. Sinon, tu continues avec la provisoire (avec la pénalité). Ça évite de revenir en arrière et fait gagner beaucoup de temps.</p>
<div class="art-quote">Compte à voix haute sur le green : « je suis à 4, je putte pour 5 ». Tu ne te tromperas plus.</div>
<h3>Pourquoi compter juste</h3>
<p>Toutes les analyses de l'app partent de ton score : ton index, ton niveau par secteur, tes progrès. Un score arrangé te ferait travailler sur le mauvais secteur. Et en partie amicale, un débutant qui compte honnêtement gagne vite le respect de ses partenaires.</p>
<h3>Dans l'app</h3>
<p>Avec la saisie express, un tap par trou suffit : Par, Bogey, Double… et les boutons − et + pour les autres scores. Tu peux noter tes putts d'un tap aussi. Si tu as oublié de noter pendant la partie, la saisie « score total » te permet de l'enregistrer après.</p>`}
);
