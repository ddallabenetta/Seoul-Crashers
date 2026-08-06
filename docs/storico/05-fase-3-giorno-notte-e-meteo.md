# Fase 3 — il tempo passa: ciclo giorno-notte e meteo

> §5.11 del progetto. Indice generale e mappa dei rimandi: [HANDOFF.md](../../HANDOFF.md).

### 5.11 Fase 3, terza tappa — il tempo passa

Seoul ha un orologio, quattro condizioni di tempo e dei negozi che chiudono. Tutto nasce da un
modulo solo, `world/daycycle.js`, che è l'unica fonte di verità su che ora è e che tempo fa:
scena, HUD, negozi, polizia e traffico leggono di lì e non tengono stato proprio.

Le scelte di design prese qui — cambiare costa poco, i punti sono tutti indicati:

- **Un giro dura 24 minuti reali**, cioè un minuto di orologio al secondo (`DAY_SECONDS`). È la
  scala di GTA III, ed è il compromesso che regge: più lento e in una partita non si vede mai
  la notte, più veloce e il cielo lampeggia. Si comincia alle 8:24 del mattino.
- **L'orologio è l'unico sistema che gira anche dentro un negozio.** Tutto il resto è fermo per
  progetto (§5.8), ma un orologio che si ferma è un orologio a cui il giocatore smette di
  credere, e restare al riparo aspettando che faccia giorno deve poter funzionare.
- **La luce è un velo a schermo intero, non un motore** (§3). L'alternativa — illuminare i tile
  del terreno — vorrebbe dire buttare la cache a ogni minuto di orologio: la si è scartata
  prima di provarla, e non è una perdita, perché la parallasse di questo gioco non ha normali
  su cui far cadere una luce vera.
- **Il colore del cielo è una tabella, non una formula** (`KEYS`). Il blu della notte fonda, il
  viola dell'alba e l'arancio del tramonto sono scelte: in tabella si cambiano guardando il
  gioco, in una sinusoide si cambiano rifacendo i conti. Un giro completo si legge con
  `daylight-sweep.scene` (§9).
- **Le ombre girano col sole, il rilievo no** (§3). Ombre lunghe e radenti all'alba e al
  tramonto, corte a mezzogiorno, quasi nulle di notte; l'hillshade del terreno resta fermo
  perché è lettura del rilievo e non ora del giorno. È la stessa scelta consapevole del
  «terreno disegnato in pianta».
- **Le finestre si accendono.** Ogni facciata ha un secondo strato di texture
  (`facades.facadeLights`) disegnato in `lighter` con l'intensità della sera: giallo caldo per
  le case, bianco freddo per gli uffici, piani interi per i grattacieli di vetro, la corona
  della N Seoul Tower, e le serre della campagna che di notte diventano lanterne. Senza, un
  palazzo di notte è una sagoma nera.
- **Quattro condizioni di tempo, legate in catena** (§3): sereno · nuvoloso · pioggia ·
  temporale. Durano da 2 a 22 ore di gioco, la transizione è di 25 s.
- **La pioggia si sente al volante.** Grip laterale −17% e frenata −14% sul bagnato, e
  l'asfalto **si asciuga piano** dopo che ha smesso (i riflessi e la scarsa aderenza restano un
  po'). I numeri sono volutamente modesti: il traffico civile frena a distanze tarate a secco
  (§5.10) e non sa che piove — raddoppiare lo spazio di frenata rimetterebbe in strada i
  tamponamenti che sono costati una sessione intera. Misurato, sotto: non li rimette.
- **Di notte e sotto l'acqua la polizia vede meno lontano** (`police.visionScale`, fino a
  −26% al buio e −20% sotto il temporale, cumulativi). È quello che dà un senso di *gioco* al
  ciclo: seminare una caccia di notte con la pioggia è davvero più facile. Il riflettore
  dell'elicottero resta assoluto — è fatto apposta per vedere di notte.
- **La città si popola per fascia oraria.** `dayCycle.trafficScale`/`pedScale` scrivono in
  `game.trafficScale`/`pedScale`, che traffico e pedoni già leggevano: ora di punta la sera
  (×1.15), notte fonda deserta (×0.34 il traffico, ×0.2 i pedoni), e sotto l'acqua i
  marciapiedi si svuotano molto più delle strade (−55% contro −18%).
- **Gli ombrelli.** In una visuale dall'alto un passante sotto l'acqua *è* un ombrello: 62% dei
  pedoni ne ha uno, deciso alla nascita e non quando comincia a piovere (vederli comparire
  tutti insieme tradirebbe che sono un effetto). Poliziotti, ostili, guardie di un territorio e
  chi è in panico non ce l'hanno aperto.
