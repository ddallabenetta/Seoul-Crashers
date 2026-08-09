# La storia di Seoul Crashers — indice

> Questa cartella è **solo copione**. Non descrive codice, non decide strutture dati e non
> anticipa l'impianto delle missioni: quello va concordato con l'utente prima di scriverlo
> (§6, §7). Qui c'è cosa succede, a chi, dove e in che ordine.

**Titolo della campagna: 백호 없는 산 — «La montagna senza tigre».**
Dal proverbio 호랑이 없는 산에 토끼가 왕 노릇 한다: *sul monte senza tigre, comanda il coniglio*.

| Se ti serve… | Apri |
| --- | --- |
| il soggetto, i temi, l'architettura dei colpi di scena | [`00-soggetto.md`](00-soggetto.md) |
| chi è chi, come parla, cosa nasconde | [`01-personaggi.md`](01-personaggi.md) |
| **la cutscene iniziale**, pannello per pannello | [`02-cutscene-iniziale.md`](02-cutscene-iniziale.md) |
| Atto I — missioni 1-4 (l'eredità) | [`03-atto-1.md`](03-atto-1.md) |
| Atto II — missioni 5-8 (il nome) | [`04-atto-2.md`](04-atto-2.md) |
| Atto III — missioni 9-12 (la riqualificazione) | [`05-atto-3.md`](05-atto-3.md) |
| i finali, i titoli di coda, la scena dopo | [`06-finali-ed-epilogo.md`](06-finali-ed-epilogo.md) |
| le chiamate radio facoltative (il «codec» del gioco) | [`07-radio-kkachi.md`](07-radio-kkachi.md) |
| **le decisioni d'impianto prese con l'utente** e le tappe di lavoro | [`08-domande-aperte.md`](08-domande-aperte.md) |
| cosa si sente **a ogni morte**: il 병원 e il suo direttore | [`09-ospedale.md`](09-ospedale.md) |
| **il calendario e i numeri** — da leggere prima di scrivere una data | [`10-continuita.md`](10-continuita.md) |

---

## Come è fatto un capitolo

Ogni missione, nei tre documenti d'atto, ha sempre le stesse voci — così chi la implementerà
sa cosa cercare senza rileggere tutto:

| Voce | Cosa contiene |
| --- | --- |
| **Dove / quando** | regione, distretto, ora del giorno, meteo richiesto |
| **Innesco** | come il giocatore la trova |
| **Apertura** | i pannelli della cutscene d'ingresso, con le battute |
| **Svolgimento** | le fasi giocate, in ordine, con le condizioni |
| **Fallimento** | cosa la interrompe e da dove riparte |
| **Chiusura** | i pannelli d'uscita e il colpo di scena, se ce n'è uno |
| **Poggia su** | i sistemi del gioco che la missione riusa **così come sono** |
| **Chiederebbe** | quello che oggi non c'è (segnalato, non progettato) |

## Sei regole di scrittura, valide ovunque qui dentro

Le prime tre dicono **cosa si può disegnare**, le altre tre **cosa si capisce**. Le seconde
sono arrivate dopo, e sono arrivate a caro prezzo: la prima stesura della cutscene iniziale era
scritta da chi la storia la sapeva già, e a schermo non era ellittica — era illeggibile
(§5.28, [`../storico/17-pannelli-e-cutscene.md`](../storico/17-pannelli-e-cutscene.md)).
Riscritta lì, la stessa griglia vale per tutto il copione, e le trovi applicate in ogni atto.

1. **Ogni pannello deve essere disegnabile da codice.** Sagome piatte, due o tre colori del
   distretto, insegne in hangul, pioggia a righe. Niente inquadrature che richiedano un
   disegnatore: se un pannello non si può descrivere come «silhouette + campiture + una
   scritta», va riscritto. È lo stesso vincolo degli sprite (`CLAUDE.md`).
2. **Italiano per le battute, hangul per insegne, targhe e toponimi.** I nomi coreani si
   scrivono in latino con il trattino (Jae-min, Ha-eun) e in hangul quando sono un'insegna.
3. **La storia non inventa una Seoul nuova.** Usa i sette distretti, le quattro bande, i
   negozi, la metro, il porto, l'aeroporto, l'autostrada, Busan e Jeju che ci sono già. Dove
   serve un luogo che non esiste, è segnalato sotto **Chiederebbe** e non dato per scontato.
4. **Ogni fatto che serve a capire si dice una volta, in chiaro.** Chi è un personaggio quando
   entra in scena, cos'è una banda quando compare, cosa vuol dire una parola coreana dentro una
   battuta, cos'è il registro del quartiere. **Una volta**: il gioco non spiega mai due volte
   ([`00-soggetto.md`](00-soggetto.md), §7), e quello che è stato detto in un pannello non si
   ripete nel dialogo.
5. **Il narratore traduce l'hangul che porta trama** — un manifesto, un documento, una parola
   dentro una battuta — e non quello decorativo. Continua a dire solo cose **verificabili**:
   ore, altezze, targhe, date, prezzi, quante righe ha un registro. Non entra mai nella testa
   di nessuno. Le righe di Kkachi non portano un nome davanti ma la frequenza: `91.45:`.
6. **Gli indizi si rendono visibili, mai spiegati.** Dove servirebbero occhi troppo buoni o una
   memoria troppo lunga — il presente di Chun-sik, la mano in tasca, un nome inciso visto sei
   ore fa — è una riga di *(nota)* a dire **dove guardare**, senza dire cosa significa. La
   *(nota)* è il solo strumento per questo e non risolve mai niente: se una nota spiega un
   indizio, l'indizio non c'è più.

## Le parole che il gioco traduce, e dove

Regola 4 e regola 5 messe in pratica: ogni parola coreana che serve a capire una battuta viene
spiegata **una volta sola**, nel punto in cui compare per la prima volta. Da lì in poi il
copione la usa e basta. Chi aggiunge una scena controlla qui prima di glossare di nuovo.

| Parola | Cosa vuol dire | Dove viene detto |
| --- | --- | --- |
| `한성개발` | Hanseong Development, il nemico | cutscene, pannello 10 |
| `철거예정` | demolizione prevista | cutscene, pannello 9 |
| `감정 중` | perizia in corso — e la perizia è il primo passo della demolizione | M1, punto 4 e chiusura |
| `편의점` | il minimarket | cutscene, pannello 21 |
| `백호파` | la Tigre Bianca, la banda del padre | cutscene 17, ripetuto in M1 per chi salta |
| `전당포` | il banco dei pegni | M2, pannello 1 |
| «il registro» | chi deve cosa a chi: non un libro, degli scaffali e una memoria | M2, svolgimento 1 |
| `당구장` · `술집` · `노래방` | sala biliardo · bar · sala per cantare | M1 pannello 3, M2 |
| `황소파` · `철마파` · `흑사파` | Bue Giallo (usura) · Cavallo di Ferro (auto) · Serpente Nero (contrabbando) | M5 · M2 e M5 · M10 |
| *hyung* | fratello maggiore | M5, uscita dal cortile |
| `피시방` | la sala computer | M8, pannello 1 |
| `둘째` | «il secondo» — come Hanseong chiama l'altro Jae-min | M8, pannello 7 |
| `요양` | casa di cura | M11, svolgimento 2 |
| `서명 취득` | firma acquisita | M11, svolgimento 5 |

## La scala dei colpi di scena, in una riga ciascuno

Per chi deve avere il quadro senza leggere tutto. **Contiene tutti gli spoiler.**

| # | Quando cade | Cosa il giocatore credeva | Cosa è vero |
| --- | --- | --- | --- |
| 1 | fine Atto I | il padre è stato ucciso dal consorzio | il padre ha organizzato la propria sparizione: nella bara c'è un altro |
| 2 | metà Atto II | Jae-min è figlio di Seo Dong-hyeok | è figlio dell'uomo che Dong-hyeok ha ucciso nel 2013 |
| 3 | fine Atto II | la polizia lo cerca per quello che ha fatto | lo cerca per quello che ha fatto **l'altro Jae-min** |
| 4 | Atto III, M9 | lo zio ha venduto suo padre | lo ha venduto **perché suo padre glielo ha chiesto** |
| 5 | Atto III, M11 | il padre è morto dodici anni fa, o nove giorni fa | è vivo a Jeju, e serve solo la sua firma: la mente non c'è più |
| 6 | Atto III, M12 | i dodici anni in America erano protezione | erano l'alibi: serviva un nome pulito da sporcare al momento giusto |
| 7 | dopo i titoli | la voce alla radio è un alleato | la voce è un archivio, e adesso qualcun altro ci sta parlando dentro |

E uno che non è un colpo di scena ma una **riscrittura all'indietro**: in M12 si scopre che le
rianimazioni del giocatore sono fatturate a 한성개발 da dodici anni, e ogni singola morte fatta
fino a quel momento cambia di segno. Il filo comincia al primo risveglio e sta in
[`09-ospedale.md`](09-ospedale.md).
