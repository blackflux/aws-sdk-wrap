const get = require('lodash.get');
const AWS = require('aws-sdk');

class AwsError extends Error {
  constructor(message, context) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
    this.context = context;
  }
}

const serviceLookup = Object.keys(AWS)
  .reduce((prev, cur) => Object.assign(prev, { [cur.toLowerCase()]: cur }), {});

module.exports = ({ config = {}, logger = null } = {}) => {
  const services = {};
  return {
    AwsError,
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
        throw new AwsError(`Error in ${service}.${funcName}()`, { service, function: funcName });
      });
    }
  };
};
