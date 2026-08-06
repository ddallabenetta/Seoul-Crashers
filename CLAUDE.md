# Seoul Crashers — istruzioni permanenti

Web game d'azione top-down 2.5D ambientato a Seoul, stile *GTA: Chinatown Wars*.
Canvas 2D puro, moduli ES nativi, zero dipendenze: tutta la grafica e tutto l'audio sono
generati da codice a runtime.

## Come usare la documentazione

Questo file è l'unico che si carica da solo. `HANDOFF.md` è l'indice (~130 righe): leggi
quello in apertura di sessione, poi apri da `docs/` **solo** il documento che serve al lavoro
richiesto. **Non caricare tutto `docs/`**: sono ~2400 righe in totale, ed è esattamente il
problema che questa struttura risolve. Lo storico in `docs/storico/` si legge solo quando
serve capire *perché* una parte esistente è fatta così.

I rimandi interni della forma `§5.10`, `§4`, `§9` sono ancora validi: la tabella in
`HANDOFF.md` dice quale file contiene quale sezione.

## Vincoli e convenzioni

- **Nessuna dipendenza, nessun build step.** Niente npm, niente bundler, niente CDN.
- **Nessun asset esterno**: se serve grafica nuova, si genera con path su canvas offscreen e
  si mette in cache (vedi `sprites.js`).
- **Commenti in italiano**, e solo dove spiegano un *perché* non ovvio. Il codice esistente ha
  una densità di commenti bassa e mirata: mantienila.
- **Italiano per UI e testi di gioco, hangul per insegne e toponimi.**
- **Determinismo**: la città nasce da `new Rng(20260730)`. Non usare `Math.random()` in
  generazione (va bene solo negli effetti a runtime). Attenzione: **qualunque `rng` in più
  consumato in generazione ridisegna tutta la città a valle**, quindi non spaventarti se una
  modifica minima cambia il conteggio di edifici — confronta gli ordini di grandezza, non i
  numeri esatti.
- **Verifica davvero.** Ogni modifica va provata nel browser, non solo "compilata": screenshot
  per la grafica, snippet di `docs/verifica.md` per il traffico. Diversi bug di queste fasi
  erano invisibili nel codice e ovvi a schermo. Chi non ha uno schermo usa `.claude/tools/`
  (`docs/strumenti.md`), che fa le stesse due cose senza mani: far girare il gioco e guardare
  gli sprite ingranditi.
- **Consegne a tappe**: l'utente vuole provare ogni fase prima della successiva, ed essere
  consultato sulle scelte di design invece di trovarsele fatte.

## Avvio

```bash
python3 -m http.server 8123 --directory .     # dalla radice del repo
```

Poi <http://localhost:8123>. Serve un server: i moduli ES non funzionano da `file://`.
In Claude Code esiste già `.claude/launch.json` (config `seoul-crashers`) per `preview_start`.

**Se non hai uno schermo** (agente, sessione remota, CI) il gioco si fa partire e interrogare
headless — è il modo normale di verificare, vedi `docs/strumenti.md`:

```bash
node .claude/tools/probe.mjs --seconds 5 --eval "game.city.stats" --shot /tmp/seoul.png
```

**Se una modifica sembra non fare niente, è la cache del browser** sui moduli ES: rimedio in
`docs/verifica.md`.
