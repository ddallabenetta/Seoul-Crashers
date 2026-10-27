# L'Atto II, seconda metà: M7, M8, R3 e le chiamate che mancano

> §5.42 del progetto. Indice generale e mappa dei rimandi: [HANDOFF.md](../../HANDOFF.md).
> Il copione: [`docs/storia/04-atto-2.md`](../storia/04-atto-2.md). La prima metà: [§5.40](29-atto-ii-m5-m6-r2.md).

### 5.42 — Tappa T8 del rework (seconda metà della F): la cella, la folla e i nove dischi

L'Atto II è chiuso. Questa tappa porta **M7** (farsi arrestare apposta), **M8** (un pedinamento a piedi
nella folla, e il secondo ribaltamento), il raccordo **R3**, le **cinque chiamate di 까치** che mancavano
(9, 10, 13, 15, 16) e la «visita che cambia» del **commesso** dopo M8. Come per la prima metà, quello che
vale per più di una missione sta nel motore e quello che sa la trama sta sotto `src/story/`: **nessuno
stato nuovo nel salvataggio** (formato `v6`, nessun scalino). Tutto quello che le tre missioni ricordano
sta nel taccuino (`missions.state`), nei fatti (`flags`: `cella`, `dulchae`, `sorella`, `commesso`,
`dischi`, `atto2`) e in `stats.metro`, che `stats` porta già intero.

---

## 1. M7: sei ore, e una cella in cui si cammina

M7 **non scrive niente di quello che fa un arresto**: la sequenza in volante (§5.35) è quella di sempre, e
termina in `game.bustPlayer()` come sempre — cauzione, arsenale, sei ore, evento `busted`. Quello che il
motore non sapeva fare era **dare l'evento a chi lo aspetta**: `MissionSystem.attach` rientrava sempre
nella fase, e adesso `phase.busted(ctx)`, se la fase lo definisce, lo prende al posto del rientro. È
l'unico aggancio che serviva, ed è generico (`busted(ctx) { ctx.next(); }`).

**La cella è una vetrina inventata.** I commissariati di Seoul sono un punto sul marciapiede, non un
edificio, quindi la missione mette davanti a quel punto una vetrina che non è in `city.shops`
(`id: 'm7-cella'`, `biz: ['jail']`) e ci entra con `shops.enter(shop, game, { silent: true })`. `jail` e
`yard` sono due righe nuove di `BUSINESSES` (`where: 'story'`: nessuna riga di `DISTRICT_MIX` le pesca, la
generazione non si sposta di un `rng`), con due `LAYOUTS` (`cells`, `yard`) e cinque mobili nuovi
(`grate`, `cot`, `crate`, `drum`, `cam`). Due celle affiancate sopra, un corridoio sotto con la scrivania
di chi sorveglia: **le sbarre sono solide**, quindi dentro la cella non si esce e non serve nessuna
serratura nel motore. Quella a sinistra è la tua; **Byeon** (un attore d'interno, `kind: 'worker'`, col
suo casco) sta in quella a destra.

**Il silenzio** è quello che il copione chiede («nessuna radio, nessuna musica, nessun HUD di missione»):
la pianta non ha `radio: true`, 까치 non parla dentro un edificio (regola 1), il campanello della porta è
saltato (`opts.silent`), il riquadro della missione sparisce (`quiet: true` sulla fase, letto da
`hud.drawMission`) e **l'orologio è fermo** (`dayCycle.paused`) per tutto il tempo. Le sei ore sono già
passate nel `bustPlayer`; alla fine la missione porta l'orologio dritto alle **06:10** (`waitUntil`) e,
dopo la chiusura, alle nove (il pannello 6 lo dice).

### Cinque scelte che il copione non dice

