/**
 * Where a query runs (FE-042): a built-in dataset, a graph uploaded in this
 * server session, or a remote SPARQL endpoint URL. The API takes all three as
 * the `endpointUrl` string.
 */
export type Endpoint =
	| { kind: 'builtIn'; id: string }
	| { kind: 'uploaded'; id: string }
	| { kind: 'remote'; url: string };

/**
 * Built-in endpoints until BE-006 serves `GET /api/endpoints`; ids from
 * `EndpointContextResolver.kt`. Wikidata is reached by its public URL.
 */
export const BUILT_IN_ENDPOINTS = [
	{ id: 'CampeonatoBrasileiro2023', label: 'Campeonato Brasileiro 2023', kind: 'local' },
	{ id: 'PokemonGen1', label: 'Pokémon (generation 1)', kind: 'local' },
	{ id: 'https://query.wikidata.org/sparql', label: 'Wikidata', kind: 'remote' }
] as const;

/** Legacy default of the endpoint field. */
export const DEFAULT_ENDPOINT: Endpoint = { kind: 'builtIn', id: 'CampeonatoBrasileiro2023' };
/** Legacy default of the Limit field. */
export const DEFAULT_LIMIT = 150;

export function endpointUrl(endpoint: Endpoint): string {
	return endpoint.kind === 'remote' ? endpoint.url : endpoint.id;
}

/** The endpoint a typed field value means: a built-in id, a URL, or else an uploaded-graph id. */
export function endpointFromText(
	text: string,
	builtIn: readonly { id: string }[] = BUILT_IN_ENDPOINTS
): Endpoint {
	const value = text.trim();
	if (builtIn.some((item) => item.id === value) && !/^https?:\/\//.test(value))
		return { kind: 'builtIn', id: value };
	if (/^https?:\/\//.test(value)) return { kind: 'remote', url: value };
	return { kind: 'uploaded', id: value };
}
