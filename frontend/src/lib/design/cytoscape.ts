import { tokens as defaultTokens, type NodeKindName, type Tokens } from './tokens.js';

/**
 * One Cytoscape style rule. Typed locally so the design module stays free of
 * the cytoscape package; the canvas passes the result to `cytoscape({ style })`.
 */
export type StyleRule = { selector: string; style: Record<string, string | number> };

/**
 * Graph elements carry `data(kind)` set by the canvas from the domain model:
 * `entity`, `variable`, `value`, `valueVariable`, `class`, `many`,
 * `legacyFilter` for nodes; edges carry `data(kind)` `fixed`, `variable` or
 * `filter`. State is expressed as classes: `selected` (action list open or
 * connection source), `rejected` (FE-036), `emphasis` (FE-023), `hover`.
 */
export function graphStylesheet(tokens: Tokens = defaultTokens): StyleRule[] {
	const { graph } = tokens;
	const nodeRules = (
		Object.entries(graph.nodes) as [NodeKindName, Tokens['graph']['nodes'][NodeKindName]][]
	).map(([kind, style]): StyleRule => ({
		selector: `node[kind = "${kind}"]`,
		style: {
			'background-color': style.fill,
			'border-color': style.border,
			'border-width': style.borderWidth,
			color: style.text,
			shape: style.shape,
			width: style.width,
			height: style.height
		}
	}));
	return [
		{
			selector: 'node',
			style: {
				label: 'data(label)',
				'font-family': tokens.font.canvas,
				'font-size': graph.labelFontSize,
				'text-valign': 'center',
				'text-halign': 'center',
				'text-wrap': 'wrap',
				'text-max-width': 110
			}
		},
		...nodeRules,
		{
			// A label longer than the node is written under it (legacy node-label-big).
			selector: 'node.label-below',
			style: { 'text-valign': 'bottom', 'text-margin-y': 6, color: graph.edge.label }
		},
		{
			selector: 'edge',
			style: {
				width: graph.edge.width,
				'curve-style': 'bezier',
				'line-color': graph.edge.line,
				'target-arrow-color': graph.edge.line,
				'target-arrow-shape': 'triangle',
				label: 'data(label)',
				'font-family': tokens.font.canvas,
				'font-size': graph.edgeLabelFontSize,
				color: graph.edge.label,
				'text-background-color': graph.edge.labelBackground,
				'text-background-opacity': 1,
				'text-background-padding': 3,
				'text-background-shape': 'roundrectangle'
			}
		},
		{
			selector: 'edge[kind = "variable"]',
			style: {
				color: graph.variableEdge.label,
				'text-background-color': graph.variableEdge.labelBackground
			}
		},
		{
			selector: 'edge[kind = "filter"]',
			style: {
				color: graph.filterEdge.label,
				'text-background-color': graph.filterEdge.labelBackground
			}
		},
		{
			selector: 'node.hover',
			style: { 'overlay-color': graph.selected, 'overlay-opacity': 0.08 }
		},
		{ selector: 'node.selected', style: { 'border-width': 4, 'border-color': graph.selected } },
		{ selector: 'node.rejected', style: { 'border-width': 4, 'border-color': graph.rejected } },
		{
			selector: 'edge.selected',
			style: {
				'line-color': graph.selected,
				'target-arrow-color': graph.selected,
				width: graph.edge.width + 2
			}
		},
		{
			selector: '.emphasis',
			style: {
				'underlay-color': tokens.light.emphasis,
				'underlay-opacity': 0.55,
				'underlay-padding': 10
			}
		}
	];
}

