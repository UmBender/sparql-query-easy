import { tokens as defaultTokens, type Palette, type Tokens } from './tokens.js';

/** `surfaceForeground` → `surface-foreground`. */
export function kebab(name: string): string {
	return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

/**
 * shadcn-svelte reads these variable names; each comes from a semantic token.
 * Keys are shadcn names, values are palette keys.
 */
const SHADCN: Record<string, keyof Palette> = {
	card: 'surface',
	'card-foreground': 'surfaceForeground',
	popover: 'surface',
	'popover-foreground': 'surfaceForeground',
	destructive: 'danger',
	'destructive-foreground': 'dangerForeground',
	sidebar: 'surface',
	'sidebar-foreground': 'surfaceForeground',
	'sidebar-primary': 'primary',
	'sidebar-primary-foreground': 'primaryForeground',
	'sidebar-accent': 'accent',
	'sidebar-accent-foreground': 'accentForeground',
	'sidebar-border': 'border',
	'sidebar-ring': 'ring',
	'chart-1': 'primary',
	'chart-2': 'success',
	'chart-3': 'warning',
	'chart-4': 'danger',
	'chart-5': 'mutedForeground'
};

/** CSS variable declarations of one palette (semantic names and shadcn aliases). */
export function paletteVariables(palette: Palette): Record<string, string> {
	const variables: Record<string, string> = {};
	for (const [name, value] of Object.entries(palette)) variables[`--${kebab(name)}`] = value;
	for (const [name, key] of Object.entries(SHADCN)) variables[`--${name}`] = palette[key];
	return variables;
}

/** Theme-independent variables: graph node kinds, type, spacing, radii, shadows, layers. */
export function sharedVariables(tokens: Tokens): Record<string, string> {
	const variables: Record<string, string> = {};
	for (const [kind, style] of Object.entries(tokens.graph.nodes)) {
		variables[`--node-${kebab(kind)}-fill`] = style.fill;
		variables[`--node-${kebab(kind)}-border`] = style.border;
		variables[`--node-${kebab(kind)}-text`] = style.text;
	}
	variables['--edge-line'] = tokens.graph.edge.line;
	variables['--edge-label'] = tokens.graph.edge.label;
	variables['--edge-variable-label'] = tokens.graph.variableEdge.label;
	variables['--edge-variable-background'] = tokens.graph.variableEdge.labelBackground;
	variables['--graph-selected'] = tokens.graph.selected;
	variables['--graph-rejected'] = tokens.graph.rejected;
	variables['--possible-assumed'] = tokens.graph.possible.assumed;
	variables['--possible-possible'] = tokens.graph.possible.possible;
	variables['--font-sans-family'] = tokens.font.sans;
	variables['--font-mono-family'] = tokens.font.mono;
	for (const [name, value] of Object.entries(tokens.text))
		variables[`--text-size-${name}`] = value;
	variables['--spacing-unit'] = tokens.spacing;
	variables['--radius'] = tokens.radius.lg;
	for (const [name, value] of Object.entries(tokens.radius))
		variables[`--radius-token-${name}`] = value;
	for (const [name, value] of Object.entries(tokens.shadow))
		variables[`--shadow-token-${name}`] = value;
	for (const [name, value] of Object.entries(tokens.z)) variables[`--z-${name}`] = String(value);
	return variables;
}

function block(selector: string, variables: Record<string, string>): string {
	const lines = Object.entries(variables).map(([name, value]) => `\t${name}: ${value};`);
	return `${selector} {\n${lines.join('\n')}\n}\n`;
}

/**
 * The generated stylesheet: shared variables and the light palette on `:root`,
 * the dark palette on `.dark` (shadcn-svelte's dark-mode class).
 */
export function tokenCss(tokens: Tokens = defaultTokens): string {
	return [
		'/* Generated from src/lib/design/tokens.ts by `npm run tokens`; do not edit. */\n',
		block(':root', { ...sharedVariables(tokens), ...paletteVariables(tokens.light) }),
		block('.dark', paletteVariables(tokens.dark))
	].join('\n');
}
