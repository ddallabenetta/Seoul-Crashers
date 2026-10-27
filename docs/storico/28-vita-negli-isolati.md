# Vita negli isolati

> §5.39 del progetto. Indice generale e mappa dei rimandi: [HANDOFF.md](../../HANDOFF.md).

### 5.39 — Tappa T9b del rework: parchi, campi, marciapiedi e moli smettono di essere tutti uguali

L'audit della mappa aveva misurato il problema: un parco aveva 14-18 prop di 1,5-4,5 tipi
(alberi, un sentiero, qualche cono), tutti identici; Jeju e Busan avevano 95 e 30 blocchi
`park`/`rural` senza un edificio; Busan aveva 9 tipi di prop contro i 21 di Seoul e 0,29
insegne per edificio contro 1,11; i docks di Seoul erano capannoni senza una parola scritta.
Questa tappa aggiunge **vita** senza toccare la forma di niente.

**Il vincolo che governa tutto.** La maglia di Seoul non si tocca e l'rng principale
(`new Rng(20260730)`) non consuma un numero in più. Quindi tutto gira in **un passo in coda**,
`vitaNegliIsolati(city)` in `src/world/blocklife.js`, chiamato da `regions.createRegion` **dopo**
`reindex` (accessi metro, stalli e negozi sono già al loro posto) e con rng suoi: **uno per
blocco**, derivato dalla posizione (`blockRng`), non dall'ordine di visita. Prima/dopo
identici: `stats.blocks/nodes/edges`, hash di `shops`, `garages`, `turfs`, fermate, accessi
metro, ospedali, blocchi, nodi e `traffic.parkingSpots` (90). Cambiano solo `buildings` e `props`,
e il passo lascia `stats.base` con i valori di prima e `stats.vita` con quanto ha aggiunto.

**Riusabile.** Nessuna funzione conosce una regione: lavorano su qualunque blocco di
qualunque `city`. Quello che dipende dalla regione è una tabella di pesi (`RURAL_THEMES`) e le
parole delle insegne (`REGION_WORDS`). Quando T9d rifarà Busan e Jeju e T9c popolerà la campagna
basta che i loro blocchi abbiano `type`, `fields` e `yards` come oggi.

#### Cosa fa

- **Parchi** (`type: 'park'`): ogni blocco sceglie una tipologia compatibile con la sua taglia —
  stagno con sponde e ninfee, campo da basket o da calcio con linee e recinto, 정자 su piazzale,
  area giochi (altalena, scivolo, altalena a bilico) con sabbiera e recinto, mercato all'aperto
  (bancarelle a telone che si guardano, tavoli 평상 e ombrelloni), orti urbani, piazzale con
  panchine e fioriere, e il bosco di sempre (con cespugli e massi) come ripiego. La scelta è
  pesata e **scoraggia la tipologia dei vicini** entro 900 px: due parchi accanto non sono uguali.
- **Campagna** (`type: 'rural'`, per appezzamento di `block.fields`): frutteto (mandarini a Jeju,
  peri e cachi altrove), serre 비닐하우스, cascina con aia, stoppia con balle 곤포, pascolo
  recintato con abbeveratoi, risaia con le piantine in fila. Ogni blocco ha un tema dominante
  (pesi per regione) e una quota di appezzamenti diversi.
- **Moli** (`dock`, `port`): insegne sui magazzini che non ne avevano (parole di porto), fasce a
  righe davanti ai portoni, **gru a portale** sul lato che guarda l'acqua (`harborcrane`, mai
  `crane`: M4 cerca il `crane` più vicino al molo e spostarlo sposterebbe la missione), container
  impilati nei vuoti del reticolo originale (anche di traverso), muletti, carrelli, gru mobile,
  pallet e casse.
- **Arredo urbano** lungo i bordi degli isolati: idranti, cestini, panchine, fermate, distributori,
  chioschi con insegna in hangul, cassette della posta, rastrelliere, fioriere, barriere. Seoul è
  il riferimento: la densità di arredo per 1000 px di marciapiede si misura (`furnitureDensity`) e
  le altre regioni ricevono arredo in proporzione al loro deficit. Seoul non riceve arredo.
- **Insegne** (`addSigns`): stessa idea, sul numero di insegne per edificio; un palazzo sulla
  strada ne porta fino a due, uno nel cortile una. Parole di Seoul più quelle della regione
  (돼지국밥, 밀면, 횟집 a Busan; 흑돼지, 감귤, 해녀 a Jeju).

#### Dove vive cosa

- **Pittura piatta** (stagni, campi, piazzali, orti, recinti, risaie, strisce): `block.decor`,
  disegnata da `src/render/blockdecor.js` **dentro il tile del terreno** (un solo gancio in
  `ground.js`). Costo per frame: zero. Se un blocco ha `decor` il sentiero generico del parco non
  si disegna (lo disegna la tipologia).
