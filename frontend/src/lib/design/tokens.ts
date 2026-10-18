/**
 * Design tokens (FE-041): the one source of every color, size and layer in the
 * new frontend. `css.ts` emits them as CSS variables for Tailwind and
 * shadcn-svelte, `cytoscape.ts` builds the graph stylesheet from them. Colors
 * are written only in `src/lib/design/` (checked by `npm run lint`).
 *
 * Node-kind colors keep the legacy page's values (graph-model.js, index2.css)
 * so a drawn query looks the same in both frontends.
 */

/** Semantic UI colors; light and dark define the same keys (unit test). */
export type Palette = {
	/** Page background and the text on it. */
	background: string;
	foreground: string;
	/** Raised panels, cards, popovers. */
	surface: string;
	surfaceForeground: string;
	/** Quiet backgrounds (tracks, table stripes) and secondary text. */
	muted: string;
	mutedForeground: string;
	border: string;
	input: string;
	/** Focus ring. */
	ring: string;
	/** Main action color (Run Query, links) and the text on it. */
	primary: string;
	primaryForeground: string;
	/** Secondary buttons and chips. */
	secondary: string;
	secondaryForeground: string;
	/** Hover/selection tint. */
	accent: string;
	accentForeground: string;
	success: string;
	successForeground: string;
	warning: string;
	warningForeground: string;
	danger: string;
	dangerForeground: string;
	/** App bar (legacy navbar/toolbar blue). */
	brand: string;
	brandForeground: string;
	/** Graph canvas background. */
	canvas: string;
	/** Numbered stage-order chips (legacy orange blocks). */
	stage: string;
	stageBorder: string;
	stageForeground: string;
	stageNumber: string;
	/** Halo shared by a variable's chip and its graph elements (FE-023). */
	emphasis: string;
};

/** How one node kind is drawn: fill, border and label color. */
export type NodeKindStyle = {
	fill: string;
	border: string;
	borderWidth: number;
	text: string;
	shape: 'ellipse' | 'rectangle';
	width: number;
	height: number;
};

export type NodeKindName =
	'entity' | 'variable' | 'value' | 'valueVariable' | 'class' | 'many' | 'legacyFilter';

export type GraphTokens = {
	nodes: Record<NodeKindName, NodeKindStyle>;
	/** Relations: line, label text and label background for fixed and variable predicates. */
	edge: { line: string; width: number; label: string; labelBackground: string };
	variableEdge: { label: string; labelBackground: string };
	filterEdge: { label: string; labelBackground: string };
	/** Selected node/edge (action list open), connection source. */
	selected: string;
	/** A filter that keeps nothing or a fixed value it rejects (FE-036). */
	rejected: string;
	/** Possible-graph window states (FE-017). */
	possible: { assumed: string; possible: string; possibleBorder: string; openText: string };
	labelFontSize: number;
	edgeLabelFontSize: number;
};

export type Tokens = {
	light: Palette;
	dark: Palette;
	graph: GraphTokens;
	/** `canvas` is the graph label font: Cytoscape accepts no quotes in font-family. */
	font: { sans: string; mono: string; canvas: string };
	/** Type scale in rem. */
	text: { xs: string; sm: string; base: string; lg: string; xl: string; '2xl': string };
	/** Spacing scale in rem (Tailwind's base unit). */
	spacing: string;
	radius: { sm: string; md: string; lg: string; full: string };
	shadow: { sm: string; md: string; lg: string };
	/** Stacking layers, lowest first. */
	z: {
		canvas: number;
		overlay: number;
		panel: number;
		menu: number;
		dialog: number;
		toast: number;
	};
};

