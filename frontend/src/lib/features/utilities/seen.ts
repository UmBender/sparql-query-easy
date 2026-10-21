/**
 * "Shown once" flags in browser storage (guided tour, first-node hint). Storage
 * can be missing or blocked (private windows, previews); then the flag only
 * lasts for the page.
 */
const memory = new Set<string>();

export function seen(key: string): boolean {
	try {
		return memory.has(key) || window.localStorage.getItem(key) !== null;
	} catch {
		return memory.has(key);
	}
}

export function markSeen(key: string): void {
	memory.add(key);
	try {
		window.localStorage.setItem(key, 'true');
	} catch {
		// Blocked storage: the in-memory flag still applies until reload.
	}
}

/** Clears a flag, so the guided tour shows again (Start the tour on /help). */
export function forget(key: string): void {
	memory.delete(key);
	try {
		window.localStorage.removeItem(key);
	} catch {
		// Blocked storage: nothing was stored.
	}
}

export const TOUR_KEY = 'easyquery-tour-seen';
export const NODE_HINT_KEY = 'newNode';
