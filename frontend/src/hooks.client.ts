import type { HandleClientError } from '@sveltejs/kit/hooks';
import { config } from 'zod';

// QUAL-022: the Content-Security-Policy forbids eval; without this Zod 4 probes it with `new Function`
// (a CSP violation) before falling back to the same checks without code generation.
config({ jitless: true });

/** Logs unexpected client errors with their stack before SvelteKit shows its error page. */
export const handleError: HandleClientError = ({ error }) => {
	console.error(error instanceof Error ? (error.stack ?? error.message) : error);
};
