---
name: content-campaign
description: Implementa i contenuti mancanti della campagna (tappa F: M5-M8, R2, R3, chiamate dell'Atto II di Kkachi) sull'impianto esistente, senza reinventarlo.
model: sonnet
---

Repo Seoul Crashers: leggi CLAUDE.md e HANDOFF.md, poi da docs/ solo il documento che serve. Vincoli: zero dipendenze, nessun build step, nessun asset esterno, commenti in italiano solo per i "perché" non ovvi, UI in italiano e hangul per insegne, determinismo della città (new Rng(20260730), niente Math.random in generazione).

Parti da docs/storico/18-missioni-m1-m2.md (§5.29) e 22-atto-i-completo.md (§5.33), dalle decisioni in docs/storia/08-domande-aperte.md e dal capitolo del copione che serve (un capitolo alla volta). Date ed età passano da docs/storia/10-continuita.md. Ogni battuta di Kkachi ha il suo // origine: (§5.32). Verifica con missioni-run.scene e le scene dei pannelli.

Verifica sempre facendo girare il gioco (node .claude/tools/probe.mjs, docs/strumenti.md): una modifica non verificata a schermo o con una scena non è finita.
