# Le sedie arancioni, Chun-sik dopo M9, il conto su Dulchae

> §5.46 del progetto. Indice generale e mappa dei rimandi: [HANDOFF.md](../../HANDOFF.md).
> Il copione: [`docs/storia/05-atto-3.md`](../storia/05-atto-3.md) («Le sedie arancioni») e
> [`07-radio-kkachi.md`](../storia/07-radio-kkachi.md). La tappa prima: [§5.43](32-atto-iii-m9-m10.md).

### 5.46 — Tappa G1b: le cose facoltative dell'Atto III che non aspettano M11

Questa tappa porta quattro cose che il copione dà per **facoltative e non segnalate**: l'incontro di Busan,
la terza «visita che cambia», il conto delle occasioni su Dulchae e le chiamate 17 e 18. Nessuna ha un blip.
È la prima tappa nata con la regola «una tappa, un ramo, una PR» (PR #31).

Le scelte che il copione non decide sono state **proposte all'utente prima del codice**, e sono quelle scritte
qui sotto. Stanno anche in testa ai file.

---

## 1. Le sedie arancioni (`story/terminale.js`)

- **La porta.** Il terminal di 부산항 è un landmark (`world/busan.js`) e i landmark non hanno vetrine.
  La sala d'attesa è una **vetrina inventata** (`busan-attesa`), come la cella di M7 (§5.42). Sta sul lato
  dell'edificio più vicino al nodo stradale di `findBusan('traghetti')` e mai in acqua. È un punto fisso
  (`sala-porta`) **sempre aperto**: anche prima di M10, e allora la sala è vuota.
- **Chi aspetta già.** Fra le **02:30 e le 04:10**, a M10 finita, Dulchae è seduto sulla fila di mezzo, al
  secondo posto (`dulchae-terminale`, un attore d'interno definito *prima* di `shops.enter`). La sedia del
  giocatore è al quinto, **tre posti più in là**. Chi entra prima delle 02:30 trova la sala vuota. Sedersi
  (`sala-sedia`, `E`) fa girare l'orologio fino alle **03:31**, l'ora del narratore, e quando la tendina si
  alza lui c'è. Chi arriva dopo le 03:31 si siede e basta.
- **Quattro pannelli** (`sedie-1…4`), una volta sola (`missions.playOnce`, flag `sedie`). Poi lui si alza e
  **cammina fino alla porta**, e lì sparisce: non esce in strada.
- **Il gioco non fa niente per impedirlo.** Gli si può sparare seduto, prima di sedersi: allora la scena non
  c'è più, perché la sedia esiste solo se lui è vivo. Oppure gli si spara mentre se ne va.
- **«Fra M10 e M11».** La sedia c'è da M10 finita in poi. M11 (G2) dovrà aggiungere una condizione: chi si è
  già imbarcato non lo trova più.

Il meccanismo nuovo è uno solo: **un punto fisso può avere un `tick(dt, game)`** (`MissionSystem.update`).
Chi se ne va dalla sala non appartiene a nessuna fase, e un punto fisso non aveva altro posto dove
guardarlo camminare.

## 2. Il conto su Dulchae (`story/dulchae.js`)

Conta **solo la morte**: flag `dulchaeUcciso` e `dulchae@m8`, `dulchae@busan`, più avanti `dulchae@m12`,
alzati da `pedKilled` su ogni attore che è lui (`dulchae`, `dulchae-cortile`, `dulchae-terminale`,
`dulchae-assedio`). Le occasioni a cui si è stati presenti non si contano.

Il conto **non sta negli attori**: ogni occasione ha il suo attore, e a scena finita viene tolto con
`undefine`, che si porterebbe via anche la sua morte. I flag della storia stanno già nel salvataggio,
quindi non serve nessuno scalino in `MIGRATIONS`.

**M8 diventa un'occasione vera.** Prima della tappa il cortile cieco era solo pannelli, e lui spariva appena
finivano. Adesso, fino ai pannelli, ha `hp` 9999 come in strada; dopo (fase `fuori`) ha 30 `hp`, cammina
fino all'unica porta e lì sparisce: è la tavola 9 del copione, «se ne va camminando». Se gli si spara e lo si
manca, scappa (`flee`) e finisce in strada come ogni cliente spaventato. Una volta morto a M8, a Busan la
sala resta vuota.

## 3. Chun-sik al 당구장 (`story/visite.js`)

È un punto `E` come Jo (`chunsik-visita`). **Prima di M9** ordina due 짜장면, «quello senza cipolla è di
tuo padre. Lo prende sempre così». **Dopo** ne ordina uno, e dice una riga sola: «Tuo padre lo prendeva senza
cipolla. Adesso lo posso dire.»

Dopo M9 resta a Busan, dove scende a 서면. Per questo **al suo sgabello non c'è** dall'inizio di M9 alla fine
di M10: il tempo di un treno. L'attore `chunsik` adesso si rimette anche dopo un caricamento (`afterRestore`,
`missionStart`, `missionDone`); prima di questa tappa esisteva solo nella sessione in cui si era fatta M1.
`defineChunsik` e `poolSite` escono da `story/m1.js`.

## 4. Le chiamate 17 e 18 (`story/kkachi.js`)

- **17 · `a3-gyeongbu`**: «Quattrocento chilometri e non cambia niente…». Il copione la copiava da Ko, M10,
  ma Ko quella frase non la diceva: la regola 3 vuole che l'originale esista, e così **Ko adesso la dice**,
  in M10, all'officina. La chiamata aspetta M10 e scatta sulla Gyeongbu fuori dalle città (`sullaGyeongbu`,
  ±400 px dalla carreggiata). «Da solo» non è un controllo in più: con un passeggero a bordo 까치 tace già.
- **18 · `a3-busan`**: la prima volta a Busan **in auto e da soli**, a M9 finita. Dentro M9 c'è Chun-sik
  a bordo e la radio è muta; e «Diceva.» lo può dire solo chi ha sentito la confessione. Kkachi risponde
  «Dice.»: si corregge al contrario.

Le chiamate in tabella sono adesso **diciotto**.

## 5. Come si verifica

- `atto-3.scene`, **in coda**: Chun-sik di nuovo al suo posto dopo M10 e la sua riga al passato; la porta
  della sala, la sala vuota all'una, la sedia, le 03:31, i quattro pannelli, lui che se ne va e sparisce, il
  flag. Poi da capo: alle tre lui c'è già, gli si spara con la pistola vera, il conto dice `busan` e
  sopravvive a un giro di `snapshot`/`restore`. Fa due scatti in più (`g1b-1-sala`, `g1b-2-se-ne-va`).
- `atto-2.scene`, in M8: intoccabile prima dei pannelli, poi cammina, e colpito conta `m8`. La voce
  `m8DulchaeSeNeVa` ha cambiato significato: prima voleva dire «sparito», adesso vuol dire «cammina».
- `kkachi.scene`: la 17 non parte prima di M10, parte dopo; la 18 parte a Busan e si corregge al contrario.
- `cutscene-sheet` e `cutscene-panel` accettano `terminale`. Le miniature hanno mostrato che in tre tavole
  su quattro il riquadro delle battute copriva le figure e le mani: la composizione adesso sta nella metà
  alta.

## 6. Cose da sapere

- **Il viaggio vero da Seoul a Busan per la 17** non è provato: la scena teletrasporta sulla carreggiata.
- **La sala non ha il sonoro**: niente `bed` sui quattro pannelli. Se un giorno ci sarà un ronzio del
  distributore, è da misurare come in §5.37.
- Il distributore della pianta (`vend`) è quello generico di tutti gli interni; nei pannelli è rosso.
