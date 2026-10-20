<!--
	One typed RDF term of an expected result (STUDY-006): an IRI by its local
	name with the full IRI as its title, a literal with its datatype or language.
-->
<script lang="ts">
	import type { RdfTerm } from '#lib/api/client.js';

	let { term }: { term: RdfTerm } = $props();

	const local = (iri: string) =>
		iri.slice(Math.max(iri.lastIndexOf('#'), iri.lastIndexOf('/')) + 1) || iri;
	const suffix = $derived(
		term.language ? `@${term.language}` : term.datatype ? ` (${local(term.datatype)})` : ''
	);
</script>

{#if term.type === 'iri'}
	<span title={term.value}>{local(term.value)}</span>
{:else}
	<span>"{term.value}"<span class="text-muted-foreground">{suffix}</span></span>
{/if}
