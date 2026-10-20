/**
 * A questionnaire's answers and page kept in this browser while it is filled
 * in (STUDY-010, DEC-015 Q4): nothing reaches the server before the final
 * submit. Keys name the user, the questionnaire and its version; the entry is
 * removed on submit, and every entry when the user goes away (logout, an
 * expired session, AUTH-004). Storage may be missing or refuse writes
 * (private windows, blocked site data); the form then simply starts empty.
 */
import type { Answers } from '#lib/domain/forms.js';

const PREFIX = 'easyquery-form:';

export type FormProgress = { answers: Answers; page: number };

const keyOf = (user: string, slug: string, version: number) =>
	`${PREFIX}${user}:${slug}:v${version}`;

function storage(): Storage | null {
	try {
		return globalThis.localStorage ?? null;
	} catch {
		return null;
	}
}

export function loadProgress(user: string, slug: string, version: number): FormProgress | null {
	try {
		const text = storage()?.getItem(keyOf(user, slug, version));
		if (!text) return null;
		const value = JSON.parse(text) as Partial<FormProgress>;
		if (!value || typeof value !== 'object' || typeof value.answers !== 'object') return null;
		return {
			answers: value.answers ?? {},
			page: Number.isInteger(value.page) ? value.page! : 0
		};
	} catch {
		return null;
	}
}

export function saveProgress(user: string, slug: string, version: number, progress: FormProgress) {
	try {
		storage()?.setItem(keyOf(user, slug, version), JSON.stringify(progress));
	} catch {
		// Not kept: the participant fills the page in again after a reload.
	}
}

export function clearProgress(user: string, slug: string, version: number) {
	try {
		storage()?.removeItem(keyOf(user, slug, version));
	} catch {
		// Nothing to remove.
	}
}

/** Removes every questionnaire's saved answers (the user went away). */
export function clearAllProgress() {
	try {
		const store = storage();
		if (!store) return;
		const keys = Array.from({ length: store.length }, (_, index) => store.key(index)).filter(
			(key): key is string => !!key?.startsWith(PREFIX)
		);
		for (const key of keys) store.removeItem(key);
	} catch {
		// Nothing to remove.
	}
}
