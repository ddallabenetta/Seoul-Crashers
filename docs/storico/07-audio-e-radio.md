# Audio procedurale e radio

> §5.13–5.14 del progetto. Indice generale e mappa dei rimandi: [HANDOFF.md](../../HANDOFF.md).

### 5.13 Seoul fa rumore — audio procedurale

Era la prima voce del §6 da quattro fasi: *«`game.audio` è ancora `null` e i quattro punti di
chiamata esistenti girano a vuoto»*. Adesso c'è `src/core/audio.js` (~1100 righe) e i punti
di chiamata sono sessantuno, sparsi in dodici file. **Nessun asset**: come la grafica nasce da
path su canvas, il suono nasce da oscillatori, filtri e due buffer di rumore generati al boot.

**Perché sintetizzare invece di registrare** non è solo il vincolo del §7. Un suono
sintetizzato è *parametrico*, e in un gioco dove tutto il resto lo è già questo si paga da
solo: il timbro di un'arma sono cinque numeri nella stessa tabella in cui c'è il danno; il
motore cambia giro con la marcia e cilindrata con la massa del mezzo (un autobus non gira come
una sportiva, e non è un secondo file); la sirena scivola di tono quando la volante ti supera,
perché il Doppler è una moltiplicazione; la pioggia dentro un negozio è **la stessa** pioggia
con il filtro spostato, cioè è il muro che si sente, non un campione «pioggia ovattata».

**Due famiglie.** È la distinzione che regge tutto il file, e sta anche in §3:

- **colpi secchi** — `shot`, `explosion`, `impact`, `melee`, `scream`, `ui`… Costruiscono due
  o tre nodi, li programmano sull'orologio del contesto, finiscono in `_live` e `update` li
  stacca quando hanno smesso. Tetto di **24 voci** insieme: una raffica di minigun dentro un
  incendio con la folla che urla ne chiederebbe centinaia.
- **letti continui** — `city rain wind sea engine traffic siren rotor fire skid spin`. Accesi
  una volta e mai spenti: ogni frame si scrive il guadagno (smorzato in JS, non con rampe
  programmate, che riempirebbero la coda di automazione senza suonare meglio).

**Un solo ascoltatore, ed è la camera.** Distanza → volume, scarto orizzontale → panning,
oltre 1500 px il suono non viene proprio costruito. Vale identico dentro un edificio: le
coordinate della pianta sono quelle della camera, e non c'è un solo caso speciale per gli
interni in tutto il file (§3).

**Un letto per famiglia, non per entità.** Il traffico attorno è **un** letto che somma la
velocità dei veicoli vicini, non quaranta motori; le sirene sono **una** voce agganciata alla
volante più vicina, con il guadagno che cresce col numero delle altre. Quaranta oscillatori
per quaranta auto sarebbero costati tutto il budget per una differenza che nessuno sente.

**I punti di chiamata sono negli imbuti**, non nei chiamanti: `weapons.shoot` copre ogni
bocca da fuoco del gioco (giocatore, polizia, teppisti, drive-by) con una riga sola;
`projectiles.explode` ogni onda d'urto; `main.onVehicleImpact` ogni urto di lamiera, dal
tamponamento del traffico allo schianto del giocatore. I passi non hanno nemmeno un punto di
chiamata: `audio.updateWalk` li conta in **pixel percorsi** dal giocatore, che è l'unico modo
di non farli sfasare con la corsa.

