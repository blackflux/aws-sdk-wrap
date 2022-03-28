import assert from 'assert';
import Create from './dy/fns/create.js';
import CreateOrModify from './dy/fns/create-or-modify.js';
import CreateOrReplace from './dy/fns/create-or-replace.js';
import DeleteItem from './dy/fns/delete.js';
import GetItem from './dy/fns/get-item.js';
import Modify from './dy/fns/modify.js';
import Query from './dy/fns/query.js';
import Replace from './dy/fns/replace.js';
import Scan from './dy/fns/scan.js';
import createModel from './dy/create-model.js';
import DyUtil from './dy/util.js';
import { ModelNotFound, ModelAlreadyExists } from '../resources/errors.js';

export default ({ call, getService, logger }) => ({
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
