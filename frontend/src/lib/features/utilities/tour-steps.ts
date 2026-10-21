/** The guided tour over the editor's toolbar and canvas (FE-054; FE-048 ported the legacy texts). */
export type TourStep = { target: string; text: string };

export const TOUR_STEPS: TourStep[] = [
	{
		target: '#input-endpoint-sparql',
		text: 'Choose what to query: a built-in dataset such as PokemonGen1, or the URL of a SPARQL endpoint such as Wikidata.'
	},
	{
		target: '#search-nodes',
		text: 'Type to search for an entity. Click the result to add it to the graph.'
	},
	{
		target: '#add-variable-btn',
		text: 'Add a variable (?) node. The query finds the entities that can take its place.'
	},
	{
		target: '#add-value-variable-btn',
		text: 'Add a value variable for numbers, text or dates. Click it to add a filter: exact, starts with, contains, at least, at most, between, MAX or MIN.'
	},
	{
		target: '#cy',
		text: 'Build your query here. Each arrow is one relation the results must have. Click a node to open its action list; click the background to close it. Alt+drag from a node to draw a new relation.'
	},
	{
		target: '#filter-funnel-btn',
		text: 'The filter funnel shows how each filter narrows the result, step by step. Switch a step off to preview the result without it. Badges above filtered nodes show how many values are kept.'
	},
	{
		target: '#run-query-btn',
		text: 'Run the query. Variables are explored one at a time, in the numbered order next to this button: choose a value for each and apply it to the graph.'
	},
	{
		target: '#view-sparql-btn',
		text: 'View SPARQL shows the query your graph turns into.'
	},
	{
		target: '#export-query-btn',
		text: 'Export Query saves the graph to a file; Upload Query opens it again later.'
	},
	{
		target: '#upload-triples-btn',
		text: 'Upload a .ttl file of triples to query it as a local dataset.'
	},
	{ target: '#input-max-results', text: 'Limit: the most results each query returns.' },
	{ target: '#auto-layout', text: 'Toggle automatic graph layout.' }
];
