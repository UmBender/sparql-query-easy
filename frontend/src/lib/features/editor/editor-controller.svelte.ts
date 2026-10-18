/**
 * Editor interactions (FE-044): the node and edge action lists, predicate
 * connections, the results table, View SPARQL and search. API calls go
 * through the typed client; graph changes go through the store. Each method
 * reproduces a legacy handler (named in its comment) so the same gestures
 * send the same requests.
 */
import { toast as sonnerToast } from 'svelte-sonner';
import {
	bindPredicateEdges,
	edgeById,
	exploreValuesRequest,
	hasVariableSource,
	nodeById,
	nodeData,
	nodeQueryRequest,
	numericProfileRequestFor,
	relationshipsRequest,
	relationshipValueRequest,
	searchProbeRequests,
	sparqlRequest,
	type QueryNode
} from '#lib/domain/index.js';
import {
	edgeActions,
	nodeActions,
	type EdgeActionId,
	type MenuAction,
	type NodeActionId
} from '#lib/domain/legacy/graph-actions.js';
import { isAbort, type ApiClient, type PropertyItem } from '#lib/api/client.js';
import type { QueryStore } from '#lib/stores/query-store.svelte.js';
import { markSeen, NODE_HINT_KEY, seen } from '#lib/features/utilities/seen.js';

export type ToastKind = 'success' | 'error' | undefined;
export type Toast = (message: string, kind?: ToastKind) => void;

const defaultToast: Toast = (message, kind) => {
	if (kind === 'success') sonnerToast.success(message);
	else if (kind === 'error') sonnerToast.error(message);
	else sonnerToast(message);
};

/** What choosing a results-table row does (legacy row classes and data-method). */
export type RowAction =
	| {
			kind: 'relationship-value';
			subjectId: string;
			predicateId: string;
			predicateLabel: string;
			isLiteral: boolean;
	  }
	| {
			kind: 'replace-node';
			variableName: string;
			nodeId: string;
			nodeLabel: string;
			propertyType?: string | null;
			propertyClass?: string | null;
	  }
	| {
			kind: 'replace-predicate';
			variableName: string;
			nodeId: string;
			nodeLabel: string;
			predicateEdgeIds: string[];
	  };

export type ResultRow = { propertyId: string; label: string; action: RowAction };
export type ResultsSheet = { rows: ResultRow[]; empty: string | null };

export type PredicateChoices = {
	sourceId: string;
	mode: 'connect' | 'value';
	message: string | null;
	items: PropertyItem[];
};

export type Connection = { sourceId: string; predicateId: string; predicateLabel: string };

export class EditorController {
	readonly store: QueryStore;
	readonly api: ApiClient;
	readonly toast: Toast;
	readonly #now: () => number;
	readonly #open: (url: string) => void;

	connection = $state.raw<Connection | null>(null);
	predicateChoices = $state.raw<PredicateChoices | null>(null);
	results = $state.raw<ResultsSheet | null>(null);
	sparql = $state.raw<{ text: string } | null>(null);
	busy = $state(0);
	/** Set when a filter editor should open (FE-045 reads it). */
	editorRequest = $state.raw<{ nodeId: string; seed: string; token: number } | null>(null);
	/** Called when the graph background is tapped (exploration closes, FE-046). */
	onBackground: (() => void)[] = [];
	#predicateRequest = 0;
	#editorToken = 0;

	constructor({
		store,
		api,
		toast = defaultToast,
		now = Date.now,
		open = (url) => window.open(url, '_blank', 'noopener,noreferrer')
	}: {
		store: QueryStore;
		api: ApiClient;
		toast?: Toast;
		now?: () => number;
		open?: (url: string) => void;
	}) {
		this.store = store;
		this.api = api;
		this.toast = toast;
		this.#now = now;
		this.#open = open;
	}

	/** The open node's actions (graph-actions.js), plus loaded predicate choices. */
	nodeMenu: { node: QueryNode; actions: MenuAction<NodeActionId>[] } | null = $derived.by(() => {
		const node = this.store.selectedNode;
		if (!node) return null;
		return {
			node,
			actions: nodeActions(nodeData(node), hasVariableSource(this.store.graph, node.id))
		};
	});
	edgeMenu = $derived.by(() => {
		const selection = this.store.selection;
		if (selection?.kind !== 'edge') return null;
		const edge = edgeById(this.store.graph, selection.id);
		return edge
			? {
					edge,
					actions: edgeActions({ nodeId: edge.predicate }) as MenuAction<EdgeActionId>[]
				}
			: null;
	});

