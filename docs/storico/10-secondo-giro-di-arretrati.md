# §5.21 — Secondo giro di arretrati

> Storico. Indice generale e mappa dei rimandi: [HANDOFF.md](../../HANDOFF.md).

Come il §5.12: nessuna tappa nuova, undici voci del §6 pagate in una sessione. Le missioni
restano dove stavano, perché sono scelte di regia da concordare e non arretrati da smaltire.

L'ordine qui sotto è quello con cui si notano, non quello in cui sono state fatte.

---

## Le auto in sosta sono solide anche per i pedoni

Era **la cosa più visibile rimasta a schermo**. Dal §5.17 la lamiera ferma il giocatore; per i
passanti non era mai stata solida, e uno che attraversava la strada entrava in una macchina
parcheggiata e usciva dall'altra parte.

La stessa spinta del giocatore non basta, e il §6 lo diceva già: il giocatore sterza da sé,
un pedone punta dritto al marciapiede di fronte e contro un ostacolo resterebbe lì per sempre.
Servono tre cose insieme, e nessuna delle tre da sola funziona.

1. **`deflectAroundCars`** sposta la meta di lato quanto basta a passare. Guarda **solo la
   prima lamiera** lungo la direzione di marcia: scansarle tutte insieme dà una risultante che
   punta dentro il mucchio, ed è il classico steering che nel sorgente sembra ragionato e a
   schermo va a sbattere. Usa la stessa terna di cerchi della fisica dei veicoli, non
   l'ingombro rettangolare — di quello, una berlina in diagonale sporge con gli angoli e i
   pedoni la scansano da tre metri.
2. **`pushOutOfCars`** risolve la compenetrazione, con la stessa lettura del §5.17: solo il
   cerchio più compenetrato, o sommando i tre il pedone parte per la tangente.
3. **Una valvola anti-incastro.** Chi vuole camminare e per 2,2 s non si muove davvero cambia
   obiettivo: chi attraversava torna sul marciapiede da cui è sceso, chi camminava inverte, chi
   era sotto una tettoia si rimette in strada. Non è una rifinitura: **il traffico frena per i
   pedoni** (`traffic.senseAhead`), quindi un pedone piantato in carreggiata non è brutto, è
   una corsia chiusa.

La scelta che tiene tutto in piedi è **quali lamiere sono solide**: solo quelle *senza nessuno
al volante* — in sosta, abbandonate, o lasciate lì dal giocatore. Rendere solide anche le auto
guidate avrebbe chiuso la corsia dall'altro lato: un pedone incastrato davanti a un muso non
se ne va più, e il muso non riparte.

**Misura.** `.claude/tools/scenes/walkers-census.scene`, nuovo, campiona 880 istantanee su
quattro zone e conta quanti pedoni sono *dentro* una carrozzeria.

| | `main` | adesso |
| --- | --- | --- |
| pedoni dentro una lamiera | 60 | **0** |
| strada percorsa (mediana, px) | 1670 | 1656 |
| fermi per tutta la zona | 3 su 243 | 5 su 242 |

`dentroLamiera` non è una taratura: è un **invariante**, e deve restare 0.

## Si esce al titolo, e «Nuova partita» ricomincia davvero

Non esisteva un modo di rimettere Jae-min, l'orologio e le statistiche come al boot. Senza
quello «Esci al titolo» sarebbe stato un `location.reload()` travestito, ed era il motivo per
cui la voce non c'era.

Adesso c'è `Game.newGame()`, e sotto di lui `Player.reset`, `DayCycle.reset`, `ShopSystem.reset`
e `Game.clearWorld`. Due note che valgono più del codice:

- **Lo stato iniziale del giocatore esce dal costruttore e diventa un metodo.** Scena, HUD,
  polizia e salvataggio tengono tutti un riferimento a *quel* giocatore: costruirne uno nuovo
  lascerebbe in giro un protagonista fantasma che nessuno disegna più.
- **`clearWorld` sta in `Game` e lo condivide con `save.apply`.** Erano lo stesso svuotamento
  scritto due volte, e uno dei due sarebbe invecchiato.

Effetto collaterale che era un bug vero: dal titolo, «Nuova partita» dopo aver caricato un
salvataggio *proseguiva la partita caricata*.

Uscire butta via quello che non è salvato, quindi vuole due Invio, e la scheda dei salvataggi
compare a fianco della domanda — chi si accorge adesso di non aver salvato ha il posto
sott'occhio.

