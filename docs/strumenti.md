# Strumenti per chi sviluppa

> §9 del progetto. Indice generale e mappa dei rimandi: [HANDOFF.md](../HANDOFF.md).

## 9. Strumenti per chi sviluppa (`.claude/`)

Il gioco resta senza dipendenze e senza build step: **niente di quello che c'è qui dentro
viene caricato dalla pagina**. Sono strumenti per chi lavora al progetto — pensati per un
agente che non ha uno schermo, ma comodi anche a mano. Usano `python3` (il server statico) e
il `playwright` già installato globalmente nell'ambiente.

### `tools/probe.mjs` — far girare il gioco e guardarci dentro

Alza un server su una porta libera, apre Chromium headless, aspetta il boot ed esegue quello
che gli chiedi nella pagina. **Esce con codice 1 se la pagina ha sollevato un errore JS o
loggato un `console.error`**, quindi vale come check secco dopo una modifica.

```bash
node .claude/tools/probe.mjs --seconds 5 --eval "game.city.stats"
node .claude/tools/probe.mjs --seconds 6 --shot /tmp/s.png --zoom 2 --clip 420,590,440,110
node .claude/tools/probe.mjs --seconds 3 --script /tmp/scena.js --shot /tmp/scena.png
```

`--script` inietta un file come corpo di funzione **async**: è così che si prepara una scena
(armi addosso, cinque stelle, un lancio) e si aspetta il risultato — il loop continua a
girare mentre lo script attende. Dentro c'è `game`, e si può `await import('/src/...')`.

La pagina viene aperta con **`?autostart=1`**, che salta il menu iniziale (§5.18): una scena
deve trovare il gioco in strada, con il giocatore che risponde ai comandi. Con **`--menu`** si
resta sul titolo — è l'unico modo di fotografarlo e di misurare il tema (`music-census`).

Chromium parte con `--autoplay-policy=no-user-gesture-required` e `--mute-audio`: l'audio è
**misurabile anche headless** (basta `game.audio.unlock()` in testa alla scena) ma non viene
mandato a una scheda audio, che in un container non c'è.

⚠️ **Una scena che accende la radio fa uscire `probe.mjs` con codice 1** se la rete è chiusa:
il browser logga da sé un `net::ERR_...` per ogni richiesta bloccata e il probe conta i
`console.error`. Non è un errore JS e non è un difetto del gioco (§5.14). Per provare la
radio senza rete si inietta una stazione finta — un WAV generato al volo dentro un `blob:` —
in `game.radio.stations`, che è esattamente come è stata verificata.

Le trappole delle prove scriptate (mira dal cursore, camera smorzata, griglie ricostruite ogni
frame, il giocatore fermo che muore) sono in §4, in fondo: leggerle prima di dare la colpa al
codice.

### `tools/scenes/` — scene pronte

Una scena è il **corpo di una funzione async**, non un modulo: dentro c'è `game`, si può fare
`await import('/src/…')` e si termina con `return` di quello che si vuole leggere. Per questo
l'estensione è `.scene` e non `.js` — l'hook su Write/Edit passa `node --check` su ogni `.js`,
e un `return` a livello di file lo farebbe fallire.