- **Prop nuovi** in `src/render/sprites.js` (`getPropSprite`): `stall`, `parasol`, `pavilion`,
  `swing`, `slide`, `seesaw`, `hoop`, `goal`, `bush`, `rock`, `hay`, `orchard`, `forklift`,
  `trolley`, `bikerack`, `planter`, `mailbox`, `bedplat`, `trough`, `harborcrane`, `mobilecrane`.
  Guardati ingranditi con `sprite.mjs`. I prop del passo portano `life: true`.
- **Edifici nuovi** (serre, cascine, container): `ctx.addBuilding`, con `elev` calcolata e
  inseriti negli indici; hanno `edges: []`, quindi non diventano mai negozi.

#### Cosa il passo rispetta (e come)

`makeCtx` costruisce una griglia di **zone vietate**: porte dei negozi (40 px), accessi metro
(+44) e punti d'arrivo, fermate, officine, ospedali, landmark, piazzole di aerei e barche,
strisce pedonali, scale, **tutte le posizioni possibili degli stalli di parcheggio** (la stessa
formula di `traffic.collectParkingSpots`, senza il 60% di probabilità) e il **centro** (il 56%) di
ogni cortile di banda: lì si sgombra e si resta sei secondi (§5.31), sui margini l'arredo può
stare. Fuori da lì: niente acqua, niente carreggiata (`rectIntersectsRoad`), niente
sovrapposizione con edifici e prop esistenti. Gli indici (`propGrid`, `solidGrid`) si rifanno
alla fine (`rebuildIndices`) perché il passo **toglie** anche prop: gli alberi sotto una
tipologia e i condizionatori dei cortili di Jeju finiti in mezzo ai campi.

I prop **solidi** nuovi sono pochi e piccoli (bancarelle in un mercato di parco, balle, silo,
chioschi e distributori): sul marciapiede l'arredo nuovo è quasi tutto non solido, perché la
corsia dei pedoni sta a `SIDEWALK × 0,78` dal bordo e un prop solido di raggio 12 la chiude.

#### Misure (prima → dopo)

Stesso harness dell'audit, sul codice di partenza e sul nuovo, stesse coordinate (M01 Jeju
interno, M02 Jeju sud, M03/M04/M14 Busan est e nord-est, M05 docks ovest di Seoul, M12 Jeju est).

| Regione | Tipi di prop | Prop | Insegne / edificio |
| --- | --- | --- | --- |
| Seoul | 21 → **37** | 1987 → 2422 | 1,13 → 1,07 |
| Busan | 9 → **35** | 1456 → 2214 | 0,29 → **0,62** |
| Jeju | 15 → **33** | 1376 → 1390 | 0,99 → 0,96 |

Le insegne per edificio di Seoul e Jeju scendono di pochissimo perché il passo aggiunge edifici
(serre, cascine, container) e non vi mette insegne; il numero assoluto di insegne sale. Seoul
totale: `buildings` 1958 → 2126, `props` 4847 → 6054 su tutta la Corea; **blocchi, nodi, archi,
negozi (509), officine, cortili, fermate, accessi metro, ospedali e stalli (90) identici**.

Costo: nessun costo per frame nuovo (la pittura piatta è nel tile). Mediana di `scene.render`
in JS, camera ferma a zoom 1, due giri a testa: Hongdae 2,2-2,5 → 2,2-2,9 ms; docks di Seoul
1,2 → 1,6-1,8; parchi di Seoul 0,8 → 1,2-1,6; Busan est 2,0-2,3 → 2,2-2,4; Jeju 0,9-1,0 → 0,9-1,6.
Il costo è quello dei prop in più nel campo visivo (docks 88 → 138). I fps misurati a occhio con
`requestAnimationFrame` oscillano fra 15 e 60 su questa macchina condivisa, prima e dopo allo stesso
modo: non dicono niente. Verifiche: `korea-census` invariato (Jeju 0 raggiungibili), `impianto-campagna`,
`missioni-run` e `atto-1` `[]`, `walkers-census` senza pedoni piantati (`piantati: 0`; `dentroLamiera`
147 prima, 146 dopo: è il difetto che c'era già, vedi backlog), censimento del traffico fianco a
fianco nel rumore (una sola coppia: urti/min 25 e 33, flusso mediano 3793 e 3240).

#### Trappole nate qui

- **`queryRect` della griglia restituisce i candidati delle celle, non solo chi sovrappone**: un
  controllo «c'è un edificio in questo rettangolo?» va rifatto a mano sul risultato
  (`ctx.hasSolid`). Il primo giro mi aveva fatto credere che i blocchi rurali di Jeju fossero già
  pieni di edifici.
- **I `rural` di Jeju portano `ac_unit` solidi dai cortili** (`decorateYards`): contarli come
  «c'è già qualcosa» saltava i due terzi dei campi. Nei campi si tolgono.
- **Un `turf` può coprire tutto il piazzale di un molo** (il porto di Incheon): se la zona vietata
  è l'intero cortile, il molo non riceve niente. Si vieta il centro.
- **Il numero di insegne per edificio non può salire sopra una soglia con una sola insegna per
  facciata**: Busan ha solo 364 edifici su 815 con un lato strada, quasi tutti già con insegna.
  Per avvicinarsi a Seoul servono la seconda insegna e quelle sui palazzi del cortile.
