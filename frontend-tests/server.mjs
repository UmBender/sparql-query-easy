import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;

const JSON_HEADERS = { 'content-type': 'application/json' };
const MIME_TYPES = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
};

export async function startFrontendTestServer() {
  const requests = [];
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname.startsWith('/api/') || url.pathname === '/health') {
      requests.push({ method: request.method, path: url.pathname });
      await consume(request);
      return respondApi(response, url.pathname);
    }
    const relativePath = url.pathname === '/' ? 'index2.html' : url.pathname.slice(1);
    try {
      const content = await readFile(join(ROOT, 'sparql', relativePath));
      response.writeHead(200, { 'content-type': MIME_TYPES[extname(relativePath)] ?? 'application/octet-stream' });
      response.end(content);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    requests,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

function respondApi(response, path) {
  if (path === '/health') return respond(response, { status: 'ok' });
  if (path === '/api/local-database') return respond(response, { data: 'uploaded-test-graph' });
  if (path === '/api/query/search') {
    return respond(response, {
      data: [{ propertyId: '<https://example.test/team-a>', propertyLabel: 'Team A', propertyType: 'objetoClasse', propertyClass: null }],
    });
  }
  if (path === '/api/query/relationships') {
    return respond(response, {
      data: [{ propertyId: '<https://example.test/hasName>', propertyLabel: 'name', propertyType: 'label', propertyClass: null }],
    });
  }
  if (path === '/api/query/relationship-value') {
    return respond(response, {
      data: [{ propertyId: 'Team A', propertyLabel: 'Team A', propertyType: 'text', propertyClass: null }],
    });
  }
  if (path === '/api/query/sparql') return respond(response, { data: 'SELECT DISTINCT ?item WHERE { ?item ?p ?o } LIMIT 20' });
  return respond(response, { data: [] });
}

function respond(response, value) {
  response.writeHead(200, JSON_HEADERS);
  response.end(JSON.stringify(value));
}

async function consume(request) {
  for await (const _chunk of request) {
    // The browser-test server only needs to consume request bodies before responding.
  }
}