export const tokens: Tokens = {
	light: {
		background: '#ffffff',
		foreground: '#1a2433',
		surface: '#ffffff',
		surfaceForeground: '#1a2433',
		muted: '#eef1f5',
		mutedForeground: '#4f5b6b',
		border: '#d5dbe3',
		input: '#c3cbd6',
		ring: '#1565c0',
		primary: '#1565c0',
		primaryForeground: '#ffffff',
		secondary: '#e3eaf7',
		secondaryForeground: '#0d3a75',
		accent: '#e3f2fd',
		accentForeground: '#0d3a75',
		success: '#2e7d32',
		successForeground: '#ffffff',
		warning: '#a85200',
		warningForeground: '#ffffff',
		danger: '#c62828',
		dangerForeground: '#ffffff',
		brand: '#0d47a1',
		brandForeground: '#ffffff',
		canvas: '#ffffff',
		stage: '#ffab40',
		stageBorder: '#b26a00',
		stageForeground: '#212121',
		stageNumber: '#fff3e0',
		emphasis: '#00b8d4'
	},
	dark: {
		background: '#0f141b',
		foreground: '#e6eaf0',
		surface: '#171e28',
		surfaceForeground: '#e6eaf0',
		muted: '#222b37',
		mutedForeground: '#a3aebc',
		border: '#2e3947',
		input: '#3a4656',
		ring: '#90caf9',
		primary: '#90caf9',
		primaryForeground: '#0b1a2b',
		secondary: '#1f2d42',
		secondaryForeground: '#d6e6fb',
		accent: '#1c3350',
		accentForeground: '#e3f2fd',
		success: '#81c784',
		successForeground: '#0b1f0c',
		warning: '#ffb74d',
		warningForeground: '#241400',
		danger: '#ef9a9a',
		dangerForeground: '#2b0606',
		brand: '#0b2f66',
		brandForeground: '#ffffff',
		canvas: '#f7f9fc',
		stage: '#ffab40',
		stageBorder: '#b26a00',
		stageForeground: '#212121',
		stageNumber: '#fff3e0',
		emphasis: '#00b8d4'
	},
	graph: {
		nodes: {
			entity: {
				fill: '#4472c4',
				border: '#4472c4',
				borderWidth: 0,
				text: '#ffffff',
				shape: 'ellipse',
				width: 120,
				height: 120
			},
			variable: {
				fill: '#a9d18e',
				border: '#6a9141',
				borderWidth: 0,
				text: '#1b3b0f',
				shape: 'ellipse',
				width: 120,
				height: 120
			},
			value: {
				fill: '#f48fb1',
				border: '#f48fb1',
				borderWidth: 0,
				text: '#212121',
				shape: 'rectangle',
				width: 120,
				height: 50
			},
			valueVariable: {
				fill: '#a9d18e',
				border: '#f48fb1',
				borderWidth: 4,
				text: '#1b3b0f',
				shape: 'rectangle',
				width: 120,
				height: 50
			},
			class: {
				fill: '#fdd835',
				border: '#fdd835',
				borderWidth: 0,
				text: '#212121',
				shape: 'ellipse',
				width: 120,
				height: 120
			},
			many: {
				fill: '#999999',
				border: '#999999',
				borderWidth: 0,
				text: '#ffffff',
				shape: 'ellipse',
				width: 120,
				height: 120
			},
			legacyFilter: {
				fill: '#7030a0',
				border: '#7030a0',
				borderWidth: 0,
				text: '#ffffff',
				shape: 'rectangle',
				width: 120,
				height: 50
			}
		},
		edge: { line: '#4472c4', width: 3, label: '#2f5597', labelBackground: '#ffffff' },
		variableEdge: { label: '#1b3b0f', labelBackground: '#a9d18e' },
		filterEdge: { label: '#1a2433', labelBackground: '#8497b0' },
		selected: '#1565c0',
		rejected: '#c62828',
		possible: {
			assumed: '#ff6f00',
			possible: '#8e24aa',
			possibleBorder: '#4a148c',
			openText: '#1b5e20'
		},
		labelFontSize: 14,
		edgeLabelFontSize: 12
	},
	font: {
		sans: "'Inter Variable', system-ui, sans-serif",
		mono: "ui-monospace, 'SFMono-Regular', Menlo, monospace",
		canvas: 'Inter Variable, system-ui, sans-serif'
	},
	text: {
		xs: '0.75rem',
		sm: '0.875rem',
		base: '1rem',
		lg: '1.125rem',
		xl: '1.25rem',
		'2xl': '1.5rem'
	},
	spacing: '0.25rem',
	radius: { sm: '0.25rem', md: '0.375rem', lg: '0.5rem', full: '9999px' },
	shadow: {
		sm: '0 1px 2px rgb(15 20 27 / 0.08)',
		md: '0 4px 12px rgb(15 20 27 / 0.12)',
		lg: '0 12px 32px rgb(15 20 27 / 0.18)'
	},
	z: { canvas: 0, overlay: 10, panel: 20, menu: 30, dialog: 40, toast: 50 }
};
