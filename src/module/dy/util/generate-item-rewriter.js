export default ((fn, sets) => (item) => {
  if (fn === 'delete') {
    return item;
  }
  const entries = Object.entries(item);
  const emptySets = entries
    .filter(([k, v]) => sets.includes(k) && v.length === 0)
    .map(([k]) => k);
  if (emptySets.length === 0) {
    return item;
  }
  const prunedEntries = Object.fromEntries(entries.filter(([k]) => !emptySets.includes(k)));
  return fn === 'put'
    ? prunedEntries
    : {
      ...prunedEntries,
      $remove: '$remove' in item ? [...item.$remove, ...emptySets] : emptySets
    };
});
