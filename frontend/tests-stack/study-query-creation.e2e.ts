/**
 * STUDY-012: two feature-rich proposed queries built through the real UI on
 * PokemonGen1, from the admin drawing the reference to the participant's
 * wrong and right answers, then a check of what PostgreSQL stored.
 *
 * Q1 (set): Water-type Pokémon that evolve by level-up at a level in 25..35,
 * whose pre-evolution has speed ≥ 60 and whose category contains "fish"
 * → Tentacruel, Seaking. Q2 (multiset): the Fire-type Pokémon with the
 * highest HP, linked to Rock by any relation → Arcanine, Moltres.
 *
 * Writes test-results/study-query-creation/report.md (also attached to the
 * Playwright report) with the SPARQL, each attempt and the stored rows.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { EditorPage } from '../tests/support/pages/editor-page';
import { TaskPage } from '../tests/support/pages/task-page';
import { guardOffline, joinStudy, loginAs } from './support.js';

const PK = 'http://easyquery.example.org/pokemon#';
const iri = (name: string) => `<${PK}${name}>`;
const REPORT_DIR = new URL('../test-results/study-query-creation/', import.meta.url);

/** Builds a query on the canvas the way a user does: search, explore, convert, filter. */
class Drawing {
	readonly editor: EditorPage;
	constructor(readonly page: Page) {
		this.editor = new EditorPage(page);
	}

	get menu() {
		return this.page.locator('#node-action-menu');
	}

	nodes() {
		return this.page.evaluate(() =>
			(
				window as never as {
					__easyquery: {
						store: {
							graph: { elements: { id: string; kind: string; label?: string }[] };
						};
					};
				}
			).__easyquery.store.graph.elements
				.filter((element) => element.kind !== 'relation')
				.map(({ id, kind, label }) => ({ id, kind, label }))
		);
	}

	edges() {
		return this.page.evaluate(() =>
			(
				window as never as {
					__easyquery: {
						store: {
							graph: {
								elements: {
									id: string;
									kind: string;
									source: string;
									target: string;
									predicate: string;
								}[];
							};
						};
					};
				}
			).__easyquery.store.graph.elements
				.filter((element) => element.kind === 'relation')
				.map(({ id, source, target, predicate }) => ({ id, source, target, predicate }))
		);
	}

	async nodeIds() {
		return (await this.nodes()).map((node) => node.id);
	}

	/** Adds a search result; Auto Layout gives it its own place (BUG-009). */
	async search(text: string, option: RegExp) {
		const before = await this.nodeIds();
		await this.page.getByRole('combobox', { name: 'Search nodes' }).fill(text);
		await this.page.getByRole('option', { name: option }).first().click();
		await expect.poll(async () => (await this.nodeIds()).length).toBe(before.length + 1);
	}

	/**
	 * A canvas point (in canvas pixels) at least `margin` away from every node and relation and not under a
	 * menu, panel or badge drawn over the canvas.
	 */
	freePoint(margin: number) {
		return this.page.evaluate((margin) => {
			const { cy } = (
				window as never as { __easyquery: { view: { cy: import('cytoscape').Core } } }
			).__easyquery.view;
			const frame = cy.container()!.getBoundingClientRect();
			const boxes = cy.elements().map((element) => element.renderedBoundingBox());
			const bare = (x: number, y: number) =>
				boxes.every(
					(box) =>
						x < box.x1 - margin ||
						x > box.x2 + margin ||
						y < box.y1 - margin ||
						y > box.y2 + margin
				) &&
				!document
					.elementFromPoint(frame.x + x, frame.y + y)
					?.closest('aside, [role="dialog"], [role="region"], button, .filter-badge');
			for (let y = margin + 8; y < frame.height - margin; y += 16)
				for (let x = margin + 8; x < frame.width - margin; x += 16)
					if (bare(x, y)) return { x, y };
			throw new Error(`No free canvas point ${margin}px away from the graph`);
		}, margin);
	}

	/** Closes any action list with a click on empty canvas. */
	async clickBackground() {
		await this.editor.canvas.click({ position: await this.freePoint(4) });
		await expect(this.menu).toBeHidden();
		await expect(this.page.locator('#edge-action-menu')).toBeHidden();
	}