## Il mixer anche prima di giocare

Il pannello dei volumi esiste dal §5.13 ma stava solo in pausa: chi apriva il gioco e lo
trovava troppo alto doveva cominciare a giocare per abbassarlo. Adesso è `ui/mixer.js`, come si
era fatto con `saveslots.js` nel §5.18 e per la stessa ragione — i posti da cui si regola
l'audio sono due e sono lo stesso pannello con gli stessi tasti.

## L'autosave tiene tre generazioni

Uno slot solo che si riscrive era una trappola al contrario: chi si accorgeva tardi di aver
sbagliato strada trovava l'errore già salvato sopra il momento in cui non l'aveva ancora fatto.

Adesso scorre. **Si spostano le stringhe invece di tenere un cursore** da qualche parte: costa
due copie da 0,7 kB ogni quattro minuti, e in cambio la generazione 0 è *sempre* la più
recente, senza un indice da salvare, rileggere e tenere allineato a quello che c'è davvero nel
browser. La generazione 0 conserva la chiave storica (`seoul.save.auto`), così chi aggiorna il
gioco ritrova il suo autosave dov'era.

Nel pannello non serve una scheda in più, e non ci starebbe: sulla riga `AUTO` il pulsante
`SALVA` era spento per definizione — lo scrive il gioco — e diventa `PRECEDENTE`. Stessi tasti,
etichetta che dice `AUTO 2/3`.

## Seoul ha un'acustica

Era **la cosa che mancava di più** all'audio: un vicolo, un 노래방 e il piazzale di Gimpo
suonavano tutti nello stesso spazio, cioè in nessuno.

Un `ConvolverNode` vuole una risposta all'impulso, cioè un file, e qui i file non esistono
(§7). Quindi la coda si genera come tutto il resto, in `audio.makeImpulse`: prime riflessioni
discrete più rumore che decade. Tre cose che sembrano dettagli e non lo sono — sono commentate
sul posto perché ognuna è costata un tentativo:

- **I due canali devono essere rumore diverso.** Con lo stesso rumore a destra e a sinistra la
  coda collassa al centro: si sente più forte, non più larga.
- **Il filtro va applicato mentre la coda decade**, non dopo. Un muro mangia gli acuti prima
  dei bassi; un rumore bianco che si spegne senza perdere brillantezza suona come un riverbero
  a molla, non come una stanza.
- **Ogni coda va normalizzata a energia uno.** L'energia cresce con la durata: senza
  normalizzare, passare da una stanza a un capannone alza il volume invece di allargare lo
  spazio, e i numeri della tabella non vogliono dire niente.

La mandata parte **dal solo bus `sfx`**: la pioggia e il brontolio della città passati per una
coda sono fango, e l'interfaccia non sta in nessuno spazio. Il cambio di spazio usa l'idioma
della musica (§5.19): si sfuma il ritorno a zero e *solo lì* si mette la coda nuova.

**Dove si è lo dice il numero di lati da cui arrivano i muri, non quanti muri ci sono.** Col
conteggio semplice il 45% dei marciapiedi risultava un vicolo, perché un marciapiede qualunque
ha tre palazzi vicini — tutti però dalla stessa parte. Quello che fa un vicolo è essere *in
mezzo*.

| | marciapiedi | Gimpo | campagna | Gangnam |
| --- | --- | --- | --- | --- |
| aperto | 23% | 100% | 72% | 14% |
| strada | 56% | — | 27% | 51% |
| vicolo | 21% | — | 1% | 35% |

**Non c'è uno spazio `hall`.** Le 114 piante del gioco vanno da 78k a 117k px²: sono tutte
stanze, e uno spazio che nessuno seleziona è codice morto. Lo vorrà il primo interno grande,
che sarà il terminal dell'aeroporto quando ce l'avrà.

Misurato con `.claude/tools/scenes/reverb-census.scene`, nuovo — coda di uno sparo identico:
`open` 192 ms, `room` 248, `street` 457, `alley` 632. Costo: fps mediano 46 contro 48 sotto
raffica continua di SMG, cioè dentro il rumore della misura.

## Uno sparo lontano non è uno sparo piano

Le armi dei nemici erano le tue moltiplicate per 0,85. Ma la distanza non toglie volume —
quello lo fa già l'attenuazione — **toglie acuti**: a duecento metri di uno sparo arriva il
rimbombo, non lo schiocco.

