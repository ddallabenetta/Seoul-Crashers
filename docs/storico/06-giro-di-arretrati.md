# Il giro di arretrati

> §5.12 del progetto. Indice generale e mappa dei rimandi: [HANDOFF.md](../../HANDOFF.md).

### 5.12 Il giro di arretrati

Non una tappa nuova: **diciannove punti che il §6 si portava dietro da quattro fasi**, presi
in blocco perché messi insieme cambiano il gioco più di una funzione nuova. Sono arrivati da
tre lavorazioni parallele su file disgiunti più le cuciture fra l'una e l'altra; qui c'è il
perché delle scelte, che è quello che serve per cambiarle.

**La polizia ti aspetta fuori.** Era il primo punto della lista dei negozi, ed è la cosa che
si sente di più. Entrare con quattro stelle e uscire dopo un minuto ridava la strada esattamente
com'era. Adesso, mentre sei dentro, `police.siege` porta le unità **sulla porta** (§3): esci e
trovi gli agenti a 70-250 px e le volanti in corsia davanti. Tre scelte reggono il pezzo: il
ricercato resta **congelato** (la porta non diventa un nascondiglio); l'assedio muove le unità
da sé senza far ripartire streaming, griglie e collisioni; i rinforzi arrivano più lenti che in
strada (1,4 s contro 0,9), perché da dentro non si vede niente e riempire la strada mentre
compri è una punizione per aver aperto un menu. **Misurato: `update` dentro un negozio resta
0,2 ms mediani, identico a prima.** Il contrappeso è la porta sul retro, che è arrivata nello
stesso giro (sotto): senza, l'assedio sarebbe una trappola invece che una scelta.

**Chi sbarca risale.** Dopo `deployCrew` la volante restava ferma per sempre. Ora, se ti
allontani in auto oltre 750 px o se il contatto è perso da 5 s, gli agenti vivi **camminano**
fino alla macchina e risalgono (misurato: 2,1 s dal richiamo alla ripartenza). Camminano e non
spariscono sul posto perché quella è tutta la scena che si vede di questa meccanica. Se non
risale nessuno la volante **non riparte**: una volante vuota che ti sperona è una trappola già
pagata (§4).

**Commissariati.** `city.stations`, quattro, calcolati come `city.hospitals` e senza consumare
rng, sul marciapiede a **sud** mentre l'ospedale sta a nord (sullo stesso isolato restano due
posti diversi, e due blip a due passi sulla minimappa sono un blip solo). Targa blu dipinta a
terra, blip su minimappa e mappa piena, e le volanti nuove partono di lì quando il commissariato
è entro 1600 px: è quello che rende credibile da dove arriva la polizia.

**In volo e in barca non si scappa più banalmente.** L'elicottero arriva **a tre stelle** invece
che a cinque quando il giocatore guida un velivolo o una barca (con 6 s di memoria, o sparirebbe
ogni volta che uno scafo tocca riva), e da tre stelle partono fino a **due motovedette** (경비정)
dal molo più vicino. Non speronano: tengono 170-300 px e sparano, perché uno scafo che ti affonda
in mezzo al Han è una morte senza appello e da una barca non si sbarca al largo.

**La SWAT tira le granate**, e le due misure che l'hanno tarata hanno cambiato il progetto due
volte. «Una sola granata in volo» **non è** un tetto di cadenza: la miccia dura 2,2 s, e con sei
uomini in strada diventa il periodo — ne partiva una ogni 2,5 s. E con la vecchia distanza di
ingaggio (120-240 px) la SWAT era quasi sempre **troppo vicina** per lanciare, visto che il
raggio dello scoppio è 155 px. Ora la SWAT tiene 190-320 px e la cadenza reale è 7,2-7,8 s.
Effetto collaterale misurato: un giocatore **fermo allo scoperto** a cinque stelle muore in
10-16 s invece di 8-15 (chi tiene più distanza sbaglia più colpi), mentre chi si è imboscato
dietro un riparo adesso lo si stana. Era lo scopo.