	/** Drags a node by hand to empty canvas (nodes from Add value filter start next to their variable). */
	async placeAside(id: string) {
		const to = await this.freePoint(70);
		const from = await this.editor.nodeCanvasPosition(id);
		await this.editor.dragNode(id, { x: to.x - from.x, y: to.y - from.y });
	}

	async openNodeMenu(id: string) {
		await this.clickBackground();
		await this.editor.clickNode(id);
		await expect(this.menu).toHaveAttribute('data-node-id', id);
	}

	/** Explore relationships on `from` and add the `predicate` row; returns the new node id. */
	async explore(from: string, predicate: string) {
		const before = await this.nodeIds();
		await this.openNodeMenu(from);
		await this.menu.getByRole('button', { name: 'Explore relationships' }).click();
		await this.page
			.locator('#table-results-body tr')
			.filter({ has: this.page.getByRole('cell', { name: predicate, exact: true }) })
			.click();
		await expect.poll(async () => (await this.nodeIds()).length).toBe(before.length + 1);
		return (await this.nodeIds()).find((id) => !before.includes(id))!;
	}

	/** Convert to variable; returns the variable's id. */
	async convert(id: string) {
		const before = await this.nodeIds();
		await this.openNodeMenu(id);
		await this.menu.getByRole('button', { name: 'Convert to variable' }).click();
		await expect.poll(async () => (await this.nodeIds()).includes(id)).toBe(false);
		return (await this.nodeIds()).find((other) => !before.includes(other))!;
	}

	get filterEditor() {
		return this.page.locator('#filter-editor');
	}

	async applyFilter(type: string, value: string) {
		// The editor seeds its value from the data profile once it loads, which resets the choice: retry.
		const choice = this.filterEditor.getByLabel(type, { exact: true });
		await expect(async () => {
			await choice.check({ timeout: 1000 });
			await expect(choice).toBeChecked({ timeout: 500 });
		}).toPass();
		// MAX and MIN keep the seeded value, as a user leaves it.
		if (value) await this.page.locator('#filter-value').fill(value);
		await this.page.locator('#apply-filter-btn').click();
		await expect(this.filterEditor).toBeHidden();
	}

	/** Add value filter on a variable: a value variable on `relation` with the filter; returns its id. */
	async addValueFilter(variable: string, relation: string, type: string, value: string) {
		const before = await this.nodeIds();
		await this.openNodeMenu(variable);
		await this.menu.getByRole('button', { name: 'Add value filter' }).click();
		await this.menu.getByRole('button', { name: relation, exact: true }).click();
		await expect(this.filterEditor).toBeVisible();
		await this.applyFilter(type, value);
		const added = (await this.nodeIds()).find((id) => !before.includes(id))!;
		await this.placeAside(added);
		return added;
	}

	/** Edit value on a literal node (numeric mode offers MAX and MIN); returns its new id. */
	async editValue(id: string, type: string, value: string) {
		await this.openNodeMenu(id);
		await this.menu.getByRole('button', { name: 'Edit value', exact: true }).click();
		await expect(this.filterEditor).toBeVisible();
		const before = await this.nodeIds();
		await this.applyFilter(type, value);
		const ids = await this.nodeIds();
		return ids.find((other) => !before.includes(other)) ?? id;
	}

	async removeEdge(id: string) {
		await this.clickBackground();
		await this.editor.clickEdge(id);
		await this.page
			.locator('#edge-action-menu')
			.getByRole('button', { name: 'Remove relation' })
			.click();
		await expect
			.poll(async () => (await this.edges()).some((edge) => edge.id === id))
			.toBe(false);
	}

	/** Connect with defined predicate from `source` to `target` through `relation`. */
	async connect(source: string, relation: string, target: string) {
		const before = (await this.edges()).length;
		await this.openNodeMenu(source);
		await this.menu.getByRole('button', { name: 'Connect with defined predicate' }).click();
		await this.menu.getByRole('button', { name: relation, exact: true }).click();
		await this.editor.clickNode(target);
		await expect.poll(async () => (await this.edges()).length).toBe(before + 1);
	}

