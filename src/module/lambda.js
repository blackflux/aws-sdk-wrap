module.exports = ({
  call,
  logger
}) => {
  const updateProvisionedConcurrency = async (functionName, concurrency, aliasName) => {
    const aliasResult = await call(
      'lambda:getAlias',
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
      await call('lambda:deleteProvisionedConcurrencyConfig', {
        FunctionName: functionName,
        Qualifier: aliasName
      });
    } else {
      await call('lambda:putProvisionedConcurrencyConfig', {
        FunctionName: functionName,
        Qualifier: aliasName,
        ProvisionedConcurrentExecutions: concurrency
      });
    }
  };

  const queryHistory = async (functionName, StartTime, EndTime, Period) => {
    const params = {
      StartTime,
      EndTime,
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
    return call('cloudwatch:getMetricData', params);
  };

  return {
    FunctionScaler: ({
      functionName,
      datetime = null,
      aliasName = 'provisioned',
      enabledSsmSettingKey = 'PROVISIONED_CONCURRENCY_ENABLED',
      PERIOD_IN_SECONDS = 300,
      WEEK_IN_SECONDS = 60 * 60 * 24 * 7,
      LOOK_AHEAD_PERIODS = 1,
      LOOK_BEHIND_WEEKS = 8
    }) => {
      const WEEK_PERIODS = WEEK_IN_SECONDS / PERIOD_IN_SECONDS;

      const computeDesiredConcurrency = (timestamps, values) => {
        const results = [];
        for (let week = 0; week < LOOK_BEHIND_WEEKS; week += 1) {
          for (let period = 0; period <= LOOK_AHEAD_PERIODS; period += 1) {
            const idx = week * WEEK_PERIODS + period;
            results.push([timestamps[idx], values[idx]]);
          }
        }

        const factor = (x) => 1.0 / (x * 0.3 + 1);
        let value = 0;
        let weight = 0;
        for (let week = 0; week < LOOK_BEHIND_WEEKS; week += 1) {
          const idx = LOOK_BEHIND_WEEKS - week - 1;
          let max = 0;
          for (let period = 0; period <= LOOK_AHEAD_PERIODS; period += 1) {
            max = Math.max(max, results[week * (LOOK_AHEAD_PERIODS + 1) + period][1]);
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

      return (restore = false) => async (event, context) => {
        const r = await call(
          'lambda:getProvisionedConcurrencyConfig',
          {
            FunctionName: functionName,
            Qualifier: aliasName
          },
          { expectedErrorCodes: ['ProvisionedConcurrencyConfigNotFoundException'] }
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

        const { Parameter: { Value } } = await call('ssm:getParameter', {
          Name: enabledSsmSettingKey
        });
        if (Value !== 'true') {
          await updateProvisionedConcurrency(functionName, 0, aliasName);
          return;
        }

        const unix = Math.round(datetime === null ? new Date() : datetime / 1000);

        const unixFloor = unix - (unix % PERIOD_IN_SECONDS);
        const StartTime = unixFloor - WEEK_IN_SECONDS * LOOK_BEHIND_WEEKS;
        const unixCeil = unixFloor + PERIOD_IN_SECONDS;
        const EndTime = unixCeil - WEEK_IN_SECONDS + PERIOD_IN_SECONDS * LOOK_AHEAD_PERIODS;

        const { MetricDataResults } = await queryHistory(functionName, StartTime, EndTime, PERIOD_IN_SECONDS);
        const { Timestamps, Values } = MetricDataResults[0];

        const desiredConcurrency = computeDesiredConcurrency(Timestamps, Values);

        await updateProvisionedConcurrency(functionName, desiredConcurrency, aliasName);
      };
    }
  };
};
