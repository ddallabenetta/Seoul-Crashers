# La regia sonora dei pannelli

> §5.37 del progetto. Indice generale e mappa dei rimandi: [HANDOFF.md](../../HANDOFF.md).

### 5.37 — Tappa T6 del rework: i pannelli hanno un suono

Il backlog della tappa D lasciava una voce: «la regia sonora dell'apertura». Il copione
([`02-cutscene-iniziale.md`](../storia/02-cutscene-iniziale.md)) la chiedeva fin dall'inizio — fruscio di
banda, cane, sirena — ma il lettore di pannelli (§5.28) non parlava con l'audio se non per
`ui('move'/'close')`.

**Il meccanismo.** Due campi opzionali sul pannello; senza, un pannello si comporta come prima
(spegne i letti di scena e non suona niente).

| Campo | Cosa fa |
| --- | --- |
| `bed: { kkachi, sirenFar }` | guadagni dei letti, **tenuti finché il pannello è a schermo**; al cambio pannello salgono o scendono con una rampa di 0,3 s. `kkachi` è la scala di `beds.kkachi` in strada (0,02 sotto una battuta, 0,05 nei silenzi) |
| `sfx: [{ at, kind, vol }]` | colpi a `at` secondi dall'inizio del pannello. Oggi `kind` è solo `'dog'` |

`Cutscene.enter` (nuovo) li legge in `play` e a metà stacco; `update` suona i colpi scaduti.
`audio.scene(levels)` imposta `sceneLv`, che `updateBeds` legge **senza passare dal `duck`**
della modalità (0,12: il mondo non c'è, ma questi *sono* la scena): il fruscio resta sotto
`mix.radio` come in strada, la sirena no. `sceneStop()`, chiamato da `skip` e da `finish`,
azzera i letti con costante 0,04 s e chiude `sceneBus` (da cui passano tutti i colpi di scena),
quindi anche un latrato già partito muore con `ESC`.

**Tre suoni.** Il fruscio è `beds.kkachi`, quello di sempre. Il **cane** (`audio.dog`) è tre
latrati a sega scivolanti (520→300 Hz) più un soffio di banda, passa-basso a 1,1 kHz, ognuno con
un'eco di vicolo a 0,21 s al 30%; entra nel convolutore dello spazio da `sfx`. La **sirena
lontana** è un letto nuovo (`beds.sirenFar`): un triangolo con lamento lento (0,32 Hz, ±170 Hz)
e passa-basso a 900 Hz. Non è `beds.siren` ridotta: quella è la caccia, tiene il Doppler
dell'auto più vicina ed è legata a `updatePolice`.

**Dove sta ogni suono, e perché** (riga del copione):

| Pannello | Suono | Dal copione |
| --- | --- | --- |
| 1 | fruscio 0,05 · cane a 8,6 s | «Fruscio di banda» e «alla terza [conta]… un cane che abbaia lontano»; la conta dura 3,75 s, la terza comincia a 7,5 s. **Scelta nostra:** il copione non dà un secondo. Se il giocatore avanza prima il cane non suona (torna nel 27) |
| 8 | fruscio 0,04 | «Fruscio. Una sillaba, mangiata.» |
| 23 | sirena lontana 0,015 | «Passa una volante, rallenta, non si ferma.» **Scelta nostra:** quanto lontana |
| 25 | fruscio 0,035 | «si accende il quadro, e con lui la radio» |
| 26 | fruscio 0,02 | non è nel copione: le battute di Kkachi sono lette, e il fruscio sotto è quello che resta in strada con una riga a schermo |
| 27 | cane a 1,6 s | «lo stesso cane del pannello 1» attraversa il vicolo |

M3 e M4 non sono agganciate: il copione dell'atto non dà un momento ovvio, e la parsimonia
era richiesta. Il meccanismo è lì, per chi vuole.

**Numeri** (`cutscene-audio.scene`, master, musica del tema chiusa; fondo dei pannelli muti
rms 0,002): pannello 1 rms 0,011 picco 0,13 (il cane) · 8 rms 0,006 · 23 rms 0,012 (prima della
taratura a 0,015 era 0,025: più del fondo urbano 0,015, per una cosa lontana) · 25 rms 0,005 ·
26 rms 0,0035 · 27 picco 0,13. Il massimo è metà di una pistola (0,30). Dopo `ESC`, 0,3 s dopo,
l'rms è tornato a 0,002-0,0027, cioè al fondo.

**Limite noto.** I letti di scena sono mono e a livello fisso: una volante che *passa* non ha
inviluppo. Se serve, `sfx` può prendere un kind `'sirenFar'` a inviluppo con panning.
