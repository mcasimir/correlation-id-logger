const Logger = require('..');
const interceptStdout = require('intercept-stdout');
const {equal} = require('assert');
const MockDate = require('mockdate');
const {hostname} = require('os');
const stripColor = require('strip-color');
const express = require('express');
const supertest = require('supertest');

describe('correlation-id-logger', function() {
  let logger;

  beforeEach(function() {
    MockDate.set('1/1/2000');
  });

  afterEach(function() {
    MockDate.reset();
  });

  describe('with defaults', function() {

    beforeEach(function() {
      logger = new Logger();
    });

    it('logs in json', async function() {
      const {message, bar} = await captureJsonOutput(() => {
        logger.info('foo', {bar: 'baz'});
      });

      equal(message, 'foo');
      equal(bar, 'baz');
    });

    describe('info()', function() {
      it('logs {"level": "info"}', async function() {
        const {level} = await captureJsonOutput(() => {
          logger.info('foo');
        });
        equal(level, 'info');
      });
    });

    describe('debug()', function() {
      it('does not log', async function() {
        const output = await captureOutput(() => {
          logger.debug('foo');
        });
        equal(output, '');
      });
    });

    describe('warn()', function() {
      it('logs {"level": "warn"}', async function() {
        const {level} = await captureJsonOutput(() => {
          logger.warn('foo');
        });
        equal(level, 'warn');
      });
    });

    describe('error()', function() {
      it('logs {"level": "error"}', async function() {
        const {level} = await captureJsonOutput(() => {
          logger.error('foo');
        });
        equal(level, 'error');
      });
    });

    describe('connectMiddleware', function() {
      it('logs requests', async function() {
        const app = express();

        app.use(logger.connectMiddleware());

        app.use('/', (req, res) => {
          res.send('');
        });

        const json = await captureJsonOutput(async () => {
          await supertest(app).get('/');
        });

        equal(json.level, 'info');
        equal(json.message, 'GET /');
        equal(json.req.method, 'GET');
        equal(json.req.url, '/');
      });

      it('logs errors', async function() {
        const app = express();

        app.use('/', (req, res, next) => {
          next(new Error('handler error'));
        });

        app.use(logger.connectErrorHandler());
        // eslint-disable-next-line
        app.use((err, req, res, next) => {
          res.send('');
        });

        const json = await captureJsonOutput(async () => {
          await supertest(app).get('/');
        });

        equal(json.level, 'error');
        equal(json.message, 'ERROR GET /');
        equal(json.req.method, 'GET');
        equal(json.req.url, '/');
        equal(json.err.message, 'handler error');
      });
    });
  });

  describe('when level is debug', function() {
    describe('debug()', function() {
      beforeEach(function() {
        logger = new Logger({
          level: 'debug'
        });
      });

      it('logs {"level": "debug"}', async function() {
        const {level} = await captureJsonOutput(() => {
          logger.debug('foo');
        });
        equal(level, 'debug');
      });
    });
  });

  describe('when silent is true', function() {
    beforeEach(function() {
      logger = new Logger({
        silent: true
      });
    });

    it('does not log', async function() {
      const output = await captureOutput(() => {
        logger.info('foo');
      });
      equal(output, '');
    });
  });

  describe('when format is pretty', function() {
    beforeEach(function() {
      logger = new Logger({
        format: 'pretty'
      });
    });

    it('logs in human format', async function() {
      const output = await captureOutput(() => {
        logger.info('foo');
      });

      const expected = `[1999-12-31T23:00:00.000Z] INFO (${process.pid} on ${hostname()}): foo\n`;
      equal(stripColor(output), expected);
    });
  });
});

async function captureJsonOutput(fn) {
  const output = await captureOutput(fn);
  return JSON.parse(output);
}

async function captureOutput(fn) {
  let captured = '';

  const stop = interceptStdout((txt) => {
    captured += txt;
    return '';
  });

  let error;
  try {
    await fn();
  } catch (e) {
    error = e;
  }

  stop();

  if (error) {
    throw error;
  }

  return captured;
}
