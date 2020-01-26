const promClient = require('prom-client');
const { register } = promClient;

const startCollection = () => {
  console.log('Starting the collection of metrics, the metrics are available on /metrics');
  promClient.collectDefaultMetrics();
}

const injectMetricsRoute = (app) => {
  app.get('/metrics', (_, res) => {
    res.set('Content-Type', register.contentType);
    res.end(register.metrics());
  });
}

const imOnline_failure = new promClient.Gauge({
  name: 'polkadot_imOnline_failure',
  help: 'Check imoOnline status',
  labelNames: ['validator', 'chain', 'name', 'version'],
});

module.exports = {
  startCollection,
  injectMetricsRoute,
  imOnline_failure,
};
