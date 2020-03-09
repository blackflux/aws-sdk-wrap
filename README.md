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

<!-- eslint-disable-next-line import/no-unresolved, import/no-extraneous-dependencies -->
```js
const aws = require('aws-sdk-wrap')();

aws
  .call('s3:putObject', { /* ... */ })
  .then(/* ... */)
  .catch(/* ... */);
```

where the first parameter is the service, the second parameter is the method and the third parameter are the "params" passed into the call.

Services are lazily initialized on first access.

One can access an `aws-sdk` service directly by calling e.g. `aws.get('s3')`.

### Methods

#### call(action: String, params: Object = {}, options: Object = {})

The `action` is of the format `path.to.service:functionName`.

Gets the service from the underlying `aws-sdk` and initialize it with the available config iff the service is not initialized yet.
Then calls the function with the passed `params` (which needs to contain the appropriate parameters for the function).

The available call `options` are detailed below.

#### get(serviceName: String)

Get the service from the underlying `aws-sdk` without initializing it. Possible to access nested paths.

#### updateGlobalConfig(config: Object)

Updates the global aws config of the underlying `aws-sdk` via `AWS.config.update`.
In most cases this should not be necessary to use.

#### sqs.sendMessageBatch({ messages: Array, queueUrl: String /* ... other options ... */ })

Splits `messages` into groups and calls [sqs.SendMessageBatch](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/SQS.html#sendMessageBatch-property) for every group.
Batch sizes can be modified by the `batchSize` option. Failed calls will be retried up to the `maxRetries` option.
The available sendMessageBatch `options` are detailed below.

#### sqs.QueueProcessor({ queueUrls: String[], stepsDir: String, ingestSteps: String[] })

Initialize a queue processor lambda handler with steps. Steps need to be defined in the steps directory as separate `STEPNAME.js` files. Each queueUrl used by a step must be defined in queueUrls.

Each `step` should export:
 - `schema<Joi>`: Joi schema
 - `handler<function(step, event, stepContext): steps>`: execution logic ingesting payload and event
 - `next`: array of next possible steps
 - `queueUrl`: the queue that the step is ingested into
 - `delay` (optional): the amount of seconds that the message is delayed, defaults to undefined, i.e. the queue default
 - `before<function(stepContext): steps>` (optional): called before first step is executed
 - `after<function(stepContext): steps>` (optional):

The schema needs to define the event name under `name`. New events that are to be re-queued into the queue need to be returned from the `handler`, `before` or `after` function as an array.

The exposed `ingest` method should only be used to seed the queue. Messages generated inside a step should simply be returned from that step.

Exposed `digraph` option can be used to visualize flow using [viz-js.com](http://viz-js.com/).

Please see tests for example.

#### sqs.prepareMessage(msg: Object, opts: Object)

Prepare message object with options. Currently options include:
- `delaySeconds` (integer): used to set the delay for a specific message. Supersedes the corresponding batch option.

#### s3.putGzipObject({ bucket: String, key: String, data: Object })
Adds an object to an Amazon S3 bucket gzipped. Uses [s3:putObject](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#putObject-property).

#### s3.getGzipJsonObject({ bucket: String, key: String, expectedErrorCodes: [String] })
Retrieves objects from Amazon S3, expecting it to be gzipped. Uses [s3:getObject](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#getObject-property).

#### s3.headObject({ bucket: String, key: String, expectedErrorCodes: [String] })
Retrieves only the metadata from an object in an Amazon S3 bucket. Uses [s3:headObject](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#headObject-property).

#### s3.deleteObject({ bucket: String, key: String })
Delete object from an Amazon S3 bucket at key. Uses [s3:deleteObject](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#deleteObject-property).

#### s3.listObjects({ bucket: String, limit: Number, startAfter: String, prefix: String })
List objects keys in an Amazon S3 bucket. Internally this pages until the
limit is reached or no more keys are available. Uses [s3:listObjectsV2](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#listObjectsV2-property).

#### s3.decodeKey(key: String)
Returns a non-ASCII key representation for an encoded s3 key. Useful to obtain the
not-encoded key representation after calling `listObjects`.

### Init Options

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

### Call Options

#### expectedErrorCodes

Type: `list`<br>
Default: `[]`

Provide string list of expected AWS error codes. Promise succeeds on expected error with error code as string.

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
