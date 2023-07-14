import { ConfiguredRetryStrategy } from '@aws-sdk/util-retry';

export default new ConfiguredRetryStrategy(
  1, // max attempts.
  (attempt) => 0
);