	async edgeBetween(source: string, target: string) {
		return (await this.edges()).find(
			(edge) => edge.source === source && edge.target === target
		)!;
	}

	/** The edge menu's Convert relation to variable (FE-003). */
	async convertEdge(id: string) {
		await this.clickBackground();
		await this.editor.clickEdge(id);
		await this.page
			.locator('#edge-action-menu')
			.getByRole('button', { name: 'Convert relation to variable' })
			.click();
		await expect
			.poll(async () => (await this.edges()).find((edge) => edge.id === id)?.predicate ?? '')
			.not.toMatch(/^</);
	}

	async sparql() {
		await this.page.getByRole('button', { name: 'View SPARQL' }).click();
		const content = this.page.locator('#sparql-content');
		await expect(content).toContainText('SELECT');
		const text = (await content.textContent())!;
		await this.page.keyboard.press('Escape');
		await expect(content).toBeHidden();
		return text;
	}
}

type Q1 = { pokemon: string; pre: string; level: string; speed: string; category?: string };

/**
 * Q1 from Tentacruel: Water and Level up by search, evolves from and rdf:type by Explore relationships,
 * both Pokémon converted to variables, then value filters. `fish` false leaves out the category filter.
 */
async function drawQ1(draw: Drawing, fish = true): Promise<Q1> {
	const tentacruel = iri('Tentacruel');
	await draw.search('Tentacruel', /^Tentacruel /);
	await draw.search('Water', /^Water </);
	await draw.search('Level', /^Level up /);
	expect((await draw.edges()).map((edge) => edge.predicate).sort()).toEqual([
		iri('evolutionTrigger'),
		iri('hasType')
	]);
	await draw.explore(tentacruel, iri('evolvesFrom'));
	await draw.explore(tentacruel, '<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>');
	const pokemon = await draw.convert(tentacruel);
	const pre = await draw.convert(iri('Tentacool'));
	const level = await draw.addValueFilter(
		pokemon,
		'evolution level',
		'Between (min..max, e.g. 40..80)',
		'25..35'
	);
	const speed = await draw.addValueFilter(pre, 'Speed', 'At least (≥)', '60');
	const result: Q1 = { pokemon, pre, level, speed };
	if (fish) result.category = await addFish(draw, pokemon);
	return result;
}

const addFish = (draw: Drawing, pokemon: string) =>
	draw.addValueFilter(pokemon, 'category', 'Contains', 'fish');

type Q2 = { pokemon: string; hp: string; relation: string };

/**
 * Q2 from Arcanine: Fire and Rock by search (the type-chart edges search adds between them are removed and
 * the primary-type edge is redrawn as has type), HP by Explore relationships, Arcanine converted to a
 * variable, the HP value edited to `hp` (MAX or MIN) and the weak-to edge converted to a predicate variable.
 */
async function drawQ2(draw: Drawing, hp: 'MAX' | 'MIN'): Promise<Q2> {
	const arcanine = iri('Arcanine');
	const fire = iri('FireType');
	const rock = iri('RockType');
	await draw.search('Arcanine', /^Arcanine /);
	await draw.search('Fire', /^Fire </);
	await draw.search('Rock', /^Rock </);
	for (const edge of await draw.edges())
		if (edge.source !== arcanine || edge.target === fire) await draw.removeEdge(edge.id);
	await draw.connect(arcanine, 'has type', fire);
	const value = await draw.explore(arcanine, iri('hp'));
	// Edit value (with MAX and MIN) is offered once the value hangs off a variable.
	const pokemon = await draw.convert(arcanine);
	const hpNode = await draw.editValue(value, hp, '');
	const weak = await draw.edgeBetween(pokemon, rock);
	expect(weak.predicate).toBe(iri('weakTo'));
	await draw.convertEdge(weak.id);
	const relation = (await draw.edgeBetween(pokemon, rock)).predicate;
	return { pokemon, hp: hpNode, relation };
}

