# 까치 — le chiamate radio

> Indice: [`README.md`](README.md). Chi (o cosa) sia Kkachi: [`01-personaggi.md`](01-personaggi.md).
>
> **Implementato dalla tappa D** (§5.32, [`../storico/21-kkachi.md`](../storico/21-kkachi.md)):
> la stazione, le sei regole, le **otto chiamate dell'Atto I** e tutte le righe di servizio.
> Restano da scrivere le sedici chiamate degli Atti II e III (tappe F e G) e le tre «visite che
> cambiano», che vanno con le missioni a cui appartengono. Chi ne aggiunge una: una riga in
> `src/story/kkachi.js`, con la sua `// origine:` — la colonna qui sotto **è** quel commento.

Il «codec» di Seoul Crashers. Ventiquattro conversazioni facoltative, più una manciata di
righe di servizio. Non sono missioni: sono il posto dove il gioco respira, fa ridere e
semina. **Venti su ventiquattro sono una delle tre condizioni del finale nascosto**
([`06-finali-ed-epilogo.md`](06-finali-ed-epilogo.md)).

## Le sei regole

1. **Kkachi esiste solo in macchina, col motore acceso, sulla frequenza `91.45`.** A piedi,
   in barca a motore spento, in metro, dentro un negozio o in cella: niente. Non è un limite
   tecnico da aggirare, è il personaggio.
2. **Chi non accende la radio non sente mai una parola.** È legittimo finire il gioco senza
   sapere che Kkachi esiste, e chi lo fa gioca a un gioco più solo — che è esattamente il
   tema. Nessun avviso, nessun punto esclamativo.
3. **Ogni battuta di Kkachi deve essere copiata da qualcosa che qualcun altro dice nel gioco.**
   La colonna «origine» qui sotto esiste per tenere l'onestà: se una riga non ha un'origine,
   va riscritta. È il meccanismo con cui il colpo di scena finale si dimostra da solo.
4. **Kkachi non dice mai «non lo so».** Se non sa, ripete la domanda con una parola cambiata,
   o inventa con sicurezza. Le invenzioni sono **sempre plausibili e sempre sbagliate**, e
   almeno tre volte nel gioco il giocatore può verificarle e scoprire che erano false.
5. **Chiamata interrotta = chiamata persa.** Se il giocatore scende dall'auto o spegne la
   radio, la conversazione non riparte. Non c'è un registro delle chiamate perse fino ai
   titoli di coda, dove ne compare il conto (`Chiamate a cui non ha risposto: 4`).
6. **La radio vera vince sempre** (§5.14). Se il giocatore sta ascoltando una stazione
   coreana, Kkachi aspetta. Non si sovrappone e non abbassa nessuno.

**Nelle tabelle qui sotto `K:` e `J:` sono abbreviazioni, e solo qui.** Nel pannello le righe
di Kkachi non portano un nome davanti ma **la frequenza** — `91.45:` — come nella cutscene
iniziale e in tutto il copione: è l'indizio principale del settimo colpo di scena e senza voce
doveva diventare un fatto tipografico ([`08-domande-aperte.md`](08-domande-aperte.md), punto 1).

---

## Atto I — otto chiamate

| # | Si innesca quando… | Scambio | Origine della copia |
| --- | --- | --- | --- |
| 1 | prima volta sul ponte del 한강 | K: «Tre ponti per ventitré milioni di persone. Quando ne chiudono uno, per due giorni la città è un'altra città.» / J: «E chi li chiude?» / K: «Quelli che hanno bisogno che tu passi da dove dicono loro.» | narratore, pannello 4 della cutscene |
| 2 | prima volta che piove guidando | K: «Con l'acqua la gente compra di più e ruba di meno. È l'unica statistica del quartiere che non ha mai sbagliato.» / J: «Chi la teneva?» / K: «Uno che stava sempre alla finestra.» | — *(prima invenzione: nessuno teneva quella statistica)* |
| 3 | primo acquisto in armeria | K: «Non ti serve. Ti serve che si veda che ce l'hai. Sono due mestieri diversi e li paghi allo stesso prezzo.» | Chun-sik, M1 |
| 4 | terza morte, uscendo dal 병원 | K: «Ti hanno rimesso insieme in fretta. Ci sono posti dove non ti rimettono insieme per niente.» / J: «Chi paga?» / K: «Chi ha bisogno che tu cammini.» | Ryu, M12 — **detta prima** |
| 5 | prima volta a Gangnam col bomber | K: «Non metterlo qui.» / J: «Me l'hanno già detto.» / K: «Allora ero io.» | Chun-sik, pannello 17 |
| 6 | prima notte fonda in giro (dopo le 03:00) | K: «A quest'ora in strada ci sono tre categorie: chi torna, chi non è mai andato a casa e chi lavora. Tu di quale sei?» / J: «Della quarta.» / K: «Non esiste una quarta.» / J: «Appunto.» | — |
| 7 | primo furto d'auto con testimoni | K: «Adesso quella signora racconterà di un uomo alto un metro e ottantatré.» / J: «Sono un metro e settantotto.» / K: «Sì. Ma è l'altezza che dicono sempre.» | referto di M4, `171 cm` — **rovesciata** |
| 8 | dopo M3, guidando a Itaewon | K: «I martedì e i venerdì. Dodici anni. Se moltiplichi, fa una cifra che in una busta non ci sta.» / J: «E dove va a finire?» / K: «Nelle perizie. Le paga qualcuno, e quel qualcuno siete voi.» | — |

