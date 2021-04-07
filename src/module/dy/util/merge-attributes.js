const assert = require('assert');
const objectScan = require('object-scan');

module.exports = ((sets) => (...versions) => {
  const result = {};
  const logic = {
    '*': ({ property: name, value }) => {
      if (name === '$remove') {
        delete result[name];
      } else if (!sets.includes(name) || Array.isArray(value)) {
        result[name] = value;
      }
    },
    '$remove[*]': ({ value }) => {
      delete result[value];
    },
    '*.$add[*]': ({ key: [name], value }) => {
      if (!sets.includes(name)) {
        return;
      }
      if (!(name in result)) {
        result[name] = [];
      }
      const field = result[name];
      const indexOf = field.indexOf(value);
      if (indexOf === -1) {
        field.push(value);
      }
    },
    '*.$delete[*]': ({ key: [name], value }) => {
      if (!sets.includes(name)) {
        return;
      }
      assert(name in result);
      const field = result[name];
      const indexOf = field.indexOf(value);
      if (indexOf !== -1) {
        field.splice(indexOf, 1);
      }
    }
  };
  versions.forEach((version) => {
    objectScan(Object.keys(logic), {
      filterFn: (kwargs) => {
        kwargs.matchedBy.forEach((k) => logic[k](kwargs));
      }
    })(version);
  });
  return result;
});
