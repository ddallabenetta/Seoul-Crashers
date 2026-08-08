# La vita degli NPC

> §5.26 del progetto. Indice generale e mappa dei rimandi: [HANDOFF.md](../../HANDOFF.md).

### 5.26 — Cielo, mare, campagna, capannelli e cronaca nera

Fino al §5.25 la Corea era piena di cose e vuota di *fatti*. Le strade avevano traffico, i
marciapiedi avevano gente, ma tutto quello che succedeva succedeva perché lo faceva succedere
il giocatore: l'unica sparatoria possibile era la sua, l'unica caccia era quella addosso a lui,
gli aerei sul piazzale di Gimpo erano arredamento e le barche all'ormeggio non erano mai
uscite dal porto. La campagna, poi, era paesaggio: campi, serre e cascine senza nessuno dentro.

Questa tappa aggiunge un modulo solo — **`src/entities/life.js`** — e dentro ci sono cinque
cose che gli abitanti fanno per conto loro.

**Un modulo, nessuna entità nuova.** È la scelta che regge tutto il resto: un pilota è un
veicolo di `game.vehicles` con un `ai.mode`, un rapinatore è un pedone di `game.peds` con lo
stato `errand`. Aggiungere un secondo tipo di abitante avrebbe voluto dire rifare rendering,
ordinamento radiale, collisioni, audio, streaming e salvataggio — e nessuna delle cinque cose
qui sotto ha bisogno di qualcosa che un pedone o un veicolo non sappiano già fare.

#### Il cielo e il mare hanno qualcuno a bordo

`traffic.driveAI` ha una riga nuova in testa: se il veicolo ha un `ai.mode`, la guida la scrive
`life.drive` e la fisica resta quella di tutti gli altri. Da lì passano quattro mestieri —
`air`, `marine`, `field`, `flee`.

Il **traffico aereo** è due macchine a stati diverse messe insieme. Il *sorvolo* attraversa
l'inquadratura a quota di crociera (300-400 px per un'ala, 165-235 per un rotore) e non tocca
mai terra: serve a dare un cielo alla mappa, costa un veicolo e passa sopra tutto. Il
*movimento d'aeroporto* esiste solo se c'è una pista entro 3000 px, ed è la stessa retta —
l'asse della pista — percorsa nei due sensi: `roll` (gas a tavoletta finché `spec.rotate` non
porta, poi cabra), oppure `final` → `rollout` → `taxi`, cioè discesa sull'asse, frenata e
rullaggio al piazzale. Chi arriva **si parcheggia e resta lì**: smette di essere di questo file
e diventa uno dei mezzi fermi che chiunque può rubare, identico a quelli messi al boot.

Le **imbarcazioni** non hanno un grafo da seguire, perché in acqua non c'è. Navigano a vista, e
l'unica cartina nautica che questo gioco abbia è `city.isWater`: un waypoint viene accettato
solo se il segmento che ci porta è acqua in **otto campioni**, e davanti alla prua si tasta la
riva a 130 px + mezzo secondo di velocità. Quel numero è stato tarato e non è cosmetico: con un
sensore lungo il doppio (`170 + 0.55 × v`) la barca trovava sempre l'altra sponda del Han —
largo 300 px — e passava la vita a scansare una riva che non stava per toccare, arrivando a
**112 px/s contro i 208 di crociera**.

#### La campagna lavora e rincasa

Un campo (`block.fields`) è un rettangolo dipinto, non un solido: ci si può stare dentro, ed è
tutto quello che serve per farci lavorare qualcuno. I braccianti hanno due stati nuovi in
`pedestrians.js` — `work` e `commute` — e il turno lo detta l'orologio: dalle 6 alle 19 si sta
nel campo, ci si sposta piano fra un punto e l'altro con lunghe pause, e due che si fermano
vicini si scambiano una parola. Alle 19 si rincasa: `commute` porta alla porta di una cascina
dell'isolato, e lì si sparisce — quello che c'è dietro è una facciata, e farceli entrare
vorrebbe dire una pianta per cascina.

