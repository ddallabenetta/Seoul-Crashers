# Fase 1.5 — urbanistica dinamica e rilievo

> §5.1–5.3 del progetto. Indice generale e mappa dei rimandi: [HANDOFF.md](../../HANDOFF.md).

### 5.1 Urbanistica dinamica

- **Passo variabile per distretto** (`DISTRICTS[].grid.step`, `citygen.meshAt`). Il passo
  globale di una linea segue il distretto **più fitto** che attraversa, non la media: una
  maglia fitta si può diradare togliendo tratti, una larga non si può infittire a posteriori.
  Gangnam e i moli diventano larghi grazie ai superblocchi, non al passo.
- **Superblocchi** (`DISTRICTS[].grid.superblock`, `citygen.carveMesh`). Probabilità per
  cella, campionata sul distretto della cella. Oggi vengono tolti ~30 % dei tratti verticali
  e ~20 % di quelli orizzontali.
- **Disassamenti** (`DISTRICTS[].grid.jog`, `citygen.planDoglegs`). Costano poco perché
  riusano `on[]`, ma **ne nascono solo 2-4 su tutta la mappa**: servono ~230 px di varco per
  lasciare due isolati decenti ai lati della gemella, e con la maglia fitta pochi varchi ce
  la fanno. Se ne vuoi di più, l'unica leva vera è `MIN_BLOCK` in `planDoglegs`.
  Il ritaglio stretto che la gemella lascia di fianco a sé **non è uno scarto**: diventa una
  fila di negozi lunga e bassa (il marciapiede si assottiglia, `pad` in `fillUrbanBlock`), che
  è esattamente come si legge un 상가 dall'alto. Solo sotto i 64 px diventa un fazzoletto verde.
- **Vicoli passanti** (골목). Un isolato più largo di 320 px viene tagliato da una fessura di
  asfalto da 38-54 px: non è una strada del grafo, è un `yard`. Spezza il blocco unico e si
  vede benissimo dall'alto, senza toccare grafo né collisioni.
- **Lungofiume promossi ad arterie.** Le due strade che costeggiano il Han sono continue per
  definizione: autentico, e impedisce alle arterie verticali di finire cieche sull'argine.
- **`trimDeadEnds`** accorcia i tratti che finirebbero dove non passa nessuna trasversale.
  Restano ciechi solo i monconi verso il bordo mappa, dove c'è la cintura invalicabile.

### 5.2 Rilievo

- **`city.elevationAt(x, y)`** (`citygen.makeElevation`): il Han è quota zero, il terreno sale
  allontanandosene (~34), due ottave di value-noise danno il rilievo locale (±23 e ±8), il
  Namsan è una cupola da 110. Deterministico dalla seed, nessuna allocazione.
- **Hillshade** nel tile del terreno (`ground.drawRelief`) e nella texture della mappa
  (`maptexture.drawRelief`): un versante che sale verso il sole si schiarisce. Il
  campionamento è a bassa risoluzione (33×33 per tile) e ingrandito con interpolazione;
  **l'offset di mezzo passo in `drawImage` è quello che fa combaciare i tile adiacenti**,
  senza si vede uno scalino sulle giunzioni.
- **Volumi più alti in quota**: `scene.projHeight(b) = b.h3d + b.elev`, usato sia
  nell'estrusione sia in `buildingShadow` (che è cachata: se le due divergono, ombra e volume
  si staccano). `b.elev` è calcolato una volta in generazione; muri, argini e cintura hanno
  `flat: true` e restano a zero perché il loro centro non significa niente.
- **Fisica della pendenza** in `updateVehicle` (`SLOPE_G = 780`, pendenza limitata a 0.14) e,
  più leggera, su pedoni e giocatore a piedi. Misurato su una pendenza del 20 % (Namsan), a
  tutto gas dopo 1 s: **90 px/s in salita, 179 in piano, 268 in discesa**; in folle, in salita
  ci si ferma in due secondi. È anche il motivo per cui la velocità mediana del traffico è
  scesa da ~60 a ~46-58: le auto in salita vanno davvero più piano.

### 5.3 Cosa è rimasto fuori dall'urbanistica, e perché

**Piazze e rotonde** (richiedono archi curvi nel grafo) e **isolati non rettangolari**
(footprint poligonali: collisioni e facciate tutte diverse). Erano già marcati come
rimandabili nel piano precedente e non è cambiato niente che li renda più facili.
