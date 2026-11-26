# Il gioco oggi, sistema per sistema

> Indice generale e mappa dei rimandi: [HANDOFF.md](../HANDOFF.md). Questo era il §1 di HANDOFF, che
> cresceva di un paragrafo a ogni tappa: sta qui dal riordino del §5.45. **Non serve leggerlo per lavorare**;
> serve a chi vuole sapere com'è il gioco a schermo prima di toccarlo, e a chi chiude una tappa per
> aggiungerci il suo paragrafo, nell'ordine in cui le cose si incontrano giocando.

**Seoul ha un'ora e un tempo.** L'orologio gira sempre (24 minuti reali = 24 ore, anche dentro
un negozio), la luce cambia con l'ora, il cielo passa da sereno a temporale e viceversa, e i
locali hanno un orario di apertura. Non è una decorazione: di notte la polizia vede meno lontano,
sotto l'acqua si frena peggio, e alle tre del mattino l'unica insegna accesa è quella del 편의점.

**Seoul si sente, e nemmeno un byte di audio è un file.** Spari, motori, sirene, rotori,
pioggia, tuoni, urla, casse che si aprono e menu che scorrono nascono da oscillatori e da due
buffer di rumore generati al boot (§5.13) — e dalla §5.21 anche **la coda del riverbero**, che
è un file per definizione. Vale lo stesso vincolo della grafica, con lo stesso vantaggio: il
timbro di un'arma è cinque numeri in tabella, e la pioggia si sente ovattata dentro un negozio
senza che esista un secondo suono di pioggia. Ci sono quattro spazi (aperto, strada, vicolo,
stanza) e quale sia lo dice **da quanti lati arrivano i muri**, non quanti ce ne sono; uno
sparo lontano non è uno sparo piano ma uno sparo *senza schiocco*; i passanti hanno quattro
timbri di voce. L'audio parte **al primo clic o tasto premuto** — regola dei browser, non una
scelta — e `F4` è il muto.

**E in macchina c'è la radio, con stazioni coreane vere** (§5.14): `R` accende e cambia
stazione, `Shift+R` spegne, e nei 편의점 aperti la si sente bassa di sottofondo. È **l'unica
cosa del gioco che parla con la rete**, non lo fa finché non premi `R` — e dal §5.32 nemmeno
allora, perché la prima tacca è 까치 e quella non è uno stream. Quando la rete non c'è il gioco
si comporta esattamente come prima, e adesso la radio non si spegne nemmeno: una stazione resta.

**La partita si salva, e la polizia adesso ti prende vivo.** Tre slot in `localStorage` dal
menu di pausa (§5.15) più **uno automatico a tre generazioni** (§5.20, §5.21): dentro c'è solo
quello che Seoul non sa rifare da sola, cioè 0,7 kB — la città nasce da una seed fissa e il
traffico è streaming. E la divisa, se hai i pugni al posto della pistola o sei quasi a terra,
ti ammanetta invece di spararti (§5.16): sei ore di cella, la cauzione, e l'arsenale se lo
tengono. Con una mazza si può essere ammanettati, ma **non mentre la stai usando** (§5.21).

**Il gioco comincia da un menu, e ha una musica sua.** Il titolo sta sopra una Seoul che gira
davvero — traffico, pedoni, luci — con «Continua» in cima se c'è qualcosa da riprendere
(§5.18), i comandi e i volumi. La musica è sintetizzata come tutto il resto e suona in **due
momenti soli**: il tema sul menu e l'inseguimento quando ti stanno addosso (§5.19). In strada
non suona niente, perché in strada c'è già Seoul, e in macchina c'è la radio — che vince
sempre. Dal menu di pausa si torna al titolo, e da lì si ricomincia davvero (§5.21).

**Il mondo è una mappa sola, larga come la Corea** (§5.25): 16.800×24.000 px con dentro le tre
città generate come prima — Seoul in alto a sinistra, Busan sulla costa sud-orientale, Jeju al
largo — più la campagna del corridoio e il mare che le separa. **A Busan ci si arriva
guidando**, sull'autostrada Gyeongbu, che è fatta di archi del grafo veri: ci passano il
traffico civile e le volanti. **A Jeju no**: nessun nodo stradale la raggiunge, ci si va via
mare o in volo. Ogni fermata ha una scala solida sul marciapiede e si attraversano atrio,
tornelli e banchina a piedi; la tratta interurbana adesso è una comodità, non l'unica via.
Traffico e pedoni restano streaming.