**Cosa suona, in ordine di quanto si sente:** le undici armi (timbro per arma, con schiocco,
corpo e coda che rimbalza fra i palazzi), esplosioni e molotov (che si *spacca*: vetro prima
della vampata), il motore del mezzo che guidi, le sirene, gli urti, il rotore dell'elicottero,
la pioggia e il tuono che arriva **dopo** il lampo con il ritardo del suono, il fondo urbano
che scende con `urbanAt` e sale col traffico dell'ora, la risacca vicino alla costa, gli
incendi che scoppiettano, le gomme, le canne della minigun che prendono giro, i passi (diversi
sull'asfalto bagnato e sulle piastrelle di un negozio), le urla, il campanello della porta,
il registratore di cassa, la stella che sale.

**Il mixer** è nel menu di pausa (voce **Audio**): quattro volumi — generale, effetti,
ambiente, interfaccia — che restano in `localStorage` sotto `seoul.audio`. `F4` è il muto.
L'interfaccia ha un bus suo che **non passa dal compressore** e non viene abbassato in pausa:
un clic di menu non deve schiacciare l'esplosione che c'è sotto, e in pausa dev'essere l'unica
cosa che si sente. Il resto dei letti in pausa si abbassa al 22% invece di spegnersi: uno
stacco netto suona come un guasto.

**Misurare invece di ascoltare.** Nessuno ha una cassa in headless, e il primo mix «a
occhio» era sbagliato di tre volte: `.claude/tools/scenes/audio-census.scene` attacca un
analizzatore al master e riporta rms e picco. La misura che ha trovato il difetto:

| | prima (a occhio) | adesso |
| --- | --- | --- |
| ambiente urbano, rms | 0,083 | **0,015** |
| temporale, rms | 0,168 | 0,045 |
| al volante, rms | 0,108 | 0,046 |
| colpo di pistola, picco | 0,44 | 0,44 |

L'ambiente aveva **lo stesso valore efficace di un colpo di pistola** e il temporale copriva
le esplosioni. Due cause: i guadagni tarati senza sentirli, e il rumore rosa che a parità di
guadagno è ~3× più forte del bianco (il filtro a un polo toglie energia, e la compensazione
era esagerata). Nel sorgente non si vedeva niente. **Il rapporto da tenere d'occhio è
ambiente contro colpo**: sotto un quarto del picco di una pistola.

**Costo.** Il passo audio in JS è **0,04 ms per frame** — tre centesimi del budget, e non è
lì che si spende: il grafo gira sul suo thread. Fianco a fianco con `main` sullo scenario
peggiore (cinque stelle, minigun, 20-24 voci vive) la mediana degli fps passa da 33-35 a
31-32, cioè dentro il rumore del container; nel caso normale (si guida in città) le due
misure si sono invertite fra due esecuzioni, che è il modo in cui il rumore dice «qui non c'è
niente da leggere». Il tetto delle voci regge: 20 su 24 in un minuto di esplosioni e incendi
continui, e lo tocca solo la caccia a cinque stelle con l'automatica in mano — che è
esattamente il momento per cui esiste.

**Rimasto fuori, e perché.** Niente musica (è un'altra cosa: vuole scelte di regia, non un
sintetizzatore); niente riverbero per interno/esterno (un `ConvolverNode` vuole una risposta
all'impulso, cioè un asset, oppure una da generare — è la cosa più grossa che manca e si
sentirebbe); niente voci vere per i pedoni (le urla sono stilizzate apposta: una formante con
vibrato, tenuta piano perché di più suonerebbe finta invece che stilizzata); niente radio in
macchina, che è la prima cosa che il giocatore cercherà e vuole musica.

### 5.14 La radio: l'unica cosa che parla con la rete

Richiesta dell'utente subito dopo il §5.13: **stazioni coreane vere**, senza chiavi API, con
i tasti in macchina per cambiare o spegnere, e la radio accesa anche nei negozi a volume
basso. È in `src/core/radio.js`, e la regola che governa tutto il file è una sola:

> **Il gioco si comporta identico quando la rete non c'è.** Niente qui può bloccare il boot,
> costare un frame o rompere qualcosa: al massimo una stazione non risponde e si passa alla
> successiva. E finché il giocatore non preme `R`, **il gioco non manda un pacchetto a
> nessuno** — la scoperta delle stazioni parte all'accensione, non al boot.

**Tre scelte tecniche, e ognuna esclude un'alternativa che sembrava più ovvia.**

1. **Non passa da WebAudio.** Sarebbe stato comodo mandare la radio nel mixer del §5.13 e
   avere ducking e compressore gratis. Ma un `MediaElementAudioSourceNode` con una sorgente
   di un'altra origine **senza intestazioni CORS diventa muto** — ed è la norma per gli
   Icecast delle emittenti. Un `<audio>` e basta suona sempre; il volume si fa con
   `el.volume`, che per un fondo musicale è tutto quello che serve.
2. **Nessun elenco di stazioni scritto a mano.** Gli URL delle emittenti cambiano, e una
   lista hardcoded è una lista che marcisce. Le stazioni si chiedono a **radio-browser.info**
   (aperto, gratuito, **nessuna chiave**, tre mirror provati in fila con timeout di 6 s),
   filtrate su `countrycode=KR` e ordinate per voti. Chi vuole fissare la propria la mette in
   `localStorage` sotto `seoul.radio.stations` (`[{name, url}]`): quelle vincono e non
   spariscono se la directory cambia idea.
3. **Solo MP3/AAC diretti.** `<audio>` non sa leggere una playlist (`.pls`, `.m3u`) né HLS
   (`.m3u8`), e librerie non ce ne sono. **Questo taglia fuori KBS, MBC e SBS**, che
   trasmettono in HLS con un token dell'app: restano le stazioni indipendenti dell'elenco.
   È un limite vero, ed è meglio saperlo qui che scoprirlo credendo a un bug.

**Comandi.** `R` accende e passa alla stazione dopo, `Shift+R` spegne. Premuti dove la radio
non si sentirebbe (a piedi in mezzo alla strada) lo dicono con un toast invece di aprire uno
stream muto. In macchina l'HUD mostra una targhetta sopra il tachimetro — nome della stazione
e tre tacche di segnale che lampeggiano finché non si aggancia — e **si vede anche da
spenta**, perché una radio che non si sa di avere non la accende nessuno.

**Dentro i negozi** suona a `0.26` del volume, e solo nei locali che ce l'hanno davvero
(`radio: true` in `interiors.BUSINESSES`: 편의점, 약국, 옷가게, 분식, 술집, 당구장 — non
l'ufficio, non l'ospedale, e non il 노래방, che la musica ce l'ha già). **È la stessa
stazione dell'autoradio**: una seconda connessione per un fondo appena percettibile non vale
il traffico dati.

**Dettagli che sembrano piccoli e non lo sono:**

- **`TUNE_SETTLE` (0,45 s).** Scorrendo la manopola si passano cinque stazioni in due
  secondi: senza la pausa si aprirebbero cinque connessioni per ascoltarne una.
- **`STALL_LIMIT` (11 s).** Una stazione che non manda un byte suonabile viene marchiata
  `broken` e saltata. Marchiata, non tolta: al giro dopo può essere tornata, ma scorrendo non
  ci si inciampa più.
- **La radio si carica solo quando qualcuno la sente.** Fuori dall'auto e fuori da un locale
  con la radio, l'elemento va in pausa: niente stream che scorre per nessuno.
- **`fail()` esce subito se la radio è spenta.** Staccare la sorgente da un `<audio>` fa
  scattare un `error` da solo — senza quella riga, spegnere la radio la **riaccendeva** sulla
  stazione successiva.

**Cosa è stato verificato, e cosa no.** L'egress di quella sessione consentiva solo GitHub
(`example.com` → 403 dal proxy), quindi **gli stream veri non sono mai stati ascoltati da
qui**. Il resto sì, e con una stazione finta — un WAV generato al volo e servito da un
`blob:` — il percorso completo è stato provato: accensione solo dove si sente, cambio
stazione, volume 0,56 in auto contro 0,15 dentro un 편의점 aperto, pausa scendendo dall'auto,
pausa col muto generale (`F4`), spegnimento con `Shift+R` che resta spento. Il ramo «la rete
non c'è» è quello che in questo container succede per davvero: tre mirror falliti, toast, e
radio che resta spenta senza rompere niente.

⚠️ **In headless, con la radio accesa, `probe.mjs` esce 1** anche quando il gioco sta bene:
il browser logga da sé `net::ERR_...` per ogni richiesta bloccata, e il probe conta i
`console.error`. Non è un errore JS. Le scene che non riguardano la radio non la accendono,
quindi il problema non si presenta mai per caso.
