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
    const aliasExists = aliasResult !== 'ResourceNotFoundException';

    if (concurrency === 0) {
      if (aliasExists) {
        await call('lambda:deleteProvisionedConcurrencyConfig', {
          FunctionName: functionName,
          Qualifier: aliasName
        });
        await call('lambda:deleteAlias', {
          FunctionName: functionName,
          Name: aliasName
        });
      }
      return;
    }

    const { Version } = await call('lambda:publishVersion', {
      FunctionName: functionName
    });

    await call(aliasExists ? 'lambda:updateAlias' : 'lambda:createAlias', {
      FunctionName: functionName,
      FunctionVersion: Version,
      Name: aliasName
    });
    await call('lambda:putProvisionedConcurrencyConfig', {
      FunctionName: functionName,
      Qualifier: aliasName,
      ProvisionedConcurrentExecutions: concurrency
    });
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
      enabled = true,
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

      return async (event, context) => {
        if (enabled) {
          const unix = Math.round(datetime === null ? new Date() : datetime / 1000);

          const unixFloor = unix - (unix % PERIOD_IN_SECONDS);
          const StartTime = unixFloor - WEEK_IN_SECONDS * LOOK_BEHIND_WEEKS;
          const unixCeil = unixFloor + PERIOD_IN_SECONDS;
          const EndTime = unixCeil - WEEK_IN_SECONDS + PERIOD_IN_SECONDS * LOOK_AHEAD_PERIODS;

          const { MetricDataResults } = await queryHistory(functionName, StartTime, EndTime, PERIOD_IN_SECONDS);
          const { Timestamps, Values } = MetricDataResults[0];

          const desiredConcurrency = computeDesiredConcurrency(Timestamps, Values);

          await updateProvisionedConcurrency(functionName, desiredConcurrency, aliasName);
        } else {
          await updateProvisionedConcurrency(functionName, 0, aliasName);
        }
      };
    }
  };
};
