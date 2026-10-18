// Independent oracle for the legacy fixture corpus (QUAL-008/QUAL-009): reads
// src/main/resources/pokemon_gen1.ttl directly, without Jena or the backend, so
// a captured response is checked against the data instead of against itself.
// The file is generated with one subject block per resource and prefixed names,
// which is all this reader supports.
import { readFileSync } from 'node:fs';

const PREFIXES = {
  pk: 'http://easyquery.example.org/pokemon#',
  owl: 'http://www.w3.org/2002/07/owl#',
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
  xsd: 'http://www.w3.org/2001/XMLSchema#',
};

export const PK = PREFIXES.pk;
export const DATASET = new URL('../../src/main/resources/pokemon_gen1.ttl', import.meta.url);

function expand(name) {
  const [prefix, local] = name.split(':');
  if (!(prefix in PREFIXES)) throw new Error(`Unknown prefix in ${name}`);
  return PREFIXES[prefix] + local;
}

/** Tokens of one statement body: prefixed names, numbers, quoted literals, `,` `;` `.` */
function tokens(text) {
  const result = [];
  const pattern = /"((?:[^"\\]|\\.)*)"(?:@[\w-]+|\^\^\S+)?|[;,.](?=\s|$)|[^\s;,]+(?:\.\d+)?/gy;
  let index = 0;
  while (index < text.length) {
    if (/\s/.test(text[index])) { index++; continue; }
    pattern.lastIndex = index;
    const match = pattern.exec(text);
    if (!match) throw new Error(`Cannot read TTL near: ${text.slice(index, index + 40)}`);
    result.push(match[1] !== undefined ? { literal: match[1] } : match[0]);
    index = pattern.lastIndex;
  }
  return result;
}

/** @returns {Map<string, Map<string, {type: 'iri' | 'literal', value: string}[]>>} */
export function loadPokemonGraph() {
  const lines = readFileSync(DATASET, 'utf8').split('\n')
    .filter(line => !line.startsWith('#') && !line.startsWith('@prefix'));
  const graph = new Map();
  const statements = lines.join('\n').split(/\n(?=\S)/).map(block => block.trim()).filter(Boolean);
  for (const statement of statements) {
    const [subjectName, ...rest] = tokens(statement);
    const subject = expand(subjectName);
    const properties = graph.get(subject) ?? new Map();
    let predicate = null;
    for (const token of rest) {
      if (token === ';' || token === '.') { predicate = null; continue; }
      if (token === ',') continue;
      if (predicate === null) {
        predicate = token === 'a' ? PREFIXES.rdf + 'type' : expand(token);
        continue;
      }
      const value = typeof token === 'object' ? { type: 'literal', value: token.literal }
        : /^[+-]?\d/.test(token) ? { type: 'literal', value: token }
          : { type: 'iri', value: expand(token) };
      properties.set(predicate, [...(properties.get(predicate) ?? []), value]);
    }
    graph.set(subject, properties);
  }
  return graph;
}

const graph = loadPokemonGraph();

/** Values of one property of a subject. */
export function values(subject, predicate) {
  return graph.get(subject)?.get(predicate) ?? [];
}

/** Subjects whose property holds the given IRI. */
export function subjectsWith(predicate, iri) {
  return [...graph.keys()].filter(subject => values(subject, predicate).some(item => item.type === 'iri' && item.value === iri));
}

/** Numeric value of a single-valued numeric property, or undefined. */
export function number(subject, predicate) {
  const [value] = values(subject, predicate);
  return value ? Number(value.value) : undefined;
}

export function label(subject) {
  return values(subject, PREFIXES.rdfs + 'label')[0]?.value;
}

export const pk = local => PK + local;
