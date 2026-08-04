---
name: seoul-citta
description: Toccare la generazione della città di Seoul Crashers — maglia stradale, isolati, edifici, arredo, quota del terreno, grafo e corsie — senza rompere il determinismo della seed né il traffico. Usala quando la richiesta riguarda urbanistica, strade, incroci, isolati, vicoli, scalinate, rilievo, mappa o "la città dovrebbe…".
---

# Toccare la generazione

La città nasce da `new Rng(20260730)` in `citygen.generateCity`. Due conseguenze che
governano tutto il lavoro qui dentro:

**1. Qualunque `rng` in più (o in meno, o spostata) ridisegna tutta Seoul a valle.** Non è
un bug ed è a volte inevitabile, ma va saputo: dopo la modifica i conteggi non torneranno,
e la messa a punto del traffico va rifatta. Se puoi ottenere lo stesso effetto **senza
consumare rng diverso** (calcolando da dati già generati, come `city.hospitals`), fallo.

```bash
node .claude/tools/probe.mjs --seconds 4 --eval "game.city.stats"
# atteso, seed attuale: buildings 418, props 1299, blocks 122, nodes 196, edges 279,
# doglegs 4, stairs 3   (+ game.pickups.items.length = 36)
# shops 113, venues 324, garages 7, turfs 6 nascono da un rng loro (`placeShops`,
# `placeGarages`, `placeTurfs`, creati DOPO la generazione): si muovono solo se
# tocchi quelle funzioni.
```

`placeShops` è l'esempio da copiare quando serve aggiungere roba alla città senza
ridisegnarla: gira in fondo a `generateCity`, si costruisce un `new Rng` suo e legge solo
dati già generati (`b.edges`, `b.h3d`, `city.hospitals`).

**2. Mai `Math.random()` in generazione.** Va bene solo negli effetti a runtime.

## Il modello mentale

La maglia **non è geometria, è un dato**: `vLines`/`hLines` sono linee con centro, larghezza,
flag arteriale e un array `on[]` — `l.on[j]` dice se quella linea esiste nella cella `j`. Da
`on[]` derivano asfalto, archi del grafo, isolati, segnaletica e strisce. Tre fenomeni
diversi sono lo stesso meccanismo: **superblocchi** (un tratto spento), **disassamenti**
(la via si spegne a metà e una gemella si accende), **fiume** (verticali spente dove passa
il Han). *Se aggiungi un fenomeno nuovo, esprimilo in `on[]`* — a valle non ci sono casi
speciali, e non devono nascerne.

Gli isolati sono **solo rettangoli**, per fusione greedy delle celle libere. È un vincolo
voluto: collisioni, tile del terreno, marciapiedi dei pedoni e parcheggi assumono tutti
rettangoli. Isolati poligonali sono un lavoro di un'altra scala.

Il terreno resta **disegnato in pianta**: il dislivello si legge da ombreggiatura per
pendenza, altezza di proiezione dei volumi (`h3d + elev`) e fisica delle salite.

## Checklist

- Cambiando qualcosa che si vede nel terreno: **invalida la cache dei tile**,
  `game.scene.ground.tiles.clear()`, altrimenti guardi il disegno vecchio e impazzisci.
- Un solido nuovo che deve fermare le auto ma non i piedi va in `city.solidGrid` con
  `vehicleOnly: true` — e chi interroga la griglia a piedi deve saltarlo: sono tre punti
  (`player.resolveCollisions`, il blocco anti-muro in `pedestrians.updatePed`, i raggi in
  `weapons.rayCast`/`hasLineOfSight`). Se nasce a runtime, va anche **tolto**
  (`SpatialGrid.removeRect`): lasciarlo dentro significa muri invisibili per il resto
  della partita.
- Dopo aver toccato la maglia, controlla i vicoli ciechi: devono restare 0-2 e **solo sul
  bordo mappa** (x o y ≈ 188).

```js
game.city.graph.usableNodes.filter(n => n.out.length === 1).map(n => [n.x|0, n.y|0])
```

- La geometria di strade e veicoli è **accoppiata**: stringere le carreggiate o allargare i
  mezzi fa collidere due auto che si incrociano, e il traffico si blocca. Boulevard 144 px
  (2 corsie per senso a 18 e 54), strada 76 px (una a 19).
- Poi misura il traffico per almeno 90 s e confronta con lo stesso scenario prima della
  modifica (vedi `/seoul-verifica`): il modo onesto è un `git worktree add /tmp/base HEAD`
  e far girare la stessa scena sui due alberi.
