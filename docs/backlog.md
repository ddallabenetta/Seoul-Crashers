# Backlog

> §6 del progetto. Indice generale e mappa dei rimandi: [HANDOFF.md](../HANDOFF.md).

## 6. Backlog successivo (già concordato con l'utente)

**Fase 3 — contenuti.** Negozi e interni (§5.8), la mappa (§5.9), il ciclo giorno-notte
(§5.11), il giro di arretrati (§5.12), il salvataggio (§5.15), l'arresto (§5.16), il menu
iniziale (§5.18), la musica (§5.19) e l'autosave (§5.20) sono fatti; la segnalazione sul
traffico è chiusa (§5.10) e quella sulle auto attraversabili pure (§5.17).
**Restano le missioni**, che sono il lavoro grosso: impianto (attivazione sulla mappa,
obiettivi, fallimento e ripetizione), cutscene a pannelli a fumetto, e i contenuti. **Le scelte
di design vanno concordate con l'utente prima di scrivere codice** — è la prima cosa da chiedere
in apertura di sessione.

Quello che segue è quanto resta indietro, in ordine di quanto si sente. È molto più corto di
prima: il §5.12 ha pagato diciannove voci di questo elenco, il §5.13 ha chiuso l'audio, il
§5.15-5.16 le due voci che stavano in cima e il §5.18-5.20 le tre che le avevano sostituite.

**Le cose che si sentono di più, oggi:**
- **I pedoni attraversano le auto in sosta.** Il giocatore no, dal §5.17. Per loro non basta
  la stessa spinta: uno che si incastra contro una macchina parcheggiata mentre attraversa la
  strada resta lì per sempre, e serve aggirarla — che è lavoro di steering. È la cosa più
  visibile che resta a schermo.
- **Non ti caricano in volante.** L'arresto c'è (§5.16), ma è uno stacco: manette, nero,
  commissariato. Vedere l'agente che ti ammanetta e la volante che parte vorrebbe
  un'animazione e un pezzo di regia della camera.

**Rimasto indietro dal salvataggio** (§5.15, §5.18, §5.20):
- **La folla degli interni non si ricorda i clienti stesi**: il personale sì, chi era di
  passaggio no (§5.15).
- **Dal menu di pausa non si torna al menu iniziale**: non esiste un `newGame()` che rimetta
  giocatore, statistiche e orologio come al boot, e senza quello «Esci al titolo» sarebbe un
  ricaricamento della pagina travestito.
- **Il menu iniziale non ha i volumi**: ci sono comandi e salvataggi, il mixer resta in pausa
  (`F4` funziona anche lì). Vorrebbe condividere il pannello audio come si è fatto con le
  schede degli slot.
- **L'autosave non tiene uno storico**: è uno slot solo che si riscrive. Due o tre a rotazione
  costerebbero 2 kB e salverebbero chi si accorge tardi di aver sbagliato strada.

**Rimasto indietro dalla radio** (§5.14):
- **Le tre grandi coreane non ci sono**: KBS, MBC e SBS trasmettono in HLS con un token, e
  `<audio>` non legge HLS. L'unica strada senza librerie sarebbe un demuxer TS→fMP4 scritto a
  mano sopra MSE: è tanto lavoro per tre stazioni, ma sono *le* tre stazioni.
- **Niente memoria di cosa suonava**: la stazione si ricorda (localStorage), il punto no —
  ovvio per una diretta, ma vuol dire che ogni salita in auto ricomincia dal buffering.
- **Non si vede il titolo del brano**: gli Icecast lo mandano nei metadati (`Icy-MetaData`),
  che da un `<audio>` non si leggono. Vorrebbe dire scaricare lo stream a mano.
- **La radio non reagisce a niente**: non si abbassa quando arriva la polizia, non gracchia
  in galleria, non si spegne quando l'auto prende fuoco.