---

## Atto II — otto chiamate

| # | Si innesca quando… | Scambio | Origine |
| --- | --- | --- | --- |
| 9 | prima volta in campagna (경기도) | K: «Qui si demolisce senza gru. Basta smettere di riparare le strade e aspettare sei anni.» | Ryu, M6 |
| 10 | primo volo (aereo o elicottero) | K: «Da lassù non si vede chi deve cosa a chi. È per questo che a loro piace guardare da lassù.» / J: «Chi, loro?» / K: «…Quelli che guardano da lassù.» *(la risposta è vuota: prima volta che si sente)* | — |
| 11 | dopo M5, passando davanti al 황소파 | K: «Il vecchio Pyo ti ha chiamato con un altro nome.» / J: «Come lo sai?» / K: «Perché l'ha detto ad alta voce.» | Kkachi, M6 — **anticipata** |
| 12 | portando addosso il completo comprato al 옷가게 | K: «Ti sta male.» / J: «È della mia taglia.» / K: «Non ho detto che è piccolo. Ho detto che ti sta male.» | Ha-eun, M3 («le sta grande») |
| 13 | prima volta che si prende la metro | K: «Sotto non ti sento. È l'unico posto della città dove sei solo.» / *(sette secondi dopo, in banchina, nessuna risposta)* | Kkachi, M7 |
| 14 | dopo aver letto la riga del 1992 (M6) | J: «Cos'è un'acquisizione?» / K: «Una voce di bilancio.» / J: «E un bambino?» / K: «Una voce di bilancio.» | — |
| 15 | guidando dopo mezzanotte con zero stelle per dieci minuti | K: «Adesso non ti cerca nessuno. Goditelo, dura poco e non torna.» / J: *(niente)* / K: «Bravo.» | Jo, M2 (il silenzio come risposta) |
| 16 | passando davanti al 장례식장 di Hongdae | K: «Le buste bianche si contano il giorno dopo. Chi ha messo di più, di solito, è chi ha più da farsi perdonare.» | Chun-sik, R1 |

---

## Atto III — otto chiamate

| # | Si innesca quando… | Scambio | Origine |
| --- | --- | --- | --- |
| 17 | primo tratto della Gyeongbu da solo | K: «Quattrocento chilometri e non cambia niente. È tutto lo stesso paese, e questo è il problema: non c'è un posto dove non arrivano.» | Ko Eun-bi, M10 |
| 18 | prima volta a Busan | K: «Qui parlano diverso. Tuo padre diceva che a Busan si mente più forte ma meno spesso.» / J: «Diceva.» / K: «Dice.» | Chun-sik, tutto l'Atto I — **e Kkachi si corregge al contrario** |
| 19 | in barca, motore acceso, al largo | K: «…perdo… la banda…» *(fruscio)* «…c'è troppa acqua fra noi.» | M11 |
| 20 | tornati a Seoul dopo Jeju | J: «Ti ricordi la cucina?» / K: «Quale cucina.» / J: «Quella con la radio sul frigo.» / K: *(quattro secondi)* «C'era la radio accesa.» | R2 — **parola per parola** |
| 21 | passando davanti al 피시방 di notte | K: «Lì dentro c'è una ragazza che non dorme mai.» / J: «La conosci?» / K: «Mi conosce lei.» | Mi-rae, R3 |
| 22 | dopo aver visto il quarto salvataggio nel menu | J: «Che partita è ancora in corso?» / K: «Non ho detto niente di sbagliato, quindi non è quella la domanda.» / J: «È la quarta volta.» / K: «È la prima.» | cutscene, pannello 26 |
| 23 | guidando in un distretto già periziato (retino grigio) | K: «Questa strada me la ricordo con più insegne.» / J: «Sei una radio. Non ti ricordi niente.» / K: «No.» *(pausa)* «No.» | — *(unica volta in cui ammette qualcosa)* |
| 24 | ultimo viaggio verso la torre, M12 | K: «Se stanotte non torni, io continuo a parlare lo stesso. Volevo che lo sapessi da me.» / J: «Perché me lo dici?» / K: «Perché è quello che si dice, prima.» | Dong-hyeok, cassetta di M11 |

---

## Le righe di servizio

Non contano per il finale nascosto, ma vanno scritte perché sono quelle che il giocatore sente
**cento volte** e sono il tono del gioco.

**Quando sale in auto**, una riga fra dodici, scelta dalla prima condizione che è vera. Cento
ripetizioni perdonano una battuta piatta e non perdonano una battuta che commenta il giocatore:
quindi ognuna dice **un fatto**, e le condizioni sono tutte roba che il motore già sa.

