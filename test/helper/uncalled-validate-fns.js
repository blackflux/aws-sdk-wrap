module.exports = {
  validateNoParams: () => {
    throw new Error('validateNoParams was called.');
  },
  validateOneParam: (changeset) => {
    throw new Error('validateOneParam was called.');
  },
  validateTwoParams: (one, two) => {
    throw new Error('validateTwoParams was called.');
  },
  validateAsync: async (changeset) => {
    throw new Error('validateAsync was called.');
  }
};
