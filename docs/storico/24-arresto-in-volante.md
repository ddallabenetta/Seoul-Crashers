# L'arresto in volante

> §5.35 del progetto. Indice generale e mappa dei rimandi: [HANDOFF.md](../../HANDOFF.md).

### 5.35 — Tappa T3 del rework: ti caricano in volante

Prima la barra del fermo arrivava in fondo e `updateArrest` chiamava `game.bustPlayer()`: manette,
nero, commissariato (§5.16). Adesso quei sei-otto secondi si **vedono**: l'agente ti ammanetta, ti
porta a una volante, ti carica, e la volante parte nel traffico con la sirena accesa. Decisioni
prese con l'utente: **in-world** (il mondo e il traffico non si fermano, non c'è stacco nero se non
alla fine), `ESC` salta, e si chiude **sempre** in `bustPlayer()`, che resta il punto unico di chiusura
(cauzione, commissariato, `wanted.reset`, evento `busted`, autosave).

## Come funziona

Un modulo solo, `entities/arrest.js` (`game.arrest`, classe `ArrestSequence`), più tre ganci in
`police.js`. Le fasi. Misurato su otto arresti di fila: **5,4 s con una volante già lì** (2-3 stelle, equipaggio sbarcato),
**8-11 s con una che arriva da fuori campo** — la parte lunga è `wait`, perché la volante nasce a 520+ px
(`trySpawnCar` la vuole fuori inquadratura) e ci mette 2,5-4 s:

| fase | cosa succede | durata |
| --- | --- | --- |
| `cuff` | il giocatore perde il controllo, posa **ammanettato** (`getHeroSprite(f,'cuffed')`), suono delle manette (`audio.handcuffs`), zoom a 1,8. L'agente si mette a fianco. Intanto la volante è già partita | 0,8 s |
| `wait` | si aspetta che la volante arrivi e si fermi (`escort.state === 'hold'`) | 0-4 s |
| `walk` | l'agente va alla portiera davanti, il giocatore lo segue e va a quella dietro, dallo stesso lato in cui si trova | ~1-2 s |
| `board` | portiera, il giocatore sparisce, sale l'agente (`police.boardCop`) | 0,95 s |
| `drive` | la volante parte lungo la strada su cui è; la camera la segue e stringe a 2,0 (`holdZoom`) | 2,0 s |
| `fade` | dissolvenza a nero e `bustPlayer()`; al commissariato rientra in 0,9 s | 0,7 s |

- **La volante.** Si usa la più vicina già lì (`police.cars`, entro 380 px e in linea di vista).
  Altrimenti `police.trySpawnCar` ne fa nascere una **appena fuori campo** (520-780 px) col muso dalla
  parte giusta e con un A* che arrivi al ciglio senza giri. Va a **~70 px dal punto più vicino
  della strada** e frena prima: una volante che frena sulla testa di chi deve caricare non è una scena.
- **Non è un'entrata in veicolo.** `player.enterVehicle` conta come furto ed emette `onEnterVehicle`:
  qui il giocatore resta `onFoot` con `vehicle === null` (radio e tachimetro non si accendono) e
  non si disegna (`arrest.hidden`). **Dentro la volante le sue coordinate seguono quelle dell'auto**:
  è così che la camera la insegue senza un ramo in `cameraTarget`.
- **Modalità `arrest`** in `core/modes.js`: `worldRuns` sì, `playerRuns` no, sotto `menu` (aprire la
  pausa ferma anche la scena). In `main.update` non c'è un ramo nuovo: `const live = this.mode.playerRuns`
  e con `live` falso non girano `player.update`, missioni/pedinamento/trasporto, cortili, negozi e metro,
  e `wanted.update` si congela. L'unica riga in più è `ESC` → `arrest.skip(this)`.
- **La polizia.** `copBehavior` in modalità arresto non spara a nessuno e dà all'agente che
  accompagna il suo ordine (`arrest.copOrder`); `driveCar` tiene ferme le altre volanti e guida
  quella dell'arresto con `police.driveEscort` (tre stati: `approach`, `hold`, `leave`).
