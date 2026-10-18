// The one place where run-to-run variation in captured fixtures is normalized
// (QUAL-008). Nothing is dropped: varying values are replaced by stable tokens.
//
// Normalized fields:
// - Date.now() suffixes in browser-made IDs (`?node_1760000000000`,
//   `?value_…`, `?default_…`, `?empty_…`, `node_…`): replaced by `<ts1>`,
//   `<ts2>`, … in order of first appearance within one scenario.
// - The id returned by POST /api/local-database for an uploaded graph and every
//   later use of it as `endpointUrl`: replaced by `<uploaded-graph>`.

const TIMESTAMP = /(?<=[_-])\d{13}(?!\d)/g;

export function createNormalizer() {
  const timestamps = new Map();
  const uploads = new Set();
  const replaceText = text => {
    let result = text.replace(TIMESTAMP, stamp => {
      if (!timestamps.has(stamp)) timestamps.set(stamp, `<ts${timestamps.size + 1}>`);
      return timestamps.get(stamp);
    });
    for (const upload of uploads) result = result.split(upload).join('<uploaded-graph>');
    return result;
  };
  const walk = value => {
    if (typeof value === 'string') return replaceText(value);
    if (Array.isArray(value)) return value.map(walk);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, walk(item)]));
    return value;
  };
  return {
    rememberUpload(id) { if (id) uploads.add(String(id)); },
    value: walk,
    text: replaceText,
  };
}

/** JSON with sorted object keys and two-space indentation, ending in a newline. */
export function stableJson(value) {
  const sort = item => {
    if (Array.isArray(item)) return item.map(sort);
    if (item && typeof item === 'object') return Object.fromEntries(Object.keys(item).sort().map(key => [key, sort(item[key])]));
    return item;
  };
  return `${JSON.stringify(sort(value), null, 2)}\n`;
}
