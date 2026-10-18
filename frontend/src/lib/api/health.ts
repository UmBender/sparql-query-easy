/** The approved `/health` body (DEC-009). */
export type Health = { status: string };

export type HealthResult = { ok: true; health: Health } | { ok: false; error: string };

/** Reads `/health` through the same origin; never throws. */
export async function fetchHealth(fetcher: typeof fetch = fetch): Promise<HealthResult> {
	try {
		const response = await fetcher('/health');
		if (!response.ok) return { ok: false, error: `HTTP ${response.status}` };
		const body: unknown = await response.json();
		if (!isHealth(body)) return { ok: false, error: 'Unexpected /health body' };
		return { ok: true, health: body };
	} catch (error) {
		return { ok: false, error: error instanceof Error ? error.message : String(error) };
	}
}

function isHealth(body: unknown): body is Health {
	return (
		typeof body === 'object' &&
		body !== null &&
		typeof (body as Record<string, unknown>).status === 'string'
	);
}
