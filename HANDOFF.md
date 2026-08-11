# HANDOFF — Seoul Crashers

Punto d'ingresso per riprendere il lavoro da una sessione pulita. **Questo file è l'indice:
resta corto apposta.** Il contenuto vero sta in `docs/`, e si apre un documento alla volta —
non tutti. Il `README.md` descrive il gioco e i comandi; qui c'è quello che serve a
*sviluppare*. Avvio e vincoli stanno in `CLAUDE.md`, che si carica da solo.

Ultimo aggiornamento: **l'Atto I completo** (§5.33, tappa E) — **M3**, **M4** e il raccordo
**R1** chiudono il primo atto, e con loro entrano le due meccaniche che il copione chiedeva da due
tappe: il **pedinamento con soglia di distanza** e l'**oggetto di missione trasportabile**. Prima
c'era 까치 sulla `91.45` (§5.32), i cortili persistenti (§5.31), l'itinerario sulla carta (§5.30) e
l'impianto delle missioni con M1 e M2 (§5.29). Le tappe precedenti sono §5.8-5.28.

> 📌 **Il prossimo lavoro è la tappa F**: l'Atto II — **M5-M8**, i raccordi **R2** e **R3** e le
> **otto chiamate dell'Atto II** — ed è l'atto che chiede più cose nuove al motore. L'ordine di
> tutte le tappe sta **in testa a [`docs/backlog.md`](docs/backlog.md) (§6.0)**, che è la prima
> cosa da leggere prima di cominciare, e le nove decisioni d'impianto prese con l'utente stanno in
> [`docs/storia/08-domande-aperte.md`](docs/storia/08-domande-aperte.md): leggi quelle, non
> ricavarle dal copione. Resta aperta una domanda sola (se le missioni si rigiocano) e non blocca
> niente. **M5 conta fino a tre** e non deve scrivere niente di quello che fa una `claim` (§5.31);
> **M6 ha un pedinamento e un'ora** e non deve scrivere né l'uno né l'altra (§5.33). **Chi scrive
> una missione nuova parte da §5.29 e §5.33**: un file sotto `src/story/`, una riga in
> `story/campaign.js`, e il motore fa il resto. **Chi scrive una battuta di Kkachi parte da
> §5.32**, con la sua `// origine:`. **Chi disegna pannelli parte da §5.28**, e li guarda con
> `cutscene-sheet.scene` e `cutscene-panel.scene` *prima* di dire che funzionano — metà dei difetti
> di questa tappa erano una faccia sotto al riquadro delle battute. Il resto del §6 resta ordinato
> per impatto: sorpasso, arresto che ti carica in volante, e il **corridoio fra Seoul e Busan**.

---

## Dove sta cosa

| Se devi… | Apri |
| --- | --- |
| far girare il gioco e verificare una modifica, o capire perché "non cambia niente" | [`docs/verifica.md`](docs/verifica.md) |
| toccare rendering, città, grafo, traffico, armi, interni — o trovare un file | [`docs/architettura.md`](docs/architettura.md) |
| diagnosticare un comportamento strano — **prima di indagare da zero** | [`docs/trappole.md`](docs/trappole.md) |
| tarare un numero (velocità, densità, danno, luce, audio, maglia) | [`docs/parametri.md`](docs/parametri.md) |
| sapere cosa viene dopo e cosa è già stato deciso | [`docs/backlog.md`](docs/backlog.md) |
| scrivere o implementare una missione, una cutscene, un dialogo | [`docs/storia/`](docs/storia/) — è l'indice: apri **un capitolo alla volta**, sono ~2900 righe |
| scrivere una data, un'età o un conteggio dentro una scena | [`docs/storia/10-continuita.md`](docs/storia/10-continuita.md) **prima** di scriverla |
| disegnare un pannello, un personaggio a pixel o una nuova espressione | `docs/storico/17-pannelli-e-cutscene.md` (§5.28) |
| **implementare una missione**: fasi, blip, punti, dialoghi, ripresa | `docs/storico/18-missioni-m1-m2.md` (§5.29) |
| disegnare su mappa o minimappa, o toccare il percorso verso il blip | `docs/storico/19-itinerario-sulla-carta.md` (§5.30) |
| toccare la proprietà di un cortile, il suo banco o la sua busta | `docs/storico/20-cortili-persistenti.md` (§5.31) |
| **pedinare qualcuno**, far portare un oggetto, mandare un'auto in un posto | `docs/storico/22-atto-i-completo.md` (§5.33) |
| **scrivere una battuta di Kkachi**, o toccare la radio e la `91.45` | `docs/storico/21-kkachi.md` (§5.32) |
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
| §5.27 Impianto della campagna | `docs/storico/16-impianto-della-campagna.md` |
| §5.28 Pannelli, pixel art e cutscene iniziale | `docs/storico/17-pannelli-e-cutscene.md` |
| §5.29 Impianto missioni, M1, M2 e il 병원 | `docs/storico/18-missioni-m1-m2.md` |
| §5.30 Itinerario sulla carta | `docs/storico/19-itinerario-sulla-carta.md` |
| §5.31 Cortili persistenti | `docs/storico/20-cortili-persistenti.md` |
| §5.32 까치 sulla `91.45` | `docs/storico/21-kkachi.md` |
| §5.33 L'Atto I completo: M3, M4, R1, pedinamento e fogli | `docs/storico/22-atto-i-completo.md` |
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
menu-musica-autosave del §5.18-5.20, le tre regioni collegate e ricostruite del §5.22-5.24,
l'impianto della campagna (§5.27), la sua prima tappa a schermo (§5.28) e le prime due missioni
giocabili (§5.29), i cortili persistenti (§5.31), 까치 sulla `91.45` (§5.32) e **l'Atto I chiuso**
(§5.33). ~38.700 righe in 76 moduli. 60 fps con ~44 veicoli e ~93
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
cosa del gioco che parla con la rete**, non lo fa finché non premi `R` — e dal §5.32 nemmeno
allora, perché la prima tacca è 까치 e quella non è uno stream. Quando la rete non c'è il gioco
si comporta esattamente come prima, e adesso la radio non si spegne nemmeno: una stazione resta.

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

