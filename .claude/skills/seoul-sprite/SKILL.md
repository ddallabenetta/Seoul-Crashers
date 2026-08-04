---
name: seoul-sprite
description: Disegnare o correggere uno sprite generato da codice in Seoul Crashers (personaggi, veicoli, arredo urbano, icone, effetti) guardandolo ingrandito invece che a occhio nel sorgente. Usala quando la richiesta riguarda l'aspetto di qualcosa a schermo — sagome, colori, leggibilità, "non si capisce cosa sia", "sembra una macchia".
---

# Lavorare sugli sprite

In questo progetto **non esistono asset**: ogni pixel nasce da path su canvas offscreen in
`src/render/sprites.js`, disegnati a 2× (`SS`) e messi in cache per chiave. Regola pratica:
a schermo un personaggio è alto venti pixel, quindi non conta il dettaglio, conta la
**silhouette** — e la silhouette si giudica solo ingrandendola.

```bash
node .claude/tools/sprite.mjs --expr "getHeroSprite(2,'aim')" --scale 8 --out /tmp/hero.png
node .claude/tools/sprite.mjs --expr "[0,1,2,3].map(f => getHeroSprite(f,'walk'))" --scale 6 --cols 4 --out /tmp/walk.png
node .claude/tools/sprite.mjs --expr "WEAPON_IDS.map(getWeaponIcon)" --scale 6 --out /tmp/icone.png
node .claude/tools/sprite.mjs --expr "getPedSprite('swat',0,2)" --scale 10 --bg '#2a2f36'
```

Nell'espressione sono in scope tutti gli export di `sprites.js` più `WEAPON_IDS`. Lo sfondo
va scelto **come quello su cui l'oggetto vivrà davvero**: una sagoma nera è leggibile su
asfalto chiaro e sparisce su asfalto scuro, ed è così che il protagonista è finito per
sembrare un casco generico.

Poi guardala anche in scena, che è dove conta:

```bash
node .claude/tools/probe.mjs --seconds 5 --shot /tmp/scena.png --zoom 2 --clip 500,250,320,220
```

## Quello che questo progetto ha già imparato

- **Convenzione**: ogni sprite guarda verso +x (angolo 0 = est).
- **La cache è per chiave**: se cambi il disegno ma non la chiave, in una pagina già aperta
  vedi il vecchio. Ricaricare basta; dentro `sprite.mjs` è sempre nuovo.
- **Non stirare gli oggetti alti.** Un lampione scalato lungo il vettore di proiezione
  diventa un bastone: il palo va disegnato a mano in `scene.drawProp`, e lo sprite resta
  solo la lampada.
- **Le dimensioni delle insegne si calcolano in pixel di mondo** e poi si riportano in
  spazio texture: la mappatura della facciata è anisotropa e deformerebbe tutto.
- **Tre segni bastano a riconoscere un personaggio dall'alto**: spalle più larghe degli
  altri, una banda di colore che punta in avanti (fa anche da freccia), un accento chiaro
  sulla testa che la stacchi dal corpo scuro.
- **Le icone dell'HUD vanno schiarite**: le armi sono disegnate quasi nere e su un pannello
  scuro spariscono. `getWeaponIcon` lo fa con `source-atop`, che tinge solo i pixel già
  disegnati e conserva la sagoma.
- Se aggiungi uno sprite che comparirà spesso, mettilo in `preloadSprites()`: il primo
  incontro non deve costare uno scatto.
