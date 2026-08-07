# Regioni e metro

> §5.22 del progetto. Indice generale e mappa dei rimandi: [HANDOFF.md](../../HANDOFF.md).
> Stato storico: topologie, dimensioni e metro sono stati sostituiti dal §5.23.

### 5.22 — Seoul estesa, Busan, Jeju e rete di viaggio

Il mondo non è più una singola istanza di Seoul. `world/regions.js` espone tre regioni
compatibili con lo stesso contratto di `citygen`: **Seoul**, **Busan** e **Jeju**, ciascuna
5400×5400 e completa di strade, grafo, rilievo, edifici, negozi, traffico, pedoni, polizia,
porto e aeroporto. Le geometrie e le texture della carta vengono create alla prima visita e
tenute in cache; le entità dinamiche restano streaming e vengono ricostruite all'arrivo.

**Seoul** ha ora landmark garantiti e distribuiti sull'intera area: N Seoul Tower, COEX Mall,
Gyeongbokgung, Dongdaemun Design Plaza, Lotte World Tower e City Hall, oltre ai riferimenti
della cintura di Incheon, Suwon, Bukhansan, Gyeonggi e Namyangju. La N Seoul Tower non dipende
più dall'esistenza casuale di un isolato abbastanza vicino al centro del Namsan.

**Busan** e **Jeju** usano seed distinte e adattatori regionali che clonano i distretti senza
toccare le definizioni globali. Busan comprende Busan Tower, Jagalchi, Centum City, Haeundae,
Gwangalli e l'identità del porto; Jeju comprende Hallasan, Dongmun Market, Seongsan
Ilchulbong, Jeju City, Seogwipo, aeroporto e terminal traghetti. Gli id canonici dei sette
distretti restano quelli storici, perché traffico, mercati e negozi li usano come chiavi.

La nuova `MetroSystem` pubblica un'azione contestuale vicino alle fermate, mostra una rete a
una o due colonne e permette sia spostamenti locali sia collegamenti Seoul–Busan–Jeju. I
tornelli restano chiusi con un livello di ricercato attivo. Il viaggio conserva protagonista,
inventario, denaro, statistiche e orologio; i collegamenti interurbani fanno avanzare il tempo.
Il salvataggio registra anche la regione e resta retrocompatibile: uno slot storico senza quel
campo viene interpretato come Seoul.

**Invarianti nuovi:** `city.stations` continua a significare commissariati; le fermate sono in
`city.transitStations`. Un adattatore può aggiungere volumi dopo `generateCity`, ma prima del
gioco `regions.js` deve ricostruire `buildingGrid`, `solidGrid`, `propGrid` e `blockGrid`. Le
coordinate editoriali di una fermata vengono agganciate al nodo stradale più vicino e ricevono
un punto `arrivalX/Y` libero da solidi e acqua entro 120 px.

Verifica finale: 424 edifici e 16 fermate a Seoul, 410 e 7 a Busan, 457 e 7 a Jeju; tutti i
landmark richiesti sono presenti, le 30 uscite sono entro i confini, asciutte e non murate, e
due generazioni consecutive restituiscono le stesse coordinate. Nel browser sono stati provati
Hongik–Samseong, Seoul–Busan e Busan–Jeju, comprese le tre mappe regionali, senza errori console.

Restano tre debiti espliciti, ora nel §6: le geografie di Busan e Jeju sono adattamenti della
topologia procedurale comune invece di coste disegnate apposta; lo stato locale di negozi e
interni non viene ancora conservato quando si lascia e si rivisita una regione; il viaggio è
un cambio scena immediato, senza tariffa né sequenza visibile di treno, traghetto o aereo.
