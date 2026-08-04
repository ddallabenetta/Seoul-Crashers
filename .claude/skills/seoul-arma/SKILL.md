---
name: seoul-arma
description: Aggiungere o bilanciare un'arma di Seoul Crashers (mischia, bocca da fuoco, esplosivo) toccando tutti i punti che servono — tabella WEAPONS, barra armi, raccolta a terra, sprite, arma in mano, HUD, polizia. Usala quando la richiesta parla di armi, munizioni, danno, cadenza, gittata, esplosivi, mine, molotov o bilanciamento del combattimento.
---

# Aggiungere un'arma

Un'arma non è una riga in una tabella: è **sette punti** che devono combaciare. Saltarne uno
dà i sintomi classici — l'arma non compare mai a terra, il personaggio la impugna invisibile,
il tasto non la seleziona, la barra mostra una casella vuota.

## La lista

1. **`src/entities/weapons.js` → `WEAPONS`.** Una riga. Campi che contano:
   - comuni: `id label hangul slot` (`slot` = fila della barra, tasto 1-6);
   - mischia: `melee: true damage rate range arc knock infinite`;
   - fuoco: `damage rate range spread pellets shake maxAmmo pickup` più i facoltativi
     `auto` (tenendo premuto), `pierce` (trapassa N bersagli), `scope` (mirino col tasto
     destro, allarga il campo di N), `spinUp` (secondi di rotazione prima del primo colpo),
     `heavy` (moltiplicatore di velocità a piedi), `driveby: false` (vietata dal finestrino);
   - esplosivi: `thrown: true`, `fuse` (0 = esplode al primo contatto), `placed: true`
     (si posa invece di volare), e `blast: {r, dmg}` **oppure** `fire: {r, life, dps}`.
2. **`WEAPON_SLOTS`** nello stesso file: metti l'id nella fila giusta. `WEAPON_ORDER` si
   ricava da lì (ordine della rotella), non va toccato.
3. **`src/entities/pickups.js`**: una voce in `PICKUP_KINDS` (con `ammo:` per la scorta che
   dà la raccolta) e una o più occorrenze in `TABLE`. `TABLE` è estratta con **un solo**
   `rng.pick`, quindi allungarla cambia *quali* armi escono ma non sposta nient'altro nel
   mondo generato.
4. **`src/render/sprites.js` → `drawGun`**: la sagoma. La usano tre cose — la cassa a terra,
   l'icona della barra armi (`getWeaponIcon`, che la schiarisce da sola) e, per gli
   esplosivi, `getThrownSprite` (l'oggetto in volo, che è un altro disegno).
5. **`src/render/scene.js` → `drawHeldWeapon`**: l'arma in pugno, nello spazio locale del
   personaggio, +x davanti. Da sopra si legge solo la **lunghezza**: pistola corta, fucile
   lungo, minigun larga.
6. **HUD** (`src/ui/hud.js`): la barra armi si popola da sola, ma controlla il mirino —
   `drawCrosshair` scala il raggio sulla dispersione e disegna il cerchio dello scoppio per
   gli esplosivi.
7. **Polizia** (`src/entities/police.js`), solo se l'arma va anche a loro: `TIERS[].weapon`,
   `spawnCar` e `spawnFootCop`. Ricorda che la cadenza degli agenti è
   `spec.rate * (auto ? 6 : 2.6)`: un'arma automatica in mano a un poliziotto non spara
   come in mano al giocatore.

Le armi da lancio passano da `src/entities/projectiles.js` senza modifiche: `throwItem` per
quelle che volano, `place` per quelle che si posano, `explode` per l'onda d'urto (che è già
condivisa con l'esplosione dei veicoli, quindi le catene vengono gratis).

## Bilanciamento

Ragiona in **danno al secondo** e in quanti colpi servono, non in numeri assoluti:
un pedone ha 28-38 hp, un teppista 62, un poliziotto 75, la SWAT 135, il giocatore 100,
una berlina 115, un furgone SWAT 260, l'elicottero 260. La lamiera assorbe: sui veicoli
il colpo vale `damage * 0.55`.

Misura invece di stimare — la scena si prepara con `--script` (vedi `/seoul-verifica`):

```js
// quanti secondi per stendere una SWAT con l'arma X
const p = game.peds.find(q => q.kind === 'swat');
```

E per una modifica alla polizia, la misura buona è **quanto sopravvive un giocatore fermo a
cinque stelle**: 10.3 s con la SMG, 8.2 s da quando la SWAT ha il fucile d'assalto.

## Prima di dire che è fatta

```bash
node .claude/tools/sprite.mjs --expr "WEAPON_IDS.map(getWeaponIcon)" --scale 6 --out /tmp/icone.png
node .claude/tools/probe.mjs --seconds 3 --script /tmp/prova-arma.js --shot /tmp/arma.png
```

Guarda le due immagini. Un'icona che non si distingue dalle altre a 30 px è un'arma che il
giocatore non troverà mai nella barra.
