const get = require('lodash.get');
const AWS = require('aws-sdk');

const lookupCache = new Map();
const getAttr = (obj, key) => { // case insensitive lookup
  if (!lookupCache.has(obj)) {
    lookupCache.set(obj, Object.entries(obj)
      .reduce((prev, [k, v]) => Object.assign(prev, { [k.toLowerCase()]: v }), {}));
  }
  return lookupCache.get(obj)[key.toLowerCase()];
};

module.exports = ({ config = {}, logger = null } = {}) => {
  AWS.config.update(config);
  const services = {};

  const getService = (service) => {
    const serviceLower = service.toLowerCase();
    if (services[serviceLower] === undefined) {
      const Service = serviceLower.split('.').reduce(getAttr, AWS);
      services[serviceLower] = typeof Service === 'object' ? Service : new Service(config);
    }
    return services[serviceLower];
  };

  return {
    call: (service, funcName, params, { expectedErrorCodes = [] } = {}) => getService(service)[funcName](params)
      .promise().catch((e) => {
        if (expectedErrorCodes.indexOf(e.code) !== -1) {
          return e.code;
        }
        if (logger !== null) {
          logger.error({
            message: `Request failed for ${service}.${funcName}()`,
            errorName: get(e, 'constructor.name'),
            errorDetails: e,
            requestParams: params
          });
        }
        throw e;
      }),
    get: getService
  };
};
