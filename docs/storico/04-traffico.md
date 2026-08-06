# Il traffico si muove bene

> §5.10 del progetto. Indice generale e mappa dei rimandi: [HANDOFF.md](../../HANDOFF.md).

### 5.10 Il traffico si muove bene

Chiude la segnalazione dell'utente (§4bis). Misurato su 170 s in cinque zone diverse, due
esecuzioni per albero, fianco a fianco con `main`:

| | `main` | adesso |
| --- | --- | --- |
| urti al minuto | 235–266 | **36–40** (−85%) |
| di cui tamponamenti (su 170 s) | 358–414 | **6–8** (−98%) |
| di cui laterali all'incrocio | 149–155 | 42–45 |
| di cui frontali | 79–83 | 4–7 |
| di cui contro un solido | 51–67 | 39–52 |
| flusso mediano, px/min per veicolo | 4047–4245 | 3450–3811 (−13%) |
| veicoli praticamente fermi | 0–5 su ~230 | 11–12 su ~190 |

**Quello che resta indietro, detto chiaro:** il flusso mediano è ~13% sotto `main` e c'è un 6%
di veicoli che in mezzo minuto non si muove, contro l'1% di prima. Non sono ingorghi eterni —
guardati a schermo sono code al semaforo che si smaltiscono — ma è il prezzo che si paga per
avere auto che si cedono il passo invece di attraversarsi. Se qualcuno vuole ridurlo, le due
leve misurate sono il ciclo del semaforo e il sorpasso (§6), non la distanza di sicurezza.

**La causa era una sola riga di geometria.** La distanza di sicurezza si misurava fra i centri
dei due veicoli, non fra le carrozzerie: una berlina è lunga 78 px, quindi la frenata
cominciava a paraurti in contatto. Il 78% dei veicoli si dichiarava `libero` nell'istante in
cui tamponava. Corretto questo, i tamponamenti sono spariti (110 → 4 sulla prima misura) — e
sono emersi tutti i difetti che il caos precedente nascondeva, perché le auto hanno cominciato
a fare **code vere** invece di attraversarsi a vicenda. Sono in §4, uno per riga; qui c'è il
perché delle scelte, che è quello che serve per cambiarle:

- **Una legge di inseguimento invece di un fattore di frenata.** Si punta alla velocità di chi
  sta davanti, corretta dall'errore di distanza (`lead + (gap − want) × 2.6`). Moltiplicare la
  velocità desiderata per quanto spazio manca — quello che si faceva prima — è instabile: chi
  frena troppo fa frenare di più chi ha dietro, e la coda si ferma da sola senza che davanti ci
  sia niente. È la differenza fra una coda che scorre e una che pulsa.
- **Tre regole all'incrocio, e servono tutte.** «C'è posto di là?» (`boxBlocked`), «è il mio
  turno?» (prenotazione d'asse, **solo dove non c'è semaforo**), e un limite di tempo che le
  sblocca entrambe. Senza la prima l'incrocio si tappa; senza la terza si arriva a uno stallo
  di cortesia in cui ognuno cede il passo a chi gli sta cedendo il passo — e su una maglia
  fitta, dove l'uscita di un incrocio è già la coda di quello dopo, succede subito.
- **Il traffico è sceso da 54 a 44 veicoli.** Non è una resa: con una distanza di sicurezza
  vera, 54 auto nell'anello di streaming chiedono agli incroci semaforizzati più di quello che
  riescono a smaltire in un ciclo, e le code crescono finché non si smaltiscono più. Misurato:
  a 48 il flusso mediano cala del 23%, a 44 del 6%. Il limite di capacità sta lì in mezzo. Se
  si vuole più densità, la leva vera è il ciclo del semaforo, non `MAX_TRAFFIC`. §5.12 l'ha poi
  misurata: accorciarlo non dà niente, allungarlo fa danni.
- **La manovra di sblocco guarda dove va.** Prima indietreggiava con sterzo casuale: in coda
  innescava la carambola successiva, contro un palazzo rompeva la macchina e restava incastrata
  lo stesso. Ora controlla veicoli e solidi dietro; se è chiuso forza il passaggio
  nell'incrocio invece di indietreggiare, e alla terza volta indietreggia comunque ma piano —
  una spinta gentile a chi sta dietro costa un urto leggero, restare incastrati costa quella
  strada per il resto della partita.
- **La polizia ha preso solo la correzione geometrica** (`police.followRoads`): le volanti
  frenano per chi hanno davvero davanti, ma restano senza la prudenza del traffico civile, che
  è metà del carattere di un inseguimento. Verificato che a cinque stelle arrivino agenti,
  volanti, posti di blocco ed elicottero, e che `wanted.reset()` li smonti tutti.

**Provato e scartato: il sorpasso.** Un'arteria ha due corsie per senso e nessuno le usa, così
dietro al primo furgone lento resta incolonnata mezza città. Implementato (cambio corsia con
scivolamento su `laneOffset` frazionario, tre punti di controllo sulla corsia di fianco) e
**misurato peggiore**: flusso mediano da 3311 a 2191 px/min e da 1 a 9 veicoli fermi. Le auto
si spostano tutte nella corsia libera, si ritrovano affiancate all'incrocio dove le due corsie
si riuniscono, e il guadagno sul rettilineo si perde tutto lì. Se qualcuno ci riprova, il pezzo
che manca è la scelta della corsia **in funzione della svolta successiva**: senza quella, il
sorpasso è un debito che si paga all'incrocio dopo.
