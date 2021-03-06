const assert = require('assert');
const Create = require('./dy/fns/create');
const CreateOrModify = require('./dy/fns/create-or-modify');
const CreateOrReplace = require('./dy/fns/create-or-replace');
const DeleteItem = require('./dy/fns/delete');
const GetItem = require('./dy/fns/get-item');
const Modify = require('./dy/fns/modify');
const Query = require('./dy/fns/query');
const Replace = require('./dy/fns/replace');
const Scan = require('./dy/fns/scan');
const createModel = require('./dy/create-model');
const DyUtil = require('./dy/util');
const { ModelNotFound, ModelAlreadyExists } = require('../resources/errors');

module.exports = ({ call, getService, logger }) => ({
  Model: ({
    name,
    attributes,
    indices,
    onNotFound: onNotFound_ = (key) => { throw new ModelNotFound(); },
    onAlreadyExists: onAlreadyExists_ = (key) => { throw new ModelAlreadyExists(); },
    onUpdate = async (item) => {},
    onCreate = async (item) => {},
    onDelete = async (item) => {}
  }) => {
    assert(typeof onNotFound_ === 'function' && onNotFound_.length === 1);
    assert(typeof onAlreadyExists_ === 'function' && onAlreadyExists_.length === 1);
    assert(typeof onUpdate === 'function' && onUpdate.length === 1);
    assert(typeof onCreate === 'function' && onCreate.length === 1);
    const model = createModel({
      name,
      attributes,
      indices,
      DocumentClient: getService('DynamoDB.DocumentClient')
    });
    const {
      validateSecondaryIndex,
      setDefaults,
      getSortKeyByIndex,
      compileFn
    } = DyUtil({
      attributes,
      model,
      onNotFound_,
      onAlreadyExists_,
      onUpdate,
      onCreate,
      onDelete
    });
    return ({
      create: Create(compileFn),
      createOrModify: CreateOrModify(compileFn),
      createOrReplace: CreateOrReplace(compileFn),
      delete: DeleteItem(compileFn),
      getItem: GetItem(model, onNotFound_, setDefaults),
      modify: Modify(compileFn),
      query: Query(model, validateSecondaryIndex, setDefaults, getSortKeyByIndex),
      replace: Replace(compileFn),
      scan: Scan(model, validateSecondaryIndex, setDefaults),
      schema: model.schema
    });
  }
});
