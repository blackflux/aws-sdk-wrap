const get = require('lodash.get');
const AWS = require('aws-sdk');

const serviceLookup = Object.keys(AWS)
  .reduce((prev, cur) => Object.assign(prev, { [cur.toLowerCase()]: cur }), {});

module.exports = ({ config = {}, logger = null } = {}) => {
  const services = {};

  const getService = (service) => {
    if (services[service] === undefined) {
      services[service] = new AWS[serviceLookup[service]](config);
    }
    return services[service];
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
            errorName: get(e, "constructor.name"),
            errorDetails: e,
            requestParams: params
          });
        }
        throw e;
      }),
    get: getService
  };
};
