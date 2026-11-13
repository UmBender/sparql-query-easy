import { describe, expect, it } from 'vitest';
import demo from './fixtures/demo-study/brasileirao-2023.json' with { type: 'json' };
import research from './fixtures/demo-study/research-pokemon-gen1.json' with { type: 'json' };
import { loadQuery } from './saved-format.js';
import { answerQuery, answerVariables } from './study.js';

/**
 * STUDY-013: the Brasileirão 2023 practice tasks seeded by `scripts/seed-demo-study.mjs`.
 * Each stored request must be the one the editor derives from the drawn graph, so the
 * seeded reference cannot drift from what a participant can draw.
 */
describe('Brasileirão 2023 demo tasks (STUDY-013)', () => {
	it('lists the DOC-009 questions P1, P2, P4, P5, P6, P8, P9, P10 in order with valid keys', () => {
		expect(demo.tasks.map((task) => task.key.split('-')[1])).toEqual([
			'p1',
			'p2',
			'p4',
			'p5',
			'p6',
			'p8',
			'p9',
			'p10'
		]);
		for (const task of demo.tasks) {
			expect(task.key).toMatch(/^[a-z0-9][a-z0-9-]{0,63}$/);
			expect(task.endpoint).toBe('CampeonatoBrasileiro2023');
			expect(task.graph.endpoint).toEqual({
				kind: 'builtIn',
				id: 'CampeonatoBrasileiro2023'
			});
			expect(new Set(task.answers).size).toBe(task.answers.length);
		}
	});

	it.each(demo.tasks.map((task) => [task.key, task] as const))(
		'%s: the stored request is the one derived from its graph',
		(_key, task) => {
			const loaded = loadQuery(JSON.stringify(task.graph));
			if ('error' in loaded) throw new Error(JSON.stringify(loaded.error));
			expect(answerVariables(loaded.document.graph)).toContain(task.answerVariable);
			expect(answerQuery(loaded.document.graph, task.answerVariable, () => 1)).toEqual({
				query: task.query
			});
		}
	);
});

/**
 * STUDY-022: the five research tasks R1-R5 on PokemonGen1, in the order of the
 * questionnaire note (§3), seeded by `scripts/seed-demo-study.mjs --set=research`.
 */
describe('PokemonGen1 research tasks R1-R5 (STUDY-022)', () => {
	it('lists R1 to R5 in order on PokemonGen1 with the common instruction first', () => {
		expect(research.group).toBe('Pesquisa PokemonGen1');
		expect(research.tasks.map((task) => task.key.split('-')[0])).toEqual([
			'r1',
			'r2',
			'r3',
			'r4',
			'r5'
		]);
		expect(research.tasks.map((task) => task.answers.length)).toEqual([6, 6, 3, 3, 2]);
		for (const task of research.tasks) {
			expect(task.key).toMatch(/^[a-z0-9][a-z0-9-]{0,63}$/);
			expect(task.endpoint).toBe('PokemonGen1');
			expect(task.graph.endpoint).toEqual({ kind: 'builtIn', id: 'PokemonGen1' });
			expect(task.statement.startsWith('Use a ferramenta para encontrar a resposta')).toBe(true);
			expect(task.statement).not.toMatch(/variável (de resposta|que representa)/);
			expect(new Set(task.answers).size).toBe(task.answers.length);
		}
	});

	it.each(research.tasks.map((task) => [task.key, task] as const))(
		'%s: the stored request is the one derived from its graph',
		(_key, task) => {
			const loaded = loadQuery(JSON.stringify(task.graph));
			if ('error' in loaded) throw new Error(JSON.stringify(loaded.error));
			expect(answerVariables(loaded.document.graph)).toContain(task.answerVariable);
			expect(answerQuery(loaded.document.graph, task.answerVariable, () => 1)).toEqual({
				query: task.query
			});
		}
	);
});
