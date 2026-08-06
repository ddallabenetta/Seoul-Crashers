# Fase 3 — negozi, interni e la mappa

> §5.8–5.9 del progetto. Indice generale e mappa dei rimandi: [HANDOFF.md](../../HANDOFF.md).

### 5.8 Fase 3, prima tappa — negozi e interni

Dodici tipi di attività, 139 vetrine e 369 locali su più piani in tutta Seoul, un'economia in
contanti e quattro modi di spenderli. Le scelte di design prese qui — cambiare costa poco, i
punti sono tutti indicati:

- **Dentro, la città si ferma.** Traffico, pedoni, polizia, ricercato e raccolte non girano
  mentre sei in un negozio (`main.update`, ramo `if (!this.indoors)`). Costa zero CPU e
  risponde una volta per tutte a "cosa succede fuori mentre compro": niente. Il ricercato
  resta **congelato**, quindi la porta non è un nascondiglio — per quello c'è l'officina, e
  si paga. L'alternativa (mondo che continua) vorrebbe dire poliziotti che ti aspettano
  davvero fuori: è il primo candidato se si vuole ampliare.
- **La polizia non entra.** Un inseguimento dentro un 편의점 vorrebbe portare pathfinding,
  streaming e volanti in uno spazio di 300 px. Esci esattamente com'eri entrato, stelle comprese.
- **L'interno si ricorda** (`shops.cache`, chiave = id del negozio). La cassa svuotata resta
  vuota, il commesso steso resta a terra. Nasce alla prima visita, non in generazione: 139
  negozi × fino a 4 piani sarebbero 369 piante costruite al boot per niente.
- **Gli interni non sono in scala** (footprint × 1.8, limitato a 300-470 × 260-390 px). Un
  negozio di Hongdae è largo 70 px in pianta e il giocatore ne è largo 18: dentro non ci si
  girerebbe. È la stessa bugia di tutti i giochi con gli interni.
- **Comprare è `E`, rapinare è `F`.** Sono la stessa distanza dallo stesso bancone: con un
  tasto solo si finirebbe per rapinare un negozio volendo comprare pallottole.
- **Rapinare vuole un'arma in pugno** — o un commesso già a terra. Il commesso di 총포상,
  술집 e 당구장 è armato e risponde al fuoco: una rapina è una scelta, non un pulsante.
  Vale `rob: 22` di heat (una stella; un cadavere ne vale due).
- **I prezzi delle armi stanno in `WEAPONS`** (`price`, `ammoPrice`): la tabella armi è
  l'unica fonte di verità, e il banco dei pegni ricompra al 45% dello stesso numero.
- **Il denaro si finisce.** Si parte con ₩60.000 — abbastanza per mangiare e per una scatola
  di munizioni, **non** per una pompa. Le casse rendono ₩20.000-90.000, la clinica si prende
  un quarto dei contanti a ogni morte, l'officina ne costa 30.000 e il cambio d'abito 40.000.
- **L'officina (도색) azzera il ricercato**, ripara e riverniciata: una per distretto, con la
  piazzola **sulla strada** davanti a una saracinesca. I cortili interni sarebbero il posto
  giusto ma in tutta Seoul ce ne sono undici e solo quattro abbastanza larghi per una macchina.
- **Il cambio d'abito toglie una stella** e cambia il colore del bomber (`HERO_OUTFITS`,
  cinque capi; fascia rossa e tigre restano, o il giocatore smetterebbe di riconoscersi).
- **L'ospedale è diventato un posto in cui si entra**: `placeShops` promuove a `clinic`
  l'edificio più vicino al punto che `city.hospitals` aveva già, e sposta il blip (e il
  risveglio dopo la morte) sulla porta.
- **Le vetrine non consumano l'rng della città.** `placeShops`/`placeGarages` girano dopo la
  generazione con un `new Rng` loro: `buildings 424` e compagnia restano identici.
- **Gli esplosivi funzionano anche dentro** (rimbalzano sui tramezzi, l'onda d'urto prende la
  gente del piano) ma **non attraversano la porta**: `projectiles.clear()` a ogni passaggio.
  Una granata in una stanza di 300 px prende in pieno anche chi l'ha tirata, ed è giusto così.