- **I locali hanno un orario.** 편의점 e 병원 ventiquattr'ore (il secondo è anche il punto di
  risveglio dopo la morte: chiuderlo chiuderebbe la partita), negozi di giorno, 술집 · 노래방 ·
  피시방 · 당구장 di sera e notte. Fuori orario la porta non si apre e il cartello dice a che
  ora riapre. **La porta segue il palazzo, non il negozio**: la scala è in comune, quindi se il
  piano terra è chiuso ma sopra c'è un 당구장 aperto si entra lo stesso, e il piano chiuso si
  attraversa al buio e vuoto — una porta che non si apre senza nemmeno una serratura da
  guardare è una parete invisibile, una sala buia si spiega da sola.
- **Un locale chiuso non ha cassa e non ha listino.** Senza, un 총포상 alle tre di notte
  sarebbe contante gratis senza nessuno a difenderlo.
- **La soglia luminosa ha tre stati**, non due: aperto · chiuso ma con qualcosa di aperto sopra
  (metà intensità) · tutto chiuso (spenta). La saracinesca abbassata si deve vedere da lontano
  quanto l'insegna accesa, o di notte si attraversa mezza Seoul per niente.
- **La minimappa si tinge, la mappa piena si tinge a metà.** Una mappa aperta va letta, e lì
  non c'è la scena attorno a dare il contesto dell'ora.

**Quanto costa, misurato.** Strumentando il loop, per frame:

| | mezzogiorno sereno | notte + temporale |
| --- | --- | --- |
| `scene.render` | 2,25 ms | 2,99 ms |
| `hud.draw` | 0,40 ms | 0,45 ms |
| `update` | 1,61 ms | 2,29 ms |
| **JS per frame** | **4,3 ms** | **5,8 ms** |

Cioè il caso peggiore costa **1,5 ms di JS in più**, e `scene.render` resta sotto quello che
misura `main` sullo stesso albero (3,0 ms). ⚠️ **Il tempo di parete però, in container, passa
da 23 a 32 ms per frame**, e quegli ~8 ms non sono nostri: sono il rasterizzatore software di
Chromium headless che paga i riempimenti a schermo intero in `multiply`/`lighter`/`overlay` e
tutto il blending `lighter` di fari, aloni e finestre. **Su una GPU vera quei passaggi sono
sostanzialmente gratis, ma in questo ambiente non è verificabile**: se qualcuno ha uno schermo,
la prima cosa da controllare è `F3` di notte sotto il temporale. Se davvero costasse, la leva è
una sola — accorpare i veli, oggi sono fino a tre `fillRect` a tutto schermo in `drawLight`.

**Il conto della pioggia sul traffico, misurato.** Con `traffic-census.scene` (§9), 170 s su
cinque zone, orologio fermo alle 8:24. Attenzione a leggere la colonna giusta: **il temporale
toglie da solo il 18% dei veicoli** (`trafficScale`), quindi il confronto onesto è la terza
colonna, dove il numero di auto è stato riportato a mano a quello del sereno.

| | sereno | temporale | temporale, **stesso traffico** |
| --- | --- | --- | --- |
| veicoli seguiti | 188 | 149 | 172 |
| urti al minuto | 32,1 | 31,9 | **41,6** |
| di cui tamponamenti | 4 | 4 | 5 |
| di cui laterali all'incrocio | 39 | 37 | 51 |
| flusso mediano (px/min) | 3818 | 4402 | 4390 |

Tradotto: **sul bagnato il traffico si tocca il 30% in più, ma non si tampona.** Gli urti in
più sono laterali e frontali, cioè auto che scodano in curva — che è esattamente quello che
deve fare un'auto con meno aderenza. Il difetto chiuso in §5.10 (la distanza di sicurezza) non
si riapre, perché la frenata è quasi intatta (−14%) e la legge di inseguimento non è stata
toccata.

**Provate e scartate, due.** *(1)* **Far rallentare l'AI in curva quando piove**
(`driveAI`, target di svolta × 0,78): −12% di urti, ma **−22% di flusso mediano** e *più*
tamponamenti, perché una fila che rallenta in curva se la trova addosso chi sta dietro. Per i
criteri del §5.10 — il flusso conta più del conteggio degli urti, e i tamponamenti sono il
difetto vero — è un cattivo affare. *(2)* **Abbassare il grip bagnato** da 0,17 a 0,11:
misurato 44,1 urti/min, cioè *peggio* del valore più alto. Non è un paradosso, è il rumore di
questa scena: qualunque modifica alla guida sposta le traiettorie e cambia lo scenario, e
l'HANDOFF lo dice da §5.10 — «una differenza del 10% non significa niente». Fra due valori
indistinguibili alla misura si tiene quello che si sente meglio col volante in mano, ed è 0,17.

**Quello che non è stato fatto, e perché.** Niente neve né nebbia: la prima vorrebbe un
accumulo a terra (cioè toccare i tile, cioè la cache), la seconda in una visuale dall'alto
toglie solo informazione. Niente stagioni. Gli orari non cambiano il *contenuto* di un locale:
un 술집 alle nove di sera ha la stessa gente di uno alle due di notte.