	async #busy<T>(task: () => Promise<T>): Promise<T> {
		this.busy++;
		try {
			return await task();
		} finally {
			this.busy--;
		}
	}

	// ── Selection and dismissal ───────────────────────────────────
	tapNode(id: string) {
		if (this.connection) this.completeConnection(id);
		else this.openNodeMenu(id);
	}
	openNodeMenu(id: string) {
		if (this.predicateChoices?.sourceId !== id) this.predicateChoices = null;
		this.store.select({ kind: 'node', id });
	}
	openEdgeMenu(id: string) {
		this.predicateChoices = null;
		this.store.select({ kind: 'edge', id });
	}
	closeMenus() {
		this.predicateChoices = null;
		this.store.select(null);
	}
	/** Graph background: cancel a connection, close both lists and the exploration panel. */
	tapBackground() {
		this.cancelConnection();
		this.closeMenus();
		this.onBackground.forEach((listener) => listener());
	}

	// ── Connections (FE-007) ──────────────────────────────────────
	beginConnection(sourceId: string, predicateId: string, predicateLabel: string) {
		this.cancelConnection();
		this.connection = { sourceId, predicateId, predicateLabel };
		this.closeMenus();
		this.toast(
			'Click a destination node to connect it. Click the background or press Escape to cancel.'
		);
	}
	completeConnection(targetId: string) {
		const connection = this.connection;
		if (!connection) return;
		this.connection = null;
		if (
			!nodeById(this.store.graph, connection.sourceId) ||
			!nodeById(this.store.graph, targetId)
		)
			return;
		this.store.connect(
			connection.sourceId,
			targetId,
			connection.predicateId,
			connection.predicateLabel
		);
	}
	cancelConnection() {
		this.connection = null;
	}

	// ── Node and edge actions ─────────────────────────────────────
	async runNodeAction(action: NodeActionId | 'choose-predicate', choiceIndex?: number) {
		const node = this.store.selectedNode;
		if (!node) return;
		const data = nodeData(node);
		switch (action) {
			case 'open-link':
				this.#open(String(data.href ?? ''));
				break;
			case 'explore-relationships':
				await this.exploreRelationships(node);
				break;
			case 'explore-default':
				await this.exploreValues(node);
				break;
			case 'run-query':
				await this.runNodeQuery(node);
				break;
			case 'add-value-filter':
				await this.loadPredicateChoices(node, 'value');
				break;
			case 'edit-filter':
			case 'edit-value':
				this.requestEditor(node.id);
				break;
			case 'toggle-boolean':
				this.store.toggleBoolean(node.id);
				break;
			case 'connect-variable-predicate':
				this.beginConnection(node.id, this.store.nextPredicateVariable(), '?');
				break;
			case 'connect-defined-predicate':
				await this.loadPredicateChoices(node, 'connect');
				break;
			case 'choose-predicate': {
				const choices = this.predicateChoices;
				const predicate =
					choices?.sourceId === node.id && choiceIndex !== undefined
						? choices.items[choiceIndex]
						: undefined;
				if (!predicate) break;
				if (choices!.mode === 'value') await this.addValueFilter(node, predicate);
				else
					this.beginConnection(
						node.id,
						predicate.propertyId,
						predicate.propertyLabel || predicate.propertyId
					);
				break;
			}
			case 'convert-variable':
				this.store.convertToVariable(node.id);
				break;
			case 'remove':
				this.store.removeNode(node.id);
				this.closeMenus();
				break;
		}
	}

	runEdgeAction(action: EdgeActionId) {
		const edge = this.edgeMenu?.edge;
		if (!edge) return;
		if (action === 'convert-predicate-variable') this.store.convertEdgeToVariable(edge.id);
		else this.store.removeEdge(edge.id);
		this.closeMenus();
	}

	requestEditor(nodeId: string, seed = '') {
		this.editorRequest = { nodeId, seed, token: ++this.#editorToken };
	}

	/**
	 * Predicate list of Connect with defined predicate, or the datatype
	 * relations of Add value filter, sorted by label (`loadPredicateChoices`).
	 */
	async loadPredicateChoices(node: QueryNode, mode: 'connect' | 'value') {
		const sourceId = node.id;
		const requestId = ++this.#predicateRequest;
		const noun = mode === 'value' ? 'value relations' : 'predicates';
		this.predicateChoices = { sourceId, mode, message: `Loading ${noun}…`, items: [] };
		const current = () =>
			requestId === this.#predicateRequest &&
			this.store.selection?.id === sourceId &&
			this.predicateChoices?.sourceId === sourceId;
		try {
			const response = await this.api.relationships(
				relationshipsRequest(this.store.graph, sourceId, this.store.context, {
					withLimit: true
				})
			);
			if (!current()) return;
			let items = response.filter(
				(item) => typeof item.propertyId === 'string' && item.propertyId
			);
			if (mode === 'value') {
				items = items
					.filter((item) => item.propertyType === 'label' && item.propertyLabel)
					.sort((left, right) => left.propertyLabel.localeCompare(right.propertyLabel));
			}
			const choose = mode === 'value' ? 'Choose a value relation:' : 'Choose a predicate:';
			this.predicateChoices = {
				sourceId,
				mode,
				message: items.length ? choose : `No ${noun} found.`,
				items
			};
		} catch {
			if (!current()) return;
			this.predicateChoices = {
				sourceId,
				mode,
				message: `Could not load ${noun}. Try again.`,
				items: []
			};
		}
	}

	/**
	 * Add value filter (FE-030/FE-034): a value variable fed through the chosen
	 * relation, then its editor seeded with the smallest numeric value.
	 */
	async addValueFilter(node: QueryNode, predicate: PropertyItem) {
		this.closeMenus();
		const valueId = this.store.addValueFilterVariable(
			node.id,
			predicate.propertyId,
			predicate.propertyLabel || predicate.propertyId
		);
		let seed = '';
		const request = numericProfileRequestFor(this.store.graph, valueId, this.store.context, 1);
		if (request) {
			try {
				const profile = await this.api.numericProfile(request);
				if (profile.count) seed = profile.values[0]?.value ?? String(profile.min);
			} catch (error) {
				console.error(error);
			}
		}
		if (!nodeById(this.store.graph, valueId)) return;
		this.requestEditor(valueId, seed);
	}

	/** Explore relationships (`getElementInfo`). */
	async exploreRelationships(node: QueryNode) {
		const elementId = String(nodeData(node).value ?? node.id);
		await this.#busy(async () => {
			try {
				const items = await this.api.relationships(
					relationshipsRequest(this.store.graph, node.id, this.store.context, {
						withLimit: false
					})
				);
				this.results = {
					empty: items.length ? null : 'No relationships found.',
					rows: items.map((item) => ({
						propertyId: item.propertyId,
						label: item.propertyLabel,
						action: {
							kind: 'relationship-value',
							...relationshipValueRequest(elementId, item, this.store.context),
							predicateLabel: item.propertyLabel
						}
					}))
				};
			} catch (error) {
				this.toast('Failed to load relationships. Please try again.', 'error');
				console.error(error);
			}
		});
	}

	/** Run query on a variable node (`getQuery` from the node action). */
	async runNodeQuery(node: QueryNode) {
		const query = nodeQueryRequest(this.store.graph, node.id, this.store.context);
		if (!query) return;
		await this.#showQuery(query.request, (item) =>
			query.method === 'replacePredicateVariable'
				? {
						kind: 'replace-predicate',
						variableName: query.request.variableName,
						nodeId: item.propertyId,
						nodeLabel: item.propertyLabel,
						predicateEdgeIds: query.predicateEdgeIds
					}
				: {
						kind: 'replace-node',
						variableName: query.request.variableName,
						nodeId: item.propertyId,
						nodeLabel: item.propertyLabel,
						propertyType: item.propertyType,
						propertyClass: item.propertyClass
					}
		);
	}

	/** Run Query when no stage order applies (a legacy variable test matched): the results table. */
	async runLegacyQuery(request: Parameters<ApiClient['query']>[0]) {
		await this.#showQuery(request, (item) => ({
			kind: 'replace-node',
			variableName: request.variableName,
			nodeId: item.propertyId,
			nodeLabel: item.propertyLabel,
			propertyType: item.propertyType,
			propertyClass: item.propertyClass
		}));
	}

	/** Explore values of a class (`explore-default`), with the full rdfs:domain IRI. */
	async exploreValues(node: QueryNode) {
		const request = exploreValuesRequest(node, this.store.context, this.#now());
		await this.#showQuery(request, (item) => ({
			kind: 'relationship-value',
			subjectId: request.variableName,
			predicateId: item.propertyId,
			predicateLabel: item.propertyLabel,
			isLiteral: item.propertyType === 'label' || item.propertyLabel === 'image'
		}));
	}

	async #showQuery(
		request: Parameters<ApiClient['query']>[0],
		action: (item: PropertyItem) => RowAction
	) {
		await this.#busy(async () => {
			try {
				const items = await this.api.query(request);
				this.results = {
					empty: items.length ? null : 'No results found.',
					rows: items.map((item) => ({
						propertyId: item.propertyId,
						label: item.propertyLabel,
						action: action(item)
					}))
				};
			} catch (error) {
				this.toast('Query failed. Please try again.', 'error');
				console.error(error);
			}
		});
	}

	closeResults() {
		this.results = null;
	}

	/** A results-table row click. */
	async chooseRow(row: ResultRow) {
		const action = row.action;
		if (action.kind === 'relationship-value') {
			await this.#busy(async () => {
				try {
					await this.#addRelationshipValues(
						action.subjectId,
						action.predicateId,
						action.predicateLabel,
						action.isLiteral
					);
					this.closeResults();
				} catch (error) {
					this.toast('Failed to load value. Please try again.', 'error');
					console.error(error);
				}
			});
		} else if (action.kind === 'replace-predicate') {
			this.store.commit(
				bindPredicateEdges(
					this.store.graph,
					action.predicateEdgeIds,
					action.variableName,
					action.nodeId,
					action.nodeLabel
				)
			);
			this.closeResults();
		} else {
			const refetch = this.store.chooseResult(action.variableName, {
				id: action.nodeId,
				label: action.nodeLabel,
				propertyType: action.propertyType,
				propertyClass: action.propertyClass
			});
			this.closeResults();
			for (const relation of refetch) {
				// `getRelationshipValueChange`: failures are only logged, as before.
				this.#addRelationshipValues(
					action.nodeId,
					relation.predicateId,
					relation.predicateLabel,
					!relation.targetIsIri
				).catch((error) => console.error(error));
			}
		}
	}

	/** One value becomes a node with its relation; zero or many an "N results" node. */
	async #addRelationshipValues(
		subjectId: string,
		predicateId: string,
		predicateLabel: string,
		isLiteral: boolean
	) {
		const items = await this.api.relationshipValue({
			endpointUrl: this.store.context.endpointUrl,
			subjectId,
			predicateId,
			isLiteral
		});
		if (items.length === 1) {
			const [item] = items;
			this.store.addRelationValue({
				id: item.propertyId,
				text: item.propertyLabel,
				valueType: item.propertyType ?? null,
				sourceNodeId: subjectId,
				predicateId,
				predicateLabel,
				predicateIndex: 0
			});
		} else {
			this.store.addRelationValue({
				id: `?node_${this.#now()}`,
				text: `${items.length} results`,
				valueType: 'many-results',
				sourceNodeId: subjectId,
				predicateId,
				predicateLabel
			});
		}
	}

	// ── View SPARQL ───────────────────────────────────────────────
	async viewSparql() {
		const result = sparqlRequest(this.store.graph, this.store.context);
		if (!('request' in result)) {
			this.toast(result.message, 'error');
			return;
		}
		await this.#busy(async () => {
			try {
				this.sparql = { text: await this.api.sparql(result.request) };
			} catch (error) {
				console.error(error);
				this.sparql = { text: 'Could not generate query. Please try again.' };
			}
		});
	}
	closeSparql() {
		this.sparql = null;
	}
	async copySparql(
		clipboard: Pick<Clipboard, 'writeText'> | undefined = globalThis.navigator?.clipboard
	) {
		if (!clipboard || !this.sparql) {
			this.toast('Clipboard not available.', 'error');
			return;
		}
		try {
			await clipboard.writeText(this.sparql.text);
			this.toast('Copied to clipboard!', 'success');
		} catch {
			this.toast('Could not copy.', 'error');
		}
	}

	// ── Search nodes (FE-001) ─────────────────────────────────────
	async searchItems(text: string, signal?: AbortSignal): Promise<PropertyItem[]> {
		try {
			return await this.api.search(
				{
					endpointUrl: this.store.context.endpointUrl,
					search: text,
					limit: this.store.limit
				},
				{ signal }
			);
		} catch (error) {
			if (!isAbort(error)) console.error(error);
			return [];
		}
	}

	/**
	 * A chosen search result (`addSearchResultNode`): every node is probed in
	 * both directions; each probe that finds a predicate adds the result with
	 * that relation, otherwise it is added on its own.
	 */
	async addSearchResult(item: PropertyItem) {
		const probes = searchProbeRequests(this.store.graph, item.propertyId, this.store.context);
		const found = await Promise.all(
			probes.map((probe) =>
				this.api.query(probe.request).then(
					(rows) => (rows.length ? { probe, predicate: rows[0] } : null),
					(error) => {
						console.error(error);
						return null;
					}
				)
			)
		);
		const hits = found.filter((hit) => hit !== null);
		for (const { probe, predicate } of hits) {
			this.store.addRelationValue({
				id: item.propertyId,
				text: item.propertyLabel,
				valueType: 'node',
				sourceNodeId: probe.existingId,
				predicateId: predicate.propertyId,
				predicateLabel: predicate.propertyLabel,
				subject: probe.invert ? probe.existingId : item.propertyId
			});
		}
		if (!hits.length) this.store.addEntity(item.propertyId, item.propertyLabel);
		// One-time hint after the first node (legacy `showIntroAlert('newNode', …)`).
		if (!seen(NODE_HINT_KEY)) {
			markSeen(NODE_HINT_KEY);
			this.toast('Click a node to open its action list.');
		}
	}
}
