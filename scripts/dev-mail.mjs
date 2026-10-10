import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const directory = resolve(process.env.BAYMED_DEV_MAIL_DIR ?? '.cache');
const destination = resolve(directory, 'latest-login-mail.json');
await mkdir(directory, { recursive: true });

createServer((request, response) => {
  if (request.method !== 'POST' || request.url !== '/api/v1/send') {
    response.writeHead(404).end();
    return;
  }
  let raw = '';
  request.on('data', (chunk) => {
    raw += chunk;
    if (raw.length > 50_000) request.destroy();
  });
  request.on('end', async () => {
    try {
      const message = JSON.parse(raw);
      if (!Array.isArray(message.To) || typeof message.Text !== 'string') throw new Error('Invalid mail');
      await writeFile(destination, JSON.stringify(message, null, 2), { mode: 0o600 });
      response.writeHead(200, { 'Content-Type': 'application/json' }).end('{}');
    } catch {
      response.writeHead(400).end();
    }
  });
}).listen(8025, '127.0.0.1', () => {
  console.log(`Development mail sink ready; latest message: ${destination}`);
});
