import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import DynamoDBClient from './dy-client-constructor.js';

export default () => DynamoDBDocumentClient.from(
  DynamoDBClient(),
  {
    marshallOptions: {
      // Whether to automatically convert empty strings, blobs, and sets to `null`.
      convertEmptyValues: false, // if not false explicitly, we set it to true.
      // Whether to remove undefined values while marshalling.
      removeUndefinedValues: false, // false, by default.
      // Whether to convert typeof object to map attribute.
      convertClassInstanceToMap: false // false, by default.
    },
    unmarshallOptions: {
      // Whether to return numbers as a string instead of converting them to native JavaScript numbers.
      // NOTE: this is required to be true in order to use the bigint data type.
      wrapNumbers: false // false, by default.
    }
  }
);
