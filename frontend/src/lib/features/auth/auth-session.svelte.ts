/**
 * Who is logged in (AUTH-003). `refresh` asks `GET /api/auth/session`; login,
 * registration and logout update the user from the answers. The cookie is
 * HttpOnly, so this state is the page's only view of the session; nothing
 * is kept in browser storage.
 */
import {
	api,
	ApiError,
	type ApiClient,
	type Credentials,
	type SessionUser
} from '#lib/api/client.js';

export type AuthApi = Pick<ApiClient, 'session' | 'login' | 'register' | 'logout'>;
export type AuthStatus = 'checking' | 'ready' | 'unavailable';
export type AuthOutcome = { ok: true } | { ok: false; error: string };

const UNAVAILABLE = 'Accounts are temporarily unavailable. The query editor still works.';

function failure(error: unknown): string {
	if (error instanceof ApiError) {
		if (error.kind === 'network') return 'Could not reach the server. Check your connection.';
		if (error.kind === 'unavailable') return UNAVAILABLE;
		return error.message;
	}
	return 'Something went wrong. Try again.';
}

export class AuthSession {
	user = $state.raw<SessionUser | null>(null);
	status = $state<AuthStatus>('checking');
	#api: AuthApi;

	constructor(authApi: AuthApi) {
		this.#api = authApi;
	}

	async refresh(): Promise<void> {
		try {
			this.user = await this.#api.session();
			this.status = 'ready';
		} catch (error) {
			this.user = null;
			this.status =
				error instanceof ApiError && error.kind === 'unauthorized'
					? 'ready'
					: 'unavailable';
		}
	}

	login(credentials: Credentials): Promise<AuthOutcome> {
		return this.#start(() => this.#api.login(credentials));
	}

	register(credentials: Credentials): Promise<AuthOutcome> {
		return this.#start(() => this.#api.register(credentials));
	}

	async logout(): Promise<AuthOutcome> {
		try {
			await this.#api.logout();
		} catch (error) {
			// An expired session is already logged out.
			if (!(error instanceof ApiError && error.kind === 'unauthorized'))
				return { ok: false, error: failure(error) };
		}
		this.user = null;
		return { ok: true };
	}

	async #start(request: () => Promise<SessionUser>): Promise<AuthOutcome> {
		try {
			this.user = await request();
			this.status = 'ready';
			return { ok: true };
		} catch (error) {
			return { ok: false, error: failure(error) };
		}
	}
}

/** The app's session, shared by the editor's toolbar and the login page. */
export const authSession = new AuthSession(api);
