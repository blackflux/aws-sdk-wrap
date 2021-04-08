module.exports = {
  validateNoParams: () => true,
  validateOneParam: (changeset) => true,
  validateTwoParams: (one, two) => true,
  validateAsync: async (changeset) => Promise.resolve(true)
};