| # | Quando | Riga |
| --- | --- | --- |
| S1 | fra le 05:00 e le 08:00 | «Le sei e dieci. Il traffico va da sud: a quest'ora chi entra a Seoul ci viene a lavorare.» |
| S2 | ora di punta | «Adesso non si guida, si sta in fila. Se prendi i vicoli fai prima e sbagli lo stesso.» |
| S3 | pomeriggio sereno | «Bella giornata. Si vede tutto il quartiere, e tutto il quartiere vede te.» |
| S4 | sera, insegne accese | «Le insegne si accendono a scaglioni: prima i 편의점, poi i 술집, per ultimo chi è indietro con la corrente.» |
| S5 | dopo le 02:00 | «Tre auto in tutta la strada, e due sono ferme.» |
| S6 | pioggia | «Piove da tre ore. Frena prima.» |
| S7 | temporale | «Con questo tempo le volanti stanno sotto i cavalcavia. Tu sai dove sono, loro sanno dove sei.» |
| S8 | volante ferma nel raggio | «C'è una volante ferma due strade più in là. Da venti minuti.» |
| S9 | veicolo malandato | «Questa macchina fa un rumore che due giorni fa non faceva. Non è un problema finché non ti fermi.» |
| S10 | veicolo appena rubato | «Il proprietario sta già telefonando. Gli servono nove minuti per farsi credere.» |
| S11 | contanti sotto la soglia | «Hai in tasca meno di quanto costa un pieno. Non è un giudizio, è un'informazione.» |
| S12 | distretto mai visitato | «Qui non ci sei mai stato. Si capisce da come guardi i numeri civici.» |

*(Nessuna delle dodici ha una «origine» come le ventiquattro chiamate, e va bene: sono le righe
in cui Kkachi fa **la radio**, non il personaggio. La regola 3 vale per le conversazioni, dove
il colpo di scena si deve poter dimostrare, non per l'ora e il meteo.)*

Le altre righe di servizio:

- **Quando ha cinque stelle:** Kkachi **tace**. Non commenta mai gli inseguimenti — parla solo
  prima e dopo. È una scelta di regia: la caccia ha già la sua musica (§5.19).
- **Quando esce di prigione:** «Sei ore. Ti hanno preso l'arsenale e un quinto dei contanti.
  Il quartiere l'ha saputo prima di te.»
- **Quando il giocatore resta fermo col motore acceso per più di due minuti:** «Se ti sei
  addormentato, va bene. Se stai pensando, dimmelo che sto zitto.»
- **Rete assente** (§5.14: la radio è l'unica cosa che parla con la rete; le battute di Kkachi
  no, ma il pretesto è comodo e va usato): «Stanotte la città è muta. Torna domani.»

---

## Le visite che cambiano

Non sono chiamate radio, ma stanno qui perché seguono la stessa regola: **sono facoltative e
non le segnala nessuno.** Tre personaggi rispondono in modo diverso a seconda di quanto la
storia è avanzata; chi ci torna trova qualcosa.

| Chi | Prima di… | Dopo… |
| --- | --- | --- |
| **Jo Ok-bun** (전당포 di Hongdae) | M6: «Torna quando sai fare la domanda giusta.» | M6: la domanda giusta è dirle che 구만기 è inciso sul proprio orologio. Allora gli mette in mano l'accendino inciso: «Tuo padre lo ha impegnato il giorno che ti ha preso. Non è mai tornato a riprenderlo.» **È una delle tre condizioni del finale C**, ed è l'accendino con cui si brucia il registro nel finale A. |
| **Chun-sik** (당구장) | M9: ordina cibo per due e parla di Dong-hyeok al presente | M9: ordina per uno e parla al passato. Una riga sola: «Adesso lo posso dire.» |
| **Il commesso del 편의점 di Itaewon** | M8: «…di nuovo?» | M8: «Ah, lei è l'altro.» *(e non aggiunge niente, mai, per tutto il resto del gioco)* |

---

## Poggia su / Chiederebbe

**Poggia su** — radio in auto e manopola `R` (§5.14) · audio interamente sintetizzato (§5.13) ·
stato del motore e dell'auto (§5.4) · orologio e meteo (§5.11) · ricercato (§5.5) · metro e
interni come «zone senza segnale» (§5.23, §5.8).

**Chiederebbe** — una stazione fittizia a `91.45` fuori dalla lista delle stazioni vere · **una
tabella di righe con predicato** (luogo, ora, meteo, prima volta di un evento, avanzamento),
nello stile di `WEAPONS` e `BUSINESSES`: è la forma decisa, e regge anche le righe di servizio
e, un giorno, le attività secondarie · un conto delle chiamate ascoltate nel salvataggio,
perché venti su ventiquattro sono una delle condizioni del finale C.

**Non chiede una voce.** I pannelli sono muti (§ [`08-domande-aperte.md`](08-domande-aperte.md)):
Kkachi è testo, e quello che lo rende riconoscibile è che le sue righe non hanno un nome
davanti ma il quadrante della frequenza, stanno sempre da sole nel pannello, e sotto c'è il
fruscio — che l'audio del gioco già sa fare (§5.13). **Queste chiamate non sono più
facoltative per chi sviluppa**: senza, il finale C non esiste.
