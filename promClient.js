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

const imOnline = new promClient.Gauge({
  name: 'polkadot_imOnline',
  help: 'Check imoOnline status',
  labelNames: ['status', 'validator', 'chain', 'name', 'version'],
});



module.exports = {
  startCollection,
  injectMetricsRoute,
  imOnline,
};