- **Il fermo si fa di sera, fra le 20:00 e la mezzanotte.** `10-continuita.md` fissa **06:10** (uscita) e
  **06:40** (morte di Byeon): con le sei ore del `bustPlayer` questo vale solo se ci si fa prendere in
  quella fascia. Prima, la fase aspetta la sera come M6 aspetta le 14:00 (`ctx.waitUntil`); dopo
  mezzanotte «per stanotte il fermo è chiuso» e si riparte da domani sera (`ctx.goto('sera')`). Ha-eun manda
  la sua riga sola — «Le mancano quattro ore» (o tre, o due: il numero è l'ora vera) — dopo 45 secondi da
  liberi. **Fallimento** non esiste, come da copione: morire riprende la stessa fase.
- **Il commissariato è il più vicino a dove ti prendono** (`bustPlayer`), e il blip va a quello di
  Myeongdong, il più centrale: 종로 non è un distretto di Seoul. La cella è la stessa dovunque.
- **«Qui si demolisce senza gru» è di Byeon, non di Ryu.** Il copione dà la chiamata 9 a Ryu in M6, ma Ryu in
  M6 non la dice in nessuna riga; la regola 3 vuole che l'originale **esista**, e un capocantiere che si
  rifiuta di parlare è il posto giusto. Il `// origine:` di `a2-campagna` lo dichiara.
- **Kkachi non «sparisce» dopo M7.** Il copione lo fa dire («per l'ultima volta prima di sparire»), ma le
  chiamate 13, 15 e 16 sono tutte dell'Atto II: «sparire» è qui *dove vive* (non dentro un edificio), non un
  silenzio di tre missioni. Il pannello 2 è diviso in due tavole (la seconda con il fruscio appena più alto,
  `bed 0,045`: la sillaba mangiata), perché cinque righe non stanno sotto una faccia.
- **L'auto è dove ti hanno preso.** Il «ritorno a piedi verso l'auto, all'alba» è la camminata fuori dal
  cancello (130 px), e la chiusura parte lì. Nessun blip sull'auto: non è compito di una missione sapere
  dov'è.

Sei pannelli (`m7-1…m7-6`): l'ingresso con le quattro volanti ferme, le due tavole di 까치, il cortile
all'alba con la busta degli effetti (e dentro **l'orologio**), la berlina nera dal cancello con **la mano
destra in tasca**, il telefono con la notizia e il narratore che fa i conti (06:10, 06:40).

## 2. M8: nella folla, e poi in un cortile

**Un pedinamento a piedi.** `core/tail.js` non chiede più un veicolo: se il bersaglio non sta in
`game.vehicles` è a piedi (`tail.foot`), si perde anche se muore o se lo streaming se lo porta via
(`gone`), e le soglie le passa chi chiama — qui `spot: 62`, `lose: 360`. M3 e M6 non sono cambiate di una
riga. **Un pedone che segue una fila di punti** (`state: 'goto'` in `entities/pedestrians.js`, con
`p.goto = { path, i, loop, speed }`): non si spaventa, non risponde ai colpi, e arrivato in fondo si ferma
lasciando `goto.arrived` per chi lo legge. **L'altro Jae-min** è un pedone con `look: 'hero'`: lo stesso
sprite del giocatore (`getHeroSprite`) in una posa nuova, `pocket`, con la mano destra in tasca.

**La folla l'ho messa io**: sedici passanti e **quattro teppisti in nero senza la banda**, attorno
all'isolato (`createPed` con l'rng degli attori, che non sposta lo streaming). È quello che fa del
riconoscerlo una scelta: «una giacca nera» non basta. **Nessun marcatore** da quando comincia la fase
(`ctx.unmark()`); il blip porta all'isolato e basta.

**Il giro e la corsa.** Lui cammina in senso orario sull'anello di marciapiede del suo isolato
(`places.anelloMarciapiede`: i quattro angoli della fascia di `SIDEWALK * 0.78` e la porta proiettata sul
suo lato). Dopo 36 secondi di pedinamento **e** quando la porta è a meno di 520 px, o appena ti vede
(`tailSpotted`), si accorge: il pedinamento si spegne, lui corre (86 px/s, contro lo scatto di 126 di
Jae-min) lungo la stessa fascia fino al portone, e il ricercato sale a due stelle. La radio della polizia
dà **il suo nome: il tuo** — è il momento in cui la storia e il sistema di ricercato diventano la stessa
cosa. Chi resta a più di 470 px per più di 6,5 secondi lo perde, e la fase riparte (`cerca`, con un altro
Dulchae), come per M3 e M6.

