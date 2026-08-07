# Seoul Crashers · 서울 크래셔스

Gioco d'azione top-down 2.5D ambientato a Seoul, nello spirito di *GTA: Chinatown Wars*.
Canvas 2D puro, moduli ES, zero dipendenze: tutta la grafica è generata da codice.

## Avvio

Serve un server statico (i moduli ES non funzionano da `file://`):

```bash
python3 -m http.server 8123 --directory /Users/danieldallabenetta/Documents/Seoul-Crashers
```

Poi apri <http://localhost:8123>.

## Comandi

| Tasto | Azione |
| --- | --- |
| `W A S D` / frecce | muoversi a piedi · guidare |
| `Shift` | correre · **in volo**: scendere di quota |
| `Spazio` | freno a mano (drift) · **in volo**: salire di quota |
| `E` | salire / scendere dal veicolo · entrare in un negozio · scale · listino · usare la metro |
| `F` | svuotare la cassa di un negozio (rapina) |
| `H` | clacson |
| **mouse** | mirare (a piedi si guarda sempre il cursore) |
| **click sinistro** | sparare / colpire / lanciare · alla guida, drive-by con le armi leggere |
| **click destro** | mirino del fucile di precisione (allarga il campo) |
| `1` … `6` | barra armi: una fila per tasto, ripremi per scorrere la fila (rotella = tutto l'arsenale) |
| `M` | mappa a tutto schermo (rotella = zoom, trascina = sposta) |
| `ESC` | menu di pausa (mappa, **salvataggi**, audio, comandi, statistiche, esci al titolo) |
| `F` (nei salvataggi) | accende e sospende il salvataggio automatico |
| `F3` | pannello tecnico (fps, entità, posizione) |
| `F4` | audio muto |
| `R` | radio: accendi · stazione successiva |
| `Shift + R` | radio: spegni |

Armi e munizioni si raccolgono a terra, nei cortili e nei vicoli, oppure si **comprano**
(vedi sotto). A zero salute ci si risveglia davanti all'ospedale del distretto più vicino —
con la salute piena, senza più un'arma, senza più nessuno alle costole e con un quarto dei
contanti in meno: la clinica presenta il conto.

Le auto sono solide anche quando sei a piedi: non ci si passa attraverso e non ci si cammina
sopra. Una che ti arriva addosso a velocità ti stende, una ferma ti sposta e basta. Vale anche
per i passanti, che le auto in sosta le **aggirano** invece di attraversarle.

## Il menu iniziale

Il gioco si apre su un titolo con Seoul che gira dietro — traffico, pedoni e luci sono già
quelli veri, non un'immagine. In cima c'è **Continua** se hai qualcosa da riprendere (ti dice
dove eri e che ora era), poi *Nuova partita*, *Carica partita*, *Audio* e *Comandi*. `W`/`S`
per scegliere, `Invio` per confermare. I volumi si regolano da qui, senza dover cominciare una
partita per abbassarli — ed è lo stesso pannello che trovi in pausa.

Dal menu di pausa si torna al titolo (l'ultima voce, e chiede conferma): quello che non hai
salvato lo perdi, e la partita ricomincia davvero — stessa Seoul, tutto il resto da capo.

## Salvataggi

`ESC` → **Salvataggi**: tre slot nel browser più uno automatico, con `W`/`S` per lo slot,
`A`/`D` per l'azione (salva · carica · cancella) e `Invio` per confermare — due volte, se stai
per sovrascrivere o cancellare. Ogni slot dice dove eri, che ora era e quanto avevi in tasca.

Il quarto slot lo scrive il gioco: **quando dormi**, quando esci dall'ospedale o dalla cella e
ogni quattro minuti in strada — ma **solo se sei in un punto da cui si può ripartire**: con le
stelle addosso, quasi morto o mentre ti stanno ammanettando non salva, e riprova più tardi. I
tuoi tre slot non li tocca mai. Se non lo vuoi, `F` su quel pannello lo sospende.

Di automatici però ne tiene **tre**, non uno: il pulsante `PRECEDENTE` su quella scheda scorre
all'indietro fino a due salvataggi più vecchi. Serve a chi si accorge tardi di aver sbagliato
strada e non vuole trovarsi l'errore già scritto sopra il momento in cui non l'aveva fatto.

Dentro c'è solo quello che Seoul non sa rifare da sola: la città nasce sempre uguale da una
seed, quindi si salvano tu, il mezzo che stavi guidando, l'orologio col suo tempo, le stelle,
le statistiche e le casse che avevi già svuotato. Sono meno di mille byte a slot, e restano nel
browser: se svuoti i dati del sito, se ne vanno con loro.

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

Ogni locale ha un orario, e chi c'è dentro dipende dall'ora: un 술집 alle undici di sera è
pieno, alle tre ci sono due persone; un ufficio la sera è vuoto. In un **주택** c'è un futon,
e ci si può dormire fino all'alba — ma non con le sirene là fuori.

Il denaro (**₩**) serve e si finisce, e **costa diverso a seconda del quartiere**: la stessa
pompa costa ₩98.500 al porto di Incheon e ₩188.500 a Gangnam. Il listino te lo dice. Si rifà
svuotando le casse con `F` — serve un'arma in pugno, e il commesso di un'armeria o di un bar è
armato e spara — oppure rivendendo al 전당포 il mezzo che hai parcheggiato davanti alla porta.

Una rapina vale una stella, e se qualcuno ti ha visto **chiama la polizia**: hai diciassette
secondi prima che la centrale sappia. La polizia dentro non entra, ma **ti aspetta fuori**: il
tuo livello di ricercato resta congelato mentre sei al riparo, e intanto loro si mettono
davanti alla porta. Al piano terra molti locali hanno una **porta sul retro** che dà nel
cortile: è per quello che c'è.

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
| ★★★★★ | furgoni SWAT che tirano granate, ed elicottero col riflettore |

In volo o in barca non ci si libera così facilmente: l'elicottero arriva già a tre stelle, e
dal porto partono le motovedette.

**Ti possono anche prendere vivo.** Fino a tre stelle, se ti trovano addosso con i pugni o una
mazza al posto della pistola — o quasi a terra — la divisa smette di sparare e viene ad
ammanettarti: hai un secondo e mezzo per scappare, saltare in macchina o tirare fuori qualcosa
di più serio. Se ti prendono sono sei ore di cella, la cauzione (un quinto dei contanti) e
l'arsenale che si tengono loro; ti risvegli davanti al commissariato più vicino, con la città
che nel frattempo è andata avanti. Da quattro stelle in su non ammanetta più nessuno.

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

Tre atti, dodici missioni, sette zone: dai vicoli di Hongdae fino ai piani alti dove
il crimine indossa un completo. (Missioni e cutscene a fumetti sono l'ultimo pezzo che manca —
vedi *Stato* più sotto. Le bande però ci sono già, e con loro si può trattare: basta entrare
nel loro cortile a mani vuote.)

## I quartieri

| Distretto | Carattere | Palette |
| --- | --- | --- |
| **Hongdae** 홍대 | vicoli, murales, indie club | neon rosa |
| **Myeongdong** 명동 | insegne, folla, contanti | rosso e oro |
| **Itaewon** 이태원 | bar internazionali, favori e debiti | ambra |
| **Gangnam** 강남 | vetro, chaebol, soldi puliti | ciano |
| **Porto di Incheon** 인천항 | container, gru, niente testimoni | giallo industriale |
| **Gimpo** 김포 | piste, hangar e risaie | azzurro |
| **Gyeonggi** 경기도 | risaie, serre, capannoni senza nome | verde |

Il **fiume Han** taglia la città in orizzontale con tre soli ponti — passaggi obbligati,
utili quando la polizia comincia a mettere posti di blocco. **Namsan** con la N Seoul Tower
è la collina al centro, visibile da mezza mappa grazie all'estrusione: il terreno sale
davvero salendo verso di essa, e l'auto se ne accorge.

La città non riempie la mappa: **ha una sagoma.** A ovest il Han si apre nel **mare** (서해),
con la battigia irregolare, la piana di marea e il **porto** dove si prendono le barche. Più
a nord l'**aeroporto di Gimpo**, con la pista, il piazzale e i velivoli parcheggiati. In mezzo
la **campagna**: risaie, serre e capannoni, dove restano solo le provinciali. Fuori dall'acqua
si annega, e un'auto che finisce nel Han affonda.

## Metro e regioni

Le fermate della metro sono segnate con una **M ciano** sulla minimappa e sulla carta, e in
strada hanno una scala solida con totem `M · 지하철`, sempre appoggiata al marciapiede invece
che alle corsie. Vai a piedi all'ingresso e premi `E`: entri in un vero interno, percorri
l'atrio insieme ai passeggeri, puoi comprare 김밥 e caffè al chiosco, attraversi i tornelli e
raggiungi la banchina. Il tabellone delle destinazioni compare soltanto davanti alle porte del
treno; da lì puoi viaggiare nella stessa città o prendere un collegamento interurbano. Con le
stelle di ricercato attive i tornelli restano chiusi.

**Seoul** ora misura 7200×7200: COEX Mall, Gyeongbokgung, Lotte World Tower, Dongdaemun,
N Seoul Tower e la cintura metropolitana stanno dentro un tessuto urbano sensibilmente più
esteso, non in una cornice vuota. Sono giocabili anche **Busan** (`부산`), una mappa autonoma
6400×5600 con baia, estuario del Nakdong, Gwangan Bridge, Jagalchi, Haeundae e Gwangalli, e
**Jeju** (`제주`), un'isola autonoma 5400×5400 con costa su quattro lati, Hallasan, campagne,
Jeju City e Seogwipo. Tutte conservano traffico, negozi, interni, polizia e rilievo; il viaggio
mantiene personaggio, inventario, denaro e ora del giorno.

Sparsi per la mappa ci sono i **territori delle bande** (백호파, 흑사파, 철마파, 황소파): un
cortile, un piazzale di container o un capannone, con il tag dipinto a terra e i loro uomini
di guardia. Passarci disarmati si può; entrarci con un ferro in pugno, no.

## Come è fatto

```
index.html
src/
  core/      loop a passo fisso, input, audio sintetizzato, RNG deterministico, griglie
  world/     generatori Seoul/Busan/Jeju, registro regioni, grafo e texture mappa
  render/    camera 2.5D, sprite, facciate, terreno a tile, interni e stazioni metro
  entities/  giocatore, fisica veicoli, traffico, pedoni, polizia, negozi
  ui/        HUD, minimappa, carta, menu, negozi e navigazione metro
```

Alcune scelte tecniche che spiegano il risultato a schermo:

- **Profondità 2.5D.** Ogni volume viene proiettato verso l'esterno dello schermo in
  proporzione alla propria altezza (`offset = (pos − camera) · h / 880`). Le facciate restano
  parallelogrammi, quindi si possono texturizzare con una singola trasformazione affine del
  contesto: un `fillRect` col gradiente della tinta + un overlay di finestre riusabile per
  tutte le tinte. Gli oggetti alti vengono ordinati per distanza radiale dal centro camera e
  disegnati dal più lontano al più vicino.
- **Terreno a tile.** Asfalto, marciapiedi, segnaletica e fiume sono pre-renderizzati in
  riquadri da 512 px con cache LRU: nemmeno una mappa 7200×7200 si ridisegna ogni frame.
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
- **Audio senza file audio.** Nessun campione, nessun `.mp3`: spari, motori, sirene, pioggia,
  tuoni e menu nascono da oscillatori e da due buffer di rumore generati all'avvio, come la
  grafica nasce da path su canvas. È il vincolo del progetto, ma si ripaga: il timbro di
  un'arma sono cinque numeri accanto al suo danno, il motore cambia giro con la marcia e
  cilindrata con la massa del mezzo, la sirena scivola di tono quando la volante ti supera, e
  la pioggia dentro un negozio è la stessa pioggia con il filtro spostato — quello che si
  sente è il muro. L'ascoltatore non è il personaggio ma **la camera**, così col mirino del
  fucile di precisione si sente quello che si vede. L'audio parte al primo clic (lo impongono
  i browser); i volumi stanno nel menu iniziale e in quello di pausa, `F4` è il muto.

- **E Seoul ha un'acustica.** La coda di un riverbero è un file per definizione: qui si genera
  a runtime come tutto il resto, e sono quattro spazi — in mezzo ai campi, su una strada, in un
  vicolo, dentro una stanza. Quale sia lo decide **da quanti lati arrivano i muri**, che è la
  differenza fra stare accanto a una fila di palazzi e starci in mezzo: il piazzale di Gimpo è
  aperto al 100%, in campagna un vicolo capita una volta su cento, a Gangnam una su tre. Sulla
  stessa strada, uno sparo lontano non è uno sparo piano — è uno sparo **senza schiocco**, che
  è quello che distingue «ti stanno sparando addosso» da «si spara da qualche parte». E i
  passanti hanno quattro timbri di voce, con due formanti ciascuno, invece di uno solo con
  l'altezza spostata a caso.

- **La musica sa quando tacere.** È sintetizzata come tutto il resto e suona in due momenti
  soli: il **tema** sul menu iniziale e l'**inseguimento** quando ti stanno addosso — con gli
  strumenti che si aggiungono man mano che salgono le stelle, così senti quanto sei nei guai
  prima di contarle sull'HUD. In strada non suona niente, perché in strada c'è già Seoul; in
  macchina c'è la radio, e la radio vince sempre. Volume suo nel mixer.

- **La radio è vera.** In macchina `R` accende l'autoradio e ci trovi **stazioni coreane in
  streaming**, prese da una directory pubblica che non chiede nessuna chiave; nei 편의점
  aperti la stessa stazione si sente bassa di sottofondo. È l'unica cosa del gioco che parla
  con la rete, non lo fa finché non premi `R`, e se la rete non c'è tutto il resto funziona
  identico — al massimo una stazione non risponde e si passa alla successiva. Le tre grandi
  (KBS, MBC, SBS) trasmettono in HLS con un token e restano fuori; la tua stazione preferita
  la puoi fissare tu, in `localStorage` sotto `seoul.radio.stations`.

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

**Fase 3, negozi e interni — completata.** 240 vetrine e 658 attività su più piani nella Seoul
estesa, dodici tipi di locale con pianta, arredo e gente propri; denaro, listini, banco dei
pegni che ricompra, cambio d'abito che toglie una stella, casse da svuotare, officine di
verniciatura che azzerano il ricercato.

**Fase 3, la mappa — completata.** Seoul 7200×7200 con mare a ovest, Gimpo, Incheon e cintura
urbana; Busan 6400×5600 con baia ed estuario; Jeju 5400×5400 con profilo insulare completo.
Le coste hanno battigia, rocce e schiuma, mentre i bordi terrestri proseguono in una fascia
verde protetta da guardrail e collisione. Si vola (elicottero, turboelica) e si naviga
(motoscafo, battello); in acqua si annega e le auto affondano. Sei territori di bande.

**Fase 3, il tempo — completata.** Un giro di ventiquattr'ore ogni ventiquattro minuti, quattro
condizioni di tempo legate in catena, le finestre che si accendono la sera, la pioggia che si
sente al volante e i locali che aprono e chiudono.

**Fase 3, il giro di arretrati — completata.** La polizia assedia la porta del negozio in cui
ti sei infilato; l'equipaggio sbarcato risale in volante; quattro commissariati sulla mappa;
elicottero e motovedette per chi scappa in volo o via acqua; granate della SWAT. I pedoni si
riparano sotto i portoni quando piove, la pioggia spegne il fuoco e lava il sangue, l'incendio
si propaga, la minigun si surriscalda. Prezzi per quartiere, mezzi rubati da rivendere, interni
che cambiano con l'ora, un futon per dormire fino all'alba, l'allarme silenzioso dopo una
rapina, la porta sul retro. E le bande commerciano: quattro banchi, uno per mestiere.

**Fase 3, l'audio — completata.** Seoul fa rumore, e non c'è un solo file sonoro: undici armi
con timbro proprio, esplosioni e vetri rotti, il motore del mezzo che guidi, sirene che
scivolano di tono passandoti accanto, il rotore dell'elicottero, la pioggia — ovattata se sei
al riparo — il tuono che arriva dopo il lampo, il fondo della città che cala quando esci dal
centro, la risacca sulla costa, gli incendi, i passi, le urla, il campanello del 편의점 e il
registratore di cassa. Quattro volumi nel menu di pausa, `F4` per il silenzio.

**Fase 3, la radio — completata.** Autoradio con stazioni coreane vere, in streaming e senza
chiavi API: `R` accende e cambia stazione, `Shift+R` spegne, il nome scorre sopra il
tachimetro e nei locali che ce l'hanno la si sente bassa. Volume suo nel mixer.

**Fase 3, salvataggio e arresto — completata.** Tre slot su `localStorage` dal menu di pausa,
con dentro solo quello che la seed non sa rifare (meno di mille byte a slot). E una sconfitta
che non è la morte: la polizia ti ammanetta invece di spararti quando non hai una pistola in
pugno o sei quasi a terra, e la cella costa sei ore di orologio, la cauzione e l'arsenale.

**Fase 3, menu, musica e autosave — completata.** Un menu d'avvio con «Continua» sopra la
città che gira davvero; la musica del gioco, generata come il resto dell'audio — un tema sul
titolo e un inseguimento che cresce con le stelle, e silenzio dove Seoul si sente già da sola;
un quarto slot che il gioco scrive da solo dormendo, uscendo dall'ospedale o dalla cella e
ogni quattro minuti in strada, ma soltanto dove si può davvero ripartire.

**Fase 3, secondo giro di arretrati — completata.** Undici voci del backlog in una sessione:
i passanti che aggirano le auto in sosta invece di attraversarle, il ritorno al titolo con una
partita che ricomincia davvero, i volumi anche prima di giocare, tre generazioni di autosave,
**il riverbero generato a runtime** con i suoi quattro spazi, gli spari lontani che perdono lo
schiocco, quattro timbri di voce, il commesso che scappando da una rapina finisce davvero in
strada (e la sua telefonata si può fermare sul marciapiede), la mazza che ti fa ammanettare
solo se non la stai usando, un banco dei pegni in ogni distretto che possa averne uno — il
porto ha così il suo primo negozio in assoluto — e il futon che cura fino al 70% e non oltre,
così l'ospedale ha di nuovo un mestiere.

**Fase 3, il resto — da fare.** Le 12 missioni con cutscene a fumetti e le attività secondarie.
