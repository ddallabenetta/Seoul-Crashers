# L'Atto III, prima parte: M9 e M10

> §5.43 del progetto. Indice generale e mappa dei rimandi: [HANDOFF.md](../../HANDOFF.md).
> Il copione: [`docs/storia/05-atto-3.md`](../storia/05-atto-3.md). L'atto prima: [§5.42](31-atto-ii-m7-m8-r3.md).

### 5.43 — Tappa G1 del rework: la Gyeongbu all'alba, e la baia di Suyeong

L'Atto III comincia. Questa tappa porta **M9 «Gyeongbu»** (Chun-sik sul sedile accanto per
quattrocento chilometri, e la confessione) e **M10 «자갈치»** (Nam Ji-uk, Ko Eun-bi alle quattro,
la cassa dei nove oggetti e la corsa in barca sotto il 광안대교). R3 passa da solo a M9, e M9 a
M10. Come per l'Atto II, **nessuno stato nuovo nel salvataggio**: quello che le due missioni
ricordano sta nel taccuino (`missions.state`) e nei fatti (`flags`: `confessione`, `gyeongbu`,
`hanseongSa`, `nove`).

Restano fuori, per scelta presa con l'utente a inizio sessione: l'**incontro facoltativo di
Busan** («Le sedie arancioni»: la sala d'attesa e i suoi mobili ci sono già, manca
`story/terminale.js`), la **visita di Chun-sik dopo M9**, il **conto delle occasioni su Dulchae** e
le **chiamate 17 e 18 di 까치**. Sono il primo blocco della tappa successiva (G1b, §6.0).

---

## 1. Tre cose nuove nel motore

- **Il passeggero che parla mentre si guida** (`core/passenger.js`). È il terzo modo in cui il
  gioco fa parlare qualcuno, dopo il dialogo (che ferma il mondo) e 까치 (che ha il suo quadrante).
  È una coda di righe che scorre da sola alla velocità di lettura, **solo se chi guida è su un
  mezzo di terra**: sceso dall'auto la coda si ferma, risalito riprende. `phone: true` toglie il
  vincolo della portiera (la risata di M10 arriva in barca). `hush` fa tacere la musica della
  caccia e la radio vera, ed è il silenzio che il copione chiede per la confessione. **Kkachi tace
  con qualcuno a bordo**: non è una regola nuova del personaggio, è la prima. Lo stato non entra nel
  salvataggio, perché riprendere vuol dire ricominciare dal tratto.
- **La nebbia bassa** (`dayCycle.fog`, `fogTarget`). Non è un meteo: non tocca luce, traffico né
  asfalto, e non sta nel salvataggio. La scrive una missione a ogni frame e ricade a zero da sola
  quando nessuno la chiede, così un caricamento a metà viaggio non resta nella nebbia.
- **Le motovedette che girano attorno alla costa** (`entities/boatnav.js`). Inseguivano in linea
  retta, e sulla costa di Busan la retta attraversa penisole e moli: una prova con la polizia vera
  le ha misurate a 1300 px dopo dieci secondi. Ora una griglia d'acqua da 96 px e una visita in
  ampiezza dicono **da che parte girare** quando la retta è bagnata a metà; i piloni dei ponti la
  chiudono. Si aggiungono una **gomma elastica** (`v.pace`, fino a +30% oltre 520 px) e anelli di
  nascita più larghi attorno al molo.

E un ritocco che vale per tutte le missioni: **il carico perso in acqua cade a riva**
(`carry.landNear`). Prima restava dov'era il giocatore, cioè in mezzo alla baia.

## 2. M9 «Gyeongbu»

Fasi: `viaggio` (il blip alla prima area di servizio), `alba` (si aspetta le 05:10 con `F`), i
tre pannelli d'apertura, poi tre tratte — **nebbia** (Chun-sik racconta il quartiere di
trent'anni fa), **convoglio** (tre furgoni e un SUV di scorta che sparano e speronano),
**confessione** (sei battute, `hush`, nessun pannello) — e il **blocco** a quattro stelle
all'ingresso di Busan, fino al piazzale di 서면. Chun-sik parla di Dong-hyeok **al presente**
(«tuo padre dice») fino alla confessione.

Scelte che il copione non dice, dichiarate in testa a `story/m9.js`:
- si parte alla prima area di servizio della Gyeongbu, l'unico «posto all'uscita di Seoul» che
  la strada ha;
- **morire riporta all'ultima area di servizio superata**, con un'auto nuova e Chun-sik già a
  bordo, e la conversazione ricomincia dal tratto. Lo stesso se salta l'auto;
- sulla Gyeongbu **non ci sono stelle** finché non si arriva al blocco: nessuno chiama il 112 per
  un convoglio privato;
- la radio non cambia stazione con i chilometri, perché le stazioni sono stream veri (§5.14).
  Chun-sik commenta quella che trova accesa, una volta.

## 3. M10 «자갈치»

Fasi: un messaggio di Nam, il mercato, tre pannelli, **il prezzo** (il carico di stasera, non
soldi), **l'officina di Ko** (riceve fra le 15:30 e le 17:00, si aspetta con `F`; alle sei dirà a
한성개발 che sei a Busan: flag `hanseongSa`), **il carico** al molo di 남포동, **la barca** e
**la corsa**: due motovedette, l'elicottero a tre stelle, la risata al telefono sotto
l'impalcato, poi **un colpo prende il motore** (scafo al 25%, che non scende sotto la soglia
finché non arrivi). Chiude in darsena, con i nove oggetti in fila sul cemento e la prima volta
che 까치 si corregge.

Scelte dichiarate in testa a `story/m10.js`: l'ordine delle fasi (Ko prima del carico, perché il
carico *è* la corsa); la cassa dei nove oggetti viaggia con il resto del carico; la darsena è il
fondo della baia di Suyeong, a nord del ponte, così ci si arriva solo passandoci sotto; **morire in
acqua rimette la fase al carico**, con la cassa a riva.

## 4. Come si verifica

- `atto-3.scene` **asserisce** (45 voci): R3 che accende M9, l'alba con il tasto, la nebbia fitta
  con Chun-sik che parla, il silenzio a piedi, la morte che riporta all'area di servizio, i quattro
  mezzi del convoglio senza stelle, la confessione in silenzio, il blocco a quattro stelle, M10 da
  sola dopo M9, Ko che a mezzogiorno non riceve, la cassa che in mare cade a riva, il colpo al
  motore, la chiusura a mani vuote. `[]` vuol dire tutto a posto; con `--shot-dir` fa cinque scatti.
- `cutscene-sheet.scene` e `cutscene-panel.scene` accettano `m9` e `m10`. Guardandoli è saltato
  fuori un solo difetto, i tondi dei nove oggetti più grandi degli oggetti stessi (pannelli m10-4 e
  m10-6), corretto.

## 5. Cose da sapere

- **La scena non prova il viaggio vero** da Seoul a Busan: teletrasporta lungo la Gyeongbu. Un
  giro guidato intero vale la pena farlo a mano una volta, prima di chiudere l'atto.
- **Le motovedette sono provate solo nella corsa di M10.** Fuori da Busan valgono le stesse regole,
  ma nessuna scena le insegue sul Han.
