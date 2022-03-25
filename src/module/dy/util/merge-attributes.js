import objectScan from 'object-scan';

export default ({ sets, numbers }) => (...versions) => {
  const result = {};
  const logic = {
    '*': ({ property: name, value }) => {
      if (name === '$remove') {
        delete result[name];
        return;
      }
      if (
        (sets.includes(name) || numbers.includes(name))
        && value.constructor === Object
      ) {
        return;
      }
      result[name] = value;
    },
    '$remove[*]': ({ value }) => {
      delete result[value];
    },
    '*.$add': ({ key: [name], value }) => {
      if (!numbers.includes(name)) {
        return;
      }
      result[name] = (name in result ? result[name] : 0) + value;
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
      if (name in result) {
        const field = result[name];
        const indexOf = field.indexOf(value);
        if (indexOf !== -1) {
          field.splice(indexOf, 1);
        }
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
};
