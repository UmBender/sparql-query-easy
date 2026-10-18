import { describe, expect, it } from 'vitest';
import { tokenCss, paletteVariables } from './css.js';
import { graphStylesheet, possibleGraphStylesheet } from './cytoscape.js';
import { tokens, type Tokens } from './tokens.js';

function withToken(change: (copy: Tokens) => void): Tokens {
	const copy = structuredClone(tokens);
	change(copy);
	return copy;
}

describe('design tokens', () => {
	it('light and dark palettes define the same keys', () => {
		expect(Object.keys(tokens.dark).sort()).toEqual(Object.keys(tokens.light).sort());
		expect(Object.keys(paletteVariables(tokens.dark)).sort()).toEqual(
			Object.keys(paletteVariables(tokens.light)).sort()
		);
	});

	it('one changed node token reaches both the CSS variables and the Cytoscape stylesheet', () => {
		const changed = withToken((copy) => {
			copy.graph.nodes.entity.fill = '#123456';
		});
		expect(tokenCss(tokens)).not.toContain('--node-entity-fill: #123456;');
		expect(tokenCss(changed)).toContain('--node-entity-fill: #123456;');
		const entityRule = (sheet: ReturnType<typeof graphStylesheet>) =>
			sheet.find((rule) => rule.selector === 'node[kind = "entity"]')?.style[
				'background-color'
			];
		expect(entityRule(graphStylesheet(tokens))).toBe(tokens.graph.nodes.entity.fill);
		expect(entityRule(graphStylesheet(changed))).toBe('#123456');
		expect(JSON.stringify(possibleGraphStylesheet(changed))).toContain('#123456');
	});

	it('one changed palette token reaches its CSS variable and the shadcn alias', () => {
		const css = tokenCss(withToken((copy) => (copy.dark.danger = '#abcdef')));
		const dark = css.slice(css.indexOf('.dark {'));
		expect(dark).toContain('--danger: #abcdef;');
		expect(dark).toContain('--destructive: #abcdef;');
	});

	it('the stylesheet styles every node kind, selection, rejection and emphasis', () => {
		const selectors = graphStylesheet().map((rule) => rule.selector);
		for (const kind of Object.keys(tokens.graph.nodes))
			expect(selectors).toContain(`node[kind = "${kind}"]`);
		expect(selectors).toEqual(
			expect.arrayContaining([
				'node.selected',
				'node.rejected',
				'edge.selected',
				'.emphasis',
				'node.hover',
				'edge[kind = "variable"]'
			])
		);
	});

	it('node-kind colors equal the legacy page values', async () => {
		// FE-049 replaces this live comparison when the legacy page is removed.
		const legacyPath = new URL('../../../../sparql/graph-model.js', import.meta.url).href;
		const legacy = await import(/* @vite-ignore */ legacyPath);
		const { nodes } = tokens.graph;
		const color = (data: object) => String(legacy.nodeColor(data)).toLowerCase();
		expect(nodes.entity.fill).toBe(color({ type: 'node' }));
		expect(nodes.variable.fill).toBe(color({ type: 'variable' }));
		expect(nodes.value.fill).toBe(color({ type: 'label' }));
		expect(nodes.valueVariable.fill).toBe(color({ type: 'value-variable' }));
		expect(nodes.class.fill).toBe(color({ type: 'default' }));
		expect(nodes.many.fill).toBe(color({ type: 'variable', color: 'gray' }));
		expect(nodes.legacyFilter.fill).toBe(color({ type: 'label-filter' }));
		const border = legacy.nodeBorder({ type: 'value-variable' });
		expect([nodes.valueVariable.borderWidth, nodes.valueVariable.border]).toEqual([
			border.width,
			border.color.toLowerCase()
		]);
		expect(legacy.nodeShape({ type: 'label' }).shape).toBe(nodes.value.shape);
		expect(legacy.nodeShape({ type: 'node' }).shape).toBe(nodes.entity.shape);
	});
});
