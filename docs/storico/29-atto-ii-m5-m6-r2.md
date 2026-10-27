# L'Atto II, prima metà: M5, M6, R2 e le visite che cambiano

> §5.40 del progetto. Indice generale e mappa dei rimandi: [HANDOFF.md](../../HANDOFF.md).
> Il copione: [`docs/storia/04-atto-2.md`](../storia/04-atto-2.md).

### 5.40 — Tappa T7 del rework (prima metà della F): il nome, i faldoni e la cucina

La tappa F è l'Atto II, ed è l'atto che chiede più cose nuove al motore. Questa è la **prima metà**:
**M5** (tre cortili da riprendere a Pyo Man-deok), **M6** (la torre di 한성개발 alle 14:00, sette
faldoni e una riga del 1992), il raccordo **R2** (la cucina), tre delle otto chiamate di 까치
dell'atto e la prima delle «visite che cambiano» (Jo dopo M6). Restano M7, M8, R3 e le altre cinque
chiamate: sono la seconda metà (T8), in fondo.

Il criterio è quello di sempre: quello che vale per più di una missione sta nel motore (e qui è
poco: due righe di `missions.js`, un evento, un argomento di `claim`), quello che sa la trama sta
sotto `src/story/`. **Nessuno stato nuovo nel salvataggio**: il formato resta `v6` e non serve uno
scalino. Tutto quello che M5 e M6 ricordano sta nel **taccuino della missione** (`missions.state`) e
nei fatti della storia (`flags`), che il salvataggio porta già dal §5.29.

---

## 1. M5: contare fino a tre, senza scrivere una `claim`

M5 **non scrive niente di quello che fa una `claim`** (§5.31): il tag a terra, il banco che cambia
mestiere, la busta e il salvataggio sono di `turfs.claim`. Quello che fa è **ascoltare
`turfClaimed`** e contare: i cortili che sono suoi (`t.held`) e che stavano nella sua scelta di tre.
Delle tre strade del copione, due erano già meccanica di città — sgombrare e restare sei secondi
(`force`), comprare il capocortile (`deal`) — e la terza è una fase che **finisce con una `claim`**:

- nel cortile compaiono **tre auto ferme**, di quelle che il 철마파 stava smontando
  (`createVehicle`, freno a mano, `protect`, marcate `_chop` con la chiave del cortile);
- chi le porta via e le **vende** le conta: `sellVehicle` manda adesso `vehicleSold(v, place, price)`
  sul bus (una riga in `shops.js`) e la missione legge `v._chop`. Che si venda a un 전당포 o al banco
  di un 철마파 è lo stesso `sellVehicle`;
- il conto è **delle vendite, non delle auto**: una rovinata o abbandonata viene rimpiazzata
  (`curaAuto`) finché non ne sono state vendute tre. Alla terza la missione chiama
  `game.turfs.claim(t, PLAYER_GANG, game, 'work')`.

`claim` ha guadagnato **un solo token**: `how === 'work'` conta come `held` come `force` e `deal`
(riga in `turfs.js`). Nessuno ha sparato e nessuno ha pagato, ma il cortile è di chi l'ha svuotato.
Le tre strade finiscono nello stesso evento — è quello che `treStradeStessaClaim` prova.

La fase dei cortili è una sola con tre caselle (§5.29): il blip segue il cortile rimasto più vicino,
e la riga dell'HUD dice il conto (`n/3`). **Un cortile che era già tuo prima di cominciare conta.**

### Cose che il copione non dice e che M5 ha dovuto decidere

- **Seoul ha un solo cortile del 철마파.** La seed è quella, la maglia non si tocca e l'rng
  principale non consuma un numero in più. I tre di Pyo sono quindi quel cortile e **i due degli
  흑사파**, che all'inizio della missione passano al 철마파 con una `claim` di tipo `war` (la stessa
  di una guerra fra bande): è esattamente quello che dice Pyo, «me li sono lasciati prendere». La
  scelta si ricorda nel taccuino (`state.targets`, le chiavi dei cortili) e `prepare` è
  **idempotente**: il ripristino lo rilancia e non cambia niente. **Costo:** chi finisce M5 ha
  tre cortili tuoi e nessun banco degli 흑사파 a Seoul (§5.31: si perde il mestiere insieme al
  padrone).
