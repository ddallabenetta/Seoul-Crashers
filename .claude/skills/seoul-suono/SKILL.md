---
name: seoul-suono
description: Aggiungere, correggere o bilanciare un suono di Seoul Crashers — spari, motori, sirene, pioggia, interfaccia — sapendo dove va messo il punto di chiamata e come si misura il livello senza avere una cassa. Usala quando la richiesta parla di audio, suoni, volume, sirena, motore, musica, silenzioso, o "non si sente / si sente troppo".
---

# Toccare l'audio

Tutto l'audio nasce da `src/core/audio.js`: **nessun file sonoro**, oscillatori e rumore
generato al boot. Vale lo stesso vincolo della grafica (§7 dell'HANDOFF), e il resto del
gioco parla con una riga sola: `game.audio?.qualcosa(...)`.

## Le due famiglie, e come si sceglie

| | Colpo secco | Letto continuo |
| --- | --- | --- |
| Cos'è | nasce, suona, muore (`shot`, `explosion`, `ui`) | acceso per sempre, si muove il guadagno (`beds.*`) |
| Chi lo fa partire | un **punto di chiamata** nel gioco | `audio.updateBeds`, ogni frame |
| Costo | 2-4 nodi per colpo, tetto `MAX_VOICES` (24) | fisso, ~30 nodi in tutto |
| Quando sceglierlo | un evento (uno sparo, una porta, una stella) | uno **stato** (stai guidando, piove, c'è una sirena) |

**Un suono che dura più di mezzo secondo e dipende da uno stato è un letto**, non una
sequenza di colpi: accendere un oscillatore sessanta volte al secondo costa e fa click.

## Aggiungere un suono nuovo

1. **Il metodo** in `AudioSystem`. Si compone con tre mattoni, e non serve altro:
   - `_at(x, y, vol, durata, bus)` → la destinazione, già attenuata per distanza e
     panoramizzata. **Torna `null`** se è troppo lontano, troppo piano o se il tetto delle
     voci è pieno: se è `null` non si costruisce niente. `x` a `null` = suono senza
     posizione (interfaccia, tuono, la propria morte).
   - `_tone(dest, { type, f0, f1, dur, peak, attack, sweep, t })` → oscillatore con
     inviluppo; `f1` fa scivolare la frequenza, ed è metà del carattere di un suono.
   - `_noise(dest, { dur, peak, attack, pink, rate, t })` → scoppio di rumore.
   - `_filter(dest, tipo, f0, q, { f1, sweep })` → si mette **davanti** a una sorgente:
     `this._noise(this._filter(out, 'bandpass', 1800, 3), { dur: 0.06 })`.

   `t` è un ritardo in secondi: è così che il tuono arriva dopo il lampo e la coda di
   un'esplosione non si impasta col botto.

2. **Il punto di chiamata**, con l'optional chaining: `game.audio?.nuovoSuono(x, y)`.
   Mettilo dove l'evento **succede davvero**, non dove viene deciso — e cerca l'imbuto:
   `weapons.shoot` copre tutte le bocche da fuoco del gioco (giocatore, polizia, teppisti),
   `projectiles.explode` tutte le onde d'urto, `main.onVehicleImpact` tutti gli urti.

3. **Se è uno stato**, aggiungi invece un letto in `buildBeds` e scrivigli `target` in
   `updateBeds`. Il guadagno viene smorzato da solo (`damp`) e scritto sul parametro:
   non programmare rampe a ogni frame.

## Trappole di questo file

- **Un contesto sospeso non è innocuo.** Se `ready` è falso (nessun gesto dell'utente, o
  scheda in secondo piano) l'orologio è fermo e tutto quello che si programma resta in
  coda. Per questo `ready` guarda `ctx.state === 'running'` e non "l'ho costruito".
- **L'ascoltatore è la camera, non il giocatore.** Col mirino del fucile la camera scivola
  via, e si deve sentire quello che si vede. Corollario: un suono generato *prima* di uno
  `snapTo` (una porta, un teletrasporto) risulta lontanissimo e viene scartato — chiamalo
  dopo, come fa `shops.stepOutside`.
- **Dentro un edificio funziona tutto identico**: le coordinate della pianta sono le stesse
  della camera. L'unica cosa da fare è ovattare, non spegnere (vedi `rain.hp.frequency`).
- **Il rumore rosa è più forte di quello bianco** a parità di guadagno: il buffer è già
  compensato in `makeNoise`, non rifarlo a mano nei singoli suoni.
- **Il picco di un rumore non dice quanto suona forte.** Si bilancia sul valore efficace
  (rms), vedi sotto.

## Misurare invece di stimare

Nessuno di noi ha una cassa in headless. Il livello si misura con un analizzatore attaccato
al master — c'è già una scena pronta:

```bash
node .claude/tools/probe.mjs --seconds 2 --quiet \
  --script .claude/tools/scenes/audio-census.scene
```

Restituisce il **picco di ogni colpo** e **rms + picco di ogni scenario** (ambiente,
temporale, motore, caccia), le voci vive e il costo in ms del passo audio.

Valori sani (Chromium headless in container, mix di fabbrica):

| | rms | picco |
| --- | --- | --- |
| ambiente urbano | ~0.015 | ~0.06 |
| temporale | ~0.045 | ~0.3 |
| al volante | ~0.045 | ~0.15 |
| caccia a 5 stelle | ~0.068 | ~0.5 |
| colpo singolo | — | 0.30 (SMG) → 0.60 (fucile di precisione) |
| esplosione | — | 0.60-0.75 |

La caccia comprende la **musica** (§5.19): senza era ~0.055. Se tocchi il pezzo
dell'inseguimento, il censimento da guardare è l'altro (vedi sotto).

**Il rapporto che conta è ambiente contro colpo.** Alla prima passata l'ambiente aveva lo
stesso rms di un colpo di pistola: nel sorgente non si vedeva, nel censimento sì.

Per ascoltare a orecchio serve un browser vero: `python3 -m http.server 8123` e un clic
sulla pagina (l'audio parte al primo gesto). `F4` è il muto, il pannello **Audio** del menu
di pausa ha i quattro volumi.

## La musica è una terza famiglia

`src/core/music.js`. Non è un colpo secco e non è un letto: è uno **scheduler in anticipo**
che ogni frame programma sull'orologio del contesto le note dei prossimi 0,25 s. Se la
richiesta riguarda la musica, quasi sempre si tocca **una funzione sola**:

| Vuoi… | Tocchi |
| --- | --- |
| far partire un pezzo in un momento nuovo (una missione, un locale) | `music.direct` — è l'unico punto che sa qualcosa del gioco |
| cambiare come suona un pezzo | `stepMenu` / `stepChase`: `i` è il passo (una croma), `t` è **quando** suonerà |
| aggiungere un pezzo | una voce in `BPM`, una in `LEVEL`, una progressione in `PROG`, un `stepX` e una riga in `step()` |
| uno stacco (vittoria, sconfitta, stacco di scena) | `music.sting`, e mandalo su `this.stings` — il bus del pezzo può essere a zero |

Regole che non si negoziano, perché sono la ragione per cui la musica non dà fastidio:

- **In strada non suona niente**, e la **radio vince sempre** (§5.19). Prima di aggiungere un
  pezzo che suona spesso, chiediti cosa copre: Seoul ha già un fondo suo.
- **Non suonare a `dt`**: un frame lungo diventa una nota in ritardo. Si programma su
  `ctx.currentTime + …`, sempre.
- **Il cambio di pezzo passa dal silenzio** (dissolvenza ~1,9 s): non si taglia a metà battuta.
- **Ogni nodo si stacca da solo** (`onended`): venti gain al secondo lasciati attaccati fanno
  crescere il grafo per tutta la partita.

```bash
node .claude/tools/probe.mjs --menu --seconds 1 --quiet \
  --script .claude/tools/scenes/music-census.scene
```

Dà rms e picco del tema e della caccia ai due gradini di stelle, **e verifica la regia**: che
il pezzo taccia in strada e con la radio accesa. Riferimenti: tema ~0.045, caccia 3 stelle
~0.034, in strada ~0.015 (che è il fondo urbano, cioè musica zero). Serve `--menu`, o il
tema non parte.

## La radio è un'altra cosa

`src/core/radio.js` **non passa dal grafo di `audio.js`** ed è l'unica parte del gioco che
parla con la rete. Se la richiesta riguarda stazioni, streaming o il volume della radio, le
regole sono queste:

- **Un `<audio>`, non un nodo WebAudio.** Un `MediaElementAudioSourceNode` con una sorgente
  di un'altra origine senza CORS diventa *muto*, ed è la norma per gli Icecast delle
  emittenti. Il volume si fa con `el.volume` = `mix.master × mix.radio × contesto`.
- **`<audio>` non legge HLS né playlist**: `.m3u8`, `.pls`, `.m3u` vanno filtrati (`usable`),
  o sembrano stazioni rotte. È il motivo per cui KBS/MBC/SBS non ci sono.
- **Le stazioni si scoprono, non si scrivono**: radio-browser.info, nessuna chiave, tre
  mirror. Una lista hardcoded marcisce. Per fissarne una: `localStorage` →
  `seoul.radio.stations` = `[{name, url}]`.
- **Niente può dipendere dalla rete.** Nessuna richiesta prima che il giocatore prema `R`,
  nessuno stream aperto se nessuno lo sente, stazione muta marchiata e saltata dopo 11 s.
- **Provala senza rete** iniettando una stazione finta invece di cercarne una vera:

```js
// un WAV generato al volo dentro un blob: suona come una stazione, senza uscire dal browser
game.radio.stations = [{ name: 'Prova FM', url: URL.createObjectURL(new Blob([wav], { type: 'audio/wav' })) }];
game.radio.discovered = true;
```

⚠️ Con la radio accesa e la rete chiusa **`probe.mjs` esce 1**: sono i `net::ERR_...` che
logga il browser, non errori del gioco (HANDOFF §5.14).

## Un'arma nuova

`GUN_TONE` in `audio.js` è una riga per arma: `f` (centro dello schiocco), `dec` (quanto
dura), `body` (il tonfo basso sotto), `tail` (la coda fra i palazzi), `gain`. **Non è
obbligatoria**: senza riga, `gunTone(spec)` ricava i cinque numeri da danno e cadenza e
l'arma suona subito come qualcosa. Aggiungila quando vuoi che quell'arma abbia un carattere
suo — ed è l'ottavo punto della lista di `/seoul-arma`.
