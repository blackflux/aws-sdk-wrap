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
Then calls the function with the passed `params`. Options are detailed below 

#### get(serviceName: String)

Get the service from the underlying `aws-sdk` without initializing it. Possible to access nested paths.

#### updateGlobalConfig(config: Object)

Updates the global aws config of the underlying `aws-sdk` via `AWS.config.update`.
In most cases this should not be necessary to use.

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
