const { ApiPromise, WsProvider, ApiRx } = require('@polkadot/api');
const { DerivedSessionInfo } = require('@polkadot/api-derive/types');
const { formatNumber } = require('@polkadot/util');
const Sentry = require('@sentry/node');
const express = require('express');
var yargs = require('yargs');
const prom = require('./promClient');


//Arguments we pass to our script
var argv = yargs.usage('Kusama imOnline Monitoring')
  .options({
    'node': {
      description: 'Provide a websocket to query data from (e.g. wss://kusama-rpc.polkadot.io/)',
      required: true,
      alias: 'ws',
    },
    'validator': {
      description: 'Provide a validator to be monitored, flag can be used multiple times to monitor multiple validators',
      type: 'array',
      required: true,
      alias: 'val',
    },
    'dsn': {
      description: 'Provide a Sentry.io DSN to send alerts to. If not provided, no alerts will be triggered.',
      type: 'string',
      required: false,
      alias: 'sentry',
    },
    'port': {
      description: 'Prometheus exporter port',
      type: 'interger',
      required: false,
      default: 5555,
    }
  }).argv;

//Getting validators to watch out for from arguments
const vals = argv.validator
//Setting up the websocket
const provider = new WsProvider(argv.node);

const app = express();
const port = argv.port;

/// Polkadot API Endpoint
const LocalEndpoint = argv.node;

//Blocks Per Session (KUSAMA)
const bps = 2400;
//initialize correct sentry dsn to alert to
//Format: https://*****************@sentry.io/*******
const sentry = argv.dsn
if (sentry != undefined) {
  console.log("Initializing Sentry alert at url", sentry)
  Sentry.init({ dsn: sentry });
}

async function main () {
  // Create the API and wait until ready
  const api = await ApiPromise.create({
    provider: provider
    });

    prom.injectMetricsRoute(app);
    prom.startCollection();
    app.listen(port, () => console.log(`imOnline monitor running at ${argv.node}`));

  // Retrieve the chain & node information information via rpc calls
  const [chain, nodeName, nodeVersion] = await Promise.all([
    api.rpc.system.chain(),
    api.rpc.system.name(),
    api.rpc.system.version()
  ]);
  //Indicates if we are connected to the correct chain
  console.log(`You are connected to chain ${chain} using ${nodeName} v${nodeVersion}`);
  //validators in the current session
  let validators;
  //indices of validators we are monitoring
  let authIndices;
  //Block Number we last send an alert
  let lastWarn = 0;
  //Last index we alerted on
  let lastIndex = 0;
  //subscribing to new heads of the chain
  const unsubscribe = await api.rpc.chain.subscribeNewHeads(async (header) => {
    console.log(`Chain is at block: #${header.number} hash: #${header.hash}`);
    let progress = await getCurrentSessionProgress(api)
    let session = await getSession(api, header.number)
    /**
    validators in the current session
    we requery this & authIndices everytime since they can change over time
    we could query less (e.g when a new session / era starts), but this is much simpler
    **/

    let validators = await api.query.session.validators();
    //indices of validators we are monitoring
    let authIndices = await getIndices(api,vals,validators);
    for (const [_, authIndex] of authIndices.entries()) {
        console.log(`Checking AuthIndex #${authIndex}, Session #${session}, Progress ${Math.round(progress * 100)}%`);
        let heartbeat = await getHeartbeat(api, session, authIndex)
        //Heartbeat is "0x00" if no heartbeat message was received yet
        if(heartbeat.toString() == "0x00") {
          /**
          this is here to prevent constant alerting, maximum alert for one validator every 10% of a session (should be max every ~24 minutes)
          authIndex > lastIndex because we want to be able to alert for different validators at the same time
          indices are sorted, so every validator can only trigger this once per 10% of session
          **/
          if (header.number > lastWarn + (0.1 * bps) || authIndex > lastIndex) {
            //So that we are not reporting at the start of a new session
            if(Math.round(progress * 100) > 0) {
              sendAlert(validators[authIndex],session)
              lastWarn = header.number.toNumber()
              lastIndex = authIndex
              prom.imOnline_failure.set({validator: validators[authIndex].toString(), chain: chain, name: nodeName, version: nodeVersion }, 1);
            }
          } else {
            //Sending no new alert, but still putting it to the logs / cli
            console.log(validators[authIndex].toString(), "has not submitted a heartbeat this session[",Math.round(progress * 100),"%].")
            prom.imOnline_failure.set({validator: validators[authIndex].toString(), chain: chain, name: nodeName, version: nodeVersion }, 1);
          }
        } else {
          //Indicates that validator has sent a heartbeat this session -> is working properly
          console.log("Everything good -",validators[authIndex].toString()," sent a heartbeat.")
          prom.imOnline_failure.set({validator: validators[authIndex].toString(), chain: chain, name: nodeName, version: nodeVersion }, 0);
        }
      }
  });

}

//check if validator at $authIndex has submitted a heartbeat this session
async function getHeartbeat(api, session, authIndex) {
  let heartbeat = await api.query.imOnline.receivedHeartbeats(session, authIndex)
  return heartbeat
}

//get the current session index we are in
async function getSession(api) {
  let session = await api.query.session.currentIndex()
  return session
}

//Query Progress in current session
async function getCurrentSessionProgress(api){
  let DerivedSession = await api.derive.session.info();
  return DerivedSession.sessionProgress / bps
}

//gets indices of validators we are monitoring in the current validator set
//authIndex is required to query heartbeats
async function getIndices(api, vals, validators) {
  let authIndices = [];
  for (const [index, validator] of validators.entries()){
    if (vals.includes(validator.toString())) {
      authIndices.push(index)
      console.log(index, validator.toString());
    }
  }
  return authIndices
}

//Send an alert in case heartbeat has not been sent
async function sendAlert(val, session, heartbeat) {
  console.log("#####")
  console.log("Reporting",val.toString(),"for session" ,formatNumber(session))
  console.log("#####")

  prom.imOnline.set({validator: validators[authIndex].toString(), chain: chain, name: nodeName, version: nodeVersion }, 1);
  if (sentry != undefined) {
    Sentry.captureMessage(val.toString() +  "is reported offline");
  }
}

main()