È anche l'unico modo di far *sentire* il ciclo giorno-notte fuori città, dove non ci sono
insegne che si accendono. Al campo c'è anche un **trattore**, che non vaga: fa i solchi, avanti
e indietro lungo il lato lungo, spostandosi di una fila a ogni testata. Un trattore che gira a
caso in un campo non si legge come lavoro, si legge come un guasto.

#### La gente si raduna e parla

Un capannello non genera nessuno: prende gente che stava già passando di lì (stato `walk` o
`idle`, non in panico, non di guardia) e le dà un posto e qualcosa da dire. Due forme sole,
perché sono due cose diverse: il **cerchio**, in cui tutti guardano il centro, e la **fila**
davanti a una vetrina, che è l'unico raduno con un davanti. Parla **uno per volta**: due
nuvolette insieme dall'alto si leggono come un errore di disegno, e una conversazione in cui
parlano tutti insieme non è una conversazione.

La nuvoletta (`scene.drawBubble`) ha tre puntini e nessun testo. Una battuta scritta andrebbe
letta, e in una visuale dall'alto, in mezzo al traffico, non si legge niente: quello che serve
è dire *che* si parla, non *cosa*. Si stacca in proiezione come l'ombrello, perché è una cosa
sopra la testa. Il suono è nuovo e sta in `audio.chatter`: la stessa gola del grido a volume di
conversazione — fondamentale più bassa, una formante sola, niente vibrato — e **due sillabe**,
perché una sola si sente come un verso e tre sono una frase, e una frase vorrebbe delle parole.

#### Rapine, guerre fra bande e la volante che arriva

Due fatti di cronaca, e la stessa impalcatura sotto.

La **rapina** (강도) ha quattro tempi: si arriva alla vetrina, si spara un colpo in aria, si
torna all'auto e si scappa. Il colpo in aria non ha una riga di codice sua: `weapons.shoot`
chiama già `game.alarm`, quindi è la strada a svuotarsi da sola — ed è anche il modo in cui il
giocatore capisce da due isolati che sta succedendo qualcosa. La volante arriva **mentre sono
ancora dentro**, non dopo: è l'unico modo di fargli vedere tutta la scena invece del solo
finale. Chi arriva alla portiera sale e sparisce; l'auto riparte con `ai.mode = 'flee'` e da lì
è un inseguimento vero, su strada, con la sirena.

L'auto della fuga **non aspetta in mezzo alla corsia**, e questa è una lezione pagata a schermo:
una lamiera ferma su una via da 76 px la chiude, il traffico civile le frena dietro e in venti
secondi c'è la coda di mezzo quartiere. Si cerca prima uno stallo di quelli che il traffico usa
già (`traffic.parkingSpots`: cortili e vicoli, fuori carreggiata per costruzione — e un'auto che
aspetta nel vicolo dietro il negozio è anche la scena giusta), e solo in mancanza si ripiega su
un boulevard, dove restano tre corsie libere.

La **guerra fra bande** (전쟁) non crea un posto: usa un territorio che c'era già (`city.turfs`)
con i suoi uomini dentro, e ci manda una manciata di una banda rivale da **un lato solo** — due
gruppetti che convergono da punti opposti si leggono come uno spawn, non come un'incursione. Le
guardie non diventano nemiche del giocatore: cambiano bersaglio per il tempo della sparatoria e
chi resta in piedi torna al suo giro di ronda. Dopo dodici secondi di fuoco arriva la volante,
e da quel momento sono nei guai tutti e due.

**Un solo stato per chi ha un compito.** `errand` non sa niente di rapine: chiede a `life.order`
dove andare e a che velocità, esattamente come `duty` lo chiede a `police.copBehavior`. I
quattro mestieri (rapinatore, incursore, difensore, agente di quartiere) stanno tutti lì dentro,
e `pedestrians.js` non sa che esistono. Tre regole di contorno sono quelle che tengono in piedi
una sparatoria fra NPC, e ognuna nasce da un modo in cui si scioglieva da sola:

- chi è in `errand` **non entra in panico** — né per gli spari (`alarm` lo salta, come salta la
  divisa) né per il traffico che passa. Senza, una rapina in riva a un boulevard finiva prima di
  cominciare, sciolta da un'auto invece che dalla polizia;
