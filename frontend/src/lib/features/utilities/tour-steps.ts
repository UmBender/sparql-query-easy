/** The guided tour (legacy Intro.js `data-intro`/`data-step` order and texts). */
export type TourStep = { target: string; text: string };

export const TOUR_STEPS: TourStep[] = [
	{
		target: '#search-nodes',
		text: 'Type to search for an entity. Click the result to add it to the graph.'
	},
	{ target: '#input-max-results', text: 'Max number of results to return per query.' },
	{
		target: '#input-endpoint-sparql',
		text: 'Specify the SPARQL endpoint or local dataset name.'
	},
	{ target: '#upload-triples-btn', text: 'Upload a .TTL file to query locally.' },
	{ target: '#auto-layout', text: 'Toggle automatic graph layout.' },
	{ target: '#add-variable-btn', text: 'Add a new variable (?) node to the canvas.' },
	{
		target: '#run-query-btn',
		text: "Run the query and see results. You can also choose Run query from a variable node's action list."
	},
	{
		target: '#cy',
		text: 'Build your query here. Click a node to open its action list. Click the graph background to close it. Alt+drag to create a new variable edge.'
	},
	{ target: '#demo-link', text: 'Watch the demo video for help.' }
];
