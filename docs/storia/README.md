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

## Tre regole di scrittura, valide ovunque qui dentro

1. **Ogni pannello deve essere disegnabile da codice.** Sagome piatte, due o tre colori del
   distretto, insegne in hangul, pioggia a righe. Niente inquadrature che richiedano un
   disegnatore: se un pannello non si può descrivere come «silhouette + campiture + una
   scritta», va riscritto. È lo stesso vincolo degli sprite (`CLAUDE.md`).
2. **Italiano per le battute, hangul per insegne, targhe e toponimi.** I nomi coreani si
   scrivono in latino con il trattino (Jae-min, Ha-eun) e in hangul quando sono un'insegna.
3. **La storia non inventa una Seoul nuova.** Usa i sette distretti, le quattro bande, i
   negozi, la metro, il porto, l'aeroporto, l'autostrada, Busan e Jeju che ci sono già. Dove
   serve un luogo che non esiste, è segnalato sotto **Chiederebbe** e non dato per scontato.

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