- **Il cortile di Pyo sta dov'è la seed lo mette**: Myeongdong, non Gangnam come scrive il copione.
  La storia cerca, non piazza (§5.29).
- **Pyo non paga in contanti.** Il copione dice «Soldi non te ne do» e poi «il ritorno da Pyo, che
  paga»: quello che paga è **la proroga**, una ricevuta (`flag proroga`). Nessuna missione la legge
  ancora. Se si è morti tre volte nella fase, Pyo ha una riga in più («ho dovuto contare i giorni due
  volte»): è il «perderli tutti e tre di fila fa aumentare il prezzo» del copione, ridotto a testo
  perché non c'è un prezzo da far salire.
- **Date e numeri assoluti**, da `10-continuita.md`: Chun-sik non dice «fra sei giorni» (il
  calendario non lo regge) ma «martedì», e Pyo dice «fino al 2025» e non «fino all'anno scorso».
- **L'innesco** è Chun-sik dentro il 당구장, che è dove R1 finisce: la scena parte **subito** se il
  giocatore è già dentro (è così quando R1 si chiude), altrimenti entrando. R1 → M5 sta in
  `campaign.js`.

Cinque pannelli (`m5-1…m5-5`): il cortile con sei uomini e la sedia vuota, Pyo e il ventaglio, il
tavolino con la bottiglia che ne riempie uno solo, il cortile la sera, la foto dentro il ventaglio.
Tre personaggi a pixel nuovi in `pixelkit.CAST`: **Pyo** (la testa pelata e il pizzetto bianco),
**Ku Man-gi a trent'anni** (la foto: stessa mascella di Jae-min ma con basette e baffi, e niente
cicatrici) e **il bambino** (testa tonda, ciuffo solo in cima, guance rosa).

## 2. M6: un'ora, un pedinamento, una riga

M6 **ha un'ora e un pedinamento e non scrive né l'uno né l'altro**: l'ora è `ctx.waitUntil(14)` come
M3 (chi arriva alle nove di sera passa la notte e rientra il giorno dopo), il pedinamento è
`game.tail.begin` con `tailLost` / `tailSpotted` ascoltati dalla fase.

**Le tre strade per entrare sono due.** Il copione ne dà tre («la scelta conta perché cambia chi ti
vede»: la porta in completo, il parcheggio interrato di M3, il tetto) e Seoul non ha un tetto da cui
entrare. Restano:

- **la porta, con il completo** comprato al 옷가게 (`HERO_OUTFITS.suit`): chi arriva con il bomber
  sale, vede il piano e **si ritrova in strada nel frame dopo** con le tre battute del portiere. Il
  rimbalzo non è dentro `floorShown`: far uscire il giocatore da dentro l'evento che lo ha messo
  dentro lascerebbe `shops.enter` a metà;
- **la rampa, dietro una berlina**: è il pedinamento. La berlina nera esce dalla rampa, va al
  편의점 di Itaewon, **sosta tre secondi** e ritorna — lo stesso giro del martedì e del venerdì di
  M3, fatto dalla parte di chi sta dietro. Quando rientra, la sbarra si alza per lei e per chi la
  segue. Perderla o farsi vedere **non è un game over**: la fase riparte (la stessa regola di M3).

**La torre è una sola, e non sale.** Le piante di Seoul hanno al più quattro piani; il copione lo
segnala nel «Chiederebbe». Quindi **l'ottavo e il ventesimo sono lo stesso piano** — quello
dell'ufficio — e la stanza di Ryu è in fondo al corridoio. Il biglietto, il riquadro e le righe
dicono «8층» come il copione; non c'è un piano 20. La torre è la stessa di M3 (`places.findTower`,
fatta per questo: con due ricerche sarebbero due palazzi).

