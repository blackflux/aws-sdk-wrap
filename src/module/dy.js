const assert = require('assert');
const DeleteItem = require('./dy/fns/delete');
const GetItem = require('./dy/fns/get-item');
const Query = require('./dy/fns/query');
const Update = require('./dy/fns/update');
const Upsert = require('./dy/fns/upsert');
const createModel = require('./dy/create-model');
const DyUtil = require('./dy/util');
const { ModelNotFound } = require('../resources/errors');

module.exports = ({ call, getService, logger }) => ({
  Model: ({
    name,
    attributes,
    indices,
    onNotFound: onNotFound_ = (key) => { throw new ModelNotFound(); },
    onUpdate = async (item) => {},
    onCreate = async (item) => {},
    onDelete = async (item) => {}
  }) => {
    assert(typeof onNotFound_ === 'function' && onNotFound_.length === 1);
    assert(typeof onUpdate === 'function' && onUpdate.length === 1);
    assert(typeof onCreate === 'function' && onCreate.length === 1);
    const model = createModel({
      name,
      attributes,
      indices,
      DocumentClient: getService('DynamoDB.DocumentClient')
    });
    const {
      setDefaults,
      getSortKeyByIndex,
      compileFn
    } = DyUtil({
      attributes,
      model,
      onNotFound_,
      onUpdate,
      onCreate,
      onDelete
    });
    return ({
      upsert: Upsert(compileFn),
      update: Update(compileFn),
      delete: DeleteItem(compileFn),
      getItem: GetItem(model, onNotFound_, setDefaults),
      query: Query(model, setDefaults, getSortKeyByIndex),
      schema: model.schema
    });
  }
});
