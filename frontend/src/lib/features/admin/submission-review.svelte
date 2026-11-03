<!--
	STUDY-017 (DEC-020): one participant's last saved answer beside the task as
	it was at the save's revision: statement, reference diagram, its SPARQL and
	expected values. The automatic check is a hint for the researcher, not a
	grade. The account behind the pseudonym is shown here only.
-->
<script lang="ts">
	import type { AdminSubmission } from '#lib/api/client.js';
	import DiagramView from './diagram-view.svelte';
	import TermValue from './term-value.svelte';

	let { submission }: { submission: AdminSubmission } = $props();

	const summary = $derived(submission.summary);
	const reference = $derived(submission.reference);
	const HINTS: Record<string, string> = {
		match: 'Match',
		no_match: 'No match',
		not_checked: 'Not checked'
	};
	const seconds = (ms: number) => `${Math.round(ms / 1000)} s`;
	const when = (iso: string) => new Date(iso).toLocaleString();
</script>

<div class="flex flex-col gap-4" data-testid="submission-review">
	<header class="flex flex-col gap-1">
		<h1 class="text-xl font-semibold">
			{summary.participant} · {summary.taskTitle}
		</h1>
		<dl
			class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm sm:grid-cols-[auto_1fr_auto_1fr]"
		>
			<dt class="text-muted-foreground">Account</dt>
			<dd data-testid="review-account">{summary.username}</dd>
			<dt class="text-muted-foreground">Task</dt>
			<dd>
				<span class="font-mono">{summary.taskKey}</span>, revision {summary.taskRevision}
			</dd>
			<dt class="text-muted-foreground">Saved</dt>
			<dd>{when(summary.savedAt)} (save {summary.saves})</dd>
			<dt class="text-muted-foreground">Time spent</dt>
			<dd>{seconds(summary.timeSpentMs)}</dd>
			<dt class="text-muted-foreground">Final submission</dt>
			<dd>{summary.finished ? 'Yes' : 'No'}</dd>
			<dt class="text-muted-foreground">Automatic check</dt>
			<dd data-testid="review-hint">
				{HINTS[summary.autoCheck] ?? summary.autoCheck} (a hint, not a grade)
			</dd>
		</dl>
	</header>

	<div class="grid gap-4 lg:grid-cols-2">
		<section
			aria-labelledby="answer-title"
			class="flex min-w-0 flex-col gap-3 rounded-lg border bg-surface p-4 text-surface-foreground"
		>
			<h2 id="answer-title" class="font-medium">Saved answer</h2>
			<DiagramView graph={submission.graph} label="Saved answer diagram" />
			<p class="text-sm" data-testid="check-summary">{submission.check.summary}</p>
			{#if submission.check.kind === 'structural'}
				<p class="text-sm text-muted-foreground">
					No variables: the drawn triples were compared with the reference's. Missing
					{submission.check.missing}, extra {submission.check.extra}.
				</p>
			{/if}
			{#each submission.check.variables as variable (variable.variable)}
				<section
					aria-label="Variable {variable.variable}"
					class="flex flex-col gap-2 border-t pt-3"
					data-testid="variable-check"
				>
					<h3 class="font-mono text-sm font-medium">
						{variable.variable}
						<span class="font-sans font-normal text-muted-foreground">
							{variable.match ? 'matches the expected values' : 'does not match'}
						</span>
					</h3>
					{#if variable.diagnostic}
						<p class="text-sm text-danger">
							The query could not run: {variable.diagnostic}
						</p>
					{/if}
					{#if variable.sparql}
						<pre class="overflow-x-auto rounded-md bg-muted p-2 text-xs"><code
								>{variable.sparql}</code
							></pre>
					{/if}
					{#if variable.expectedCount !== null}
						<p class="text-sm text-muted-foreground">
							{variable.values.length} values{variable.truncated
								? ' (cut at the cap)'
								: ''};
							{variable.matched} of {variable.expectedCount} expected, {variable.missing}
							missing,
							{variable.extra} extra.
						</p>
					{/if}
					{#if variable.values.length}
						<ul class="flex max-h-40 flex-wrap gap-x-3 gap-y-1 overflow-y-auto text-sm">
							{#each variable.values as term, index (index)}
								<li><TermValue {term} /></li>
							{/each}
						</ul>
					{/if}
				</section>
			{/each}
			{#if submission.check.unchecked.length}
				<p class="text-sm text-muted-foreground">
					Not run: {submission.check.unchecked.join(', ')}.
				</p>
			{/if}
		</section>

		<section
			aria-labelledby="reference-title"
			class="flex min-w-0 flex-col gap-3 rounded-lg border bg-surface p-4 text-surface-foreground"
		>
			<h2 id="reference-title" class="font-medium">
				Reference, revision {summary.taskRevision}
			</h2>
			{#if reference}
				<p class="text-sm whitespace-pre-wrap" data-testid="reference-statement">
					{reference.statement}
				</p>
				<DiagramView graph={reference.referenceGraph} label="Reference diagram" />
				<pre class="overflow-x-auto rounded-md bg-muted p-2 text-xs"><code
						>{reference.referenceSparql}</code
					></pre>
				<p class="text-sm text-muted-foreground">
					{reference.expected.length} expected values ({reference.comparison}) of
					{reference.referenceQuery?.variableName ?? 'the answer variable'}.
				</p>
				<ul class="flex max-h-40 flex-wrap gap-x-3 gap-y-1 overflow-y-auto text-sm">
					{#each reference.expected as term, index (index)}
						<li><TermValue {term} /></li>
					{/each}
				</ul>
			{:else}
				<p class="text-sm text-muted-foreground" data-testid="reference-missing">
					The reference for revision {summary.taskRevision} was not kept: the task was edited
					before revisions were stored.
				</p>
			{/if}
		</section>
	</div>
</div>
