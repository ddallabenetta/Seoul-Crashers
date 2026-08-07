# Geografie dedicate e metro fisica

> §5.23 del progetto. Corregge ed estende il §5.22; indice generale e mappa dei rimandi:
> [HANDOFF.md](../../HANDOFF.md).
>
> Stato storico precedente al §5.24: conteggi e geometria degli ingressi qui sotto descrivono
> la prima consegna delle mappe dedicate, non la revisione corrente.

### 5.23 — Tre mappe vere e una stazione da attraversare

Il primo passaggio regionale aveva raggiunto il contratto sistemico, non il risultato visivo:
Busan e Jeju adattavano la maglia di Seoul, la capitale cresceva soprattutto ai bordi e la metro
era un pannello aperto vicino a un marker. Questa tappa ricostruisce i tre punti senza cambiare
la compatibilità con traffico, negozi, polizia, salvataggi e viaggio.

**Seoul** passa da 5400×5400 a **7200×7200**: +77,8% di superficie. Quattro nuovi lobi
periferici portano strade, isolati, edifici e props dentro l'area aggiunta; la densità edilizia
per area totale cresce invece di diluirsi. N Seoul Tower, COEX Mall, Gyeongbokgung, DDP, Lotte
World Tower e City Hall sono volumi fisici garantiti. Il risultato deterministico conta 849
edifici, 234 isolati, 1991 props e un grafo di 306 nodi/479 archi.

**Busan** non importa né chiama `citygen`: il suo generatore 6400×5600 costruisce una maglia
costiera irregolare, Busan Bay, l'estuario del Nakdong, quattro ponti, colline, moli e quartieri
propri. Busan Tower, Jagalchi, Centum City, Haeundae, Gwangalli e Gwangan Bridge sono presenti
nel mondo. Il grafo finale ha 177 nodi e 300 archi connessi; ogni arco è campionato lungo la
campata e nessuno entra in acqua.

**Jeju** è un generatore autonomo 5400×5400. `isWater` chiude una superellisse su tutti e
quattro i lati, Hallasan alza il centro asciutto, le due città e le campagne condividono una
rete connessa di 294 nodi/425 archi e 399 edifici. I quattro bordi della mappa sono mare;
aeroporto, porto, Dongmun, Seongsan, Jeju City e Seogwipo hanno geometria propria.

Il contratto comune non impone più la geografia di Seoul. `GroundRenderer` e la texture della
carta campionano `city.isWater` per Busan e Jeju; la carta usa scale orizzontale e verticale
separate, necessarie per la Busan non quadrata. `regions.reindex` resta l'unico punto che
ricostruisce le griglie e aggiunge a tutte le 30 fermate un ingresso asciutto, libero e visibile.

**La metro ora è un luogo.** In strada si vede una scala con totem `M · 지하철`; `E` porta in
un interno 1080×720 condiviso dalle collisioni, con atrio, macchine T-money, tornelli, locali
tecnici, panche, banchina, binari, convoglio e uscita. Il giocatore deve percorrerlo: il pannello
delle tratte appare soltanto vicino alla porta del treno. `Game.interiorFloor` rende camera,
minimappa e collisioni indipendenti dal tipo di interno; `Game.leaveInterior` chiude in modo
coerente negozio o stazione durante viaggio, morte, arresto e caricamento.

Verifica finale: sintassi di tutti i moduli e `git diff --check`; generazione ripetuta identica
per le tre seed; firme topologiche differenti; 30/30 ingressi visibili e 30/30 arrivi asciutti e
liberi; perimetro di Jeju bagnato in 164 campioni; zero archi bagnati a Busan; percorso libero
dall'ingresso metro alla banchina. Nel browser sono stati provati ingresso visibile, interno,
tabellone in banchina, viaggio a Busan e Jeju e le tre carte regionali, senza errori console.

Restano nel §6 la persistenza dello stato locale delle regioni, un vero grafo delle linee e la
regia del tratto interurbano dopo l'imbarco (tariffa e sequenza KTX/traghetto/aereo).
