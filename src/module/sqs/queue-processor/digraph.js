export default ({
  queues, ingestSteps, steps
}) => () => {
  const formatStep = (step) => step.replace(/-([a-z])/g, ($1) => $1.slice(1).toUpperCase());

  const result = [
    ...Object.entries(queues)
      .map(([queue, url], idx) => [
        `subgraph cluster_${idx} {`,
        ...[
          `label="${queue}";`,
          'style=filled;',
          `color=${url.endsWith('.fifo') ? '"#ffaaaa"' : 'lightgrey'};`,
          'node [label="node",style=filled,color=white];',
          ...Object
            .values(steps)
            .filter((step) => queue === step.queue)
            .map((step) => `${formatStep(step.name)} [${[
              `label="${step.name}"`,
              step.isParallel ? 'color=red' : null,
              step.delay !== 0 ? 'shape=doublecircle' : null
            ].filter((e) => e !== null).join(',')}];`)
        ].map((e) => `  ${e}`),
        '}'
      ])
      .reduce((p, c) => p.concat(c), []),
    '',
    '_ingest [shape=Mdiamond,label=ingest];',
    ...ingestSteps.map((step) => `_ingest -> ${formatStep(step)};`),
    '',
    ...Object.values(steps).reduce((r, step) => {
      step.next.forEach((nStep) => {
        r.push(`${formatStep(step.name)} -> ${formatStep(nStep)};`);
      });
      return r;
    }, [])
  ];

  return [
    '# Visualize at http://viz-js.com/',
    'digraph G {',
    ...result.map((e) => `  ${e}`),
    '}'
  ];
};
