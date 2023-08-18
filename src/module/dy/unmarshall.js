import objectScan from 'object-scan';
import { unmarshall } from '@aws-sdk/util-dynamodb';

export default (...args) => {
  const result = unmarshall(...args);
  objectScan(['**'], {
    filterFn: ({ parent, property, value }) => {
      if (value instanceof Set) {
        // eslint-disable-next-line no-param-reassign
        parent[property] = [...value];
      }
    }
  })(result);
  return result;
};