| Scena | Cosa misura |
| --- | --- |
| `traffic-census.scene` | urti al minuto e loro tipo, flusso in px/min per veicolo, su cinque zone. È la misura con cui è stato tarato §5.10 — e l'unica onesta per giudicare una modifica alla guida AI **o al ciclo del semaforo** (`roadgraph.SIGNAL_CYCLE`, che dalla §5.12 è una manopola sola: il giallo è fisso e il verde si prende quello che avanza) |
| `daylight-sweep.scene` | la luce ora per ora su tutto il giro, più quattro campioni col temporale. Serve a vedere in una tabella quello che altrimenti vuole ventiquattro screenshot: tinta, velo caldo, lampioni, ombre, popolamento |
| `audio-census.scene` | **livelli veri dell'audio**: un analizzatore sul master dà rms e picco di ogni scenario (ambiente, temporale, motore, caccia) e il picco di ogni arma, più voci vive e costo in ms. È l'unico modo di bilanciare senza una cassa, ed è quello che ha trovato l'ambiente tarato tre volte troppo alto (§5.13) |
| `music-census.scene` | **livello e regia della musica** (§5.19): rms e picco del tema e della caccia ai due gradini di stelle, e la verifica che il pezzo *taccia* dove deve — in strada da puliti e con la radio accesa. Va lanciata con `--menu`, o il tema non suona |
| `walkers-census.scene` | **i pedoni contro le lamiere ferme** (§5.21): quanti passanti finiscono *dentro* una carrozzeria, quanti restano piantati, e quanta strada fanno, su quattro zone. Una delle sue cifre non si interpreta — `dentroLamiera` è un invariante e **deve essere 0** |
| `life-census.scene` | **la vita degli NPC** (§5.26): le cinque cose di `life.js` una dopo l'altra, ognuna nel posto in cui può succedere davvero — decolli e atterraggi, navigazione, braccianti che rincasano, capannelli, una rapina e una guerra fra bande. Tre cifre sono invarianti: un velivolo pilotato deve staccare da terra, una rapina deve arrivare almeno a `escape`, una guerra senza caduti non è una guerra |
| `impianto-campagna.scene` | **l'impianto del §5.27**, e non misura: *asserisce*. Round-trip del salvataggio, migrazione di uno slot v1, rifiuto di uno slot dal futuro, un attore che resta al suo posto e non risorge, una porta sigillata, un blip che si sposta invece di accumularsi. Si lancia filtrando i `false`, e `[]` vuol dire tutto a posto |
| `cast-sheet.scene` | **il cast dei pannelli ingrandito** (§5.28): ogni personaggio con le sue quattro espressioni e le sue sei pose, più folla e cane. È il `sprite.mjs` dei volti, e serve *prima* di disegnare un pannello: una griglia 24×24 nel sorgente non dice niente su come si legge a schermo. Ha trovato metà cast invisibile e Chun-sik che ringhiava invece di ridere |
| `cutscene-sheet.scene` | **i ventotto pannelli dell'apertura in una griglia sola.** Uno scatto, e si vede quale tavola è una macchia e quale ha il testo sopra la faccia. Vale per ogni atto che verrà: si lancia con `--menu` |
| `cutscene-panel.scene` | **un pannello solo, fermo, a grandezza vera.** Il numero è quello del copione (1-28) e si passa con uno script di una riga davanti: `echo 'window.__PANEL = 11;' > /tmp/p.js` |
| `cutscene-run.scene` | **l'apertura fatta girare davvero**, dal menu al gioco, e *asserisce*: modalità, mondo fermo, tema dell'apertura che suona, avanzamento, `ESC` che salta, e il passaggio di consegne (08:24, asfalto bagnato, l'auto lì davanti). Va lanciata con `--menu`, o la cutscene non parte da dove parte davvero |
| `reverb-census.scene` | **le code del riverbero** (§5.21): quanto dura e quanto pesa la coda dello stesso sparo in ognuno dei quattro spazi. Ferma il mondo col menu di pausa e azzera i letti, o quello che misura è la città |

⚠️ **Una misura alla volta.** La scena cambia zona a tempo di *orologio*, non di simulazione:
due censimenti che girano insieme sulla stessa macchina si rubano la CPU e i teletrasporti
cadono in istanti diversi. Ancora peggio se condividono l'albero, perché ognuno riscrive il
parametro che l'altro sta misurando — è un modo silenzioso di produrre numeri che sembrano buoni
e non vogliono dire niente. Un albero per configurazione (`git worktree add`), e in fila.

Per forzare ora e meteo in una scena qualunque: `game.dayCycle.hour = 21.5`,
`game.dayCycle.setWeather('storm')`, `game.dayCycle.paused = true`. Per misurare qualcosa che
dipende dal traffico **a tempo fermo**, incolla le prime due righe davanti a
`traffic-census.scene` — è così che è stato misurato il traffico sotto la pioggia in §5.11.

### `tools/sprite.mjs` — guardare uno sprite ingrandito

```bash
node .claude/tools/sprite.mjs --expr "getHeroSprite(2,'aim')" --scale 8 --out /tmp/hero.png
node .claude/tools/sprite.mjs --expr "WEAPON_IDS.map(getWeaponIcon)" --scale 6 --cols 4
```

Nell'espressione sono in scope tutti gli export di `sprites.js` più `WEAPON_IDS`. Fondo a
scacchi per vedere dove finisce la sagoma, `--bg` per provarla sul colore su cui vivrà
davvero. È la procedura con cui il protagonista è stato rifatto tre volte, automatizzata.

### Hook (`.claude/settings.json` + `hooks/`)

- **PostToolUse su Write/Edit** → `check-js.mjs`: `node --check` sul file toccato (un errore
  di sintassi qui si presenta come "schermata di caricamento ferma", che è il sintomo più
  costoso da diagnosticare), e un promemoria automatico quando si tocca la generazione della
  città (determinismo dell'rng, cache dei tile, `Math.random()` fuori posto).
- **SessionStart** → `session-brief.mjs`: quattro righe di briefing (leggi HANDOFF, i vincoli,
  come si verifica) e un controllo che `python3` e `playwright` ci siano davvero.

### Skill

Cinque, invocabili anche a mano con `/nome`:

| Skill | Quando |
| --- | --- |
| `/seoul-verifica` | dopo aver toccato `src/`, e prima di dire che qualcosa funziona |
| `/seoul-arma` | aggiungere o bilanciare un'arma: i sette punti che devono combaciare |
| `/seoul-sprite` | disegnare o correggere uno sprite generato |
| `/seoul-citta` | toccare la generazione senza rompere il determinismo o il traffico |
| `/seoul-suono` | aggiungere o bilanciare un suono: colpo secco o letto continuo, e come si misura |
