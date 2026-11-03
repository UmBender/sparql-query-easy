/** STUDY-017: the admin review shows the save, its check and the reference of its revision. */
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import fireSpeed from '#lib/domain/fixtures/fire-speed-at-least-90.query.json?raw';
import type { AdminSubmission } from '#lib/api/client.js';
import SubmissionReview from './submission-review.svelte';

const PK = 'http://easyquery.example.org/pokemon#';
const graph = JSON.parse(fireSpeed);
const query = {
	where: [
		{
			subject: '?pokemon',
			predicate: `<${PK}hasType>`,
			object: `<${PK}FireType>`,
			filterType: null
		}
	],
	variableFilters: []
};

function submission(overrides: Partial<AdminSubmission> = {}): AdminSubmission {
	return {
		summary: {
			id: 7,
			participant: 'P002',
			username: 'Ada',
			taskKey: 'fire-fast',
			taskTitle: 'Fast Fire Pokémon',
			taskRevision: 1,
			savedAt: '2026-11-02T12:00:00Z',
			timeSpentMs: 42_000,
			saves: 3,
			finished: true,
			autoCheck: 'match'
		},
		graph,
		query,
		check: {
			kind: 'variables',
			hint: 'match',
			summary: '?pokemon matches the expected values.',
			missing: null,
			extra: null,
			variables: [
				{
					variable: '?pokemon',
					sparql: 'SELECT DISTINCT ?pokemon WHERE { ... }',
					match: true,
					diagnostic: null,
					values: [{ type: 'iri', value: `${PK}Charizard` }],
					truncated: false,
					matched: 1,
					missing: 0,
					extra: 0,
					expectedCount: 1
				}
			],
			unchecked: []
		},
		reference: {
			revision: 1,
			title: 'Fast Fire Pokémon',
			statement: 'Find the Fire-type Pokémon with speed of at least 90.',
			endpoint: 'PokemonGen1',
			referenceGraph: graph,
			referenceQuery: { variableName: '?pokemon', ...query },
			referenceSparql: 'SELECT ?pokemon WHERE { reference }',
			expected: [{ type: 'iri', value: `${PK}Charizard` }],
			comparison: 'set',
			maxResults: 1000,
			savedAt: '2026-11-01T12:00:00Z'
		},
		...overrides
	};
}

describe('SubmissionReview', () => {
	it('shows the save beside the reference of its revision', async () => {
		const screen = await render(SubmissionReview, { submission: submission() });
		await expect.element(screen.getByRole('heading', { level: 1 })).toHaveTextContent('P002');
		await expect.element(screen.getByTestId('review-account')).toHaveTextContent('Ada');
		await expect.element(screen.getByTestId('review-hint')).toHaveTextContent('Match');
		await expect
			.element(screen.getByTestId('reference-statement'))
			.toHaveTextContent('Find the Fire-type Pokémon with speed of at least 90.');
		await expect.element(screen.getByText('SELECT ?pokemon WHERE { reference }')).toBeVisible();
		await expect
			.element(screen.getByText('SELECT DISTINCT ?pokemon WHERE { ... }'))
			.toBeVisible();
		await expect
			.element(screen.getByRole('img', { name: 'Saved answer diagram (read-only)' }))
			.toBeInTheDocument();
		await expect
			.element(screen.getByRole('img', { name: 'Reference diagram (read-only)' }))
			.toBeInTheDocument();
		await expect.element(screen.getByTestId('variable-check')).toHaveTextContent('?pokemon');
	});

	it('says when the reference of the revision was not kept, and shows a structural check', async () => {
		const screen = await render(SubmissionReview, {
			submission: submission({
				reference: null,
				check: {
					kind: 'structural',
					hint: 'no_match',
					summary: 'Structural: 2 reference triples missing; 1 extra.',
					missing: 2,
					extra: 1,
					variables: [],
					unchecked: []
				}
			})
		});
		await expect
			.element(screen.getByTestId('reference-missing'))
			.toHaveTextContent('The reference for revision 1 was not kept');
		await expect.element(screen.getByTestId('check-summary')).toHaveTextContent('Structural');
		await expect.element(screen.getByText(/Missing\s+2, extra 1/)).toBeVisible();
	});

	it('lists the diagram as text with numbered nodes and its relations', async () => {
		const screen = await render(SubmissionReview, { submission: submission() });
		await screen.getByText('Saved answer diagram as text').click();
		const nodes = screen.getByTestId('diagram-nodes').first();
		await expect.element(nodes).toBeVisible();
		await expect
			.element(screen.getByTestId('diagram-relations').first())
			.toHaveTextContent('—');
	});
});
