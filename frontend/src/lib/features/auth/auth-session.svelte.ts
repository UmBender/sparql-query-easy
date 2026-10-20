/**
 * Who is logged in (AUTH-003). `refresh` asks `GET /api/auth/session`; login,
 * registration and logout update the user from the answers. The cookie is
 * HttpOnly, so this state is the page's only view of the session; nothing
 * is kept in browser storage. When the logged-in user goes away (logout, an
 * expired session, another user logging in) `onUserGone` runs, so the app can
 * drop cached server data of that user (AUTH-004) and the questionnaire
 * answers kept in the browser while they are filled in (STUDY-010).
 */
import { appQueryClient } from '#lib/api/queries.js';
import { clearAllProgress } from '#lib/features/forms/form-progress.js';
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
	#onUserGone: () => void;

	constructor(authApi: AuthApi, onUserGone: () => void = () => {}) {
		this.#api = authApi;
		this.#onUserGone = onUserGone;
	}

	#setUser(user: SessionUser | null) {
		const previous = this.user;
		this.user = user;
		if (previous && previous.username.toLowerCase() !== user?.username.toLowerCase())
			this.#onUserGone();
	}

	async refresh(): Promise<void> {
		try {
			this.#setUser(await this.#api.session());
			this.status = 'ready';
		} catch (error) {
			this.#setUser(null);
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
		this.#setUser(null);
		return { ok: true };
	}

	async #start(request: () => Promise<SessionUser>): Promise<AuthOutcome> {
		try {
			this.#setUser(await request());
			this.status = 'ready';
			return { ok: true };
		} catch (error) {
			return { ok: false, error: failure(error) };
		}
	}
}

/** The app's session, shared by the root layout's guard, the editor's toolbar and the login page. */
export const authSession = new AuthSession(api, () => {
	appQueryClient.clear();
	clearAllProgress();
});