**Il traffico civile buca sui chiodi.** Sei veicoli per frame a rotazione, solo entro 700 px dal
giocatore, e testando **tre punti** lungo la carrozzeria invece del solo centro: a campionamento
rotante una striscia larga 22 px la si attraversa in 0,09 s e il centro la salterebbe una volta
su due. Misurato: 2 auto bucate in 40 s su 4 strisce. Occasionale, non continuo.

**I pedoni si riparano dalla pioggia.** Sopra `rain 0.35`, chi **non ha l'ombrello** ed è `shy`
(75%) si infila sotto il portone più vicino entro 340 px e ci resta al massimo 40 s; chi
l'ombrello ce l'ha tira dritto, che è il motivo per cui se lo porta. Tutti affrettano il passo
(×1,12: di più si legge come panico, non come pioggia). Il rientro ha una soglia **per pedone**
più un ritardo casuale, per la stessa ragione degli ombrelli (§5.11): vederli ripartire tutti
insieme tradirebbe l'effetto. Il tetto dei 40 s non è pigrizia — i fermi contano nel tetto dello
streaming, e senza rotazione il marciapiede si svuota una volta sola e resta vuoto per tutto il
temporale. Misurato: 20 al riparo su 90 pedoni sotto il temporale, 0 dopo 11 s di sereno.

**La pioggia bagna anche quello che c'era già.** Spegne le pozze della molotov —
`life × (1 + rain² × 3,6)`, al quadrato perché una pioggerella deve accorciare e un temporale
spegnere: 9,7 s sereno · 4,6 s pioggia · **2,1 s temporale**, e la pozza fuma mentre muore.
Lava il sangue (~14 s col temporale) ma **non le bruciature**: un cerchio di catrame bruciato
non se ne va con l'acqua. E a piedi si slitta: spazio d'arresto da 3,8 a 6,2 px (+63%). Era
stato provato a +89% e a schermo il passo laterale cominciava a pattinare — che è metà del
combattimento a piedi in questa visuale. **Dentro un edificio `rain` vale 0**: il temporale di
fuori non spegne una pozza in un 노래방.

**Il fuoco si propaga** (§3 per il meccanismo). Una molotov: picco 12-13 pozze, terza
generazione, tutto spento da solo in 10,5 s. Quattro molotov insieme: tetto tenuto a 22, fps
32-39, e `projectiles.count` torna a 0. **Un'auto sotto il 45% della lamiera accende l'asfalto
sotto di sé**, ed è quello che fa attraversare al fuoco una fila di macchine in sosta invece di
fermarsi al primo paraurti. Non attacca sull'acqua, dentro un solido né sotto `rain > 0.35`.

**La minigun si surriscalda.** 5,8 s dal grilletto all'inceppamento (100 colpi sui 600), 4,4 s
per ripartire: un nastro intero passa da 27 a ~53 s e vuole sei inceppamenti. Il calore sale
**a colpi** e non a secondi di grilletto, così la taratura resta «la raffica utile» qualunque
cadenza abbia un'arma futura, e finire le munizioni interrompe anche il surriscaldamento. Vale
solo per le armi con `spinUp`: la SMG non si inceppa. Da inceppata le canne **rallentano**, e
l'anello del calore nel mirino lampeggia — un rosso fisso lì si confonderebbe con l'anello dello
spin-up pieno, che a dodici pixel di distanza vuol dire l'esatto contrario.

