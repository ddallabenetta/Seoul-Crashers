# Seoul Crashers · 서울 크래셔스

Gioco d'azione top-down 2.5D ambientato a Seoul, nello spirito di *GTA: Chinatown Wars*.
Canvas 2D puro, moduli ES, zero dipendenze: tutta la grafica è generata da codice.

## Avvio

Serve un server statico (i moduli ES non funzionano da `file://`):

```bash
python3 -m http.server 8123 --directory /Users/danieldallabenetta/Documents/seoul_crashers
```

Poi apri <http://localhost:8123>.

## Comandi

| Tasto | Azione |
| --- | --- |
| `W A S D` / frecce | muoversi a piedi · guidare |
| `Shift` | correre |
| `Spazio` | freno a mano (drift) |
| `E` | salire / scendere dal veicolo · entrare in un negozio · scale · listino |
| `F` | svuotare la cassa di un negozio (rapina) |
| `H` | clacson |
| **mouse** | mirare (a piedi si guarda sempre il cursore) |
| **click sinistro** | sparare / colpire / lanciare · alla guida, drive-by con le armi leggere |
| **click destro** | mirino del fucile di precisione (allarga il campo) |
| `1` … `6` | barra armi: una fila per tasto, ripremi per scorrere la fila (rotella = tutto l'arsenale) |
| `M` | mappa a tutto schermo (rotella = zoom, trascina = sposta) |
| `ESC` | menu di pausa (mappa, comandi, statistiche) |
| `F3` | pannello tecnico (fps, entità, posizione) |

Armi e munizioni si raccolgono a terra, nei cortili e nei vicoli, oppure si **comprano**
(vedi sotto). A zero salute ci si risveglia davanti all'ospedale del distretto più vicino —
con la salute piena, senza più un'arma, senza più nessuno alle costole e con un quarto dei
contanti in meno: la clinica presenta il conto.

## L'arsenale

| Fila | Armi | Come si comportano |
| --- | --- | --- |
| `1` | pugni · mazza · **katana** | cono davanti a te; la katana taglia in due colpi |
| `2` | pistola | precisa, munizioni ovunque |
| `3` | **pompa** | otto pallini in una rosa larga, gittata corta, spinge indietro |
| `4` | SMG · **fucile d'assalto** | automatiche; il fucile non si usa dal finestrino |
| `5` | **fucile di precisione** · **minigun** | il primo trapassa due bersagli e col tasto destro allarga il campo fin dove arriva; la seconda deve prendere giro prima di sparare e ti fa camminare |
| `6` | **molotov** · **granata** · **mina** | esplosivi: volano davvero dove punti, e il mirino ti mostra il raggio |

Gli esplosivi sono gli unici oggetti che non sono raggi istantanei: hanno una parabola,
un'ombra che dice dove cadranno e rimbalzano su muri e transenne. La molotov lascia una
pozza che brucia per una decina di secondi (e la bruciatura resta sull'asfalto), la granata
ha una miccia e rotola, la mina si arma quando ti allontani — e si sgancia anche dalla coda
dell'auto mentre scappi. Un'auto presa dall'onda d'urto salta a sua volta: le catene di
esplosioni sono gratis, e la polizia se ne accorge.

## Negozi e interni

Le porte si aprono davvero. Ogni facciata con una soglia illuminata sul marciapiede è un
posto in cui si entra con `E`, e i palazzi alti sono **pile di attività**: la colonna di
insegne che si legge dalla strada dice cosa c'è a ogni piano, e le scale ci portano.

| Insegna | Cosa ci si fa |
| --- | --- |
| **총포상** armeria | pistole, pompa, SMG, fucile d'assalto e munizioni |
| **전당포** banco dei pegni | usato a poco prezzo — e **ricompra** il tuo arsenale in contanti |
| **편의점** minimarket | cibo che rimette in piedi, e soju più benzina per due molotov |
| **약국** farmacia | antidolorifici e kit di pronto soccorso |
| **분식 · 술집** tavola calda e bar | si mangia, si beve, si recupera salute |
| **옷가게** vestiti | cambio d'abito: esci vestito diverso e **perdi una stella** |
| **병원** ospedale | medicazione e ricovero lampo, senza morire prima |
| **피시방 · 노래방 · 당구장 · 사무실 · 주택** | non si compra niente: si esplora, e c'è una cassa |
| **도색** officina | ci si guida dentro: ripara, riverniciata e **azzera il ricercato** |

Il denaro (**₩**) serve e si finisce. Si rifà svuotando le casse con `F`: serve un'arma da
fuoco in pugno, e il commesso di un'armeria o di un bar non sta a guardare — è armato, e
spara. Una rapina vale una stella, un cadavere due: la polizia però non entra, ti aspetta
fuori. Mentre sei dentro la città è ferma, ricercato compreso: la porta non è un nascondiglio.

## Il protagonista

**Jae-min Seo** si riconosce a colpo d'occhio anche in mezzo alla folla di Myeongdong:
bomber nero con la banda rossa lungo la schiena e l'artigliata della tigre bianca (백호),
fascia rossa in fronte, suole rosse (il bomber cambia colore se ti cambi al 옷가게). Con un'arma da fuoco in pugno cambia posa — braccia
tese verso il mirino — e il suo ritratto in alto a sinistra lampeggia di rosso quando
incassa. È tutto disegnato da codice, come il resto.

## Ricercato

Sparare in strada, investire qualcuno o rubare un'auto sotto gli occhi di un testimone
alza il livello di **수배** (ricercato), da una a cinque stelle:

| ★ | Cosa ti arriva addosso |
| --- | --- |
| ★ | pattuglie a piedi |
| ★★ | volanti con sirena, l'equipaggio scende quando sei a piedi |
| ★★★ | speronamenti e colpi dal finestrino |
| ★★★★ | posti di blocco e strisce chiodate sulla tua strada |
| ★★★★★ | furgoni SWAT ed elicottero col riflettore |

Le stelle scendono **solo se nessuno ti vede**: basta un poliziotto con la linea di vista
libera, o il cono del riflettore addosso, e il cronometro della fuga riparte da zero. Un
vicolo, una scalinata che le auto non possono salire o un palazzo in mezzo valgono più di
un motore grosso. I tre ponti sul Han sono passaggi obbligati: è lì che mettono i blocchi.

## La lore

**Jae-min Seo** torna a Seoul dopo dodici anni a Los Angeles, per il funerale di suo padre —
un boss caduto in disgrazia della gang **Baekho** (백호, "tigre bianca"). La versione ufficiale
parla di un incidente sul lavoro ai moli di Incheon. La versione vera è che qualcuno lo ha
venduto a un consorzio immobiliare che sta ripulendo i quartieri vecchi con la scusa della
riqualificazione: prima gli sgomberi, poi le gru, poi le torri di vetro di Gangnam.

Tre atti, dodici missioni, cinque quartieri: dai vicoli di Hongdae fino ai piani alti dove
il crimine indossa un completo. (Missioni e cutscene a fumetti arrivano nella fase 3 —
vedi *Stato* più sotto.)

## I quartieri

| Distretto | Carattere | Palette |
| --- | --- | --- |
| **Hongdae** 홍대 | vicoli, murales, indie club | neon rosa |
| **Myeongdong** 명동 | insegne, folla, contanti | rosso e oro |
| **Itaewon** 이태원 | bar internazionali, favori e debiti | ambra |
| **Gangnam** 강남 | vetro, chaebol, soldi puliti | ciano |
| **Docks di Incheon** 인천 부두 | container, gru, niente testimoni | giallo industriale |

Il **fiume Han** taglia la città in orizzontale con tre soli ponti — passaggi obbligati,
utili quando la polizia comincia a mettere posti di blocco. **Namsan** con la N Seoul Tower
è la collina al centro, visibile da mezza mappa grazie all'estrusione: il terreno sale
davvero salendo verso di essa, e l'auto se ne accorge.

## Come è fatto

```
index.html
src/
  core/      loop a passo fisso, input, RNG deterministico, griglie spaziali
  world/     generazione città, grafo stradale, distretti, texture mappa
  render/    camera 2.5D, sprite vettoriali, facciate, terreno a tile, effetti
  entities/  giocatore, fisica veicoli, traffico, pedoni, polizia, negozi
  ui/        HUD e minimappa, mappa a tutto schermo, menu di pausa
```

Alcune scelte tecniche che spiegano il risultato a schermo:

- **Profondità 2.5D.** Ogni volume viene proiettato verso l'esterno dello schermo in
  proporzione alla propria altezza (`offset = (pos − camera) · h / 880`). Le facciate restano
  parallelogrammi, quindi si possono texturizzare con una singola trasformazione affine del
  contesto: un `fillRect` col gradiente della tinta + un overlay di finestre riusabile per
  tutte le tinte. Gli oggetti alti vengono ordinati per distanza radiale dal centro camera e
  disegnati dal più lontano al più vicino.
- **Terreno a tile.** Asfalto, marciapiedi, segnaletica e fiume sono pre-renderizzati in
  riquadri da 512 px con cache LRU: una mappa 4200×4200 non si ridisegna ogni frame.
- **Maglia stradale irregolare.** Le vie non sono una scacchiera: ogni linea esiste o no
  cella per cella, e da quel dato solo derivano superblocchi (isolati fusi), disassamenti
  (una via si interrompe su un'arteria e riprende spostata) e l'interruzione sul fiume.
  Il passo segue il distretto — fitto a Hongdae, largo a Gangnam e ai moli.
- **Rilievo.** Un campo di quota deterministico (il Han è il punto più basso, Namsan il
  rilievo dominante) ombreggia il terreno in base alla pendenza, alza i volumi in proiezione
  e agisce sulla fisica: in salita si perde velocità, in discesa si guadagna.
- **Sprite generati.** Veicoli, pedoni e arredo urbano sono disegnati con path su canvas
  offscreen a 2× e messi in cache: nessun asset esterno, nitidezza a qualsiasi zoom.
- **Traffico su grafo.** Nodi negli incroci, archi con corsie (guida a destra), semafori a
  ciclo sfasato e **prenotazione dell'incrocio per asse**, che è ciò che evita i blocchi
  reciproci dove non c'è semaforo. Chi resta incastrato manovra in retromarcia e riprende la
  corsia.
- **Streaming.** Veicoli e pedoni compaiono appena fuori dal rettangolo inquadrato e si
  dissolvono a distanza, con densità e tipologie decise dal distretto.
- **Fisica arcade.** Velocità del motore lungo il muso + vettore velocità che la inseguе con
  grip laterale: la differenza tra i due è il drift. Freno a mano quasi azzera il grip.
  Collisioni a tre cerchi per scafo, urti morbidi a bassa velocità e pieni negli schianti.
- **Fuoco hitscan con magnetismo.** I colpi sono raggi risolti nello stesso frame contro
  muri, pedoni e veicoli; quello che vola è solo il tracciante. La direzione del cursore viene
  piegata di pochi gradi verso il bersaglio più allineato — abbastanza da non mancare un
  pedone a mezzo isolato, troppo poco per sostituirsi alla mira. I colpi perforanti sono lo
  stesso raggio rilanciato da dove ha trapassato.
- **Esplosivi con proiettili veri.** Solo loro: per una granata il tempo di volo *è* l'arma.
  Hanno una quota, quindi scavalcano le transenne e proiettano un'ombra che dice dove
  cadranno; l'onda d'urto cala col raggio ed è la stessa che fa saltare i veicoli.
- **Scalinate.** Un vicolo passante troppo ripido diventa una scalinata: stessa geometria di
  prima più un solido che ferma le ruote e lascia passare i piedi. È la scorciatoia che le
  auto non possono seguire.
- **Interni come sotto-mondi.** Ogni piano di un negozio è una piantina generata al volo
  dal footprint dell'edificio, con muri, arredo e gente in uno spazio di coordinate suo.
  Collisioni, raggi delle armi e onde d'urto non sanno di essere dentro: interrogano la
  stessa struttura dati della città, che quando sei in un negozio *è* la stanza. Il resto
  della città non gira, e la stanza resta com'era — cassa svuotata compresa — se ci torni.
- **Polizia senza pathfinding.** Le unità sono le entità che esistono già: un agente è un
  pedone con uno stato in più, una volante è un veicolo con gas e sterzo scritti da un'altra
  parte. A ogni incrocio la volante prende l'arco che avvicina di più al bersaglio — dieci
  confronti, nessun grafo di ricerca — e quando resta incastrata manovra in retromarcia come
  il traffico civile. I posti di blocco sono volanti ferme di traverso più transenne che
  fermano le ruote e lasciano passare piedi e proiettili: la stessa cosa delle scalinate.

## Stato

**Fase 1 — completata.** Città esplorabile, guida, traffico, pedoni, camera 2.5D, minimappa
e mappa, menu, effetti (gomma, fumo, scintille, esplosioni), statistiche.

**Fase 1.5 — completata.** Urbanistica dinamica (superblocchi, passo per distretto,
disassamenti, vicoli passanti) e rilievo (quota, ombreggiatura, volumi più alti in collina,
fisica della pendenza).

**Fase 2, tappa A — completata.** Scalinate pedonali, mira col mouse, pugni · mazza ·
pistola · SMG, drive-by, raccolte a terra, salute e morte con risveglio all'ospedale,
pedoni che scappano agli spari e teppisti che rispondono al fuoco, sangue persistente e
ragdoll.

**Fase 2, tappa B — completata.** Ricercato a 5 livelli con heat e raffreddamento a vista,
pattuglie a piedi, volanti che inseguono e speronano, sbarco dell'equipaggio, colpi dal
finestrino, posti di blocco, strisce chiodate (gomme a terra: meno velocità, meno grip e
tiraggio da un lato), furgoni SWAT, elicottero con riflettore — abbattibile — e stelle
sull'HUD, blip su minimappa e mappa.

**Fase 2, tappa C — completata.** Arsenale pesante: katana, pompa a otto pallini, fucile
d'assalto, fucile di precisione (perforante, col mirino che allarga il campo), minigun con
spin-up, e i tre esplosivi con proiettili veri — molotov con pozza di fuoco, granata a
miccia, mina di prossimità. Onda d'urto condivisa che fa saltare anche i veicoli (catene di
esplosioni), barra armi a sei file, mirino che mostra il raggio dello scoppio, SWAT passata
al fucile d'assalto.

**Fase 3, negozi e interni — completata.** 139 vetrine e 369 attività su più piani in tutta
Seoul, dodici tipi di locale con pianta, arredo e gente propri; denaro, listini, banco dei
pegni che ricompra, cambio d'abito che toglie una stella, casse da svuotare, officine di
verniciatura che azzerano il ricercato.

**Fase 3, il resto — da fare.** Le 12 missioni con cutscene a fumetti, mercato nero dinamico
con prezzi per distretto, attività secondarie, ciclo giorno-notte e meteo, audio procedurale,
salvataggio su localStorage.