**E il motore è pronto per la campagna** (§5.27), che è l'unica tappa di questo progetto in cui
non si vede niente di nuovo. I fatti del mondo passano da un **bus** (`game.on/emit`) invece che
da otto callback con un solo ascoltatore, così i cento inneschi delle dodici missioni non
diventano cento `if` in `main.js`; le modalità del gioco stanno in una **tabella** invece che in
dieci booleani, e `game.paused` è derivato; il **salvataggio si migra** invece di rifiutarsi, il
che vuol dire che aggiungere uno stato non cancella più la partita di nessuno; e un personaggio
può finalmente **stare in un posto** (`entities/actors.js`) senza che lo streaming se lo porti
via o lo resusciti.

**E la campagna è cominciata** (§5.28). «Nuova partita» manda in «12년»: ventotto pannelli a
pixel art, cinque personaggi disegnati cella per cella con quattro espressioni a testa, un tema
musicale suo, e `ESC` che salta sempre. I tre indizi che semina tornano tutti più avanti, ed è
la ragione per cui saltarla non costa niente.

**E adesso si gioca** (§5.29). Appena il motore è acceso parte **M1**: un blip alla volta e il
pizzo di martedì da riscuotere in tre posti, di cui uno ha la serranda sigillata da una perizia.
Poi **M2**, tre pegni scaduti a piedi e Jo Ok-bun, cieca da nove anni, che il registro del
quartiere ce l'ha in testa. Una missione è una **fila di fasi**: morire non riporta all'inizio
ma rimette dov'eri, i pannelli non si rivedono mai, e il salvataggio si ricorda a che punto è la
storia in centoventidue byte. I dialoghi non coprono lo schermo: la città resta lì sotto, ferma.
E al **병원 «성심»** il direttore ha una battuta diversa a ogni risveglio — quattro sono un
pannello, dal decimo in poi dice il numero, e quel numero è lo stesso che M12 stamperà sulle
fatture.

**E un cortile può diventare tuo** (§5.31). Un territorio non è più un dato di generazione: si
prende sgombrandolo e restandoci dentro sei secondi, si compra al banco della sua banda, e si
perde in una guerra come lo si è preso. Quello che cambia non è solo il tag a terra — **il banco
cambia mestiere insieme al padrone** (prendere il ricettatore del 황소파 vuol dire un'armeria in
più e un ricettatore in meno) e il cortile mette da parte una busta da riscuotere di persona. È
il primo pezzo di **città** che entra nel salvataggio, e ci entra in 92 byte.

**E qualcuno ti parla, se lo cerchi** (§5.32). Sulla `91.45` c'è 까치: le otto chiamate
dell'Atto I, dodici righe quando sali in macchina, e le battute della storia che prima erano
messaggi in un angolo. **Chi non accende la radio non sente mai una parola** — nessun avviso,
nessun punto esclamativo, ed è la regola, non una svista. Kkachi esiste solo col motore acceso,
tace quando ti stanno addosso, e una chiamata interrotta è una chiamata persa per sempre: venti
su ventiquattro sono una delle tre condizioni del finale nascosto, quindi il conto sta nel
salvataggio. Le sue righe non portano un nome ma il quadrante della frequenza, e sotto c'è il
fruscio — che è tutto quello che ha al posto di una voce.

**E il primo atto è finito** (§5.33). Alle quattro di notte, davanti a un 편의점 di Itaewon sotto
l'acqua, una busta passa da un furgone del 백호파 a una berlina nera che scende in un parcheggio di
Gangnam: il 백호파 non riscuote da 한성개발, **la paga**, da dodici anni. Al molo 7 un medico legale
consegna due fogli e muore male a metà sparatoria, senza che il gioco gli faccia un pannello;
dalla barca, all'alba, si legge `신장 171 cm`. Nella bara non c'è Seo Dong-hyeok — e il giorno dopo
Chun-sik parla di suo padre **al presente**, e non si corregge. Con l'atto entrano le due
meccaniche che tornano in M6 e M9: **il pedinamento** (troppo lontano lo perdi, troppo vicino ti
vede) e **l'oggetto che si porta in mano**, che morendo resta per terra dov'eri. E quando Kkachi
dice «abbassa», il gioco abbassa **la manopola vera** e non la rialza.

**E adesso si sa dove andare** (§5.30). La meta della missione è un rombo con l'alone su tutte
e due le carte, con il suo nome sulla mappa piena e, quando esce dal ritaglio della minimappa,
una punta sul bordo che la guarda con scritto quanto manca. Sotto ci passa **la strada da
fare**: un A* sul grafo stradale, tratteggio che scorre verso la meta, ricalcolato due volte al
secondo mentre si guida e mai mentre si sta fermi. Dove le strade non arrivano — Jeju — resta
una retta, e la carta lo dice.

La Fase 2 era divisa in tre tappe, concordate con l'utente: **A** combattimento base,
**B** polizia e ricercato a 5 livelli, **C** armi pesanti ed esplosivi. **Sono tutte fatte.**
La Fase 3 (contenuti) è cominciata da **negozi e interni** (§5.8), poi la mappa (§5.9) e il
ciclo giorno-notte (§5.11); il §5.12 ha chiuso gli arretrati. **Dei tre atti della campagna il
primo è fatto** (M1-M4 e R1): restano l'Atto II, l'Atto III e i finali, §6.

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
