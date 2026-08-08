# HANDOFF — Seoul Crashers

Punto d'ingresso per riprendere il lavoro da una sessione pulita. **Questo file è l'indice:
resta corto apposta.** Il contenuto vero sta in `docs/`, e si apre un documento alla volta —
non tutti. Il `README.md` descrive il gioco e i comandi; qui c'è quello che serve a
*sviluppare*. Avvio e vincoli stanno in `CLAUDE.md`, che si carica da solo.

Ultimo aggiornamento: **la tappa A della campagna** (§5.27) — le primitive dei pannelli a
fumetto, la **cutscene iniziale** da ventotto pannelli, e i due pezzi d'impianto che la
reggono: il **bus di eventi** e la **tabella delle modalità**. Le precedenti sono §5.8-5.26.

> 📌 **Il prossimo lavoro è la tappa B**: impianto missioni (blip singolo, fasi, ripresa
> dall'ultima fase) più **M1 e M2**. L'ordine delle sette tappe che restano, e le **quattro cose
> d'impianto che la tappa A ha lasciato aperte apposta** — migrazioni del salvataggio, NPC
> persistenti, il blip, la porta sigillata — stanno **in testa a
> [`docs/backlog.md`](docs/backlog.md) (§6.0)**, che è la prima cosa da leggere prima di
> cominciare. Le nove decisioni d'impianto prese con l'utente stanno in
> [`docs/storia/08-domande-aperte.md`](docs/storia/08-domande-aperte.md): leggi quelle, non
> ricavarle dal copione. Resta aperta una domanda sola (se le missioni si rigiocano) e non
> blocca niente. Due cose che la tappa A **non** ha fatto e che vanno con la D: la regia sonora
> della cutscene e la prima riga di Kkachi, che oggi è un toast. Il resto del §6 resta ordinato
> per impatto: le voci più concrete sono il sorpasso, l'arresto che ti carica in volante e il
> **corridoio fra Seoul e Busan**, che dal §5.25 è geografia percorribile ma non ha ancora
> niente da fare — ed è la superficie naturale delle attività secondarie.

---

## Dove sta cosa

| Se devi… | Apri |
| --- | --- |
| far girare il gioco e verificare una modifica, o capire perché "non cambia niente" | [`docs/verifica.md`](docs/verifica.md) |
| toccare rendering, città, grafo, traffico, armi, interni — o trovare un file | [`docs/architettura.md`](docs/architettura.md) |
| diagnosticare un comportamento strano — **prima di indagare da zero** | [`docs/trappole.md`](docs/trappole.md) |
| tarare un numero (velocità, densità, danno, luce, audio, maglia) | [`docs/parametri.md`](docs/parametri.md) |
| sapere cosa viene dopo e cosa è già stato deciso | [`docs/backlog.md`](docs/backlog.md) |
| scrivere o implementare una missione, una cutscene, un dialogo | [`docs/storia/`](docs/storia/) — è l'indice: apri **un capitolo alla volta**, sono ~2000 righe |
| verificare headless, usare `probe.mjs`, le scene o le skill | [`docs/strumenti.md`](docs/strumenti.md) |
| capire *perché* una parte esistente è fatta così | [`docs/storico/`](docs/storico/) |

## I rimandi `§` — quale file contiene cosa

I documenti conservano la numerazione originale, quindi ogni `(§5.10)` sparso nel testo e nei
commenti resta valido: si risolve qui.

| § | File |
| --- | --- |
| §1 Contesto | qui sotto |
| §1 Avvio · §7 Vincoli e convenzioni | `CLAUDE.md` |
| §1 Verifica rapida | `docs/verifica.md` |
| §2 Mappa dei file · §3 Concetti | `docs/architettura.md` |
| §4 Trappole · §4bis | `docs/trappole.md` |
| §5.1–5.3 Urbanistica e rilievo | `docs/storico/01-urbanistica-e-rilievo.md` |
| §5.4–5.7 Fase 2 (combattimento, polizia, arsenale) | `docs/storico/02-fase-2-combattimento-polizia-arsenale.md` |
| §5.8–5.9 Negozi, interni, mappa | `docs/storico/03-fase-3-negozi-interni-mappa.md` |
| §5.10 Traffico | `docs/storico/04-traffico.md` |
| §5.11 Giorno-notte e meteo | `docs/storico/05-fase-3-giorno-notte-e-meteo.md` |
| §5.12 Giro di arretrati | `docs/storico/06-giro-di-arretrati.md` |
| §5.13–5.14 Audio e radio | `docs/storico/07-audio-e-radio.md` |
| §5.15–5.17 Salvataggio, arresto, lamiera | `docs/storico/08-salvataggio-arresto-lamiera.md` |
| §5.18–5.20 Menu, musica, autosave | `docs/storico/09-menu-musica-autosave.md` |
| §5.21 Secondo giro di arretrati | `docs/storico/10-secondo-giro-di-arretrati.md` |
| §5.22 Regioni e metro | `docs/storico/11-regioni-e-metro.md` |
| §5.23 Geografie dedicate e metro fisica | `docs/storico/12-geografie-dedicate-e-metro-fisica.md` |
| §5.24 Strade libere, metro viva e confini | `docs/storico/13-strade-metro-confini.md` |
| §5.25 Mappa unica della Corea | `docs/storico/14-mappa-unica-corea.md` |
| §5.26 Vita degli NPC | `docs/storico/15-vita-degli-npc.md` |
| §5.27 Pannelli, cutscene e impianto | `docs/storico/16-pannelli-e-cutscene.md` |
| §6 Backlog | `docs/backlog.md` |
| §8 Parametri | `docs/parametri.md` |
| §9 Strumenti (`.claude/`) | `docs/strumenti.md` |

---

## 1. Contesto in una pagina

Web game d'azione top-down 2.5D ambientato a Seoul, stile *GTA: Chinatown Wars*.
Canvas 2D puro, moduli ES nativi, **zero dipendenze, nessun build step**. Tutta la grafica
(sprite, facciate, terreno, mappa) è generata da codice a runtime: non esistono asset esterni.

Stato: **Fase 1, Fase 1.5, Fase 2 (tutte e tre le tappe) e le prime tre tappe della Fase 3
completate e collaudate**, più la revisione della guida AI del traffico (§5.10), i due giri di
arretrati (§5.12 e §5.21), l'audio procedurale del §5.13, il salvataggio del §5.15, il giro
menu-musica-autosave del §5.18-5.20, le tre regioni collegate e ricostruite del §5.22-5.24 e
la prima tappa della campagna (§5.27). ~29.000 righe in 52 moduli. 60 fps con ~44 veicoli e ~93
pedoni attivi, e restano 60 anche sotto raffica continua di SMG. Dentro un edificio il costo è
trascurabile: la città non gira. Il ciclo giorno-notte costa **1,5 ms di JS per frame nel caso
peggiore** (notte con temporale) — ma i veli a schermo intero non sono misurabili onestamente
in headless, vedi l'avvertenza in §5.11.

**Seoul ha un'ora e un tempo.** L'orologio gira sempre (24 minuti reali = 24 ore, anche dentro
un negozio), la luce cambia con l'ora, il cielo passa da sereno a temporale e viceversa, e i
locali hanno un orario di apertura. Non è una decorazione: di notte la polizia vede meno lontano,
sotto l'acqua si frena peggio, e alle tre del mattino l'unica insegna accesa è quella del 편의점.

**Seoul si sente, e nemmeno un byte di audio è un file.** Spari, motori, sirene, rotori,
pioggia, tuoni, urla, casse che si aprono e menu che scorrono nascono da oscillatori e da due
buffer di rumore generati al boot (§5.13) — e dalla §5.21 anche **la coda del riverbero**, che
è un file per definizione. Vale lo stesso vincolo della grafica, con lo stesso vantaggio: il
timbro di un'arma è cinque numeri in tabella, e la pioggia si sente ovattata dentro un negozio
senza che esista un secondo suono di pioggia. Ci sono quattro spazi (aperto, strada, vicolo,
stanza) e quale sia lo dice **da quanti lati arrivano i muri**, non quanti ce ne sono; uno
sparo lontano non è uno sparo piano ma uno sparo *senza schiocco*; i passanti hanno quattro
timbri di voce. L'audio parte **al primo clic o tasto premuto** — regola dei browser, non una
scelta — e `F4` è il muto.

**E in macchina c'è la radio, con stazioni coreane vere** (§5.14): `R` accende e cambia
stazione, `Shift+R` spegne, e nei 편의점 aperti la si sente bassa di sottofondo. È **l'unica
cosa del gioco che parla con la rete**, non lo fa finché non premi `R`, e quando la rete non
c'è il gioco si comporta esattamente come prima.

**La partita si salva, e la polizia adesso ti prende vivo.** Tre slot in `localStorage` dal
menu di pausa (§5.15) più **uno automatico a tre generazioni** (§5.20, §5.21): dentro c'è solo
quello che Seoul non sa rifare da sola, cioè 0,7 kB — la città nasce da una seed fissa e il
traffico è streaming. E la divisa, se hai i pugni al posto della pistola o sei quasi a terra,
ti ammanetta invece di spararti (§5.16): sei ore di cella, la cauzione, e l'arsenale se lo
tengono. Con una mazza si può essere ammanettati, ma **non mentre la stai usando** (§5.21).

**Il gioco comincia da un menu, e ha una musica sua.** Il titolo sta sopra una Seoul che gira
davvero — traffico, pedoni, luci — con «Continua» in cima se c'è qualcosa da riprendere
(§5.18), i comandi e i volumi. La musica è sintetizzata come tutto il resto e suona in **due
momenti soli**: il tema sul menu e l'inseguimento quando ti stanno addosso (§5.19). In strada
non suona niente, perché in strada c'è già Seoul, e in macchina c'è la radio — che vince
sempre. Dal menu di pausa si torna al titolo, e da lì si ricomincia davvero (§5.21).

**Il mondo è una mappa sola, larga come la Corea** (§5.25): 16.800×24.000 px con dentro le tre
città generate come prima — Seoul in alto a sinistra, Busan sulla costa sud-orientale, Jeju al
largo — più la campagna del corridoio e il mare che le separa. **A Busan ci si arriva
guidando**, sull'autostrada Gyeongbu, che è fatta di archi del grafo veri: ci passano il
traffico civile e le volanti. **A Jeju no**: nessun nodo stradale la raggiunge, ci si va via
mare o in volo. Ogni fermata ha una scala solida sul marciapiede e si attraversano atrio,
tornelli e banchina a piedi; la tratta interurbana adesso è una comodità, non l'unica via.
Traffico e pedoni restano streaming.

**E la Corea ha dei fatti, non solo delle cose** (§5.26). All'aeroporto si decolla e si atterra,
sul fiume c'è chi naviga, nei campi si lavora fino a sera e poi si rincasa, sui marciapiedi si
formano capannelli in cui uno parla per volta — e ogni tanto qualcuno rapina una vetrina o porta
la sua banda nel cortile di un'altra, con la volante che arriva a rovinare la festa a tutti. Un
modulo solo (`entities/life.js`) e **nessuna entità nuova**: un pilota è un veicolo con un
`ai.mode`, un rapinatore è un pedone con lo stato `errand`. La caccia a *te* resta un altro file.

**E la partita comincia con una scena** (§5.27). «Nuova partita» apre **«12년»**: ventotto
pannelli a fumetto disegnati da codice come tutto il resto, saltabili sempre con `ESC` perché i
tre indizi che seminano tornano tutti più avanti. All'ultimo si sveglia in un vicolo di Hongdae
alle 8:24, l'asfalto ancora bagnato e l'auto di suo padre lì davanti — e se accende la radio,
qualcuno gli parla. Sotto ci sono due pezzi d'impianto che valgono più della scena: il **bus di
eventi** (`game.on/emit`), da cui passeranno i cento inneschi delle dodici missioni, e la
**tabella delle modalità**, che ha sostituito i dieci booleani con cui il gioco diceva se era
in pausa.

La Fase 2 era divisa in tre tappe, concordate con l'utente: **A** combattimento base,
**B** polizia e ricercato a 5 livelli, **C** armi pesanti ed esplosivi. **Sono tutte fatte.**
La Fase 3 (contenuti) è cominciata da **negozi e interni** (§5.8), poi la mappa (§5.9) e il
ciclo giorno-notte (§5.11); il §5.12 ha chiuso gli arretrati. **Restano le missioni**, §6.

---

## Come tenere in ordine questi documenti

Quando chiudi una tappa:

1. **Storico** → nuovo file `docs/storico/NN-nome.md` con la sezione `### 5.N` che avresti
   aggiunto qui, e una riga nella tabella dei rimandi qui sopra. Non riscrivere i file delle
   tappe passate: sono un archivio, e il loro valore è che nessuno li rilegge.
2. **Trappole** → una riga in `docs/trappole.md` per ogni bug che è costato una diagnosi.
3. **Parametri** → una riga in `docs/parametri.md` per ogni costante nuova da tarare.
4. **Architettura** → aggiorna `docs/architettura.md` solo se hai cambiato un *meccanismo*
   (un modulo nuovo, un invariante nuovo), non per ogni feature.
5. **Backlog** → togli quello che hai fatto, aggiungi quello che è emerso.
6. **Qui** → aggiorna «Ultimo aggiornamento», il riquadro 📌 e il §1. Se questo file supera
   ~140 righe, quello che hai aggiunto va in `docs/`.

Regola generale: ogni fatto sta in **un** posto solo. Se ti viene da copiarlo, mettici un
rimando — la numerazione `§` serve a questo.
