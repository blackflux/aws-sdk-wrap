const transform = (logic) => Object.fromEntries(Object.entries(logic)
  .map(([k, v]) => [k, (kwargs) => {
    if (typeof v === 'function') {
      return v(kwargs);
    }
    const { headers, value } = kwargs;
    const entries = Object.entries(v);
    for (let idx = 0; idx < entries.length; idx += 1) {
      const [hostMatcher, valueNew] = entries[idx];
      if (headers.host.endsWith(hostMatcher)) {
        return typeof valueNew === 'function' ? valueNew(kwargs) : valueNew;
      }
    }
    return value;
  }]));

export default transform({
  'content-length': ({ value }) => (String(value) === '0' ? 0 : '^[1-9][0-9]*$'),
  'user-agent': {
    'monitoring.us-west-2.amazonaws.com': '^aws-sdk-nodejs/.+$',
    'lambda.us-west-2.amazonaws.com': '^aws-sdk-nodejs/.+$',
    'sqs.us-west-2.amazonaws.com': '^aws-sdk-nodejs/.+$',
    'ssm.us-west-2.amazonaws.com': '^aws-sdk-nodejs/.+$',
    'dynamodb.us-west-2.amazonaws.com': '^aws-sdk-nodejs/.+$',
    's3.us-west-2.amazonaws.com': '^aws-sdk-nodejs/.+$',
    'dynamodb-local:8000': '^aws-sdk-nodejs/.+$'
  },
  authorization: {
    '.us-west-2.amazonaws.com': '^AWS4-HMAC-SHA256 Credential=.+$',
    'opensearch:9200': '^AWS4-HMAC-SHA256 Credential=.+$',
    'dynamodb-local:8000': '^AWS4-HMAC-SHA256 Credential=.+$',
    '': '<PLEASE-FILL-IN-REGEX-HERE>'
  },
  'x-amz-date': {
    '.us-west-2.amazonaws.com': '^[0-9]{8}T[0-9]{6}Z$'
  },
  'x-amz-security-token': {
    '.us-west-2.amazonaws.com': '^X{368}$'
  },
  'x-amz-content-sha256': {
    '.us-west-2.amazonaws.com': ({ value }) => (value === 'UNSIGNED-PAYLOAD' ? value : '^[a-f0-9]{64}$')
  }
});
