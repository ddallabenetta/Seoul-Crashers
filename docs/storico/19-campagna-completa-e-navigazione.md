# 5.30 — Campagna completa e navigazione delle missioni

La catena ora attraversa **M1-M12** e, dopo il flag `m12`, apre direttamente la scelta fra i
tre finali, i titoli e la scena dopo. I raccordi R1-R4 restano dentro le missioni che li
circondano, così non esistono capitoli vuoti creati solo per mostrare pannelli. Un salvataggio
vecchio fermo alla fine del contenuto disponibile riparte dal primo capitolo non concluso.

La frequenza **91.45 · 까치** è una stazione virtuale sempre disponibile: 24 chiamate con
predicato, dodici righe di servizio e contatori separati per ascoltate e perse. Spegnere o
cambiare stazione interrompe la chiamata; il finale C richiede almeno venti ascolti, la visita
facoltativa a Jo dopo M6 e Dulchae vivo in tutte e tre le occasioni previste dal copione.

I cortili conquistati da M5 vivono in `ShopSystem`, modificano prezzi e commercio e vengono
salvati. Il formato è salito alla versione 5 con migrazioni per proprietà dei turf e stato
Kkachi.

La mappa usa due livelli intenzionalmente diversi:

- la **carta completa** mostra tutte le destinazioni note della fase (`mapPoints`);
- la **minimappa** conserva un solo blip attivo e gli disegna sotto il percorso A* sul grafo
  stradale. Se le componenti non sono collegate — Jeju rispetto alla penisola — non inventa
  una linea attraverso il mare.

Il check puro `.claude/tools/check-campaign.mjs` difende catena, id delle fasi, 24 chiamate,
condizioni del finale C e connettività Seoul-Busan/Jeju. La scena browser
`missioni-run.scene` continua a difendere il blip singolo e ora verifica anche punti carta e
rotta.
