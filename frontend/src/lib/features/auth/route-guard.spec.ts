/** AUTH-004: the protected-page decision and the post-login target. */
import { describe, expect, it } from 'vitest';
import { guardDecision, isProtected, loginPath, safeNext } from './route-guard.js';

const anonymous = { status: 'ready', loggedIn: false } as const;
const checking = { status: 'checking', loggedIn: false } as const;
const loggedIn = { status: 'ready', loggedIn: true } as const;

describe('isProtected', () => {
	it('protects the study and admin pages and nothing else', () => {
		expect(isProtected('/study')).toBe(true);
		expect(isProtected('/admin')).toBe(true);
		expect(isProtected('/admin/tasks')).toBe(true);
		expect(isProtected('/administrator')).toBe(false);
		expect(isProtected('/study/3')).toBe(true);
		expect(isProtected('/studying')).toBe(false);
		expect(isProtected('/')).toBe(false);
		expect(isProtected('/login')).toBe(false);
		expect(isProtected('/styleguide')).toBe(false);
	});
});

describe('guardDecision', () => {
	it('shows public pages whatever the session', () => {
		for (const session of [
			anonymous,
			checking,
			loggedIn,
			{ status: 'unavailable', loggedIn: false } as const
		])
			for (const path of ['/', '/login', '/styleguide'])
				expect(guardDecision(path, '', session)).toEqual({ kind: 'show' });
	});

	it('waits on a protected page until the session is known', () => {
		expect(guardDecision('/study', '', checking)).toEqual({ kind: 'wait' });
	});

	it('shows a protected page to a logged-in user', () => {
		expect(guardDecision('/study', '', loggedIn)).toEqual({ kind: 'show' });
	});

	it('shows an admin page only to an admin and sends a participant to the editor', () => {
		expect(guardDecision('/admin/tasks', '', { ...loggedIn, admin: true })).toEqual({
			kind: 'show'
		});
		expect(guardDecision('/admin', '', loggedIn)).toEqual({ kind: 'redirect', to: '/' });
		expect(guardDecision('/study', '', { ...loggedIn, admin: true })).toEqual({ kind: 'show' });
		expect(guardDecision('/admin', '', anonymous)).toEqual({
			kind: 'redirect',
			to: loginPath('/admin')
		});
		expect(guardDecision('/admin', '', checking)).toEqual({ kind: 'wait' });
	});

	it('sends an anonymous visitor to login with the page to come back to', () => {
		expect(guardDecision('/study/2', '?tab=a', anonymous)).toEqual({
			kind: 'redirect',
			to: '/login?next=%2Fstudy%2F2%3Ftab%3Da'
		});
		expect(guardDecision('/study', '', { status: 'unavailable', loggedIn: false })).toEqual({
			kind: 'redirect',
			to: loginPath('/study')
		});
	});
});

describe('safeNext', () => {
	it('keeps a path of this app', () => {
		expect(safeNext('/study')).toBe('/study');
		expect(safeNext('/study/2?tab=a#top')).toBe('/study/2?tab=a#top');
	});

	it('falls back to the editor for anything else', () => {
		for (const next of [
			null,
			'',
			'study',
			'https://evil.example/',
			'//evil.example/study',
			'/\\evil.example',
			'\\\\evil.example',
			'javascript:alert(1)',
			'/login',
			'/login?next=/study'
		])
			expect(safeNext(next), String(next)).toBe('/');
	});
});