**Il cortile cieco.** La città non ha vicoli in cui ci si perda a Myeongdong: le piante con un cortile
raggiungibile sono dodici in tutta Seoul (`b.alleys`), e nessuna è lì. La porta di un **분식 di Myeongdong**
dà sul cortile **per la durata della missione**: `shops.stageShop(id, alt)` dice che dietro *quella* porta
c'è un'altra pianta (stessa insegna, stesso `id`, cache sotto una chiave sua), `unstage` ripristina quella
vera. Il cortile ha quattro muri, casse e fusti, **una telecamera per angolo** (con il led che lampeggia) e
nessuna uscita sul retro (`building: null`). Dulchae è un attore d'interno in fondo, rivolto alla porta;
quando il giocatore entra comincia, dopo 1,3 s, la sequenza di otto pannelli, e a fine pannelli Dulchae se
ne va (è `undefine`, e il piano lo perde). Si esce dalla stessa porta con le stelle ad aspettare fuori.

### Scelte che il copione non dice

- **A piedi, e basta.** Il copione manda l'inseguimento sui tetti, poi in macchina, poi in metro («se il
  giocatore è lento»). Qui si corre per le strade dell'isolato: i tetti non esistono, l'auto è un'altra
  missione e con le stelle addosso i tornelli restano chiusi (`metro.enterStation`).
- **Non c'è la scelta di sparare.** `10-continuita.md` conta il cortile cieco fra le tre occasioni di
  uccidere Dulchae: qui è una sequenza di pannelli, e quella decisione resta ai finali (tappa H).
- **Il 피시방 è aperto dalla storia** (`shops.hold`): alle undici del mattino non apre mai, e l'orario si
  aspetta come in M6. Il copione dice **terzo piano**, e `findShop` ha adesso una preferenza di piano
  (`level`); ma a Hongdae non ce n'è uno al terzo (quelli al terzo sono a Myeongdong e a Gangnam), e **vince
  il quartiere sul piano**: sta al secondo, e il suggerimento di fase dice il piano vero.
