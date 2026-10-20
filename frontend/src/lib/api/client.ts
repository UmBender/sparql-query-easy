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
import type { SavedQueryV1 } from '#lib/domain/saved-format.js';
import type { AnswerQuery } from '#lib/domain/study.js';

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
export type AdminTaskSummary = Schemas['AdminTaskSummaryHttpResponse'];
export type AdminTask = Omit<
	Schemas['AdminTaskHttpResponse'],
	'startingGraph' | 'referenceGraph'
> & { startingGraph: SavedQueryV1 | null; referenceGraph: SavedQueryV1 };
export type TaskPreview = Schemas['TaskPreviewHttpResponse'];
export type StudyGroup = Schemas['StudyGroupHttpResponse'];
export type Participant = Schemas['ParticipantHttpResponse'];
export type StudyTaskSummary = Schemas['StudyTaskSummaryHttpResponse'];
export type StudySubmission = Schemas['StudySubmissionHttpResponse'];
export type StudyConsent = Schemas['StudyConsentHttpResponse'];
export type StudyTask = Omit<Schemas['StudyTaskHttpResponse'], 'startingGraph'> & {
	startingGraph: SavedQueryV1 | null;
};
/** A drawn query (DEC-014 Q5): the saved graph and the request derived from it. */
export type DrawnQuery = { graph: SavedQueryV1; query: AnswerQuery };
export type AdminTaskBody = {
	key: string;
	title: string;
	statement: string;
	endpoint: string;
	startingGraph: SavedQueryV1 | null;
	reference: DrawnQuery;
	comparison: 'set' | 'multiset';
	maxResults: number;
};

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
 * `forbidden` 403 (admin and study routes), `conflict` 409, `rate-limited` 429, `unavailable` 503; `server` any other status, `network` no response,
 * `aborted` cancelled by the caller, `unexpected` a 200 whose body is not the
 * documented shape.
 */
