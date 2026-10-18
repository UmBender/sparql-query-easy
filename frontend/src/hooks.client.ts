import type { HandleClientError } from '@sveltejs/kit/hooks';

/** Logs unexpected client errors with their stack before SvelteKit shows its error page. */
export const handleError: HandleClientError = ({ error }) => {
	console.error(error instanceof Error ? (error.stack ?? error.message) : error);
};
