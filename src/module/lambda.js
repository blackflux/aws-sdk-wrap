import assert from 'assert';

export default ({
  call,
  logger
}) => {
  const updateProvisionedConcurrency = async (functionName, concurrency, aliasName) => {
    const aliasResult = await call(
      'lambda:GetAliasCommand',
      {
        FunctionName: functionName,
        Name: aliasName
      },
      { expectedErrorCodes: ['ResourceNotFoundException'] }
    );
    if (aliasResult === 'ResourceNotFoundException') {
      return;
    }
    if (concurrency === 0) {
      await call('lambda:DeleteProvisionedConcurrencyConfigCommand', {
        FunctionName: functionName,
        Qualifier: aliasName
      });
    } else {
      await call('lambda:PutProvisionedConcurrencyConfigCommand', {
        FunctionName: functionName,
        Qualifier: aliasName,
        ProvisionedConcurrentExecutions: concurrency
      });
    }
  };

  const queryHistory = async (functionName, StartTime, EndTime, Period) => {
    const params = {
      StartTime: new Date(StartTime * 1000),
      EndTime: new Date(EndTime * 1000),
      MetricDataQueries: [ /* required */
        {
          Id: 'metric_aliasmetricsviewgraph0',
          MetricStat: {
            Metric: {
              Dimensions: [{ Name: 'FunctionName', Value: functionName }],
              MetricName: 'ConcurrentExecutions',
              Namespace: 'AWS/Lambda'
            },
            Period,
            Stat: 'Maximum',
            Unit: 'Count'
          },
          ReturnData: true
        }
      ],
      ScanBy: 'TimestampAscending'
    };
    return call('Cloudwatch:GetMetricDataCommand', params);
  };

  return {
    FunctionScaler: ({
      functionName,
      aliasName = 'provisioned',
      enabledSsmSettingKey = 'PROVISIONED_CONCURRENCY_ENABLED',
      PERIOD_IN_SECONDS = 300,
      WEEK_IN_SECONDS = 60 * 60 * 24 * 7,
      LOOK_AHEAD_PERIODS = 1,
      LOOK_BEHIND_WEEKS = 8,
      MIN_VALUE = 0,
      MAX_VALUE = 100
    }) => {
      const WEEK_PERIODS = WEEK_IN_SECONDS / PERIOD_IN_SECONDS;

      const computeDesiredConcurrency = (startTime, endTime, timestamps, values) => {
        const obj = {};
        for (let c = startTime; c < endTime; c += PERIOD_IN_SECONDS) {
          obj[new Date(c * 1000).toISOString()] = 0;
        }
        for (let idx = 0; idx < timestamps.length; idx += 1) {
          obj[timestamps[idx].toISOString()] = values[idx];
        }
        const results = [];
        for (let week = 0; week < LOOK_BEHIND_WEEKS; week += 1) {
          for (let period = 0; period <= LOOK_AHEAD_PERIODS; period += 1) {
            const idx = week * WEEK_PERIODS + period;
            const e = new Date(1000 * (startTime + idx * PERIOD_IN_SECONDS)).toISOString();
            assert(e in obj, e);
            results.push([e, obj[e]]);
          }
        }

        const factor = (x) => 1.0 / (x * 0.3 + 1);
        let value = 0;
        let weight = 0;
        for (let week = 0; week < LOOK_BEHIND_WEEKS; week += 1) {
          const idx = LOOK_BEHIND_WEEKS - week - 1;
          let max = 0;
          for (let period = 0; period <= LOOK_AHEAD_PERIODS; period += 1) {
            const i = week * (LOOK_AHEAD_PERIODS + 1) + period;
            assert(i < results.length, i);
            max = Math.max(max, results[i][1]);
          }
          const fact = factor(idx);
          value += max * fact;
          weight += fact;
        }
        value /= weight;
        value = Math.round(value);
        value = Math.max(0, value);
        return value;
      };

      return (restore) => async (event, context) => {
        const r = await call(
          'lambda:GetProvisionedConcurrencyConfigCommand',
          {
            FunctionName: functionName,
            Qualifier: aliasName
          },
          {
            expectedErrorCodes: [
              'ProvisionedConcurrencyConfigNotFoundException',
              'ResourceNotFoundException'
            ]
          }
        );

        if (restore === true) {
          if (r === 'ProvisionedConcurrencyConfigNotFoundException') {
            await updateProvisionedConcurrency(functionName, 1, aliasName);
          }
          return;
        }

        if (r?.Status === 'IN_PROGRESS') {
          return;
        }

        if (
          typeof r?.LastModified === 'string'
          && Date.now() - new Date(r.LastModified) < ((PERIOD_IN_SECONDS * 1000) / 2)
        ) {
          return;
        }

        const { Parameter: { Value } } = await call('SSM:GetParameterCommand', {
          Name: enabledSsmSettingKey
        });
        if (Value !== 'true') {
          await updateProvisionedConcurrency(functionName, 0, aliasName);
          return;
        }

        const unix = Math.round(new Date() / 1000);

        const unixFloor = unix - (unix % PERIOD_IN_SECONDS);
        const StartTime = unixFloor - WEEK_IN_SECONDS * LOOK_BEHIND_WEEKS;
        const unixCeil = unixFloor + PERIOD_IN_SECONDS;
        const EndTime = unixCeil - WEEK_IN_SECONDS + PERIOD_IN_SECONDS * LOOK_AHEAD_PERIODS;

        const { MetricDataResults } = await queryHistory(functionName, StartTime, EndTime, PERIOD_IN_SECONDS);
        const { Timestamps, Values } = MetricDataResults[0];

        const desiredConcurrency = Math.max(
          MIN_VALUE,
          Math.min(
            MAX_VALUE,
            computeDesiredConcurrency(StartTime, EndTime, Timestamps, Values)
          )
        );
        assert(Number.isSafeInteger(desiredConcurrency), desiredConcurrency);

        await updateProvisionedConcurrency(functionName, desiredConcurrency, aliasName);
      };
    }
  };
};
