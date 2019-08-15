const envVars = [
  ['AWS_REGION', 'us-west-2'],
  ['AWS_ACCESS_KEY_ID', 'XXXXXXXXXXXXXXXXXXXX'],
  ['AWS_SECRET_ACCESS_KEY', 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'],
  ['QUEUE_URL', 'https://sqs.us-west-2.amazonaws.com/XXXXXXXXXXXX/queueUrl']
];

module.exports.before = () => {
  envVars.forEach((envVar) => {
    process.env[envVar[0]] = envVar[1];
  });
};

module.exports.after = () => {
  envVars.forEach((envVar) => {
    delete process.env[envVar[0]];
  });
};