/** Runs one SQL query in the stack's PostgreSQL container (Testcontainers, found by its published port). */
function sql<T>(query: string): T {
	const url = readFileSync(new URL('../../build/stack-postgres.ready', import.meta.url), 'utf8');
	const port = /:(\d+)\//.exec(url)![1];
	const container = execFileSync('docker', ['ps', '-q', '--filter', `publish=${port}`], {
		encoding: 'utf8'
	}).trim();
	expect(container, `PostgreSQL container on port ${port}`).not.toBe('');
	const out = execFileSync(
		'docker',
		['exec', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-At', '-c', query],
		{ encoding: 'utf8' }
	);
	return JSON.parse(out.trim() || 'null') as T;
}

type StoredTask = {
	task_key: string;
	comparison: string;
	revision: number;
	reference_graph: { formatVersion: number; nodes: unknown[]; edges: unknown[] };
	reference_request: { variableName: string; where: unknown[]; variableFilters?: unknown[] };
	reference_sparql: string;
	expected_result: { type: string; value: string }[];
};
type StoredSubmission = {
	id: number;
	task_key: string;
	task_revision: number;
	answer_variable: string;
	sparql: string;
	result_summary: { values?: { type: string; value: string }[]; [key: string]: unknown };
	correct: boolean;
	feedback: string;
	invalid: boolean;
	time_spent_ms: number;
	graph: unknown;
	request: unknown;
};

const storedTask = (key: string) =>
	sql<StoredTask>(
		`select row_to_json(t) from (select task_key, comparison, revision, reference_graph, reference_request,
		 reference_sparql, expected_result from study_task where task_key = '${key}') t`
	);

const storedSubmissions = (user: string) =>
	sql<StoredSubmission[]>(
		`select coalesce(json_agg(row_to_json(s) order by s.id), '[]') from (select s.id, t.task_key, s.task_revision,
		 s.answer_variable, s.sparql, s.result_summary, s.correct, s.feedback, s.invalid, s.time_spent_ms, s.graph,
		 s.request from study_submission s join study_task t on t.id = s.task_id join app_user u on u.id = s.user_id
		 where u.username = '${user}') s`
	);

const storedOpens = (user: string) =>
	sql<{ task_key: string }[]>(
		`select coalesce(json_agg(row_to_json(o)), '[]') from (select t.task_key from study_task_open o
		 join study_task t on t.id = o.task_id join app_user u on u.id = o.user_id where u.username = '${user}') o`
	);

const pokemon = (...names: string[]) =>
	names.map((name) => ({ type: 'iri', value: `${PK}${name}` }));

/** Fills the admin task form and saves it; returns the preview line. */
async function saveTask(
	page: Page,
	task: { key: string; title: string; statement: string },
	answer: string,
	comparison: 'set' | 'multiset',
	expected: string[]
) {
	await page.getByLabel('Key').fill(task.key);
	await page.getByLabel('Title').fill(task.title);
	await page.getByLabel('Statement').fill(task.statement);
	await page.locator(`input[name="task-answer"][value="${answer}"]`).check();
	await page.locator(`input[name="task-comparison"][value="${comparison}"]`).check();
	await expect(page.locator('[data-sonner-toast]')).toHaveCount(0, { timeout: 15_000 });
	await page.getByRole('button', { name: 'Preview expected result' }).click();
	const preview = page.getByRole('region', { name: 'Expected result' });
	await expect(preview.getByRole('listitem')).toHaveCount(expected.length);
	for (const name of expected) await expect(preview).toContainText(name);
	const line = (await page.getByTestId('preview-count').textContent())!.trim();
	await page.getByRole('button', { name: 'Save task' }).click();
	await expect(page).toHaveURL(new RegExp(`/admin/tasks/${task.key}$`));
	await expect(page.getByTestId('task-revision')).toHaveText('Revision 1 · active');
	return line;
}

type Attempt = { label: string; feedback: string };

/** Submits the drawn answer on a task page and returns the feedback line. */
async function submit(taskPage: TaskPage, answer: string, expected: RegExp) {
	await taskPage.page.locator(`input[name="answer-variable"][value="${answer}"]`).check();
	await taskPage.submit();
	await expect(taskPage.feedback).toHaveText(expected);
	return (await taskPage.feedback.textContent())!.trim();
}

const short = (terms: { value: string }[]) =>
	terms.map((term) => term.value.replace(PK, 'pk:')).join(', ');

const fence = (text: string, lang = '') => `\n\`\`\`${lang}\n${text.trim()}\n\`\`\`\n`;

test.use({ viewport: { width: 1600, height: 1000 } });

test('two proposed queries drawn in the UI are stored, checked and reported', async ({
	page,
	browser,
	baseURL
}, testInfo) => {
	test.setTimeout(300_000);
	const stamp = Date.now();
	const tasks = {
		q1: {
			key: `water-fish-${stamp}`,
			title: 'Fast-growing Water fish',
			statement:
				'Find the Water-type Pokémon that evolve by level-up at a level between 25 and 35, whose pre-evolution has speed of at least 60, and whose category contains "fish".'
		},
		q2: {
			key: `fire-hp-rock-${stamp}`,
			title: 'Toughest Fire Pokémon and how Rock hits them',
			statement:
				'Among the Fire-type Pokémon with the highest HP, list each one once per relation that links it to the Rock type.'
		}
	};
	const participant = `creator-${stamp}`;

	// The participant exists, consented and answered the profile before the admin assigns them.
	const solver = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
	await loginAs(solver.request, participant);
	await joinStudy(solver.request);

	const unexpected = guardOffline(page, baseURL!);
	await loginAs(page.request, 'stack-admin');
	const draw = new Drawing(page);
	const editor = draw.editor;

	// Admin, Q1: draw, explore, check the funnel, export and reload, save.
	await page.goto('/admin/tasks/new');
	await editor.ready();
	const q1 = await drawQ1(draw);
	const q1Sparql = await draw.sparql();
	for (const part of [
		`>= 25 && ?${q1.level.slice(1)} <= 35`,
		`?${q1.speed.slice(1)} >= 60`,
		`CONTAINS(STR(?${q1.category!.slice(1)}), "fish")`,
		`${q1.pokemon} <${PK}evolvesFrom> ${q1.pre}`
	])
		expect(q1Sparql).toContain(part);
	await expect(editor.orderChips).toHaveText([
		'Pokémon',
		'Evolves from',
		'Evolution level',
		'Speed',
		'Category'
	]);

	await editor.runQuery();
	await expect(editor.stageHeading).toHaveText('Step 1 of 5: Pokémon');
	await expect(editor.candidates).toHaveText(['Seaking IRI', 'Tentacruel IRI']);
	await editor.candidates.filter({ hasText: 'Tentacruel' }).hover();
	await expect(page.locator('#stage-preview-list')).toContainText('Tentacool');
	const before = await editor.graph();
	await editor.assumeButtons.nth(1).click();
	await expect.poll(async () => (await editor.graph()).nodes.join()).toContain('Tentacruel');
	await page.getByRole('button', { name: 'Undo' }).click();
	await expect.poll(() => editor.graph()).toEqual(before);
	await page.getByRole('button', { name: 'Redo' }).click();
	await expect.poll(async () => (await editor.graph()).nodes.join()).toContain('Tentacruel');
	await page.getByRole('button', { name: 'Undo' }).click();
	await expect.poll(() => editor.graph()).toEqual(before);

	await page.getByRole('button', { name: 'Filter funnel' }).click();
	const funnelResult = page.locator('#filter-funnel-result');
	await expect(funnelResult).toHaveText('Result: 2 Pokémon of 52.');
	const funnelSteps = await page.locator('#filter-funnel-steps > li').allInnerTexts();
	const fish = page
		.locator('#filter-funnel-steps .funnel-toggle', { hasText: 'category contains fish' })
		.locator('input');
	await fish.uncheck();
	await expect(funnelResult).toHaveText(
		'Result: 4 Pokémon of 52. Preview without 1 filter; Run Query still applies every filter.'
	);
	await fish.check();
	await expect(funnelResult).toHaveText('Result: 2 Pokémon of 52.');
	await page.getByRole('button', { name: 'Close filter funnel' }).click();

	const downloading = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Export Query' }).click();
	const exported = readFileSync(await (await downloading).path(), 'utf8');
	expect(JSON.parse(exported).formatVersion).toBe(1);
	await page.getByRole('button', { name: 'New Query' }).click();
	await expect(editor.nodeCount).toHaveText('Nodes: 0');
	await editor.uploadQuery('q1.query.json', JSON.parse(exported));
	await expect.poll(() => editor.graph()).toEqual(before);

	const q1Preview = await saveTask(page, tasks.q1, q1.pokemon, 'set', ['Tentacruel', 'Seaking']);

	// Admin, Q2.
	await page.goto('/admin/tasks/new');
	await editor.ready();
	const q2 = await drawQ2(draw, 'MAX');
	expect(await draw.sparql()).toContain(`${q2.pokemon} ${q2.relation} <${PK}RockType>`);
	const q2Preview = await saveTask(page, tasks.q2, q2.pokemon, 'multiset', [
		'Arcanine',
		'Moltres'
	]);

	// Admin: a group with both tasks and the participant, through the groups page.
	await page.goto('/admin/groups');
	const group = `Query creation ${stamp}`;
	await page.getByLabel('New group name').fill(group);
	await page.getByRole('button', { name: 'Create group' }).click();
	await page.getByRole('link', { name: `Open ${group}` }).click();
	for (const task of [tasks.q1, tasks.q2]) {
		await page.getByRole('button', { name: `Add task ${task.key}` }).click();
		await expect(page.getByTestId('group-tasks')).toContainText(task.title);
	}
	await page.getByRole('button', { name: `Add participant ${participant}` }).click();
	await expect(page.getByTestId('group-members')).toContainText(participant);
	expect(unexpected, 'Unexpected external browser requests (admin)').toEqual([]);

	// Participant: a wrong then a right answer for each task.
	const solverPage = await solver.newPage();
	const solverUnexpected = guardOffline(solverPage, baseURL!);
	const taskPage = new TaskPage(solverPage);
	const solve = new Drawing(solverPage);
	const attempts: Attempt[] = [];
	const record = (label: string, feedback: string) => attempts.push({ label, feedback });

	await taskPage.open(tasks.q1.key);
	await expect(taskPage.statement).toHaveText(tasks.q1.statement);
	const p1 = await drawQ1(solve, false);
	record(
		'Q1 without the "fish" filter',
		await submit(taskPage, p1.pokemon, /^Incorrect: 2 of 2 expected results; 2 extra\.$/)
	);
	await addFish(solve, p1.pokemon);
	record(
		'Q1 complete',
		await submit(taskPage, p1.pokemon, /^Correct: all 2 expected results\.$/)
	);
	await expect(taskPage.attempts).toHaveCount(2);

	await taskPage.open(tasks.q2.key);
	const p2 = await drawQ2(solve, 'MIN');
	record(
		'Q2 with MIN instead of MAX',
		await submit(taskPage, p2.pokemon, /^Incorrect: 0 of 2 expected results; 1 extra\.$/)
	);
	await solve.editValue(p2.hp, 'MAX', '');
	record(
		'Q2 complete',
		await submit(taskPage, p2.pokemon, /^Correct: all 2 expected results\.$/)
	);
	expect(solverUnexpected, 'Unexpected external browser requests (participant)').toEqual([]);

	// What PostgreSQL stored.
	const stored1 = storedTask(tasks.q1.key);
	const stored2 = storedTask(tasks.q2.key);
	expect(stored1.comparison).toBe('set');
	expect(stored2.comparison).toBe('multiset');
	expect(stored1.expected_result).toEqual(
		expect.arrayContaining(pokemon('Tentacruel', 'Seaking'))
	);
	expect(stored1.expected_result).toHaveLength(2);
	// SELECT DISTINCT keeps one row per Pokémon: Moltres is not repeated for its second Rock relation.
	expect(stored2.expected_result).toEqual(expect.arrayContaining(pokemon('Arcanine', 'Moltres')));
	expect(stored2.expected_result).toHaveLength(2);
	expect(stored1.reference_graph.formatVersion).toBe(1);
	expect(stored1.reference_graph.nodes).toHaveLength(8);
	expect(stored1.reference_graph.edges).toHaveLength(7);
	expect(stored1.reference_request.variableName).toBe(q1.pokemon);
	expect(stored1.reference_request.variableFilters).toHaveLength(3);
	expect(stored1.reference_sparql).toContain('CONTAINS');
	expect(stored2.reference_sparql).toContain(q2.relation);

	const opens = storedOpens(participant).map((open) => open.task_key);
	expect(opens.sort()).toEqual([tasks.q1.key, tasks.q2.key].sort());

	const submissions = storedSubmissions(participant);
	expect(
		submissions.map(({ task_key, correct, invalid, task_revision, answer_variable }) => ({
			task_key,
			correct,
			invalid,
			task_revision,
			answer_variable
		}))
	).toEqual([
		{
			task_key: tasks.q1.key,
			correct: false,
			invalid: false,
			task_revision: 1,
			answer_variable: p1.pokemon
		},
		{
			task_key: tasks.q1.key,
			correct: true,
			invalid: false,
			task_revision: 1,
			answer_variable: p1.pokemon
		},
		{
			task_key: tasks.q2.key,
			correct: false,
			invalid: false,
			task_revision: 1,
			answer_variable: p2.pokemon
		},
		{
			task_key: tasks.q2.key,
			correct: true,
			invalid: false,
			task_revision: 1,
			answer_variable: p2.pokemon
		}
	]);
	submissions.forEach((submission, index) => {
		expect(submission.feedback).toBe(attempts[index].feedback);
		expect(submission.time_spent_ms).toBeGreaterThan(0);
		expect(submission.sparql).toContain('SELECT');
	});

	// The report for the human check.
	const report = [
		`# STUDY-012 query creation report`,
		'',
		`Run ${new Date(stamp).toISOString()} on the real stack (PokemonGen1, Testcontainers PostgreSQL).`,
		`Participant \`${participant}\`; tasks \`${tasks.q1.key}\` and \`${tasks.q2.key}\`.`,
		'',
		...[
			[tasks.q1, stored1, q1Preview],
			[tasks.q2, stored2, q2Preview]
		].flatMap(([task, stored, preview]) => {
			const t = task as typeof tasks.q1;
			const st = stored as StoredTask;
			return [
				`## ${t.title} (\`${st.comparison}\`)`,
				'',
				t.statement,
				'',
				`Admin preview: ${preview}. Stored expected result: ${short(st.expected_result)}.`,
				'',
				'Stored `reference_sparql` (answer variable projected):',
				fence(st.reference_sparql, 'sparql'),
				'Stored `reference_request`:',
				fence(JSON.stringify(st.reference_request, null, 2), 'json'),
				'Stored `reference_graph`:',
				fence(JSON.stringify(st.reference_graph, null, 2), 'json'),
				...(t === tasks.q1
					? [
							'Filter funnel steps:',
							fence(funnelSteps.map((step) => step.replace(/\n/g, ' → ')).join('\n'))
						]
					: [])
			];
		}),
		'## Participant attempts (`study_submission`)',
		'',
		'| # | Task | Attempt | Returned | Correct | Feedback | Time spent (ms) |',
		'|---|---|---|---|---|---|---|',
		...submissions.map(
			(row, index) =>
				`| ${index + 1} | ${row.task_key} | ${attempts[index].label} | ${short(row.result_summary.values ?? [])} | ${row.correct} | ${row.feedback} | ${row.time_spent_ms} |`
		),
		'',
		...submissions.flatMap((row, index) => [
			`### Attempt ${index + 1}: ${attempts[index].label}`,
			'',
			'Stored `sparql`:',
			fence(row.sparql, 'sparql'),
			'Stored `result_summary`:',
			fence(JSON.stringify(row.result_summary, null, 2), 'json')
		]),
		'## `study_task_open`',
		'',
		...opens.map((key) => `- ${key}`),
		'',
		'## Notes',
		'',
		'- Drawn queries run as `SELECT DISTINCT` on the answer variable, so Moltres appears once although two',
		'  relations (weak to, four times weak to) link it to Rock: `multiset` sees no duplicates (DEC-019).',
		'- The funnel lists rdf:type by its IRI because the dataset gives it no label.'
	].join('\n');
	mkdirSync(REPORT_DIR, { recursive: true });
	writeFileSync(new URL('report.md', REPORT_DIR), report);
	await testInfo.attach('report.md', { body: report, contentType: 'text/markdown' });
	await solver.close();
});
