export default (attributes, types) => {
  const attributesWithValidate = Object.fromEntries(
    Object.entries(attributes)
      .filter(([_, v]) => v.validate !== undefined)
      .map(([k, v]) => [k, v.validate])
  );
  return (item) => {
    if (Object.keys(attributesWithValidate).length === 0) {
      return;
    }
    const errors = Object.entries(item)
      .filter(([k, v]) => {
        if (!(k in attributesWithValidate)) {
          return false;
        }
        const value = types.map.includes(k) && '$set' in v ? v.$set : v;
        return attributesWithValidate[k](value) !== true;
      })
      .map(([k, _]) => k);
    if (errors.length !== 0) {
      throw new Error(`Validation failure on attribute(s): ${errors.join(', ')}`);
    }
  };
};
