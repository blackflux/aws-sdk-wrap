import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

export default () => new DynamoDBClient({
  endpoint: process.env.DYNAMODB_ENDPOINT,
  apiVersion: '2012-08-10',
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});
