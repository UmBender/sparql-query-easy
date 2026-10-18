/**
 * The ported legacy unit suites (FE-042) keep their `node:assert/strict` calls
 * and expected values. Each call runs Node's strict assertion unchanged and
 * also registers a Vitest assertion (the config requires one per test).
 */
import nodeAssert from 'node:assert/strict';
import { expect, test as vitestTest, vi } from 'vitest';

const counted =
	<A extends unknown[]>(check: (...args: A) => void) =>
	(...args: A): void => {
		check(...args);
		expect(true).toBe(true);
	};

export default {
	equal: counted((actual: unknown, expected: unknown, message?: string) =>
		nodeAssert.equal(actual, expected, message)
	),
	notEqual: counted((actual: unknown, expected: unknown, message?: string) =>
		nodeAssert.notEqual(actual, expected, message)
	),
	deepEqual: counted((actual: unknown, expected: unknown, message?: string) =>
		nodeAssert.deepEqual(actual, expected, message)
	)
};

/**
 * `test` with the part of node:test's context the ported suites use:
 * `t.mock.timers.enable()` and `t.mock.timers.tick(ms)`, on Vitest fake timers.
 */
type OracleContext = {
	mock: { timers: { enable(options?: unknown): void; tick(ms: number): void } };
};

export function test(name: string, fn: (t: OracleContext) => unknown): void {
	vitestTest(name, async () => {
		const t: OracleContext = {
			mock: {
				timers: {
					enable: () => {
						vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
					},
					tick: (ms) => {
						vi.advanceTimersByTime(ms);
					}
				}
			}
		};
		try {
			await fn(t);
		} finally {
			vi.useRealTimers();
		}
	});
}
