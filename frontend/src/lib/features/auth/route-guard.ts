/**
 * Which pages need a session and where an anonymous visitor goes instead
 * (AUTH-004). Paths are app paths (`url.pathname` with the base path removed).
 * The query editor, the login page and the styleguide stay public
 * (Authentication Contract); the study pages (STUDY-001) need a session and
 * the admin pages (AUTH-005) the admin role: a logged-in participant goes back
 * to the editor.
 */
import type { AuthStatus } from './auth-session.svelte.js';

export const PROTECTED_PREFIXES: readonly string[] = ['/study', '/admin'];
export const ADMIN_PREFIXES: readonly string[] = ['/admin'];

export type GuardDecision =
	{ kind: 'show' } | { kind: 'wait' } | { kind: 'redirect'; to: LoginPath | '/' };

function under(prefixes: readonly string[], pathname: string): boolean {
	return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isProtected(pathname: string): boolean {
	return under(PROTECTED_PREFIXES, pathname);
}

export function isAdminOnly(pathname: string): boolean {
	return under(ADMIN_PREFIXES, pathname);
}

export type LoginPath = `/login?${string}`;

/** The login page's address that brings the visitor back to `target` afterwards. */
export function loginPath(target: string): LoginPath {
	return `/login?${new URLSearchParams({ next: target })}`;
}

/**
 * Show a public page at once; keep a protected page hidden until the session
 * is known, then show it to a logged-in user or send everyone else to login.
 * An admin page is shown only to an admin.
 */
export function guardDecision(
	pathname: string,
	search: string,
	session: { status: AuthStatus; loggedIn: boolean; admin?: boolean }
): GuardDecision {
	if (!isProtected(pathname)) return { kind: 'show' };
	if (session.loggedIn && isAdminOnly(pathname) && !session.admin)
		return { kind: 'redirect', to: '/' };
	if (session.loggedIn) return { kind: 'show' };
	if (session.status === 'checking') return { kind: 'wait' };
	return { kind: 'redirect', to: loginPath(`${pathname}${search}`) };
}

const PROBE_ORIGIN = 'http://easyquery.invalid';

/**
 * Where to go after login: the `next` parameter when it is a path of this
 * app, otherwise the editor. Absolute, protocol-relative (`//host`) and
 * backslash addresses are ignored, so the parameter cannot send the user to
 * another site.
 */
export function safeNext(next: string | null): string {
	if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return '/';
	let url: URL;
	try {
		url = new URL(next, PROBE_ORIGIN);
	} catch {
		return '/';
	}
	if (url.origin !== PROBE_ORIGIN) return '/';
	if (url.pathname === '/login' || url.pathname.startsWith('/login/')) return '/';
	return `${url.pathname}${url.search}${url.hash}`;
}
