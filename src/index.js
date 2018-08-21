const get = require('lodash.get');
const AWS = require('aws-sdk');

const serviceLookup = Object.keys(AWS)
  .reduce((prev, cur) => Object.assign(prev, { [cur.toLowerCase()]: cur }), {});

module.exports = ({ config = {}, logger = null } = {}) => {
  const services = {};
  return {
    call: (service, funcName, params, { expectedErrorCodes = [] } = {}) => {
      if (services[service] === undefined) {
        services[service] = new AWS[serviceLookup[service]](config);
      }
      return services[service][funcName](params).promise().catch((e) => {
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
      });
    }
  };
};
