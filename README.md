# Seoul Crashers · 서울 크래셔스

Gioco d'azione top-down 2.5D ambientato a Seoul, nello spirito di *GTA: Chinatown Wars*.
Canvas 2D puro, moduli ES, zero dipendenze: tutta la grafica è generata da codice.

## Avvio

Serve un server statico (i moduli ES non funzionano da `file://`):

```bash
python3 -m http.server 8123 --directory /Users/danieldallabenetta/Documents/seoul_crashers
```

Poi apri <http://localhost:8123>.

## Comandi

| Tasto | Azione |
| --- | --- |
| `W A S D` / frecce | muoversi a piedi · guidare |
| `Shift` | correre |
| `Spazio` | freno a mano (drift) |
| `E` | salire / scendere dal veicolo |
| `H` | clacson |
| **mouse** | mirare (a piedi si guarda sempre il cursore) |
| **click sinistro** | sparare / colpire · alla guida, drive-by con le armi leggere |
| `1` `2` `3` `4` | pugni · mazza · pistola · SMG (rotella per scorrere) |
| `M` | mappa a tutto schermo (rotella = zoom, trascina = sposta) |
| `ESC` | menu di pausa (mappa, comandi, statistiche) |
| `F3` | pannello tecnico (fps, entità, posizione) |

Armi e munizioni si raccolgono a terra, nei cortili e nei vicoli. A zero salute ci si
risveglia davanti all'ospedale del distretto più vicino — con la salute piena e senza
più un'arma.

## La lore

**Jae-min Seo** torna a Seoul dopo dodici anni a Los Angeles, per il funerale di suo padre —
un boss caduto in disgrazia della gang **Baekho** (백호, "tigre bianca"). La versione ufficiale
parla di un incidente sul lavoro ai moli di Incheon. La versione vera è che qualcuno lo ha
venduto a un consorzio immobiliare che sta ripulendo i quartieri vecchi con la scusa della
riqualificazione: prima gli sgomberi, poi le gru, poi le torri di vetro di Gangnam.

Tre atti, dodici missioni, cinque quartieri: dai vicoli di Hongdae fino ai piani alti dove
il crimine indossa un completo. (Missioni e cutscene a fumetti arrivano nella fase 3 —
vedi *Stato* più sotto.)

## I quartieri

| Distretto | Carattere | Palette |
| --- | --- | --- |
| **Hongdae** 홍대 | vicoli, murales, indie club | neon rosa |
| **Myeongdong** 명동 | insegne, folla, contanti | rosso e oro |
| **Itaewon** 이태원 | bar internazionali, favori e debiti | ambra |
| **Gangnam** 강남 | vetro, chaebol, soldi puliti | ciano |
| **Docks di Incheon** 인천 부두 | container, gru, niente testimoni | giallo industriale |

Il **fiume Han** taglia la città in orizzontale con tre soli ponti — passaggi obbligati,
utili quando la polizia comincia a mettere posti di blocco. **Namsan** con la N Seoul Tower
è la collina al centro, visibile da mezza mappa grazie all'estrusione: il terreno sale
davvero salendo verso di essa, e l'auto se ne accorge.

## Come è fatto

```
index.html
src/
  core/      loop a passo fisso, input, RNG deterministico, griglie spaziali
  world/     generazione città, grafo stradale, distretti, texture mappa
  render/    camera 2.5D, sprite vettoriali, facciate, terreno a tile, effetti
  entities/  giocatore, fisica veicoli, traffico, pedoni
  ui/        HUD e minimappa, mappa a tutto schermo, menu di pausa
```

Alcune scelte tecniche che spiegano il risultato a schermo:

- **Profondità 2.5D.** Ogni volume viene proiettato verso l'esterno dello schermo in
  proporzione alla propria altezza (`offset = (pos − camera) · h / 880`). Le facciate restano
  parallelogrammi, quindi si possono texturizzare con una singola trasformazione affine del
  contesto: un `fillRect` col gradiente della tinta + un overlay di finestre riusabile per
  tutte le tinte. Gli oggetti alti vengono ordinati per distanza radiale dal centro camera e
  disegnati dal più lontano al più vicino.