**Sette faldoni, di cui tre inutili.** I primi tre sono quelli del copione (la perizia con la
controfirma di 서재민, l'atto di cessione di nove anni fa, la pagina del 1992); il quarto è **un
contratto firmato a penna** che il copione chiede a `00-soggetto.md` per M11 («ogni contratto
Hanseong dell'Atto II è firmato a mano e datato di recente»): è facoltativo come i tre inutili.
**Basta la perizia e la pagina** per andare avanti, e **la pagina esce solo dopo l'atto di cessione**,
perché è «allegata come prova» a quello. Ogni faldone è un punto interattivo (`E`) sul piano, messo
in un posto libero che **non** sia sulle scale (`E` lì è già «scendi»). La data della controfirma è
**14 settembre 2025** e non «undici mesi fa»: una relativa che sette missioni dopo sarebbe falsa.

**Il ribaltamento è in silenzio.** Letta la riga del 1992 non c'è un pannello e non c'è una battuta:
tre secondi senza niente (`SILENZIO`) e poi l'allarme. I tre numeri sono tutti in scena — il nome
inciso (M2), l'anno del libro, i trentaquattro anni di Jae-min — e metterli in fila sarebbe farlo al
posto del giocatore. 까치 se ne ricorda (`kkachi.mark('riga1992')`) e la chiamata 14 aspetta che il
giocatore salga in macchina.

**Fallimento.** **Sparare dentro la torre** (tre stelle mentre si è dentro) chiude l'archivio fino
al **giorno dopo alle 14**: si torna alla fase dell'appuntamento con il giorno segnato nel
taccuino, e aspettare il pomeriggio dello stesso giorno non basta. Una morte o un arresto
riprendono la **stessa** fase con i faldoni già letti. L'espulsione della sicurezza, cioè «farsi
prendere», **non c'è**: non c'è una sicurezza che ti prenda.

**L'allarme non è un allarme di polizia.** Il copione lo chiede come un allarme scriptato distinto
da quello dei negozi: qui è una battuta del narratore con un suono d'interfaccia, e **nessuna
volante aspetta fuori**. Ryu non chiama nessuno — è tutta la scena, e la sua riga resta com'è,
con la *(nota)* degli occhiali. È una scelta che si cambia con un'ora di lavoro, e va decisa quando
si sa cosa fa M7 della polizia.

**Sette pannelli, e quattro di apertura.** Il copione ne dà tre; **la seconda metà della battuta di
Ha-eun è in una tavola sua** (il telefono con il soffitto dentro) perché in una sola il testo era
più della faccia (la stessa regola del §5.33: si taglia la battuta o si divide la tavola). La riga
del 1992 è un pannello a tutto schermo che si chiude da sé dopo 3,2 s (`hold`): è l'unico in cui la
traduzione manca apposta, perché il narratore l'ha già data nel faldone.

## 3. R2, la cucina

Una fase e due pannelli, come R1. **Lo stesso disegno due volte** — una sola funzione (`cucina`) a
cui si tolgono il bambino, l'uomo e la luce della radio — perché non è un'altra stanza: è la
stessa, di oggi. La **cicatrice** è sulla guancia destra di lui, e lui è di spalle: sul pannello
compare come una striscia di guancia a **destra di chi guarda**, che sborda dalla nuca, ed è l'unica
cosa del disegno che dice chi è. La radio c'è anche nel secondo pannello, spenta: è la riga che 까치
ripeterà parola per parola nell'Atto III (chiamata 20).

**Regia sonora** (§5.37): il primo pannello ha il fruscio sotto la voce (`bed.kkachi` 0,03: la radio
sul frigo è accesa), il secondo **niente** — è il silenzio che cambia. Anche il quadrante di M6 ha il
suo fruscio (0,03). Misurati con `cutscene-audio.scene` sul master: R2-1 rms 0,0048 contro 0,0030 di
R2-2, M6-7 0,0049; picco ben sotto una pistola.

## 4. 까치: tre chiamate, tutte con la loro origine

Delle otto dell'Atto II **tre** stanno qui perché il copione le lega a M5 e M6 (le altre cinque
vanno con la seconda metà). Ognuna ha il suo `// origine:` in `story/kkachi.js`, ed è la prova:

| Chiamata | Si innesca | Origine |
| --- | --- | --- |
| `a2-pyo` (11) | M5 finita, a meno di 520 px dal cortile del 황소파 | Kkachi in M6 (pannello 8) — **anticipata** |
| `a2-completo` (12) | il completo addosso, **M3 finita** | Ha-eun in M3 («le sta grande») |
| `a2-riga` (14) | un quarto d'ora di gioco dopo aver letto la riga del 1992 | nessuna, come da copione |

`a2-completo` aspetta M3 per la stessa ragione di `a1-itaewon`: la copia non esiste prima
dell'originale. Come tutte, escono **solo a radio accesa** e una chiamata interrotta è persa per
sempre: la scena lo prova con la stessa chiamata in tutti e due i modi.

## 5. Jo risponde in modo diverso

Era rimasta indietro dalla tappa B. **Non è una missione**: è un punto interattivo che c'è sempre
(`MissionSystem.standing`), con `when` che dice quando vale. Prima di M6 Jo ripete «Torna quando sai
fare la domanda giusta»; dopo, mette sul banco l'accendino inciso (`flag accendino`, una delle tre
condizioni del finale C e l'oggetto con cui si brucia il registro nel finale A) e lo dà **una volta
sola**. **La domanda giusta non la compone il giocatore**: `ui/dialogue.js` non ha scelte, ed è
stato deciso così; chi parla a Jo dopo M6 fa la domanda che Jae-min ha in testa («구만기, è inciso
sul mio orologio»). Il suggerimento resta «parla con Jo» prima e dopo. **Scelta nostra.**

Per esserci anche dopo un caricamento Jo si **ridefinisce da sola** (`missions.afterRestore`):
`prepare` gira solo per la missione in corso, e una definizione nata in M2 non sopravviveva a un
salvataggio — oggi il banco tornava a un commesso qualunque. `defineJo` è uscita da `M2.prepare`.

## 6. Il motore: quattro righe e un evento

- `MissionSystem.standing(p)` — **punti fissi**, non di fase: non si smontano al cambio e valgono
  anche senza missione in corso. `update` non esce più quando non c'è una missione attiva;
- `MissionSystem.afterRestore(fn)` — chi deve rifare qualcosa dopo ogni caricamento;
- `vehicleSold(v, place, price)` sul bus, da `sellVehicle`;
- `turfs.claim(..., 'work')` conta come tuo;
- `places.findTower` · `places.mandaA` · `places.arrivata`: la torre e «un'auto che arriva»,
  usate da M3 **e** da M6 (stavano private in `m3.js`);
- `pixelkit.figure(..., { accent })`: ridipinge la cravatta e la banda sulla schiena. Per
  Dong-hyeok l'accento è il colore della cicatrice, e su un bomber diventava una striscia chiara
  di mezzo pannello.

## 7. Quello che questa tappa ha trovato a schermo, e non nel sorgente

- **Il bambino era una testa che galleggiava.** `figure(..., 'seat', { crop: 26 })` è la testa e
  due righe di corpo: per un bambino seduto serve `crop: 46`, o non si vedono né il busto né le
  gambe. E stava dietro al riquadro delle battute, come tutto quello sotto il 60% (§5.33).
- **Pyo finiva sotto il narratore.** Il riquadro del narratore si prende la fascia in alto a
  sinistra fino al 62% di larghezza: una testa a 0,64 ci passa dietro. A destra del 70% sta in
  chiaro.
- **I commensali del cortile la sera erano macchie scure su un fondo scuro.** Una sagoma che deve
  *mangiare* vuole una tinta più chiara del fondo e la testa sopra il piano del tavolo.
- **Un albero dentro l'atrio sotto la scritta è un albero che cancella la scritta.** Il soggetto
  del pannello 1 di M6 è l'albero: la scritta va a lato, e la folla ai due bordi.
- **Un telefono accanto alla faccia è una telefonata.** Per «fotografa il soffitto» il braccio sale
  **a lato della testa** e il telefono sta sopra, inclinato (la crocchia di Ha-eun sborda a destra:
  si passa fuori).
- **Il faldone sulle scale non si legge.** Il punto cadeva dove `E` è già «scendi al piano terra».
  Ryu stava sul pianerottolo, e a schermo sembrava un'altra figura sulle scale.

## Come si prova

```bash
node .claude/tools/probe.mjs --seconds 1 --quiet \
  --script .claude/tools/scenes/atto-2.scene \
  --eval "Object.entries(window.__OUT).filter(([k,v]) => v===false).map(([k])=>k)"
```

`[]` vuol dire tutto a posto. **137 voci**: R1 che passa a M5, i tre cortili presi nei tre
modi (con un salvataggio e una morte in mezzo), le tre auto vendute e quella rovinata rimpiazzata,
M6 dall'auto alle 14:00 del giorno dopo, la porta che rimbalza senza completo, il pedinamento
perso, scoperto e riuscito, i faldoni che non tornano dopo il salvataggio, l'archivio chiuso dallo
sparo e riaperto il giorno dopo, la ripresa dopo una morte **e dopo un arresto** (`busted`), Ryu, R2,
Jo e le tre chiamate a radio accesa e spenta. Sei voci sono invarianti (in testa alla scena).
`window.__LOG` è la fila delle fasi; con `--shot-dir` fotografa sette momenti giocati
(`m5-1-pyo-prezzo`, `m5-2-cortile-auto`, `m6-1-pedinamento`, `m6-2-archivio-faldone`,
`m6-3-pagina-1992`, `m6-4-ryu`, `jo-1-accendino`). I pannelli si guardano con
`cutscene-sheet.scene` e `cutscene-panel.scene` (`window.__SCENA = 'm5' | 'm6' | 'r2'`) e i tre
personaggi nuovi con `cast-sheet.scene` (`window.__CAST = ['pyo', 'bambino', 'kumangi']`).

`atto-1.scene` ha una riga in più: R1 non chiude più la campagna — subito dopo parte M5 — quindi
la prova «nessuna missione appesa» ferma M5 prima di guardare. `kkachi.scene` conta undici
chiamate e non otto.

## Quello che questa tappa lascia indietro (T8)

- **M7, M8, R3**, e le **cinque chiamate restanti dell'Atto II** (9 campagna, 10 primo volo, 13
  metro, 15 mezzanotte senza stelle, 16 il 장례식장). La 13 ha M7 per origine.
- **Le «visite che cambiano» di Chun-sik (dopo M9) e del commesso (dopo M8)**: il meccanismo
  (`standing` + `afterRestore`) c'è, sono due righe di dialogo ciascuna.
- **Una torre in cui si sale davvero** e **un allarme scriptato con le volanti fuori**: l'ottavo
  e il ventesimo piano sono lo stesso piano, e Ryu non chiama nessuno. Se M7 vuole che la polizia
  sia già addosso a Jae-min, il posto per metterla è la fase `allarme` di `m6.js`.
- **Il tetto**, la terza strada d'ingresso.
- **Nessuno legge `proroga`**: Pyo la dà e basta. Se un'altra missione deve sapere che il quartiere
  è fermo per un mese, il flag c'è.

## Poggia su

Impianto delle missioni e fasi (§5.29) · cortili e `claim` (§5.31) · 까치 e le sue righe (§5.32) ·
pedinamento, `waitUntil` e `mandaA` (§5.33) · arresto che emette `busted` (§5.35) · regia sonora dei
pannelli (§5.37) · negozi, piani, scale e vestiti (§5.8) · orologio (§5.11).