export type ApiErrorKind =
	| 'bad-request'
	| 'not-found'
	| 'upstream'
	| 'unauthorized'
	| 'forbidden'
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
	if (status === 403) return 'forbidden';
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
	const put = <T>(
		path: string,
		body: unknown,
		fallback: string,
		valid?: (data: unknown) => boolean
	) =>
		call<T>(
			path,
			{
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(body)
			},
			fallback,
			valid
		);
	const get = <T>(
		path: string,
		fallback: string,
		options: Options = {},
		valid?: (data: unknown) => boolean
	) => call<T>(path, { signal: options.signal }, fallback, valid);
	const isArray = (data: unknown) => Array.isArray(data);
	const isTask = (data: unknown) => !!data && typeof (data as { key?: unknown }).key === 'string';
	const taskPath = (key: string) => `/api/admin/tasks/${encodeURIComponent(key)}`;
	const isGroup = (data: unknown) => !!data && typeof (data as { id?: unknown }).id === 'number';
	const groupPath = (id: number) => `/api/admin/groups/${id}`;
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
		/** STUDY-006: the proposed tasks, for admins. */
		admin: {
			tasks: (options?: Options) =>
				get<AdminTaskSummary[]>('/api/admin/tasks', 'Task list failed', options, isArray),
			task: (key: string, options?: Options) =>
				get<AdminTask>(taskPath(key), 'Task lookup failed', options, isTask),
			createTask: (body: AdminTaskBody) =>
				post<AdminTask>('/api/admin/tasks', body, 'Saving the task failed', {}, isTask),
			updateTask: (key: string, body: AdminTaskBody) =>
				put<AdminTask>(taskPath(key), body, 'Saving the task failed', isTask),
			previewTask: (
				body: { endpoint: string; reference: DrawnQuery; maxResults: number },
				options?: Options
			) =>
				post<TaskPreview>(
					'/api/admin/tasks/preview',
					body,
					'Preview failed',
					options,
					(data) => Array.isArray((data as TaskPreview | null)?.expected)
				),
			setTaskActive: (key: string, active: boolean) =>
				post<AdminTaskSummary>(
					`${taskPath(key)}/${active ? 'reactivate' : 'deactivate'}`,
					{},
					'Changing the task failed',
					{},
					isTask
				),
			/** STUDY-007: participant groups. */
			participants: (options?: Options) =>
				get<Participant[]>(
					'/api/admin/participants',
					'Participant list failed',
					options,
					isArray
				),
			groups: (options?: Options) =>
				get<StudyGroup[]>('/api/admin/groups', 'Group list failed', options, isArray),
			group: (id: number, options?: Options) =>
				get<StudyGroup>(groupPath(id), 'Group lookup failed', options, isGroup),
			createGroup: (name: string) =>
				post<StudyGroup>(
					'/api/admin/groups',
					{ name },
					'Creating the group failed',
					{},
					isGroup
				),
			renameGroup: (id: number, name: string) =>
				put<StudyGroup>(groupPath(id), { name }, 'Renaming the group failed', isGroup),
			setGroupTasks: (id: number, tasks: string[]) =>
				put<StudyGroup>(
					`${groupPath(id)}/tasks`,
					{ tasks },
					'Saving the tasks failed',
					isGroup
				),
			assignMember: (id: number, username: string) =>
				post<StudyGroup>(
					`${groupPath(id)}/members`,
					{ username },
					'Adding the participant failed',
					{},
					isGroup
				),
			unassignMember: (id: number, username: string) =>
				post<StudyGroup>(
					`${groupPath(id)}/members/remove`,
					{ username },
					'Removing the participant failed',
					{},
					isGroup
				),
			/** 204 without a body. */
			async deleteGroup(id: number): Promise<void> {
				let response: Response;
				try {
					response = await fetcher(`${baseUrl}${groupPath(id)}/delete`, {
						method: 'POST',
						headers: { 'content-type': 'application/json' },
						body: '{}'
					});
				} catch (error) {
					throw new ApiError(
						'network',
						error instanceof Error ? error.message : String(error)
					);
				}
				if (!response.ok) {
					const body = (await response.json().catch(() => null)) as {
						error?: string;
					} | null;
					throw new ApiError(
						kindOf(response.status),
						body?.error || `Deleting the group failed (${response.status}).`,
						response.status
					);
				}
			}
		},
		/** STUDY-003…005: the caller's proposed tasks; STUDY-008: the consent that opens them. */
		study: {
			consent: (options?: Options) =>
				get<StudyConsent>(
					'/api/study/consent',
					'Loading the consent text failed',
					options,
					(data) => typeof (data as StudyConsent | null)?.version === 'number'
				),
			/** Accepting stores the version with the server's time; a stale version answers `conflict`. */
			acceptConsent: (version: number) =>
				post<{ version: number; acceptedAt: string }>(
					'/api/study/consent',
					{ version },
					'Accepting the consent failed',
					{},
					(data) =>
						typeof (data as { acceptedAt?: unknown } | null)?.acceptedAt === 'string'
				),
			tasks: (options?: Options) =>
				get<StudyTaskSummary[]>('/api/study/tasks', 'Task list failed', options, isArray),
			task: (key: string, options?: Options) =>
				get<StudyTask>(
					`/api/study/tasks/${encodeURIComponent(key)}`,
					'Opening the task failed',
					options,
					isTask
				),
			/** STUDY-004: the server checks the answer; the client never sends a verdict. */
			submit: (key: string, answer: DrawnQuery) =>
				post<StudySubmission>(
					`/api/study/tasks/${encodeURIComponent(key)}/submissions`,
					answer,
					'Submitting the answer failed',
					{},
					(data) => typeof (data as StudySubmission | null)?.correct === 'boolean'
				),
			/** STUDY-005: the final submission; afterwards the task routes answer `forbidden`. */
			finish: () =>
				post<{ finishedAt: string }>(
					'/api/study/finish',
					{},
					'Finishing the study failed',
					{},
					(data) =>
						typeof (data as { finishedAt?: unknown } | null)?.finishedAt === 'string'
				),
			submissions: (key: string, options?: Options) =>
				get<StudySubmission[]>(
					`/api/study/submissions?${new URLSearchParams({ task: key })}`,
					'Attempt history failed',
					options,
					isArray
				)
		},
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
