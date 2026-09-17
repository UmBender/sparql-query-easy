export const JQUERY_STUB = `
(() => {
  const callbacks = new Map();
  const wrap = (input) => {
    const nodes = typeof input === 'string' ? [...document.querySelectorAll(input)] : input ? [input] : [];
    const api = {
      ready(callback) { callback(); return api; },
      on(events, callback) { events.split(' ').forEach((event) => nodes.forEach((node) => node.addEventListener(event, callback))); return api; },
      modal() { return api; },
      autocomplete(arg, data) {
        const node = nodes[0];
        if (!node) return api;
        if (typeof arg === 'object') callbacks.set(node.id, arg.onAutocomplete);
        if (arg === 'updateData') node.dataset.autocomplete = JSON.stringify(data);
        return api;
      },
      html(value) { if (value !== undefined) nodes.forEach((node) => { node.innerHTML = value; }); return api; },
      text(value) { if (value !== undefined) nodes.forEach((node) => { node.textContent = value; }); return api; },
      val(value) { if (value === undefined) return nodes[0]?.value; nodes.forEach((node) => { node.value = value; }); return api; },
      attr() { return api; }, prop() { return api; }, find() { return wrap(null); }, each() { return api; },
      closest() { return wrap(null); }, append() { return api; }, remove() { return api; },
      addClass() { return api; }, removeClass() { return api; }, css() { return api; },
      is() { return false; }, trigger() { return api; }, click() { return api; },
    };
    return api;
  };
  wrap.ajax = (options) => {
    const headers = options.contentType === 'application/json' ? { 'content-type': 'application/json' } : undefined;
    fetch(options.url, { method: options.type ?? 'GET', headers, body: options.data })
      .then(async (response) => {
        const body = await response.text();
        if (!response.ok) throw { responseText: body };
        options.success?.(body ? JSON.parse(body) : undefined);
      })
      .catch((error) => options.error?.(error));
  };
  wrap.get = (url) => {
    const request = fetch(url).then((response) => response.json());
    return { done(callback) { request.then((data) => callback(data, 'success')); return this; }, fail(callback) { request.catch(callback); return this; } };
  };
  window.__autocompleteCallbacks = callbacks;
  window.$ = window.jQuery = wrap;
})();
`;

export const MATERIALIZE_STUB = `
window.M = {
  toast() {},
  AutoInit() {},
  Modal: { init() {} },
  FormSelect: { init() {} },
  Sidenav: { init() {} },
};
`;

export const INTRO_STUB = `window.introJs = () => ({ setOptions() { return this; }, start() {} });`;