/** Stylesheet of the read-only possible-graph window (FE-017): smaller nodes and assignment states. */
export function possibleGraphStylesheet(tokens: Tokens = defaultTokens): StyleRule[] {
	const { graph } = tokens;
	return [
		{
			selector: 'node',
			style: {
				label: 'data(label)',
				width: 60,
				height: 60,
				'font-size': 11,
				'text-valign': 'center',
				'text-halign': 'center',
				'text-wrap': 'ellipsis',
				'text-max-width': 70,
				color: graph.nodes.entity.text,
				'background-color': graph.nodes.entity.fill,
				'border-width': 0
			}
		},
		{
			selector: 'node.literal',
			style: {
				shape: 'rectangle',
				height: 26,
				'background-color': graph.nodes.value.fill,
				color: graph.nodes.value.text
			}
		},
		{
			selector: 'node.open',
			style: { 'background-color': graph.nodes.variable.fill, color: graph.possible.openText }
		},
		{
			selector: 'node.assumed',
			style: {
				'border-width': 4,
				'border-color': graph.possible.assumed,
				'border-style': 'dashed'
			}
		},
		{
			selector: 'node.possible',
			style: {
				'background-color': graph.possible.possible,
				color: graph.nodes.entity.text,
				'border-width': 3,
				'border-color': graph.possible.possibleBorder,
				'border-style': 'dashed'
			}
		},
		{
			selector: 'edge',
			style: {
				label: 'data(label)',
				'font-size': 10,
				width: 2,
				'curve-style': 'bezier',
				'target-arrow-shape': 'triangle',
				'line-color': graph.edge.line,
				'target-arrow-color': graph.edge.line,
				'text-background-color': graph.edge.labelBackground,
				'text-background-opacity': 1,
				'text-background-padding': 2,
				color: graph.edge.label
			}
		},
		{
			selector: 'edge.open',
			style: {
				color: graph.possible.openText,
				'text-background-color': graph.nodes.variable.fill
			}
		},
		{
			selector: 'edge.assumed',
			style: {
				'line-style': 'dashed',
				'line-color': graph.possible.assumed,
				'target-arrow-color': graph.possible.assumed
			}
		},
		{
			selector: 'edge.possible',
			style: {
				'line-color': graph.possible.possible,
				'target-arrow-color': graph.possible.possible,
				color: graph.nodes.entity.text,
				'text-background-color': graph.possible.possible
			}
		},
		{
			selector: '.label-below',
			style: {
				'text-wrap': 'wrap',
				'text-max-width': 150,
				'text-background-opacity': 0.92,
				'text-background-padding': 2,
				'text-background-shape': 'roundrectangle'
			}
		},
		{
			selector: 'node.label-below',
			style: {
				'text-valign': 'bottom',
				'text-margin-y': 4,
				color: graph.nodes.value.text,
				'text-background-color': graph.edge.labelBackground
			}
		},
		{ selector: 'edge.label-below', style: { 'text-margin-y': 'data(labelOffset)' } }
	];
}

/** Stylesheet of the filter editor's mini result graph (FE-035): entities above their values. */
export function filterPreviewStylesheet(tokens: Tokens = defaultTokens): StyleRule[] {
	const { graph } = tokens;
	return [
		{
			selector: 'node[kind = "entity"]',
			style: {
				shape: 'ellipse',
				width: 96,
				height: 56,
				'background-color': graph.nodes.entity.fill,
				label: 'data(label)',
				'font-size': 15,
				color: graph.nodes.entity.text,
				'text-valign': 'center',
				'text-wrap': 'ellipsis',
				'text-max-width': 86,
				'text-outline-color': graph.nodes.entity.fill,
				'text-outline-width': 2
			}
		},
		{
			selector: 'node[kind = "value"]',
			style: {
				shape: 'round-rectangle',
				width: 80,
				height: 36,
				'background-color': graph.nodes.value.fill,
				label: 'data(label)',
				'font-size': 16,
				'font-weight': 'bold',
				color: graph.nodes.value.text,
				'text-valign': 'center',
				'text-wrap': 'ellipsis',
				'text-max-width': 76
			}
		},
		{
			selector: 'edge',
			style: {
				width: 3,
				'line-color': graph.edge.line,
				'target-arrow-color': graph.edge.line,
				'target-arrow-shape': 'triangle',
				'curve-style': 'straight',
				label: 'data(label)',
				'font-size': 13,
				color: graph.edge.label,
				'text-background-color': graph.edge.labelBackground,
				'text-background-opacity': 1,
				'text-background-padding': 2
			}
		}
	];
}
