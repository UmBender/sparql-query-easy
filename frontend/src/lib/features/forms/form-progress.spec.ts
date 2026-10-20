/** STUDY-010: saved questionnaire progress per user, questionnaire and version, and its removal. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearAllProgress, clearProgress, loadProgress, saveProgress } from './form-progress.js';

function memoryStorage(): Storage {
	const items = new Map<string, string>();
	return {
		get length() {
			return items.size;
		},
		clear: () => items.clear(),
		getItem: (key) => items.get(key) ?? null,
		key: (index) => [...items.keys()][index] ?? null,
		removeItem: (key) => void items.delete(key),
		setItem: (key, value) => void items.set(key, value)
	};
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('questionnaire progress in the browser', () => {
	it('keeps the answers and page per user, questionnaire and version', () => {
		vi.stubGlobal('localStorage', memoryStorage());
		saveProgress('ada', 'usability', 1, { answers: { easy_to_use: 4 }, page: 1 });
		expect(loadProgress('ada', 'usability', 1)).toEqual({
			answers: { easy_to_use: 4 },
			page: 1
		});
		expect(loadProgress('bob', 'usability', 1)).toBeNull();
		expect(loadProgress('ada', 'usability', 2)).toBeNull();
		clearProgress('ada', 'usability', 1);
		expect(loadProgress('ada', 'usability', 1)).toBeNull();
	});

	it('removes every questionnaire entry and nothing else when the user goes away', () => {
		const storage = memoryStorage();
		vi.stubGlobal('localStorage', storage);
		storage.setItem('easyquery-tour-seen', 'true');
		saveProgress('ada', 'profile', 1, { answers: {}, page: 0 });
		saveProgress('ada', 'usability', 1, { answers: {}, page: 1 });
		clearAllProgress();
		expect(storage.length).toBe(1);
		expect(storage.getItem('easyquery-tour-seen')).toBe('true');
	});

	it('ignores malformed entries and works without storage', () => {
		const storage = memoryStorage();
		vi.stubGlobal('localStorage', storage);
		storage.setItem('easyquery-form:ada:profile:v1', '{not json');
		expect(loadProgress('ada', 'profile', 1)).toBeNull();
		storage.setItem('easyquery-form:ada:profile:v1', '{"answers":{"a":"b"},"page":"x"}');
		expect(loadProgress('ada', 'profile', 1)).toEqual({ answers: { a: 'b' }, page: 0 });

		const refusing = memoryStorage();
		refusing.setItem = () => {
			throw new Error('QuotaExceededError');
		};
		vi.stubGlobal('localStorage', refusing);
		expect(() => saveProgress('ada', 'profile', 1, { answers: {}, page: 0 })).not.toThrow();
		vi.stubGlobal('localStorage', undefined);
		expect(loadProgress('ada', 'profile', 1)).toBeNull();
		expect(() => clearAllProgress()).not.toThrow();
		expect(() => clearProgress('ada', 'profile', 1)).not.toThrow();
	});
});