**Il mercato ha un prezzo per quartiere** (§3). La pompa costa 98.500 al porto e 188.500 a
강남; le munizioni costano di più in campagna, dove non c'è concorrenza. Il listino lo dice
(`시세 강남` accanto all'insegna e lo scostamento su ogni riga), perché un prezzo che cambia
senza dirlo è un bug agli occhi di chi gioca. **Il giro compra-e-rivendi migliore rende ~700₩
per la traversata di Seoul**, contro i 20-90k di una cassa: esiste sulla carta e non è una zecca.

**Si rivendono i mezzi rubati.** `F` davanti a un 전당포 con un veicolo fermo entro 108 px —
nove metri, cioè la carreggiata davanti alla vetrina, perché un'auto accostata ha il centro a
mezza corsia dalla porta. Si vende **solo quello che hai guidato tu** (`v.hotwired`): senza, si
rivenderebbe l'auto in sosta di uno sconosciuto senza toccarla. Prezzo per tipo × stato
(`0,35 + 0,65 × hp/maxHp`: un rottame vale i pezzi) × gomme × mercato. Una volante viene
rifiutata **con una risposta**, non col silenzio: è la prima cosa che prova chiunque.

**Gli interni cambiano con l'ora.** Tre liste invece di una — `f.staff` (il ruolino,
permanente), `f.crowd` (la folla di passaggio, rifatta a ogni arrivo su un piano), `f.kept` (i
clienti morti, permanenti); `f.people` è la loro somma e resta quello che leggono `game.peds`,
mischia, raggi e onde d'urto. Ricalcolare tutto rimetterebbe in piedi il commesso steso, non
ricalcolare niente era il difetto. Un 술집 ha 5 persone alle 22 e 2 alle 3, un 사무실 è deserto
alle 18:30, un 편의점 ha un cliente solo di notte. Il velo della luce dentro continua a non
esserci (§3): quello che cambia è **la luce che entra dalla porta**, un fascio bianco a
mezzogiorno e un fondo d'arancione da lampione di notte.

**Si dorme per far passare il tempo.** Su un futon di un 주택: «dormi fino alle 06:30 · 8h»,
dissolvenza, orologio e giorno avanti, salute piena. `daycycle.advance` **fa girare** la catena
di Markov a passi di 5 s (96 iterazioni per otto ore) invece di teletrasportare l'ora:
svegliarsi con lo stesso temporale che c'era andando a letto vorrebbe dire che mentre dormivi
il tempo non è passato. Due mete e non un menù di orari — all'alba o a stasera — perché la
domanda di chi va a letto in un gioco è una sola. **Dormire non azzera il ricercato**, e sopra
le tre stelle non si dorme affatto («con le sirene là fuori non chiudi occhio»): il letto non
deve essere la risposta all'assedio.

**L'allarme silenzioso.** Una rapina con testimoni vivi fa partire un timer di 17 s; alla
scadenza la centrale sa, e l'heat sale ancora fino alla seconda stella. Il chiamante ha un
anello rosso che si svuota e una cornetta sopra la testa. **Un commesso già steso non chiama
nessuno**, e chi è armato e ti sta sparando nemmeno: rapinare un 총포상 costa un conflitto a
fuoco, rapinare un 편의점 una denuncia. Rapinare senza testimoni resta possibile ed è l'unico
modo di farla franca.

**La porta sul retro.** Al piano terra, un varco di 44 px nel muro di fondo che esce dietro
l'edificio. Sta **all'estremo** del muro e non in mezzo, perché quello è il muro dell'arredo e
un varco al centro lo spezzerebbe in due tronconi corti (§4, la trappola dei vani scala). Il
punto d'uscita si decide una volta sola e dev'essere libero, non in acqua, non sul bordo mappa:
**se non c'è posto il varco non viene proprio aperto**, perché un buco nel muro che non porta da
nessuna parte è peggio di un muro. **42 negozi su 113 (37%) ce l'hanno**; gli altri 71 hanno un
palazzo attaccato dietro — misurato, è sempre quello il motivo, mai l'acqua o il bordo.

**Le bande commerciano** (§3 per `canDeal`). Un 거래책 per territorio, riconoscibile a vista da
un anello nel colore della banda e da un rombo sospeso; si tratta **solo a mani vuote e senza
stelle**, che è la stessa soglia con cui `watchTurfs` decide se prendersela con te. Da qui in
poi quella regola non è più solo un modo di farsi sparare: è l'unica porta d'ingresso a un
mercato che i negozi non hanno. Quattro mestieri, quattro cose diverse — 백호파 vende armi
sotto mercato (e anche sniper e minigun, che in vetrina non ci sono), 흑사파 esplosivi e cure,
철마파 **compra** i mezzi pagando più del 전당포, 황소파 ricompra le armi al 56%. Le armi
comprate da una banda finiscono **in borsa, non in mano**: senza quella riga, comprare una
pistola dai 백호파 vorrebbe dire farsi sparare dai 백호파 mezzo secondo dopo averli pagati.
Il contatto non è invulnerabile: stenderlo costa 18 s prima che un altro prenda il suo posto.

