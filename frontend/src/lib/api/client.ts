/**
 * Typed client for the Ktor API (FE-043). Responses are typed from the
 * OpenAPI document (`schema.d.ts`, generated); request bodies come from the
 * domain's request mapping, which is checked against fixtures/legacy. Every
 * method resolves to the `data` of a `DataResponse` or rejects with an
 * `ApiError` carrying the 400/404/502 contract (tcc/03 - Backend/API v1.md).
 */
import type { components } from './schema';
import type {
	CountRequest,
	NumericProfileRequest,
	QueryFilter,
	StageRequestBody,
	VariableFilter
} from '#lib/domain/legacy/query-calculations.js';
import type { StageRequest } from '#lib/domain/legacy/query-stages.js';

type Schemas = components['schemas'];
export type PropertyItem = Schemas['PropertyDtoResponse'];
export type StagePage = Schemas['StageCandidatesHttpResponse'];
export type StageCandidate = Schemas['StageCandidateHttpResponse'];
export type RdfTerm = Schemas['RdfTermHttp'];
export type NumericProfile = Schemas['NumericProfileHttpResponse'];
export type ResultCount = Schemas['ResultCountHttpResponse'];
export type EndpointItem = Schemas['EndpointHttpItem'];
export type Health = Schemas['HealthResponse'];
export type SessionUser = Schemas['SessionUserHttpResponse'];
export type Credentials = { username: string; password: string };

export type QueryBody = {
	endpointUrl: string;
	where: QueryFilter[] | { subject: string; predicate: string; object: string }[];
	variableName: string;
	limit: number;
	ignoreWikidata?: boolean;
	variableFilters?: VariableFilter[];
};
export type RelationshipsBody = { endpointUrl: string; id: string; limit?: number };
export type RelationshipValueBody = {
	endpointUrl: string;
	subjectId: string;
	predicateId: string;
	isLiteral: boolean;
};
export type SearchBody = { endpointUrl: string; search: string; limit: number };

/**
 * `bad-request` 400, `not-found` 404 (unknown uploaded graph), `upstream` 502
 * (endpoint failure); for the account routes (AUTH-001) `unauthorized` 401,
 * `conflict` 409, `rate-limited` 429, `unavailable` 503; `server` any other status, `network` no response,
 * `aborted` cancelled by the caller, `unexpected` a 200 whose body is not the
 * documented shape.
 */
export type ApiErrorKind =
	| 'bad-request'
	| 'not-found'
	| 'upstream'
	| 'unauthorized'
	| 'conflict'
	| 'rate-limited'
	| 'unavailable'
	| 'server'
	| 'network'
	| 'aborted'
	| 'unexpected';

export class ApiError extends Error {
	readonly kind: ApiErrorKind;
	readonly status: number | null;
	constructor(kind: ApiErrorKind, message: string, status: number | null = null) {
		super(message);
		this.name = kind === 'aborted' ? 'AbortError' : 'ApiError';
		this.kind = kind;
		this.status = status;
	}
}

export function isAbort(error: unknown): boolean {
	return (
		(error instanceof ApiError && error.kind === 'aborted') ||
		(error instanceof Error && error.name === 'AbortError')
	);
}

function kindOf(status: number): ApiErrorKind {
	if (status === 400) return 'bad-request';
	if (status === 404) return 'not-found';
	if (status === 502) return 'upstream';
	if (status === 401) return 'unauthorized';
	if (status === 409) return 'conflict';
	if (status === 429) return 'rate-limited';
	if (status === 503) return 'unavailable';
	return 'server';
}

type Options = { signal?: AbortSignal };

export type ApiClientOptions = { fetch?: typeof fetch; baseUrl?: string };

