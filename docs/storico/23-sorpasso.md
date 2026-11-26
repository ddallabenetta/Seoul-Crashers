# Il sorpasso, con la corsia scelta in base alla svolta

> §5.34 del progetto. Indice generale e mappa dei rimandi: [HANDOFF.md](../../HANDOFF.md).

### 5.34 — Tappa T1 del rework: l'arteria ha due corsie, e adesso le usano tutte e due

Il primo tentativo (§5.10, in [04-traffico.md](04-traffico.md)) era stato scartato con una
diagnosi: «il pezzo che manca è scegliere la corsia **in funzione della svolta successiva**».
Questo è quel pezzo. Tutto sta dietro `traffic.OVERTAKE` (`true`): con `false` la guida è quella
di prima — verificato confrontando le posizioni dei veicoli dopo 8 s su un albero di partenza e
sul nuovo con la costante spenta, uguali al pixel di deriva del passo di frame.

## Come funziona

- **Chi svolta sceglie la corsia, non il caso.** Appena si entra in un arco dell'arteria la
  svolta all'incrocio dopo è già decisa (`nextChoice`, con il rng seedato del traffico: prima si
  sceglieva a 150 px dal nodo). `turnOf(edge, dir, choice)` la classifica col segno del prodotto
  vettoriale (y verso il basso, quindi positivo = destra). La Corea guida a destra e
  `lanePoint` mette l'offset a destra del verso di marcia: **corsia 1 (54 px) è l'esterna,
  quella della svolta a destra; corsia 0 (18 px) è l'interna, quella della svolta a sinistra.**
- **Chi entra svoltando entra nella corsia giusta**: a destra nella 1, a sinistra nella 0. È la
  geometria stessa della svolta, e senza serve meno lavoro dopo.
- **Cambio obbligatorio** (`laneLogic`): se la corsia non è quella della svolta, ci si sposta
  appena `laneProbe` dice che c'è posto. Le arterie hanno archi da ~290 px (mediana), quindi
  `LANE.mandatory = 700` vuol dire «subito».
- **Sorpasso facoltativo**: solo se si va dritto, a più di `noOptional` (200 px) dall'incrocio, il
  leader viaggia almeno `slower` (75 px/s) sotto il nostro target, dall'altra parte il gap
  davanti è ≥ 180 px (e ≥ gap del leader + 100) e chi lo occupa è ≥ 40 px/s più veloce del
  nostro leader. Fra due cambi facoltativi passano `minBetween` = 3 s.
- **Scivolamento continuo**: `ai.laneF` (frazionario) insegue `ai.lane` a `slide` = 1,1 corsie/s
  e il waypoint usa `laneF`. `laneOffset` è diventata `18 + 36·lane`: identica a prima per 0 e 1,
  e interpolabile fra i due.
- **`laneProbe`** guarda la corsia di destinazione con `vehicleGrid` entro 300 px: occupa la
  corsia chi sta a meno di `window` = 26 px dal suo centro; davanti serve `GAP_STOP + 12 +
  0,9·(v − v_o)⁺`, dietro `16 + 1,1·(v_o − v)⁺ + 0,1·v_o`. Chi è obbligato (svolta vicina) si
  accontenta del 60% della velocità relativa e di meno spazio fisso.
- **`senseAhead`** durante lo scivolamento guarda anche la corsia di destinazione (finestra
  `lat ≈ Δ`), e memorizza `ai.leadGap`/`leadSpeed`, che servono a decidere il sorpasso.
- **Esclusi**: `ai.scripted` (auto della storia, `spawnScripted`/`sendTo`), la polizia (ha
  `copAi` e un suo `driveAI`) e `driver==='player'`. `reacquireLane` riallinea `laneF` a `lane`.

## Misura (fianco a fianco, `sorpasso.scene`, cinque run per ramo)

Scena nuova `.claude/tools/scenes/sorpasso.scene`: il censimento del traffico più le metriche di
corsia, prese **dalla posizione fisica** delle auto (così vale anche sull'albero di partenza).
Il rumore fra due run dello *stesso* codice è enorme: sull'albero di partenza flusso 3452-3971,
immobili 15-26, urti 26-34/min. Per questo cinque run per parte e le medie, non una run.

| | partenza | nuovo |
| --- | --- | --- |
| urti/min | 30,7 | **27,6** |
| flusso mediano px/min | 3756 | **3886** (+3,5%, sotto il rumore) |
| flusso minimo (zona peggiore) | 2505 | **3009** |
| immobili su ~200 seguiti | 19,2 | 19,0 |
| cambi di corsia/min | 14,1 (rumore dell'isteresi) | **51,8** |
| quota di campioni in corsia esterna | 0,21 | **0,36** |
| auto in corsia sbagliata per la svolta, a 20-60 px dal nodo | 51% | **22%** |
| fps | 32 | 30 |

Il guadagno non è nel flusso mediano (pari, entro il rumore) ma nel **minimo** — la zona che
prima si incolonnava dietro il furgone lento — e nel fatto che adesso la corsia esterna serve.

**Cosa è servito per arrivarci** (tre iterazioni, tutte misurate):
1. facoltativo largo (leader −40 px/s, nessun limite di spazio oltre 110 px, gap appena migliore):
   flusso 3347 (−12%), immobili 30. Peggio, come la prima volta;
2. **solo cambi obbligatori** (`LANE.optional = false`): flusso 3557, immobili 18, urti 24. Il
   danno veniva interamente dal sorpasso facoltativo, non dalla scelta della corsia;
3. facoltativo stretto (leader −75 px/s, ≥ 200 px dall'incrocio, gap ≥ 180): quello in vigore.

Restano il 22% di auto in corsia sbagliata: perlopiù chi è in coda a un rosso nell'altra corsia
e non ha spazio per spostarsi, o è appena uscito da una svolta e sta ancora scivolando.

## Cose da sapere

- **Il sorpasso è un lusso da pochi px**: gli archi sono corti (mediana 291 px, e ~70 vanno
  persi nell'incrocio), quindi il facoltativo scatta soltanto sui tratti lunghi o appena dopo
  una svolta. Allargarlo costa flusso (iterazione 1).
- **`walkers-census` non dà 0 nemmeno sull'albero di partenza** in questo container
  (`dentroLamiera` 26 e 72 in due run): sono sempre **veicoli parcheggiati** con un pedone che
  ci passa attraverso (il censimento scarta i veicoli con guidatore). Sul ramo nuovo 281-332,
  tutto da un furgone in sosta. È caotico, non sistematico: cambiando `slide` da 1,1 a 1,0 il
  furgone scende da 36 campioni a 3. Dipende da dove cade il rng delle auto in sosta, che qui
  si sposta perché la svolta si decide prima. Non l'ha causato il sorpasso, ma l'invariante
  «0» non è affidabile a prescindere: va riaperto con una scena che usi sempre le stesse auto.
- **Non toccare `ai.lane` da fuori**: è la corsia *desiderata*; quella reale è `ai.laneF`.
