import assert from 'assert';
import get from 'lodash.get';
import Joi from 'joi-strict';
import Dy from './module/dy.js';
import S3 from './module/s3.js';
import Sqs from './module/sqs.js';
import Lambda from './module/lambda.js';
import * as errors from './resources/errors.js';

export default (opts = {}) => {
  Joi.assert(opts, Joi.object().keys({
    services: Joi.object().pattern(Joi.string(), Joi.any()),
    config: Joi.object().optional(),
    configService: Joi.object().optional(),
    logger: Joi.any().optional(),
    onCall: Joi.function().optional(),
    cursorSecret: Joi.string().optional()
  }));
  const servicesCache = {};
  const services = Object.fromEntries(
    Object
      .entries(get(opts, 'services', {}))
      .map(([k, v]) => [k.toLowerCase(), v])
  );
  const config = get(opts, 'config', {});
  const configService = get(opts, 'configService', {});
  const logger = get(opts, 'logger', null);
  const cursorSecret = get(opts, 'cursorSecret', null);

  const onCallIfSet = (kwargs) => {
    if (opts.onCall !== undefined) {
      opts.onCall(kwargs);
    }
  };

  const getService = (service) => {
    const serviceLower = service.toLowerCase();
    if (servicesCache[serviceLower] === undefined) {
      assert(services[serviceLower] !== undefined, `Service "${serviceLower}" not injected.`);
      const Service = services[serviceLower];
      try {
        servicesCache[serviceLower] = new Service(get(configService, serviceLower, config));
      } catch (e) {
        assert(e instanceof TypeError);
        servicesCache[serviceLower] = Service;
      }
    }
    return servicesCache[serviceLower];
  };

  const call = async (...kwargs) => {
    const [
      action,
      params,
      options = {}
    ] = kwargs;
    const {
      expectedErrorCodes = [],
      meta = null,
      logger: logger_ = logger
    } = options;
    assert(typeof action === 'string');
    assert(params instanceof Object && !Array.isArray(params));
    assert(Array.isArray(expectedErrorCodes) && expectedErrorCodes.every((e) => typeof e === 'string'));
    const splitIndex = action.indexOf(':');
    assert(splitIndex !== -1, 'Bad Action Provided.');
    const service = action.slice(0, splitIndex);
    const funcName = action.slice(splitIndex + 1);
    try {
      const svc = await getService(service);
      const cmds = await getService(`${service}:CMD`);
      assert(funcName in cmds, `Missing Command ${service}:${funcName}`);
      const cmd = new cmds[funcName](params);
      const response = await svc.send(cmd);
      onCallIfSet({
        action,
        params,
        options,
        status: '2xx',
        error: undefined,
        response
      });
      return response;
    } catch (e) {
      if (expectedErrorCodes.includes(e.name)) {
        onCallIfSet({
          action,
          params,
          options,
          status: '4xx',
          error: e,
          response: e.name
        });
        return e.name;
      }
      if (logger_ !== null) {
        logger_.warn(`Request failed for ${service}.${funcName}()\n${JSON.stringify({
          errorName: get(e, 'constructor.name'),
          errorDetails: e,
          requestParams: params,
          ...(meta === null ? {} : { meta })
        })}`);
      }
      onCallIfSet({
        action,
        params,
        options,
        status: '5xx',
        error: e,
        response: undefined
      });
      throw e;
    }
  };

  return {
    call,
    get: getService,
    dy: Dy({
      call, getService, logger, cursorSecret
    }),
    s3: S3({ call, logger }),
    sqs: Sqs({ call, getService, logger }),
    lambda: Lambda({ call, logger }),
    errors
  };
};