export function createApiClient({
	fetch: fetcher = (...args) => globalThis.fetch(...args),
	baseUrl = ''
}: ApiClientOptions = {}) {
	async function call<T>(
		path: string,
		init: RequestInit,
		fallback: string,
		valid: (data: unknown) => boolean = () => true
	): Promise<T> {
		let response: Response;
		try {
			response = await fetcher(`${baseUrl}${path}`, init);
		} catch (error) {
			if (error instanceof Error && error.name === 'AbortError')
				throw new ApiError('aborted', 'The request was cancelled.');
			throw new ApiError('network', error instanceof Error ? error.message : String(error));
		}
		const body: unknown = await response.json().catch(() => null);
		if (!response.ok) {
			const message =
				body &&
				typeof body === 'object' &&
				typeof (body as { error?: unknown }).error === 'string'
					? (body as { error: string }).error
					: '';
			throw new ApiError(
				kindOf(response.status),
				message || `${fallback} (${response.status}).`,
				response.status
			);
		}
		const data =
			body && typeof body === 'object' ? (body as { data?: unknown }).data : undefined;
		if (data === undefined || !valid(data))
			throw new ApiError(
				'unexpected',
				`Unexpected ${fallback.toLowerCase().replace(/ failed$/, '')} response.`,
				response.status
			);
		return data as T;
	}

	const post = <T>(
		path: string,
		body: unknown,
		fallback: string,
		options: Options = {},
		valid?: (data: unknown) => boolean
	) =>
		call<T>(
			path,
			{
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(body),
				signal: options.signal
			},
			fallback,
			valid
		);
	const isArray = (data: unknown) => Array.isArray(data);
	const isUser = (data: unknown) =>
		!!data && typeof (data as { username?: unknown }).username === 'string';

	return {
		/** GET /health (not an envelope). */
		async health(options: Options = {}): Promise<Health> {
			let response: Response;
			try {
				response = await fetcher(`${baseUrl}/health`, { signal: options.signal });
			} catch (error) {
				throw new ApiError(
					'network',
					error instanceof Error ? error.message : String(error)
				);
			}
			const body = (await response.json().catch(() => null)) as Health | null;
			if (!response.ok)
				throw new ApiError(
					kindOf(response.status),
					`Health check failed (${response.status}).`,
					response.status
				);
			if (!body || typeof body.status !== 'string')
				throw new ApiError('unexpected', 'Unexpected health response.', response.status);
			return body;
		},
		endpoints: (options: Options = {}) =>
			call<EndpointItem[]>(
				'/api/endpoints',
				{ signal: options.signal },
				'Endpoint list failed',
				isArray
			),
		/** POST /api/local-database; resolves to the uploaded graph id. */
		upload: (file: Blob, name: string, options: Options = {}) => {
			const form = new FormData();
			form.append('ttlFile', file, name);
			return call<string>(
				'/api/local-database',
				{ method: 'POST', body: form, signal: options.signal },
				'Upload failed',
				(data) => typeof data === 'string'
			);
		},
		relationships: (body: RelationshipsBody, options?: Options) =>
			post<PropertyItem[]>(
				'/api/query/relationships',
				body,
				'Relationships failed',
				options,
				isArray
			),
		relationshipValue: (body: RelationshipValueBody, options?: Options) =>
			post<PropertyItem[]>(
				'/api/query/relationship-value',
				body,
				'Value lookup failed',
				options,
				isArray
			),
		search: (body: SearchBody, options?: Options) =>
			post<PropertyItem[]>('/api/query/search', body, 'Search failed', options, isArray),
		query: (body: QueryBody, options?: Options) =>
			post<PropertyItem[]>('/api/query', body, 'Query failed', options, isArray),
		stage: (body: StageRequest | StageRequestBody, options?: Options) =>
			post<StagePage>('/api/query/stage', body, 'Stage request failed', options, (data) =>
				Array.isArray((data as StagePage | null)?.candidates)
			),
		numericProfile: (body: NumericProfileRequest, options?: Options) =>
			post<NumericProfile>(
				'/api/query/numeric-profile',
				body,
				'Numeric profile failed',
				options,
				(data) => Array.isArray((data as NumericProfile | null)?.values)
			),
		count: (body: CountRequest, options?: Options) =>
			post<ResultCount>('/api/query/count', body, 'Count failed', options, (data) =>
				Number.isFinite((data as ResultCount | null)?.count)
			),
		sparql: (body: QueryBody, options?: Options) =>
			post<string>(
				'/api/query/sparql',
				body,
				'SPARQL generation failed',
				options,
				(data) => typeof data === 'string'
			),
		/** GET /api/auth/session; rejects with `unauthorized` when nobody is logged in. */
		session: (options: Options = {}) =>
			call<SessionUser>(
				'/api/auth/session',
				{ signal: options.signal },
				'Session check failed',
				isUser
			),
		/** POST /api/auth/register; the session cookie is set by the response. */
		register: (body: Credentials, options?: Options) =>
			post<SessionUser>('/api/auth/register', body, 'Registration failed', options, isUser),
		login: (body: Credentials, options?: Options) =>
			post<SessionUser>('/api/auth/login', body, 'Login failed', options, isUser),
		/** POST /api/auth/logout (204, no body). */
		async logout(options: Options = {}): Promise<void> {
			let response: Response;
			try {
				response = await fetcher(`${baseUrl}/api/auth/logout`, {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: '{}',
					signal: options.signal
				});
			} catch (error) {
				throw new ApiError(
					'network',
					error instanceof Error ? error.message : String(error)
				);
			}
			if (!response.ok) {
				const body = (await response.json().catch(() => null)) as { error?: string } | null;
				throw new ApiError(
					kindOf(response.status),
					body?.error || `Logout failed (${response.status}).`,
					response.status
				);
			}
		}
	};
}

export type ApiClient = ReturnType<typeof createApiClient>;

/** The app's client: same origin (the Vite dev server and the web service proxy /api). */
export const api: ApiClient = createApiClient();
