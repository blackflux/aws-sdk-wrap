module.exports = (attributes) => {
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
      .filter(([k, v]) => k in attributesWithValidate && attributesWithValidate[k](v) !== true)
      .map(([k, _]) => k);
    if (errors.length !== 0) {
      throw new Error(`Validation failure on attribute(s): ${errors.join(', ')}`);
    }
  };
};
