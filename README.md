# log-id

Wrapper around `pino` logger that logs with `correlation-id`.

Bundles connect `middlewares` and `errorHandler` to log express/connect requests.

## Install

```
npm install --save log-id
```

## Usage

``` js
const correlator = require('express-correlation-id');
const express = require('express');

const Logger = require('correlation-id-logger');
const logger = new Logger({
  level: 'debug',
  format: 'pretty',
  correlator
});

const app = express();
app.use(correlator());
app.use(logger.connectMiddleware({level: 'debug'}));

app.get('/', function(req, res) {
  res.send('HI!');
});

app.use(logger.connectErrorHandler({level: 'warn'}));

app.listen(3000, function() {
  logger.info('started.');
});
```