- **«Myeongdong» è quello che dice l'HUD.** Le etichette `shop.district` di generazione e `districtAt`
  non coincidono sui bordi (la prima porta trovata stava, per l'HUD, a Hongdae): `findShop` ha un'opzione
  nuova, `visible`, che chiede il distretto **come lo legge il giocatore**.
- **Il messaggio** d'apertura è quello del copione — un numero non in rubrica, che sa cosa hai mangiato.
- **Date assolute.** I nove fotogrammi vanno dal 9 ottobre 2014 al 22 luglio 2026, con il 14 settembre 2025
  (la controfirma di M6) e il 9 maggio 2024 (Busan): i tre che Mi-rae nomina sono anche i tre timbri LAX del
  pannello 3. Il numero di registro è velato (`920***-1******`), perché le carte vere lo sono.

Quattordici pannelli (`m8-1…m8-14`; sei di apertura, otto di chiusura): la battuta di Mi-rae in
tre tavole e quelle di Dulchae in tre, perché nessuna delle due sta sotto una faccia. Tre cose nuove nel
cast a pixel (`pixelkit.CAST`): **Mi-rae** (capelli lunghi e frangia dritta, la testa più stretta del
cast; il fermaglio e le cuffie ciano), **Dulchae** (stessa testa di Jae-min, stesso bomber, e un'opzione
nuova di `figure`, `pocket`, che mette quella mano in tasca) e le **cuffie**, disegnate dal pannello perché
stanno sul corpo.

## 3. R3: stanotte, dischi accesi

Una fase di viaggio (il blip, e **si aspetta la notte** come in M6: le 23:00), l'ingresso al 피시방 e i
pannelli. Il raccordo è di **cinque** tavole e non di tre: la risposta lunga di Mi-rae sulla natura di
까치 si divide in due (il monitor con la forma d'onda è il soggetto, e il testo se lo mangiava), e le tre
righe che «servono» — *di chi è la voce* — hanno la tavola loro. L'ultima è il quadrante `91.45`, fermo, per
**cinque secondi** (`hold`), con il fruscio di sempre. **L'atto è finito**: R3 alza `dischi` e `atto2` e
non lascia niente in corso.

## 4. 까치: le otto dell'Atto II sono tutte

Come le altre, ognuna esce **solo a radio accesa**, e una chiamata interrotta è persa per sempre
(`atto-2.scene` lo prova con la 16 in tutti e due i modi).

| Chiamata | Si innesca | Origine |
| --- | --- | --- |
| `a2-campagna` (9) | in macchina nel distretto di 경기도 o fuori da ogni città, **M7 finita** | Byeon, M7 — **spostata** da Ryu (vedi sopra) |
| `a2-volo` (10) | in volo (`airborne`), **R1 finita** | nessuna; **la risposta è vuota**, ed è la prima volta |
| `a2-metro` (13) | avvicinandosi a una scala di Seoul in macchina, **mai scesi prima**, M7 finita | Kkachi, M7 |
| `a2-mezzanotte` (15) | dieci minuti di gioco fra mezzanotte e le cinque, guidando e senza stelle | Jo, M2 (il silenzio come risposta) |
| `a2-funerale` (16) | in macchina a meno di 260 px dalla sala dell'ospedale di Hongdae, R1 finita | il narratore, pannello 12 della cutscene — **spostata** da Chun-sik |

- **La 13** si sente *prima* di scendere, perché a piedi 까치 non parla: scendere conta (`stats.metro`,
  scritto da `metro.enterStation` e portato dal salvataggio) e dopo la prima volta non c'è più. **La
  seconda metà** — sette secondi in banchina, nessuna risposta — non è una riga di radio ma un toast di
  Jae-min (`Jae-min: «…Kkachi?» — nessuna risposta`) mandato dall'evento `metroDwell`, e si segna come
  `a2-metro-vuoto` fra le chiamate andate (non conta per il finale: `heard` non cambia).
- **La 15** è l'unico predicato con stato della tabella: `pickCall` valuta solo mentre si guida e senza
  stelle, quindi «dieci minuti» è il tempo fra due valutazioni consecutive; un buco di oltre 20 secondi
  azzera il conto. Sta in una chiusura di `story/kkachi.js`, non nel motore.
- **La 16**: il gioco non ha un edificio che si chiami 장례식장, e i funerali coreani si tengono nelle sale
  annesse agli ospedali — è quello del distretto. **Il copione dà l'origine a Chun-sik in R1, che quelle
  buste non nomina mai**: l'originale vero è il pannello della camera ardente («Buste di condoglianze.
  Sono tre. La più spessa è di 한성개발»), e il `// origine:` lo dice.

## 5. Il commesso, dopo M8

«Ah, lei è l'altro» — e non aggiunge niente, mai. **Non è un punto da premere**: il 편의점 ha già il suo `E`
(il listino), e una visita permanente sullo stesso bancone lo avrebbe tolto a chi ha fame. Parla da sé la
prima volta che si entra nel 편의점 di Itaewon dopo M8, **una volta sola** (`flag commesso`). La riga di
prima di M8, «…di nuovo?», è già nella cutscene e in M3: non si ripete. **Scelta nostra.** Chun-sik dopo M9
viene con M9.

## 6. Il motore

- `phase.busted(ctx)` e `phase.quiet` (`core/missions.js`, `ui/hud.js`); `ctx.goto(id)` / `MissionSystem.goto`
  per saltare a una fase per id (M6 aveva un suo `torna`, che resta).
- `tail.begin` accetta un pedone (`tail.foot`).
- `state: 'goto'` e `p.look` (`pedestrians`, `scene.drawPed`, `actors`); `getHeroSprite(..., 'pocket')`.
- `shops.stageShop` / `unstage`, `enter(shop, game, { silent })`, e le chiavi non numeriche della cache che
  `snapshot` salta.
- `jail` e `yard` in `world/interiors.js` e i cinque mobili in `render/interiorscene.js`.
- `places.findShop` ha due opzioni (`level`, `visible`) e `places.anelloMarciapiede`.
- `pixelkit.CAST` guadagna `mirae` e `dulchae`; `figure` l'opzione `pocket`.
- Due eventi sul bus: `metroEnter` e `metroDwell`.

## 7. Quello che questa tappa ha trovato a schermo, e non nel sorgente

- **`put()` scarta in silenzio quello che tocca un mobile già messo.** Il divisorio fra le due celle sparì: era
  attaccato alla sbarra della fronte, e a schermo c'era una cella sola. Ora il divisorio si mette per primo e
  si ferma due pixel sopra.
- **`shop.district` non è il distretto che legge il giocatore.** La prima «porta di Myeongdong» stava in
  Hongdae: l'etichetta di generazione e `districtAt` si separano sui bordi.
- **Una finestrella nera sul fondo di un pannello è un pannello morto.** Il finestrino della berlina di M7
  era la prima volta un rettangolo scuro con un blocco color pelle: il polso in tasca si legge solo se la
  manica arriva dalla spalla, il vetro è chiaro e la tasca è una fessura.
- **Un pannello con tre battute lunghe non ha una faccia.** Mi-rae e Dulchae finivano dietro il riquadro:
  si dividono le tavole, e le figure si fanno più piccole e più alte (cima a 0,2).
- **`actors.restore` azzera `d.ped` anche di chi è nato durante il caricamento.** Byeon, definito dalla
  fase mentre `missions.restore` rientra, ha il pedone sul piano ma `actors.get('byeon')` dice `null`: il
  punto di dialogo non ne dipende, ma una prova deve guardare `floor.people`.
- **Ripresa durante la cella e dopo un arresto in M8.** Entrambe riprendono la stessa fase, e il
  `stageShop` si rimette da sé (`shops.restore` svuota `stage`, la fase lo riapparecchia).

## Come si prova

```bash
node .claude/tools/probe.mjs --seconds 1 --quiet \
  --shot-dir /tmp/atto2 --script .claude/tools/scenes/atto-2.scene \
  --eval "Object.entries(window.__OUT).filter(([k,v]) => v===false).map(([k])=>k)"
```

`[]` vuol dire tutto a posto. **287 voci**: oltre a quelle della prima metà, M7 intera (l'appuntamento della
sera, l'arresto **vero** — manette, volante, `busted` —, la cella con Byeon, il salvataggio **dentro la
cella**, l'alba, la chiusura alle nove), M8 intera (il pedinamento a piedi **perso, scoperto e riuscito**,
la corsa, il cortile dietro la porta, la ripresa dopo una morte **e dopo un arresto**, il salvataggio fuori
dalla porta, la porta che torna quella di prima), il commesso, R3, **nessuna missione appesa al passaggio
all'Atto III** e le cinque chiamate a radio accesa e spenta. `window.__LOG` è la fila delle fasi. Con
`--shot-dir` fotografa sedici momenti giocati (`m7-1-cella`, `m7-2-byeon`, `m7-3-alba`, `r3-0-notte`, `m8-0-pcbang`, `m8-1-pedina`,
`m8-2-fuga`, `m8-3-cortile`, `m8-4-cortile-vuoto` e quelli della prima metà). I pannelli si guardano con
`cutscene-sheet.scene` e `cutscene-panel.scene` (`window.__SCENA = 'm7' | 'm8' | 'r3'`), i due personaggi nuovi con
`cast-sheet.scene` (`window.__CAST = ['mirae', 'dulchae']`) e il fruscio con `cutscene-audio.scene` (nuova
sezione 4: M7-2 rms 0,0048, M7-3 0,0070, R3 da 0,0035 a 0,0063, contro 0,0023 del silenzio e picco massimo
0,025). `kkachi.scene` conta sedici chiamate (otto + otto).

## Quello che questa tappa lascia indietro

- **L'Atto III**: M9 (Chun-sik ordina cibo per uno e parla al passato: la sua «visita che cambia» è lì), M10,
  M11, M12, R4, le otto chiamate dell'Atto III e i finali. Il filo di Dulchae continua: le tre occasioni di
  ucciderlo (`10-continuita.md`) sono ai finali, e il conto del cortile cieco non è tenuto da nessuna parte.
- **Un allarme scriptato con le volanti fuori in M6** e **chi legge `proroga`** (M5): il copione dell'Atto II
  non li chiede, e restano due righe di dialogo e un'ora di lavoro se serve.
- **Una torre in cui si sale davvero** e **il tetto** come terza strada d'ingresso (§5.40): invariati.
- **Dulchae di giorno nella folla dopo M8**: l'attore non esiste fuori dalla missione. Se l'Atto III vuole la
  sua faccia in strada, `look: 'hero'` e `state: 'goto'` ci sono già.

## Poggia su

Impianto delle missioni e fasi (§5.29) · cortili (§5.31) · 까치 (§5.32) · pedinamento (§5.33) · arresto in
volante, che termina in `busted` (§5.35) · regia sonora dei pannelli (§5.37) · l'Atto II, prima metà (§5.40) ·
negozi, piani e interni (§5.8) · orologio e meteo (§5.11).