- **L'agente.** È quello più vicino al giocatore quando la barra si chiude (`updateArrest`). Arriva alla
  portiera con `p.escort`, un flag che spegne `deflectAroundCars`: contro quella lamiera ci deve
  andare. Il giocatore invece le scansa tutte tranne la sua.

**Il suono delle manette** (`audio.handcuffs`): tre scatti di cricchetto sempre più fitti e il clack
del dente che aggancia, tutti corti e acuti, senza coda. Misurato con l'analizzatore di
`audio-census`: picco **0,27** contro un fondo di 0,05 (una portiera, `doorClose`, fa 0,22; un
colpo di pistola 0,30-0,60). La portiera della volante riusa `doorClose`.

## Fallback e uscite anomale

Tutto finisce in `bustPlayer()`, tranne un caso:

- **Nessuna volante raggiungibile** (nessuna strada entro 300 px, nessun punto di nascita buono,
  non arriva in 5 s, o l'accompagnamento a piedi dura più di 4 s): niente teletrasporti, si resta in
  manette e si va alla dissolvenza (`mode: 'short'`, o salto a `fade`).
- **Agente morto prima di salire, volante distrutta o tolta dalla lista, timeout di 12 s**: `finish`.
- **`ESC` in qualunque fase**: `skip` → `finish` → `bustPlayer`.
- **Il giocatore muore ammanettato** (lo ha colpito qualcun altro): `abort`, comanda la morte. È
  l'unico caso in cui la scena non chiude con un arresto.
- **Autosave**: `canAutosave` è falso con `game.arrest.active`; l'unico salvataggio è quello di
  `bustPlayer`, a sequenza chiusa.

## Il bug che stava lì sotto

`arresting`/`bustT` si aggiornano solo in `police.update`, che **non gira negli interni**: entrare in
un negozio con la barra a metà la lasciava congelata (e con lei, al ritorno in strada, il fermo che
riprendeva da dov'era). Riprodotto con `probe.mjs` (barra a 0,5 dentro il negozio, `bustProgress`
0,36) e corretto in `police.siege`, che azzera `arresting` e `bustT`: entrare in un negozio è una
fuga a tutti gli effetti.

## Come si verifica

```bash
node .claude/tools/probe.mjs --seconds 1 --quiet --shot-dir /tmp/arresto \
  --script .claude/tools/scenes/arresto.scene \
  --eval "Object.entries(window.__OUT).filter(([k,v]) => v===false).map(([k])=>k)"
```

`arresto.scene` asserisce e **scatta uno screenshot a ogni cambio di fase** (`--shot-dir` è nuovo in
`probe.mjs`: la scena chiama `await window.__shot('nome')`). Invarianti: `finisceInBust`, `escSalta`,
`nessunAutosaveDurante`, `barraSiAzzeraNelNegozio`. Il rumore fra run è reale — una volante su
quattro resta bloccata (una coda, un incrocio) e la scena cade nel fallback —, quindi **un
`attraversaLeFasi: false` va rilanciato prima di indagare**, e `comeFinisce` dice perché è finita
(`dissolvenza`, `esc`, `timeout`, `agenteMorto`, `volanteDistrutta`, `volanteSparita`). La scena riprova da
sola se l'agente muore nel primo mezzo secondo (un passante armato, un'auto).

## Cose da sapere

- La sequenza si guarda a schermo, non si deduce: gli sprite del giocatore sono ~40 px e a zoom 1
  due persone e una volante sono macchie. Per questo lo zoom a 1,45 durante la scena.
- Il giocatore **non è fermo per davvero**: `player.update` non gira, ma `arrest.update` ne scrive
  posizione, velocità e angolo. Chi legge `player.vx/vy` (la camera, il passo) li trova coerenti.
- Una volante già lì (sbarcata, magari ferma di traverso) parte con `copAi.edge = null`: `followRoads`
  la riaggancia alla corsia più compatibile col muso invece di guidare da un arco che non è più suo.
- `ArrestSequence.fade` decade anche a sequenza finita: è il rientro dal nero. Una modifica che
  azzera `game.arrest` senza `reset()` lascia lo schermo nero per 0,9 s.