**In campagna c'è qualcosa da raccogliere.** Le capezzagne dei campi e le teste dei moli, con
tabelle diverse da quelle urbane (una pompa da caccia in un fienile si spiega, una minigun no)
e una densità **un ordine di grandezza più bassa**: la campagna è vuota per progetto e deve
restare un posto in cui si va apposta. Le raccolte passano da 36 a **43**, e adesso si controlla
che il punto non sia murato — così si è scoperto che **la molotov garantita davanti alla
safehouse era dentro un solido da tre fasi di sviluppo**, e non l'aveva mai raccolta nessuno.

**Il ciclo del semaforo, finalmente misurato — e lasciato dov'era.** `SIGNAL_CYCLE` valeva
15,5 s «dai tempi in cui nessuno si fermava» (§6, vecchia edizione), e non era mai stato
provato con le code vere che il §5.10 ha introdotto. C'era anche un difetto silenzioso: le
fasi erano tre numeri scritti a mano che con `SIGNAL_CYCLE` non c'entravano niente, quindi
cambiarlo **non cambiava il verde**. Adesso è una manopola sola — il giallo è un intervallo di
sicurezza e resta fisso a 1 s, il verde si prende quello che avanza — e si può misurare per
davvero con `traffic-census.scene` (170 s su cinque zone, un albero per configurazione, in fila):

| ciclo | urti al minuto | flusso mediano (px/min) | veicoli praticamente fermi |
| --- | --- | --- | --- |
| 12 s | 36,0 | 4323 | 4 su 172 |
| 12 s, **seconda esecuzione** | 33,5 | 4035 | 8 su 184 |
| 15,5 s (quello di prima) | 38,5 | 3926 | 8 su 183 |
| 19 s | 34,2 | 3084 (**−21%**) | 23 su 179 |

**Il ciclo lungo è fuori discussione**: un quinto del flusso in meno e tre volte i fermi, perché
con 8,5 s di verde per asse la coda formata sul rosso non si smaltisce in un ciclo solo. Ma
**fra 12 e 15,5 non c'è differenza**, e la riga che lo dimostra è la seconda: due esecuzioni
della *stessa* configurazione si scostano del 7% sul flusso e del doppio sui fermi, cioè più
di quanto separi 12 da 15,5. La prima misura da sola (+10% e metà dei fermi) sembrava un
risultato; è rumore, ed è esattamente il caso contro cui §5.10 mette in guardia — «una
differenza del 10% non significa niente». **Il valore resta 15,5.** Quello che si porta a casa
è che adesso la manopola funziona, che il verso lungo è già stato provato e non conviene, e che
**il rumore di questa scena a configurazione ferma vale ~7%**: chi misura la prossima modifica
alla guida sa sotto quale soglia non deve credersi.

**Cuciture.** Cinque pezzi stavano a cavallo di file diversi e sono stati collegati a parte:
l'anello del calore nel mirino; il peso proprio di un esplosivo nel ricercato (`blast` 6, cioè
il doppio di uno sparo — due granate in strada fanno una stella); `fx.update(dt, game)`, che
riporta la sbiadita del sangue dentro `Fx` invece di farla chiamare a `projectiles` solo per
via della firma; lo stallo di sosta liberato quando un'auto affonda; la targa a terra del
commissariato.

**Costo, misurato.** fps nella solita banda del container (43-58 a riposo, 32-39 con un incendio
da 22 pozze), `update` in strada da 1,0 a 0,9-1,0 ms mediani, `update` dentro un negozio
invariato a 0,2 ms. `city.stats` **identico** (`buildings 418, props 1299, blocks 122, nodes 196,
edges 279, doglegs 4, stairs 3`): niente di tutto questo ha spostato una `rng` in generazione.