**E la Corea ha dei fatti, non solo delle cose** (§5.26). All'aeroporto si decolla e si atterra,
sul fiume c'è chi naviga, nei campi si lavora fino a sera e poi si rincasa, sui marciapiedi si
formano capannelli in cui uno parla per volta — e ogni tanto qualcuno rapina una vetrina o porta
la sua banda nel cortile di un'altra, con la volante che arriva a rovinare la festa a tutti. Un
modulo solo (`entities/life.js`) e **nessuna entità nuova**: un pilota è un veicolo con un
`ai.mode`, un rapinatore è un pedone con lo stato `errand`. La caccia a *te* resta un altro file.

**E il motore è pronto per la campagna** (§5.27), che è l'unica tappa di questo progetto in cui
non si vede niente di nuovo. I fatti del mondo passano da un **bus** (`game.on/emit`) invece che
da otto callback con un solo ascoltatore, così i cento inneschi delle dodici missioni non
diventano cento `if` in `main.js`; le modalità del gioco stanno in una **tabella** invece che in
dieci booleani, e `game.paused` è derivato; il **salvataggio si migra** invece di rifiutarsi, il
che vuol dire che aggiungere uno stato non cancella più la partita di nessuno; e un personaggio
può finalmente **stare in un posto** (`entities/actors.js`) senza che lo streaming se lo porti
via o lo resusciti.

**E la campagna è cominciata** (§5.28). «Nuova partita» manda in «12년»: ventotto pannelli a
pixel art, cinque personaggi disegnati cella per cella con quattro espressioni a testa, un tema
musicale suo, e `ESC` che salta sempre. I tre indizi che semina tornano tutti più avanti, ed è
la ragione per cui saltarla non costa niente.

**E adesso si gioca** (§5.29). Appena il motore è acceso parte **M1**: un blip alla volta e il
pizzo di martedì da riscuotere in tre posti, di cui uno ha la serranda sigillata da una perizia.
Poi **M2**, tre pegni scaduti a piedi e Jo Ok-bun, cieca da nove anni, che il registro del
quartiere ce l'ha in testa. Una missione è una **fila di fasi**: morire non riporta all'inizio
ma rimette dov'eri, i pannelli non si rivedono mai, e il salvataggio si ricorda a che punto è la
storia in centoventidue byte. I dialoghi non coprono lo schermo: la città resta lì sotto, ferma.
E al **병원 «성심»** il direttore ha una battuta diversa a ogni risveglio — quattro sono un
pannello, dal decimo in poi dice il numero, e quel numero è lo stesso che M12 stamperà sulle
fatture.

**E un cortile può diventare tuo** (§5.31). Un territorio non è più un dato di generazione: si
prende sgombrandolo e restandoci dentro sei secondi, si compra al banco della sua banda, e si
perde in una guerra come lo si è preso. Quello che cambia non è solo il tag a terra — **il banco
cambia mestiere insieme al padrone** (prendere il ricettatore del 황소파 vuol dire un'armeria in
più e un ricettatore in meno) e il cortile mette da parte una busta da riscuotere di persona. È
il primo pezzo di **città** che entra nel salvataggio, e ci entra in 92 byte.

**E qualcuno ti parla, se lo cerchi** (§5.32). Sulla `91.45` c'è 까치: le otto chiamate
dell'Atto I, dodici righe quando sali in macchina, e le battute della storia che prima erano
messaggi in un angolo. **Chi non accende la radio non sente mai una parola** — nessun avviso,
nessun punto esclamativo, ed è la regola, non una svista. Kkachi esiste solo col motore acceso,
tace quando ti stanno addosso, e una chiamata interrotta è una chiamata persa per sempre: venti
su ventiquattro sono una delle tre condizioni del finale nascosto, quindi il conto sta nel
salvataggio. Le sue righe non portano un nome ma il quadrante della frequenza, e sotto c'è il
fruscio — che è tutto quello che ha al posto di una voce.

**E il primo atto è finito** (§5.33). Alle quattro di notte, davanti a un 편의점 di Itaewon sotto
l'acqua, una busta passa da un furgone del 백호파 a una berlina nera che scende in un parcheggio di
Gangnam: il 백호파 non riscuote da 한성개발, **la paga**, da dodici anni. Al molo 7 un medico legale
consegna due fogli e muore male a metà sparatoria, senza che il gioco gli faccia un pannello;
dalla barca, all'alba, si legge `신장 171 cm`. Nella bara non c'è Seo Dong-hyeok — e il giorno dopo
Chun-sik parla di suo padre **al presente**, e non si corregge. Con l'atto entrano le due
meccaniche che tornano in M6 e M9: **il pedinamento** (troppo lontano lo perdi, troppo vicino ti
vede) e **l'oggetto che si porta in mano**, che morendo resta per terra dov'eri. E quando Kkachi
dice «abbassa», il gioco abbassa **la manopola vera** e non la rialza.