- chi viene colpito da un altro NPC **non scappa**: gira il ferro verso chi l'ha colpito
  (`p.aggro`, lo scrive `pedestrians.hurt`). Senza, la prima pallottola trasformava l'evento in
  gente che corre;
- il giocatore resta un caso a parte: se spari tu a un teppista, vale la vecchia regola e
  diventa ostile **verso di te**.

**La polizia degli eventi non è la polizia del giocatore.** `PoliceSystem` lavora su un
bersaglio solo — te — e allargarla a N bersagli avrebbe rimesso in gioco ricercato, assedio,
arresto, chiodi e sirene. Le volanti di quartiere stanno in una lista a parte (`life.units`) e
riusano soltanto quello che è già generico: `police.followRoads` e `police.snapToRoad`, che di
bersagli non sanno niente. Gli agenti sbarcati sono pedoni **con `cop = true`** — anello blu,
niente panico per le auto, e se gli spari sei tu a finire sul registro della centrale — ma con
stato `errand` e non `duty`, quindi non passano mai da `copBehavior`. Chi resta ferito sotto il
45% della salute non lo si finisce: lo si ammanetta.

L'unica riga di `audio.js` che li conosce è la sirena: `updatePolice` passa anche su
`game.life.units`, o un inseguimento che non riguarda il giocatore sarebbe muto.

#### Ordine di aggiornamento

`life.update` gira **dopo `police.update` e prima di `traffic.update`**, per la stessa ragione
per cui ci gira la polizia: scrive gas e sterzo dei mezzi che pilota, e la fisica gliela integra
il traffico. Gira anche dietro al menu iniziale — un aereo che passa e un capannello sull'angolo
sono metà di quello che si vede da lì. E passa da `clearWorld`: tiene riferimenti a veicoli e
pedoni che stanno per sparire, e un evento sopravvissuto continuerebbe a dare ordini a fantasmi.

#### Misure

`.claude/tools/scenes/life-census.scene` mette le cinque cose una dopo l'altra, ognuna nel posto
in cui può succedere davvero. Sul mondo attuale:

| | |
| --- | --- |
| quota massima raggiunta da un velivolo pilotato | 397 px |
| fasi di volo osservate | `roll, cruise, final, rollout, taxi` |
| imbarcazioni in navigazione · velocità media · campioni piantati | 3 · 222 px/s · 1 su 180 |
| braccianti nei campi alle 10 · trattori | 8 · 1 |
| braccianti rimasti nei campi alle 20 | **0** (tutti rincasati) |
| capannelli · membri del più grande · campioni con qualcuno che parla | 2 · 6 · 66 su 70 |
| rapina: fasi percorse | `arrive > rob > escape [> chase]` |
| guerra fra bande: caduti · volanti arrivate | 4 su 6 · 1 |
| auto civili piantate da oltre 6 s, **senza** fatti in corso | 7,65 in media · 16 al peggio |
| le stesse **con** i fatti in corso | 8,53 in media · 13 al peggio |
| fps con tutto acceso | 58-60 (45 headless, come senza) |

Le due righe sulle auto piantate rispondono all'unica domanda che questa tappa poteva far
finire male: **una scena di regia non deve chiudere una strada.** La differenza fra i due
scenari sta dentro il rumore del traffico normale — e prima della correzione sull'auto della
fuga non ci stava affatto.

Tre cifre non si interpretano, sono invarianti: un velivolo pilotato **deve** staccare da terra,
una rapina **deve** arrivare almeno a `escape`, e una guerra fra bande in cui non cade nessuno
non è una guerra. Che una rapina arrivi a `chase` invece no: se il rapinatore resta a terra o la
volante gli sfascia l'auto, la fuga non parte — ed è un finale legittimo, non un difetto.

Tre numeri sono stati **spostati per una misura**, e sono i tre punti in cui questa tappa era
sbagliata a occhio e giusta nel sorgente: il tastatore di riva delle barche (§ sopra), la
chiamata della polizia in una guerra fra bande — a dodici secondi la volante partiva sempre a
cose finite, **zero volanti su tre prove** — e la portata di ingaggio di un rapinatore in fuga,
che a 380 px lo piantava a duellare con l'agente da un capo all'altro della strada invece di
correre alla macchina: un minuto pieno di colpi e nessuno a terra.