**Rimasto indietro dalla musica** (§5.19):
- **Non c'è un pezzo per la guida**: fuori dal menu e dalla caccia il gioco è muto di musica,
  e quando la radio non ha rete resta muto e basta. Un pezzo lento da notte, che parta solo in
  auto e solo con la radio spenta, è la prima cosa da provare — e la prima da buttare se
  stanca dopo dieci minuti.
- **La caccia non sa se sei in auto o a piedi**, e nemmeno se stai scappando o combattendo:
  gli strati crescono con le stelle e basta.
- **Gli stacchi sono due** (`go`, `busted`): mancano quello della morte (c'è solo
  `audio.playerDown`), quello di una rapina riuscita e tutto quello che vorranno le missioni.
- **Niente musica negli interni**: un 노래방 senza musica è un 노래방 strano.

**Rimasto indietro dall'audio** (§5.13):
- **Niente riverbero**: un vicolo, un 노래방 e il piazzale dell'aeroporto suonano nello stesso
  spazio. È la cosa che manca di più. Un `ConvolverNode` vuole una risposta all'impulso, cioè
  un asset — o una generata a runtime (rumore che decade, è fattibile in venti righe).
- **Le armi dei nemici suonano come le tue**, solo un po' più piano: manca la coda lontana che
  distingue «ti stanno sparando addosso» da «si spara da qualche parte».
- **L'insegna non ronza e il 편의점 non ha la sua musichetta**: il fondo urbano è un letto solo
  e non sa niente di cosa c'è attorno. Un letto per prop acceso costerebbe poco (le insegne
  vicine sono già indicizzate) e caratterizzerebbe i quartieri di notte.
- **Le urla sono una formante sola**: uomini, donne e vecchi urlano con lo stesso timbro, solo
  con l'altezza spostata a caso.

**Rimasto indietro dal ciclo giorno-notte** (§5.11):
- **Il traffico non sa che piove**: frena alle stesse distanze e sul bagnato scoda in curva
  (+30% di urti laterali). Farlo rallentare *in* curva è già stato provato e **misurato
  peggiore**. Se qualcuno ci riprova, il pezzo che manca è rallentare **prima** della curva,
  cioè guardare `nextChoice` un arco più avanti.
- **Il sole non entra nella scelta dei colori delle facciate**: al tramonto le ombre sono lunghe
  ma il lato illuminato di un palazzo è sempre lo stesso. Costa l'invalidazione di `gradCache`
  a ogni tacca del sole, ed è la cosa che si nota meno di tutto l'elenco.
- **Niente neve, nebbia o stagioni**, per le ragioni in §5.11.

**Rimasto indietro dai negozi** (§5.8) e dagli interni:
- **Nessuno chiama la polizia *da fuori***: l'allarme silenzioso alza l'heat, ma il commesso che
  scappa dalla porta non porta nessuno con sé in strada. Serve un aggancio in `pedestrians` al
  momento del `gone`.
- **Dal retro non si entra e non si sale**: la porta di servizio è solo un'uscita.
- **Chi dorme non paga niente**: il letto è gratis e cura del tutto. Se la clinica deve avere
  senso, la leva è curare solo in parte.
- **La folla non ricorda chi era lì**: due visite alla stessa ora hanno gli stessi posti ma
  persone nuove. Ricordarle vorrebbe dire una lista permanente per fascia oraria, e non si nota.
- **I 전당포 stanno in 4 distretti su 7**, quindi le tre righe più caratterizzate di
  `shops.MARKETS` (armi 0.68 e auto 1.35 al porto, munizioni 1.40 in campagna) si toccano solo
  attraverso il prezzo dell'officina. Un banco dei pegni per distretto in `citygen.placeShops`,
  come `placeGarages` fa con le officine, e il mercato si vedrebbe tutto.

**Rimasto indietro dalla polizia** (§5.5, §5.12, §5.16):
- **Dalla cella non si esce a piedi con qualcosa da fare**: niente cauzione da pagare in
  anticipo, niente scelta fra restare dentro e uscire subito, e i commissariati restano volumi
  chiusi anche adesso che ci si rinasce davanti.
