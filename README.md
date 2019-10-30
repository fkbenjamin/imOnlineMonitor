# Kusama imOnline Monitoring tool

**Experimental**, so no guarantee this actually works :)
<br/>
**From Staking Facilities with ❤️**

## Getting Started
### Installing

Install packages by running

```
yarn install
```

### Run it

#### Example
```
node index.js --node wss://kusama-rpc.polkadot.io/ --validator H1ye1dQ7zVM8obAmb21kfUKA8otRekWXn6fiToKusamaJK9 --validator ET9SkhNZhY7KT474vkCEJtAjbgJdaqAGW4beeeUJyDQ3SnA --sentry https://s8sdadg8dgvdna8dsf@sentry.io/1234567
```

```
--node, --ws        Provide a websocket to query data from (e.g.
                      wss://kusama-rpc.polkadot.io/)
--validator, --val  Provide a validator to be monitored, flag can be used
                      multiple times to monitor multiple validators
--dsn, --sentry     Provide a Sentry.io DSN to send alerts to. If not
                      provided, no alerts will be triggered.
```

You can create an account at [Sentry.io](https://sentry.io/) to receive alerts via the `--dsn` flag