`audio.shot` guarda quanto è lontano dall'ascoltatore e da lì fa scendere la banda del crack,
ne abbassa il picco, lascia stare il colpo basso (i bassi viaggiano) e allunga la coda fino a
mezzo secondo in più, in ritardo e più cupa. La tua arma resta sempre all'orecchio, anche col
mirino che porta via la camera: sei tu che premi il grilletto.

Centroide spettrale di un colpo di fucile a 0 · 600 · 900 px dal centro camera: 3316 · 3058 ·
2178 Hz. Il tuo, 4183.

## Le voci di Seoul non sono una sola

Le urla erano una formante sola con `f0` spostato a caso, cioè lo stesso timbro cantato più
acuto. **Un grido si riconosce dalle due risonanze del tratto vocale**, non dall'altezza.

Quattro voci in `audio.VOICES` — `uomo`, `donna`, `giovane`, `anziano` — con f1, f2, raschio e
tremolo propri. Chi ce l'ha lo decide la nascita, con un peso per tipo di pedone
(`pedestrians.VOICE_MIX`): in un ufficio più uomini che donne, in un cantiere quasi solo
uomini, i vecchi in mezzo alla gente qualunque. Il verso di chi incassa usa la stessa gola.

Centroidi misurati: 1203 · 2002 · 2314 · 1156 Hz.

## Chi scappa da una rapina esce davvero in strada

L'allarme silenzioso c'era dal §5.8, ma il commesso che correva alla porta spariva sulla
soglia: fuori non se ne accorgeva nessuno, e una rapina restava una cosa privata fra il
giocatore e una stanza.

`shops.spillOutside` lo rimette in strada davanti al portone — **lo stesso individuo**,
spostato di lista, non uno nuovo: ricrearlo romperebbe il riferimento di `alarmCaller`, e
inseguire fuori chi sta telefonando è proprio la cosa che questa uscita rende possibile. Urla e
chi è sul marciapiede si spaventa; `source` è nullo apposta, perché uno che scappa non è un
aggressore e passare il giocatore renderebbe ostile ogni teppista dell'isolato per una cassa
svuotata due porte più in là.

Lo spostamento si fa **dove la sala lo toglie dal ruolino**, non dove viene alzato `gone`: al
primo tentativo, fatto nel posto sbagliato, il commesso restava in tutte e due le liste e la
sala continuava a farlo camminare con le coordinate della città addosso.

## Menare non è tenere in mano

`WEAPONS[].melee` non distingue fra *avere* una mazza e *usarla*, e la divisa provava ad
ammanettare anche chi gliela stava tirando in testa. Adesso c'è `player.swingT`, un cronometro
che dura poco più di una mazzata: chi continua a colpire resta uno a cui sparare, chi si ferma
torna ammanettabile in un secondo. I pugni non contano — chi tira cazzotti è disarmato comunque.

## Un 전당포 per distretto

`shops.MARKETS` dà a ognuno dei sette quartieri una percentuale di ricompra sua, ma `pawn` era
una voce del mix come le altre e il caso ne lasciava tre distretti senza. `placeShops` adesso
riempie i buchi come già faceva per la clinica: prima prova a cambiare mestiere a una vetrina
esistente — una porta in più è un'insegna in più su una facciata che ne aveva già la sua — e
solo se il distretto non ne ha nessuna ne apre una. Cliniche e 총포상 restano intoccabili.

Il risultato è **5 distretti su 5 possibili, non 7**: a Gimpo ci sono cinque edifici e sono
tutti volumi dell'aeroporto, in campagna non ce n'è nessuno che regga una vetrina. Quelle due
righe di `MARKETS` restano raggiungibili solo attraverso il prezzo dell'officina finché
l'aeroporto non avrà interni. In compenso **il porto adesso ha il suo primo negozio in
assoluto**, ed è il banco con la ricompra peggiore di Seoul (0,34).

`shops` passa da 113 a 114 e `venues` da 324 a 325; il resto della città non si muove di
un'unità, perché `placeShops` ha un rng suo.

## Il futon non cura più del tutto

Era gratis e rimetteva a nuovo, il che lasciava il 병원 e la farmacia senza mestiere: nessuno
compra una medicazione da 14.000₩ potendo dormire. Adesso il riposo arriva al 70% e non oltre,
a 9 punti per ora dormita — una notte piena riempie da zero fino al tetto, un pisolino no.
L'ultimo terzo di salute si paga, ed è l'unica cosa che dà un senso alla clinica.

---
