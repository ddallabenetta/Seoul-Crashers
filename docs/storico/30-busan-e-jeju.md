# La forma di Busan e Jeju

> §5.41 del progetto. Indice generale e mappa dei rimandi: [HANDOFF.md](../../HANDOFF.md).

### 5.41 — Tappa T9d del rework: due città che non sono più Seoul su un'altra costa

Un audit misurato aveva trovato Jeju come un rettangolo con gli angoli arrotondati su un reticolo
uniforme (95 blocchi su 226 senza edifici), Busan come una scacchiera con la costa a ovest e la
campagna vuota a est, e i sette distretti **clonati** da Seoul con le stesse tinte e gli stessi
negozi. **Seoul e l'rng `new Rng(20260730)` non sono stati toccati**: un hash di edifici, prop,
negozi, officine, cortili, isolati, nodi, ospedali, fermate e landmark *dentro Seoul* è identico
prima e dopo (`stats` e luoghi delle missioni M1-M4 compresi). Busan e Jeju hanno seed propri e
sono state riscritte da zero.

## Il meccanismo nuovo (tre moduli, nessuna dipendenza)

- **`world/coastmask.js`** — la costa è un insieme di *poligoni* (terra, baie, isolotti)
  rasterizzati in una maschera a 8 px (`createMask`, `paint`, `blobPoly`, `roughen` a punto medio).
  `isWater` diventa una lettura di memoria; `shoreDist` (chamfer a 16 px) dice quanto un punto di
  terra è lontano dal mare. `contour` lancia raggi da un perno e dà una curva parallela alla riva.
- **`world/netgen.js`** — la rete stradale nasce da **tracciati** (poligonali con lati assiali),
  non da un reticolo con `on[]`: `buildNetwork` ricava linee, grafo (`roadgraph.graphFromParts`,
  estratto da `buildRoadGraph`), incroci e strisce. `staircase` segue una curva con isteresi (gambe
  lunghe dove è dritta, gradini ≥ `thr` dove corre in diagonale: **mai sotto la somma delle mezze
  carreggiate**). `carveBlocks` ritaglia gli isolati dallo **spazio libero** (griglia comprimessa
  sui bordi delle strade, passate a passo decrescente per la riva): niente isolato in acqua né su una
  strada, per costruzione. Le linee portano i loro `marks`; `korea.buildLaneMarks` le lascia stare.
- **`world/regionkit.js`** — una sola implementazione di edifici, isolati urbani/parco/campo/porto,
  vetrine, officine, ospedali, bande, fermate e landmark (prima erano due copie divergenti).
  Quello che cambia fra regioni sta nei **distretti**: palette, `mix` di negozi, `signWords`,
  `lotScale`/`gapScale`.

## Jeju