- **Terreno a tile.** Asfalto, marciapiedi, segnaletica e fiume sono pre-renderizzati in
  riquadri da 512 px con cache LRU: una mappa 4200×4200 non si ridisegna ogni frame.
- **Maglia stradale irregolare.** Le vie non sono una scacchiera: ogni linea esiste o no
  cella per cella, e da quel dato solo derivano superblocchi (isolati fusi), disassamenti
  (una via si interrompe su un'arteria e riprende spostata) e l'interruzione sul fiume.
  Il passo segue il distretto — fitto a Hongdae, largo a Gangnam e ai moli.
- **Rilievo.** Un campo di quota deterministico (il Han è il punto più basso, Namsan il
  rilievo dominante) ombreggia il terreno in base alla pendenza, alza i volumi in proiezione
  e agisce sulla fisica: in salita si perde velocità, in discesa si guadagna.
- **Sprite generati.** Veicoli, pedoni e arredo urbano sono disegnati con path su canvas
  offscreen a 2× e messi in cache: nessun asset esterno, nitidezza a qualsiasi zoom.
- **Traffico su grafo.** Nodi negli incroci, archi con corsie (guida a destra), semafori a
  ciclo sfasato e **prenotazione dell'incrocio per asse**, che è ciò che evita i blocchi
  reciproci dove non c'è semaforo. Chi resta incastrato manovra in retromarcia e riprende la
  corsia.
- **Streaming.** Veicoli e pedoni compaiono appena fuori dal rettangolo inquadrato e si
  dissolvono a distanza, con densità e tipologie decise dal distretto.
- **Fisica arcade.** Velocità del motore lungo il muso + vettore velocità che la inseguе con
  grip laterale: la differenza tra i due è il drift. Freno a mano quasi azzera il grip.
  Collisioni a tre cerchi per scafo, urti morbidi a bassa velocità e pieni negli schianti.
- **Fuoco hitscan con magnetismo.** I colpi sono raggi risolti nello stesso frame contro
  muri, pedoni e veicoli; quello che vola è solo il tracciante. La direzione del cursore viene
  piegata di pochi gradi verso il bersaglio più allineato — abbastanza da non mancare un
  pedone a mezzo isolato, troppo poco per sostituirsi alla mira.
- **Scalinate.** Un vicolo passante troppo ripido diventa una scalinata: stessa geometria di
  prima più un solido che ferma le ruote e lascia passare i piedi. È la scorciatoia che le
  auto non possono seguire.

## Stato

**Fase 1 — completata.** Città esplorabile, guida, traffico, pedoni, camera 2.5D, minimappa
e mappa, menu, effetti (gomma, fumo, scintille, esplosioni), statistiche.

**Fase 1.5 — completata.** Urbanistica dinamica (superblocchi, passo per distretto,
disassamenti, vicoli passanti) e rilievo (quota, ombreggiatura, volumi più alti in collina,
fisica della pendenza).

**Fase 2, tappa A — completata.** Scalinate pedonali, mira col mouse, pugni · mazza ·
pistola · SMG, drive-by, raccolte a terra, salute e morte con risveglio all'ospedale,
pedoni che scappano agli spari e teppisti che rispondono al fuoco, sangue persistente e
ragdoll.

**Fase 2, tappe B e C — da fare.** Sistema di ricercato a 5 livelli (pattuglie, volanti,
speronamenti, posti di blocco e chiodi, SWAT ed elicottero), poi armi pesanti ed esplosivi.

**Fase 3 — da fare.** Le 12 missioni con cutscene a fumetti, negozi (armi, garage, ospedale),
mercato nero dinamico, attività secondarie, ciclo giorno-notte e meteo, audio procedurale,
salvataggio su localStorage.
