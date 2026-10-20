/**
 * QUAL-012: the frozen legacy fixtures (`fixtures/legacy/`, QUAL-008/009) by
 * scenario name. Vite bundles the files, so both Vitest projects (node and
 * browser) can load them without `node:fs`. Never edit a fixture to make a
 * test pass (fixtures/legacy/README.md).
 */

/** One `/api/*` request the legacy page sent, in order. */
export type CapturedRequest = { method: string; path: string; body: unknown };
/** The response to the request at the same index. */
export type CapturedResponse = { status: number; body: unknown };

export type LegacyFixture = {
	name: string;
	requests: CapturedRequest[];
	responses: CapturedResponse[];
	/** The text View SPARQL showed at the end of the scenario. */
	sparql: string;
	/** The Export Query file (four scenarios only). */
	exported?: unknown;
};

const glob = {
	requests: import.meta.glob<CapturedRequest[]>('../../../../fixtures/legacy/*.request.json', {
		eager: true,
		import: 'default'
	}),
	responses: import.meta.glob<CapturedResponse[]>('../../../../fixtures/legacy/*.response.json', {
		eager: true,
		import: 'default'
	}),
	sparql: import.meta.glob<string>('../../../../fixtures/legacy/*.sparql', {
		eager: true,
		query: '?raw',
		import: 'default'
	}),
	exported: import.meta.glob<unknown>('../../../../fixtures/legacy/*.export.json', {
		eager: true,
		import: 'default'
	})
};

const byName = <T>(files: Record<string, T>): Map<string, T> =>
	new Map(
		Object.entries(files).map(([path, value]) => [
			path
				.slice(path.lastIndexOf('/') + 1)
				.replace(/\.(request|response|export)\.json$|\.sparql$/, ''),
			value
		])
	);

const requests = byName(glob.requests);
const responses = byName(glob.responses);
const sparql = byName(glob.sparql);
const exported = byName(glob.exported);

/** Every scenario name, sorted. */
export const FIXTURE_NAMES: readonly string[] = [...requests.keys()].sort();

/** The fixture files of one scenario; an unknown name fails with the known ones. */
export function loadFixture(name: string): LegacyFixture {
	const captured = requests.get(name);
	if (!captured)
		throw new Error(`Unknown legacy fixture "${name}". Known: ${FIXTURE_NAMES.join(', ')}`);
	return {
		name,
		requests: captured,
		responses: responses.get(name) ?? [],
		sparql: sparql.get(name) ?? '',
		...(exported.has(name) ? { exported: exported.get(name) } : {})
	};
}
