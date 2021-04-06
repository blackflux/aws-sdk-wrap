module.exports = ((sets) => (item) => {
  const entries = Object.entries(item);
  const emptySets = entries
    .filter(([k, v]) => sets.includes(k) && v.length === 0)
    .map(([k]) => k);
  if (emptySets.length === 0) {
    return item;
  }
  return {
    ...Object.fromEntries(entries.filter(([k]) => !emptySets.includes(k))),
    $remove: '$remove' in item ? [...item.$remove, ...emptySets] : emptySets
  };
});
