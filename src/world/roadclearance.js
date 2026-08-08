// Geometria condivisa per tutto ciò che deve restare fuori dalla carreggiata.
// Il grafo descrive dove guidano i mezzi, ma il renderer usa la larghezza delle
// linee: controllare soltanto l'asse lascia tetti, scale e container sull'asfalto.

function overlaps(a0, a1, b0, b1) {
  return a0 < b1 && a1 > b0;
}

function activeAt(line, point, pad = 0) {
  return (line.segments || []).some(([a, b]) => point >= a - pad && point <= b + pad);
}

/** True quando un rettangolo invade una strada visibile, larghezza compresa. */
export function rectIntersectsRoad(city, rect, clearance = 0) {
  // Su una mappa con tre maglie sovrapposte la scansione lineare costa: se la
  // città ha già indicizzato le carreggiate si passa da lì. Il risultato è lo
  // stesso, e i generatori regionali — che l'indice non ce l'hanno ancora
  // mentre costruiscono — continuano a usare il percorso qui sotto.
  if (city.roadIndex) {
    const hits = city.roadIndex.queryRect(
      rect.x - clearance, rect.y - clearance, rect.w + clearance * 2, rect.h + clearance * 2
    );
    for (const r of hits) {
      if (overlaps(rect.x, rect.x + rect.w, r.x - clearance, r.x + r.w + clearance)
        && overlaps(rect.y, rect.y + rect.h, r.y - clearance, r.y + r.h + clearance)) return true;
    }
    return false;
  }
  for (const line of city.vLines || []) {
    const left = line.c - line.width / 2 - clearance;
    const right = line.c + line.width / 2 + clearance;
    if (!overlaps(rect.x, rect.x + rect.w, left, right)) continue;
    for (const [a, b] of line.segments || []) {
      if (overlaps(rect.y, rect.y + rect.h, a - clearance, b + clearance)) return true;
    }
  }
  for (const line of city.hLines || []) {
    const top = line.c - line.width / 2 - clearance;
    const bottom = line.c + line.width / 2 + clearance;
    if (!overlaps(rect.y, rect.y + rect.h, top, bottom)) continue;
    for (const [a, b] of line.segments || []) {
      if (overlaps(rect.x, rect.x + rect.w, a - clearance, b + clearance)) return true;
    }
  }
  return false;
}

/** Linea attiva più vicina a un punto; serve per appoggiare un accesso al bordo. */
export function nearestActiveLine(city, axis, x, y, maxDistance = 180) {
  const lines = axis === 'v' ? city.vLines || [] : city.hLines || [];
  const along = axis === 'v' ? y : x;
  const cross = axis === 'v' ? x : y;
  let best = null;
  let bestD = maxDistance;
  for (const line of lines) {
    if (!activeAt(line, along, 2)) continue;
    const d = Math.abs(line.c - cross);
    if (d < bestD) { bestD = d; best = line; }
  }
  return best;
}

export function rectsOverlap(a, b, pad = 0) {
  return a.x < b.x + b.w + pad && a.x + a.w > b.x - pad
    && a.y < b.y + b.h + pad && a.y + a.h > b.y - pad;
}
