const Joi = require('joi-strict');
const objectHash = require('object-hash-strict');

module.exports.name = 'group-id-step';

module.exports.queue = 'one';

module.exports.groupIdFunction = (msg) => objectHash(msg);
module.exports.deduplicationIdFunction = (msg) => objectHash(msg);

module.exports.schema = Joi.object().keys({
  name: Joi.string().valid('group-id-step'),
  meta: Joi.string()
});

module.exports.handler = async (payload, event, context) => [];

module.exports.next = [];
