# Menu iniziale, musica e autosave

> §5.18–5.20 del progetto. Indice generale e mappa dei rimandi: [HANDOFF.md](../../HANDOFF.md).

### 5.18 Il menu iniziale: Seoul gira dietro al titolo

Stava nel §6 da quando esiste il salvataggio: *«non c'è una schermata iniziale: il gioco parte
in strada e un salvataggio esistente si annuncia con un toast»*. Chi tornava il giorno dopo
doveva sapere che «ESC → Salvataggi» era il posto in cui riprendere. Adesso la prima cosa che
si vede è una porta d'ingresso, e **«Continua» è la prima voce** — c'è solo se c'è qualcosa da
continuare, perché una voce spenta in cima a un menu di quattro righe è peggio di una voce che
non c'è.

**Lo sfondo è il gioco, non un'immagine.** Al boot il mondo è già acceso e il loop già gira:
traffico, pedoni, effetti e luci si muovono dietro al titolo (`Game.updateAttract`), e la
camera fa un giro lento attorno al punto di partenza. Costa quanto un frame di gioco — che
sarebbe stato disegnato comunque — e la prima impressione è una Seoul che si muove invece di
una cartolina.

Le due cose che **non** girano, e sono scelte:

- **Il giocatore.** `player.update` non viene chiamato, quindi non risponde ai comandi, non
  viene investito e non annega. Bloccare l'input a monte sarebbe stato più invasivo: il menu
  quell'input lo usa.
- **L'orologio.** Dieci minuti passati a leggere il menu sono dieci ore di gioco (§5.11), e la
  partita comincerebbe a un'ora decisa da quanto ci si è messi a premere Invio.

**La camera gira stretta apposta** (250 × 170 px, un giro ogni ~40 s). Lo streaming immette il
traffico attorno al **giocatore** e lo despawna sulla distanza dal giocatore (§3): una camera
che se ne andasse a spasso inquadrerebbe strade vuote con le auto che svaniscono in campo
visivo. Un volo sopra la città vorrebbe un secondo sistema di popolamento, e non vale il prezzo.

**Le schede dei salvataggi sono le stesse** del menu di pausa: sono finite in
`src/ui/saveslots.js` (`SaveSlots`), che i due menu istanziano con l'unica differenza che
conta — dal menu iniziale non si può *scrivere*, perché non c'è ancora una partita da salvare.
Due liste separate sarebbero scivolate l'una dall'altra alla prima modifica. Lo stesso vale per
l'elenco dei comandi (`CONTROLS` e `drawControlsList`, esportati da `menu.js`).

**`?autostart` salta il menu.** `probe.mjs` lo passa da sé: una scena di prova deve trovare il
gioco in strada, con il giocatore che risponde ai comandi, esattamente come prima che il menu
ci fosse. Per fotografare il titolo c'è `--menu` (§9). Senza questo, tutte le scene esistenti
si sarebbero trovate davanti a un giocatore che non si muove, e il modo di scoprirlo sarebbe
stato una mezz'ora persa a chiedersi perché.

Effetto collaterale gradito: il gesto che i browser pretendono per far partire l'audio (§5.13)
adesso arriva **prima** della partita, non durante. Si preme un tasto per navigare il menu, e
il tema attacca lì.

### 5.19 La musica: due pezzi, e soprattutto una regia

Era in cima al §6 e in una nota in testa a questo file: *«manca un tema, e mancano i pezzi che
accompagnano una missione o una fuga. È materia di regia e va concordata»*. La parte tecnica
non era il problema — `audio.js` fa già suonare undici armi da oscillatori — e infatti
`src/core/music.js` è il file corto di questo giro. **La domanda vera non è che timbro ha: è
quando parte e quando tace.**

Le tre regole, e sono tutte e tre delle rinunce:

1. **In strada non suona niente.** Seoul ha già un fondo suo — traffico, pioggia, insegne,
   sirene — e coprirlo con un tappeto continuo sarebbe togliere, non aggiungere.
2. **Suona dove il gioco parla di sé**: il menu iniziale e la caccia. Sono i due momenti in cui
   non c'è niente da ascoltare *nel* mondo e tutto da sentire *sul* mondo.
3. **La radio vince sempre.** Se il giocatore ha acceso la sua stazione (§5.14), la musica del
   gioco non si sovrappone nemmeno con cinque stelle addosso. La radio è musica *scelta*.

**I due pezzi.** Girano tutti e due su quattro battute in La minore, con la pentatonica come
scala di riferimento — cinque note, ed è anche la scala della musica tradizionale coreana.

| | tema (menu) | caccia |
| --- | --- | --- |
| passo | 84 bpm, i-VI-III-VII | 148 bpm, i-i-VI-VII |
| cosa c'è | pad che tiene l'accordo, basso, arpeggio, niente batteria vera | cassa in quarti, rullante sul 2 e sul 4, basso in crome |
| strati | — | accordi da 3 stelle, ritornello da 4 |
| quando | `!game.started` | `wanted.level ≥ 2`, fuori da un edificio, radio spenta |

Gli strati che entrano con le stelle sono la cosa che si sente di più: **la musica dice quanto
sei nei guai prima che tu conti le stelle sull'HUD**. Il volume del pezzo sale con loro
(`0.72 + 0.28 × intensità`).

**Due stacchi** (`music.sting`), che non sono musica ma punteggiatura: `go` quando si esce dal
menu — tre note che salgono e un tonfo, l'unica cosa che dice «adesso comandi tu» — e `busted`
sull'arresto. Hanno un **bus loro che non sfuma mai**: suonano proprio dove la musica tace, e
sul bus del pezzo arriverebbero al volume di quello che c'era prima.

