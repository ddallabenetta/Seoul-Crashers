# HANDOFF — Seoul Crashers

Punto d'ingresso per riprendere il lavoro da una sessione pulita. **Questo file è l'indice:
resta corto apposta.** Il contenuto vero sta in `docs/`, e si apre un documento alla volta —
non tutti. Il `README.md` descrive il gioco e i comandi; qui c'è quello che serve a
*sviluppare*. Avvio e vincoli stanno in `CLAUDE.md`, che si carica da solo.

Ultimo aggiornamento: **tappa G1b** (PR #31, §5.46): le sedie arancioni di Busan, Chun-sik dopo M9, il conto
delle occasioni su Dulchae, le chiamate 17 e 18. Prima, il rework della PR #30 (§5.34-5.45) e le tappe §5.8-5.33.

> 📌 **Il prossimo lavoro è la tappa G2**: M11, R4, M12 e le chiamate 19-24 dell'Atto III. Poi **H** (i tre
> finali, i titoli di coda, la scena dopo). L'elenco con cosa contiene ogni tappa e come si prova sta **in testa a
> [`docs/backlog.md`](docs/backlog.md) (§6.0)**; le decisioni d'impianto prese con l'utente in
> [`docs/storia/08-domande-aperte.md`](docs/storia/08-domande-aperte.md).
>
> **Una tappa, un ramo da `main`, una PR**, che si chiude quando la tappa passa le sue scene. È la regola nata
> dalla PR #30, rimasta aperta un mese con dentro undici tappe. Chi scrive una missione parte da §5.29 e §5.33
> (un file sotto `src/story/`, una riga in `story/campaign.js`) e allunga `atto-3.scene` in coda; chi scrive una
> battuta di Kkachi da §5.32, con la sua `// origine:`; chi disegna pannelli da §5.28, e li guarda con
> `cutscene-sheet` e `cutscene-panel` *prima* di dire che funzionano.

---

## Dove sta cosa

| Se devi… | Apri |
| --- | --- |
| far girare il gioco e verificare una modifica, o capire perché "non cambia niente" | [`docs/verifica.md`](docs/verifica.md) |
| toccare rendering, città, grafo, traffico, armi, interni — o trovare un file | [`docs/architettura.md`](docs/architettura.md) |
| diagnosticare un comportamento strano — **prima di indagare da zero** | [`docs/trappole.md`](docs/trappole.md) |
| tarare un numero (velocità, densità, danno, luce, audio, maglia) | [`docs/parametri.md`](docs/parametri.md) |
| sapere cosa viene dopo e cosa è già stato deciso | [`docs/backlog.md`](docs/backlog.md) |
| scrivere o implementare una missione, una cutscene, un dialogo | [`docs/storia/`](docs/storia/) — è l'indice: apri **un capitolo alla volta**, sono ~2900 righe |
| scrivere una data, un'età o un conteggio dentro una scena | [`docs/storia/10-continuita.md`](docs/storia/10-continuita.md) **prima** di scriverla |
| disegnare un pannello, un personaggio a pixel o una nuova espressione | `docs/storico/17-pannelli-e-cutscene.md` (§5.28) |
| **implementare una missione**: fasi, blip, punti, dialoghi, ripresa | `docs/storico/18-missioni-m1-m2.md` (§5.29) |
| disegnare su mappa o minimappa, o toccare il percorso verso il blip | `docs/storico/19-itinerario-sulla-carta.md` (§5.30) |
| toccare la proprietà di un cortile, il suo banco o la sua busta | `docs/storico/20-cortili-persistenti.md` (§5.31) |
| dare un suono a un pannello (fruscio, cane, sirena lontana) | `docs/storico/26-regia-sonora.md` (§5.37) |
| **toccare gli estremi delle strade**, le testate dei vicoli ciechi, il terreno attorno alle città o il bordo del mondo | `docs/storico/27-cuciture-della-mappa.md` (§5.38) |
| toccare la corsia, il cambio corsia o il car-following del traffico | `docs/storico/23-sorpasso.md` (§5.34) |
| toccare le **sirene sul traffico**, il clacson, come i pedoni attraversano o perché finiscono nelle lamiere | `docs/storico/25-la-strada-reagisce.md` (§5.36) |
| toccare l'**arresto**: manette, agente che accompagna, volante che parte, `ESC` | `docs/storico/24-arresto-in-volante.md` (§5.35) |
| **rifare la geografia** di Busan o Jeju, aggiungere un luogo nominato, una strada, un ponte | `docs/storico/30-busan-e-jeju.md` (§5.41) |
| **arredare** un parco, un campo, un molo o un marciapiede; aggiungere insegne o un tipo di prop | `docs/storico/28-vita-negli-isolati.md` (§5.39) |
| **pedinare qualcuno**, far portare un oggetto, mandare un'auto in un posto | `docs/storico/22-atto-i-completo.md` (§5.33) |
| **contare cortili**, far leggere dei faldoni, un punto fisso come «Jo dopo M6», le chiamate dell'Atto II | `docs/storico/29-atto-ii-m5-m6-r2.md` (§5.40) |
| **una cella o un cortile percorribili**, far arrestare apposta, **pedinare a piedi** nella folla, mettere un'altra stanza dietro una porta vera | `docs/storico/31-atto-ii-m7-m8-r3.md` (§5.42) |
| **un passeggero che parla mentre si guida**, la nebbia, una corsa in barca con le motovedette, un carico che cade a riva | `docs/storico/32-atto-iii-m9-m10.md` (§5.43) |
| **un incontro senza missione** in un interno inventato, un punto fisso che fa qualcosa da solo, **contare le occasioni su Dulchae** | `docs/storico/35-sedie-arancioni.md` (§5.46) |
| misurare quanto costa un frame per sistema, o aggiungere una modalità che si prende l'intero frame | `docs/storico/34-engine-e-prestazioni.md` (§5.45) |
| sapere com'è il gioco a schermo, sistema per sistema, senza aprire il codice | [`docs/il-gioco-oggi.md`](docs/il-gioco-oggi.md) |
| **toccare come la polizia raggiunge il giocatore** (A* sul grafo, ricalcolo a scaglioni) o le **guardie del cortile tuo** (scorta, difesa) | `docs/storico/33-polizia-e-guardie.md` (§5.44) |
| **scrivere una battuta di Kkachi**, o toccare la radio e la `91.45` | `docs/storico/21-kkachi.md` (§5.32) |
| verificare headless, usare `probe.mjs`, le scene o le skill | [`docs/strumenti.md`](docs/strumenti.md) |
| capire *perché* una parte esistente è fatta così | [`docs/storico/`](docs/storico/) |

