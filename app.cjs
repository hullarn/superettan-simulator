/* oxlint-disable typescript/no-require-imports -- Passenger loads this startup file as CommonJS. */
const { createServer } = require('node:http');
const next = require('next');

const port = Number.parseInt(process.env.PORT || '3000', 10);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`Ogiltig PORT: ${process.env.PORT}`);
}

const app = next({
  dev: false,
  hostname: '0.0.0.0',
  port,
});
const handle = app.getRequestHandler();

app.prepare()
  .then(() => {
    createServer((request, response) => handle(request, response)).listen(port, () => {
      console.log(`Slutspurten lyssnar på port ${port}.`);
    });
  })
  .catch((error) => {
    console.error('Slutspurten kunde inte startas.', error);
    process.exit(1);
  });
