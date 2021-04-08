module.exports = ((attributes) => {
  const attributesWithValidate = Object.entries(attributes)
    .filter(([_, v]) => v.validate !== undefined)
    .reduce((prev, [k, v]) => {
      // eslint-disable-next-line no-param-reassign
      prev[k] = v.validate;
      return prev;
    }, {});
  return (item) => {
    if (Object.keys(attributesWithValidate).length === 0) {
      return;
    }
    const errors = Object.entries(item)
      .filter(([k, v]) => k in attributesWithValidate && attributesWithValidate[k](v) !== true)
      .map(([k, _]) => k);
    if (errors.length !== 0) {
      throw new Error(`Validation failure on attribute(s) : ${errors.join(', ')}`);
    }
  };
});
