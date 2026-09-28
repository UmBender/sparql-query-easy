import { readFileSync } from 'node:fs';
import { CYTOSCAPE_HTML_LABEL_STUB, INTRO_STUB, JQUERY_STUB, MATERIALIZE_STUB } from './cdn-stubs.mjs';

const materializeCss = readFileSync(new URL('../node_modules/materialize-css/dist/css/materialize.min.css', import.meta.url), 'utf8');

/**
 * Local replacements for the page's third-party assets. Browser suites fulfill
 * these and reject every other external request.
 */
export function externalAssetFixture(url) {
  const key = `${url.hostname}${url.pathname}`;
  const scripts = new Map([
    ['ajax.googleapis.com/ajax/libs/jquery/2.1.1/jquery.min.js', JQUERY_STUB],
    ['cdnjs.cloudflare.com/ajax/libs/materialize/1.0.0/js/materialize.min.js', MATERIALIZE_STUB],
    ['cdnjs.cloudflare.com/ajax/libs/intro.js/7.2.0/intro.min.js', INTRO_STUB],
    ['unpkg.com/cytoscape-html-label@1.1.7/dist/cytoscape-html-label.js', CYTOSCAPE_HTML_LABEL_STUB],
  ]);
  if (scripts.has(key)) return { contentType: 'text/javascript', body: scripts.get(key) };
  if (key === 'fonts.googleapis.com/icon') {
    // Keep icon glyph boxes the same size as Material Icons without fetching font files.
    return { contentType: 'text/css', body: '.material-icons { display: inline-block; width: 24px; height: 24px; overflow: hidden; font-size: 0; line-height: 24px; vertical-align: middle; }' };
  }
  if (key === 'cdnjs.cloudflare.com/ajax/libs/materialize/1.0.0/css/materialize.min.css') {
    return { contentType: 'text/css', body: materializeCss };
  }
  if (key === 'cdnjs.cloudflare.com/ajax/libs/intro.js/7.2.0/introjs.css') {
    // The Intro.js test stub does not render tooltips; keep its stylesheet local.
    return { contentType: 'text/css', body: '.introjs-overlay, .introjs-tooltip { position: fixed; }' };
  }
  if (key === 'cygri.github.io/rdf-logos/svg/sparql.svg') {
    return { contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"/>' };
  }
  return null;
}

/**
 * Serve same-origin traffic, fulfill known third-party assets locally and record
 * every other external request as unexpected (it is aborted).
 */
export async function guardExternalTraffic(page, baseUrl) {
  const unexpected = [];
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.origin === baseUrl) return route.continue();
    const fixture = externalAssetFixture(url);
    if (fixture) return route.fulfill(fixture);
    unexpected.push(url.href);
    return route.abort('blockedbyclient');
  });
  return unexpected;
}
