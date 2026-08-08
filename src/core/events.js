// Il bus di eventi del gioco.
//
// Fino alla campagna non serviva: i fatti del mondo si dicevano con otto callback
// fissi su `Game` (`onPedKilled`, `onVehicleDestroyed`, …), chiamati da tredici
// punti sparsi fra `vehicle.js`, `player.js`, `pedestrians.js` e `shops.js`. Con
// dodici missioni, cinque fasi ciascuna e due condizioni per fase si arriva a un
// centinaio di inneschi: scritti a quel modo diventerebbero un centinaio di `if`
// dentro `main.js`, che oggi è il file che tiene insieme tutto e non deve sapere
// niente della storia.
//
// Gli stessi eventi servono **due volte**: alle missioni e alla tabella di Kkachi,
// che fra i suoi predicati ha «la prima volta che succede X». Un posto solo da cui
// passano, e le due cose si iscrivono invece di frugare nello stato del gioco a
// ogni frame.
export class Events {
  constructor() {
    this.map = new Map();
  }

  /** Restituisce la funzione che disiscrive: comodo per una fase che finisce. */
  on(name, fn) {
    let list = this.map.get(name);
    if (!list) this.map.set(name, (list = []));
    list.push(fn);
    return () => this.off(name, fn);
  }

  once(name, fn) {
    const off = this.on(name, (...args) => { off(); fn(...args); });
    return off;
  }

  off(name, fn) {
    const list = this.map.get(name);
    if (!list) return;
    const i = list.indexOf(fn);
    if (i >= 0) list.splice(i, 1);
    if (!list.length) this.map.delete(name);
  }

  /**
   * Si itera su una **copia**: un iscritto che si disiscrive mentre viene chiamato
   * è il caso normale (una fase di missione che si chiude proprio sull'evento che
   * aspettava), e senza la copia salterebbe l'iscritto che gli sta dietro.
   *
   * L'eccezione di un iscritto non deve fermare il frame. Un innesco di missione
   * scritto male spegnerebbe il gioco a metà inseguimento, e il colpevole sarebbe
   * illeggibile: qui si vede in console e il mondo continua a girare.
   */
  emit(name, ...args) {
    const list = this.map.get(name);
    if (!list || !list.length) return;
    for (const fn of list.slice()) {
      try {
        fn(...args);
      } catch (err) {
        console.error(`[events] "${name}" ha alzato un'eccezione:`, err);
      }
    }
  }

  /** Quanti iscritti su un evento: serve solo alle prove e al pannello di debug. */
  count(name) {
    return this.map.get(name)?.length || 0;
  }

  clear() {
    this.map.clear();
  }
}
