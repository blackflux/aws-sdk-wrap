# AWS SDK Wrap

[![Build Status](https://circleci.com/gh/blackflux/aws-sdk-wrap.png?style=shield)](https://circleci.com/gh/blackflux/aws-sdk-wrap)
[![Test Coverage](https://img.shields.io/coveralls/blackflux/aws-sdk-wrap/master.svg)](https://coveralls.io/github/blackflux/aws-sdk-wrap?branch=master)
[![Dependabot Status](https://api.dependabot.com/badges/status?host=github&repo=blackflux/aws-sdk-wrap)](https://dependabot.com)
[![Dependencies](https://david-dm.org/blackflux/aws-sdk-wrap/status.svg)](https://david-dm.org/blackflux/aws-sdk-wrap)
[![NPM](https://img.shields.io/npm/v/aws-sdk-wrap.svg)](https://www.npmjs.com/package/aws-sdk-wrap)
[![Downloads](https://img.shields.io/npm/dt/aws-sdk-wrap.svg)](https://www.npmjs.com/package/aws-sdk-wrap)
[![Semantic-Release](https://github.com/blackflux/js-gardener/blob/master/assets/icons/semver.svg)](https://github.com/semantic-release/semantic-release)
[![Gardener](https://github.com/blackflux/js-gardener/blob/master/assets/badge.svg)](https://github.com/blackflux/js-gardener)

Wrapper around [aws-sdk](https://www.npmjs.com/package/aws-sdk).

## Why

When dealing with the aws-sdk a lot, some calls become very repetitive and achieving code coverage becomes tiresome. This wrapper abstracts some of the repetitive logic.

Some examples of repetitive logic are:
 - having to call `.promise()`
 - handling of expected errors
 - logging of unexpected errors

## Install

Install with [npm](https://www.npmjs.com/):

    $ npm install --save aws-sdk-wrap

Ensure required peer dependencies are available.

## Usage

<!-- eslint-disable import/no-unresolved, import/no-extraneous-dependencies -->
```js
import AWS from 'aws-sdk-wrap';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

AWS({
  services: {
    S3: S3Client,
    'S3:CMD': { PutObjectCommand }
  }
})
  .call('S3:PutObjectCommand', { /* ... */ })
  .then(/* ... */)
  .catch(/* ... */);
```

where the first parameter is the service, the second parameter is the method and the third parameter are the "params" passed into the call.

Services are lazily initialized on first access.

One can access an `aws-sdk` service directly by calling e.g. `aws.get('S3')`.

### Methods

#### call(action: String, params: Object = {}, options: Object = {})

The `action` is of the format `path.to.service:functionName`.

Gets the service from the underlying `aws-sdk` and initialize it with the available config iff the service is not initialized yet.
Then calls the function with the passed `params` (which needs to contain the appropriate parameters for the function).

The available call `options` are detailed below.

#### get(serviceName: String)

Get the service from the underlying `aws-sdk` without initializing it. Possible to access nested paths.

#### updateGlobalConfig(AWS, config: Object)

Updates the global aws config of the passed `aws-sdk` via `AWS.config.update`.
In most cases this should not be necessary to use.

#### sqs.sendMessageBatch({ messages: Array, queueUrl: String /* ... other options ... */ })

Splits `messages` into groups and calls [sqs.SendMessageBatch](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/SQS.html#sendMessageBatch-property) for every group.
Batch sizes can be modified by the `batchSize` option. Failed calls will be retried up to the `maxRetries` option.
The available sendMessageBatch `options` are detailed below.

#### sqs.getDeadLetterQueueUrl({ queueUrl })

Return the Dead Letter Queue Url configured for the passed queue url

#### sqs.QueueProcessor({ queueUrls: String[], steps: Array<Object>, ingestSteps: String[] })

Initialize a queue processor lambda handler with steps. Steps need to be defined in the steps directory as separate `STEPNAME.js` files. Each queueUrl used by a step must be defined in queueUrls.

Each `step` should export:
 - `schema<Joi>`: Joi schema
 - `handler<function(payload, event, stepContext): steps>`: execution logic ingesting payload and event
 - `next`: array of next possible steps
 - `queueUrl`: the queue that the step is ingested into
 - `delay = 0` (optional): the amount of seconds that the message is delayed, defaults to undefined, i.e. the queue default
 - `retry = null` (optional): Declare object that is then used to instantiate `RetryError` internally
 - `timeout = 900` (optional): Timeout for individual step. Should allow for extra overhead for message management / processing and account for concurrency.
 - `groupIdFunction = undefined` (optional): Generator function for the groupId. Takes step payload as parameter
 - `deduplicationIdFunction = undefined` (optional): Generator function for the deduplicationId. Takes step payload as parameter
 - `before<function(stepContext, payloads[]): steps>` (optional): called before first step is executed
 - `after<function(stepContext): steps>` (optional):

The schema needs to define the event name under `name`. New events that are to be re-queued into the queue need to be returned from the `handler`, `before` or `after` function as an array.

Exposes:
- `ingest`: Method used to seed queue. Note that messages generated inside a step should simply be returned from that step.
- `handler`: Lambda function handler that is triggered by sqs
- `digraph`: Visualize flow using [viz-js.com](http://viz-js.com/).

Please see tests for example.

#### sqs.errors

- `RetryError`: Can be thrown from step logic or declared on step to trigger (code) retry logic

#### sqs.prepareMessage(msg: Object, opts: Object)

Prepare message object with options. Currently options include:
- `delaySeconds` (integer): used to set the delay for a specific message. Supersedes the corresponding batch option.
- `groupId` (string): group id for the message, can only be set for steps that do not define `groupIdFunction`
- `deduplicationId` (string): deduplication id for the message, can only be set for steps that do not define `deduplicationIdFunction`
- `urgent` (boolean): message is immediately enqueued if returned from before or handler, instead of at the very end

#### s3.putGzipObject({ bucket: String, key: String, data: Object })
Adds an object to an Amazon S3 bucket gzipped. Uses [s3:putObject](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#putObject-property).

#### s3.getGzipJsonObject({ bucket: String, key: String, expectedErrorCodes: [String] })
Retrieves objects from Amazon S3, expecting it to be gzipped. Uses [s3:getObject](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#getObject-property).

#### s3.headObject({ bucket: String, key: String, expectedErrorCodes: [String] })
Retrieves only the metadata from an object in an Amazon S3 bucket. Uses [s3:headObject](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#headObject-property).

#### s3.deleteObject({ bucket: String, key: String })
Delete object from an Amazon S3 bucket at key. Uses [s3:deleteObject](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#deleteObject-property).

#### s3.listObjects({ bucket: String, limit: Number, startAfter: String, stopAfter: String, prefix: String })
List objects keys in an Amazon S3 bucket. Internally this pages until the
limit is reached or no more keys are available. Uses [s3:listObjectsV2](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#listObjectsV2-property).
- stopAfter: If provided paging is stopped if the last key returned is larger or equal to this parameter. Only appropriate keys are then returned.

#### s3.decodeKey(key: String)
Returns a non-ASCII key representation for an encoded s3 key. Useful to obtain the
not-encoded key representation after calling `listObjects`.

#### dy.Model({ name: String, attributes: Object, indices: Object, onNotFound: Function, onUpdate: Function, onCreate: Function })
Options details:
- `onNotFound` (Function): Return value is returned from corresponding function. Return value is returned from corresponding function.
- `onUpdate` (Function): Executed after an item is updated successfully.
- `onCreate` (Function): Executed after an item is created successfully.
Instantiates Model.<br>
Internally uses [dynamodb-toolbox](https://github.com/jeremydaly/dynamodb-toolbox)

##### dy.Model().createOrModify(item: Object, opts: Object)
Creates entry if key does not exist. Otherwise updates the item.<br>
Options include (all optional):
- `conditions` (Object|Array): Conditions that must be met for operation to succeed.
- `expectedErrorCodes` (Array): Provide string list of expected AWS error codes. Promise succeeds on expected error with error code as string.
- `toReturn` (Array): Fields to return on item.

Internally uses [update](https://github.com/jeremydaly/dynamodb-toolbox#updatekey-options-parameters)

##### dy.Model().createOrReplace(item: Object, opts: Object)
Creates entry if key does not exist. Otherwise replaces entire entry if item exists.<br>
Options include (all optional):
- `conditions` (Object|Array): Conditions that must be met for operation to succeed.
- `expectedErrorCodes` (Array): Provide string list of expected AWS error codes. Promise succeeds on expected error with error code as string.
- `toReturn` (Array): Fields to return on item.

Internally uses [put](https://github.com/jeremydaly/dynamodb-toolbox#putitem-options-parameters)

##### dy.Model().modify(item: Object, opts: Object)
Edits an existing item's attributes. Can only update an item if it exists.<br>
Options include (all optional):
- `conditions` (Object|Array): Conditions that must be met for operation to succeed.
- `onNotFound` (Function): Overrides Model `onNotFound` function.
- `expectedErrorCodes` (Array): Provide string list of expected AWS error codes. Promise succeeds on expected error with error code as string.
- `toReturn` (Array): Fields to return on item.

Internally uses [update](https://github.com/jeremydaly/dynamodb-toolbox#updatekey-options-parameters)

##### dy.Model().delete(key: Object, opts: Object)
Deletes an item. Can only delete an item if it exists.<br>
Options include (all optional):
- `conditions` (Object|Array): Conditions that must be met for operation to succeed.
- `onNotFound` (Function): Overrides Model `onNotFound` function.
- `expectedErrorCodes` (Array): Provide string list of expected AWS error codes. Promise succeeds on expected error with error code as string.
- `toReturn` (Array): Fields to return on item.

Internally uses [delete](https://github.com/jeremydaly/dynamodb-toolbox#deletekey-options-parameters)

##### dy.Model().getItem(key: String, opts: Object)
Returns entry or null if not found.<br>
Options include (all optional):
- `toReturn` (Array): Fields to return.
- `onNotFound` (Function): Overrides Model `onNotFound` function.

Internally uses [get](https://github.com/jeremydaly/dynamodb-toolbox#getkey-options-parameters)

##### dy.Model().create(item: Object, opts: Object)
Creates entry if key does not exist. Otherwise errors.<br>
Options include (all optional):
- `conditions` (Object|Array): Conditions that must be met for operation to succeed.
- `onAlreadyExists` (Function): Overrides Model `onAlreadyExists` function.
- `expectedErrorCodes` (Array): Provide string list of expected AWS error codes. Promise succeeds on expected error with error code as string.
- `toReturn` (Array): Fields to return on item.

Internally uses [put](https://github.com/jeremydaly/dynamodb-toolbox#putitem-options-parameters)

##### dy.Model().query(key: String, opts: Object)
Pages through table based on primary key values.<br>
Options include (all optional):
- `index` (String): Index name.
- `limit` (Array): Maximum number of items to retrieve. If set to `null`, will exhaustively paginate.
- `consistent` (Boolean): Enables [ConsistentRead](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_Query.html#DDB-Query-request-ConsistentRead).
- `conditions` (Object): Conditions that must be met for operation to succeed.
- `filters` (Object): Conditions to filter the query results after execution (still executed on AWS).
- `toReturn` (Array): Fields to return.
- `cursor` (String): Cursor to page through query results.

Internally uses [query](https://github.com/jeremydaly/dynamodb-toolbox#querypartitionkey-options-parameters)

##### dy.Model().replace(item: Object, opts: Object)
Replaces entire entry if item exists. Otherwise errors.<br>
Options include (all optional):
- `conditions` (Object|Array): Conditions that must be met for operation to succeed.
- `onNotFound` (Function): Overrides Model `onNotFound` function.
- `expectedErrorCodes` (Array): Provide string list of expected AWS error codes. Promise succeeds on expected error with error code as string.
- `toReturn` (Array): Fields to return on item.

Internally uses [put](https://github.com/jeremydaly/dynamodb-toolbox#putitem-options-parameters)

##### dy.Model().scan(opts: Object)
Scans through every item in a table or secondary index.<br>
Options include (all optional):
- `index` (String): Index name.
- `limit` (Array): Maximum number of items to retrieve.
- `consistent` (Boolean): Enables [ConsistentRead](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_Scan.html#DDB-Scan-request-ConsistentRead).
- `filters` (Object): Conditions to filter the query results after execution (still executed on AWS).
- `toReturn` (Array): Fields to return.
- `lastEvaluatedKey` (Object): Primary key of first item to be evaluated by operation.

Internally uses [scan](https://github.com/jeremydaly/dynamodb-toolbox#scanoptions-parameters)

##### dy.Model().schema
Returns subset of cloudformation template.

### Init Options

#### services

Type: `Object`<br>
Default: *N/A*

AWS Services that should be available for this utility.

#### logger

Type: `Logger`<br>
Default: `null`

Provide logger. E.g. [logplease](https://github.com/haadcode/logplease) or [lambda-rollbar](https://github.com/blackflux/lambda-rollbar).

When an unexpected error is risen, information is logged using `.error(...)`.

#### config

Type: `Object`<br>
Default: `{}`

AWS Config object used to initialize the service.

This only affects initialized services. To update the global AWS config use `updateGlobalConfig`.

#### configService

Type: `Object`<br>
Default: `{}`

Declare service specific configurations. E.g. `configService = { dynamodb: { ... } }`.

#### onCall

Type: `Function`<br>
Default: `() => {}`

Callback function that is called everytime after the AWS service is called, containing all
information about the call and response.

### Call Options

#### expectedErrorCodes

Type: `list`<br>
Default: `[]`

Provide string list of expected AWS error codes. Promise succeeds on expected error with error code as string.

#### meta

Type: `object`<br>
Default: `null`

Provide additional debug information for failure case.

#### logger

Used to overwrite global logger. Set to `null` to prevent logging of errors.

### SendMessageBatch Options

#### batchSize
Type: `integer`<br>
Default: `10`

Specify the size of each batch that will be sent. Should never exceed 10.

#### maxRetries
Type: `integer`<br>
Default: `10`

Number of times to retry any failed requests.

#### backoffFunction
Type: `Function`<br>
Default: `(count) => 30 * (count ** 2)`

The length of time the function will wait after each failed request before retrying.

#### delaySeconds
Type: `integer`<br>
Default: `null`

Set [DelaySeconds](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-delay-queues.html) option.
