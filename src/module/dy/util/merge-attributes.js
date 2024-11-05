import assert from 'assert';
import clonedeep from 'lodash.clonedeep';
import objectScan from 'object-scan';

export default (types) => (...versions) => {
  const clonedVersions = clonedeep(versions);
  const result = {};
  const logic = {
    '*': ({ property: name, value }) => {
      if (name === '$remove') {
        delete result[name];
        return;
      }
      if (types.string.includes(name)) {
        result[name] = String(value);
        return;
      }
      if (
        (types.set.includes(name) || types.number.includes(name))
        && value?.constructor === Object
      ) {
        return;
      }
      if (types.map.includes(name)) {
        if (Object.keys(value).some((k) => k === '$set')) {
          return;
        }
        result[name] = value;
        return;
      }
      result[name] = value;
    },
    '$remove[*]': ({ value }) => {
      delete result[value];
    },
    '*.$set': ({ key: [name], value }) => {
      if (!types.map.includes(name)) {
        return;
      }
      assert(name in result, 'Can not update non-existing map');
      Object.entries(value).forEach(([k, v]) => {
        if (v === undefined) {
          delete result[name][k];
        } else {
          result[name][k] = v;
        }
      });
    },
    '*.$add': ({ key: [name], value }) => {
      if (!types.number.includes(name)) {
        return;
      }
      result[name] = (name in result ? result[name] : 0) + value;
    },
    '*.$add[*]': ({ key: [name], value }) => {
      if (!types.set.includes(name)) {
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
      if (!types.set.includes(name)) {
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
  clonedVersions.forEach((version) => {
    objectScan(Object.keys(logic), {
      filterFn: (kwargs) => {
        kwargs.matchedBy.forEach((k) => logic[k](kwargs));
      }
    })(version);
  });
  return result;
};
