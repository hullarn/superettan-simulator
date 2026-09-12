/* oxlint-disable typescript/no-require-imports -- Passenger loads this startup file as CommonJS. */
const { createServer } = require('node:http');
const { existsSync, readFileSync, realpathSync } = require('node:fs');
const path = require('node:path');

const currentRelease = path.join(__dirname, '.current');
const applicationDirectory = existsSync(currentRelease)
  ? realpathSync(currentRelease)
  : __dirname;
const releaseFile = path.join(applicationDirectory, '.release-sha');

if (existsSync(releaseFile)) {
  const releaseSha = readFileSync(releaseFile, 'utf8').trim();
  if (!/^[a-f0-9]{40}$/.test(releaseSha)) {
    throw new Error(`Ogiltigt release-id i ${releaseFile}.`);
  }
  process.env.APP_RELEASE_SHA = releaseSha;
  process.env.NEXT_DEPLOYMENT_ID = releaseSha;
}

process.chdir(applicationDirectory);
const next = require(path.join(applicationDirectory, 'node_modules', 'next'));

const port = Number.parseInt(process.env.PORT || '3000', 10);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`Ogiltig PORT: ${process.env.PORT}`);
}

const app = next({
  dir: applicationDirectory,
  dev: false,
  hostname: '0.0.0.0',
  port,
});
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    createServer((request, response) => handle(request, response)).listen(
      port,
      () => {
        const release = process.env.APP_RELEASE_SHA ?? 'lokal checkout';
        console.log(`Slutspurten (${release}) lyssnar på port ${port}.`);
      },
    );
  })
  .catch((error) => {
    console.error('Slutspurten kunde inte startas.', error);
    process.exit(1);
  });
