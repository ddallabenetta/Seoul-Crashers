---
name: seoul-verifica
description: Verifica una modifica a Seoul Crashers facendola girare davvero in un browser headless — fps, salute del traffico, stato di ricercato e polizia, screenshot, errori in console. Usala ogni volta che hai toccato qualcosa sotto src/ e prima di dire che una modifica funziona, e quando serve riprodurre un comportamento (inseguimento, esplosione, incastro del traffico) senza avere uno schermo.
---

# Verificare una modifica

Il gioco non ha test unitari e non ne vuole: è un canvas che gira a 60 fps. La verifica
è **farlo partire e guardarci dentro**. Diversi bug di questo progetto (auto ferme col gas
a tavoletta, insegne invisibili, lampione stirato) erano invisibili nel sorgente e ovvi a
schermo — rileggere il codice non li avrebbe trovati mai.

## Lo strumento

`.claude/tools/probe.mjs` alza un server statico su una porta libera, apre Chromium headless,
aspetta il boot e poi esegue quello che gli chiedi dentro la pagina. **Esce con codice 1 se
la pagina ha sollevato un errore JS o loggato un `console.error`**, quindi vale anche come
check secco dopo una modifica.

```bash
# il minimo sindacale dopo aver toccato src/: parte? ci sono errori?
node .claude/tools/probe.mjs --seconds 5 --eval "game.loop.fps"

# uno sguardo
node .claude/tools/probe.mjs --seconds 6 --shot /tmp/seoul.png
node .claude/tools/probe.mjs --seconds 6 --shot /tmp/hud.png --zoom 2 --clip 420,590,440,110
```

Opzioni: `--seconds N` (secondi di gioco prima di valutare), `--eval "expr"` (ripetibile,
`game` in scope, stampa JSON), `--script file.js` (corpo di funzione async: serve a
**preparare la scena**), `--shot`, `--clip x,y,w,h`, `--zoom N`, `--size WxH`.

## Preparare una scena

Uno script iniettato può armare il giocatore, alzare le stelle, teletrasportare, aspettare.
Dentro c'è `game`, si può `await import('/src/...')` e si può attendere: il loop continua a
girare mentre aspetti.

```js
// /tmp/scena.js — cinque stelle e una granata in mezzo alla strada
const pl = game.player;
const W = await import('/src/entities/weapons.js');
const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));
for (const id of W.WEAPON_ORDER) pl.giveWeapon(id, 40);
game.wanted.add(200, game);
pl.setWeapon('grenade');
pl.fireCd = 0;
pl.aimX = pl.x + 240; pl.aimY = pl.y;
pl.angle = pl.aimAngle = 0;
pl.attack(game, W.WEAPONS.grenade);
await wait(3);
return { scoppi: game.stats.blasts, stelle: game.wanted.level, hp: Math.round(pl.hp) };
```

```bash
node .claude/tools/probe.mjs --seconds 3 --script /tmp/scena.js --shot /tmp/scena.png
```

**Tre trappole che fanno sembrare rotto quello che funziona.** Costano un'ora ciascuna:

- Le griglie (`game.pedGrid`, `game.vehicleGrid`) sono **ricostruite a ogni frame**. Se
  teletrasporti un'entità e nello stesso istante spari, la griglia ha ancora la posizione
  vecchia e il colpo "manca". Dopo un teletrasporto aspetta un frame (`await wait(0.05)`).
- **Non impostare `player.angle`**: a piedi viene riscritto ogni frame verso il cursore.
  Per mirare si muove il mouse — `game.input.mouse.x/y`, in pixel di schermo:
  `const s = game.camera.worldToScreen(wx, wy); game.input.mouse.x = s.x; ...`
- Dopo aver teletrasportato il **giocatore**, la camera ci arriva smorzata: la conversione
  mondo→schermo di un istante prima non vale più, e la mira punta altrove. Fai
  `game.camera.snapTo(pl.x, pl.y)` e aspetta un decimo di secondo prima di mirare.

## Le misure che contano

```js
// traffico (aspetta 90 s: il grumo del prewarm ci mette un minuto a sciogliersi)
const ai = game.vehicles.filter(v => v.driver === 'ai');
const sp = ai.map(v => Math.abs(v.speed)).sort((a, b) => a - b);
({ fps: game.loop.fps, n: ai.length, stop: sp.filter(s => s < 8).length,
   move: sp.filter(s => s > 25).length, med: Math.round(sp[sp.length >> 1]),
   why: ai.filter(v => Math.abs(v.speed) < 8).reduce((a, v) => (a[v.ai.why] = (a[v.ai.why]||0)+1, a), {}) })
```

Sani: `n ~49`, `move 31-35`, `stop < 15`, `med 46-58`. `why: libero` su un'auto ferma
significa **bloccata fisicamente**, ed è il sintomo da inseguire.

```js
game.city.stats            // 424/796/119/179/261/3/8 + shops 139/venues 369/garages 5
game.wanted.level          // stelle
game.police.cops.length    // ≤16 a cinque stelle; volanti ≤6, blocchi ≤3, chiodi ≤2
game.projectiles.count     // esplosivi in volo + mine + pozze di fuoco
game.indoors               // dentro un negozio: metà dei sistemi NON sta girando
```

I primi sette numeri di `city.stats` cambiano solo se hai spostato un `rng` in generazione;
gli ultimi tre nascono da un rng separato (`placeShops`) e si muovono solo se tocchi quello.

## Verificare un interno

Dentro un edificio non gira niente della città: traffico, pedoni, polizia, ricercato e
raccolte sono fermi, e `game.area()` restituisce la pianta del piano invece della città. Una
prova su un interno quindi **non** si fa aspettando che il mondo si assesti: si entra e si
guarda subito.

```js
// /tmp/interno.js — entra nel negozio più vicino, sale un piano, guarda cosa c'è
const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));
const pl = game.player;
const shop = game.city.shops.find((x) => x.biz.length >= 3);
pl.x = shop.x; pl.y = shop.y;
game.shops.enter(shop, game);
await wait(0.2);
game.shops.useStairs(1, game);
await wait(0.2);
const f = game.shops.floor;
return { locale: f.biz.id, stanza: [f.w, f.h], muri: f.walls.length,
         mobili: f.furni.length, gente: f.people.length, cassa: !!f.till,
         azioni: game.shops.actions.map((a) => `${a.key}: ${a.text}`) };
```

Cosa guardare, e cosa significa se è sbagliato:

- **`mobili` sotto 4** = pianta vuota. Quasi sempre è `put()` che scarta tutto perché il
  mobile pesta un vano scala: le piante devono usare `f.band` e `f.body`, non l'area intera.
- **`azioni` vuoto** stando sul bancone = il locale non ha `shop` nel catalogo, o sei più
  lontano di `DESK_REACH` (54 px).
- **Uno screenshot vale il doppio qui**: la camera inquadra la stanza intera (`roomZoom`),
  quindi una pianta sbagliata si vede tutta in un colpo.
- Dopo `leave()`, `game.projectiles.count` deve essere **0**: gli esplosivi non attraversano
  la porta, e una mina rimasta armata vive in coordinate che fuori cadono in un angolo della
  mappa.

I valori attesi completi stanno in HANDOFF.md §1 e §8. Confrontali sempre **prima e dopo**
la modifica: in headless gli fps assoluti sono più bassi che su una macchina vera (48-54
invece di 60), quindi vale il delta, non il numero.

## Regola

Non dire che una modifica funziona se non l'hai vista funzionare. Uno screenshot o una misura
nel messaggio finale vale più di tre paragrafi di spiegazione.