## I rimandi `§` — quale file contiene cosa

I documenti conservano la numerazione originale, quindi ogni `(§5.10)` sparso nel testo e nei
commenti resta valido: si risolve qui.

| § | File |
| --- | --- |
| §1 Contesto | qui sotto |
| §1 Avvio · §7 Vincoli e convenzioni | `CLAUDE.md` |
| §1 Verifica rapida | `docs/verifica.md` |
| §2 Mappa dei file · §3 Concetti | `docs/architettura.md` |
| §4 Trappole · §4bis | `docs/trappole.md` |
| §5.1–5.3 Urbanistica e rilievo | `docs/storico/01-urbanistica-e-rilievo.md` |
| §5.4–5.7 Fase 2 (combattimento, polizia, arsenale) | `docs/storico/02-fase-2-combattimento-polizia-arsenale.md` |
| §5.8–5.9 Negozi, interni, mappa | `docs/storico/03-fase-3-negozi-interni-mappa.md` |
| §5.10 Traffico | `docs/storico/04-traffico.md` |
| §5.11 Giorno-notte e meteo | `docs/storico/05-fase-3-giorno-notte-e-meteo.md` |
| §5.12 Giro di arretrati | `docs/storico/06-giro-di-arretrati.md` |
| §5.13–5.14 Audio e radio | `docs/storico/07-audio-e-radio.md` |
| §5.15–5.17 Salvataggio, arresto, lamiera | `docs/storico/08-salvataggio-arresto-lamiera.md` |
| §5.18–5.20 Menu, musica, autosave | `docs/storico/09-menu-musica-autosave.md` |
| §5.21 Secondo giro di arretrati | `docs/storico/10-secondo-giro-di-arretrati.md` |
| §5.22 Regioni e metro | `docs/storico/11-regioni-e-metro.md` |
| §5.23 Geografie dedicate e metro fisica | `docs/storico/12-geografie-dedicate-e-metro-fisica.md` |
| §5.24 Strade libere, metro viva e confini | `docs/storico/13-strade-metro-confini.md` |
| §5.25 Mappa unica della Corea | `docs/storico/14-mappa-unica-corea.md` |
| §5.26 Vita degli NPC | `docs/storico/15-vita-degli-npc.md` |
| §5.27 Impianto della campagna | `docs/storico/16-impianto-della-campagna.md` |
| §5.28 Pannelli, pixel art e cutscene iniziale | `docs/storico/17-pannelli-e-cutscene.md` |
| §5.29 Impianto missioni, M1, M2 e il 병원 | `docs/storico/18-missioni-m1-m2.md` |
| §5.30 Itinerario sulla carta | `docs/storico/19-itinerario-sulla-carta.md` |
| §5.31 Cortili persistenti | `docs/storico/20-cortili-persistenti.md` |
| §5.32 까치 sulla `91.45` | `docs/storico/21-kkachi.md` |
| §5.33 L'Atto I completo: M3, M4, R1, pedinamento e fogli | `docs/storico/22-atto-i-completo.md` |
| §5.34 Il sorpasso: corsia in base alla svolta | `docs/storico/23-sorpasso.md` |
| §5.35 L'arresto in volante | `docs/storico/24-arresto-in-volante.md` |
| §5.36 La strada reagisce: sirene, clacson, attraversamenti | `docs/storico/25-la-strada-reagisce.md` |
| §5.37 La regia sonora dei pannelli: `bed` e `sfx` | `docs/storico/26-regia-sonora.md` |
| §5.38 Le cuciture della mappa: spuntoni, testate, fascia scura, bordi del mondo | `docs/storico/27-cuciture-della-mappa.md` |
| §5.39 Vita negli isolati: tipologie di parchi e campi, arredo, insegne, moli | `docs/storico/28-vita-negli-isolati.md` |
| §5.40 L'Atto II, prima metà: M5, M6, R2, tre chiamate di 까치, Jo dopo M6 | `docs/storico/29-atto-ii-m5-m6-r2.md` |
| §5.41 La forma di Busan e Jeju: coste a maschera, strade da tracciati, luoghi dell'Atto III | `docs/storico/30-busan-e-jeju.md` |
| §5.42 L'Atto II, seconda metà: M7, M8, R3, cinque chiamate di 까치, il commesso dopo M8 | `docs/storico/31-atto-ii-m7-m8-r3.md` |
| §5.43 L'Atto III, prima parte: M9, M10, il passeggero, la nebbia, le motovedette | `docs/storico/32-atto-iii-m9-m10.md` |
| §5.44 Polizia e guardie: volanti con A*, guardie del cortile tuo che ti scortano | `docs/storico/33-polizia-e-guardie.md` |
| §5.45 Engine e prestazioni: `costo.scene`, quattro risparmi, modalità che si prendono il frame | `docs/storico/34-engine-e-prestazioni.md` |
| §5.46 Le sedie arancioni, Chun-sik dopo M9, il conto su Dulchae, le chiamate 17 e 18 | `docs/storico/35-sedie-arancioni.md` |
| §6 Backlog | `docs/backlog.md` |
| §8 Parametri | `docs/parametri.md` |
| §9 Strumenti (`.claude/`) | `docs/strumenti.md` |

