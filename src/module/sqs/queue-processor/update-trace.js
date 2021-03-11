const assert = require('assert');
const get = require('lodash.get');
const { clone } = require('../prepare-message');
const { metaKey } = require('./payload');

const concat = (trace, toAppend) => {
  if (trace.length === 0) {
    return [toAppend];
  }
  const [last, count = '1'] = trace[trace.length - 1].split(' * ');
  if (last !== toAppend) {
    return trace.concat(toAppend);
  }
  return trace.slice(0, -1).concat(`${last} * ${parseInt(count, 10) + 1}`);
};

module.exports = (msgs, step, trace) => {
  assert(Array.isArray(trace) || typeof trace === 'string');
  return msgs.map((msg) => {
    const m = clone(msg);
    const meta = get(m, metaKey, {});
    meta.trace = Array.isArray(trace)
      ? concat(trace, step.name)
      : concat([], `${step.name}.${trace}`);
    // eslint-disable-next-line no-param-reassign
    m[metaKey] = meta;
    return m;
  });
};