Isola 7200×4800 (era 5400²): ellisse lunga con costa rugosa, il promontorio di Seongsan e quattro
isolotti. **Hallasan** è un cono (quota 300, crateri e 14 *oreum* parassiti) senza una strada sopra
la quota alta. **일주도로**: anello a gradini a ~400-700 px dalla riva, dritto dove attraversa
Jeju-si (nord, con lungomare e porto con tre moli e gru) e Seogwipo (sud); l'**aeroporto** sta fra
costa e anello (pista 760 px, piazzale, eliporto, terminale sulla strada). Anello interno attorno
al cono, strade di campagna a ponte fra due tratti, sei villaggi (Aewol…), strada del promontorio
(vicolo cieco con testata). Campi di mandarini con **muretti di basalto** (`stonewall` in
`blockdecor`), spiagge di sabbia o basalto (`ground.drawRegionalWater` colora la terra entro 120 px
dall'acqua, `shoreKind`), stile di facciata `stone`. Resta un'isola: 0 nodi raggiungibili da Seoul.

## Busan

Cuneo che punta a sud-est (6400×5600): foce del Nakdong a ovest, porto con l'isola di Yeongdo
(ponte-terrapieno), baia di Suyeong con il **ponte Gwangan**, penisola di Marine City, spiaggia di
Haeundae a est. Otto monti (Geumjeongsan, Hwangnyeongsan, Jangsan…) spezzano la scacchiera; le strade
principali sono scalinate che seguono il fondovalle (asse Gyeongbu → Dongnae → Seomyeon → Nampo),
le griglie dei quartieri hanno il perimetro chiuso (niente vicoli ciechi). **Gradoni**: nelle zone
`TERRACES` la quota sale a terrazze (`makeElevation`), quindi i palazzi dei pendii stanno a quote
diverse. Fronte mare occidentale con cinque moli (due container, traghetti, Jagalchi, Nampo).
**Cuciture con il mondo**: `busan.SEAM` fissa dove il mare d'ovest e d'est incontra il bordo; in
`korea.makeGeography` costa sud ed est sono raccordate (a sud di Busan è tutto mare, la Gyeongbu
entra da nord a x locale 3700, arteria da 144).

**Un ponte è terra.** I veicoli affondano su `isWater` e le barche sono bloccate dalla terra, quindi
il ponte Gwangan e quello di Yeongdo sono terrapieni percorribili (`city.bridges`, calcolati dalle
campate che attraversano l'acqua): in barca si gira attorno, non si passa *sotto*. Chi scrive la
corsa in baia di M10 lo sappia (§6).

## Identità

Palette, mix di negozi (nuovi locali `hoe` 횟집, `heuk` 흑돼지, `cafe`, `gukbap` 돼지국밥, che nei mix
di Seoul non compaiono), parole delle insegne e `lotScale` per distretto, in `busan.js` e `jeju.js`.
`traffic.js` e `pedestrians.js` leggono il mix **del distretto della regione** (identico per Seoul).

## Atto III: i luoghi di Busan

`story/places.js` → `findBusan(game, chiave)` (e `findShop`/`findTurf` accettano `area:'busan'`).
Non si cerca: i luoghi **esistono** come `city.landmarks` con id fisso, sempre nello stesso punto.
`ingresso` (`busan-checkpoint`, posto di blocco M9) · `piazzale` (`seomyeon-square`, M9) ·
`mercato` (`jagalchi-market`, M10) · `moli` (`nampo-piers`) · `officina` (`sasang-workshop`, Ko
Eun-bi) · `baia` (`busan-bay`) · `ponte` (`gwangan-bridge`) · `traghetti` (`busan-ferry-terminal`,
M11 e incontro facoltativo) · `container` · `spiaggia`. Il risultato ha `approach`, il nodo stradale
più vicino (i landmark con edificio hanno il centro in un solido). `regioni-census.scene` li
verifica: asciutti, fuori dai solidi, raggiungibili guidando da Seoul.

## Cuciture rifatte (T9a/T9b sulla forma nuova)

- **Testate**: `accorciaStrade` le rigenera (Busan 2, Jeju 1; solo vicoli ciechi voluti).
- **Siepi**: Seoul resta sul rettangolo; Busan e Jeju hanno `korea.siepi`, calcolata dove un isolato
  urbano confina con un campo o con terra aperta (`calcolaSiepi`).
- **blocklife** gira sui blocchi nuovi (`theme` forza la tipologia: il piazzale di Seomyeon; campi di
  Jeju con muretti).
- Un salvataggio con il giocatore in acqua dove prima c'era terra lo riporta alla fermata più vicina.

## Verifica

`korea-census` (Busan 163/163 nodi raggiungibili, Jeju 0, tutti gli invarianti a 0),
`regioni-census` (nuova, tutto `[]`), `impianto-campagna`/`missioni-run`/`atto-1` senza `false`,
`walkers-census`, traffico a Busan (`window.__AREA`), `life-census`, hash di Seoul identico.

## Trappole nate qui

- `staircase` con `thr` sotto 2×(larghezza/2) sovrappone gli asfalti; i raccordi forzati (`force`)
  creano gradini piccoli: scegliere quote vicine a quelle naturali.
- Un'arteria che attraversa una griglia in diagonale la rovina: il tracciato libero deve **attaccarsi
  a una linea della griglia** (`exactEnd`) e attraversarla dritto.
- Un landmark vicino alla riva va riservato **prima** di `carveBlocks`; dopo, `regions.reindex` lancia
  «Landmark sulla carreggiata».
- Isolati di meno di ~70 px sono strisce senza porte: `minSize 72`.