---

## 1. Contesto in una pagina

Web game d'azione top-down 2.5D ambientato a Seoul, stile *GTA: Chinatown Wars*.
Canvas 2D puro, moduli ES nativi, **zero dipendenze, nessun build step**. Tutta la grafica
(sprite, facciate, terreno, mappa) è generata da codice a runtime: non esistono asset esterni.

Stato: Fasi 1, 1.5 e 2 complete; della Fase 3 sono fatti negozi e interni, mappa, giorno-notte,
audio, radio, salvataggio, menu e musica, le tre regioni nella mappa unica della Corea, la vita degli
NPC, l'impianto della campagna e **due atti e mezzo**: M1-M10 con R1, R2, R3 (§5.28-5.43) e l'incontro di
Busan (§5.46). Restano M11, R4, M12 e i finali (§6.0). ~50.000 righe in 94 moduli; 60 fps con ~44 veicoli e
~93 pedoni attivi, anche sotto raffica di SMG. Dove va il tempo di un frame lo dice `costo.scene` (§5.45);
i veli a schermo intero restano non misurabili onestamente in headless (§5.11).

**Com'è il gioco a schermo**, sistema per sistema, sta in [`docs/il-gioco-oggi.md`](docs/il-gioco-oggi.md).

---

## Come tenere in ordine questi documenti

Quando chiudi una tappa:

1. **Storico** → nuovo file `docs/storico/NN-nome.md` con la sezione `### 5.N` che avresti
   aggiunto qui, e una riga nella tabella dei rimandi qui sopra. Non riscrivere i file delle
   tappe passate: sono un archivio, e il loro valore è che nessuno li rilegge.
2. **Trappole** → una riga in `docs/trappole.md` per ogni bug che è costato una diagnosi.
3. **Parametri** → una riga in `docs/parametri.md` per ogni costante nuova da tarare.
4. **Architettura** → aggiorna `docs/architettura.md` solo se hai cambiato un *meccanismo*
   (un modulo nuovo, un invariante nuovo), non per ogni feature.
5. **Backlog** → togli quello che hai fatto, aggiungi quello che è emerso.
6. **Qui** → aggiorna «Ultimo aggiornamento» e il riquadro 📌, e aggiungi il paragrafo della tappa in
   `docs/il-gioco-oggi.md`, non qui. Se questo file supera ~140 righe, quello che hai aggiunto va in `docs/`.

Regola generale: ogni fatto sta in **un** posto solo. Se ti viene da copiarlo, mettici un
rimando — la numerazione `§` serve a questo.