**Tecnicamente è uno scheduler in anticipo**, non un suono per frame. Ogni giro di `update` si
programmano sull'orologio del contesto le note dei prossimi 0,25 s. Suonare a `dt` del game
loop vorrebbe dire che un frame lungo è una nota in ritardo, e sedici note in ritardo sono una
canzone che zoppica: **il loop decide cosa, l'orologio dell'audio decide quando.** Se il
contesto è andato avanti senza di noi (scheda in secondo piano, muto tolto) si riparte da
adesso invece di sparare in un colpo solo tutte le note arretrate.

**Il cambio di pezzo passa dal silenzio.** Si sfuma il vecchio (mezza vita 0,3 s, ~1,9 s in
tutto), e solo sotto 0.01 si cambia pattern e si riparte da battuta uno. Tagliare a metà
battuta si sente come un guasto — è la stessa ragione per cui i letti in pausa si abbassano
invece di spegnersi (§5.13).

**Il bus della musica passa dal compressore**, al contrario di quello dell'interfaccia: quando
scoppia una granata la musica deve abbassarsi come tutto il resto, o un pezzo che continua
indifferente sopra un'esplosione la fa sembrare piccola. Nel mixer c'è la riga **Musica**
(`mix.music`, di fabbrica 0.7), e il suo campione di prova è un accordo e non un clic — quasi
sempre in quel momento non sta suonando niente.

**Misurato** con `.claude/tools/scenes/music-census.scene` (§9), che è al censimento audio
quello che l'audio-census è al mix:

| | rms | picco |
| --- | --- | --- |
| tema, sul menu | 0,045 | 0,26 |
| in strada, da puliti | 0,015 | 0,06 |
| caccia a 3 stelle | 0,034 | 0,24 |
| caccia a 5 stelle (con sirene e piombo) | 0,069 | 0,60 |

Il riferimento resta quello del §5.13: **ambiente contro colpo**. La musica sta sopra il fondo
urbano (0,015) e sotto il picco di una pistola (0,44). La prima taratura aveva la caccia a
0,077 di rms nello scenario peggiore del censimento audio, cioè il 40% sopra il valore senza
musica: il pezzo è sceso a `LEVEL.chase 0.5` e la cassa a 0.42, e adesso quello scenario sta a
0,068. **Costo in JS: 0,001-0,003 ms per frame**, cioè niente — le note le suona il grafo sul
suo thread.

**Rimasto fuori, e perché.** Niente pezzo per la guida tranquilla: quella è la radio, e quando
la rete non c'è il silenzio è comunque meglio di un loop che gira per venti minuti. Niente
musica negli interni (il 노래방 la avrebbe, ma vorrebbe un pezzo per locale). Niente musica
delle missioni: si scriverà insieme alle missioni, perché una musica di missione senza la
missione è una traccia che non sa dove attaccare e dove finire.

### 5.20 L'autosave: uno slot in più, e solo dove si può ripartire

Il §5.15 aveva scelto di **non** averlo, con una ragione buona e ancora vera: *«un autosave che
scatta da solo mentre hai quattro stelle addosso è una trappola»*. La ragione però non dice «mai
salvare da soli»: dice **dove**. Il salvataggio automatico di qui non scatta quando gli pare.

**Uno slot suo, il quarto.** Chiave `seoul.save.auto`, e i tre manuali non li tocca nessuno: un
autosave che sovrascrive quello che il giocatore ha messo da parte è un autosave che gli fa
perdere la partita invece di conservargliela. In lista le schede sono quattro, e su quella
`AUTO` il pulsante `SALVA` è spento — quello lo scrive il gioco.

**Quattro momenti**, tre dei quali sono eventi che sanno già di essere buoni:

| Quando | Perché lì |
| --- | --- |
| dopo aver dormito nel futon di un 주택 | è il punto di salvataggio di qualunque gioco che ne abbia uno: ci si dorme apposta quando si è messo via qualcosa da non perdere |
| all'uscita dall'ospedale | zero stelle, salute piena, in piedi davanti a una porta |
| all'uscita dalla cella | idem, ed è la sconfitta che costa di più (sei ore) |
| ogni 4 minuti in strada | l'unico che deve chiederselo |

**La condizione è una sola, scritta in tre modi** (`save.canAutosave`): si salva solo un punto
da cui si può ripartire. Zero stelle (o si ricaricherebbe dentro l'inseguimento), non morenti e
sopra i 25 HP (o si ricaricherebbe a un passo dalla morte), niente manette che si stringono (o
si ricaricherebbe in arresto). Quando la risposta è no, l'autosave a tempo **riprova fra 20 s**
invece di saltare il giro: chiedere a `localStorage` sessanta volte al secondo per tutta una
caccia sarebbe l'altro modo di sbagliare.

**Si spegne.** `F` sul pannello dei salvataggi (in tutti e due i menu), stato in `localStorage`
sotto `seoul.autosave`, e la scheda `AUTO` dice sempre se è acceso o sospeso. Chi la pensa come
il §5.15 lo spegne e non ne sente più parlare.

Un toast lo dice ogni volta (`Salvataggio automatico · dopo il sonno`) con un suono
d'interfaccia: un salvataggio che avviene di nascosto è un salvataggio di cui il giocatore non
si fida. Il costo è quello del §5.15 — **0,7 kB e un `JSON.stringify` ogni quattro minuti**.

---
