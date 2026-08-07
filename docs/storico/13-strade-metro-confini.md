# Strade libere, metro viva e confini rifiniti

> §5.24 del progetto. Rifinisce il §5.23; indice generale e mappa dei rimandi:
> [HANDOFF.md](../../HANDOFF.md).

### 5.24 — La geometria visibile diventa geometria di gioco

La prima metro fisica usava ingressi non solidi e li validava attorno al centro della strada:
un totem poteva quindi coprire una corsia pur risultando lontano dall'asse. Anche alcuni
volumi procedurali e arredi sconfinavano sull'asfalto. `roadclearance.js` introduce un unico
test rettangolo-carreggiata basato su larghezza e segmenti attivi; i generatori lo usano alla
fonte e `regions.reindex` resta la rete di sicurezza comune. Ogni uscita è ora un volume
86×58 orientato sul fronte stradale, indicizzato in `solidGrid`, separato dalle altre uscite e
accompagnato da un punto di arrivo asciutto, libero e fuori strada.

La stazione 1080×720 non è più vuota: dieci passeggeri seguono percorsi deterministici fra
atrio, tornelli e banchina, mentre un negoziante resta al chiosco. Il chiosco è solido e vende
김밥 e caffè per ₩2.500, ripristinando 22 HP e la stamina. Uscendo si torna al punto libero dal
quale si era entrati, non al centro ormai solido della scala.

Il bordo giocabile ha adesso una responsabilità condivisa. Quattro collider larghi 64 px
impediscono a giocatore, pedoni e veicoli di abbandonare la mappa; il renderer continua fuori
campo con mare o vegetazione, aggiunge una fascia verde e guardrail sui bordi terrestri e
costruisce battigia, rocce e schiuma sulle coste regionali. La carta sostituisce il vecchio
riquadro nero con una cornice geografica doppia e tacche di orientamento.

Con le seed correnti, dopo la validazione comune, Seoul conta 842 edifici, 1987 props, 234
isolati, 240 negozi/658 attività e un grafo 306/479; Busan 741 edifici, 1456 props, 150 isolati,
140 negozi/320 attività e 177/300; Jeju 377 edifici, 1376 props, 226 isolati, 129 negozi/230
attività e 294/425. I volumi rimossi erano soltanto procedurali o arredo invadente: landmark,
negozi e reti restano integri.

Verifica finale: sintassi e `git diff --check`; cinque seed ciascuna per i generatori autonomi;
grafi connessi; generazione deterministica; zero edifici ordinari e zero props solidi sulla
carreggiata; 30/30 ingressi solidi e fuori strada; 30/30 arrivi asciutti, liberi e fuori strada;
quattro collider di bordo per regione. Nel browser sono stati provati ingressi a Seoul, Busan
e Jeju, acquisto al chiosco, movimento dei passeggeri, bordo terrestre di Seoul, costa est di
Jeju e nuova cornice della carta, senza errori console.
