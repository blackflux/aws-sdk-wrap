const assert = require('assert');
const get = require('lodash.get');
const AWS = require('aws-sdk');
const sqs = require('./util/sqs');
const errors = require('./resources/errors');

const lookupCache = new Map();
const getAttr = (obj, key) => { // case insensitive lookup
  if (!lookupCache.has(obj)) {
    lookupCache.set(obj, Object.entries(obj)
      .reduce((prev, [k, v]) => Object.assign(prev, { [k.toLowerCase()]: v }), {}));
  }
  return lookupCache.get(obj)[key.toLowerCase()];
};

module.exports = ({ config = {}, logger = null } = {}) => {
  const services = {};

  const getService = (service) => {
    const serviceLower = service.toLowerCase();
    if (services[serviceLower] === undefined) {
      const Service = serviceLower.split('.').reduce(getAttr, AWS);
      try {
        services[serviceLower] = new Service(config);
      } catch (e) {
        assert(e instanceof TypeError);
        services[serviceLower] = Service;
      }
    }
    return services[serviceLower];
  };

  const call = (action, params, { expectedErrorCodes = [] } = {}) => {
    assert(typeof action === 'string');
    assert(params instanceof Object && !Array.isArray(params));
    assert(Array.isArray(expectedErrorCodes) && expectedErrorCodes.every((e) => typeof e === 'string'));
    const splitIndex = action.indexOf(':');
    assert(splitIndex !== -1, 'Bad Action Provided.');
    const service = action.slice(0, splitIndex);
    const funcName = action.slice(splitIndex + 1);
    return getService(service)[funcName](params).promise().catch((e) => {
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
    });
  };

  return {
    updateGlobalConfig: (cfg) => AWS.config.update(cfg),
    call,
    get: getService,
    sqs: sqs({ call, getService, logger }),
    errors
  };
};