- **La divisa ammanetta anche chi ha una mazza in mano** e la sta usando: `WEAPONS[].melee` non
  distingue fra tenere una mazza e menare.
- **Durante l'assedio non si posano blocchi né chiodi**: uscendo non si trova mai una transenna
  davanti alla porta. `manageObstacles` ragiona su un vettore velocità, e una porta non ce l'ha.
- **Durante l'assedio gli agenti attraversano i muri** (nessuna collisione, per scelta di costo):
  per un frame se ne può vedere uno dentro una vetrina prima che lo steering lo rimetta a posto.
- **Non si entra nei commissariati**: non esiste un `biz` `police` in `interiors.js` — e
  adesso che l'arresto ti ci sveglia davanti, si nota di più.
- **Le motovedette non speronano e non fanno posti di blocco d'acqua**; non c'è un'unità aerea
  d'attacco oltre all'elicottero.
- **La granata è solo della SWAT e solo a cinque stelle**: niente lanci dal finestrino.

**Rimasto indietro dal traffico** (§5.10):
- **Nessuno sorpassa.** Sull'arteria le due corsie per senso restano inutilizzate. Un tentativo
  è già stato fatto e misurato peggiore: manca la scelta della corsia in base alla svolta
  successiva. **È l'ultimo debito grosso del traffico**, adesso che il ciclo del semaforo è
  stato misurato (§5.12).
- **Il traffico non sa niente della quota**: un'auto in salita rallenta per fisica ma non se lo
  aspetta, e alza il gas dopo.
- **`MAX_TRAFFIC` resta a 44, e adesso si sa che il semaforo non lo sblocca.** §5.10 lo aveva
  sceso da 54 indicando il ciclo del semaforo come la leva per rialzarlo; §5.12 l'ha misurata e
  la leva non c'è (accorciare non dà niente, allungare fa danni). Chi vuole più densità deve
  cercare la capacità da un'altra parte — il sorpasso, o la priorità fra i mezzi.
- **Non c'è priorità fra i mezzi**: un autobus (158 px) e uno scooter (44 px) trattano l'incrocio
  allo stesso modo, e il primo lo occupa per il doppio del tempo.

**Rimasto indietro dalla mappa** (§5.9) e dagli esplosivi (§5.7):
- **Nessun traffico aereo o navale**: aerei e barche civili sono tutti fermi. Un paio di battelli
  che fanno la spola sul Han costerebbero un `ai` semplice — il fiume è una linea, non serve grafo.
- **Le bande non si fanno la guerra e non si conquistano.** Adesso commerciano (§5.12), ma
  restano quattro banchi: niente faide, niente territori che cambiano padrone. È materia della
  storia.
- **In campagna c'è da raccogliere ma non da fare**: le attività secondarie (consegne, salti,
  corse) sono ancora la superficie migliore su cui metterle.
- **L'aeroporto non ha interni**: terminal e hangar sono volumi chiusi.
- **Il fuoco non attacca gli edifici**: lambisce le facciate e si ferma. Bruciare un palazzo
  vorrebbe dire uno stato sui volumi e un modo di disegnarlo.

**Fase 3 — quello che resta.**
12 missioni in 3 atti con cutscene a **pannelli a fumetto** (gli interni sono anche il posto
dove ambientarne metà: un incontro in un 노래방 non ha bisogno di niente di nuovo, un
appuntamento può avere un'ora, e adesso una banda ha anche un motivo per parlarti); attività
secondarie (taxi, consegne, salti). **Restano solo quelle.** Le missioni avranno bisogno di
quattro cose che adesso ci sono e prima no — un posto da cui cominciare la partita (§5.18), un
posto in cui riprenderla (§5.15), una sconfitta che non sia solo la morte (§5.16) e un sistema
musicale a cui aggiungere una riga per far partire un pezzo (§5.19: si tocca `music.direct` e
nient'altro).
