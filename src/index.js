const assert = require('assert');
const get = require('lodash.get');
const AWS = require('aws-sdk');
const Joi = require('joi-strict');
const { Sqs } = require('./module/sqs');
const { S3 } = require('./module/s3');
const errors = require('./resources/errors');

const lookupCache = new Map();
const getAttr = (obj, key) => { // case insensitive lookup
  if (!lookupCache.has(obj)) {
    lookupCache.set(obj, Object.entries(obj)
      .reduce((prev, [k, v]) => Object.assign(prev, { [k.toLowerCase()]: v }), {}));
  }
  return lookupCache.get(obj)[key.toLowerCase()];
};

module.exports = (opts = {}) => {
  Joi.assert(opts, Joi.object().keys({
    config: Joi.object().optional(),
    configService: Joi.object().optional(),
    logger: Joi.any().optional()
  }));
  const services = {};
  const config = get(opts, 'config', {});
  const configService = get(opts, 'configService', {});
  const logger = get(opts, 'logger', null);

  const getService = (service) => {
    const serviceLower = service.toLowerCase();
    if (services[serviceLower] === undefined) {
      const Service = serviceLower.split('.').reduce(getAttr, AWS);
      try {
        services[serviceLower] = new Service(get(configService, serviceLower, config));
      } catch (e) {
        assert(e instanceof TypeError);
        services[serviceLower] = Service;
      }
    }
    return services[serviceLower];
  };

  const call = (action, params, { expectedErrorCodes = [], errorLogOverride = false } = {}) => {
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
      if (logger !== null && errorLogOverride !== true) {
        logger.error(`Request failed for ${service}.${funcName}()\n${JSON.stringify({
          errorName: get(e, 'constructor.name'),
          errorDetails: e,
          requestParams: params
        })}`);
      }
      throw e;
    });
  };

  return {
    updateGlobalConfig: (cfg) => AWS.config.update(cfg),
    call,
    get: getService,
    sqs: Sqs({ call, getService, logger }),
    s3: S3({ call, logger }), // TODO: backoffFunction, maxRetries are not set on instantiation. Is this by design?
    errors
  };
};
