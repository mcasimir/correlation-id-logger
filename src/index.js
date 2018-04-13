const pino = require('pino');

class Logger {
  constructor(options = {}) {

    const {
      level = 'info',
      format = 'json',
      silent = false,
      transport = stdoutStream(format),
      correlator,
      serializers,
      correlationIdProperty = 'correlation-id'
    } = options;

    const pretty = format === 'pretty';

    let pinoTransport = transport;
    if (pretty) {
      const prettyTransport = pino.pretty();
      prettyTransport.pipe(transport);
      pinoTransport = prettyTransport;
    }

    const defaultSerializers = {
      req: pino.stdSerializers.req,
      res: pino.stdSerializers.res,
      err: pino.stdSerializers.err
    };

    const defaultPinoOptions = {
      level,
      timestamp: pino.stdTimeFunctions.slowTime,
      pretty,
      serializers: Object.assign(defaultSerializers, serializers)
    };

    if (!pretty) {
      defaultPinoOptions.messageKey = 'message';
    }

    const pinoOptions = Object.assign(
      defaultPinoOptions,
      options.pinoOptions
    );

    const pinoInstance = pino(pinoOptions, pinoTransport);

    for (const level of ['debug', 'info', 'warn', 'error']) {
      this[level] = (message, metadata = {}) => {
        if (correlator) {
          metadata[correlationIdProperty] = correlator.getId();
        }

        if (silent) {
          return;
        }

        pinoInstance[level](metadata, message);
      };
    }
  }

  connectMiddleware({
    level = 'info',
    message = function(req) {
      return `${req.method} ${req.path}`;
    }
  } = {}) {
    const logger = this;

    return function logidConnectMiddleware(req, res, next) {
      logger[level](message(req), {req});

      next();
    };
  }

  connectErrorHandler({
    level = 'error',
    message = function(req) {
      return `ERROR ${req.method} ${req.path}`;
    }
  } = {}) {
    const logger = this;

    return function logidConnectErrorHandler(err, req, res, next) {
      logger[level](message(req), {req, err});

      next(err);
    };
  }
}

module.exports = Logger;

function stringifyVersion(chunk) {
  return chunk.replace(
      /("level":\s*)(\d+)/,
      (match, keyString, levelString) =>
          `${keyString}"${pino.levels.labels[parseInt(levelString, 10)]}"`,
  );
}

function stdoutStream(format) {
  if (format === 'pretty') {
    return process.stdout;
  }

  return {
    write(chunk) {
      process.stdout.write(stringifyVersion(chunk));
    }
  };
}