**E il nome è stato detto** (§5.40). Un vecchio strozzino presta *un mese in cui nessuno bussa* in cambio di tre
cortili — si prendono sparando, comprando, o portando via le tre auto che il 철마파 smontava e rivendendole — e
sbaglia il nome di Jae-min di mezzo secondo. Poi la torre di 한성개발 alle 14:00, dalla porta in completo o
dietro una berlina che si pedina: sette faldoni, e in uno una riga del 1992 che il gioco **non commenta**, solo
tre secondi di silenzio. R2 è la stessa cucina due volte, una con la radio accesa. Jo, dopo, mette sul banco
l'accendino inciso.

**E l'Atto II è chiuso** (§5.42). Per farsi dire cosa sa Byeon, il capocantiere dentro per il crollo, **bisogna farsi
arrestare**: il gioco chiede quello che ha insegnato a evitare, e la cella è un posto in cui si cammina — due celle,
le sbarre solide, nessuna radio e nessun riquadro di missione, l'orologio fermo. Poi c'è una sorella che scrive da
un numero sconosciuto, e un bomber identico al tuo nella folla di Myeongdong che si pedina **a piedi**, riconoscendo
la banda rossa sulla schiena fra quattro in nero che non ce l'hanno, e che si ferma solo in un cortile cieco dietro
la porta di un 분식: quattro telecamere, e la stessa faccia. R3 sono i nove dischi di 까치 e la sua voce. Le otto
chiamate dell'atto ci sono tutte, e il commesso dice «Ah, lei è l'altro».

**E adesso si sa dove andare** (§5.30). La meta della missione è un rombo con l'alone su tutte
e due le carte, con il suo nome sulla mappa piena e, quando esce dal ritaglio della minimappa,
una punta sul bordo che la guarda con scritto quanto manca. Sotto ci passa **la strada da
fare**: un A* sul grafo stradale, tratteggio che scorre verso la meta, ricalcolato due volte al
secondo mentre si guida e mai mentre si sta fermi. Dove le strade non arrivano — Jeju — resta
una retta, e la carta lo dice.

**E l'Atto III è cominciato** (§5.43). All'alba sulla Gyeongbu Chun-sik sale in macchina e parla per
quattrocento chilometri, nella nebbia bassa, con un convoglio di 한성개발 in mezzo: a duecento all'ora, senza
pannello e senza musica, dice che è stato lui a consegnare Dong-hyeok, perché glielo aveva chiesto lui. A Busan
Nam Ji-uk vuole solo che il carico di stasera arrivi, Ko Eun-bi lo dirà a Seoul alle sei, e la corsa in barca
passa sotto il 광안대교 con due motovedette che adesso girano attorno alla costa invece di piantarsi contro un
molo. Sul cemento della darsena ci sono nove oggetti, e 까치 si corregge per la prima volta.

**E la polizia arriva, e il cortile tuo ti difende** (§5.44). Da lontano una volante segue un A* che preferisce
le vie larghe, e da vicino guida a vista come sempre: davanti al Han e alle baie di Busan non si pianta più a
guardarti. Le guardie di un cortile preso ti vengono dietro a ventaglio, rispondono a chi ti spara, e lasciano
stare la divisa finché non ti ha a tiro.

**E a Busan, di notte, qualcuno aspetta** (§5.46). Il terminal dei traghetti di 부산항 ha una sala d'attesa con tre file
di sedie arancioni e un distributore acceso. Fra le due e mezza e le quattro e dieci, dopo il molo di M10, sulla fila di
mezzo è seduto un uomo con il tuo stesso bomber: chi si siede tre sedie più in là vede quattro tavole, e poi lo vede
alzarsi e uscire camminando. Nessuno lo segnala, e niente impedisce di sparargli. Lo stesso vale nel cortile cieco di
M8, dove adesso se ne va a piedi davanti a te, e il gioco si ricorda in silenzio se l'hai lasciato andare. Al 당구장
Chun-sik ordina due 짜장면 prima della Gyeongbu e uno dopo. Sulla `91.45` ci sono la Gyeongbu fatta da soli e la prima
volta a Busan, dove 까치 si corregge al contrario: «Dice».