Cosa c'è in un locale, per tipo: 총포상 armeria · 전당포 pegni (compra e vende) · 편의점
minimarket · 약국 farmacia · 분식 e 술집 da mangiare · 옷가게 vestiti · 병원 ospedale ·
피시방, 노래방, 당구장, 사무실, 주택 solo da esplorare (ma con la cassa). Sei piante
condivise — `counter`, `market`, `eatery`, `desks`, `rooms`, `hall` — bastano a farli sembrare
tutti diversi perché cambiano palette, arredo e gente.

### 5.9 Fase 3, seconda tappa — la mappa prende forma

Il mondo passa da 4200×4200 a **5400×5400**, ma la città resta grande come prima: quello che
si aggiunge attorno è il mare, l'aeroporto, il porto e la campagna. Misurato campionando la
mappa: la strada scende dal 43% al 30% della superficie, l'acqua sale dall'8% al 18%, e gli
isolati urbani restano 3,9 M px² contro i 4,3 M di prima. **Seoul non è rimpicciolita: si è
smesso di riempire il rettangolo.**

Le scelte di design prese qui — cambiare costa poco, i punti sono tutti indicati:

- **La mappa resta un quadrato, la città no.** Alternativa scartata: un mondo rettangolare.
  Sarebbe stato più fedele alla Seoul vera, ma minimappa, mappa piena e texture assumono tutte
  un mondo quadrato (`MAP_SIZE / city.w` usato per entrambi gli assi), e riscriverle costava più
  di quanto rendeva. La forma la dà il contenuto: `URBAN_BLOBS`, il mare a ovest, i rilievi a
  nord-est. Se un giorno serve davvero un mondo rettangolare, i punti da toccare sono tre —
  `buildMapTexture`, `MapView.drawPanel`, `Hud.drawMinimap`.
- **Due distretti nuovi**, Gimpo 김포 (aeroporto e risaie: a Gimpo le due cose si toccano
  davvero) e Gyeonggi 경기도 (campagna), più i moli promossi a **Porto di Incheon** 인천항 e
  spostati sulla costa. Sette distretti in tutto.
- **Un aeroporto solo, ma vero.** 1039 × 1530 px: pista da 1377, raccordo, due bretelle,
  piazzale con cinque piazzole, terminal, torre di controllo, tre hangar, cisterne e maniche a
  vento. Ci sono **tre turboelica e tre elicotteri** parcheggiati, più un eliporto al porto.
- **Si vola con due tasti.** `Spazio` sale, `Shift` scende; gas e sterzo restano quelli
  dell'auto. L'alternativa (assetto a due assi, beccheggio) vuole un modello di volo e una
  camera nuova per risolvere un problema che in visuale dall'alto non esiste. L'elicottero
  decolla da fermo, il turboelica vuole 250 px/s di rullaggio prima di staccare.
- **Il volo non è un cheat**: sopra i 400-460 px di quota non si sale, le torri di Gangnam e la
  N Seoul Tower restano solide, e la polizia continua a vedere il giocatore. Quello che il volo
  compra è la geografia — attraversare il Han senza ponte, arrivare al porto senza fare il giro.
- **Quattro imbarcazioni**: motoscafo e battello, ormeggiati ai moli del porto e agli scali sul
  Han. Il fiume attraversa tutta la mappa: in barca è la strada più veloce da est a ovest.
- **L'acqua uccide.** A piedi si annega, un'auto nel Han affonda (niente esplosione: uno spruzzo
  e il relitto che cala), da una barca non si sbarca in mezzo al mare. Senza questo il mare
  sarebbe uno sfondo, e con un quarto della mappa coperto d'acqua non poteva restarlo.
- **La campagna è fatta di campi, non di isolati vuoti.** `block.fields` è un elenco a parte che
  disegna il terreno: risaie allagate e campi solcati a scacchiera, con serre (비닐하우스),
  cascine, fienili, silo e filari. Non sono edifici né cortili — non devono fermare nessuno.
- **Sei territori di bande** (백호파 · 흑사파 · 철마파 · 황소파), piazzati con un rng loro su
  cortili e piazzali che esistevano già. Reagiscono a chi entra armato o già ricercato; con i
  pugni in tasca si passa. È il gancio per le missioni: un posto dove andare a trattare, e un
  posto da cui si esce sparando.
- **La polizia non è stata toccata.** Non ha elicotteri suoi da mandare dietro a un giocatore in
  volo (il suo ne ha già uno, ma solo a cinque stelle) e non insegue in barca. È la prima cosa
  che si sentirà mancare.
