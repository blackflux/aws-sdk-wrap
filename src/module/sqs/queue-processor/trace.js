export const findCycles = (input) => {
  const idx = {};
  const hits = {};

  for (let i = 0, len = input.length; i < len; i += 1) {
    const current = input[i];
    if (current in idx) {
      const offsets = idx[current];
      for (let j = 0; j < offsets.length; j += 1) {
        const offset = offsets[j];
        // length of a potential match is distance from old position to new one
        const matchLen = i - offset;

        const originalMatch = input.slice(offset, offset + matchLen);

        if (originalMatch.length > 0) {
          const newMatch = input.slice(i, i + matchLen);
          if (originalMatch.length === newMatch.length && originalMatch.every((e, index) => newMatch[index] === e)) {
            if (!(originalMatch in hits)) {
              hits[originalMatch] = [offset, i];
            } else {
              const originalDist = hits[originalMatch][1] - hits[originalMatch][0];
              const newDist = i - hits[originalMatch][hits[originalMatch].length - 1];
              if (originalDist === newDist) {
                hits[originalMatch].push(i);
              }
            }
          }
        }
      }
    }

    if (!(current in idx)) {
      idx[current] = [];
    }
    idx[current].push(i);
  }

  return hits;
};

export const getCycleLength = (trace) => {
  const expanded = trace.flatMap((item) => {
    const [i, c] = item.split(' * ');
    if (c === undefined) {
      return i;
    }
    return Array(Number.parseInt(c, 10)).fill(i);
  });

  const cycles = findCycles(expanded);
  const startCycles = Object.entries(cycles)
    .filter(([k, v]) => v[0] === 0)
    .map(([k, v]) => [k, v, (v[1] - v[0]) * v.length]);
  startCycles.sort((a, b) => b[2] - a[2]);
  return startCycles[0][2];
};
