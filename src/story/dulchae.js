// Il conto delle occasioni su Dulchae: la terza condizione del finale C.
//
// Il copione (`docs/storia/10-continuita.md`, `06-finali-ed-epilogo.md`) dà tre occasioni in cui si
// può ucciderlo — il cortile cieco di M8, la sala d'attesa di Busan, l'assedio di M12 — e **nessuna è
// segnalata**. Quello che conta per il finale è una cosa sola: se è morto. Quindi un flag solo,
// `dulchaeUcciso`, più `dulchae@<dove>` per chi un giorno vorrà sapere quale delle tre (scelta presa con
// l'utente: la presenza alle occasioni non si conta).
//
// **Non sta negli attori** (`actors.snapshot`): ogni occasione ha il suo attore (`dulchae-cortile`,
// `dulchae-terminale`), e a scena finita viene tolto con `undefine` — la sua morte se ne andrebbe con
// lui. I flag della storia stanno già nel salvataggio, quindi nessuno scalino in `MIGRATIONS`.

/** Dove si trova ogni attore che è Dulchae. Il pedone di strada di M8 ha `hp` 9999 apposta. */
const DOVE = { dulchae: 'm8', 'dulchae-cortile': 'm8', 'dulchae-terminale': 'busan', 'dulchae-assedio': 'm12' };

export const dulchaeVivo = (game) => !game.missions.flag('dulchaeUcciso');

export function attachDulchae(game) {
  game.on('pedKilled', (p) => {
    const dove = DOVE[p?.actor];
    if (!dove || game.missions.flag('dulchaeUcciso')) return;
    game.missions.setFlag('dulchaeUcciso');
    game.missions.setFlag(`dulchae@${dove}`);
  });
}
